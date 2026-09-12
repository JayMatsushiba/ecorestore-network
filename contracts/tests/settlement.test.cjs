"use strict";

const { expect } = require("chai");
const { DEFAULT_ESCROW, UNIT_PRICE_USDC, buildAuth, createDefaultDeed, deployFixture } = require("./helpers.cjs");

async function verifiedDeed(quantityOverride) {
  const ctx = await deployFixture();
  const created = await createDefaultDeed(ctx);
  await ctx.deed.connect(ctx.sponsor).fundDeed(created.deedId);
  const auth = buildAuth(quantityOverride ? { settledQuantityScaled: quantityOverride } : {});
  await ctx.deed.connect(ctx.verifier).submitVerification(created.deedId, auth);
  return { ctx, ...created, auth };
}

describe("RestorationDeed — settlement", function () {
  it("pays the beneficiary the exact computed settlement amount and returns the remainder to the sponsor", async function () {
    // 5.00 whole units settled at 1.00 USDC/unit against a 100.00 USDC escrow
    // => 5.00 USDC to beneficiary, 95.00 USDC back to sponsor.
    const quantityScaled = 5_000_000n; // 5.0 units at 6-decimal scale
    const { ctx, deedId, params, auth } = await verifiedDeed(quantityScaled);

    const expectedSettlement = 5_000_000n; // 5.00 USDC (6 decimals)
    const expectedRemainder = params.escrowAmount - expectedSettlement;

    const sponsorBefore = await ctx.usdc.balanceOf(ctx.sponsor.address);
    const beneficiaryBefore = await ctx.usdc.balanceOf(ctx.beneficiary.address);
    const contractAddress = await ctx.deed.getAddress();

    await expect(ctx.deed.settleDeed(deedId))
      .to.emit(ctx.deed, "SettlementExecuted")
      .withArgs(deedId, auth.verificationId, ctx.beneficiary.address, expectedSettlement, expectedRemainder);

    expect(await ctx.usdc.balanceOf(ctx.beneficiary.address)).to.equal(beneficiaryBefore + expectedSettlement);
    expect(await ctx.usdc.balanceOf(ctx.sponsor.address)).to.equal(sponsorBefore + expectedRemainder);
    expect(await ctx.usdc.balanceOf(contractAddress)).to.equal(0n); // no trapped funds

    const onChain = await ctx.deed.getDeed(deedId);
    expect(onChain.status).to.equal(3n); // SETTLED
    expect(onChain.releasedAmount).to.equal(expectedSettlement);
  });

  it("pays the full escrow to the beneficiary when the settled quantity exactly exhausts it (no remainder)", async function () {
    // settledQuantityScaled chosen so settlementAmount == escrowAmount exactly.
    const { ctx, deedId, params } = await verifiedDeed(DEFAULT_ESCROW); // unit price 1.0 => amount == escrow
    const contractAddress = await ctx.deed.getAddress();

    await expect(ctx.deed.settleDeed(deedId))
      .to.emit(ctx.deed, "SettlementExecuted")
      .withArgs(deedId, (await ctx.deed.getDeed(deedId)).verificationId, ctx.beneficiary.address, params.escrowAmount, 0n);

    expect(await ctx.usdc.balanceOf(contractAddress)).to.equal(0n);
  });

  it("is permissionless: any address can trigger settlement of a VERIFIED deed", async function () {
    const { ctx, deedId } = await verifiedDeed(1_000_000n);
    await expect(ctx.deed.connect(ctx.other).settleDeed(deedId)).to.not.be.reverted;
    expect((await ctx.deed.getDeed(deedId)).status).to.equal(3n);
  });

  it("rejects settlement of a deed that is not VERIFIED (e.g. still FUNDED)", async function () {
    const ctx = await deployFixture();
    const { deedId } = await createDefaultDeed(ctx);
    await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);
    await expect(ctx.deed.settleDeed(deedId)).to.be.revertedWithCustomError(ctx.deed, "WrongStatus");
  });

  it("rejects settlement of a deed that is CREATED (never funded)", async function () {
    const ctx = await deployFixture();
    const { deedId } = await createDefaultDeed(ctx);
    await expect(ctx.deed.settleDeed(deedId)).to.be.revertedWithCustomError(ctx.deed, "WrongStatus");
  });

  it("rejects double settlement", async function () {
    const { ctx, deedId } = await verifiedDeed(1_000_000n);
    await ctx.deed.settleDeed(deedId);
    await expect(ctx.deed.settleDeed(deedId)).to.be.revertedWithCustomError(ctx.deed, "WrongStatus");
  });

  it("rejects settlement of a FAILED deed", async function () {
    const ctx = await deployFixture();
    const { deedId } = await createDefaultDeed(ctx);
    await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);
    await ctx.deed.connect(ctx.verifier).submitVerification(
      deedId,
      buildAuth({ financiallyEligible: false, settledQuantityScaled: 0n }),
    );
    await expect(ctx.deed.settleDeed(deedId)).to.be.revertedWithCustomError(ctx.deed, "WrongStatus");
  });

  it("never releases more than the deed's escrowed amount, across settlement + remainder combined", async function () {
    const { ctx, deedId, params } = await verifiedDeed(3_000_000n);
    const beneficiaryBefore = await ctx.usdc.balanceOf(ctx.beneficiary.address);
    const sponsorBefore = await ctx.usdc.balanceOf(ctx.sponsor.address);

    await ctx.deed.settleDeed(deedId);

    const beneficiaryGain = (await ctx.usdc.balanceOf(ctx.beneficiary.address)) - beneficiaryBefore;
    const sponsorGain = (await ctx.usdc.balanceOf(ctx.sponsor.address)) - sponsorBefore;
    expect(beneficiaryGain + sponsorGain).to.equal(params.escrowAmount);
  });

  it("refund is unavailable once a deed is VERIFIED (must settle, not refund, at that point)", async function () {
    const { ctx, deedId } = await verifiedDeed(1_000_000n);
    await expect(ctx.deed.connect(ctx.sponsor).refundDeed(deedId)).to.be.revertedWithCustomError(
      ctx.deed,
      "WrongStatus",
    );
  });

  it("refund is unavailable once a deed is SETTLED", async function () {
    const { ctx, deedId } = await verifiedDeed(1_000_000n);
    await ctx.deed.settleDeed(deedId);
    await expect(ctx.deed.connect(ctx.sponsor).refundDeed(deedId)).to.be.revertedWithCustomError(
      ctx.deed,
      "WrongStatus",
    );
  });
});
