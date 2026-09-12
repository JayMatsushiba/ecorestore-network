/**
 * Ecorestore Network — Guardian Policy: Verifier Registry (M2)
 *
 * MOCKED: a hard-coded, in-code authorized-verifier allowlist standing in
 * for Guardian's real identity/role infrastructure (in production, Hedera
 * DID-based verifier credentials issued and checked by a deployed Guardian
 * policy — see docs/GUARDIAN.md "Mock versus real integration"). M2 does
 * not implement DIDs, key management, or any identity-proofing; this is a
 * deterministic stand-in only.
 */

export type VerifierId = string;

const AUTHORIZED_VERIFIER_IDS: ReadonlySet<VerifierId> = new Set(["guardian-verifier-kootenay-001"]);

export function isAuthorizedVerifier(verifierId: VerifierId): boolean {
  return AUTHORIZED_VERIFIER_IDS.has(verifierId);
}
