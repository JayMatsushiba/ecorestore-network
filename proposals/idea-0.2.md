> **Status: HISTORICAL BASELINE — superseded by `proposals/idea-0.3.md`.**
>
> This is the Idea 0.2 text as reviewed in `proposal_review.md` (2026-09-09), restored
> here because this file was committed empty in `45b81dc`. It is retained unmodified as
> the record of what was reviewed. Do not build against it; build against Idea 0.3.

# Ecorestore Network — Spatially-Verified Restoration Finance

**ETHOnline 2026 submission and portfolio piece.**

**Idea 0.2 — validated revision.**

Supersedes and merges `ecorestore_network.md` (concept) and `restoration_ledger.md` (technical guidance).

---

## 1. Objective

Build **Ecorestore Network**: a protocol and application in which capital for ecological restoration is released against *spatially verified, uncertainty-bounded, additionality-adjusted* evidence of ecological change — and in which the resulting verified outcome becomes a tokenized real-world asset that a corporate buyer can hold, audit, and retire.

The system connects four things into one loop:

**Remote sensing → multi-tier evidence fusion → programmable settlement → tokenized outcome.**

The centre of gravity of this project is the **spatial data pipeline**. The blockchain components are not the product; they are the settlement, provenance, and asset layer that makes a rigorous MRV (Measurement, Reporting, Verification) pipeline *financially load-bearing*. A verification pipeline that nobody pays against is a research artifact. A payment rail with no verification is a trust-me machine. The contribution is the join.

### The problem being solved

Nature restoration finance has a verification failure, not a funding failure. Carbon and biodiversity credits are typically:

- **issued up front**, against modelled projections rather than observed outcomes;
- **verified by a central certifier** paid by the party seeking certification;
- **measured without a counterfactual**, so regional good weather is sold as project performance;
- **reported as a point estimate**, with the uncertainty stripped out of the number that gets traded;
- **never re-checked**, so a site that burns or is cleared in year three still has live credits against it.

Each of these is a *spatial data* problem with a *financial instrument* answer. This project builds both halves and wires them together.

### Why this author

I have spent years building the environmental-value layers this depends on: blue carbon maps of UK waters, Marine Net Gain estimates, island-wide conservation prioritization, and species distribution models derived from satellite and remote-sensing data. The recurring blocker across all of that work was never the science — it was that the outputs had no mechanism to bind anyone to them. Smart contracts supply the missing binding: the number the model produces is the number that moves the money.

---

## 2. Target Audience

Ecorestore Network is a **B2B product**. The buyer is an organisation with a disclosure obligation or a procurement mandate, not a retail user browsing causes.

### Primary: corporate sponsors

The purchasing driver is regulatory and assurance pressure, which is what makes spatially explicit evidence a requirement rather than a nicety:

- **CSRD / ESRS E4** (Biodiversity and Ecosystems) — in-scope EU undertakings subject to the current CSRD/ESRS framework face biodiversity and ecosystem disclosure requirements, including location-specific information for material impacts and risks. Site-level, spatially explicit evidence is therefore useful to the reporting and assurance workflow.
- **TNFD** — the LEAP approach is explicitly spatial: *Locate* is step one. Adopters need to say *where*, at parcel resolution.
- **SBTN** — science-based targets for nature require baselines and measured change against them.
- **UK Biodiversity Net Gain** — statutory 10% uplift with a 30-year maintenance obligation. The 30-year part is a monitoring liability that nobody currently has a good instrument for.
- **EU Nature Restoration Regulation** — member-state restoration targets create downstream corporate demand.
- **Greenwashing litigation and assurance** — as ESG statements become auditable and legally actionable, a PDF certificate from a certifier is a weak evidentiary position. A reproducible, hash-committed evidence bundle with named satellite scene IDs and a published processing graph is a strong one.

**Personas inside the buyer:**

| Persona | Needs from the product |
|---|---|
| Sustainability / ESG lead | Site selection, ecological credibility, disclosure-ready export |
| Treasury / finance | Multi-approver authorization, disbursement controls, spend visibility |
| Internal audit / external assurance | Immutable event history, reproducible derivation, evidence provenance |
| Procurement / legal | Counterparty KYC, transfer restrictions, contractual milestone terms |

The product must therefore serve **an approval workflow, an audit trail, and a data export** — not a donate button.

**Supply side of the marketplace** (also B2B): restoration operators, conservation NGOs, land trusts, Indigenous-led stewardship organisations, and landowners who hold the parcel and do the work. They need transparent milestone definitions, predictable payment, and to not be forced to buy a satellite programme to get paid.

### Secondary: individual donors

Individual donors are supported but deliberately *thin*. They participate by contributing into a **pooled deed** — an aggregated funding vehicle against a single parcel with a single set of milestones — using the same contracts, same verification, same evidence. They receive a proportional claim on the resulting outcome units and the same evidence bundle a corporate buyer gets.

Explicitly **not** built: badges, streaks, leaderboards, passports, challenges, or achievement mechanics. The gamification layer from the earlier draft is dropped entirely. It works against the credibility of the verification story, which is the thing this project is actually demonstrating. Transparency of outcome is the reward.

---

## 3. Scope — The Spatial Data Pipeline

This section replaces the single-fictional-project demonstration scenario from the earlier draft. The pipeline is the deliverable.

### 3.1 Design principle: the evidence ladder

The pipeline treats evidence sources as a **ladder ordered by an explicit tradeoff between spatial resolution, temporal frequency, cost, and spoofability**. No single tier is trusted alone. Verification is *cross-tier corroboration*.

