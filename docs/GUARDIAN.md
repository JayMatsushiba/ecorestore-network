# Ecorestore Network — Hedera Guardian Integration

## 1. Purpose

Hedera Guardian provides the environmental methodology and verification workflow layer.

Guardian is not the scientific calculation engine and is not the financial settlement authority.

Guardian policies define roles, schemas, workflows and verification-related state.

---

## 2. Authority Boundary

```text
Ecorestore Verification Engine
        ↓
canonical VerificationResult
        ↓
Guardian policy / verifier workflow
        ↓
authorized verification
        ↓
Arc Restoration Deed
```

Guardian consumes the deterministic result.

It does not independently calculate the scientific result.

---

## 3. Intended Responsibilities

Guardian will eventually manage:

* project verification workflow;
* evidence schemas;
* verifier roles;
* verification credentials;
* approval state;
* restoration outcome state;
* relevant lifecycle/provenance.

Guardian policies provide roles, schemas, workflows and rules for environmental processes.

---

## 4. Verification Result

Guardian should receive a structured, versioned result from Ecorestore.

The result should include:

* methodology version;
* parcel H3 root;
* metric;
* measured change;
* additionality-adjusted result;
* uncertainty interval;
* lower bound;
* quality status;
* evidence commitment.

---

## 5. Security Boundary

Guardian authorization does not allow an AI agent to bypass the deterministic result.

The verified result is an input to the environmental verification workflow.

Financial execution remains outside Guardian.

---

## 6. Financial Separation

Guardian must not be treated as the mechanism that releases Arc funds.

The Arc Restoration Deed remains the financial authority.

This separation avoids coupling environmental methodology to financial custody.

---

## 7. M0

M0 only establishes interfaces and documentation.

Do not install or deploy Guardian merely to create the M0 scaffold.

---

## 8. M2

M2 will define:

1. Guardian schemas;
2. policy roles;
3. verification workflow;
4. deterministic result ingestion;
5. verifier approval;
6. credential/outcome representation;
7. integration tests.

Implementation decisions must be checked against the current Guardian documentation before integration.

---

## 9. M2 Implementation Notes

This section documents what M2 actually built in `guardian/`. It supersedes §8 as the record of what was delivered.

### 9.1 What "Guardian" means in M2

There is no live Hedera Guardian deployment, no Guardian policy engine, and no Hedera network calls in M2. `guardian/adapter.ts` defines a `GuardianAdapter` TypeScript interface — the integration boundary a real Guardian policy/SDK integration would implement later — and `MockGuardianAdapter`, a deterministic in-memory implementation of that interface used for this milestone and its tests. Every other file under `guardian/` (models, identifiers, validation, policy registries, schemas) is real logic, not a stub — only the *transport* to an actual Hedera Guardian instance is absent, by design (M2 prompt §3: "implement a clean adapter boundary and deterministic mock/test implementation instead").

### 9.2 Guardian data model (`guardian/models.ts`)

- **`EvidenceSubmission`** — a project/parcel identity plus the M1 `evidenceHash`. Thin by design (§9.5).
- **`VerificationSubmission`** — every field copied verbatim from the M1 `VerificationResult` that produced it (`methodologyVersion`, `metric`, `verificationStatus`, `qualityGateStatus`, `settledQuantity`, `lowerBound`, `evidenceHash`), plus two Guardian-derived fields: `financiallyEligible` (`true` iff `qualityGateStatus === "PASS"` — never independently computed) and `lifecycleState`.
- **`AuthorizedVerification`** — a workflow attestation that an authorized verifier reviewed a financially-eligible submission. Explicitly **not** financial authorization (§6 below).
- **`GuardianCredential`** — a workflow-level credential referencing the verification result, the verifier, and Guardian's own policy version (`GUARDIAN_POLICY_VERSION`, distinct from the M1 methodology version — see §9.7).
- **`RestorationOutcome`** — the verified restoration outcome. `status: "RECORDED"` is the only value M2 produces; reversal is a documented future extension (M3+, once Arc/persistence-tranche integration exists).
- **`LifecycleState`** — `EVIDENCE_SUBMITTED → VERIFICATION_SUBMITTED → VERIFICATION_AUTHORIZED → CREDENTIAL_ISSUED → OUTCOME_RECORDED`, monotonic (never regresses) and keyed by `(projectId, parcelH3Root)`, not by verification-result identity — because evidence can be submitted before any verification result exists for that parcel.

