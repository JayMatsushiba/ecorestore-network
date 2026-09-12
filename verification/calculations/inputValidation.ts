/**
 * Ecorestore Network — Input Validation (M1)
 *
 * Basic sufficiency checks on a project's declared evidence, independent of
 * control matching or the parallel-trend diagnostic. These catch malformed
 * or incomplete inputs early with an explicit reason, rather than letting
 * later calculation stages fail with a generic error or silently compute a
 * nonsensical result.
 */

import type { MethodologyConfiguration, Project } from "../models.js";
import { groupParcelObservations } from "./observationGrouping.js";

export interface EvidenceValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
}

export function validateEvidenceSufficiency(
  project: Project,
  config: MethodologyConfiguration,
): EvidenceValidationResult {
  if (!(project.claimedQuantity > 0)) {
    return { valid: false, reason: "claimedQuantity must be a positive number" };
  }

  if (!(project.treatedParcel.areaHectares > 0)) {
    return { valid: false, reason: "treated parcel areaHectares must be a positive number" };
  }

  const treatedObservations = groupParcelObservations(
    project.evidence,
    project.treatedParcel.parcelId,
    config.metric,
  );

  if (treatedObservations.preTreatment.length === 0) {
    return {
      valid: false,
      reason: "no pre-treatment observations found for the treated parcel for the configured metric",
    };
  }

  if (treatedObservations.postTreatment.length === 0) {
    return {
      valid: false,
      reason: "no post-treatment observations found for the treated parcel for the configured metric",
    };
  }

  const window = project.window;
  const preStart = new Date(window.preTreatmentStart).getTime();
  const preEnd = new Date(window.preTreatmentEnd).getTime();
  const postStart = new Date(window.postTreatmentStart).getTime();
  const postEnd = new Date(window.postTreatmentEnd).getTime();

  if (
    [preStart, preEnd, postStart, postEnd].some((value) => Number.isNaN(value)) ||
    preStart >= preEnd ||
    preEnd > postStart ||
    postStart >= postEnd
  ) {
    return { valid: false, reason: "observation window is not chronologically well-formed" };
  }

  return { valid: true };
}
