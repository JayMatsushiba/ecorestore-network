"use strict";

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { DEFAULT_ESCROW, createDefaultDeed, deployFixture } = require("./helpers.cjs");

describe("RestorationDeed — funding & refunds", function () {
  it("lets the sponsor fund a CREATED deed, transferring exactly escrowAmount", async function () {
    const ctx = await deployFixture();
    const { deedId, params } = await createDefaultDeed(ctx);

    const contractAddress = await ctx.deed.getAddress();
    const balanceBefore = await ctx.usdc.balanceOf(ctx.sponsor.address);

    await expect(ctx.deed.connect(ctx.sponsor).fundDeed(deedId))
      .to.emit(ctx.deed, "DeedFunded")
      .withArgs(deedId, ctx.sponsor.address, params.escrowAmount);

    expect(await ctx.usdc.balanceOf(contractAddress)).to.equal(params.escrowAmount);
    expect(await ctx.usdc.balanceOf(ctx.sponsor.address)).to.equal(balanceBefore - params.escrowAmount);

    const onChain = await ctx.deed.getDeed(deedId);
    expect(onChain.fundedAmount).to.equal(params.escrowAmount);
    expect(onChain.status).to.equal(1n); // FUNDED
  });

  it("rejects funding from a non-sponsor", async function () {
    const ctx = await deployFixture();
    const { deedId } = await createDefaultDeed(ctx);
    await ctx.usdc.mint(ctx.other.address, DEFAULT_ESCROW);
    await ctx.usdc.connect(ctx.other).approve(await ctx.deed.getAddress(), DEFAULT_ESCROW);
    await expect(ctx.deed.connect(ctx.other).fundDeed(deedId)).to.be.revertedWithCustomError(ctx.deed, "NotSponsor");
  });

  it("rejects funding a deed that is not CREATED (e.g. already FUNDED)", async function () {
    const ctx = await deployFixture();
    const { deedId } = await createDefaultDeed(ctx);
    await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);
    await expect(ctx.deed.connect(ctx.sponsor).fundDeed(deedId)).to.be.revertedWithCustomError(ctx.deed, "WrongStatus");
  });

  it("reverts funding without a sufficient prior ERC-20 approval", async function () {
    const ctx = await deployFixture();
    const { deedId } = await createDefaultDeed(ctx);
    // Reset approval to zero so the transferFrom inside fundDeed must fail.
    await ctx.usdc.connect(ctx.sponsor).approve(await ctx.deed.getAddress(), 0n);
    await expect(ctx.deed.connect(ctx.sponsor).fundDeed(deedId)).to.be.reverted;
  });

  it("reverts funding if the sponsor does not hold enough of the token", async function () {
    const ctx = await deployFixture();
    const { deedId } = await createDefaultDeed(ctx, { escrowAmount: ctx.sponsorBalance + 1n });
    await ctx.usdc.connect(ctx.sponsor).approve(await ctx.deed.getAddress(), ctx.sponsorBalance + 1n);
    await expect(ctx.deed.connect(ctx.sponsor).fundDeed(deedId)).to.be.reverted;
  });

  describe("refunds", function () {
    it("lets the sponsor reclaim escrow from a FUNDED deed that has no verification yet", async function () {
      const ctx = await deployFixture();
      const { deedId, params } = await createDefaultDeed(ctx);
      await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);

      const balanceBefore = await ctx.usdc.balanceOf(ctx.sponsor.address);
      await expect(ctx.deed.connect(ctx.sponsor).refundDeed(deedId))
        .to.emit(ctx.deed, "RefundExecuted")
        .withArgs(deedId, ctx.sponsor.address, params.escrowAmount);

      expect(await ctx.usdc.balanceOf(ctx.sponsor.address)).to.equal(balanceBefore + params.escrowAmount);
      expect(await ctx.usdc.balanceOf(await ctx.deed.getAddress())).to.equal(0n);

      const onChain = await ctx.deed.getDeed(deedId);
      expect(onChain.status).to.equal(6n); // REFUNDED
    });

    it("rejects refunding a CREATED (never-funded) deed", async function () {
      const ctx = await deployFixture();
      const { deedId } = await createDefaultDeed(ctx);
      await expect(ctx.deed.connect(ctx.sponsor).refundDeed(deedId)).to.be.revertedWithCustomError(
        ctx.deed,
        "WrongStatus",
      );
    });

    it("rejects refund from a non-sponsor", async function () {
      const ctx = await deployFixture();
      const { deedId } = await createDefaultDeed(ctx);
      await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);
      await expect(ctx.deed.connect(ctx.other).refundDeed(deedId)).to.be.revertedWithCustomError(
        ctx.deed,
        "NotSponsor",
      );
    });

    it("rejects refunding the same deed twice", async function () {
      const ctx = await deployFixture();
      const { deedId } = await createDefaultDeed(ctx);
      await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);
      await ctx.deed.connect(ctx.sponsor).refundDeed(deedId);
      await expect(ctx.deed.connect(ctx.sponsor).refundDeed(deedId)).to.be.revertedWithCustomError(
        ctx.deed,
        "WrongStatus",
      );
    });
  });
});
