"use strict";

const { expect } = require("chai");
const {
  DEFAULT_ESCROW,
  METHODOLOGY_VERSION,
  OTHER_METHODOLOGY_VERSION,
  PARCEL_H3_ROOT,
  PROJECT_ID,
  UNIT_PRICE_USDC,
  buildAuth,
  createDefaultDeed,
  deployFixture,
  hashId,
} = require("./helpers.cjs");
const { ethers } = require("hardhat");

async function fundedDeed(overrides = {}) {
  const ctx = await deployFixture();
  const created = await createDefaultDeed(ctx, overrides);
  await ctx.deed.connect(ctx.sponsor).fundDeed(created.deedId);
  return { ctx, ...created };
}

describe("RestorationDeed — verification submission", function () {
  describe("authorization", function () {
    it("lets the deed's authorizedVerifier submit a verification", async function () {
      const { ctx, deedId } = await fundedDeed();
      const auth = buildAuth();
      // UNIT_PRICE_USDC is exactly 1_000_000n (1.00 USDC per whole unit) at
      // 6-decimal scale, so settlementAmount == settledQuantityScaled here.
      const expectedSettlementAmount = auth.settledQuantityScaled;
      await expect(ctx.deed.connect(ctx.verifier).submitVerification(deedId, auth))
        .to.emit(ctx.deed, "VerificationSubmitted")
        .withArgs(deedId, auth.verificationId, true, auth.settledQuantityScaled, expectedSettlementAmount);
    });

    it("rejects submission from an address that is not this deed's authorizedVerifier", async function () {
      const { ctx, deedId } = await fundedDeed();
      const auth = buildAuth();
      await expect(ctx.deed.connect(ctx.other).submitVerification(deedId, auth)).to.be.revertedWithCustomError(
        ctx.deed,
        "NotAuthorizedVerifier",
      );
    });

    it("rejects submission from the sponsor itself (sponsor != verifier by default)", async function () {
      const { ctx, deedId } = await fundedDeed();
      const auth = buildAuth();
      await expect(ctx.deed.connect(ctx.sponsor).submitVerification(deedId, auth)).to.be.revertedWithCustomError(
        ctx.deed,
        "NotAuthorizedVerifier",
      );
    });

    it("rejects submission from the beneficiary itself", async function () {
      const { ctx, deedId } = await fundedDeed();
      const auth = buildAuth();
      await expect(ctx.deed.connect(ctx.beneficiary).submitVerification(deedId, auth)).to.be.revertedWithCustomError(
        ctx.deed,
        "NotAuthorizedVerifier",
      );
    });

    it("a verifier authorized on one deed cannot submit for a different deed with a different verifier", async function () {
      const ctx = await deployFixture();
      const deedA = await createDefaultDeed(ctx, { authorizedVerifier: ctx.verifier.address });
      const deedB = await createDefaultDeed(ctx, { authorizedVerifier: ctx.other.address });
      await ctx.deed.connect(ctx.sponsor).fundDeed(deedA.deedId);
      await ctx.deed.connect(ctx.sponsor).fundDeed(deedB.deedId);

      const auth = buildAuth();
      await expect(ctx.deed.connect(ctx.verifier).submitVerification(deedB.deedId, auth)).to.be.revertedWithCustomError(
        ctx.deed,
        "NotAuthorizedVerifier",
      );
    });
  });

  describe("deed state requirement", function () {
    it("rejects submission against a deed that is not FUNDED (e.g. still CREATED)", async function () {
      const ctx = await deployFixture();
      const { deedId } = await createDefaultDeed(ctx);
      const auth = buildAuth();
      await expect(ctx.deed.connect(ctx.verifier).submitVerification(deedId, auth)).to.be.revertedWithCustomError(
        ctx.deed,
        "WrongStatus",
      );
    });

    it("rejects a second submission against an already-VERIFIED deed", async function () {
      const { ctx, deedId } = await fundedDeed();
      await ctx.deed.connect(ctx.verifier).submitVerification(deedId, buildAuth());
      const secondAuth = buildAuth();
      await expect(ctx.deed.connect(ctx.verifier).submitVerification(deedId, secondAuth)).to.be.revertedWithCustomError(
        ctx.deed,
        "WrongStatus",
      );
    });
  });

  describe("identity binding (Invariant 9 — methodology/project/parcel)", function () {
    it("rejects a verification whose projectId does not match the deed", async function () {
      const { ctx, deedId } = await fundedDeed();
      const auth = buildAuth({ projectId: hashId("a-different-project") });
      await expect(ctx.deed.connect(ctx.verifier).submitVerification(deedId, auth)).to.be.revertedWithCustomError(
        ctx.deed,
        "VerificationIdentityMismatch",
      );
    });

    it("rejects a verification whose parcelH3Root does not match the deed", async function () {
      const { ctx, deedId } = await fundedDeed();
      const auth = buildAuth({ parcelH3Root: hashId("a-different-parcel") });
      await expect(ctx.deed.connect(ctx.verifier).submitVerification(deedId, auth)).to.be.revertedWithCustomError(
        ctx.deed,
        "VerificationIdentityMismatch",
      );
    });

    it("rejects a methodology-version mismatch", async function () {
      const { ctx, deedId } = await fundedDeed();
      const auth = buildAuth({ methodologyVersion: OTHER_METHODOLOGY_VERSION });
      await expect(ctx.deed.connect(ctx.verifier).submitVerification(deedId, auth)).to.be.revertedWithCustomError(
        ctx.deed,
        "VerificationIdentityMismatch",
      );
    });

    it("rejects a missing (zero) evidenceHash", async function () {
      const { ctx, deedId } = await fundedDeed();
      const auth = buildAuth({ evidenceHash: ethers.ZeroHash });
      await expect(ctx.deed.connect(ctx.verifier).submitVerification(deedId, auth)).to.be.revertedWithCustomError(
        ctx.deed,
        "VerificationIdentityMismatch",
      );
    });

    it("preserves methodology identity: two deeds under different methodology versions each require their own", async function () {
      const ctx = await deployFixture();
      const deedA = await createDefaultDeed(ctx, { methodologyVersion: METHODOLOGY_VERSION });
      const deedB = await createDefaultDeed(ctx, {
        methodologyVersion: OTHER_METHODOLOGY_VERSION,
        authorizedVerifier: ctx.verifier.address,
      });
      await ctx.deed.connect(ctx.sponsor).fundDeed(deedA.deedId);
      await ctx.deed.connect(ctx.sponsor).fundDeed(deedB.deedId);

      // An auth built for methodology A must not settle deed B.
      const authForA = buildAuth({ methodologyVersion: METHODOLOGY_VERSION });
      await expect(
        ctx.deed.connect(ctx.verifier).submitVerification(deedB.deedId, authForA),
      ).to.be.revertedWithCustomError(ctx.deed, "VerificationIdentityMismatch");
    });
  });

  describe("financially ineligible verification (INSUFFICIENT_EVIDENCE / INVALID_RESULT semantics)", function () {
    it("moves the deed to FAILED without recording a settlement amount or moving funds", async function () {
      const { ctx, deedId } = await fundedDeed();
      const auth = buildAuth({ financiallyEligible: false, settledQuantityScaled: 0n });

      await expect(ctx.deed.connect(ctx.verifier).submitVerification(deedId, auth))
        .to.emit(ctx.deed, "VerificationSubmitted")
        .withArgs(deedId, auth.verificationId, false, 0n, 0n);

      const onChain = await ctx.deed.getDeed(deedId);
      expect(onChain.status).to.equal(4n); // FAILED
      expect(onChain.settlementAmount).to.equal(0n);
      expect(onChain.settledQuantityScaled).to.equal(0n);
      expect(await ctx.usdc.balanceOf(await ctx.deed.getAddress())).to.equal(onChain.fundedAmount);
    });

    it("still consumes the verificationId even though the deed did not settle (cannot be replayed)", async function () {
      const { ctx, deedId } = await fundedDeed();
      const auth = buildAuth({ financiallyEligible: false, settledQuantityScaled: 0n });
      await ctx.deed.connect(ctx.verifier).submitVerification(deedId, auth);
      expect(await ctx.deed.consumedVerificationIds(auth.verificationId)).to.equal(true);
    });

    it("a FAILED deed can be refunded by the sponsor", async function () {
      const { ctx, deedId, params } = await fundedDeed();
      const auth = buildAuth({ financiallyEligible: false, settledQuantityScaled: 0n });
      await ctx.deed.connect(ctx.verifier).submitVerification(deedId, auth);

      await expect(ctx.deed.connect(ctx.sponsor).refundDeed(deedId))
        .to.emit(ctx.deed, "RefundExecuted")
        .withArgs(deedId, ctx.sponsor.address, params.escrowAmount);
    });

    it("does not allow settleDeed to be called on a FAILED deed", async function () {
      const { ctx, deedId } = await fundedDeed();
      const auth = buildAuth({ financiallyEligible: false, settledQuantityScaled: 0n });
      await ctx.deed.connect(ctx.verifier).submitVerification(deedId, auth);
      await expect(ctx.deed.settleDeed(deedId)).to.be.revertedWithCustomError(ctx.deed, "WrongStatus");
    });

    it("rejects a financiallyEligible=true submission with settledQuantityScaled = 0 (nonsensical PASS)", async function () {
      const { ctx, deedId } = await fundedDeed();
      const auth = buildAuth({ financiallyEligible: true, settledQuantityScaled: 0n });
      await expect(ctx.deed.connect(ctx.verifier).submitVerification(deedId, auth)).to.be.revertedWithCustomError(
        ctx.deed,
        "ZeroSettledQuantity",
      );
    });
  });

  describe("replay protection (Invariant 5 / M3 prompt §14)", function () {
    it("rejects reusing the same verificationId on a second deed", async function () {
      const ctx = await deployFixture();
      const deedA = await createDefaultDeed(ctx);
      const deedB = await createDefaultDeed(ctx);
      await ctx.deed.connect(ctx.sponsor).fundDeed(deedA.deedId);
      await ctx.deed.connect(ctx.sponsor).fundDeed(deedB.deedId);

      const auth = buildAuth();
      await ctx.deed.connect(ctx.verifier).submitVerification(deedA.deedId, auth);

      await expect(ctx.deed.connect(ctx.verifier).submitVerification(deedB.deedId, auth)).to.be.revertedWithCustomError(
        ctx.deed,
        "VerificationAlreadyConsumed",
      );
    });

    it("rejects resubmitting the exact same verification+deed pair", async function () {
      const { ctx, deedId } = await fundedDeed();
      const auth = buildAuth();
      await ctx.deed.connect(ctx.verifier).submitVerification(deedId, auth);
      // Deed is now VERIFIED, so this actually reverts as WrongStatus first —
      // demonstrated separately below with a deed that is still FUNDED.
      await expect(ctx.deed.connect(ctx.verifier).submitVerification(deedId, auth)).to.be.reverted;
    });

    it("a verificationId consumed by a FAILED submission cannot later be reused on a fresh FUNDED deed", async function () {
      const ctx = await deployFixture();
      const deedA = await createDefaultDeed(ctx);
      const deedB = await createDefaultDeed(ctx);
      await ctx.deed.connect(ctx.sponsor).fundDeed(deedA.deedId);
      await ctx.deed.connect(ctx.sponsor).fundDeed(deedB.deedId);

      const auth = buildAuth({ financiallyEligible: false, settledQuantityScaled: 0n });
      await ctx.deed.connect(ctx.verifier).submitVerification(deedA.deedId, auth);

      await expect(ctx.deed.connect(ctx.verifier).submitVerification(deedB.deedId, auth)).to.be.revertedWithCustomError(
        ctx.deed,
        "VerificationAlreadyConsumed",
      );
    });
  });

  describe("quantity handling", function () {
    it("records the settled quantity exactly as submitted by the authorized verifier", async function () {
      const { ctx, deedId } = await fundedDeed();
      const auth = buildAuth({ settledQuantityScaled: 5_000_000n });
      await ctx.deed.connect(ctx.verifier).submitVerification(deedId, auth);
      const onChain = await ctx.deed.getDeed(deedId);
      expect(onChain.settledQuantityScaled).to.equal(5_000_000n);
    });

    it("rejects a settlement amount that would exceed the escrowed amount (Invariant 6)", async function () {
      const { ctx, deedId, params } = await fundedDeed();
      // escrowAmount is DEFAULT_ESCROW (100 USDC) at UNIT_PRICE_USDC (1 USDC per whole unit);
      // request settlement of 1000 whole units, far exceeding the escrow.
      const auth = buildAuth({ settledQuantityScaled: 1_000_000_000n });
      await expect(ctx.deed.connect(ctx.verifier).submitVerification(deedId, auth)).to.be.revertedWithCustomError(
        ctx.deed,
        "SettlementExceedsEscrow",
      );
      // The deed must remain FUNDED — a rejected submission must not leave it half-transitioned.
      expect((await ctx.deed.getDeed(deedId)).status).to.equal(1n);
    });

    it("an arbitrary caller cannot substitute a larger settledQuantityScaled than what the authorized verifier submits — only the authorizedVerifier's call is accepted at all", async function () {
      const { ctx, deedId } = await fundedDeed();
      const inflatedAuth = buildAuth({ settledQuantityScaled: 50_000_000n });
      await expect(ctx.deed.connect(ctx.other).submitVerification(deedId, inflatedAuth)).to.be.revertedWithCustomError(
        ctx.deed,
        "NotAuthorizedVerifier",
      );
    });
  });
});
