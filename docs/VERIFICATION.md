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

During M1, evidence is synthetic and controlled.

Synthetic evidence must be explicitly marked as synthetic.

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

## 6. Matched Controls

Control parcels represent the counterfactual.

Controls should be selected using relevant characteristics such as:

* land cover;
* elevation;
* slope;
* aspect;
* soil;
* climate;
* pre-treatment trajectory.

Potential treatment spillover or contamination must exclude a control.

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

## 9. Additionality

Additionality distinguishes intervention-attributable change from change that would plausibly have occurred without the intervention.

The system must not settle against gross parcel greening alone.

---

## 10. Uncertainty

The engine must represent uncertainty explicitly.

The result must contain an interval rather than only a point estimate.

Potential sources include:

* observation error;
* residual cloud contamination;
* spatial boundary error;
* control matching uncertainty;
* model uncertainty;
* measurement uncertainty.

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
methodologyVersion
metric
claimedQuantity
observedChange
controlChange
additionalityAdjusted
uncertainty
lowerBound
parallelTrendStatus
qualityGateStatus
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

## 15. M1 Objective

M1 implements the complete deterministic synthetic verification pipeline and tests its failure modes.

No blockchain integration is required to consider M1 complete.

---

## 16. M1 Implementation Notes

This section documents what the M1 deterministic engine (`verification/`) actually implements, as run against the synthetic fixtures in `verification/fixtures.ts`. It supersedes §15 as the record of what M1 delivered.

### 16.1 Synthetic dataset

All M1 fixtures represent one fictional project, "Kootenay Riparian Restoration," British Columbia — **synthetic demonstration data, not a real place or project** (see the header comment in `verification/fixtures.ts`). The metric used throughout is `canopy_cover_fraction_pct` (fractional canopy cover, 0-100), with two pre-treatment observations per parcel (to establish a two-point pre-treatment trend slope) and one post-treatment observation.

Six fixtures exercise the pipeline's decision paths:

| Fixture | Demonstrates |
|---|---|
| `FIXTURE_PARTIAL_SETTLEMENT` | Primary demo case: quality gate PASSes, settled quantity (~18.18 ha) is below the claim (35.0 ha) -> `PARTIAL`. |
| `FIXTURE_FULL_SETTLEMENT` | Same evidence, lower claim (10.0 ha) fully covered by the settled quantity -> `VERIFIED`. |
| `FIXTURE_PARALLEL_TREND_FAIL` | Treated parcel's pre-treatment slope (+5.0 pp/yr) diverges sharply from its controls' (+1.0 pp/yr) -> parallel-trend `FAIL` -> `INSUFFICIENT_EVIDENCE`, `settledQuantity: 0`. |
| `FIXTURE_MISSING_POST_EVIDENCE` | Treated parcel has no post-treatment observation -> blocked at the input-validation gate. |
| `FIXTURE_INVALID_CLAIM` | `claimedQuantity <= 0` -> blocked at the input-validation gate. |
| `FIXTURE_INSUFFICIENT_CONTROLS` | Only one eligible (matched, uncontaminated) control remains after exclusion, below `minimumControlCount: 2` -> blocked before the parallel-trend diagnostic ever runs. |

None of these numbers are reused from earlier proposal drafts; they were authored fresh for M1.

### 16.2 Control matching (`calculations/controlMatching.ts`)

Rule-based, not production causal inference (propensity-score or synthetic-control matching over a full historical panel is future work). A candidate is eligible only if:

1. it carries no `contaminationReason`, and
2. its declared characteristics match the treated parcel — identical `landCover`, `climateZone`, `soilType`, and `aspect`; elevation and slope within the configured tolerance (`matchingTolerance`, default ±150 m / ±8°).

### 16.3 Contamination rule

A `Parcel.contaminationReason` (`known_concurrent_intervention`, `adjacent_to_treated_parcel_with_plausible_spillover`, or `shared_hydrology_with_treated_parcel`) unconditionally excludes a candidate, even when its characteristics match perfectly. Contaminated candidates are reported separately from non-matching ones in `VerificationDiagnostics` so a reviewer can see *why* each candidate was excluded.

### 16.4 Parallel-trend diagnostic (`calculations/parallelTrend.ts`)

A **hard gate**. "Trend" is a two-point linear slope (metric units per year) between the earliest and latest pre-treatment observation for a parcel — not a fitted multi-point regression. The treated parcel's slope is compared to the mean slope across eligible controls:

```text
divergenceRatio = |treatedSlope - meanControlSlope| / max(|meanControlSlope|, parallelTrendMinimumSlopeDenominator)
status = divergenceRatio <= parallelTrendToleranceRatio ? PASS : FAIL
```

