"""Shared datum decoding and epoch wallet identity aggregation.

Adapters identify participants; this module deduplicates them without treating
wallet credentials as people. All credential rows are temporary working data.
"""
from dataclasses import dataclass
import hashlib
import io

import cbor2
from .wallet_methods import METHOD


def constructor(value):
    if not isinstance(value, cbor2.CBORTag):
        raise ValueError('Expected Plutus constructor')
    tag = value.tag
    if 121 <= tag <= 127:
        index, fields = tag - 121, value.value
    elif 1280 <= tag <= 1400:
        index, fields = tag - 1280 + 7, value.value
    elif tag == 102 and isinstance(value.value, (list, tuple)) and len(value.value) == 2:
        index, fields = value.value
    else:
        raise ValueError('Unsupported Plutus constructor tag')
    if type(index) is not int or not isinstance(fields, (list, tuple)):
        raise ValueError('Invalid constructor fields')
    return index, fields


def decode(hexadecimal):
    data = bytes.fromhex(hexadecimal)
    if not data or len(data) > 65536:
        raise ValueError('Datum size outside supported bounds')
    stream = io.BytesIO(data)
    value = cbor2.CBORDecoder(stream, max_depth=64, allow_duplicate_keys=False).decode()
    if stream.read():
        raise ValueError('Trailing CBOR data')
    return value


def credential(value):
    kind, fields = constructor(value)
    if kind not in (0, 1) or len(fields) != 1 or not isinstance(fields[0], bytes) or len(fields[0]) != 28:
        raise ValueError('Invalid credential')
    return kind, fields[0].hex()


def address_credentials(value):
    kind, fields = constructor(value)
    if kind != 0 or len(fields) != 2:
        raise ValueError('Invalid Plutus address')
    payment_kind, payment = credential(fields[0])
    maybe, stake_fields = constructor(fields[1])
    stake = None
    if maybe == 0 and len(stake_fields) == 1:
        stake_kind, wrapped = constructor(stake_fields[0])
        if stake_kind != 0 or len(wrapped) != 1:
            raise ValueError('Unsupported pointer stake reference')
        credential_kind, stake_value = credential(wrapped[0])
        if credential_kind == 0:
            stake = stake_value
    elif maybe != 1 or stake_fields:
        raise ValueError('Invalid optional stake credential')
    return payment_kind, payment, stake


@dataclass(frozen=True)
class Participant:
    status: str
    payment: str | None = None
    stake: str | None = None
    kind: str = 'payment'

    def __post_init__(self):
        if self.kind not in {'payment', 'authorization'}:
            raise ValueError('Unknown participant credential kind')
        if self.kind == 'authorization' and self.stake is not None:
            raise ValueError('An untyped authorization key cannot claim a stake link')
        if self.status not in {'identified','script_controlled','unrecognized_datum','missing_datum','unavailable_datum'}:
            raise ValueError('Unknown wallet attribution status')
        if self.status == 'identified':
            if not self.payment or len(bytes.fromhex(self.payment)) != 28 or (self.stake and len(bytes.fromhex(self.stake)) != 28):
                raise ValueError('Invalid participant credential length')
        elif self.payment is not None or self.stake is not None:
            raise ValueError('Unattributed orders cannot carry a wallet identity')

    @property
    def key(self):
        # Keep untyped protocol authorization keys distinct from payment keys;
        # the schema stores an opaque credential token, never a guessed role.
        return ('authorization:' + self.payment if self.kind == 'authorization' else self.payment) if self.payment else None


SCHEMA = '''
CREATE TABLE IF NOT EXISTS wallet_orders(
 ref TEXT PRIMARY KEY,slot INTEGER NOT NULL REFERENCES blocks(slot) ON DELETE CASCADE,
 dapp TEXT NOT NULL,family TEXT NOT NULL,script TEXT NOT NULL,tx TEXT NOT NULL,output_index INTEGER NOT NULL,
 datum_hash TEXT,datum TEXT,status TEXT NOT NULL,payment TEXT,stake TEXT);
CREATE INDEX IF NOT EXISTS wallet_orders_dapp ON wallet_orders(dapp,status,payment);
'''


