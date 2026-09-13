# Development Log

Chronological record of real implementation work, decisions, and deviations for each milestone. Entries are appended, not rewritten.

---

## M1 — Deterministic Spatial Verification Engine

**Date:** 2026-09-10
**Scope:** `verification/` only, per the M1 prompt's "Architecture Boundaries" (§16).

### What was built

- `verification/models.ts` — TypeScript data models: `Project`, `Parcel`, `EvidenceObservation`, `MethodologyConfiguration`, `Uncertainty`, `QualityGateStatus`, `VerificationStatus`, `VerificationResult`, and supporting types (`ParcelCharacteristics`, `ObservationWindow`, `VerificationDiagnostics`, etc.). `BaselineObservation` and `ControlObservation` are documented type-level narrowings of `EvidenceObservation` rather than separate wire shapes (see rationale in the file).
- `verification/config.ts` — `M1_METHODOLOGY_VERSION` (`ecorestore-m1-v0.1`), `DEFAULT_METHODOLOGY_CONFIG`, and a second `STRICT_METHODOLOGY_CONFIG` used only to test configuration-sensitivity.
- `verification/calculations/` — one pure-function module per pipeline stage: `spatialIdentity.ts`, `evidenceHash.ts`, `observationGrouping.ts`, `controlMatching.ts`, `parallelTrend.ts`, `differenceInDifferences.ts`, `additionality.ts`, `uncertainty.ts`, `qualityGate.ts`, `inputValidation.ts`.
- `verification/engine.ts` — `verifyProject(project, config)`, the single pure entry point that runs the full pipeline and returns a canonical `VerificationResult`.
- `verification/fixtures.ts` — six synthetic "Kootenay Riparian Restoration" (British Columbia, fictional) fixtures covering the success/partial/verified paths and every required failure path.
- `verification/tests/` — 45 vitest tests across 6 files, including a dedicated test proving a failed parallel-trend diagnostic cannot produce a valid settlement quantity, and a dedicated determinism test.
- `docs/VERIFICATION.md` — appended §16 "M1 Implementation Notes" documenting the synthetic dataset, matching rule, contamination rule, parallel-trend diagnostic, DiD formula, additionality conversion, uncertainty simplification, lower-bound rule, quality gates, methodology version, and known limitations.

### Configuration fix required before any of the above would compile

M0's `package.json` had `"type": "commonjs"`, but `tsconfig.json` already had `"module": "nodenext"` with `"verbatimModuleSyntax": true`. That combination is internally inconsistent: `verbatimModuleSyntax` requires the compiler to preserve `import`/`export` syntax verbatim in the emitted output, which is impossible if the emitted output must be CommonJS (Node's CJS loader doesn't understand `import`/`export` keywords). Every file using `export function`/`export const` failed to typecheck with `TS1287`, and plain `import { ... }` statements failed with `TS1295`, before any M1 code was even reached.

**Fix:** changed `package.json`'s `"type"` from `"commonjs"` to `"module"`, which is what the existing `tsconfig.json` settings already assumed. This is an ESM project now. Relative imports in `.ts` files under `verification/` use explicit `.js` extensions (e.g. `from "./models.js"`), which is the standard (and here, required) convention for TypeScript's `NodeNext` module resolution in ESM mode — the extension refers to the file the compiler will resolve to `models.ts`'s output, not a literal file that needs to exist.

Also added `"types": ["node"]` to `tsconfig.json`'s `compilerOptions`, which had been left as `"types": []`. `verification/calculations/evidenceHash.ts` uses Node's built-in `node:crypto` for SHA-256 hashing (`createHash`), which requires `@types/node` (already a devDependency) to actually be included in the type-checking scope.

Both changes are scoped to project-wide config files, not to `app/` or any other M0 area, and were necessary for **any** TypeScript file with exports to typecheck under M0's own `tsconfig.json` — not an M1 scope expansion.

### Environment fix required before tests would run

The uploaded workspace's `node_modules` contained Windows-native optional-dependency binaries (e.g. `@rolldown/binding-win32-...`) that don't run on this Linux environment; `vitest` failed at startup with "Cannot find native binding." Ran `rm -rf node_modules package-lock.json && npm install` to reinstall platform-appropriate binaries. No `package.json` dependency versions were changed by this — same declared dependencies, regenerated lockfile and native bindings for the current platform.

### Scientific/methodology decisions (see docs/VERIFICATION.md §16 for full detail)

1. **Metric:** single metric `canopy_cover_fraction_pct` (0-100 fractional cover), not the proposal's hectare-gain metric directly. Hectares are derived at the additionality step (`(DiD / 100) * treatedParcel.areaHectares`) so the canonical result's units match the proposal's `claimedQuantity` framing (hectares) while the underlying observations are a plain, easy-to-reason-about percentage.
2. **Pre-treatment trend, not a single baseline point:** each parcel has two pre-treatment observations (~2 years apart) specifically so the parallel-trend diagnostic has a real two-point slope to compare, rather than needing to be stubbed out. This was a deliberate fixture-design choice to make §7-8 of the M1 prompt testable end-to-end.
3. **Control level/change is an average of each control's own change**, not the change between group-averaged levels. Documented in `differenceInDifferences.ts` and §16.5 — the two are numerically identical for equal-sized control groups but conceptually different, and the implementation is explicit about which one it computes.
4. **`VerificationStatus` adds `VERIFIED` vs. `PARTIAL`** on top of the M1 prompt's `QualityGateStatus` vocabulary (`PASS` / `INSUFFICIENT_EVIDENCE` / `INVALID_RESULT`). This isn't specified verbatim in the prompt, but §14 of the prompt requires both `claimedQuantity` and `settledQuantity` on the canonical result, and collapsing every quality-gate `PASS` into one status would discard the signal those two fields exist to carry (over-claim vs. fully-supported claim). Flagged here as an explicit interpretive choice, not a silent addition.
5. **Uncertainty model is a fixed relative-fraction margin** (`relativeUncertaintyFraction: 0.15` by default), explicitly documented as not a validated statistical interval. `confidenceLevel` is carried as a declared label, not used to derive the margin in this simplified model — this asymmetry is called out in three places (models.ts, uncertainty.ts, docs/VERIFICATION.md §16.7) so it isn't missed.
6. **Settlement is clamped to `max(0, lowerBound)`** — a negative "gain" is not a settleable quantity in this prototype. This wasn't explicitly specified in the prompt; added because the fixed-fraction uncertainty model can in principle push a small point estimate's lower bound negative, and a negative settlement quantity would be nonsensical for this domain.

### Simplifications explicitly out of scope for M1 (per the prompt's Architecture Boundaries)

No Hedera, Guardian, Arc, USDC, The Graph, x402, Circle Agent Stack, Privy, LLM APIs, AI agents, satellite APIs, IPFS/Filecoin, or live credentials were implemented or referenced. `evidenceCid` exists as a reserved (always-omitted) field on `VerificationResult` per the prompt's explicit allowance in §14, but nothing populates it.

### Tests run and results

- `npm run typecheck` (`tsc --noEmit`): **0 errors.**
- `npm test` (`vitest run`): **45/45 tests passed**, 6 test files, ~1.2s. Includes:
  - the required test proving a failed parallel-trend diagnostic cannot produce a valid settlement quantity (`engine.test.ts`, "CRITICAL INVARIANT" describe block, re-checked against a second methodology configuration too);
  - the required determinism test (`engine.test.ts`, three repeated runs asserted equal, plus a separate determinism check on the blocked path);
  - contaminated-control exclusion, non-matching-control exclusion, parallel-trend PASS/FAIL/INSUFFICIENT_EVIDENCE, DiD arithmetic, additionality conversion, uncertainty bounds and invalid-configuration handling, conservative lower-bound settlement, missing/invalid evidence, invalid `claimedQuantity`, insufficient eligible controls, methodology-version/config sensitivity, and evidence-hash order-insensitivity.
- Lint: **not run** — no lint tooling is configured anywhere in the repository (no ESLint config exists outside the already-deleted `app/` scaffold, and no `lint` script exists in `package.json`). Per the M1 prompt §18 ("do not add libraries unless they provide clear value to M1") and §21 ("if a command cannot run, report the exact reason"), no linter was added; `tsc --noEmit` under the repo's existing strict settings (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`) was treated as the primary static-analysis gate for M1.
- Build: **not applicable** — `app/` (the only buildable target) was not touched by M1 and no build script exists for the root package.

### Pre-existing, unrelated working-tree state (not touched by M1)

At the start of this milestone, `git status` already showed uncommitted changes unrelated to M1: a deleted `app/` Vite/React scaffold, and what first appeared to be content edits to several `docs/*.md` files and `node_modules/.bin/*` scripts but were confirmed (via `git diff --stat`, 252 insertions / 252 deletions on a 504-line file) to be CRLF/LF line-ending noise from checkout, not real content changes. None of this was staged or committed as part of M1; only files this milestone actually authored or had to modify to compile/run were committed.

### Known limitations

See docs/VERIFICATION.md §16.12 for the full list. Headline items: single metric, single treated parcel per project, rule-based (not propensity-score) control matching, two-point (not regression-based) trend diagnostic, non-statistical uncertainty model, and placeholder (non-cryptographic, non-H3) spatial identity and evidence-hash values.

### Recommended next step

M2: determine how Hedera Guardian consumes the canonical `VerificationResult` produced here (methodology/workflow representation, verifier roles, verification state transitions) — per docs/ARCHITECTURE.md's authority model, Guardian owns methodology and workflow, not scientific calculation, so M2 should treat `verifyProject`'s output as an opaque, already-computed input rather than re-deriving any of it.

---

## M2 — Hedera Guardian (Workflow, Credential, Outcome Layer)

**Date:** 2026-09-11
**Scope:** `guardian/` only. M1 (`verification/`) was not modified in any way — confirmed by full M1 regression pass (see Tests below).

### What was built

