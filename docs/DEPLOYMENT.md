# Ecorestore Network — Deployment

## 1. Purpose

This document describes how the demonstration is intended to run on AWS as a live,
publicly reachable deployment, alongside a Hedera Guardian instance.

Nothing described here is deployed. This is a plan, not a record. §12 states the actual
implementation state.

The deployment is deliberately layered so that the expensive and security-sensitive
tiers can be omitted without breaking the demonstration. The application degrades to
static evidence rather than failing.

---

## 2. Topology

```text
                 CloudFront ──► S3          static React app + assurance bundles
                      │
                      ▼
              (optional) Lambda             on-demand verification, ~1.4 s / 3 scenarios
                      │
        ┌─────────────┴──────────────┐
        ▼                            ▼
   Arc Testnet                  EC2: Guardian              20+ containers, compose
   RestorationDeed              api-gateway (private)      MongoDB, NATS, Valkey, IPFS
   chain 5042002
```

Five tiers, in descending order of importance to the demonstration and ascending order
of cost:

| Tier | Service | Required? |
|---|---|---|
| Application | S3 + CloudFront | Yes |
| Settlement | Arc Testnet | Yes — this is the product claim |
| Verification | Lambda | Only for on-demand runs |
| Methodology | EC2 running Guardian | Only for live policy execution |
| Payment | x402 gateway (Hedera) | Only if the API is monetised — see `X402.md` |

---

## 3. Application tier

The React application is static. `npm run build` in `app/` produces `app/dist`; serve it
from S3 behind CloudFront.

The three assurance bundles total ~130 KB, so the evidence the application displays can
ship as static assets alongside it. No backend is required to show a completed
verification.

Two things must be set before the first deploy:

* `base` in `app/vite.config.ts`, if the application is served from any path other than
  the distribution root. `App.tsx` resolves bundle paths through
  `import.meta.env.BASE_URL`; the value is currently unset.
* the copy step from `out/demo/` into `app/public/demo/`, which is presently manual.

---

## 4. Settlement tier

Settlement runs on **Arc Testnet** (chain id 5042002, RPC `https://rpc.testnet.arc.io`,
explorer `https://testnet.arcscan.app`).

Do not run a demonstration chain on AWS. A hosted `anvil` is another service to operate,
another state store to lose, and it weakens the claim: a transaction on Arc Testnet is
evidence, a transaction on a private chain is a screenshot.

`contracts/script/Deploy.s.sol` performs the deployment. Set `USDC_ADDRESS` to the Arc
Testnet USDC interface; when unset the script deploys `MockUSDC`, which is correct for
local work and wrong for a public demonstration.

This tier is the M1 deliverable. **The AWS deployment depends on it and cannot precede
it** — see §7 of `ARC.md`.

---

## 5. Verification tier

Full verification of all three scenarios — including a 2000-iteration bootstrap and 40
placebo runs per scenario — completes in **1.4 s wall, 153 MB peak resident**.

That is small enough that on-demand verification is feasible in Lambda (1 GB memory
setting) rather than requiring a long-running service. It is also small enough that it
does not need to run live at all.

Default: **do not deploy this tier.** Pre-compute the bundles, ship them with the
application, and the demonstration is complete.

One thing would remove the choice: **monetising the API with x402 makes this tier
mandatory**, because selling access to a verification commits the project to operating
the service that performs it. The payment layer is edge middleware in front of this tier,
documented in `X402.md`.

x402 is optional and demoted (`DECISIONS.md` §2), and it carries a condition that is not a
deployment detail: metered per-request verification recreates the specification-search
incentive pre-registration exists to close, so it may only ship coupled to plan
commitment and on-chain run-count recording, and **every verification sold must be a
recorded verification** — no unrecorded preview tier. See `X402.md` §5 before planning
this tier.

Deploy it only if a visitor is meant to trigger a fresh verification. In that case use a
Lambda **container image** rather than a zip: the pinned runtime is the point. The
engine's determinism guarantee is a same-process guarantee — `Math.sin`, `Math.cos`,
`Math.log` and `Math.exp` are not required by ECMAScript to be correctly rounded, so
`resultHash` is reproducible on a given V8 and not guaranteed across Node versions. A
pinned image makes the verification runtime an artefact that can be cited.

---

## 6. Methodology tier

Guardian is a 20+ microservice platform (gateway, auth, policy, worker, notification,
logger, analytics, indexer, MongoDB, NATS, Valkey, IPFS). It is configured through files
inside its own tree and is operated from its own repository.