class WalletCollector:
    def __init__(self, adapters, script_hash):
        self.adapters = {a.slug: a for a in adapters}
        self.scripts = {script: (a, family) for a in adapters for script, family in a.order_scripts.items()}
        if len(self.adapters) != len(adapters) or len(self.scripts) != sum(len(a.order_scripts) for a in adapters):
            raise ValueError('Adapters must have distinct DApp names and script mappings')
        self.script_hash = script_hash

    def ingest(self, db, block):
        for tx in block.get('transactions', []):
            if tx.get('spends') != 'inputs':
                continue
            for index, output in enumerate(tx.get('outputs', [])):
                script = self.script_hash(output['address'])
                if script not in self.scripts:
                    continue
                adapter, family = self.scripts[script]
                datum = output.get('datum')
                advertised_hash = output.get('datumHash')
                if datum is None and advertised_hash:
                    datum = tx.get('datums', {}).get(advertised_hash)
                actual_hash = hashlib.blake2b(bytes.fromhex(datum), digest_size=32).hexdigest() if datum else advertised_hash
                if datum and advertised_hash and actual_hash != advertised_hash:
                    raise ValueError('Order datum hash does not match the node witness')
                participant = self.identify(adapter, family, datum)
                db.execute('INSERT INTO wallet_orders VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
                    (f"{tx['id']}#{index}", block['slot'], adapter.slug, family, script, tx['id'], index,
                     actual_hash, datum, participant.status, participant.key, participant.stake))

    @staticmethod
    def identify(adapter, family, datum):
        if not datum:
            return Participant('missing_datum')
        try:
            return adapter.participant(family, decode(datum))
        except (ValueError, TypeError, IndexError, cbor2.CBORDecodeError):
            return Participant('unrecognized_datum')


def aggregate(db, slug):
    rows = db.execute('SELECT payment,stake,family,status FROM wallet_orders WHERE dapp=?', (slug,)).fetchall()
    aliases = {}
    for payment, stake, _, status in rows:
        if status == 'identified' and stake:
            aliases.setdefault(payment, set()).add(stake)
    identities = set()
    families = {}
    statuses = {}
    for payment, _, family, status in rows:
        statuses[status] = statuses.get(status, 0) + 1
        if status != 'identified':
            continue
        known = aliases.get(payment, set())
        identity = 'stake:' + next(iter(known)) if len(known) == 1 else 'payment:' + payment
        identities.add(identity)
        families.setdefault(family, set()).add(identity)
    sql_count = db.execute('''WITH aliases AS (
      SELECT payment,COUNT(DISTINCT stake) AS n,MIN(stake) AS stake FROM wallet_orders
      WHERE dapp=? AND status='identified' GROUP BY payment)
      SELECT COUNT(DISTINCT CASE WHEN a.n=1 THEN 'stake:'||a.stake ELSE 'payment:'||o.payment END)
      FROM wallet_orders o JOIN aliases a ON a.payment=o.payment
      WHERE o.dapp=? AND o.status='identified' ''', (slug, slug)).fetchone()[0]
    if sql_count != len(identities):
        raise ValueError('Independent SQL/Python wallet aggregation disagrees')
    if statuses.get('missing_datum', 0):
        raise ValueError('Unresolved order datums must be resolved before publication')
    total = len(rows)
    attributed = statuses.get('identified', 0)
    return {'activeWallets': sql_count, 'walletActivity': {
        'method': METHOD, 'candidateOrderOutputs': total, 'attributedOrderOutputs': attributed,
        'scriptControlledOrderOutputs': statuses.get('script_controlled', 0),
        'unrecognizedOrderOutputs': statuses.get('unrecognized_datum', 0),
        'unavailableDatumOrderOutputs': statuses.get('unavailable_datum', 0),
        'attributionPercent': round(100 * attributed / total, 2) if total else 100.0,
        'ambiguousPaymentKeys': sum(len(values) > 1 for values in aliases.values()),
        'familyWalletCounts': {family: len(values) for family, values in families.items()}}}
