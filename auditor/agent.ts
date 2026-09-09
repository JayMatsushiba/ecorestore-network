/**
 * Restoration Auditor — orchestration and explanation boundary (docs/AUDITOR.md).
 *
 * The Auditor explains the deterministic result; it never produces a number
 * that reaches settlement. This module contains no LLM call and no API key.
 * The `AuditorNarrator` interface is the seam an LLM narrator would implement
 * at M5; the default narrator is a deterministic template so the boundary can
 * be tested now.
 *
 * Nothing here can:
 *   - alter a VerificationResult (results are consumed read-only);
 *   - select or re-select the control set (drawn by the committed rule);
 *   - release funds (only the contract does, on the verifier's submission).
 */
import type { EvidenceBundle, VerificationResult } from '../verification/models.js';

export interface ProjectHistory {
  /** Runs recorded on-chain for the deed (VerificationRunRecorded events). */
  verificationRunCount: number;
  /** Verdicts actually submitted to the contract. */
  submittedResultCount: number;
  priorReversals: number;
  priorClaims: Array<{ claimed: number; settled: number }>;
}

export interface Anomaly {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  detail: string;
}

export interface AuditorNarrator {
  narrate(result: VerificationResult, anomalies: Anomaly[]): string;
}

export interface AuditReport {
  resultHash: VerificationResult['resultHash'];
  verificationStatus: VerificationResult['verificationStatus'];
  settledQuantity: number;
  anomalies: Anomaly[];
  narrative: string;
  boundary: {
    llmUsed: false;
    note: string;
  };
}

/** Rule-based anomaly detection over the result, the evidence and indexed history. */
export function detectAnomalies(result: VerificationResult, evidence: EvidenceBundle, history: ProjectHistory): Anomaly[] {
  const out: Anomaly[] = [];
  const hidden = history.verificationRunCount - history.submittedResultCount;
  if (hidden >= 3) {
    out.push({ code: 'RUN_COUNT', severity: 'critical', detail: `${history.verificationRunCount} verification runs recorded behind ${history.submittedResultCount} submitted result(s) — possible specification search despite pre-registration` });
  } else if (hidden > 0) {
    out.push({ code: 'RUN_COUNT', severity: 'info', detail: `${hidden} recorded run(s) without a submitted result` });
  }
  if (history.priorReversals > 0) out.push({ code: 'PRIOR_REVERSAL', severity: 'warning', detail: `${history.priorReversals} prior reversal(s) on this parcel` });
  const overshoots = history.priorClaims.filter((c) => c.settled > 0 && c.claimed / c.settled > 2).length;
  if (overshoots >= 2) out.push({ code: 'REPEATED_OVERCLAIM', severity: 'warning', detail: `${overshoots} prior claims exceeded their settled quantity by more than 2x` });

  const m = result.measured;
  if (result.claimedQuantity > 0 && m.parcelChangeHa > 0 && result.claimedQuantity / m.parcelChangeHa > 1.5) {
    out.push({ code: 'CLAIM_EXCEEDS_GROSS', severity: 'warning', detail: `claim ${result.claimedQuantity} ha exceeds gross measured parcel gain ${m.parcelChangeHa.toFixed(2)} ha by more than 50%` });
  }
  if (m.controlChangeFarRingHa > 0 && m.parcelChangeHa > 0 && m.controlChangeFarRingHa / m.parcelChangeHa > 0.5) {
    out.push({ code: 'REGIONAL_GREENING', severity: 'info', detail: `far-ring controls account for ${((m.controlChangeFarRingHa / m.parcelChangeHa) * 100).toFixed(0)}% of the gross parcel change — regional, not project, effect` });
  }
  if (m.leakageHa > 0) out.push({ code: 'LEAKAGE', severity: 'info', detail: `near ring degraded relative to far ring; ${m.leakageHa.toFixed(2)} ha deducted as leakage` });
  const cov = result.uncertainty.empiricalCoverage;
  if (cov.empirical !== null && cov.empirical < cov.nominal - 0.05) {
    out.push({ code: 'COVERAGE_BELOW_NOMINAL', severity: 'warning', detail: `empirical coverage ${cov.empirical} against nominal ${cov.nominal} over ${cov.placebos} placebos — the interval method is not yet calibrated for this metric` });
  }
  const flat = evidence.tier2.nodes.filter((n) => n.flatlined);
  if (flat.length) out.push({ code: 'IOT_FLATLINE', severity: 'info', detail: `${flat.map((n) => n.nodeId).join(', ')} flatlined through recorded rainfall (SIMULATED Tier 2) — excluded from corroboration` });
  if (result.tier0Provenance.provenance !== 'REAL') out.push({ code: 'SYNTHETIC_TIER0', severity: 'critical', detail: `Tier 0 is SIMULATED: ${result.tier0Provenance.note ?? ''}` });
  for (const g of result.qualityGate.gates) if (g.status === 'FAIL') out.push({ code: `GATE_${g.name.toUpperCase()}`, severity: 'critical', detail: g.detail });
  return out;
}

