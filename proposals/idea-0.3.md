# Ecorestore Network — Idea 0.3

**Canonical product baseline. Supersedes Idea 0.2.**

**ETHOnline 2026 submission and portfolio piece.**

**Date:** 2026-09-10

---

## 0. Status and provenance

Idea 0.3 is the reconciliation of four divergent statements of this project into one approach.

| Source | Role in this document |
|---|---|
| `proposals/idea-0.2.md` (= root `ecorestore_network_proposal.md`) | Baseline thesis, market positioning, sponsor reasoning, financial instruments |
| `ideation/ecorestore_network_proposal_v2.md` | Authority model, milestone discipline, synthetic-data honesty, `INSUFFICIENT_EVIDENCE` gate |
| `proposal_review.md` (2026-09-09) | Incentive critique, scientific corrections, Guardian/ATS analysis, landscape research |
| `docs/*.md` (M0) | Component boundaries, retained and amended where they conflicted |

Every accept / reject / defer decision is recorded in §13. Nothing in this document
fabricates implementation history: as of 2026-09-10 the repository contains M0
documentation, empty source stubs, and an unmodified Vite template. No verification
code, no contract logic, and no integration exists yet.

**Schedule reality.** The Arc mainnet-readiness deadline is **September 30, 2026**.
That is **20 days** from today. §9 is ordered against that constraint, not against
technical preference.

---

## 1. One-page summary

**What it is.** Capital for ecological restoration is released against spatially
verified, uncertainty-bounded, additionality-adjusted evidence of ecological change.
The verified outcome becomes an auditable asset a corporate buyer can hold, audit,
and retire.

**The loop.** Evidence → deterministic verification → methodology workflow →
programmable settlement → verified restoration outcome → indexed history.

**What is actually novel.** Three things, in order:

1. **Difference-in-differences additionality inside the settlement rule.** Not in a
   methodology PDF — in the code path that moves money. The landscape research in
   `proposal_review.md` Part 5 confirms nobody occupies this: Regen has the registry,
   Open Forest Protocol the MRV, Silvi and Solid World the forward finance, Renoster
   the counterfactual analysis. The join is unoccupied.
2. **Persistence payment made economically viable by near-zero marginal monitoring
   cost.** Conventional MRV cost is what forced the pay-at-planting norm. Continuous
   free satellite observation removes it, which makes long-dated conditional payment
   affordable for the first time.
3. **A pre-registered analysis plan committed on-chain before the outcome is
   observable.** The control set is *drawn by a committed rule*, not chosen at
   verification time. This is what separates an estimator from a negotiation.

**What makes it reach operators who currently cannot access outcome finance.** The
deed holds committed USDC against machine-evaluable release conditions — a better
credit instrument than a small restorer's balance sheet. A mobilisation tranche, an
assignable receivable, and MRV cost paid from escrow convert "outcome finance for
people who already have money" into outcome finance.

**Positioning.** Not a parallel registry. **A dMRV source that a registry or standard
can call.** Verra runs on Hedera Guardian as of 2025; the projects that died in this
space died fighting registries.

**The demonstration.** One site — Kootenay Riparian Restoration, British Columbia.
Real Sentinel-2 and Sentinel-1 for Tier 0 and its control set. Tiers 1–3 simulated
from realistic parameters and labelled as simulated on screen and in the video. The
moment to land: *the claim was honest, the measurement was correct, and the payout was
still far too high until the counterfactual was applied.*

**The value proposition is insurance against restatement, not units per dollar.** A
unit that survives assurance is worth more than three units that get restated.

---

## 2. Positioning and audience

### 2.1 Positioning — reconciled

Idea 0.2 and `ecorestore_network.md` claimed **"no central certifier required."**
That framing is deleted. It is precisely the positioning that got Toucan killed when
Verra banned tokenizing retired credits in May 2023. Every survivor in this space works
*with* registries.

Ecorestore Network is **dMRV infrastructure a registry or standard could adopt.** The
Guardian integration (§4.4) is the concrete surface that makes the claim credible
rather than aspirational.

**Market sizing is cited honestly.** The $7.1B→$8.8B biodiversity-credit CAGR figures
from Polaris and Grand View are dropped — they bundle compliance offsets and mitigation
banking and an informed judge will discount the submission for quoting them. The
honest numbers:

- **UK BNG — £93M across 312 registered gain sites in 2026.** Statutory credits (the
  last-resort backstop) took £426,100 in FY2025–26.
- **EU Roadmap towards Nature Credits**, published July 2025, pilots 2025–27,
  framework targeted around 2027.
- Voluntary biodiversity credit transactions globally: low tens of millions.
- VCM transaction volume fell from ~$2B (2021) to ~$535M (2024).

### 2.2 Primary buyer: corporate sponsors

The purchasing driver is regulatory and assurance pressure, which is what makes
spatially explicit evidence a requirement rather than a nicety:

- **CSRD / ESRS E4** — in-scope EU undertakings face biodiversity and ecosystem
  disclosure requirements including location-specific information for material impacts
  and risks. *Risk, stated plainly: the CSRD scope-and-timing rollback process has been
  narrowing this specific driver. It is a demand signal, not a guarantee.*
- **TNFD** — the LEAP approach is explicitly spatial; *Locate* is step one.
- **SBTN** — science-based targets for nature require baselines and measured change.
- **UK BNG** — statutory 10% uplift with a 30-year maintenance obligation.
- **EU Nature Restoration Regulation** — member-state targets.

The product must serve an approval workflow, an audit trail, a reproducible
verification record, and a data export. It is not a donation application.

**The framing correction.** Rigorous verification issues *fewer units per dollar of
restoration* than lax verification. A budget-constrained buyer comparing a settled
13.1 ha against a certifier-blessed 42 ha at the same price buys the certifier's —
unless assurance and litigation risk are priced. So the comparison presented is never
units-per-dollar; it is **expected write-down**. The UI carries a named
assurance-adjusted view: *"13.1 ha defensible vs. 42 ha at risk."* Restatement is the
thing a sustainability lead is personally exposed to.

### 2.3 Supply side

Restoration operators, conservation NGOs, land trusts, Indigenous-led stewardship
organisations, and landowners who hold the parcel and do the work.

They need transparent milestone definitions, predictable payment, working capital
(§4.5), and a verification system that does not require them to buy a satellite
programme to get paid.

**This is a design constraint, not a sentiment.** An instrument that requires the
restorer to self-finance three years of operations plus their own MRV selects for
well-capitalised operators, easy-to-measure biomes, and large parcels — the segments
where restoration finance already flows. That mechanism reallocates existing
restoration toward better-verified operators rather than increasing the amount of
restoration. §4.5 exists to prevent that outcome.

---

## 3. The spatial pipeline

The pipeline is the primary technical deliverable and the centre of gravity of the
project. The blockchain components are not the product; they are the settlement,
provenance, workflow, and asset layer that makes a rigorous MRV pipeline *financially
load-bearing*.

### 3.1 Design principle: the evidence ladder

Evidence sources are ordered by an explicit tradeoff between spatial resolution,
temporal frequency, cost, and **spoofability**. No single tier is trusted alone;
verification is cross-tier corroboration.

| Tier | Source | Resolution | Revisit | Cost | Spoofability | Role |
|---|---|---|---|---|---|---|
| 0 | Satellite (optical + SAR) | 10–30 m | 5–12 days | ~free | **Low at source** | Arbiter and continuous baseline |
| 1 | Drone / UAS | cm | on demand | ££ | Medium | Site-scale calibration and counts |
| 2 | IoT / in-situ sensors | point | continuous | ££ | **High** | Condition signal between observations |
| 3 | Ground reports | variable | ad hoc | £ | **Highest** | Claims, labels, accountability |

The inversion at the heart of the design: **the tier that measures best is not the
tier that lies least.**

Therefore satellite is the **arbiter, not the sole measurer** — its raw acquisition is
independently sourced, though derived products remain subject to processing and model
error. Ground reports are **claims, not evidence**, until corroborated. Divergence
between tiers is treated as signal, never averaged away.

### 3.2 Tier 0 — satellite base layer (REAL)

**Decision (2026-09-10): Tier 0 is real, not synthetic.** This amends the
all-synthetic rule in `CLAUDE.md` and `docs/ARCHITECTURE.md §4`. The satellite layer
is the core scientific claim of the submission; fabricating it would undermine
everything built on top. Tiers 1–3 remain simulated and labelled.

