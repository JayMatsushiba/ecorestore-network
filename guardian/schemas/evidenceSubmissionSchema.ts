/**
 * Ecorestore Network — Guardian Evidence Submission Schema (M2)
 *
 * Structural shape for the input to `submitEvidence` (workflow.ts). This is
 * intentionally thin in M2: it validates identity fields only, since the
 * actual evidence content is already validated and hashed by M1
 * (verification/calculations/evidenceHash.ts) before it ever reaches
 * Guardian. A production Guardian policy would define a full evidence
 * schema (per-tier fields, units, provenance) — see docs/GUARDIAN.md.
 */

import type { ShapeValidationResult } from "./shapeValidation.js";

export interface EvidenceSubmissionInput {
  readonly projectId: string;
  readonly parcelH3Root: string;
  readonly evidenceHash: string;
}

export function validateEvidenceSubmissionInput(input: EvidenceSubmissionInput): ShapeValidationResult {
  if (!input.projectId) {
    return { valid: false, reason: "missing project identity" };
  }
  if (!input.parcelH3Root) {
    return { valid: false, reason: "missing parcel/H3 identity" };
  }
  if (!input.evidenceHash) {
    return { valid: false, reason: "missing evidence identity (evidenceHash)" };
  }
  return { valid: true };
}
