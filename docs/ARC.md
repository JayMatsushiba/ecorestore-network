# Ecorestore Network — Arc Settlement

## 1. Purpose

Arc is the financial settlement layer.

The Restoration Deed holds USDC against predefined restoration milestones and releases funds only when the contractual verification conditions are satisfied.

Arc's current documentation supports deploying Solidity contracts to Arc Testnet and using testnet USDC for development.

---

## 2. Financial Authority

The authority model is:

```text
Verification Engine
        ↓
VerificationResult
        ↓
Guardian authorization
        ↓
authorized verifier
        ↓
RestorationDeed
        ↓
USDC
```

The contract, not the AI agent, controls settlement.

---

## 3. Restoration Deed

The intended contract contains:

```text
project
parcel identity            h3 root + geometry hash
tenure attestation         hashed rights attestation + type
encumbrances               legal obligations, subsidy, existing claims
metric
methodology version
analysis plan hash         committed BEFORE any outcome is observable
milestones                 mobilisation / establishment / persistence
thresholds
confidence level
benefit share              fraction routed to a named steward address
funding
verification authority
assignments                tranches pledged to third-party lenders
released amount
remaining escrow
buffer withholding         fraction retained against portfolio reversals
```

---

## 4. Intended Lifecycle

```text
createProject()      parcel, tenure attestation, encumbrances
createDeed()         terms + analysis_plan_hash + benefit_share
fundDeed()
drawMobilisation()   cost-recovery advance against verified EFFORT, not outcome
submitEvidence()
verifyMilestone()    versioned verdict + run index
releaseTranche()     against the verified lower bound; routes the benefit share
assignTranche()      pledge a future tranche to a third-party lender
withholdRetention()
```

**Why the additions.** Outcome-only payment means the restorer fronts land access,
stock, labour and three years of maintenance against a payment that arrives at
12/24/36 months. The parties named as the supply side have the least access to working
capital, so an outcome-only instrument selects for well-capitalised operators — it
reallocates existing restoration rather than increasing it.

The deed already holds committed USDC against machine-evaluable conditions, which is a
better credit instrument than a small restorer's balance sheet. `drawMobilisation()`
and `assignTranche()` are what turn that into working capital, and MRV cost is paid
from escrow rather than the restorer's pocket. See Idea 0.3 §4.5.

The exact interface is designed during M1.

---

## 5. Security Requirements

The contract must prevent:

* unauthorized verification;
* arbitrary withdrawals;
* replayed verification results;
* settlement above deed limits;
* settlement against an invalid milestone;
* modification of immutable deed terms;
* AI-controlled fund release.

Verification submissions must be authorized.

Settlement calculations must be bounded by contract state.

---

## 6. Data Provenance

Verification results reaching the contract derive from **real Tier 0 satellite data**
combined with **simulated Tiers 1-3**. The application and documentation must show which
is which, and must never present simulated evidence as measurement.

---

## 7. M1 — Arc comes first

**The build sequence is reordered.** Earlier drafts put Arc contracts at step 4,
behind a full spatial pipeline and a globe. The Arc Testnet→Mainnet track carries a
hard external deadline of **September 30, 2026**, and that ordering cannot meet it.

Contracts are **M1**. The pipeline builds against a deployed contract, not the reverse.

M1 implements:

* deed creation with the committed analysis plan hash;
* tenure attestation and encumbrance recording at project registration;
* USDC funding;
* milestone state (mobilisation / establishment / persistence);
* authorized verification with replay protection;
* lower-bound settlement bounded by contract state;
* mobilisation draw, `assignTranche()`, benefit-share routing;
* release / withholding;
* tests.

Arc Testnet is the deployment environment; track mainnet readiness from day one.
