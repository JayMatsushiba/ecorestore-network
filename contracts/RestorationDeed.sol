// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title RestorationDeed
 * @notice Ecorestore Network's Arc financial settlement layer (M3).
 *
 * ============================================================================
 * FINANCIAL AUTHORITY MODEL (see docs/ARCHITECTURE.md, docs/ARC.md, M3 prompt §4)
 * ============================================================================
 * This contract, not Guardian and not any off-chain AI/application component,
 * is the sole authority that releases escrowed USDC. It never performs the
 * M1 ecological calculations (control matching, difference-in-differences,
 * additionality, uncertainty) and never re-derives a settlement quantity —
 * it only accepts an already-computed, already-authorized quantity through
 * `submitVerification`, and only from the address a deed's sponsor
 * designated as that deed's `authorizedVerifier` at creation time.
 *
 * Guardian (M2) does not call this contract and has no path to release
 * funds. An off-chain Guardian-authorized verification result is translated
 * into a `VerificationAuthorization` struct by the `arc/` adapter (M3, off
 * -chain TypeScript) and submitted here by whichever address holds the
 * designated verifier's private key — see docs/ARC.md for exactly what
 * production would add to bind that address to a real Guardian verifier
 * identity (out of scope for this prototype).
 *
 * ============================================================================
 * TRUST MODEL — READ BEFORE ASSUMING THIS IS DECENTRALIZED
 * ============================================================================
 * Each deed's `authorizedVerifier` is a single Ethereum address chosen by
 * the sponsor at deed creation. Whoever controls that address's private key
 * can submit a verification for that deed. This is address-based
 * administrator-style authorization, not a decentralized oracle network, a
 * multisig, or a threshold signature scheme — see M3 prompt §15. There is
 * no contract-wide admin/owner role: no single address can act on deeds it
 * was not specifically designated for.
 *
 * ============================================================================
 * WHAT IS NOT ON-CHAIN
 * ============================================================================
 * No satellite imagery, no geospatial datasets, no full evidence bundles.
 * `projectId`, `parcelH3Root`, and `methodologyVersion` are stored as
 * `keccak256` hashes of their canonical off-chain string identifiers (the
 * same identifiers used in verification/ and guardian/) — the contract
 * compares hashes for equality and never needs the original strings.
 * `evidenceHash` is carried through only as a non-zero reference.
 */
