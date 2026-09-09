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
