"""Decode mainnet payment script credentials; never match stake credentials."""

ALPHABET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"


def _polymod(values: list[int]) -> int:
    checksum = 1
    generators = (0x3B6A57B2, 0x26508E6D, 0x1EA119FA, 0x3D4233DD, 0x2A1462B3)
    for value in values:
        top = checksum >> 25
        checksum = ((checksum & 0x1FFFFFF) << 5) ^ value
        for index, generator in enumerate(generators):
            if (top >> index) & 1:
                checksum ^= generator
    return checksum


def payment_script_hash(address: str) -> str | None:
    if not isinstance(address, str) or address.lower() != address and address.upper() != address:
        return None
    address = address.lower()
    separator = address.rfind("1")
    if separator < 1 or address[:separator] != "addr":
        return None
    try:
        values = [ALPHABET.index(char) for char in address[separator + 1:]]
    except ValueError:
        return None
    hrp = address[:separator]
    expanded = [ord(char) >> 5 for char in hrp] + [0] + [ord(char) & 31 for char in hrp]
    if len(values) < 7 or _polymod(expanded + values) != 1:
        return None
    accumulator = bits = 0
    result = bytearray()
    for value in values[:-6]:
        accumulator = (accumulator << 5) | value
        bits += 5
        while bits >= 8:
            bits -= 8
            result.append((accumulator >> bits) & 255)
        accumulator &= (1 << bits) - 1
    if bits >= 5 or accumulator:
        return None
    if not result or result[0] & 15 != 1:
        return None
    address_type = result[0] >> 4
    if address_type not in (1, 3, 5, 7):
        return None
    expected_length = 57 if address_type in (1, 3) else 29 if address_type == 7 else None
    if expected_length is not None and len(result) != expected_length:
        return None
    if address_type == 5 and len(result) < 32:
        return None
    return bytes(result[1:29]).hex()
