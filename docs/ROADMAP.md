# Ecorestore Network — Build Sequence

## 1. Ordering principle

**Contracts come first. The pipeline builds against a deployed contract, not the
reverse.**

The Arc mainnet-readiness deadline is **September 30, 2026** and it is a hard external
date. An ordering that puts settlement contracts behind a full spatial pipeline, control
matching and a 3D globe cannot meet it. This sequence is ordered against the constraint,
not against technical preference.

Milestones keep M-numbering. Every milestone records objective, implementation, tests,
validation, architectural/scientific/security decisions, deviations from these documents,
unresolved risks and next steps, in `DEVELOPMENT_LOG.md`.

---

## 2. Milestones

| M | Objective | Deadline pressure |
|---|---|---|
| **M0** | Foundation — repository, documentation, interfaces, React scaffold, test framework, contract scaffold. *Partially complete; see §3.* | done |
| **M1** | **Arc contracts first.** `RestorationDeed`: escrow, milestone state, `analysis_plan_hash` at `createDeed()`, authorized verification with replay protection, lower-bound settlement bounded by contract state, mobilisation draw, `assignTranche()`, benefit-share routing, retention withholding. Deploy to Arc Testnet, track mainnet readiness from day one. Full contract test suite. | **Sept 30** |
| **M2** | **Deterministic verification engine.** Real Sentinel-2/1 ingest for the Kootenay parcel; STAC search, cloud masking, index computation, H3 indexing, polygon geometry; near-ring and far-ring control selection drawn by the committed rule; parallel-trend diagnostic; DiD; leakage; uncertainty with empirical coverage; quality gates; canonical `VerificationResult`. Simulated Tiers 1–3, labelled. Tests for every failure mode, including `INSUFFICIENT_EVIDENCE`. | high |
| **M3** | **Vertical slice.** Verification → verdict VC → Arc settlement, end to end, one milestone. This is the thesis working. | high |
| **M4** | **Hedera ATS + the seam.** `issueByPartition` with vintage partitions, `setDocument()` binding the signed verdict VC, ERC-3643 transfer rules, ERC-1644 reversal path. Publish the Guardian-compatible VC schema. Verify contracts on HashScan. | medium |
| **M5** | **Subgraph + Auditor.** Full entity set including `VerificationRun`; live queries; Auditor consuming project history as a genuine input. | medium |
| **M6** | **UI.** Additionality view, assurance export, assurance-adjusted comparison — in that order. Secondary views only if these are done. Privy slot decision made here. Optional x402 **with** pre-registration coupling (`X402.md`). | medium |
| **M7** | **Hardening and submission.** Deterministic test pass, authorization and replay tests, evidence hash verification, real/simulated labelling audit, error states, demo reliability, documentation, 2–4 minute video at ≥720p with narrated audio. | hard |

---

## 3. M0 — recorded honestly

As committed in `45b81dc`, M0 delivered `CLAUDE.md`, `docs/*.md` and directory structure.
It did **not** deliver working interfaces: `verification/{engine,models,fixtures}.ts`,
`auditor/agent.ts`, `guardian/adapter.ts` and `contracts/RestorationDeed.sol` were empty
files, `app/src/App.tsx` was the unmodified Vite counter template, and
`DEVELOPMENT_LOG.md` was empty despite a per-milestone record being required.

**M0 was therefore not complete.** Closing it required the TypeScript interface
definitions those stubs were supposed to hold, a running test framework, and a
development log entry. That work was carried into M1 rather than backdated.

---

## 4. Explicitly out of scope

Specified in the design, not built for the hackathon:

* Guardian stood up as a running instance (`GUARDIAN.md`);
* cohort verification (`ARC.md`);
* the reversal buffer pool's actuarial sizing — the withholding mechanism ships, the
  actuarial model does not;
* the rotating globe.

---

## 5. Cut order

If time compresses, cut in this order:

1. the globe;
2. secondary UI views;
3. x402;
4. ATS lifecycle depth;
5. the Subgraph.

**Never cut additionality, leakage, uncertainty, pre-registration, or the
`INSUFFICIENT_EVIDENCE` path.** Those are the thesis.

Do not cut the scientific core to add cosmetic features.