| Tier | Source | Resolution | Revisit | Cost | Spoofability | Role |
|---|---|---|---|---|---|---|
| 0 | Satellite (optical + SAR) | 10–30 m | 5–12 days | ~free | **Low at source** | Arbiter and continuous baseline |
| 1 | Drone / UAS | 2–10 cm | Episodic | Medium | Medium | Site-scale calibration and counts |
| 2 | IoT / in-situ sensors | Point | Continuous | Low-medium | Medium-high | Condition signal between passes |
| 3 | Ground reports | Plot / individual | Sparse | High (labour) | **High** | Claims, labels, and accountability |

The inversion at the heart of the design: **the tier that measures best is the tier that lies easiest.** A field report can state a precise number of established seedlings and can also be fabricated at a desk. A Sentinel-2 scene cannot resolve individual seedlings but is acquired by an independent third-party constellation on a fixed orbit, is archived globally, and can be re-derived by any party years later.

Therefore satellite is the **arbiter, not the sole measurer**. Its raw acquisition is independently sourced, but derived satellite products remain subject to processing and model error. Ground reports are **claims, not evidence**, until corroborated. The auditor's job is to reconcile them.

### 3.2 Tier 0 — Satellite base layer

The always-on foundation. Every parcel in the system has a continuous satellite record whether or not anyone is currently funding it.

**Optical — Sentinel-2 L2A** (10 m, ~5-day revisit, free, 2015–present)
- Spectral indices: NDVI, EVI2 (saturation-resistant in high-biomass), NDWI/MNDWI (water and inundation), NBR/dNBR (burn severity and fire reversal detection), NDMI (moisture stress), SAVI (soil-adjusted, for sparse dryland canopies where NDVI is dominated by soil background)
- Rigorous cloud/shadow/cirrus masking (s2cloudless or the SCL band with a dilated shadow projection) — unmasked cloud edges are the single largest source of spurious "greening" in naive pipelines

**SAR — Sentinel-1 GRD + SLC** (10 m, C-band, free)
- Cloud-penetrating and illumination-independent. **Non-optional** for mangrove, tropical, and maritime-temperate sites where an optical time series may have fewer than five clear scenes a year.
- GRD provides VV/VH backscatter and the VH/VV ratio as a canopy-structure proxy. **Interferometric coherence requires phase-bearing SLC data (or a derived coherence product), not GRD alone**, and is used where acquisition geometry and temporal baselines make the signal interpretable as a disturbance indicator.

**Long baseline — Landsat 5/7/8/9** (30 m, 1984–present)
- Establishes the **pre-disturbance reference state**. You cannot define "restored" without knowing what the site was before it was degraded. A 40-year record turns "restoration target" from a negotiated guess into an empirical one.

**Structure — GEDI / ICESat-2** (spaceborne lidar, sampled)
- Canopy height and vertical structure where footprints intersect the parcel; used to calibrate the 2D indices toward a 3D biomass interpretation.

**Context — land cover and ecological priors**
- ESA WorldCover / Dynamic World for land-cover transitions
- **Global 100 m Projections of Biodiversity Intactness 2017–2025 (v1.1)**, Vizzuality — <https://source.coop/vizzuality/biodiversity-intactness-100m-v1-1> — the ecological-value prior used in parcel scoring

**Derived products per parcel:** a harmonised, gap-filled, cloud-masked datacube; per-index time series with per-observation uncertainty; seasonal decomposition (so a phenological green-up is never mistaken for restoration); and a trend estimate with confidence intervals.

### 3.3 Tier 1 — Drone / UAS

Site-scale, episodic, centimetre-resolution. Commissioned at defined milestones rather than continuously.

- RGB and multispectral (RedEdge/Altum-class) capture, processed to orthomosaic + DSM; DSM minus a DTM yields a **canopy height model**
- Individual tree crown delineation and stem counts — the metric that satellite fundamentally cannot deliver
- Species or functional-group classification at planting-unit level; survival and establishment rates
- Precise canopy cover fraction, used to **calibrate the satellite signal**: fitting cm-scale ground truth against 10 m pixel values converts the Tier 0 index into a physically interpretable quantity for that specific site and vegetation type

Tier 1's most valuable output is not its own measurement — it is the **transfer function that makes Tier 0 quantitative**, letting one drone flight extend credibility across every subsequent free satellite pass.

### 3.4 Tier 2 — IoT / in-situ sensors

Continuous point measurement filling the gap between satellite passes and drone flights.

- Soil moisture and temperature probes; dendrometers for stem increment
- Water table depth (peatland rewetting), salinity and tidal inundation (mangrove / saltmarsh blue carbon)
- Bioacoustic recorders — acoustic complexity and diversity indices as a **biodiversity** proxy rather than a **vegetation** proxy, which matters because greenness is not the same thing as ecological recovery
- Camera traps for faunal return

Sensors sign their telemetry with a device key; the auditor tracks per-device health and **downweights or flags implausible series** (a flatlined soil-moisture probe through a rainfall event is a failed or tampered sensor, not a dry site).

Tier 2 is the early-warning channel: drought stress, tidal disconnection, or hydrological failure show up here months before they are visible from orbit.

### 3.5 Tier 3 — Ground reports

The human layer, and the one with real legal and social accountability behind it.

- Geotagged, timestamped field photography with EXIF retained and hashed
- Standardised plot surveys (fixed quadrats, revisited on schedule), species inventories, planting and maintenance records
- Operator attestation, signed by an identified party

