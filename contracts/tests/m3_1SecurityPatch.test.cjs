"use strict";
/**
 * RestorationDeed — M3.1 security patch tests.
 *
 * Covers the four contract-level tests required by the M3.1 prompt §3.4:
 *   Test A: settleDeed cannot settle a REFUNDED deed.
 *   Test B: a second verification submission cannot bypass the state
 *           machine after a failed (FAILED-status) verification.
 *   Test D: quantityDecimals boundary (valid at MAX, rejected above MAX,
 *           normal settlement still works at the boundary).
 *
 * Test C (forged-but-internally-consistent M1/M2 objects) lives in
 * arc/tests/payload.test.ts, since it is a property of the off-chain
 * `buildVerificationAuthorization` helper, not of the contract — see that
 * file for the actual demonstration and docs/ARC.md for the write-up.
 */

const { expect } = require("chai");
const {
  DEFAULT_ESCROW,
  UNIT_PRICE_USDC,
  buildAuth,
  createDefaultDeed,
  deployFixture,
} = require("./helpers.cjs");

describe("RestorationDeed — M3.1 security patch", function () {
  describe("Test A — settleDeed cannot settle a REFUNDED deed", function () {
    it("rejects settlement of a deed refunded from FUNDED", async function () {
      const ctx = await deployFixture();
      const { deedId } = await createDefaultDeed(ctx);
      await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);
      await ctx.deed.connect(ctx.sponsor).refundDeed(deedId);

      expect((await ctx.deed.getDeed(deedId)).status).to.equal(6n); // REFUNDED
      await expect(ctx.deed.settleDeed(deedId)).to.be.revertedWithCustomError(ctx.deed, "WrongStatus");
    });

    it("rejects settlement of a deed refunded from FAILED", async function () {
      const ctx = await deployFixture();
      const { deedId } = await createDefaultDeed(ctx);
      await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);
      await ctx.deed.connect(ctx.verifier).submitVerification(
        deedId,
        buildAuth({ financiallyEligible: false, settledQuantityScaled: 0n }),
      );
      await ctx.deed.connect(ctx.sponsor).refundDeed(deedId);

      expect((await ctx.deed.getDeed(deedId)).status).to.equal(6n); // REFUNDED
      await expect(ctx.deed.settleDeed(deedId)).to.be.revertedWithCustomError(ctx.deed, "WrongStatus");
    });

    it("a REFUNDED deed also cannot be refunded again", async function () {
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

  describe("Test B — a second submission cannot bypass the state machine after FAILED", function () {
    it("rejects a second submitVerification call once a deed is FAILED (same guard as VERIFIED)", async function () {
      const ctx = await deployFixture();
      const { deedId } = await createDefaultDeed(ctx);
      await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);

      const firstAuth = buildAuth({ financiallyEligible: false, settledQuantityScaled: 0n });
      await ctx.deed.connect(ctx.verifier).submitVerification(deedId, firstAuth);
      expect((await ctx.deed.getDeed(deedId)).status).to.equal(4n); // FAILED

      const secondAuth = buildAuth({ financiallyEligible: true }); // a fresh, distinct verificationId
      await expect(
        ctx.deed.connect(ctx.verifier).submitVerification(deedId, secondAuth),
      ).to.be.revertedWithCustomError(ctx.deed, "WrongStatus");

      // The deed must remain FAILED, not silently flip to VERIFIED.
      expect((await ctx.deed.getDeed(deedId)).status).to.equal(4n);
      expect((await ctx.deed.getDeed(deedId)).settlementAmount).to.equal(0n);
    });

    it("a FAILED deed cannot be settled even if a later (rejected) attempt carried a financiallyEligible=true payload", async function () {
      const ctx = await deployFixture();
      const { deedId } = await createDefaultDeed(ctx);
      await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);
      await ctx.deed.connect(ctx.verifier).submitVerification(
        deedId,
        buildAuth({ financiallyEligible: false, settledQuantityScaled: 0n }),
      );
      await expect(
        ctx.deed.connect(ctx.verifier).submitVerification(deedId, buildAuth({ financiallyEligible: true })),
      ).to.be.revertedWithCustomError(ctx.deed, "WrongStatus");
      await expect(ctx.deed.settleDeed(deedId)).to.be.revertedWithCustomError(ctx.deed, "WrongStatus");
    });
  });

  describe("Test D — quantityDecimals boundary", function () {
    it("accepts quantityDecimals exactly at the MAX_QUANTITY_DECIMALS boundary (18)", async function () {
      const ctx = await deployFixture();
      const max = await ctx.deed.MAX_QUANTITY_DECIMALS();
      expect(max).to.equal(18n);
      await expect(createDefaultDeed(ctx, { quantityDecimals: 18 })).to.not.be.reverted;
    });

    it("rejects quantityDecimals one above the boundary (19)", async function () {
      const ctx = await deployFixture();
      await expect(createDefaultDeed(ctx, { quantityDecimals: 19 })).to.be.revertedWithCustomError(
        ctx.deed,
        "InvalidDeedParameters",
      );
    });

    it("normal settlement remains fully functional at the boundary value", async function () {
      const ctx = await deployFixture();
      // At 18 decimals, choose a unit price and quantity that keep the
      // settlement amount well within the escrow and within uint256 range.
      const { deedId } = await createDefaultDeed(ctx, {
        quantityDecimals: 18,
        unitPriceUSDC: 1_000_000n, // 1.00 USDC (token is still 6-decimal MockUSDC)
        escrowAmount: DEFAULT_ESCROW,
      });
      await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);

      // 5 whole units at 18-decimal scale = 5 * 10^18.
      const fiveUnitsScaled = 5_000_000_000_000_000_000n;
      await ctx.deed.connect(ctx.verifier).submitVerification(
        deedId,
        buildAuth({ settledQuantityScaled: fiveUnitsScaled }),
      );

      const onChain = await ctx.deed.getDeed(deedId);
      expect(onChain.status).to.equal(2n); // VERIFIED
      expect(onChain.settlementAmount).to.equal(5_000_000n); // 5.00 USDC (6-decimal token)

      await expect(ctx.deed.settleDeed(deedId)).to.not.be.reverted;
      expect((await ctx.deed.getDeed(deedId)).status).to.equal(3n); // SETTLED
      expect(await ctx.usdc.balanceOf(ctx.beneficiary.address)).to.equal(5_000_000n);
    });

    it("normal (default, 6-decimal) settlement is unaffected by the new validation", async function () {
      const ctx = await deployFixture();
      const { deedId } = await createDefaultDeed(ctx); // default quantityDecimals = 6
      await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);
      await ctx.deed.connect(ctx.verifier).submitVerification(deedId, buildAuth());
      await expect(ctx.deed.settleDeed(deedId)).to.not.be.reverted;
      expect((await ctx.deed.getDeed(deedId)).status).to.equal(3n); // SETTLED
    });
  });
});
