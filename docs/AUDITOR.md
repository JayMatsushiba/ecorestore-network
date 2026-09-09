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