Ground reports serve two functions: they are the **claim** that initiates a verification cycle, and they are the **labelled training and validation data** for the classifiers operating at Tiers 0 and 1. Treating them as labels rather than as truth is what allows the system to use them without being hostage to them.

### 3.6 Fusion and adjudication

Where the tiers meet. A milestone claim is evaluated as follows:

1. **Normalise** every input to a common spatial frame — the parcel geometry rasterised to an H3 cell set at an appropriate resolution — and a common temporal frame.
2. **Score corroboration per tier**: does each tier independently support the claimed direction and magnitude of change? Each returns a corroboration score with its own uncertainty.
3. **Weight by tier reliability and by suitability for the specific metric.** Stem counts weight toward Tier 1. Persistence over 24 months weights toward Tier 0. Hydrological condition weights toward Tier 2.
4. **Test for disagreement.** Divergence between tiers is the most informative signal the system produces and is never averaged away. Ground reports claiming establishment while SAR coherence indicates recent clearing is a fraud signal, not a noisy measurement.
5. **Adjust for additionality** (§3.7).
6. **Propagate uncertainty** to a bounded estimate (§3.8).
7. **Emit a structured verdict** consumed by deterministic settlement rules. The auditor agent is not trusted with custody or unilateral authority to move funds; numerical settlement quantities are produced by the versioned verification pipeline and enforced against the deed terms by the contract.

### 3.7 Counterfactual and additionality

**The most important component of the pipeline, and the one most conspicuously missing from existing credit markets.**

Raw greening is not restoration. A wet year greens an entire region. A project that measures only its own parcel sells the weather.

The pipeline therefore constructs a **matched control set** for every funded parcel: nearby unfunded parcels selected for similarity in land cover class, elevation, slope, aspect, soil, climate zone, and — critically — **pre-treatment index trajectory**, while excluding parcels with plausible treatment spillover or contamination. Matching on the pre-treatment trend is what distinguishes a genuine control from a merely adjacent one.

Verified change is then the **difference-in-differences** estimate: the parcel's change minus the control set's change over the same window, using the same sensors and the same processing chain. The control set must first pass a **pre-treatment parallel-trend diagnostic**; matching on covariates alone is not sufficient. Shared systematic error can be reduced when both sides use the same scenes and processing, but it does not automatically cancel.

This makes the settled quantity *additional* change — the change attributable to the intervention — which is the quantity a corporate buyer actually needs to defend under assurance.

### 3.8 Uncertainty and conservative settlement

Every measurement carries error: atmospheric correction residuals, BRDF and view-angle effects, mixed pixels at parcel boundaries, co-registration error, residual cloud shadow, control-set matching error. The pipeline propagates **modelled uncertainty** from these sources and reports an interval, never a bare number.

**The financial rule: settlement pays against the lower bound of the declared uncertainty interval, not the point estimate.**

This is a small change with large consequences:

- The settlement rule is deliberately conservative: it is designed to avoid paying against the optimistic point estimate when uncertainty is material.
- The restorer gains a **direct financial incentive to fund better measurement**, because tightening the interval raises the payout without changing the ecology. Commissioning a drone flight or maintaining a sensor array becomes a revenue decision rather than a compliance cost.
- Cheap, sloppy MRV becomes self-penalising instead of self-serving.

The confidence level is a parameter of the deed, negotiated up front, and the interval method is versioned and calibrated for the metric. A conservative corporate buyer can require a 95% lower bound; a risk-tolerant one can accept 80% and pay more per unit.

### 3.9 Data representation and standards

Portfolio-grade means using the actual geospatial stack, not bespoke formats.

| Concern | Choice |
|---|---|
| Catalogue | **STAC** (SpatioTemporal Asset Catalog) — items, collections, and a searchable API for every input scene and derived product |
| Raster storage | **Cloud-Optimized GeoTIFF (COG)** — range-request reads, no full-file downloads |
| Vector storage | **GeoParquet** for parcels, controls, and observations; GeoJSON at the API boundary |
| Datacube | **Zarr**, accessed as `xarray` via `odc-stac` / `stackstac`, chunked with `dask` |
| Spatial index | **H3** — hierarchical hexagonal cells; the join key across every tier and the on-chain geographic representation |
| Serving | **titiler** for dynamic tiling from COGs; **OGC API — Features** for vector access |
| Provenance | Every product records its input scene IDs, processing graph, software versions, and parameters; the whole bundle is hashed and pinned to IPFS/Filecoin |

**Reproducibility is a first-class output.** Because every derived number cites named public satellite scenes and a published, versioned processing graph, an auditor with no access to this system can re-derive the number independently. That property — not the ledger — is what makes the evidence defensible.

### 3.10 On-chain geographic representation

Polygons do not belong on a blockchain. Storage is expensive, geometry operations are worse, and neither buys anything.

**Commit to geography; store it off-chain.** What goes on-chain per parcel:

```text
h3_cell_root      compact commitment over the parcel's H3 cell set
geometry_hash     hash of the canonical GeoJSON (RFC 7946, normalised)
baseline_ref      STAC item IDs + hash of the baseline product
metric_id         identifier of the agreed metric and its version
verified_delta    additionality-adjusted change, lower confidence bound
confidence_level  the bound used (e.g. 95%)
evidence_cid      IPFS/Filecoin CID of the full evidence bundle
window            observation start and end
```

An H3 cell index is a 64-bit integer. A parcel is represented by a **canonical H3 resolution and deterministic cell-set encoding**, with a Merkle root committed on-chain. This gives compact, reproducible on-chain **spatial identity** without storing polygon geometry.