**Guardian is not vendored into this repository and is not a submodule.** It is cloned
as a sibling checkout and run from its own `docker-compose-quickstart.yml`. The pinned
tag or commit this project has been tested against belongs in `.env.example` and in
`GUARDIAN.md`, not in a gitlink. The integration surface is one HTTP POST; there is no
source-level dependency to pin.

Sizing: quickstart on a single EC2 instance with at least 16 GB of memory (`t3.xlarge`,
or `t3.2xlarge` if constrained), MongoDB on EBS. Do not decompose the services into
individual ECS task definitions for the demonstration.

Prerequisites: a Hedera testnet account with an ED25519 DER-encoded keypair, an IPFS
provider (local Kubo, Storacha, or a Filebase bucket), and RSA-2048 JWT keypairs.

The `externalDataBlock` endpoint only accepts a document once a policy containing a block
tagged to match `GUARDIAN_BLOCK_TAG` has been **published**, with the verifier DID
registered against it. `scripts/demo.ts` defaults that tag to `ecorestore_verdict_ingest`.
Standing up the containers is necessary but not sufficient.

### Degraded mode is a supported state

With `GUARDIAN_URL` unset, `submitToGuardian()` writes the exact request to
`guardian/outbox/` and reports `GUARDIAN_URL not set; request written to outbox and NOT
submitted`. The demonstration remains honest in this mode: it shows the request that
would be sent and states plainly that no policy run occurred.

Running twenty containers continuously so that one POST returns 200 is a real trade
against the demonstration's value. Consider running this tier only during a judging
window.

---

## 7. Container architecture (split pipeline)

This section describes a **proposed** architecture, not the current one. The pipeline is
today a single TypeScript process. Splitting the spatial analysis into Python is an
architectural change and requires explicit approval before it is built (`CLAUDE.md`).

It is recorded here because the deployment topology differs materially under it, and
because the boundary between the two runtimes has one constraint that is easy to get
wrong and silent when violated.

### 7.1 The constraint

A hash commits to **bytes**, not to data. Exactly one implementation may turn a result
into bytes; every other participant treats the resulting hash as opaque.

`RestorationDeed.sol` already demonstrates the pattern. It contains no `keccak256` call
and no `abi.encode`: it compares `bytes32` values it was handed and never re-derives
them. The EVM is therefore a second runtime in the trust chain and is entirely safe,
because it never re-serialises a document.

Python may own everything upstream of canonicalisation and nothing downstream of it.

### 7.2 Containers

```text
┌─ this repository's compose project ───────────────┐
│                                                   │
│  analysis (Python)          verify (TypeScript)   │
│  scipy, statsmodels         canonicalise, keccak  │
│  no keys                    sign VC, ABI-encode   │
│  no chain access            holds VERIFIER_SEED   │
│  no Guardian access                 │             │
│        ▲                            │             │
│        └──── plan bytes ────────────┘             │
│              ◄─── numbers ───                     │
└─────────────────────────────────────┼─────────────┘
                                      │
             ┌────────────────────────┴──────────┐
             ▼                                   ▼
     guardian_default                      Arc Testnet RPC
     (external network)
     api-gateway, policy, MongoDB,   ← separate compose project
     NATS, Valkey, IPFS
```

| Container | Owns | Must not have |
|---|---|---|
| `analysis` | Estimation, control matching, bootstrap, diagnostics | Keys, chain access, Guardian access |
| `verify` | Canonicalisation, hashing, credential signing, calldata, submission | The scientific stack, GDAL |
| Guardian | Policy, workflow, credentials, its own Hedera operator key | Any key material of this project's |

`acquire` (Python with `rasterio`/`pystac-client`) is not part of the runtime stack. It is
a batch job run occasionally to regenerate the Tier 0 snapshot, and its output is a
committed fixture. `loadTier0()` reads that file and checks one field, so the acquisition
step is already a clean seam — it is the lowest-risk place to introduce Python, being
entirely upstream of the first hash.

### 7.3 Direction of control

`verify` calls `analysis`. Never the reverse.

`analysis` is a pure function service: stateless, no database, identical inputs give
identical numbers. That is what allows it to hold no credentials and require no egress.
Enforce this in the network topology rather than by convention — a container that cannot
reach Guardian or the RPC cannot be induced to submit anything to either.

### 7.4 Request contract

The plan and the evidence both cross the boundary as **raw bytes with a hash receipt**.

