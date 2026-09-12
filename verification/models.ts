/**
 * Ecorestore Network — Verification Data Models (M1)
 *
 * These types define the deterministic verification engine's inputs and
 * outputs. See docs/VERIFICATION.md for the pipeline these support and
 * docs/ARCHITECTURE.md for how the engine fits into the wider system.
 *
 * M1 SCOPE NOTE: this is a single-metric, single-treated-parcel prototype
 * data model. It is intentionally narrower than the full production data
 * model described in proposals/idea-0.2.md (multi-tier evidence, STAC/H3
 * geospatial stack, Hedera Guardian methodology objects, etc.). Do not
 * extend this file with later-milestone concerns (Guardian, Arc, Graph,
 * AI) — see CLAUDE.md "Architecture Boundaries".
 */

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

export type ProjectId = string;
export type ParcelId = string;
export type EvidenceId = string;

/**
 * The ecological metric being verified. M1 supports a single metric id as a
 * simplification — see docs/VERIFICATION.md "Known Limitations".
 */
export type MetricId = string;

// ---------------------------------------------------------------------------
// Spatial / parcel model
// ---------------------------------------------------------------------------

export type ParcelRole = "treated" | "control_candidate";

export type CompassAspect = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

/**
 * Reasons a candidate control parcel may be excluded as a contaminated
 * (non-independent) counterfactual. See docs/VERIFICATION.md §6.
 */
export type ContaminationReason =
  | "known_concurrent_intervention"
  | "adjacent_to_treated_parcel_with_plausible_spillover"
  | "shared_hydrology_with_treated_parcel";

export interface ParcelCharacteristics {
  readonly landCover: string;
  readonly elevationMeters: number;
  readonly slopeDegrees: number;
  readonly aspect: CompassAspect;
  readonly soilType: string;
  readonly climateZone: string;
}

export interface Parcel {
  readonly parcelId: ParcelId;
  readonly role: ParcelRole;
  readonly areaHectares: number;
  readonly characteristics: ParcelCharacteristics;
  /**
   * Present only when the parcel is a known/plausible contamination risk as
   * a counterfactual (e.g. spillover from the funded intervention). Callers
   * should check for the key's presence rather than comparing to
   * `undefined` explicitly — `exactOptionalPropertyTypes` is enabled, so
   * fixtures omit this key entirely for clean controls rather than setting
   * it to `undefined`.
   */
  readonly contaminationReason?: ContaminationReason;
}

// ---------------------------------------------------------------------------
// Evidence / observations
// ---------------------------------------------------------------------------

export type ObservationPeriod = "pre_treatment" | "post_treatment";

/**
 * M1 uses only synthetic evidence sources. See docs/ARCHITECTURE.md §4 and
 * §6 — production sources (real Sentinel-2/-1, drone, IoT, field reports)
 * are future milestones, not M1.
 */
export type EvidenceSource =
  | "synthetic_satellite_optical"
  | "synthetic_satellite_sar"
  | "synthetic_ground_report";

/**
 * A single atomic evidence reading for one parcel, one metric, at one point
 * in time.
 *
 * `synthetic` is fixed to `true` in M1: every observation the engine
 * consumes in this milestone is demonstration data, never a real
 * field/satellite measurement. See CLAUDE.md "Synthetic Data".
 */
export interface EvidenceObservation {
  readonly evidenceId: EvidenceId;
  readonly parcelId: ParcelId;
  readonly metric: MetricId;
  readonly period: ObservationPeriod;
  readonly value: number;
  readonly observedAt: string; // ISO 8601 date, e.g. "2025-03-01"
  readonly source: EvidenceSource;
  readonly synthetic: true;
}

/**
 * M1 SIMPLIFICATION: `BaselineObservation` and `ControlObservation` are not
 * separate wire formats from `EvidenceObservation`. They are
 * `EvidenceObservation`s distinguished by context:
 *
 * - A `BaselineObservation` is any `EvidenceObservation` whose `period` is
 *   `"pre_treatment"`.
 * - A `ControlObservation` is any `EvidenceObservation` whose `parcelId`
 *   refers to a `Parcel` with `role: "control_candidate"`.
 *
 * The engine derives both groupings at read time (see
 * `verification/calculations/observationGrouping.ts`) rather than requiring
 * callers to pre-partition evidence into different shapes. This keeps the
 * fixture data and validation logic simple, at the cost of not encoding the
 * distinction in the type system beyond the `period` narrowing below.
 */
export type BaselineObservation = EvidenceObservation & { readonly period: "pre_treatment" };
export type ControlObservation = EvidenceObservation;