**Optical — Sentinel-2 L2A** (10 m, 5-day revisit, free)
NDVI, EVI2, NDWI/MNDWI, NBR/dNBR, NDMI, SAVI, with rigorous cloud, shadow and cirrus
masking.

**SAR — Sentinel-1 GRD (+ SLC where required)** (10 m, C-band, free)
GRD provides VV/VH backscatter and the VH/VV ratio as a canopy-structure proxy.

Three corrections carried from `proposal_review.md` Part 3:

- **Interferometric coherence requires phase-bearing SLC data**, not GRD alone.
- **C-band decorrelates severely over dense vegetation at 6–12 day baselines.** The
  reversal detector is built primarily on **backscatter change plus dNBR**, with
  coherence as corroboration only where acquisition geometry and temporal baseline make
  it interpretable.
- **The Sentinel-1 archive has a temporal-baseline discontinuity.** S1B failed in 2021
  and the constellation was single-satellite for a period before S1C. Any coherence or
  backscatter series spanning that window has a revisit-interval break. Verify the
  current constellation state at implementation time and record the discontinuity in
  the processing graph.

**Long baseline — Landsat 5/7/8/9** (30 m, 1984–) establishes the pre-disturbance
reference state.

**Structure — ICESat-2, not GEDI.** GEDI flies on the ISS at 51.6° inclination, so
coverage stops near ±51.6°. The Kootenay site at ~49.5°N sits inside that envelope but
near its edge, where track density is lowest and footprint intersection with any given
parcel is unreliable. **ICESat-2 (near-polar, ~±88°) is the structure source**, and the
latitude limit is stated explicitly wherever GEDI is mentioned.

### 3.3–3.5 Tiers 1–3 (SIMULATED, LABELLED)

The intended production system uses drone orthomosaics and crown detection (Tier 1),
soil moisture / water table / acoustic monitoring (Tier 2), and geotagged photography,
plot surveys and planting records (Tier 3).

For the ETHOnline prototype these are **simulated from realistic parameters and
labelled as simulated in the application, in the documentation, and in the video**.
They are never represented as actual field measurements.

### 3.6 Fusion and adjudication

1. **Normalize** inputs to a common spatial and temporal frame.
2. **Score corroboration per tier.**
3. **Weight** evidence by reliability and metric suitability.
4. **Test for disagreement** — divergence is surfaced, not smoothed.
5. **Estimate leakage** (§3.7.2).
6. **Adjust for additionality** (§3.7).
7. **Propagate uncertainty** (§3.8).
8. **Emit a structured deterministic verdict** consumed by deterministic settlement
   rules.

The auditor agent is not trusted with custody or unilateral authority to move funds.
Numerical settlement quantities are produced by the versioned verification pipeline and
enforced against deed terms by the contract.

### 3.7 Counterfactual and additionality

Raw greening is not restoration. A wet year can green an entire region, and a project
that measures only its own parcel sells regional change as project performance.

The pipeline constructs a **matched control set** for every funded parcel: nearby
unfunded parcels matched on land cover class, elevation, slope, aspect, soil, climate
zone, and — critically — **pre-treatment index trajectory**. Matching on the
pre-treatment trend is what distinguishes a genuine control from a merely adjacent one.

The control set must pass a **pre-treatment parallel-trend diagnostic**. Matching on
covariates alone is not sufficient. **If the diagnostic fails the system returns
`INSUFFICIENT_EVIDENCE` and does not force a settlement.** This is a hard gate.

Verified change is the **difference-in-differences** estimate: the parcel's change
minus the control set's change over the same window, using the same sensors and the
same processing chain. Shared systematic error is *reduced* when both sides use the
same scenes and processing; it does not automatically cancel.

**Vocabulary is split, permanently.** Idea 0.2 used "additionality" for two different
things and conflating them is the criticism levelled hardest at credit markets:

- **Biophysical additionality** — the DiD adjustment. *This is what the pipeline
  measures.*
- **Financial additionality** — would this have happened without the payment?
  *This is not measurable from imagery.* It is addressed procedurally by the
  encumbrance registry (§4.6), which is the only honest answer available.

This distinction matters most where Idea 0.2 was weakest: restoration performed to
discharge a statutory obligation (BNG uplift, an NRR designation, a s.106 condition)
shows beautiful *biophysical* additionality against unfunded controls and is, as
finance, entirely non-additional. Idea 0.2 cited those regulations as demand drivers
while walking straight into the criticism.

#### 3.7.1 Pre-registration — ADOPTED

Nothing in Idea 0.2 fixed *when* the analysis choices were made. As written, the
control set was selected and the analysis run at verification time, by a service the
restorer pays per request (§4.7). That is a researcher-degrees-of-freedom problem with
money attached: run the verification against several candidate control sets, several
observation windows, several index choices, and submit the favourable one. Every number
in the verdict stays honest; the estimator is still biased.

**The analysis plan hash is committed at `createDeed()`, before any outcome is
observable.** The committed plan contains:

```text
metric_id + version
observation windows              fixed dates, not "a 6-month window"
control selection RULE           covariates, calipers, k, exclusion buffer
                                 — the rule, never the selected parcels
index and masking chain version
confidence level
parallel-trend diagnostic + its pass criterion
leakage ring geometry            near-ring and far-ring radii
```

At verification the control set is **drawn deterministically by the committed rule**,
not chosen. Re-runs are permitted, but **every run is recorded on-chain and the verdict
cites its run index.** A parcel with eleven verification runs and one submitted result
is visible to anyone reading the Subgraph.

Run count is also a genuine input to the Auditor's project-history reasoning (§6).

#### 3.7.2 Leakage — ADOPTED, promoted to a pipeline step

Excluding grazing, fuelwood collection or cultivation from a funded parcel frequently
displaces that pressure to adjacent land. Because the control set is drawn from
**nearby** parcels, displaced pressure degrades the controls at the same time the
parcel improves — and the difference-in-differences **overstates** additionality on both
sides simultaneously.

This is the one place the Idea 0.2 design was not conservative, in a design whose
entire selling point is conservatism. A subordinate clause about "excluding parcels
with plausible spillover" is not enough weight for an anti-conservative bias.

**Two control rings:**

- **Near ring** — leakage-exposed, matched, immediately adjacent.
- **Far ring** — matched and buffered beyond plausible displacement distance.

**The DiD estimate uses the far ring.** The **divergence between rings is a direct
leakage estimate**, reported explicitly in the verdict JSON and deducted, rather than
assumed away by the buffer.

Both ring geometries are part of the pre-registered plan (§3.7.1).

### 3.8 Uncertainty and conservative settlement

Every measurement carries error. The pipeline propagates modelled uncertainty and
reports an interval, never a bare number.

**Error sources, correctly ordered.** Idea 0.2 listed atmospheric residuals, BRDF,
mixed pixels and co-registration first. In a DiD estimate those are second-order. The
dominant terms are:

1. **Control-matching error**
2. **Index → physical-quantity model transfer error**
3. Leakage estimation error (§3.7.2)
4. Mixed pixels at parcel boundaries
5. Residual cloud and cloud-shadow contamination
6. Atmospheric correction residuals, BRDF and view-angle effects
7. Co-registration error

**The financial rule: settlement pays against the lower bound of the declared
uncertainty interval, not the point estimate.**

Three consequences: noisy evidence pays less, so there is a standing incentive to fund
better measurement; the rule is deliberately conservative and avoids paying against an
optimistic point estimate when uncertainty is material; and the confidence level is a
deed parameter negotiated up front, with the interval method versioned and calibrated
per metric.

#### 3.8.1 Empirical interval coverage — ADOPTED

Analytically propagated intervals are routinely mis-calibrated, and the entire financial
argument rests on the bound meaning what it says. The pipeline therefore reports an
**empirical coverage figure alongside the nominal one**: on held-out ground-truth plots,
does the nominal 95% interval contain truth approximately 95% of the time?

This is cheap and it is the single most credible thing the project can show an
ecology-literate reviewer.

#### 3.8.2 Conservatism and pricing are separated — ADOPTED

Idea 0.2 placed 100% of measurement uncertainty on the restorer. The stated benefit —
restorers are incentivised to fund better measurement — holds only for the
**controllable** fraction. Most of the interval is not controllable:

- **Biome.** Cloud frequency, canopy density, phenological noise and index saturation
  are properties of where the ecosystem is.
