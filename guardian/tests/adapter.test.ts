/**
 * Ecorestore Network — Guardian Adapter Security & Workflow Tests (M2)
 *
 * Covers the M2 prompt's required Tests A-I (§14) and the required
 * parameter table (§16). Each test builds a fresh `MockGuardianAdapter` via
 * `createMockGuardianAdapter()` so state never leaks between cases. All
 * timestamps are fixed strings (never `Date.now()`), per the M2 prompt's
 * "no nondeterministic IDs or timestamps in core deterministic tests"
 * instruction.
 */

import { describe, expect, it } from "vitest";
import { createMockGuardianAdapter } from "../adapter.js";
import { computeVerificationResultId } from "../identifiers.js";
import { GUARDIAN_POLICY_VERSION } from "../policy/methodologyRegistry.js";
import { verifyProject } from "../../verification/engine.js";
import { DEFAULT_METHODOLOGY_CONFIG } from "../../verification/config.js";
import {
  FIXTURE_INSUFFICIENT_CONTROLS,
  FIXTURE_PARALLEL_TREND_FAIL,
  FIXTURE_PARTIAL_SETTLEMENT,
} from "../../verification/fixtures.js";
import type { VerificationResult } from "../../verification/models.js";

const AUTHORIZED_VERIFIER = "guardian-verifier-kootenay-001";
const UNAUTHORIZED_VERIFIER = "not-a-real-verifier";

const T0 = "2026-09-10T00:00:00.000Z";
const T1 = "2026-09-10T01:00:00.000Z";
const T2 = "2026-09-10T02:00:00.000Z";
const T3 = "2026-09-10T03:00:00.000Z";

function validPassResult(): VerificationResult {
  return verifyProject(FIXTURE_PARTIAL_SETTLEMENT, DEFAULT_METHODOLOGY_CONFIG);
}

function insufficientEvidenceResult(): VerificationResult {
  return verifyProject(FIXTURE_PARALLEL_TREND_FAIL, DEFAULT_METHODOLOGY_CONFIG);
}

/** Genuinely produced by M1 with a deliberately invalid uncertainty configuration, not a fabricated object. */
function invalidResultResult(): VerificationResult {
  const brokenConfig = { ...DEFAULT_METHODOLOGY_CONFIG, relativeUncertaintyFraction: 1.5 };
  return verifyProject(FIXTURE_PARTIAL_SETTLEMENT, brokenConfig);
}

describe("Test A — valid verification is accepted and can proceed to a recorded outcome", () => {
  it("submits, authorizes, issues a credential, and records an outcome", () => {
    const guardian = createMockGuardianAdapter();
    const result = validPassResult();
    const verificationResultId = computeVerificationResultId(result);

    const submission = guardian.submitVerificationResult(result, T0);
    expect(submission.accepted).toBe(true);
    if (!submission.accepted) return;
    expect(submission.submission.financiallyEligible).toBe(true);
    expect(submission.submission.settledQuantity).toBe(result.settledQuantity);

    const authorization = guardian.authorizeVerification(verificationResultId, AUTHORIZED_VERIFIER, result, T1);
    expect(authorization.accepted).toBe(true);

    const credential = guardian.issueCredential(verificationResultId, AUTHORIZED_VERIFIER, T2);
    expect(credential.accepted).toBe(true);
    if (!credential.accepted) return;
    expect(credential.credential.settledQuantity).toBe(result.settledQuantity);
    expect(credential.credential.guardianPolicyVersion).toBe(GUARDIAN_POLICY_VERSION);

    const outcome = guardian.recordOutcome(credential.credential.credentialId, T3);
    expect(outcome.accepted).toBe(true);
    if (!outcome.accepted) return;
    expect(outcome.outcome.status).toBe("RECORDED");
    expect(outcome.outcome.settledQuantity).toBe(result.settledQuantity);

    expect(guardian.getLifecycleState(result.projectId, result.parcelH3Root)).toBe("OUTCOME_RECORDED");
  });
});

describe("Test B — INSUFFICIENT_EVIDENCE is not financially eligible", () => {
  it("accepts the submission for audit purposes but marks it ineligible and blocks authorization", () => {
    const guardian = createMockGuardianAdapter();
    const result = insufficientEvidenceResult();
    expect(result.verificationStatus).toBe("INSUFFICIENT_EVIDENCE");
    const verificationResultId = computeVerificationResultId(result);

    const submission = guardian.submitVerificationResult(result, T0);
    expect(submission.accepted).toBe(true);
    if (!submission.accepted) return;
    expect(submission.submission.financiallyEligible).toBe(false);

    const authorization = guardian.authorizeVerification(verificationResultId, AUTHORIZED_VERIFIER, result, T1);
    expect(authorization.accepted).toBe(false);

    const credential = guardian.issueCredential(verificationResultId, AUTHORIZED_VERIFIER, T2);
    expect(credential.accepted).toBe(false);

    expect(guardian.getLifecycleState(result.projectId, result.parcelH3Root)).toBe("VERIFICATION_SUBMITTED");
  });
});

