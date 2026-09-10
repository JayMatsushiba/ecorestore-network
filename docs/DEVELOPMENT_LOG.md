# Ecorestore Network — Development Log

Newest first. One entry per milestone, per `CLAUDE.md`.

Entries written before the documentation consolidation (below) cite `proposals/idea-0.3.md`
and its section numbers. Those documents were removed from the repository once their
load-bearing content moved into `docs/`; they remain in git history. Past entries are left
as written rather than rewritten, because a log records what was true at the time.

---

## 2026-09-10 — Application usability: verdict in plain words, map view, About page

### Objective

Make the application readable by the people it is for: a restoration team watching its
own project, and a buyer deciding whether an outcome would survive an audit. Close the
three UI issues: #12 (dashboard audit, ten findings), #11 (About page) and #10 (web map).
Owner's instruction: improve usability, resolve the UI issues, file anything else as an
issue and leave it for a later sprint.

### Implementation

**Dashboard (#12).** The page now states its own verdict above the numbers
(`app/src/copy.ts`, `verdictFor()`), one headline and one explanation per
`verificationStatus`, covering all six statuses the engine can return. `statusReason`
stays underneath as the engine record. The three scenario tabs name the lesson and the
rule's behaviour (*Real data · settles nothing*, *Injected effect · settles the lower
bound*, *Trend test fails · refuses to score*) under one line, *One committed rule,
three runs*; the provenance detail stays in the banner. The cards are grouped into three
bands with headings at real size: *What was claimed, and what settled* (weightier),
*How that number was reached* (four numbered steps) and *What is on record*. The
`parallelTrend.criterion` field now reaches the page (`app/src/types.ts`) and prints
beside the verdict and beside the `parallel_trend` gate, so a FAIL at p 0.76 reads as a
tightened threshold rather than an inverted test. The claim-to-settlement chart is an
HTML table: the claim is a reference line above it, each row is an operation so the
sign and the word agree, and a zero settlement is a marked tick carrying its value. The
palette moves both control rings into one cool neutral family, separated by weight and
dash, and reserves amber for simulated provenance; the parcel line turns amber only when
its Tier 0 is simulated. A build-state strip states what ran live, what is prepared and
deliberately unsent, and why, derived from the bundle's own fields. Both SVG charts sit
in an `overflow-x: auto` container and hold a minimum width under 700 px, with SVG text
at 13 viewBox units so no label drops below about 11 effective pixels. The hero numbers
are glossed in place (*would survive an audit*, *at risk of restatement*). The loading
copy names the data, not the scenario id, and defines nothing by abbreviation; the
results region is a `role="status"` live region; *Re-run verification* is a button
beside the status it belongs to.