- **Parcel size.** Mixed-pixel boundary error scales with perimeter-to-area, so small
  parcels have structurally wider relative intervals.
- **Ecosystem type.** Peatland and dryland — the two biomes where restoration need is
  highest and measurement is hardest — are penalised hardest.

Net effect, uncorrected: the mechanism pays best for large, uniform, temperate,
dense-canopy plantings. That is the easiest thing to measure and the thing most likely
to be a monoculture — the opposite of the NbS priority ordering.

**The fix, and it is one deed parameter.** Price per unit is set against the
**ex-ante expected interval width for that biome / parcel-size class** — a difficulty
premium. The restorer then bears only the *deviation from expectation*, which is the
controllable part, and the incentive to improve measurement survives intact.

The equilibrium is stated honestly rather than gestured at: if price does not adjust for
expected uncertainty, buyers bid for easily-measured projects and the clearing price for
hard-to-measure biomes collapses. The lower-bound rule as written in Idea 0.2 was
partly self-cancelling.

### 3.9 Data representation and reproducibility

| Concern | Choice |
|---|---|
| Catalogue | STAC |
| Raster storage | Cloud-Optimized GeoTIFF |
| Vector storage | GeoParquet |
| Datacube | Zarr / xarray |
| Spatial index | H3 (index and join key only — see §3.10) |
| Serving | OGC APIs / dynamic tiling |
| Provenance | hashes + content-addressed evidence |

**Reproducibility is the defensibility claim, not the ledger.** Every verdict names
its STAC scene IDs and its versioned processing graph, so a third party can re-derive
the number independently. The blockchain records *that* a number was produced and
binds money to it; the science is defensible because it can be re-run.

### 3.10 Spatial identity — SIMPLIFIED

Idea 0.2 asked H3 to do two jobs, and it is only good at one.

**H3 is the index and join key.** A canonical resolution and deterministic cell-set
encoding give each parcel a compact, reproducible identity; the Merkle root of the cell
set is committed on-chain. H3 joins evidence across tiers and indexes the datacube.
That is what it is for.

**Polygon geometry carries quantities and the non-overlap test.** Two corrections from
`proposal_review.md` Part 3 force this, and resolving both makes the design *simpler*
than Idea 0.2:

- **H3 cells are not equal-area.** Cell area varies within a resolution through
  icosahedral distortion, plus 12 pentagons. **Hectares are never derived from cell
  counts** — the verdict JSON reports hectares, so this would have been a live error.
- **H3 non-overlap does not prove parcel non-overlap.** Two adjacent parcels can
  legitimately share a boundary cell, and centroid-in versus full-cover containment
  materially changes both area and the intersection test. Run on cell sets, the
  double-counting check produces a false positive on every adjacent pair.

**Double-counting prevention is therefore a polygon set-intersection check at issuance
time**, against real geometry, with an explicit boundary tolerance.

**Location Protocol compatibility — adopted as a shape, not a dependency.** Parcel
records use the Astral **Location Protocol** attestation shape (signed spatial records
over the Ethereum Attestation Service, GeoJSON as the documented format) so
interoperability is structural rather than promised. **The Astral Location Services
oracle is not taken as a dependency**: it is explicitly a research preview at MVP
v0.1.0 with a trust model described as a centralized service with a known signer running
in a TEE, on a chain not otherwise in use here. "Compatible with the Location Protocol"
is a cheap credible sentence; a research-preview TEE oracle on the critical path is
live-demo risk.

*Related: Idea 0.2 §5.3 declined Chainlink CRE Confidential Workflows while conceding
that TEE processing of sensitive site coordinates is a real use case. Astral is already
shipping that pattern. The instinct was right and there is now convergent evidence for
it.*

The on-chain parcel record:

```text
h3_cell_root        identity / join key
geometry_hash       commitment to the off-chain polygon
baseline_ref
metric_id + version
analysis_plan_hash  §3.7.1
tenure_attestation  §4.5
encumbrances        §4.6
evidence_cid
```

### 3.11 Demonstration project

**Kootenay Riparian Restoration — British Columbia, Canada.**

One site. `CLAUDE.md` fixes British Columbia and that decision stands.

**This resolves the review's sharpest metric objection at no cost.** The Idea 0.2
flagship was Sahel drylands with `canopy_cover_gain_ha`, which is close to the worst
available metric for drylands: the ecologically correct interventions there are largely
*not* planting — assisted natural regeneration, FMNR, grazing exclosure, water
harvesting — and a canopy-gain metric underprices all of them while actively rewarding
afforestation of native grassland and savanna. In temperate riparian restoration,
woody cover gain is a defensible proxy.

**The general principle is retained regardless of site: metric choice is an incentive
design decision, not a measurement decision.** Money released against canopy cover
makes the profit-maximising strategy fast, dense, uniform canopy. A post-hoc pass/fail
quality *detector* gets gamed.

**Ecological conditions are therefore gates on issuance, not scores in a verdict:**

- native / functional species fraction (Tier 1 and Tier 3);
- **no net loss of existing habitat inside the parcel over the window** — Tier 0 alone
  can verify that intact scrub was not cleared in order to plant;
- biome-specific condition floors.

> **OPEN — requires approval before M1.** The exact settled metric for the Kootenay
> site. Recommendation: `riparian_woody_cover_gain_ha` with the issuance gates above.
> Per `CLAUDE.md`, metric selection is ecological verification methodology and is not
> Claude's to settle.

**Synthetic and simulated data rules are absolute.** The application must visibly
state, wherever simulated evidence appears:

> SIMULATED DEMONSTRATION DATA — NOT REAL FIELD, SENSOR OR REGULATORY MEASUREMENT.

Tier 0 is real and is labelled as real, with its scene IDs shown. Tiers 1–3 are
simulated and labelled as simulated. Never imply simulated values are observations,
never describe the demonstration as regulatory certification, never call the outcome a
regulatory biodiversity credit.

---

## 4. Financial instruments

The spatial pipeline produces bounded, additionality-adjusted, provenance-carrying
measurements. The financial layer converts those into programmable restoration funding.

**The invariant, stated once and enforced everywhere:** the contract, not the AI agent,
is the authority that enforces deed terms and releases funds. An authorized verifier can
submit evidence and a versioned verdict; it cannot bypass contract policy or custody the
sponsor's funds.

### 4.1 Restoration Deed — programmable escrow (Arc, USDC)

A funder locks USDC against a specific parcel, a specific metric, a methodology
version, a **committed analysis plan**, and a schedule of milestones.

```text
createProject()      parcel: h3 root, geometry hash, baseline ref, metric,
                     tenure attestation (§4.5), encumbrances (§4.6)
createDeed()         terms: milestones, thresholds, confidence level, schedule,
                     analysis_plan_hash (§3.7.1), benefit_share (§4.5)
fundDeed()           corporate sponsor deposits USDC into escrow
drawMobilisation()   cost-recovery advance against verified effort (§4.5)
submitEvidence()     restorer commits an evidence bundle CID
verifyMilestone()    authorized verifier submits the versioned verdict on-chain,
                     citing its run index (§3.7.1)
releaseTranche()     conditional release against the verified lower bound
assignTranche()      pledge a future tranche to a third-party lender (§4.5)
withholdRetention()  persistence window fails -> retention is not released
```

### 4.2 Persistence payments

Restoration money is conventionally paid at planting and nobody checks in year three.
This is the failure mode programmable money removes, and it is the strongest argument
the project makes. **It should lead the pitch.** The economic insight is not "we use a
blockchain" — it is that continuous free satellite observation drives the marginal cost
of re-verification to approximately zero, and conventional MRV cost is the only reason
the pay-at-planting norm exists.

- **Establishment tranche** — released on verified intervention (Tiers 1 and 3
  dominant).
- **Persistence tranches at 12 / 24 / 36 months** — released only if the satellite
  record shows the gain has *held*, evaluated automatically against the same
  pre-registered controls.

**Reversal handling.** If dNBR indicates fire, or backscatter change indicates
clearing, inside the commitment window, retention does not release and previously issued
outcome units are lifecycle-marked as reversed. The asset carries its own bad news.

*Stated plainly rather than assumed: reversal marking is **not** a native primitive in
either Guardian or ATS. It is the one lifecycle operation being built from scratch here,
and Idea 0.2 read as though it came free.*

#### 4.2.1 Monitoring decoupled from payment — ADOPTED