If the treated parcel's slope, or *any* eligible control's slope, cannot be computed (fewer than two dated pre-treatment observations), the diagnostic returns `INSUFFICIENT_EVIDENCE` rather than dropping that control silently or guessing. `FAIL` and `INSUFFICIENT_EVIDENCE` are both treated as non-PASS by the quality gate — neither is sufficient support for a settlement quantity, and the engine does not compute DiD, additionality, or uncertainty past this gate (see `engine.ts`'s `buildBlockedResult`).

### 16.5 Difference-in-Differences (`calculations/differenceInDifferences.ts`)

```text
DiD = (treatedPost - treatedPre) - (controlPost - controlPre)
```

`treatedPre` / `controlPre` are each parcel's *latest* pre-treatment observation (closest to treatment start). `treatedPost` / `controlPost` are the mean of that parcel's post-treatment observation(s). The control-side level is the **average of each eligible control's own (pre, post) change**, not the change between the group's averaged levels — for equal-sized control groups these coincide, but the implementation always computes it the first way for clarity about what it represents.

### 16.6 Additionality (`calculations/additionality.ts`)

The DiD estimate is a percentage-point change. It is converted to hectares by scaling against the treated parcel's declared `areaHectares`, assuming the percentage-point change is uniform across the parcel:

```text
additionalityAdjustedHectares = (DiD / 100) * treatedParcel.areaHectares
```

A production system would derive this from actual per-cell area rather than a single scalar.

### 16.7 Uncertainty (simplified prototype model)

`calculations/uncertainty.ts` implements a **fixed relative-fraction margin**, not a statistically fitted confidence interval:

```text
margin = |pointEstimate| * relativeUncertaintyFraction
lowerBound = pointEstimate - margin
upperBound = pointEstimate + margin
```

`relativeUncertaintyFraction` (default `0.15`) and `confidenceLevel` (default `0.85`, carried through as a declared label only — this model does not derive the margin from it) are both `MethodologyConfiguration` parameters, versioned via `uncertaintyModel: "m1-fixed-fraction-v0.1"`. This does **not** model atmospheric correction residuals, control-matching error, or the other sources listed in §10 above. Swapping in a validated statistical model later does not require changing the engine's pipeline shape — only `computeUncertainty`'s implementation and the config's `uncertaintyModel` id.

### 16.8 Conservative settlement (lower-bound rule)

```text
settledQuantity = qualityGateStatus === "PASS" ? max(0, uncertainty.lowerBound) : 0
```

The `max(0, ...)` clamp prevents a negative "gain" (which is not a settleable restoration outcome in this prototype) from propagating as a negative settlement quantity. On any blocked path (insufficient evidence, insufficient eligible controls, or a non-PASS parallel-trend result) `settledQuantity` is unconditionally `0`.

### 16.9 Quality gates (`calculations/qualityGate.ts`)

```text
!hasSufficientEvidence                    -> INSUFFICIENT_EVIDENCE
parallelTrendStatus !== PASS              -> INSUFFICIENT_EVIDENCE
uncertaintyStatus !== VALID               -> INVALID_RESULT
otherwise                                 -> PASS
```

`hasSufficientEvidence` is `false` both when the input-validation checks fail (missing observations, non-positive claim, malformed window) and when fewer than `minimumControlCount` eligible controls remain after matching and contamination exclusion — both are evidence-sufficiency problems, distinct from a parallel-trend failure, and are reported as such in `VerificationDiagnostics` (eligible/excluded control lists are always populated even on a blocked path, so a reviewer can see *why*).

`VerificationStatus` adds one more distinction on top of `QualityGateStatus`: when the gate is `PASS`, the result is `VERIFIED` if `settledQuantity >= claimedQuantity`, else `PARTIAL`. This distinction is not specified verbatim by the M1 prompt; it was added because §14's canonical result carries both `claimedQuantity` and `settledQuantity`, and collapsing every `PASS` into a single status would discard the over/under-claim signal those two fields exist to carry.

### 16.10 Methodology version

`verification/config.ts` defines `M1_METHODOLOGY_VERSION = "ecorestore-m1-v0.1"` and a single `DEFAULT_METHODOLOGY_CONFIG` constant bundling every tunable parameter (matching tolerance, trend tolerance, uncertainty fraction, minimum control count, confidence level). A second constant, `STRICT_METHODOLOGY_CONFIG`, exists purely to test that engine behavior is actually driven by configuration rather than hard-coded values — it is not a claim of a second validated methodology.

### 16.11 Spatial identity and evidence hash simplifications

- `calculations/spatialIdentity.ts` derives `parcelH3Root` via a 32-bit FNV-1a hash of the parcel id — a deterministic placeholder, **not** an H3 cell-set Merkle root. No H3 library or Merkle tree is implemented in M1 (see M1 prompt §5).
- `calculations/evidenceHash.ts` derives `evidenceHash` via a SHA-256 digest (Node's built-in `node:crypto`) over a canonicalized, sorted JSON encoding of the evidence array — reproducible and order-insensitive, but **not** a CID and not linked to any real content-addressed storage (no IPFS/Filecoin integration exists in M1).

### 16.12 Known limitations

- Single metric (`canopy_cover_fraction_pct`), single treated parcel per project, single evidence source per observation (all fixtures use `synthetic_satellite_optical`) — the multi-tier evidence fusion described in the proposal is not implemented.
- Control matching is rule-based on four categorical fields plus two numeric tolerances; it does not implement propensity-score matching, synthetic controls, or any weighting scheme.
- The parallel-trend diagnostic uses a two-point slope, not a regression over a multi-point historical baseline.
- The uncertainty model is a fixed relative-fraction margin, explicitly not a validated statistical confidence interval — see §16.7.
- `parcelH3Root` and `evidenceHash` are non-cryptographic/placeholder identifiers appropriate only for a prototype (see §16.11); they must not be treated as production spatial-identity or content-addressing guarantees.
- `evidenceCid` exists on `VerificationResult` as a reserved field but is never populated in M1 (no storage integration).
- No seasonal decomposition, cloud/shadow masking, or any of the Tier 0 satellite-processing detail from the proposal is implemented — evidence is synthetic scalar values, not derived from imagery.

### 16.13 M1 completion statement

M1 implements the complete deterministic synthetic verification pipeline described in §2-§14 above, including the hard parallel-trend gate (§7) and the conservative lower-bound settlement rule (§11), against six synthetic Kootenay fixtures, with 45 passing automated tests. No blockchain, Guardian, Arc, Graph, or AI integration exists in this milestone — see CLAUDE.md and the M1 prompt §16 "Architecture Boundaries".
