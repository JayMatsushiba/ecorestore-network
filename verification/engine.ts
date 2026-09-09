/**
 * Deterministic verification engine (docs/VERIFICATION.md, Idea 0.3 §3).
 *
 *   Evidence → Baseline → Parcel observation → Controls drawn by the committed
 *   rule (near + far ring) → Parallel-trend diagnostic → DiD against the far
 *   ring → Leakage from near/far divergence → Biophysical additionality →
 *   Bootstrap uncertainty + empirical coverage → Quality and issuance gates →
 *   Lower bound → canonical VerificationResult
 *
 * The engine is a pure function of (plan, evidence, runIndex). Identical inputs
 * produce byte-identical results. Nothing here can move money or talk to an LLM.
 */
import { canonicalize, cidV1Raw, keccakOf } from './canonical.js';
import {
  SIMULATED_BANNER,
  type AnalysisPlan,
  type ControlSetSummary,
  type EvidenceBundle,
  type GateStatus,
  type Hex,
  type ObligationStatus,
  type ObservationWindow,
  type ParcelRecord,
  type SpatialUnit,
  type Tier0Snapshot,
  type TierCorroboration,
  type VerificationResult,
  type VerificationStatus,
} from './models.js';
import { dayOfYear, makeRng, mean, median, ols, quantile, randomNormal, sampleSd, yearsSince2000 } from './stats.js';

export const METHODOLOGY_VERSION = 'ecorestore-did-leakage-lowerbound-1.0.0';

export interface EngineInput {
  projectId: string;
  parcel: ParcelRecord;
  plan: AnalysisPlan;
  evidence: EvidenceBundle;
  runIndex: number;
  /** Fixed for reproducibility in tests; defaults to now. */
  computedAt?: string;
}

// ---------------------------------------------------------------------------
// Unit-level series
// ---------------------------------------------------------------------------

interface UnitSeries {
  unit: SpatialUnit;
  index: number;
  /** Per pre-window seasonal composite (median of valid scene observations). */
  preComposites: Array<number | null>;
  postComposite: number | null;
  preLevel: number | null;
  /** NDVI per year across pre windows (null if fewer than 2 composites). */
  preSlope: number | null;
  waterFraction: number;
  /** Scene-level pre-period observations for the parallel-trend regression. */
  preObservations: Array<{ t: number; doy: number; ndvi: number }>;
}

function inWindow(datetime: string, w: ObservationWindow): boolean {
  const d = datetime.slice(0, 10);
  return d >= w.start && d <= w.end;
}

function scenesInWindow(snapshot: Tier0Snapshot, plan: AnalysisPlan, w: ObservationWindow): string[] {
  return snapshot.scenes
    .filter((s) => inWindow(s.datetime, w) && s.cloudCoverPct <= plan.index.maxSceneCloudCoverPct)
    .map((s) => s.sceneId);
}

function windowMidYear(w: ObservationWindow): number {
  return (yearsSince2000(w.start) + yearsSince2000(w.end)) / 2;
}

