/**
 * Ecorestore Network — Arc Settlement Payload Builder (M3)
 *
 * Translates an M1 `VerificationResult` plus its M2 `GuardianCredential`
 * into the on-chain identifiers and `VerificationAuthorization` struct
 * RestorationDeed.sol expects. This is where the string-based identifiers
 * verification/ and guardian/ use become the bytes32 hashes and
 * fixed-point integers Solidity works with — no ecological calculation
 * happens here, only representation conversion (M3 prompt §5, §10).
 *
 * SCOPE NOTE: `buildVerificationAuthorization` only builds ELIGIBLE
 * payloads (`financiallyEligible: true`), because a `GuardianCredential`
 * can only exist for a submission Guardian already authorized as
 * financially eligible (guardian/adapter.ts's `issueCredential` requires a
 * prior `authorizeVerification`, which itself requires
 * `financiallyEligible === true`). There is currently no Guardian-
 * authorized *ineligible* object for this adapter to translate.
 * RestorationDeed.sol's `financiallyEligible: false` branch still exists
 * and is still tested directly at the contract level
 * (contracts/tests/RestorationDeed.settlement.test.cjs) as a defense-in-
 * depth / future-extension path, not something M3's off-chain adapter
 * currently produces.
 */

import { computeVerificationResultId } from "../guardian/identifiers.js";
import type { GuardianCredential } from "../guardian/models.js";
import type { VerificationResult } from "../verification/models.js";
import { hashIdentifier, scaleQuantity } from "./identifiers.js";

export interface OnChainDeedIdentity {
  readonly projectId: string;
  readonly parcelH3Root: string;
  readonly methodologyVersion: string;
}

export interface OnChainVerificationAuthorization extends OnChainDeedIdentity {
  readonly verificationId: string;
  readonly evidenceHash: string;
  readonly settledQuantityScaled: bigint;
  readonly financiallyEligible: true;
}

/**
 * Computes the three hashed identity fields `createDeed` needs, from the
 * same `VerificationResult` that will later be used to build the
 * settlement authorization — guaranteeing the two always agree, since both
 * derive from the same source strings via the same hash function.
 */
export function buildDeedIdentity(result: VerificationResult): OnChainDeedIdentity {
  return {
    projectId: hashIdentifier(result.projectId),
    parcelH3Root: hashIdentifier(result.parcelH3Root),
    methodologyVersion: hashIdentifier(result.methodologyVersion),
  };
}

/**
 * Builds the settlement authorization payload for `submitVerification`.
 *
 * Throws (refuses to build a payload) if:
 *  - the credential's `verificationResultId` does not match the hash M2
 *    itself would compute for `result` (defense in depth — the credential
 *    should always agree with the result it was issued for, but this
 *    adapter does not assume that without checking);
 *  - `result.qualityGateStatus !== "PASS"` (a second, independent
 *    eligibility check — again, a real `GuardianCredential` should already
 *    guarantee this, but the on-chain settlement path never trusts a
 *    single unchecked assumption for something this consequential).
 */
export function buildVerificationAuthorization(
  result: VerificationResult,
  credential: GuardianCredential,
  quantityDecimals: number,
): OnChainVerificationAuthorization {
  const expectedVerificationResultId = computeVerificationResultId(result);
  if (credential.verificationResultId !== expectedVerificationResultId) {
    throw new Error(
      "credential.verificationResultId does not match the hash of the supplied VerificationResult; refusing to build a settlement payload",
    );
  }
  if (result.qualityGateStatus !== "PASS") {
    throw new Error(
      `cannot build an eligible settlement payload for a result with qualityGateStatus=${result.qualityGateStatus}`,
    );
  }

  const identity = buildDeedIdentity(result);

  return {
    ...identity,
    verificationId: hashIdentifier(credential.verificationResultId),
    evidenceHash: hashIdentifier(result.evidenceHash),
    settledQuantityScaled: scaleQuantity(result.settledQuantity, quantityDecimals),
    financiallyEligible: true,
  };
}
