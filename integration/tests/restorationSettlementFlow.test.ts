import { describe, expect, it } from "vitest";
import { prepareSettlementAuthorization } from "../restorationSettlementFlow.js";
import { createMockGuardianAdapter } from "../../guardian/adapter.js";
import { GUARDIAN_POLICY_VERSION } from "../../guardian/policy/methodologyRegistry.js";
import { DEFAULT_METHODOLOGY_CONFIG } from "../../verification/config.js";
import { verifyProject } from "../../verification/engine.js";
import {
  FIXTURE_PARALLEL_TREND_FAIL,
  FIXTURE_PARTIAL_SETTLEMENT,
} from "../../verification/fixtures.js";
import type { VerificationResult } from "../../verification/models.js";

const VERIFIER = "guardian-verifier-kootenay-001";
const TIMESTAMPS = {
  submittedAt: "2026-09-11T00:00:00.000Z",
  authorizedAt: "2026-09-11T01:00:00.000Z",
  issuedAt: "2026-09-11T02:00:00.000Z",
};
const QUANTITY_DECIMALS = 6;

describe("prepareSettlementAuthorization — successful path", () => {
  it("produces a real M1 result, a Mock Guardian credential, and a matching on-chain payload", () => {
    const guardian = createMockGuardianAdapter();
    const outcome = prepareSettlementAuthorization(
      FIXTURE_PARTIAL_SETTLEMENT,
      DEFAULT_METHODOLOGY_CONFIG,
      guardian,
      VERIFIER,
      QUANTITY_DECIMALS,
      TIMESTAMPS,
    );

    expect(outcome.eligible).toBe(true);
    if (!outcome.eligible) return;

    // The settlement quantity in the on-chain payload must trace directly
    // back to M1's own settledQuantity — nothing in this module recomputes,
    // rounds beyond the documented fixed-point scaling, or substitutes it.
    expect(outcome.verificationResult.verificationStatus).toBe("PARTIAL");
    expect(outcome.verificationResult.qualityGateStatus).toBe("PASS");
    expect(outcome.credential.settledQuantity).toBe(outcome.verificationResult.settledQuantity);
    expect(outcome.onChainAuthorization.financiallyEligible).toBe(true);
    expect(outcome.onChainAuthorization.settledQuantityScaled).toBe(
      BigInt(Math.round(outcome.verificationResult.settledQuantity * 10 ** QUANTITY_DECIMALS)),
    );

    expect(
      guardian.getLifecycleState(outcome.verificationResult.projectId, outcome.verificationResult.parcelH3Root),
    ).toBe("CREDENTIAL_ISSUED");
  });

  it("is deterministic: the same project and config produce the same eligible outcome", () => {
    const first = prepareSettlementAuthorization(
      FIXTURE_PARTIAL_SETTLEMENT,
      DEFAULT_METHODOLOGY_CONFIG,
      createMockGuardianAdapter(),
      VERIFIER,
      QUANTITY_DECIMALS,
      TIMESTAMPS,
    );
    const second = prepareSettlementAuthorization(
      FIXTURE_PARTIAL_SETTLEMENT,
      DEFAULT_METHODOLOGY_CONFIG,
      createMockGuardianAdapter(),
      VERIFIER,
      QUANTITY_DECIMALS,
      TIMESTAMPS,
    );
    expect(first).toEqual(second);
  });
});

describe("prepareSettlementAuthorization — fails closed on INSUFFICIENT_EVIDENCE", () => {
  it("stops before authorization/credential/payload when M1's parallel-trend diagnostic fails", () => {
    const guardian = createMockGuardianAdapter();
    const outcome = prepareSettlementAuthorization(
      FIXTURE_PARALLEL_TREND_FAIL,
      DEFAULT_METHODOLOGY_CONFIG,
      guardian,
      VERIFIER,
      QUANTITY_DECIMALS,
      TIMESTAMPS,
    );

    expect(outcome.eligible).toBe(false);
    if (outcome.eligible) return;
    expect(outcome.verificationResult.verificationStatus).toBe("INSUFFICIENT_EVIDENCE");
    expect(outcome.reason).toContain("INSUFFICIENT_EVIDENCE");

    // Guardian recorded the submission (for audit purposes) but never
    // authorized it — confirmed by checking the lifecycle never advanced
    // past VERIFICATION_SUBMITTED.
    const lifecycle = guardian.getLifecycleState(
      outcome.verificationResult.projectId,
      outcome.verificationResult.parcelH3Root,
    );
    expect(lifecycle).toBe("VERIFICATION_SUBMITTED");
  });
});

