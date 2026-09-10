# Ecorestore Network — Claude Code Instructions

Read this file before you change anything in this repository. It tells you what the
project is, what you may decide on your own, what you must not decide, and how far the
build has actually got.

Everything you write here — this file included — follows the plain language
standard set out below.

## Project

Ecorestore Network is a spatially-verified restoration finance protocol. It releases
capital for ecological restoration only against evidence of ecological change that is
measured from space, bounded by its own uncertainty, and adjusted for additionality.

**`docs/` is the source of truth.** There is no separate proposal document. The original
proposals and ideation drafts were starting points. We removed them once their
load-bearing content moved into `docs/`. They remain in git history.

Start here:

- `docs/PRODUCT.md` — what this is, who buys it, and why
- `docs/DECISIONS.md` — why the design is what it is, what is still open, which
  risks we carry
- `docs/ARCHITECTURE.md` — component boundaries and the authority model
- `docs/ROADMAP.md` — build sequence and milestones

Two sections of `docs/DECISIONS.md` matter most:

- §3 lists the methodology decisions that still need explicit approval.
- §5 lists the constraints that are not open to revision.

Update these documents as the design changes. They are working documents, not a fixed
baseline. The one exception is §5 of `DECISIONS.md`: change it only with explicit
approval.

## Writing Style

Write in plain language, following **ISO 24495-1** (*Plain language — Part 1: Governing
principles and guidelines*). A text is in plain language when its readers get what they
need, find it easily, understand it, and can use it.

Apply that standard in this repository as follows:

- Write for the person who will act on the text. Say who does what.
- Use active voice and the present tense. Name the actor: "the engine returns a lower
  bound", not "a lower bound is returned".
- Keep one idea per sentence. Prefer short sentences to long ones.
- Choose the shortest word that is still exact. Keep a technical term when it is the
  precise one, and define it the first time you use it.
- Put the most important information first, in the document and in each section.
- Write headings that say what the section contains. Use a list for anything that is a
  series.
- Say "must" for a requirement and "may" for a choice. Do not soften a rule with "should"
  when you mean "must".
- Use one name per concept, everywhere. Do not vary the term for variety.
- Cut every word that carries no information.

This applies to `docs/`, `README.md`, this file, code comments, commit messages, pull
request descriptions, and text the application shows to a user. It does not apply to
quoted material, and it is not a reason to rewrite entries already recorded in
`docs/DEVELOPMENT_LOG.md`.

## Development Role

You are the implementation agent.

You may:

- implement bounded engineering tasks
- write tests
- refactor code
- create documentation
- integrate approved external services

You must not redesign any of the following on your own:

- ecological verification methodology
- additionality methodology
- uncertainty methodology
- financial settlement authority
- blockchain trust boundaries
- Guardian policy semantics
- token semantics
- cryptographic and security assumptions

Ask for explicit approval before you make any architectural or scientific change.

## Authority Model

Each component has one job. Never let one component take over another's:

- The Spatial Verification Engine produces the scientific verification result.
- Hedera Guardian holds the environmental methodology, workflow, credentials and outcomes.
- The Arc Restoration Deed holds the financial escrow and decides settlement.
- The Graph indexes blockchain history and serves reads.
- The Auditor orchestrates the work and explains it.
- The React application presents the result.
- The x402 payment gateway charges for API access only. It never settles anything.

Two rules follow from this, and neither has an exception:

- An AI-generated number must never decide a financial settlement directly.
- Paying for an API request must never trigger, influence or replace a milestone
  settlement. Settlement is USDC on Arc. API payment is HBAR or HTS on Hedera. These are
  different networks, different accounts and different authority.

## Data Provenance

The hackathon demonstration uses one restoration project in British Columbia: Kootenay
Riparian Restoration. Its evidence comes from two sources. Never blur them.

### Tier 0 is real

Tier 0 satellite evidence (Sentinel-2 L2A, Sentinel-1, Landsat, ICESat-2) is **real
data**, not synthetic. The satellite layer is the core scientific claim of the project.
Fabricating it would undermine everything built on top of it.

Label real Tier 0 evidence as real. Show its STAC scene IDs and its processing graph
version.

### Tiers 1-3 are simulated

Drone evidence (Tier 1), IoT and in-situ evidence (Tier 2) and ground reports (Tier 3)
are simulated from realistic parameters for the demonstration.

- Always identify simulated data as simulated: in the application, in the documentation,
  and in the video.
- Never present a simulated observation as a real field measurement or a real satellite
  observation.
- Keep real and simulated evidence visually distinguishable in the interface at all times.

## Development Discipline

- Prefer small changes that someone can review.
- Do not implement a future milestone early.
- Do not fabricate implementation history.

Record all of the following for every milestone:

- objective
- implementation
- tests
- validation
- architectural, scientific and security decisions
- deviations from the documented design
- unresolved risks
- next steps

## Current Milestone

**M1 — Arc Restoration Deed. One thing remains: deployment to Arc Testnet.**

We planned to build contracts first, to meet the **Arc mainnet-readiness deadline of
September 30, 2026** (`docs/ROADMAP.md`). The work did not go that way. We built the
M1–M4 slice together on one branch, on the owner's instruction. The part that has *not*
happened is the deployment M1 is named for.

Built and tested:

- `RestorationDeed`: escrow, plan-hash commitment, replay-protected verification,
  lower-bound settlement, mobilisation draw, `assignTranche()`, benefit share and
  retention — 31 Foundry tests
- the deterministic engine, running on real Sentinel-2 Tier 0 data
- the end-to-end vertical slice
- the Guardian verdict-VC and ATS calldata seam
- the rule-based Auditor boundary

**Not done: Arc Testnet deployment.** This environment holds no deployer key.
`contracts/script/Deploy.s.sol` is ready. Until this deployment happens, the public
demonstration cannot claim settlement. The rest of that demonstration is live on AWS
(`docs/DEPLOYMENT.md` §12), with calldata prepared and never broadcast.

Other work is open, but it is not M1: Sentinel-1, Landsat and ICESat-2 ingest; a running
Guardian; ATS broadcast; The Graph subgraph; the Auditor LLM narrator; x402; and
production settlement. See `docs/ARCHITECTURE.md` §8 for the current split and
`docs/ROADMAP.md` for the sequence.

**Do not describe unbuilt work as built. Do not describe built work as unbuilt.** When
this section and the repository disagree, fix this section.

These parts are still unbuilt. Do not describe them otherwise:

- Sentinel-1, Landsat and ICESat-2 ingest (we acquire only Sentinel-2)
- control matching on terrain, soil and climate covariates (we match on pre-level and
  pre-slope only)
- a running Guardian instance
- Hedera ATS broadcast (calldata is prepared, never sent)
- The Graph subgraph
- Auditor LLM narration (the narrator is a deterministic template)
- x402
- production financial settlement
