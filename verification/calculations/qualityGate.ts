/**
 * Ecorestore Network — Quality Gate (M1)
 *
 * Evaluates the overall quality gate for a verification run. Ordering
 * matters and mirrors docs/VERIFICATION.md §12:
 *
 *  1. Missing/invalid required evidence (including too few eligible,
 *     uncontaminated, matched control parcels) -> INSUFFICIENT_EVIDENCE.
 *  2. A parallel-trend diagnostic that is not PASS -> INSUFFICIENT_EVIDENCE.
 *     Both FAIL and INSUFFICIENT_EVIDENCE trend outcomes map here: neither
 *     is sufficient support for a settlement quantity (M1 prompt §8 — "do
 *     NOT override this failure merely because the post-treatment effect
 *     looks large").
 *  3. An invalid uncertainty interval/configuration -> INVALID_RESULT.
 *  4. Otherwise -> PASS.
 *
 * A failed gate must never be silently converted into PASS by this function
 * or its caller.
 */

import type { ParallelTrendStatus, QualityGateStatus, UncertaintyStatus } from "../models.js";

export interface QualityGateInput {
  readonly hasSufficientEvidence: boolean;
  readonly parallelTrendStatus: ParallelTrendStatus;
  /** `null` when the uncertainty model was never evaluated (an earlier gate already blocked the pipeline). */
  readonly uncertaintyStatus: UncertaintyStatus | null;
}

export function evaluateQualityGate(input: QualityGateInput): QualityGateStatus {
  if (!input.hasSufficientEvidence) {
    return "INSUFFICIENT_EVIDENCE";
  }
  if (input.parallelTrendStatus !== "PASS") {
    return "INSUFFICIENT_EVIDENCE";
  }
  if (input.uncertaintyStatus !== "VALID") {
    return "INVALID_RESULT";
  }
  return "PASS";
}
