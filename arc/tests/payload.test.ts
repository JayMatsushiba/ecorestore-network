import { describe, expect, it } from "vitest";
import { createMockGuardianAdapter } from "../../guardian/adapter.js";
import { computeVerificationResultId } from "../../guardian/identifiers.js";
import type { GuardianCredential } from "../../guardian/models.js";
import { GUARDIAN_POLICY_VERSION } from "../../guardian/policy/methodologyRegistry.js";
import { DEFAULT_METHODOLOGY_CONFIG } from "../../verification/config.js";
import { verifyProject } from "../../verification/engine.js";
import { FIXTURE_PARALLEL_TREND_FAIL, FIXTURE_PARTIAL_SETTLEMENT } from "../../verification/fixtures.js";
import type { VerificationResult } from "../../verification/models.js";
import { hashIdentifier, scaleQuantity } from "../identifiers.js";
import { buildDeedIdentity, buildVerificationAuthorization } from "../payload.js";

const VERIFIER = "guardian-verifier-kootenay-001";
const T0 = "2026-09-11T00:00:00.000Z";
const T1 = "2026-09-11T01:00:00.000Z";
const T2 = "2026-09-11T02:00:00.000Z";
const QUANTITY_DECIMALS = 6;

function issuedCredential() {
  const guardian = createMockGuardianAdapter();
  const result = verifyProject(FIXTURE_PARTIAL_SETTLEMENT, DEFAULT_METHODOLOGY_CONFIG);
  const verificationResultId = computeVerificationResultId(result);
  guardian.submitVerificationResult(result, T0);
  guardian.authorizeVerification(verificationResultId, VERIFIER, result, T1);
  const credentialOutcome = guardian.issueCredential(verificationResultId, VERIFIER, T2);
  if (!credentialOutcome.accepted) {
    throw new Error("test setup failed: credential was not issued");
  }
  return { result, credential: credentialOutcome.credential };
}

describe("buildDeedIdentity", () => {
  it("hashes the result's project/parcel/methodology identifiers", () => {
    const { result } = issuedCredential();
    const identity = buildDeedIdentity(result);
    expect(identity.projectId).toBe(hashIdentifier(result.projectId));
    expect(identity.parcelH3Root).toBe(hashIdentifier(result.parcelH3Root));
    expect(identity.methodologyVersion).toBe(hashIdentifier(result.methodologyVersion));
  });
});