export const templateNarrator: AuditorNarrator = {
  narrate(r, anomalies) {
    const m = r.measured;
    const ci = r.uncertainty.interval;
    const lines: string[] = [];
    lines.push(`Claim: ${r.claimedQuantity} ${r.metric.unit} of ${r.metric.id} over ${r.window.start} → ${r.window.end} (run ${r.runIndex}, plan ${short(r.analysisPlanHash)}).`);
    lines.push(`Tier 0 (${r.tier0Provenance.provenance}): ${r.stacSceneIds.length} Sentinel-2 scenes, processing graph ${r.processingGraphVersion}.`);
    lines.push(`Gross parcel change: ${m.parcelChangeHa.toFixed(2)} ha (ΔNDVI ${m.parcelChangeIndex}). Far-ring controls, drawn by the committed rule: ${m.controlChangeFarRingHa.toFixed(2)} ha. Near ring: ${m.controlChangeNearRingHa.toFixed(2)} ha.`);
    lines.push(`Parallel-trend diagnostic: ${r.parallelTrend.status} (p = ${r.parallelTrend.pValue}, n = ${r.parallelTrend.nObservations}).`);
    lines.push(`Difference-in-differences: ${(m.didIndex * (m.parcelChangeHa / (m.parcelChangeIndex || 1))).toFixed(2)} ha; leakage deducted: ${m.leakageHa.toFixed(2)} ha; biophysical additionality: ${m.additionalBiophysicalHa.toFixed(2)} ha.`);
    lines.push(`${Math.round(ci.confidenceLevel * 100)}% interval [${ci.lower.toFixed(2)}, ${ci.upper.toFixed(2)}] ha; empirical coverage ${r.uncertainty.empiricalCoverage.empirical ?? 'n/a'} over ${r.uncertainty.empiricalCoverage.placebos} placebos.`);
    lines.push(`Result: ${r.verificationStatus} — ${r.statusReason}. Settled quantity: ${r.settledQuantity} ha (${r.settlementBasis}).`);
    if (r.verificationStatus === 'PARTIAL') {
      lines.push(`The claim of ${r.claimedQuantity} ha is not dishonest and the measurement is not wrong; ${(r.claimedQuantity - r.settledQuantity).toFixed(2)} ha of it is regional change, leakage and uncertainty, none of which is paid.`);
    }
    if (anomalies.length) lines.push(`Anomalies: ${anomalies.map((a) => `[${a.severity}] ${a.code}: ${a.detail}`).join(' | ')}`);
    lines.push(r.simulatedTiersBanner);
    return lines.join('\n');
  },
};

export function audit(result: VerificationResult, evidence: EvidenceBundle, history: ProjectHistory, narrator: AuditorNarrator = templateNarrator): AuditReport {
  const anomalies = detectAnomalies(result, evidence, history);
  return {
    resultHash: result.resultHash,
    verificationStatus: result.verificationStatus,
    settledQuantity: result.settledQuantity,
    anomalies,
    narrative: narrator.narrate(result, anomalies),
    boundary: {
      llmUsed: false,
      note: 'Narrative is a deterministic template. An LLM narrator (M5) would implement AuditorNarrator and could only rephrase; every number above is copied from the canonical result.',
    },
  };
}

function short(h: string): string {
  return `${h.slice(0, 10)}…`;
}
