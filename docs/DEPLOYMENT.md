# Ecorestore Network — Deployment

## 1. Purpose

This document describes how the demonstration is intended to run on AWS as a live,
publicly reachable deployment, alongside a Hedera Guardian instance.

Nothing described here is deployed. This is a plan, not a record. §11 states the actual
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
              (optional) Lambda             on-demand verification, 1.4 s per run
                      │
        ┌─────────────┴──────────────┐
        ▼                            ▼
   Arc Testnet                  EC2: Guardian              20+ containers, compose
   RestorationDeed              api-gateway (private)      MongoDB, NATS, Valkey, IPFS
   chain 5042002
```

Four tiers, in descending order of importance to the demonstration and ascending order
of cost:

| Tier | Service | Required? |
|---|---|---|
| Application | S3 + CloudFront | Yes |
| Settlement | Arc Testnet | Yes — this is the product claim |
| Verification | Lambda | Only for on-demand runs |
| Methodology | EC2 running Guardian | Only for live policy execution |

---

## 3. Application tier

The React application is static. `npm run build` in `app/` produces `app/dist`; serve it
from S3 behind CloudFront.

The three assurance bundles total 144 KB, so the evidence the application displays can
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
registered against it. `guardian/adapter.ts` defaults that tag to
`ecorestore_verdict_ingest`. Standing up the containers is necessary but not sufficient.

### Degraded mode is a supported state

With `GUARDIAN_URL` unset, `submitToGuardian()` writes the exact request to
`guardian/outbox/` and reports `GUARDIAN_URL not set; request written to outbox and NOT
submitted`. The demonstration remains honest in this mode: it shows the request that
would be sent and states plainly that no policy run occurred.

Running twenty containers continuously so that one POST returns 200 is a real trade
against the demonstration's value. Consider running this tier only during a judging
window.

---

## 7. Secrets and key custody

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

## 8. Data provenance in public

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
  ground — should be the landing state, not `synthetic`.

The honest scenario is the more interesting one. It should be the default view.

---

## 9. Cost

Guardian dominates. At on-demand pricing a `t3.xlarge` running continuously is on the
order of $120/month; S3, CloudFront and Lambda for a demonstration of this size are
single-digit dollars combined. Verify current rates for the chosen region.

If cost matters, the ordering is: run Guardian on a schedule, then drop to degraded mode
(§6), then reduce the application tier — in that order. The application tier is the last
thing to economise on and the cheapest to keep.

---

## 10. Build order

1. Deploy `RestorationDeed` to Arc Testnet and record the address. (M1.)
2. Set `base` in the Vite config, wire the `out/demo/` → `app/public/demo/` copy, build
   and publish the static tier against the deployed address.
3. Decide whether Guardian must be live. If yes, stand up the EC2 host and publish a
   policy carrying the `ecorestore_verdict_ingest` block tag.
4. Add the Lambda tier only if on-demand verification is required.

Steps 1 and 2 produce a complete, honest demonstration. Steps 3 and 4 are additive.

---

## 11. Implementation state (2026-09-10)

Nothing in this document is deployed.

* `RestorationDeed` has not been deployed to Arc Testnet; no deployer key exists in the
  build environment. The contract's 31-test Foundry suite passes, run through the
  `ghcr.io/foundry-rs/foundry` image, and the full lifecycle has executed against a local
  `anvil` container: mobilisation draw, plan-hash-bound verification, tranche release at
  the lower bound, benefit share and retention.
* No AWS resources exist. No infrastructure-as-code has been written, and no tool has
  been chosen between Terraform and CDK.
* No Guardian instance has been stood up. Every Guardian request produced so far has been
  staged to `guardian/outbox/` and reported as not submitted.
* The measurements in §5 (1.4 s, 153 MB) and §3 (144 KB) were taken on the development
  host and are indicative, not benchmarks.
