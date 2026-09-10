"""Numerical helpers mirroring ``verification/stats.ts``.

Sums are sequential (``sum`` over a Python list is left-to-right in float64),
matching the reference loops rather than numpy's pairwise summation, so the
last bit agrees. The regression and the t-distribution use numpy and scipy —
the conventional tools — and agree with the reference to well inside the six
decimals the diagnostic reports.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone

import numpy as np
from scipy import stats as sps

_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


def seq_sum(xs) -> float:
    """Left-to-right float64 accumulation. Python 3.12's built-in ``sum`` uses
    compensated (Neumaier) summation for floats, which is *more* accurate than
    the reference and therefore does not reproduce it."""
    s = 0.0
    for x in xs:
        s += x
    return s


def mean(xs: list[float]) -> float:
    if not xs:
        return math.nan
    return seq_sum(xs) / len(xs)


def median(xs: list[float]) -> float:
    if not xs:
        return math.nan
    s = sorted(xs)
    mid = len(s) // 2
    return (s[mid - 1] + s[mid]) / 2 if len(s) % 2 == 0 else s[mid]


def sample_sd(xs: list[float]) -> float:
    if len(xs) < 2:
        return math.nan
    m = mean(xs)
    s = 0.0
    for x in xs:
        s += (x - m) * (x - m)
    return math.sqrt(s / (len(xs) - 1))


def quantile(xs: list[float] | np.ndarray, q: float) -> float:
    """Linear-interpolated quantile, identical to the reference."""
    n = len(xs)
    if n == 0:
        return math.nan
    s = sorted(float(x) for x in xs)
    pos = (n - 1) * q
    lo = math.floor(pos)
    hi = math.ceil(pos)
    if lo == hi:
        return s[lo]
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


@dataclass
class OlsResult:
    beta: np.ndarray
    se: np.ndarray
    t_stat: np.ndarray
    p_value: np.ndarray
    n: int
    dof: int
    sigma2: float


def ols(X: np.ndarray, y: np.ndarray) -> OlsResult:
    """OLS via the normal equations with two-sided t-tests.

    Raises ``numpy.linalg.LinAlgError`` on a singular design.
    """
    n, p = X.shape
    if n == 0 or p == 0 or y.shape[0] != n:
        raise ValueError("ols: bad dimensions")
    xtx = X.T @ X
    xty = X.T @ y
    inv = np.linalg.inv(xtx)
    if not np.all(np.isfinite(inv)):
        raise np.linalg.LinAlgError("singular design matrix")
    beta = inv @ xty
    resid = y - X @ beta
    rss = float(resid @ resid)
    dof = n - p
    sigma2 = rss / dof if dof > 0 else math.nan
    se = np.sqrt(sigma2 * np.diag(inv))
    t_stat = beta / se
    p_value = 2 * sps.t.sf(np.abs(t_stat), dof) if dof > 0 else np.full(p, math.nan)
    return OlsResult(beta, se, t_stat, p_value, n, dof, sigma2)


def _epoch_ms(iso: str) -> int:
    """``Date.parse`` in milliseconds for the ISO forms the snapshot uses."""
    s = iso if len(iso) > 10 else f"{iso}T00:00:00Z"
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    td = dt - _EPOCH
    return td.days * 86_400_000 + td.seconds * 1000 + td.microseconds // 1000


def day_number(iso: str) -> float:
    return _epoch_ms(iso) / 86_400_000


_DAY_2000 = day_number("2000-01-01")


def years_since_2000(iso: str) -> float:
    return (day_number(iso) - _DAY_2000) / 365.25


def day_of_year(iso: str) -> float:
    ms = _epoch_ms(iso)
    year = datetime.fromisoformat((iso if len(iso) > 10 else f"{iso}T00:00:00Z").replace("Z", "+00:00")).year
    start = _epoch_ms(f"{year:04d}-01-01")
    return (ms - start) / 86_400_000
