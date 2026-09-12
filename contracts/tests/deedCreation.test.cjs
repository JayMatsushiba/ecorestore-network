"use strict";

const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  DEFAULT_ESCROW,
  METHODOLOGY_VERSION,
  PARCEL_H3_ROOT,
  PROJECT_ID,
  UNIT_PRICE_USDC,
  createDefaultDeed,
  deployFixture,
} = require("./helpers.cjs");

describe("RestorationDeed — creation & cancellation", function () {
  describe("valid creation", function () {
    it("creates a deed with the expected initial state (CREATED)", async function () {
      const ctx = await deployFixture();
      const { deedId, params } = await createDefaultDeed(ctx);

      const onChain = await ctx.deed.getDeed(deedId);
      expect(onChain.projectId).to.equal(params.projectId);
      expect(onChain.parcelH3Root).to.equal(params.parcelH3Root);
      expect(onChain.methodologyVersion).to.equal(params.methodologyVersion);
      expect(onChain.sponsor).to.equal(ctx.sponsor.address);
      expect(onChain.beneficiary).to.equal(params.beneficiary);
      expect(onChain.authorizedVerifier).to.equal(params.authorizedVerifier);
      expect(onChain.escrowAmount).to.equal(params.escrowAmount);
      expect(onChain.unitPriceUSDC).to.equal(params.unitPriceUSDC);
      expect(onChain.quantityDecimals).to.equal(params.quantityDecimals);
      expect(onChain.fundedAmount).to.equal(0n);
      expect(onChain.status).to.equal(0n); // CREATED
    });

    it("assigns sequential deed ids and emits DeedCreated", async function () {
      const ctx = await deployFixture();
      const first = await createDefaultDeed(ctx);
      const second = await createDefaultDeed(ctx);
      expect(second.deedId).to.equal(first.deedId + 1n);

      await expect(
        ctx.deed
          .connect(ctx.sponsor)
          .createDeed(
            PROJECT_ID,
            PARCEL_H3_ROOT,
            METHODOLOGY_VERSION,
            ctx.beneficiary.address,
            ctx.verifier.address,
            DEFAULT_ESCROW,
            UNIT_PRICE_USDC,
            6,
          ),
      )
        .to.emit(ctx.deed, "DeedCreated")
        .withArgs(
          second.deedId + 1n,
          PROJECT_ID,
          PARCEL_H3_ROOT,
          ctx.sponsor.address,
          ctx.beneficiary.address,
          ctx.verifier.address,
          DEFAULT_ESCROW,
          UNIT_PRICE_USDC,
          6,
        );
    });

    it("records whichever address called createDeed as the sponsor, not a supplied parameter", async function () {
      const ctx = await deployFixture();
      const { deedId } = await createDefaultDeed(ctx);
      const onChain = await ctx.deed.getDeed(deedId);
      expect(onChain.sponsor).to.equal(ctx.sponsor.address);
    });
  });

  describe("invalid parameters are rejected", function () {
    it("rejects a zero projectId", async function () {
      const ctx = await deployFixture();
      await expect(createDefaultDeed(ctx, { projectId: ethers.ZeroHash })).to.be.revertedWithCustomError(
        ctx.deed,
        "InvalidDeedParameters",
      );
    });

    it("rejects a zero parcelH3Root", async function () {
      const ctx = await deployFixture();
      await expect(createDefaultDeed(ctx, { parcelH3Root: ethers.ZeroHash })).to.be.revertedWithCustomError(
        ctx.deed,
        "InvalidDeedParameters",
      );
    });

    it("rejects a zero methodologyVersion", async function () {
      const ctx = await deployFixture();
      await expect(createDefaultDeed(ctx, { methodologyVersion: ethers.ZeroHash })).to.be.revertedWithCustomError(
        ctx.deed,
        "InvalidDeedParameters",
      );
    });

    it("rejects a zero-address beneficiary", async function () {
      const ctx = await deployFixture();
      await expect(createDefaultDeed(ctx, { beneficiary: ethers.ZeroAddress })).to.be.revertedWithCustomError(
        ctx.deed,
        "InvalidDeedParameters",
      );
    });

    it("rejects a zero-address authorizedVerifier", async function () {
      const ctx = await deployFixture();
      await expect(createDefaultDeed(ctx, { authorizedVerifier: ethers.ZeroAddress })).to.be.revertedWithCustomError(
        ctx.deed,
        "InvalidDeedParameters",
      );
    });

    it("rejects a zero escrowAmount", async function () {
      const ctx = await deployFixture();
      await expect(createDefaultDeed(ctx, { escrowAmount: 0n })).to.be.revertedWithCustomError(
        ctx.deed,
        "InvalidDeedParameters",
      );
    });

    it("rejects a zero unitPriceUSDC", async function () {
      const ctx = await deployFixture();
      await expect(createDefaultDeed(ctx, { unitPriceUSDC: 0n })).to.be.revertedWithCustomError(
        ctx.deed,
        "InvalidDeedParameters",
      );
    });

    it("rejects a zero token address at deployment", async function () {
      const RestorationDeed = await ethers.getContractFactory("RestorationDeed");
      await expect(RestorationDeed.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        RestorationDeed,
        "InvalidDeedParameters",
      );
    });
  });

  describe("cancellation", function () {
    it("lets the sponsor cancel an unfunded (CREATED) deed", async function () {
      const ctx = await deployFixture();
      const { deedId } = await createDefaultDeed(ctx);

      await expect(ctx.deed.connect(ctx.sponsor).cancelDeed(deedId)).to.emit(ctx.deed, "DeedCancelled").withArgs(deedId);
      expect(await ctx.deed.getDeedStatus(deedId)).to.equal(5n); // CANCELLED
    });

    it("rejects cancellation from a non-sponsor", async function () {
      const ctx = await deployFixture();
      const { deedId } = await createDefaultDeed(ctx);
      await expect(ctx.deed.connect(ctx.other).cancelDeed(deedId)).to.be.revertedWithCustomError(
        ctx.deed,
        "NotSponsor",
      );
    });

    it("rejects cancelling a deed that is not CREATED (e.g. already FUNDED)", async function () {
      const ctx = await deployFixture();
      const { deedId } = await createDefaultDeed(ctx);
      await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);
      await expect(ctx.deed.connect(ctx.sponsor).cancelDeed(deedId)).to.be.revertedWithCustomError(
        ctx.deed,
        "WrongStatus",
      );
    });

    it("rejects cancelling the same deed twice", async function () {
      const ctx = await deployFixture();
      const { deedId } = await createDefaultDeed(ctx);
      await ctx.deed.connect(ctx.sponsor).cancelDeed(deedId);
      await expect(ctx.deed.connect(ctx.sponsor).cancelDeed(deedId)).to.be.revertedWithCustomError(
        ctx.deed,
        "WrongStatus",
      );
    });
  });

  describe("nonexistent deeds", function () {
    it("reverts reading a deed that was never created", async function () {
      const ctx = await deployFixture();
      await expect(ctx.deed.getDeed(999n)).to.be.revertedWithCustomError(ctx.deed, "DeedDoesNotExist");
    });

    it("reverts funding a deed that was never created", async function () {
      const ctx = await deployFixture();
      await expect(ctx.deed.connect(ctx.sponsor).fundDeed(999n)).to.be.revertedWithCustomError(
        ctx.deed,
        "DeedDoesNotExist",
      );
    });
  });
});
