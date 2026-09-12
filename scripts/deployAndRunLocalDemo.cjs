"use strict";
/**
 * Ecorestore Network — M5 Local Demo Deployment Script
 *
 * Deploys MockUSDC + RestorationDeed to a PERSISTENT local Hardhat node
 * (started separately and left running: `npx hardhat node --hostname
 * 0.0.0.0`), then runs the real M1 -> M2 -> Arc chain — the exact same
 * `prepareSettlementAuthorization()` (integration/, M4) that
 * contracts/tests/endToEnd.test.cjs exercises against Hardhat's ephemeral
 * in-process network — against this persistent node instead, producing
 * real on-chain events for the local Graph Node (M5) to index.
 *
 * This script computes nothing scientific and nothing financial itself:
 * every quantity comes from the real verifyProject()/Guardian/Arc chain.
 *
 * Usage (from the repository root):
 *   NODE_OPTIONS=--import=tsx npx hardhat run scripts/deployAndRunLocalDemo.cjs --network localhost
 *
 * Writes subgraph/deployment.local.json with the deployed contract address
 * and deployment block number, which scripts/configureSubgraph.cjs then
 * uses to patch subgraph/subgraph.yaml before codegen/build/deploy.
 */

const fs = require("node:fs");
const path = require("node:path");
const { ethers, network } = require("hardhat");

const VERIFIER_ID = "guardian-verifier-kootenay-001";
const QUANTITY_DECIMALS = 6;
const ESCROW_AMOUNT = 100_000_000n; // 100.00 mUSDC — LOCAL TEST TOKEN, not real USDC
const UNIT_PRICE_USDC = 1_000_000n; // 1.00 mUSDC per 1.0 whole settled unit — explicit demo pricing convention, see docs/ARC.md §9.7
const TIMESTAMPS = {
  submittedAt: "2026-09-12T00:00:00.000Z",
  authorizedAt: "2026-09-12T01:00:00.000Z",
  issuedAt: "2026-09-12T02:00:00.000Z",
};

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

function findEvent(receipt, contract, name) {
  return receipt.logs
    .map((log) => {
      try {
        return contract.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed) => parsed && parsed.name === name);
}

async function main() {
  if (network.name !== "localhost") {
    throw new Error(
      `refusing to run against network "${network.name}" — this script targets the persistent local demo node only (--network localhost). ` +
        "Start it first with: npx hardhat node --hostname 0.0.0.0",
    );
  }

  const { verifyProject } = await import("../verification/engine.js");
  const { DEFAULT_METHODOLOGY_CONFIG } = await import("../verification/config.js");
  const { FIXTURE_PARTIAL_SETTLEMENT } = await import("../verification/fixtures.js");
  const { createMockGuardianAdapter } = await import("../guardian/adapter.js");
  const { prepareSettlementAuthorization } = await import("../integration/restorationSettlementFlow.js");

  const [sponsor, beneficiary, verifierSigner] = await ethers.getSigners();

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();

  const RestorationDeed = await ethers.getContractFactory("RestorationDeed");
  const deed = await RestorationDeed.deploy(await usdc.getAddress());
  const deployTx = deed.deploymentTransaction();
  await deed.waitForDeployment();
  const deployReceipt = await deployTx.wait();

  console.log("MockUSDC deployed at", await usdc.getAddress());
  console.log("RestorationDeed deployed at", await deed.getAddress(), "block", deployReceipt.blockNumber);

  // Real M1 -> M2 -> Arc-payload chain. verifyProject() runs for real here
  // (imported above solely so this log line can report its status; the
  // authoritative call happens inside prepareSettlementAuthorization).
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
    throw new Error(`expected an eligible M4 outcome for this demo fixture, got: ${outcome.reason}`);
  }
  console.log(
    "M1 verification:",
    outcome.verificationResult.verificationStatus,
    "settledQuantity =",
    outcome.verificationResult.settledQuantity,
  );

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
  const createdEvent = findEvent(createReceipt, deed, "DeedCreated");
  const deedId = createdEvent.args.deedId;
  console.log("DeedCreated, deedId =", deedId.toString());

  await (await usdc.mint(sponsor.address, ESCROW_AMOUNT)).wait();
  await (await usdc.connect(sponsor).approve(await deed.getAddress(), ESCROW_AMOUNT)).wait();
  await (await deed.connect(sponsor).fundDeed(deedId)).wait();
  console.log("DeedFunded");

  await (
    await deed.connect(verifierSigner).submitVerification(deedId, toSolidityAuth(outcome.onChainAuthorization))
  ).wait();
  console.log(
    "VerificationSubmitted, settledQuantityScaled =",
    outcome.onChainAuthorization.settledQuantityScaled.toString(),
  );

  await (await deed.settleDeed(deedId)).wait();
  console.log("SettlementExecuted");

  const deploymentInfo = {
    address: await deed.getAddress(),
    startBlock: deployReceipt.blockNumber,
    deedId: deedId.toString(),
    verificationId: outcome.onChainAuthorization.verificationId,
    projectId: outcome.verificationResult.projectId,
    parcelH3Root: outcome.verificationResult.parcelH3Root,
    settledQuantity: outcome.verificationResult.settledQuantity,
  };
  // DEMO_DEPLOYMENT_FILE: docker-compose.yml's shared record location.
  const outPath = process.env.DEMO_DEPLOYMENT_FILE ?? path.join(__dirname, "..", "subgraph", "deployment.local.json");
  fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("Wrote", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
