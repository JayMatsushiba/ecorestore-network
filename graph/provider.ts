/**
 * Ecorestore Network — GraphProvider Interface (M5)
 *
 * The Auditor's ONLY path to on-chain-indexed history. Per
 * docs/ARCHITECTURE.md's authority model, the Graph is a read/index layer,
 * not a scientific or financial authority — this interface exposes only
 * retrieval, nothing that could mutate on-chain or Guardian state.
 *
 * `TheGraphProvider` (theGraphProvider.ts) is the real implementation,
 * querying a local Graph Node's GraphQL endpoint. `FixtureGraphProvider`
 * (fixtureGraphProvider.ts) is a deterministic in-memory implementation
 * for fast unit tests only — it is NOT sufficient for M5 acceptance on its
 * own; the real local Graph Node integration path
 * (docs/GRAPH.md, `npm run test:e2e:graph`) is required.
 */

import type { IndexedProject, IndexedVerification, DeedHistory } from "./types.js";

export class GraphUnavailableError extends Error {
  constructor(cause: unknown) {
    super(`Graph Node / GraphQL endpoint unavailable: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "GraphUnavailableError";
  }
}

export interface GraphProvider {
  /** Full indexed history for one deed, or null if no such deed has been indexed. */
  getDeedHistory(deedId: string): Promise<DeedHistory | null>;

  /** All deeds indexed under one on-chain projectId, or an empty array if none. */
  getDeedsByProject(projectId: string): Promise<readonly DeedHistory[]>;

  /** A single verification by its canonical verificationId, or null if not indexed. */
  getVerification(verificationId: string): Promise<IndexedVerification | null>;

  /** The Project entity for a given projectId, or null if never indexed. */
  getProject(projectId: string): Promise<IndexedProject | null>;
}