Double-counting prevention becomes a set-intersection check over the canonical H3 cell sets at issuance time. The resolution and boundary-encoding rules must be identical for every parcel; otherwise cell-level comparison alone is not sufficient to prove non-overlap. This is a concrete, demonstrable advantage of the spatial-index choice and worth showing explicitly in the demo.

### 3.11 Demonstration sites

Four real, named regions with genuinely available imagery, each exercising a different part of the pipeline. Real geography means the globe shows real data and the demo survives scrutiny.

| Site | Ecosystem | Pipeline emphasis |
|---|---|---|
| **Fraser Valley, British Columbia** | Riparian forest | Optical time series, drone stem counts, seasonal decomposition |
| **Gulf of Thailand / Indonesian coast** | Mangrove (blue carbon) | **SAR-led** — persistent cloud makes Sentinel-1 the primary sensor; tidal/salinity IoT |
| **Flow Country, Scotland** | Peatland rewetting | Water-table IoT as the leading indicator; MNDWI; long Landsat baseline |
| **Sahel drylands** | Savanna woodland regeneration | **Additionality-critical** — high interannual rainfall variability makes the control set decisive |

The dryland site is the one to feature in the demo, because it is where a naive pipeline most visibly fails and where the counterfactual machinery earns its place.

---

## 4. Financial Instruments

The spatial pipeline produces bounded, additionality-adjusted, provenance-carrying measurements. The financial layer converts those into instruments a corporate treasury can actually transact.

### 4.1 Restoration Deed — programmable escrow (Arc, USDC)

A funder locks USDC against a specific parcel, a specific metric, and a schedule of milestones. Release is conditional on a verified outcome. **The contract, not the AI agent, is the authority that enforces deed terms and releases funds; an authorised verifier can submit evidence and a verdict, but cannot bypass contract policy or directly custody the sponsor's funds.**

```text
createProject()      register parcel: h3 root, geometry hash, baseline ref, metric
createDeed()         terms: milestones, thresholds, confidence level, schedule
fundDeed()           corporate sponsor deposits USDC into escrow
submitEvidence()     restorer commits an evidence bundle CID
verifyMilestone()    authorized verifier submits the versioned verdict on-chain
releaseTranche()     conditional release against verified lower bound
withholdRetention()  persistence window fails -> retention is not released
```

### 4.2 Persistence payments — the core innovation

Restoration money is conventionally paid at planting. Nobody checks in year three. This is precisely the failure mode programmable money removes, and it is the strongest argument this project makes.

The deed splits payment across time:

- **Establishment tranche** — released on verified planting/intervention (Tier 1 and Tier 3 dominant)
- **Persistence tranches at 12 / 24 / 36 months** — released only if the satellite record shows the gain has *held*, evaluated automatically against the same controls

The retention tranches cost almost nothing to enforce, because Tier 0 is free and continuous. The contract simply re-runs the same query on a schedule. **Continuous, low-cost satellite monitoring helps make long-dated conditional payment economically viable** — the marginal compute cost of re-checking a parcel can be kept low relative to the value at risk.

**Reversal handling:** if dNBR indicates fire or SAR coherence indicates clearing inside the commitment window, retention does not release and previously issued outcome units are flagged and lifecycle-marked as reversed. The asset carries its own bad news.

### 4.3 Restoration Outcome Unit — tokenized RWA (Hedera ATS)

The verified restoration outcome becomes a transferable, auditable asset issued through the **Asset Tokenization Studio**. Issuance occurs **only** on a verified milestone — there is no forward issuance against projections. The prototype's unit represents a **verified restoration outcome**, not a claim that it is itself a regulatory biodiversity credit.

Each unit carries:

```text
parcel identity     h3 cell root + geometry hash
vintage             observation window
metric + version    what was measured and how
verified quantity   additionality-adjusted, lower confidence bound
confidence level    the bound applied
evidence CID        full bundle: STAC IDs, processing graph, tier corroboration
control set ref     the counterfactual parcels used
```

**Lifecycle operations** — the reason ATS is the right tool rather than a bare token standard:

- **Issue** on verification
- **Hold** with permissioned transfer: allowlisted, KYC'd counterparties only, which is what a corporate buyer's legal team requires and what a plain ERC-20 cannot express
- **Transfer** under compliance controls
- **Retire** — records the sponsor's retirement of the outcome unit for its internal disclosure/impact accounting. Retirement is **not, by itself, a regulatory credit or compliance claim**; any external claim remains subject to the applicable reporting, legal, and assurance framework.
- **Flag / mark reversed** on detected loss

ATS gives regulated-asset lifecycle semantics out of the box. Hedera's low, predictable fees also make per-parcel, per-vintage issuance economically sensible at portfolio scale, and its sustainability positioning aligns with the buyer's own reporting posture.

### 4.4 Metered verification-as-a-service (x402 on Hedera)

The spatial pipeline is itself a product. It is exposed as an **x402-gated service on Hedera**, using the event's required **Blocky402 facilitator** for settlement: a per-request paid API for parcel scoring, baseline derivation, and verification runs.

The Restoration Auditor agent uses **Circle Agent Stack** for its agent wallet/payment path and **pays per analysis** — per scene processed, per verification executed. This makes MRV a metered, machine-payable utility instead of a bundled consultancy line item, and it means an operator can obtain independent verification without a subscription or a relationship with a certifier.

It also satisfies a second Hedera track at no additional sponsor cost (§5).

