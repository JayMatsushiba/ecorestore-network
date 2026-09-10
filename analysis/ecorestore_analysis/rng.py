"""Deterministic PRNG — an exact port of ``verification/stats.ts`` ``makeRng``.

mulberry32 keeps a 32-bit state that advances by a constant each call, so the
*n*-th output is a pure function of ``(seed, n)``. That makes the stream
vectorisable: ``stream(seed, n)`` reproduces ``n`` successive calls of the
scalar generator bit for bit, which is what lets the bootstrap run as numpy
array operations while consuming the random stream in exactly the order the
reference loop does.
"""

from __future__ import annotations

import numpy as np

MASK = 0xFFFFFFFF
_INC = 0x6D2B79F5


def imul(a: int, b: int) -> int:
    """``Math.imul`` — 32-bit wrapping multiply (sign is irrelevant under the mask)."""
    return (a * b) & MASK


class Mulberry32:
    """Scalar generator; ``__call__`` returns a float in [0, 1)."""

    def __init__(self, seed: int) -> None:
        self.a = seed & MASK

    def __call__(self) -> float:
        self.a = (self.a + _INC) & MASK
        t = self.a
        t = imul(t ^ (t >> 15), t | 1)
        t ^= (t + imul(t ^ (t >> 7), t | 61)) & MASK
        return ((t ^ (t >> 14)) & MASK) / 4294967296.0


def stream(seed: int, n: int) -> np.ndarray:
    """The first ``n`` outputs of ``Mulberry32(seed)`` as a float64 array."""
    if n == 0:
        return np.zeros(0, dtype=np.float64)
    i = np.arange(1, n + 1, dtype=np.uint64)
    a = ((np.uint64(seed & MASK) + i * np.uint64(_INC)) & np.uint64(MASK)).astype(np.uint32)
    with np.errstate(over="ignore"):
        t = (a ^ (a >> np.uint32(15))) * (a | np.uint32(1))
        t ^= t + (t ^ (t >> np.uint32(7))) * (t | np.uint32(61))
        out = t ^ (t >> np.uint32(14))
    return out.astype(np.float64) / 4294967296.0


def random_normal(rng: Mulberry32, mean: float = 0.0, sd: float = 1.0) -> float:
    """Box–Muller as in ``stats.ts``: two nonzero uniforms, one normal."""
    u = 0.0
    v = 0.0
    while u == 0.0:
        u = rng()
    while v == 0.0:
        v = rng()
    return mean + sd * np.sqrt(-2.0 * np.log(u)) * np.cos(2.0 * np.pi * v)


def fnv1a32(s: str) -> int:
    """``hashId`` in ``engine.ts`` — FNV-1a over UTF-16 code units (ASCII here)."""
    h = 2166136261
    for ch in s:
        h = imul(h ^ ord(ch), 16777619)
    return h & MASK