Idea 0.2's tranches stopped at 36 months while §2 sold against BNG's 30-year
maintenance obligation. The 27-year gap is the entire liability the buyer is trying to
discharge, and after the final tranche a detected reversal had no financial consequence
at all.

**Payment ends at 36 months; observation and reversal-flagging continue for the full
obligation term.** The project's own argument defeats the 36-month limit: if marginal
monitoring cost is near zero, there is no reason to stop. This costs almost nothing and
is directly the instrument §2 claims BNG lacks.

#### 4.2.2 Reversal buffer pool — ADOPTED

A fraction of every issuance is withheld into a shared pool covering reversals across
the portfolio. Standard practice in carbon registries — but here the buffer is
**actuarially sized from observed portfolio reversal rates**, because monitoring is
continuous and free, rather than set by negotiated guess.

That converts idiosyncratic reversal risk into pooled risk, which raises the clearing
price and therefore the restorer's revenue. Good economics and good for restoration.

### 4.3 Restoration Outcome Unit

The verified restoration outcome becomes a transferable, auditable asset. **Issuance
occurs only on a verified milestone; there is no forward issuance against projections.**
The unit represents a verified restoration outcome — **not** a claim that it is itself a
regulatory biodiversity credit or carbon credit.

```text
parcel identity      h3 root + geometry hash
vintage              observation window
metric + version     what was measured and how
verified quantity    additionality-adjusted, leakage-deducted, lower confidence bound
confidence level     the bound applied
evidence CID         STAC IDs, processing graph, tier corroboration, run index
control set ref      near ring and far ring
obligation_status    voluntary_additional | obligation_linked | subsidy_overlapping
verification status
```

Retirement records the sponsor's retirement of the unit for internal disclosure and
impact accounting. **Retirement is not, by itself, a regulatory credit or compliance
claim**; any external claim remains subject to the applicable reporting, legal and
assurance framework.

#### 4.3.1 Why ATS — justification rewritten

**Idea 0.2's stated reason was wrong and would not survive a Hedera judge.** It claimed
permissioned transfer to KYC'd counterparties is something "a plain ERC-20 cannot
express" — but **HTS provides exactly that natively via the KYC key**, consensus-
enforced, without ATS. Idea 0.2 also attached its low-fee argument to ATS; that argument
supports native HTS operations, whereas ATS is Solidity on Hedera's EVM behind a diamond
proxy and is meaningfully more expensive per call.

A good justification exists. It is:

- **ERC-1410 partitions make vintages first-class** rather than metadata. A parcel
  issues against multiple observation windows, and transfers and retirements need to
  happen *per vintage* — which is exactly what disclosure accounting requires.
- **ERC-3643 modular compliance evaluates rules per transfer** — jurisdiction, holder
  caps, lockups — rather than as a binary account flag. That is what a corporate legal
  team actually asks for.
- **ERC-1644 controller operations are the closest existing primitive to the reversal
  flag**: a regulator-style forced action on an already-transferred unit. Nobody has
  used ERC-1644 for environmental reversal handling. Framing it that way is novel and
  defensible.

ATS's securities machinery beyond this — Reg D 506(b)/506(c) and Reg S coverage,
dividends, coupons, snapshots — is **irrelevant here and is not claimed**. The
Restoration Outcome Unit is explicitly not a security.

### 4.4 Guardian — issuance authority, and the seam

**Idea 0.2 did not mention Hedera Guardian at all.** Guardian is the incumbent policy
workflow engine on the chosen chain, **Verra partnered with the Hedera Foundation in
2025** to integrate it into their Project Hub and digitize 20+ methodologies, and in
2026 approved first credits under a dMRV pilot. Proposing environmental asset issuance
on Hedera without naming Guardian is a scoring risk.

**Guardian is the issuance authority. ATS is the instrument.** Guardian decides whether
and how much to issue and carries the provenance; ATS is what the buyer holds and
transfers. Arc holds the money and Guardian never touches it.

**The seam.** A completed Guardian policy run produces a **Verifiable Presentation**
bundling the trust chain — project registration, MRV submission, verdict, mint
authorization — each VC DID-signed by its issuer, pinned to IPFS, written to an HCS
topic, hash-addressable.

**ERC-1643 exists precisely to bind off-chain compliance documents to a token. A
Guardian VP is an off-chain compliance document.**

```text
Guardian VP  ─────────────────────────────────►  ATS token

setDocument(
  name         = "guardian-trust-chain-v1"
  uri          = ipfs://bafy...            (the VP)
  documentHash = keccak256(VP)
)

issueByPartition(
  partition    = keccak256(h3_root, window_start, window_end)   // the vintage
  holder       = sponsor
  value        = settled_quantity                              // lower bound
  data         = abi.encode(vp_hash, hcs_topic_id, hcs_seq_no)
)
```

Two standards otherwise doing nothing start doing real work: **partitions become
vintages**, and **documents become the evidence binding** — the standard's intended use,
not a custom metadata field.

**What guarantees the seam is public verifiability, not on-chain enforcement.** HCS
messages are not readable from Hedera's EVM, so no contract can check the VP. Instead
the mint records the VP hash and HCS message ID, and anyone can fetch the HCS message,
fetch the IPFS document, re-hash, and confirm the token corresponds to a real completed
policy run. **This is the same argument §3.9 makes about the spatial pipeline** —
reproducibility as the defensibility mechanism — so the seam is consistent with the
project's philosophy rather than a weaker exception to it.

**Two things fall out of this that improve the design:**

- **Persistence tranches (§4.2) map onto a Guardian `timer` block.** Scheduled
  12/24/36-month re-verification is a native primitive, not custom scheduling
  infrastructure.
- **Multi-chain justification gets stronger.** Idea 0.2 asserted "the bridge is the
  auditor's attestation, not a token bridge." Here the shared artifact is a specific,
  hash-addressable, third-party-verifiable document with an HCS timestamp. Arc and
  Hedera both reference the same VP hash and nothing else crosses. No value bridges.

#### 4.4.1 The VVB tension, resolved

Guardian's trust model is built around **a human VVB approving submissions** — the very
thing this project argues should be computed. Either keep a VVB in the loop and
contradict the thesis, or rubber-stamp the role, which registries would reject.

**The resolution is a better story than Idea 0.2 had, and it belongs in the pitch: the
pipeline does not remove the VVB, it changes what the VVB reviews.** From *"is this
claim form plausible?"* to:

- is the pipeline correctly configured?
- **is the pre-registered analysis plan honoured (§3.7.1)?**
- is the parallel-trend diagnostic passing?

That is a role a registry would accept, and it makes the Guardian integration natural
rather than awkward.

#### 4.4.2 Build plan: design C, build B, make the seam real

Guardian is ~10 microservices plus MongoDB, IPFS, a vault, and a Standard Registry
testnet account — realistically **1–3 days to stand up** and **2–4 days to author a
minimal real policy**. That is 3–7 days of a 20-day budget that also contains the
spatial pipeline, Arc contracts against a mainnet deadline, a Subgraph, the auditor and
a UI. **Guardian is not stood up for the hackathon.**

Four steps, hours rather than days:

1. **Publish the verdict VC schema** as a Guardian-compatible JSON schema file in the
   repo.
2. **Emit the auditor verdict as a signed VC** against that schema. §6 already emits
   structured JSON; wrapping it as a W3C VC with a DID signature is a small addition.
3. **Bind that VC into the ATS token via a real `setDocument()` call** at issuance,
   partition set to the vintage. This is the seam actually working, with the Ecorestore
   verifier occupying the slot Guardian would occupy.
4. **One diagram and one paragraph** showing Guardian dropping into that slot, naming
   the `externalDataBlock` and `timer` mappings.

"We use ATS" is unremarkable. "We plan to integrate Guardian" is a promise. **A working
ERC-1643 binding of a signed verdict VC into a partitioned token, with the Guardian
drop-in point specified,** is a demonstrated architecture with a credible path — and the
ERC-1643 / ERC-1410 / ERC-1644 usage is novel for environmental assets regardless of
whether Guardian is in the loop yet.

### 4.5 Working capital, assignability and benefit-sharing — ADOPTED

**This is the highest-value addition in the reconciliation.** Outcome-based payment
means the restorer fronts everything: land access, stock, labour, three years of
maintenance, plus the drone flights and sensors the design encourages them to buy.
Payment arrives at 12/24/36 months against a lower bound that in the worked example is
31% of the claim. The parties named as the supply side are precisely the parties with
the least access to working capital.

