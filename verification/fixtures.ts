/**
 * Ecorestore Network — Synthetic Kootenay Riparian Restoration Fixtures (M1)
 *
 * ============================================================================
 * SYNTHETIC DEMONSTRATION DATA — NOT REAL FIELD, SATELLITE, SENSOR OR
 * REGULATORY MEASUREMENT. "Kootenay Riparian Restoration" is a fictional
 * project. No real parcel, restorer, or funder is represented. Every number
 * below was authored for this milestone to exercise the deterministic
 * verification pipeline and does not describe any actual place. See
 * docs/ARCHITECTURE.md §4.
 * ============================================================================
 *
 * All fixtures share one synthetic metric, `canopy_cover_fraction_pct`
 * (fractional canopy cover, 0-100), observed at two pre-treatment dates
 * (to establish a pre-treatment trend slope) and one post-treatment date,
 * for a treated parcel and several candidate control parcels.
 *
 * Fixture index:
 *  - FIXTURE_PARTIAL_SETTLEMENT   success path, quality gate PASSes,
 *                                  settled quantity < claimed -> PARTIAL.
 *                                  This is the primary M1 demonstration case.
 *  - FIXTURE_FULL_SETTLEMENT      same shape as above but with a lower
 *                                  claim, so settled >= claimed -> VERIFIED.
 *  - FIXTURE_PARALLEL_TREND_FAIL  treated parcel's pre-treatment trend
 *                                  diverges sharply from its controls'
 *                                  -> parallel-trend FAIL -> INSUFFICIENT_EVIDENCE,
 *                                  settledQuantity 0.
 *  - FIXTURE_MISSING_POST_EVIDENCE treated parcel has no post-treatment
 *                                  observation -> INSUFFICIENT_EVIDENCE at
 *                                  the input-validation gate.
 *  - FIXTURE_INVALID_CLAIM        claimedQuantity <= 0 -> INSUFFICIENT_EVIDENCE
 *                                  at the input-validation gate.
 *  - FIXTURE_INSUFFICIENT_CONTROLS only one eligible (matched,
 *                                  uncontaminated) control candidate exists,
 *                                  below `minimumControlCount` ->
 *                                  INSUFFICIENT_EVIDENCE before the
 *                                  parallel-trend diagnostic ever runs.
 */

import { M1_METRIC_ID } from "./config.js";
import type { EvidenceObservation, EvidenceSource, ObservationWindow, Parcel, Project } from "./models.js";

const SYNTHETIC_SOURCE: EvidenceSource = "synthetic_satellite_optical";

const STANDARD_WINDOW: ObservationWindow = {
  preTreatmentStart: "2023-03-01",
  preTreatmentEnd: "2025-03-01",
  postTreatmentStart: "2025-03-02",
  postTreatmentEnd: "2026-09-01",
};

function observation(
  evidenceId: string,
  parcelId: string,
  period: "pre_treatment" | "post_treatment",
  observedAt: string,
  value: number,
): EvidenceObservation {
  return {
    evidenceId,
    parcelId,
    metric: M1_METRIC_ID,
    period,
    value,
    observedAt,
    source: SYNTHETIC_SOURCE,
    synthetic: true,
  };
}

// ---------------------------------------------------------------------------
// Fixture A — success path (PARTIAL settlement)
// ---------------------------------------------------------------------------

const treatedParcelA: Parcel = {
  parcelId: "KOOT-T-01",
  role: "treated",
  areaHectares: 46.5,
  characteristics: {
    landCover: "riparian_forest",
    elevationMeters: 620,
    slopeDegrees: 6,
    aspect: "SW",
    soilType: "alluvial_loam",
    climateZone: "interior_temperate_wet",
  },
};

const controlCleanA1: Parcel = {
  parcelId: "KOOT-C-01",
  role: "control_candidate",
  areaHectares: 39.0,
  characteristics: {
    landCover: "riparian_forest",
    elevationMeters: 610,
    slopeDegrees: 6.5,
    aspect: "SW",
    soilType: "alluvial_loam",
    climateZone: "interior_temperate_wet",
  },
};

