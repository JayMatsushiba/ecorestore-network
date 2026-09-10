# Ecorestore Network

Spatially-verified restoration finance. ETHOnline 2026.

Capital for ecological restoration is released against spatially verified,
uncertainty-bounded, additionality-adjusted evidence of ecological change. The verified
outcome becomes an auditable asset a corporate buyer can hold, audit, and retire.

**Canonical baseline: [`proposals/idea-0.3.md`](proposals/idea-0.3.md).** Start with its
§1 one-page summary; §13 is the decision log.

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
guardian/adapter.ts                  contracts/RestorationDeed.sol (Foundry, 28 tests)
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
| `proposals/idea-0.3.md` | **Canonical product baseline** |
| `proposals/idea-0.2.md` | Historical — the text reviewed in `proposal_review.md` |
| `proposal_review.md` | Incentive, scientific and landscape review (2026-09-09) |
| `docs/` | Architecture, verification, Guardian, Arc, Graph, Auditor, demo, development log |
| `verification/` | Deterministic verification engine, REAL Tier 0 acquisition, simulated Tiers 1-3, fixtures |
| `contracts/` | Arc Restoration Deed (Solidity, Foundry) and its TypeScript client |
| `guardian/` | Verdict VC schema, DID-signed credential, externalDataBlock request, ATS seam |
| `auditor/` | Orchestration and explanation boundary (no LLM) |
| `scripts/demo.ts` | End-to-end demonstration |
| `app/` | React application |
| `ideation/` | Historical brainstorming and superseded drafts |

## Authority model

| Component | Authority |
|---|---|
| Ecorestore Verification Engine | Scientific result |
| Hedera Guardian | Methodology, workflow, credentials, outcome state |
| Arc Restoration Deed | Financial escrow and settlement |
| The Graph | Indexed blockchain history |
| Restoration Auditor | Orchestration and explanation |
| React application | Presentation |

**No AI-generated numerical result may directly determine financial settlement.**

## Data provenance

**Tier 0 (Sentinel-2 L2A) is real.** `verification/fixtures/tier0-kootenay-riparian-001.json`
holds 72 genuine acquisitions over the Creston Valley, British Columbia, with their STAC
scene IDs and processing graph version. **Tiers 1–3 (drone, IoT, ground reports) are
simulated** from realistic parameters and are labelled as simulated everywhere they
appear. The `synthetic` demo scenario injects a treatment effect into the real series and
is labelled SIMULATED at Tier 0 in every artefact it produces.

## Status

Prototype of the M1–M4 vertical slice. See `docs/DEVELOPMENT_LOG.md` for what is built,
what is deferred, and which methodology parameters remain provisional pending approval
(Idea 0.3 §13.6).
