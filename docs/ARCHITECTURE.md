# Ecorestore Network — Architecture

## 1. Purpose

Ecorestore Network connects deterministic ecological verification to programmable restoration finance.

The architecture deliberately separates:

1. scientific verification;
2. environmental methodology and verification workflow;
3. financial settlement;
4. blockchain indexing;
5. AI orchestration;
6. presentation.

The system must remain understandable and independently testable at each boundary.

---

## 2. Authority Model

| Component                      | Authority                                                               |
| ------------------------------ | ----------------------------------------------------------------------- |
| Ecorestore Verification Engine | Scientific result                                                       |
| Hedera Guardian                | Environmental methodology, workflow, credentials and verification state |
| Arc Restoration Deed           | Financial settlement                                                    |
| The Graph                      | Indexed history / read layer                                            |
| Auditor Agent                  | Orchestration, investigation and explanation                            |
| React UI                       | Presentation only                                                       |
| x402 Payment Gateway           | API access payment only — never settlement (`docs/X402.md`)             |

### Critical invariant

**No AI-generated numerical result may directly determine financial settlement.**

The settlement path is:

```text
Evidence
  ↓
Deterministic Verification Engine
  ↓
Canonical VerificationResult
  ↓
Guardian verification workflow
  ↓
Authorized verification
  ↓
Arc Restoration Deed
  ↓
USDC settlement
```

The Auditor may invoke the deterministic engine and explain its result, but cannot independently alter the result or release funds.

---

## 3. Intended Architecture

```text
                    React UI
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
   Verification     Guardian         Graph
      Results       Workflow        History
        │              │              │
        └──────────────┼──────────────┘
                       │
                    Auditor
                       │
                       ▼
            Deterministic Engine
                       │
                       ▼
              Canonical Result
                       │
                       ▼
                 Arc Deed
                       │
                       ▼
                    USDC
```

---

## 4. Demonstration Environment — mixed provenance

The prototype uses one British Columbia restoration project: **Kootenay Riparian
Restoration**.

**Tier 0 is real.** Sentinel-2 L2A, Sentinel-1, Landsat and ICESat-2 are real
acquisitions for the parcel, the near control ring and the far control ring. The
satellite layer is the core scientific claim of the project and is not fabricated.
Real Tier 0 displays its STAC scene IDs and processing graph version.

*(This amends an all-synthetic rule this section previously carried. The reason is
recorded in `DECISIONS.md` §2.)*

**Tiers 1-3 are simulated** from realistic parameters and must be explicitly labeled:

> SIMULATED DEMONSTRATION DATA — NOT REAL FIELD, SENSOR OR REGULATORY MEASUREMENT.

Simulated data exists to make the deterministic verification pipeline testable and
reproducible during the hackathon. It must never be presented as actual environmental
measurement, and it must be visually distinguishable from real Tier 0 at all times.

---

## 5. Spatial Identity

**H3 is the index and join key. Polygon geometry carries quantities and the
non-overlap test.**

H3 cells are not equal-area (icosahedral distortion, plus 12 pentagons), so hectares
are never derived from cell counts. H3 non-overlap also does not prove parcel
non-overlap: adjacent parcels can legitimately share a boundary cell. Both problems
disappear when the intersection test runs on real geometry.

*(This replaces an earlier framing in which H3 proved non-overlap. The reason is
recorded in `DECISIONS.md` §2. The result is strictly simpler.)*

The prototype uses:

* canonical H3 resolution and deterministic cell-set encoding — identity and join key;
* parcel H3 root committed on-chain;
* off-chain polygon geometry with a `geometry_hash` commitment — areas and the
  double-counting check, with an explicit boundary tolerance;
* Location Protocol attestation shape for parcel records (compatibility, not a
  dependency — the Astral oracle is a research preview and is not on the critical path);
* evidence hash / CID.

The on-chain parcel record also carries `analysis_plan_hash` (`VERIFICATION.md`),
`tenure_attestation` (§4.5) and `encumbrances` (§4.6).

---

## 6. Evidence

The conceptual evidence ladder remains:

```text
Tier 0 — Satellite
Tier 1 — Drone / UAS
Tier 2 — IoT / in-situ
Tier 3 — Ground reports
```

