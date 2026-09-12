/**
 * Ecorestore Network — Evidence Hashing (M1)
 *
 * Deterministically hashes the evidence set used by a verification run.
 *
 * M1 SIMPLIFICATION: this is a SHA-256 digest of a canonical JSON encoding
 * of the evidence observations (sorted by `evidenceId`), not a CID and not
 * a Merkle root over an H3 cell set. It exists so the canonical
 * `VerificationResult` can reference "the evidence that produced this
 * result" in a reproducible way. Real content-addressed evidence storage
 * (IPFS/Filecoin, per docs/ARCHITECTURE.md) is out of scope for M1 — see
 * CLAUDE.md "Architecture Boundaries".
 */

import { createHash } from "node:crypto";
import type { EvidenceObservation } from "../models.js";

export function computeEvidenceHash(evidence: readonly EvidenceObservation[]): string {
  const sorted = [...evidence].sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
  const canonical = sorted.map((observation) => ({
    evidenceId: observation.evidenceId,
    parcelId: observation.parcelId,
    metric: observation.metric,
    period: observation.period,
    value: observation.value,
    observedAt: observation.observedAt,
    source: observation.source,
  }));
  const json = JSON.stringify(canonical);
  return `sha256:${createHash("sha256").update(json).digest("hex")}`;
}
