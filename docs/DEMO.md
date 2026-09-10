# Ecorestore Network — Demonstration Plan

The 4-minute video script that shoots this plan is `docs/VIDEO_SCRIPT.md`.

## 1. Demonstration Principle

The demo uses one British Columbia restoration project with a **mixed evidence
provenance that must never be blurred**.

**Tier 0 is real.** Sentinel-2 L2A, Sentinel-1, Landsat and ICESat-2 acquisitions for
the parcel and both control rings, shown with their STAC scene IDs and processing graph
version. The satellite layer is the core scientific claim and is not fabricated.

**Tiers 1-3 are simulated.** Wherever they appear the application must visibly state:

> SIMULATED DEMONSTRATION DATA — NOT REAL FIELD, SENSOR OR REGULATORY MEASUREMENT.

Real and simulated evidence must be visually distinguishable at all times.

---

## 2. Demonstration Project

Working name:

**Kootenay Riparian Restoration — British Columbia**

The parcel is a real location with real satellite coverage. The restoration project,
the deed, the claim and all Tier 1-3 evidence are constructed for the demonstration.

Tier 0 indices are genuine measurements of that ground. No claim is made that a
restoration intervention took place there, that the Tier 1-3 evidence is real, or
that any displayed outcome constitutes certification.

---

## 3. Demonstration Flow

```text
Sponsor selects project
        ↓
Reviews parcel, tenure attestation, encumbrance declaration,
and the committed analysis plan
        ↓
Restoration Deed is funded in USDC
        ↓
Mobilisation tranche draws against verified effort — the restorer is paid to start
        ↓
Evidence is submitted   (Tier 0 REAL, Tiers 1-3 SIMULATED and labelled)
        ↓
Auditor investigates, querying project history via The Graph
        ↓
Control set is DRAWN by the pre-registered rule — not chosen
        ↓
Parallel-trend diagnostic
        ↓
Difference-in-differences against the far ring
        ↓
Leakage deduction from near/far ring divergence
        ↓
Biophysical additionality
        ↓
Uncertainty, with empirical coverage reported
        ↓
Issuance gates: native species fraction, no net habitat loss, condition floor
        ↓
Lower-bound settlement quantity
        ↓
Arc settlement; benefit share routes to the steward address
        ↓
Verdict signed as a VC; outcome issued into the vintage partition
with setDocument(VC)      [Guardian drops into this slot in production]
        ↓
Persistence tranche scheduled; monitoring commitment runs past it
        ↓
Assurance bundle exported
        ↓
History available through The Graph
```

---

## 4. Critical Demonstration Moment

The most important moment is not the UI.

It is showing that:

```text
claimed change
        ↓
observed parcel change
        ↓
regional/control change
        ↓
additionality-adjusted change
        ↓
uncertainty interval
        ↓
conservative lower bound
        ↓
settlement
```

The demo should make clear why gross ecological change is not automatically the amount that gets paid.

---

## 5. Failure Case

A second test case should eventually demonstrate:

```text
parallel-trend failure
        ↓
INSUFFICIENT_EVIDENCE
        ↓
no settlement
```

This is a critical trust property.

---

## 6. Data Provenance Rules

Never:

* imply simulated values are real satellite observations;
* cite simulated values as field measurements;
* describe the demonstration as regulatory certification;
* call the outcome a regulatory biodiversity credit.

Use:

* simulated dataset / simulated observation (Tiers 1-3);
* real Sentinel-2 acquisition, with scene IDs (Tier 0) — Sentinel-1 is not ingested and
  must not be shown as acquired;
* demonstration outcome;
* prototype verification.

---

## 7. Demo Priority

If time becomes constrained, **cut in this order**: the rotating globe, then secondary
UI views, then x402, then ATS lifecycle depth, then the Subgraph.

**Never cut** additionality, leakage, uncertainty, pre-registration, or the
`INSUFFICIENT_EVIDENCE` path. Those are the thesis.

Do not cut the scientific core to add cosmetic features.

## 8. The two UI views that must ship

1. **Additionality view** — parcel trajectory against the far-ring control envelope,
   with the near ring shown separately so leakage is visible. The gap between the lines
   *is* the settled quantity.
2. **Assurance export** — the disclosure-ready bundle: quantities with bounds, empirical
   coverage, evidence provenance, STAC scene IDs, processing graph version, control-set
   and ring geometry, analysis plan hash and run index, obligation status, transaction
   references, verdict VC.

Plus the **assurance-adjusted comparison**, generated from the result — on current data
*"2.2271 ha defensible vs. 42 ha at risk"* — because the value proposition is insurance
against restatement, not units per dollar.
A buyer told they get a third of the credits buys elsewhere; a buyer told their units
survive assurance does not.
