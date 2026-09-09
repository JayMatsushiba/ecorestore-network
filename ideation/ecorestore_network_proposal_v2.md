> **HISTORICAL.** The M0 rewrite (`45b81dc`). Its authority model, milestone
> discipline, `INSUFFICIENT_EVIDENCE` gate and data-labelling rules were carried into
> the canonical baseline; its deletions of the market, sponsor and finance analysis
> were not. See `proposals/idea-0.3.md` §13.3.

# Ecorestore Network — Spatially-Verified Restoration Finance

**ETHOnline 2026 submission and portfolio piece.**

**Idea 0.2 — validated revision.**

Supersedes and merges `ecorestore_network.md` (concept) and `restoration_ledger.md` (technical guidance).

---

## 1. Objective

Build **Ecorestore Network**: a protocol and application in which capital for ecological restoration is released against *spatially verified, uncertainty-bounded, additionality-adjusted* evidence of ecological change — and in which the resulting verified outcome becomes an auditable restoration outcome that a corporate buyer can hold, audit, and retire.

The system connects four things into one loop:

**Evidence → deterministic verification → programmable settlement → verified restoration outcome.**

The centre of gravity of this project is the **spatial data pipeline**. The blockchain components are not the product; they are the settlement, provenance, verification-workflow, and asset layer that makes a rigorous MRV (Measurement, Reporting, Verification) pipeline *financially load-bearing*. A verification pipeline that nobody pays against is a research artifact. A payment rail with no verification is a trust-me machine. The contribution is the join.

### The problem being solved

Nature restoration finance has a verification failure, not simply a funding failure. Restoration claims can be:

* issued or funded against projections rather than observed outcomes;
* verified without a transparent counterfactual;
* measured without explicitly accounting for uncertainty;
* reported as point estimates when the underlying measurement has material error;
* insufficiently re-checked after restoration.

Each of these is a *spatial data* problem with a *financial instrument* answer. This project builds both halves and wires them together.

---

## 2. Target Audience

Ecorestore Network is a **B2B product**. The buyer is an organisation with a disclosure obligation or a procurement mandate, not a retail user browsing causes.

### Primary: corporate sponsors

The purchasing driver is the need for defensible, auditable environmental outcomes.

The product must therefore serve:

* an approval workflow;
* an audit trail;
* a reproducible verification record;
* a data export.

It is not a donation application.

### Supply side

The supply side includes restoration operators, conservation NGOs, land trusts, Indigenous-led stewardship organisations, and landowners who hold the parcel and do the work.

They need transparent milestone definitions, predictable payment, and a verification system that does not depend on a single opaque certification process.

---

## 3. Scope — The Spatial Data Pipeline

The pipeline is the primary technical deliverable.

### 3.1 Design principle: the evidence ladder

The pipeline treats evidence sources as a **ladder ordered by an explicit tradeoff between spatial resolution, temporal frequency, cost, and spoofability**.

No single tier is trusted alone.

Verification is **cross-tier corroboration**.

| Tier | Source                  | Role                                  |
| ---- | ----------------------- | ------------------------------------- |
| 0    | Satellite optical + SAR | Arbiter and continuous baseline       |
| 1    | Drone / UAS             | Site-scale calibration and counts     |
| 2    | IoT / in-situ sensors   | Condition signal between observations |
| 3    | Ground reports          | Claims, labels, and accountability    |

The inversion at the heart of the design:

**the tier that measures best is not necessarily the tier that lies least.**

Therefore satellite is the **arbiter, not the sole measurer**.

Ground reports are **claims, not truth**, until corroborated.

---

### 3.2 Tier 0 — Satellite base layer

The intended production system uses:

**Optical — Sentinel-2 L2A**

* NDVI;
* EVI2;
* NDWI/MNDWI;
* NBR/dNBR;
* NDMI;
* SAVI;
* rigorous cloud, shadow and cirrus masking.

**SAR — Sentinel-1 GRD + SLC**

* VV/VH backscatter;
* VH/VV ratio;
* phase/coherence where appropriate.

**Long baseline — Landsat**

Used to establish the pre-disturbance reference state.

**Structure — GEDI / ICESat-2**

Used where footprints intersect the parcel to help interpret vertical structure.

For the ETHOnline prototype, these observations are represented by **synthetic fixtures** so the complete verification pipeline can be developed deterministically and reproducibly.

