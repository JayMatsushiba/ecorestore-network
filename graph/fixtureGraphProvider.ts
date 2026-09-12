/**
 * Ecorestore Network — FixtureGraphProvider (M5)
 *
 * A deterministic, in-memory GraphProvider for fast unit tests only. It
 * exists so Auditor logic can be tested without Docker/Graph Node/Postgres
 * /IPFS in the ordinary `npm test` run. It is NOT sufficient for M5
 * acceptance by itself — the real local Graph Node integration path
 * (TheGraphProvider, docs/GRAPH.md, `npm run test:e2e:graph`) is required
 * and is exercised separately.
 */

import type { GraphProvider } from "./provider.js";
import type { DeedHistory, IndexedProject, IndexedVerification } from "./types.js";

export class FixtureGraphProvider implements GraphProvider {
  private readonly deeds = new Map<string, DeedHistory>();
  private readonly projects = new Map<string, IndexedProject>();

  /** Seeds one deed's full history. Overwrites any existing entry for the same deed id. */
  seedDeed(history: DeedHistory): void {
    this.deeds.set(history.deed.id, history);
  }

  seedProject(project: IndexedProject): void {
    this.projects.set(project.id, project);
  }

  async getDeedHistory(deedId: string): Promise<DeedHistory | null> {
    return this.deeds.get(deedId) ?? null;
  }

  async getDeedsByProject(projectId: string): Promise<readonly DeedHistory[]> {
    return Array.from(this.deeds.values()).filter((h) => h.deed.projectId === projectId);
  }

  async getVerification(verificationId: string): Promise<IndexedVerification | null> {
    for (const history of this.deeds.values()) {
      const match = history.verifications.find((v) => v.verificationId === verificationId);
      if (match) return match;
    }
    return null;
  }

  async getProject(projectId: string): Promise<IndexedProject | null> {
    return this.projects.get(projectId) ?? null;
  }
}