export function buildUnitSeries(snapshot: Tier0Snapshot, plan: AnalysisPlan): UnitSeries[] {
  const preWindows = plan.windows.pre;
  const postWindows = plan.windows.post;
  const preSceneIds = preWindows.map((w) => scenesInWindow(snapshot, plan, w));
  const postSceneIds = postWindows.flatMap((w) => scenesInWindow(snapshot, plan, w));
  const sceneById = new Map(snapshot.scenes.map((s) => [s.sceneId, s]));
  return snapshot.units.map((unit, index) => {
    const preComposites = preSceneIds.map((ids) => composite(ids, index, snapshot));
    const postComposite = composite(postSceneIds, index, snapshot);
    const validPre = preComposites.filter((v): v is number => v !== null);
    const preLevel = validPre.length > 0 ? mean(validPre) : null;
    let preSlope: number | null = null;
    if (preComposites.length >= 2) {
      const pts = preComposites.map((v, i) => ({ v, t: windowMidYear(preWindows[i]!) })).filter((p): p is { v: number; t: number } => p.v !== null);
      if (pts.length >= 2) {
        const first = pts[0]!;
        const last = pts[pts.length - 1]!;
        preSlope = (last.v - first.v) / (last.t - first.t);
      }
    }
    const preObservations: UnitSeries['preObservations'] = [];
    let waterSum = 0;
    let waterN = 0;
    for (const ids of preSceneIds) {
      for (const id of ids) {
        const obs = snapshot.observations[id];
        const scene = sceneById.get(id);
        if (!obs || !scene) continue;
        const v = obs.ndvi[index];
        waterSum += obs.waterFraction[index] ?? 0;
        waterN++;
        if (v === null || v === undefined) continue;
        preObservations.push({ t: yearsSince2000(scene.datetime), doy: dayOfYear(scene.datetime), ndvi: v });
      }
    }
    return { unit, index, preComposites, postComposite, preLevel, preSlope, waterFraction: waterN > 0 ? waterSum / waterN : 0, preObservations };
  });
}

function composite(sceneIds: string[], unitIndex: number, snapshot: Tier0Snapshot): number | null {
  const vals: number[] = [];
  for (const id of sceneIds) {
    const v = snapshot.observations[id]?.ndvi[unitIndex];
    if (v !== null && v !== undefined) vals.push(v);
  }
  return vals.length > 0 ? median(vals) : null;
}

// ---------------------------------------------------------------------------
// Control drawing — by the committed rule, never chosen
// ---------------------------------------------------------------------------

export interface DrawnControls {
  ring: 'near' | 'far';
  candidates: number;
  excludedWater: number;
  matched: UnitSeries[];
}

export function drawControls(
  ring: 'near' | 'far',
  target: { preLevel: number; preSlope: number },
  pool: UnitSeries[],
  plan: AnalysisPlan,
  excludeUnitId?: string,
): DrawnControls {
  const rule = plan.controlRule;
  const inRing = pool.filter((u) => u.unit.zone === ring && u.unit.unitId !== excludeUnitId);
  const excludedWater = inRing.filter((u) => u.waterFraction > rule.maxWaterFraction).length;
  const usable = inRing.filter(
    (u) => u.waterFraction <= rule.maxWaterFraction && u.preLevel !== null && u.preSlope !== null && u.postComposite !== null,
  );
  const levels = usable.map((u) => u.preLevel!);
  const slopes = usable.map((u) => u.preSlope!);
  const sdLevel = sampleSd(levels) || 1e-6;
  const sdSlope = sampleSd(slopes) || 1e-6;
  const useLevel = rule.matching.covariates.includes('pre_level');
  const useSlope = rule.matching.covariates.includes('pre_slope');
  const scored = usable
    .map((u) => {
      const dl = useLevel ? (u.preLevel! - target.preLevel) / sdLevel : 0;
      const ds = useSlope ? (u.preSlope! - target.preSlope) / sdSlope : 0;
      return { u, dl, ds, dist: Math.sqrt(dl * dl + ds * ds) };
    })
    .filter((s) => Math.abs(s.dl) <= rule.matching.caliperSd && Math.abs(s.ds) <= rule.matching.caliperSd)
    .sort((a, b) => a.dist - b.dist || a.u.unit.unitId.localeCompare(b.u.unit.unitId));
  return { ring, candidates: inRing.length, excludedWater, matched: scored.slice(0, rule.matching.k).map((s) => s.u) };
}

// ---------------------------------------------------------------------------
// Parallel-trend diagnostic
// ---------------------------------------------------------------------------

export interface ParallelTrendOutcome {
  status: GateStatus;
  slopeDiffPerYear: number;
  pValue: number;
  nObservations: number;
  criterion: string;
}

/**
 * ndvi ~ b0 + b1·t + b2·treated + b3·(t·treated) + b4·sin(doy) + b5·cos(doy)
 * over pre-period scene observations. b3 is the pre-trend divergence.
 */
