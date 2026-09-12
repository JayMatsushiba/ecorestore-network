# M6 → M7 Readiness Report

**Date:** 2026-09-11
**Author:** Claude Code (M6 implementation session)
**Audience:** the project architect, before M7 begins

This report is the primary handoff artifact for M7. It documents what M6 actually built, what was actually run and verified (not merely compiled), what remains before any real deployment, and a prioritized backlog. See `docs/DEVELOPMENT_LOG.md`'s M6 entry for the dated implementation log this report summarizes.

---

## 1. Executive Summary

```text
M6 STATUS: PASS

M7 READY: YES

DEPLOYMENT READY: NO
```

M6 delivered a working React UI (`app/`) and a thin API layer (`server/`) on top of the real, unmodified M1-M5 system. The complete local demo was actually started end to end — persistent Hardhat node, real M1→M2→Arc chain, Docker Graph Node stack, subgraph deployment, API server, and React dev server — and driven with a headless browser (Playwright) against the live stack, not just compiled. Zero console errors, zero page errors, zero failed requests were observed across all 8 pages in both the success and failure verification cases. One real integration bug (missing block/tx-hash provenance on Funding/Refund/Cancellation events, an M5-era gap) was found during this verification and fixed, not just documented.

Nothing in this milestone is deployment-ready: the local Hardhat network, Mock Guardian, MockUSDC, local Graph Node, and the unauthenticated local API server are all explicitly local/mock components that M7 must replace or productionize before any real release. No production infrastructure, secrets, or credentials exist anywhere in this repository.

---

## 2. Actual Demo Result

**The demo was actually run**, not assumed to work from a successful build. Exact sequence:

```bash
npx hardhat node --hostname 0.0.0.0                              # persistent chain, left running
npm run demo:local                                                 # real M1->M2->Arc chain; wrote subgraph/deployment.local.json
cd subgraph && docker compose up -d                                 # Postgres, IPFS, Graph Node
npm run configure && npm run codegen && npm run build
npm run create-local && npm run deploy-local
cd ..
npm run server                                                      # API server on :4000
cd app && npm run dev                                                # Vite dev server on :5173
```

