# Ecorestore Network — M0–M7 Development

> **Status note:** this document narrates the intended arc of the project across all eight milestones. As of this writing, **M0 through M6 are actually implemented, tested, and committed** — see `docs/DEVELOPMENT_LOG.md` for the dated, authoritative record of what was built and validated at each step. **M7 has not started.** The M7 section below describes its planned scope (what it is meant to cover), not work already performed; `docs/M6_M7_READINESS_REPORT.md` has the concrete blocker list and backlog M7 must actually work through. Do not read this document as a claim that testnet or AWS deployment has occurred — it has not.

## Overview

This development takes Ecorestore Network from an initial architecture and prototype concept through a complete, testable application architecture for **spatially verified restoration finance**.

The system connects deterministic environmental verification with verification workflow, programmable settlement, indexed blockchain history, AI-assisted auditing, and a minimalist user interface.

The central design principle throughout the development is:

> **AI may assist with analysis and interpretation, but it does not determine the authoritative environmental result or directly control financial settlement.**

---

## M0 — Foundation

Established the repository structure, project documentation, development conventions, authority model, milestone plan, and security boundaries.

Defined the core architecture and explicitly separated:

* deterministic scientific verification
* Guardian verification workflow
* financial settlement
* blockchain history/indexing
* AI auditing
* user-interface presentation

The project also established the use of a **synthetic British Columbia restoration project** for demonstration purposes, preventing simulated environmental data from being represented as real observations.

---

## M1 — Deterministic Spatial Verification

Implemented the core environmental verification engine.

The verification pipeline includes:

```text
Evidence
→ Baseline
→ Parcel Observation
→ Matched Controls
→ Parallel-Trend Diagnostic
→ Difference-in-Differences
→ Additionality
→ Uncertainty
→ Lower-Bound Quantity
→ Quality Gate
→ VerificationResult
```

The verification engine is deterministic and versioned.

It includes explicit handling for:

* control matching
* contamination exclusion
* parallel-trend failure
* additionality
* uncertainty
* insufficient evidence
* invalid results
* deterministic settlement quantities

The resulting `VerificationResult` provides the canonical scientific output used by later system components.

---

## M2 — Hedera Guardian Layer

Added the Guardian layer as the methodology and verification-workflow boundary.

Guardian handles concepts such as:

* methodology identity
* evidence/provenance
* verification workflow
* verifier authorization
* verification credentials
* restoration outcomes

The architecture deliberately prevents Guardian from becoming a replacement for the deterministic scientific engine or the financial settlement authority.

Mock/local Guardian infrastructure was used where appropriate for prototype development, with live deployment clearly distinguished from simulated functionality.

---

## M3 — Arc RestorationDeed & Financial Settlement

Implemented the `RestorationDeed` smart contract and financial settlement architecture.

The contract provides:

* project/deed identity
* parcel identity
* methodology identity
* sponsor and beneficiary binding
* authorized verifier
* USDC escrow
* verification authorization
* settlement
* refund/failure paths
* replay protection
* state-machine enforcement
* settlement quantity controls

The contract does not reproduce the scientific calculations from M1.

Instead, it consumes an authorized verification result.

This establishes the critical security boundary:

```text
Scientific verification
        ↓
Guardian authorization
        ↓
Authorized settlement
        ↓
USDC
```

AI cannot directly determine or release settlement funds.

---

## M4 — Vertical Integration

Connected the M1 verification engine, Guardian layer, and Arc settlement layer into a coherent end-to-end application flow.

The integration was designed as a thin orchestration layer rather than another independent implementation of the scientific methodology.

The system was tested through a local blockchain environment using the real deterministic verification engine and appropriate local/mock infrastructure.

The development also established explicit terminology distinguishing:

* real implementation
* local implementation
* mocked components
* deferred live infrastructure

---

## M5 — The Graph & Auditor

Implemented the blockchain history/indexing and AI auditing layer.

The local development architecture became:

