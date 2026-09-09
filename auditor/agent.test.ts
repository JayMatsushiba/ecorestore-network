import { describe, expect, it } from 'vitest';
import { verify } from '../verification/engine.js';
import { loadEvidenceBundle } from '../verification/fixtures.js';
import { injectSyntheticEffect } from '../verification/scenario.js';
import { audit, detectAnomalies } from './agent.js';

const { parcel, plan, evidence } = loadEvidenceBundle();
const real = verify({ projectId: 'p', parcel, plan, evidence, runIndex: 1, computedAt: '2026-09-10T00:00:00Z' });
const clean = { verificationRunCount: 1, submittedResultCount: 1, priorReversals: 0, priorClaims: [] };

describe('auditor boundary', () => {
  it('flags eleven runs behind one submitted result', () => {
    const a = detectAnomalies(real, evidence, { ...clean, verificationRunCount: 11 });
    expect(a.find((x) => x.code === 'RUN_COUNT')?.severity).toBe('critical');
  });

  it('flags a synthetic Tier 0 as critical', () => {
    const r = verify({ projectId: 'p', parcel, plan, evidence: { ...evidence, tier0: injectSyntheticEffect(evidence.tier0, plan, 0.25) }, runIndex: 1, computedAt: '2026-09-10T00:00:00Z' });
    const a = detectAnomalies(r, evidence, clean);
    expect(a.some((x) => x.code === 'SYNTHETIC_TIER0' && x.severity === 'critical')).toBe(true);
  });

  it('copies numbers from the result and never invents them', () => {
    const report = audit(real, evidence, clean);
    expect(report.settledQuantity).toBe(real.settledQuantity);
    expect(report.resultHash).toBe(real.resultHash);
    expect(report.boundary.llmUsed).toBe(false);
    expect(report.narrative).toContain(real.verificationStatus);
    expect(report.narrative).toContain('SIMULATED DEMONSTRATION DATA');
    expect(report.narrative).toContain(String(real.claimedQuantity));
  });
});