The deed already holds committed USDC with deterministic, machine-evaluable release
conditions. **That is a better credit instrument than the restorer's balance sheet.**

- **Mobilisation tranche (10–20%)** released against verified *effort*, not outcome —
  planting records, Tier 1 orthomosaic, receipts. Idea 0.2's establishment tranche is
  framed ex-post; the first slice is explicitly a **cost-recovery advance** and is
  described as one.
- **Assignable receivable.** `assignTranche(milestoneId, assignee)` lets the restorer
  pledge or assign a future tranche to a third-party lender on-chain. A conditional
  claim on escrowed USDC, where the condition is evaluated by a published pipeline
  against free public imagery, is exactly the kind of cashflow a lender can discount.
  **This is a genuinely novel primitive and it is a few lines of Solidity.** *Prior art
  acknowledged: Silvi is piloting tree-forwards; Solid World runs forward carbon
  liquidity pools with working capital before certification. Neither ties the condition
  to a counterfactual estimator.*
- **MRV cost pass-through.** Tier 1/2 measurement is funded from the escrow at
  verification time, not from the restorer's pocket. Otherwise §3.8's "the restorer is
  incentivised to fund better measurement" holds only for restorers with the cash to act
  on the incentive.

**Tenure attestation and benefit-sharing — ADOPTED.** Idea 0.2 addressed neither land
tenure, nor free prior and informed consent, nor benefit-sharing, while naming
Indigenous-led stewardship organisations as supply-side users. As specified, any party
could register a cell set and sell outcomes over land they have no rights to. That is
the precise mechanism by which carbon projects have generated land conflict and
dispossession, and it is the social-licence risk that ends a real deployment regardless
of how good the remote sensing is.

- **Parcel registration requires a tenure/rights attestation** from an identified
  party, hashed into the parcel record, with the attestation type recorded — freehold,
  lease, customary, co-management agreement.
- **The deed carries a benefit-sharing split**: a fixed fraction of every tranche routes
  to a named steward address at release, **enforced by the contract** rather than
  promised in a side agreement.

Both are trivial on-chain and no existing registry has either as a protocol primitive.

### 4.6 Encumbrance registry — ADOPTED

The H3 / polygon non-overlap check (§3.10) prevents the same **hectare** being sold
twice. It does not prevent the same **outcome** being claimed once as a BNG obligation
discharge and once as a voluntary outcome unit. Spatial double-counting was solved;
claim double-counting was not.

At parcel registration:

```text
legal_obligations[]      BNG unit registration, NRR designation,
                         planning condition, s.106
public_subsidy[]         agri-environment / ELM / CAP payments on the parcel
existing_claims[]        credits issued under other registries, registry + serial
tenure_basis             §4.5
```

The outcome unit carries `obligation_status` — `voluntary_additional`,
`obligation_linked`, or `subsidy_overlapping` — and permissioned transfer (§4.3.1) can
restrict who may buy which.

This is cheap, it composes with the geometry commitment, no existing registry has
encumbrance as a protocol primitive, and it converts "we cite regulation as demand" from
a liability into a feature. **It is also the only honest handle the system has on
financial additionality (§3.7).**

### 4.7 Cohort verification — ADOPTED, scoped to design

A Tier 1 drone sortie is roughly £1–5k and a sensor array £2–10k installed. On a 40 ha
planting at $1–3k/ha, MRV is plausibly 10–30% of project cost; on the 1–10 ha parcels
that dominate BNG and community restoration it is prohibitive. §3.8's "cheap MRV is
self-penalising" therefore cuts hardest against exactly the projects that most need to
participate.

**Cohort verification:** many small parcels aggregate into a cohort sharing one control
set, one drone sortie and one calibration transfer function; verification runs at cohort
level and allocates to parcels. This amortises Tier 1 across parcels and is a natural
extension of pooled deeds.

*Specified in the design; not built for the hackathon (§9).*

### 4.8 Metered verification (x402) — DEMOTED

Idea 0.2 made x402 a core component and a second Hedera track. **It is demoted to
optional and it must never become a prerequisite for the core verification or settlement
flow.**

Two reasons, and the second is the important one:

1. Scope. 20 days.
2. **Metered per-request verification actively creates the p-hacking incentive that
   §3.7.1 exists to close.** If it ships, it ships *with* pre-registration, run-count
   recording, and a note in the docs that the two features are coupled — the
   conflict-of-interest is designed out, not left implicit.

If implemented: the auditor pays per analysis through the verification API, and the
per-run cost is drawn from escrow under §4.5's MRV pass-through, not from the restorer.

### 4.9 Treasury controls and pooled deeds

**Privy** — a corporate sponsor cannot have one person unilaterally moving funds. The
funding path uses policies, key quorums and intents: a sustainability lead proposes a
deed, finance approves under a spend policy, disbursement requires quorum signing, and
the approval trail is part of the audit record. *Built for product reasons; see §5 on
whether it claims a submission slot.*

**Pooled deeds** — individual contributions aggregate into a single deed against one
parcel, sharing the same contracts and verification. Contributors hold a proportional
claim and receive the identical evidence bundle. Thin surface, no separate mechanics, no
gamification.

---

## 5. Sponsor stack

ETHGlobal allows up to **3 partner prizes** at submission, and **a partner with
multiple tracks counts as one slot while remaining eligible for all of its tracks**.
The correct strategy is three partners with deep multi-track fit, not three partners
with one track each. *Verify against the ETHOnline 2026 submission page before
finalising.*

| Partner | Slot | Tracks | Fit after reconciliation |
|---|---|---|---|
| **Hedera** | 1 | Tokenization of Anything; AI & Agentic Payments (x402) | Tokenization is **strengthened** by §4.3.1 and §4.4 — genuine lifecycle plus a real ERC-1643 evidence binding. x402 is **weakened** by §4.8's demotion. |
| **Arc** | 1 | Testnet→Mainnet; DeFi/Onchain Finance; Agentic Economy | **Strengthened.** §4.5's assignable receivable and mobilisation tranche make the DeFi track substantially more interesting than a payment schedule. |
| **The Graph** | 1 | AI Tooling; Composable Graph Products | **Strengthened.** §3.7.1 makes verification run count part of project history, so the Subgraph becomes load-bearing for the Auditor rather than decorative. |
| **Privy** | 0 | (Best B2B Financial Product) | Built for product reasons (§4.9), not claimed. Swap in for The Graph only if the treasury flow becomes the demo centrepiece and the Subgraph ends up shallow. Decide at M6, not now. |

**The honest trade on x402.** Demoting x402 costs addressable prize money on the Hedera
AI & Agentic Payments track. It is demoted anyway because it conflicts with §3.7.1 and
because 20 days does not accommodate it alongside the Arc deadline. If schedule allows
at M6 it is added back **with** pre-registration, not instead of it.

**Declined:** Chainlink CRE (slot scarcity only — strongest post-hackathon candidate,
see §3.10), World, Ledger, ENS, 1inch/Uniswap, Bazantic.

**Selection principle.** Do not add technology to claim a prize. A partner integration
must strengthen the core thesis.

---

## 6. Restoration Auditor

One focused component, not a multi-agent architecture.

**Inputs**

```text
deed terms              metric, thresholds, confidence level, milestone schedule,
                        analysis_plan_hash
claim                   quantity and window asserted by the restorer
evidence bundle         tier 1/2/3 submissions, CIDs, hashes
satellite derivation    tier 0 time series for parcel, near ring and far ring
project history         indexed via The Graph — prior claims, verdicts, payments,
                        reversals, and VERIFICATION RUN COUNT (§3.7.1)
```

Project history is a genuine input, not decoration. A parcel with a prior reversal, a
repeatedly-revised claim, ground reports that consistently overshoot corroborated
measurement, **or eleven verification runs behind one submitted result** is scored
differently from a clean one. This is only queryable because the Subgraph exists.

**Boundary — the critical invariant.** The auditor may use AI for evidence triage,
anomaly explanation and workflow orchestration. **The settlement quantity is not an
LLM-generated number.** The versioned pipeline computes the measurement, leakage
deduction, additionality adjustment, uncertainty interval and release fraction; the
contract enforces the resulting bounds against the deed terms.

The auditor may not invent measurements, alter verification quantities, override quality
gates, approve its own verification, bypass Guardian authorization or Arc contract rules,
or release sponsor funds.

**Output** — the verdict, emitted as structured JSON *and* as a signed W3C VC against
the published Guardian-compatible schema (§4.4.2):