### 4.5 Corporate treasury controls (Privy)

A corporate sponsor cannot have one person unilaterally moving funds. The funding path uses **policies, key quorums, and intents**: a sustainability lead proposes a deed, finance approves under a spend policy, and disbursement requires quorum signing. The approval trail is part of the audit record.

### 4.6 Pooled deeds for individual donors

Individual contributions aggregate into a single deed against one parcel, sharing the same contracts and verification. Contributors hold a proportional claim on issued units and receive the identical evidence bundle. Thin surface, no separate mechanics, no gamification.

---

## 5. Sponsor Stack and Prize Evaluation

### 5.1 The submission constraint

ETHGlobal allows a project to select **up to 3 partner prizes** at submission. Critically, **a partner with multiple tracks counts as one partner slot while remaining eligible for all of its tracks**. This materially changes the optimal stack: the correct strategy is to pick three partners with *deep, multi-track* fit rather than three partners with one track each.

*Verify against the ETHOnline 2026 submission page before finalising, since per-event rules vary.*

### 5.2 Recommended stack

**Hedera — 1 slot, 2 tracks, $12,000 addressable**

| Track | Pool | Fit |
|---|---|---|
| Tokenization of Anything | $6,000 (3 × $2,000) | **Excellent.** ATS issues and manages the Restoration Outcome Unit. Requirement is explicitly issuance *plus lifecycle operations* — this project has a genuine lifecycle (issue, permissioned transfer, retire, reverse) rather than a mint-and-stop. |
| AI & Agentic Payments (x402) | $6,000 (3 × $2,000) | **Strong.** Requires a live x402-gated service plus an agent completing a real paid request. The verification API is the service; the auditor is the agent. Both halves already exist in the architecture. |

Requirements to satisfy: Hedera testnet deployment, **contracts verified on HashScan**, demo video ≤5 min showing issuance and lifecycle operations, public repo.

**Arc — 1 slot, up to 3 tracks, $6,834 addressable**

| Track | Pool | Fit |
|---|---|---|
| Launch on Arc Testnet & Push to Mainnet | $3,500 (2 winners) | **Highest EV — only two prizes.** Requires mainnet deployment or deployment-readiness **by September 30**. Treat this as a hard schedule constraint from day one, not a stretch goal. |
| Best DeFi / Onchain Finance Application | $1,667 | **Excellent.** Requirement reads "conditional payments, onchain automation or multi-step settlement" — the tranched persistence deed is all three simultaneously. |
| Best Agentic Economy (Circle Agent Stack) | $1,667 | **Strong.** "Agents with clear decision logic tied to real signals" — the signal is a satellite time series, which is about as real as a signal gets. |

**The Graph — 1 slot, 2 tracks, $10,000 addressable**

| Track | Pool | Fit |
|---|---|---|
| Best AI Tooling or AI Use Case — From Scratch | $5,000 (3 winners) | **Excellent.** The auditor is the AI component; The Graph is load-bearing (it supplies the project history the verdict depends on), and the work done is reasoning, decision, and automation. |
| Composable or Standardized Graph Products | $5,000 (3 winners) | **Good** if the project composes the Subgraph with another current Graph product such as Substreams, or meaningfully uses a standardized schema, rather than querying one Subgraph alone. |

**Privy — use without claiming a slot**

Privy's *Best B2B Financial Product* track ($2,500) is an unusually exact match for this project's stated audience — it asks for treasury operations, approval workflows, and wallet administration using Privy policies, signers, key quorums, or intents, which is precisely §4.5.

However, using a sponsor's technology and submitting to their prize are separate decisions. Privy has two single-winner tracks, while each of Hedera, Arc, and The Graph offers multiple multi-winner tracks against a deeper integration. Build the corporate treasury flow on Privy for product reasons; spend the three slots on Hedera, Arc, and The Graph.

*Swap condition:* if the corporate multi-approver treasury flow becomes the demo's centrepiece and the Subgraph ends up shallow, swap Privy in for The Graph. Decide this by the end of the build sequence, not at the start.

### 5.3 Evaluated and declined

| Sponsor | Assessment |
|---|---|
| **Chainlink** (CRE Confidential Workflows) | Genuinely interesting — precise coordinates of restoration sites and rare-species observations are sensitive (poaching risk, landowner privacy), and processing them in a TEE is a real use case, not a contrivance. Also useful for securely managing commercial imagery API keys. **Declined only for slot scarcity.** Strongest candidate for a post-hackathon continuity submission. |
| **World** (Selfie Check) | Proof-of-personhood for field observers submitting ground reports is a legitimate anti-fraud fit. But it pushes toward B2C framing and the fusion pipeline already handles Tier 3 fraud via cross-tier corroboration. Declined. |
| **Ledger** | Hardware-backed keys for the auditor agent are plausible but peripheral to the thesis. Declined. |
| **ENS** | Human-readable parcel names are cosmetic here, and the track explicitly excludes cosmetic use. Declined. |
| **1inch / Uniswap** | Outcome-unit secondary market liquidity is a real future concern, entirely out of scope now. Declined. |
| **Bazantic** | Requires a Bazantic gateway/recipe; overlaps the x402 work without adding to the thesis. Declined. |

### 5.4 Multi-chain justification

This design deliberately spans two chains, which needs defending rather than hand-waving:

- **Arc is the money rail.** USDC-denominated, corporate-treasury-facing, programmable settlement.
- **Hedera is the asset and registry rail.** ATS provides regulated-asset lifecycle semantics that a settlement contract should not be reimplementing.
- **The bridge is the auditor's attestation, not a token bridge.** No value crosses chains. A verified milestone on Arc emits an event; the auditor observes it and triggers issuance on Hedera, carrying the same evidence CID and H3 root as its payload. The link is a shared commitment hash.

