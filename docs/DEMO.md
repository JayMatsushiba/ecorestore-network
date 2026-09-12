# Ecorestore Network — Demonstration Plan

> **Status note:** this document describes the full intended demo flow. As of this note, deterministic verification (M1), Guardian (M2), Arc settlement (M3/M3.1), the M1→M2→Arc local vertical integration (M4), local Graph Node indexing + Auditor correlation (M5), and the React presentation layer (M6) are implemented, tested, and actually run end to end — see §8 below for the exact commands and observed results. Guardian is a Mock adapter, Arc runs on a local Hardhat network, and the Graph runs on a local Docker Graph Node — none of this is live Hedera/Arc/Graph Network infrastructure. See `docs/DEVELOPMENT_LOG.md` for the authoritative current status and `docs/M6_M7_READINESS_REPORT.md` for the deployment-readiness assessment.

## 1. Demonstration Principle

The demo uses one synthetic British Columbia restoration project.

All environmental measurements are synthetic.

The application must visibly state:

> SYNTHETIC DEMONSTRATION DATA — NOT REAL FIELD, SATELLITE, SENSOR OR REGULATORY MEASUREMENT.

---

## 2. Demonstration Project

Working name:

**Kootenay Riparian Restoration — British Columbia**

The location is used as a synthetic geographic context.

No claim is made that the displayed measurements represent actual conditions at the site.

---

## 3. Demonstration Flow

```text
Sponsor selects project
        ↓
Reviews parcel and evidence
        ↓
Restoration Deed is funded
        ↓
Evidence is submitted
        ↓
Auditor investigates
        ↓
Deterministic verification runs
        ↓
Parallel-trend diagnostic
        ↓
Additionality calculation
        ↓
Uncertainty calculation
        ↓
Lower-bound settlement quantity
        ↓
Guardian verification
        ↓
Arc settlement
        ↓
Outcome displayed
        ↓
History available through Graph
```

---

## 4. Critical Demonstration Moment

The most important moment is not the UI.

It is showing that:

```text
claimed change
        ↓
observed parcel change
        ↓
regional/control change
        ↓
additionality-adjusted change
        ↓
uncertainty interval
        ↓
conservative lower bound
        ↓
settlement
```

The demo should make clear why gross ecological change is not automatically the amount that gets paid.

---

## 5. Failure Case

A second test case should eventually demonstrate:

```text
parallel-trend failure
        ↓
INSUFFICIENT_EVIDENCE
        ↓
no settlement
```

This is a critical trust property.

---

## 6. Synthetic Data Rules

Never:

* imply synthetic values are real satellite observations;
* cite synthetic values as field measurements;
* describe the demonstration as regulatory certification;
* call the outcome a regulatory biodiversity credit.

Use:

* synthetic dataset;
* synthetic observation;
* demonstration outcome;
* prototype verification.

---

## 7. Demo Priority

If time becomes constrained:

1. deterministic verification;
2. additionality;
3. uncertainty;
4. Arc settlement;
5. Guardian;
6. Graph;
7. Auditor;
8. UI polish.

Do not cut the scientific core to add cosmetic features.

---

## 8. M6 Implementation Notes — the demo actually run

This section documents the demo as it was actually executed and observed during M6, superseding §1-§7's description of intent. See `docs/M6_M7_READINESS_REPORT.md` for the full output-verification table and reality audit.

### 8.1 Architecture

```text
Persistent Hardhat node (npx hardhat node --hostname 0.0.0.0)
        ↓
scripts/deployAndRunLocalDemo.cjs — real M1 → M2 → Arc chain, funds and settles one deed
        ↓
Local Docker Graph Node stack (subgraph/docker-compose.yml)
        ↓
server/index.ts — thin HTTP API calling the real M1/M2/M4/M5 functions directly (holds no signing key)
        ↓
app/ — React (Vite), fetches from the API server, presentation only
```

### 8.2 Prerequisites

Node.js v24.14.1, npm 11.11.0, Docker Desktop 29.1.3, a modern desktop browser. See `README.md` "Prerequisites" for the authoritative list.

### 8.3 Exact startup sequence used

```bash
npx hardhat node --hostname 0.0.0.0                          # terminal 1, left running
npm run demo:local                                            # real M1->M2->Arc chain
cd subgraph && docker compose up -d                            # Postgres, IPFS, Graph Node
npm run configure && npm run codegen && npm run build
npm run create-local && npm run deploy-local
cd ..
npm run server                                                 # terminal 2, left running
cd app && npm run dev                                           # terminal 3, left running
```

### 8.4 What was actually verified

A headless Chromium browser (Playwright) loaded every page (`Overview`, `Evidence`, `Verification`, `Guardian`, `Financial / Deed`, `Provenance`, `Auditor`, `About`) against the real running stack. Result: **zero console errors, zero page errors, zero failed network requests**, across all 8 pages, in both the success case (`FIXTURE_PARTIAL_SETTLEMENT`) and after switching to the failure case (`FIXTURE_PARALLEL_TREND_FAIL`) via the UI's "Verification case" selector. A full-page reload was also verified to work correctly.

Key values were spot-checked against the real backend during this run (see `docs/M6_M7_READINESS_REPORT.md` §4 for the full table): observed change 61.00 pp, control change 15.00 pp, difference-in-differences 46.00 pp, additionality-adjusted 21.39 ha, uncertainty interval [18.18, 24.60] ha, settled quantity 18.18 ha, on-chain `settledQuantityScaled` 18181500 — all traced correctly from `verifyProject()` through to the rendered page.

**One real bug was found and fixed during this verification**, not merely documented: the Provenance page's "DeedFunded" timeline entry showed "block –" with no transaction hash. Root cause: `graph/theGraphProvider.ts`'s GraphQL query never requested `blockNumber`/`transactionHash` for `Funding`/`Refund`/`Cancellation` entities, even though the subgraph schema (M5) already stored them. Fixed by extending the query and `graph/types.ts`'s `IndexedFunding`/`IndexedRefund`/`IndexedCancellation` interfaces; re-verified visually afterward. See `docs/DEVELOPMENT_LOG.md`'s M6 entry.

**Failure-mode testing performed:** the Graph Node container was stopped mid-session; the Financial and Auditor pages immediately and correctly showed a specific `UNAVAILABLE` status naming the unreachable subsystem and the exact remediation command, not a generic error. The container was then restarted and the pages recovered without a page reload being required (the periodic/on-navigation fetch simply succeeded on the next request).

### 8.5 Reset procedure

See `README.md` "Resetting the Demo".

### 8.6 Current limitations (carried from M1-M5, restated for the UI)

- `methodologyVersion` is not shown as a Graph-indexed on-chain field on the Financial page, because it genuinely is not indexed (docs/GRAPH.md §7.5) — the Guardian page shows it instead, from the real off-chain M2 credential.
- The Financial/Provenance/Auditor pages always reflect the one deed actually funded and settled on-chain (the success-case fixture) — switching the "Verification case" selector changes what the Verification/Guardian/Auditor pages compute and display off-chain, but does not create a second on-chain deed.
- The demo API server (`server/`) is local-only: no auth, permissive CORS. Not suitable for any network-exposed deployment as-is — see `docs/M6_M7_READINESS_REPORT.md`.
