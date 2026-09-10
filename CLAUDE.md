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
- x402 payment gateway = API access payment only, never settlement

AI-generated numerical results must never directly determine financial settlement.

Paying for an API request must never trigger, influence or substitute for a milestone
settlement. Settlement is USDC on Arc; API payment is HBAR/HTS on Hedera. Different
networks, different accounts, different authority.

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

**M1 — Arc Restoration Deed. One thing remains: deployment to Arc Testnet.**

The sequence was ordered contracts-first against the **September 30, 2026 Arc
mainnet-readiness deadline** (`docs/ROADMAP.md`). That is not how the work went. The
M1–M4 slice was built together on one branch, on the owner's instruction, and the piece
that has *not* happened is the deployment M1 is named for.

Built and tested: `RestorationDeed` (escrow, plan-hash commitment, replay-protected
verification, lower-bound settlement, mobilisation draw, `assignTranche()`, benefit share,
retention — 31 Foundry tests); the deterministic engine on real Sentinel-2 Tier 0; the
end-to-end vertical slice; the Guardian verdict-VC and ATS calldata seam; the rule-based
Auditor boundary.

**Not done: Arc Testnet deployment** — no deployer key in this environment;
`contracts/script/Deploy.s.sol` is ready. This gates the public demonstration.

Also open, and not M1: Sentinel-1/Landsat/ICESat-2 ingest, Guardian stood up, ATS
broadcast, The Graph subgraph, the Auditor LLM narrator, x402, production settlement. See
`docs/ARCHITECTURE.md` §8 for the current split and `docs/ROADMAP.md` for the sequence.

**Do not describe unbuilt work as built, and do not describe built work as unbuilt.** When
this section and the repository disagree, fix this section.

Still unbuilt, and not to be described otherwise:

- Sentinel-1, Landsat and ICESat-2 ingest (only Sentinel-2 is acquired)
- control matching on terrain, soil and climate covariates (pre-level and pre-slope only)
- a running Guardian instance
- Hedera ATS broadcast (calldata is prepared, never sent)
- The Graph subgraph
- Auditor LLM narration (the narrator is a deterministic template)
- x402
- production financial settlement