This is a separation of concerns, not multi-chain for its own sake. It is nonetheless the largest integration risk in the build (§9).

---

## 6. Restoration Auditor

One focused component, not a multi-agent architecture.

### 6.1 Inputs

```text
deed terms              metric, thresholds, confidence level, milestone schedule
claim                   quantity and window asserted by the restorer
evidence bundle         tier 1/2/3 submissions, CIDs, hashes
satellite derivation    tier 0 time series for parcel and control set
project history         indexed via The Graph — prior claims, verdicts, payments, reversals
```

Project history is a genuine input, not decoration. A parcel with a prior reversal, a repeatedly-revised claim, or a pattern of ground reports that consistently overshoot corroborated measurement is scored differently from a clean one. This is only queryable because the Subgraph exists.

### 6.2 Output

The auditor may use AI for evidence triage, anomaly explanation, and workflow orchestration, but **the settlement quantity is not an LLM-generated number**. The versioned spatial/statistical pipeline computes the measurement, additionality adjustment, uncertainty interval, and release fraction; the contract enforces the resulting bounds against the deed terms.

```json
{
  "status": "PARTIAL",
  "parcel_h3_root": "0x...",
  "window": ["2026-03-01", "2026-09-01"],
  "claimed": { "metric": "canopy_cover_gain_ha", "value": 42.0 },
  "measured": {
    "parcel_change": 38.4,
    "control_change": 21.7,
    "additional": 16.7,
    "ci_95": [13.1, 20.3]
  },
  "quality_gate": {
    "status": "PASS",
    "metric": "ecological_function",
    "note": "Canopy heterogeneity, SAR-derived structure, and spectral signature consistent with native species mix, not a monoculture flush"
  },
  "settled_quantity": 13.1,
  "settlement_basis": "lower_bound_95",
  "tier_corroboration": {
    "tier_0_satellite": { "score": 0.91, "note": "Sentinel-2 + S1 agree on direction and magnitude" },
    "tier_1_drone":     { "score": 0.88, "note": "Orthomosaic canopy fraction consistent with S2 calibration" },
    "tier_2_iot":       { "score": 0.42, "note": "Soil moisture node 3 flatlined through recorded rainfall — excluded" },
    "tier_3_ground":    { "score": 0.55, "note": "Claim exceeds corroborated satellite measurement by ~9%" }
  },
  "reason": "Regional control parcels greened 21.7 ha over the same window under above-average rainfall. Claim is not adjusted for the regional trend; additional gain is 16.7 ha (95% CI 13.1–20.3). Regrowth passes the ecological-function quality gate. Settling at the lower bound.",
  "evidence_cid": "bafy...",
  "action": "RELEASE_TRANCHE",
  "release_fraction": 0.312
}
```

### 6.3 The demonstration case

A revegetated site claims a 42 ha canopy gain. The satellite record measures 38.4 ha of parcel-level gain. Tier 0 and Tier 1 support the direction and magnitude; the Tier 2 stream contains a failed sensor node and the Tier 3 claim exceeds the corroborated measurement. The system therefore treats the claim as **partially corroborated**, not automatically as fraudulent.

**The auditor then evaluates the matched control set** using the same observation window and processing chain. The control parcels gained 21.7 ha over the same period, so the additionality-adjusted gain is 16.7 ha. The pre-treatment trajectories pass the parallel-trend diagnostic, supporting the counterfactual comparison. Regional background greening is not credited as restoration.

A second observation runs in parallel: is the gain ecologically functional, or just green? Canopy cover can spike from an invasive monoculture or scrub that never develops the required forest structure — neither qualifies. The system checks canopy heterogeneity, SAR-derived structure, and spectral signatures against the versioned ecological-quality rules for the site. Here it passes: the regrowth shows structural diversity rather than a monoculture flush.

The 16.7 ha clears the quality gate, and after uncertainty propagation the settled quantity is 13.1 ha — under a third of the claim. The verdict is `PARTIAL`, the tranche releases proportionally, and the Restoration Outcome Units issued on Hedera carry the additionality-adjusted, quality-gated quantity.

This single case demonstrates the counterfactual machinery, the ecological-quality gate, the uncertainty rule, the multi-tier fusion, and the settlement link at once. It shows how a workflow that paid against the gross 38.4 ha measurement can instead settle only against the additionality-adjusted lower bound. A second, contrasting case (SAR coherence loss revealing clearing behind a clean-looking optical composite) demonstrates the reversal path.

---

## 7. User Interface — Interactive 3D Globe

Web-based, B2B, and built so the spatial work is the visible substance of the product rather than a thumbnail beside a form.

### 7.1 Globe technology

**Recommended: deck.gl `GlobeView` over a MapLibre GL JS basemap, in React.**

Rationale:
- Native **`H3HexagonLayer`** — H3 is already the pipeline's spatial index, so parcels, control sets, and scores render directly off the production data structures with no conversion layer
- `ArcLayer` for capital flows from sponsor to parcel; `ScatterplotLayer` and `IconLayer` for bounty markers; `BitmapLayer` for imagery draping
- GPU-accelerated, handles large parcel counts, and renders the dark-globe aesthetic the concept needs
- Straightforward React integration alongside the rest of the app