```text
Hardhat
   ↓
Local Graph Node
   ↓
Ecorestore Subgraph
   ↓
GraphQL
   ↓
TheGraphProvider
   ↓
Auditor
```

The subgraph was designed around actual `RestorationDeed` events rather than fabricated application data.

Indexed entities and relationships capture blockchain history such as:

* restoration deeds
* funding
* verification submissions
* settlements
* refunds
* cancellations
* project identity

The implementation explicitly avoids fabricating fields that are not exposed by the current contract events.

The Auditor provides:

* historical inspection
* project correlation
* verification inspection
* anomaly detection
* explanation
* orchestration

The Auditor is deliberately not a scientific or financial authority.

---

## M6 — React Interface, Operational Demo & Readiness

Added the user-facing React application and converted the underlying prototype into an operational demonstration.

The interface was designed to be:

* minimalist
* readable
* environmentally/GIS appropriate
* technically credible
* visually distinctive without excessive Web3 styling

The UI presents the actual system state rather than implementing a second scientific calculation.

M6 also established detailed operational documentation covering:

* prerequisites
* local setup
* services
* synthetic data
* environment variables
* demo execution
* troubleshooting
* system architecture

The application was run and reviewed as an actual browser-based demo rather than being validated only through unit tests.

A dedicated M6 → M7 readiness assessment identified remaining deployment, security, documentation, and production-readiness requirements.

---

## M7 — Hardening, Deployment & Release

M7 completes the development cycle by auditing and hardening the entire M0–M6 system.

The release work covers:

* full regression testing
* end-to-end demo validation
* security review
* smart-contract review
* scientific/reality review
* Graph integrity review
* Auditor authority review
* UI integrity review
* environment/secrets review
* deployment architecture
* AWS deployment preparation
* blockchain/testnet deployment
* Graph deployment
* operational documentation
* final release documentation

M7 also establishes a reproducible deployment path so that the project can be operated by a developer who was not involved in its construction.

---

# Final Architecture

The resulting architecture separates authority by responsibility:

| Component              | Authority                                |
| ---------------------- | ---------------------------------------- |
| M1 Verification Engine | Scientific result                        |
| Hedera Guardian        | Methodology / verification workflow      |
| RestorationDeed / Arc  | Financial settlement                     |
| The Graph              | Indexed blockchain history               |
| Auditor                | Inspection / orchestration / explanation |
| React                  | Presentation                             |

The system therefore follows:

```text
Environmental Evidence
        ↓
Deterministic Verification
        ↓
Canonical VerificationResult
        ↓
Guardian Verification Workflow
        ↓
Authorized Financial Settlement
        ↓
Blockchain Events
        ↓
The Graph
        ↓
Auditor
        ↓
React Interface
```

---

# Scientific & Data Integrity

The prototype uses synthetic British Columbia restoration data for demonstration.

The data is intentionally designed to resemble plausible environmental monitoring information while remaining explicitly identified as synthetic.

The application does not claim that the synthetic observations are actual satellite measurements, field measurements, regulatory credits, or compliance-grade environmental credits.

The verification quantity is generated by deterministic code rather than by an LLM.

---

# Security Model

A core security invariant throughout the development is:

> **No AI-generated numerical result can directly determine financial settlement.**

The Auditor can inspect, correlate, detect anomalies, and explain system state, but cannot independently authorize payment.

Similarly, the UI cannot become a financial or scientific authority.

The smart contract enforces the financial settlement boundary.

Known prototype limitations and non-production security assumptions are documented rather than hidden.

---

# Development Outcome

M0–M6 establish a complete, tested prototype architecture demonstrating how environmental restoration evidence can be connected to deterministic verification, verification provenance, programmable financial settlement, indexed blockchain history, and AI-assisted auditing. M7 (hardening, deployment, and release) is the planned next milestone — not yet started — that would carry this architecture toward a reproducible, real deployment.

The resulting system is intended as a **hackathon prototype and demonstration architecture**, with explicit separation between what is implemented, simulated, deployed, and deferred.
