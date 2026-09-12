/**
 * Ecorestore Network — Additionality (M1)
 *
 * Converts the DiD estimate (in metric percentage points, for the M1
 * `canopy_cover_fraction_pct` metric) into hectares of additionality-
 * adjusted gain, using the treated parcel's declared area. This is the
 * quantity attributable to the intervention after removing the regional/
 * background change captured by the control set — see docs/VERIFICATION.md
 * §9. The system does not settle against gross parcel greening alone.
 *
 * M1 SIMPLIFICATION: this assumes the metric's percentage-point change is
 * uniform across the whole treated parcel area. A production system would
 * derive this from actual per-pixel/per-cell area rather than a single
 * scalar area field.
 */

import type { Parcel } from "../models.js";
import type { DifferenceInDifferencesResult } from "./differenceInDifferences.js";

export interface AdditionalityResult {
  readonly additionalityAdjustedHectares: number;
  readonly conversionAreaHectares: number;
  readonly differenceInDifferencesPercentagePoints: number;
}

export function computeAdditionality(
  did: DifferenceInDifferencesResult,
  treatedParcel: Parcel,
): AdditionalityResult {
  const additionalityAdjustedHectares = (did.differenceInDifferences / 100) * treatedParcel.areaHectares;

  return {
    additionalityAdjustedHectares,
    conversionAreaHectares: treatedParcel.areaHectares,
    differenceInDifferencesPercentagePoints: did.differenceInDifferences,
  };
}
