"""Number helpers that reproduce JavaScript semantics where the reference
engine's output depends on them: ``Math.round`` (ties toward +∞) and
``Number.prototype.toString`` (decimal notation between 1e-7 and 1e21).
"""

from __future__ import annotations

import math
from fractions import Fraction


def js_round(x: float) -> float:
    """``Math.round``: nearest integer, ties toward +∞. Exact via rationals."""
    if not math.isfinite(x):
        return x
    f = math.floor(x)
    return float(f + 1) if Fraction(x) - f >= Fraction(1, 2) else float(f)


def round4(x: float | None) -> float | None:
    if x is None or not math.isfinite(x):
        return x
    return js_round(x * 10_000) / 10_000


def round6(x: float | None) -> float | None:
    if x is None or not math.isfinite(x):
        return x
    return js_round(x * 1_000_000) / 1_000_000


def js_number_to_string(x: float) -> str:
    """``String(x)`` for a finite JavaScript number."""
    if x != x:
        return "NaN"
    if x == 0:
        return "0"
    if x == int(x) and abs(x) < 1e21:
        return str(int(x))
    sign = "-" if x < 0 else ""
    r = repr(abs(x))
    if "e" in r:
        mant, exp = r.split("e")
        e = int(exp)
    else:
        mant, e = r, 0
    if "." in mant:
        ip, fp = mant.split(".")
    else:
        ip, fp = mant, ""
    digits = (ip + fp).lstrip("0")
    # value = 0.<digits> × 10^n
    n = len(ip.lstrip("0")) + e if ip.strip("0") else e - (len(fp) - len(fp.lstrip("0")))
    digits = digits.rstrip("0") or "0"
    k = len(digits)
    if k <= n <= 21:
        return sign + digits + "0" * (n - k)
    if 0 < n <= 21:
        return sign + digits[:n] + "." + digits[n:]
    if -6 < n <= 0:
        return sign + "0." + "0" * (-n) + digits
    exp_sign = "+" if n - 1 >= 0 else "-"
    if k == 1:
        return f"{sign}{digits}e{exp_sign}{abs(n - 1)}"
    return f"{sign}{digits[0]}.{digits[1:]}e{exp_sign}{abs(n - 1)}"