const controlCleanA2: Parcel = {
  parcelId: "KOOT-C-04",
  role: "control_candidate",
  areaHectares: 42.0,
  characteristics: {
    landCover: "riparian_forest",
    elevationMeters: 630,
    slopeDegrees: 5.5,
    aspect: "SW",
    soilType: "alluvial_loam",
    climateZone: "interior_temperate_wet",
  },
};

const controlContaminatedA: Parcel = {
  parcelId: "KOOT-C-02",
  role: "control_candidate",
  areaHectares: 30.0,
  characteristics: {
    landCover: "riparian_forest",
    elevationMeters: 615,
    slopeDegrees: 7.0,
    aspect: "SW",
    soilType: "alluvial_loam",
    climateZone: "interior_temperate_wet",
  },
  // A separately funded, concurrent restoration program on the adjacent
  // parcel — plausible spillover, so this parcel cannot serve as an
  // independent counterfactual even though its characteristics match.
  contaminationReason: "known_concurrent_intervention",
};

const controlNonMatchingA: Parcel = {
  parcelId: "KOOT-C-03",
  role: "control_candidate",
  areaHectares: 55.0,
  characteristics: {
    landCover: "montane_grassland",
    elevationMeters: 1200,
    slopeDegrees: 15,
    aspect: "N",
    soilType: "sandy_loam",
    climateZone: "interior_temperate_dry",
  },
};

const evidenceA: readonly EvidenceObservation[] = [
  // Treated parcel: pre-trend +1.0 pp/yr, then a large post-treatment jump.
  observation("ev-a-t01-pre-early", "KOOT-T-01", "pre_treatment", "2023-03-01", 22.0),
  observation("ev-a-t01-pre-late", "KOOT-T-01", "pre_treatment", "2025-03-01", 24.0),
  observation("ev-a-t01-post", "KOOT-T-01", "post_treatment", "2026-09-01", 85.0),

  // Clean matched control 1: same pre-trend (+1.0 pp/yr), smaller post-treatment gain
  // (regional background greening only — no intervention here).
  observation("ev-a-c01-pre-early", "KOOT-C-01", "pre_treatment", "2023-03-01", 21.0),
  observation("ev-a-c01-pre-late", "KOOT-C-01", "pre_treatment", "2025-03-01", 23.0),
  observation("ev-a-c01-post", "KOOT-C-01", "post_treatment", "2026-09-01", 40.0),

  // Clean matched control 2: same pre-trend (+1.0 pp/yr).
  observation("ev-a-c04-pre-early", "KOOT-C-04", "pre_treatment", "2023-03-01", 23.0),
  observation("ev-a-c04-pre-late", "KOOT-C-04", "pre_treatment", "2025-03-01", 25.0),
  observation("ev-a-c04-post", "KOOT-C-04", "post_treatment", "2026-09-01", 38.0),

  // Contaminated candidate: excluded regardless of its own trajectory.
  observation("ev-a-c02-pre-early", "KOOT-C-02", "pre_treatment", "2023-03-01", 20.0),
  observation("ev-a-c02-pre-late", "KOOT-C-02", "pre_treatment", "2025-03-01", 22.0),
  observation("ev-a-c02-post", "KOOT-C-02", "post_treatment", "2026-09-01", 70.0),

  // Non-matching candidate (different land cover / climate zone / elevation):
  // excluded by characteristic matching, not contamination.
  observation("ev-a-c03-pre-early", "KOOT-C-03", "pre_treatment", "2023-03-01", 30.0),
  observation("ev-a-c03-pre-late", "KOOT-C-03", "pre_treatment", "2025-03-01", 31.0),
  observation("ev-a-c03-post", "KOOT-C-03", "post_treatment", "2026-09-01", 33.0),
];

/**
 * Primary M1 demonstration fixture. The restorer claims 35.0 ha of gain.
 * The treated parcel really did gain 61.0 percentage points of canopy
 * cover, but the matched, uncontaminated controls gained a mean of 15.0
 * points over the same window (regional background greening). The
 * additionality-adjusted gain is ~21.39 ha; after the M1 uncertainty margin
 * the settled quantity is ~18.18 ha — below the 35.0 ha claim, so the
 * verdict is PARTIAL.
 */
