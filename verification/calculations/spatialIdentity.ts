/**
 * Ecorestore Network — Spatial Identity (M1)
 *
 * M1 SIMPLIFICATION: the production architecture (docs/ARCHITECTURE.md §5,
 * §3.10 of proposals/idea-0.2.md) computes a canonical H3 cell-set Merkle
 * root over a parcel's real geometry. M1 does not ingest real geometry and
 * does not implement H3 indexing or a Merkle tree — per CLAUDE.md and the M1
 * prompt §5 ("do not invent cryptographic guarantees... do not implement a
 * Merkle tree merely because the architecture may eventually use
 * content-addressed evidence").
 *
 * Instead, M1 derives a deterministic, stable placeholder "h3Root" string
 * from the parcel's declared identifier using a simple non-cryptographic
 * hash (FNV-1a, 32-bit). This is NOT a Merkle root, NOT collision-resistant,
 * and NOT suitable for production spatial-identity, double-counting-
 * prevention, or anti-fraud use. It exists only so the canonical
 * `VerificationResult` has a stable `parcelH3Root` field to hand to
 * Guardian/Arc in later milestones.
 */

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function deriveParcelH3Root(parcelId: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < parcelId.length; index += 1) {
    hash ^= parcelId.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `h3sim_${hex}`;
}
