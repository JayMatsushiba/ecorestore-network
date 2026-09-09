# Ecorestore Network — The Graph

## 1. Purpose

The Graph is the indexed history and query layer.

A Subgraph extracts blockchain events and exposes structured entities through GraphQL.

The Graph must be load-bearing rather than decorative.

---

## 2. Intended Entities

```text
Project              parcel, tenure attestation, encumbrances
RestorationDeed      terms, analysis_plan_hash, benefit_share
Contribution
Milestone            mobilisation / establishment / persistence
Assignment           tranche pledged to a third-party lender
EvidenceSubmission   tier, CID, real | simulated
VerificationRun      run index, plan hash, submitted or not
Verification         verdict, controls, leakage, CI, coverage, tier scores
GuardianCredential
OutcomeUnit          vintage partition, obligation_status, lifecycle state
Settlement
Reversal             detected loss, cause, affected units, buffer draw
ControlSet           near ring and far ring
Retirement
```

**`VerificationRun` is the entity that makes pre-registration enforceable.** Re-runs
are permitted, but every run is indexed, so a parcel with eleven verification runs and
one submitted result is visible to anyone reading the Subgraph.

Additional entities may be added only when required by the implementation.

---

## 3. Intended Queries

The Auditor and UI should eventually be able to retrieve:

* project history;
* deed state;
* evidence submissions;
* verification history;
* prior reversals;
* settlements;
* outcome lifecycle;
* retirement history.

---

## 4. Auditor Use

The Graph must be a genuine Auditor input.

Examples:

```text
retrieve project history
retrieve prior verification
retrieve prior settlement
detect repeated claim/reversal patterns
COUNT VERIFICATION RUNS BEHIND A SUBMITTED RESULT
inspect current deed state
```

Run count is genuine history and a genuine anomaly signal, not decoration.

The Auditor should not merely query The Graph to populate UI cards.

---

## 5. M0

M0 creates only the boundary/configuration.

Do not fake indexed data.

Do not claim a deployed Subgraph that does not exist.

---

## 6. M5

M5 implements the live indexing path.

Potential AI integration may use The Graph's Subgraph MCP, which allows AI-compatible clients to discover schemas and execute Subgraph queries through a standardized interface.

The final implementation must satisfy the actual ETHOnline prize requirements at submission time.
