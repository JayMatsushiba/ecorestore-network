import { describe, expect, it } from "vitest";
import {
  computeCredentialId,
  computeEvidenceSubmissionId,
  computeOutcomeId,
  computeVerificationResultId,
} from "../identifiers.js";
import { verifyProject } from "../../verification/engine.js";
import { DEFAULT_METHODOLOGY_CONFIG } from "../../verification/config.js";
import { FIXTURE_PARTIAL_SETTLEMENT } from "../../verification/fixtures.js";

describe("computeVerificationResultId", () => {
  const result = verifyProject(FIXTURE_PARTIAL_SETTLEMENT, DEFAULT_METHODOLOGY_CONFIG);

  it("is deterministic for identical results", () => {
    const again = verifyProject(FIXTURE_PARTIAL_SETTLEMENT, DEFAULT_METHODOLOGY_CONFIG);
    expect(computeVerificationResultId(result)).toBe(computeVerificationResultId(again));
  });

  it("changes if any field is altered (tamper-detection basis)", () => {
    const tampered = { ...result, settledQuantity: result.settledQuantity + 1000 };
    expect(computeVerificationResultId(tampered)).not.toBe(computeVerificationResultId(result));
  });

  it("changes if a nested field (e.g. uncertainty) is altered", () => {
    const tampered = { ...result, uncertainty: { ...result.uncertainty, lowerBound: 999 } };
    expect(computeVerificationResultId(tampered)).not.toBe(computeVerificationResultId(result));
  });

  it("is insensitive to key insertion order", () => {
    // Rebuild the same object with keys in reverse order.
    const reversed = Object.fromEntries(Object.entries(result).reverse()) as typeof result;
    expect(computeVerificationResultId(reversed)).toBe(computeVerificationResultId(result));
  });
});

describe("id-derivation helpers are deterministic and input-sensitive", () => {
  it("computeEvidenceSubmissionId", () => {
    const a = computeEvidenceSubmissionId("proj-1", "sha256:aaa");
    const b = computeEvidenceSubmissionId("proj-1", "sha256:aaa");
    const c = computeEvidenceSubmissionId("proj-1", "sha256:bbb");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("computeCredentialId", () => {
    const a = computeCredentialId("vr-1", "verifier-1", "policy-v1");
    const b = computeCredentialId("vr-1", "verifier-1", "policy-v1");
    const c = computeCredentialId("vr-1", "verifier-2", "policy-v1");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("computeOutcomeId", () => {
    const a = computeOutcomeId("cred-1");
    const b = computeOutcomeId("cred-1");
    const c = computeOutcomeId("cred-2");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
