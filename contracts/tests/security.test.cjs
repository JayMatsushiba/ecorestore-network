"use strict";
/**
 * RestorationDeed — dedicated security & invariant tests (M3 prompt §16-17).
 *
 * These deliberately re-test scenarios already covered elsewhere from the
 * explicit angle of "can a malicious/unauthorized caller do X" and "does
 * invariant Y always hold", per the M3 prompt's required structure, rather
 * than introducing new contract behavior.
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { DEFAULT_ESCROW, UNIT_PRICE_USDC, buildAuth, createDefaultDeed, deployFixture, hashId } = require("./helpers.cjs");

describe("RestorationDeed — security invariants", function () {
  it("Invariant: a malicious caller cannot settle without funding", async function () {
    const ctx = await deployFixture();
    const { deedId } = await createDefaultDeed(ctx);
    await expect(ctx.deed.connect(ctx.other).settleDeed(deedId)).to.be.revertedWithCustomError(ctx.deed, "WrongStatus");
  });

  it("Invariant: a malicious caller cannot settle without any verification having been submitted", async function () {
    const ctx = await deployFixture();
    const { deedId } = await createDefaultDeed(ctx);
    await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);
    await expect(ctx.deed.connect(ctx.other).settleDeed(deedId)).to.be.revertedWithCustomError(ctx.deed, "WrongStatus");
  });

  it("Invariant: a malicious caller cannot settle using an arbitrary/self-declared quantity — submitVerification itself is gated to the authorizedVerifier", async function () {
    const ctx = await deployFixture();
    const { deedId } = await createDefaultDeed(ctx);
    await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);
    const maliciousAuth = buildAuth({ settledQuantityScaled: 999_999_999n });
    await expect(
      ctx.deed.connect(ctx.other).submitVerification(deedId, maliciousAuth),
    ).to.be.revertedWithCustomError(ctx.deed, "NotAuthorizedVerifier");
  });

  it("Invariant: a deed cannot settle twice, even if called back-to-back by different callers", async function () {
    const ctx = await deployFixture();
    const { deedId } = await createDefaultDeed(ctx);
    await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);
    await ctx.deed.connect(ctx.verifier).submitVerification(deedId, buildAuth({ settledQuantityScaled: 1_000_000n }));
    await ctx.deed.connect(ctx.sponsor).settleDeed(deedId);
    await expect(ctx.deed.connect(ctx.other).settleDeed(deedId)).to.be.revertedWithCustomError(ctx.deed, "WrongStatus");
  });

  it("Invariant: an arbitrary caller cannot withdraw escrow via refundDeed on someone else's deed", async function () {
    const ctx = await deployFixture();
    const { deedId } = await createDefaultDeed(ctx);
    await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);
    await expect(ctx.deed.connect(ctx.other).refundDeed(deedId)).to.be.revertedWithCustomError(ctx.deed, "NotSponsor");
  });

  it("Invariant: authorization cannot be bypassed by calling submitVerification for a deed that does not name the caller as verifier, even with a perfectly well-formed payload", async function () {
    const ctx = await deployFixture();
    const { deedId } = await createDefaultDeed(ctx);
    await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);
    const wellFormedAuth = buildAuth();
    await expect(
      ctx.deed.connect(ctx.other).submitVerification(deedId, wellFormedAuth),
    ).to.be.revertedWithCustomError(ctx.deed, "NotAuthorizedVerifier");
  });

  it("Invariant: a financially-failed (INSUFFICIENT_EVIDENCE/INVALID_RESULT-equivalent) verification cannot settle", async function () {
    const ctx = await deployFixture();
    const { deedId } = await createDefaultDeed(ctx);
    await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);
    await ctx.deed.connect(ctx.verifier).submitVerification(
      deedId,
      buildAuth({ financiallyEligible: false, settledQuantityScaled: 0n }),
    );
    await expect(ctx.deed.settleDeed(deedId)).to.be.revertedWithCustomError(ctx.deed, "WrongStatus");
    // and the escrow is still fully present, reclaimable only via refund:
    expect(await ctx.usdc.balanceOf(await ctx.deed.getAddress())).to.equal(DEFAULT_ESCROW);
  });

  it("Invariant: releasedAmount can never exceed escrowedAmount, verified across many randomized settled quantities", async function () {
    const ctx = await deployFixture();
    const quantities = [1n, 100n, 12_345n, 50_000_000n, 100_000_000n]; // last one == full escrow at 1.0 price
    for (const q of quantities) {
      const { deedId } = await createDefaultDeed(ctx);
      await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);
      await ctx.deed.connect(ctx.verifier).submitVerification(deedId, buildAuth({ settledQuantityScaled: q }));
      await ctx.deed.settleDeed(deedId);
      const onChain = await ctx.deed.getDeed(deedId);
      expect(onChain.releasedAmount).to.be.lte(onChain.escrowAmount);
    }
  });

  it("Invariant: no AI/application input can independently release funds — settleDeed only ever moves the amount computed inside submitVerification from a Guardian-authorized quantity, never an amount passed as a settleDeed argument (settleDeed takes no amount argument at all)", async function () {
    const ctx = await deployFixture();
    const { deedId } = await createDefaultDeed(ctx);
    await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);
    await ctx.deed.connect(ctx.verifier).submitVerification(deedId, buildAuth({ settledQuantityScaled: 1_000_000n }));
    // settleDeed's ABI takes only a deedId — there is no parameter through
    // which any off-chain component, AI-generated or otherwise, could pass
    // a different amount at settlement time.
    expect(ctx.deed.interface.getFunction("settleDeed").inputs.length).to.equal(1);
    await ctx.deed.settleDeed(deedId);
    const onChain = await ctx.deed.getDeed(deedId);
    expect(onChain.releasedAmount).to.equal(1_000_000n);
  });

  it("Invariant: invalid state transitions are rejected at every stage (state machine cannot be bypassed by call ordering)", async function () {
    const ctx = await deployFixture();
    const { deedId } = await createDefaultDeed(ctx);

    // Cannot submitVerification before funding.
    await expect(
      ctx.deed.connect(ctx.verifier).submitVerification(deedId, buildAuth()),
    ).to.be.revertedWithCustomError(ctx.deed, "WrongStatus");

    // Cannot settle before funding.
    await expect(ctx.deed.settleDeed(deedId)).to.be.revertedWithCustomError(ctx.deed, "WrongStatus");

    // Cannot refund before funding.
    await expect(ctx.deed.connect(ctx.sponsor).refundDeed(deedId)).to.be.revertedWithCustomError(
      ctx.deed,
      "WrongStatus",
    );

    await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);

    // Cannot cancel once funded.
    await expect(ctx.deed.connect(ctx.sponsor).cancelDeed(deedId)).to.be.revertedWithCustomError(
      ctx.deed,
      "WrongStatus",
    );

    // Cannot settle before verification.
    await expect(ctx.deed.settleDeed(deedId)).to.be.revertedWithCustomError(ctx.deed, "WrongStatus");
  });

  it("Invariant: methodology identity is bound — a verification cannot substitute a different methodology than the deed was created under", async function () {
    const ctx = await deployFixture();
    const { deedId } = await createDefaultDeed(ctx);
    await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);
    const substitutedMethodology = buildAuth({ methodologyVersion: hashId("some-other-methodology-v9.9") });
    await expect(
      ctx.deed.connect(ctx.verifier).submitVerification(deedId, substitutedMethodology),
    ).to.be.revertedWithCustomError(ctx.deed, "VerificationIdentityMismatch");
  });

  it("Invariant: a verification cannot be substituted across projects (project-substitution attack)", async function () {
    const ctx = await deployFixture();
    const { deedId } = await createDefaultDeed(ctx);
    await ctx.deed.connect(ctx.sponsor).fundDeed(deedId);
    const substitutedProject = buildAuth({ projectId: hashId("someone-elses-project") });
    await expect(
      ctx.deed.connect(ctx.verifier).submitVerification(deedId, substitutedProject),
    ).to.be.revertedWithCustomError(ctx.deed, "VerificationIdentityMismatch");
  });

  it("reentrancy: a malicious token's transfer hook cannot re-enter settleDeed to double-settle", async function () {
    const [sponsor, beneficiary, verifier] = await ethers.getSigners();

    const MaliciousToken = await ethers.getContractFactory("MaliciousReentrantToken");
    const evilToken = await MaliciousToken.deploy();
    await evilToken.waitForDeployment();

    const RestorationDeed = await ethers.getContractFactory("RestorationDeed");
    const deed = await RestorationDeed.deploy(await evilToken.getAddress());
    await deed.waitForDeployment();

    const escrow = 100_000_000n;
    await evilToken.transfer(sponsor.address, escrow);
    await evilToken.connect(sponsor).approve(await deed.getAddress(), escrow);

    const tx = await deed
      .connect(sponsor)
      .createDeed(
        hashId("reentrancy-test-project"),
        hashId("reentrancy-test-parcel"),
        hashId("ecorestore-m1-v0.1"),
        beneficiary.address,
        verifier.address,
        escrow,
        UNIT_PRICE_USDC,
        6,
      );
    const receipt = await tx.wait();
    const created = receipt.logs.map((l) => { try { return deed.interface.parseLog(l); } catch { return null; } }).find((p) => p && p.name === "DeedCreated");
    const deedId = created.args.deedId;

    await deed.connect(sponsor).fundDeed(deedId);
    await deed.connect(verifier).submitVerification(
      deedId,
      buildAuth({
        projectId: hashId("reentrancy-test-project"),
        parcelH3Root: hashId("reentrancy-test-parcel"),
        methodologyVersion: hashId("ecorestore-m1-v0.1"),
        settledQuantityScaled: 1_000_000n,
      }),
    );

    // Arm the token to re-enter settleDeed(deedId) during its own transfer,
    // which fires inside the FIRST settleDeed call below.
    await evilToken.configureAttack(await deed.getAddress(), deedId);

    // The reentrant inner call hits RestorationDeed's nonReentrant guard
    // before it can reach any state check, which reverts the token
    // transfer, which reverts the entire outer settleDeed transaction.
    await expect(deed.settleDeed(deedId)).to.be.reverted;

    // Because the whole transaction reverted, the deed must still be
    // VERIFIED (unsettled) and no funds moved — the guard prevented any
    // partial/double effect, it did not merely prevent a *second* payout
    // after a first one already landed.
    const onChain = await deed.getDeed(deedId);
    expect(onChain.status).to.equal(2n); // VERIFIED, not SETTLED
    expect(await evilToken.balanceOf(beneficiary.address)).to.equal(0n);
  });
});
