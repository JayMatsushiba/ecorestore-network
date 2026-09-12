/**
 * Ecorestore Network — Parallel-Trend Diagnostic (M1)
 *
 * This is a hard quality gate (docs/VERIFICATION.md §7, M1 prompt §8): if it
 * does not return PASS, the engine must not proceed to a valid settlement
 * quantity, no matter how large the post-treatment effect looks.
 *
 * M1 SIMPLIFICATION: "trend" is a two-point linear slope between the
 * earliest and latest pre-treatment observation for each parcel (see
 * observationGrouping.ts), not a fitted multi-point regression over a long
 * historical baseline.
 *
 * The diagnostic compares the treated parcel's pre-treatment slope to the
 * mean pre-treatment slope across eligible control parcels. If the treated
 * slope cannot be computed, or ANY eligible control's slope cannot be
 * computed, the diagnostic returns INSUFFICIENT_EVIDENCE rather than
 * silently dropping that control or guessing.
 */

import type { EvidenceObservation, MethodologyConfiguration, Parcel, ParallelTrendStatus } from "../models.js";
import { groupParcelObservations, preTreatmentSlopePerYear } from "./observationGrouping.js";

export interface ParallelTrendDiagnostic {
  readonly status: ParallelTrendStatus;
  readonly treatedSlopePerYear: number | null;
  readonly controlMeanSlopePerYear: number | null;
  readonly divergenceRatio: number | null;
}

export function evaluateParallelTrend(
  treated: Parcel,
  eligibleControls: readonly Parcel[],
  evidence: readonly EvidenceObservation[],
  config: MethodologyConfiguration,
): ParallelTrendDiagnostic {
  const treatedObservations = groupParcelObservations(evidence, treated.parcelId, config.metric);
  const treatedSlopePerYear = preTreatmentSlopePerYear(treatedObservations);

  const controlSlopes: number[] = [];
  for (const control of eligibleControls) {
    const controlObservations = groupParcelObservations(evidence, control.parcelId, config.metric);
    const slope = preTreatmentSlopePerYear(controlObservations);
    if (slope !== null) {
      controlSlopes.push(slope);
    }
  }

  const allControlSlopesComputable = controlSlopes.length === eligibleControls.length && controlSlopes.length > 0;

  if (treatedSlopePerYear === null || !allControlSlopesComputable) {
    return {
      status: "INSUFFICIENT_EVIDENCE",
      treatedSlopePerYear,
      controlMeanSlopePerYear: controlSlopes.length > 0 ? mean(controlSlopes) : null,
      divergenceRatio: null,
    };
  }

  const controlMeanSlopePerYear = mean(controlSlopes);
  const denominator = Math.max(Math.abs(controlMeanSlopePerYear), config.parallelTrendMinimumSlopeDenominator);
  const divergenceRatio = Math.abs(treatedSlopePerYear - controlMeanSlopePerYear) / denominator;

  const status: ParallelTrendStatus = divergenceRatio <= config.parallelTrendToleranceRatio ? "PASS" : "FAIL";

  return { status, treatedSlopePerYear, controlMeanSlopePerYear, divergenceRatio };
}

function mean(values: readonly number[]): number {
  return values.reduce((accumulator, value) => accumulator + value, 0) / values.length;
}
