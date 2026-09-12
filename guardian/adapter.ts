/**
 * Ecorestore Network — Guardian Adapter (M2)
 *
 * `GuardianAdapter` is the integration boundary between the M1 deterministic
 * verification engine and Hedera Guardian's workflow/credential/outcome
 * layer (docs/GUARDIAN.md). It is designed so a real Guardian policy/SDK
 * integration can implement the same interface later without the rest of
 * the system (or the M1 engine) changing — see the M2 prompt §12.
 *
 * `MockGuardianAdapter` is a deterministic, in-memory implementation used
 * for this milestone. It is NOT a live Guardian integration: there is no
 * Hedera Consensus Service submission, no Guardian policy engine, no DID
 * infrastructure, and no persistence beyond the process. See docs/GUARDIAN.md
 * "Mock versus real integration" for exactly what a production
 * implementation would add.
 *
 * AUTHORITY BOUNDARY (see docs/GUARDIAN.md §2, §5-6 and the M2 prompt §6):
 * this adapter never computes, edits, or overrides any scientific quantity.
 * Every numeric field on a `VerificationSubmission`/`GuardianCredential`/
 * `RestorationOutcome` is copied verbatim from the `VerificationResult` that
 * M1 already produced. `financiallyEligible` is derived, never invented: it
 * is `true` if and only if `result.qualityGateStatus === "PASS"`. Nothing
 * in this file can turn an `INSUFFICIENT_EVIDENCE` or `INVALID_RESULT`
 * outcome into a settlement-eligible one, and nothing here authorizes
 * payment — Arc remains the sole financial settlement authority (M3+).
 */

import { computeCredentialId, computeEvidenceSubmissionId, computeOutcomeId, computeVerificationResultId } from "./identifiers.js";
import type {
  AuthorizationResult,
  AuthorizedVerification,
  CredentialIssuanceResult,
  EvidenceSubmission,
  EvidenceSubmissionResult,
  GuardianCredential,
  LifecycleState,
  OutcomeRecordingResult,
  RestorationOutcome,
  VerificationSubmission,
  VerificationSubmissionResult,
} from "./models.js";
import { GUARDIAN_POLICY_VERSION } from "./policy/methodologyRegistry.js";
import { isAuthorizedVerifier } from "./policy/verifierRegistry.js";
import type { EvidenceSubmissionInput } from "./schemas/evidenceSubmissionSchema.js";
import { validateEvidenceSubmissionInput } from "./schemas/evidenceSubmissionSchema.js";
import { validateVerificationResultShape } from "./schemas/verificationResultSchema.js";
import { validateMethodologyVersion, validateSubmissionIntegrity } from "./validation.js";
import type { VerificationResult } from "../verification/models.js";

/**
 * The Guardian integration boundary. Every operation is a pure function of
 * its explicit inputs plus the adapter's own internal state — no operation
 * reads the wall clock or generates random identifiers; callers supply
 * timestamps, and identifiers are either deterministically derived
 * (identifiers.ts) or supplied by the caller (verifier IDs).
 */
export interface GuardianAdapter {
  submitEvidence(input: EvidenceSubmissionInput, submittedAt: string): EvidenceSubmissionResult;

  /**
   * Submits a full M1 `VerificationResult` into the Guardian workflow.
   *
   * Rejects outright (does not create any workflow record) when:
   *  - the result is missing a required identity field (project, parcel,
   *    methodology version, or evidence hash);
   *  - the methodology version is not on Guardian's supported allowlist;
   *  - `qualityGateStatus === "INVALID_RESULT"` (the pipeline itself did
   *    not produce a trustworthy object, not merely an unfavourable one).
   *
   * Accepts (creates a workflow record) for every other `qualityGateStatus`,
   * including `INSUFFICIENT_EVIDENCE` — Guardian records that a claim was
   * reviewed and found insufficient (useful audit trail for a restorer who
   * may resubmit better evidence later) but marks it
   * `financiallyEligible: false`, and no later operation in this adapter
   * can move such a submission forward to authorization/credential/outcome.
   */
  submitVerificationResult(result: VerificationResult, submittedAt: string): VerificationSubmissionResult;

  /**
   * Authorizes a previously submitted, financially-eligible verification.
   * Requires: a matching submission exists; `result` is byte-for-byte
   * identical (by recomputed hash) to what was submitted under this
   * identity (tamper check); `verifierId` is on the authorized-verifier
   * allowlist; and the submission's `qualityGateStatus` is `PASS`.
   */
  authorizeVerification(
    verificationResultId: string,
    verifierId: string,
    result: VerificationResult,
    authorizedAt: string,
  ): AuthorizationResult;

