"""WingRiders dex-serializer acc572a40acc498a8843db79e2d3afa409f509b1.

V1 constant-product and stableswap requests share RequestDatumV1 metadata.
The owner is the explicit key, not an arbitrary beneficiary. Stake grouping is
used only when the beneficiary payment key matches that owner.
"""
from ..wallets import Participant, constructor, address_credentials
from ..wallet_methods import ADAPTER_VERSIONS
from . import reference


class WingRidersWalletAdapter:
    slug = 'wingriders'
    version = ADAPTER_VERSIONS[slug]

    def __init__(self, registry):
        project = next(p for p in registry['projects'] if p['slug']==self.slug)
        self.order_scripts = {s['hash']:('V1-stableswap' if 'stableswap' in s['role'] else 'V1')
                              for s in project['scripts'] if 'request' in s['role']}

    def participant(self, family, datum):
        root,f = constructor(datum)
        if family not in ('V1','V1-stableswap') or root!=0 or len(f)!=2:raise ValueError('Invalid WingRiders request')
        m,metadata = constructor(f[0])
        if m!=0 or len(metadata)!=4 or not isinstance(metadata[1],bytes) or type(metadata[2]) is not int:
            raise ValueError('Invalid WingRiders request metadata')
        action,_ = constructor(f[1])
        if action not in (0,1,2):raise ValueError('Invalid request action')
        kind,payment,stake = address_credentials(metadata[0])
        owner = metadata[1].hex()
        return Participant('identified',owner,stake if kind==0 and payment==owner else None)

    def reference_participant(self, family, datum):
        try:
            if family not in ('V1','V1-stableswap'):raise ValueError('Unsupported family')
            metadata,action = reference.fields(datum,0,2)
            beneficiary,owner,deadline,_ = reference.fields(metadata,0,4)
            if action['constructor'] not in (0,1,2) or type(deadline['int']) is not int:raise ValueError('Invalid request')
            owner = reference.key(owner)
            kind,payment,stake = reference.address(beneficiary)
            return Participant('identified',owner,stake if kind==0 and payment==owner else None)
        except (KeyError,ValueError,TypeError,IndexError):return Participant('unrecognized_datum')
