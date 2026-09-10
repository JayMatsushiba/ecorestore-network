"""Receipt verification only.

This module hashes *opaque bytes it was handed*; it never serialises a
document. Exactly one implementation (``verification/canonical.ts``) turns a
document into bytes — see ``docs/DEPLOYMENT.md`` §7.1.
"""

from __future__ import annotations

from Crypto.Hash import keccak


def keccak256_hex(data: bytes) -> str:
    h = keccak.new(digest_bits=256)
    h.update(data)
    return "0x" + h.hexdigest()


class ReceiptMismatch(ValueError):
    pass


def check_receipt(label: str, canonical: str, expected_hash: str) -> None:
    got = keccak256_hex(canonical.encode("utf-8"))
    if got != expected_hash.lower():
        raise ReceiptMismatch(f"{label}: keccak of the bytes received is {got}, receipt says {expected_hash}")
