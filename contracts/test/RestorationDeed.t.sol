// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {RestorationDeed, IERC20} from "../src/RestorationDeed.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract RestorationDeedTest is Test {
    RestorationDeed deed;
    MockUSDC usdc;

    address sponsor = makeAddr("sponsor");
    address restorer = makeAddr("restorer");
    address steward = makeAddr("steward");
    address verifier = makeAddr("verifier");
    address lender = makeAddr("lender");
    address bufferPool = makeAddr("bufferPool");
    address stranger = makeAddr("stranger");

    bytes32 constant PLAN = keccak256("analysis-plan-v1");
    bytes32 constant METHOD = keccak256("ecorestore-did-leakage-lowerbound-1.0.0");
    uint256 constant Q = 1e4; // metric units x1e4

    uint256 constant MOB = 20_000e6;
    uint256 constant EST = 100_000e6;
    uint256 constant PERS = 80_000e6;
    uint256 constant THRESHOLD = 42 * Q; // 42 ha for full release

    uint256 projectId;
    uint256 deedId;

    function setUp() public {
        usdc = new MockUSDC();
        deed = new RestorationDeed(IERC20(address(usdc)));
        usdc.mint(sponsor, 1_000_000e6);

        projectId = deed.createProject(
            RestorationDeed.ProjectInput({
                h3Root: keccak256("h3"),
                geometryHash: keccak256("geom"),
                baselineRef: keccak256("baseline"),
                metricId: keccak256("riparian_woody_cover_gain_ha"),
                tenureAttestationHash: keccak256("tenure"),
                tenureType: 3,
                encumbranceHash: keccak256("[]"),
                restorer: restorer,
                steward: steward
            })
        );

        RestorationDeed.MilestoneTerms[] memory schedule = new RestorationDeed.MilestoneTerms[](3);
        schedule[0] = RestorationDeed.MilestoneTerms(RestorationDeed.MilestoneType.MOBILISATION, MOB, 0, 0, 0);
        schedule[1] = RestorationDeed.MilestoneTerms(RestorationDeed.MilestoneType.ESTABLISHMENT, EST, THRESHOLD, 0, uint64(block.timestamp + 365 days));
        schedule[2] = RestorationDeed.MilestoneTerms(RestorationDeed.MilestoneType.PERSISTENCE, PERS, THRESHOLD, uint64(block.timestamp + 300 days), uint64(block.timestamp + 800 days));

        vm.prank(sponsor);
        deedId = deed.createDeed(_terms(), schedule);

        vm.startPrank(sponsor);
        usdc.approve(address(deed), type(uint256).max);
        deed.fundDeed(deedId, MOB + EST + PERS);
        vm.stopPrank();
    }

    function _terms() internal view returns (RestorationDeed.DeedTerms memory) {
        return RestorationDeed.DeedTerms({
            projectId: projectId,
            verifier: verifier,
            analysisPlanHash: PLAN,
            methodologyVersion: METHOD,
            confidenceBps: 9500,
            benefitShareBps: 1000, // 10% to steward
            retentionBps: 1500, // 15% withheld against reversal
            bufferPool: bufferPool
        });
    }

    function _run() internal returns (uint32) {
        vm.prank(verifier);
        return deed.recordVerificationRun(deedId, PLAN);
    }

    function _verify(uint8 ms, uint32 run, bytes32 rh, RestorationDeed.VerdictStatus st, uint256 lb) internal {
        vm.prank(verifier);
        deed.verifyMilestone(deedId, ms, run, rh, PLAN, st, lb, 42 * Q);
    }

    // ------------------------------------------------------------------
    // Creation and funding
    // ------------------------------------------------------------------

    function test_deedRecordsPlanHashAndTerms() public view {
        RestorationDeed.Deed memory d = deed.getDeed(deedId);
        assertEq(d.terms.analysisPlanHash, PLAN);
        assertEq(d.sponsor, sponsor);
        assertEq(d.totalAmount, MOB + EST + PERS);
        assertEq(d.funded, MOB + EST + PERS);
        assertEq(d.milestoneCount, 3);
    }

    function test_createDeedRejectsMissingPlanHash() public {
        RestorationDeed.DeedTerms memory t = _terms();
        t.analysisPlanHash = bytes32(0);
        RestorationDeed.MilestoneTerms[] memory s = new RestorationDeed.MilestoneTerms[](1);
        s[0] = RestorationDeed.MilestoneTerms(RestorationDeed.MilestoneType.ESTABLISHMENT, 1e6, Q, 0, 0);
        vm.prank(sponsor);
        vm.expectRevert(abi.encodeWithSelector(RestorationDeed.BadTerms.selector, "analysis plan hash"));
        deed.createDeed(t, s);
    }

    function test_projectRequiresTenureAttestation() public {
        RestorationDeed.ProjectInput memory p = deed.getProject(projectId).input;
        p.tenureAttestationHash = bytes32(0);
        vm.expectRevert(abi.encodeWithSelector(RestorationDeed.BadTerms.selector, "tenure attestation required"));
        deed.createProject(p);
    }

    function test_fundingCannotExceedSchedule() public {
        vm.prank(sponsor);
        vm.expectRevert(abi.encodeWithSelector(RestorationDeed.BadTerms.selector, "funding amount"));
        deed.fundDeed(deedId, 1);
    }

    // ------------------------------------------------------------------
    // Authorization, pre-registration and replay
    // ------------------------------------------------------------------

    function test_onlyVerifierCanRecordRunsAndVerify() public {
        vm.prank(stranger);
        vm.expectRevert(RestorationDeed.NotAuthorized.selector);
        deed.recordVerificationRun(deedId, PLAN);

        uint32 run = _run();
        vm.prank(stranger);
        vm.expectRevert(RestorationDeed.NotAuthorized.selector);
        deed.verifyMilestone(deedId, 1, run, keccak256("r"), PLAN, RestorationDeed.VerdictStatus.PARTIAL, 11 * Q, 42 * Q);
    }

    function test_runMustCiteCommittedPlan() public {
        vm.prank(verifier);
        vm.expectRevert(RestorationDeed.PlanMismatch.selector);
        deed.recordVerificationRun(deedId, keccak256("other-plan"));
    }

    function test_verdictMustCiteRecordedRun() public {
        vm.prank(verifier);
        vm.expectRevert(RestorationDeed.BadRunIndex.selector);
        deed.verifyMilestone(deedId, 1, 1, keccak256("r"), PLAN, RestorationDeed.VerdictStatus.PARTIAL, 11 * Q, 42 * Q);
    }

    function test_verdictWithWrongPlanHashRejected() public {
        uint32 run = _run();
        vm.prank(verifier);
        vm.expectRevert(RestorationDeed.PlanMismatch.selector);
        deed.verifyMilestone(deedId, 1, run, keccak256("r"), keccak256("other"), RestorationDeed.VerdictStatus.PARTIAL, 11 * Q, 42 * Q);
    }

    function test_resultHashCannotBeReplayed() public {
        uint32 run = _run();
        bytes32 rh = keccak256("result-1");
        _verify(1, run, rh, RestorationDeed.VerdictStatus.INSUFFICIENT_EVIDENCE, 0);
        uint32 run2 = _run();
        vm.prank(verifier);
        vm.expectRevert(RestorationDeed.ReplayedResult.selector);
        deed.verifyMilestone(deedId, 1, run2, rh, PLAN, RestorationDeed.VerdictStatus.PARTIAL, 11 * Q, 42 * Q);
    }

    function test_runCountIsVisibleHistory() public {
        for (uint256 i = 0; i < 11; i++) _run();
        assertEq(deed.getDeed(deedId).runCount, 11);
        _verify(1, 11, keccak256("the-one-submitted"), RestorationDeed.VerdictStatus.PARTIAL, 11 * Q);
        assertEq(deed.getMilestone(deedId, 1).runIndex, 11);
    }

    function test_verificationRespectsNotBefore() public {
        uint32 run = _run();
        vm.prank(verifier);
        vm.expectRevert(RestorationDeed.TooEarly.selector);
        deed.verifyMilestone(deedId, 2, run, keccak256("early"), PLAN, RestorationDeed.VerdictStatus.PARTIAL, 11 * Q, 42 * Q);
    }

    // ------------------------------------------------------------------
    // Settlement against the lower bound, bounded by contract state
    // ------------------------------------------------------------------

    function test_partialReleaseIsProportionalAndRoutesBenefitShare() public {
        uint32 run = _run();
        _verify(1, run, keccak256("partial"), RestorationDeed.VerdictStatus.PARTIAL, 112_000); // 11.2 ha
        deed.releaseTranche(deedId, 1);

        uint256 gross = (EST * 112_000) / THRESHOLD; // 26.67% of 100k
        uint256 retention = (gross * 1500) / 10_000;
        uint256 net = gross - retention;
        uint256 share = (net * 1000) / 10_000;

        assertEq(usdc.balanceOf(steward), share, "steward benefit share");
        assertEq(usdc.balanceOf(restorer), net - share, "restorer net");
        RestorationDeed.Deed memory d = deed.getDeed(deedId);
        assertEq(d.retained, retention);
        assertEq(d.releasedNet, net);
        assertEq(uint256(deed.getMilestone(deedId, 1).state), uint256(RestorationDeed.MilestoneState.RELEASED));
    }

    function test_releaseNeverExceedsMilestoneAmount() public {
        uint32 run = _run();
        _verify(1, run, keccak256("over"), RestorationDeed.VerdictStatus.VERIFIED, 500 * Q); // bound far above threshold
        deed.releaseTranche(deedId, 1);
        uint256 gross = EST; // capped at the milestone amount
        uint256 retention = (gross * 1500) / 10_000;
        assertEq(usdc.balanceOf(steward) + usdc.balanceOf(restorer), gross - retention);
    }

    function test_releaseBoundedByEscrow() public {
        // A second, unfunded deed: verification succeeds, release must fail.
        RestorationDeed.MilestoneTerms[] memory s = new RestorationDeed.MilestoneTerms[](1);
        s[0] = RestorationDeed.MilestoneTerms(RestorationDeed.MilestoneType.ESTABLISHMENT, EST, THRESHOLD, 0, 0);
        vm.prank(sponsor);
        uint256 d2 = deed.createDeed(_terms(), s);
        vm.prank(verifier);
        uint32 run = deed.recordVerificationRun(d2, PLAN);
        vm.prank(verifier);
        deed.verifyMilestone(d2, 0, run, keccak256("d2"), PLAN, RestorationDeed.VerdictStatus.PARTIAL, 11 * Q, 42 * Q);
        vm.expectRevert(RestorationDeed.InsufficientEscrow.selector);
        deed.releaseTranche(d2, 0);
    }

    function test_insufficientEvidenceReleasesNothingAndAllowsRerun() public {
        uint32 run = _run();
        _verify(1, run, keccak256("insufficient"), RestorationDeed.VerdictStatus.INSUFFICIENT_EVIDENCE, 0);
        assertEq(uint256(deed.getMilestone(deedId, 1).state), uint256(RestorationDeed.MilestoneState.INSUFFICIENT));
        vm.expectRevert(abi.encodeWithSelector(RestorationDeed.WrongState.selector, RestorationDeed.MilestoneState.INSUFFICIENT));
        deed.releaseTranche(deedId, 1);

        uint32 run2 = _run();
        _verify(1, run2, keccak256("later-partial"), RestorationDeed.VerdictStatus.PARTIAL, 5 * Q);
        deed.releaseTranche(deedId, 1);
        assertGt(usdc.balanceOf(restorer), 0);
    }

    function test_notAdditionalFailsMilestoneAndCannotBeReverified() public {
        uint32 run = _run();
        _verify(1, run, keccak256("not-additional"), RestorationDeed.VerdictStatus.NOT_ADDITIONAL, 0);
        assertEq(uint256(deed.getMilestone(deedId, 1).state), uint256(RestorationDeed.MilestoneState.FAILED));
        uint32 run2 = _run();
        vm.prank(verifier);
        vm.expectRevert(abi.encodeWithSelector(RestorationDeed.WrongState.selector, RestorationDeed.MilestoneState.FAILED));
        deed.verifyMilestone(deedId, 1, run2, keccak256("retry"), PLAN, RestorationDeed.VerdictStatus.PARTIAL, 11 * Q, 42 * Q);
        assertEq(usdc.balanceOf(restorer), 0);
    }

    function test_partialWithZeroLowerBoundDoesNotRelease() public {
        uint32 run = _run();
        _verify(1, run, keccak256("zero"), RestorationDeed.VerdictStatus.PARTIAL, 0);
        assertEq(uint256(deed.getMilestone(deedId, 1).state), uint256(RestorationDeed.MilestoneState.FAILED));
    }

    // ------------------------------------------------------------------
    // Working capital
    // ------------------------------------------------------------------

    function test_mobilisationDrawAgainstVerifiedEffort() public {
        uint32 run = _run();
        _verify(0, run, keccak256("effort"), RestorationDeed.VerdictStatus.VERIFIED, 0);
        deed.drawMobilisation(deedId, 0);
        uint256 share = (MOB * 1000) / 10_000;
        assertEq(usdc.balanceOf(restorer), MOB - share);
        assertEq(usdc.balanceOf(steward), share);
        assertEq(deed.getDeed(deedId).retained, 0, "no retention on mobilisation");
    }

    function test_mobilisationNeedsVerifiedEffort() public {
        uint32 run = _run();
        _verify(0, run, keccak256("no-effort"), RestorationDeed.VerdictStatus.PARTIAL, 10 * Q);
        vm.expectRevert(abi.encodeWithSelector(RestorationDeed.WrongState.selector, RestorationDeed.MilestoneState.INSUFFICIENT));
        deed.drawMobilisation(deedId, 0);
    }

    function test_assignTrancheRoutesPayeeToLender() public {
        vm.prank(restorer);
        deed.assignTranche(deedId, 1, lender);
        uint32 run = _run();
        _verify(1, run, keccak256("assigned"), RestorationDeed.VerdictStatus.PARTIAL, 21 * Q);
        deed.releaseTranche(deedId, 1);
        assertGt(usdc.balanceOf(lender), 0);
        assertEq(usdc.balanceOf(restorer), 0);
        assertGt(usdc.balanceOf(steward), 0, "benefit share still routed to steward");
    }

    function test_onlyRestorerAssigns() public {
        vm.prank(stranger);
        vm.expectRevert(RestorationDeed.NotAuthorized.selector);
        deed.assignTranche(deedId, 1, lender);
    }

    // ------------------------------------------------------------------
    // Retention
    // ------------------------------------------------------------------

    function test_persistenceFailureWithholdsRetentionToBufferPool() public {
        uint32 run = _run();
        _verify(1, run, keccak256("est"), RestorationDeed.VerdictStatus.PARTIAL, 21 * Q);
        deed.releaseTranche(deedId, 1);
        uint256 retained = deed.getDeed(deedId).retained;
        assertGt(retained, 0);

        vm.warp(block.timestamp + 301 days);
        uint32 run2 = _run();
        _verify(2, run2, keccak256("reversal"), RestorationDeed.VerdictStatus.GATE_FAILED, 0);
        deed.withholdRetention(deedId, 2);
        assertEq(usdc.balanceOf(bufferPool), retained);
        assertEq(deed.getDeed(deedId).retained, 0);
    }

    function test_retentionReleasedAfterPersistenceHolds() public {
        uint32 run = _run();
        _verify(1, run, keccak256("est"), RestorationDeed.VerdictStatus.PARTIAL, 21 * Q);
        deed.releaseTranche(deedId, 1);
        vm.warp(block.timestamp + 301 days);
        uint32 run2 = _run();
        _verify(2, run2, keccak256("held"), RestorationDeed.VerdictStatus.PARTIAL, 21 * Q);
        deed.releaseTranche(deedId, 2);
        uint256 retained = deed.getDeed(deedId).retained;
        uint256 stewardBefore = usdc.balanceOf(steward);
        uint256 restorerBefore = usdc.balanceOf(restorer);
        deed.releaseRetention(deedId);
        uint256 share = (retained * 1000) / 10_000;
        assertEq(usdc.balanceOf(steward) - stewardBefore, share);
        assertEq(usdc.balanceOf(restorer) - restorerBefore, retained - share);
    }

    function test_retentionCannotReleaseWhilePersistencePending() public {
        vm.expectRevert(abi.encodeWithSelector(RestorationDeed.WrongState.selector, RestorationDeed.MilestoneState.PENDING));
        deed.releaseRetention(deedId);
    }

    // ------------------------------------------------------------------
    // Reclaim
    // ------------------------------------------------------------------

    function test_sponsorReclaimsUnreleasedAfterDeadline() public {
        uint32 run = _run();
        _verify(1, run, keccak256("est"), RestorationDeed.VerdictStatus.PARTIAL, 21 * Q); // half released
        deed.releaseTranche(deedId, 1);
        uint256 gross = EST / 2;
        vm.warp(block.timestamp + 366 days);
        uint256 before = usdc.balanceOf(sponsor);
        vm.prank(sponsor);
        deed.reclaim(deedId, 1);
        assertEq(usdc.balanceOf(sponsor) - before, EST - gross);
    }

    function test_reclaimAfterReleaseKeepsRetentionPathOpen() public {
        uint32 run = _run();
        _verify(1, run, keccak256("est"), RestorationDeed.VerdictStatus.PARTIAL, 21 * Q);
        deed.releaseTranche(deedId, 1);
        vm.warp(block.timestamp + 301 days);
        uint32 run2 = _run();
        _verify(2, run2, keccak256("held"), RestorationDeed.VerdictStatus.PARTIAL, 21 * Q);
        deed.releaseTranche(deedId, 2);
        // Sponsor reclaims the unreleased half of the persistence tranche after its deadline...
        vm.warp(block.timestamp + 500 days);
        vm.prank(sponsor);
        deed.reclaim(deedId, 2);
        assertEq(uint256(deed.getMilestone(deedId, 2).state), uint256(RestorationDeed.MilestoneState.RELEASED));
        // ...and retention can still be released to the restorer.
        uint256 retained = deed.getDeed(deedId).retained;
        assertGt(retained, 0);
        deed.releaseRetention(deedId);
        assertEq(deed.getDeed(deedId).retained, 0);
        vm.prank(sponsor);
        vm.expectRevert(abi.encodeWithSelector(RestorationDeed.WrongState.selector, RestorationDeed.MilestoneState.RELEASED));
        deed.reclaim(deedId, 2);
    }

    function test_reclaimBeforeDeadlineRejected() public {
        vm.prank(sponsor);
        vm.expectRevert(RestorationDeed.TooEarly.selector);
        deed.reclaim(deedId, 1);
    }

    function test_strangerCannotReclaim() public {
        vm.warp(block.timestamp + 366 days);
        vm.prank(stranger);
        vm.expectRevert(RestorationDeed.NotAuthorized.selector);
        deed.reclaim(deedId, 1);
    }

    // ------------------------------------------------------------------
    // Invariant: escrow accounting never exceeds balance
    // ------------------------------------------------------------------

    function test_escrowAccountingMatchesBalance() public {
        uint32 run = _run();
        _verify(0, run, keccak256("effort"), RestorationDeed.VerdictStatus.VERIFIED, 0);
        deed.drawMobilisation(deedId, 0);
        uint32 run2 = _run();
        _verify(1, run2, keccak256("est"), RestorationDeed.VerdictStatus.PARTIAL, 30 * Q);
        deed.releaseTranche(deedId, 1);
        RestorationDeed.Deed memory d = deed.getDeed(deedId);
        assertEq(usdc.balanceOf(address(deed)), d.funded - d.releasedNet, "contract holds funded minus net paid out");
        assertEq(deed.availableEscrow(deedId), d.funded - d.releasedNet - d.retained - d.reclaimed);
    }
}