export const FIXTURE_PARTIAL_SETTLEMENT: Project = {
  projectId: "kootenay-riparian-restoration-partial",
  name: "Kootenay Riparian Restoration (SYNTHETIC)",
  location:
    "Kootenay River riparian corridor, British Columbia, Canada — SYNTHETIC DEMONSTRATION DATA, not a real location or real restoration project.",
  treatedParcel: treatedParcelA,
  candidateControlParcels: [controlCleanA1, controlCleanA2, controlContaminatedA, controlNonMatchingA],
  evidence: evidenceA,
  claimedQuantity: 35.0,
  window: STANDARD_WINDOW,
};

/**
 * Identical evidence to FIXTURE_PARTIAL_SETTLEMENT, but with a lower claim
 * (10.0 ha) that the ~18.18 ha settled quantity fully covers -> VERIFIED.
 * Exists to exercise the VERIFIED branch of `verificationStatus` without
 * duplicating the underlying dataset.
 */
export const FIXTURE_FULL_SETTLEMENT: Project = {
  ...FIXTURE_PARTIAL_SETTLEMENT,
  projectId: "kootenay-riparian-restoration-verified",
  claimedQuantity: 10.0,
};

/**
 * Same structure as FIXTURE_PARTIAL_SETTLEMENT but with claimedQuantity <= 0,
 * which the input-validation gate rejects before any control matching or
 * trend analysis runs.
 */
export const FIXTURE_INVALID_CLAIM: Project = {
  ...FIXTURE_PARTIAL_SETTLEMENT,
  projectId: "kootenay-riparian-restoration-invalid-claim",
  claimedQuantity: 0,
};

// ---------------------------------------------------------------------------
// Fixture B — parallel-trend diagnostic FAILs
// ---------------------------------------------------------------------------

const treatedParcelB: Parcel = {
  parcelId: "KOOT-T-02",
  role: "treated",
  areaHectares: 50.0,
  characteristics: {
    landCover: "riparian_forest",
    elevationMeters: 600,
    slopeDegrees: 6,
    aspect: "SW",
    soilType: "alluvial_loam",
    climateZone: "interior_temperate_wet",
  },
};

const controlCleanB1: Parcel = {
  parcelId: "KOOT-C-05",
  role: "control_candidate",
  areaHectares: 40.0,
  characteristics: {
    landCover: "riparian_forest",
    elevationMeters: 605,
    slopeDegrees: 6.2,
    aspect: "SW",
    soilType: "alluvial_loam",
    climateZone: "interior_temperate_wet",
  },
};

const controlCleanB2: Parcel = {
  parcelId: "KOOT-C-06",
  role: "control_candidate",
  areaHectares: 44.0,
  characteristics: {
    landCover: "riparian_forest",
    elevationMeters: 595,
    slopeDegrees: 5.8,
    aspect: "SW",
    soilType: "alluvial_loam",
    climateZone: "interior_temperate_wet",
  },
};

const evidenceB: readonly EvidenceObservation[] = [
  // Treated parcel: already diverging sharply pre-treatment (+5.0 pp/yr) —
  // e.g. unrelated recovery from an earlier disturbance, not the funded
  // intervention. This must block settlement even though the post-treatment
  // value looks similar to Fixture A's.
  observation("ev-b-t02-pre-early", "KOOT-T-02", "pre_treatment", "2023-03-01", 20.0),
  observation("ev-b-t02-pre-late", "KOOT-T-02", "pre_treatment", "2025-03-01", 30.0),
  observation("ev-b-t02-post", "KOOT-T-02", "post_treatment", "2026-09-01", 85.0),

  observation("ev-b-c05-pre-early", "KOOT-C-05", "pre_treatment", "2023-03-01", 21.0),
  observation("ev-b-c05-pre-late", "KOOT-C-05", "pre_treatment", "2025-03-01", 23.0),
  observation("ev-b-c05-post", "KOOT-C-05", "post_treatment", "2026-09-01", 40.0),

  observation("ev-b-c06-pre-early", "KOOT-C-06", "pre_treatment", "2023-03-01", 23.0),
  observation("ev-b-c06-pre-late", "KOOT-C-06", "pre_treatment", "2025-03-01", 25.0),
  observation("ev-b-c06-post", "KOOT-C-06", "post_treatment", "2026-09-01", 38.0),
];

