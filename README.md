# ecorestore-network
Project for EthOnline Hackathon 2026

## Status

M0 (Foundation), M1 (Deterministic Verification), M2 (Hedera Guardian), M3 (Arc / RestorationDeed), M3.1 (security patch), M4 (local vertical integration connecting M1 → M2 → Arc into one executable path), and M5 (local Graph Node indexing + Auditor correlation) are implemented and tested. **`docs/DEVELOPMENT_LOG.md` is the single source of truth for what is actually implemented, tested, and committed** — do not assume any milestone's status from this file, from memory, or from any other single document without checking it.

See `docs/ARCHITECTURE.md` for the system design and `CLAUDE.md` for the current authority model and trust-boundary summary. All demonstration data is synthetic — see the header comments in `verification/fixtures.ts`.

`app/` (the React UI) is intentionally absent until M6 — do not recreate it. No live Hedera Guardian, Arc, or Graph Network deployment exists yet; contract tests run against Hardhat's local in-process network only (see `docs/ARC.md`), Guardian is a deterministic local mock adapter (see `docs/GUARDIAN.md`), and the Graph runs on a local Docker Graph Node (see `docs/GRAPH.md`).

## Development

```bash
npm install

npm run typecheck        # TypeScript, strict mode
npm test                 # verification/, guardian/, arc/, graph/, auditor/ (vitest)
npm run compile           # Solidity contracts (Hardhat)
npm run test:contracts    # contracts/ (Hardhat + Mocha, local network only)

# M5 Graph Node integration (requires Docker Desktop) — see docs/GRAPH.md
# for the full local setup, teardown, and query instructions.
npm run test:e2e:graph
```
