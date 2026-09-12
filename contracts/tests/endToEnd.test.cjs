"use strict";
/**
 * Ecorestore Network — M4 End-to-End Integration Test
 *
 * Runs the real, connected chain for the synthetic "Kootenay Riparian
 * Restoration" (British Columbia) project — SYNTHETIC DEMONSTRATION DATA,
 * not a real place or real restoration outcome (see
 * verification/fixtures.ts's own header). Nothing in this file recomputes
 * M1's ecological math, invents a settlement quantity, or duplicates
 * Guardian's authorization logic — every number and every authorization
 * decision comes from the real `verifyProject()`, the real
 * `MockGuardianAdapter`, and the real `prepareSettlementAuthorization()`
 * (integration/), loaded via dynamic `import()` (see hardhat.config.cjs /
 * package.json's `test:contracts` script for why this works: the M1/M2/
 * arc/integration layers are ESM TypeScript, this file is CommonJS to
 * match Hardhat's Mocha runner, and `cross-env NODE_OPTIONS=--import=tsx`
 * registers the loader that bridges the two).
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

const VERIFIER_ID = "guardian-verifier-kootenay-001";
const QUANTITY_DECIMALS = 6;
const ESCROW_AMOUNT = 100_000_000n; // 100.00 mUSDC — LOCAL TEST TOKEN, not real USDC
const UNIT_PRICE_USDC = 1_000_000n; // 1.00 mUSDC per 1.0 whole settled unit — explicit demo pricing convention, see docs/ARC.md §9.7
const TIMESTAMPS = {
  submittedAt: "2026-09-11T00:00:00.000Z",
  authorizedAt: "2026-09-11T01:00:00.000Z",
  issuedAt: "2026-09-11T02:00:00.000Z",
};

async function deployArc() {
  const [sponsor, beneficiary, verifierSigner, other] = await ethers.getSigners();

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();

  const RestorationDeed = await ethers.getContractFactory("RestorationDeed");
  const deed = await RestorationDeed.deploy(await usdc.getAddress());
  await deed.waitForDeployment();

  return { usdc, deed, sponsor, beneficiary, verifierSigner, other };
}

/**
 * Steps 1-6 of the flow (M1 -> M2 -> Arc payload), using ONLY real,
 * existing code — verifyProject(), a fresh MockGuardianAdapter, and
 * prepareSettlementAuthorization(). Returns the eligible outcome; throws
 * (failing the test loudly) if the synthetic fixture ever stops being
 * eligible, since every test in this file assumes it is.
 */
async function prepareRealSettlementPayload() {
  const { verifyProject } = await import("../../verification/engine.js");
  const { DEFAULT_METHODOLOGY_CONFIG } = await import("../../verification/config.js");
  const { FIXTURE_PARTIAL_SETTLEMENT } = await import("../../verification/fixtures.js");
  const { createMockGuardianAdapter } = await import("../../guardian/adapter.js");
  const { prepareSettlementAuthorization } = await import("../../integration/restorationSettlementFlow.js");

  const guardian = createMockGuardianAdapter();
  const outcome = prepareSettlementAuthorization(
    FIXTURE_PARTIAL_SETTLEMENT,
    DEFAULT_METHODOLOGY_CONFIG,
    guardian,
    VERIFIER_ID,
    QUANTITY_DECIMALS,
    TIMESTAMPS,
  );

  if (!outcome.eligible) {
    throw new Error(`test fixture assumption violated: expected an eligible outcome, got ${outcome.reason}`);
  }
  return outcome;
}

function toSolidityAuth(onChainAuthorization) {
  return {
    verificationId: onChainAuthorization.verificationId,
    projectId: onChainAuthorization.projectId,
    parcelH3Root: onChainAuthorization.parcelH3Root,
    methodologyVersion: onChainAuthorization.methodologyVersion,
    evidenceHash: onChainAuthorization.evidenceHash,
    settledQuantityScaled: onChainAuthorization.settledQuantityScaled,
    financiallyEligible: onChainAuthorization.financiallyEligible,
  };
}

