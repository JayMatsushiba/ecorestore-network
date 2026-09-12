# Ecorestore Network

A prototype for spatially-verified restoration finance. Built for EthOnline Hackathon 2026.

**Status: M0–M6 implemented and tested. No production deployment exists.** See [Current Prototype Status](#current-prototype-status) and `docs/DEVELOPMENT_LOG.md` (the single source of truth for what is actually implemented, tested, and committed — do not trust milestone status from this README, from memory, or from any other single document without checking that file).

---

## Project Overview

Ecorestore Network connects deterministic ecological verification to programmable restoration finance. A restorer claims a quantity of ecological gain (e.g. hectares of canopy recovered); the system runs that claim through a deterministic verification pipeline (control matching, difference-in-differences, additionality, uncertainty), records a workflow credential, and — only for a conservative, uncertainty-adjusted lower-bound quantity — authorizes a financial settlement on-chain. Every step is indexed and explainable.

The prototype uses **one synthetic British Columbia restoration project** ("Kootenay Riparian Restoration") throughout — a fictional project, not a real place or real funder. See [Synthetic Demo Data](#synthetic-demo-data).

## Architecture

```text
Environmental Evidence (synthetic)
        ↓
M1 — Deterministic Spatial Verification         verification/
        ↓
M2 — Hedera Guardian (methodology/credential)   guardian/
        ↓
M3 / M3.1 — RestorationDeed / Arc (financial)   contracts/, arc/
        ↓
M4 — Vertical Integration (M1→M2→Arc)           integration/
        ↓
Blockchain Events
        ↓
M5 — The Graph (local indexing) + Auditor       subgraph/, graph/, auditor/
        ↓
M6 — React UI (presentation only)               app/, server/
```

**Authority boundaries** (unconditional — see `CLAUDE.md`):

| Component | Authority | Never |
|---|---|---|
| M1 verification engine | Scientific result | — |
| Hedera Guardian | Methodology / workflow / credential | Financial settlement, scientific calculation |
| RestorationDeed / Arc | Financial settlement | Scientific calculation |
| The Graph | Indexed history (read-only) | Scientific or financial authority |
| Auditor | Orchestration / correlation / explanation | Choosing a quantity, authorizing anything, releasing funds |
| React UI (`app/`) | Presentation | Any of the above — it cannot compute, authorize, or release anything |

## Current Prototype Status

| Layer | Status |
|---|---|
| M1 deterministic verification | **Implemented, real** |
| M2 Hedera Guardian | **Implemented** — `MockGuardianAdapter`; no live Hedera deployment |
| M3/M3.1 RestorationDeed / Arc | **Implemented, real Solidity** — local Hardhat network only |
| M4 vertical integration | **Implemented, real** |
| M5 Graph indexing + Auditor | **Implemented, real Graph Node** — local Docker stack only |
| M6 React UI | **Implemented** — consumes the real pipeline via a thin local API server |
| Hosted / decentralized Graph Network | **Deferred** |
| AWS demo hosting | **Pipeline built** — `main` deploys this local demo stack to one EC2 host (`docs/AWS_DEPLOYMENT.md`); production hosting **deferred** |
| Live Hedera Guardian | **Deferred** |
| Arc Testnet/Mainnet deployment | **Deferred** |
| Production USDC | **Deferred** — `MockUSDC` only |
| Production financial settlement | **Not implemented** |

See `docs/M6_M7_READINESS_REPORT.md` for the detailed component-by-component deployment assessment.

## Prerequisites

Exact versions this repository was developed and tested against:

- **Node.js** v24.14.1 (v18+ required; `@graphprotocol/graph-cli` requires ≥20.18.1)
- **npm** 11.11.0
- **Docker Desktop** 29.1.3 (with Compose v2) — required only for the M5 Graph Node stack
- **Git** 2.49.0
- A modern desktop browser (Chromium/Firefox/Safari) — the UI is not optimized for mobile

No wallet, RPC provider account, or testnet faucet is required to run the local demo — see [Faucets](#faucets).

## Installation

```bash
git clone <this repository>
cd ecorestore-network
npm install          # root: verification/, guardian/, arc/, contracts/, integration/, graph/, auditor/, server/
cd subgraph && npm install && cd ..   # subgraph/ is an isolated AssemblyScript project
cd app && npm install && cd ..        # app/ is an isolated Vite/React project
```

## Environment Variables

| Variable | Where | Required? | Purpose |
|---|---|---|---|
| `VITE_API_BASE_URL` | `app/.env` (see `app/.env.example`) | No — defaults to `http://localhost:4000` | Where the React app looks for the demo API server |
| `PORT` | shell, before `npm run server` | No — defaults to `4000` | Port the demo API server listens on |

**No API keys, private keys, RPC provider credentials, or wallet secrets are used anywhere in this prototype.** Nothing in this repository holds a signing key — `RestorationDeed`'s `authorizedVerifier` is a Hardhat default test account, never a real key.

## Faucets

**Not required for M6.** This prototype runs entirely on a local Hardhat network with pre-funded test accounts and a local `MockUSDC` token (unlimited local minting). No real testnet ETH, USDC, or HBAR is used anywhere in the current demo.

| Network | Asset | Purpose | Where to obtain it | Needed for M6? | Needed for M7? |
|---|---|---|---|---|---|
| Arc Testnet | Testnet ETH (gas) | Deploying `RestorationDeed`/`MockUSDC` to a real testnet | Arc's testnet faucet (not yet integrated — see `docs/ARC.md`) | No | Yes, if M7 deploys to Arc Testnet |
| Arc Testnet | Testnet USDC | Funding a real testnet deed | Circle's testnet USDC faucet or Arc-provided equivalent | No | Yes |
| Hedera Testnet | Testnet HBAR | Live Hedera Guardian interaction | Hedera Portal faucet | No | Yes, if M7 integrates live Guardian |

## Synthetic Demo Data

Every environmental value in this prototype is synthetic — authored to exercise the verification pipeline, never measured in the field or from a real satellite pass. Never presented as regulatory credit data.

| What | Where | What it represents |
|---|---|---|
| Project/parcel definitions, evidence observations | `verification/fixtures.ts` | Six fixtures covering the success, partial-settlement, and every documented failure path (`FIXTURE_PARTIAL_SETTLEMENT`, `FIXTURE_PARALLEL_TREND_FAIL`, etc.) |
| Methodology configuration | `verification/config.ts` | `DEFAULT_METHODOLOGY_CONFIG` — matching tolerances, uncertainty fraction, minimum control count |
| Metric | `verification/config.ts`'s `M1_METRIC_ID` | `canopy_cover_fraction_pct` — fractional canopy cover, 0–100 |
| Guardian verifier identity | `guardian/policy/verifierRegistry.ts` | Hard-coded allowlist, one id: `guardian-verifier-kootenay-001` |
| On-chain demo run | `scripts/deployAndRunLocalDemo.cjs` → `subgraph/deployment.local.json` (gitignored, regenerated per run) | The one deed this prototype actually funds and settles on a local chain |

The UI's fixture toggle (top-right of every page) lets you switch between the real success case (`FIXTURE_PARTIAL_SETTLEMENT`) and the real parallel-trend-failure case (`FIXTURE_PARALLEL_TREND_FAIL`) — both are genuine M1 fixtures, not UI-invented states.

## Starting the Local Stack

**Containers (one command):** the whole stack — chain, Graph Node, the demo
settlement and subgraph deploy, the API and the UI — as one Compose project.
Requires Docker; publishes only the UI, on port 3001, so it can run beside the
hand-started stack below.

```bash
docker compose up --build        # then open http://localhost:3001
docker compose down -v           # full reset: fresh chain, empty index
```

This is what `docs/AWS_DEPLOYMENT.md` puts on the demonstration host. It is still
the local demo (in-memory Hardhat chain, MockUSDC, MockGuardianAdapter, synthetic
fixtures); nothing about it is more real in a container.

**By hand:** each of these runs in its own terminal and is left running.

```bash
# 1. Persistent local blockchain (NOT the ephemeral network `npm test` uses)
npx hardhat node --hostname 0.0.0.0

# 2. Local Graph Node stack (Postgres, IPFS, Graph Node) — requires Docker Desktop running
cd subgraph
docker compose up -d
cd ..

# 3. Demo API server (calls the real M1/M2/M4/M5 code; holds no signing key)
npm run server

# 4. React app
cd app
npm run dev
```

## Running the Demo

```text
1. Start the persistent Hardhat node (see above) — leave it running.
2. Run the real M1 → M2 → Arc chain against it, funding and settling one deed:
     npm run demo:local
   This writes subgraph/deployment.local.json.
3. Start the Docker Graph Node stack (see above).
4. Configure, build, and deploy the subgraph:
     cd subgraph
     npm run configure && npm run codegen && npm run build
     npm run create-local && npm run deploy-local
     cd ..
5. Start the demo API server:  npm run server
6. Start the React app:        cd app && npm run dev
7. Open http://localhost:5173 in a browser.
8. Walk through: Overview → Evidence → Verification → Guardian →
   Financial / Deed → Provenance → Auditor → About.
9. Use the "Verification case" selector (top-right) to switch between the
   success case and the real insufficient-evidence failure case.
```

Steps 2–4 only need to be repeated after a fresh Hardhat node restart (a new chain has no deployed contract or indexed history yet).

## Resetting the Demo

```bash
# Stop everything, then:
cd subgraph && docker compose down -v && cd ..   # wipes Graph Node's Postgres/IPFS volumes
rm subgraph/deployment.local.json                 # or just start a fresh Hardhat node — it's gitignored, regenerated
# Restart from "Running the Demo" step 1.
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `EADDRINUSE` on port 4000 or 8545 | A previous server/Hardhat process is still running | Find and stop it (`netstat -ano \| findstr :4000` on Windows), or use a different `PORT` |
| Docker commands fail with "the system cannot find the file specified" | Docker Desktop isn't running | Start Docker Desktop and wait for the daemon (`docker info` succeeds) |
| Financial / Provenance / Auditor pages show "UNAVAILABLE" | The Graph Node stack isn't running, or the subgraph isn't deployed yet | Run `cd subgraph && docker compose up -d`, then redo the configure/codegen/build/deploy steps |
| Subgraph never reaches `synced: true` | The persistent Hardhat node isn't running, or was restarted (new chain, stale `deployment.local.json`) | Restart the Hardhat node, rerun `npm run demo:local`, reconfigure and redeploy the subgraph |
| React app shows "Demo API server unreachable" | `npm run server` isn't running, or `VITE_API_BASE_URL` points elsewhere | Start the server; check `app/.env` if you set one |
| Matchstick subgraph tests fail with "not a TTY" | `graph test --docker`'s own `-it` flag fails in non-interactive shells | Use `npm test` inside `subgraph/` — it already uses the Windows-safe wrapper (`docs/GRAPH.md` §7.11) |
| Stale indexed data after redeploying contracts | Graph Node's Postgres volume still has the old subgraph's data | `cd subgraph && docker compose down -v` before redeploying |

## What This Demo Does NOT Represent

- Synthetic environmental data — not real field, satellite, or sensor measurements.
- A local Hardhat blockchain — not Arc Testnet, not Arc Mainnet, not any live network.
- A Mock Guardian adapter — not a live Hedera Guardian deployment.
- `MockUSDC` — not real USDC; unrestricted local minting.
- A local Graph Node — not the hosted/decentralized Graph Network.
- A non-production Auditor — no LLM, no natural-language generation; template-string explanations only.
- Prototype pricing/settlement conventions (`docs/ARC.md` §9.7) — not an audited financial mechanism.
- No regulatory environmental credit, carbon credit, or biodiversity credit of any kind.
- No production financial settlement has ever occurred.

## Development

```bash
npm install

npm run typecheck         # root TypeScript, strict mode (subgraph/ and app/ excluded — separate toolchains)
npm test                  # verification/, guardian/, arc/, integration/, graph/, auditor/ (vitest)
npm run compile            # Solidity contracts (Hardhat)
npm run test:contracts     # contracts/ (Hardhat + Mocha, local network only)
npm run test:e2e:graph     # M5 Graph Node integration (requires the local stack running — see docs/GRAPH.md)

cd subgraph && npm test    # subgraph mapping tests (Matchstick, via Docker)
cd app && npm test         # React component tests (vitest + testing-library)
cd app && npm run build    # production build of the UI
```

See `docs/DEMO.md` for the full demo walkthrough and `docs/M6_M7_READINESS_REPORT.md` for what remains before any real deployment.
