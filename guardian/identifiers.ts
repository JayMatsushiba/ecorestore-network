/**
 * Ecorestore Network — Guardian Deterministic Identifiers (M2)
 *
 * M2 SIMPLIFICATION: these are SHA-256 digests over a canonical (sorted-key)
 * JSON encoding of the relevant object, not Hedera Consensus Service
 * timestamps, not Hedera DIDs, and not a production content-addressing
 * scheme. They exist so Guardian-facing records have stable, reproducible,
 * tamper-evident identities without depending on any live Guardian/Hedera
 * integration. See docs/GUARDIAN.md "Mock versus real integration".
 *
 * This module is deliberately separate from
 * `verification/calculations/evidenceHash.ts`: that module hashes raw
 * evidence observations for the M1 engine; this module hashes
 * Guardian-facing records (a full `VerificationResult`, or small
 * credential/outcome tuples) for the Guardian workflow layer.
 */

import { createHash } from "node:crypto";
import type { VerificationResult } from "../verification/models.js";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Deterministically and recursively stringifies a JSON-compatible value
 * with object keys sorted, so the result is independent of property
 * insertion order. Used to hash whole records (including nested objects
 * like `uncertainty` and `diagnostics`) so that a mutation anywhere in the
 * structure changes the resulting identifier.
 */
function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalStringify(entry)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const entries = keys.map((key) => `${JSON.stringify(key)}:${canonicalStringify(record[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Identifies a specific M1 `VerificationResult` by hashing its entire
 * structure (canonicalized). Re-deriving this from a possibly-mutated copy
 * of the result and comparing it to a previously recorded value is the
 * mechanism `validation.ts` uses to detect tampering.
 */
export function computeVerificationResultId(result: VerificationResult): string {
  return `guardian-vr:sha256:${sha256Hex(canonicalStringify(result))}`;
}

export function computeEvidenceSubmissionId(projectId: string, evidenceHash: string): string {
  return `guardian-evidence:sha256:${sha256Hex(canonicalStringify({ projectId, evidenceHash }))}`;
}

export function computeCredentialId(
  verificationResultId: string,
  verifierId: string,
  guardianPolicyVersion: string,
): string {
  return `guardian-cred:sha256:${sha256Hex(canonicalStringify({ verificationResultId, verifierId, guardianPolicyVersion }))}`;
}

export function computeOutcomeId(credentialId: string): string {
  return `guardian-outcome:sha256:${sha256Hex(canonicalStringify({ credentialId }))}`;
}
