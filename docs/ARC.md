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
parcel identity
metric
methodology version
milestones
thresholds
confidence level
funding
verification authority
released amount
remaining escrow
```

---

## 4. Intended Lifecycle

```text
createProject()
createDeed()
fundDeed()
submitEvidence()
verifyMilestone()
releaseTranche()
withholdRetention()
```

The exact interface will be designed during M3.

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

## 6. Synthetic Data

The contract may receive synthetic verification results during the hackathon.

Those results must be visibly marked as synthetic in the application and documentation.

---

## 7. M0

M0 creates only the Solidity scaffold.

Do not deploy.

Do not implement the complete escrow logic.

---

## 8. M3

M3 implements:

* deed creation;
* USDC funding;
* milestone state;
* authorized verification;
* lower-bound settlement;
* replay protection;
* release/withholding;
* tests.

Arc Testnet is the intended deployment environment.
