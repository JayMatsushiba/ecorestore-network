# Ecorestore Network — The Graph

## 1. Purpose

The Graph is the indexed history and query layer.

A Subgraph extracts blockchain events and exposes structured entities through GraphQL.

The Graph must be load-bearing rather than decorative.

---

## 2. Intended Entities

```text
Project
RestorationDeed
EvidenceSubmission
Verification
GuardianCredential
OutcomeUnit
Settlement
Retirement
```

Additional entities may be added only when required by the implementation.

---

## 3. Intended Queries

The Auditor and UI should eventually be able to retrieve:

* project history;
* deed state;
* evidence submissions;
* verification history;
* prior reversals;
* settlements;
* outcome lifecycle;
* retirement history.

---

## 4. Auditor Use

The Graph must be a genuine Auditor input.

Examples:

```text
retrieve project history
retrieve prior verification
retrieve prior settlement
detect repeated claim/reversal patterns
inspect current deed state
```

The Auditor should not merely query The Graph to populate UI cards.

---

## 5. M0

M0 creates only the boundary/configuration.

Do not fake indexed data.

Do not claim a deployed Subgraph that does not exist.

---

## 6. M5

M5 implements the live indexing path.

Potential AI integration may use The Graph's Subgraph MCP, which allows AI-compatible clients to discover schemas and execute Subgraph queries through a standardized interface.

The final implementation must satisfy the actual ETHOnline prize requirements at submission time.

---

## 7. M5 Implementation Notes

This section documents what M5 actually built and validated in `subgraph/` and `graph/`. It supersedes §1-§6 as the record of what was delivered — those sections describe original intent; this one describes what exists, was run, and was tested, per `docs/DEVELOPMENT_LOG.md`'s M5 entry.

### 7.1 Why Graph Node, not a custom indexer

Per the M5 prompt's explicit requirement: Graph Node is the real indexing engine (`graphprotocol/graph-node`), not a hand-rolled TypeScript log-reader, not PostgreSQL populated directly by the application, and not a fake GraphQL server. `subgraph/` compiles to real WASM mappings that Graph Node executes against real Ethereum JSON-RPC block/log data. The application boundary is strictly `Auditor -> GraphProvider -> GraphQL -> Graph Node` — nothing in this repository queries Postgres, Graph Node's internal storage, or Hardhat event logs directly.

### 7.2 Local architecture

```text
Windows host
│
├── Persistent Hardhat node (npx hardhat node --hostname 0.0.0.0)
│      127.0.0.1:8545 / 0.0.0.0:8545
│      NOT the ephemeral in-process "hardhat" network `npm test`/
│      `npm run test:contracts` use — those start and discard a fresh
│      chain per test file, which Graph Node cannot index over time.
│
└── Docker Desktop (docker compose, subgraph/docker-compose.yml)
       │
       ├── postgres:14           — Graph Node's own storage backend
       ├── ipfs/kubo:v0.17.0     — subgraph manifest/file storage
       └── graphprotocol/graph-node:v0.45.0
              reaches the host's Hardhat node via host.docker.internal:8545
              (the exact pattern graph-node's own reference
              docker/docker-compose.yml uses for a host-local chain)
```

```text
Hardhat (persistent, port 8545)
  ↓ JSON-RPC (host.docker.internal:8545)
Graph Node (Docker, network label "hardhat")
  ↓ indexes RestorationDeed events into Postgres
Ecorestore subgraph (ecorestore/restoration-deed)
  ↓ GraphQL, http://localhost:8000/subgraphs/name/ecorestore/restoration-deed
TheGraphProvider (graph/theGraphProvider.ts)
  ↓
Auditor (auditor/agent.ts)
```

The Postgres and IPFS containers are Graph Node's own dependencies, not an independent Ecorestore database — nothing outside Graph Node itself connects to them.

### 7.3 Selected versions (verified, not guessed)