export function parallelTrendDiagnostic(parcel: UnitSeries, controls: UnitSeries[], plan: AnalysisPlan): ParallelTrendOutcome {
  const rows: number[][] = [];
  const y: number[] = [];
  const push = (o: { t: number; doy: number; ndvi: number }, treated: number) => {
    const ang = (2 * Math.PI * o.doy) / 365.25;
    rows.push([1, o.t, treated, o.t * treated, Math.sin(ang), Math.cos(ang)]);
    y.push(o.ndvi);
  };
  for (const o of parcel.preObservations) push(o, 1);
  for (const c of controls) for (const o of c.preObservations) push(o, 0);
  const criterion = `interaction p ≥ ${plan.parallelTrend.alpha} and |Δslope| ≤ ${plan.parallelTrend.maxAbsSlopeDiffPerYear} NDVI/yr (${plan.parallelTrend.test})`;
  if (rows.length < 12 || parcel.preObservations.length < 4) {
    return { status: 'FAIL', slopeDiffPerYear: NaN, pValue: NaN, nObservations: rows.length, criterion: `${criterion}; too few pre-period observations` };
  }
  let fit;
  try {
    fit = ols(rows, y);
  } catch {
    return { status: 'FAIL', slopeDiffPerYear: NaN, pValue: NaN, nObservations: rows.length, criterion: `${criterion}; singular design` };
  }
  const slopeDiff = fit.beta[3]!;
  const p = fit.pValue[3]!;
  const pass = p >= plan.parallelTrend.alpha && Math.abs(slopeDiff) <= plan.parallelTrend.maxAbsSlopeDiffPerYear;
  return { status: pass ? 'PASS' : 'FAIL', slopeDiffPerYear: round6(slopeDiff), pValue: round6(p), nObservations: rows.length, criterion };
}

// ---------------------------------------------------------------------------
// Estimator
// ---------------------------------------------------------------------------

export interface Estimate {
  parcelChange: number;
  farChange: number;
  nearChange: number;
  leakage: number;
  did: number;
  additional: number;
}

function change(u: UnitSeries): number {
  return u.postComposite! - u.preLevel!;
}

export function estimate(parcelChange: number, far: UnitSeries[], near: UnitSeries[], plan: AnalysisPlan): Estimate {
  const farChange = mean(far.map(change));
  const nearChange = near.length > 0 ? mean(near.map(change)) : farChange;
  let leakage = farChange - nearChange;
  if (plan.leakage.floorAtZero) leakage = Math.max(0, leakage);
  const did = parcelChange - farChange;
  return { parcelChange, farChange, nearChange, leakage, did, additional: did - leakage };
}

/**
 * Bootstrap over (a) far-ring matched units, (b) near-ring matched units,
 * (c) parcel sub-cells, and (d) the index→cover transfer coefficient. Returns
 * additional hectares per iteration.
 */
export function bootstrapAdditionalHa(
  parcelCells: UnitSeries[],
  far: UnitSeries[],
  near: UnitSeries[],
  areaHa: number,
  plan: AnalysisPlan,
  iterations: number,
  seed: number,
): number[] {
  const rng = makeRng(seed);
  const cellChanges = parcelCells.map(change);
  const cellWeights = parcelCells.map((c) => c.unit.areaHa);
  const farChanges = far.map(change);
  const nearChanges = near.map(change);
  const farMean = mean(farChanges);
  const residuals = plan.uncertainty.controlMatchingShock.method === 'far_ring_residual_v1' ? farChanges.map((c) => c - farMean) : [0];
  const { coefficient, sd } = plan.uncertainty.modelTransfer;
  const out: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const shock = residuals[Math.floor(rng() * residuals.length)]!;
    const pc = resampleWeighted(cellChanges, cellWeights, rng) + shock;
    const fc = mean(resample(farChanges, rng));
    const nc = nearChanges.length > 0 ? mean(resample(nearChanges, rng)) : fc;
    let leak = fc - nc;
    if (plan.leakage.floorAtZero) leak = Math.max(0, leak);
    const additionalIndex = pc - fc - leak;
    const coef = Math.max(0, randomNormal(rng, coefficient, sd));
    out.push(additionalIndex * coef * areaHa);
  }
  return out;
}