Verification method: a headless Chromium instance (Playwright 1.63, installed in an OS temp directory — never added to any project's dependencies) navigated to `http://localhost:5173/#/<route>` for each of the 8 pages, captured `console` events, `pageerror` events, and `requestfailed` events, and took a full-page screenshot of each.

**Services started:** persistent Hardhat node (port 8545), Postgres/IPFS/Graph Node (Docker, ports 5432/5001/8000-8040), demo API server (port 4000), Vite dev server (port 5173).

**Application URL:** `http://localhost:5173`

**Successful workflow observed:**
- Overview page: real project identity, methodology version, and current verification/deed status all rendered.
- Evidence page: all synthetic observations grouped by parcel, correctly labeled synthetic.
- Verification page: full M1 pipeline output rendered — pipeline stage strip, result fields, uncertainty-interval bar, diagnostics.
- Guardian page: real M2 workflow lifecycle, submission/authorization/credential state, credential fields.
- Financial/Deed page: real on-chain deed state via the Graph, plus a read-only Arc payload preview.
- Provenance page: real event timeline (DeedCreated → DeedFunded → VerificationSubmitted → SettlementExecuted) in correct block order.
- Auditor page: real `auditDeed()` output, status `CONSISTENT`, zero anomalies, explanation text referencing the real settled quantity.
- About page: architecture summary and real/local/mock/deferred table.
- Switching the "Verification case" selector to the failure fixture correctly re-rendered the Verification page with `INSUFFICIENT_EVIDENCE`/`FAIL` states and a "no uncertainty interval — not evaluated" message.
- Full-page reload was verified to work correctly after the fixture switch.

**Observed failures (both found and fixed during this session):**
1. Playwright was accidentally installed into the root project's `package.json` instead of an isolated scratch directory — caught immediately, reverted with `npm uninstall playwright` before any commit.
2. Provenance page's `DeedFunded` entry showed `block –` with no transaction hash — root-caused to a GraphQL query gap in `graph/theGraphProvider.ts` (M5-era), fixed, and re-verified with a fresh screenshot.

**Remaining failures:** none observed in the final verification pass.

---

## 3. UI Verification

| Page | Loads | Data renders | Console errors | Notes |
|---|---|---|---|---|
| Overview | Yes | Yes | 0 | Project identity, verification status, deed status |
| Evidence | Yes | Yes | 0 | All observations grouped by parcel |
| Verification | Yes | Yes | 0 | Both success and failure fixtures verified |
| Guardian | Yes | Yes | 0 | Full workflow lifecycle + credential |
| Financial / Deed | Yes | Yes | 0 | Real on-chain state; graceful UNAVAILABLE when Graph stopped |
| Provenance | Yes | Yes | 0 | Event timeline; bug found and fixed here |
| Auditor | Yes | Yes | 0 | Real `auditDeed()` output |
| About | Yes | Yes | 0 | Static architecture/status summary |

**Interactions tested:** navigation between all 8 pages; the "Verification case" fixture selector (success ↔ failure); full-page reload; Graph Node stopped/restarted mid-session.

**Network behavior:** all `/api/*` requests observed to succeed except when the Graph Node container was deliberately stopped, at which point `/api/deed` and `/api/audit` returned a structured `UNAVAILABLE` response (HTTP 200 with a status field, not a 5xx) — the UI rendered this as a specific, named-subsystem message, never a generic error.

**Visual issues found:** none blocking; the uncertainty-interval bar's "settled quantity" marker can visually coincide with the range's lower-bound edge when they are equal (which they always are in this prototype's conservative-settlement rule) — a minor, non-misleading redundancy, not fixed in M6 (see backlog, LOW).

**Usability issues found:** none blocking for a judge/developer demo.

---

## 4. Output Verification

All values below were cross-checked against the real backend during the actual demo run (fixture: `FIXTURE_PARTIAL_SETTLEMENT`).

| Output | Source of Truth | UI Correct? | Notes |
|---|---|---|---|
| `projectId` | `verification/fixtures.ts` | PASS | `kootenay-riparian-restoration-partial`, exact match |
| `methodologyVersion` | `verification/config.ts` | PASS | `ecorestore-m1-v0.1`, exact match |
| `observedChange` | `verifyProject()` output | PASS | 61.00 pp, matches treated parcel 24.0→85.0 |
| `controlChange` | `verifyProject()` output | PASS | 15.00 pp, matches mean of two eligible controls |
| DiD (observed − control) | derived display only, from the two fields above | PASS | 46.00 pp |
| `additionalityAdjusted` | `verifyProject()` output | PASS | 21.39 ha, matches (46/100)×46.5 |
| `uncertainty.{lowerBound,pointEstimate,upperBound}` | `verifyProject()` output | PASS | 18.18 / 21.39 / 24.60 ha |
| `settledQuantity` | `verifyProject()` output | PASS | 18.18 ha (rounded from 18.1815) |
| `verificationStatus` | `verifyProject()` output | PASS | `PARTIAL`; `INSUFFICIENT_EVIDENCE` correctly shown for the failure fixture |
| Guardian `credentialId`/`verifierId`/`methodologyVersion` | `MockGuardianAdapter` output | PASS | Real credential fields, not fabricated |
| `verificationId` (on-chain) | Graph-indexed `Verification` entity | PASS | Matches `subgraph/deployment.local.json` exactly |
| `deedId` / `deedStatus` | Graph-indexed `RestorationDeed` entity | PASS | `0` / `SETTLED` |
| `settledQuantityScaled` (on-chain) | Graph-indexed `RestorationDeed` entity | PASS | `18181500`, matches `scaleQuantity(18.1815, 6)` |
| `settlementAmount` | Graph-indexed `Settlement` entity | PASS | 18.18 mUSDC |
| Event provenance (block/tx hash) | Graph-indexed event entities | **FAIL → FIXED** | Funding/Refund/Cancellation initially missing block/tx hash — fixed this session, re-verified PASS |
| Auditor `status`/`explanation` | `auditDeed()` output | PASS | `CONSISTENT`, explanation references the real settled quantity |

---

## 5. Reality / Scientific Integrity

**Terminology review:** every label in the UI corresponds to an actual field in `VerificationResult`, `GuardianCredential`, or `DeedHistory` — no invented metric names, no unexplained Web3 jargon substituted for a plain environmental term where one exists (e.g. "canopy cover fraction," "riparian forest," "elevation/slope/aspect/soil type/climate zone" are used as-is from the fixtures, not renamed for effect).

**Environmental data realism:** land cover (`riparian_forest`, `montane_grassland`), soil type (`alluvial_loam`, `sandy_loam`), climate zone (`interior_temperate_wet`/`_dry`), elevation (595-1200 m), slope (5.5-15°), aspect (compass points) are all plausible for a BC interior riparian site. Canopy-cover values (20-85%) and a two-year pre-treatment / ~1.5-year post-treatment observation window are plausible for optical remote-sensing-derived vegetation monitoring.

**Units:** hectares for area/settlement quantities, percentage points for the canopy-cover metric, ISO 8601 dates for observations — consistent throughout.

**Synthetic-data labeling:** the disclaimer banner ("SYNTHETIC DEMONSTRATION DATA — not field measurements, not satellite observations, not a regulatory environmental credit") is present on every page (verified: `hasDisclaimer: true` on all 8 pages in the Playwright run). The About page and Evidence page additionally state the synthetic nature of every value in prose.

**Unsupported claims found:** none. No page claims satellite processing, field validation, regulatory certification, or a certified carbon/biodiversity credit.

**Artificial terminology found:** none introduced by M6.

| Issue | Classification |
|---|---|
| Disclaimer present on every page | FIXED IN M6 (built correctly from the start) |
| No invented environmental terminology | ACCEPTABLE — verified, not an issue |
| Uncertainty model is a fixed-fraction margin, not a fitted statistical interval | ACCEPTABLE PROTOTYPE LIMITATION (inherited from M1, correctly disclosed in the UI's boundary note) |
| No production remote-sensing pipeline exists | ACCEPTABLE PROTOTYPE LIMITATION (disclosed on the About page) |
| `methodologyVersion` not shown as an on-chain Graph field | ACCEPTABLE PROTOTYPE LIMITATION — genuinely not indexed (docs/GRAPH.md §7.5); shown instead from the real Guardian credential |

---

## 6. Architecture

| Milestone | Real? | Notes |
|---|---|---|
| M1 verification | Real | Unmodified; deterministic; re-verified via UI output checks |
| M2 Guardian | Real workflow logic, Mock adapter | No live Hedera deployment |
| M3/M3.1 RestorationDeed/Arc | Real Solidity | Local Hardhat network only |
| M4 integration | Real | Unmodified |
| M5 Graph + Auditor | Real (local Graph Node) | One bug found/fixed this session (event provenance fields) |
| M6 React UI | Real | Presentation only; no authority acquired |

**Authority boundaries:** verified intact by inspection and by the Auditor page's own explicit "authority boundary" listing, which is rendered from static text describing real code behavior (not a live check, but the underlying claims were verified against `auditor/agent.ts`'s actual implementation during M5 and re-confirmed unchanged this session).

**Trust boundaries:** unchanged from M3.1/M4/M5 — `RestorationDeed.authorizedVerifier` remains the sole financial-authorization mechanism; nothing in `app/` or `server/` holds a signing key or can construct a transaction.

**End-to-end coherence:** confirmed — the same `verificationId` and `settledQuantityScaled` that `scripts/deployAndRunLocalDemo.cjs` produced on-chain are the exact values the UI displays, traced through `TheGraphProvider` and `auditDeed()`.

---

## 7. Security

- **Secrets:** none exist in this repository. No `.env` file with real values, no API keys, no private keys, no wallet seed phrases.
- **Wallets:** the demo uses Hardhat's default, publicly-known test accounts exclusively. `RestorationDeed.authorizedVerifier` is one such test account's address — appropriate for local demo only.
- **Client-side security:** `app/` makes no direct blockchain calls, holds no signer, and cannot construct or send a transaction. `server/` similarly holds no signing key — it only reads.
- **Contract security assumptions:** unchanged from M3.1's security review (`docs/ARC.md` §9.9, §10) — `authorizedVerifier` is address-based, not cryptographically bound to a Guardian-attested identity; the contract has not been externally audited.
- **Guardian assumptions:** unchanged from M2 (`docs/GUARDIAN.md` §9.9) — no cryptographic binding proves a `VerificationResult` came from a genuine `verifyProject()` execution.
- **Graph assumptions:** read-only by protocol design; no mutation path exists for `graph/theGraphProvider.ts` to misuse even if compromised.
- **Auditor limitations:** stateless, read-only, no persistence, no LLM (docs/AUDITOR.md §8.6-8.7).
- **Local/testnet limitations:** `server/`'s CORS is `Access-Control-Allow-Origin: *` with no authentication — acceptable only because it is bound to `localhost` in this demo; this is a hard blocker for any network-exposed deployment (see backlog, BLOCKER).
- **Production security gaps:** no rate limiting, no auth, no HTTPS, no input validation beyond a fixture-name allowlist on `server/`'s routes (acceptable for a local demo whose only "input" is a same-origin dropdown selection; would need real hardening before any public exposure).

**The system's tests passing does not mean it is secure** — this is a prototype with explicit, documented trust-boundary simplifications (address-based verifier authorization, unaudited contract, mock Guardian) that M7 must not silently paper over.

---

## 8. Deployment

| Component | Status |
|---|---|
| React app (`app/`) | READY WITH CONFIGURATION — needs a real API base URL and static hosting; `HashRouter` avoids needing server routing config |
| Demo API server (`server/`) | REQUIRES M7 WORK — needs auth, CORS restriction, HTTPS, and likely a rewrite of its "always re-run M1/M2 fresh" pattern into something backed by real persistence if used beyond a single demo |
| Arc / RestorationDeed contract | READY WITH CONFIGURATION — same bytecode deploys unchanged to Arc Testnet; needs a real RPC endpoint, a real funded deployer key (not committed to this repo), and a real USDC address |
| Hedera Guardian | REQUIRES M7 WORK — no live integration exists; `MockGuardianAdapter`'s interface is the intended seam (`docs/GUARDIAN.md` §9.1) |
| The Graph | REQUIRES M7 WORK — local Graph Node only; hosted/decentralized deployment not attempted |
| Database | NOT APPLICABLE — Graph Node's own Postgres is a Graph Node implementation detail, not an application database |
| AWS | REQUIRES M7 WORK — nothing deployed; `docs/ARCHITECTURE.md`'s eventual architecture names AWS as the future Auditor/API host |
| Secrets management | REQUIRES M7 WORK — no secrets exist yet because nothing is deployed; a real deployment needs a real secrets manager (e.g. AWS Secrets Manager) for a deployer key and any future Guardian/Hedera credentials |
| Domains / API endpoints | REQUIRES M7 WORK — none provisioned |
| RPC endpoints | REQUIRES M7 WORK — local Hardhat only; needs a real Arc Testnet/Mainnet RPC provider |
| Wallets | REQUIRES M7 WORK — needs a real, funded deployer/verifier wallet with proper key custody, not a Hardhat default account |
| Testnet/mainnet | DEFERRED — no testnet deployment attempted in M6 |
| USDC | REQUIRES M7 WORK — `MockUSDC` only; needs the real USDC contract address on the target network |

---

## 9. M7 Backlog

### BLOCKER

1. **`server/` has no authentication and permissive CORS.** Problem: anyone who can reach the server's port can query it (read-only, but still an uncontrolled information-exposure surface if ever network-exposed). Why it matters: this server must never be exposed beyond localhost as-is. Fix: add auth (even a simple shared secret) and restrict CORS before any deployment beyond a local demo. Files: `server/index.ts`. Before deployment: yes.
2. **No live Hedera Guardian integration.** Problem: `MockGuardianAdapter` is the only Guardian implementation. Why it matters: the project's core value proposition depends on a real methodology/credential authority. Fix: implement a `GuardianAdapter` against real Hedera Guardian (policy JSON, HCS submission, DID-based verifier identity) per `docs/GUARDIAN.md` §9.8's own "production" column. Files: new `guardian/hederaAdapter.ts` (or similar), `guardian/policy/*`. Before deployment: yes.
3. **No cryptographic binding between `authorizedVerifier` and a real Guardian-attested identity.** Problem: the financial trust boundary is a bare Ethereum address. Why it matters: whoever controls that key can settle a deed regardless of Guardian's actual decision. Fix: DID-linked key registry or signature scheme binding the on-chain verifier address to a Guardian credential, per `docs/ARC.md` §9.5, §9.9. Files: `contracts/RestorationDeed.sol` (careful, security-reviewed change), `arc/`. Before deployment: yes.
4. **No Arc Testnet/Mainnet deployment exists.** Problem: everything runs on a local Hardhat network. Why it matters: this is the literal definition of "not deployed." Fix: deploy `RestorationDeed`/`MockUSDC`→real-USDC swap to Arc Testnet first, with a real funded deployer key held in a secrets manager, not a repository file. Files: new deployment scripts, `hardhat.config.cjs` network config. Before deployment: yes.

### HIGH

5. **`server/`'s re-run-everything-per-request pattern won't scale or persist.** Problem: `/api/verification`, `/api/guardian`, and `/api/audit` recompute the entire M1→M2 chain fresh on every request; there's no persistence of a Guardian workflow across requests beyond a single call. Why it matters: fine for a single-deed local demo, wrong for anything with multiple real users/deeds. Fix: introduce real persistence (a database) for Guardian submissions/credentials and cache verification results by project+config. Files: `server/index.ts`, likely a new `guardian/` persistence layer. Before deployment: for anything beyond a single-demo instance, yes.
6. **No automated end-to-end (Playwright) test suite committed.** Problem: M6's UI verification was performed with a temporary script in an OS temp directory, not a repository-tracked test. Why it matters: regressions in the UI/API integration won't be caught by `npm test`. Fix: add a proper `app/e2e/` Playwright suite (or similar) as a tracked, runnable test target. Files: new `app/` test infra. Before deployment: recommended, not strictly blocking.
7. **Contract has not been externally audited.** Problem: `RestorationDeed.sol` has only had internal security review (M3's own review, M3.1's patch). Why it matters: real funds require real audit assurance. Fix: commission an external audit before any Mainnet deployment. Files: `contracts/RestorationDeed.sol`. Before deployment: yes, for Mainnet; recommended even for Testnet.
8. **No secrets management solution exists.** Problem: no deployment has ever needed one yet. Why it matters: the first real deployment will need a deployer key and (eventually) Guardian/Hedera credentials handled correctly from day one. Fix: provision AWS Secrets Manager (or equivalent) before the first Testnet deployment; never commit a key to the repository. Files: new deployment tooling/CI config. Before deployment: yes.

### MEDIUM

9. **`HashRouter` is a local-demo choice.** Problem: hash-based routing is unusual for a production URL scheme. Why it matters: cosmetic/SEO/shareability concerns for a real public UI. Fix: switch to `BrowserRouter` with proper server-side history-fallback once real hosting exists. Files: `app/src/App.tsx`. Before deployment: no, but should happen alongside real hosting setup.
10. **No rate limiting or input validation hardening on `server/`.** Problem: routes only validate the `fixture` query param against a small allowlist. Why it matters: fine for a single local user; not fine for any exposed endpoint. Fix: add proper request validation and rate limiting if `server/` (or its successor) is ever exposed. Files: `server/index.ts`. Before deployment: yes, if this server (or a descendant of it) is ever network-exposed.
11. **Multi-deed / multi-project UI support does not exist.** Problem: the UI is built around exactly one synthetic project and one on-chain deed. Why it matters: a real product needs to list and browse many projects/deeds. Fix: extend `server/` and `app/` to list/browse multiple `RestorationDeed`s via `graph/theGraphProvider.ts`'s already-existing `getDeedsByProject`. Files: `server/index.ts`, new `app/` list views. Before deployment: no, but likely needed before real users onboard.

### LOW

12. **Uncertainty-bar visual redundancy** (settled-quantity marker coincides with the lower-bound edge). Cosmetic only. Files: `app/src/pages/Verification.tsx`.
13. **No dark-mode / print stylesheet.** Not requested by the M6 prompt; optional polish.

### OPTIONAL

14. **Subgraph MCP integration** for AI-compatible schema discovery, mentioned as a possibility in `docs/GRAPH.md` §6 — not pursued in M6, no current requirement.
15. **LLM-based Auditor explanation generation** — `auditor/agent.ts`'s `explanation` field is currently template-string only; a richer natural-language explanation is plausible future work but must remain bound by the Auditor's existing authority limits (`docs/AUDITOR.md` §8.6).

---

## 10. Final M7 Recommendation

```text
M6 STATUS: PASS

M7 READY: YES

DEPLOYMENT READY: NO

BLOCKERS:
- server/ has no authentication or CORS restriction (must not be network-exposed as-is)
- No live Hedera Guardian integration exists (MockGuardianAdapter only)
- authorizedVerifier is not cryptographically bound to a real Guardian-attested identity
- No Arc Testnet/Mainnet deployment exists

REQUIRED M7 FIXES:
1. Add authentication and CORS restriction to server/ (or replace it with a properly
   secured API) before any network exposure.
2. Implement a real Hedera Guardian adapter (policy JSON, HCS submission, DID-based
   verifier identity) alongside or in place of MockGuardianAdapter.
3. Close the authorizedVerifier trust gap — bind the on-chain verifier address to a
   real Guardian-attested identity (signature scheme or DID-linked key registry).
4. Deploy RestorationDeed/MockUSDC->real-USDC to Arc Testnet with a securely-held
   deployer key (secrets manager, not a repository file); do not skip straight to Mainnet.
5. Commission an external audit of RestorationDeed.sol before any Mainnet deployment.
6. Add real persistence for Guardian workflow state if serving more than one demo
   instance at a time.

OPTIONAL M7 IMPROVEMENTS:
1. Commit a tracked Playwright end-to-end test suite instead of relying on ad hoc
   verification scripts.
2. Switch app/ from HashRouter to BrowserRouter once real hosting with history-fallback
   routing exists.
3. Extend the UI to list/browse multiple projects and deeds, not just the one synthetic
   demo project.
```

STOP