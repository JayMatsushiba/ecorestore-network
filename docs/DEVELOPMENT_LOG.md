# Ecorestore Network — Development Log

Newest first. One entry per milestone, per `CLAUDE.md`.

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
  no local Foundry installation: **31 passed, 0 failed**. This is the first time the
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
