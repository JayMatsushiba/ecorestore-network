/**
 * Ecorestore Network — Guardian Workflow Validation (M2)
 *
 * Pure validation functions used by workflow.ts. Separate from
 * `schemas/` (structural shape checks) and `policy/` (registries) —
 * this module implements the checks that combine the two: methodology
 * allowlisting and submission-integrity (tamper) detection.
 */

import { computeVerificationResultId } from "./identifiers.js";
import { isSupportedMethodologyVersion } from "./policy/methodologyRegistry.js";
import type { VerificationResult } from "../verification/models.js";
import type { VerificationSubmission } from "./models.js";

export interface IntegrityCheckResult {
  readonly valid: boolean;
  readonly reason?: string;
}

export function validateMethodologyVersion(methodologyVersion: string): IntegrityCheckResult {
  if (!isSupportedMethodologyVersion(methodologyVersion)) {
    return { valid: false, reason: `unsupported methodology version: ${methodologyVersion}` };
  }
  return { valid: true };
}

/**
 * Re-derives the verification-result identity from `result` and compares
 * it to the identity recorded on `submission` at submission time. A
 * mismatch means the object presented now is not byte-for-byte identical
 * to what Guardian originally received under this `submissionId` — i.e. it
 * was altered after the fact, or the wrong result was supplied. This is
 * the mechanism behind the M2 prompt's "Tampered verification result ->
 * rejected" requirement (Test E).
 *
 * This is a structural equality check, not a cryptographic signature
 * verification — see docs/GUARDIAN.md "Mock versus real integration" for
 * what a production integration would add (e.g. a signed Hedera
 * Consensus Service message).
 */
export function validateSubmissionIntegrity(
  submission: VerificationSubmission,
  result: VerificationResult,
): IntegrityCheckResult {
  const recomputed = computeVerificationResultId(result);
  if (recomputed !== submission.verificationResultId) {
    return {
      valid: false,
      reason: "verification result does not match the identity recorded at submission time (possible tampering)",
    };
  }
  return { valid: true };
}
