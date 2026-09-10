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
| Verification | Lambda, or the `verify` + `analysis` containers (§7) | Only for on-demand runs |
| Methodology | EC2 running Guardian (§7.6 for the attachment) | Only for live policy execution |
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

The pipeline runs as three containers from `docker-compose.yml` at the repository root,
with two optional services behind compose profiles. The split of the spatial analysis
into Python and the verification/signing path into TypeScript was **approved and built
on 2026-09-10** on the owner's instruction; this section describes what runs. §7.8
records where the build departs from the proposal this section previously carried, and
why.

```text
docker compose up --build            → http://localhost:3001
```

### 7.1 The constraint

A hash commits to **bytes**, not to data. Exactly one implementation may turn a result
into bytes; every other participant treats the resulting hash as opaque.

`RestorationDeed.sol` already demonstrates the pattern. It contains no `keccak256` call
and no `abi.encode`: it compares `bytes32` values it was handed and never re-derives
them. The EVM is therefore a second runtime in the trust chain and is entirely safe,
because it never re-serialises a document.

Python owns everything upstream of canonicalisation and nothing downstream of it. That
holds for the analysis service and for the acquisition job alike: `acquire` writes a
snapshot *without* `geometryHash`, `h3Root` or `snapshotHash`, and a TypeScript step
attaches them (§7.2).

### 7.2 Containers

```text
┌─ this repository's compose project ("ecorestore") ─────────────────────────┐
│                                                                            │
│  frontend (nginx)        verify (TypeScript)         analysis (Python)     │
│  built React app         canonicalise, keccak        numpy, scipy          │
│  proxies /api/ → verify  sign VC, ABI-encode         controls, trend, DiD, │
│  127.0.0.1:3001          holds VERIFIER_SEED         leakage, bootstrap,   │
│         │                127.0.0.1:8090              placebo coverage      │
│         └──── edge ──────────┤                       no keys, no egress    │
│                              ├────── internal ──────────────┤             │
│                              │  plan bytes + snapshot bytes → │             │
│                              │  ◄────────── numbers ─────────│             │
│                              │                                             │
│  anvil  (profile: chain)  ───┘ internal                                    │
│  acquire (profile: acquire) — egress network only; writes ./out/acquire/   │
└──────────────────────────────┼─────────────────────────────────────────────┘
                               │ guardian-quickstart_default (external network)
                               ▼
                    web-proxy → api-gateway → policy-service, MongoDB, NATS, IPFS …
                    (the Guardian quickstart compose project, run from its own tree)
```

| Container | Image | Owns | Must not have |
|---|---|---|---|
| `analysis` | `python:3.12-slim` + numpy, scipy, FastAPI | Unit series, controls drawn by the committed rule, parallel-trend diagnostic, DiD, leakage, bootstrap interval, placebo coverage | Keys, chain access, Guardian access, any route to the internet |
| `verify` | `node:22-slim` (+ a Foundry build stage for the contract artefacts) | Canonicalisation, hashing, status resolution and Tier 1–3 gates, credential signing, Guardian submission, issuance calldata, optional on-chain settlement, the HTTP API | The scientific stack, GDAL |
| `frontend` | Vite build served by `nginx:alpine` | Presentation; proxies `/api/` to `verify` | Any backend other than `verify` |
| `anvil` (profile `chain`) | `ghcr.io/foundry-rs/foundry` | A local chain for `verify` to settle on | — |
| `acquire` (profile `acquire`) | the `analysis` image, different entrypoint | Batch re-acquisition of REAL Tier 0 into `./out/acquire/` | Keys; it never writes to `verification/fixtures/` |
| Guardian | its own compose project | Policy, workflow, credentials, its own Hedera operator key | Any key material of this project's |

The same Python image serves both `analysis` and `acquire`; the scientific stack
(rasterio, pystac-client, h3, shapely, pyproj) is installed once. The runtime service
never imports the acquisition modules.

