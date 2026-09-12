import { describe, expect, it } from "vitest";
import { FixtureGraphProvider } from "../fixtureGraphProvider.js";
import type { DeedHistory, IndexedProject } from "../types.js";

function minimalHistory(id: string, projectId: string): DeedHistory {
  return {
    deed: {
      id,
      deedId: id,
      projectId,
      parcelH3Root: "0xparcel",
      sponsor: "0xsponsor",
      beneficiary: "0xbeneficiary",
      authorizedVerifier: "0xverifier",
      escrowAmount: "1",
      unitPriceUSDC: "1",
      quantityDecimals: 6,
      fundedAmount: "0",
      verificationId: null,
      settledQuantityScaled: null,
      settlementAmount: null,
      releasedAmount: null,
      status: "CREATED",
      createdAt: "0",
      createdBlock: "1",
      createdTxHash: "0xtx",
      updatedAt: "0",
      updatedBlock: "1",
      updatedTxHash: "0xtx",
    },
    verifications: [],
    settlements: [],
    fundings: [],
    refunds: [],
    cancellations: [],
  };
}

describe("FixtureGraphProvider", () => {
  it("returns null for an unseeded deed", async () => {
    const provider = new FixtureGraphProvider();
    expect(await provider.getDeedHistory("0")).toBeNull();
  });

  it("returns a seeded deed's history", async () => {
    const provider = new FixtureGraphProvider();
    const history = minimalHistory("0", "0xproject");
    provider.seedDeed(history);
    expect(await provider.getDeedHistory("0")).toEqual(history);
  });

  it("filters deeds by projectId", async () => {
    const provider = new FixtureGraphProvider();
    provider.seedDeed(minimalHistory("0", "0xproject-a"));
    provider.seedDeed(minimalHistory("1", "0xproject-b"));
    const results = await provider.getDeedsByProject("0xproject-a");
    expect(results.map((h) => h.deed.id)).toEqual(["0"]);
  });

  it("finds a verification by verificationId across seeded deeds", async () => {
    const provider = new FixtureGraphProvider();
    const history = minimalHistory("0", "0xproject");
    provider.seedDeed({
      ...history,
      deed: { ...history.deed, verificationId: "0xverif" },
      verifications: [
        {
          id: "0xverif",
          deedId: "0",
          verificationId: "0xverif",
          financiallyEligible: true,
          settledQuantityScaled: "100",
          settlementAmount: "100",
          timestamp: "0",
          blockNumber: "2",
          transactionHash: "0xtx2",
        },
      ],
    });
    const found = await provider.getVerification("0xverif");
    expect(found?.deedId).toBe("0");
    expect(await provider.getVerification("0xdoesnotexist")).toBeNull();
  });

  it("returns a seeded project", async () => {
    const provider = new FixtureGraphProvider();
    const project: IndexedProject = {
      id: "0xproject",
      parcelH3Root: "0xparcel",
      createdAt: "0",
      createdBlock: "1",
      createdTxHash: "0xtx",
    };
    provider.seedProject(project);
    expect(await provider.getProject("0xproject")).toEqual(project);
    expect(await provider.getProject("0xother")).toBeNull();
  });
});
