# Ecorestore Network — Verification Architecture

## 1. Purpose

The verification engine is the scientific core of Ecorestore Network.

It converts environmental evidence into a deterministic, versioned verification result that downstream systems can trust.

The engine must be deterministic for identical inputs, methodology version and configuration.

---

## 2. Verification Pipeline

```text
Evidence
   ↓
Baseline
   ↓
Parcel Observation
   ↓
Matched Controls
   ↓
Parallel-Trend Diagnostic
   ↓
Difference-in-Differences
   ↓
Additionality
   ↓
Uncertainty
   ↓
Lower Bound
   ↓
Quality Gate
   ↓
VerificationResult
```

---

## 3. Evidence

Evidence is structured input.

It may eventually include:

* satellite observations;
* drone observations;
* IoT measurements;
* field reports;
* imagery;
* derived spatial products.

**Tier 0 is real.** Sentinel-2 L2A, Sentinel-1, Landsat and ICESat-2 acquisitions for
the parcel and both control rings, with STAC scene IDs and processing graph version
recorded in every result.

**Tiers 1-3 are simulated** from realistic parameters and must be explicitly marked as
simulated wherever they appear.

*(This amends an earlier all-synthetic framing; the reason is recorded in
`DECISIONS.md` §2.)*

### Datasets

**Two columns, and they mean different things.** *Kind* is whether the dataset is real
observation or simulated for the demonstration. *Acquired* is whether this repository has
actually ingested it. Only Sentinel-2 L2A is acquired today; every other real dataset is
planned, and no result depends on one.

| Dataset | Use | Kind | Acquired |
|---|---|---|---|
| Sentinel-2 L2A | Optical indices, 10 m | REAL observation | **Yes** — 72 scenes, Earth Search STAC |
| Sentinel-1 GRD (+SLC) | SAR backscatter; coherence only where interpretable | REAL observation | No — planned |
| Landsat 5/7/8/9 | Long baseline, 1984– | REAL observation | No — planned |
| ICESat-2 | Canopy structure (GEDI unusable at this latitude) | REAL observation | No — planned |
| ESA WorldCover | Land cover transitions | REAL observation | No — planned |
| Dynamic World | Near-real-time land cover context | REAL observation | No — planned |
| SRTM / Copernicus DEM | Terrain covariates for control matching | REAL observation | No — planned |
| WorldClim / ERA5 | Climate covariates for control matching | REAL observation | No — planned |
| Biodiversity Intactness 100 m v1.1 | Ecological value prior for parcel scoring | REAL observation | No — planned |
| Drone orthomosaic, crown detections | Tier 1 calibration | **SIMULATED, LABELLED** | Generated |
| Soil moisture, water table, acoustic | Tier 2 condition signal | **SIMULATED, LABELLED** | Generated |
| Plot surveys, planting records, geotagged photos | Tier 3 claims | **SIMULATED, LABELLED** | Generated |

Control matching currently uses pre-level and pre-slope only. The terrain, soil and
climate covariates above are specified, not yet joined.

---

## 4. Baseline

The baseline defines the pre-intervention state against which subsequent change is measured.

A baseline must have:

* defined spatial boundary;
* defined observation period;
* defined metric;
* methodology version;
* evidence references.

---

## 5. Parcel Observation

The engine calculates the observed change inside the funded parcel.

The observed parcel change is **not automatically the restoration outcome**.

Regional or background change must be accounted for.

---

## 6. Matched Controls — two rings

Control parcels represent the counterfactual.

Controls are selected on land cover, elevation, slope, aspect, soil, climate and
pre-treatment index trajectory. Matching on the pre-treatment trend is what
distinguishes a genuine control from a merely adjacent one.

**The control set is drawn by the pre-registered rule (§6.1), never chosen at
verification time.**

**Two rings, because leakage biases the estimate upward:**

* **near ring** — matched, immediately adjacent, leakage-exposed;
* **far ring** — matched, buffered beyond plausible displacement distance.

Excluding grazing, fuelwood collection or cultivation from a funded parcel displaces
that pressure to adjacent land. Because controls are drawn from nearby parcels,
displaced pressure degrades the controls at the same time the parcel improves, and the
DiD **overstates** additionality on both sides at once. This is the one place the design
is not conservative, so it is handled explicitly rather than assumed away by a buffer.

**The DiD estimate uses the far ring. The divergence between rings is a direct leakage
estimate**, reported in the result and deducted.

### 6.1 Pre-registration

**Why it exists.** Nothing otherwise fixes *when* the analysis choices are made. If the
control set were selected and the analysis run at verification time, by a service the
restorer pays per request, the result would be:

