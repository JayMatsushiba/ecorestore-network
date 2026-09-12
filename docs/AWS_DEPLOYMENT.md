# Ecorestore Network — AWS Deployment

> **Status (2026-09-12): pipeline built and verified locally; not yet deployed from this branch.**
> The continuous-deployment path below is committed and was exercised end to end on a
> development machine (`docker compose up --build`, every service healthy, the deed
> indexed and served). It has not yet run against the AWS host from this branch: that
> happens on the first merge to `main` after the one-time stack update in §3. The host
> currently serves the stack shape `main` deployed on 2026-09-11, which this replaces.
>
> This hosts **the local demo on a public URL** — Hardhat's in-memory chain, MockUSDC,
> MockGuardianAdapter, a local Graph Node, synthetic fixture data. It does not deploy
> to Arc Testnet/Mainnet, a live Hedera Guardian, or real USDC; those are separate,
> later work (`docs/M6_M7_READINESS_REPORT.md` §8-9). Every environmental value the
> site shows remains synthetic and labelled as such.

The runbook — creating the stack, the parameters, the GitHub configuration, branch
protection — is `deploy/README.md`. This page records the shape and the decisions.

---

## 1. Shape

```text
push to main ─► ci.yml ─► build ×2 ─► ECR ─► SSM Run Command ─► deploy/host/deploy.sh ─► smoke test
                (typecheck, vitest,    (OIDC role;    (instance role; pulls,      (/api/health,
                 lint+test+build,       no AWS keys    down -v, up --wait,         /api/deed == OK,
                 hardhat test,          in GitHub)     waits for the deed)         the page)
                 compose build)
```

| Piece | Where | Runs |
|---|---|---|
| `ci.yml` | GitHub | every PR and branch push; called by `deploy.yml` before any image is built |
| `deploy.yml` | GitHub → ECR → host | every push to `main`; one at a time, never cancelled, so the host is always the branch tip |
| `demo-host.yml` | CloudFormation | once, by hand: EC2 (`t3.xlarge`, AL2023, no SSH), EIP, security group, ECR, instance role, GitHub OIDC provider and deploy role |
| `deploy.sh` | the host, as root, via SSM | one commit; idempotent |

On the host, `docker-compose.yml` plus `deploy/docker-compose.aws.yml`:

```text
caddy (80/443, the only public port)
└── frontend   nginx: React build, /api/ → api
    └── api    server/index.ts — read-only, no key; calls the real M1-M5 functions
        ├── graph-node ── postgres, ipfs        indexes the chain
        │       └── chain   npx hardhat node    in-memory demo network, not Arc
        └── bootstrap (one-shot, before api)    demo:local settlement + subgraph deploy
```

The React app is built with an empty `VITE_API_BASE_URL`, so the browser calls `/api/`
on whatever host served the page and nginx forwards it. The same image works behind
the public IP, a domain, or `localhost:3001`.

## 2. Decisions

* **The existing pipeline was kept and retargeted, not replaced.** OIDC trust, ECR,
  the SSM-driven host, Caddy and branch protection were already working for the
  previous stack shape; only the images, the compose file and the smoke test changed.
* **Every deploy is a fresh chain.** Hardhat's network lives in memory, so there is
  nothing to preserve; `deploy.sh` removes the chain, Graph Node and deployment-record
  volumes and lets `bootstrap` settle the synthetic deed again. The alternative —
  keeping Graph Node's store across a chain reset — leaves an index of blocks that no
  longer exist. Caddy's volumes are kept so a TLS certificate is not re-requested.
* **`bootstrap` is a one-shot service the API depends on**, so `docker compose up
  --wait` returns only after the settlement and subgraph deploy have succeeded, locally
  and on the host alike. It is idempotent: on a chain that already holds the recorded
  contract it skips the settlement and only redeploys the subgraph.
* **One runtime image for chain, bootstrap and api.** They share root `node_modules`
  and the compiled contracts; a second image would only duplicate them.
* **No application secret exists.** The host reads the ECR registry and an optional
  domain from Parameter Store, nothing else. The moment a real deployer key or Hedera
  credential is introduced, it goes into Secrets Manager or a SecureString parameter,
  never into the repository, an EC2 file, or a GitHub secret.
* **Not run in CI:** the subgraph's Matchstick suite (`graph test --docker`) and the
  Graph Node end-to-end test (`npm run test:e2e:graph`), which needs the running stack.

## 3. Prerequisite before the first deploy from this branch

The stack on AWS predates the `ecorestore/app` image. Run the same CloudFormation
command from `deploy/README.md` §1 once against the existing stack; it adds the
repository and the deploy role's permission to push to it and changes nothing else.
Without it the build job fails at push with an ECR "repository does not exist" error,
and nothing reaches the host.

Then, because `ci.yml` no longer has an `analysis` job, main's required status checks
must be `typescript`, `frontend`, `contracts`, `images` (`deploy/README.md` §4).

## 4. Known limitations of this deployment path

Everything in `docs/M6_M7_READINESS_REPORT.md`'s BLOCKER and HIGH lists still applies
once this is reachable at a public URL — most importantly:

- **`server/`'s API has no authentication.** Anyone who can reach `/api/*` can query
  it. It is read-only (no fund-release path exists), but it is still an uncontrolled
  information-exposure surface.
- This hosts the **same Mock Guardian, MockUSDC and in-memory Hardhat chain** as the
  local demo. Keep the UI's synthetic-data disclaimer and "local demo only" language
  intact; do not remove it because the demo now has a real-looking URL.
- A single EC2 instance is a single point of failure with no redundancy — acceptable
  for a hackathon demo, not for anything with real users.
- After a host reboot the containers restart but the chain is empty; run **Deploy**
  again to bootstrap it.

## 5. The larger, AWS-native production path (not this page)

`docs/M6_M7_READINESS_REPORT.md` §8 sketches the eventual production shape — ECS
Fargate (or App Runner) for the API, RDS for Graph Node's Postgres, S3 + CloudFront for
the static React build, Secrets Manager for a real deployer key, and a real Arc
Testnet/Mainnet RPC endpoint instead of a local Hardhat node. That is materially more
work and depends on M7's Guardian/Arc trust-boundary work landing first — it is not a
bigger version of this page, it is a different, later milestone.
