/**
 * Ecorestore Network — Guardian Policy: Methodology Registry (M2)
 *
 * `GUARDIAN_POLICY_VERSION` identifies the version of *this Guardian
 * workflow policy* — distinct from the M1 verification methodology version
 * (`ecorestore-m1-v0.1`, see verification/config.ts) and distinct from the
 * software/package version. See M2 prompt §8 and docs/GUARDIAN.md.
 *
 * `SUPPORTED_METHODOLOGY_VERSIONS` is Guardian's allowlist of verification
 * methodology versions it will accept results from. A result produced
 * under any other version — including a real M1 configuration variant that
 * simply isn't on this list, such as `verification/config.ts`'s
 * `STRICT_METHODOLOGY_CONFIG` — is rejected at submission (M2 prompt §16,
 * "Methodology mismatch -> rejected"). This is a deliberate, explicit
 * allowlist rather than "accept anything that looks like a VerificationResult":
 * Guardian does not reinterpret or trust an unversioned or unrecognized
 * methodology's numbers.
 */

export const GUARDIAN_POLICY_VERSION = "ecorestore-guardian-m2-v0.1";

export const SUPPORTED_METHODOLOGY_VERSIONS: readonly string[] = ["ecorestore-m1-v0.1"];

export function isSupportedMethodologyVersion(methodologyVersion: string): boolean {
  return SUPPORTED_METHODOLOGY_VERSIONS.includes(methodologyVersion);
}
