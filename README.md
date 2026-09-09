# Ecorestore Network

Spatially-verified restoration finance. ETHOnline 2026.

Capital for ecological restoration is released against spatially verified,
uncertainty-bounded, additionality-adjusted evidence of ecological change. The verified
outcome becomes an auditable asset a corporate buyer can hold, audit, and retire.

**Canonical baseline: [`proposals/idea-0.3.md`](proposals/idea-0.3.md).** Start with its
§1 one-page summary; §13 is the decision log.

## Repository

| Path | Contents |
|---|---|
| `proposals/idea-0.3.md` | **Canonical product baseline** |
| `proposals/idea-0.2.md` | Historical — the text reviewed in `proposal_review.md` |
| `proposal_review.md` | Incentive, scientific and landscape review (2026-09-09) |
| `docs/` | Architecture, verification, Guardian, Arc, Graph, Auditor, demo, development log |
| `verification/` | Deterministic verification engine (M2) |
| `contracts/` | Arc Restoration Deed (M1) |
| `guardian/`, `auditor/` | Methodology workflow and orchestration boundaries |
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

**Tier 0 (Sentinel-2, Sentinel-1, Landsat, ICESat-2) is real.** Tiers 1–3 (drone, IoT,
ground reports) are simulated from realistic parameters and are labelled as simulated
everywhere they appear. Simulated evidence is never presented as measurement.

## Status

M1 — Arc Restoration Deed. See `docs/DEVELOPMENT_LOG.md`.
