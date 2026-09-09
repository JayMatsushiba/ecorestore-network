import { describe, expect, it } from 'vitest';
import { keccakOf } from './canonical.js';
import { verify, type EngineInput } from './engine.js';
import { loadEvidenceBundle } from './fixtures.js';
import type { AnalysisPlan, Tier0Snapshot } from './models.js';
import { injectSyntheticEffect } from './scenario.js';

const FIXED_TIME = '2026-09-10T00:00:00Z';
/** Injected ΔNDVI for the labelled sensitivity scenario; must clear the conservative interval. */
export const SCENARIO_DELTA = 0.25;

function baseInput(overrides: Partial<EngineInput> = {}): EngineInput {
  const { parcel, plan, evidence } = loadEvidenceBundle();
  return { projectId: 'kootenay-demo', parcel, plan, evidence, runIndex: 1, computedAt: FIXED_TIME, ...overrides };
}

describe('verification engine on the REAL Kootenay snapshot', () => {
  const input = baseInput();
  const result = verify(input);

  it('is deterministic: identical inputs give identical result hashes', () => {
    const again = verify(baseInput());
    expect(again.resultHash).toBe(result.resultHash);
    expect(again).toEqual(result);
  });

  it('commits to the plan, the parcel identity and real Tier 0 provenance', () => {
    expect(result.analysisPlanHash).toBe(keccakOf(input.plan));
    expect(result.geometryHash).toBe(input.evidence.tier0.geometryHash);
    expect(result.parcelH3Root).toBe(input.evidence.tier0.h3Root);
    expect(result.tier0Provenance.provenance).toBe('REAL');
    expect(result.stacSceneIds.length).toBeGreaterThan(30);
    expect(result.stacSceneIds.every((id) => /^S2[ABC]_11UNQ_\d{8}_\d_L2A$/.test(id))).toBe(true);
    expect(result.processingGraphVersion).toBe('1.0.0');
  });

  it('draws controls by the committed rule and passes the parallel-trend diagnostic', () => {
    const far = result.controlSets.find((c) => c.ring === 'far')!;
    const near = result.controlSets.find((c) => c.ring === 'near')!;
    expect(far.matched).toBeGreaterThanOrEqual(input.plan.controlRule.matching.minMatched);
    expect(far.matched).toBeLessThanOrEqual(input.plan.controlRule.matching.k);
    expect(near.matched).toBeGreaterThan(0);
    expect(result.parallelTrend.status).toBe('PASS');
    expect(result.parallelTrend.pValue).toBeGreaterThanOrEqual(input.plan.parallelTrend.alpha);
  });

  it('reports an interval, not a bare number, and the empirical coverage', () => {
    const { lower, upper } = result.uncertainty.interval;
    expect(lower).toBeLessThan(upper);
    expect(result.lowerBound).toBe(lower);
    expect(result.uncertainty.empiricalCoverage.placebos).toBeGreaterThan(10);
    expect(result.uncertainty.empiricalCoverage.empirical).not.toBeNull();
    expect(result.uncertainty.empiricalCoverage.basis).toMatch(/REAL Tier 0/);
  });

  it('does not settle when the lower bound is not above zero — no intervention took place here', () => {
    expect(['NOT_ADDITIONAL', 'PARTIAL', 'VERIFIED']).toContain(result.verificationStatus);
    if (result.verificationStatus === 'NOT_ADDITIONAL') {
      expect(result.settledQuantity).toBe(0);
      expect(result.lowerBound).toBeLessThanOrEqual(0);
    } else {
      expect(result.settledQuantity).toBeLessThanOrEqual(result.lowerBound);
    }
    expect(result.settledQuantity).toBeLessThanOrEqual(result.claimedQuantity);
  });

  it('labels simulated tiers as simulated everywhere they appear', () => {
    for (const t of result.tierCorroboration) {
      if (t.tier === 0) expect(t.provenance).toBe('REAL');
      else expect(t.provenance).toBe('SIMULATED');
    }
    expect(result.simulatedTiersBanner).toMatch(/SIMULATED DEMONSTRATION DATA/);
    const nativeGate = result.qualityGate.gates.find((g) => g.name === 'native_species_fraction')!;
    expect(nativeGate.provenance).toBe('SIMULATED');
  });

  it('the near/far divergence is reported as leakage and deducted', () => {
    const m = result.measured;
    expect(m.leakageIndex).toBeGreaterThanOrEqual(0);
    // Components are independently rounded to 4 decimals, so allow one unit in the last place.
    expect(m.additionalBiophysicalIndex).toBeCloseTo(m.didIndex - m.leakageIndex, 3);
    expect(m.didIndex).toBeCloseTo(m.parcelChangeIndex - m.controlChangeFarRingIndex, 3);
  });
});

