# Ecorestore Network — Claude Code Instructions

## Project

Ecorestore Network is a spatially-verified restoration finance protocol.

The canonical product baseline is:

`proposals/idea-0.3.md`

Idea 0.3 reconciles Idea 0.2, `ideation/ecorestore_network_proposal_v2.md`, and
`proposal_review.md` into one approach. Its §13 decision log records every accepted,
rejected and deferred change, and its §13.6 lists the methodology decisions still
awaiting explicit approval.

`proposals/idea-0.2.md` and everything in `ideation/` are historical.

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
- deviations from Idea 0.3
- unresolved risks
- next steps

Do not fabricate implementation history.

## Current Milestone

M1 — Arc Restoration Deed.

The build sequence is ordered against the **September 30, 2026 Arc mainnet-readiness
deadline** (Idea 0.3 §9). Contracts come first; the pipeline builds against a deployed
contract, not the reverse.

M1 implements:

- RestorationDeed escrow and milestone state
- `analysis_plan_hash` committed at `createDeed()` (Idea 0.3 §3.7.1)
- authorized verification with replay protection
- lower-bound settlement bounded by contract state
- mobilisation draw, `assignTranche()`, benefit-share routing (§4.5)
- retention withholding
- Arc Testnet deployment and a full contract test suite

M1 also closes the M0 gaps recorded in Idea 0.3 §9.1: the TypeScript interface
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
