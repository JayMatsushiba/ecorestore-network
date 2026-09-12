# Ecorestore Network — Arc Settlement

## 1. Purpose

Arc is the financial settlement layer.

The Restoration Deed holds USDC against predefined restoration milestones and releases funds only when the contractual verification conditions are satisfied.

Arc's current documentation supports deploying Solidity contracts to Arc Testnet and using testnet USDC for development.

---

## 2. Financial Authority

The authority model is:

```text
Verification Engine
        ↓
VerificationResult
        ↓
Guardian authorization
        ↓
authorized verifier
        ↓
RestorationDeed
        ↓
USDC
```

The contract, not the AI agent, controls settlement.

---

## 3. Restoration Deed

The intended contract contains:

```text
project
parcel identity
metric
methodology version
milestones
thresholds
confidence level
funding
verification authority
released amount
remaining escrow
```

---

## 4. Intended Lifecycle

```text
createProject()
createDeed()
fundDeed()
submitEvidence()
verifyMilestone()
releaseTranche()
withholdRetention()
```

The exact interface will be designed during M3.

---

## 5. Security Requirements

The contract must prevent:

* unauthorized verification;
* arbitrary withdrawals;
* replayed verification results;
* settlement above deed limits;
* settlement against an invalid milestone;
* modification of immutable deed terms;
* AI-controlled fund release.

Verification submissions must be authorized.

Settlement calculations must be bounded by contract state.

---

## 6. Synthetic Data

The contract may receive synthetic verification results during the hackathon.

Those results must be visibly marked as synthetic in the application and documentation.

---

## 7. M0

M0 creates only the Solidity scaffold.

Do not deploy.

Do not implement the complete escrow logic.

---

## 8. M3

M3 implements:

* deed creation;
* USDC funding;
* milestone state;
* authorized verification;
* lower-bound settlement;
* replay protection;
* release/withholding;
* tests.

Arc Testnet is the intended deployment environment.

---

## 9. M3 Implementation Notes

This section documents what M3 actually built. It supersedes §8 as the record of what was delivered.

### 9.1 What was implemented, and what environment it runs in

**Implemented:** `contracts/RestorationDeed.sol` (the settlement contract), `contracts/MockUSDC.sol` (a local test-only ERC-20), a full Hardhat + local-network test suite (`contracts/tests/`, 72 tests), and `arc/` (a TypeScript adapter translating M1/M2 output into on-chain calls, 15 vitest tests for its pure logic).

**Not implemented — explicitly deferred:** any deployment to Arc Testnet or any other live network. Every test in this milestone runs against Hardhat's in-process local EVM network (`hardhat` network, chain id 31337), which starts fresh for each test file and is discarded afterward. There is no `.env`, no RPC URL, no private key, and no deployed contract address anywhere in this repository. **Local Hardhat network tests passing is not equivalent to an Arc Testnet deployment** — see M3 prompt §18, §28. Deploying to Arc Testnet is a mechanical next step (this same `RestorationDeed`/`MockUSDC` pair deploys unchanged; only network config and a real testnet USDC address would need to be supplied), but it was not performed, and this document does not claim otherwise.

### 9.2 Solidity toolchain note (environment constraint)

This build environment's network egress allowlist does not include `binaries.soliditylang.org`, which is where Hardhat's built-in compiler manager fetches `solc` from by default. `hardhat.config.cjs` overrides Hardhat's `TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD` subtask to resolve solc from the `solc` npm package (installed from the standard, allowed npm registry) instead of attempting that download. This is a documented, standard Hardhat pattern for offline compilation, not a change to how Solidity itself is compiled — the same solc 0.8.24 version and inputs produce the same bytecode either way.

### 9.3 RestorationDeed state machine

```text
CREATED -> FUNDED -> VERIFIED -> SETTLED
CREATED -> CANCELLED
FUNDED -> REFUNDED
FUNDED -> FAILED -> REFUNDED
```

