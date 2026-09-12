# Ecorestore Network — Restoration Auditor

## 1. Purpose

The Restoration Auditor is a focused AI orchestration component.

It is not a scientific authority and is not a financial authority.

---

## 2. Responsibilities

The Auditor may:

* inspect evidence;
* retrieve project history;
* query The Graph;
* invoke deterministic verification;
* compare claims against evidence;
* identify anomalies;
* explain verification results;
* orchestrate approved workflows.

---

## 3. Non-Responsibilities

The Auditor must not:

* generate settlement quantities;
* modify a VerificationResult;
* override quality gates;
* approve its own verification;
* release sponsor funds;
* bypass Guardian authorization;
* bypass Arc contract rules.

---

## 4. Inputs

Potential inputs:

```text
project
deed terms
claim
evidence bundle
verification result
project history
```

---

## 5. Deterministic Boundary

The Auditor calls the verification engine.

It does not recreate the calculations in natural language.

Example:

```text
Auditor:
"Run verification for project X."

Verification Engine:
{
  verificationStatus: "VERIFIED",
  settledQuantity: 12.4,
  ...
}

Auditor:
"The result is VERIFIED because..."
```

The Auditor explains the result rather than becoming the result.

---

## 6. M0

Create only the interface boundary.

Do not implement an LLM agent.

Do not connect API keys.

Do not connect wallets.

Do not connect payment systems.

---

## 7. M5

M5 implements the Auditor after the deterministic verification engine, Guardian boundary, Arc boundary and Graph history are sufficiently stable.

---

## 8. M5 Implementation Notes

This section documents what M5 actually built in `auditor/agent.ts`. It supersedes §1-§7 as the record of what was delivered.

### 8.1 Provider boundary

The Auditor's only path to on-chain-indexed history is a `GraphProvider` (`graph/provider.ts`), injected by the caller — `auditDeed({ graphProvider, deedId, ... })` never constructs its own provider or reaches for a hardcoded endpoint. In production use this is `TheGraphProvider` (real GraphQL against a local Graph Node, see `docs/GRAPH.md`); tests use `FixtureGraphProvider` (deterministic in-memory). The Auditor never queries Postgres, Graph Node's internal storage, or Hardhat event logs directly — only `GraphProvider`'s four read methods.

### 8.2 What `auditDeed` does

Given a `deedId` (and, optionally, the real off-chain M1 `VerificationResult` and/or M2 `GuardianCredential` the caller already has), it:

1. Retrieves the deed's full indexed history via `GraphProvider.getDeedHistory`.
2. Checks deed &harr; verification identity: the deed's `verificationId` must resolve to an actually-indexed `Verification` entity.
3. Checks deed state &harr; settlement event: a `SETTLED` deed must have exactly one indexed `Settlement`, whose `settlementAmount` must equal both the deed's own recorded `settlementAmount` **and** an independent recomputation of `settledQuantityScaled x unitPriceUSDC / 10^quantityDecimals` (mirroring `RestorationDeed.sol`'s own `Math.mulDiv` call) — this re-derives an already-settled on-chain arithmetic result to detect indexing corruption; it is not a new financial calculation and never influences anything (§3 below).
4. If a `Settlement`'s linked `Verification` is indexed as `financiallyEligible=false`, that is flagged directly — the contract's own state machine should make this impossible, so finding it would indicate serious indexing/data corruption.
5. If a real M1 `VerificationResult` is supplied, the indexed `settledQuantityScaled` is compared against `scaleQuantity(verificationResult.settledQuantity, quantityDecimals)` — the same scaling function `arc/payload.ts` itself uses, not a reimplementation — to confirm the on-chain quantity traces back to the real M1 output.
6. If both a `VerificationResult` and `GuardianCredential` are supplied, their `methodologyVersion` fields are compared directly. **This is an off-chain-only check** — see `docs/GRAPH.md` §7.5 for why the Graph cannot also expose the on-chain `methodologyVersion` for a second, independent cross-check; that field is not indexed due to a confirmed graph-node/Hardhat RPC incompatibility, not a design omission.

Every check produces an `Anomaly` (a code + message), never a thrown error and never a repair. The overall `AuditReport.status` is `CONSISTENT`, `ANOMALOUS`, `NOT_FOUND` (no such deed indexed), or `DATA_UNAVAILABLE` (the Graph itself could not be reached — caught via `GraphUnavailableError`, not left to crash the caller).

### 8.3 Authority boundary — verified directly, not just documented

Every function in `auditor/agent.ts` is `async function auditDeed(...): Promise<AuditReport>` — read-only, no mutation of the `GraphProvider`'s data (tested directly: `auditor/tests/agent.test.ts`'s "never mutates the graph provider's data" test), no call into `guardian/`'s adapter, no call into `arc/` or `RestorationDeed.sol`, no LLM or natural-language component of any kind. It cannot calculate M1 scientific truth (it never calls `verifyProject`), cannot modify a `VerificationResult` (it only ever reads one supplied by the caller), cannot choose or alter a settlement quantity (every quantity it touches already exists in indexed history or a supplied M1 result), cannot authorize a verification or settlement (no write path exists to any of those), and cannot release funds (nothing in this module ever constructs a transaction).

### 8.4 Error handling

A Graph outage, a nonexistent deed, and every detected data inconsistency all return a normal `AuditReport` value — never a thrown exception the caller must catch, and never an automatic retry or repair. This matches the M5 prompt's failure-handling requirement directly (`docs/DEVELOPMENT_LOG.md`'s M5 entry lists the exact scenarios tested: Graph unavailable, missing deed, deed/verification identity mismatch, settlement amount mismatch, settlement referencing an ineligible verification, off-chain/on-chain quantity mismatch, off-chain methodology mismatch).

### 8.5 Future AWS runtime

`auditor/agent.ts` has no AWS dependency of any kind — no SDK, no deployment, no runtime assumption beyond plain Node.js/TypeScript. The eventual production architecture (`docs/ARCHITECTURE.md`) places an AWS-hosted API in front of this same Auditor logic; M5 only keeps the module itself free of anything that would make that future hosting step harder, without building any part of it now.

### 8.6 AI boundary

No LLM, prompt, or natural-language generation exists anywhere in `auditor/agent.ts` as of M5 — `explanation` strings are plain template interpolation over already-computed values, not model output. Introducing an LLM to phrase `AuditReport.explanation` more richly is plausible future work (deferred), but it must remain bound by §3/§8.3 above: explaining a result, never becoming one.

### 8.7 Known limitations

- The methodology cross-check is off-chain-only (§8.2 step 6) — see `docs/GRAPH.md` §7.5.
- The Auditor does not (yet) aggregate anomalies across multiple deeds/projects, or persist audit history — each `auditDeed` call is a fresh, stateless read.
- No LLM-based explanation generation exists (§8.6) — explanations are template strings.