> a researcher-degrees-of-freedom problem with money attached: run the verification
> against several candidate control sets, several observation windows, several index
> choices, and submit the favourable one. Every number in the verdict stays honest; the
> estimator is still biased.

That is the failure this section prevents, and it is why metered verification cannot ship
without the coupling in `X402.md` §5.

The analysis plan hash is committed at `createDeed()`, before any outcome is
observable:

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

Re-runs are permitted, but **every run is recorded on-chain and the result cites its
run index.** A parcel with eleven runs and one submitted result is visible.

Without this, the control set is selected and the analysis run at verification time by
a service the restorer pays per request — a researcher-degrees-of-freedom problem with
money attached. Every number stays honest; the estimator is still biased.

---

## 7. Parallel-Trend Diagnostic

Difference-in-differences requires an appropriate pre-treatment relationship.

The control set must pass a pre-treatment parallel-trend diagnostic.

If the diagnostic fails:

```text
VerificationStatus = INSUFFICIENT_EVIDENCE
```

The system must not force a settlement quantity.

This is a hard quality gate.

---

## 8. Difference-in-Differences

Conceptually:

```text
DiD =
    post-treatment parcel change
  - pre-treatment parcel change
  - (
      post-treatment control change
      - pre-treatment control change
    )
```

The implementation must define the exact mathematical form and version it.

---

## 9. Additionality — two distinct things

The system must not settle against gross parcel greening alone.

**Biophysical additionality** — the DiD adjustment against the far ring, less the
leakage deduction. *This is what the engine measures.*

**Financial additionality** — would this have happened without the payment? *This is
not measurable from imagery.* It is addressed procedurally by the encumbrance registry
(`ARC.md`), which records legal obligations, public subsidy and existing claims at
parcel registration and attaches an `obligation_status` to the outcome.

Conflating the two is the criticism levelled hardest at credit markets. The vocabulary
is kept split everywhere in the code and the interface.

---

## 10. Uncertainty

The engine must represent uncertainty explicitly.

The result must contain an interval rather than only a point estimate.

Sources, in order of typical magnitude for a DiD estimate:

1. **control-matching error**;
2. **index → physical-quantity model transfer error**;
3. leakage estimation error;
4. mixed pixels at parcel boundaries;
5. residual cloud and cloud-shadow contamination;
6. atmospheric correction residuals, BRDF and view-angle effects;
7. co-registration error.

The first two dominate. Listing atmospheric and co-registration terms first, as earlier
drafts did, gets the ordering backwards.

### 10.1 Empirical coverage

Analytically propagated intervals are routinely mis-calibrated, and the entire financial
argument rests on the bound meaning what it says. The result therefore reports an
**empirical coverage figure alongside the nominal one**: on held-out ground-truth plots,
does the nominal 95% interval contain truth approximately 95% of the time?

If coverage is materially below nominal, the settlement rule is not yet sound. That must
be reported, not hidden.

---

## 11. Conservative Settlement

The financial settlement quantity is based on the declared lower confidence bound.

Conceptually:

```text
settledQuantity = lowerBound(uncertaintyInterval)
```

The point estimate is not the settlement authority.

### Conservatism and pricing are separated

The lower-bound rule on its own places 100% of measurement uncertainty on the restorer.
The stated benefit — restorers are incentivised to fund better measurement — holds only
for the **controllable** fraction. Most of the interval is not controllable:

* **Biome.** Cloud frequency, canopy density, phenological noise and index saturation are
  properties of where the ecosystem is.
* **Parcel size.** Mixed-pixel boundary error scales with perimeter-to-area, so small
  parcels have structurally wider relative intervals.
* **Ecosystem type.** Peatland and dryland — the two biomes where restoration need is
  highest and measurement is hardest — are penalised hardest.

Net effect, uncorrected: the mechanism pays best for large, uniform, temperate,
dense-canopy plantings. That is the easiest thing to measure and the thing most likely to
be a monoculture — the opposite of the NbS priority ordering.

**The fix is one deed parameter.** Price per unit is set against the **ex-ante expected
interval width for that biome and parcel-size class** — a difficulty premium. The restorer
then bears only the *deviation from expectation*, which is the controllable part, and the
incentive to improve measurement survives intact.

The equilibrium, stated honestly: if price does not adjust for expected uncertainty,
buyers bid for easily-measured projects and the clearing price for hard-to-measure biomes
collapses. **A lower-bound rule without a difficulty premium is partly self-cancelling.**

The two rules are therefore inseparable. Settlement pays the lower bound
(`DECISIONS.md` §5); pricing compensates for the expected width of that bound. Implementing
the first without the second reproduces the outcome the design exists to avoid.

