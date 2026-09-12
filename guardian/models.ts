/**
 * Ecorestore Network — Guardian Domain Models (M2)
 *
 * These types represent the Guardian-facing workflow around an M1
 * `VerificationResult`: evidence submission, verification submission,
 * verifier authorization, credential/attestation issuance, and restoration
 * outcome recording. See docs/GUARDIAN.md for the authority model this
 * implements.
 *
 * M2 SCOPE NOTE: this does NOT duplicate the full M1 `VerificationResult`.
 * Guardian-facing records carry a `verificationResultId` (a deterministic
 * hash of the full result — see identifiers.ts) plus the specific fields
 * Guardian's workflow actually needs (§5 of the M2 prompt). The full
 * `VerificationResult` is re-supplied by the caller wherever an operation
 * needs to re-validate against it (see `authorizeVerification` in
 * workflow.ts) rather than being stored a second time.
 */

import type {
  ParcelId,
  ProjectId,
  QualityGateStatus,
  VerificationStatus,
} from "../verification/models.js";

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

export type GuardianSubmissionId = string;
export type VerificationResultId = string;
export type CredentialId = string;
export type OutcomeId = string;
export type VerifierId = string;

// ---------------------------------------------------------------------------
// Verifier
// ---------------------------------------------------------------------------

/**
 * M2 supports a single verifier role. Production Guardian deployments
 * typically support multiple roles (e.g. reviewer, approver); see
 * docs/GUARDIAN.md "Mock versus real integration".
 */
export type VerifierRole = "environmental_verifier";

export interface Verifier {
  readonly verifierId: VerifierId;
  readonly role: VerifierRole;
}

// ---------------------------------------------------------------------------
// Evidence submission
// ---------------------------------------------------------------------------

export interface EvidenceSubmission {
  readonly submissionId: GuardianSubmissionId;
  readonly projectId: ProjectId;
  readonly parcelH3Root: string;
  readonly evidenceHash: string;
  /** Caller-supplied ISO 8601 timestamp — never generated internally. See adapter.ts. */
  readonly submittedAt: string;
}

// ---------------------------------------------------------------------------
// Verification submission
// ---------------------------------------------------------------------------

/**
 * Every one of these fields is copied verbatim from the M1
 * `VerificationResult` that produced it, except `financiallyEligible` and
 * `lifecycleState`, which Guardian derives (never recalculates the
 * underlying science) from `qualityGateStatus`.
 */
export interface VerificationSubmission {
  readonly submissionId: GuardianSubmissionId;
  readonly verificationResultId: VerificationResultId;
  readonly projectId: ProjectId;
  readonly parcelH3Root: ParcelId;
  readonly methodologyVersion: string;
  readonly metric: string;
  readonly verificationStatus: VerificationStatus;
  readonly qualityGateStatus: QualityGateStatus;
  readonly settledQuantity: number;
  readonly lowerBound: number;
  readonly evidenceHash: string;
  /** `true` only when `qualityGateStatus === "PASS"`. Never authorizable otherwise. */
  readonly financiallyEligible: boolean;
  readonly submittedAt: string;
  readonly lifecycleState: LifecycleState;
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

/**
 * A Guardian-workflow attestation that an authorized verifier reviewed a
 * financially-eligible submission. This is NOT financial authorization —
 * Arc remains the sole settlement authority (docs/GUARDIAN.md §6).
 */
export interface AuthorizedVerification {
  readonly submissionId: GuardianSubmissionId;
  readonly verificationResultId: VerificationResultId;
  readonly verifierId: VerifierId;
  readonly authorizedAt: string;
}

// ---------------------------------------------------------------------------
// Credential / attestation
// ---------------------------------------------------------------------------

/**
 * Corresponds to The Graph's planned `GuardianCredential` entity
 * (docs/GRAPH.md §2). Represents a workflow attestation, not a financial
 * instrument and not a regulatory credit (docs/GUARDIAN.md, M2 prompt §10).
 */
export interface GuardianCredential {
  readonly credentialId: CredentialId;
  readonly submissionId: GuardianSubmissionId;
  readonly verificationResultId: VerificationResultId;
  readonly projectId: ProjectId;
  readonly parcelH3Root: ParcelId;
  readonly methodologyVersion: string;
  readonly guardianPolicyVersion: string;
  readonly verifierId: VerifierId;
  readonly settledQuantity: number;
  readonly issuedAt: string;
}

// ---------------------------------------------------------------------------
// Restoration outcome
// ---------------------------------------------------------------------------

/**
 * `RECORDED` is the only status M2 produces. Reversal (e.g. driven by a
 * later dNBR/coherence-loss detection per proposals/idea-0.2.md §4.2) is a
 * documented future extension once Arc/persistence-tranche integration
 * exists (M3+) — not implemented here.
 */
export type OutcomeStatus = "RECORDED";

/**
 * This is explicitly a **verified restoration outcome**, not a regulatory
 * carbon credit, biodiversity credit, or compliance credit — see M2 prompt
 * §10 and docs/DEMO.md §6.
 */
export interface RestorationOutcome {
  readonly outcomeId: OutcomeId;
  readonly credentialId: CredentialId;
  readonly verificationResultId: VerificationResultId;
  readonly projectId: ProjectId;
  readonly parcelH3Root: ParcelId;
  readonly methodologyVersion: string;
  readonly settledQuantity: number;
  readonly status: OutcomeStatus;
  readonly recordedAt: string;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Every value here is actually reachable/produced by `MockGuardianAdapter`
 * (adapter.ts). A verification result rejected outright (missing identity,
 * unsupported methodology, or `INVALID_RESULT`) never enters this lifecycle
 * at all — `getLifecycleState` reports `"NO_SUBMISSION"` for it, which is
 * intentionally not a member of this union (see adapter.ts).
 */
export type LifecycleState =
  | "EVIDENCE_SUBMITTED"
  | "VERIFICATION_SUBMITTED"
  | "VERIFICATION_AUTHORIZED"
  | "CREDENTIAL_ISSUED"
  | "OUTCOME_RECORDED";

// ---------------------------------------------------------------------------
// Operation result unions
// ---------------------------------------------------------------------------

export interface GuardianRejection {
  readonly accepted: false;
  readonly reason: string;
}

export type EvidenceSubmissionResult =
  | { readonly accepted: true; readonly submission: EvidenceSubmission }
  | GuardianRejection;

export type VerificationSubmissionResult =
  | { readonly accepted: true; readonly submission: VerificationSubmission }
  | GuardianRejection;

export type AuthorizationResult =
  | { readonly accepted: true; readonly authorization: AuthorizedVerification }
  | GuardianRejection;

export type CredentialIssuanceResult =
  | { readonly accepted: true; readonly credential: GuardianCredential }
  | GuardianRejection;

export type OutcomeRecordingResult =
  | { readonly accepted: true; readonly outcome: RestorationOutcome }
  | GuardianRejection;
