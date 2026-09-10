# Ecorestore Network

Spatially-verified restoration finance. ETHOnline 2026.

Capital for ecological restoration is released against spatially verified,
uncertainty-bounded, additionality-adjusted evidence of ecological change. The verified
outcome becomes an auditable asset a corporate buyer can hold, audit, and retire.

**`docs/` is the source of truth.** Start with
[`docs/PRODUCT.md`](docs/PRODUCT.md) for what this is and who it is for;
[`docs/DECISIONS.md`](docs/DECISIONS.md) records why the design is what it is, what is
still open, and the risks being carried knowingly.

## What runs today

```text
REAL Sentinel-2 L2A (Earth Search STAC, 72 scenes)      SIMULATED Tiers 1-3, labelled
            │                                                     │
            ▼                                                     ▼
   verification/engine.ts — deterministic: controls drawn by the committed rule,
   parallel-trend gate, DiD vs far ring, leakage from near/far divergence,
   bootstrap interval + placebo coverage, issuance gates, lower bound
            │
            ▼  canonical VerificationResult (resultHash, analysisPlanHash, runIndex)
            │
   ┌────────┴──────────────────────────────┐
   ▼                                       ▼
guardian/adapter.ts                  contracts/RestorationDeed.sol (Foundry, 31 tests)
signed W3C VC (Ed25519 did:key)      recordVerificationRun → verifyMilestone (replay-
→ externalDataBlock request          protected, plan-hash-bound) → releaseTranche at the
→ ATS setDocument/issueByPartition   lower bound, benefit share, retention, assignTranche
   calldata (prepared, not sent)
```

`scripts/demo.ts` runs three scenarios end to end and writes `out/demo/`:

| Scenario | Tier 0 | Outcome |
|---|---|---|
| `real` | REAL | `NOT_ADDITIONAL` — the parcel did not green relative to its far-ring controls, so nothing is paid. No intervention took place on this ground. |
| `synthetic` | **SIMULATED** (real series + injected +0.25 NDVI, labelled) | `PARTIAL` — settled at the 95% lower bound, VC signed, Guardian request staged, issuance calldata prepared, tranche released on a local chain. |
| `trend-failure` | REAL | `INSUFFICIENT_EVIDENCE` — parallel-trend gate refuses to settle. |

## Quickstart

```bash
npm install
npm test                 # vitest: engine, geometry, stats, adapter, client, auditor
npm run typecheck
npm run test:contracts   # needs Foundry: https://getfoundry.sh
npm run demo             # offline: uses the committed REAL Tier 0 snapshot

# End to end on a local chain
anvil &
npm run build:contracts
DEMO_RPC_URL=http://127.0.0.1:8545 npm run demo

# Re-acquire the REAL Tier 0 snapshot from Earth Search (network, ~5 min)
npm run acquire
```

## Repository

| Path | Contents |
|---|---|
| `docs/PRODUCT.md` | **What this is, who buys it, and why** |
| `docs/DECISIONS.md` | Decisions and their reasons, open approvals, risks carried |
| `docs/ROADMAP.md` | Build sequence, milestones, cut order |
| `docs/` | Architecture, verification, Guardian, Arc, Graph, Auditor, demo, deployment, x402, development log |
| `verification/` | Deterministic verification engine, REAL Tier 0 acquisition, simulated Tiers 1-3, fixtures |
| `contracts/` | Arc Restoration Deed (Solidity, Foundry) and its TypeScript client |
| `guardian/` | Verdict VC schema, DID-signed credential, externalDataBlock request, ATS seam |
| `auditor/` | Orchestration and explanation boundary (no LLM) |
| `scripts/demo.ts` | End-to-end demonstration |
| `app/` | React application |

## Authority model

| Component | Authority |
|---|---|
| Ecorestore Verification Engine | Scientific result |
| Hedera Guardian | Methodology, workflow, credentials, outcome state |
| Arc Restoration Deed | Financial escrow and settlement |
| The Graph | Indexed blockchain history |
| Restoration Auditor | Orchestration and explanation |
| React application | Presentation |
| x402 payment gateway | API access payment only — never settlement |

**No AI-generated numerical result may directly determine financial settlement.**

## Data provenance

**Tier 0 (Sentinel-2 L2A) is real.** `verification/fixtures/tier0-kootenay-riparian-001.json`
holds 72 genuine acquisitions over the Creston Valley, British Columbia, with their STAC
scene IDs and processing graph version. **Tiers 1–3 (drone, IoT, ground reports) are
simulated** from realistic parameters and are labelled as simulated everywhere they
appear. The `synthetic` demo scenario injects a treatment effect into the real series and
is labelled SIMULATED at Tier 0 in every artefact it produces.

## Status

Prototype of the M1–M4 vertical slice. See `docs/DEVELOPMENT_LOG.md` for what is built
and what is deferred, and `docs/DECISIONS.md` §3 for the methodology parameters that
remain provisional pending approval.
