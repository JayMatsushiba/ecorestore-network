/**
 * Deterministic numerical helpers: seeded PRNG, OLS with t-tests, quantiles.
 * No external dependencies so the engine remains reproducible byte-for-byte.
 */

/** mulberry32 — small, fast, deterministic. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomNormal(rng: () => number, mean = 0, sd = 1): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return NaN;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

export function sampleSd(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) * (x - m);
  return Math.sqrt(s / (xs.length - 1));
}

/** Linear-interpolated quantile, q in [0,1]. */
export function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return s[lo]!;
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

export interface OlsResult {
  beta: number[];
  se: number[];
  tStat: number[];
  pValue: number[];
  n: number;
  dof: number;
  sigma2: number;
}

/**
 * Ordinary least squares via normal equations with Gaussian elimination.
 * X: n rows × p columns (row-major array of rows). Returns coefficient
 * estimates, standard errors and two-sided t-test p-values.
 */
export function ols(X: number[][], y: number[]): OlsResult {
  const n = X.length;
  const p = X[0]?.length ?? 0;
  if (n === 0 || p === 0 || y.length !== n) throw new Error('ols: bad dimensions');
  const xtx: number[][] = Array.from({ length: p }, () => Array<number>(p).fill(0));
  const xty: number[] = Array<number>(p).fill(0);
  for (let i = 0; i < n; i++) {
    const row = X[i]!;
    for (let a = 0; a < p; a++) {
      xty[a]! += row[a]! * y[i]!;
      for (let b = 0; b < p; b++) xtx[a]![b]! += row[a]! * row[b]!;
    }
  }
  const inv = invert(xtx);
  const beta = inv.map((r) => r.reduce((s, v, j) => s + v * xty[j]!, 0));
  let rss = 0;
  for (let i = 0; i < n; i++) {
    const row = X[i]!;
    let yhat = 0;
    for (let a = 0; a < p; a++) yhat += row[a]! * beta[a]!;
    rss += (y[i]! - yhat) ** 2;
  }
  const dof = n - p;
  const sigma2 = dof > 0 ? rss / dof : NaN;
  const se = beta.map((_, a) => Math.sqrt(sigma2 * inv[a]![a]!));
  const tStat = beta.map((b, a) => b / se[a]!);
  const pValue = tStat.map((t) => (dof > 0 ? 2 * (1 - studentTCdf(Math.abs(t), dof)) : NaN));
  return { beta, se, tStat, pValue, n, dof, sigma2 };
}

function invert(m: number[][]): number[][] {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r]![col]!) > Math.abs(a[pivot]![col]!)) pivot = r;
    if (Math.abs(a[pivot]![col]!) < 1e-12) throw new Error('ols: singular design matrix');
    [a[col], a[pivot]] = [a[pivot]!, a[col]!];
    const pv = a[col]![col]!;
    for (let c = 0; c < 2 * n; c++) a[col]![c]! /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r]![col]!;
      if (f === 0) continue;
      for (let c = 0; c < 2 * n; c++) a[r]![c]! -= f * a[col]![c]!;
    }
  }
  return a.map((row) => row.slice(n));
}

/** Student t CDF via the regularised incomplete beta function. */
export function studentTCdf(t: number, dof: number): number {
  const x = dof / (dof + t * t);
  const ib = regularizedIncompleteBeta(x, dof / 2, 0.5);
  return t >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
}

/** Regularised incomplete beta I_x(a, b) via Lentz's continued fraction (NR §6.4). */
export function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  // The continued fraction converges fast only for x < (a+1)/(a+b+2); use symmetry otherwise.
  if (x > (a + 1) / (a + b + 2)) return 1 - regularizedIncompleteBeta(1 - x, b, a);
  const lbeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;
  const fpmin = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < fpmin) d = fpmin;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-14) break;
  }
  return front * h;
}

function lnGamma(z: number): number {
  const g = 7;
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let x = coef[0]!;
  for (let i = 1; i < g + 2; i++) x += coef[i]! / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Days since 1970-01-01 for an ISO date or datetime string. */
export function dayNumber(iso: string): number {
  return Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso) / 86_400_000;
}

/** Fractional years since 2000-01-01, used as the OLS time axis. */
export function yearsSince2000(iso: string): number {
  return (dayNumber(iso) - dayNumber('2000-01-01')) / 365.25;
}

export function dayOfYear(iso: string): number {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return (d.getTime() - start) / 86_400_000;
}
