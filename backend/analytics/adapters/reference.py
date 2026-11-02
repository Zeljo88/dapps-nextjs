"""Independent Plutus JSON address reader for ownership sample validation."""

def fields(value, index, length):
    if value.get('constructor') != index or len(value.get('fields', [])) != length:
        raise ValueError('Unexpected JSON constructor')
    return value['fields']


def key(value):
    h = value['bytes']
    if len(bytes.fromhex(h)) != 28:
        raise ValueError('Invalid JSON key length')
    return h


def address(value):
    payment, maybe = fields(value, 0, 2)
    kind = payment['constructor']
    if kind not in (0, 1):raise ValueError('Invalid JSON credential')
    payment_key = key(fields(payment, kind, 1)[0])
    stake = None
    if maybe['constructor'] == 0:
        wrapped = fields(maybe, 0, 1)[0]
        credential = fields(wrapped, 0, 1)[0]
        stake_kind = credential['constructor']
        if stake_kind not in (0, 1):raise ValueError('Invalid JSON stake credential')
        stake_key = key(fields(credential, stake_kind, 1)[0])
        if stake_kind == 0:stake = stake_key
    else:fields(maybe, 1, 0)
    return kind, payment_key, stake
