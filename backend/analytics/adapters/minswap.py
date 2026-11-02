"""Order-owner attribution pinned to minswap/sdk ccf8fe740a7f56b7bda7f973596cbf6577871985."""
from ..wallets import Participant, constructor, address_credentials
from ..wallet_methods import ADAPTER_VERSIONS


class MinswapWalletAdapter:
    slug = 'minswap'
    version = ADAPTER_VERSIONS['minswap']

    def __init__(self, registry):
        project = next(p for p in registry['projects'] if p['slug'] == self.slug)
        self.order_scripts = {s['hash']: s['role'].split()[0] for s in project['scripts'] if 'order' in s['role']}

    def participant(self, family, datum):
        kind, fields = constructor(datum)
        if kind != 0:
            raise ValueError('Invalid order constructor')
        if family in ('V1', 'Stableswap'):
            # The pinned SDK reads the six-field prefix and permits trailing
            # extension fields. Real V1 orders also use that extended form.
            if len(fields) < 6:
                raise ValueError('Invalid V1/stableswap order field count')
            payment_kind, payment, stake = address_credentials(fields[0])
            address_credentials(fields[1])
            step, _ = constructor(fields[3])
            if step not in range(5) or any(type(x) is not int or x < 0 for x in fields[4:6]):
                raise ValueError('Invalid order step or fee fields')
            return Participant('script_controlled') if payment_kind else Participant('identified', payment, stake)
        if family == 'V2':
            if len(fields) != 9:
                raise ValueError('Invalid V2 order field count')
            auth, auth_fields = constructor(fields[0])
            if auth not in range(4) or len(auth_fields) != 1 or not isinstance(auth_fields[0], bytes) or len(auth_fields[0]) != 28:
                raise ValueError('Invalid V2 authorization method')
            refund_kind, refund, stake = address_credentials(fields[1])
            address_credentials(fields[3])
            step, _ = constructor(fields[6])
            if step not in range(11) or type(fields[7]) is not int or fields[7] < 0:
                raise ValueError('Invalid V2 order step or fee')
            if auth != 0:
                return Participant('script_controlled')
            payment = auth_fields[0].hex()
            # A third-party refund recipient is not the order owner. Use the
            # authorization key, with stake grouping only for a matching address.
            return Participant('identified', payment, stake if refund_kind == 0 and refund == payment else None)
        raise ValueError('Unsupported Minswap family')

    def reference_participant(self, family, value):
        """Separate decoder for the independent API's Plutus JSON representation."""
        def addr(data):
            assert data['constructor'] == 0
            pay, maybe = data['fields']
            pay_kind = pay['constructor']
            payment = pay['fields'][0]['bytes']
            stake = None
            if maybe['constructor'] == 0:
                wrapped = maybe['fields'][0]
                assert wrapped['constructor'] == 0
                cred = wrapped['fields'][0]
                if cred['constructor'] == 0:
                    stake = cred['fields'][0]['bytes']
            return pay_kind, payment, stake
        try:
            assert value['constructor'] == 0
            fields = value['fields']
            if family in ('V1', 'Stableswap'):
                assert len(fields) >= 6
                kind, payment, stake = addr(fields[0])
                return Participant('script_controlled') if kind else Participant('identified', payment, stake)
            assert family == 'V2' and len(fields) == 9
            auth = fields[0]
            if auth['constructor'] != 0:
                return Participant('script_controlled')
            payment = auth['fields'][0]['bytes']
            kind, refund, stake = addr(fields[1])
            return Participant('identified', payment, stake if not kind and refund == payment else None)
        except (KeyError, ValueError, TypeError, IndexError, AssertionError):
            return Participant('unrecognized_datum')
