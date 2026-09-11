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
   analysis (Python service) ≡ verification/engine.ts (TypeScript reference), bit-exact:
   controls drawn by the committed rule, parallel-trend gate, DiD vs far ring,
   leakage from near/far divergence, bootstrap interval + placebo coverage
            │  numbers, over hash receipts
            ▼
   verify: issuance gates, status, lower bound, canonical result, resultHash
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

## Quickstart — containers

Three containers (`docs/DEPLOYMENT.md` §7): a Python **analysis** service that returns
numbers and can reach nothing, a TypeScript **verify** service that canonicalises, signs
and submits, and an nginx **frontend** that proxies to it.

```bash
# With the Guardian quickstart running (its network is joined automatically)
docker compose up --build
# Without Guardian: requests are staged to guardian/outbox/ and reported as not submitted
docker compose -f docker-compose.yml up --build

open http://localhost:3001            # the verification console
open http://localhost:3001/about      # what it is for, how it works, what is built
curl -s localhost:8090/health         # analysis engine, Guardian and chain reachability
curl -s -X POST localhost:8090/api/verify/synthetic | jq .result.verificationStatus

# Also settle each verification on a local chain
DEMO_RPC_URL=http://anvil:8545 docker compose --profile chain up --build

# Batch job: re-acquire REAL Tier 0 into out/acquire/ (network), then finalise it
docker compose --profile acquire run --rm acquire --limit 5
npm run acquire:finalize -- out/acquire/tier0-kootenay-riparian-001.unhashed.json --out /tmp/preview.json
```

Ports bind to `127.0.0.1`; override with `FRONTEND_PORT`, `VERIFY_PORT`. See `.env.example`.

The same stack deploys itself to AWS on every push to `main` (`.github/workflows/`,
`deploy/README.md`, `docs/DEPLOYMENT.md` §13). Live at http://32.189.224.38 (§12).

## Quickstart — host

```bash
npm install
npm test                 # vitest: engine, geometry, stats, adapter, client, auditor
npm run typecheck
npm run test:contracts   # needs Foundry: https://getfoundry.sh
npm run demo             # offline: in-process TypeScript analysis, REAL Tier 0 snapshot

# Python analysis service and its parity suite (needs Python ≥ 3.12).
# Install against constraints.txt: the pins are what the image ships, and
# parity is bit-exact, so an unconstrained NumPy is a different engine.
python -m venv analysis/.venv
analysis/.venv/bin/pip install -c analysis/constraints.txt -e "analysis[test]"
npm run test:analysis                # prefers analysis/.venv/bin/python when it exists
analysis/.venv/bin/ecorestore-analysis-server &
ANALYSIS_URL=http://127.0.0.1:8000 GUARDIAN_URL=http://localhost:3000 npm run demo

# verify service + Vite dev server
npm run verify:serve &                      # :8080 on the host
(cd app && npm run dev)                     # proxies /api to it

# End to end on a local chain
anvil &
npm run build:contracts
DEMO_RPC_URL=http://127.0.0.1:8545 npm run demo

# Re-acquire the REAL Tier 0 snapshot from Earth Search with the TypeScript graph (1.0.0)
npm run acquire
```

## Repository

| Path | Contents |
|---|---|
| `docs/PRODUCT.md` | **What this is, who buys it, and why** |
| `docs/DECISIONS.md` | Decisions and their reasons, open approvals, risks carried |
| `docs/ROADMAP.md` | Build sequence, milestones, cut order |
| `docs/` | Architecture, verification, Guardian, Arc, Graph, Auditor, demo, deployment, x402, development log |
| `verification/` | Deterministic verification engine, the analysis boundary contract, REAL Tier 0 acquisition (graph 1.0.0), simulated Tiers 1-3, fixtures |
| `analysis/` | Python analysis service — bit-exact with the TypeScript engine — and the Tier 0 acquisition batch job (graph 2.1.0) |
| `verify/` | The verify HTTP service and the shared end-to-end pipeline |
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
