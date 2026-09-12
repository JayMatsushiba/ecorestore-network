/**
 * Ecorestore Network — Control Matching (M1)
 *
 * Deterministic control-selection for the M1 prototype.
 *
 * M1 SIMPLIFICATION: this is explicit rule-based matching on declared
 * parcel characteristics, not production-grade causal-inference matching
 * (e.g. propensity-score or synthetic-control matching over many covariates
 * and a full historical time series). See docs/VERIFICATION.md §6 and the
 * M1 prompt §7 — this does NOT establish production-level causal inference.
 *
 * A candidate control is eligible only if BOTH:
 *  1. It is not flagged with a `contaminationReason` (plausible treatment
 *     spillover / non-independence as a counterfactual); and
 *  2. Its characteristics match the treated parcel: identical land cover,
 *     climate zone, soil type and aspect, and elevation/slope within the
 *     configured tolerance.
 */

import type { ContaminationReason, ControlMatchingTolerance, ExcludedControl, Parcel, ParcelId } from "../models.js";

export interface ControlMatchResult {
  readonly eligibleControlParcelIds: readonly ParcelId[];
  readonly excludedContaminated: readonly ExcludedControl[];
  readonly excludedNonMatching: readonly ParcelId[];
}

export function selectMatchedControls(
  treated: Parcel,
  candidates: readonly Parcel[],
  tolerance: ControlMatchingTolerance,
): ControlMatchResult {
  const eligibleControlParcelIds: ParcelId[] = [];
  const excludedContaminated: ExcludedControl[] = [];
  const excludedNonMatching: ParcelId[] = [];

  for (const candidate of candidates) {
    const contaminationReason: ContaminationReason | undefined = candidate.contaminationReason;
    if (contaminationReason !== undefined) {
      excludedContaminated.push({ parcelId: candidate.parcelId, reason: contaminationReason });
      continue;
    }

    if (!isCharacteristicMatch(treated, candidate, tolerance)) {
      excludedNonMatching.push(candidate.parcelId);
      continue;
    }

    eligibleControlParcelIds.push(candidate.parcelId);
  }

  return { eligibleControlParcelIds, excludedContaminated, excludedNonMatching };
}

function isCharacteristicMatch(treated: Parcel, candidate: Parcel, tolerance: ControlMatchingTolerance): boolean {
  const t = treated.characteristics;
  const c = candidate.characteristics;

  if (t.landCover !== c.landCover) return false;
  if (t.climateZone !== c.climateZone) return false;
  if (t.soilType !== c.soilType) return false;
  if (t.aspect !== c.aspect) return false;
  if (Math.abs(t.elevationMeters - c.elevationMeters) > tolerance.elevationMeters) return false;
  if (Math.abs(t.slopeDegrees - c.slopeDegrees) > tolerance.slopeDegrees) return false;

  return true;
}