  /** Issues a credential only for a verification this adapter has itself authorized, to the same verifier that authorized it. */
  issueCredential(verificationResultId: string, verifierId: string, issuedAt: string): CredentialIssuanceResult;

  /** Records a restoration outcome only for a credential this adapter has itself issued. */
  recordOutcome(credentialId: string, recordedAt: string): OutcomeRecordingResult;

  /**
   * Returns the current lifecycle state for a given project/parcel, or
   * `"NO_SUBMISSION"` if nothing has been submitted for it yet. Keyed by
   * project + parcel (not by `verificationResultId`) because evidence can
   * be submitted before any verification result exists.
   */
  getLifecycleState(projectId: string, parcelH3Root: string): LifecycleState | "NO_SUBMISSION";
}

function lifecycleKey(projectId: string, parcelH3Root: string): string {
  return `${projectId}::${parcelH3Root}`;
}

/**
 * Deterministic, in-memory `GuardianAdapter` implementation for M2. State
 * lives only for the lifetime of the instance — create a fresh adapter per
 * test (see guardian/tests/) rather than sharing one across cases.
 */
export class MockGuardianAdapter implements GuardianAdapter {
  private readonly evidenceSubmissions = new Map<string, EvidenceSubmission>();
  private readonly verificationSubmissions = new Map<string, VerificationSubmission>();
  private readonly authorizations = new Map<string, AuthorizedVerification>();
  private readonly credentials = new Map<string, GuardianCredential>();
  private readonly outcomes = new Map<string, RestorationOutcome>();
  private readonly lifecycle = new Map<string, LifecycleState>();

  submitEvidence(input: EvidenceSubmissionInput, submittedAt: string): EvidenceSubmissionResult {
    const shapeCheck = validateEvidenceSubmissionInput(input);
    if (!shapeCheck.valid) {
      return { accepted: false, reason: shapeCheck.reason ?? "invalid evidence submission" };
    }

    const submissionId = computeEvidenceSubmissionId(input.projectId, input.evidenceHash);
    const submission: EvidenceSubmission = {
      submissionId,
      projectId: input.projectId,
      parcelH3Root: input.parcelH3Root,
      evidenceHash: input.evidenceHash,
      submittedAt,
    };

    this.evidenceSubmissions.set(submissionId, submission);
    this.setLifecycleIfAdvancing(input.projectId, input.parcelH3Root, "EVIDENCE_SUBMITTED");

    return { accepted: true, submission };
  }

  submitVerificationResult(result: VerificationResult, submittedAt: string): VerificationSubmissionResult {
    const shapeCheck = validateVerificationResultShape(result);
    if (!shapeCheck.valid) {
      return { accepted: false, reason: shapeCheck.reason ?? "invalid verification result" };
    }

    const methodologyCheck = validateMethodologyVersion(result.methodologyVersion);
    if (!methodologyCheck.valid) {
      return { accepted: false, reason: methodologyCheck.reason ?? "unsupported methodology version" };
    }

    // An INVALID_RESULT means the deterministic pipeline itself flagged its
    // own output as untrustworthy (e.g. an invalid uncertainty
    // configuration) — Guardian rejects it outright rather than recording
    // it as a reviewable workflow item. See M2 prompt §7, Test C.
    if (result.qualityGateStatus === "INVALID_RESULT") {
      return { accepted: false, reason: "verification result is INVALID_RESULT; Guardian rejects it outright" };
    }

    const verificationResultId = computeVerificationResultId(result);
    const financiallyEligible = result.qualityGateStatus === "PASS";

    const submission: VerificationSubmission = {
      submissionId: verificationResultId,
      verificationResultId,
      projectId: result.projectId,
      parcelH3Root: result.parcelH3Root,
      methodologyVersion: result.methodologyVersion,
      metric: result.metric,
      verificationStatus: result.verificationStatus,
      qualityGateStatus: result.qualityGateStatus,
      settledQuantity: result.settledQuantity,
      lowerBound: result.lowerBound,
      evidenceHash: result.evidenceHash,
      financiallyEligible,
      submittedAt,
      lifecycleState: "VERIFICATION_SUBMITTED",
    };

    this.verificationSubmissions.set(verificationResultId, submission);
    this.setLifecycleIfAdvancing(result.projectId, result.parcelH3Root, "VERIFICATION_SUBMITTED");

    return { accepted: true, submission };
  }

