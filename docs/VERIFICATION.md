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
