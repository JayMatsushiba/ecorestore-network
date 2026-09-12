/**
 * Ecorestore Network — Difference-in-Differences (M1)
 *
 * DiD = (treatedPost - treatedPre) - (controlPost - controlPre)
 *
 * The control pre/post levels are the mean, across eligible control
 * parcels, of each parcel's own (latest pre-treatment, mean post-treatment)
 * levels — i.e. this is the average of individual control changes. For
 * equal-sized groups this coincides with "change of the group means"; the
 * implementation always uses the average-of-changes form for clarity about
 * what it is doing. See docs/VERIFICATION.md §8.
 *
 * This function is only called by the engine after it has already confirmed
 * sufficient evidence exists and the parallel-trend diagnostic passed (see
 * engine.ts) — a missing observation here indicates an engine-level logic
 * error, not an expected runtime condition, so it throws rather than
 * returning a fabricated value.
 */

import type { EvidenceObservation, MethodologyConfiguration, Parcel } from "../models.js";
import { groupParcelObservations, latestPreTreatmentLevel, meanPostTreatmentLevel } from "./observationGrouping.js";

export interface DifferenceInDifferencesResult {
  readonly treatedPreTreatmentLevel: number;
  readonly treatedPostTreatmentLevel: number;
  readonly treatedObservedChange: number;
  readonly controlPreTreatmentLevel: number;
  readonly controlPostTreatmentLevel: number;
  readonly controlObservedChange: number;
  readonly differenceInDifferences: number;
}

export function computeDifferenceInDifferences(
  treated: Parcel,
  eligibleControls: readonly Parcel[],
  evidence: readonly EvidenceObservation[],
  config: MethodologyConfiguration,
): DifferenceInDifferencesResult {
  const treatedObservations = groupParcelObservations(evidence, treated.parcelId, config.metric);
  const treatedPreTreatmentLevel = requireLevel(
    latestPreTreatmentLevel(treatedObservations),
    treated.parcelId,
    "pre-treatment",
  );
  const treatedPostTreatmentLevel = requireLevel(
    meanPostTreatmentLevel(treatedObservations),
    treated.parcelId,
    "post-treatment",
  );
  const treatedObservedChange = treatedPostTreatmentLevel - treatedPreTreatmentLevel;

  const controlPreLevels: number[] = [];
  const controlPostLevels: number[] = [];
  const controlChanges: number[] = [];

  for (const control of eligibleControls) {
    const controlObservations = groupParcelObservations(evidence, control.parcelId, config.metric);
    const pre = requireLevel(latestPreTreatmentLevel(controlObservations), control.parcelId, "pre-treatment");
    const post = requireLevel(meanPostTreatmentLevel(controlObservations), control.parcelId, "post-treatment");
    controlPreLevels.push(pre);
    controlPostLevels.push(post);
    controlChanges.push(post - pre);
  }

  const controlPreTreatmentLevel = mean(controlPreLevels);
  const controlPostTreatmentLevel = mean(controlPostLevels);
  const controlObservedChange = mean(controlChanges);

  const differenceInDifferences = treatedObservedChange - controlObservedChange;

  return {
    treatedPreTreatmentLevel,
    treatedPostTreatmentLevel,
    treatedObservedChange,
    controlPreTreatmentLevel,
    controlPostTreatmentLevel,
    controlObservedChange,
    differenceInDifferences,
  };
}

function requireLevel(value: number | null, parcelId: string, label: string): number {
  if (value === null) {
    throw new Error(
      `Missing ${label} observation for parcel ${parcelId}; the engine should have validated evidence sufficiency before calling computeDifferenceInDifferences.`,
    );
  }
  return value;
}

function mean(values: readonly number[]): number {
  return values.reduce((accumulator, value) => accumulator + value, 0) / values.length;
}
