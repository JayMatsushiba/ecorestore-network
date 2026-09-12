# Ecorestore Network — Architecture

## 1. Purpose

Ecorestore Network connects deterministic ecological verification to programmable restoration finance.

The architecture deliberately separates:

1. scientific verification;
2. environmental methodology and verification workflow;
3. financial settlement;
4. blockchain indexing;
5. AI orchestration;
6. presentation.

The system must remain understandable and independently testable at each boundary.

---

## 2. Authority Model

| Component                      | Authority                                                               |
| ------------------------------ | ----------------------------------------------------------------------- |
| Ecorestore Verification Engine | Scientific result                                                       |
| Hedera Guardian                | Environmental methodology, workflow, credentials and verification state |
| Arc Restoration Deed           | Financial settlement                                                    |
| The Graph                      | Indexed history / read layer                                            |
| Auditor Agent                  | Orchestration, investigation and explanation                            |
| React UI                       | Presentation only                                                       |

### Critical invariant

**No AI-generated numerical result may directly determine financial settlement.**

The settlement path is:

```text
Evidence
  ↓
Deterministic Verification Engine
  ↓
Canonical VerificationResult
  ↓
Guardian verification workflow
  ↓
Authorized verification
  ↓
Arc Restoration Deed
  ↓
USDC settlement
```

The Auditor may invoke the deterministic engine and explain its result, but cannot independently alter the result or release funds.

---

## 3. Intended Architecture

```text
                    React UI
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
   Verification     Guardian         Graph
      Results       Workflow        History
        │              │              │
        └──────────────┼──────────────┘
                       │
                    Auditor
                       │
                       ▼
            Deterministic Engine
                       │
                       ▼
              Canonical Result
                       │
                       ▼
                 Arc Deed
                       │
                       ▼
                    USDC
```

---

## 4. Synthetic Demonstration Environment

The hackathon prototype uses one synthetic British Columbia restoration project.

All synthetic evidence must be explicitly labeled:

> SYNTHETIC DEMONSTRATION DATA — NOT REAL FIELD, SATELLITE, SENSOR OR REGULATORY MEASUREMENT.

Synthetic data exists to make the deterministic verification pipeline testable and reproducible during the hackathon.

It must never be presented as actual environmental measurement.

---

## 5. Spatial Identity

H3 provides the spatial identity layer.

The prototype uses:

* canonical H3 resolution;
* deterministic cell-set encoding;
* parcel H3 root;
* geometry hash;
* evidence hash/CID.

Polygon geometry remains off-chain.

---

## 6. Evidence

The conceptual evidence ladder remains:

```text
Tier 0 — Satellite
Tier 1 — Drone / UAS
Tier 2 — IoT / in-situ
Tier 3 — Ground reports
```

For M1 these are represented by controlled synthetic fixtures.

The future production system may ingest real Sentinel-2, Sentinel-1, Landsat, drone, IoT and field evidence.

---

## 7. Component Boundaries

### Verification

Owns:

* evidence normalization;
* baseline;
* parcel observations;
* control matching;
* parallel-trend diagnostics;
* difference-in-differences;
* additionality;
* uncertainty;
* lower-bound settlement quantity;
* quality gates;
* canonical `VerificationResult`.

Does not own:

* payment;
* wallets;
* blockchain authorization;
* AI reasoning.

### Guardian

Owns:

* methodology;
* policy workflow;
* verifier roles;
* evidence/credential structure;
* verification state;
* restoration outcome lifecycle.

Guardian does not become the scientific calculation engine.

### Arc

Owns:

* Restoration Deed;
* USDC escrow;
* milestone conditions;
* authorized verification;
* release/withholding.

Arc is the financial authority.

### The Graph

Owns:

* indexed project history;
* deed history;
* verification history;
* evidence references;
* settlement history;
* outcome lifecycle.

The Graph is a read/index layer, not the scientific authority.

### Auditor

May:

* inspect evidence;
* query project history;
* invoke deterministic verification;
* identify anomalies;
* explain results;
* orchestrate workflow.

May not:

* invent measurements;
* alter verification quantities;
* bypass verification;
* release sponsor funds.

---

## 8. M0 Boundary (historical)

M0 established architecture and interfaces only, and at that point did not implement:

* satellite processing;
* control matching;
* difference-in-differences;
* additionality;
* uncertainty;
* Guardian integration;
* Arc integration;
* Graph indexing;
* AI agent;
* x402;
* production financial settlement.

**This list describes M0's scope at the time, not the project's current state.** Control matching, DiD, additionality, uncertainty, Guardian integration, Arc integration, the M4 local vertical integration connecting all three into one executable chain, the M5 local Graph Node indexing + Auditor correlation layer, and the M6 React presentation layer are implemented as of M1-M6 — see `docs/DEVELOPMENT_LOG.md` for the authoritative, dated record of what is actually built, tested, and committed, and `docs/M6_M7_READINESS_REPORT.md` for the deployment-readiness assessment. The AI agent's own reasoning/orchestration, x402, live Hedera Guardian/Arc deployment, hosted/decentralized Graph Network deployment, AWS, and production financial settlement remain not implemented, per the milestone sequence.

---

## 9. Design Principle

Keep the architecture lean.

Every component must have a clear reason to exist.

Partner technologies must be load-bearing rather than decorative.

---

## 10. M6 Presentation Layer Implementation Notes

M6 added exactly two components, both strictly at the presentation boundary:

- **`app/`** — a Vite/React/TypeScript single-page application. Reads from `server/`'s HTTP API only; contains no verification, Guardian, Graph, or financial logic of its own, and holds no signing key.
- **`server/`** — a thin, read-mostly Node HTTP layer whose only reason to exist is that a browser cannot directly execute the Node-based M1-M5 modules (`node:crypto`, `node:fs`, process-local adapter state). Every route calls the real function (`verifyProject`, `MockGuardianAdapter`, `buildVerificationAuthorization`, `TheGraphProvider`, `auditDeed`) and serializes its actual return value — it recomputes nothing and holds no signing key, so it cannot authorize or settle anything even though it runs on a server rather than in the browser.

Neither component moves or narrows any authority boundary defined in §2 above. See `docs/DEMO.md` §8 for what was actually run and verified, and `docs/M6_M7_READINESS_REPORT.md` for the full security/deployment review.