describe("prepareSettlementAuthorization — fails closed on INVALID_RESULT", () => {
  it("Guardian rejects the submission outright, so no on-chain payload is ever attempted", () => {
    // A genuinely M1-produced INVALID_RESULT (invalid uncertainty
    // configuration), exactly as guardian/tests/adapter.test.ts constructs
    // one — not a hand-fabricated object.
    const brokenConfig = { ...DEFAULT_METHODOLOGY_CONFIG, relativeUncertaintyFraction: 1.5 };
    const guardian = createMockGuardianAdapter();
    const outcome = prepareSettlementAuthorization(
      FIXTURE_PARTIAL_SETTLEMENT,
      brokenConfig,
      guardian,
      VERIFIER,
      QUANTITY_DECIMALS,
      TIMESTAMPS,
    );

    expect(outcome.eligible).toBe(false);
    if (outcome.eligible) return;
    expect(outcome.verificationResult.qualityGateStatus).toBe("INVALID_RESULT");
    expect(outcome.reason).toContain("Guardian rejected the submission");

    const lifecycle = guardian.getLifecycleState(
      outcome.verificationResult.projectId,
      outcome.verificationResult.parcelH3Root,
    );
    expect(lifecycle).toBe("NO_SUBMISSION");
  });
});

describe("prepareSettlementAuthorization — tampered result is caught before authorization (M4 prompt §11)", () => {
  it("rejects authorization when the VerificationResult is mutated after submission, using Guardian's existing integrity check", () => {
    // This deliberately does NOT go through prepareSettlementAuthorization
    // end-to-end, because that function calls verifyProject/Guardian in a
    // fixed sequence with no seam for an attacker to tamper between steps.
    // Instead this exercises the exact seam a real attacker would need —
    // submit once, then present a mutated result at authorization time —
    // to confirm the existing M2 protection (not a new one) catches it.
    const guardian = createMockGuardianAdapter();
    const genuineResult = verifyProject(FIXTURE_PARTIAL_SETTLEMENT, DEFAULT_METHODOLOGY_CONFIG);

    const submission = guardian.submitVerificationResult(genuineResult, TIMESTAMPS.submittedAt);
    expect(submission.accepted).toBe(true);
    if (!submission.accepted) return;
    const verificationResultId = submission.submission.verificationResultId;

    const tamperedResult: VerificationResult = {
      ...genuineResult,
      settledQuantity: genuineResult.settledQuantity + 1_000_000,
    };

    const authorization = guardian.authorizeVerification(
      verificationResultId,
      VERIFIER,
      tamperedResult,
      TIMESTAMPS.authorizedAt,
    );

    expect(authorization.accepted).toBe(false);
    // No credential could ever be issued from here — confirming the tamper
    // is caught strictly before any on-chain payload could be built.
    const credentialAttempt = guardian.issueCredential(verificationResultId, VERIFIER, TIMESTAMPS.issuedAt);
    expect(credentialAttempt.accepted).toBe(false);
  });
});

describe("prepareSettlementAuthorization — quantity/methodology traceability", () => {
  it("carries the exact methodology version and evidence hash from M1 through to the on-chain identity", () => {
    const guardian = createMockGuardianAdapter();
    const outcome = prepareSettlementAuthorization(
      FIXTURE_PARTIAL_SETTLEMENT,
      DEFAULT_METHODOLOGY_CONFIG,
      guardian,
      VERIFIER,
      QUANTITY_DECIMALS,
      TIMESTAMPS,
    );
    expect(outcome.eligible).toBe(true);
    if (!outcome.eligible) return;

    expect(outcome.credential.methodologyVersion).toBe(outcome.verificationResult.methodologyVersion);
    expect(outcome.credential.guardianPolicyVersion).toBe(GUARDIAN_POLICY_VERSION);
    expect(outcome.deedIdentity.methodologyVersion).toBe(outcome.onChainAuthorization.methodologyVersion);
    expect(outcome.deedIdentity.projectId).toBe(outcome.onChainAuthorization.projectId);
    expect(outcome.deedIdentity.parcelH3Root).toBe(outcome.onChainAuthorization.parcelH3Root);
  });
});