None of these types duplicate the full `VerificationResult`. Wherever an operation needs to re-validate against the complete result (tamper detection — §9.6), the caller re-supplies it; it is never stored a second time inside a Guardian record.

### 9.3 Deterministic identifiers (`guardian/identifiers.ts`)

`computeVerificationResultId` hashes the *entire* `VerificationResult` (SHA-256 over a canonicalized, key-sorted JSON encoding, including nested objects like `uncertainty` and `diagnostics`) so that a mutation anywhere in the structure changes the identifier. `computeEvidenceSubmissionId`, `computeCredentialId`, and `computeOutcomeId` hash the smaller Guardian-specific tuples that identify those records. These are **not** Hedera Consensus Service timestamps, not Hedera DIDs, and not a production content-addressing scheme — see §9.9.

### 9.4 Policy registries (`guardian/policy/`)

- **`methodologyRegistry.ts`** defines `GUARDIAN_POLICY_VERSION = "ecorestore-guardian-m2-v0.1"` (this Guardian workflow policy's own version) and `SUPPORTED_METHODOLOGY_VERSIONS = ["ecorestore-m1-v0.1"]` (an explicit allowlist of M1 methodology versions Guardian will accept). A result produced under any other version — including a real M1 configuration variant not on this list — is rejected at submission. Guardian does not reinterpret or trust an unrecognized methodology's numbers.
- **`verifierRegistry.ts`** is a hard-coded, in-code allowlist of one authorized verifier id (`guardian-verifier-kootenay-001`), standing in for Guardian's real identity/role infrastructure. See §9.8 for what production would replace this with.

### 9.5 Schemas (`guardian/schemas/`)

`validateEvidenceSubmissionInput` and `validateVerificationResultShape` are structural checks only — required identity fields present and non-empty (`projectId`, `parcelH3Root`, `methodologyVersion`, `evidenceHash`). They are **not** a re-implementation of M1's scientific input validation and **not** a JSON Schema engine; no schema-validation library was added (M2 prompt §18).

### 9.6 Workflow validation (`guardian/validation.ts`)

`validateMethodologyVersion` checks the allowlist above. `validateSubmissionIntegrity` re-derives `computeVerificationResultId` from whatever `VerificationResult` object is presented at authorization time and compares it to the identity recorded when the submission was first accepted. A mismatch — for example, a `settledQuantity` altered after submission but presented under the original submission id — is rejected as tampering. This is a **structural equality check**, not a cryptographic signature; see §9.9.

### 9.7 The adapter and its workflow (`guardian/adapter.ts`)

`GuardianAdapter` exposes: `submitEvidence`, `submitVerificationResult`, `authorizeVerification`, `issueCredential`, `recordOutcome`, `getLifecycleState`. `MockGuardianAdapter` implements it with plain in-memory `Map`s and no internal clock/randomness — every timestamp is caller-supplied and every identifier is either deterministically derived or caller-supplied (verifier ids).

Rejection points, in the order they're checked:

1. **`submitVerificationResult`** rejects outright (no workflow record created) if: a required identity field is missing (`validateVerificationResultShape`); the methodology version isn't on the allowlist (`validateMethodologyVersion`); or `qualityGateStatus === "INVALID_RESULT"` — the pipeline itself flagged its own output as untrustworthy, which Guardian treats as not a reviewable claim at all, not merely an unfavourable one.
2. An `INSUFFICIENT_EVIDENCE` result **is** accepted as a submission (useful audit trail — a restorer may resubmit better evidence later) but is marked `financiallyEligible: false`, and no later call in the adapter can move it forward.
3. **`authorizeVerification`** requires, in order: a matching prior submission; `validateSubmissionIntegrity` to pass (tamper check); the verifier to be on the allowlist; and `financiallyEligible === true`. Any failure is rejected with a specific reason string.
4. **`issueCredential`** requires a prior authorization, and that the credential be requested by the *same* verifier who authorized it.
5. **`recordOutcome`** requires a prior credential.

Two design choices not spelled out verbatim by the M2 prompt, made explicit here:

- **`getLifecycleState(projectId, parcelH3Root)`**, not `getLifecycleState(verificationResultId)`. The prompt's model list doesn't fix this signature, and keying by verification-result identity can't represent the `EVIDENCE_SUBMITTED` stage (evidence precedes any verification result). Keying by project+parcel makes the full five-stage lifecycle representable end to end.
- Guardian **accepts but flags** `INSUFFICIENT_EVIDENCE` (rather than rejecting the submission outright, as it does for `INVALID_RESULT`). This distinguishes "the pipeline broke" from "the pipeline ran correctly and found the evidence wanted more support" — the latter is a legitimate, auditable workflow state.

### 9.8 Mock versus real integration

| Concern | M2 (mock) | Production |
|---|---|---|
| Guardian workflow engine | In-memory `Map`s in `MockGuardianAdapter` | Deployed Guardian policy on Hedera |
| Verifier identity | Hard-coded id allowlist (`verifierRegistry.ts`) | Hedera DID-based verifier credentials, issued/checked by policy |
| Record identifiers | SHA-256 over canonical JSON (`identifiers.ts`) | Hedera Consensus Service timestamps / message IDs |
| Tamper detection | Structural hash re-comparison (`validation.ts`) | Signed HCS messages / policy-enforced immutability |
| Evidence/result schema | Minimal identity-field presence checks | Full Guardian policy schema (per-tier fields, units, provenance) |
| Persistence | None — process memory only | Guardian's own ledger-backed state |

### 9.9 Known limitations

- No cryptographic binding proves a `VerificationResult` handed to `submitVerificationResult` actually came from `verifyProject()` — Guardian trusts the shape and methodology-version allowlist, not a signature. A production system would have M1 sign its output (see docs/DEVELOPMENT_LOG.md M2 entry for the specific test covering this gap, Test G).
- `parcelH3Root`/`evidenceHash` inherit M1's own placeholder identifiers (see docs/VERIFICATION.md §16.11) — Guardian does not add real spatial or content-addressing guarantees on top of them.
- Single verifier role (`environmental_verifier`); no multi-role review chain (e.g. reviewer → approver).
- No credential/outcome revocation or reversal path yet (only forward lifecycle transitions).
- No real Hedera Consensus Service submission, no Guardian policy JSON, no DID infrastructure.

### 9.10 Relationship to M1 and to future Arc integration

Guardian never recomputes, edits, or overrides `settledQuantity`, `uncertainty`, or `qualityGateStatus` — every numeric field on a Guardian record is copied verbatim from the M1 `VerificationResult`, and `financiallyEligible` is a direct, undisguised function of `qualityGateStatus === "PASS"`. Guardian's `AuthorizedVerification` and `GuardianCredential` are workflow attestations, not financial authorizations — nothing in `guardian/` releases funds or touches Arc escrow.

**Update (M4):** the wiring this section originally described as future work is now built. `integration/restorationSettlementFlow.ts`'s `prepareSettlementAuthorization` sequences a real `verifyProject()` call into this adapter's `submitVerificationResult` → `authorizeVerification` → `issueCredential`, then hands the resulting `GuardianCredential` to `arc/payload.ts`'s `buildVerificationAuthorization`, which `RestorationDeed.submitVerification` (docs/ARC.md) consumes on a local Hardhat network. This is a Mock Guardian adapter wired end to end with the real M1 engine and a locally-deployed Arc contract — not a live Hedera Guardian deployment. See `docs/DEVELOPMENT_LOG.md`'s M4 entry and `contracts/tests/endToEnd.test.cjs` for the executed chain.