function resample(xs: number[], rng: () => number): number[] {
  return xs.map(() => xs[Math.floor(rng() * xs.length)]!);
}

function resampleWeighted(xs: number[], w: number[], rng: () => number): number {
  let s = 0;
  let ws = 0;
  for (let i = 0; i < xs.length; i++) {
    const j = Math.floor(rng() * xs.length);
    s += xs[j]! * w[j]!;
    ws += w[j]!;
  }
  return ws > 0 ? s / ws : 0;
}

// ---------------------------------------------------------------------------
// Empirical coverage — placebo in space on real Tier 0
// ---------------------------------------------------------------------------

/**
 * Each usable far-ring unit is treated in turn as a pseudo-parcel with true
 * additional change = 0 (no intervention there). Controls are re-drawn by the
 * committed rule excluding that unit, the bootstrap interval is computed, and
 * coverage is the fraction of intervals containing zero. This tests interval
 * calibration of the DiD estimator under the null on real data; it is not
 * held-out ground truth. The parcel's near ring is not a near ring for a
 * pseudo-parcel elsewhere, so no leakage term enters the placebo.
 */
export function empiricalCoverage(series: UnitSeries[], plan: AnalysisPlan, seed: number): { empirical: number | null; placebos: number } {
  const cov = plan.uncertainty.coverage;
  const candidates = series
    .filter((u) => u.unit.zone === 'far' && u.preLevel !== null && u.preSlope !== null && u.postComposite !== null && u.waterFraction <= plan.controlRule.maxWaterFraction)
    .sort((a, b) => a.unit.unitId.localeCompare(b.unit.unitId));
  const rng = makeRng(seed ^ 0x5eed);
  const chosen: UnitSeries[] = [];
  const poolCopy = [...candidates];
  while (chosen.length < cov.maxPlacebos && poolCopy.length > 0) chosen.push(poolCopy.splice(Math.floor(rng() * poolCopy.length), 1)[0]!);
  let hits = 0;
  let n = 0;
  const alpha = 1 - plan.uncertainty.confidenceLevel;
  for (const pseudo of chosen) {
    const far = drawControls('far', { preLevel: pseudo.preLevel!, preSlope: pseudo.preSlope! }, series, plan, pseudo.unit.unitId);
    if (far.matched.length < plan.controlRule.matching.minMatched) continue;
    const draws = bootstrapAdditionalHa([pseudo], far.matched, [], pseudo.unit.areaHa, plan, cov.bootstrapIterations, seed ^ hashId(pseudo.unit.unitId));
    const lo = quantile(draws, alpha / 2);
    const hi = quantile(draws, 1 - alpha / 2);
    n++;
    if (lo <= 0 && hi >= 0) hits++;
  }
  return { empirical: n > 0 ? round4(hits / n) : null, placebos: n };
}