export const FIXTURE_PARALLEL_TREND_FAIL: Project = {
  projectId: "kootenay-riparian-restoration-trend-fail",
  name: "Kootenay Riparian Restoration — Pre-Trend Divergence (SYNTHETIC)",
  location:
    "Kootenay River riparian corridor, British Columbia, Canada — SYNTHETIC DEMONSTRATION DATA, not a real location or real restoration project.",
  treatedParcel: treatedParcelB,
  candidateControlParcels: [controlCleanB1, controlCleanB2],
  evidence: evidenceB,
  claimedQuantity: 40.0,
  window: STANDARD_WINDOW,
};

// ---------------------------------------------------------------------------
// Fixture C — missing post-treatment evidence
// ---------------------------------------------------------------------------

const treatedParcelC: Parcel = {
  parcelId: "KOOT-T-03",
  role: "treated",
  areaHectares: 30.0,
  characteristics: {
    landCover: "riparian_forest",
    elevationMeters: 615,
    slopeDegrees: 6,
    aspect: "SW",
    soilType: "alluvial_loam",
    climateZone: "interior_temperate_wet",
  },
};

const controlCleanC: Parcel = {
  parcelId: "KOOT-C-07",
  role: "control_candidate",
  areaHectares: 33.0,
  characteristics: {
    landCover: "riparian_forest",
    elevationMeters: 612,
    slopeDegrees: 6.1,
    aspect: "SW",
    soilType: "alluvial_loam",
    climateZone: "interior_temperate_wet",
  },
};

const controlCleanC2: Parcel = {
  parcelId: "KOOT-C-08",
  role: "control_candidate",
  areaHectares: 36.0,
  characteristics: {
    landCover: "riparian_forest",
    elevationMeters: 618,
    slopeDegrees: 5.9,
    aspect: "SW",
    soilType: "alluvial_loam",
    climateZone: "interior_temperate_wet",
  },
};

/**
 * Deliberately has ONLY pre-treatment observations for the treated parcel.
 * Represents an evidence-quality failure: the restorer submitted a claim
 * before any post-treatment monitoring evidence existed.
 */
export const FIXTURE_MISSING_POST_EVIDENCE: Project = {
  projectId: "kootenay-riparian-restoration-missing-post-evidence",
  name: "Kootenay Riparian Restoration — Incomplete Monitoring (SYNTHETIC)",
  location:
    "Kootenay River riparian corridor, British Columbia, Canada — SYNTHETIC DEMONSTRATION DATA, not a real location or real restoration project.",
  treatedParcel: treatedParcelC,
  candidateControlParcels: [controlCleanC, controlCleanC2],
  evidence: [
    observation("ev-c-t03-pre-early", "KOOT-T-03", "pre_treatment", "2023-03-01", 22.0),
    observation("ev-c-t03-pre-late", "KOOT-T-03", "pre_treatment", "2025-03-01", 24.0),
    observation("ev-c-c07-pre-early", "KOOT-C-07", "pre_treatment", "2023-03-01", 21.0),
    observation("ev-c-c07-pre-late", "KOOT-C-07", "pre_treatment", "2025-03-01", 23.0),
    observation("ev-c-c07-post", "KOOT-C-07", "post_treatment", "2026-09-01", 40.0),
    observation("ev-c-c08-pre-early", "KOOT-C-08", "pre_treatment", "2023-03-01", 23.0),
    observation("ev-c-c08-pre-late", "KOOT-C-08", "pre_treatment", "2025-03-01", 25.0),
    observation("ev-c-c08-post", "KOOT-C-08", "post_treatment", "2026-09-01", 38.0),
    // no post_treatment observation for KOOT-T-03
  ],
  claimedQuantity: 12.0,
  window: STANDARD_WINDOW,
};