export interface ObservationWindow {
  readonly preTreatmentStart: string;
  readonly preTreatmentEnd: string;
  readonly postTreatmentStart: string;
  readonly postTreatmentEnd: string;
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export interface Project {
  readonly projectId: ProjectId;
  readonly name: string;
  /** Human-readable location description. Always marked synthetic in M1 fixtures. */
  readonly location: string;
  readonly treatedParcel: Parcel;
  readonly candidateControlParcels: readonly Parcel[];
  readonly evidence: readonly EvidenceObservation[];
  readonly claimedQuantity: number;
  readonly window: ObservationWindow;
}

// ---------------------------------------------------------------------------
// Methodology configuration
// ---------------------------------------------------------------------------

export type UncertaintyModelId = "m1-fixed-fraction-v0.1";

export interface ControlMatchingTolerance {
  readonly elevationMeters: number;
  readonly slopeDegrees: number;
}

export interface MethodologyConfiguration {
  readonly methodologyVersion: string;
  readonly metric: MetricId;
  /**
   * Declared confidence level associated with the uncertainty model, e.g.
   * 0.85. Prototype only — see docs/VERIFICATION.md "Known Limitations".
   * Not derived from a fitted statistical distribution in M1.
   */
  readonly confidenceLevel: number;
  /**
   * Maximum allowed relative divergence between the treated and control
   * pre-treatment trend slopes before the parallel-trend diagnostic fails.
   */
  readonly parallelTrendToleranceRatio: number;
  /**
   * Floor applied to the denominator when computing the pre-treatment slope
   * divergence ratio, to avoid dividing by a near-zero control slope.
   */
  readonly parallelTrendMinimumSlopeDenominator: number;
  readonly uncertaintyModel: UncertaintyModelId;
  /**
   * Simplified prototype uncertainty model parameter: the uncertainty
   * margin as a fraction of the point estimate.
   */
  readonly relativeUncertaintyFraction: number;
  readonly minimumControlCount: number;
  readonly matchingTolerance: ControlMatchingTolerance;
}

// ---------------------------------------------------------------------------
// Uncertainty
// ---------------------------------------------------------------------------

export type UncertaintyStatus =
  | "VALID"
  | "INVALID_CONFIGURATION"
  | "INVALID_INTERVAL"
  /** The uncertainty model was never evaluated because an earlier gate (missing evidence or a non-PASS parallel-trend result) already blocked the pipeline. */
  | "NOT_EVALUATED";

export interface Uncertainty {
  readonly model: UncertaintyModelId;
  readonly confidenceLevel: number;
  readonly pointEstimate: number;
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly status: UncertaintyStatus;
}

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

export type ParallelTrendStatus = "PASS" | "FAIL" | "INSUFFICIENT_EVIDENCE";

export type QualityGateStatus = "PASS" | "INSUFFICIENT_EVIDENCE" | "INVALID_RESULT";

/**
 * `VERIFIED`: the conservative settled quantity fully supports the claim
 * (settledQuantity >= claimedQuantity).
 * `PARTIAL`: the quality gate passed, but the settled quantity is less than
 * what was claimed.
 * `INSUFFICIENT_EVIDENCE` / `INVALID_RESULT`: mirror the quality gate; no
 * valid settlement quantity was produced.
 */
export type VerificationStatus =
  | "VERIFIED"
  | "PARTIAL"
  | "INSUFFICIENT_EVIDENCE"
  | "INVALID_RESULT";

// ---------------------------------------------------------------------------
// Canonical result
// ---------------------------------------------------------------------------

export interface ExcludedControl {
  readonly parcelId: ParcelId;
  readonly reason: ContaminationReason;
}

/**
 * Intermediate values exposed so a reviewer can reconstruct how the
 * canonical result's headline numbers were derived, without re-running the
 * engine. See M1 prompt §10 ("do not hide the calculation behind a single
 * opaque function").
 */
export interface VerificationDiagnostics {
  readonly treatedParcelId: ParcelId;
  readonly eligibleControlParcelIds: readonly ParcelId[];
  readonly excludedContaminatedControls: readonly ExcludedControl[];
  readonly excludedNonMatchingControlParcelIds: readonly ParcelId[];
  readonly treatedPreTreatmentLevel: number;
  readonly treatedPostTreatmentLevel: number;
  readonly treatedObservedChange: number;
  readonly controlPreTreatmentLevel: number;
  readonly controlPostTreatmentLevel: number;
  readonly controlObservedChange: number;
  readonly treatedPreTreatmentSlopePerYear: number | null;
  readonly controlMeanPreTreatmentSlopePerYear: number | null;
  readonly parallelTrendDivergenceRatio: number | null;
}

/**
 * The canonical, serializable verification result. M1 produces this object;
 * M2 determines how Guardian consumes it; M3 determines how Arc uses an
 * authorized verification result for settlement. See docs/VERIFICATION.md §13.
 */
export interface VerificationResult {
  readonly projectId: ProjectId;
  readonly parcelH3Root: string;
  readonly methodologyVersion: string;
  readonly metric: MetricId;
  readonly claimedQuantity: number;
  readonly observedChange: number;
  readonly controlChange: number;
  readonly additionalityAdjusted: number;
  readonly uncertainty: Uncertainty;
  readonly lowerBound: number;
  readonly settledQuantity: number;
  readonly parallelTrendStatus: ParallelTrendStatus;
  readonly qualityGateStatus: QualityGateStatus;
  readonly verificationStatus: VerificationStatus;
  readonly evidenceHash: string;
  /**
   * Reserved for a future content-addressed evidence bundle reference
   * (IPFS/Filecoin CID). Not populated in M1 — no external storage
   * integration exists yet (see CLAUDE.md "Architecture Boundaries").
   * Omitted (not set to `undefined`) whenever unavailable, per
   * `exactOptionalPropertyTypes`.
   */
  readonly evidenceCid?: string;
  readonly window: ObservationWindow;
  readonly diagnostics: VerificationDiagnostics;
}
