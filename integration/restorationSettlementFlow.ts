/**
 * Ecorestore Network — Restoration Settlement Flow (M4)
 *
 * The thin orchestration layer connecting M1 -> M2 -> the Arc on-chain
 * payload. This module computes nothing scientific and nothing financial
 * itself — it only calls the already-established functions from
 * `verification/`, `guardian/`, and `arc/` in the order the architecture
 * defines (docs/ARCHITECTURE.md), and fails closed when any step does not
 * produce a financially eligible result.
 *
 * This is intentionally the ONLY file in `integration/`. There is no
 * framework, no service layer, no event bus — just one function that
 * sequences four existing calls and returns a discriminated result the
 * caller can branch on. See the M4 prompt §13 ("avoid unnecessary
 * abstractions... this is a hackathon prototype").
 */

import { buildDeedIdentity, buildVerificationAuthorization } from "../arc/payload.js";
import type { OnChainDeedIdentity, OnChainVerificationAuthorization } from "../arc/payload.js";
import type { GuardianAdapter } from "../guardian/adapter.js";
import { computeVerificationResultId } from "../guardian/identifiers.js";
import type { GuardianCredential } from "../guardian/models.js";
import { verifyProject } from "../verification/engine.js";
import type { MethodologyConfiguration, Project, VerificationResult } from "../verification/models.js";

export interface SettlementFlowTimestamps {
  readonly submittedAt: string;
  readonly authorizedAt: string;
  readonly issuedAt: string;
}

export type SettlementFlowResult =
  | {
      readonly eligible: true;
      readonly verificationResult: VerificationResult;
      readonly credential: GuardianCredential;
      readonly onChainAuthorization: OnChainVerificationAuthorization;
      readonly deedIdentity: OnChainDeedIdentity;
    }
  | {
      readonly eligible: false;
      readonly verificationResult: VerificationResult;
      readonly reason: string;
    };

/**
 * Runs the full M1 -> M2 -> Arc-payload pipeline for one project.
 *
 * Sequence (mirrors docs/ARCHITECTURE.md exactly — no step is reordered,
 * skipped, or reimplemented):
 *   1. `verifyProject` (M1) — the sole source of the scientific result.
 *   2. `guardian.submitVerificationResult` (M2) — records the claim.
 *      Rejected outright (`INVALID_RESULT`) -> fails closed here.
 *   3. If `qualityGateStatus !== "PASS"` (`INSUFFICIENT_EVIDENCE`) -> fails
 *      closed here, before any authorization step runs.
 *   4. `guardian.authorizeVerification` (M2) — this is also where a
 *      *tampered* `VerificationResult` (mutated after step 2's submission)
 *      would be caught, via Guardian's own integrity re-hash check
 *      (`guardian/validation.ts`) — this module invents no separate tamper
 *      check of its own.
 *   5. `guardian.issueCredential` (M2).
 *   6. `buildVerificationAuthorization` (M3's `arc/`) — converts the
 *      result + credential into the on-chain payload shape. Never invoked
 *      unless every step above succeeded.
 *
 * This function never touches a blockchain and needs no deployed contract
 * — it stops at producing the payload `RestorationDeed.submitVerification`
 * would need. Submitting that payload on-chain is the caller's
 * responsibility (see contracts/tests/endToEnd.test.cjs).
 */
export function prepareSettlementAuthorization(
  project: Project,
  config: MethodologyConfiguration,
  guardian: GuardianAdapter,
  verifierId: string,
  quantityDecimals: number,
  timestamps: SettlementFlowTimestamps,
): SettlementFlowResult {
  const verificationResult = verifyProject(project, config);

  const submission = guardian.submitVerificationResult(verificationResult, timestamps.submittedAt);
  if (!submission.accepted) {
    return {
      eligible: false,
      verificationResult,
      reason: `Guardian rejected the submission: ${submission.reason}`,
    };
  }

  if (verificationResult.qualityGateStatus !== "PASS") {
    return {
      eligible: false,
      verificationResult,
      reason: `verification is not financially eligible (qualityGateStatus=${verificationResult.qualityGateStatus}, verificationStatus=${verificationResult.verificationStatus})`,
    };
  }

  const verificationResultId = computeVerificationResultId(verificationResult);

  const authorization = guardian.authorizeVerification(
    verificationResultId,
    verifierId,
    verificationResult,
    timestamps.authorizedAt,
  );
  if (!authorization.accepted) {
    return {
      eligible: false,
      verificationResult,
      reason: `Guardian refused to authorize the verification: ${authorization.reason}`,
    };
  }

  const credentialOutcome = guardian.issueCredential(verificationResultId, verifierId, timestamps.issuedAt);
  if (!credentialOutcome.accepted) {
    return {
      eligible: false,
      verificationResult,
      reason: `Guardian refused to issue a credential: ${credentialOutcome.reason}`,
    };
  }

  const onChainAuthorization = buildVerificationAuthorization(
    verificationResult,
    credentialOutcome.credential,
    quantityDecimals,
  );
  const deedIdentity = buildDeedIdentity(verificationResult);

  return {
    eligible: true,
    verificationResult,
    credential: credentialOutcome.credential,
    onChainAuthorization,
    deedIdentity,
  };
}
