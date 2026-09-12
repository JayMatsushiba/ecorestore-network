/**
 * Ecorestore Network — Observation Grouping (M1)
 *
 * Shared helpers for pulling a single parcel's pre-/post-treatment evidence
 * for a given metric out of a project's flat evidence list, and for
 * deriving the "levels" and "trend slope" used by the DiD and parallel-trend
 * calculations. Kept separate from those calculations so both can reuse the
 * exact same grouping logic (see M1 prompt §18: separate data access from
 * scientific calculation).
 */

import type { EvidenceObservation, MetricId, ParcelId } from "../models.js";

export interface ParcelMetricObservations {
  /** Pre-treatment observations for this parcel/metric, sorted ascending by `observedAt`. */
  readonly preTreatment: readonly EvidenceObservation[];
  /** Post-treatment observations for this parcel/metric, sorted ascending by `observedAt`. */
  readonly postTreatment: readonly EvidenceObservation[];
}

export function groupParcelObservations(
  evidence: readonly EvidenceObservation[],
  parcelId: ParcelId,
  metric: MetricId,
): ParcelMetricObservations {
  const forParcel = evidence.filter((observation) => observation.parcelId === parcelId && observation.metric === metric);

  const preTreatment = forParcel
    .filter((observation) => observation.period === "pre_treatment")
    .slice()
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt));

  const postTreatment = forParcel
    .filter((observation) => observation.period === "post_treatment")
    .slice()
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt));

  return { preTreatment, postTreatment };
}

/**
 * The pre-treatment "level" used as the DiD baseline: the pre-treatment
 * observation closest to treatment start, i.e. the latest pre-treatment
 * observation. Returns `null` if there is no pre-treatment observation.
 */
export function latestPreTreatmentLevel(observations: ParcelMetricObservations): number | null {
  const last = observations.preTreatment.at(-1);
  return last ? last.value : null;
}

/**
 * The post-treatment "level" used as the DiD endpoint: the mean of all
 * post-treatment observations (M1 fixtures typically have exactly one).
 * Returns `null` if there is no post-treatment observation.
 */
export function meanPostTreatmentLevel(observations: ParcelMetricObservations): number | null {
  if (observations.postTreatment.length === 0) {
    return null;
  }
  const sum = observations.postTreatment.reduce((accumulator, observation) => accumulator + observation.value, 0);
  return sum / observations.postTreatment.length;
}

/**
 * Pre-treatment trend slope in metric units per year, computed from the
 * earliest and latest pre-treatment observations for this parcel/metric.
 *
 * M1 SIMPLIFICATION: this is a two-point linear slope, not a fitted
 * multi-point regression over a long historical baseline. Requires at least
 * two distinct-dated pre-treatment observations; returns `null` otherwise
 * (insufficient evidence to establish a trend) rather than guessing from a
 * single point.
 */
export function preTreatmentSlopePerYear(observations: ParcelMetricObservations): number | null {
  if (observations.preTreatment.length < 2) {
    return null;
  }
  const first = observations.preTreatment[0];
  const last = observations.preTreatment.at(-1);
  if (!first || !last) {
    return null;
  }
  const yearsElapsed = daysBetween(first.observedAt, last.observedAt) / 365.25;
  if (yearsElapsed <= 0) {
    return null;
  }
  return (last.value - first.value) / yearsElapsed;
}

function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return (end - start) / (1000 * 60 * 60 * 24);
}
