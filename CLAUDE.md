# Ecorestore Network — Claude Code Instructions

## Project

Ecorestore Network is a spatially-verified restoration finance protocol.

**`docs/` is the source of truth.** There is no separate proposal document. The original
proposals and ideation drafts were starting points; they were removed once their
load-bearing content moved into `docs/`, and they remain in git history.

Start here:

- `docs/PRODUCT.md` — what this is, who buys it, and why
- `docs/DECISIONS.md` — why the design is what it is, what is still open, risks carried
- `docs/ARCHITECTURE.md` — component boundaries and the authority model
- `docs/ROADMAP.md` — build sequence and milestones

`docs/DECISIONS.md` §3 lists the methodology decisions still awaiting explicit approval,
and §5 the constraints that are not open to revision.

Update these documents as the design changes. They are working documents, not a fixed
baseline — but §5 of `DECISIONS.md` changes only with explicit approval.

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
- React application = presentation layer

AI-generated numerical results must never directly determine financial settlement.

## Data Provenance

The hackathon demonstration uses one British Columbia restoration project — Kootenay
Riparian Restoration — with a mixed evidence provenance that must never be blurred.

### Tier 0 is real

Tier 0 satellite evidence (Sentinel-2 L2A, Sentinel-1, Landsat, ICESat-2) is **real
data**, not synthetic. The satellite layer is the core scientific claim of the project
and fabricating it would undermine everything built on top of it.

Real Tier 0 must be labelled as real and must display its STAC scene IDs and processing
graph version.

### Tiers 1-3 are simulated

Drone (Tier 1), IoT/in-situ (Tier 2) and ground report (Tier 3) evidence is simulated
from realistic parameters for the demonstration.

Simulated data must always be clearly identified as simulated, in the application, in
the documentation, and in the video.

Simulated observations must never be represented as actual field measurements or
satellite observations.

Real and simulated evidence must be visually distinguishable in the interface at all
times.

## Development Discipline

Prefer small, reviewable changes.

Do not implement future milestones prematurely.

Every milestone must have:

- objective
- implementation
- tests
- validation
- architectural/scientific/security decisions
- deviations from the documented design
- unresolved risks
- next steps

Do not fabricate implementation history.

## Current Milestone

M1 — Arc Restoration Deed.

The build sequence is ordered against the **September 30, 2026 Arc mainnet-readiness
deadline** (`docs/ROADMAP.md`). Contracts come first; the pipeline builds against a
deployed contract, not the reverse.

M1 implements:

- RestorationDeed escrow and milestone state
- `analysis_plan_hash` committed at `createDeed()` (`docs/VERIFICATION.md`)
- authorized verification with replay protection
- lower-bound settlement bounded by contract state
- mobilisation draw, `assignTranche()`, benefit-share routing (`docs/ARC.md`)
- retention withholding
- Arc Testnet deployment and a full contract test suite

M1 also closes the M0 gaps recorded in `docs/ROADMAP.md` §3: the TypeScript interface
definitions the empty stubs are supposed to hold, a running test framework, and a
development log entry.

M1 does NOT implement:

- satellite processing
- control matching
- DiD
- additionality calculation
- uncertainty calculation
- Guardian integration
- Hedera ATS issuance
- Graph integration
- Auditor intelligence
- x402
- production financial settlement

Those belong to M2 and later.
