# Ecorestore Network — Claude Code Instructions

## Project

Ecorestore Network is a spatially-verified restoration finance protocol.

The canonical product baseline is:

`proposals/idea-0.2.md`

Do not modify the proposal unless explicitly instructed.

## Development Role

Claude Code is the implementation agent.

Claude may implement bounded engineering tasks, write tests, refactor code, create documentation, and integrate approved external services.

Claude must not independently redesign:

- ecological verification methodology
- additionality methodology
- uncertainty methodology
- financial settlement authority
- blockchain trust boundaries
- Guardian policy semantics
- token semantics
- cryptographic/security assumptions

Architectural or scientific changes require explicit approval.

## Authority Model

The system has explicit authority boundaries:

- Spatial Verification Engine = scientific verification result
- Hedera Guardian = environmental methodology/workflow/credential/outcome layer
- Arc Restoration Deed = financial escrow and settlement authority
- The Graph = indexed blockchain history/read layer
- Auditor = orchestration and explanation
- React application (`app/`) = presentation layer only

AI-generated numerical results must never directly determine financial settlement.

The React UI must never calculate settlement quantities, make financial authorization decisions, fabricate environmental observations, invent verification results, bypass Guardian, or directly manipulate Graph or financial state. It reads from `server/`, a thin HTTP layer that calls the real M1-M5 functions and holds no signing key of its own — neither `app/` nor `server/` may become an authority.

## Synthetic Data

The hackathon demonstration uses a synthetic British Columbia restoration project.

Synthetic data must always be clearly identified as synthetic.

Synthetic observations must never be represented as actual field measurements or satellite observations.

## Development Discipline

Prefer small, reviewable changes.

Do not implement future milestones prematurely.

Every milestone must have:

- objective
- implementation
- tests
- validation
- architectural/scientific/security decisions
- deviations from Idea 0.2
- unresolved risks
- next steps

Do not fabricate implementation history.

## Current Status

**M6 is complete.** M0 (Foundation), M1 (Deterministic Verification), M2 (Hedera Guardian), M3/M3.1 (Arc / RestorationDeed + security patch), M4 (vertical integration), M5 (local Graph Node + Auditor), and M6 (React UI + operational demo) are all implemented and tested. **The current milestone is M7** — see `docs/M6_M7_READINESS_REPORT.md` for the full deployment-readiness assessment and prioritized backlog before beginning it.

**`docs/DEVELOPMENT_LOG.md` is the single source of truth for what is actually implemented, tested, and committed.** Do not trust milestone status from memory, from this file, or from any other single document without checking it — this file is updated less often than the log and can drift.

`app/` (the React UI, M6) now exists — a Vite/React/TypeScript app in `app/`, backed by a thin read-only HTTP layer in `server/` that calls the real M1-M5 functions directly. Neither holds a signing key or any secret. Do not treat this as production-deployment-ready: it is a local demo UI with no auth and permissive CORS (see the readiness report's BLOCKER list).

Every environmental value shown anywhere (UI, docs, logs) must remain identified as synthetic demonstration data — see `README.md`'s "Synthetic Demo Data" section for exactly where it lives and what it represents. The README is also the canonical operational guide: prerequisites, exact startup sequence, troubleshooting, and simulation-boundary list all belong there, not duplicated ad hoc elsewhere.

**No production deployment has occurred.** No AWS, no hosted/decentralized Graph Network, no live Hedera Guardian, no Arc Testnet/Mainnet deployment, no real USDC, no real funds — everything runs locally (Hardhat, Docker Graph Node, MockUSDC, MockGuardianAdapter).

The current financial trust boundary: `RestorationDeed.authorizedVerifier` (a per-deed Ethereum address chosen by the sponsor at deed creation) is the sole financial authorization mechanism. AI cannot release funds without controlling that address's private key. The off-chain M1/M2 objects (`VerificationResult`, `GuardianCredential`) are not cryptographically bound to a genuine execution — see `docs/ARC.md` for the full analysis and its dedicated demonstration test. Do not silently strengthen or weaken this trust model; closing this gap (signatures, key infrastructure, decentralized verifier governance) is explicitly deferred to M7 — see `docs/M6_M7_READINESS_REPORT.md`'s BLOCKER list.

## Before Making Any Change

1. Read this file first.
2. Read `README.md` and whichever `docs/*.md` files are relevant to the area you're touching (`docs/VERIFICATION.md` for M1, `docs/GUARDIAN.md` for M2, `docs/ARC.md` for M3/Arc, `docs/GRAPH.md` for M5/subgraph, `docs/AUDITOR.md` for the Auditor, `docs/DEMO.md` for the local demo, `docs/M6_M7_READINESS_REPORT.md` for deployment status, `docs/DEVELOPMENT_LOG.md` for current status always).
3. Treat `proposals/idea-0.2.md` as the canonical product concept and `docs/DEVELOPMENT_LOG.md` as the canonical implementation history.
4. Preserve the authority boundaries above without exception.
5. Make small, reviewable changes — prefer several focused commits over one large one.
6. Run the relevant test suite (`npm test`, `npm run test:contracts`, `npm run typecheck`) after any meaningful change and report the actual results, not an assumption.
7. Report deviations from this file or from idea-0.2 explicitly rather than silently redesigning.
8. Do not implement a future milestone's functionality prematurely — check `docs/DEVELOPMENT_LOG.md` for what's next before adding scope.
9. Never expose secrets, API keys, private keys, mnemonics, or RPC credentials in code, commits, or output.
10. Treat all synthetic/demo data as synthetic — never imply it is a real measurement or outcome.
11. Stop at the milestone boundary you were asked to implement; do not continue autonomously into the next one.