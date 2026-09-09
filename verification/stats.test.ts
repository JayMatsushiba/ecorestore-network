import { describe, expect, it } from 'vitest';
import { makeRng, mean, median, ols, quantile, randomNormal, regularizedIncompleteBeta, sampleSd, studentTCdf } from './stats.js';

describe('stats', () => {
  it('rng is deterministic for a seed', () => {
    const a = makeRng(7);
    const b = makeRng(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('normal draws have the requested moments', () => {
    const rng = makeRng(1);
    const xs = Array.from({ length: 20_000 }, () => randomNormal(rng, 2, 0.5));
    expect(mean(xs)).toBeCloseTo(2, 1);
    expect(sampleSd(xs)).toBeCloseTo(0.5, 1);
  });

  it('median and quantile', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75);
  });

  it('student t cdf matches known values', () => {
    expect(studentTCdf(0, 10)).toBeCloseTo(0.5, 6);
    expect(studentTCdf(2.228, 10)).toBeCloseTo(0.975, 3);
    expect(studentTCdf(-1.96, 1000)).toBeCloseTo(0.025, 2);
    expect(regularizedIncompleteBeta(0.5, 2, 2)).toBeCloseTo(0.5, 6);
  });

  it('ols recovers a known linear model with interaction', () => {
    const rng = makeRng(3);
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 400; i++) {
      const t = rng() * 4;
      const treated = i % 2;
      X.push([1, t, treated, t * treated]);
      y.push(0.3 + 0.05 * t + 0.1 * treated + 0.02 * t * treated + randomNormal(rng, 0, 0.01));
    }
    const fit = ols(X, y);
    expect(fit.beta[0]).toBeCloseTo(0.3, 2);
    expect(fit.beta[1]).toBeCloseTo(0.05, 2);
    expect(fit.beta[2]).toBeCloseTo(0.1, 2);
    expect(fit.beta[3]).toBeCloseTo(0.02, 2);
    expect(fit.pValue[3]).toBeLessThan(0.001);
  });

  it('ols interaction p-value is large when there is no divergence', () => {
    const rng = makeRng(11);
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 400; i++) {
      const t = rng() * 4;
      const treated = i % 2;
      X.push([1, t, treated, t * treated]);
      y.push(0.3 + 0.05 * t + randomNormal(rng, 0, 0.05));
    }
    expect(ols(X, y).pValue[3]).toBeGreaterThan(0.05);
  });
});
