"use strict";
/**
 * Ecorestore Network — Hardhat test helpers (M3)
 *
 * Shared deployment and payload-construction helpers for
 * RestorationDeed.sol's test suite. CommonJS by convention (matching
 * hardhat.config.cjs) — see docs/ARC.md "Local testing approach" for why
 * contracts/tests/ is a separate CJS/Mocha world from verification/ and
 * guardian/'s ESM/vitest world.
 */

const { ethers } = require("hardhat");

const QUANTITY_DECIMALS = 6;
const UNIT_PRICE_USDC = 1_000_000n; // 1.00 USDC (6 decimals) per 1.0 whole settled unit — a simple, explicit demo pricing convention, not a real market price. See docs/ARC.md.

async function deployFixture() {
  const [sponsor, beneficiary, verifier, other] = await ethers.getSigners();

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();

  const RestorationDeed = await ethers.getContractFactory("RestorationDeed");
  const deed = await RestorationDeed.deploy(await usdc.getAddress());
  await deed.waitForDeployment();

  // Fund the sponsor with plenty of mock USDC and pre-approve the contract,
  // since almost every test needs a funded deed as a starting point.
  const sponsorBalance = 1_000_000_000_000n; // 1,000,000.00 USDC
  await usdc.mint(sponsor.address, sponsorBalance);
  await usdc.connect(sponsor).approve(await deed.getAddress(), sponsorBalance);

  return { usdc, deed, sponsor, beneficiary, verifier, other, sponsorBalance };
}

function hashId(value) {
  return ethers.keccak256(ethers.toUtf8Bytes(value));
}

const PROJECT_ID = hashId("kootenay-riparian-restoration-partial");
const PARCEL_H3_ROOT = hashId("h3sim_deadbeef");
const METHODOLOGY_VERSION = hashId("ecorestore-m1-v0.1");
const OTHER_METHODOLOGY_VERSION = hashId("ecorestore-m1-v0.1-strict-demo");

const DEFAULT_ESCROW = 100_000_000n; // 100.00 USDC

/** Creates a deed with sane defaults; individual params can be overridden per test. */
async function createDefaultDeed(ctx, overrides = {}) {
  const { deed, sponsor, beneficiary, verifier } = ctx;
  const params = {
    projectId: PROJECT_ID,
    parcelH3Root: PARCEL_H3_ROOT,
    methodologyVersion: METHODOLOGY_VERSION,
    beneficiary: beneficiary.address,
    authorizedVerifier: verifier.address,
    escrowAmount: DEFAULT_ESCROW,
    unitPriceUSDC: UNIT_PRICE_USDC,
    quantityDecimals: QUANTITY_DECIMALS,
    ...overrides,
  };

  const tx = await deed
    .connect(sponsor)
    .createDeed(
      params.projectId,
      params.parcelH3Root,
      params.methodologyVersion,
      params.beneficiary,
      params.authorizedVerifier,
      params.escrowAmount,
      params.unitPriceUSDC,
      params.quantityDecimals,
    );
  const receipt = await tx.wait();
  const event = receipt.logs
    .map((log) => {
      try {
        return deed.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed) => parsed && parsed.name === "DeedCreated");
  const deedId = event.args.deedId;
  return { deedId, params };
}

/** Builds a VerificationAuthorization struct for submitVerification, with sane defaults. */
function buildAuth(overrides = {}) {
  return {
    verificationId: hashId(`verification-${Math.random()}`),
    projectId: PROJECT_ID,
    parcelH3Root: PARCEL_H3_ROOT,
    methodologyVersion: METHODOLOGY_VERSION,
    evidenceHash: hashId("sha256:evidence"),
    settledQuantityScaled: 18_181_500n, // 18.1815 units at 6-decimal scale, matching verification/fixtures.ts's primary demo case
    financiallyEligible: true,
    ...overrides,
  };
}

module.exports = {
  QUANTITY_DECIMALS,
  UNIT_PRICE_USDC,
  DEFAULT_ESCROW,
  PROJECT_ID,
  PARCEL_H3_ROOT,
  METHODOLOGY_VERSION,
  OTHER_METHODOLOGY_VERSION,
  deployFixture,
  hashId,
  createDefaultDeed,
  buildAuth,
};
