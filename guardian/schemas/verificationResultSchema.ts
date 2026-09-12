/**
 * Ecorestore Network — Guardian VerificationResult Shape Validation (M2)
 *
 * Checks that an incoming M1 `VerificationResult` carries the identity
 * fields Guardian's workflow and provenance model depend on (M2 prompt §5,
 * §16 "Missing evidence identity" / "Missing verification identity"). This
 * is NOT a re-check of the scientific calculation — M1 already owns that
 * (see CLAUDE.md, M2 prompt §4: "do not rewrite or improve" M1 logic).
 */

import type { VerificationResult } from "../../verification/models.js";
import type { ShapeValidationResult } from "./shapeValidation.js";

export function validateVerificationResultShape(result: VerificationResult): ShapeValidationResult {
  if (!result.projectId) {
    return { valid: false, reason: "missing project identity" };
  }
  if (!result.parcelH3Root) {
    return { valid: false, reason: "missing parcel/H3 identity" };
  }
  if (!result.methodologyVersion) {
    return { valid: false, reason: "missing methodology version" };
  }
  if (!result.evidenceHash) {
    return { valid: false, reason: "missing evidence identity (evidenceHash)" };
  }
  return { valid: true };
}