- `guardian/models.ts` — Guardian-facing domain types: `EvidenceSubmission`, `VerificationSubmission`, `Verifier`, `AuthorizedVerification`, `GuardianCredential`, `RestorationOutcome`, `LifecycleState`, and the `{accepted: true, ...} | GuardianRejection` result unions used by every adapter operation.
- `guardian/identifiers.ts` — deterministic SHA-256-based identifiers (`computeVerificationResultId`, `computeEvidenceSubmissionId`, `computeCredentialId`, `computeOutcomeId`) over canonicalized (key-sorted) JSON, independent of `verification/calculations/evidenceHash.ts` (which hashes raw evidence for M1, not Guardian records).
- `guardian/policy/methodologyRegistry.ts` — `GUARDIAN_POLICY_VERSION` (`ecorestore-guardian-m2-v0.1`) and an explicit `SUPPORTED_METHODOLOGY_VERSIONS` allowlist (currently `["ecorestore-m1-v0.1"]`).
- `guardian/policy/verifierRegistry.ts` — a mocked, hard-coded authorized-verifier allowlist.
- `guardian/schemas/{shapeValidation,evidenceSubmissionSchema,verificationResultSchema}.ts` — structural (identity-field-presence) validation only, no schema library added.
- `guardian/validation.ts` — `validateMethodologyVersion` and `validateSubmissionIntegrity` (tamper detection via identifier re-derivation).
- `guardian/adapter.ts` — the `GuardianAdapter` interface and `MockGuardianAdapter`, the actual workflow engine: `submitEvidence`, `submitVerificationResult`, `authorizeVerification`, `issueCredential`, `recordOutcome`, `getLifecycleState`.
- `guardian/tests/{identifiers,adapter}.test.ts` — 21 new tests, including all nine required security tests (A-I) from the M2 prompt §14.
- `docs/GUARDIAN.md` — appended §9 documenting the full M2 implementation, mock-vs-production table, and known limitations.

### Note on starting state

Several `guardian/` files (`models.ts`, `identifiers.ts`, `validation.ts`, `policy/*`, `schemas/*`) already existed, fully implemented, in the working tree at the start of this session — carried over from earlier work in this same task before a context boundary. They were reviewed in full before proceeding and found to be correct, consistent with `docs/GUARDIAN.md`'s authority model, and consistent with the M1 `VerificationResult` shape; no changes were needed. `guardian/adapter.ts` (0 bytes) and all of `guardian/tests/` were the only pieces actually written in this session.

### Key implementation decisions

1. **`INVALID_RESULT` is rejected outright at `submitVerificationResult`; `INSUFFICIENT_EVIDENCE` is accepted but marked `financiallyEligible: false`.** The M2 prompt's §7 and §14 (Tests B and C) describe different required outcomes for these two statuses ("not financially eligible" vs. "rejected"), which this distinction satisfies directly: `INVALID_RESULT` means the M1 pipeline itself flagged its own output as untrustworthy (e.g. an invalid uncertainty configuration), which is not a legitimate workflow item at all; `INSUFFICIENT_EVIDENCE` means the pipeline ran correctly and correctly found the evidence insufficient — a legitimate, auditable claim worth recording so a restorer can see why and potentially resubmit.
2. **`getLifecycleState(projectId, parcelH3Root)`, not `getLifecycleState(verificationResultId)`.** The M2 prompt lists "retrieve lifecycle state" as a required operation without fixing its signature. Keying by verification-result identity cannot represent the `EVIDENCE_SUBMITTED` stage, since evidence is submitted before any verification result exists for a parcel. Keying by project+parcel makes the full five-stage lifecycle (`EVIDENCE_SUBMITTED → VERIFICATION_SUBMITTED → VERIFICATION_AUTHORIZED → CREDENTIAL_ISSUED → OUTCOME_RECORDED`) representable end to end, and every value in the `LifecycleState` union is actually reachable.
3. **`VerificationSubmission.submissionId` reuses `computeVerificationResultId`'s output** rather than introducing a second identifier. One verification result is the natural unit of a verification submission; a separate submission-id scheme would add indirection without adding meaning.
4. **Lifecycle transitions are monotonic** (`setLifecycleIfAdvancing` in adapter.ts) — a later call with an earlier stage never regresses the recorded state, so `getLifecycleState` is a progress indicator, not a "last operation" log.
5. **Credential issuance requires the same verifier who authorized the verification.** Not explicitly required by the prompt, but a direct consequence of "Guardian may... identify authorized verifier roles" — allowing a different, even authorized, verifier to claim credit for someone else's authorization would break the provenance the M2 prompt's Test I requires.

### The AI-authority-boundary gap this milestone documents rather than closes