For M2, Tier 0 is real acquisition and Tiers 1-3 are controlled simulated fixtures.

The future production system extends the real Tier 0 ingest to real drone, IoT and field evidence.

---

## 7. Component Boundaries

### Verification

Owns:

* evidence normalization;
* baseline;
* parcel observations;
* control matching — **near ring and far ring**, drawn by the pre-registered rule
  rather than chosen at verification time;
* parallel-trend diagnostics;
* difference-in-differences against the far ring;
* **leakage estimation from near/far ring divergence**;
* biophysical additionality;
* uncertainty, with an **empirical coverage figure** alongside the nominal interval;
* lower-bound settlement quantity;
* quality gates and issuance gates;
* canonical `VerificationResult`.

Does not own:

* payment;
* wallets;
* blockchain authorization;
* AI reasoning.

### Guardian

**Guardian is the issuance authority; ATS is the instrument.** Guardian decides whether
and how much to issue and carries the provenance; ATS is what the buyer holds and
transfers. Guardian never touches money. For the hackathon Guardian is *not stood up* —
the seam is built and the drop-in point specified (`GUARDIAN.md`).

Owns:

* methodology;
* policy workflow;
* verifier roles;
* evidence/credential structure;
* verification state;
* restoration outcome lifecycle.

Guardian does not become the scientific calculation engine.

### Arc

Owns:

* Restoration Deed;
* USDC escrow;
* milestone conditions;
* authorized verification;
* release/withholding.

Arc is the financial authority.

### The Graph

Owns:

* indexed project history;
* deed history;
* verification history;
* evidence references;
* settlement history;
* outcome lifecycle.

The Graph is a read/index layer, not the scientific authority.

### Auditor

May:

* inspect evidence;
* query project history;
* invoke deterministic verification;
* identify anomalies;
* explain results;
* orchestrate workflow.

May not:

* invent measurements;
* alter verification quantities;
* bypass verification;
* release sponsor funds.

### Payment gateway (x402)

Owns:

* payment terms for a monetised API request;
* payment verification at the edge;
* refusal of unpaid requests.

May not:

* trigger, influence or substitute for a milestone settlement;
* alter a verification result or any quantity within it;
* place payment data inside a hashed document;
* charge for the evidence a third party needs to check an issued verdict;
* sell an unrecorded verification run;
* become a prerequisite for the core verification or settlement flow.

x402 pays for compute on Hedera. Settlement is USDC on Arc. The two are different
networks, different assets and different accounts, and the separation is structural
rather than conventional.

x402 is optional and demoted (`DECISIONS.md` §2). Metering verification per request
recreates the specification-search incentive §3.7.1 closes, so it ships only coupled to
plan commitment and on-chain run-count recording. See `docs/X402.md` §5.

---

## 8. Milestone Boundary

**M0 is not complete.** As committed in `45b81dc` it delivered documentation and
directory structure, but `verification/{engine,models,fixtures}.ts`,
`auditor/agent.ts`, `guardian/adapter.ts` and `contracts/RestorationDeed.sol` are empty
files, `app/src/App.tsx` is the unmodified Vite template, and the development log was
never written. Those gaps carry into M1 rather than being backdated. See `ROADMAP.md` §3.

**M1 is the Arc Restoration Deed**, ordered first against the September 30, 2026
mainnet-readiness deadline. The pipeline builds against a deployed contract, not the
reverse.

**State on 2026-09-10:** the M1 contract, the M2 engine against real Tier 0, the M3
vertical slice (`scripts/demo.ts`) and the M4 Guardian/ATS seam (prepared calldata, not
broadcast) are prototyped on one branch — see `docs/DEVELOPMENT_LOG.md`. Arc Testnet
deployment, the Subgraph, Sentinel-1 and the Auditor LLM remain open.

M1 does not implement:

* satellite processing;
* control matching;
* difference-in-differences;
* leakage;
* additionality;
* uncertainty;
* Guardian integration;
* Hedera ATS issuance;
* Graph indexing;
* AI agent;
* x402;
* production financial settlement.

---

## 9. Design Principle

Keep the architecture lean.

Every component must have a clear reason to exist.

Partner technologies must be load-bearing rather than decorative.
