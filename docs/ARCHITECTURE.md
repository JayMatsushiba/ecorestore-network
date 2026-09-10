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

**Tier 0 is real.** **Sentinel-2 L2A is acquired** — 72 genuine scenes over the parcel,
the near control ring and the far control ring, with their STAC scene IDs and processing
graph version displayed. Sentinel-1, Landsat and ICESat-2 are specified in the evidence
ladder and **are not yet ingested** (`VERIFICATION.md` §3); no result depends on them, and
no interface may show scene IDs for them until they are.

The satellite layer is the core scientific claim of the project and is not fabricated.

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
`tenure_attestation` and `encumbrances` (`ARC.md` §3).

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
* serve an unrecorded verification run — sold, free, preview, dry-run or trial alike;
* become a prerequisite for the core verification or settlement flow.

x402 pays for compute on Hedera. Settlement is USDC on Arc. The two are different
networks, different assets and different accounts, and the separation is structural
rather than conventional.

x402 is optional and demoted (`DECISIONS.md` §2). Metering verification per request
recreates the specification-search incentive pre-registration closes (`VERIFICATION.md` §6.1),
so it ships only coupled to
plan commitment and on-chain run-count recording. See `docs/X402.md` §5.

---

## 8. Milestone Boundary

**M0 was closed inside M1.** As committed in `45b81dc` it delivered documentation and
directory structure only — the engine, models, fixtures, auditor, Guardian adapter and
contract were empty files and the development log was never written. Those gaps were
carried into M1 and are now closed. See `ROADMAP.md` §3.

**The ordering was Arc first, and that is not what happened.** The sequence put contracts
ahead of the pipeline against the September 30, 2026 mainnet-readiness deadline. In
practice the M1–M4 slice was built together on one branch, and the single thing M1 names
that has *not* happened is the deployment itself.

### State on 2026-09-10

| Built and tested | Not done |
|---|---|
| `RestorationDeed` — escrow, plan-hash commitment, replay-protected verification, lower-bound settlement, mobilisation draw, `assignTranche()`, benefit share, retention (31 Foundry tests) | **Arc Testnet deployment** — no deployer key; `Deploy.s.sol` is ready |
| Deterministic engine on real Sentinel-2 Tier 0 — controls by committed rule, parallel-trend gate, DiD, leakage, bootstrap uncertainty, placebo coverage, issuance gates | Sentinel-1, Landsat, ICESat-2 ingest |
| Vertical slice end to end (`scripts/demo.ts`), executed against a local chain | Guardian stood up; ATS broadcast (calldata prepared only) |
| Guardian seam — signed verdict VC, `externalDataBlock` request, ATS issuance calldata | The Graph subgraph; Auditor LLM narrator; x402 |
| Rule-based Auditor boundary; additionality view in the app | Production financial settlement |
| **Container stack** — Python `analysis` service (bit-exact with the TypeScript engine), TypeScript `verify` service, nginx `frontend`, optional `anvil` and `acquire`; `verify` attached to a running Guardian 3.7.0 quickstart and its verdicts acknowledged by the gateway (`DEPLOYMENT.md` §7) | AWS deployment; a published Guardian policy carrying the block tag (the `200` is delivery, not a policy run) |

The application's About page (`/about`) states this split in one table. Whoever moves a
row here updates that table (`app/src/About.tsx`). The application's map view draws the
`spatial` block of the bundle envelope and computes nothing: every polygon comes from the
engine's geometry helpers, and no satellite data reaches the browser.

**Deployment to Arc Testnet is therefore the remaining M1 deliverable**, and it gates the
public demonstration (`DEPLOYMENT.md` §4). The verification engine now has two
implementations of one boundary — the reference in `verification/engine.ts` and the
Python service in `analysis/` — and the result records which one produced it
(`VERIFICATION.md` §15). Everything else on the left was prototyped
ahead of its milestone; the development log records that it was done on the owner's
instruction rather than by drift.

---

## 9. Design Principle

Keep the architecture lean.

Every component must have a clear reason to exist.

Partner technologies must be load-bearing rather than decorative.
