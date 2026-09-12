/**
 * Ecorestore Network — M5 Graph Node End-to-End Integration Test
 *
 * Exercises the REAL local integration path required by the M5 prompt:
 *
 *   Hardhat (persistent node) -> RestorationDeed events -> Graph Node ->
 *   Ecorestore subgraph -> GraphQL -> TheGraphProvider -> Auditor
 *
 * This is NOT a unit test and does NOT run as part of `npm test` (see
 * vitest.config.ts's `**\/*.e2e.test.ts` exclude and this project's
 * `test:e2e:graph` script). It requires infrastructure to already be
 * running:
 *
 *   1. A persistent Hardhat node:
 *        npx hardhat node --hostname 0.0.0.0
 *   2. The real M1 -> M2 -> Arc chain run against it, producing on-chain
 *      events (writes subgraph/deployment.local.json):
 *        NODE_OPTIONS=--import=tsx npx hardhat run scripts/deployAndRunLocalDemo.cjs --network localhost
 *   3. The local Graph Node stack:
 *        cd subgraph && docker compose up -d
 *   4. The subgraph configured, built, and deployed against it:
 *        cd subgraph && npm run configure && npm run codegen && npm run build
 *        npm run create-local && npm run deploy-local
 *
 * See docs/GRAPH.md for the full startup sequence and prerequisites. This
 * test reads subgraph/deployment.local.json (written by step 2) instead of
 * hardcoding addresses/quantities, so it stays correct if the demo is
 * re-run against a fresh chain.
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { auditDeed } from "../../auditor/agent.js";
import { hashIdentifier, scaleQuantity } from "../../arc/identifiers.js";
import { DEFAULT_METHODOLOGY_CONFIG } from "../../verification/config.js";
import { verifyProject } from "../../verification/engine.js";
import { FIXTURE_PARTIAL_SETTLEMENT } from "../../verification/fixtures.js";
import { TheGraphProvider } from "../theGraphProvider.js";

const deploymentPath = fileURLToPath(new URL("../../subgraph/deployment.local.json", import.meta.url));

const skip = !existsSync(deploymentPath);
if (skip) {
  // eslint-disable-next-line no-console
  console.warn(
    `Skipping Graph Node E2E test: ${deploymentPath} does not exist. Run the setup steps in docs/GRAPH.md first.`,
  );
}

describe.skipIf(skip)("M5 Graph Node E2E: Hardhat -> Graph Node -> subgraph -> GraphQL -> TheGraphProvider -> Auditor", () => {
  const deployment = skip ? null : JSON.parse(readFileSync(deploymentPath, "utf8"));
  const graphProvider = new TheGraphProvider();

  it("indexes the real on-chain deed with the exact identifiers and quantities the real M1/M2/Arc chain produced", async () => {
    const history = await graphProvider.getDeedHistory(deployment.deedId);
    expect(history).not.toBeNull();
    if (!history) return;

    const { deed } = history;
    expect(deed.projectId).toBe(hashIdentifier(deployment.projectId));
    expect(deed.parcelH3Root).toBe(hashIdentifier(deployment.parcelH3Root));
    expect(deed.status).toBe("SETTLED");
    expect(deed.verificationId).toBe(deployment.verificationId);

    const expectedScaled = scaleQuantity(deployment.settledQuantity, deed.quantityDecimals).toString();
    expect(deed.settledQuantityScaled).toBe(expectedScaled);
    expect(deed.settlementAmount).toBe(deed.releasedAmount);

    expect(history.verifications).toHaveLength(1);
    expect(history.verifications[0]?.verificationId).toBe(deployment.verificationId);
    expect(history.verifications[0]?.financiallyEligible).toBe(true);

    expect(history.settlements).toHaveLength(1);
    expect(history.settlements[0]?.verificationId).toBe(deployment.verificationId);

    expect(history.fundings).toHaveLength(1);
  });

  it("the indexed settled quantity traces back to a fresh, independently-recomputed real M1 result (re-running verifyProject on the same synthetic fixture is deterministic)", async () => {
    const verificationResult = verifyProject(FIXTURE_PARTIAL_SETTLEMENT, DEFAULT_METHODOLOGY_CONFIG);
    expect(verificationResult.settledQuantity).toBe(deployment.settledQuantity);

    const history = await graphProvider.getDeedHistory(deployment.deedId);
    expect(history?.deed.settledQuantityScaled).toBe(
      scaleQuantity(verificationResult.settledQuantity, history!.deed.quantityDecimals).toString(),
    );
  });

  it("the Auditor, querying the real Graph Node through TheGraphProvider, reports the deed CONSISTENT", async () => {
    const verificationResult = verifyProject(FIXTURE_PARTIAL_SETTLEMENT, DEFAULT_METHODOLOGY_CONFIG);
    const report = await auditDeed({
      graphProvider,
      deedId: deployment.deedId,
      verificationResult,
    });

    expect(report.status).toBe("CONSISTENT");
    expect(report.anomalies).toEqual([]);
  });

  it("a nonexistent deed id is reported NOT_FOUND, not a crash", async () => {
    const report = await auditDeed({ graphProvider, deedId: "999999" });
    expect(report.status).toBe("NOT_FOUND");
  });

  it("an unreachable Graph endpoint is reported DATA_UNAVAILABLE, not a thrown error", async () => {
    const unreachable = new TheGraphProvider("http://127.0.0.1:1/subgraphs/name/does-not-exist");
    const report = await auditDeed({ graphProvider: unreachable, deedId: deployment.deedId });
    expect(report.status).toBe("DATA_UNAVAILABLE");
  });
});