The synthetic data is explicitly labelled and is not presented as real satellite measurement.

---

### 3.3 Tier 1 — Drone / UAS

The intended production system uses site-scale drone evidence for:

* canopy measurements;
* individual tree or stem counts;
* species or functional-group classification;
* calibration of satellite observations.

The prototype uses synthetic Tier 1 evidence.

---

### 3.4 Tier 2 — IoT / in-situ sensors

The intended production system may use:

* soil moisture;
* soil temperature;
* water table;
* salinity;
* acoustic monitoring;
* camera traps.

Sensors provide condition signals between satellite observations.

The prototype uses synthetic Tier 2 evidence.

---

### 3.5 Tier 3 — Ground reports

Ground evidence may include:

* geotagged photography;
* standardized plot surveys;
* planting records;
* maintenance records;
* operator attestations.

Ground reports serve as claims and labelled validation data rather than being treated as unquestionable truth.

The prototype uses synthetic Tier 3 evidence.

---

### 3.6 Fusion and adjudication

Where the tiers meet, a milestone claim is evaluated as follows:

1. **Normalize** inputs to a common spatial and temporal frame.
2. **Score corroboration per tier.**
3. **Weight evidence according to reliability and metric suitability.**
4. **Test for disagreement.**
5. **Adjust for additionality.**
6. **Propagate uncertainty.**
7. **Emit a structured deterministic verdict.**

Divergence between tiers is never averaged away automatically.

The auditor agent may explain divergence, but the numerical verification result is produced by the versioned deterministic pipeline.

---

### 3.7 Counterfactual and additionality

Raw greening is not restoration.

A wet year can green an entire region. A project that measures only its own parcel risks selling regional change as project performance.

The pipeline therefore constructs a **matched control set** for every funded parcel.

Controls should be selected for similarity in:

* land cover;
* elevation;
* slope;
* aspect;
* soil;
* climate;
* pre-treatment index trajectory.

Controls with plausible treatment spillover or contamination must be excluded.

The control set must first pass a **pre-treatment parallel-trend diagnostic**.

If the diagnostic fails, the system returns:

**INSUFFICIENT_EVIDENCE**

and does not force a settlement.

Verified change is then estimated using a versioned **difference-in-differences** procedure.

This makes the settled quantity additional change rather than gross parcel change.

---

### 3.8 Uncertainty and conservative settlement

Every measurement carries error.

The pipeline explicitly models uncertainty and reports an interval rather than a bare point estimate.

Potential sources include:

* observation error;
* residual cloud contamination;
* mixed pixels;
* co-registration error;
* parcel-boundary error;
* control matching error;
* model uncertainty.

**The financial rule: settlement pays against the lower bound of the declared uncertainty interval, not the point estimate.**

The confidence level and uncertainty method are versioned.

---

### 3.9 Data representation and standards

The intended production geospatial stack is:

| Concern        | Choice                              |
| -------------- | ----------------------------------- |
| Catalogue      | STAC                                |
| Raster storage | Cloud-Optimized GeoTIFF             |
| Vector storage | GeoParquet                          |
| Datacube       | Zarr / xarray                       |
| Spatial index  | H3                                  |
| Serving        | OGC APIs / dynamic tiling           |
| Provenance     | hashes + content-addressed evidence |

The prototype may simplify storage while preserving the same conceptual boundaries.

---

### 3.10 On-chain geographic representation

Polygons do not belong on a blockchain.

**Commit to geography; store it off-chain.**

The intended on-chain representation contains:

```text
h3_cell_root
geometry_hash
baseline_ref
metric_id
verified_delta
confidence_level
evidence_cid
window
```

H3 provides canonical spatial identity.

The parcel geometry remains off-chain.

---

### 3.11 Demonstration project

The ETHOnline prototype uses one synthetic British Columbia restoration project:

**Kootenay Riparian Restoration — British Columbia, Canada**

This is a synthetic demonstration context.

The displayed environmental observations, control parcels, evidence and verification values are synthetic.

They must never be represented as actual field, satellite, regulatory or ecological measurements.

The purpose of the project is to demonstrate the verification architecture rather than claim real environmental certification.

---

## 4. Financial Instruments

The spatial pipeline produces bounded, additionality-adjusted, provenance-carrying measurements.

The financial layer converts those into programmable restoration funding.