// ---------------------------------------------------------------------------
// Fixture D — insufficient eligible controls
// ---------------------------------------------------------------------------

const treatedParcelD: Parcel = {
  parcelId: "KOOT-T-04",
  role: "treated",
  areaHectares: 28.0,
  characteristics: {
    landCover: "riparian_forest",
    elevationMeters: 625,
    slopeDegrees: 6,
    aspect: "SW",
    soilType: "alluvial_loam",
    climateZone: "interior_temperate_wet",
  },
};

const controlCleanD: Parcel = {
  parcelId: "KOOT-C-09",
  role: "control_candidate",
  areaHectares: 31.0,
  characteristics: {
    landCover: "riparian_forest",
    elevationMeters: 620,
    slopeDegrees: 6.3,
    aspect: "SW",
    soilType: "alluvial_loam",
    climateZone: "interior_temperate_wet",
  },
};

const controlContaminatedD: Parcel = {
  parcelId: "KOOT-C-10",
  role: "control_candidate",
  areaHectares: 27.0,
  characteristics: {
    landCover: "riparian_forest",
    elevationMeters: 622,
    slopeDegrees: 6.1,
    aspect: "SW",
    soilType: "alluvial_loam",
    climateZone: "interior_temperate_wet",
  },
  contaminationReason: "shared_hydrology_with_treated_parcel",
};

const controlNonMatchingD: Parcel = {
  parcelId: "KOOT-C-11",
  role: "control_candidate",
  areaHectares: 60.0,
  characteristics: {
    landCover: "montane_grassland",
    elevationMeters: 1180,
    slopeDegrees: 14,
    aspect: "N",
    soilType: "sandy_loam",
    climateZone: "interior_temperate_dry",
  },
};

/**
 * Only one candidate (KOOT-C-09) is both uncontaminated and characteristic-
 * matched; the other two are excluded (one contaminated, one non-matching).
 * With `minimumControlCount: 2` in the default config, this is one control
 * short, and the engine must stop before ever running the parallel-trend
 * diagnostic.
 */
export const FIXTURE_INSUFFICIENT_CONTROLS: Project = {
  projectId: "kootenay-riparian-restoration-insufficient-controls",
  name: "Kootenay Riparian Restoration — Thin Control Pool (SYNTHETIC)",
  location:
    "Kootenay River riparian corridor, British Columbia, Canada — SYNTHETIC DEMONSTRATION DATA, not a real location or real restoration project.",
  treatedParcel: treatedParcelD,
  candidateControlParcels: [controlCleanD, controlContaminatedD, controlNonMatchingD],
  evidence: [
    observation("ev-d-t04-pre-early", "KOOT-T-04", "pre_treatment", "2023-03-01", 22.0),
    observation("ev-d-t04-pre-late", "KOOT-T-04", "pre_treatment", "2025-03-01", 24.0),
    observation("ev-d-t04-post", "KOOT-T-04", "post_treatment", "2026-09-01", 80.0),
    observation("ev-d-c09-pre-early", "KOOT-C-09", "pre_treatment", "2023-03-01", 21.0),
    observation("ev-d-c09-pre-late", "KOOT-C-09", "pre_treatment", "2025-03-01", 23.0),
    observation("ev-d-c09-post", "KOOT-C-09", "post_treatment", "2026-09-01", 39.0),
    observation("ev-d-c10-pre-early", "KOOT-C-10", "pre_treatment", "2023-03-01", 20.0),
    observation("ev-d-c10-pre-late", "KOOT-C-10", "pre_treatment", "2025-03-01", 22.0),
    observation("ev-d-c10-post", "KOOT-C-10", "post_treatment", "2026-09-01", 68.0),
    observation("ev-d-c11-pre-early", "KOOT-C-11", "pre_treatment", "2023-03-01", 30.0),
    observation("ev-d-c11-pre-late", "KOOT-C-11", "pre_treatment", "2025-03-01", 31.0),
    observation("ev-d-c11-post", "KOOT-C-11", "post_treatment", "2026-09-01", 33.0),
  ],
  claimedQuantity: 18.0,
  window: STANDARD_WINDOW,
};