describe("Test C — INVALID_RESULT is rejected outright", () => {
  it("refuses to even create a workflow submission", () => {
    const guardian = createMockGuardianAdapter();
    const result = invalidResultResult();
    expect(result.qualityGateStatus).toBe("INVALID_RESULT");

    const submission = guardian.submitVerificationResult(result, T0);
    expect(submission.accepted).toBe(false);

    expect(guardian.getLifecycleState(result.projectId, result.parcelH3Root)).toBe("NO_SUBMISSION");
  });
});

describe("Test D — an unauthorized verifier cannot create an authorized verification", () => {
  it("rejects authorization from a verifier not on the allowlist", () => {
    const guardian = createMockGuardianAdapter();
    const result = validPassResult();
    const verificationResultId = computeVerificationResultId(result);
    guardian.submitVerificationResult(result, T0);

    const authorization = guardian.authorizeVerification(verificationResultId, UNAUTHORIZED_VERIFIER, result, T1);
    expect(authorization.accepted).toBe(false);

    expect(guardian.getLifecycleState(result.projectId, result.parcelH3Root)).toBe("VERIFICATION_SUBMITTED");
  });
});

describe("Test E — a tampered settledQuantity is rejected at authorization", () => {
  it("detects that the presented result no longer matches the submitted identity", () => {
    const guardian = createMockGuardianAdapter();
    const result = validPassResult();
    const verificationResultId = computeVerificationResultId(result);
    guardian.submitVerificationResult(result, T0);

    const tamperedResult: VerificationResult = { ...result, settledQuantity: result.settledQuantity + 999 };

    // Attacker presents the tampered object under the ORIGINAL submission
    // identity (as if nothing changed) — this is exactly the tamper
    // scenario Test E describes.
    const authorization = guardian.authorizeVerification(verificationResultId, AUTHORIZED_VERIFIER, tamperedResult, T1);
    expect(authorization.accepted).toBe(false);
  });
});

describe("Test F — methodology mismatch is rejected", () => {
  it("rejects a result whose methodologyVersion is not on Guardian's allowlist", () => {
    const guardian = createMockGuardianAdapter();
    const result = validPassResult();
    const mismatched: VerificationResult = { ...result, methodologyVersion: "ecorestore-m1-v9.9-unsupported" };

    const submission = guardian.submitVerificationResult(mismatched, T0);
    expect(submission.accepted).toBe(false);
  });
});

describe("Test G — AI authority boundary: no bare quantity can enter the settlement/outcome path", () => {
  it("rejects an object shaped like an AI-generated number wrapper, lacking real M1 identity", () => {
    const guardian = createMockGuardianAdapter();

    // Simulates an AI (or any non-M1 caller) trying to inject a number
    // directly, dressed up as a VerificationResult but without the
    // identity fields a real verifyProject() output always carries.
    const aiGenerated = { settledQuantity: 999999, qualityGateStatus: "PASS" } as unknown as VerificationResult;

    const submission = guardian.submitVerificationResult(aiGenerated, T0);
    expect(submission.accepted).toBe(false);
  });

  it("rejects a bare-number injection attempt even if it reaches authorizeVerification directly", () => {
    // Defense in depth: even if a caller bypassed submitVerificationResult
    // entirely and tried to authorize directly against a fabricated
    // "result", there is no matching prior submission for its (fabricated)
    // identity, so authorization still fails. This shows the rejection
    // does not depend solely on the submission-time shape check.
    const guardian = createMockGuardianAdapter();
    const aiGenerated = { settledQuantity: 999999, qualityGateStatus: "PASS" } as unknown as VerificationResult;
    const authorization = guardian.authorizeVerification("fabricated-id", AUTHORIZED_VERIFIER, aiGenerated, T1);
    expect(authorization.accepted).toBe(false);
  });
});

describe("Test H — determinism: same VerificationResult + same Guardian inputs -> same representation", () => {
  it("produces identical submissions, authorizations, credentials and outcomes across two independent adapters", () => {
    const result = validPassResult();
    const verificationResultId = computeVerificationResultId(result);

    const guardianA = createMockGuardianAdapter();
    const submissionA = guardianA.submitVerificationResult(result, T0);
    const authA = guardianA.authorizeVerification(verificationResultId, AUTHORIZED_VERIFIER, result, T1);
    const credA = authA.accepted ? guardianA.issueCredential(verificationResultId, AUTHORIZED_VERIFIER, T2) : null;

    const guardianB = createMockGuardianAdapter();
    const submissionB = guardianB.submitVerificationResult(result, T0);
    const authB = guardianB.authorizeVerification(verificationResultId, AUTHORIZED_VERIFIER, result, T1);
    const credB = authB.accepted ? guardianB.issueCredential(verificationResultId, AUTHORIZED_VERIFIER, T2) : null;

    expect(submissionA).toEqual(submissionB);
    expect(authA).toEqual(authB);
    expect(credA).toEqual(credB);
  });
});