### 4.1 Restoration Deed — programmable escrow

A funder locks USDC against:

* a specific parcel;
* a specific metric;
* a methodology version;
* a schedule of milestones.

Release is conditional on a verified outcome.

**The contract, not the AI agent, is the authority that enforces deed terms and releases funds.**

An authorized verifier can submit a verification result but cannot bypass contract policy or directly custody sponsor funds.

Conceptually:

```text
createProject()
createDeed()
fundDeed()
submitEvidence()
verifyMilestone()
releaseTranche()
withholdRetention()
```

---

### 4.2 Persistence payments

Restoration money should not necessarily end at the moment of intervention.

The deed can split payment across time:

* establishment tranche;
* persistence tranche;
* subsequent monitoring tranches.

Persistence is evaluated against the same verification methodology.

If evidence shows reversal, the retention tranche is withheld.

---

### 4.3 Restoration Outcome

The verified result becomes a **Restoration Outcome Unit / verified restoration outcome record**.

The prototype does not claim that this outcome is automatically a regulatory biodiversity credit or carbon credit.

Each outcome should reference:

```text
parcel identity
vintage
metric + methodology version
verified quantity
confidence level
evidence commitment
control set
verification status
```

A later production implementation may use a dedicated tokenization lifecycle.

The ETHOnline prototype prioritizes the deterministic verification → Guardian → Arc flow over implementing a second tokenization system solely for prize coverage.

---

## 5. Sponsor Stack and Prize Evaluation

The architecture is designed around three meaningful partner integrations:

### Hedera Guardian

Guardian provides the environmental methodology and verification workflow layer.

It is responsible for:

* policy;
* roles;
* schemas;
* verification workflow;
* credentials;
* outcome state.

It does not replace the Ecorestore deterministic verification engine.

### Arc

Arc is the financial settlement layer.

The Restoration Deed uses USDC escrow and conditional settlement.

The strongest Arc fit is programmable money: conditional payments and multi-step settlement.

### The Graph

The Graph provides the indexed project history used by the UI and Auditor.

The Auditor should query real indexed blockchain history as part of its reasoning.

The Graph currently offers Subgraphs and AI-oriented tooling including Subgraph MCP, which can expose live structured blockchain data to AI clients.

### x402

x402 is optional and secondary.

If implemented, it exposes verification as a paid service:

```text
Auditor
  ↓
x402 payment
  ↓
Verification API
  ↓
Deterministic Engine
  ↓
VerificationResult
```

It must not become a prerequisite for the core verification or settlement flow.

### Partner-selection principle

Do not add technology merely to claim a prize.

A partner integration must strengthen the core thesis.

---

## 6. Restoration Auditor

One focused component, not a multi-agent architecture.

### Inputs

```text
deed terms
claim
evidence bundle
verification result
project history
```

Project history is a genuine input.

The Auditor may inspect:

* previous claims;
* previous verification results;
* previous settlements;
* reversal history;
* evidence history.

### Output

The Auditor may explain and orchestrate.

It may not generate the settlement quantity.

The versioned deterministic verification pipeline computes:

* measured change;
* control change;
* additionality;
* uncertainty;
* lower-bound quantity;
* quality status.

---

## 7. User Interface

The UI exists to make the verification process inspectable.

The intended views are:

### Project

* parcel;
* baseline;
* evidence;
* methodology;
* status.

### Evidence

* Tier 0;
* Tier 1;
* Tier 2;
* Tier 3;
* corroboration.

### Additionality

The parcel trajectory versus the matched control set.

### Verification

* observed change;
* control change;
* additionality;
* uncertainty;
* lower bound;
* quality gate;
* final status.

### Deed

* funding;
* milestone;
* verification state;
* settlement.

### History

* evidence;
* verification;
* settlement;
* outcome.

The UI must not display synthetic measurements as real-world measurements.

---

## 8. Architecture

```text
                    React UI
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
 Verification      Guardian         Graph
   Results         Workflow        History
        │              │              │
        └──────────────┼──────────────┘
                       │
                    Auditor
                       │
                       ▼
            Deterministic Engine
                       │
                       ▼
              VerificationResult
                       │
                       ▼
                  Arc Deed
                       │
                       ▼
                     USDC
```

### Authority model