| Component | Version | Why |
|---|---|---|
| `graphprotocol/graph-node` | `v0.45.0` (Docker) | Current tagged release at implementation time, confirmed via the Docker Hub tags API (not `:latest`, for reproducibility) |
| `postgres` | `14` (Docker) | Long-stable version widely used with graph-node |
| `ipfs/kubo` | `v0.17.0` (Docker) | Matches the version pinned in graph-node's own reference `docker/docker-compose.yml` |
| `@graphprotocol/graph-cli` | `0.98.1` (npm) | Current version at implementation time, confirmed via `npm view`; requires Node >= 20.18.1 (this project uses Node 24) |
| `@graphprotocol/graph-ts` | `0.38.2` (npm) | Current version at implementation time, confirmed via `npm view` |
| `matchstick-as` | `0.6.0` (npm) | Current version at implementation time, confirmed via `npm view`; matches the version graph-cli's own Dockerfile template downloads |
| Docker Desktop | `29.1.3` / Compose `v2.40.3` | Already installed on the development host; confirmed the daemon starts and can pull all three images above |

All three Docker images were pulled and verified runnable before any subgraph code was written (per the M5 prompt's Phase 0E). `subgraph/` is a fully isolated package (its own `package.json`, `subgraph/`-scoped `devDependencies`) — an AssemblyScript/WASM toolchain, deliberately kept out of the root ESM/TypeScript project's `tsconfig.json` (excluded explicitly) and `vitest.config.ts` (excluded explicitly), matching the same reasoning `contracts/**` already uses for Hardhat's separate CJS/Mocha toolchain.

### 7.4 Hardhat connectivity

Graph Node's `ethereum` environment variable is `hardhat:http://host.docker.internal:8545` — `"hardhat"` is a network *label* Graph Node uses to route to this JSON-RPC endpoint; it is deliberately not `"mainnet"`, so indexed data can never be mistaken for real-chain history. `subgraph.yaml`'s `dataSources[].network` is `hardhat`, matching this label. `host.docker.internal` is Docker Desktop's built-in host-gateway DNS name; no public exposure, no cloud RPC, no production network of any kind is involved.

The Hardhat node itself must be the **persistent** `npx hardhat node` process, not the ephemeral in-process network `npm test`/`npm run test:contracts` start and discard per test file — Graph Node needs a chain that keeps running and accumulating blocks to index.

### 7.5 methodologyVersion — not indexed (a real, reproduced blocker, not a design choice)

`RestorationDeed.sol`'s `DeedCreated` event does not emit `methodologyVersion` (verified directly against the compiled ABI — see §7.7). It is only readable from contract storage via `getDeed(deedId)`.

An `eth_call` to `getDeed()` from the `handleDeedCreated` mapping handler was implemented and tested, and **reproducibly failed** against this project's persistent Hardhat node: graph-node v0.45.0's Alloy-based Ethereum client sends both a `data` and an `input` field in every `eth_call` JSON-RPC request (for compatibility across client conventions), and Hardhat's JSON-RPC server rejects the request outright with `error code -32602: duplicate field "data"`. This is a confirmed upstream incompatibility — [NomicFoundation/hardhat#4603](https://github.com/NomicFoundation/hardhat/issues/4603), closed by the Hardhat team as "not planned" (they will not add `input`-field support to Hardhat 2.x). No `eth_call` from any subgraph mapping can succeed against this Hardhat version with this graph-node version; this is not specific to this project's mapping code.

**Resolution:** `methodologyVersion` is not represented on `RestorationDeed` in `schema.graphql` at all. The Auditor correlates it off-chain instead — when a caller supplies the real M1 `VerificationResult` and M2 `GuardianCredential` alongside a Graph query, `auditor/agent.ts` cross-checks `verificationResult.methodologyVersion === credential.methodologyVersion` directly (see `docs/AUDITOR.md`). On-chain methodology enforcement still exists and is unchanged — `RestorationDeed.submitVerification` still reverts `VerificationIdentityMismatch` for a wrong `methodologyVersion` (tested in `contracts/tests/verification.test.cjs`) — this limitation only means the Graph cannot independently re-observe that enforcement after the fact.

This was a genuine architecture-affecting decision made during implementation, not before it (§7.9 below records exactly what was tried first). Per the M5 prompt's own guidance ("If a field is not emitted and cannot safely be obtained without an eth_call, do not invent it"): once the eth_call was demonstrated unsafe (unreliable) in this toolchain, it was removed rather than left in as a permanently-failing code path.

### 7.6 evidenceHash and Guardian credential — not indexed (unchanged conclusion, now confirmed against the real ABI)

`evidenceHash` is checked non-zero inside `submitVerification` but is never emitted by any event and never stored in the `Deed` struct (confirmed against the ABI — see §7.7's `VerificationSubmitted` row). It is genuinely unavailable to this subgraph by any means, not merely omitted for convenience — `schema.graphql` does not include it anywhere.

Guardian credential contents (methodology label, verifier id, policy version, issuance timestamp) live entirely in M2's `guardian/` domain and are never written to `RestorationDeed.sol`. The Graph indexes only `financiallyEligible` and `settledQuantityScaled`/`settlementAmount` — the on-chain-committed *outcome* of Guardian's authorization, not the credential itself. The Auditor correlates a real `GuardianCredential` object (supplied by the caller) against indexed history via `verificationId`, exactly as this document's original §9 anticipated — it does not, and cannot, retrieve Guardian credential contents from the Graph.

### 7.7 Event-to-entity mapping (exact ABI fields, verified against `contracts/.artifacts/contracts/RestorationDeed.sol/RestorationDeed.json`)

| Contract event (exact signature) | Entity created/updated | Event fields used | Entity fields set | Status effect | Source type |
|---|---|---|---|---|---|
| `DeedCreated(uint256 indexed deedId, bytes32 indexed projectId, bytes32 parcelH3Root, address indexed sponsor, address beneficiary, address authorizedVerifier, uint256 escrowAmount, uint256 unitPriceUSDC, uint8 quantityDecimals)` | `RestorationDeed` (new) + `Project` (new or reused) | all 9 params | `deedId, projectId, parcelH3Root, sponsor, beneficiary, authorizedVerifier, escrowAmount, unitPriceUSDC, quantityDecimals`; `fundedAmount=0`; `project` relation | `CREATED` | EVENT |
| `DeedFunded(uint256 indexed deedId, address indexed sponsor, uint256 amount)` | `Funding` (new) + `RestorationDeed` (update) | all 3 params | `Funding`: `deed, sponsor, amount` + provenance. `RestorationDeed`: `fundedAmount=amount` | `FUNDED` | EVENT |
| `DeedCancelled(uint256 indexed deedId)` | `Cancellation` (new) + `RestorationDeed` (update) | `deedId` only — no other params exist on this event | `Cancellation`: `deed` + provenance | `CANCELLED` | EVENT |
| `VerificationSubmitted(uint256 indexed deedId, bytes32 indexed verificationId, bool financiallyEligible, uint256 settledQuantityScaled, uint256 settlementAmount)` | `Verification` (new, id = `verificationId`) + `RestorationDeed` (update) | all 5 params — **no `projectId`/`parcelH3Root`/`methodologyVersion`/`evidenceHash` exist on this event** | `Verification`: all 5 fields + provenance. `RestorationDeed`: `verificationId`; if `financiallyEligible`: `settledQuantityScaled, settlementAmount` | `VERIFIED` if `financiallyEligible` else `FAILED` | EVENT |
| `SettlementExecuted(uint256 indexed deedId, bytes32 indexed verificationId, address indexed beneficiary, uint256 settlementAmount, uint256 refundedRemainder)` | `Settlement` (new) + `RestorationDeed` (update) | all 5 params | `Settlement`: `deed, verification (=verificationId), beneficiary, settlementAmount, refundedRemainder` + provenance. `RestorationDeed`: `releasedAmount=settlementAmount` | `SETTLED` | EVENT |
| `RefundExecuted(uint256 indexed deedId, address indexed sponsor, uint256 amount)` | `Refund` (new) + `RestorationDeed` (update) | all 3 params | `Refund`: `deed, sponsor, amount` + provenance | `REFUNDED` | EVENT |

`methodologyVersion` and `evidenceHash`: see §7.5-§7.6 — **not represented on any entity.**

### 7.8 Schema (`subgraph/schema.graphql`)

Entities: `Project`, `RestorationDeed`, `Funding`, `Cancellation`, `Verification`, `Settlement`, `Refund`. `Project` and `RestorationDeed` are mutable (`@entity(immutable: false)`, updated by later events); the five event-record entities are immutable (`@entity(immutable: true)`, one per emitted event, never updated after creation) — `specVersion: 1.0.0` requires this `immutable` argument explicitly on every entity.

**Relationships:** `RestorationDeed.project -> Project` (many-to-one; multiple deeds sharing a `projectId`, e.g. a resubmission after a refund, resolve to the same `Project`); `Funding.deed`, `Cancellation.deed`, `Verification.deed`, `Settlement.deed`, `Refund.deed -> RestorationDeed` (many-to-one, `@derivedFrom` back-references on `RestorationDeed`); `Settlement.verification -> Verification` (the settlement's `verificationId` param, resolved to the `Verification` entity created when that verification was submitted — always exists by the time a settlement can occur, since `submitVerification` must precede `settleDeed` in the contract's state machine).

**ID strategy:** `RestorationDeed.id` = `deedId.toString()` (unique per contract instance). `Project.id` = the on-chain `projectId` hash itself. `Verification.id` = the on-chain `verificationId` hash itself — genuinely canonical, not an arbitrary choice, because `RestorationDeed.sol`'s `consumedVerificationIds` mapping makes it contract-wide unique and replay-protected by construction. `Funding`/`Cancellation`/`Settlement`/`Refund.id` = `transactionHash.concatI32(logIndex)` (via `graph-ts`'s `Bytes.concatI32`), per the M5 prompt's suggested event-record ID pattern. No arbitrary UUIDs anywhere.

**Event provenance:** every event-record entity carries `timestamp`, `blockNumber`, `transactionHash`, and `logIndex`; `RestorationDeed` additionally carries `createdAt/createdBlock/createdTxHash` and `updatedAt/updatedBlock/updatedTxHash` (the block/tx of whichever event last changed it).

### 7.9 What was tried and rejected

The `getDeed()` eth_call for `methodologyVersion` (§7.5) was fully implemented, including a passing Matchstick unit test that mocked the call — the mapping code compiled and the unit test suite could not have caught this failure, because Matchstick simulates the contract-call interface in-process and never touches a real JSON-RPC server. The bug was only found by actually running the real local Graph Node integration and inspecting its logs (`docker compose logs graph-node`), which is exactly why the M5 prompt requires the real integration test rather than treating mapping unit tests as sufficient (task acceptance criterion F/G's distinction). No workaround (retry, alternate call encoding, older graph-node) was pursued once the root cause was confirmed as a Hardhat-side "won't fix" — see §7.5 for why removing the eth_call, not chasing the incompatibility further, was the correct scope-preserving decision.

### 7.10 Subgraph testing (`subgraph/tests/mapping.test.ts`, Matchstick)

9 tests covering: entity creation and field mapping for all 6 event handlers, the `Project`-entity-reuse case (two deeds sharing a `projectId`), the `financiallyEligible=true` vs `false` branch (`VERIFIED` vs `FAILED`, and that quantity fields stay unset on the `FAILED` branch), and the `Settlement -> Verification` relationship. Run via `npm test` inside `subgraph/` — see §7.12 for the Windows/Docker note.

### 7.11 Windows/Docker note for Matchstick

`matchstick-as` ships no native Windows binary (Linux/macOS only); `graph test --docker` runs it in a Docker container instead. graph-cli's own Docker runner hardcodes `docker run -it`, which fails with `"the input device is not a TTY"` in any non-interactive shell (this includes most automation/agent environments on Windows, not just this one) — Matchstick's own output is non-interactive, so this is a real gap in `graph-cli`'s own tooling, not a project-specific issue. `subgraph/scripts/test-docker.cjs` reproduces graph-cli's own build-then-run sequence (`test.js`'s `runDocker`) with `-it` changed to `-i` (stdin only, no pty) — behaviorally identical on a real terminal, and the only change that makes it work non-interactively. `subgraph/package.json`'s `"test"` script calls this wrapper instead of `graph test --docker` directly. `subgraph/tests/.docker/Dockerfile` (graph-cli's own auto-generated template, pinning `matchstick 0.6.0` and Node 18 inside the container) is committed so a fresh checkout does not need network access to regenerate it.

### 7.12 GraphProvider (`graph/`)

`graph/provider.ts` defines the `GraphProvider` interface (`getDeedHistory`, `getDeedsByProject`, `getVerification`, `getProject`) and `GraphUnavailableError`. `graph/theGraphProvider.ts` (`TheGraphProvider`) is the real implementation — plain `fetch()` (Node 18+ built-in, no HTTP dependency added) against a local Graph Node's GraphQL endpoint, default `http://localhost:8000/subgraphs/name/ecorestore/restoration-deed`. `graph/fixtureGraphProvider.ts` (`FixtureGraphProvider`) is a deterministic in-memory implementation used only by fast unit tests (`auditor/tests/agent.test.ts`, `graph/tests/fixtureGraphProvider.test.ts`) — per the M5 prompt, it is explicitly not sufficient for M5 acceptance by itself; the real local Graph Node path is exercised separately (§7.14).

### 7.13 Local vs hosted Graph status

| Concern | This project (M5) | Hosted/production |
|---|---|---|
| Graph Node | Local Docker container, ephemeral per `docker compose up` | The Graph Network (decentralized indexers) |
| Chain indexed | Local persistent Hardhat node (chain id 31337) | Real Arc/Hedera/Ethereum mainnet or testnet |
| Subgraph deployment | `graph create`/`graph deploy` against `localhost:8020` | `graph deploy` against a hosted/decentralized endpoint, IPFS-pinned publicly |
| GraphQL endpoint | `localhost:8000`, not publicly reachable | A public, load-balanced gateway |
| AWS | Not used anywhere in this milestone | Planned future host for the Auditor/API (docs/AUDITOR.md) — not the Graph itself |

**Nothing in M5 is deployed to the hosted Graph Network, AWS, or any live network.** Every step in §7.14 runs entirely on the local development machine.

### 7.14 Startup / build / deploy / query / test instructions

```bash
# 1. Persistent Hardhat node (separate terminal; leave running)
npx hardhat node --hostname 0.0.0.0

# 2. Real M1 -> M2 -> Arc chain against it (writes subgraph/deployment.local.json)
npm run demo:local

# 3. Local Graph Node stack
cd subgraph
docker compose up -d

# 4. Configure, generate, build, deploy the subgraph
npm run configure   # patches subgraph.yaml's address/startBlock from deployment.local.json
npm run codegen
npm run build
npm run create-local
npm run deploy-local

# 5. Query it directly (optional — sanity check)
curl -s http://localhost:8000/subgraphs/name/ecorestore/restoration-deed \
  -H "Content-Type: application/json" \
  --data '{"query":"{ restorationDeeds { id status settledQuantityScaled } }"}'

# 6. Fast subgraph mapping unit tests (no Docker infra needed beyond the
#    Matchstick container itself)
npm test        # inside subgraph/

# 7. Real Graph Node E2E integration test (from the repository root;
#    requires steps 1-4 already running)
npm run test:e2e:graph

# Tear down
cd subgraph && docker compose down -v
```

Redeploying after any mapping/schema change: repeat step 4's `codegen`/`build`/`deploy-local` (no need to `remove-local`/`create-local` again unless the subgraph name changes).

### 7.15 Validation results (this milestone, actual run)

- `npm run typecheck` (root, `tsc --noEmit`, `subgraph/` excluded — see its own tsconfig-free AssemblyScript toolchain): **0 errors.**
- `npm test` (root vitest, Graph Node E2E excluded): **104/104 passed**, 13 files (the 88 pre-M5 tests + 16 new M5 tests: 5 `FixtureGraphProvider` + 11 `auditor/agent.ts`).
- `npx hardhat compile` / `npm run test:contracts`: **84/84 passed**, unchanged from M4 — confirms `contracts/` was not modified.
- `subgraph`: `npm run codegen` / `npm run build`: succeed. `npm test` (Matchstick, via the Docker wrapper in §7.11): **9/9 passed.**
- `npm run test:e2e:graph` (real Graph Node, real persistent Hardhat node, real deployed `RestorationDeed`): **5/5 passed** — confirmed the indexed deed's `status`, `verificationId`, `settledQuantityScaled` (traced back to a freshly-recomputed real M1 result), relationships, and the Auditor's `CONSISTENT` verdict against the real local stack; plus `NOT_FOUND`/`DATA_UNAVAILABLE` failure-path checks against the same real provider.

### 7.16 Known limitations

- `methodologyVersion` is not indexed (§7.5) — a genuine, documented upstream RPC incompatibility, not a scope-reduction choice.
- `evidenceHash` and full Guardian credential contents are not indexed (§7.6) — never available on-chain.
- Single subgraph data source, no templates — this project deploys exactly one `RestorationDeed` contract instance per environment.
- `docker-compose.yml`'s Postgres password (`let-me-in`) is graph-node's own upstream reference-compose convention, a throwaway local-only credential with no relation to any real secret — not a security concern for a local development stack, but noted here for transparency.
- No production/hosted Graph Network deployment exists or was attempted.
