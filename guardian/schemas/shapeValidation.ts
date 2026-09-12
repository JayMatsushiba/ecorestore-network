/**
 * Ecorestore Network — Guardian Shape Validation (M2)
 *
 * Shared result type for Guardian-facing schema/shape checks. These are
 * structural checks (required identity fields present and non-empty), not
 * a re-implementation of M1's scientific input validation
 * (verification/calculations/inputValidation.ts) and not a full JSON Schema
 * engine — see the M2 prompt §3 item 3 ("Guardian-compatible evidence
 * schema") and §18 (dependency discipline: no schema-validation library was
 * added for this).
 */

export interface ShapeValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
}