**Two engines, one contract.** `verification/analysis-contract.ts` defines the boundary.
`verification/engine.ts` keeps the reference TypeScript implementation (`analyseTier0()`),
and `analysis/` implements the same function in Python. `analysis/tests/test_parity.py`
replays five reference cases dumped from the TypeScript side and asserts every number is
*equal*, not close — the seeded PRNG is ported exactly and sums accumulate in the same
order. Which engine produced a result is recorded in the result itself
(`analysisEngine`) and is therefore part of what `resultHash` commits to, because the
determinism guarantee is per runtime (§5).

### 7.3 Direction of control

`verify` calls `analysis`. Never the reverse.

`analysis` is a pure function service: stateless, no database, identical inputs give
identical numbers. That is what allows it to hold no credentials and require no egress.
The compose file enforces it in the topology: `analysis` sits only on a network declared
`internal: true`, which has no gateway. From inside that container, Earth Search and
Guardian's web proxy are both unreachable (checked on 2026-09-10); from `verify`, Guardian
answers.

### 7.4 Request contract

The plan and the evidence both cross the boundary as **raw canonical bytes with a hash
receipt**. `analysis` checks each receipt by hashing the opaque string it was handed,
parses it once, and never re-encodes anything.

```jsonc
// verify → analysis            POST /analyse
{
  "planCanonical":  "<canonicalize(plan)>",                       // ~3.4 KB
  "planHash":       "0xa901a322…",                                // keccak of those bytes
  "tier0Canonical": "<canonicalize(snapshot minus snapshotHash)>", // ~860 KB
  "snapshotHash":   "0x5be25dd2…"                                 // keccak of those bytes
}

// analysis → verify            numbers only
{
  "engine":        { "name": "ecorestore-analysis-py", "version": "1.0.0" },
  "planHash":      "0xa901a322…",  "snapshotHash": "0x5be25dd2…",   // receipts echoed
  "parcel":        { "areaHa": 48.9486, "preLevel": 0.63485, "preSlope": -0.01208, "postComposite": 0.6082, "changeIndex": -0.02665 },
  "parcelCells":   { "count": 253, "areaHa": 49.0168, "lossCellFraction": 0.0079 },
  "stacSceneIds":  [ "S2A_11UNQ_20230608_0_L2A", "…" ],
  "scenesPerWindow": [ { "label": "season-2023", "usable": 19 }, "…" ],
  "controlSets":   [ { "ring": "far", "matched": 30, "matchedUnitIds": [ "…" ], "…": "…" }, "…" ],
  "parallelTrend": { "status": "PASS", "slopeDiffPerYear": 0.013, "pValue": 0.76, "nObservations": 1229, "criterion": "…" },
  "estimate":      { "parcelChange": -0.0267, "farChange": 0.0166, "nearChange": 0.0186, "leakage": 0, "did": -0.0432, "additional": -0.0432 },
  "interval":      { "lower": -11.6192, "upper": 5.4459 },
  "coverage":      { "empirical": 0.875, "placebos": 40 },
  "tier0Usable":   { "usableScenes": 72, "totalScenes": 72 }
}
```

`analysis` returns numbers. It returns no hashes of anything it produced, no canonical
documents and no signed material; the two hashes in its response are the receipts it was
given, echoed so `verify` can assert it received the analysis of what it sent. `verify`
resolves status, applies the Tier 1–3 gates, assembles the `VerificationResult`, attaches
the plan hash **it** computed and committed at `createDeed()`, canonicalises once, and
hashes. A receipt that does not match is a `422` and the run fails loudly.

The snapshot travels **inline** rather than through a shared volume, which the proposal
suggested. The synthetic scenario's snapshot — the real series with a labelled treatment
effect injected — exists only in memory on the `verify` side, so a volume could never
carry it; and the receipt discipline is identical either way. One local hop of ~860 KB
costs a few milliseconds. No fixture is mounted into `analysis`.

### 7.5 Compose

Two files. `docker-compose.yml` is the standalone stack; `docker-compose.override.yml`
is merged automatically by `docker compose up` and does one thing: joins `verify` — and
only `verify` — to Guardian's network (§7.6).

