/**
 * Ecorestore Network — Arc On-Chain Identifier Helpers (M3)
 *
 * RestorationDeed.sol never stores full off-chain string identifiers
 * on-chain (projectId, parcelH3Root, methodologyVersion) — it stores their
 * keccak256 hashes and compares hashes for equality (see the contract's
 * NatSpec, "WHAT IS NOT ON-CHAIN"). These are the corresponding off-chain
 * helpers that compute the exact same hashes, so the value submitted to
 * `createDeed`/`submitVerification` always matches what verification/ and
 * guardian/ already identify a result by.
 */

import { keccak256, toUtf8Bytes } from "ethers";

/** keccak256 of the UTF-8 bytes of a non-empty string identifier (projectId, parcelH3Root, or methodologyVersion). */
export function hashIdentifier(value: string): string {
  if (value.length === 0) {
    throw new Error("cannot hash an empty identifier");
  }
  return keccak256(toUtf8Bytes(value));
}

/**
 * Converts an M1 floating-point quantity (e.g. hectares) into the
 * fixed-point integer representation RestorationDeed.sol's
 * `settledQuantityScaled` expects.
 *
 * PRECISION NOTE: `value` is already a JS floating-point number by the time
 * it reaches this function (M1's `VerificationResult.settledQuantity` is a
 * `number`), so this does not — and cannot — recover precision beyond what
 * IEEE-754 double arithmetic already provides upstream. `Math.round` is
 * applied to the scaled value because multiplying a non-terminating binary
 * fraction by a power of ten can land arbitrarily close to, but not
 * exactly on, an integer (this does not occur for every input — many
 * hectare-scale values happen to multiply cleanly at 6 decimal places —
 * but the function does not rely on that being true in general).
 */
export function scaleQuantity(value: number, decimals: number): bigint {
  if (!Number.isFinite(value)) {
    throw new Error(`cannot scale a non-finite quantity: ${value}`);
  }
  if (value < 0) {
    throw new Error(`cannot scale a negative quantity: ${value}`);
  }
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error(`decimals must be a non-negative integer: ${decimals}`);
  }
  const scaled = Math.round(value * 10 ** decimals);
  return BigInt(scaled);
}
