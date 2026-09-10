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

## 7. The ATS seam — how Guardian and the token connect

**Guardian is the issuance authority. ATS is the instrument.** Guardian decides whether
and how much to issue and carries the provenance; ATS is what the buyer holds and
transfers.

A completed Guardian policy run produces a **Verifiable Presentation** bundling the
trust chain, each VC DID-signed, pinned to IPFS, written to an HCS topic,
hash-addressable. **ERC-1643 exists precisely to bind off-chain compliance documents to
a token, and a Guardian VP is an off-chain compliance document:**

```text
setDocument(
  name         = "guardian-trust-chain-v1"
  uri          = ipfs://bafy...            (the VP)
  documentHash = keccak256(VP)
)

issueByPartition(
  partition    = keccak256(h3_root, window_start, window_end)   // the vintage
  holder       = sponsor
  value        = settled_quantity                              // lower bound
  data         = abi.encode(vp_hash, hcs_topic_id, hcs_seq_no)
)
```

**What guarantees the seam is public verifiability, not on-chain enforcement.** HCS
messages are not readable from Hedera's EVM, so no contract can check the VP. The mint
records the VP hash and HCS message ID, and anyone can fetch the HCS message, fetch the
IPFS document, re-hash, and confirm the token corresponds to a real completed policy
run. This is the same reproducibility argument the spatial pipeline makes.

Persistence re-verification maps onto a Guardian `timer` block; the Ecorestore verdict
enters through an `externalDataBlock`.

---

## 8. The VVB tension

Guardian's trust model is built around **a human VVB approving submissions** — the thing
this project argues should be computed.

The resolution: **the pipeline does not remove the VVB, it changes what the VVB
reviews** — from "is this claim form plausible?" to "is the pipeline correctly
configured, is the pre-registered analysis plan honoured, and is the parallel-trend
diagnostic passing?" That is a role a registry would accept.

---

## 9. Build plan — design C, build B

Guardian is ~10 microservices plus MongoDB, IPFS, a vault and a Standard Registry
testnet account: realistically 1-3 days to stand up and 2-4 days to author a minimal
real policy. **The delivered stack does not run Guardian, and no policy exists.** §10
records what the seam has been exercised against: a quickstart instance the operator
starts separately, which acknowledged delivery but ran nothing.

Instead, at M4:

1. **Publish the verdict VC schema** as a Guardian-compatible JSON schema in the repo.
2. **Emit the verdict as a signed VC** against that schema.
3. **Bind that VC into the ATS token via a real `setDocument()` call** at issuance,
   partition set to the vintage — the Ecorestore verifier occupying the slot Guardian
   would occupy.
4. **One diagram and one paragraph** showing Guardian dropping into that slot.

"We plan to integrate Guardian" is a promise. A working ERC-1643 binding of a signed
verdict VC into a partitioned token, with the drop-in point specified, is a demonstrated
architecture with a credible path.

Implementation decisions must be checked against the current Guardian documentation
before integration.

## 10. Implementation state (2026-09-10)

Steps 1–3 of §9 exist in `guardian/`:

- `schema/verification-result.vc.schema.json` — the verdict schema (draft-07).
- `adapter.ts` — Ed25519 `did:key` verifier identity; the verdict wrapped as a W3C VC
  with a detached-JWS proof; `verifyVerdictCredential()` for anyone holding the VC;
  a Verifiable Presentation carrying the full result; and `buildExternalDataRequest()`
  producing the documented `POST /api/v1/external/{policyId}/{blockTag}` body
  (`owner`, `policyTag`, `document`). With `GUARDIAN_URL` unset the request is written
  to `guardian/outbox/` and reported as **not submitted**.
- `issuance.ts` — ERC-1643 `setDocument` and ERC-1410 `issueByPartition` calldata for
  the vintage partition, returned with `broadcast: false`. No Hedera account or ATS
  deployment is configured; nothing is minted.

The Guardian drop-in point is recorded in every presentation: `externalDataBlock` for
ingest, the VVB review scope, `timerBlock` for persistence, `mintDocumentBlock` for the
amount.

### Attachment to a locally run Guardian — validated 2026-09-10

Nothing in this repository starts Guardian. `docker-compose.override.yml` attaches
`verify` — and only `verify` — to the Docker network of a Guardian quickstart that the
operator runs separately (`DEPLOYMENT.md` §7.6); if that network does not exist, the
stack is brought up with `-f docker-compose.yml` alone and Guardian requests are staged
to the outbox.

That attachment was exercised on 2026-09-10 against a Guardian 3.7.0 quickstart. Each
verdict was POSTed to `/api/v1/external/{policyId}/{blockTag}` through Guardian's web
proxy — the same server exposed on `localhost:3000` — and the gateway answered `200` on
all three scenarios. That is a validation result, not a component of the delivered
system.

Two things that `200` did not mean, stated so the seam is not overstated:

- **No policy exists.** The policy ID is the placeholder `ecorestore-policy-not-deployed`.
  Guardian's external endpoint queues the document and acknowledges before the policy
  engine looks for the policy, so it returns `200` regardless. The adapter and the
  interface describe the outcome as *gateway acknowledged*, never as a completed run.
- **Steps 4–5 of §9 remain.** Authoring a policy with an `externalDataBlock` tagged
  `ecorestore_verdict_ingest`, registering the verifier DID against it and publishing it
  are Guardian-side work not yet done. Until then, `submitToGuardian()` proves delivery;
  the ERC-1643 binding remains the demonstrated seam.

`submitToGuardian()` now distinguishes three outcomes: `sent` (any HTTP answer, with the
status), `outbox` (`GUARDIAN_URL` unset), and `failed` (configured but unreachable; the
request is staged to the outbox as well).