describe("buildVerificationAuthorization", () => {
  it("builds a correctly-shaped, eligible on-chain payload from a Mock Guardian credential", () => {
    const { result, credential } = issuedCredential();
    const payload = buildVerificationAuthorization(result, credential, QUANTITY_DECIMALS);

    expect(payload.financiallyEligible).toBe(true);
    expect(payload.projectId).toBe(hashIdentifier(result.projectId));
    expect(payload.parcelH3Root).toBe(hashIdentifier(result.parcelH3Root));
    expect(payload.methodologyVersion).toBe(hashIdentifier(result.methodologyVersion));
    expect(payload.evidenceHash).toBe(hashIdentifier(result.evidenceHash));
    expect(payload.settledQuantityScaled).toBe(scaleQuantity(result.settledQuantity, QUANTITY_DECIMALS));
  });

  it("is deterministic: identical inputs produce an identical payload", () => {
    const { result, credential } = issuedCredential();
    const first = buildVerificationAuthorization(result, credential, QUANTITY_DECIMALS);
    const second = buildVerificationAuthorization(result, credential, QUANTITY_DECIMALS);
    expect(first).toEqual(second);
  });

  it("refuses to build a payload if the credential does not match the supplied result", () => {
    const { credential } = issuedCredential();
    const differentResult = verifyProject(FIXTURE_PARTIAL_SETTLEMENT, {
      ...DEFAULT_METHODOLOGY_CONFIG,
      methodologyVersion: "ecorestore-m1-v0.1-tampered",
    });
    expect(() => buildVerificationAuthorization(differentResult, credential, QUANTITY_DECIMALS)).toThrow();
  });

  it("refuses to build a payload for a result that is not qualityGateStatus PASS, even if mismatched credential data were somehow supplied", () => {
    const insufficientResult = verifyProject(FIXTURE_PARALLEL_TREND_FAIL, DEFAULT_METHODOLOGY_CONFIG);
    // Construct a credential-shaped object claiming to match this (ineligible) result's id —
    // this cannot happen through the real guardian/adapter.ts flow (issueCredential requires
    // financiallyEligible), so this simulates a hypothetical malformed/forged credential input.
    const forgedCredential = {
      credentialId: "forged",
      submissionId: "forged",
      verificationResultId: computeVerificationResultId(insufficientResult),
      projectId: insufficientResult.projectId,
      parcelH3Root: insufficientResult.parcelH3Root,
      methodologyVersion: insufficientResult.methodologyVersion,
      guardianPolicyVersion: GUARDIAN_POLICY_VERSION,
      verifierId: VERIFIER,
      settledQuantity: 0,
      issuedAt: T2,
    };
    expect(() => buildVerificationAuthorization(insufficientResult, forgedCredential, QUANTITY_DECIMALS)).toThrow();
  });

  /**
   * M3.1 Test C (M3.1 prompt §3.2, §3.4): demonstrates — rather than merely
   * documents — the exact trust boundary the M3 security review identified.
   *
   * `buildVerificationAuthorization` checks that `credential` and `result`
   * are INTERNALLY CONSISTENT with each other (the credential's id matches
   * a hash of the result, and the result claims PASS). Both of those checks
   * are satisfiable by a caller who fabricates BOTH objects from scratch —
   * neither the M1 `VerificationResult` nor the M2 `GuardianCredential` here
   * comes from a real `verifyProject()` or `issueCredential()` call. This is
   * NOT a bug being demonstrated; it is the documented boundary: the actual
   * financial authorization boundary is `RestorationDeed.authorizedVerifier`
   * on-chain (msg.sender), not anything in this file. See docs/ARC.md's
   * "M3.1 — off-chain trust boundary" section for the full write-up.
   */
  it("[TRUST BOUNDARY] accepts a forged-but-internally-consistent VerificationResult + GuardianCredential pair — neither was produced by a real M1/M2 execution", () => {
    // Fabricate a VerificationResult from scratch — not from verifyProject().
    // Every field is attacker-chosen; nothing here was computed by M1.
    const forgedResult: VerificationResult = {
      projectId: "attacker-fabricated-project",
      parcelH3Root: "attacker-fabricated-parcel",
      methodologyVersion: "ecorestore-m1-v0.1", // must be on Guardian's allowlist to matter downstream, but nothing here checks that
      metric: "canopy_cover_fraction_pct",
      claimedQuantity: 1,
      observedChange: 999,
      controlChange: 0,
      additionalityAdjusted: 999,
      uncertainty: {
        model: "m1-fixed-fraction-v0.1",
        confidenceLevel: 0.85,
        pointEstimate: 999,
        lowerBound: 999, // attacker sets this arbitrarily high — no real M1 uncertainty calculation ran
        upperBound: 999,
        status: "VALID",
      },
      lowerBound: 999,
      settledQuantity: 999, // <- the number that ultimately becomes the on-chain settlement quantity
      parallelTrendStatus: "PASS",
      qualityGateStatus: "PASS", // <- attacker simply asserts this; no real quality gate evaluated it
      verificationStatus: "VERIFIED",
      evidenceHash: "attacker-fabricated-evidence-hash",
      window: {
        preTreatmentStart: "2023-01-01",
        preTreatmentEnd: "2023-06-01",
        postTreatmentStart: "2023-06-02",
        postTreatmentEnd: "2024-01-01",
      },
      diagnostics: {
        treatedParcelId: "attacker-fabricated-parcel",
        eligibleControlParcelIds: [],
        excludedContaminatedControls: [],
        excludedNonMatchingControlParcelIds: [],
        treatedPreTreatmentLevel: 0,
        treatedPostTreatmentLevel: 0,
        treatedObservedChange: 0,
        controlPreTreatmentLevel: 0,
        controlPostTreatmentLevel: 0,
        controlObservedChange: 0,
        treatedPreTreatmentSlopePerYear: null,
        controlMeanPreTreatmentSlopePerYear: null,
        parallelTrendDivergenceRatio: null,
      },
    };

    // The forged credential is internally consistent BY CONSTRUCTION: its
    // verificationResultId is computed from the forged result using the
    // exact same public, unkeyed hash function `buildVerificationAuthorization`
    // itself uses to check consistency. An attacker needs no secret to do this.
    const forgedCredential: GuardianCredential = {
      credentialId: "attacker-fabricated-credential",
      submissionId: "attacker-fabricated-submission",
      verificationResultId: computeVerificationResultId(forgedResult),
      projectId: forgedResult.projectId,
      parcelH3Root: forgedResult.parcelH3Root,
      methodologyVersion: forgedResult.methodologyVersion,
      guardianPolicyVersion: GUARDIAN_POLICY_VERSION,
      verifierId: "attacker-claimed-verifier-identity",
      settledQuantity: forgedResult.settledQuantity,
      issuedAt: T2,
    };

    // This SUCCEEDS — demonstrating that internal consistency alone, with
    // no real M1 computation and no real M2 authorization behind either
    // object, is sufficient to produce a payload that LOOKS like a valid
    // eligible settlement authorization.
    const payload = buildVerificationAuthorization(forgedResult, forgedCredential, QUANTITY_DECIMALS);
    expect(payload.financiallyEligible).toBe(true);
    expect(payload.settledQuantityScaled).toBe(scaleQuantity(999, QUANTITY_DECIMALS));

    // The ONLY reason this forged payload cannot actually move funds is that
    // RestorationDeed.submitVerification on-chain independently requires
    // msg.sender === deed.authorizedVerifier — a check this function, and
    // this entire file, has no part in and no knowledge of. See
    // contracts/RestorationDeed.sol and contracts/tests/verification.test.cjs
    // ("rejects submission from an address that is not this deed's
    // authorizedVerifier") for where the real enforcement lives.
  });
});