```json
{
  "status": "PARTIAL",
  "run_index": 1,
  "analysis_plan_hash": "0x...",
  "parcel_h3_root": "0x...",
  "geometry_hash": "0x...",
  "window": ["2026-03-01", "2026-09-01"],
  "claimed": { "metric": "riparian_woody_cover_gain_ha", "value": 42.0 },
  "measured": {
    "parcel_change": 38.4,
    "control_change_far_ring": 21.7,
    "control_change_near_ring": 19.4,
    "leakage_estimate": 2.3,
    "additional_biophysical": 14.4,
    "ci_95": [11.2, 17.6],
    "empirical_coverage_95": 0.94
  },
  "parallel_trend": { "status": "PASS", "p": 0.41 },
  "quality_gate": {
    "status": "PASS",
    "gates": ["native_species_fraction", "no_net_habitat_loss", "condition_floor"]
  },
  "obligation_status": "voluntary_additional",
  "settled_quantity": 11.2,
  "settlement_basis": "lower_bound_95",
  "tier_corroboration": {
    "tier_0_satellite": { "score": 0.91, "real": true },
    "tier_1_drone":     { "score": 0.88, "simulated": true },
    "tier_2_iot":       { "score": 0.42, "simulated": true,
                          "note": "node 3 flatlined through recorded rainfall — excluded" },
    "tier_3_ground":    { "score": 0.55, "simulated": true,
                          "note": "claim exceeds corroborated measurement by ~9%" }
  },
  "evidence_cid": "bafy...",
  "stac_scene_ids": ["S2B_...", "S1A_..."],
  "processing_graph_version": "1.0.0",
  "action": "RELEASE_TRANCHE",
  "release_fraction": 0.267
}
```

*Illustrative numbers. Real values come from the pipeline at M1.*

---

## 7. User interface — cut hard

Idea 0.2 specified a seven-view deck.gl globe. **The globe is the demo's surface and
also the biggest time sink for the least thesis value.** Two views done well beat seven
half-done.

**Tier 1 — must ship, in this order:**

1. **Additionality view.** Parcel trajectory plotted against the far-ring control
   envelope, with the near ring shown separately so leakage is visible. The gap between
   the lines *is* the settled quantity, drawn as a shaded region. This is the single most
   important chart in the product.
2. **Assurance export.** One click produces a disclosure-ready bundle: verified
   quantities with confidence bounds, empirical coverage, complete evidence provenance,
   named STAC scene IDs, processing-graph version, control-set definition and ring
   geometry, analysis plan hash and run index, obligation status, on-chain transaction
   references, and the verdict VC. **This is the artifact that makes the product
   buyable.**
3. **The assurance-adjusted comparison** (§2.2) as a named view: *11.2 ha defensible vs.
   42 ha at risk.* One slide's worth of work that fixes the framing across the demo, the
   video and the pitch.

**Tier 2 — if time allows:** parcel detail with real Tier 0 imagery and control
parcels drawn in contrast; evidence ladder with per-tier corroboration and real/simulated
labelling; deed and settlement state; outcome unit lifecycle; history.

**Tier 3 — cut unless everything above is done:** the rotating globe landing view,
`ArcLayer` capital flows, portfolio filtering.

**Design constraints.** Dark, precise, data-dense — Earth-observation operations
consoles and financial terminals, not consumer donation apps. **Every number displayed
carries its uncertainty; no bare point estimates anywhere in the interface.** Real Tier 0
and simulated Tiers 1–3 are visually distinguishable at all times.

---

## 8. Architecture and authority model

```text
                          React UI  (presentation only)
                              │
        ┌─────────────────────┼─────────────────────┐
        │ GraphQL             │                     │ Privy
        ▼                     ▼                     ▼
┌────────────────┐   ┌──────────────────┐   ┌────────────────┐
│ The Graph      │   │ Restoration      │   │ Treasury       │
│ indexed history│◄──┤ Auditor          │   │ approval flow  │
│ (read layer)   │   │ (explain /       │   └────────────────┘
└────────────────┘   │  orchestrate)    │
        ▲            └────────┬─────────┘
        │ events              │ invokes, never overrides
        │                     ▼
        │            ┌──────────────────────────────────────┐
        │            │ Deterministic Verification Engine    │
        │            │ STAC · COG · Zarr · H3 · polygons    │
        │            │ near/far rings · DiD · leakage ·      │
        │            │ uncertainty · quality gates          │
        │            └────────┬─────────────────────────────┘
        │                     │ canonical VerificationResult
        │                     │ + signed verdict VC
        │            ┌────────┴─────────┐
        │            ▼                  ▼
┌───────┴────────────────┐   ┌──────────────────────────────┐
│ ARC — money rail       │   │ HEDERA — asset rail          │
│ RestorationDeed        │   │ ATS: issueByPartition(vintage)│
│ USDC escrow, tranches, │   │      setDocument(verdict VC)  │
│ mobilisation, assign,  │   │      ERC-3643 transfer rules  │
│ benefit share, buffer  │   │      ERC-1644 reversal        │
└────────────────────────┘   │ [Guardian drops in here]      │
                             └──────────────────────────────┘
                                        │
                     IPFS — evidence bundles, VPs, provenance
```

### Authority model — unchanged from M0, and non-negotiable

| Component | Authority |
|---|---|
| Ecorestore Verification Engine | Scientific result |
| Hedera Guardian | Environmental methodology, workflow, credentials, outcome state |
| Arc Restoration Deed | Financial escrow and settlement |
| The Graph | Indexed blockchain history / read layer |
| Restoration Auditor | Orchestration and explanation |
| React application | Presentation |

**Critical invariant: no AI-generated numerical result may directly determine financial
settlement.**

**No component silently becomes the authority for another component's responsibility.**

### Subgraph entities

```text
Parcel          h3 root, geometry hash, baseline ref, ecosystem,
                tenure attestation, encumbrances
Deed            terms, metric, thresholds, confidence level,
                analysis_plan_hash, benefit_share
Contribution    funder, amount, pooled or direct
Milestone       schedule, type (mobilisation / establishment / persistence)
Assignment      tranche pledged to a third-party lender
Evidence        tier, CID, hashes, submitter, real | simulated
VerificationRun run index, plan hash, submitted or not      ← §3.7.1
Verification    verdict, measured, controls, leakage, CI, coverage, tier scores
Payment         tranche release, amount, benefit-share routing, tx
OutcomeUnit     Hedera asset ref, quantity, vintage, partition,
                obligation_status, lifecycle state
Reversal        detected loss, cause, affected units, buffer draw
ControlSet      near ring and far ring parcels used
```

---

## 9. Build sequence — reordered against September 30

**Idea 0.2 put Arc contracts at step 4 of 12, behind a full spatial pipeline, control
matching and a deck.gl globe. That ordering cannot meet the deadline it is written
against.** The Arc Testnet→Mainnet track is two winners at $3,500 and carries a hard
external date. Contracts move to the front and the pipeline builds against a deployed
contract, not the reverse.

Milestones keep the M-numbering established in M0. Every milestone records: objective,
implementation, tests, validation, architectural/scientific/security decisions,
deviations from this baseline, unresolved risks, next steps — in
`docs/DEVELOPMENT_LOG.md`.

| M | Objective | Deadline pressure |
|---|---|---|
| **M0** | Foundation — repository, documentation, interfaces, React scaffold, test framework, contract scaffold. *Partially complete; see §9.1.* | done |
| **M1** | **Arc contracts first.** RestorationDeed: escrow, milestone state, `analysis_plan_hash` at `createDeed()`, authorized verification with replay protection, lower-bound settlement bounded by contract state, mobilisation draw, `assignTranche()`, benefit-share routing, retention withholding. Deploy to Arc Testnet, track mainnet readiness from day one. Full contract test suite. | **Sept 30** |
| **M2** | **Deterministic verification engine.** Real Sentinel-2/1 ingest for the Kootenay parcel; STAC search, cloud masking, index computation, H3 indexing, polygon geometry; near-ring and far-ring control selection drawn by the committed rule; parallel-trend diagnostic; DiD; leakage; uncertainty with empirical coverage; quality gates; canonical `VerificationResult`. Simulated Tiers 1–3, labelled. Tests for every failure mode, including `INSUFFICIENT_EVIDENCE`. | high |
| **M3** | **Vertical slice.** Verification → verdict VC → Arc settlement, end to end, one milestone. This is the thesis working. | high |
| **M4** | **Hedera ATS + the seam.** `issueByPartition` with vintage partitions, `setDocument()` binding the signed verdict VC, ERC-3643 transfer rules, ERC-1644 reversal path. Publish the Guardian-compatible VC schema. Verify contracts on HashScan. | medium |
| **M5** | **Subgraph + Auditor.** Full entity set including `VerificationRun`; live queries; Auditor consuming project history as a genuine input. | medium |
| **M6** | **UI.** Additionality view, assurance export, assurance-adjusted comparison — in that order. Tier 2 views only if these are done. Privy slot decision made here. Optional x402 **with** pre-registration coupling. | medium |
| **M7** | **Hardening and submission.** Deterministic test pass, authorization and replay tests, evidence hash verification, real/simulated labelling audit, error states, demo reliability, documentation, 2–4 minute video at ≥720p with narrated audio. | hard |