**Alternative: CesiumJS**, if terrain and time-dynamic imagery draping become central — Cesium is more geospatially rigorous (true WGS84 ellipsoid, terrain, CZML time dynamics) at the cost of a heavier, less React-native integration. Choose deck.gl unless 3D terrain proves essential to the story.

### 7.2 Views

**Globe (landing)** — dark rotating Earth. Restoration bounties as glowing markers sized by available bounty and coloured by verification state (open / funded / verifying / verified / reversed). Filter by ecosystem type, bounty size, biodiversity intactness prior, and confidence level. Arcs animate capital flowing from sponsor to parcel. This is the first thing a corporate visitor sees, and it must communicate *portfolio* immediately.

**Parcel** — zoom from globe to site. H3 cells rendered over high-resolution imagery. Parcel boundary, matched control parcels shown alongside in a contrasting colour so the counterfactual is *visible*, not just asserted. Baseline state, target state, current state, bounty terms, milestone schedule.

**Evidence ladder** — the pipeline made legible. Four stacked panels, one per tier, each showing what it contributes and its corroboration score. Satellite panel carries a **time slider** with a before/after imagery swipe and the index time series charted with its confidence band. Drone panel shows the orthomosaic and detected crowns. IoT panel shows sensor series with flagged nodes marked. Ground panel shows geotagged photos on the parcel.

**Additionality** — parcel trajectory plotted against the control-set envelope. The gap between the two lines *is* the settled quantity, drawn as a shaded region. This is the single most important chart in the product and should be treated as such.

**Deed and settlement** — funding terms, tranche schedule, approval status, which milestones have released, retention tranches pending with their next evaluation date, and the Arc transaction history.

**Outcome units** — issued Hedera assets with their full attribute set, lifecycle state, transfer history, and retirement action.

**Assurance export** — the B2B deliverable. One click produces a disclosure-ready bundle: verified quantities with confidence bounds, complete evidence provenance, named STAC scene IDs, processing-graph version, control-set definition, on-chain transaction references, and the auditor's verdicts. This is the artifact the sustainability lead hands to their assurance provider, and it is what makes the product buyable.

### 7.3 Design constraints

Dark, precise, data-dense — reference points are Earth-observation operations consoles and financial terminals, not consumer donation apps. Every number displayed carries its uncertainty; no bare point estimates anywhere in the interface. Colour must remain accessible and consistent between the globe and the charts.

---

## 8. Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  Web app — React + deck.gl GlobeView + MapLibre             │
│  Globe · Parcel · Evidence Ladder · Additionality ·          │
│  Deed · Outcome Units · Assurance Export                     │
└───────────────┬─────────────────────────────┬───────────────┘
                │ GraphQL                     │ Privy (treasury controls)
                ▼                             ▼
┌───────────────────────────┐   ┌─────────────────────────────┐
│  The Graph — Subgraph     │   │  Arc — USDC settlement      │
│  Parcel, Deed, Milestone, │◄──┤  Deed escrow, tranches,     │
│  Evidence, Verification,  │   │  persistence retention      │
│  Payment, OutcomeUnit,    │   └──────────┬──────────────────┘
│  Reversal                 │              │ events
└───────────┬───────────────┘              │
            │ history queries              │
            ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Restoration Auditor  (x402-metered, pays per analysis)      │
│  fusion · additionality · uncertainty · verdict              │
└───────────┬─────────────────────────────┬───────────────────┘
            │                             │ attestation
            ▼                             ▼
┌───────────────────────────┐   ┌─────────────────────────────┐
│  Spatial pipeline         │   │  Hedera ATS                 │
│  STAC · COG · Zarr · H3   │   │  Outcome Unit issuance,     │
│  S2 · S1 · Landsat · GEDI │   │  permissioned transfer,     │
│  drone · IoT · ground     │   │  retirement, reversal       │
│  controls · uncertainty   │   └─────────────────────────────┘
└───────────┬───────────────┘
            ▼
┌─────────────────────────────────────────────────────────────┐
│  IPFS / Filecoin — evidence bundles, selected derived artifacts, provenance │
└─────────────────────────────────────────────────────────────┘
```

### Subgraph entities

```text
Parcel          h3 root, geometry hash, baseline ref, ecosystem
Deed            terms, metric, thresholds, confidence level
Contribution    funder, amount, pooled or direct
Milestone       schedule, type (establishment / persistence)
Evidence        tier, CID, hashes, submitter
Verification    verdict, measured, control, additional, CI, tier scores
Payment         tranche release, amount, tx
OutcomeUnit     Hedera asset ref, quantity, vintage, lifecycle state
Reversal        detected loss, cause, affected units
ControlSet      matched parcels used for the counterfactual
```

---

## 9. Build Sequence

Vertical slices, frequent public commits. ETHGlobal requires a meaningful commit history and permits AI coding tools with attribution.

1. **Spatial pipeline core.** STAC search, Sentinel-2 + Sentinel-1 ingest for the four demonstration sites, cloud masking, index computation, H3 parcel indexing. *Start here — it is the longest pole and the portfolio centrepiece.*
2. **Controls and additionality.** Matched control selection, difference-in-differences, uncertainty propagation to bounded estimates.
3. **Globe UI with real data.** deck.gl GlobeView, H3 layers, parcel drill-down, time slider. Real imagery from step 1 from the first commit — never mock geospatial data.
4. **Arc contracts.** Deed escrow, tranches, persistence retention, milestone verification hooks. Deploy to testnet. **Track mainnet readiness from this point** given the September 30 deadline.
5. **Privy treasury flow.** Corporate funding path with policy and quorum approval.
6. **Subgraph.** Full entity set, live queries driving the UI.
7. **Restoration Auditor.** Fusion, verdict, structured output; consumes Graph history as an actual input.
8. **x402 gating + Circle Agent Stack.** Verification service metered; auditor agent uses the agent wallet/payment path and pays per analysis.
9. **Hedera ATS.** Outcome unit issuance on verification, permissioned transfer, retirement, reversal. Verify contracts on HashScan.
10. **Assurance export.** Disclosure-ready bundle generation.
11. **Reversal path.** dNBR/coherence loss detection driving retention withholding and unit flagging.
12. **Polish the demonstration path** and record the video.

**Risk order.** The riskiest items are the cross-chain attestation link (step 9 depending on steps 4 and 7) and the Arc mainnet deadline. Build a stubbed attestation path early so step 9 is an integration rather than a discovery. If time compresses, cut the reversal path and the fourth demonstration site before cutting additionality or uncertainty — those two are the thesis.

---

## 10. Demonstration Path

```text
Corporate sponsor opens the globe
        ↓
