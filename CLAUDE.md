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
- React application = presentation layer

AI-generated numerical results must never directly determine financial settlement.

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

## Current Milestone

M0 — Foundation.

M0 establishes repository structure, documentation, interfaces, and application scaffolding.

M0 does NOT implement:

- satellite processing
- control matching
- DiD
- additionality calculation
- uncertainty calculation
- Guardian integration
- Arc deployment
- Graph integration
- Auditor intelligence
- x402
- production financial settlement

Those belong to later milestones.