```jsonc
// verify → analysis
{
  "planCanonical": "<the canonical plan string, ~3.4 KB for the current plan>",
  "planHash":      "0xa901a322…",   // analysis verifies by keccak over those raw bytes
  "parcelId":      "kootenay-riparian-001",
  "snapshotHash":  "0x…"            // the Tier 0 snapshot's own snapshotHash field
}

// analysis → verify
{
  "measured":      { "parcelChangeIndex": -0.0267, "…": "…" },
  "controlSets":   [ "…" ],
  "parallelTrend": { "…": "…" },
  "uncertainty":   { "…": "…" }
}
```

`analysis` returns numbers. It returns no hashes, no canonical documents and no signed
material. `verify` assembles the `VerificationResult`, attaches the plan hash **it**
computed and committed at `createDeed()`, canonicalises once, and hashes.

Verifying a receipt by hashing an opaque byte string is not serialisation, so `analysis`
can confirm it received the committed plan without ever re-encoding it. This is the same
discipline the contract follows.

The Tier 0 snapshot is 860 KB. Mount `verification/fixtures/` read-only into both
containers rather than shipping it in every request; `analysis` loads it from the volume
and confirms the snapshot it read carries the `snapshotHash` it was given. If the two
containers ever see different evidence the run fails loudly, rather than producing a
result bound to evidence that was not the evidence analysed.

**Do not hash the snapshot file's raw bytes to check this.** Two hashes here are easy to
confuse and neither is the file:

* `snapshotHash` (`acquire.ts`) is `keccakOf(snapshot-without-its-own-snapshotHash-field)`
  — a canonical hash over the object, computed before the field is added to it.
* `evidenceHash` (`engine.ts`) is `keccakOf({tier0, tier1, tier2, tier3})`, a four-field
  digest of the tier hashes — not a hash of any file, and not what `analysis` should be
  checking.

A raw-bytes hash of the file matches neither, because the stored JSON has its own
`snapshotHash` embedded and its keys in insertion order. The receipt check that works
without a second canonicaliser is the cheap one: compare the `snapshotHash` string the
snapshot already carries against the one `verify` sent. `verify` remains the only
component that hashes anything.

### 7.5 Compose skeleton

```yaml
services:
  analysis:
    build: ./analysis
    networks: [internal]                     # no egress — see the internal: true flag below
    volumes:
      - ./verification/fixtures:/fixtures:ro

  verify:
    build: ./verify
    networks: [internal, guardian_default]   # the only service that touches Guardian
    volumes:
      - ./verification/fixtures:/fixtures:ro
    environment:
      ANALYSIS_URL: http://analysis:8000
      GUARDIAN_URL: http://api-gateway:3002  # container name, not localhost
      DEMO_RPC_URL: ${DEMO_RPC_URL}          # this is the variable the code reads
      VERIFIER_SEED_FILE: /run/secrets/verifier_seed
    secrets: [verifier_seed]

networks:
  internal:
    internal: true                           # REQUIRED — without it this is an ordinary
                                             # bridge network with full outbound access
  guardian_default:
    external: true

secrets:
  verifier_seed:
    file: ./secrets/verifier_seed.txt        # or external: true, backed by Secrets Manager
```

Three things in that block are load-bearing and easy to get wrong:

* **`internal: true` is what makes the containment real.** A network named `internal`
  without the flag is an ordinary bridge network — `analysis` would keep normal outbound
  access and could reach the Arc RPC and any other host, while §7.3 claims it cannot.
* **The top-level `secrets:` block is required.** Without it, `docker compose config`
  rejects the project outright: *"service `verify` refers to undefined secret
  verifier_seed"* — no build, no partial start.
* **`DEMO_RPC_URL` is the variable the code actually reads.** `ARC_TESTNET_RPC_URL` exists
  only in `contracts/foundry.toml` as a `forge` input; no TypeScript in the repository
  reads it. `scripts/demo.ts` falls back to calldata-only when `DEMO_RPC_URL` is unset, and
  does so silently — the container starts clean and settles nothing.

Joining Guardian by an external network rather than by publishing ports means Guardian's
gateway need not be exposed on the host at all, and only one of this project's containers
can reach it. Confirm the network name with `docker network ls` once Guardian's compose is
running — it is `<project>_default` — and take the gateway's internal port from Guardian's
compose file rather than assuming the port the web UI uses.

### 7.6 Local and deployed

The same two containers run in both places. Locally, add an `anvil` service and point
`verify` at it. Deployed, the least complicated honest arrangement is one EC2 host running
both compose projects side by side: the instance is already sized for Guardian (§6), and
these two containers add little to it. Splitting them across separate ECS services buys
nothing at this scale and costs the shared network.

### 7.7 Anti-patterns

* Merging Guardian's services into this project's compose file.
* Giving `analysis` an RPC URL or Guardian credentials.
* Letting `verify` acquire a scientific dependency.
* Passing documents across the boundary where a hash would do.
* Running the React application as a runtime container; it is a build-time artefact.