contract RestorationDeed is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------

    /**
     * Simplified on-chain lifecycle. The conceptual milestone lifecycle in
     * docs/ARC.md/the M3 prompt (CREATED -> FUNDED -> RESTORATION_ACTIVE ->
     * VERIFICATION_PENDING -> VERIFIED -> SETTLED) includes two intermediate
     * stages, RESTORATION_ACTIVE and VERIFICATION_PENDING, that this
     * contract does not represent as distinct on-chain states: nothing
     * on-chain can observe "restoration work is happening" or "evidence is
     * under Guardian review" independently of "funded and awaiting a
     * verification submission" — that distinction lives in Guardian's own
     * lifecycle (guardian/models.ts LifecycleState), not on Arc. Both
     * collapse into `FUNDED` here. This is a documented simplification, not
     * an oversight (M3 prompt §7: "If the existing architecture requires a
     * different state model, preserve the existing semantics and document
     * the reason").
     */
    enum DeedStatus {
        CREATED, // terms set, awaiting funding
        FUNDED, // USDC escrowed; awaiting an authorized verification submission
        VERIFIED, // an eligible, authorized verification has been recorded; awaiting settlement
        SETTLED, // funds released to beneficiary (+ any unused escrow returned to sponsor)
        FAILED, // an authorized verification was submitted but was not financially eligible
        CANCELLED, // sponsor cancelled before funding; no funds were ever escrowed
        REFUNDED // sponsor reclaimed escrow from FUNDED or FAILED
    }

    struct Deed {
        // --- Identity (keccak256 of the canonical off-chain string identifiers) ---
        bytes32 projectId;
        bytes32 parcelH3Root;
        bytes32 methodologyVersion;
        // --- Parties (fixed at creation) ---
        address sponsor;
        address beneficiary;
        address authorizedVerifier;
        // --- Financial terms (immutable after creation) ---
        uint256 escrowAmount; // token smallest units the sponsor commits to fund, in full, in one call
        uint256 unitPriceUSDC; // token smallest units per 1 whole unit of settledQuantity
        uint8 quantityDecimals; // fixed-point scale used for settledQuantityScaled (e.g. 6)
        // --- Funding / verification / settlement accounting ---
        uint256 fundedAmount; // == escrowAmount once FUNDED, else 0
        bytes32 verificationId; // the verification that moved this deed to VERIFIED or FAILED
        uint256 settledQuantityScaled; // recorded only if VERIFIED
        uint256 settlementAmount; // token amount computed at VERIFIED time; paid out at SETTLED time
        uint256 releasedAmount; // == settlementAmount only after a real transfer succeeded (audit marker)
        DeedStatus status;
    }

    /**
     * The settlement authorization payload. Constructed off-chain by the
     * `arc/` adapter from a Guardian-authorized M2 verification. The
     * contract trusts `financiallyEligible` as already computed by the
     * trusted M1 -> M2 pathway (`qualityGateStatus === "PASS"`, see
     * guardian/adapter.ts) — it does not recompute it (M3 prompt §10).
     */
    struct VerificationAuthorization {
        bytes32 verificationId; // globally unique; replay-protected contract-wide
        bytes32 projectId; // must match the deed's projectId
        bytes32 parcelH3Root; // must match the deed's parcelH3Root
        bytes32 methodologyVersion; // must match the deed's methodologyVersion
        bytes32 evidenceHash; // reference only; must be non-zero
        uint256 settledQuantityScaled; // fixed-point, scale = deed.quantityDecimals
        bool financiallyEligible; // Guardian's qualityGateStatus === PASS, trusted input
    }

    // -------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------

    /**
     * M3.1 SECURITY PATCH: `quantityDecimals` was previously unbounded
     * (any uint8, 0-255). A value above ~77 makes `10 ** quantityDecimals`
     * in `submitVerification`'s eligible branch overflow `uint256`,
     * permanently reverting on any attempt to submit an eligible
     * verification for that deed (the deed would still be recoverable via
     * the FAILED -> REFUNDED path, so this was never a fund-theft risk,
     * only a self-inflicted misconfiguration risk for the deed's own
     * sponsor — see docs/ARC.md's M3 security review, finding C1). 18 is
     * chosen because it matches the most common real-world ERC-20 decimals
     * convention (e.g. 18 for most tokens, 6 for USDC) and comfortably
     * exceeds any `quantityDecimals` this prototype's `arc/identifiers.ts`
     * `scaleQuantity` actually uses (6).
     */
    uint8 public constant MAX_QUANTITY_DECIMALS = 18;

    IERC20 public immutable token;

    uint256 public nextDeedId;
    mapping(uint256 => Deed) private deeds;

    /// @dev Replay protection (M3 prompt §14): a verificationId can settle at most one deed, exactly once.
    mapping(bytes32 => bool) public consumedVerificationIds;

    // -------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------

    event DeedCreated(
        uint256 indexed deedId,
        bytes32 indexed projectId,
        bytes32 parcelH3Root,
        address indexed sponsor,
        address beneficiary,
        address authorizedVerifier,
        uint256 escrowAmount,
        uint256 unitPriceUSDC,
        uint8 quantityDecimals
    );
    event DeedFunded(uint256 indexed deedId, address indexed sponsor, uint256 amount);
    event DeedCancelled(uint256 indexed deedId);
    event VerificationSubmitted(
        uint256 indexed deedId,
        bytes32 indexed verificationId,
        bool financiallyEligible,
        uint256 settledQuantityScaled,
        uint256 settlementAmount
    );
    event SettlementExecuted(
        uint256 indexed deedId,
        bytes32 indexed verificationId,
        address indexed beneficiary,
        uint256 settlementAmount,
        uint256 refundedRemainder
    );
    event RefundExecuted(uint256 indexed deedId, address indexed sponsor, uint256 amount);

    // -------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------

    error DeedDoesNotExist(uint256 deedId);
    error InvalidDeedParameters(string reason);
    error WrongStatus(uint256 deedId, DeedStatus expected, DeedStatus actual);
    error NotSponsor(uint256 deedId, address caller);
    error NotAuthorizedVerifier(uint256 deedId, address caller);
    error VerificationAlreadyConsumed(bytes32 verificationId);
    error VerificationIdentityMismatch(string field);
    error SettlementExceedsEscrow(uint256 deedId, uint256 amount, uint256 escrowed);
    error ZeroSettledQuantity();

    constructor(address token_) {
        if (token_ == address(0)) revert InvalidDeedParameters("token is zero address");
        token = IERC20(token_);
    }

    // -------------------------------------------------------------------
    // Creation
    // -------------------------------------------------------------------

    /**
     * @notice Creates a new deed. `msg.sender` becomes the sponsor.
     * @dev Folds what docs/ARC.md's intended lifecycle describes as
     * separate `createProject()` + `createDeed()` calls into a single call,
     * as the smallest viable surface for this prototype (M3 prompt §6).
     * `unitPriceUSDC` is supplied by the sponsor here — the deed's pricing
     * convention, not something any off-chain component (AI or otherwise)
     * can influence after creation (M3 prompt §11).
     */
    function createDeed(
        bytes32 projectId,
        bytes32 parcelH3Root,
        bytes32 methodologyVersion,
        address beneficiary,
        address authorizedVerifier,
        uint256 escrowAmount,
        uint256 unitPriceUSDC,
        uint8 quantityDecimals
    ) external returns (uint256 deedId) {
        if (projectId == bytes32(0)) revert InvalidDeedParameters("projectId is zero");
        if (parcelH3Root == bytes32(0)) revert InvalidDeedParameters("parcelH3Root is zero");
        if (methodologyVersion == bytes32(0)) revert InvalidDeedParameters("methodologyVersion is zero");
        if (beneficiary == address(0)) revert InvalidDeedParameters("beneficiary is zero address");
        if (authorizedVerifier == address(0)) revert InvalidDeedParameters("authorizedVerifier is zero address");
        if (escrowAmount == 0) revert InvalidDeedParameters("escrowAmount is zero");
        if (unitPriceUSDC == 0) revert InvalidDeedParameters("unitPriceUSDC is zero");
        if (quantityDecimals > MAX_QUANTITY_DECIMALS) revert InvalidDeedParameters("quantityDecimals exceeds maximum");

        deedId = nextDeedId++;

        Deed storage deed = deeds[deedId];
        deed.projectId = projectId;
        deed.parcelH3Root = parcelH3Root;
        deed.methodologyVersion = methodologyVersion;
        deed.sponsor = msg.sender;
        deed.beneficiary = beneficiary;
        deed.authorizedVerifier = authorizedVerifier;
        deed.escrowAmount = escrowAmount;
        deed.unitPriceUSDC = unitPriceUSDC;
        deed.quantityDecimals = quantityDecimals;
        deed.status = DeedStatus.CREATED;

        emit DeedCreated(
            deedId,
            projectId,
            parcelH3Root,
            msg.sender,
            beneficiary,
            authorizedVerifier,
            escrowAmount,
            unitPriceUSDC,
            quantityDecimals
        );
    }

    /// @notice Cancels an unfunded deed. Only the sponsor; only while CREATED. No funds are involved.
    function cancelDeed(uint256 deedId) external {
        Deed storage deed = _requireDeed(deedId);
        if (msg.sender != deed.sponsor) revert NotSponsor(deedId, msg.sender);
        _requireStatus(deed, deedId, DeedStatus.CREATED);

        deed.status = DeedStatus.CANCELLED;
        emit DeedCancelled(deedId);
    }

    // -------------------------------------------------------------------
    // Funding
    // -------------------------------------------------------------------

    /**
     * @notice Escrows the deed's full `escrowAmount` in one call.
     * @dev Sponsor must have approved this contract for at least
     * `escrowAmount` beforehand (standard ERC-20 escrow pattern). This
     * prototype does not support partial/incremental funding across
     * multiple calls — a documented simplification, not a limitation of
     * the underlying trust model.
     */
    function fundDeed(uint256 deedId) external nonReentrant {
        Deed storage deed = _requireDeed(deedId);
        if (msg.sender != deed.sponsor) revert NotSponsor(deedId, msg.sender);
        _requireStatus(deed, deedId, DeedStatus.CREATED);

        deed.status = DeedStatus.FUNDED;
        deed.fundedAmount = deed.escrowAmount;

        token.safeTransferFrom(msg.sender, address(this), deed.escrowAmount);

        emit DeedFunded(deedId, msg.sender, deed.escrowAmount);
    }

    // -------------------------------------------------------------------
    // Verification
    // -------------------------------------------------------------------

    /**
     * @notice Submits an authorized verification result for a funded deed.
     * @dev Only the deed's designated `authorizedVerifier` may call this
     * (Invariant 3). The verification identity must match this deed's
     * project/parcel/methodology (Invariant 9) and must not have been
     * consumed before, on this or any other deed (Invariant 5 / M3 §14).
     * `verificationId` is marked consumed BEFORE branching on eligibility,
     * so a verification that turns out to be financially ineligible can
     * never be resubmitted and retried either (Invariant 10).
     *
     * This function does NOT recompute any ecological quantity — it only
     * validates identity/replay/authorization and, if
     * `auth.financiallyEligible` is true, computes the USDC settlement
     * amount from the already-determined `settledQuantityScaled` using the
     * deed's own fixed pricing terms (Invariant 6 is enforced here: the
     * computed amount can never exceed the escrowed amount, checked before
     * any state is finalized).
     */
    function submitVerification(uint256 deedId, VerificationAuthorization calldata auth) external {
        Deed storage deed = _requireDeed(deedId);
        if (msg.sender != deed.authorizedVerifier) revert NotAuthorizedVerifier(deedId, msg.sender);
        _requireStatus(deed, deedId, DeedStatus.FUNDED);

        if (consumedVerificationIds[auth.verificationId]) revert VerificationAlreadyConsumed(auth.verificationId);
        if (auth.projectId != deed.projectId) revert VerificationIdentityMismatch("projectId");
        if (auth.parcelH3Root != deed.parcelH3Root) revert VerificationIdentityMismatch("parcelH3Root");
        if (auth.methodologyVersion != deed.methodologyVersion) revert VerificationIdentityMismatch("methodologyVersion");
        if (auth.evidenceHash == bytes32(0)) revert VerificationIdentityMismatch("evidenceHash");

        // Consumed unconditionally from this point on — even the FAILED branch below permanently spends this verificationId.
        consumedVerificationIds[auth.verificationId] = true;
        deed.verificationId = auth.verificationId;

        if (auth.financiallyEligible) {
            if (auth.settledQuantityScaled == 0) revert ZeroSettledQuantity();

            uint256 amount = Math.mulDiv(auth.settledQuantityScaled, deed.unitPriceUSDC, 10 ** deed.quantityDecimals);
            if (amount > deed.fundedAmount) revert SettlementExceedsEscrow(deedId, amount, deed.fundedAmount);

            deed.settledQuantityScaled = auth.settledQuantityScaled;
            deed.settlementAmount = amount;
            deed.status = DeedStatus.VERIFIED;

            emit VerificationSubmitted(deedId, auth.verificationId, true, auth.settledQuantityScaled, amount);
        } else {
            deed.status = DeedStatus.FAILED;
            emit VerificationSubmitted(deedId, auth.verificationId, false, 0, 0);
        }
    }

    // -------------------------------------------------------------------
    // Settlement
    // -------------------------------------------------------------------

    /**
     * @notice Executes settlement for a VERIFIED deed: pays the beneficiary
     * the pre-computed `settlementAmount` and returns any unused escrow to
     * the sponsor in the same transaction, so no funds are ever left
     * trapped in the contract after settlement.
     * @dev Intentionally permissionless: by the time a deed is VERIFIED,
     * the recipient and amount are already fixed and immutable, so letting
     * anyone trigger the mechanical payout removes a liveness dependency on
     * any single party without weakening authorization (the authorization
     * decision already happened in `submitVerification`). State is updated
     * before external calls (checks-effects-interactions), and
     * `nonReentrant` is applied as defense in depth.
     */
    function settleDeed(uint256 deedId) external nonReentrant {
        Deed storage deed = _requireDeed(deedId);
        _requireStatus(deed, deedId, DeedStatus.VERIFIED);

        uint256 settlementAmount = deed.settlementAmount;
        uint256 remainder = deed.fundedAmount - settlementAmount; // never underflows: enforced <= fundedAmount in submitVerification

        deed.status = DeedStatus.SETTLED;
        deed.releasedAmount = settlementAmount;

        token.safeTransfer(deed.beneficiary, settlementAmount);
        if (remainder > 0) {
            token.safeTransfer(deed.sponsor, remainder);
        }

        emit SettlementExecuted(deedId, deed.verificationId, deed.beneficiary, settlementAmount, remainder);
    }

    // -------------------------------------------------------------------
    // Refunds
    // -------------------------------------------------------------------

    /**
     * @notice Returns the full escrowed balance to the sponsor. Only the
     * sponsor; only from FUNDED (voluntary withdrawal before any
     * verification was submitted) or FAILED (verification came back
     * ineligible) — never from VERIFIED or SETTLED.
     */
    function refundDeed(uint256 deedId) external nonReentrant {
        Deed storage deed = _requireDeed(deedId);
        if (msg.sender != deed.sponsor) revert NotSponsor(deedId, msg.sender);
        if (deed.status != DeedStatus.FUNDED && deed.status != DeedStatus.FAILED) {
            revert WrongStatus(deedId, DeedStatus.FUNDED, deed.status);
        }

        uint256 amount = deed.fundedAmount;
        deed.status = DeedStatus.REFUNDED;
        deed.fundedAmount = 0;

        token.safeTransfer(deed.sponsor, amount);

        emit RefundExecuted(deedId, deed.sponsor, amount);
    }

    // -------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------

    function getDeed(uint256 deedId) external view returns (Deed memory) {
        _requireDeed(deedId);
        return deeds[deedId];
    }

    function getDeedStatus(uint256 deedId) external view returns (DeedStatus) {
        return _requireDeed(deedId).status;
    }

    // -------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------

    function _requireDeed(uint256 deedId) internal view returns (Deed storage) {
        if (deedId >= nextDeedId) revert DeedDoesNotExist(deedId);
        return deeds[deedId];
    }

    function _requireStatus(Deed storage deed, uint256 deedId, DeedStatus expected) internal view {
        if (deed.status != expected) revert WrongStatus(deedId, expected, deed.status);
    }
}