**About page (#11).** `app/src/About.tsx`, reached at `/about` through a hand-rolled
two-route switch (`app/src/route.ts`, `pushState` and `popstate`, no router
dependency). It answers three questions in order: what this is for, how it works, what
you are looking at. It names each component and its one job, states both authority
rules, states that Tier 0 is real and Tiers 1–3 are simulated, and carries build state
in one table with `RUNS` / `PREPARED` / `NOT BUILT` markers in the existing badge
treatment. `docs/ARCHITECTURE.md` §8 now says the page mirrors it.

**Map (#10).** `verify/spatial.ts` adds a `spatial` block to the assurance bundle
envelope, never to `VerificationResult`: the parcel polygon, both ring polygons from
`ringPolygon()`, the Tier 0 read window in its source CRS and in WGS84, the matched
control cells with boundaries from `cellBoundaryLngLat()`, and the Tier 1–3 evidence
locations as cell centroids, labelled `SIMULATED`. Coordinates are rounded to six
decimals (about 11 cm). `app/src/Map.tsx` draws it as an SVG over its own graticule
and scale bar, with a layer toggle and a provenance badge per layer; simulated layers
are hatched or dashed, not only coloured. Hovering a cell shows its id and which ring's
mean it feeds. A `details` block reads the map as text. A bundle without the block gets
an explicit empty state. The three committed bundles in `app/public/demo/` were
regenerated with `DEMO_FIXED_TIME=2026-09-10T00:00:00.000Z npm run demo`; the diff is
purely additive.

### Tests / validation

* `verify/spatial.test.ts` — five cases: the block carries parcel, rings, window and
  the matched ids the result cites; ring extents agree with the plan radii within 2%;
  the WGS84 read window contains the far ring; cell boundaries equal `geometry.ts`
  output; and `resultHash` is unchanged against the committed bundle.
* Root: `npm run typecheck` clean; `npm test` 12 files, 73 tests passing.
* `app/`: `npm run lint` clean (the pre-existing `exhaustive-deps` warning on the
  trajectory chart is gone: the margins are module constants); `npm run build` passes.
* Rendered in headless Chromium over the DevTools protocol at 1440 px and 420 px, all
  three runs and the About page: no horizontal overflow at either width, live region
  present, criterion rendered, 63 map paths drawn, `/about` served as a deep link by
  `vite preview`.

### Architectural, scientific and security decisions

* No basemap and no client-side raster (`DECISIONS.md` §2). The map draws vectors
  only; a link opens the location in OpenStreetMap.
* Geometry on the envelope, not in the hashed result (`DECISIONS.md` §2).
* Matched cell boundaries are serialised server-side rather than derived in the browser
  with `h3-js`. Sixty cells cost about 8 KB; adding `h3-js` to the application would cost
  more, and the application keeps its two dependencies.
* In the `synthetic` run the control cells inherit the snapshot's `SIMULATED` label,
  following the rule in `models.ts` that every downstream artefact of a perturbed
  snapshot inherits it, even though the perturbation touches parcel observations only.
* The parcel is drawn in the REAL blue, never in a colour a verdict uses.

### Deviations from the documented design

* #10 asked to derive cell boundaries in the browser; they are serialised instead (above).
* #10 asked to link scene hover to the map; the bundle has no per-scene geometry, so the
  map says so instead of implying it. Per-cell series are not in the bundle either, so
  selecting a cell names the mean it feeds rather than highlighting a series.
* #12 proposed tab labels with settled quantities in them; the tabs carry the rule's
  behaviour instead, so a re-run with different data cannot leave a stale number in a tab.

### Review round

The repository's Claude Code Review workflow ran twice on the pull request and posted
nothing: 7 turns, one permission denial, no comments each time (issue #16). A local
review of the branch at medium effort returned eight findings; all eight were fixed:

* The About route unmounted the dashboard and re-ran verification on return. The
  dashboard now stays mounted and hidden behind the About page.
* The trajectory legend hard-coded `REAL` on the control series while the map marked
  the same cells `SIMULATED` in the synthetic run. The chart takes the bundle's control
  provenance.
* The About page said indexed history exists in the present tense. Reworded.
* The bare `.band` layout rule also matched the legend swatch class. Renamed.
* The build-state strip said "unsent" even when Guardian had acknowledged delivery, and
  its "why" sentence named no actor. The Guardian row is conditional and the verify
  service is the actor.
* "2.23 ha released" read as funds moved. Headlines state the rule's decision ("The
  rule releases…"), and the delivery card is "Verdict delivery status".
* The back link used a relative `href`. It uses the route helper.
* Tab outcome phrases were fixed per scenario and could contradict a live result. Once
  a run has loaded, its tab derives the phrase from `verificationStatus`.

### Unresolved risks

* All three committed bundles still carry `contract.chain: null`, so no run shows
  settlement completing. Filed as an issue.
* The committed bundles carry the host's absolute `outboxPath`. Filed as an issue.
* The About page's status table is hand-written; it drifts if `ARCHITECTURE.md` §8 moves
  and nobody follows the pointer.
* The map's equirectangular projection is exact enough at a 4 km extent and would not be
  at a continental one.

### Next steps

#4, Arc Testnet deployment, remains the open M1 deliverable. #8 (project switcher) and
#9 (origination design) are unchanged and sequenced behind it.

---

## 2026-09-10 — Continuous deployment to AWS: GitHub Actions, one EC2 host, Guardian beside it

### Objective

Make `main` deploy itself to a live, publicly reachable demonstration on AWS for the
hackathon submission: the container stack from `docs/DEPLOYMENT.md` §7 and, on demand,
the Hedera Guardian quickstart alongside it — with the pipeline living in this
repository as GitHub Actions. Owner's instruction: "implement the CI/CD to deploy the
changes to main branch to a live application, hosted on AWS."

### Implementation

* `.github/workflows/ci.yml` — every suite the repository has, on every PR and branch
  push, and as a reusable workflow: typecheck + vitest, frontend lint + Vite build,
  pytest parity, `forge test` (foundry-toolchain), and a clean `docker compose build`.
* `.github/workflows/deploy.yml` — on push to `main`: CI, then three matrix jobs assume
  an IAM role through GitHub's OIDC provider and push `ecorestore/{analysis,verify,
  frontend}` to ECR tagged with the commit SHA (registry build cache), then one SSM
  Run Command advances the host's checkout to that commit and runs
  `deploy/host/deploy.sh`, then the job smoke-tests `DEMO_URL/health` and the page.
  Deploys are serialised and never cancelled.
* `.github/workflows/guardian.yml` — manual `up` / `down` / `status` / `logs` for the
  Guardian quickstart on the host via `deploy/host/guardian.sh`.
* `deploy/cloudformation/demo-host.yml` — the one-time stack: `t3.xlarge` Amazon
  Linux 2023 with an EIP and an encrypted 80 GB gp3 root, security group 80/443 (+3000
  for the Guardian UI, closable by parameter), no SSH; instance role limited to SSM,
  ECR pull and `/ecorestore/*` parameters; three ECR repositories with a keep-10
  lifecycle; GitHub OIDC provider (reusable) and a deploy role trusting only this
  repository's `main` and its `demo` environment. User-data installs Docker and the
  compose plugin and clones this repository and Guardian at tag `3.7.0`.
* `deploy/docker-compose.aws.yml` — overlay on `docker-compose.yml`: images from ECR at
  `IMAGE_TAG`, `build` reset, frontend host port removed, a `caddy` edge on 80/443 with
  automatic TLS when `DOMAIN` is set (`deploy/caddy/Caddyfile`).
* `deploy/guardian/docker-compose.public.yml` — overlay on Guardian's
  `docker-compose-quickstart.yml`: republishes the web proxy on `0.0.0.0:3000`; nothing
  else in Guardian is exposed.
* `deploy/host/deploy.sh` — reads `/ecorestore/demo/*` from Parameter Store into the
  process environment (no `.env` written), logs in to ECR with the instance role, adds
  `docker-compose.override.yml` only if `guardian-quickstart_default` exists, and runs
  `compose up -d --wait`, then checks `/health` through Caddy.
* `deploy/host/guardian.sh` — the same for Guardian, from `/opt/ecorestore/guardian`,
  with `OPERATOR_ID`/`OPERATOR_KEY` from `/ecorestore/guardian/*`.
* `deploy/README.md` — the runbook; `docs/DEPLOYMENT.md` §7.7, §11, §12 updated and
  §13 added; `README.md` pointer; `.dockerignore` excludes `deploy/` and `.github/`.
* Branch protection on `main` (GitHub API, not in the repository): the five CI jobs
  `typescript`, `frontend`, `analysis`, `contracts`, `images` are required status
  checks, force pushes and deletion are blocked, and administrators are not exempt.
  Merges to `main` therefore go through a pull request with green CI.
* `app/src/App.tsx` — the CI lint job exposed a pre-existing
  `react-hooks/set-state-in-effect` error: the three state resets moved from the
  effect body into the scenario-select and re-run handlers (a same-scenario click is
  now a no-op rather than a reset with no reload). Behaviour otherwise unchanged.

### Tests / validation

Run locally in the worktree, on the code as committed:

* `npm run typecheck` clean; `npm test` 9 files, 54 tests passed.
* `app`: `npm run lint` 0 errors (1 pre-existing `exhaustive-deps` warning in
  `charts.tsx`); `npm run build` succeeds.
* `analysis`: `pytest` 29 passed (parity, RNG, acquire, server).
* `forge test` via `ghcr.io/foundry-rs/foundry`: 31 passed.
* `docker compose -f docker-compose.yml build`: all three images build.
* `docker compose -f docker-compose.yml -f deploy/docker-compose.aws.yml config`
  (with and without `docker-compose.override.yml`): `build` removed, ECR images set,
  frontend port gone, Caddy on 80/443, `GUARDIAN_URL=http://web-proxy:80` and the
  external network present only when the override is included.
* The Guardian overlay validated against the actual `docker-compose-quickstart.yml`
  of the local 3.7.0 checkout: web-proxy published on `3000:80`, no loopback bind.
* `actionlint` 1.7.12, `cfn-lint` 1.56.2, `shellcheck` 0.11 (style level): clean.

**Not validated at the time of writing:** anything on AWS. Later the same day the
stack was created in us-west-2 (`ecorestore-demo`, host `32.189.224.38`), the
parameters, secret, variables and `demo` environment were set, and PR #5 merged. The
first Deploy run (`34480834081`) failed at the OIDC step in every build job:
`Not authorized to perform sts:AssumeRoleWithWebIdentity`. CloudTrail showed the
presented subject as `repo:JayMatsushiba@45748435/ecorestore-network@1358238302:environment:demo`
— GitHub's immutable subject format, the default for repositories created after
2026-07-15, which the trust policy's name-only patterns did not match. The template
now accepts both forms (`GitHubOwnerId`, `GitHubRepositoryId`); the stack was updated
in place and the re-run of `34480834081` succeeded: three images pushed to ECR, the
SSM deploy completed, `/health` answered through Caddy. The first live verification
then failed on outbox permissions (*Unresolved risks*); after the fix all three
scenarios ran through `http://32.189.224.38/api/verify/<scenario>` on the Python
engine — `real` NOT_ADDITIONAL, `synthetic` PARTIAL (SIMULATED, labelled),
`trend-failure` INSUFFICIENT_EVIDENCE — in about one second each. A second push to
`main` (PR #6, the Claude review workflows) deployed again without intervention.

### Architectural, scientific and security decisions

* Nothing in the authority model changes. The deployed stack is the local stack: the
  same compose file, the same network split (`analysis` internal-only, `verify` the sole
  key holder, the frontend knowing only `verify`), the same Guardian attachment rule.
* GitHub ↔ AWS trust is OIDC-only, scoped to this repository's `main` and `demo`
  environment; the role can push to three repositories and run a shell script on one
  instance. No AWS key exists in GitHub; no SSH key or port exists on the host.
* Secrets are SSM Parameter Store `SecureString`s read on the host at deploy time,
  never a `.env` and never a GitHub secret — `DEPLOYMENT.md` §8 as built. The deployment
  must use a fresh `VERIFIER_SEED`, not the local default.
* No chain on AWS (`DEPLOYMENT.md` §4). `DEMO_RPC_URL` is absent from the host's
  parameters by design; deployed verifications prepare calldata and report that.
* Guardian is a manual, separately-switched workflow because running it is a cost
  decision, not part of the build. Only its web proxy is published, and the security
  group rule for it is a parameter that can be emptied.
* CloudFormation rather than Terraform or CDK: one file, one CLI, no state backend.
  This closes the open tool choice recorded in `DEPLOYMENT.md` §12.
* The host runs the compose projects as root via SSM. Acceptable for a demonstration
  host holding only testnet material; recorded as a risk below.

### Deviations from the documented design

* `DEPLOYMENT.md` §2–§3 describe S3 + CloudFront for the application tier and Lambda for
  verification. The container path (§7, added earlier today) supersedes that for the
  hackathon: one host serves all three tiers. §11 now says so; §2–§3 remain as the
  lower-cost arrangement for later.
* `docs/DEPLOYMENT.md` §7.7 previously said the AWS deployment was "a later milestone";
  it now points at §13, and §12 records the live deployment.

### Unresolved risks

* **Two defects found only by running it, both fixed the same day.** (1) The deploy
  role's trust policy did not match GitHub's immutable OIDC subject (see *Tests /
  validation*); the stack was updated in place. (2) The first live verification failed
  with `EACCES` on the outbox: `deploy.sh` created the bind-mounted directory as root
  and `verify` runs as the image's `node` user (uid 1000); the directory was handed
  to that uid on the host and the script now does so after `mkdir`. Between the
  ownership fix on the host and the merge of the script fix (PR #7), a fresh host
  would reproduce (2).
* **Compose on the host is unpinned.** User-data installs the latest Compose release
  (v5.5.1 at bootstrap); `!reset`/`!override` need ≥ 2.24.
* **Copilot review (PR #5) fixes, applied the same day:** Guardian UI port closed by
  default; `deploy.sh` refuses a missing or default `VERIFIER_SEED` and any
  `DEMO_RPC_URL`/`DEMO_MNEMONIC`; attachment requires a *running* Guardian web-proxy
  on the network, not just the network; old SHA-tagged images are removed after each
  deploy; `guardian.sh down` detaches foreign endpoints first; `deploy.yml` and
  `guardian.yml` use separate concurrency groups and the SSM commands take a host
  `flock` *before* the checkout (the scripts inherit it via `ECORESTORE_HOST_LOCK`),
  and `guardian.yml` no longer moves the application checkout at all — only a deploy
  does; the smoke test fails when `DEMO_URL` is unset; ECR repositories set
  `EmptyOnDelete`; the instance gets a launch-time public IP so user-data has a route
  out before the EIP attaches; the `demo` environment is restricted to protected
  branches because an environment-bound job presents the environment OIDC subject,
  not the branch.
* **Root on the host.** SSM Run Command runs as root and so do the compose projects. A
  dedicated user would be better hygiene; not done.
* **Guardian UI exposure.** Port 3000 is closed by default (`GuardianUiCidr=""`);
  opening it for a judging window is a stack update with a /32. The Standard Registry
  password in the quickstart env is the upstream demo default — change it before
  opening the port.
* **Plain HTTP by default.** Without a domain the site is served over HTTP on the EIP.
  Setting `/ecorestore/demo/DOMAIN` to a record pointing at the EIP gives HTTPS via
  Caddy with no other change.
* **Arc Testnet is still not deployed** (M1), so the settlement claim is still shown as
  prepared calldata, on AWS as locally.

### Next steps

1. Merge PR #7 so the repository matches the running stack (trust policy, outbox
   ownership). Consider pinning the Compose version in user-data and adding a
   non-root deploy user on the host.
2. Deploy `RestorationDeed` to Arc Testnet (M1) and, once it exists, decide how the
   deployed `verify` addresses it.
3. Author and publish a Guardian policy carrying `ecorestore_verdict_ingest`; until
   then a Guardian `200` remains delivery, not a policy run.

---

## 2026-09-10 — Second review pass: stale demonstration bundles, reference drift, engine binding

### Objective

Act on the six findings of the re-review of PR #3 — two new, four the first pass had not
surfaced. All six held when checked. One of them contradicted a claim this project had
made about itself, which makes it the most important of the set.

### Implementation

**The committed demonstration bundles were stale.** `app/public/demo/*/assurance-bundle.json`
carried no `result.analysisEngine` and no `runtime`, and were missing
`presentation.document` entirely. `analysisEngine` became part of the hashed result when
the engine was split, so these files could not be produced by the current pipeline at
all — and the PR description claimed they had been regenerated. They were, in the review
fix pass, *before* the engine identity existed; nothing regenerated them afterwards.
Regenerated with `DEMO_FIXED_TIME=2026-09-10T00:00:00.000Z`; every `resultHash` moved
(`real` `0xfc25a605…` → `0x2fb065b7…`, `synthetic` `0x8a42ed45…` → `0x9534e805…`,
`trend-failure` `0x6ba2f1ea…` → `0x7d2d0e0b…`). A second run of the demo produces
byte-identical files, which is what "reproducible" was supposed to mean.

**`sent` is not acceptance.** `submitToGuardian()` reports any HTTP answer as `sent`, so
the interface rendered a `500` as "submitted … gateway acknowledgement only". The
adapter's own `detail` had this right — it attaches `GUARDIAN_ACCEPTED_NOTE` only on
`res.ok` — and only the presentation layer overstated. Now a 2xx renders as submitted
with the acknowledgement caveat, and anything else renders as *rejected — the gateway
refused the document; NOT submitted and no policy run*.

**The parity references were testing history.** `analysis/tests/reference/*.output.json`
are dumps from the TypeScript engine that the Python suite replays. Nothing tied them to
the live `analyseTier0()`, so a change there would have left `npm run test:analysis`
green while the two engines diverged. `verification/analysis-reference.test.ts`
recomputes all five cases — outputs, plan hashes, snapshot hashes and the gzipped
canonical snapshots — and fails on any difference. The case definitions moved to
`verification/analysis-reference-cases.ts`, shared with the dump script, so the check
cannot drift from what it checks. Verified by perturbing a committed reference: the test
fails.

**The client binds to an engine.** `remoteBackend()` checked the plan and snapshot
receipts but accepted any `engine` in the response, so a rollout between `/health` and
`/analyse` could commit a result to one engine while callers reported another.
Mismatches now throw, with four tests over the guards.

**Host setup and build context.** `npm run test:analysis` invoked the system `python`
regardless of the virtualenv the README had just created, and that install bypassed
`constraints.txt` — the drift this project had already documented as a risk, written
into its own quickstart. The script now prefers `analysis/.venv/bin/python`, and the
README installs with `-c analysis/constraints.txt`; a fresh venv built that way resolves
NumPy 2.5.3 / SciPy 1.18.1, the same stack as the image. Separately, the analysis image
builds with `./analysis` as its context, so the repository-root `.dockerignore` never
applied: `analysis/.dockerignore` now excludes the virtualenv and caches, deliberately
keeping `tests/reference` since running parity as a build stage is a stated next step.

### Tests / validation

| Suite | Result |
|---|---|
| `npm test` (vitest, 11 files) | 68 passed (was 54) |
| `npm run typecheck` | clean |
| `npm run test:analysis` on a venv built per the README | 33 passed on NumPy 2.5.3 / SciPy 1.18.1 — the image's stack |
| New: `verification/analysis-reference.test.ts` | 10 cases; perturbing `real.output.json` fails it, as intended |
| New: `verification/analysis-client.test.ts` | 4 guards — engine mismatch, plan mismatch, snapshot mismatch, well-formed |
| Demo re-run with `DEMO_FIXED_TIME` | byte-identical bundles on all three scenarios |
| Frontend image build (`tsc -b && vite build`) | clean |
| Full stack, three scenarios concurrently on anvil | `NOT_ADDITIONAL` / `PARTIAL` 2.2271 ha / `INSUFFICIENT_EVIDENCE`, engine `ecorestore-analysis-py 1.0.0` |
| nginx-served fallback bundle | carries `analysisEngine` and `resultHash 0x2fb065b7…` |
| Analysis build context | 466 MB → 469 B |

### Architectural, scientific and security decisions

1. **A committed artefact that the pipeline cannot reproduce is not evidence.** The
   demonstration bundles are the offline fallback the interface shows when the API is
   unreachable; showing a result whose hash no longer corresponds to anything is worse
   than showing nothing.
2. **A dump is not a test.** Reference files pin one side of a comparison. Something has
   to keep pinning them to the thing they were dumped from.
3. **Bind to the engine, not just to the inputs.** Receipts proved *what* was analysed;
   the engine identity proves *by what*, and it is in the hash.
4. **The quickstart is part of the reproducibility surface.** A pinned image and an
   unpinned developer install is one guarantee and one hole.

### Deviations from the documented design

None.

### Unresolved risks

- A non-2xx Guardian response is not staged to the outbox: the request is neither
  accepted nor retained, though the bundle still carries it. Unreachable and unset are
  both staged. Worth reconciling when a real policy exists.
- The engine version was still not bumped; see the previous entry.
- Parity in the image is still not run as a build stage.

### Next steps

Unchanged: AWS deployment, a Guardian policy, and Arc Testnet deployment of
`RestorationDeed` — the open M1 deliverable.

---

## 2026-09-10 — Review pass on the container stack: determinism, provenance binding, chain concurrency

### Objective

Act on the seven findings of an automated review of PR #3. Each was checked against the
code before anything was changed; all seven held. Nothing here alters methodology or
numerics — the changes close ways the *same* numbers could end up bound to the wrong
thing, or the same inputs could stop producing the same numbers.

### Implementation

**Scene ordering is `(datetime, sceneId)`** in both acquisition implementations
(`analysis/ecorestore_analysis/stac.py`, `verification/stac.ts`). Sorting by datetime
alone is stable, so ties fell back to the catalogue's paging order — and granules of one
pass share an acquisition datetime. The scene array is canonicalised into
`snapshotHash`, so the commitment was dependent on the order Earth Search happened to
page. The committed fixture has 72 distinct datetimes, so nothing moved; the hazard was
latent, not realised.

**The acquisition handoff carries its own geometry.** `acquire.py` writes
`sourceParcel` — the `parcelId`, geometry and H3 resolution it actually read — into the
unhashed document. `scripts/finalize-acquisition.ts` verifies that geometry hashes to the
repository parcel's `geometryHash` and `h3Root` before attaching them, then strips the
field. Previously it checked only `parcelId`, and `ecorestore-acquire --fixtures` will
read any parcel it is pointed at: a snapshot derived from different coordinates would
have been committed under the repository parcel's identity, with the provenance binding
asserting something untrue.

**Chain-backed runs are serialised** (`verify/server.ts`). Deduplication was per
scenario, but the collision is across scenarios: every scenario deploys and settles from
the same deterministic accounts, and two concurrent runs read the same
`eth_getTransactionCount` and produce a replacement or a failure. `chain()` now memoises
the setup *promise* rather than its resolved value — two concurrent first callers both
saw `undefined` and would both have deployed — and does not cache a failure. Runs with a
chain context queue behind one another; analysis-only runs stay concurrent.

**The analysis response body is the contract's `AnalysisOutput` and nothing else.**
`elapsedSeconds` was an undeclared, wall-clock-dependent field on a boundary whose
output `verify` assembles into a hashed document. It moved to the
`x-analysis-elapsed-seconds` header.

**The analysis image installs against pinned constraints.** `analysis/constraints.txt`
pins the entire resolved set. `pyproject.toml` declared `numpy>=1.26`, and the drift was
not hypothetical: the built image carries NumPy 2.5.3 / SciPy 1.18.1 while the
development host had 1.26.4 / 1.11.4 — two numeric stacks under one `analysisEngine
1.0.0`, which is exactly what the identity exists to rule out. `GET /health` now reports
the versions actually loaded (`numericStack`), surfaced through `verify`'s `/health`, so
drift is visible without waiting for a parity run. `ENGINE` carries the rule that its
version bumps when a pin moves.

**Documentation.** `DEPLOYMENT.md` §7.4's example reported 72 usable scenes against 72
total; the reference outputs say 61 of 72. `DECISIONS.md` carried the same error in a
sentence that contradicted itself. `GUARDIAN.md` §10 stated that a Guardian instance
runs alongside the stack, which contradicted §9 and the roadmap's unbuilt list; nothing
in this repository starts Guardian, so it is now a dated validation result against a
quickstart the operator runs separately, and §9 says what the delivered stack does and
does not contain.

### Tests / validation

| Suite | Result |
|---|---|
| `npm test` (vitest, 9 files) | 54 passed |
| `npm run typecheck` | clean |
| pytest, run **inside** `ecorestore/analysis:latest` | 33 passed (was 29): parity still bit-exact on the image's NumPy 2.5.3 / SciPy 1.18.1 |
| New: `test_analyse_body_is_exactly_the_contract_output` | HTTP body keys and values equal the reference — the gap that let `elapsedSeconds` through, since `test_parity` calls `analyse()` directly |
| New: `test_identical_requests_get_identical_bodies` | two POSTs of one request return identical bytes |
| New: `analysis/tests/test_constraints.py` | every declared dependency is pinned; no pin below its declared minimum |
| `finalize-acquisition` on the committed fixture with a `sourceParcel` handoff | reproduces `snapshotHash 0x5be25dd2…` exactly — the handoff is stripped and does not perturb the hash |
| Same, geometry shifted 0.01° under the correct `parcelId` | refused: `acquisition read a different geometry` |
| Same, H3 resolution 9 instead of 10 | refused |
| Same, no handoff at all | refused, with the instruction to re-acquire |

### Architectural, scientific and security decisions

1. **A matching id is not a matching parcel.** The identity attached to a snapshot must
   be the identity of the geometry that produced it, verified, not inferred from a
   string equal on both sides.
2. **A named runtime is worth what its environment is worth.** `analysisEngine` is a
   claim about which numbers come back; an unpinned NumPy makes that claim unfalsifiable.
   The pins are part of the identity, and the rule for moving one is written where the
   pins are.
3. **Nothing wall-clock-dependent crosses the analysis boundary.** The receiving side
   builds a hashed document; convenience fields are a hazard there.
4. **Serialise on the shared resource, not on the request.** Per-scenario deduplication
   was the wrong axis — the contention is the account, not the scenario.

### Deviations from the documented design

None. Every change enforces a rule the documents already stated.

### Unresolved risks

- Parity is verified against whatever stack is installed. The pins make the *image*
  reproducible; a developer host installed outside `constraints.txt` still runs a
  different NumPy, and only the parity suite would catch it. Running the parity suite as
  a build stage in the image would close this.
- `resultHash` is still not reproducible across service runs — `computedAt` is the wall
  clock and the service does not yet accept a fixed time. Unchanged by this pass.
- Chain-backed runs are now serialised, which bounds throughput to one settlement at a
  time. Correct for a demonstration; a real deployment needs per-role nonce management.
- The engine version was **not** bumped, because the pins record the stack the committed
  bundles were produced on rather than changing it. The next pin move must bump it and
  regenerate the bundles.

### Next steps

Unchanged from the previous entry: AWS deployment, a real Guardian policy, and Arc
Testnet deployment of `RestorationDeed` — still the open M1 deliverable.

---

## 2026-09-10 — Containerised prototype: Python analysis, TypeScript verify, frontend, Guardian attached

### Objective

Run the prototype as containers, on the owner's instruction: the spatial analysis
rewritten in Python "to make it easier to have a more conventional spatial analysis
pipeline", with acquisition (batch) sharing its image; verification in its own
container; the frontend in its own; all able to reach the Guardian instance running
locally on `localhost:3000`; one compose file that brings up the first prototype. AWS
deployment is deferred to a later milestone. `docs/` updated where the build differs
from what was documented.

### Implementation

**The analysis boundary** (`verification/analysis-contract.ts`, `engine.ts`). The engine
was split at the seam `DEPLOYMENT.md` §7 had proposed: `analyseTier0()` holds everything
upstream of canonicalisation and returns numbers; `assembleResult()` holds status
resolution, the Tier 1–3 gates, corroboration, provenance, the evidence commitment and
the hash. `verify()` composes the two in-process and is unchanged in behaviour;
`verifyWith(input, backend)` takes any `AnalysisBackend`. Requests cross the boundary as
canonical bytes with hash receipts (`planHash`, `snapshotHash`); the analysis side checks
each by hashing the opaque string and never re-serialises. The result now carries
`analysisEngine`.

**Python analysis service** (`analysis/`, `python:3.12-slim`, ~790 MB with the
scientific stack). FastAPI: `GET /health`, `POST /analyse`. Receipts verified with
pycryptodome keccak; a mismatch is a `422`. The pipeline ports the reference numerics:
numpy and scipy for the regression and t-distribution; an exact port of mulberry32 whose
stream is vectorised — the state advances by a constant, so the *n*-th output is a
function of `(seed, n)` — and column-wise accumulation in the bootstrap so
floating-point order matches the reference loop. Sums are sequential because Python
3.12's built-in `sum()` compensates float error and does not reproduce the reference.

**Parity.** `scripts/dump-analysis-reference.ts` writes five (request, output) pairs from
the TypeScript side; `analysis/tests/test_parity.py` replays them and asserts every
number equal. The first run differed in exactly two values (the compensated sum); after
the fix, all five cases are bit-identical: interval, coverage, control sets, regression.
The three demo scenarios computed by the two engines differ only in `analysisEngine` and
therefore `resultHash`.

**Verify service** (`verify/`, `node:22-slim` with a Foundry stage compiling the
contracts). `verify/pipeline.ts` holds one scenario end to end and is shared with
`scripts/demo.ts`; `verify/server.ts` exposes `/health`, `/api/scenarios`,
`POST /api/verify/:scenario`, `/api/results`. Runs TypeScript directly via `tsx`.

**Frontend** (`app/Dockerfile`: Vite build served by `nginx:alpine`, 74 MB). The page
POSTs `/api/verify/<scenario>`, falls back to the committed bundle when the API is
unreachable and says which it is showing, names the analysis engine, reports Guardian's
outcome, and renders the SIMULATED banner *inside* the settlement card for the synthetic
scenario (`DEPLOYMENT.md` §9 obligation).

**Guardian.** `submitToGuardian()` has three outcomes: `sent`, `outbox`, `failed`
(unreachable; staged to the outbox as well). Its `2xx` message states that the gateway
acknowledged delivery, not that a policy ran.

**Compose.** `docker-compose.yml`: `analysis` on an `internal: true` network (no
gateway); `verify` on `internal` + `edge`, published on `127.0.0.1:8090`; `frontend` on
`edge`, published on `127.0.0.1:3001`; profiles `chain` (anvil) and `acquire` (batch
job). `docker-compose.override.yml`, merged by default, joins `verify` — only `verify` —
to `guardian-quickstart_default` and points it at Guardian's `web-proxy`.

**Acquisition in Python** (`acquire.py`, `geometry.py`, `stac.py`, `cog.py`; processing
graph `2.0.0`): pystac-client, rasterio windowed reads, h3 + shapely + pyproj frame. It
writes an *unhashed* snapshot; `scripts/finalize-acquisition.ts` (`npm run
acquire:finalize`) attaches `geometryHash`, `h3Root` and `snapshotHash`, compares with
the committed fixture, and writes it. The committed fixture was not replaced.

### Tests / validation

| Suite | Result |
|---|---|
| `npm test` (vitest, 9 files) | 54 passed — unchanged after the engine split |
| `npm run typecheck` | clean, including `verify/` and the new scripts |
| `npm run test:analysis` (pytest) | 29 passed — 5 parity cases bit-exact, RNG stream, server, acquisition geometry |
| `docker compose config` (with and without override) | valid |
| `docker compose up` + three scenarios via `localhost:3001/api/verify/*` | `NOT_ADDITIONAL` / `PARTIAL` 2.2271 ha / `INSUFFICIENT_EVIDENCE`; engine `ecorestore-analysis-py 1.0.0`; 0.2–0.3 s each |
| Guardian 3.7.0 quickstart, from `verify` | `POST /api/v1/external/…` → `200 true` on all three; `/health` sees Guardian (`401` on an authenticated probe) |
| Network containment | from `analysis`: Earth Search and `web-proxy` unreachable; from `verify`: `web-proxy` answers |
| `--profile chain` (anvil) | synthetic: 11 transactions, milestone `RELEASED`, restorer +22,056.50 (18,000 mobilisation + 4,056.50), steward +2,450.72, retained 795.39; real: milestone `FAILED`, mobilisation only |
| `--profile acquire --limit 2` (network, in Docker) | same 402×382 grid, same 857 units (253 / 83 / 520), parcel NDVI identical to the fixture on both scenes; finalize: `geometryHash` and `h3Root` unchanged |
| Host smoke, `--limit 3` | 856 of 857 units shared with the 1.0.0 frame; 91 % of unit NDVI values bit-identical; max difference 0.02 on ring-edge units |

### Architectural, scientific and security decisions

Made within the implementation mandate; the numerics were ported, not changed.

1. **Bit-exact parity is the acceptance test for the Python engine**, not tolerance. Two
   engines that agree on every number are interchangeable behind one contract; two that
   agree "closely" are two methodologies. The seeded generator is therefore ported
   rather than replaced with numpy's, and sums keep the reference order.
2. **The engine is named in the result.** Determinism is per runtime (`DEPLOYMENT.md`
   §5), so the runtime is part of the commitment. Same inputs through the two engines
   give the same quantities and different `resultHash` values.
3. **Python never hashes what it produced.** Analysis echoes receipts it was given;
   acquisition writes an unhashed document and TypeScript finalises it. The
   one-canonicaliser rule is kept structurally, not by convention.
4. **Containment by topology.** `analysis` has no route to anything; `verify` is the
   only container on Guardian's network. Checked, not assumed.
5. **Guardian's `200` is delivery.** Guardian 3.7 queues and acknowledges before the
   policy engine looks for the policy — a nonexistent policy ID also gets `200`. Reported
   as gateway acknowledgement everywhere it appears.
6. **The snapshot travels inline.** The synthetic scenario's snapshot exists only in
   memory on the verify side; a shared volume cannot carry it.

### Deviations from the documented design

- `DEPLOYMENT.md` §7.7 listed the frontend-as-container as an anti-pattern; built on the
  owner's instruction, with the reason recorded (§7.8). The static path stands.
- `CLAUDE.md`'s M1 scope excludes Guardian integration; the owner asked for the
  containers to reach the local Guardian. Delivery to a running instance is done;
  policy authoring is not.
- The proposal's compose `secrets:` block is not used locally; `VERIFIER_SEED` is an
  environment variable with a demonstration default. §8 still governs deployment.
- `verify` ships development dependencies and runs `tsx`; a compiled build is deferred.
- Acquisition graph 2.0.0 uses ellipsoidal areas and projected-plane ring buffers, so
  ring candidates and hectare figures differ slightly from 1.0.0 (parcel 48.95 → 49.10
  ha). Recorded in `processingGraphVersion`; the 1.0.0 fixture remains committed.

### Unresolved risks

- No Guardian policy exists; the seam is delivery-only until one is authored, published
  and the verifier DID registered against its `externalDataBlock`.
- Images are large (`verify` 1.05 GB, `analysis` 790 MB) — dev dependencies and the
  full scientific stack. Fine for a prototype; a compiled `verify` and a
  two-image split for `analysis`/`acquire` would halve them.
- `docker compose up` requires Guardian's network to exist because the override is
  merged by default; without Guardian the `-f docker-compose.yml` form must be used.
- `resultHash` is not reproducible across runs of the service because `computedAt` is
  the wall clock (already recorded in the review fix pass); the service does not yet
  accept a fixed time.
- Verification runs are unauthenticated; the API is bound to loopback and is not meant
  to be exposed as is.

### Next steps

1. AWS deployment of the compose stack beside Guardian on one host (`DEPLOYMENT.md`
   §7.7), Terraform or CDK to be chosen; the credit is unspent.
2. Author and publish a Guardian policy with an `externalDataBlock` tagged
   `ecorestore_verdict_ingest`; register the verifier DID; then the `200` means a run.
3. Deploy `RestorationDeed` to Arc Testnet — still the open M1 deliverable.
4. Decide whether to promote a full 2.0.0 acquisition to the committed fixture.

---

## 2026-09-10 — Review fix pass: doc/code contradictions, restored decisions, regenerated plan hash

### Objective

Act on a max-effort review of the consolidation. Fifteen findings, most of them introduced
by moving proposal prose into documents that read as descriptions of a built system.

### Implementation

**Restored two decisions lost in the deletion.** `VERIFICATION.md` §11 regains the
separation of conservatism from pricing: the lower-bound rule alone loads all measurement
uncertainty onto the restorer including the uncontrollable part, which pays best for large
uniform temperate plantings and penalises the biomes where need is highest; the fix is a
difficulty premium against the ex-ante expected interval width. `DECISIONS.md` §5 now
states the bound and the premium as one rule, since preserving the first without the second
reproduces the outcome the design exists to avoid. `ARC.md` §4 regains monitoring decoupled
from payment — tranches end at 36 months, observation runs the full obligation term.

**Regenerated the plan hash.** The seven `openItem` citations in `analysis-plan.json`
`provisional[]` now cite `docs/DECISIONS.md` §3. Because that block is hashed,
`analysisPlanHash` moved `0xf9b5265f…` → `0xa901a322…`, and every downstream `resultHash`,
credential and bundle with it. Bundles were regenerated with `DEMO_FIXED_TIME` pinned to
`2026-09-10T00:00:00.000Z`, so the committed artefacts are now reproducible rather than
carrying a wall-clock timestamp. Citations in the contract, engine, models, geometry,
adapter, issuance and demo were rewritten; the Guardian `note` string embedded in every
bundle no longer cites a deleted document.

**Corrected claims that were false about the code.** `X402.md` §5.2 stated three
safeguards as implemented; two were overstated. `verify()` is deterministic in
`(plan, evidence, runIndex, computedAt)` and *not* pure in the first three — `computedAt`
defaults to the wall clock and is inside the hash — so the replay guard deduplicates
nothing across re-runs. The `RUN_COUNT` anomaly reaches `critical` at three hidden runs,
not at one, so the alarm as tuned tolerates two silent runs per submission. Both now carry
what must change before metering ships. `DEPLOYMENT.md` §7.4 described `evidenceHash` as a
hash of the snapshot's raw file bytes; it is a four-field digest, the inner `snapshotHash`
is itself a canonical hash over the object minus that field, and a raw-bytes hash matches
neither — following the doc would have forced the second canonicaliser §7.1 forbids.

**Fixed the compose skeleton**, which did not validate: `secrets: [verifier_seed]` had no
top-level definition, and the `internal` network lacked `internal: true`, so the
containment §7.3 claims as structural did not exist. It also passed `ARC_TESTNET_RPC_URL`,
which no TypeScript reads, instead of `DEMO_RPC_URL`.

**Corrected provenance claims.** The datasets table marked eight never-acquired datasets
`REAL` in a column whose peer rows read `SIMULATED, LABELLED`; it now separates *kind* from
*acquired*, and only Sentinel-2 is acquired. `ARCHITECTURE.md` §4 and `DEMO.md` no longer
assert Sentinel-1, Landsat and ICESat-2 acquisitions.

**Marked designed-but-unbuilt surfaces as such** rather than deleting them — pooled deeds
and the Privy treasury flow. Pooled deeds additionally records that `fundDeed()` accepts
any address while `reclaim()` returns everything to the sponsor, so a second contributor
has no claim today.

**Milestone honesty.** `CLAUDE.md`'s Current Milestone described a contracts-first ordering
and listed as unimplemented a set of things the repository contains. It now states what is
built, that Arc Testnet deployment is the one remaining M1 deliverable, and a rule: when
the section and the repository disagree, fix the section. `ARCHITECTURE.md` §8 and
`ROADMAP.md` §2 gain the same built/not-done split. x402 was added to the authority tables
in `CLAUDE.md` and `README.md`, which still listed six components.

Smaller corrections: `PRODUCT.md`'s "13.1 ha" and `DEMO.md`'s "11.2 ha" replaced with the
figures the code generates; `README.md` 28 → 31 contract tests; the Creston Valley site
described as interior rather than coastal, with scene availability recorded as resolved;
`DEPLOYMENT.md`'s tier count, byte counts and timing scoped correctly; the `real` landing
state recorded as already implemented; a seventh and eighth open approval added to
`DECISIONS.md` §3 with the gate thresholds written out, since seven provisional fields were
listed against six approvals and the thresholds appeared in no document.

### Tests / validation

- `npm test` — 54 passed, 9 files, after the citation and fixture changes.
- `npm run typecheck` — clean.
- `npm run demo` with `DEMO_FIXED_TIME` — three scenarios, unchanged outcomes
  (`NOT_ADDITIONAL`, `PARTIAL` at 2.2271 ha, `INSUFFICIENT_EVIDENCE`). The estimates did
  not move; only the plan hash and the hashes over it did.
- The corrected compose block was validated with `docker compose config`: exit 0, with
  `internal: true` and the secret resolving. The previous block was confirmed invalid.
- No reference to the removed proposals remains in `docs/`, `README.md`, `CLAUDE.md`, or in
  any TypeScript, Solidity or fixture file — this time the sweep covered code.

### Architectural, scientific and security decisions

- **Aspirational documentation is allowed; false statements about code are not.** Design
  intent stays, marked as design. A claim that evidence exists, that a safeguard is
  implemented, or that a command works is checked against the tree.
- **Provenance is not subject to the above.** A dataset that has not been ingested may not
  be marked real in a provenance table, and no interface may show scene IDs for an
  unacquired sensor.
- **`computedAt` must stop defaulting to the wall clock** before metered verification
  ships. Recorded in `X402.md` §5.2 rather than changed here, because it alters every
  published hash and belongs with the M6 decision.

### Deviations from the documented design

None. Restorations reinstate previously adopted decisions; the rest are corrections.

### Unresolved risks

- `computedAt` still defaults to the wall clock, so `resultHash` is not reproducible unless
  a caller pins it. The committed artefacts pin it; nothing enforces that.
- The `RUN_COUNT` threshold of three is unchanged. It is defensible without a paywall and
  not with one.
- Pooled funding remains reachable: `fundDeed()` still accepts any address. The
  documentation now warns, but the contract does not prevent it.
- The eight open methodology approvals in `DECISIONS.md` §3 still block M2.

### Next steps

1. Deploy `RestorationDeed` to Arc Testnet — the remaining M1 deliverable.
2. Decide whether `fundDeed()` should be restricted to the sponsor for now.
3. Settle the open methodology approvals before M2 work begins.

---

## 2026-09-10 — Documentation consolidation: `docs/` becomes the source of truth

### Objective

Move the load-bearing content out of `proposals/` and `ideation/` into `docs/`, then
remove both directories, on the owner's instruction that the proposal and ideation
documents are starting points rather than binding rules and that further updates are made
against `docs/`. No code changed.

### Implementation

Three documents created to carry content that existed nowhere in `docs/`:

- `docs/PRODUCT.md` — one-page summary, positioning, the honest market figures, the
  corporate buyer and the regulatory drivers, the restatement-risk framing, supply-side
  design constraint, sponsor stack, treasury controls and pooled deeds, and the central
  rule.
- `docs/ROADMAP.md` — build sequence ordered against September 30, the M0–M7 table, M0's
  honest state, out-of-scope list and cut order.
- `docs/DECISIONS.md` — decisions and the reasons behind them, the six methodology
  decisions still requiring approval, open questions and risks, and the constraints not
  open to revision.

Existing documents absorbed the rest: the dataset table into `VERIFICATION.md` §3, cohort
verification into `ARC.md`. Every reference to the removed documents was rewritten to
point at `docs/` — 28 sites across `ARCHITECTURE.md`, `VERIFICATION.md`, `ARC.md`,
`X402.md`, `DEPLOYMENT.md`, `README.md` and `CLAUDE.md`.

`CLAUDE.md` no longer names a canonical proposal. It points at `docs/` and states that
these are working documents, with the exception of the constraints in `DECISIONS.md` §5.

`ideation/` and `proposals/` removed — 4777 lines across eight files.

### Tests / validation

No code changed. Validation was documentary:

- No reference to `idea-0.3`, `idea-0.2`, `proposals/`, `ideation/` or `proposal_review`
  remains in `docs/`, `README.md` or `CLAUDE.md`, except in the historical log entries
  below, which are deliberately preserved.

  **This sweep was scoped to prose and missed the code.** 42 further references survived
  in TypeScript, Solidity and fixture files, including seven `openItem` citations inside
  the `provisional[]` block of `analysis-plan.json` — a hashed field, so the stale
  citations were committed into `analysisPlanHash` itself. Corrected in the following
  entry.
- Every claim carried across was taken from the source text rather than paraphrased from
  memory: the BNG and VCM figures, the regulatory drivers, the milestone table, the risk
  assessments and the six open approvals.

### Architectural, scientific and security decisions

- **`docs/` is the source of truth.** A single baseline document that must not be
  modified, sitting alongside documentation that must be, produced two sources of truth
  and a rule against updating the more authoritative one. Working documents that are
  expected to change are the more honest arrangement.
- **Reconciliation provenance was not carried across.** The tables recording which of the
  four source documents each decision came from are archaeology once those documents are
  gone; git history holds them. What was carried is the *reason* for each decision, which
  is what stops a later contributor re-proposing something already rejected for cause.
- **The non-negotiable constraints are stated as such** in `DECISIONS.md` §5 — the AI
  settlement boundary, real-versus-simulated labelling, pre-registration, lower-bound
  settlement, and `INSUFFICIENT_EVIDENCE` as a valid outcome. Loosening the proposal's
  authority should not loosen those.

### Deviations from the documented design

None. This is a relocation of content, not a revision of it. Where wording was tightened,
the substance and the figures are unchanged.

### Unresolved risks

- The six methodology decisions in `DECISIONS.md` §3 remain unapproved and still block M2.
- Historical log entries reference section numbers that no longer resolve to a file in the
  working tree. The header note above explains this; the alternative was rewriting a dated
  record, which is worse.

### Next steps

1. Deploy `RestorationDeed` to Arc Testnet — M1 is not closed until it exists.
2. Settle the six open methodology decisions before M2 work begins.

---

## 2026-09-10 — Deployment and x402 documentation

### Objective

Record how the demonstration is intended to run on AWS alongside a Guardian instance,
and how API payment would work if it ships, without either document being mistakable for
a record of work done. No code changed.

### Implementation

- `docs/DEPLOYMENT.md` (new). Four tiers — static application, Arc Testnet settlement,
  optional verification, optional Guardian host — ordered so the expensive and
  security-sensitive tiers can be dropped without breaking the demonstration. §7 records
  the container architecture for a **proposed** Python/TypeScript split of the pipeline.
  §8 covers key custody, §9 the provenance obligations a public URL creates.
- `docs/X402.md` (new). Authority boundary, Hedera's payment scheme, the
  specification-search coupling, account separation, determinism requirement.
- `docs/ARCHITECTURE.md` §2 and §7 amended: the x402 gateway added to the authority
  model and given a component boundary with its `may not` list.
- `README.md` documentation index updated.

### Tests / validation

No code changed; validation was documentary, with two operational checks run against the
existing tree:

- The Foundry suite was executed through the `ghcr.io/foundry-rs/foundry` container with
  no local Foundry installation: **31 passed, 0 failed**. This is the first time this
  environment has been able to run the
  contract suite has run in this environment and it substantiates `ARC.md` §8.
- The full three-scenario demo was run against a containerised `anvil` (chain 31337):
  `real` → milestone FAILED, `synthetic` → RELEASED with benefit share and retention,
  `trend-failure` → INSUFFICIENT. Offline, the three scenarios complete in 1.38 s wall,
  153 MB peak resident — the figure `DEPLOYMENT.md` §5 uses to size the optional tier.

### Architectural, scientific and security decisions

- **Guardian is not a submodule.** It is cloned as a sibling checkout and run from its
  own compose project. The integration surface is one HTTP POST; there is no
  source-level dependency to pin, its configuration and key material live inside its own
  tree, and vendoring it would blur the authority boundary.
- **Settlement runs on Arc Testnet, not a hosted chain.** A transaction on a private
  demonstration chain is a screenshot, not evidence.
- **One serializer, not one runtime.** A hash commits to bytes, not data. Exactly one
  implementation may serialise a result; every other participant treats the hash as
  opaque. `RestorationDeed.sol` already follows this — it contains no `keccak256` and no
  `abi.encode`. A Python split may therefore own everything upstream of canonicalisation
  and nothing downstream of it.
- **x402 is coupled to pre-registration, and the coupling is now written down**, as
  Idea 0.3 §4.8 requires. The first draft of `X402.md` recommended selling per-request
  verification without it; that is the exact hazard §3.7.1 names — *"a service the
  restorer pays per request"* — and it was corrected during review. The rule recorded is
  that every verification sold must be a recorded verification: no unrecorded preview
  tier, because an unrecorded run is a private trial that defeats run-count history while
  leaving pre-registration apparently intact.
- **Three separate Hedera accounts** for Guardian operator, ATS treasury and x402
  receipts. A compromise of a public payment endpoint must not reach the account that can
  issue outcome tokens.

### Deviations from Idea 0.3

None. `X402.md` restates §4.8's demotion and §3.7.1's coupling rather than revising
either; x402 remains optional, M6, and third in the cut order.

### Unresolved risks

- No infrastructure-as-code exists and no choice has been made between Terraform and CDK.
- The split pipeline in `DEPLOYMENT.md` §7 is unapproved. It is an architectural change
  and requires explicit sign-off before any of it is built.
- The provenance obligations in `DEPLOYMENT.md` §9 are documented but not implemented:
  the `SIMULATED` banner is not yet guaranteed to appear within a settlement view, and
  the application still lands on a scenario chosen by the reader rather than defaulting
  to `real`.

### Next steps

1. Deploy `RestorationDeed` to Arc Testnet and record the address — M1 is not closed
   until this exists.
2. Implement the two provenance changes before anything is publicly reachable.
3. Choose an infrastructure tool, then write the static tier.

---

## 2026-09-10 — Spatial pipeline → Guardian seam → Arc deed prototype (M1–M4 vertical slice)

### Objective

A working prototype of the loop Idea 0.3 §1 describes: real remotely-sensed evidence →
deterministic, pre-registered verification → signed verdict credential in the shape
Guardian ingests → programmable settlement on the Restoration Deed → outcome-token
issuance seam. Built on the direction given on 2026-09-10 to link the spatial pipeline
to Guardian for token minting, which spans M1 (contract), M2 (engine), M3 (vertical
slice) and the M4 seam rather than M1 alone. The M1 scope in `CLAUDE.md` is delivered
in full inside it.

### Implementation

**Real Tier 0 acquisition** (`verification/stac.ts`, `cog.ts`, `frame.ts`, `acquire.ts`)

- STAC search against Earth Search (AWS Open Data) for Sentinel-2 L2A over the parcel,
  for the three pre-registered growing-season windows, cloud cover < 30%.
- Windowed HTTP range reads of the red, NIR and SCL Cloud-Optimized GeoTIFFs via
  `geotiff`; SCL masking (classes 4, 5, 6 valid); per-unit mean NDVI.
- **72 real scenes** (19 in 2023, 22 in 2024, 31 in 2025) committed as
  `verification/fixtures/tier0-kootenay-riparian-001.json` with scene IDs, asset URLs,
  the STAC-advertised reflectance scale/offset, and a snapshot hash. Engine tests run
  offline against this snapshot; `npm run acquire` re-derives it.
- Sampling frame: parcel (48.95 ha, geodesic), 253 sub-parcel H3 r11 cells, 83 near-ring
  and 520 far-ring H3 r10 candidate control units, each with a pixel mask on the
  402 × 382 px UTM 11N grid.

**Deterministic engine** (`verification/engine.ts`, ~500 lines, pure function of
`(plan, evidence, runIndex)`)

- Seasonal median composites per unit; pre-level and pre-slope covariates.
- Controls **drawn by the committed rule**: caliper on standardised pre-level and
  pre-slope, k nearest, water-fraction exclusion, near ring and far ring separately.
- Parallel-trend diagnostic: OLS `ndvi ~ t + treated + t·treated + annual harmonics`
  over 1,229 scene-level pre-period observations; interaction p-value and slope
  difference tested against the plan's criterion.
- DiD against the far ring; leakage = far − near divergence (floored at zero); biophysical
  additionality = DiD − leakage. Hectares via the versioned index→cover transfer.
- Bootstrap interval over matched far units, matched near units, parcel sub-cells, the
  transfer coefficient, and a far-ring residual draw (control-matching shock).
- **Empirical coverage by placebo-in-space**: 40 far-ring units treated in turn as
  pseudo-parcels with truth = 0 under the same rule; fraction of intervals containing 0.
- Evidence gates (scenes per window, matched-control count, parallel trend), validity
  gate, issuance gates (no net habitat loss from Tier 0, native species fraction from
  simulated Tier 1, condition floor), status resolution, lower-bound settlement.
- Canonical `VerificationResult` with `resultHash`, `analysisPlanHash`, `runIndex`,
  `stacSceneIds`, `processingGraphVersion`, tier corroboration with REAL/SIMULATED
  labels, and a locally-computed CIDv1 for the evidence commitment.

**Simulated Tiers 1–3** (`verification/simulate.ts`): seeded, labelled with the banner,
parameterised by realistic values rather than by the Tier 0 outcome.

**Guardian seam** (`guardian/`)

- `schema/verification-result.vc.schema.json` — the Guardian-compatible verdict schema.
- `adapter.ts` — Ed25519 `did:key` verifier identity; W3C VC with detached-JWS proof;
  schema validation (Ajv); public verification of signature and result-hash binding;
  Verifiable Presentation; the exact `POST /api/v1/external/{policyId}/{blockTag}`
  body Guardian's `externalDataBlock` accepts; outbox when `GUARDIAN_URL` is unset.
- `issuance.ts` — ERC-1643 `setDocument` and ERC-1410 `issueByPartition` calldata with
  the vintage partition `keccak256(h3Root, windowStart, windowEnd)`; `broadcast: false`.

**Arc Restoration Deed** (`contracts/`, Foundry)

- `RestorationDeed.sol`: `createProject` (tenure attestation required, encumbrance hash),
  `createDeed` (analysis plan hash, verifier, confidence, benefit share, retention,
  buffer pool, milestone schedule), `fundDeed`, `submitEvidence` (tier + simulated flag),
  `recordVerificationRun`, `verifyMilestone` (verifier-only, plan-hash-bound, run-index
  cited, global result-hash replay protection, `notBefore`/`deadline`), `drawMobilisation`,
  `releaseTranche` (proportional to lower bound / threshold, capped by milestone amount
  and escrow, retention withheld, benefit share routed, assignee paid), `assignTranche`,
  `withholdRetention`, `releaseRetention`, `reclaim`.
- 31 Foundry tests. `contracts/client.ts` is the only path from a result to calldata
  and refuses a result whose plan hash or content hash disagree.

**Auditor boundary** (`auditor/agent.ts`): rule-based anomaly detection (run count
behind submitted results, prior reversals, over-claim, regional greening, leakage,
coverage below nominal, IoT flatline, synthetic Tier 0, gate failures) and a
deterministic narrator behind an `AuditorNarrator` interface. No LLM, no keys.

**Demo** (`scripts/demo.ts`): three scenarios, optional on-chain execution.

### Tests / validation

| Suite | Result |
|---|---|
| `npm test` (vitest, 9 files) | 54 passed |
| `forge test` | 31 passed |
| `npm run typecheck` | clean |
| `npm run demo` | 3 scenarios, offline |
| `DEMO_RPC_URL=… npm run demo` on anvil | 11 transactions per scenario, all succeed |

Engine results on the **real** snapshot (run 1, fixed time):

| Quantity | Value |
|---|---|
| Parcel ΔNDVI (2025 vs 2023–24) | −0.0267 (−1.63 ha) |
| Far-ring control ΔNDVI | +0.0166 (+1.01 ha) |
| Near-ring control ΔNDVI | +0.0186 |
| Leakage | 0 (near ring did not degrade relative to far) |
| Biophysical additionality | −0.0432 (−2.65 ha) |
| 95% interval | [−11.62, +5.45] ha |
| Parallel trend | PASS, Δslope 0.013 NDVI/yr, p = 0.76, n = 1,229 |
| Empirical coverage (40 placebos) | 0.875 vs nominal 0.95 |
| Status | `NOT_ADDITIONAL`, settled 0 ha |

No intervention took place on this ground, so this is the correct answer. The
contract's establishment milestone ends `FAILED` and releases nothing; mobilisation
(effort-attested, 20,000 USDC) releases 18,000 to the restorer and 2,000 to the steward.

**Synthetic scenario** (+0.25 NDVI injected, labelled SIMULATED at Tier 0):
`PARTIAL`, additional 12.0 ha point estimate, interval [2.23, 21.63] ha, settled
**2.2271 ha** of 42 claimed. On chain: gross release 5,302.62 USDC of the 100,000 USDC
establishment tranche; 795.39 retained; 450.72 to the steward; 4,056.50 to the restorer.

**Trend-failure scenario**: `INSUFFICIENT_EVIDENCE`, milestone `INSUFFICIENT`,
re-verifiable, escrow intact.

Validation that a third party can perform: re-run `npm run acquire` and compare
`snapshotHash`; re-run `verify()` and compare `resultHash`; verify the VC signature
from the issuer `did:key` alone; re-hash the presentation and compare with the
`setDocument` document hash.

### Architectural, scientific and security decisions

Made within the implementation mandate:

1. **DN → reflectance.** Earth Search v1 `sentinel-2-l2a` COGs are BOA-offset-harmonised
   (verified: vegetation red p50 ≈ 0.036, NIR p50 ≈ 0.37). The STAC-advertised −0.1
   offset is recorded per scene but not applied; applying it produced NDVI > 1. The
   rule is versioned in the plan (`index.dnToReflectance`).
2. **Verification status set.** `docs/VERIFICATION.md` §12 listed examples only. The
   engine and the contract share six statuses: `VERIFIED`, `PARTIAL`,
   `NOT_ADDITIONAL` (evidence sufficient, lower bound ≤ 0), `INSUFFICIENT_EVIDENCE`,
   `GATE_FAILED` (issuance gate), `INVALID_RESULT`. The contract maps the last four to
   no release; `INSUFFICIENT_EVIDENCE`/`INVALID_RESULT` leave the milestone
   re-verifiable, `NOT_ADDITIONAL`/`GATE_FAILED` fail it.
3. **Replay protection** is a global `resultHashUsed` set plus per-deed run indices;
   a result cannot be resubmitted under any deed.
4. **Mobilisation** is an effort attestation by the verifier role (status `VERIFIED`,
   no quantity) rather than an outcome verdict, per §4.5.
5. **Reclaim.** Not in the M1 list, added so escrow can never be stranded: after a
   milestone deadline the sponsor recovers the unreleased balance.
6. **Guardian request shape** follows the documented `externalDataBlock` push API
   (`owner`, `policyTag`, `document`), verified against the current Guardian docs.

Awaiting explicit approval (recorded in the plan's `provisional` list so the plan hash
commits to that state; none of these is treated as settled):

- **Uncertainty method.** The bootstrap adds a far-ring residual draw per iteration as
  the representation of control-matching error (Idea 0.3 §3.8 term 1). Without it,
  placebo coverage on this snapshot was **0.33**; with it, **0.875**. The interval is
  reported with that coverage figure, not hidden behind the nominal 95%.
- **Placebo-in-space coverage** stands in for held-out ground-truth plots, which do
  not exist for a simulated intervention. It tests calibration under the null on real
  data and is labelled as such in every result.
- Metric, confidence level, ring radii, parallel-trend criterion, transfer coefficient
  and gate thresholds (Idea 0.3 §13.6) are provisional defaults.
- Leakage floored at zero (conservative; a negative divergence would otherwise add).

### Deviations from Idea 0.3

- **Scope.** M2, M3 and the M4 seam are prototyped alongside M1 on the owner's
  instruction; ATS issuance is prepared as calldata, not executed, and Guardian is not
  stood up (§4.4.2 honoured).
- **Sentinel-1, Landsat, ICESat-2** are not ingested. Reversal detection (backscatter
  change + dNBR) is therefore not built; the no-net-habitat-loss gate uses NDVI drop.
- **Control matching** uses pre-level and pre-slope only; land cover, terrain, soil and
  climate covariates (§3.7) are not yet joined.
- **H3 non-overlap / polygon intersection check** at issuance is not implemented.
- **Not built:** Arc Testnet deployment (no deployer key in this environment; the
  Foundry script is ready), The Graph subgraph, x402, Privy, the app UI beyond a
  minimal additionality view.

### Unresolved risks

- Coverage 0.875 < 0.95: the settlement rule is not yet calibrated for this metric.
- The synthetic scenario's interval is wide (≈ ±10 ha on a 49 ha parcel) because the
  residual shock is applied unscaled; a spatial covariance model would narrow it.
- Real Tier 0 for one tile and three seasons only; a second parcel or a different
  MGRS tile would exercise the grid-mismatch path.
- Guardian schema field naming assumes a custom-imported schema; a policy authored in
  the Guardian UI may expect `field0…N` names.
- 20 days to the Arc deadline; the contract has not been deployed to Arc Testnet.

### Next steps

1. Deploy to Arc Testnet with `forge script script/Deploy.s.sol` and record the address.
2. Approve or replace the provisional plan parameters; re-run and re-commit the plan hash.
3. Sentinel-1 ingest for the reversal detector; covariate join for control matching.
4. Subgraph over the contract events (entity set is emitted already).
5. Additionality view and assurance export in `app/`.

---

## 2026-09-10 — Proposal reconciliation (Idea 0.3)

### Objective

Reconcile four divergent statements of the project into one canonical approach:
Idea 0.2 (root `ecorestore_network_proposal.md`), the M0 rewrite
(`ideation/ecorestore_network_proposal_v2.md`), `proposal_review.md` (2026-09-09), and
the M0 `docs/*.md` set.

### Implementation

- `proposals/idea-0.2.md` was committed **empty** in `45b81dc` while `CLAUDE.md`
  declared it the canonical baseline. Populated from the root proposal and banner-marked
  as historical.
- `proposals/idea-0.3.md` written as the canonical baseline, with a full decision log
  (§13) recording every accepted, rejected and deferred change and its source.
- `CLAUDE.md` repointed to Idea 0.3; data-provenance rule amended; current milestone
  changed from M0 to M1.
- `docs/ARCHITECTURE.md`, `VERIFICATION.md`, `GUARDIAN.md`, `ARC.md`, `GRAPH.md`,
  `AUDITOR.md`, `DEMO.md` amended where they contradicted the reconciled approach.

### Tests / validation

No code changed. Validation was documentary: every amended doc section is traceable to
a numbered item in `proposal_review.md` or to a named source document, and Idea 0.3 §13
is the cross-reference.

### Architectural, scientific and security decisions

Four required explicit approval and were approved by the project owner on 2026-09-10:

1. **Token layer — Guardian authority + ATS instrument.** Guardian decides issuance and
   carries provenance; ATS is the instrument. Guardian is *not stood up* for the
   hackathon (3-7 days of a 20-day budget); the ERC-1643 seam is built and the drop-in
   point specified. Idea 0.2's ATS justification was factually wrong — it claimed
   permissioned transfer is something a plain ERC-20 cannot express, but HTS provides
   that natively via the KYC key — and has been rewritten around ERC-1410 partitions as
   vintages, ERC-3643 per-transfer rules, and ERC-1644 as the reversal primitive.
2. **Tier 0 is real.** Amends the all-synthetic rule in `CLAUDE.md` and
   `docs/ARCHITECTURE.md §4`. Tiers 1-3 remain simulated and labelled.
3. **Four incentive-design additions adopted**: pre-registration of the analysis plan,
   working capital (mobilisation tranche, `assignTranche()`, MRV cost pass-through),
   tenure attestation with contract-enforced benefit-sharing, and an encumbrance
   registry with `obligation_status`.
4. **Build sequence reordered against the September 30, 2026 Arc deadline.** Contracts
   are M1; the verification engine is M2.

Also settled without needing approval, because each follows from a factual correction:

- **H3 demoted to index and join key.** H3 cells are not equal-area, so hectares must
  not come from cell counts; and H3 non-overlap does not prove parcel non-overlap at
  shared boundary cells. Polygon geometry carries quantities and the intersection test.
  This is strictly simpler than what Idea 0.2 specified.
- **ICESat-2 replaces GEDI.** GEDI's ISS orbit caps coverage near ±51.6°; the Kootenay
  site at ~49.5°N is inside that envelope but near its edge, where track density is
  lowest.
- **Reversal detection built on backscatter change plus dNBR**, with C-band coherence as
  corroboration only where geometry and baseline permit.
- **Leakage promoted to a pipeline step** with near/far control rings, because it biases
  DiD *upward* — the one place the design was not conservative.
- **Uncertainty sources reordered**; control-matching and model-transfer error promoted
  above atmospheric and co-registration terms.
- **"No central certifier required" deleted** and CAGR market sizing replaced with UK
  BNG (£93M, 312 sites) and the EU Nature Credits Roadmap.

### Deviations from the baseline

Idea 0.3 *is* the new baseline. Deviations from Idea 0.2 are enumerated in §13.5.

### Unresolved risks

- Six methodology decisions remain open and block M2, not M1. Idea 0.3 §13.6.
- Real Tier 0 acquisition is a **new** risk created by this reconciliation: coastal BC
  cloud cover is real, and scene availability must be checked before M2 begins. Pick the
  parcel and window from actual archive availability, not the reverse.
- 20 days to the Arc deadline.

### Next steps

M1 — Arc Restoration Deed, plus the M0 gaps below.

---

## 2026-09-09 — M0, Application Foundation (`45b81dc`) — INCOMPLETE

Recorded retrospectively on 2026-09-10. Not backdated, and not represented as having
been written at the time: `docs/DEVELOPMENT_LOG.md` was committed empty.

### What was delivered

`CLAUDE.md`, the `docs/*.md` set, `ideation/` reorganisation, the
`ideation/ecorestore_network_proposal_v2.md` rewrite, directory structure, root
`package.json` and `tsconfig.json`, and a Vite + React + TypeScript application
scaffold.

### What was not delivered

M0's stated objective includes "interfaces" and a test framework. Neither exists:

- `verification/engine.ts`, `verification/models.ts`, `verification/fixtures.ts` — empty
- `auditor/agent.ts`, `guardian/adapter.ts` — empty
- `contracts/RestorationDeed.sol` — empty
- `app/src/App.tsx` — unmodified Vite counter template
- `docs/DEVELOPMENT_LOG.md` — empty
- `proposals/idea-0.2.md` — empty, while `CLAUDE.md` declared it canonical
- no test run exists; root `package.json` still has `"test": "echo \"Error: no test specified\" && exit 1"`

### Assessment

**M0 is not complete.** The documentation half is genuinely useful — the authority
model it established is carried into Idea 0.3 verbatim and is the strongest thing M0
produced. The interface half was not started.

### Next steps

The outstanding M0 work is carried into M1 rather than closed retroactively:
TypeScript interface definitions for the empty stubs, a running test framework, and
this log.
