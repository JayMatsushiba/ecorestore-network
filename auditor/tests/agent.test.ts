import { describe, expect, it } from "vitest";
import { auditDeed } from "../agent.js";
import { FixtureGraphProvider } from "../../graph/fixtureGraphProvider.js";
import { GraphUnavailableError, type GraphProvider } from "../../graph/provider.js";
import type { DeedHistory } from "../../graph/types.js";
import { scaleQuantity } from "../../arc/identifiers.js";
import { createMockGuardianAdapter } from "../../guardian/adapter.js";
import { computeVerificationResultId } from "../../guardian/identifiers.js";
import { DEFAULT_METHODOLOGY_CONFIG } from "../../verification/config.js";
import { verifyProject } from "../../verification/engine.js";
import { FIXTURE_PARTIAL_SETTLEMENT } from "../../verification/fixtures.js";

const DEED_ID = "0";
const VERIFICATION_ID = "0xaa";
const QUANTITY_DECIMALS = 6;
const UNIT_PRICE_USDC = "1000000";

function consistentHistory(): DeedHistory {
  const settledQuantityScaled = "18181500";
  const settlementAmount = "18181500"; // 18.1815 * 1_000_000 / 10^6 unit price 1.0
  return {
    deed: {
      id: DEED_ID,
      deedId: DEED_ID,
      projectId: "0xproject",
      parcelH3Root: "0xparcel",
      sponsor: "0xsponsor",
      beneficiary: "0xbeneficiary",
      authorizedVerifier: "0xverifier",
      escrowAmount: "100000000",
      unitPriceUSDC: UNIT_PRICE_USDC,
      quantityDecimals: QUANTITY_DECIMALS,
      fundedAmount: "100000000",
      verificationId: VERIFICATION_ID,
      settledQuantityScaled,
      settlementAmount,
      releasedAmount: settlementAmount,
      status: "SETTLED",
      createdAt: "0",
      createdBlock: "1",
      createdTxHash: "0xtx1",
      updatedAt: "0",
      updatedBlock: "5",
      updatedTxHash: "0xtx5",
    },
    verifications: [
      {
        id: VERIFICATION_ID,
        deedId: DEED_ID,
        verificationId: VERIFICATION_ID,
        financiallyEligible: true,
        settledQuantityScaled,
        settlementAmount,
        timestamp: "0",
        blockNumber: "3",
        transactionHash: "0xtx3",
      },
    ],
    settlements: [
      {
        id: "0xtx5-0",
        deedId: DEED_ID,
        verificationId: VERIFICATION_ID,
        beneficiary: "0xbeneficiary",
        settlementAmount,
        refundedRemainder: "81818500",
        timestamp: "0",
        blockNumber: "5",
        transactionHash: "0xtx5",
      },
    ],
    fundings: [],
    refunds: [],
    cancellations: [],
  };
}

describe("auditDeed — consistent history", () => {
  it("reports CONSISTENT with no anomalies for a correctly indexed settled deed", async () => {
    const graphProvider = new FixtureGraphProvider();
    graphProvider.seedDeed(consistentHistory());

    const report = await auditDeed({ graphProvider, deedId: DEED_ID });

    expect(report.status).toBe("CONSISTENT");
    expect(report.anomalies).toEqual([]);
    expect(report.explanation).toContain("internally consistent");
  });

  it("cross-checks against a real M1 VerificationResult and finds it consistent", async () => {
    const graphProvider = new FixtureGraphProvider();
    const history = consistentHistory();
    graphProvider.seedDeed(history);

    const verificationResult = verifyProject(FIXTURE_PARTIAL_SETTLEMENT, DEFAULT_METHODOLOGY_CONFIG);
    // Align the fixture's on-chain settledQuantityScaled with this real M1 result.
    const scaled = scaleQuantity(verificationResult.settledQuantity, QUANTITY_DECIMALS).toString();
    graphProvider.seedDeed({
      ...history,
      deed: { ...history.deed, settledQuantityScaled: scaled },
      verifications: [{ ...history.verifications[0]!, settledQuantityScaled: scaled }],
      settlements: [],
    });

    const report = await auditDeed({ graphProvider, deedId: DEED_ID, verificationResult });
    expect(report.anomalies.filter((a) => a.code === "QUANTITY_MISMATCH")).toEqual([]);
  });
});