```text
Scientific result
    = Ecorestore Verification Engine

Methodology / verification workflow
    = Hedera Guardian

Financial settlement
    = Arc Restoration Deed

Blockchain history
    = The Graph

Orchestration / explanation
    = Auditor

Presentation
    = React UI
```

---

## 9. Build Sequence

The prototype is built in controlled milestones.

### M0 — Foundation

* repository;
* documentation;
* interfaces;
* React scaffold;
* test framework;
* contract scaffold.

### M1 — Deterministic Verification

* synthetic BC dataset;
* parcel/H3 identity;
* baseline;
* parcel observations;
* matched controls;
* parallel-trend diagnostic;
* difference-in-differences;
* additionality;
* uncertainty;
* lower bound;
* quality gates;
* canonical VerificationResult;
* tests.

### M2 — Guardian

* schemas;
* roles;
* verification workflow;
* result ingestion;
* verifier approval;
* outcome representation.

### M3 — Arc

* Restoration Deed;
* USDC escrow;
* milestone state;
* authorized verification;
* lower-bound settlement;
* replay protection;
* tests.

### M4 — Vertical Integration

Connect:

```text
Verification
→ Guardian
→ Arc
→ Outcome
```

### M5 — Graph + Auditor

* live Graph indexing;
* history queries;
* Auditor;
* deterministic verification invocation;
* explanation;
* optional x402.

### M6 — UI + Demo

* project;
* evidence;
* additionality;
* verification;
* deed;
* outcome;
* history.

### M7 — Hardening and Submission

* deterministic tests;
* contract tests;
* Guardian workflow validation;
* authorization;
* replay protection;
* evidence hashes;
* synthetic-data labels;
* error states;
* demo reliability;
* documentation;
* Git history.

---

## 10. Demonstration Path

```text
Sponsor opens project
        ↓
Reviews synthetic evidence
        ↓
Funds Restoration Deed
        ↓
Evidence is submitted
        ↓
Auditor investigates
        ↓
Deterministic verification runs
        ↓
Parallel-trend diagnostic
        ↓
Difference-in-differences
        ↓
Additionality
        ↓
Uncertainty
        ↓
Lower-bound quantity
        ↓
Guardian verification
        ↓
Arc settlement
        ↓
Outcome recorded
        ↓
Graph provides lifecycle history
```

The demonstration must make the counterfactual visible.

The important story is:

**The parcel changed. The region also changed. Ecorestore pays only for the defensible additional change, bounded by uncertainty.**

---

## 11. Open Questions and Risks

| Item                     | Assessment                                                   |
| ------------------------ | ------------------------------------------------------------ |
| Control-set quality      | Scientific weak point. Require parallel-trend diagnostic.    |
| Synthetic evidence       | Must be clearly labelled.                                    |
| Metric standardisation   | Prototype metric is not automatically a biodiversity metric. |
| Uncertainty              | Must be versioned and tested.                                |
| Guardian integration     | Must preserve deterministic verification boundary.           |
| Arc authorization        | Smart contract must remain financial authority.              |
| Graph indexing           | Eventual consistency must be handled honestly.               |
| x402                     | Optional; must not become core dependency.                   |
| Cross-system integration | Build only after interfaces are stable.                      |

If the parallel-trend diagnostic fails, return insufficient evidence rather than forcing a settlement.

---

## 12. Datasets

The intended production system may use:

| Dataset               | Use                |
| --------------------- | ------------------ |
| Sentinel-2 L2A        | Optical indices    |
| Sentinel-1 GRD + SLC  | SAR / coherence    |
| Landsat               | Long baseline      |
| GEDI / ICESat-2       | Canopy structure   |
| ESA WorldCover        | Land cover         |
| Dynamic World         | Land cover context |
| SRTM / Copernicus DEM | Terrain covariates |
| WorldClim / ERA5      | Climate covariates |

For the hackathon M1 implementation, these are represented by synthetic fixtures.

---

## 13. Summary

The target is not feature count.

It is a technically credible, publicly developed system in which **rigorous spatial evidence, explicit uncertainty, measured additionality, deterministic verification, programmable settlement, environmental verification workflow, and auditable restoration outcomes form one working loop**.

The central rule is simple:

**Evidence produces the result. The methodology governs verification. The contract governs money. The index provides history. AI explains and orchestrates.**

No single component is allowed to silently become the authority for another component's responsibility.