---

## 8. Secrets and key custody

Three categories of key material are involved:

* the **Arc deployer key** (`DEPLOYER_KEY`), which deploys and owns the contract;
* the **verifier identity** (`VERIFIER_SEED`), which signs every verdict credential;
* the **Hedera operator key** and IPFS credentials, held by Guardian.

Requirements:

* Testnet key material only. No key that controls anything of value may exist on a
  publicly reachable demonstration host.
* Secrets Manager or SSM Parameter Store. Not `.env` files on the instance, and never in
  the repository — `.env` and `.env.*` are ignored, and `.env.example`, the only committed
  variant, holds no secrets (its single value is the public Arc Testnet RPC URL).
* `VERIFIER_SEED` deserves the strictest handling of the three. It is the root of every
  credential the demonstration signs; anyone holding it can mint verdicts under the
  project's DID.
* Guardian's API gateway must not be open to the internet. Restrict it by security group
  to the application tier, or to a bastion, and expose only what the demonstration reads.

This does not change the authority model in `ARC.md` §2 and `GUARDIAN.md` §5. It is the
operational consequence of it: settlement authority lives in the contract, and the keys
that can address the contract are therefore the assets worth protecting.

---

## 9. Data provenance in public

`CLAUDE.md` and `DEMO.md` require real and simulated evidence to be visually
distinguishable at all times. A public deployment raises the stakes of that requirement
rather than relaxing it.

The only scenario that settles is `synthetic` — the real Sentinel-2 series with a +0.25
NDVI treatment effect injected. It is the scenario that produces a released tranche, a
benefit-share payment and an issuance record, and it is therefore the screenshot most
likely to circulate.

Before this is publicly reachable:

* the `SIMULATED DEMONSTRATION DATA` banner must be present within any view that shows a
  settlement, not only above or below it, so that it cannot be cropped out;
* Tier 0 provenance (`REAL` or `SIMULATED`) must be legible in the same viewport as the
  settled quantity;
* the `real` scenario — which settles nothing, because no intervention took place on that
  ground — must remain the landing state. **Already satisfied:** `App.tsx` initialises the
  scenario selector to `'real'`. This is recorded so it is not changed casually; the honest
  scenario is the more interesting one and belongs first.

---

## 10. Cost

Guardian dominates. At on-demand pricing a `t3.xlarge` running continuously is on the
order of $120/month; S3, CloudFront and Lambda for a demonstration of this size are
single-digit dollars combined. Verify current rates for the chosen region.

If cost matters, the ordering is: run Guardian on a schedule, then drop to degraded mode
(§6), then reduce the application tier — in that order. The application tier is the last
thing to economise on and the cheapest to keep.

---

## 11. Build order

1. Deploy `RestorationDeed` to Arc Testnet and record the address. (M1.)
2. Set `base` in the Vite config, wire the `out/demo/` → `app/public/demo/` copy, build
   and publish the static tier against the deployed address.
3. Decide whether Guardian must be live. If yes, stand up the EC2 host and publish a
   policy carrying the `ecorestore_verdict_ingest` block tag.
4. Add the Lambda tier only if on-demand verification is required.

Steps 1 and 2 produce a complete, honest demonstration. Steps 3 and 4 are additive.

---

## 12. Implementation state (2026-09-10)

Nothing in this document is deployed.

* `RestorationDeed` has not been deployed to Arc Testnet; no deployer key exists in the
  build environment. The contract's 31-test Foundry suite passes, run through the
  `ghcr.io/foundry-rs/foundry` image, and the full lifecycle has executed against a local
  `anvil` container: mobilisation draw, plan-hash-bound verification, tranche release at
  the lower bound, benefit share and retention.
* No AWS resources exist. No infrastructure-as-code has been written, and no tool has
  been chosen between Terraform and CDK.
* The split pipeline in §7 is a proposal. The verification pipeline is a single
  TypeScript process; no Python service exists, no `analysis` or `verify` container has
  been built, and the split has not been approved. The compose skeleton and request
  contract in §7.4 and §7.5 are illustrative.
* No payment tier exists. No endpoint returns `402`, no Hedera receiving account has
  been created and no facilitator has been selected. x402 is outside M1 — see
  `X402.md` §10 and §11.
* No Guardian instance has been stood up. Every Guardian request produced so far has been
  staged to `guardian/outbox/` and reported as not submitted.
* The measurements in §5 (1.4 s, 153 MB for all three scenarios) and §3 (~130 KB) were taken on the development
  host and are indicative, not benchmarks.