**Explicitly out of scope for the hackathon**, specified but not built: Guardian stood
up (§4.4.2), cohort verification (§4.7), the reversal buffer pool's actuarial sizing
(§4.2.2 — the withholding mechanism ships, the actuarial model does not), and the
rotating globe.

**Cut order if time compresses.** Cut the globe, then Tier 2 UI views, then x402, then
ATS lifecycle depth, then the Subgraph. **Never cut additionality, leakage,
uncertainty, pre-registration, or the `INSUFFICIENT_EVIDENCE` path.** Those are the
thesis. Do not cut the scientific core to add cosmetic features.

### 9.1 M0 — actual state, recorded honestly

As committed in `45b81dc`, M0 delivered `CLAUDE.md`, `docs/*.md`, and directory
structure. It did **not** deliver working interfaces: `verification/{engine,models,fixtures}.ts`,
`auditor/agent.ts`, `guardian/adapter.ts` and `contracts/RestorationDeed.sol` are empty
files, `app/src/App.tsx` is the unmodified Vite counter template, and
`docs/DEVELOPMENT_LOG.md` is empty despite `CLAUDE.md` requiring a record per milestone.

**M0 is therefore not complete.** Closing it requires the TypeScript interface
definitions those stubs are supposed to hold, a running test framework, and a
development log entry. That work is carried into M1 rather than backdated.

---

## 10. Demonstration path

```text
Corporate sponsor opens the Kootenay project
        ↓
Reviews parcel, tenure attestation, encumbrance declaration,
and the committed analysis plan
        ↓
Funds the Restoration Deed in USDC
  (Privy: proposal → policy check → quorum approval → disbursement)
        ↓
Mobilisation tranche draws against verified effort — the restorer is paid to start
        ↓
Restorer submits a claim: 42 ha woody cover gain
        ↓
Evidence ladder populates — Tier 0 REAL, Tiers 1–3 SIMULATED and labelled
        ↓
Auditor queries indexed project history via The Graph
        ↓
Control set is DRAWN by the pre-registered rule — not chosen
        ↓
Parallel-trend diagnostic passes
        ↓
Satellite measures 38.4 ha gain on the parcel
        ↓
Far-ring controls greened 21.7 ha over the same window
        ↓
Near/far ring divergence gives a 2.3 ha leakage deduction
        ↓
Biophysical additionality: 14.4 ha  (95% CI 11.2–17.6, empirical coverage 0.94)
        ↓
Issuance gates pass: native species fraction, no net habitat loss, condition floor
        ↓
Settled at the lower bound: 11.2 ha  →  PARTIAL
        ↓
Arc releases the tranche proportionally; benefit share routes to the steward address
        ↓
Verdict signed as a VC; ATS issues into the vintage partition with setDocument(VC)
        ↓
12-month persistence tranche scheduled; monitoring commitment runs past it
        ↓
Sponsor exports the assurance bundle:
"11.2 ha defensible vs. 42 ha at risk"
```

**A second case demonstrates the trust property that matters most:** parallel-trend
failure → `INSUFFICIENT_EVIDENCE` → no settlement. A system that refuses to pay is more
credible than one that always finds a number.

**The moment to land in the video:** the claim was honest, the measurement was correct,
and the payout was still far too high until the counterfactual was applied. Everything
that does not serve the counterfactual reveal is cuttable.

---

## 11. Open questions and risks

| Item | Assessment |
|---|---|
| **Arc mainnet by Sept 30** | 20 days. Hard external deadline. M1 is contracts for this reason. |
| **M0 is not actually complete** | §9.1. Interfaces, tests and the development log carry into M1. |
| **Real Tier 0 acquisition** | New risk created by this reconciliation. Sentinel-2/1 ingest for one BC parcel is tractable, but cloud cover in coastal BC is real and scene availability must be checked before M2 starts. Mitigation: pick the parcel and window from actual archive availability, not the reverse. |
| **Control-set matching quality** | The scientific weak point. Poorly matched controls produce a confidently wrong estimate. Mitigations: pre-registered selection rule, mandatory parallel-trend diagnostic, matched parcels rendered in the UI so the assumption is inspectable, and `INSUFFICIENT_EVIDENCE` rather than a forced settlement. |
| **Interval calibration** | The whole financial argument rests on the bound meaning what it says. §3.8.1's empirical coverage check is the defence; if coverage is materially below nominal, the settlement rule is not yet sound and that must be reported, not hidden. |
| **Financial additionality** | Not measurable from imagery. §4.6 is a procedural handle, not a solution. State the limitation plainly. |
| **Metric standardisation** | Woody cover gain is a proxy, not a biodiversity metric. The registry is versioned so better metrics can be added without changing contracts. **Metric choice remains OPEN pending approval (§3.11).** |
| **Guardian not stood up** | Deliberate (§4.4.2). The risk is a Hedera judge reading the drop-in point as vapour. Mitigation: the ERC-1643 seam must actually work, with a real `setDocument()` call in the demo. |
| **Reversal is built, not inherited** | Neither Guardian nor ATS has a reversal primitive. ERC-1644 is the closest fit and it is being used in a novel way. Budget for it. |
| **Demand-side assumption** | Load-bearing. Regulation pricing assurance is the commercial foundation, and the CSRD scope-and-timing rollback narrows it. Flagged as a risk, not treated as given. Mitigation is §2.2's restatement-risk framing. |
| **Latency to settlement** | Sentinel revisit plus processing means verification is days to weeks, not blocks. The UI represents pending verification honestly. This is a property of the physical world, not a defect. |
| **Subgraph indexing lag** | Eventual consistency after confirmation. Poll `_meta`, render optimistically, do not pretend it is instant. |
| **Cross-chain link** | Arc and Hedera share only a hash. No value crosses. Stub the attestation path early so M4 is integration, not discovery. |
| **x402 conflict of interest** | If x402 ships, per-request metering creates the incentive §3.7.1 closes. The two features ship together or x402 does not ship. |
| **Peatland inverts the trust model** | Not a risk for the Kootenay site, recorded because it blocks the obvious next site: for peatland rewetting the outcome variable is water table, measured by Tier 2 — the most spoofable tier — and greenness can move the wrong way after successful rewetting. Any peatland extension needs InSAR peat surface motion and SAR-derived surface wetness as the satellite-side arbiter. |

---

## 12. Datasets

| Dataset | Use | Source | Status |
|---|---|---|---|
| Sentinel-2 L2A | Optical indices, 10 m | Copernicus / AWS Open Data (STAC) | **REAL** |
| Sentinel-1 GRD (+SLC) | SAR backscatter; coherence only where interpretable | Copernicus Data Space / AWS Open Data | **REAL** |
| Landsat 5/7/8/9 | Long baseline, 1984– | USGS / AWS Open Data | **REAL** |
| ICESat-2 | Canopy structure (GEDI unusable at this latitude, §3.2) | NASA | **REAL** |
| ESA WorldCover | Land cover transitions | ESA | **REAL** |
| Dynamic World | Near-real-time land cover context | Google / WRI | **REAL** |
| SRTM / Copernicus DEM | Terrain covariates for control matching | ESA / NASA | **REAL** |
| WorldClim / ERA5 | Climate covariates for control matching | WorldClim / ECMWF | **REAL** |
| Biodiversity Intactness 100 m v1.1 | Ecological value prior for parcel scoring | source.coop / vizzuality | **REAL** |
| Drone orthomosaic, crown detections | Tier 1 calibration | — | **SIMULATED, LABELLED** |
| Soil moisture, water table, acoustic | Tier 2 condition signal | — | **SIMULATED, LABELLED** |
| Plot surveys, planting records, geotagged photos | Tier 3 claims | — | **SIMULATED, LABELLED** |