describe('failure modes', () => {
  it('parallel-trend failure → INSUFFICIENT_EVIDENCE and no settlement', () => {
    const input = baseInput();
    const plan: AnalysisPlan = { ...input.plan, parallelTrend: { ...input.plan.parallelTrend, maxAbsSlopeDiffPerYear: 0.000001, alpha: 0.999 } };
    const r = verify({ ...input, plan });
    expect(r.parallelTrend.status).toBe('FAIL');
    expect(r.verificationStatus).toBe('INSUFFICIENT_EVIDENCE');
    expect(r.settledQuantity).toBe(0);
    expect(r.analysisPlanHash).not.toBe(keccakOf(input.plan));
  });

  it('too few usable scenes → INSUFFICIENT_EVIDENCE', () => {
    const input = baseInput();
    const plan: AnalysisPlan = { ...input.plan, minScenesPerWindow: 500 };
    const r = verify({ ...input, plan });
    expect(r.verificationStatus).toBe('INSUFFICIENT_EVIDENCE');
    expect(r.qualityGate.gates.filter((g) => g.name.startsWith('scenes:')).every((g) => g.status === 'FAIL')).toBe(true);
  });

  it('too few matched controls → INSUFFICIENT_EVIDENCE', () => {
    const input = baseInput();
    const plan: AnalysisPlan = { ...input.plan, controlRule: { ...input.plan.controlRule, matching: { ...input.plan.controlRule.matching, caliperSd: 0.0001 } } };
    const r = verify({ ...input, plan });
    expect(r.verificationStatus).toBe('INSUFFICIENT_EVIDENCE');
    expect(r.parallelTrend.status).toBe('NOT_EVALUATED');
  });

  it('a non-REAL Tier 0 snapshot without a synthetic-effect note is rejected', () => {
    const input = baseInput();
    const tier0 = { ...input.evidence.tier0, provenance: 'SIMULATED' } as Tier0Snapshot;
    expect(() => verify({ ...input, evidence: { ...input.evidence, tier0 } })).toThrow(/syntheticEffectNote/);
  });
});

describe('synthetic treatment-effect scenario (SIMULATED Tier 0, labelled)', () => {
  const input = baseInput();
  const tier0 = injectSyntheticEffect(input.evidence.tier0, input.plan, SCENARIO_DELTA);
  const r = verify({ ...input, evidence: { ...input.evidence, tier0 } });

  it('is labelled SIMULATED at Tier 0 and in the corroboration table', () => {
    expect(r.tier0Provenance.provenance).toBe('SIMULATED');
    expect(r.tier0Provenance.note).toMatch(/SYNTHETIC/);
    expect(r.tierCorroboration[0]!.provenance).toBe('SIMULATED');
  });

  it('settles at the lower bound, below the point estimate and below the claim', () => {
    expect(r.verificationStatus).toBe('PARTIAL');
    expect(r.settledQuantity).toBeGreaterThan(0);
    expect(r.settledQuantity).toBe(r.lowerBound);
    expect(r.lowerBound).toBeLessThan(r.measured.additionalBiophysicalHa);
    expect(r.settledQuantity).toBeLessThan(r.claimedQuantity);
  });

  it('gate failure on native species fraction → GATE_FAILED with no settlement', () => {
    const { evidence } = loadEvidenceBundle({ nativeSpeciesFraction: 0.5 });
    const r2 = verify({ ...input, evidence: { ...evidence, tier0 } });
    expect(r2.qualityGate.gates.find((g) => g.name === 'native_species_fraction')!.status).toBe('FAIL');
    expect(r2.verificationStatus).toBe('GATE_FAILED');
    expect(r2.settledQuantity).toBe(0);
  });
});