Test G ("AI-generated quantity without M1 result -> rejected") is satisfied at the *shape and methodology* layer: an object lacking `projectId`/`parcelH3Root`/`methodologyVersion`/`evidenceHash`, or carrying an unrecognized methodology version, is rejected by `submitVerificationResult` regardless of what numeric quantity it carries. However, M2 does **not** cryptographically prove that a shape-valid, methodology-valid `VerificationResult` actually came from `verifyProject()` — Guardian trusts the caller to have supplied a genuine M1 output. Closing this gap in production would mean M1 signs its output (e.g. with a key Guardian's policy is configured to trust) so Guardian can verify provenance, not just shape. This is recorded as a known limitation in `docs/GUARDIAN.md` §9.9, not silently left undocumented.

### Simplifications explicitly out of scope for M2 (per the prompt's boundaries)

No live Hedera Guardian deployment, no Guardian policy JSON/engine, no Hedera Consensus Service submission, no DID infrastructure, no Arc/USDC settlement, no Graph indexing, no x402, no LLM/AI component, no React UI (`app/` remains absent, as instructed).

### Tests run and results

- `npm run typecheck` (`tsc --noEmit`): **0 errors.**
- `npm test` (`vitest run`): **66/66 tests passed**, 8 test files (~1.5s): the 45 existing M1 tests (unchanged, full regression pass) plus 21 new M2 tests (14 in `adapter.test.ts`, 7 in `identifiers.test.ts`). The 14 adapter tests cover all of Tests A-I from the M2 prompt §14 (Test G is split into two sub-tests: rejection at submission, and defense-in-depth rejection at authorization) plus four additional parameter-table checks (missing identity fields, authorization against a never-submitted id, the insufficient-controls fixture, and an explicit M1-regression spot-check from within the Guardian test file).
- Lint: not run — same reasoning as M1 (no lint tooling configured in the repository; not added per §18).
- Build: N/A — no build script exists; `app/` remains absent as instructed.

### Documentation

`docs/GUARDIAN.md` §9 added. `docs/ARCHITECTURE.md` was reviewed but **not modified** — its existing "Guardian owns: methodology, policy workflow, verifier roles, evidence/credential structure, verification state, restoration outcome lifecycle" description already matched what M2 built with no material change needed, and the prompt only calls for updating it "where M2 materially changes the architecture" (§17).

### Known limitations

See `docs/GUARDIAN.md` §9.9. Headline items: no cryptographic binding from Guardian back to a genuine M1 execution (see "AI-authority-boundary gap" above); single verifier role; no revocation/reversal path; no live Hedera integration of any kind.

### Recommended next step

M3: Arc financial settlement. Arc's `verifyMilestone()` will require a Guardian-issued credential/authorized-verification as a precondition for `releaseTranche()` — that wiring does not exist yet and was not built in M2.

---

## M3 — Arc Financial Settlement Layer

**Date:** 2026-09-11
**Scope:** `contracts/`, `arc/`, plus toolchain additions (Hardhat, OpenZeppelin, solc) and their config files (`hardhat.config.cjs`, `vitest.config.ts`). `verification/` and `guardian/` were not modified — confirmed by full regression pass (60/60 M1+M2 tests unchanged).

### What was built

- `contracts/RestorationDeed.sol` — the financial settlement contract. State machine `CREATED → FUNDED → VERIFIED → SETTLED`, with `CANCELLED`/`REFUNDED`/`FAILED` failure paths. USDC escrow via OpenZeppelin `SafeERC20`. Settlement quantity consumed from an already-computed, already-authorized payload — never recalculated on-chain. Contract-wide replay protection (`consumedVerificationIds`). `ReentrancyGuard` on both fund-moving functions.
- `contracts/MockUSDC.sol` — a local test-only ERC-20 (OpenZeppelin `ERC20`, 6 decimals, unrestricted `mint`), explicitly documented as not real USDC.
- `contracts/tests/{helpers,deedCreation,funding,verification,settlement,security}.test.cjs` — 72 Hardhat/Mocha tests, including a real reentrancy-attack simulation (`MaliciousReentrantToken.sol`, a test-only fixture contract).
- `arc/{identifiers,payload,adapter}.ts` — the TypeScript integration boundary: `identifiers.ts` (keccak256 hashing of off-chain string identifiers, floating-point-to-fixed-point quantity scaling), `payload.ts` (builds the on-chain `VerificationAuthorization` struct from a real M1 `VerificationResult` + M2 `GuardianCredential`, with defense-in-depth re-validation), `adapter.ts` (`ArcAdapter`, a thin ethers v6 wrapper around the deployed contract's ABI).
- `arc/tests/{identifiers,payload}.test.ts` — 15 vitest tests for the pure/deterministic parts of `arc/`.
- `docs/ARC.md` §9 — full M3 implementation documentation including a dedicated security review write-up.
- `.gitignore` — added (did not previously exist); covers `node_modules/` going forward and the new Hardhat build-artifact directories (`contracts/.cache/`, `contracts/.artifacts/`). Pre-existing tracked `node_modules` content from M0 was not retroactively removed — that is a larger, out-of-scope cleanup decision, not an M3 concern.

### Toolchain decisions and environment constraints

1. **Hardhat 2.x, not Hardhat 3.x.** Hardhat 3 is a significant rewrite (viem-first, different config/plugin architecture) released after a point where fully reliable, error-free one-shot configuration was less certain; Hardhat 2.29.1 + `@nomicfoundation/hardhat-ethers@3.1.3` + `hardhat-chai-matchers@2.1.2` + `hardhat-network-helpers@1.1.2` is a long-stable, well-understood combination, chosen deliberately for a security-sensitive milestone where toolchain surprises are costly.
2. **Offline solc resolution.** This sandbox's network egress allowlist does not include `binaries.soliditylang.org`, which is where Hardhat's built-in compiler manager fetches `solc` by default — confirmed by an early, deliberate probe (see below) before writing any contract code, to avoid discovering this blocker after significant work was already invested. `hardhat.config.cjs` overrides the `TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD` subtask to resolve solc from the `solc` npm package (installed from the standard, allowed npm registry) instead. This is a documented, standard Hardhat pattern, not a change to Solidity compilation behavior. **Root-caused and fixed one real bug in this override during implementation:** the first working version of `hardhat.config.cjs` never actually `require()`d `@nomicfoundation/hardhat-ethers`/`hardhat-chai-matchers`/`hardhat-network-helpers`, so `ethers` was silently absent from the Hardhat Runtime Environment. Diagnosed by tracing a `Cannot read properties of undefined (reading 'keccak256')` failure back through a minimal debug script before writing the real test suite.
3. **CJS test files under `contracts/tests/`, ESM elsewhere.** The root `package.json` is `"type": "module"` (see M1's dev log entry), but Hardhat 2's Mocha-based test runner and `require("hardhat")`-based plugin loading are CommonJS-oriented. Rather than fight that mismatch, `contracts/tests/*.test.cjs` are plain CommonJS (explicit `.cjs` extension, which always wins over the nearest `package.json` `"type"` field in Node's module resolution) and use `require`, not `import`. `vitest.config.ts` excludes `contracts/**` so vitest's default test-file glob does not also try to import these Mocha-style files and fail.
4. **`arc/` is ESM TypeScript** (matching `verification/`/`guardian/`), tested via vitest for its pure logic only. `ArcAdapter` (the ethers-wrapping class) is not separately live-network-tested in this milestone — its correctness is validated transitively, since it calls the exact same contract functions with the exact same argument shapes `contracts/tests/` already exercises directly. Standing up a second, cross-toolchain (ESM vitest ↔ CJS Hardhat network) live-network test harness was judged not worth the added moving parts for this milestone's scope; documented as a reasonable follow-up, not a gap being hidden.

### Key implementation decisions

1. **Two on-chain states collapsed into one (`RESTORATION_ACTIVE`/`VERIFICATION_PENDING` → `FUNDED`).** Documented in detail in `docs/ARC.md` §9.3 and in the contract's own NatSpec: nothing on-chain can observe the difference between "restoration is happening" and "evidence is under Guardian review" — that distinction is Guardian's (M2), not Arc's, to track.
2. **`financiallyEligible: false` submissions move a deed to `FAILED`, consuming the verification id, rather than being rejected outright at the contract level.** Mirrors the M2 `INSUFFICIENT_EVIDENCE` design choice (accepted-but-ineligible, not rejected) — Arc records that a verification was authorized and reviewed, just not favorably, giving the sponsor a `FAILED → REFUNDED` path rather than leaving the deed stuck.
3. **`settleDeed` is intentionally permissionless.** By the time a deed is `VERIFIED`, both the recipient and the amount are already fixed and immutable; letting any address trigger the mechanical payout removes a liveness dependency on any single party without weakening authorization (the actual authorization decision already happened in `submitVerification`).
4. **Settlement always returns any unused escrow to the sponsor in the same transaction as the payout**, rather than requiring a separate claim — chosen specifically to guarantee no funds are ever left trapped in the contract post-settlement (tested directly).
5. **`arc/payload.ts` only builds eligible payloads**, because M2's `guardian/adapter.ts` only ever issues a `GuardianCredential` for an eligible submission — there is currently no Guardian-authorized *ineligible* object for the adapter to translate. The contract's `FAILED` branch is still implemented and tested directly in Solidity (defense in depth / future extension), just not currently exercised through the TS adapter's happy path. Flagged explicitly rather than silently built and left undocumented.
6. **`Math.mulDiv` (OpenZeppelin) instead of plain `a * b / c`** for the settlement-amount calculation, to avoid the intermediate-overflow failure mode a naive multiply-then-divide has when the two operands' product alone would exceed 256 bits, even though the final result fits.

### Tests run and results

- `npm run typecheck` (`tsc --noEmit`): **0 errors.**
- `npm test` (`vitest run`): **81/81 passed**, 10 files (~2.4s) — the 45 M1 + 21 M2 tests, all unchanged and still passing (full regression confirmed), plus 15 new `arc/` tests.
- `npx hardhat compile`: succeeds (offline, per the solc note above).
- `npx hardhat test` (`contracts/tests/`): **72/72 passed** (~3s) across 5 files: creation/cancellation (17), funding/refunds (9), verification submission (26), settlement (10), and dedicated security invariants (13, including one real reentrancy-attack simulation, not a structural placeholder).
- Lint: not run — same reasoning as M1/M2 (no lint tooling configured; not added per dependency-discipline guidance).
- Build: no application build target exists (`app/` remains absent, as instructed); Solidity "build" is `hardhat compile`, covered above.

### Documentation

`docs/ARC.md` §9 added (state machine, escrow model, verifier authorization model, settlement quantity model, pricing convention, events, a full security-review write-up, local-vs-testnet status, and explicit restatement of "Guardian does not release funds, AI does not release funds, the contract is the sole financial authority"). `docs/ARCHITECTURE.md` reviewed, **not modified** — its existing "Arc owns: Restoration Deed, USDC escrow, milestone conditions, authorized verification, release/withholding" description already matched what M3 built.

### Known limitations

See `docs/ARC.md` §9.9 and §9.11. Headline items: no cryptographic binding proves the address calling `submitVerification` is really controlled by the Guardian-attested verifier it's meant to represent (inherited trust gap from M2, not newly introduced); `unitPriceUSDC` pricing is an explicit prototype convention, not an audited financial mechanism; the contract has not been externally audited; no Arc Testnet deployment was performed.

### Recommended next step

M4/M5 per the project's milestone sequence (not started, per this prompt's explicit stop instruction). The Graph (M5) will index the events already emitted here (`DeedCreated`, `DeedFunded`, `VerificationSubmitted`, `SettlementExecuted`, `RefundExecuted`); no Graph schema or indexing was built in M3.

---

## M3.1 — Security Patch / Trust-Boundary Closure

**Date:** 2026-09-11
**Scope:** `contracts/RestorationDeed.sol` (one small addition), `contracts/tests/m3_1SecurityPatch.test.cjs` (new), `arc/tests/payload.test.ts` (one test added), `docs/ARC.md`, `package.json`/`package-lock.json` (one new devDependency, `cross-env`).

### What was done

1. **`quantityDecimals` bound (security review finding C1).** Added `MAX_QUANTITY_DECIMALS = 18` (public constant) and a `createDeed` validation reverting `InvalidDeedParameters` above it. Tested: boundary value (18) accepted, one above (19) rejected, and settlement still works correctly both at the default (6) and at the boundary (18) decimals.
2. **Trust-boundary wording correction (security review finding B1).** `docs/ARC.md` §9.11's "AI does not release Arc funds" replaced with the precise statement: AI cannot release funds *without also controlling the `authorizedVerifier` signing key*, and the off-chain checks provide no independent protection against a compromised or malicious holder of that key. A new §10 documents the patch itself.
3. **The trust boundary is now demonstrated, not just documented.** `arc/tests/payload.test.ts` gained a `[TRUST BOUNDARY]` test that fabricates a complete, internally-consistent `VerificationResult` + `GuardianCredential` pair from scratch (neither from a real `verifyProject()`/`issueCredential()` call) and shows `buildVerificationAuthorization` accepts it — because `computeVerificationResultId` is a public, unkeyed hash, internal consistency requires no special access to produce. This is a deliberate characterization test of an accepted prototype limitation, not a regression test for a bug being fixed.
4. **Nine new contract-level tests** (`contracts/tests/m3_1SecurityPatch.test.cjs`): Test A (settleDeed rejects a REFUNDED deed, from both the FUNDED→REFUNDED and FAILED→REFUNDED paths, plus double-refund), Test B (a second `submitVerification` call cannot move a FAILED deed to VERIFIED), Test D (the quantityDecimals boundary, both directions, plus two settlement-still-works checks).

### A toolchain addition required to write Test E properly (carried into M4)

Test E (§3.4) — a real end-to-end chain from `verifyProject()` through `submitVerification()` — needs the M1/M2/`arc/` ESM TypeScript modules loadable from inside a Hardhat/Mocha CommonJS test file. Node's dynamic `import()` can load ESM from CJS natively, but the `.ts` sources (referenced via NodeNext's `./foo.js`-resolves-to-`./foo.ts` convention) still need a TypeScript-aware loader active in the process. Added `cross-env` (a small, standard, single-purpose devDependency for cross-platform environment variables) and changed the `test:contracts` script to `cross-env NODE_OPTIONS=--import=tsx hardhat test`, which registers `tsx`'s ESM loader before Hardhat spawns Mocha. Verified with a throwaway probe test before writing anything real, then removed the probe. This does not change any test's behavior — it only makes cross-module-system dynamic imports resolve; the existing 72 (now 81) CJS-only tests are unaffected, confirmed by a full regression run both with and without the wrapper.

Per the prompt's guidance ("if this full chain belongs more naturally in M4, implement it as the first M4 integration test"), Test E itself is implemented in M4 — see that entry below — using this same mechanism.

### M3.1 acceptance gate

```text
M3.1: PASS

Tests: 82/82 vitest (unchanged M1/M2/arc regression + 1 new trust-boundary test)
       81/81 hardhat (72 existing + 9 new M3.1 contract tests)

TypeScript: PASS (tsc --noEmit, 0 errors)
Solidity:   PASS (hardhat compile)

Documentation: PASS (docs/ARC.md §9.11 corrected, §10 added)

Known limitations: unchanged from M3 except as explicitly narrowed by the
fixes above — quantityDecimals is now bounded; the off-chain trust
boundary is now precisely worded AND directly demonstrated by a test,
rather than only asserted in prose.
```

No substantive architectural problem was found. Proceeding directly into M4 per the prompt.

---

## M4 — Vertical Integration

**Date:** 2026-09-11
**Scope:** `integration/`, `contracts/tests/endToEnd.test.cjs`, plus terminology corrections in three test files and documentation updates (`docs/GUARDIAN.md`, `docs/ARC.md`, `docs/ARCHITECTURE.md`, `docs/DEMO.md`). No file under `verification/`, `guardian/` (excluding this entry's doc note), `arc/{identifiers,payload,adapter}.ts`, or `contracts/RestorationDeed.sol`/`MockUSDC.sol` was modified — M4 is integration-only, per its own scope.

**Objective:** connect M1 → M2 → M3 into one executable local path for the synthetic Kootenay BC project — `verifyProject()` → Guardian credential → Arc authorization payload → `RestorationDeed` funding and settlement — using only the real, existing components, with no duplicated ecological or financial calculation and no new trust mechanism.

### Starting state

This session found substantial M4 work already present in the working tree from prior sessions: `integration/restorationSettlementFlow.ts`, `integration/tests/restorationSettlementFlow.test.ts`, and `contracts/tests/endToEnd.test.cjs`, all functionally complete. This session's job was to verify that code (not rewrite it), re-run the full validation gate, correct terminology, and synchronize documentation — per the explicit instruction not to discard working code from a previous session.

### What was verified

- `integration/restorationSettlementFlow.ts`'s `prepareSettlementAuthorization()` calls `verifyProject` (M1), then `GuardianAdapter.submitVerificationResult` / `authorizeVerification` / `issueCredential` (M2), then `buildVerificationAuthorization`/`buildDeedIdentity` (M3 `arc/`), in that fixed order, with no step reordered, skipped, or reimplemented. It takes no caller-supplied settlement quantity anywhere in its signature — the only path to a settlement quantity is through `verifyProject`'s own `VerificationResult.settledQuantity`.
- `guardian/adapter.ts` (M2, unmodified) never recomputes `settledQuantity`/`uncertainty`/`qualityGateStatus`; `financiallyEligible` is a direct function of `qualityGateStatus === "PASS"`.
- `arc/payload.ts`'s `buildVerificationAuthorization` (M3, unmodified) derives `settledQuantityScaled` only via `scaleQuantity(result.settledQuantity, quantityDecimals)` — no independent quantity source, no rounding beyond the documented fixed-point scaling.
- `RestorationDeed.sol` (M3.1, unmodified) remains the sole component that moves escrowed USDC; `submitVerification` never recomputes the settlement amount's underlying quantity, only the USDC amount from an already-fixed quantity and the deed's own immutable pricing terms.

### The successful path (traced end to end)

```text
FIXTURE_PARTIAL_SETTLEMENT (synthetic Kootenay project, canopy_cover_fraction_pct)
  -> verifyProject()                                                    [M1]
     qualityGateStatus=PASS, verificationStatus=PARTIAL, settledQuantity=lowerBound
  -> MockGuardianAdapter: submitVerificationResult -> authorizeVerification -> issueCredential   [M2]
  -> buildVerificationAuthorization() / buildDeedIdentity()             [M3 arc/]
  -> RestorationDeed.createDeed -> fundDeed(MockUSDC) -> submitVerification -> settleDeed   [M3 contract, local Hardhat network]
  -> beneficiary receives settlementAmount; sponsor receives the escrow remainder
```

`contracts/tests/endToEnd.test.cjs` asserts `outcome.verificationResult.settledQuantity === outcome.verificationResult.lowerBound` and that the on-chain `settledQuantityScaled` equals `Math.round(settledQuantity * 10**quantityDecimals)` — the scientific-to-financial invariant demonstrated directly, not just documented.

### Failure paths covered

`INSUFFICIENT_EVIDENCE` (parallel-trend failure) and `INVALID_RESULT` (invalid uncertainty config) both fail closed inside `prepareSettlementAuthorization`, before any Guardian authorization or on-chain payload is built (`integration/tests/`). A tampered `VerificationResult` presented at authorization time is caught by Guardian's existing `validateSubmissionIntegrity` re-hash check — no new tamper-detection code was added for M4 (`integration/tests/`). An unauthorized verifier and a methodology mismatch are both rejected on-chain using the real M4 payload (`contracts/tests/endToEnd.test.cjs`, `NotAuthorizedVerifier`/`VerificationIdentityMismatch`). Replay/double-settlement protection (`consumedVerificationIds`, `settleDeed`'s `WrongStatus` guard) is exercised generically in `contracts/tests/verification.test.cjs` and `contracts/tests/settlement.test.cjs` — the same code path the real M4 payload goes through, not a separate mechanism.

### Terminology correction made during this session

Three test titles/comments used an unqualified "real Guardian credential" / "real Arc settlement" (`contracts/tests/endToEnd.test.cjs`, `integration/tests/restorationSettlementFlow.test.ts`, `arc/tests/payload.test.ts`), which could be misread as a claim of live Hedera Guardian or Arc mainnet/testnet infrastructure. Corrected to "Mock Guardian credential" / "local RestorationDeed settlement" — "real" is still accurate for describing genuinely-executed (not hand-fabricated) code, but "Guardian" and "Arc" needed the Mock/local qualifier. No behavior changed; only test names and comments. `docs/GUARDIAN.md` §9.10 and `docs/ARC.md` (new §11) were updated to state plainly that this milestone is a Mock Guardian adapter wired to a locally-deployed Arc contract, not live sponsor infrastructure.

### Validation results (this session, actual run)

- `npm run typecheck` (`tsc --noEmit`): **0 errors.**
- `npm test` (`vitest run`): **88/88 passed**, 11 test files. This is the 81 pre-existing M1/M2/M3/M3.1 tests plus the 6 M4 `integration/` tests plus the 1 M3.1 trust-boundary test already counted in the 82-test M3.1 gate — i.e. 82 pre-existing + 6 new M4 tests = 88.
- `npx hardhat compile`: succeeds (offline solc resolution, unchanged from M3).
- `npm run test:contracts` (Hardhat): **84/84 passed** — the 81 pre-existing M3/M3.1 contract tests plus 3 new M4 end-to-end tests (successful path, unauthorized-verifier failure, methodology-mismatch failure).

No test was weakened, skipped, or deleted to obtain these results.

### Security considerations

M4 introduces no new trust mechanism and closes no existing gap; it only wires together mechanisms that were already independently reviewed in M2/M3/M3.1. The financial authorization boundary is unchanged: `RestorationDeed.authorizedVerifier` (an Ethereum address chosen by the sponsor at deed creation) is the sole gate on `submitVerification`. AI cannot choose the settlement quantity (it is fixed by `verifyProject`'s deterministic output before any Guardian or Arc call), cannot authorize a financial settlement, and cannot bypass Guardian or `RestorationDeed` authorization through anything in `integration/`. As stated precisely in `docs/ARC.md` since M3.1: AI cannot release funds without also controlling the `authorizedVerifier` signing key — the off-chain checks in `arc/payload.ts` and `integration/` verify internal consistency between objects, not cryptographic provenance from a genuine M1/M2 execution.

### Known limitations (unchanged from M3/M3.1)

- `authorizedVerifier` is address-based, not cryptographically bound to a Guardian-attested identity.
- No cryptographic Guardian signatures; no decentralized verifier governance; no verifier key rotation.
- `MockUSDC` is not production USDC; the local Hardhat network is not Arc Testnet or Mainnet.
- `MockGuardianAdapter` is not a live Hedera Guardian deployment — no Hedera Consensus Service, no Guardian policy engine, no DID infrastructure.
- The contract has not received an external audit.
- `unitPriceUSDC` pricing remains an explicit prototype convention, not an audited financial mechanism.

### Deviations from Idea 0.2

None identified beyond those already documented in the M1/M2/M3 entries above (single metric, rule-based control matching, non-statistical uncertainty model, address-based verifier authorization, etc.). M4 did not introduce any new deviation — it only connects already-built, already-documented components.

### Explicitly deferred (not part of M4)

The Graph, Auditor/LLM integration, x402, Circle Agent Stack, React UI (`app/` remains absent, as instructed), production satellite processing, live Hedera Guardian deployment, live Arc Testnet/Mainnet deployment, decentralized verifier governance, verifier key rotation, cryptographic Guardian signatures, IPFS/Filecoin integration, production financial settlement infrastructure.

### M4 acceptance gate

```text
M4: PASS

Tests:      88/88 vitest (11 files) — 82 pre-existing (M1/M2/M3/M3.1) + 6 new M4 integration tests
            84/84 hardhat            — 81 pre-existing (M3/M3.1) + 3 new M4 end-to-end tests

TypeScript: PASS (tsc --noEmit, 0 errors)
Solidity:   PASS (hardhat compile)

Documentation: PASS (docs/GUARDIAN.md §9.10 updated, docs/ARC.md §11 added,
               docs/ARCHITECTURE.md §8 updated, docs/DEMO.md status note updated)

Terminology: corrected — "Mock Guardian" / "local RestorationDeed settlement"
             replace unqualified "real Guardian" / "real Arc settlement" in
             three test files; no behavior changed.
```

### Recommended next step

M5 — The Graph + Auditor, per the project's milestone sequence. The Graph will index the events `RestorationDeed` already emits (`DeedCreated`, `DeedFunded`, `VerificationSubmitted`, `SettlementExecuted`, `RefundExecuted`); the Auditor will orchestrate and explain the pipeline this milestone connected, without independently altering any of its results (docs/ARCHITECTURE.md §2, §7).

---

## M5 — The Graph + Auditor

**Date:** 2026-09-12
**Scope:** `subgraph/` (new, isolated AssemblyScript package), `graph/` (new, `GraphProvider`/`TheGraphProvider`/`FixtureGraphProvider`), `auditor/agent.ts` (implemented — was a 0-byte M0 stub), `scripts/deployAndRunLocalDemo.cjs` (new), `tsconfig.json`/`vitest.config.ts` (excluded `subgraph/`), `.gitignore` (subgraph build artifacts), `package.json` (`demo:local`, `test:e2e:graph` scripts), plus documentation (`docs/GRAPH.md`, `docs/AUDITOR.md`, `docs/ARCHITECTURE.md`, `docs/DEMO.md`, `README.md`). No file under `verification/`, `guardian/`, `arc/`, `integration/`, or `contracts/` was modified — confirmed by full regression (84/84 Hardhat, unchanged from M4).

**Objective:** index `RestorationDeed`'s real on-chain events through a genuine local Graph Node (not a custom indexer), and implement an Auditor that retrieves and cross-checks that indexed history against the real off-chain M1/M2 objects — read-only, no new financial or scientific authority.

### Phase 0 — infrastructure resolved before any subgraph code was written

Per the M5 prompt's explicit requirement, the local Graph Node stack was verified runnable *before* writing `subgraph/src/mapping.ts`: Docker Desktop (installed but not running) was started and its daemon confirmed responsive; all three required images (`graphprotocol/graph-node:v0.45.0`, `postgres:14`, `ipfs/kubo:v0.17.0`) were pulled and confirmed available; current `@graphprotocol/graph-cli`/`graph-ts`/`matchstick-as` versions were confirmed via `npm view`, not guessed. See `docs/GRAPH.md` §7.3 for the full version table and rationale.

### The actual contract events (verified against the ABI, not assumed)

`contracts/.artifacts/contracts/RestorationDeed.sol/RestorationDeed.json` was inspected directly. Two assumptions a naive reading of the M5 prompt's "conceptual" event model would make turned out to be wrong:

1. `DeedCreated` does **not** emit `methodologyVersion` — only `deedId, projectId, parcelH3Root, sponsor, beneficiary, authorizedVerifier, escrowAmount, unitPriceUSDC, quantityDecimals`.
2. `VerificationSubmitted` does **not** emit `projectId`, `parcelH3Root`, `methodologyVersion`, or `evidenceHash` — only `deedId, verificationId, financiallyEligible, settledQuantityScaled, settlementAmount`. `evidenceHash` is not stored in the `Deed` struct either — it is checked non-zero in calldata and discarded.

Both were confirmed by reading the ABI's `inputs`/`outputs` directly (`docs/GRAPH.md` §7.7 has the full per-event table).

### The `methodologyVersion` eth_call — implemented, tested, and then removed for a real reason

An `eth_call` to `getDeed(deedId)` in the `handleDeedCreated` mapping handler was implemented first (the natural way to obtain `methodologyVersion`, since it exists in contract storage even though no event emits it), with a passing Matchstick unit test (mocked call). It failed reproducibly the moment it ran against the real local Graph Node: graph-node v0.45.0's Alloy-based Ethereum client sends both `data` and `input` fields in every `eth_call`, and Hardhat's JSON-RPC server rejects the duplicate key outright (`error code -32602`). This is a confirmed, closed-as-"not planned" upstream Hardhat limitation ([NomicFoundation/hardhat#4603](https://github.com/NomicFoundation/hardhat/issues/4603)) — no subgraph mapping can make any `eth_call` succeed against this Hardhat version with this graph-node version. The Matchstick unit test could not have caught this, since Matchstick never touches a real JSON-RPC server — this was only found by running the actual required Graph Node integration test, exactly the reason that test exists as a separate acceptance gate from mapping unit tests.

**Decision:** removed the eth_call entirely. `methodologyVersion` is not represented on the `RestorationDeed` Graph entity. The Auditor cross-checks it off-chain instead, directly between a supplied M1 `VerificationResult` and M2 `GuardianCredential` (`docs/GRAPH.md` §7.5, `docs/AUDITOR.md` §8.2). On-chain methodology enforcement is unchanged — it still happens inside `RestorationDeed.submitVerification` (`VerificationIdentityMismatch`); the Graph simply cannot observe that enforcement after the fact through this field. This is recorded as an architectural decision made *during* implementation, not assumed beforehand, per the prompt's own instruction to report the precise blocker rather than inventing a workaround.

### What was built

- `subgraph/schema.graphql` — `Project`, `RestorationDeed` (mutable), `Funding`/`Cancellation`/`Verification`/`Settlement`/`Refund` (immutable, one per emitted event). `Verification.id` is the on-chain `verificationId` itself (canonical — contract-wide replay-protected by construction, not an arbitrary choice). Event-record entities use `transactionHash.concatI32(logIndex)` as their id.
- `subgraph/src/mapping.ts` — one handler per event, each a straight copy from event params into entity fields; no ecological or financial calculation anywhere in this file.
- `subgraph/subgraph.yaml` — manifest targeting network label `"hardhat"` (deliberately not `"mainnet"`), address/startBlock patched by `subgraph/scripts/configure.cjs` from a real local deployment rather than hardcoded.
- `subgraph/docker-compose.yml` — pinned `postgres:14`, `ipfs/kubo:v0.17.0`, `graphprotocol/graph-node:v0.45.0`, `host.docker.internal:8545` connectivity to the host's persistent Hardhat node.
- `subgraph/tests/mapping.test.ts` — 9 Matchstick tests (entity creation/field mapping for all 6 handlers, `Project` reuse across deeds, `VERIFIED`/`FAILED` branching, `Settlement -> Verification` relationship).
- `subgraph/scripts/test-docker.cjs` — a Windows-safe replacement for `graph test --docker`, whose own `docker run -it` fails non-interactively (`docs/GRAPH.md` §7.11); reproduces graph-cli's own build/run sequence with `-i` instead of `-it`.
- `scripts/deployAndRunLocalDemo.cjs` — deploys `MockUSDC`+`RestorationDeed` to a **persistent** local Hardhat node (`npx hardhat node --hostname 0.0.0.0`, not the ephemeral per-test network `npm test`/`test:contracts` use) and runs the real M4 `prepareSettlementAuthorization()` chain against it, producing real on-chain events for Graph Node to index. Writes `subgraph/deployment.local.json` (gitignored — regenerated per fresh chain).
- `graph/types.ts`, `graph/provider.ts` (`GraphProvider` interface, `GraphUnavailableError`), `graph/theGraphProvider.ts` (real `fetch()`-based GraphQL client), `graph/fixtureGraphProvider.ts` (deterministic in-memory provider for unit tests).
- `auditor/agent.ts` — `auditDeed()`: retrieves indexed history, checks deed↔verification identity, deed-state↔settlement-event consistency (including re-deriving the settlement amount from `settledQuantityScaled x unitPriceUSDC / 10^quantityDecimals` to detect indexing corruption — not a new financial calculation), and (when supplied) off-chain M1-quantity↔on-chain-quantity and M1↔M2-methodology cross-checks. Every outcome is a returned `AuditReport`, never a thrown error, never a repair, never a financial action.
- `graph/tests/e2e.test.ts` + `vitest.e2e.config.ts` — the real Graph Node integration test, run via `npm run test:e2e:graph`, excluded from ordinary `npm test` (`vitest.config.ts`).

### Key implementation decisions

1. **`RestorationDeed`/`Project` are mutable Graph entities; the five event records are immutable** — `specVersion: 1.0.0` requires an explicit `immutable` argument on every `@entity`, which an earlier `graph codegen` run surfaced immediately (not guessed in advance).
2. **`Verification.id = verificationId`** (not a synthetic per-event id) — chosen because the contract's own `consumedVerificationIds` replay-protection mapping already makes it contract-wide unique, so reusing it as the canonical Graph identity adds no risk and lets the Auditor address a verification the same way the contract itself does.
3. **The persistent-vs-ephemeral Hardhat network distinction is load-bearing, not incidental** — `npm test`/`npm run test:contracts` deliberately keep using Hardhat's fast in-process ephemeral network (M1-M4 are unaffected), while M5 introduces a *second*, persistent `npx hardhat node` process specifically because Graph Node needs a chain that keeps existing across time to index. These are not interchangeable, and the M5 tooling (`demo:local`, `subgraph/docker-compose.yml`) never touches the ephemeral one.
4. **The Auditor takes `VerificationResult`/`GuardianCredential` as optional caller-supplied inputs, not something it fetches itself** — there is no persistent Guardian store to query (`MockGuardianAdapter` is in-memory per instance) and the Graph does not carry credential contents (`docs/GRAPH.md` §7.6), so cross-checking against them requires the caller to already have them — exactly matching `docs/AUDITOR.md`'s original §4 "Inputs" list (`verification result` was already listed as a potential input, not assumed to be retrieved independently).

### Tests run and results (actual, this session)

```text
TypeScript:              PASS (tsc --noEmit, 0 errors; subgraph/ excluded — separate AssemblyScript toolchain)
Vitest (root):           104/104 passed, 13 files (88 pre-M5 + 16 new: 5 FixtureGraphProvider + 11 auditor/agent.ts)
Hardhat compile:         PASS (unchanged from M4 — contracts/ not modified)
Hardhat test:            84/84 passed (unchanged from M4)
Subgraph codegen/build:  PASS
Subgraph mapping tests:  9/9 passed (Matchstick, via the Docker wrapper — docs/GRAPH.md §7.11)
Graph Node E2E:          5/5 passed (npm run test:e2e:graph, against a real local Graph Node,
                          real persistent Hardhat node, and a real deployed RestorationDeed —
                          confirmed indexed status/verificationId/settledQuantityScaled trace
                          back to a freshly-recomputed real M1 result, plus NOT_FOUND/
                          DATA_UNAVAILABLE failure-path checks against the same real provider)
```

No test was weakened, skipped, or deleted to obtain these results. Two real bugs were found and fixed during this milestone, both documented above and in `docs/GRAPH.md`: the `specVersion: 1.0.0` `immutable` requirement, and the `eth_call` incompatibility.

### Security review

- The Graph is read/index-only: nothing in `subgraph/` or `graph/` writes to `RestorationDeed.sol`, Guardian, or any wallet — verified by inspection (no `ethers`/write-capable client anywhere in `graph/` or `auditor/`).
- The Auditor cannot release funds, authorize a verification/settlement, choose a settlement quantity, or modify a `VerificationResult` — every `auditor/agent.ts` function is a pure read-then-compare; tested directly (`auditor/tests/agent.test.ts`'s "never mutates the graph provider's data").
- AI does not bypass Guardian or Arc authorization — unchanged from M3/M3.1/M4; M5 adds no new authorization path of any kind.
- No secrets or production credentials were committed. `subgraph/docker-compose.yml`'s Postgres password (`let-me-in`) is graph-node's own upstream reference-compose convention — a throwaway local-only value, not a real credential (`docs/GRAPH.md` §7.16).
- No production blockchain transaction, hosted Graph deployment, or AWS resource was created or touched anywhere in this milestone.

### Documentation

`docs/GRAPH.md` §7 added (versions, architecture, exact event-to-entity table, the `methodologyVersion`/`evidenceHash` limitations with the full incompatibility write-up, ID strategy, startup/build/deploy/query/test instructions, validation results). `docs/AUDITOR.md` §8 added (provider boundary, what `auditDeed` checks, authority boundary, error handling, AWS/AI notes). `docs/ARCHITECTURE.md` §8 and `docs/DEMO.md`'s status note updated to reflect M5 as implemented. `README.md`'s status line and dev commands updated.

### Known limitations

- `methodologyVersion` is not Graph-indexed (real upstream RPC incompatibility, not a design choice) — see `docs/GRAPH.md` §7.5.
- `evidenceHash` and full Guardian credential contents are not Graph-indexed — never available on-chain in the first place.
- The Auditor's methodology cross-check is off-chain-only (M1 result vs. M2 credential), not independently re-verified against an on-chain field, for the same reason.
- Single subgraph data source; no multi-contract/multi-network support attempted or needed at this scale.
- No hosted/decentralized Graph Network deployment, no AWS, no production blockchain — all explicitly deferred per the milestone's own scope.

### Deviations from Idea 0.2

None beyond those already recorded in the M1-M4 entries. M5 did not alter any scientific, financial, or Guardian-workflow behavior — it only added a read/index layer and a read-only correlation layer on top of what M1-M4 already built.

### Recommended next step

M6 — React UI + Demo, per the project's milestone sequence (not started, per this milestone's own scope boundary).

---

## M6 — React UI, Operational Demo & M7 Readiness

**Date:** 2026-09-11
**Scope:** `app/` (new — Vite/React/TypeScript), `server/` (new — thin HTTP API over the real M1-M5 code), `graph/theGraphProvider.ts` and `graph/types.ts` (one bug fix — see below), `tsconfig.json`/`vitest.config.ts` (excluded `app/`, same isolation pattern as `subgraph/`), `package.json` (`server` script), documentation (`README.md` rewritten as an operational guide, `docs/DEMO.md` §8, `docs/ARCHITECTURE.md` §10, `docs/M6_M7_READINESS_REPORT.md` new). No file under `verification/`, `guardian/`, `arc/`, `integration/`, `contracts/`, `subgraph/`, or `auditor/agent.ts` itself was modified — confirmed by full regression (104/104 root vitest, 84/84 Hardhat, 9/9 subgraph, 5/5 Graph E2E, all unchanged from M5 except the one graph/ fix below).

**Objective:** build the React presentation layer on top of the real M1-M5 system, actually run the complete local demo (not just compile it), verify UI output against authoritative backend values, and produce the M6→M7 readiness report.

### A note on repository state at the start of this session

This session began on branch `v2_build_shants`, whose git log shows substantial prior real history (AWS CI/CD, Docker, a Python analysis pipeline, an earlier React app) — but the actual HEAD commit ("M5- UI done", authored by the project owner) had replaced that entire tree with the M0-M5 backend implementation from a prior session (verified directly via `git ls-tree HEAD` and a zero-diff against `origin/v2_build_shants`). `app/` was empty and `CLAUDE.md` matched the M0-M5 session's version exactly. Per CLAUDE.md's own instruction to trust the actual implementation over any other signal, this session treated that state as authoritative and proceeded — this note exists so a future session doesn't rediscover the same discrepancy from scratch.

### What was built

- **`app/`** — Vite + React 19 + TypeScript, `react-router-dom` (`HashRouter`, so no server-side history-fallback config is needed for a static build). Eight pages: Overview, Evidence, Verification, Guardian, Financial / Deed, Provenance, Auditor, About. A shared `FixtureProvider` context lets the demo switch between the real success fixture (`FIXTURE_PARTIAL_SETTLEMENT`) and the real failure fixture (`FIXTURE_PARALLEL_TREND_FAIL`) across the Verification/Guardian/Auditor pages. Restrained, earth-toned CSS (no component library, no charting library) — a plain uncertainty-interval bar and a pipeline-stage strip are the only custom visualizations, both driven entirely by real `VerificationResult` fields.
- **`server/index.ts`** — plain `node:http` (no Express — five simple GET routes didn't justify a new dependency), CORS-open for local dev only. Routes: `/api/project`, `/api/evidence`, `/api/verification`, `/api/guardian`, `/api/deed`, `/api/audit`, `/api/arc-payload-preview`. Every route calls the real M1/M2/M4/M5 function directly; `/api/deed` and `/api/audit` return a structured `{status: "UNAVAILABLE", reason: "..."}` (naming the actual unreachable subsystem and the fix command) rather than a generic error or fabricated data when the Graph Node isn't running.
- **`app/src/components/AsyncBlock.tsx`** — the one shared data-loading component; renders a subsystem-named loading/error state, never a generic "Something went wrong."
- Component tests (`app/`, vitest + `@testing-library/react` + jsdom): `StatusPill`, `AsyncBlock` (loading/error/data states), `Overview` (real fetched data rendering, and demo-API-unreachable handling) — 9 tests.

### The actual demo was run, not just compiled

Per the M6 prompt's hard acceptance gate: a persistent Hardhat node was started, `npm run demo:local` ran the real M1→M2→Arc chain against it, the Docker Graph Node stack was brought up and the subgraph deployed, the API server and Vite dev server were started, and a **headless Chromium browser (Playwright, installed in an isolated temp directory — not added to any project's `package.json`)** loaded every page against the real running stack. Result: zero console errors, zero page errors, zero failed network requests, across all 8 pages, in both the success and failure verification cases, plus a full-page reload. See `docs/DEMO.md` §8 and `docs/M6_M7_READINESS_REPORT.md` §2-3 for the complete record and screenshots taken during this run.

### A real integration bug was found during UI verification, and fixed

The Provenance page's timeline showed a `DeedFunded` entry with `block –` and no transaction hash. Root cause: `graph/theGraphProvider.ts`'s GraphQL query for `fundings`/`refunds`/`cancellations` never requested `blockNumber`/`transactionHash`, even though `subgraph/schema.graphql` (M5) already stores them on every event entity. This was an M5 oversight, not an M6 regression — `graph/types.ts`'s `IndexedFunding`/`IndexedRefund`/`IndexedCancellation` interfaces simply never declared those fields either. **Fixed** (not merely documented): extended the GraphQL query and the three TypeScript interfaces; re-verified visually with a fresh Playwright screenshot showing correct block numbers (3, 6, 7, 8 in order) and real transaction hashes. Root M5/M6 regression suites (104 root vitest tests, 5 Graph E2E tests) still pass unchanged after the fix — the fix only added previously-unfetched fields, it didn't change any existing field's value.

### An unrelated tooling mistake, caught and corrected before it reached git

While setting up Playwright for browser verification, an `npm install` was accidentally run against the **root** project instead of an isolated scratch directory, adding `playwright` to the root `package.json`/`package-lock.json` as a real dependency. This was caught immediately (via the "package.json changed on disk" notice) and reverted with `npm uninstall playwright` before any commit; Playwright was then correctly installed in an OS temp directory outside the repository entirely. Recorded here per this project's "do not fabricate implementation history" rule — the mistake happened and was corrected, not silently erased from the record.

### Key implementation decisions

1. **A thin server, not a second implementation.** `server/` was the one structural addition this milestone required beyond `app/` itself, because a browser cannot run `node:crypto`/`node:fs`-dependent modules. Every response is the real function's real return value, serialized — the M6 prompt's "do not create a parallel demonstration engine" requirement is met by construction, not by discipline alone: `server/index.ts` contains no control-matching, DiD, additionality, uncertainty, or settlement-amount arithmetic anywhere.
2. **`HashRouter`, not `BrowserRouter`.** Avoids needing history-fallback server configuration for a static build — appropriate for a local hackathon demo; a production deployment (M7) may prefer `BrowserRouter` with proper server-side routing config once a real hosting target exists.
3. **No component library, no charting library.** The M6 prompt explicitly warns against a generic AI/Web3-dashboard aesthetic; hand-written CSS gave full control over a restrained, GIS-appropriate presentation without adding dependencies whose defaults would have to be fought.
4. **The Arc payload preview is read-only and clearly labeled as such.** `/api/arc-payload-preview` calls the real `arc/payload.ts` functions to show what *would* be submitted to `RestorationDeed.submitVerification()`, but never calls the contract — this satisfies the UI walkthrough requirement for a Financial/Deed view without creating any path from the browser to a transaction.

### Reality / terminology audit

Performed against the actually-rendered UI (not just the source), using the real fixture data (`verification/fixtures.ts`'s Kootenay Riparian Restoration parcels: `riparian_forest` land cover, `alluvial_loam` soil, `canopy_cover_fraction_pct` metric, plausible elevation/slope/aspect/climate-zone values). No invented environmental terminology was introduced — every label on every page corresponds to an actual field in `VerificationResult`, `GuardianCredential`, or the Graph-indexed `DeedHistory`. The synthetic-data disclaimer banner is present on every page (verified in the Playwright run: `hasDisclaimer: true` on all 8 pages). No claim of satellite imagery, field measurement, or regulatory credit status appears anywhere in the UI. Full classification in `docs/M6_M7_READINESS_REPORT.md` §5 (Section 25 of the M6 prompt).

### Security review

- No API key, private key, wallet secret, or `.env` secret exists anywhere in this repository (checked directly — `server/` and `app/` use no credentials at all).
- No signing capability exists in `app/` or `server/` — `RestorationDeed`'s `authorizedVerifier` is a Hardhat default test account; the demo's on-chain transactions were all sent by `scripts/deployAndRunLocalDemo.cjs` directly against the local node, never through the UI or API server.
- `/api/arc-payload-preview` never calls `RestorationDeed.submitVerification()` — it only builds and returns the payload object.
- The Graph is queried read-only (`graph/theGraphProvider.ts` issues GraphQL queries only; The Graph's query protocol has no mutation path for indexed data in the first place).
- `server/`'s CORS header (`Access-Control-Allow-Origin: *`) and total absence of authentication are appropriate only for local development — flagged explicitly as an M7 blocker if this server is ever exposed beyond `localhost` (see `docs/M6_M7_READINESS_REPORT.md`).
- No React component uses `dangerouslySetInnerHTML` or otherwise renders unescaped dynamic content; all displayed hashes/addresses/values go through React's default text rendering.

### Tests run and results (actual, this session)

```text
TypeScript (root):        PASS (tsc --noEmit, 0 errors; subgraph/ and app/ excluded — separate toolchains)
Vitest (root):             104/104 passed (unchanged from M5)
Hardhat compile/test:      PASS / 84/84 passed (unchanged from M5)
Subgraph build/tests:      PASS / 9/9 passed (unchanged from M5)
Graph Node E2E:            5/5 passed (unchanged from M5)
App build:                 PASS (tsc -b && vite build)
App component tests:       9/9 passed (vitest + testing-library, new this milestone)
Browser verification:      8/8 pages loaded with 0 console errors, 0 page errors, 0 failed requests
                           (Playwright/Chromium, headless, against the real running local stack)
Failure-path verification: Graph Node stopped mid-session -> Financial/Auditor pages showed a
                           specific, actionable UNAVAILABLE state; restarted -> recovered without
                           a page reload
```

No test was weakened, skipped, or deleted to obtain these results.

### Documentation

`README.md` rewritten as a full operational guide (prerequisites with exact versions, installation, environment variables, faucet table, synthetic-data map, exact startup/demo/reset sequences, troubleshooting table, simulation-boundary list). `docs/DEMO.md` §8 added (actual architecture, exact commands, what was verified, the bug found and fixed, current limitations). `docs/ARCHITECTURE.md` §8 and §10 updated. `docs/M6_M7_READINESS_REPORT.md` created — the primary M7 handoff artifact (see that document for the full output-verification table, deployment-readiness classification, and prioritized M7 backlog). `CLAUDE.md` updated to record M6 as complete and the current milestone as M7.

### Known limitations

- `server/` and `app/` are local-only, single-instance, unauthenticated — not deployable as-is (M7 backlog item).
- The Financial/Provenance/Auditor pages reflect only the one deed actually funded and settled on-chain per Hardhat-node lifetime; switching the UI's fixture selector changes off-chain Verification/Guardian/Auditor output but does not create a second on-chain deed.
- No end-to-end (Playwright) test suite was committed to the repository — verification for this milestone was performed interactively with a temporary script, per the M6 prompt's acceptance gate, but a regression-guarding E2E suite is not yet part of `npm test`. Recorded as an M7 backlog item.
- `HashRouter` is a local-demo-appropriate choice, not a production one.

### Deviations from Idea 0.2

None. M6 added only the presentation layer explicitly scoped to this milestone.

### Recommended next step

M7 — see `docs/M6_M7_READINESS_REPORT.md` for the complete prioritized backlog and deployment-readiness assessment.

---

## M6.1 — Containerised demo stack and continuous deployment to the AWS demonstration host

**Date:** 2026-09-12
**Scope:** `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `scripts/bootstrap-stack.sh`, `scripts/http-probe.cjs` (new); `app/Dockerfile`, `app/nginx.conf`, `app/.dockerignore` (new); `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `deploy/` (restored from `main` and retargeted); four one-line environment overrides in `hardhat.config.cjs`, `server/index.ts`, `scripts/deployAndRunLocalDemo.cjs`, `subgraph/scripts/configure.cjs`; `vitest.config.ts` (excludes `.claude/`); `docs/AWS_DEPLOYMENT.md` rewritten; `deploy/README.md`, `README.md`, `CLAUDE.md` updated. No file under `verification/`, `guardian/`, `arc/`, `integration/`, `contracts/`, `subgraph/src`, `auditor/` or `app/src` was modified.

**Objective:** make this branch deployable to the existing AWS demonstration host through the CI/CD pipeline `main` already has, instead of the manual SSH/pm2/nginx procedure the previous `docs/AWS_DEPLOYMENT.md` described (which could not be applied: the host has no SSH port, and the branch had deleted every pipeline file `main` relies on, so merging would have triggered no deployment and was blocked by branch protection).

### What was built

* **One Compose stack for the whole demo** (`docker-compose.yml`): the persistent Hardhat chain, Graph Node with Postgres and IPFS (settings from `subgraph/docker-compose.yml`), a one-shot `bootstrap` service, the read-only API (`server/`) and nginx serving the React build with `/api/` proxied to the API. Only the frontend publishes a host port (3001), so it runs beside the hand-started stack.
* **`bootstrap`** (`scripts/bootstrap-stack.sh`) does what README "Running the Demo" steps 2 and 4 do by hand: `npm run demo:local` (the real M1 → M2 → Arc settlement of the synthetic fixture on the chain) then configure/codegen/build/create/deploy of the subgraph. It computes nothing itself. It is idempotent: if the deployment record already names a contract that exists on the current chain, the settlement is skipped. `api` depends on it completing, so `docker compose up --wait` returns only after the deed is settled and the subgraph deployed.
* **One runtime image** (`Dockerfile`, `node:22-slim`, runs as `node`) serves `chain`, `bootstrap` and `api`; contracts are compiled at build time from the local `solc` package, no network. The frontend image builds the app with an empty `VITE_API_BASE_URL` (same origin) so the bundle no longer hardcodes `localhost:4000`; verified by grepping the built assets.
* **Environment overrides, defaults unchanged:** `HARDHAT_RPC_URL` (Hardhat's `localhost` network), `GRAPH_QUERY_URL` (the API's Graph endpoint), `DEMO_DEPLOYMENT_FILE` (where the demo record is written and read; a shared volume in the stack).
* **CI** (`ci.yml`): `typescript` (typecheck + vitest), `frontend` (lint + tests + build), `contracts` (the Hardhat suite), `images` (compose config with the AWS overlay + build). The `analysis` job from `main` is gone; there is no analysis service on this branch.
* **CD** (`deploy.yml`, `deploy/host/deploy.sh`): unchanged OIDC → ECR → SSM mechanics; the matrix now builds `ecorestore/app` and `ecorestore/frontend`. The host script takes the stack down including the chain, Graph Node and record volumes (Hardhat's chain is in-memory, so every deploy is a fresh chain and the old index is meaningless), keeps Caddy's volumes, and waits until `/api/deed` reports `OK` through Caddy. The workflow's smoke test checks `/api/health`, `/api/deed == OK` and the page.
* **CloudFormation:** adds the `ecorestore/app` ECR repository and the deploy role's push permission on it. The `analysis` and `verify` repositories are retained until their removal is decided.
* **Removed:** the Guardian operator workflow, host script and public overlay — nothing in this stack talks to a Hedera Guardian quickstart.

### Tests run and results (actual, this session, development host)

| Suite | Command | Result |
|---|---|---|
| Root typecheck | `npm run typecheck` | exit 0 |
| Root vitest | `npm test` | 13 files, 104/104 passed (after excluding `.claude/` worktree copies, which had made 17 files fail locally; those directories do not exist in CI) |
| Contracts | `npm run test:contracts` | 84 passing |
| Frontend | `cd app && npm run lint && npm test && npm run build` | lint 0 errors (1 pre-existing warning), 9/9 tests, build OK |
| Compose | `docker compose config --quiet`; with the AWS overlay; `docker compose build` | all OK |
| Stack | `docker compose up -d --wait` | every service healthy; `bootstrap` exited 0 after settling the deed and deploying the subgraph |
| Through the frontend proxy | `/api/health` | `{"status":"OK"}` |
| | `/api/deed` | `OK` on the first poll; deedId 0, settledQuantity 18.1815 — the **synthetic** partial-settlement fixture |
| | `/api/audit?fixture=partial` | `CONSISTENT`, 0 anomalies |
| | `/` | contains `<div id="root">` |

Not run: the subgraph Matchstick suite and `npm run test:e2e:graph` (unchanged code, and the latter needs the hand-started stack on the ports my compose stack does not publish). Not run: the AWS deploy itself — see "Unresolved" below.

### Decisions

* **Retarget the existing pipeline rather than write a new one.** OIDC trust, ECR, SSM, Caddy and branch protection already worked for `main`'s previous stack shape; only the images, compose file and smoke test are different.
* **Fresh chain per deploy** (see above). Keeping Graph Node's store across a chain reset would leave an index of blocks that no longer exist.
* **Same-origin API base** for the built frontend instead of baking a hostname in; the previous guide's suggested value would have produced `/api/api/...` paths.
* **Authority boundaries unchanged.** The API is still read-only and keyless; the UI still knows only the API; the chain container is Hardhat's public test accounts; nothing in the image or on the host is a secret.

### Deviations from Idea 0.2

None. This is hosting of the existing demo; no methodology, settlement, trust-boundary or token semantics changed.

### Unresolved / next steps

1. **The AWS deploy has not run from this branch.** Two operator steps precede the first one: re-run `aws cloudformation deploy` on the existing stack (adds the `app` repository), and merge to `main`. The host currently serves the stack `main` deployed on 2026-09-11; the first deploy from this branch replaces it.
2. **Main's required status checks still list `analysis`**, which no longer reports; the rule must be changed to `typescript`, `frontend`, `contracts`, `images` (the command is in `deploy/README.md` §4) or the PR cannot merge. This session was not permitted to change repository settings.
3. After a host reboot the containers restart on an empty chain; a **Deploy** run is needed to bootstrap it. A systemd unit or a restart-aware bootstrap could remove that step.
4. The API still has no authentication on a public URL (readiness report BLOCKER list).
5. `main`'s `analysis`/`verify` ECR repositories and the Guardian checkout on the host are unused by this stack and can be removed deliberately.

---

## M6.2 — Financial/Provenance did not reflect the contract audit

**Date:** 2026-09-12
**Scope:** `app/src/components/AuditSummary.tsx` (new), `app/src/pages/{Financial,Provenance,AuditorPage}.tsx`, `app/src/pages/FinancialProvenance.test.tsx` (new). No file under `verification/`, `guardian/`, `arc/`, `contracts/`, `auditor/`, or `server/` was modified — this was a UI wiring gap, not a backend defect.

### Bug report and root cause

Reported: selecting the "Failure" verification case in the UI's case selector did not produce a visibly different, reliable result on the Financial and Provenance pages.

Confirmed by inspection and by a throwaway RTL test exercising both fixtures against mocked API responses: `auditDeed()` (M5) and every server route it depends on (`/api/audit`, `/api/deed`, `/api/arc-payload-preview`) already compute the correct, differing result per fixture — `CONSISTENT`/`ANOMALOUS` and eligible/ineligible were verified correct at the API layer for both `partial` and `trendFail` via direct HTTP calls. The bug was entirely in the UI: `Financial.tsx`'s primary "on-chain deed" panel and all of `Provenance.tsx` render only `api.deed()`, which is fixture-independent by design (docs/DEMO.md — only one deed is ever actually funded and settled on-chain). Neither page called `/api/audit`, so neither page showed any indication of whether the selected case matched the deed — switching to the Failure case looked identical to Success on both pages, which is what "unreliable" meant here: the divergence existed only on the separate Auditor page.

### Fix

Added a shared `AuditSummary` component (status pill, deedId, explanation, anomaly list — the same rendering `AuditorPage.tsx` already had) and added a "Contract audit" panel, backed by `api.audit(fixture)`, to both `Financial.tsx` and `Provenance.tsx`. `AuditorPage.tsx` was refactored to use the same component instead of duplicating the markup. Both pages also gained a short note explaining that the deed/timeline panels themselves are fixed to the one real settled deed and will not change with the selector — the audit panel is what shows whether the current selection is consistent with it.

### Deviations from Idea 0.2 / prior docs

None. No authority boundary, settlement logic, or verification methodology changed — `auditDeed()` was already read-only and this only surfaces its existing output in two more places.

### Tests run and results

- `npm run typecheck` (root): 0 errors.
- `npm test` (root): 104/104 passed (unchanged — no root code touched).
- `cd app && npx vitest run`: 11/11 passed (9 pre-existing + 2 new, `FinancialProvenance.test.tsx`, asserting `CONSISTENT` for the success case and `ANOMALOUS` with the real anomaly code for the failure case on both pages).
- `cd app && npx oxlint`: same 3 pre-existing warnings, none new.
- `cd app && npm run build`: OK.

### Known limitations

Still true, unchanged from M6.1: only one deed is ever actually created/funded/settled on-chain in this local demo; the Failure case is demonstrated off-chain (Guardian fails closed before Arc, shown in Financial's Arc-payload-preview panel) and, now, as a visible audit mismatch — not as a second real on-chain deed. Building a genuine second on-chain deed for the failure path is a larger scope change deferred to M7, not attempted here.

---

## M6.3 — Overview map: synthetic parcel extents on Leaflet, with a reference-imagery toggle

**Date:** 2026-09-13
**Scope:** `server/spatialFixtures.ts`, `server/spatialFixtures.test.ts` (new); `server/index.ts` (one new read-only route, `/api/geometry`); `app/src/components/ProjectMap.tsx`, `app/src/components/projectMapLayers.ts`, `app/src/components/ProjectMap.test.tsx` (new); `app/src/pages/Overview.tsx`, `app/src/pages/Overview.test.tsx`, `app/src/api/{types,client}.ts`, `app/src/styles.css`, `app/src/setupTests.ts`, `app/nginx.conf` (comment), `app/package.json` (+ `leaflet`, `@types/leaflet`); `README.md`. No file under `verification/`, `guardian/`, `arc/`, `integration/`, `contracts/`, `subgraph/`, or `auditor/` was modified.

### Objective

Give the Overview page a web map between the project panel and the "Current status" panel: a free basemap (OpenStreetMap), the restoration project's parcel extent, and — if possible — the satellite imagery the pipeline used as evidence, as a toggleable raster.

### What was built

* **Synthetic parcel extents** (`server/spatialFixtures.ts`). The M1 fixtures carry no geometry at all (M1's spatial identity is a placeholder hash of the parcel id — `verification/calculations/spatialIdentity.ts`), so there was nothing to draw. Eight polygons were drawn for this prototype, one per parcel of the two fixtures the server serves, each scaled so its planar area matches the parcel's declared `areaHectares` (within 0.2%; the test enforces 0.5%). They are placed along the Kootenay River in the Creston Valley, British Columbia — the same reach the earlier `feature/spatial-pipeline-prototype` branch used — purely so the map shows a plausible riparian setting. They are labelled synthetic in the file header, the API response's `disclaimer`, the panel text, the layer-control label, and every popup. The verification engine does not read them; `verifyProject()`, the evidence hash, Guardian, and settlement are untouched.
* **`/api/geometry?fixture=`** returns a GeoJSON FeatureCollection whose feature properties are copied straight from the fixture's `Parcel` records (role, declared hectares, land cover, contamination flag). It derives nothing; it lists any parcel it has no extent for rather than inventing one.
* **`ProjectMap`** (Leaflet 1.9.4, no React wrapper) draws OpenStreetMap tiles, the parcel polygons, a scale bar, an always-open layer control and a legend. Control parcels are coloured eligible/excluded from the real `VerificationResult.diagnostics.eligibleControlParcelIds` that the Overview already fetches; until that result arrives they are drawn as undifferentiated candidates rather than guessed at. Popups are built from DOM nodes, not HTML strings.
* **Imagery toggle.** This pipeline consumes no imagery: its observations are synthetic values, so there is no "imagery used as evidence" to show. The nearest honest thing was added instead — EOX's public Sentinel-2 cloudless 2024 mosaic as an overlay that is **off by default** and labelled "reference imagery, not pipeline evidence" in the layer control, the panel note and the README. Attribution and licence (CC BY-NC-SA 4.0, non-commercial) are shown in the map's attribution control.

### Tests run and results (actual, this session)

| Suite | Command | Result |
|---|---|---|
| Root typecheck | `npm run typecheck` | 0 errors |
| Root vitest | `npm test` | 14 files, 110/110 passed (104 pre-existing + 6 new in `server/spatialFixtures.test.ts`: closed rings inside the Kootenay region, area agrees with declared hectares for every parcel of both served fixtures, properties copied not invented, no overlapping parcels within a project, missing parcels reported not fabricated) |
| App tests | `cd app && npm test` | 5 files, 16/16 passed (11 pre-existing + 3 in `ProjectMap.test.tsx` + 2 more in `Overview.test.tsx`; Leaflet runs for real in jsdom via a one-line `createSVGRect` shim in `setupTests.ts`) |
| App lint | `cd app && npm run lint` | 0 errors; the same 3 pre-existing warnings, none new |
| App build | `cd app && npm run build` | OK (bundle 449 kB, +Leaflet) |
| Browser | headless Chromium over the DevTools protocol against the real `npm run server` and `vite preview` | Success case: 5 polygons, 9 OSM tiles loaded, 0 EOX tiles before the toggle; toggle on: 9 EOX tiles, attribution shows both sources; popup shows fixture values; failure case via the real selector: 3 polygons; headings in order (project, "Project extent", "Current status"); 0 console errors, 0 exceptions, 0 HTTP errors; no horizontal overflow at 1440 px or 420 px. Screenshots were inspected. |

`app/src/setupTests.ts` now also runs testing-library's `cleanup()` after each test (the app's vitest has `globals: false`, so it never ran before); this exposed no defect in the existing tests.

Not run: contracts (`npm run test:contracts`), subgraph Matchstick, Graph Node E2E — no file they cover changed.

### Decisions

* **Geometry lives in `server/`, not `verification/`.** Adding a `geometry` field to M1's `Parcel` would have touched the canonical data model for a presentation need and invited the reading that M1 verifies spatially. It does not; the polygons are demo scenery served by the read layer, and the file header says so.
* **Real tile hosts.** The map is the one place the browser now contacts hosts other than the demo API (`tile.openstreetmap.org`, `tiles.maps.eox.at`); `app/nginx.conf`'s comment and the README record it. Without internet access the polygons still draw on a blank background.
* **EOX Sentinel-2 cloudless** was chosen over other free imagery because it is genuinely Sentinel-2 and its terms are explicit. Its licence is non-commercial; a commercial deployment would need a different source or a licence from EOX.
* **Authority boundaries unchanged.** The route is read-only and computes nothing; the UI still reads only from `server/`; eligibility colouring is the engine's own list, not a UI judgement.

### Deviations from Idea 0.2

None. Idea 0.2's geospatial stack (H3 cell sets, STAC evidence, real Sentinel-2 ingestion) is still unimplemented and this change does not pretend otherwise: the polygons are not an H3 root, the mosaic is not evidence, and no verification value depends on either.

### Known limitations / unresolved

* The imagery layer is context, not evidence. Showing the imagery a verification actually consumed requires the real acquisition pipeline (the `analysis/` work on `analysis-evaluation-fixes`, which is not on this branch) and per-scene rendering (COG tiles or pre-rendered PNG overlays) — an M7-scale item, not attempted here.
* Only the two fixtures the server serves have extents; the other four fixtures' parcels would be reported under `parcelsWithoutGeometry` if they were ever exposed.
* The map is rebuilt once when the verification result arrives (to recolour controls), which cancels a few in-flight tile requests — visible only in a network log as `ERR_ABORTED`, not to the user.

---

## M6.4 — Evidence page: flow diagram of the deterministic verification pipeline

**Date:** 2026-09-13
**Scope:** `app/src/components/VerificationFlow.tsx`, `app/src/components/VerificationFlow.test.tsx` (new); `app/src/pages/Evidence.tsx`, `app/src/pages/Evidence.test.tsx` (new); `app/src/styles.css`. No file under `verification/`, `guardian/`, `arc/`, `integration/`, `contracts/`, `subgraph/`, `auditor/`, or `server/` was modified.

### Objective

Give the Evidence page a visual explanation of the deterministic spatial verification pipeline: which data sources (satellite imagery, field visits, …) feed it, how they become structured observations, and the gated steps that turn those observations into a verification finding. Placed in its own panel above the "Observations" panel that holds the treated and control parcel tables.

### What was built

* **`VerificationFlow`** — a static, CSS-only flow diagram in three bands:
  1. *Evidence sources*: one card per family. The three come from `EvidenceSource` in `verification/models.ts` (optical satellite, SAR satellite, ground report); a fourth, "Drone & IoT sensors", is shown dashed as a future input listed in `docs/VERIFICATION.md` §3 but not in the data model. Each card states honestly what the loaded fixture holds — a record count per source (e.g. "15 synthetic observations in this fixture"), "In the data model — none in this fixture", or "Not yet in the data model". This count is the only thing the component reads from live data.
  2. *Structured evidence*: the `EvidenceObservation` record shape, splitting into the treated parcel and the candidate control parcels, then converging.
  3. *Deterministic pipeline*: nine stages in the order `verifyProject()` runs them (evidence sufficiency → control matching → parallel-trend diagnostic → difference-in-differences → additionality → uncertainty → conservative lower bound → quality gate → `VerificationResult`). Gate stages are highlighted with a legend explaining that a failed gate yields `INSUFFICIENT_EVIDENCE` with settled quantity 0; the output stage links to the Verification page, where the real result of running the pipeline on the same fixture is shown.
* Connectors are drawn with CSS borders and pseudo-elements, so the diagram wraps to a single column on narrow screens without a chart library or SVG.
* A figcaption repeats that all sources are synthetic and that no real satellite scene or field visit has been ingested.

### Tests run and results (actual, this session)

| Suite | Command | Result |
|---|---|---|
| Root typecheck | `npm run typecheck` | 0 errors |
| Root vitest | `npm test` | 14 files, 110/110 passed (unchanged — no root code touched) |
| App tests | `cd app && npm test` | 7 files, 20/20 passed (16 pre-existing + 3 in `VerificationFlow.test.tsx`: stage order/gates/output, per-source counts without invented sources, synthetic statement and Verification link; + 1 in `Evidence.test.tsx`: the diagram heading precedes the Observations heading and the tables still render) |
| App lint | `cd app && npm run lint` | 0 errors; the same 3 pre-existing warnings, none new |
| App build | `cd app && npm run build` | OK |
| Browser | headless Chromium over the DevTools protocol against the real `npm run server` and `vite preview`, success fixture | Diagram renders above the Observations panel at 1440 px and 420 px; 0 console errors, 0 exceptions, no horizontal overflow at either width. Screenshots inspected. |

Not run: contracts, subgraph Matchstick, Graph Node E2E — no file they cover changed.

### Decisions

* **Descriptive, not computed.** The stage list is hand-written to mirror `verification/engine.ts` and `docs/VERIFICATION.md` §2; the UI does not introspect the engine. If the pipeline order changes, this component must be updated by hand — noted in its file header.
* **Sources shown as families, not as claims of ingestion.** The user asked for a view of how satellite imagery and field visits "would be" incorporated. The diagram shows the modelled input families but labels, per fixture, which ones actually contain records, so it cannot be read as saying SAR or field data was used when it was not.
* **Authority boundaries unchanged.** The component derives nothing beyond a record count per source; no verification value is computed or restated in the browser.

### Deviations from Idea 0.2

None. The diagram describes the M1 pipeline as implemented; it does not add methodology.

### Known limitations / unresolved

* The diagram is static prose plus layout; it does not animate the fixture through the stages or show per-stage intermediate values (those remain on the Verification page).
* Only the four source families are shown; the future acquisition pipeline (STAC/Sentinel ingestion on the `analysis` branches) is not represented beyond the "future inputs" card.