*Not implemented. The difficulty premium is a pricing parameter; no deed carries one yet.*

---

## 12. Quality Gate

The quality gate evaluates whether the verification result is sufficiently supported.

Examples:

```text
parallel trend failed
→ INSUFFICIENT_EVIDENCE

evidence incomplete
→ INSUFFICIENT_EVIDENCE

required metric unavailable
→ INSUFFICIENT_EVIDENCE

uncertainty interval invalid
→ INVALID_RESULT
```

A failed quality gate must not be silently converted into a successful verification.

---

## 13. Canonical VerificationResult

The canonical result should contain, at minimum:

```text
projectId
parcelH3Root
geometryHash
analysisPlanHash          §6.1
runIndex                  §6.1
methodologyVersion
processingGraphVersion
stacSceneIds              real Tier 0 provenance
metric
claimedQuantity
observedChange
controlChangeFarRing
controlChangeNearRing
leakageEstimate
additionalityAdjusted     biophysical
uncertainty
empiricalCoverage         §10.1
lowerBound
parallelTrendStatus
qualityGateStatus
obligationStatus          §9
verificationStatus
evidenceHash
evidenceCid
```

The exact TypeScript representation is implementation work for M1.

---

## 14. AI Boundary

The LLM is not the numerical source of truth.

AI may:

* inspect;
* summarize;
* explain;
* orchestrate;
* identify anomalies.

AI may not:

* invent a verification quantity;
* replace deterministic calculations;
* modify the canonical result;
* directly authorize settlement.

---

## 15. Implementation state (2026-09-10)

`verification/engine.ts` implements §2–§13 as a pure function of
`(plan, evidence, runIndex)` against the committed REAL Sentinel-2 snapshot
(`verification/fixtures/tier0-kootenay-riparian-001.json`, 72 scenes) and simulated
Tiers 1–3. Its status set is `VERIFIED | PARTIAL | NOT_ADDITIONAL |
INSUFFICIENT_EVIDENCE | GATE_FAILED | INVALID_RESULT`, mirrored by the contract.

Two points where the implementation goes beyond this document, both recorded as
provisional in the analysis plan and in `docs/DEVELOPMENT_LOG.md`:

- **Control-matching error** (§10 item 1) is represented by a far-ring residual draw
  in each bootstrap iteration. Without it, placebo coverage was 0.33.
- **Empirical coverage** (§10.1) is estimated by placebo-in-space over far-ring units
  on real data, because no held-out ground-truth plots exist for a simulated
  intervention. The result labels the basis.

Not yet implemented: Sentinel-1 / Landsat / ICESat-2 ingest, covariate matching beyond
pre-level and pre-slope, the polygon intersection check at issuance.

### The analysis boundary (2026-09-10)

§2's pipeline is split at one seam, defined in `verification/analysis-contract.ts`:

```text
analysis   unit series → controls by the committed rule → parallel-trend diagnostic
           → DiD → leakage → bootstrap interval → placebo coverage        (numbers)
verify     evidence and issuance gates → status → provenance → evidence commitment
           → canonical VerificationResult → resultHash                     (the document)
```

Two implementations of the analysis side exist and must agree exactly:

- `verification/engine.ts` `analyseTier0()` — the reference, in-process, used by the
  test suite and by `verify()`.
- `analysis/` — the Python service (numpy, scipy, FastAPI), used by the container stack
  through `verifyWith()`. Its test suite replays five reference cases dumped from the
  TypeScript side (`real`, `synthetic`, `trend-failure`, `few-scenes`, `few-controls`)
  and asserts equality of every number. The seeded generator is ported exactly and the
  bootstrap consumes its stream in the reference order; the regression uses numpy and
  scipy and agrees to well inside the six decimals reported.

The result names the engine that produced it (`analysisEngine`), so two results that
agree on every scientific quantity still differ in `resultHash` if different runtimes
computed them. That is deliberate: the determinism guarantee is per runtime
(`DEPLOYMENT.md` §5), and the runtime is therefore part of the commitment.

Tier 0 acquisition also has a second implementation, processing graph `2.0.0`
(`analysis/ecorestore_analysis/acquire.py`: pystac-client, rasterio, h3, shapely,
pyproj). On the same grid it reproduces the committed 1.0.0 fixture's parcel and
parcel-cell pixel masks exactly and parcel NDVI to 4 dp; ring candidates at the buffer
edge and unit areas (ellipsoidal rather than spherical) differ slightly, which is why it
carries a new graph version. The committed fixture is still 1.0.0.