**Deviation from the conceptual lifecycle in §7 above (documented per M3 prompt §7's "preserve existing semantics and document the reason"):** the suggested `RESTORATION_ACTIVE` and `VERIFICATION_PENDING` intermediate states are not represented on-chain. Nothing on-chain can independently observe "restoration work is happening" versus "evidence is under Guardian review" — that distinction lives in Guardian's own `LifecycleState` (guardian/models.ts), not in Arc. Both collapse into `FUNDED` here: a deed is `FUNDED` from the moment escrow lands until an authorized verification (eligible or not) is submitted.

Every transition function checks the deed's current status via a `WrongStatus` custom error and reverts otherwise — there is no function whose behavior depends on call ordering beyond that explicit check (M3 prompt §7, "impossible to bypass through arbitrary function ordering" — tested directly in `contracts/tests/security.test.cjs`, "invalid state transitions are rejected at every stage").

### 9.4 USDC escrow model

`RestorationDeed` holds one ERC-20 token address, set once at deployment (`immutable token`), for every deed that instance manages. `fundDeed` calls `SafeERC20.safeTransferFrom` — the sponsor must `approve` the contract for the full `escrowAmount` beforehand (standard ERC-20 escrow pattern). Funding is all-or-nothing in this prototype: one call transfers the deed's entire agreed `escrowAmount`; there is no incremental/partial funding across multiple calls. This is a documented simplification, not a limitation of the trust model — the smallest surface that supports the demo (M3 prompt §6).

`contracts/MockUSDC.sol` is a local test-only ERC-20 (OpenZeppelin `ERC20`, 6 decimals to match real USDC) with an unrestricted public `mint`. **This is not USDC, is not deployed by Circle, and would be a critical vulnerability as a real token** (anyone can mint anything) — it exists solely so the test suite can set up balances deterministically. Production deployment would point `RestorationDeed`'s constructor at the real USDC contract address on Arc, unmodified.

### 9.5 Verification authorization model

Each deed has one `authorizedVerifier` address, chosen by the sponsor at `createDeed` time. Only that address may call `submitVerification` for that deed. There is **no contract-wide admin/owner role** — no single address can act on a deed it was not specifically designated for. This is honest, documented **address-based, administrator-style authorization**, not a decentralized oracle network, multisig, or threshold scheme (M3 prompt §15). In this prototype, the `authorizedVerifier` address is meant to correspond to the single Guardian-authorized verifier identity from M2 (`guardian-verifier-kootenay-001`); binding a real Ethereum address to a real Guardian-attested identity (e.g. via a DID-linked key registry) is production infrastructure this milestone does not build — see §9.9.

### 9.6 Settlement quantity model — the contract never recomputes M1's science

`submitVerification` takes a `VerificationAuthorization` struct built off-chain (by `arc/payload.ts`, from an M2 `GuardianCredential`) containing an already-determined `settledQuantityScaled` (a fixed-point integer, scale = `quantityDecimals`, typically 6) and a `financiallyEligible` boolean (Guardian's `qualityGateStatus === "PASS"`, computed off-chain and trusted as input — never re-derived on-chain). The contract:

1. checks the verification hasn't been consumed before (replay protection, contract-wide);
2. checks the payload's `projectId`/`parcelH3Root`/`methodologyVersion` (all `keccak256` hashes of the off-chain string identifiers) match the deed's;
3. if `financiallyEligible`, computes `settlementAmount = settledQuantityScaled * unitPriceUSDC / 10**quantityDecimals` via OpenZeppelin's `Math.mulDiv` (avoids intermediate-overflow issues plain `a*b/c` can have), checks it does not exceed the deed's escrowed amount, and moves the deed to `VERIFIED`;
4. otherwise moves the deed to `FAILED` — no funds move, but the verification id is still permanently consumed.

**No ecological calculation (control matching, DiD, additionality, uncertainty) happens in Solidity anywhere.** Those all live in `verification/` (M1) and are already complete by the time a payload reaches this contract (M3 prompt §5, §10).

### 9.7 Pricing / financial representation convention

**This is an explicit, versioned demo convention, not a real market mechanism** (M3 prompt §11): `settlementAmount = settledQuantityScaled × unitPriceUSDC / 10^quantityDecimals`. `unitPriceUSDC` is supplied by the sponsor at `createDeed` time and is immutable thereafter — no off-chain component, AI or otherwise, can influence it after creation. The test suite (`contracts/tests/helpers.cjs`) uses `1.00 USDC per 1.0 whole settled unit` (e.g. per hectare) purely as an illustrative, arbitrary constant — it is not a claim about what restoration outcomes are actually worth. `quantityDecimals` is stored per-deed (not hard-coded) so the fixed-point scale is explicit and inspectable on-chain, matching whatever scale the off-chain scaling in `arc/identifiers.ts`'s `scaleQuantity` used for that deed.

### 9.8 Events

`DeedCreated`, `DeedFunded`, `DeedCancelled`, `VerificationSubmitted`, `SettlementExecuted`, `RefundExecuted` — all with indexed `deedId`/`verificationId`/party-address fields where useful for later indexing. M5 (The Graph) is not implemented here; these events exist so M5 has clean, complete lifecycle data to index later, per M3 prompt §20-21.

### 9.9 Security review summary

Full review performed against M3 prompt §25 and §32's checklist. Findings:

- **Reentrancy:** `settleDeed` and `refundDeed` (the two fund-moving functions) use OpenZeppelin's `ReentrancyGuard` (`nonReentrant`), in addition to checks-effects-interactions ordering (deed status is updated to its terminal state *before* any external token call). This was verified with a real attack simulation, not just a structural check: `contracts/tests/security.test.cjs`'s reentrancy test deploys a `MaliciousReentrantToken` (test-only) whose `transfer` hook attempts to re-enter `settleDeed` mid-transfer; the reentrant call reverts on the `nonReentrant` guard, which reverts the entire outer transaction, leaving the deed `VERIFIED` (unsettled) and no funds moved.
- **Authorization bypass:** every state-changing function checks `msg.sender` against the specific address authorized for that action on that specific deed (`sponsor` for `cancelDeed`/`fundDeed`/`refundDeed`, `authorizedVerifier` for `submitVerification`); there is no bypass path. Tested directly (`NotSponsor`, `NotAuthorizedVerifier` custom errors) and via dedicated "malicious caller" tests.
- **State-machine bypass:** every transition function's status check (`_requireStatus`) is unconditional; `contracts/tests/security.test.cjs`'s "invalid state transitions are rejected at every stage" test calls every function against a deed in every wrong state and confirms each reverts.
- **Double settlement:** `settleDeed` sets `status = SETTLED` before transferring; a second call reverts `WrongStatus`. Tested directly.
- **Integer overflow/underflow:** Solidity ^0.8.24 has built-in checked arithmetic (reverts rather than wraps); `Math.mulDiv` (OpenZeppelin) is used for the settlement-amount multiply-then-divide specifically to avoid the plain `a*b/c` pattern's intermediate-overflow failure mode when `a*b` alone would exceed 256 bits.
- **Token decimal handling:** `MockUSDC.decimals()` is hard-coded to 6 to match real USDC; `quantityDecimals` is a per-deed, explicit parameter rather than an assumption baked into the contract, so the fixed-point scale is always inspectable.
- **Arbitrary token/beneficiary substitution:** the settlement token is `immutable`, set once at deployment; `beneficiary` and `authorizedVerifier` are fixed per-deed at `createDeed` and never mutated by any other function.
- **Allowance/transfer handling:** `SafeERC20` is used for every transfer (`safeTransferFrom`, `safeTransfer`), which reverts on a falsy/missing return value rather than silently treating it as success — relevant because not every real-world ERC-20 strictly follows the standard's return-value convention.
- **Funding/settlement accounting:** `settleDeed` always pays out `settlementAmount` to the beneficiary and the exact remainder (`fundedAmount - settlementAmount`) back to the sponsor in the same transaction, so no funds are ever left trapped in the contract post-settlement. Verified directly (`no trapped funds` assertion) and via a general invariant test summing beneficiary + sponsor balance deltas to exactly the escrowed amount.
- **Replay attacks:** `consumedVerificationIds` is a contract-wide (not per-deed) mapping; a `verificationId` can settle at most one deed, once, ever — including the `FAILED` branch, so a rejected verification cannot be resubmitted and retried. Tested directly across multiple scenarios.
- **Verification/methodology substitution:** `submitVerification` checks `projectId`, `parcelH3Root`, and `methodologyVersion` hash-equality against the deed before accepting anything; cross-project and cross-methodology substitution attempts are tested directly and rejected.

**Known prototype-level risks not claimed to be resolved:** (1) no cryptographic binding proves the address calling `submitVerification` is really controlled by the Guardian-attested verifier identity it's meant to represent — this is a trust assumption inherited from M2's own documented gap (see docs/GUARDIAN.md §9.9), not newly introduced here, but it is the weakest link in the end-to-end chain; (2) `unitPriceUSDC`/pricing is a prototype convention, not an audited financial mechanism; (3) this contract has not been externally audited — passing tests demonstrates the tested behaviors are correct, not that the contract is production-secure (M3 prompt §25 — "do not claim the contract is production-secure merely because tests pass").

### 9.10 Local testing approach vs. Arc Testnet

**Implemented and run:** `npx hardhat compile` (Solidity compilation, offline per §9.2) and `npx hardhat test` (72 tests against Hardhat's local in-process network). **Not performed:** any testnet or mainnet deployment, any interaction with a real RPC endpoint, any use of testnet USDC. Treat every dollar figure, balance, and "USDC" reference in `contracts/tests/` as local-simulation-only, exactly as `MockUSDC.sol`'s own NatSpec states.

### 9.11 Relationship to M1 and M2 — authority boundary, restated

- M1 (`verification/`) computes `settledQuantity`; M3 never recomputes it.
- M2 (`guardian/`) authorizes a verification and issues a credential *only* for a financially eligible M1 result; M3's `arc/payload.ts` only ever builds an eligible on-chain payload from a real issued `GuardianCredential` (see its own file header for why the ineligible/`FAILED` on-chain path, while implemented and tested in Solidity for defense in depth, has no current M2-originated caller).
- **Guardian does not release Arc funds.** Nothing in `guardian/` calls `arc/` or `RestorationDeed`; the connection is one-directional (M3 consumes M2's output) and entirely off-chain until a human/service holding the `authorizedVerifier` private key submits a transaction.
- **AI is not the direct financial authority, but the boundary is address-based, not cryptographic.** No LLM, agent, or natural-language component exists anywhere in this codebase as of M3. `settleDeed` takes no quantity argument at all — the only quantity that can ever be paid out is the one computed and locked in during `submitVerification`, from an already-authorized M1/M2 pathway. However: **AI cannot release funds without also controlling the `authorizedVerifier` signing key. The off-chain TypeScript checks in `arc/payload.ts` do not independently prevent a malicious or compromised verifier, or an AI agent operating with that verifier's credentials, from producing an authorized settlement payload.** `buildVerificationAuthorization` verifies that a supplied `VerificationResult` and `GuardianCredential` are *internally consistent with each other* — it does not, and cannot, cryptographically prove that either object was produced by a genuine M1/M2 execution, because `computeVerificationResultId` is a public, unkeyed hash function: anyone can construct a self-consistent forged pair (demonstrated directly in `arc/tests/payload.test.ts`, the `[TRUST BOUNDARY]` test). **The `RestorationDeed.authorizedVerifier` address check on-chain — not anything in `arc/` — is the actual, sole financial authorization boundary.** The prototype does not cryptographically prove Guardian identity on-chain. See §9.9 above and the M3 security review for the full analysis; this paragraph was corrected in M3.1 after that review found the original wording ("AI does not release Arc funds") overstated what the off-chain code actually enforces.
- **The contract is the financial settlement authority.** `RestorationDeed` is the only component in this repository that can move escrowed USDC.

---

## 10. M3.1 — Security Patch / Trust-Boundary Closure

Small, targeted patch applied after the M3 security review, before M4 began. No architecture was redesigned.

### 10.1 `quantityDecimals` bound (security review finding C1)

`createDeed` previously accepted any `uint8` value (0–255) for `quantityDecimals` with no validation. A value above ~77 makes `10 ** quantityDecimals` overflow inside `submitVerification`'s eligible branch, permanently blocking that one deed from ever settling with a real eligible outcome (though it remained refundable via `FAILED → REFUNDED`). This was never a fund-theft vector — only a self-inflicted misconfiguration risk for the deed's own sponsor — but it was unvalidated input.

**Fix:** `createDeed` now reverts `InvalidDeedParameters("quantityDecimals exceeds maximum")` if `quantityDecimals > MAX_QUANTITY_DECIMALS` (a new `public constant` set to `18`, matching the common ERC-20 decimals convention and comfortably exceeding the `6` this prototype actually uses). Existing deeds using 6-decimal quantities are unaffected; tested directly (boundary at 18 accepted, 19 rejected, normal settlement still works at both the default and the boundary value).

### 10.2 Trust-boundary wording correction (security review finding B1)

The M3 documentation previously stated **"AI does not release Arc funds"** without qualification. The M3 security review found this overstated what the code actually enforces: the off-chain `arc/payload.ts` checks only verify that a supplied `VerificationResult` and `GuardianCredential` are *mutually consistent*, not that either was genuinely produced by M1/M2 — `computeVerificationResultId` is a public, unkeyed hash, so a caller can fabricate a self-consistent forged pair with no special access. §9.11 above has been corrected to state the precise boundary: **AI cannot release funds without also controlling the `authorizedVerifier` signing key**, and the off-chain checks provide no independent protection against a compromised or malicious holder of that key. This is now also demonstrated directly, not just documented: `arc/tests/payload.test.ts`'s `[TRUST BOUNDARY]` test constructs a fully forged, internally-consistent `VerificationResult`/`GuardianCredential` pair from scratch and shows `buildVerificationAuthorization` accepts it. This is a deliberate test of the documented prototype boundary, not a bug report — closing it would require real cryptographic signatures and key infrastructure, which is explicitly out of scope for M3.1 (deferred to a future milestone; not decentralized verifier governance, not key rotation, not multisig).

### 10.3 What M3.1 explicitly did not do

Per its own scope: no signatures, no key infrastructure, no Guardian cryptographic identity, no multisig, no key rotation, no decentralized verifier governance. `RestorationDeed.authorizedVerifier` remains the actual financial authorization boundary, unchanged in mechanism — only its surrounding documentation and the `quantityDecimals` input validation changed.

---

## 11. M4 — Vertical Integration

M4 connects M1 → M2 → this contract into one executable local chain for the synthetic Kootenay BC project, using only the already-existing, already-tested components from M1/M2/M3/M3.1. No new financial logic, no new authorization mechanism, and no new Solidity was written for M4; `RestorationDeed.sol` is unchanged from M3.1.

### 11.1 What "real" and "local"/"mock" mean here

To avoid the ambiguity flagged in earlier drafts of this milestone's own test names:

- **Real (genuinely executed, not fabricated):** `verifyProject()` (M1), `MockGuardianAdapter`'s workflow logic (M2), `arc/payload.ts`'s payload construction, `RestorationDeed.sol`'s Solidity execution on a local EVM.
- **Mock / local (not live sponsor infrastructure):** `MockGuardianAdapter` (no Hedera Consensus Service, no Guardian policy engine), `MockUSDC` (not real USDC), Hardhat's in-process local network (not Arc Testnet or Mainnet).
- **Not implemented:** live Hedera Guardian deployment, live Arc deployment, production USDC, any RPC endpoint or private key.

Test names and comments across `integration/`, `arc/tests/`, and `contracts/tests/endToEnd.test.cjs` were corrected during M4 finalization to say "Mock Guardian credential" / "local RestorationDeed settlement" rather than an unqualified "real Guardian" / "real Arc settlement", which could otherwise be misread as a claim of live sponsor infrastructure.

### 11.2 What was built

- `integration/restorationSettlementFlow.ts` — `prepareSettlementAuthorization()`, the sole orchestration function. It calls, in order and without reimplementing any of them: `verifyProject` (M1) → `guardian.submitVerificationResult` → `guardian.authorizeVerification` → `guardian.issueCredential` (M2) → `buildVerificationAuthorization`/`buildDeedIdentity` (M3's `arc/`). It fails closed (returns `{eligible: false, reason}`) the moment any step rejects or `qualityGateStatus !== "PASS"`, before any on-chain payload is ever constructed.
- `integration/tests/restorationSettlementFlow.test.ts` — vitest coverage of the successful path, determinism, the `INSUFFICIENT_EVIDENCE` and `INVALID_RESULT` fail-closed paths, a tampered-result case caught by Guardian's own integrity check (`guardian/validation.ts`), and explicit quantity/methodology traceability assertions.
- `contracts/tests/endToEnd.test.cjs` — a Hardhat test that runs the complete chain against a real deployed (local) `RestorationDeed` + `MockUSDC` pair: `prepareSettlementAuthorization()` → `createDeed` → `fundDeed` → `submitVerification` (with the real, unmodified on-chain payload) → `settleDeed`, plus two failure paths (unauthorized verifier, methodology mismatch) using that same real payload.

### 11.3 The successful path, traced

```text
FIXTURE_PARTIAL_SETTLEMENT (synthetic Kootenay project)
  -> verifyProject()                              [M1, real]
  -> qualityGateStatus === "PASS", verificationStatus === "PARTIAL"
  -> guardian.submitVerificationResult / authorizeVerification / issueCredential   [M2, Mock Guardian]
  -> buildVerificationAuthorization() -> settledQuantityScaled                     [M3 arc/, real]
  -> RestorationDeed.createDeed / fundDeed(MockUSDC) / submitVerification / settleDeed   [M3 contract, local Hardhat]
  -> beneficiary receives settlementAmount; sponsor receives the remainder
```

`contracts/tests/endToEnd.test.cjs` asserts directly that `outcome.verificationResult.settledQuantity === outcome.verificationResult.lowerBound` (the conservative M1 rule) and that the on-chain `settledQuantityScaled` recorded on the deed equals `Math.round(settledQuantity * 10**quantityDecimals)` — i.e. the number that ultimately moves USDC traces back to M1's own deterministic lower-bound output, not to any value invented in `integration/`, `arc/`, or the test itself.

### 11.4 Failure paths covered

| Case | Where it's caught | Test |
|---|---|---|
| `INSUFFICIENT_EVIDENCE` (parallel-trend failure) | `prepareSettlementAuthorization` fails closed before any Guardian authorization or on-chain payload | `integration/tests/restorationSettlementFlow.test.ts` |
| `INVALID_RESULT` (invalid uncertainty config) | Guardian's `submitVerificationResult` rejects outright | `integration/tests/restorationSettlementFlow.test.ts` |
| Tampered `VerificationResult` presented at authorization | Guardian's existing `validateSubmissionIntegrity` re-hash check | `integration/tests/restorationSettlementFlow.test.ts` |
| Unauthorized verifier submits the real payload | `RestorationDeed`'s `authorizedVerifier` check (`NotAuthorizedVerifier`) | `contracts/tests/endToEnd.test.cjs` |
| Methodology mismatch between the real payload and the deed | `RestorationDeed`'s identity check (`VerificationIdentityMismatch`) | `contracts/tests/endToEnd.test.cjs` |
| Replay / double settlement | Contract-wide `consumedVerificationIds`; `settleDeed`'s `WrongStatus` guard on a second call | `contracts/tests/verification.test.cjs` ("replay protection"), `contracts/tests/settlement.test.cjs` ("rejects double settlement") — generic contract-level coverage exercised via the same code path the real M4 payload uses, not duplicated here |

### 11.5 Known limitations (unchanged from M3/M3.1)

M4 introduces no new trust mechanism and closes no existing gap. The financial authorization boundary is still exactly `RestorationDeed.authorizedVerifier` (an Ethereum address, not a cryptographic binding to a Guardian-attested identity) — see §9.9/§9.11 and §10.2 above. `MockUSDC` is not production USDC; the local Hardhat network is not Arc Testnet or Mainnet; `MockGuardianAdapter` is not a live Hedera Guardian deployment; the contract has not been externally audited.

### 11.6 Validation

`npm run typecheck`: 0 errors. `npm test` (vitest): 88/88 passed across 11 files (the 81 pre-existing M1/M2/M3/M3.1 tests plus the M4 `integration/` tests). `npx hardhat compile`: succeeds. `npm run test:contracts` (Hardhat): 84/84 passed, including the three M4 end-to-end tests. See `docs/DEVELOPMENT_LOG.md`'s M4 entry for the full, dated record.