```yaml
# docker-compose.yml (abridged; the file itself is the reference)
services:
  analysis:   { build: ./analysis, networks: [internal] }
  verify:     { build: { context: ., dockerfile: verify/Dockerfile },
                networks: [internal, edge], ports: ["127.0.0.1:${VERIFY_PORT:-8090}:8080"],
                environment: { ANALYSIS_URL: http://analysis:8000, VERIFIER_SEED: …, GUARDIAN_URL: …, DEMO_RPC_URL: … },
                volumes: ["./guardian/outbox:/app/guardian/outbox"] }
  frontend:   { build: ./app, networks: [edge], ports: ["127.0.0.1:${FRONTEND_PORT:-3001}:80"] }
  anvil:      { profiles: [chain], image: ghcr.io/foundry-rs/foundry, entrypoint: [anvil], networks: [internal] }
  acquire:    { profiles: [acquire], build: ./analysis, entrypoint: [ecorestore-acquire], networks: [egress],
                volumes: ["./verification/fixtures:/fixtures:ro", "./out/acquire:/out", "acquire-cache:/cache"] }
networks:
  internal: { internal: true }   # REQUIRED — without the flag it is an ordinary bridge with full egress
  edge: {}
  egress: {}
```

```yaml
# docker-compose.override.yml
services:
  verify:
    networks: [internal, edge, guardian]
    environment:
      GUARDIAN_URL: ${GUARDIAN_URL:-http://web-proxy:80}
      GUARDIAN_PUBLIC_URL: ${GUARDIAN_PUBLIC_URL:-http://localhost:3000}
networks:
  guardian: { external: true, name: "${GUARDIAN_NETWORK:-guardian-quickstart_default}" }
```

| Command | Effect |
|---|---|
| `docker compose up --build` | Full stack, attached to the running Guardian. Fails to start if Guardian's network does not exist. |
| `docker compose -f docker-compose.yml up --build` | Standalone; the override is not merged; Guardian requests go to `guardian/outbox/` and are reported as not submitted. |
| `DEMO_RPC_URL=http://anvil:8545 docker compose --profile chain up --build` | Adds `anvil`; each verification also runs the deed lifecycle and settles on it. |
| `docker compose --profile acquire run --rm acquire --limit 5` | Batch job: re-acquire REAL Tier 0 into `./out/acquire/` (§7.2). |
| `docker compose -f docker-compose.yml config` | Validate. |

Host ports are bound to `127.0.0.1`. Port 8080 is not used because the Guardian
quickstart's IPFS node already publishes it.

Secrets: the prototype passes `VERIFIER_SEED` as an environment variable with a
demonstration default. §8 still applies to any deployment — a compose `secrets:` block or
Secrets Manager, never a committed value — and is not weakened by the local convenience.

### 7.6 Guardian attachment

Guardian runs from its own quickstart compose project (`docker-compose-quickstart.yml` in
the Guardian checkout). Its network is `guardian-quickstart_default`; confirm with
`docker network ls` and set `GUARDIAN_NETWORK` if the project name differs.

Two facts about Guardian 3.7 decide where `verify` points:

* **The gateway serves its routes without the `/api/v1` prefix.** `api-gateway:3002`
  answers `POST /external/{policyId}/{blockTag}`; the `/api/v1/…` form the documentation
  cites is added by Guardian's `web-proxy` (nginx), which is the container published on
  the host as `localhost:3000`. `verify` therefore targets `http://web-proxy:80` inside the
  network — the same server the operator sees at `localhost:3000` — and the documented
  path is what gets called. `GUARDIAN_PUBLIC_URL` is only used to render the host-visible
  URL in the interface.
* **A `200` from the external-data endpoint is an acknowledgement, not a policy run.**
  Guardian queues the document to the policy engine and returns `true` before the policy
  sees it — including for a policy ID that does not exist. The adapter reports this
  outcome as *gateway acknowledged*, and the interface says so. A run is confirmed only
  inside Guardian, against a published policy whose `externalDataBlock` carries
  `GUARDIAN_BLOCK_TAG`; no such policy has been authored (§6).

`GET /health` on `verify` probes Guardian with an authenticated endpoint and treats any
HTTP response, including `401`, as reachability.