function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function verify(input: EngineInput): VerificationResult {
  const { plan, evidence, parcel, runIndex } = input;
  const t0 = evidence.tier0;
  if (t0.provenance !== 'REAL' && !t0.syntheticEffectNote) {
    throw new Error('A non-REAL Tier 0 snapshot must declare syntheticEffectNote');
  }
  const analysisPlanHash = keccakOf(plan);
  const computedAt = input.computedAt ?? new Date().toISOString();
  const series = buildUnitSeries(t0, plan);
  const parcelSeries = series.find((u) => u.unit.zone === 'parcel');
  if (!parcelSeries) throw new Error('snapshot has no parcel unit');
  const parcelCells = series.filter((u) => u.unit.zone === 'parcel_cell' && u.preLevel !== null && u.postComposite !== null);
  const areaHa = parcelSeries.unit.areaHa;
  const claimed = evidence.tier3.claim.value;
  const postWindow = plan.windows.post[plan.windows.post.length - 1]!;
  const window: ObservationWindow = { label: 'verification', start: plan.windows.pre[0]!.start, end: postWindow.end };
  const transfer = plan.uncertainty.modelTransfer.coefficient;
  const toHa = (idx: number) => round4(idx * transfer * areaHa);

  const gates: VerificationResult['qualityGate']['gates'] = [];
  const evidenceGateFailures: string[] = [];

  // Evidence sufficiency — scenes per window.
  for (const w of [...plan.windows.pre, ...plan.windows.post]) {
    const n = scenesInWindow(t0, plan, w).filter((id) => t0.observations[id]?.ndvi[parcelSeries.index] != null).length;
    const ok = n >= plan.minScenesPerWindow;
    gates.push({ name: `scenes:${w.label}`, status: ok ? 'PASS' : 'FAIL', detail: `${n} usable scenes (min ${plan.minScenesPerWindow})`, provenance: 'REAL' });
    if (!ok) evidenceGateFailures.push(`${w.label} has ${n} usable scenes`);
  }

  const target = { preLevel: parcelSeries.preLevel ?? NaN, preSlope: parcelSeries.preSlope ?? NaN };
  const far = drawControls('far', target, series, plan);
  const near = drawControls('near', target, series, plan);
  const enoughControls = far.matched.length >= plan.controlRule.matching.minMatched;
  gates.push({ name: 'controls:far_ring', status: enoughControls ? 'PASS' : 'FAIL', detail: `${far.matched.length} matched of ${far.candidates} candidates (min ${plan.controlRule.matching.minMatched})`, provenance: 'REAL' });
  if (!enoughControls) evidenceGateFailures.push(`only ${far.matched.length} far-ring controls matched`);

  const pt = enoughControls
    ? parallelTrendDiagnostic(parcelSeries, far.matched, plan)
    : { status: 'NOT_EVALUATED' as GateStatus, slopeDiffPerYear: NaN, pValue: NaN, nObservations: 0, criterion: 'not evaluated: insufficient controls' };
  gates.push({ name: 'parallel_trend', status: pt.status, detail: `Δslope ${fmt(pt.slopeDiffPerYear)} NDVI/yr, p ${fmt(pt.pValue)}, n ${pt.nObservations}`, provenance: 'REAL' });
  if (pt.status === 'FAIL') evidenceGateFailures.push('parallel-trend diagnostic failed');

  const controlSets: ControlSetSummary[] = [summariseControls(far, plan.controlRule.farRing), summariseControls(near, plan.controlRule.nearRing)];

  const parcelChange = parcelSeries.postComposite !== null && parcelSeries.preLevel !== null ? change(parcelSeries) : NaN;
  const est = enoughControls && Number.isFinite(parcelChange) ? estimate(parcelChange, far.matched, near.matched, plan) : null;

  // Uncertainty
  const alpha = 1 - plan.uncertainty.confidenceLevel;
  let lower = NaN;
  let upper = NaN;
  if (est) {
    const draws = bootstrapAdditionalHa(parcelCells.length > 0 ? parcelCells : [parcelSeries], far.matched, near.matched, areaHa, plan, plan.uncertainty.bootstrapIterations, plan.uncertainty.seed);
    lower = round4(quantile(draws, alpha / 2));
    upper = round4(quantile(draws, 1 - alpha / 2));
  }
  const coverage = est ? empiricalCoverage(series, plan, plan.uncertainty.seed) : { empirical: null, placebos: 0 };
  const intervalValid = Number.isFinite(lower) && Number.isFinite(upper) && lower <= upper;

  // Issuance gates
  const lossCells = parcelCells.filter((c) => change(c) < plan.gates.noNetHabitatLoss.ndviDropThreshold);
  const lossArea = lossCells.reduce((s, c) => s + c.unit.areaHa, 0);
  const cellArea = parcelCells.reduce((s, c) => s + c.unit.areaHa, 0);
  const lossFraction = cellArea > 0 ? lossArea / cellArea : 1;
  const noNetLossOk = parcelCells.length > 0 && lossFraction <= plan.gates.noNetHabitatLoss.maxLossCellFraction;
  gates.push({ name: 'no_net_habitat_loss', status: noNetLossOk ? 'PASS' : 'FAIL', detail: `${(lossFraction * 100).toFixed(1)}% of parcel area dropped below ΔNDVI ${plan.gates.noNetHabitatLoss.ndviDropThreshold} (max ${plan.gates.noNetHabitatLoss.maxLossCellFraction * 100}%)`, provenance: 'REAL' });

  const nativeOk = evidence.tier1.nativeSpeciesFraction >= plan.gates.nativeSpeciesFraction.min;
  gates.push({ name: 'native_species_fraction', status: nativeOk ? 'PASS' : 'FAIL', detail: `${evidence.tier1.nativeSpeciesFraction} (min ${plan.gates.nativeSpeciesFraction.min}) — SIMULATED Tier 1/3`, provenance: 'SIMULATED' });

  const conditionOk = parcelSeries.postComposite !== null && parcelSeries.postComposite >= plan.gates.conditionFloor.minPostNdvi;
  gates.push({ name: 'condition_floor', status: conditionOk ? 'PASS' : 'FAIL', detail: `post-window parcel NDVI ${fmt(parcelSeries.postComposite)} (min ${plan.gates.conditionFloor.minPostNdvi})`, provenance: 'REAL' });

  const issuanceGateFailures = [noNetLossOk ? null : 'no_net_habitat_loss', nativeOk ? null : 'native_species_fraction', conditionOk ? null : 'condition_floor'].filter((x): x is string => x !== null);

  // Status resolution — evidence gates first, then validity, then issuance gates, then quantity.
  let status: VerificationStatus;
  let reason: string;
  let settled = 0;
  if (evidenceGateFailures.length > 0 || !est) {
    status = 'INSUFFICIENT_EVIDENCE';
    reason = evidenceGateFailures.join('; ') || 'estimator not computable';
  } else if (!intervalValid) {
    status = 'INVALID_RESULT';
    reason = `uncertainty interval invalid: [${lower}, ${upper}]`;
  } else if (issuanceGateFailures.length > 0) {
    status = 'GATE_FAILED';
    reason = `issuance gate(s) failed: ${issuanceGateFailures.join(', ')}`;
  } else if (lower <= 0) {
    status = 'NOT_ADDITIONAL';
    reason = `lower ${plan.uncertainty.confidenceLevel * 100}% bound ${lower} ha is not above zero`;
  } else {
    settled = round4(Math.min(lower, claimed));
    status = settled >= claimed ? 'VERIFIED' : 'PARTIAL';
    reason = `settled at the lower ${plan.uncertainty.confidenceLevel * 100}% bound (${lower} ha) against a claim of ${claimed} ha`;
  }
  const qualityStatus: GateStatus = evidenceGateFailures.length === 0 && issuanceGateFailures.length === 0 ? 'PASS' : 'FAIL';

  const stacSceneIds = [...plan.windows.pre, ...plan.windows.post].flatMap((w) => scenesInWindow(t0, plan, w)).sort();
  const tierCorroboration = corroborate(evidence, parcelSeries, est, areaHa, transfer);
  const obligationStatus = obligation(parcel);
  const evidenceDoc = { tier0: t0.snapshotHash, tier1: evidence.tier1.bundleHash, tier2: evidence.tier2.bundleHash, tier3: evidence.tier3.bundleHash };
  const evidenceHash = keccakOf(evidenceDoc);
  const evidenceCid = cidV1Raw(new TextEncoder().encode(canonicalize(evidenceDoc)));

  const partial: Omit<VerificationResult, 'resultHash'> = {
    resultVersion: '1.0.0',
    projectId: input.projectId,
    parcelId: parcel.parcelId,
    parcelH3Root: t0.h3Root,
    geometryHash: t0.geometryHash,
    parcelAreaHa: round4(areaHa),
    analysisPlanHash,
    runIndex,
    methodologyVersion: METHODOLOGY_VERSION,
    processingGraphVersion: t0.processingGraphVersion,
    stacSceneIds,
    tier0Provenance: {
      provenance: t0.provenance,
      catalog: t0.source.catalog,
      collection: t0.source.collection,
      snapshotHash: t0.snapshotHash,
      ...(t0.syntheticEffectNote ? { note: t0.syntheticEffectNote } : {}),
    },
    metric: { id: plan.metric.id, version: plan.metric.version, unit: plan.metric.unit },
    window,
    claimedQuantity: claimed,
    measured: {
      parcelChangeIndex: round4(nz(parcelChange)),
      parcelChangeHa: toHa(nz(parcelChange)),
      controlChangeFarRingIndex: round4(nz(est?.farChange)),
      controlChangeFarRingHa: toHa(nz(est?.farChange)),
      controlChangeNearRingIndex: round4(nz(est?.nearChange)),
      controlChangeNearRingHa: toHa(nz(est?.nearChange)),
      leakageIndex: round4(nz(est?.leakage)),
      leakageHa: toHa(nz(est?.leakage)),
      didIndex: round4(nz(est?.did)),
      additionalBiophysicalIndex: round4(nz(est?.additional)),
      additionalBiophysicalHa: toHa(nz(est?.additional)),
    },
    controlSets,
    parallelTrend: { status: pt.status, slopeDiffPerYear: nz(pt.slopeDiffPerYear), pValue: nz(pt.pValue), nObservations: pt.nObservations, criterion: pt.criterion },
    uncertainty: {
      interval: { lower: nz(lower), upper: nz(upper), confidenceLevel: plan.uncertainty.confidenceLevel },
      method: 'nonparametric bootstrap over matched far/near units and parcel sub-cells, with Gaussian index→cover transfer error',
      bootstrapIterations: plan.uncertainty.bootstrapIterations,
      seed: plan.uncertainty.seed,
      empiricalCoverage: {
        nominal: plan.uncertainty.confidenceLevel,
        empirical: coverage.empirical,
        method: plan.uncertainty.coverage.method,
        placebos: coverage.placebos,
        basis: 'Placebo-in-space over far-ring units on REAL Tier 0 (truth = 0 by construction). Not held-out ground-truth plots.',
      },
    },
    lowerBound: nz(lower),
    qualityGate: { status: qualityStatus, gates },
    tierCorroboration,
    obligationStatus,
    verificationStatus: status,
    statusReason: reason,
    settledQuantity: settled,
    settlementBasis: `lower_bound_${Math.round(plan.uncertainty.confidenceLevel * 100)}`,
    evidenceHash,
    evidenceCid,
    evidenceCidNote: 'CIDv1 raw/sha2-256 computed locally over the canonical evidence commitment; not pinned to IPFS by this prototype.',
    simulatedTiersBanner: SIMULATED_BANNER,
    computedAt,
  };
  return { ...partial, resultHash: keccakOf(partial) };
}