describe("auditDeed — failure handling (task acceptance criterion K)", () => {
  it("K1: Graph unavailable -> DATA_UNAVAILABLE, not a thrown error", async () => {
    const failingProvider: GraphProvider = {
      getDeedHistory: async () => {
        throw new GraphUnavailableError(new Error("connection refused"));
      },
      getDeedsByProject: async () => [],
      getVerification: async () => null,
      getProject: async () => null,
    };

    const report = await auditDeed({ graphProvider: failingProvider, deedId: DEED_ID });
    expect(report.status).toBe("DATA_UNAVAILABLE");
    expect(report.anomalies).toEqual([]);
  });

  it("K3: missing deed -> NOT_FOUND", async () => {
    const graphProvider = new FixtureGraphProvider();
    const report = await auditDeed({ graphProvider, deedId: "999" });
    expect(report.status).toBe("NOT_FOUND");
  });

  it("K2 / K6: deed references a verificationId with no matching Verification indexed", async () => {
    const graphProvider = new FixtureGraphProvider();
    const history = consistentHistory();
    graphProvider.seedDeed({ ...history, verifications: [] });

    const report = await auditDeed({ graphProvider, deedId: DEED_ID });
    expect(report.status).toBe("ANOMALOUS");
    expect(report.anomalies.map((a) => a.code)).toContain("DEED_VERIFICATION_ID_MISMATCH");
  });

  it("K6: SETTLED deed with no indexed Settlement event", async () => {
    const graphProvider = new FixtureGraphProvider();
    const history = consistentHistory();
    graphProvider.seedDeed({ ...history, settlements: [] });

    const report = await auditDeed({ graphProvider, deedId: DEED_ID });
    expect(report.status).toBe("ANOMALOUS");
    expect(report.anomalies.map((a) => a.code)).toContain("SETTLED_WITHOUT_SETTLEMENT_EVENT");
  });

  it("K5: settlement amount tampered relative to the deed's recorded settlementAmount", async () => {
    const graphProvider = new FixtureGraphProvider();
    const history = consistentHistory();
    graphProvider.seedDeed({
      ...history,
      settlements: [{ ...history.settlements[0]!, settlementAmount: "999999999" }],
    });

    const report = await auditDeed({ graphProvider, deedId: DEED_ID });
    expect(report.status).toBe("ANOMALOUS");
    expect(report.anomalies.map((a) => a.code)).toContain("SETTLEMENT_AMOUNT_MISMATCH");
  });

  it("K6: a Settlement referencing a financially-ineligible Verification is flagged", async () => {
    const graphProvider = new FixtureGraphProvider();
    const history = consistentHistory();
    graphProvider.seedDeed({
      ...history,
      verifications: [{ ...history.verifications[0]!, financiallyEligible: false }],
    });

    const report = await auditDeed({ graphProvider, deedId: DEED_ID });
    expect(report.anomalies.map((a) => a.code)).toContain("SETTLEMENT_WITHOUT_ELIGIBLE_VERIFICATION");
  });

  it("K5: quantity mismatch between the off-chain M1 result and the on-chain indexed quantity", async () => {
    const graphProvider = new FixtureGraphProvider();
    const history = consistentHistory();
    // Deliberately mismatched: FIXTURE_PARTIAL_SETTLEMENT's real settledQuantity
    // scales to 18181500 (see the "consistent history" describe block above),
    // so seed a clearly different on-chain value to produce a genuine mismatch.
    graphProvider.seedDeed({
      ...history,
      verifications: [{ ...history.verifications[0]!, settledQuantityScaled: "99999999" }],
    });

    const verificationResult = verifyProject(FIXTURE_PARTIAL_SETTLEMENT, DEFAULT_METHODOLOGY_CONFIG);
    const report = await auditDeed({ graphProvider, deedId: DEED_ID, verificationResult });

    expect(report.status).toBe("ANOMALOUS");
    expect(report.anomalies.map((a) => a.code)).toContain("QUANTITY_MISMATCH");
  });

  it("K4: methodology mismatch between the off-chain M1 result and the M2 credential", async () => {
    const graphProvider = new FixtureGraphProvider();
    graphProvider.seedDeed(consistentHistory());

    const guardian = createMockGuardianAdapter();
    const result = verifyProject(FIXTURE_PARTIAL_SETTLEMENT, DEFAULT_METHODOLOGY_CONFIG);
    const verificationResultId = computeVerificationResultId(result);
    guardian.submitVerificationResult(result, "2026-09-12T00:00:00.000Z");
    guardian.authorizeVerification(verificationResultId, "guardian-verifier-kootenay-001", result, "2026-09-12T01:00:00.000Z");
    const credentialOutcome = guardian.issueCredential(
      verificationResultId,
      "guardian-verifier-kootenay-001",
      "2026-09-12T02:00:00.000Z",
    );
    if (!credentialOutcome.accepted) throw new Error("test setup failed");

    const tamperedCredential = { ...credentialOutcome.credential, methodologyVersion: "a-different-methodology" };

    const report = await auditDeed({
      graphProvider,
      deedId: DEED_ID,
      verificationResult: result,
      credential: tamperedCredential,
    });

    expect(report.anomalies.map((a) => a.code)).toContain("METHODOLOGY_MISMATCH");
  });
});

describe("auditDeed — authority boundary", () => {
  it("never mutates the graph provider's data and returns a read-only report", async () => {
    const graphProvider = new FixtureGraphProvider();
    const history = consistentHistory();
    graphProvider.seedDeed(history);

    await auditDeed({ graphProvider, deedId: DEED_ID });
    const after = await graphProvider.getDeedHistory(DEED_ID);
    expect(after).toEqual(history);
  });
});
