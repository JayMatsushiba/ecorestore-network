// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title RestorationDeed — programmable restoration escrow (Idea 0.3 §4.1, §4.5)
/// @notice Holds USDC against a parcel, a metric, a methodology version and a
///         pre-registered analysis plan, and releases it only against an
///         authorized, replay-protected verification whose lower-bound quantity
///         is bounded by the deed's own terms.
///
///         Authority model: this contract is the financial authority. The
///         verifier role submits the deterministic engine's verdict; it cannot
///         exceed milestone amounts, cannot release without a verdict that
///         carries a positive lower bound, and cannot custody sponsor funds.
///         No AI-generated number reaches this contract: the verifier submits
///         the versioned pipeline's result hash and bound.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

contract RestorationDeed {
    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    enum MilestoneType {
        MOBILISATION, // cost-recovery advance against verified effort, not outcome
        ESTABLISHMENT,
        PERSISTENCE
    }

    enum MilestoneState {
        PENDING,
        VERIFIED, // verdict accepted, release available
        INSUFFICIENT, // INSUFFICIENT_EVIDENCE / INVALID_RESULT — may be re-verified with a later run
        FAILED, // NOT_ADDITIONAL / GATE_FAILED — no release; persistence failure withholds retention
        RELEASED,
        RECLAIMED
    }

    /// @dev Mirrors verification/models.ts VerificationStatus, in order.
    enum VerdictStatus {
        VERIFIED,
        PARTIAL,
        NOT_ADDITIONAL,
        INSUFFICIENT_EVIDENCE,
        GATE_FAILED,
        INVALID_RESULT
    }

    struct ProjectInput {
        bytes32 h3Root;
        bytes32 geometryHash;
        bytes32 baselineRef;
        bytes32 metricId;
        bytes32 tenureAttestationHash;
        uint8 tenureType; // 0 freehold, 1 lease, 2 customary, 3 co-management
        bytes32 encumbranceHash;
        address restorer;
        address steward; // benefit-share recipient
    }

    struct Project {
        ProjectInput input;
        address registrar;
        bool exists;
    }

    struct MilestoneTerms {
        MilestoneType mType;
        uint256 amount; // USDC units escrowed for this milestone
        uint256 thresholdQuantity; // metric units x1e4 for full release (0 for MOBILISATION)
        uint64 notBefore; // earliest verification timestamp
        uint64 deadline; // after this the sponsor may reclaim the unreleased balance
    }

    struct Milestone {
        MilestoneTerms terms;
        MilestoneState state;
        bytes32 resultHash;
        uint32 runIndex;
        uint256 verifiedQuantity; // lower bound accepted, metric units x1e4
        address assignee; // third-party lender assigned this tranche (§4.5)
        uint256 releasedGross;
        bool reclaimed; // sponsor has recovered the unreleased balance
    }

    struct DeedTerms {
        uint256 projectId;
        address verifier;
        bytes32 analysisPlanHash; // committed BEFORE any outcome is observable (§3.7.1)
        bytes32 methodologyVersion;
        uint16 confidenceBps; // e.g. 9500
        uint16 benefitShareBps; // fraction of every net release routed to steward (§4.5)
        uint16 retentionBps; // fraction of every outcome release withheld against reversal (§4.2.2)
        address bufferPool; // receives withheld retention on persistence failure
    }

    struct Deed {
        DeedTerms terms;
        address sponsor;
        uint256 totalAmount;
        uint256 funded;
        uint256 releasedNet;
        uint256 retained;
        uint256 reclaimed;
        uint32 runCount;
        uint8 milestoneCount;
        bool retentionSettled;
    }

    // ------------------------------------------------------------------
    // Storage
    // ------------------------------------------------------------------

    IERC20 public immutable usdc;
    uint16 public constant BPS = 10_000;

    uint256 public projectCount;
    uint256 public deedCount;
    mapping(uint256 => Project) private projects;
    mapping(uint256 => Deed) private deeds;
    mapping(uint256 => mapping(uint8 => Milestone)) private milestones;
    /// @dev Replay protection: each result hash is accepted at most once, globally.
    mapping(bytes32 => bool) public resultHashUsed;

    uint256 private locked = 1;

    // ------------------------------------------------------------------
    // Events (the Subgraph entity set, docs/GRAPH.md)
    // ------------------------------------------------------------------

    event ProjectCreated(uint256 indexed projectId, bytes32 h3Root, bytes32 geometryHash, address restorer, address steward, uint8 tenureType);
    event DeedCreated(uint256 indexed deedId, uint256 indexed projectId, address sponsor, address verifier, bytes32 analysisPlanHash, uint256 totalAmount);
    event MilestoneDefined(uint256 indexed deedId, uint8 indexed milestoneId, MilestoneType mType, uint256 amount, uint256 thresholdQuantity, uint64 notBefore, uint64 deadline);
    event DeedFunded(uint256 indexed deedId, address funder, uint256 amount, uint256 funded);
    event EvidenceSubmitted(uint256 indexed deedId, uint8 indexed milestoneId, uint8 tier, bool simulated, string cid, address submitter);
    event VerificationRunRecorded(uint256 indexed deedId, uint32 runIndex, bytes32 analysisPlanHash, address verifier);
    event MilestoneVerified(uint256 indexed deedId, uint8 indexed milestoneId, uint32 runIndex, bytes32 resultHash, VerdictStatus status, uint256 lowerBoundQuantity, uint256 claimedQuantity, MilestoneState newState);
    event TrancheReleased(uint256 indexed deedId, uint8 indexed milestoneId, uint256 gross, uint256 retention, uint256 benefitShare, address payee, uint256 payeeAmount);
    event TrancheAssigned(uint256 indexed deedId, uint8 indexed milestoneId, address assignee);
    event RetentionWithheld(uint256 indexed deedId, uint8 indexed milestoneId, uint256 amount, address bufferPool);
    event RetentionReleased(uint256 indexed deedId, uint256 amount, address restorer, uint256 benefitShare);
    event Reclaimed(uint256 indexed deedId, uint8 indexed milestoneId, uint256 amount, address sponsor);

    // ------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------

    error NotAuthorized();
    error UnknownProject();
    error UnknownDeed();
    error UnknownMilestone();
    error BadTerms(string reason);
    error WrongState(MilestoneState state);
    error PlanMismatch();
    error ReplayedResult();
    error BadRunIndex();
    error TooEarly();
    error TooLate();
    error InsufficientEscrow();
    error TransferFailed();
    error Reentrancy();

    modifier nonReentrant() {
        if (locked != 1) revert Reentrancy();
        locked = 2;
        _;
        locked = 1;
    }

    constructor(IERC20 usdc_) {
        usdc = usdc_;
    }

    // ------------------------------------------------------------------
    // Project registration (§4.5 tenure, §4.6 encumbrances)
    // ------------------------------------------------------------------

    function createProject(ProjectInput calldata input) external returns (uint256 projectId) {
        if (input.h3Root == bytes32(0) || input.geometryHash == bytes32(0)) revert BadTerms("parcel identity");
        if (input.tenureAttestationHash == bytes32(0)) revert BadTerms("tenure attestation required");
        if (input.restorer == address(0) || input.steward == address(0)) revert BadTerms("parties");
        projectId = ++projectCount;
        projects[projectId] = Project({input: input, registrar: msg.sender, exists: true});
        emit ProjectCreated(projectId, input.h3Root, input.geometryHash, input.restorer, input.steward, input.tenureType);
    }

    // ------------------------------------------------------------------
    // Deed lifecycle
    // ------------------------------------------------------------------

    function createDeed(DeedTerms calldata terms, MilestoneTerms[] calldata schedule) external returns (uint256 deedId) {
        if (!projects[terms.projectId].exists) revert UnknownProject();
        if (terms.verifier == address(0)) revert BadTerms("verifier");
        if (terms.analysisPlanHash == bytes32(0)) revert BadTerms("analysis plan hash");
        if (terms.confidenceBps == 0 || terms.confidenceBps >= BPS) revert BadTerms("confidence");
        if (uint256(terms.benefitShareBps) + terms.retentionBps > BPS) revert BadTerms("benefit share + retention");
        if (terms.retentionBps > 0 && terms.bufferPool == address(0)) revert BadTerms("buffer pool");
        if (schedule.length == 0 || schedule.length > 255) revert BadTerms("schedule length");

        deedId = ++deedCount;
        Deed storage d = deeds[deedId];
        d.terms = terms;
        d.sponsor = msg.sender;
        d.milestoneCount = uint8(schedule.length);
        uint256 total;
        for (uint8 i = 0; i < schedule.length; i++) {
            MilestoneTerms calldata m = schedule[i];
            if (m.amount == 0) revert BadTerms("milestone amount");
            if (m.mType != MilestoneType.MOBILISATION && m.thresholdQuantity == 0) revert BadTerms("threshold");
            if (m.deadline != 0 && m.deadline <= m.notBefore) revert BadTerms("deadline");
            milestones[deedId][i].terms = m;
            total += m.amount;
            emit MilestoneDefined(deedId, i, m.mType, m.amount, m.thresholdQuantity, m.notBefore, m.deadline);
        }
        d.totalAmount = total;
        emit DeedCreated(deedId, terms.projectId, msg.sender, terms.verifier, terms.analysisPlanHash, total);
    }

    /// @notice Anyone may fund (pooled deeds); escrow never exceeds the schedule total.
    function fundDeed(uint256 deedId, uint256 amount) external nonReentrant {
        Deed storage d = _deed(deedId);
        if (amount == 0 || d.funded + amount > d.totalAmount) revert BadTerms("funding amount");
        d.funded += amount;
        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        emit DeedFunded(deedId, msg.sender, amount, d.funded);
    }

    function submitEvidence(uint256 deedId, uint8 milestoneId, uint8 tier, bool simulated, string calldata cid) external {
        Deed storage d = _deed(deedId);
        _milestone(deedId, milestoneId);
        if (msg.sender != projects[d.terms.projectId].input.restorer) revert NotAuthorized();
        emit EvidenceSubmitted(deedId, milestoneId, tier, simulated, cid, msg.sender);
    }

    /// @notice Every verification run is recorded on-chain before its verdict
    ///         can be submitted, so a deed with eleven runs and one submitted
    ///         result is visible (§3.7.1).
    function recordVerificationRun(uint256 deedId, bytes32 analysisPlanHash) external returns (uint32 runIndex) {
        Deed storage d = _deed(deedId);
        if (msg.sender != d.terms.verifier) revert NotAuthorized();
        if (analysisPlanHash != d.terms.analysisPlanHash) revert PlanMismatch();
        runIndex = ++d.runCount;
        emit VerificationRunRecorded(deedId, runIndex, analysisPlanHash, msg.sender);
    }

    /// @notice Authorized verification with replay protection.
    /// @param lowerBoundQuantity engine lower bound in metric units x1e4 (ignored for MOBILISATION)
    /// @param claimedQuantity restorer claim in metric units x1e4 (recorded for the index)
    function verifyMilestone(
        uint256 deedId,
        uint8 milestoneId,
        uint32 runIndex,
        bytes32 resultHash,
        bytes32 analysisPlanHash,
        VerdictStatus status,
        uint256 lowerBoundQuantity,
        uint256 claimedQuantity
    ) external {
        Deed storage d = _deed(deedId);
        Milestone storage m = _milestone(deedId, milestoneId);
        if (msg.sender != d.terms.verifier) revert NotAuthorized();
        if (analysisPlanHash != d.terms.analysisPlanHash) revert PlanMismatch();
        if (resultHash == bytes32(0) || resultHashUsed[resultHash]) revert ReplayedResult();
        if (runIndex == 0 || runIndex > d.runCount) revert BadRunIndex();
        if (m.state != MilestoneState.PENDING && m.state != MilestoneState.INSUFFICIENT) revert WrongState(m.state);
        if (block.timestamp < m.terms.notBefore) revert TooEarly();
        if (m.terms.deadline != 0 && block.timestamp > m.terms.deadline) revert TooLate();

        resultHashUsed[resultHash] = true;
        m.resultHash = resultHash;
        m.runIndex = runIndex;

        MilestoneState next;
        if (m.terms.mType == MilestoneType.MOBILISATION) {
            // Effort attestation: VERIFIED releases the full advance; anything else is not an advance.
            next = status == VerdictStatus.VERIFIED ? MilestoneState.VERIFIED : MilestoneState.INSUFFICIENT;
            m.verifiedQuantity = 0;
        } else if ((status == VerdictStatus.VERIFIED || status == VerdictStatus.PARTIAL) && lowerBoundQuantity > 0) {
            next = MilestoneState.VERIFIED;
            m.verifiedQuantity = lowerBoundQuantity;
        } else if (status == VerdictStatus.INSUFFICIENT_EVIDENCE || status == VerdictStatus.INVALID_RESULT) {
            next = MilestoneState.INSUFFICIENT;
            m.verifiedQuantity = 0;
        } else {
            next = MilestoneState.FAILED;
            m.verifiedQuantity = 0;
        }
        m.state = next;
        emit MilestoneVerified(deedId, milestoneId, runIndex, resultHash, status, lowerBoundQuantity, claimedQuantity, next);
    }

    /// @notice Cost-recovery advance (§4.5). Same release path, restricted to MOBILISATION.
    function drawMobilisation(uint256 deedId, uint8 milestoneId) external nonReentrant {
        Milestone storage m = _milestone(deedId, milestoneId);
        if (m.terms.mType != MilestoneType.MOBILISATION) revert BadTerms("not a mobilisation milestone");
        _release(deedId, milestoneId);
    }

    /// @notice Release against the verified lower bound, proportional to the
    ///         milestone threshold and bounded by escrow. Routes the benefit
    ///         share to the steward and withholds retention.
    function releaseTranche(uint256 deedId, uint8 milestoneId) external nonReentrant {
        Milestone storage m = _milestone(deedId, milestoneId);
        if (m.terms.mType == MilestoneType.MOBILISATION) revert BadTerms("use drawMobilisation");
        _release(deedId, milestoneId);
    }

    function _release(uint256 deedId, uint8 milestoneId) internal {
        Deed storage d = _deed(deedId);
        Milestone storage m = milestones[deedId][milestoneId];
        Project storage p = projects[d.terms.projectId];
        if (m.state != MilestoneState.VERIFIED) revert WrongState(m.state);

        uint256 gross;
        uint256 retention;
        if (m.terms.mType == MilestoneType.MOBILISATION) {
            gross = m.terms.amount;
        } else {
            uint256 q = m.verifiedQuantity > m.terms.thresholdQuantity ? m.terms.thresholdQuantity : m.verifiedQuantity;
            gross = (m.terms.amount * q) / m.terms.thresholdQuantity;
            retention = (gross * d.terms.retentionBps) / BPS;
        }
        if (gross == 0) revert BadTerms("nothing to release");
        if (gross > _available(d)) revert InsufficientEscrow();

        uint256 net = gross - retention;
        uint256 share = (net * d.terms.benefitShareBps) / BPS;
        uint256 payeeAmount = net - share;
        address payee = m.assignee != address(0) ? m.assignee : p.input.restorer;

        m.state = MilestoneState.RELEASED;
        m.releasedGross = gross;
        d.releasedNet += net;
        d.retained += retention;

        if (share > 0 && !usdc.transfer(p.input.steward, share)) revert TransferFailed();
        if (payeeAmount > 0 && !usdc.transfer(payee, payeeAmount)) revert TransferFailed();
        emit TrancheReleased(deedId, milestoneId, gross, retention, share, payee, payeeAmount);
    }

    /// @notice Pledge a future tranche to a third-party lender (§4.5).
    function assignTranche(uint256 deedId, uint8 milestoneId, address assignee) external {
        Deed storage d = _deed(deedId);
        Milestone storage m = _milestone(deedId, milestoneId);
        if (msg.sender != projects[d.terms.projectId].input.restorer) revert NotAuthorized();
        if (m.state == MilestoneState.RELEASED || m.state == MilestoneState.RECLAIMED || m.reclaimed) revert WrongState(m.state);
        m.assignee = assignee;
        emit TrancheAssigned(deedId, milestoneId, assignee);
    }

    /// @notice A persistence milestone that failed, or expired without a verdict,
    ///         sends the accumulated retention to the buffer pool instead of the
    ///         restorer (§4.2): persistence was not demonstrated.
    function withholdRetention(uint256 deedId, uint8 milestoneId) external nonReentrant {
        Deed storage d = _deed(deedId);
        Milestone storage m = _milestone(deedId, milestoneId);
        bool notDemonstrated = m.state == MilestoneState.FAILED || m.state == MilestoneState.RECLAIMED;
        if (m.terms.mType != MilestoneType.PERSISTENCE || !notDemonstrated) revert WrongState(m.state);
        if (d.retentionSettled) revert BadTerms("retention settled");
        uint256 amount = d.retained;
        d.retained = 0;
        d.retentionSettled = true;
        if (amount > 0 && !usdc.transfer(d.terms.bufferPool, amount)) revert TransferFailed();
        emit RetentionWithheld(deedId, milestoneId, amount, d.terms.bufferPool);
    }

    /// @notice Once every persistence milestone has released, retention flows
    ///         to the restorer with the benefit share applied.
    function releaseRetention(uint256 deedId) external nonReentrant {
        Deed storage d = _deed(deedId);
        if (d.retentionSettled) revert BadTerms("retention settled");
        bool anyPersistence;
        for (uint8 i = 0; i < d.milestoneCount; i++) {
            Milestone storage m = milestones[deedId][i];
            if (m.terms.mType != MilestoneType.PERSISTENCE) continue;
            anyPersistence = true;
            if (m.state != MilestoneState.RELEASED) revert WrongState(m.state);
        }
        if (!anyPersistence) revert BadTerms("no persistence milestones");
        Project storage p = projects[d.terms.projectId];
        uint256 amount = d.retained;
        d.retained = 0;
        d.retentionSettled = true;
        uint256 share = (amount * d.terms.benefitShareBps) / BPS;
        if (share > 0 && !usdc.transfer(p.input.steward, share)) revert TransferFailed();
        if (amount - share > 0 && !usdc.transfer(p.input.restorer, amount - share)) revert TransferFailed();
        emit RetentionReleased(deedId, amount, p.input.restorer, share);
    }

    /// @notice After a milestone's deadline the sponsor recovers whatever of its
    ///         amount was not released, so escrow can never be stranded.
    function reclaim(uint256 deedId, uint8 milestoneId) external nonReentrant {
        Deed storage d = _deed(deedId);
        Milestone storage m = _milestone(deedId, milestoneId);
        if (msg.sender != d.sponsor) revert NotAuthorized();
        if (m.terms.deadline == 0 || block.timestamp <= m.terms.deadline) revert TooEarly();
        if (m.reclaimed) revert WrongState(m.state);
        uint256 amount = m.terms.amount - m.releasedGross;
        uint256 avail = _available(d);
        if (amount > avail) amount = avail;
        m.reclaimed = true;
        // A released or failed milestone keeps its state so retention can still be
        // released or withheld; an unverified one can no longer be verified.
        if (m.state == MilestoneState.PENDING || m.state == MilestoneState.INSUFFICIENT) m.state = MilestoneState.RECLAIMED;
        d.reclaimed += amount;
        if (amount > 0 && !usdc.transfer(d.sponsor, amount)) revert TransferFailed();
        emit Reclaimed(deedId, milestoneId, amount, d.sponsor);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function getProject(uint256 projectId) external view returns (Project memory) {
        if (!projects[projectId].exists) revert UnknownProject();
        return projects[projectId];
    }

    function getDeed(uint256 deedId) external view returns (Deed memory) {
        return _deed(deedId);
    }

    function getMilestone(uint256 deedId, uint8 milestoneId) external view returns (Milestone memory) {
        return _milestone(deedId, milestoneId);
    }

    function availableEscrow(uint256 deedId) external view returns (uint256) {
        return _available(_deed(deedId));
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    function _available(Deed storage d) internal view returns (uint256) {
        return d.funded - d.releasedNet - d.retained - d.reclaimed;
    }

    function _deed(uint256 deedId) internal view returns (Deed storage d) {
        d = deeds[deedId];
        if (d.sponsor == address(0)) revert UnknownDeed();
    }

    function _milestone(uint256 deedId, uint8 milestoneId) internal view returns (Milestone storage m) {
        if (milestoneId >= deeds[deedId].milestoneCount) revert UnknownMilestone();
        m = milestones[deedId][milestoneId];
    }
}