  authorizeVerification(
    verificationResultId: string,
    verifierId: string,
    result: VerificationResult,
    authorizedAt: string,
  ): AuthorizationResult {
    const submission = this.verificationSubmissions.get(verificationResultId);
    if (!submission) {
      return { accepted: false, reason: "no matching verification submission for this verificationResultId" };
    }

    const integrityCheck = validateSubmissionIntegrity(submission, result);
    if (!integrityCheck.valid) {
      return { accepted: false, reason: integrityCheck.reason ?? "verification result failed integrity check" };
    }

    if (!isAuthorizedVerifier(verifierId)) {
      return { accepted: false, reason: `verifier is not authorized: ${verifierId}` };
    }

    // Hard authority boundary: an unfavourable M1 result can never be
    // authorized, no matter who the verifier is. See M2 prompt §6, §7.
    if (!submission.financiallyEligible) {
      return {
        accepted: false,
        reason: `submission is not financially eligible (qualityGateStatus=${submission.qualityGateStatus}); cannot authorize`,
      };
    }

    const authorization: AuthorizedVerification = {
      submissionId: submission.submissionId,
      verificationResultId,
      verifierId,
      authorizedAt,
    };

    this.authorizations.set(verificationResultId, authorization);
    this.setLifecycleIfAdvancing(submission.projectId, submission.parcelH3Root, "VERIFICATION_AUTHORIZED");

    return { accepted: true, authorization };
  }

  issueCredential(verificationResultId: string, verifierId: string, issuedAt: string): CredentialIssuanceResult {
    const submission = this.verificationSubmissions.get(verificationResultId);
    if (!submission) {
      return { accepted: false, reason: "no matching verification submission for this verificationResultId" };
    }

    const authorization = this.authorizations.get(verificationResultId);
    if (!authorization) {
      return { accepted: false, reason: "verification has not been authorized" };
    }

    if (authorization.verifierId !== verifierId) {
      return {
        accepted: false,
        reason: "credential can only be issued by the verifier who authorized this verification",
      };
    }

    const credentialId = computeCredentialId(verificationResultId, verifierId, GUARDIAN_POLICY_VERSION);
    const credential: GuardianCredential = {
      credentialId,
      submissionId: submission.submissionId,
      verificationResultId,
      projectId: submission.projectId,
      parcelH3Root: submission.parcelH3Root,
      methodologyVersion: submission.methodologyVersion,
      guardianPolicyVersion: GUARDIAN_POLICY_VERSION,
      verifierId,
      settledQuantity: submission.settledQuantity,
      issuedAt,
    };

    this.credentials.set(credentialId, credential);
    this.setLifecycleIfAdvancing(submission.projectId, submission.parcelH3Root, "CREDENTIAL_ISSUED");

    return { accepted: true, credential };
  }

  recordOutcome(credentialId: string, recordedAt: string): OutcomeRecordingResult {
    const credential = this.credentials.get(credentialId);
    if (!credential) {
      return { accepted: false, reason: "no matching credential for this credentialId" };
    }

    const outcomeId = computeOutcomeId(credentialId);
    const outcome: RestorationOutcome = {
      outcomeId,
      credentialId,
      verificationResultId: credential.verificationResultId,
      projectId: credential.projectId,
      parcelH3Root: credential.parcelH3Root,
      methodologyVersion: credential.methodologyVersion,
      settledQuantity: credential.settledQuantity,
      status: "RECORDED",
      recordedAt,
    };

    this.outcomes.set(outcomeId, outcome);
    this.setLifecycleIfAdvancing(credential.projectId, credential.parcelH3Root, "OUTCOME_RECORDED");

    return { accepted: true, outcome };
  }

  getLifecycleState(projectId: string, parcelH3Root: string): LifecycleState | "NO_SUBMISSION" {
    return this.lifecycle.get(lifecycleKey(projectId, parcelH3Root)) ?? "NO_SUBMISSION";
  }

  /**
   * Lifecycle states only move forward. `LIFECYCLE_ORDER`'s index defines
   * "forward"; a later call with an earlier stage (e.g. re-submitting
   * evidence after a credential was already issued) does not regress the
   * recorded state. This keeps `getLifecycleState` a monotonic progress
   * indicator rather than a raw "last operation" log.
   */
  private setLifecycleIfAdvancing(projectId: string, parcelH3Root: string, next: LifecycleState): void {
    const key = lifecycleKey(projectId, parcelH3Root);
    const current = this.lifecycle.get(key);
    if (!current || LIFECYCLE_ORDER.indexOf(next) > LIFECYCLE_ORDER.indexOf(current)) {
      this.lifecycle.set(key, next);
    }
  }
}

const LIFECYCLE_ORDER: readonly LifecycleState[] = [
  "EVIDENCE_SUBMITTED",
  "VERIFICATION_SUBMITTED",
  "VERIFICATION_AUTHORIZED",
  "CREDENTIAL_ISSUED",
  "OUTCOME_RECORDED",
];

export function createMockGuardianAdapter(): GuardianAdapter {
  return new MockGuardianAdapter();
}