---

## 13. Decision log

Every point on which the source documents disagreed, and how it was settled.

### 13.1 Structural conflicts

| # | Conflict | Resolution |
|---|---|---|
| S1 | `proposals/idea-0.2.md` committed empty while `CLAUDE.md` declares it the canonical baseline | Populated from root `ecorestore_network_proposal.md` with a historical banner. `CLAUDE.md` now points at this document. |
| S2 | Four competing statements of the project | Idea 0.3 is canonical. Idea 0.2 and both `ideation/` copies are historical. |
| S3 | `docs/*.md` described the v2 approach, which is now partly superseded | Amended in place where they conflict; see 13.5. |
| S4 | `docs/DEVELOPMENT_LOG.md` empty despite `CLAUDE.md` requiring a record per milestone | M0 state recorded honestly in §9.1 and in the log. Not backdated. |
| S5 | Root proposal and `ideation/ecorestore_network_proposal.md` differ (Shantanu's `73e4be7` tightening edits) | Tightened wording carried into Idea 0.3; the stale ideation copy is superseded. |

### 13.2 Accepted from Idea 0.2 (against v2, which had deleted it)

- Market positioning, target-audience specificity, and the regulatory demand analysis.
- Sponsor stack reasoning and the multi-track slot strategy (§5).
- Persistence-tranche economics as the lead argument (§4.2).
- The assurance export as the B2B deliverable (§7).
- Reproducibility — named scene IDs plus a versioned processing graph — as the
  defensibility claim rather than the ledger (§3.9).
- Real Tier 0 data.
- Concrete dataset and index specificity (§3.2, §12).

### 13.3 Accepted from v2 / M0 (against Idea 0.2)

- **The authority model**, verbatim. It is the strongest thing M0 produced.
- The explicit `INSUFFICIENT_EVIDENCE` return on parallel-trend failure as a hard gate.
- Milestone discipline (M-numbering, per-milestone records).
- Guardian named as the methodology and workflow layer — Idea 0.2 omitted it entirely.
- One site rather than four.
- British Columbia rather than the Sahel, which independently resolves the metric
  objection (§3.11).
- Rigorous synthetic/simulated data labelling rules.
- "Do not add technology merely to claim a prize."

### 13.4 Accepted from `proposal_review.md`

**Incentive design — all four top items adopted, per approval on 2026-09-10:**

| Review item | Where |
|---|---|
| 2.1 Working capital, assignable receivable, MRV pass-through | §4.5 |
| 2.2 Pre-registration of the analysis plan | §3.7.1 |
| 2.4 Encumbrance registry and `obligation_status` | §4.6 |
| 2.8 Tenure attestation and benefit-sharing split | §4.5 |
| 2.3 Conservatism separated from pricing | §3.8.2 |
| 2.5 Ecological conditions as issuance gates, not post-hoc scores | §3.11 |
| 2.6 Leakage as a first-class term with two control rings | §3.7.2 |
| 2.7 Monitoring decoupled from payment; reversal buffer pool | §4.2.1–4.2.2 |
| 2.9 Restatement-risk framing replacing units-per-dollar | §2.2 |
| 2.10 Cohort verification | §4.7, design only |

**Scientific corrections — all nine adopted:**

| Part 3 item | Where |
|---|---|
| 1. GEDI latitude limit → ICESat-2 | §3.2 |
| 2. Peatland inverts the trust model | §11 (site-relevant, recorded) |
| 3. C-band coherence decorrelation | §3.2 |
| 4. Sentinel-1 archive discontinuity | §3.2 |
| 5. H3 cells are not equal-area | §3.10 |
| 6. H3 non-overlap ≠ parcel non-overlap | §3.10 |
| 7. Uncertainty sources reordered; control-matching and model-transfer error promoted | §3.8 |
| 8. Empirical interval coverage validation | §3.8.1 |
| 9. Biophysical vs financial additionality split | §3.7 |

**Positioning and stack:**

| Review item | Where |
|---|---|
| 5.4 Drop "no central certifier required"; reposition as dMRV a registry calls | §2.1 |
| 5.4 Drop CAGR market sizing; cite BNG £93M and the EU roadmap | §2.1 |
| 6.2 Rewrite the ATS justification — HTS provides KYC natively | §4.3.1 |
| 6.2 Move the low-fee argument off ATS onto HTS | §4.3.1 |
| 6.2 State that reversal is built, not inherited | §4.2, §11 |
| 6.4–6.5 Guardian VP → ERC-1643 seam; design C, build B | §4.4, §4.4.2 |
| 6.4 VVB reframing — what the VVB reviews changes | §4.4.1 |
| 6.6 Location Protocol shape adopted; Astral oracle not a dependency | §3.10 |
| Part 4 Reorder against Sept 30; Arc first | §9 |
| Part 4 Cut to two UI views | §7 |
| Part 7 item 13 One-page summary at the top | §1 |

### 13.5 Rejected or modified

| Item | Decision | Reason |
|---|---|---|
| v2's **all-synthetic Tier 0** | **Rejected** | The satellite layer is the core scientific claim; fabricating it undermines everything built on it. Approved 2026-09-10. Amends `CLAUDE.md` and `docs/ARCHITECTURE.md §4`. |
| Review's **dryland demonstration site** | **Rejected** | `CLAUDE.md` fixes British Columbia. The underlying objection was that canopy gain is a perverse metric *for drylands*; the BC site resolves it without changing the site. The general principle — metric choice is incentive design — is retained (§3.11). |
| Idea 0.2's **x402 as core** | **Modified — demoted** | 20 days, and per-request metering conflicts with §3.7.1. Ships only with pre-registration coupling, or not at all (§4.8). |
| Idea 0.2's **seven-view globe** | **Modified — cut to three** | Biggest time sink for the least thesis value (§7). |
| Idea 0.2's **four demonstration sites** | **Rejected** | One site. |
| Idea 0.2's **"no central certifier required"** | **Deleted** | The positioning that got Toucan killed (§2.1). |
| Idea 0.2's **§3.10 H3 non-overlap proof** | **Replaced** | Polygon geometry for quantities and the intersection test; H3 demoted to index and join key. Strictly simpler (§3.10). |
| **Guardian stood up for the hackathon** | **Deferred** | 3–7 days of a 20-day budget. Seam built, drop-in point specified (§4.4.2). |
| **Cohort verification implementation** | **Deferred** | Specified in §4.7, not built. |
| **Actuarial buffer sizing** | **Deferred** | The withholding mechanism ships; the actuarial model does not (§4.2.2). |
| Review's **§9 six-month plan critique** | **Accepted in full** | §9 is rebuilt against 20 days. |

### 13.6 Open — requires explicit approval

Per `CLAUDE.md`, these are ecological/scientific methodology decisions and are not
Claude's to settle. They block M2, not M1.

1. **The settled metric for the Kootenay site.** Recommendation:
   `riparian_woody_cover_gain_ha` with the §3.11 issuance gates.
2. **Confidence level for the demonstration deed.** Recommendation: 95%.
3. **Near-ring and far-ring radii**, and the plausible displacement distance for
   riparian restoration in this landscape.
4. **The parallel-trend pass criterion** — the specific diagnostic and its threshold.
5. **Benefit-share fraction** and the tenure attestation types recognised at
   registration.
6. **Whether the reversal buffer withholding fraction is fixed or per-deed** for the
   prototype.

---

## 14. Summary

The target is not feature count. It is a technically credible, publicly developed system
in which **rigorous remote sensing, explicit uncertainty, pre-registered additionality,
deterministic verification, programmable settlement, and auditable restoration outcomes
form one working loop** — where the number the pipeline produces is the number that
releases the money, and where the buyer can re-derive that number themselves.

**The central rule:**

> Evidence produces the result.
> The methodology governs verification.
> The contract governs money.
> The index provides history.
> AI explains and orchestrates.
>
> No component silently becomes the authority for another component's responsibility.

**And the answer to the question the review asked** — does this incentivise restoration,
or only make existing restoration finance more auditable?

With §3.7.1, §4.5 and §4.6 in the baseline, it incentivises restoration, and specifically
it incentivises restoration by operators who currently cannot access outcome finance at
all. Without them, it makes existing restoration finance harder to lie about — worth
doing, but a smaller claim than this document would otherwise be making.
