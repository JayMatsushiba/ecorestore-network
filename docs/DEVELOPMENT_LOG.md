# Ecorestore Network — Development Log

Newest first. One entry per milestone, per `CLAUDE.md`.

---

## 2026-09-10 — Proposal reconciliation (Idea 0.3)

### Objective

Reconcile four divergent statements of the project into one canonical approach:
Idea 0.2 (root `ecorestore_network_proposal.md`), the M0 rewrite
(`ideation/ecorestore_network_proposal_v2.md`), `proposal_review.md` (2026-09-09), and
the M0 `docs/*.md` set.

### Implementation

- `proposals/idea-0.2.md` was committed **empty** in `45b81dc` while `CLAUDE.md`
  declared it the canonical baseline. Populated from the root proposal and banner-marked
  as historical.
- `proposals/idea-0.3.md` written as the canonical baseline, with a full decision log
  (§13) recording every accepted, rejected and deferred change and its source.
- `CLAUDE.md` repointed to Idea 0.3; data-provenance rule amended; current milestone
  changed from M0 to M1.
- `docs/ARCHITECTURE.md`, `VERIFICATION.md`, `GUARDIAN.md`, `ARC.md`, `GRAPH.md`,
  `AUDITOR.md`, `DEMO.md` amended where they contradicted the reconciled approach.

### Tests / validation

No code changed. Validation was documentary: every amended doc section is traceable to
a numbered item in `proposal_review.md` or to a named source document, and Idea 0.3 §13
is the cross-reference.

### Architectural, scientific and security decisions

Four required explicit approval and were approved by the project owner on 2026-09-10:

1. **Token layer — Guardian authority + ATS instrument.** Guardian decides issuance and
   carries provenance; ATS is the instrument. Guardian is *not stood up* for the
   hackathon (3-7 days of a 20-day budget); the ERC-1643 seam is built and the drop-in
   point specified. Idea 0.2's ATS justification was factually wrong — it claimed
   permissioned transfer is something a plain ERC-20 cannot express, but HTS provides
   that natively via the KYC key — and has been rewritten around ERC-1410 partitions as
   vintages, ERC-3643 per-transfer rules, and ERC-1644 as the reversal primitive.
2. **Tier 0 is real.** Amends the all-synthetic rule in `CLAUDE.md` and
   `docs/ARCHITECTURE.md §4`. Tiers 1-3 remain simulated and labelled.
3. **Four incentive-design additions adopted**: pre-registration of the analysis plan,
   working capital (mobilisation tranche, `assignTranche()`, MRV cost pass-through),
   tenure attestation with contract-enforced benefit-sharing, and an encumbrance
   registry with `obligation_status`.
4. **Build sequence reordered against the September 30, 2026 Arc deadline.** Contracts
   are M1; the verification engine is M2.

Also settled without needing approval, because each follows from a factual correction:

- **H3 demoted to index and join key.** H3 cells are not equal-area, so hectares must
  not come from cell counts; and H3 non-overlap does not prove parcel non-overlap at
  shared boundary cells. Polygon geometry carries quantities and the intersection test.
  This is strictly simpler than what Idea 0.2 specified.
- **ICESat-2 replaces GEDI.** GEDI's ISS orbit caps coverage near ±51.6°; the Kootenay
  site at ~49.5°N is inside that envelope but near its edge, where track density is
  lowest.
- **Reversal detection built on backscatter change plus dNBR**, with C-band coherence as
  corroboration only where geometry and baseline permit.
- **Leakage promoted to a pipeline step** with near/far control rings, because it biases
  DiD *upward* — the one place the design was not conservative.
- **Uncertainty sources reordered**; control-matching and model-transfer error promoted
  above atmospheric and co-registration terms.
- **"No central certifier required" deleted** and CAGR market sizing replaced with UK
  BNG (£93M, 312 sites) and the EU Nature Credits Roadmap.

### Deviations from the baseline

Idea 0.3 *is* the new baseline. Deviations from Idea 0.2 are enumerated in §13.5.

### Unresolved risks

- Six methodology decisions remain open and block M2, not M1. Idea 0.3 §13.6.
- Real Tier 0 acquisition is a **new** risk created by this reconciliation: coastal BC
  cloud cover is real, and scene availability must be checked before M2 begins. Pick the
  parcel and window from actual archive availability, not the reverse.
- 20 days to the Arc deadline.

### Next steps

M1 — Arc Restoration Deed, plus the M0 gaps below.

---

## 2026-09-09 — M0, Application Foundation (`45b81dc`) — INCOMPLETE

Recorded retrospectively on 2026-09-10. Not backdated, and not represented as having
been written at the time: `docs/DEVELOPMENT_LOG.md` was committed empty.

### What was delivered

`CLAUDE.md`, the `docs/*.md` set, `ideation/` reorganisation, the
`ideation/ecorestore_network_proposal_v2.md` rewrite, directory structure, root
`package.json` and `tsconfig.json`, and a Vite + React + TypeScript application
scaffold.

### What was not delivered

M0's stated objective includes "interfaces" and a test framework. Neither exists:

- `verification/engine.ts`, `verification/models.ts`, `verification/fixtures.ts` — empty
- `auditor/agent.ts`, `guardian/adapter.ts` — empty
- `contracts/RestorationDeed.sol` — empty
- `app/src/App.tsx` — unmodified Vite counter template
- `docs/DEVELOPMENT_LOG.md` — empty
- `proposals/idea-0.2.md` — empty, while `CLAUDE.md` declared it canonical
- no test run exists; root `package.json` still has `"test": "echo \"Error: no test specified\" && exit 1"`

### Assessment

**M0 is not complete.** The documentation half is genuinely useful — the authority
model it established is carried into Idea 0.3 verbatim and is the strongest thing M0
produced. The interface half was not started.

### Next steps

The outstanding M0 work is carried into M1 rather than closed retroactively:
TypeScript interface definitions for the empty stubs, a running test framework, and
this log.
