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
* bypass Arc contract rules;
* select or re-select the control set — it is drawn by the pre-registered rule.

---

## 4. Inputs

Potential inputs:

```text
project
deed terms              incl. analysis_plan_hash
claim
evidence bundle         tier, real | simulated
verification result
project history         prior claims, verdicts, payments, reversals,
                        and VERIFICATION RUN COUNT
```

A parcel with a prior reversal, a repeatedly-revised claim, ground reports that
consistently overshoot corroborated measurement, **or eleven verification runs behind
one submitted result**, is scored differently from a clean one.

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

## 6. Implementation state (2026-09-10)

`auditor/agent.ts` holds the boundary: rule-based `detectAnomalies()` (run count behind
submitted results, prior reversals, over-claim, regional greening, leakage, coverage
below nominal, IoT flatline, synthetic Tier 0, gate failures) and a deterministic
`templateNarrator` behind the `AuditorNarrator` interface an LLM would implement at M5.

No LLM agent, no API keys, no wallets, no payment systems. Every number in the
narrative is copied from the canonical result.

---

## 7. M5

M5 implements the Auditor after the deterministic verification engine (M2), the Arc
contracts (M1), the vertical slice (M3) and Graph history are sufficiently stable.

The verdict is emitted as structured JSON **and** as a signed W3C VC against the
published Guardian-compatible schema, so it can be bound into the outcome token via
`setDocument()`.
