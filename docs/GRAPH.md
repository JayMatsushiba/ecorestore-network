# Ecorestore Network — The Graph

## 1. Purpose

The Graph is the indexed history and query layer.

A Subgraph extracts blockchain events and exposes structured entities through GraphQL.

The Graph must be load-bearing rather than decorative.

---

## 2. Intended Entities

```text
Project
RestorationDeed
EvidenceSubmission
Verification
GuardianCredential
OutcomeUnit
Settlement
Retirement
```

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
inspect current deed state
```

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