function summariseControls(d: DrawnControls, geometry: { innerM: number; outerM: number }): ControlSetSummary {
  const m = d.matched;
  return {
    ring: d.ring,
    geometry,
    candidates: d.candidates,
    excludedWater: d.excludedWater,
    matched: m.length,
    matchedUnitIds: m.map((u) => u.unit.unitId),
    meanPreLevel: m.length ? round4(mean(m.map((u) => u.preLevel!))) : 0,
    meanPreSlope: m.length ? round4(mean(m.map((u) => u.preSlope!))) : 0,
    changeIndex: m.length ? round4(mean(m.map(change))) : 0,
  };
}

function corroborate(evidence: EvidenceBundle, parcelSeries: UnitSeries, est: Estimate | null, areaHa: number, transfer: number): TierCorroboration[] {
  const t0 = evidence.tier0;
  const usable = Object.values(t0.observations).filter((o) => o.ndvi[parcelSeries.index] != null).length;
  const tier0Score = t0.scenes.length > 0 ? round4(usable / t0.scenes.length) : 0;
  const out: TierCorroboration[] = [
    {
      tier: 0,
      label: t0.provenance === 'REAL' ? 'Sentinel-2 L2A (REAL)' : 'Sentinel-2 L2A with SYNTHETIC EFFECT INJECTED (SIMULATED)',
      provenance: t0.provenance,
      score: tier0Score,
      note: `${usable} of ${t0.scenes.length} scenes usable over the parcel after SCL masking`,
    },
  ];
  const t1 = evidence.tier1;
  const plotGain = mean(t1.plots.map((p) => p.canopyFractionPost - p.canopyFractionPre));
  const measuredFraction = est ? est.parcelChange * transfer : null;
  const t1Score = measuredFraction === null ? 0 : round4(Math.max(0, 1 - Math.abs(plotGain - measuredFraction) / Math.max(0.05, Math.abs(measuredFraction) + 0.05)));
  out.push({ tier: 1, label: 'Drone plots (SIMULATED)', provenance: 'SIMULATED', score: t1Score, note: `mean plot canopy gain ${plotGain.toFixed(3)} vs Tier 0 implied cover change ${measuredFraction === null ? 'n/a' : measuredFraction.toFixed(3)}` });
  const t2 = evidence.tier2;
  const flat = t2.nodes.filter((n) => n.flatlined);
  const t2Score = round4((t2.nodes.length - flat.length) / Math.max(1, t2.nodes.length));
  out.push({ tier: 2, label: 'IoT soil moisture (SIMULATED)', provenance: 'SIMULATED', score: t2Score, note: flat.length ? `${flat.map((n) => n.nodeId).join(', ')} flatlined through recorded rainfall — excluded` : 'all nodes responsive to rainfall' });
  const t3 = evidence.tier3;
  const measuredHa = est ? est.parcelChange * transfer * areaHa : null;
  const overshoot = measuredHa === null || measuredHa <= 0 ? null : (t3.claim.value - measuredHa) / measuredHa;
  const t3Score = overshoot === null ? 0 : round4(Math.max(0, 1 - Math.abs(overshoot)));
  out.push({ tier: 3, label: 'Ground report (SIMULATED)', provenance: 'SIMULATED', score: t3Score, note: overshoot === null ? 'claim cannot be compared: no measured gross gain' : `claim ${t3.claim.value} ha ${overshoot >= 0 ? 'exceeds' : 'is below'} gross measured gain ${measuredHa!.toFixed(2)} ha by ${(Math.abs(overshoot) * 100).toFixed(0)}%` });
  return out;
}

function obligation(parcel: ParcelRecord): ObligationStatus {
  if (parcel.encumbrances.legalObligations.length > 0) return 'obligation_linked';
  if (parcel.encumbrances.publicSubsidy.length > 0) return 'subsidy_overlapping';
  return 'voluntary_additional';
}

function nz(x: number | undefined | null): number {
  return x === undefined || x === null || !Number.isFinite(x) ? 0 : x;
}

function fmt(x: number | null | undefined): string {
  return x === null || x === undefined || !Number.isFinite(x) ? 'n/a' : x.toFixed(4);
}

function round4(x: number): number {
  return Number.isFinite(x) ? Math.round(x * 10_000) / 10_000 : x;
}

function round6(x: number): number {
  return Number.isFinite(x) ? Math.round(x * 1_000_000) / 1_000_000 : x;
}

export function analysisPlanHash(plan: AnalysisPlan): Hex {
  return keccakOf(plan);
}