### 7.7 Local and deployed

The same images run in both places. Deployed, the least complicated honest arrangement
is one EC2 host running both compose projects side by side: the instance is already
sized for Guardian (§6), and these three containers add little to it. Splitting them
across separate ECS services buys nothing at this scale and costs the shared network.
The AWS deployment itself is a later milestone; nothing in this section has been
deployed (§12).

### 7.8 Deviations from the proposal

Recorded so the reasons are not lost.

* **The React application runs as a container.** The proposal listed this as an
  anti-pattern; the owner asked for the frontend as its own container, and the reason to
  have one turned out to be real: the page now calls `verify` to run a scenario live, so
  something has to proxy `/api/`. nginx serves the static build and proxies. The static
  path in §3 is unchanged — the same `dist/` can go to S3 — and the page falls back to
  the committed bundles, saying which it is showing, when the API is unreachable.
* **The snapshot is sent inline, not mounted.** §7.4.
* **`acquire` writes an unhashed document.** The proposal had the Python job producing
  the committed fixture directly; that would have made Python a second canonicaliser.
  `npm run acquire:finalize` attaches the three hashes and compares against the current
  fixture before writing it.
* **`verify` runs TypeScript directly** (`tsx`) rather than a compiled build; the image
  carries development dependencies. A compile step is an optimisation for later.
* **The analysis engine is named in the result.** Not in the proposal; follows from §5.

### 7.9 Anti-patterns

* Merging Guardian's services into this project's compose file.
* Giving `analysis` an RPC URL, Guardian credentials, or a route to the internet.
* Letting `verify` acquire a scientific dependency.
* Passing documents across the boundary where a hash would do; passing hashes back
  across it that the sender did not supply.
* Letting the Python job write `verification/fixtures/` directly.
* Treating Guardian's `200` as a policy run.

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

Nothing in this document is deployed to AWS. The container stack in §7 runs locally.

* `RestorationDeed` has not been deployed to Arc Testnet; no deployer key exists in the
  build environment. The contract's 31-test Foundry suite passes, run through the
  `ghcr.io/foundry-rs/foundry` image, and the full lifecycle has executed against a local
  `anvil` — both from the host and, via the `chain` profile, inside the compose stack:
  mobilisation draw, plan-hash-bound verification, tranche release at the lower bound,
  benefit share and retention.
* No AWS resources exist. No infrastructure-as-code has been written, and no tool has
  been chosen between Terraform and CDK. The credit available for it is unspent.
* **The split pipeline in §7 is built.** `docker compose up --build` starts `analysis`,
  `verify` and `frontend`; the interface at `localhost:3001` runs each scenario through
  the Python analysis service and the TypeScript verify service and displays the result.
  The Python engine reproduces the TypeScript reference exactly on all five parity cases.
  Verification of one scenario through the stack takes ~0.2–0.3 s.
* The Python acquisition job runs (`--profile acquire`). On a smoke run it reproduced the
  committed fixture's grid, unit counts and parcel/parcel-cell pixel masks, and parcel
  NDVI to 4 dp on every scene in common. The committed fixture is still the 1.0.0
  (TypeScript) acquisition; promoting a 2.0.0 snapshot is a deliberate step that changes
  every downstream hash and has not been taken.
* No payment tier exists. No endpoint returns `402`, no Hedera receiving account has
  been created and no facilitator has been selected. x402 is outside M1 — see
  `X402.md` §10 and §11.
* **A Guardian 3.7.0 quickstart instance is running locally** and `verify` reaches it
  over its Docker network. Every verdict is POSTed to
  `/api/v1/external/ecorestore-policy-not-deployed/ecorestore_verdict_ingest` and the
  gateway answers `200`. **No policy has been authored or published**, so no policy run
  has consumed a verdict; the `200` is delivery, not processing (§7.6). Standalone runs
  still stage to `guardian/outbox/`.
* The measurements in §5 (1.4 s, 153 MB for all three scenarios in-process) and §3
  (~130 KB) were taken on the development host and are indicative, not benchmarks.