describe("Test I — provenance is preserved end to end", () => {
  it("traces project, parcel/H3 identity, methodology version, evidence identity, and verification result through every stage", () => {
    const guardian = createMockGuardianAdapter();
    const result = validPassResult();
    const verificationResultId = computeVerificationResultId(result);

    const submission = guardian.submitVerificationResult(result, T0);
    const authorization = guardian.authorizeVerification(verificationResultId, AUTHORIZED_VERIFIER, result, T1);
    const credential = authorization.accepted
      ? guardian.issueCredential(verificationResultId, AUTHORIZED_VERIFIER, T2)
      : null;
    const outcome =
      credential?.accepted === true ? guardian.recordOutcome(credential.credential.credentialId, T3) : null;

    expect(submission.accepted).toBe(true);
    if (!submission.accepted || !credential?.accepted || !outcome?.accepted) {
      throw new Error("setup failed");
    }

    // Project identity
    expect(submission.submission.projectId).toBe(result.projectId);
    expect(credential.credential.projectId).toBe(result.projectId);
    expect(outcome.outcome.projectId).toBe(result.projectId);

    // Parcel / H3 identity
    expect(submission.submission.parcelH3Root).toBe(result.parcelH3Root);
    expect(credential.credential.parcelH3Root).toBe(result.parcelH3Root);
    expect(outcome.outcome.parcelH3Root).toBe(result.parcelH3Root);

    // Methodology version
    expect(submission.submission.methodologyVersion).toBe(result.methodologyVersion);
    expect(credential.credential.methodologyVersion).toBe(result.methodologyVersion);
    expect(outcome.outcome.methodologyVersion).toBe(result.methodologyVersion);

    // Evidence identity
    expect(submission.submission.evidenceHash).toBe(result.evidenceHash);

    // Verification result identity
    expect(submission.submission.verificationResultId).toBe(verificationResultId);
    expect(credential.credential.verificationResultId).toBe(verificationResultId);
    expect(outcome.outcome.verificationResultId).toBe(verificationResultId);
  });
});

describe("required parameter table (M2 prompt §16)", () => {
  it("rejects when required identity fields are missing from the verification result", () => {
    const guardian = createMockGuardianAdapter();
    const result = validPassResult();
    const missingEvidenceHash: VerificationResult = { ...result, evidenceHash: "" };
    expect(guardian.submitVerificationResult(missingEvidenceHash, T0).accepted).toBe(false);

    const missingProjectId: VerificationResult = { ...result, projectId: "" };
    expect(guardian.submitVerificationResult(missingProjectId, T0).accepted).toBe(false);
  });

  it("rejects authorization against a verification result identity that was never submitted", () => {
    const guardian = createMockGuardianAdapter();
    const result = validPassResult();
    const neverSubmittedId = "guardian-vr:sha256:0000000000000000000000000000000000000000000000000000000000000000";
    const authorization = guardian.authorizeVerification(neverSubmittedId, AUTHORIZED_VERIFIER, result, T1);
    expect(authorization.accepted).toBe(false);
  });

  it("blocks the insufficient-eligible-controls fixture the same way as any other INSUFFICIENT_EVIDENCE result", () => {
    const guardian = createMockGuardianAdapter();
    const result = verifyProject(FIXTURE_INSUFFICIENT_CONTROLS, DEFAULT_METHODOLOGY_CONFIG);
    expect(result.verificationStatus).toBe("INSUFFICIENT_EVIDENCE");
    const submission = guardian.submitVerificationResult(result, T0);
    expect(submission.accepted).toBe(true);
    if (submission.accepted) {
      expect(submission.submission.financiallyEligible).toBe(false);
    }
  });

  it("M1 regression: the underlying VerificationResult fixtures still produce the expected statuses", () => {
    expect(verifyProject(FIXTURE_PARTIAL_SETTLEMENT, DEFAULT_METHODOLOGY_CONFIG).verificationStatus).toBe("PARTIAL");
    expect(verifyProject(FIXTURE_PARALLEL_TREND_FAIL, DEFAULT_METHODOLOGY_CONFIG).verificationStatus).toBe(
      "INSUFFICIENT_EVIDENCE",
    );
  });
});