describe("M4 — End-to-End Integration (synthetic BC restoration)", function () {
  it("runs the full connected flow: real M1 verification -> Mock Guardian credential -> local RestorationDeed settlement", async function () {
    // 1-3: real M1 verification (via the integration layer, which calls verifyProject() itself)
    // 4-6: Mock Guardian credential (MockGuardianAdapter) + real on-chain payload (same call)
    const outcome = await prepareRealSettlementPayload();
    expect(outcome.verificationResult.verificationStatus).to.equal("PARTIAL");
    expect(outcome.verificationResult.qualityGateStatus).to.equal("PASS");

    const { usdc, deed, sponsor, beneficiary, verifierSigner } = await deployArc();

    // 6: create the RestorationDeed using the identity derived from the real M1 result
    const createTx = await deed
      .connect(sponsor)
      .createDeed(
        outcome.deedIdentity.projectId,
        outcome.deedIdentity.parcelH3Root,
        outcome.deedIdentity.methodologyVersion,
        beneficiary.address,
        verifierSigner.address,
        ESCROW_AMOUNT,
        UNIT_PRICE_USDC,
        QUANTITY_DECIMALS,
      );
    const createReceipt = await createTx.wait();
    const createdEvent = createReceipt.logs
      .map((log) => {
        try {
          return deed.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed && parsed.name === "DeedCreated");
    expect(createdEvent).to.not.equal(undefined);
    const deedId = createdEvent.args.deedId;

    // 7: fund with MockUSDC (LOCAL TEST TOKEN)
    await usdc.mint(sponsor.address, ESCROW_AMOUNT);
    await usdc.connect(sponsor).approve(await deed.getAddress(), ESCROW_AMOUNT);
    await expect(deed.connect(sponsor).fundDeed(deedId))
      .to.emit(deed, "DeedFunded")
      .withArgs(deedId, sponsor.address, ESCROW_AMOUNT);
    expect(await deed.getDeedStatus(deedId)).to.equal(1n); // FUNDED

    // 8: submit the REAL authorization payload — nothing hand-constructed
    await expect(deed.connect(verifierSigner).submitVerification(deedId, toSolidityAuth(outcome.onChainAuthorization)))
      .to.emit(deed, "VerificationSubmitted")
      .withArgs(
        deedId,
        outcome.onChainAuthorization.verificationId,
        true,
        outcome.onChainAuthorization.settledQuantityScaled,
        outcome.onChainAuthorization.settledQuantityScaled, // unitPriceUSDC is 1.00 at matching decimals, so amount == quantity here
      );

    // 9: assert VERIFIED
    const afterVerify = await deed.getDeed(deedId);
    expect(afterVerify.status).to.equal(2n); // VERIFIED

    // 13: the on-chain settled quantity corresponds exactly to M1's own
    // conservative lower-bound result — not a value invented anywhere in
    // this test or in the integration layer.
    expect(outcome.verificationResult.settledQuantity).to.equal(outcome.verificationResult.lowerBound);
    const expectedScaled = BigInt(Math.round(outcome.verificationResult.settledQuantity * 10 ** QUANTITY_DECIMALS));
    expect(afterVerify.settledQuantityScaled).to.equal(expectedScaled);
    expect(afterVerify.settledQuantityScaled).to.equal(outcome.onChainAuthorization.settledQuantityScaled);

    // 10-12: settle and assert correct USDC movement
    const beneficiaryBefore = await usdc.balanceOf(beneficiary.address);
    const sponsorBefore = await usdc.balanceOf(sponsor.address);

    await expect(deed.settleDeed(deedId)).to.emit(deed, "SettlementExecuted");

    const afterSettle = await deed.getDeed(deedId);
    expect(afterSettle.status).to.equal(3n); // SETTLED

    const beneficiaryAfter = await usdc.balanceOf(beneficiary.address);
    const sponsorAfter = await usdc.balanceOf(sponsor.address);
    expect(beneficiaryAfter - beneficiaryBefore).to.equal(afterSettle.settlementAmount);
    expect(beneficiaryAfter - beneficiaryBefore + (sponsorAfter - sponsorBefore)).to.equal(ESCROW_AMOUNT);
    expect(await usdc.balanceOf(await deed.getAddress())).to.equal(0n); // no trapped funds

    // 14: events already asserted above (DeedCreated implicitly via the
    // successful parse, DeedFunded, VerificationSubmitted, SettlementExecuted)
  });

  it("failure path — unauthorized verifier: the real payload is rejected from a non-designated signer", async function () {
    const outcome = await prepareRealSettlementPayload();
    const { usdc, deed, sponsor, beneficiary, verifierSigner, other } = await deployArc();

    const createTx = await deed
      .connect(sponsor)
      .createDeed(
        outcome.deedIdentity.projectId,
        outcome.deedIdentity.parcelH3Root,
        outcome.deedIdentity.methodologyVersion,
        beneficiary.address,
        verifierSigner.address, // designated verifier
        ESCROW_AMOUNT,
        UNIT_PRICE_USDC,
        QUANTITY_DECIMALS,
      );
    const receipt = await createTx.wait();
    const deedId = receipt.logs
      .map((log) => {
        try {
          return deed.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((p) => p && p.name === "DeedCreated").args.deedId;

    await usdc.mint(sponsor.address, ESCROW_AMOUNT);
    await usdc.connect(sponsor).approve(await deed.getAddress(), ESCROW_AMOUNT);
    await deed.connect(sponsor).fundDeed(deedId);

    // `other` is NOT the designated authorizedVerifier for this deed.
    await expect(
      deed.connect(other).submitVerification(deedId, toSolidityAuth(outcome.onChainAuthorization)),
    ).to.be.revertedWithCustomError(deed, "NotAuthorizedVerifier");

    expect(await deed.getDeedStatus(deedId)).to.equal(1n); // still FUNDED — funds remain protected
  });

  it("failure path — methodology mismatch: the real payload cannot settle a deed created under a different methodology", async function () {
    const outcome = await prepareRealSettlementPayload();
    const { usdc, deed, sponsor, beneficiary, verifierSigner } = await deployArc();

    const wrongMethodologyVersion = ethers.keccak256(ethers.toUtf8Bytes("ecorestore-m1-v0.1-a-different-methodology"));

    const createTx = await deed
      .connect(sponsor)
      .createDeed(
        outcome.deedIdentity.projectId,
        outcome.deedIdentity.parcelH3Root,
        wrongMethodologyVersion, // deliberately does not match the real result's methodology
        beneficiary.address,
        verifierSigner.address,
        ESCROW_AMOUNT,
        UNIT_PRICE_USDC,
        QUANTITY_DECIMALS,
      );
    const receipt = await createTx.wait();
    const deedId = receipt.logs
      .map((log) => {
        try {
          return deed.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((p) => p && p.name === "DeedCreated").args.deedId;

    await usdc.mint(sponsor.address, ESCROW_AMOUNT);
    await usdc.connect(sponsor).approve(await deed.getAddress(), ESCROW_AMOUNT);
    await deed.connect(sponsor).fundDeed(deedId);

    await expect(
      deed.connect(verifierSigner).submitVerification(deedId, toSolidityAuth(outcome.onChainAuthorization)),
    ).to.be.revertedWithCustomError(deed, "VerificationIdentityMismatch");

    expect(await deed.getDeedStatus(deedId)).to.equal(1n); // still FUNDED — no settlement occurred
  });
});