Filters bounties by ecosystem and biodiversity intactness
        ↓
Selects the dryland parcel — reviews baseline, target, control set
        ↓
Funds the Restoration Deed in USDC
  (Privy: proposal → policy check → quorum approval → disbursement)
        ↓
Arc escrow holds funds against tranched milestones
        ↓
Restorer submits a claim: 42 ha canopy gain
        ↓
Evidence ladder populates — satellite, drone, IoT, ground
        ↓
Auditor queries indexed project history via The Graph,
pays per analysis through the x402-gated verification service
        ↓
Satellite confirms 38.4 ha gain on the parcel — all tiers corroborate
        ↓
Control parcels greened 21.7 ha over the same window
        ↓
Additionality-adjusted gain: 16.7 ha  (95% CI 13.1–20.3)
        ↓
Regrowth passes the ecological-function quality gate
        ↓
Settled at the lower bound: 13.1 ha  →  PARTIAL
        ↓
Arc releases the tranche proportionally (31.2%)
        ↓
Hedera ATS issues Outcome Units carrying the adjusted quantity,
confidence bound, H3 root, and evidence CID
        ↓
12-month persistence tranche scheduled; satellite monitoring continues
        ↓
Sponsor exports the assurance bundle and retires units for its disclosure/impact accounting
```

The video must be **2–4 minutes**, at least **720p**, narrated with clear spoken audio, no music, and weighted toward the working system rather than the concept. The moment to land is the control-set reveal: the claim was honest, the measurement was correct, and the payout was still three times too high until the counterfactual was applied.

---

## 11. Open Questions and Risks

| Item | Assessment |
|---|---|
| **Arc mainnet by Sept 30** | Hard external deadline for the largest single Arc track. Treat as a schedule constraint from day one. |
| **Cross-chain attestation** | Highest integration risk. Stub early. No value crosses chains — only a commitment hash — which limits the blast radius. |
| **Control-set matching quality** | The scientific weak point. Poorly matched controls produce a confidently wrong additionality estimate. Require a pre-treatment parallel-trend diagnostic and publish the matching criteria; if the diagnostic fails, return insufficient evidence rather than forcing a settlement. Show the matched parcels in the UI so the assumption is inspectable rather than hidden. |
| **Drone and IoT data for demo sites** | Real Tier 1/2 data will not exist for all four sites. Simulate Tiers 1–2 from realistic parameters and label the simulation explicitly. Tier 0 must be genuinely real — the satellite layer is the core scientific claim, and faking it would undermine the entire submission. |
| **Metric standardisation** | "Canopy cover gain" is not a biodiversity metric. It is a defensible proxy for the prototype; the metric registry is versioned so better metrics can be added without changing the contracts. State this limitation plainly rather than overclaiming. |
| **Latency to settlement** | Sentinel revisit plus processing means verification is measured in days to weeks, not blocks. The UI must represent pending verification honestly. This is a property of the physical world, not a defect. |
| **Subgraph indexing lag** | Eventual consistency after transaction confirmation. Poll `_meta` and render optimistically so the live demo does not appear broken. |
| **Privy slot decision** | Deferred to end of build sequence (§5.2). |

---

## 12. Datasets

| Dataset | Use | Source |
|---|---|---|
| Sentinel-2 L2A | Optical indices, 10 m | Copernicus / AWS Open Data (STAC) |
| Sentinel-1 GRD + SLC / derived coherence | SAR backscatter, coherence | Copernicus Data Space / AWS Open Data (STAC where available) |
| Landsat 5/7/8/9 | Long baseline, 1984– | USGS / AWS Open Data |
| GEDI / ICESat-2 | Canopy height, structure | NASA |
| ESA WorldCover | Land cover transitions | ESA |
| Dynamic World | Near-real-time land cover | Google / WRI |
| **Biodiversity Intactness 100 m v1.1 (2017–2025)** | Ecological value prior for parcel scoring | <https://source.coop/vizzuality/biodiversity-intactness-100m-v1-1> |
| SRTM / Copernicus DEM | Terrain covariates for control matching | ESA / NASA |
| WorldClim / ERA5 | Climate covariates for control matching | WorldClim / ECMWF |

---

## 13. Summary

The target is not feature count. It is a technically credible, publicly developed system in which **rigorous remote sensing, explicit uncertainty, measured additionality, programmable settlement, and tokenized restoration outcomes form one working loop** — where the number a satellite produces is the number that releases the money, and where the buyer can re-derive that number themselves.
