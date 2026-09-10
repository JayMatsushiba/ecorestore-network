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

*(This amends the earlier all-synthetic framing. See Idea 0.3 §3.2 and §13.5.)*

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
(Idea 0.3 §4.6), which records legal obligations, public subsidy and existing claims at
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
