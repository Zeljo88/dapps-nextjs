"""Sundae SDK e32b6e2d8a2329468c82e32d20a942dbc6d40601 owner policies.

V1 alternate signer, otherwise key stake credential then key payment credential.
V3/V4/stableswaps use only the explicit single-signature owner policy. Owner
keys may be stake or payment hashes: deduplicate as opaque authorization keys,
without interpreting an arbitrary payout address as the owner.
"""
from ..wallets import Participant, constructor, address_credentials
from ..wallet_methods import ADAPTER_VERSIONS
from . import reference


class SundaeSwapWalletAdapter:
    slug = 'sundaeswap'
    version = ADAPTER_VERSIONS[slug]

    def __init__(self, registry):
        project = next(p for p in registry['projects'] if p['slug'] == self.slug)
        self.order_scripts = {s['hash']:s['role'].split()[0] for s in project['scripts']
                              if 'order.' in s['role'] or 'escrow.' in s['role']}

    def participant(self, family, datum):
        root, f = constructor(datum)
        if root != 0:raise ValueError('Invalid Sundae order root')
        if family == 'V1':
            if len(f) != 4 or not isinstance(f[0],bytes) or type(f[2]) is not int or f[2] < 0:
                raise ValueError('Invalid Sundae V1 order')
            a, addresses = constructor(f[1])
            if a != 0 or len(addresses) != 2:raise ValueError('Invalid V1 addresses')
            d, destination = constructor(addresses[0])
            if d != 0 or len(destination) != 2:raise ValueError('Invalid V1 destination')
            kind,payment,stake = address_credentials(destination[0])
            alt, values = constructor(addresses[1])
            if alt == 0 and len(values) == 1:
                owner = values[0].hex() if isinstance(values[0],bytes) else None
            elif alt == 1 and not values:
                owner = stake or (payment if kind == 0 else None)
            else:raise ValueError('Invalid V1 alternate owner')
            return Participant('identified',owner,kind='authorization') if owner else Participant('script_controlled')
        if family not in ('V3','V4','Stableswaps') or len(f) != (7 if family == 'V4' else 6):
            raise ValueError('Invalid Sundae order family or shape')
        owner, values = constructor(f[0] if family == 'V4' else f[1])
        if owner == 0 and len(values) == 1 and isinstance(values[0],bytes):
            return Participant('identified',values[0].hex(),kind='authorization')
        if owner in range(1,7):return Participant('script_controlled')
        raise ValueError('Invalid Sundae owner policy')

    def reference_participant(self, family, datum):
        try:
            f = reference.fields(datum,0,4 if family=='V1' else 7 if family=='V4' else 6)
            if family == 'V1':
                destination, alternate = reference.fields(f[1],0,2)
                credentials,_ = reference.fields(destination,0,2)
                kind,payment,stake = reference.address(credentials)
                if alternate['constructor'] == 0:owner = reference.key(reference.fields(alternate,0,1)[0])
                else:
                    reference.fields(alternate,1,0)
                    owner = stake or (payment if kind == 0 else None)
                return Participant('identified',owner,kind='authorization') if owner else Participant('script_controlled')
            if family not in ('V3','V4','Stableswaps'):raise ValueError('Unsupported family')
            policy = f[0] if family=='V4' else f[1]
            if policy['constructor'] == 0:
                return Participant('identified',reference.key(reference.fields(policy,0,1)[0]),kind='authorization')
            if policy['constructor'] in range(1,7):return Participant('script_controlled')
            raise ValueError('Invalid owner')
        except (KeyError,ValueError,TypeError,IndexError):return Participant('unrecognized_datum')
