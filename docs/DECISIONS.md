# Ecorestore Network — Decisions, Open Questions and Risks

## 1. Purpose

This document records **why the design is what it is**, the decisions that are still open,
and the risks being carried knowingly.

It exists because the reasons for a rejection are easy to lose and expensive to
rediscover. Several entries below record things that were tried, proposed or assumed and
then deliberately dropped; without the reason, a later contributor re-proposes them.

### Provenance

The project began as four divergent statements — a proposal, a second draft, an
incentive-and-science review, and the M0 component docs — reconciled into a single
baseline in September 2026. Those source documents have been removed from the repository
now that their load-bearing content lives in `docs/`. They remain in git history at the
commit that removed them, along with the full reconciliation table recording which source
each decision came from.

**These documents are the source of truth. Changes are made here, not against the
historical proposals.**

---

## 2. Rejected and modified

| Decision | Outcome | Reason |
|---|---|---|
| **All-synthetic Tier 0** | **Rejected** | The satellite layer is the core scientific claim; fabricating it undermines everything built on it. Tier 0 is real; Tiers 1–3 are simulated and labelled. |
| **"No central certifier required"** | **Deleted** | The positioning that got Toucan killed when Verra banned tokenizing retired credits in May 2023. The project is dMRV a registry can call (`PRODUCT.md` §2). |
| **x402 as a core component** | **Demoted** | Two reasons. First, scope. Second and governing: per-request metering conflicts with pre-registration by monetising specification search. **It must never become a prerequisite for the core verification or settlement flow.** Ships only with the coupling in `X402.md` §5, or not at all. |
| **Seven-view 3D globe** | **Cut to three views, then cut entirely** | The biggest time sink for the least thesis value. First in the cut order (`ROADMAP.md` §5). |
| **Four demonstration sites** | **Rejected** | One site. Kootenay Riparian Restoration, British Columbia. |
| **A dryland demonstration site** | **Rejected** | The underlying objection was that canopy gain is a perverse metric *for drylands*; the BC site resolves it without changing the site. The general principle — metric choice is incentive design — is retained. |
| **H3 as a non-overlap proof** | **Replaced** | H3 cells are not equal-area, and H3 non-overlap does not imply parcel non-overlap. Polygon geometry computes quantities and the intersection test; H3 is demoted to index and join key. Strictly simpler. |
| **Guardian stood up for the hackathon** | **Deferred** | 3–7 days of a 20-day budget. The seam is built and the drop-in point specified. |
| **Cohort verification** | **Deferred** | Specified in `ARC.md`, not built. |
| **Actuarial buffer sizing** | **Deferred** | The withholding mechanism ships; the actuarial model does not. |
| **GEDI for canopy structure** | **Replaced** | GEDI does not reach the demonstration site's latitude. ICESat-2 is used instead. |
| **Market sizing by bundled CAGR** | **Dropped** | Mixes compliance offsets and mitigation banking. Replaced with UK BNG and EU roadmap figures (`PRODUCT.md` §2). |
| **Conservatism as the whole of the incentive** | **Adopted with a correction** | The lower-bound rule alone penalises hard-to-measure biomes and small parcels — the opposite of the priority ordering. Pricing carries a difficulty premium against the ex-ante expected interval width, so the restorer bears only the controllable deviation. `VERIFICATION.md` §11. |
| **Spatial analysis in Python, verification in TypeScript** | **Approved and built** (2026-09-10) | The owner asked for a conventional spatial pipeline. The split follows the one-canonicaliser rule (`DEPLOYMENT.md` §7.1): Python returns numbers over hash receipts and never serialises a document it hashes. The Python engine must be *bit-exact* with the TypeScript reference (`analysis/tests/test_parity.py`), and the engine that produced a result is recorded in it. |
| **Frontend as a build-time artefact only** | **Amended** | Built as a container on the owner's instruction, because the page now asks `verify` to run a scenario live and needs an `/api/` proxy. The static-hosting path is preserved; the page falls back to committed bundles and says so. `DEPLOYMENT.md` §7.8. |
| **Python acquisition writes the committed fixture** | **Rejected** | It would make Python a second canonicaliser. The job writes an unhashed snapshot; `npm run acquire:finalize` attaches `geometryHash`, `h3Root` and `snapshotHash` and compares against the current fixture before writing. |
| **Guardian `200` as evidence of a policy run** | **Rejected** | Guardian 3.7 acknowledges delivery before the policy engine sees the document, even for a nonexistent policy. Reported as gateway acknowledgement; a run is confirmed only inside Guardian against a published policy. |
| **Payment window as the monitoring window** | **Rejected** | Tranches end at 36 months; a BNG obligation runs 30 years. Observation and reversal-flagging continue for the full obligation term — near-zero marginal monitoring cost is the project's own argument for it. `ARC.md` §4. |

---

## 3. Open — requires explicit approval

These are ecological and scientific methodology decisions. Per `CLAUDE.md` they are not
the implementation agent's to settle. **They block M2, not M1.**

1. **The settled metric for the Kootenay site.** Recommendation:
   `riparian_woody_cover_gain_ha` with the issuance gates in `VERIFICATION.md`.
2. **Confidence level for the demonstration deed.** Recommendation: 95%.
3. **Near-ring and far-ring radii**, and the plausible displacement distance for riparian
   restoration in this landscape.
4. **The parallel-trend pass criterion** — the specific diagnostic and its threshold.
5. **Benefit-share fraction** and the tenure attestation types recognised at registration.
6. **Whether the reversal buffer withholding fraction is fixed or per-deed** for the
   prototype.
7. **The issuance gate thresholds.** Currently implemented as placeholders in
   `verification/fixtures/analysis-plan.json`:

   | Gate | Parameter | Placeholder |
   |---|---|---|
   | No net habitat loss | NDVI drop threshold | −0.15 |
   | No net habitat loss | Max loss cell fraction | 0.05 |
   | Native species fraction | Minimum | 0.80 |
   | Condition floor | Minimum post-window NDVI | 0.30 |

8. **The uncertainty method parameters**, which are not simply thresholds:
   the index→cover transfer coefficient (which dominates hectare-scale uncertainty) and
   the control-matching shock. Adding a far-ring residual draw per bootstrap iteration is
   the prototype's representation of control-matching error; without it, placebo coverage
   on the Kootenay snapshot was 0.33 against a nominal 0.95. The method itself awaits
   approval, not just its value. See `VERIFICATION.md` §10.

Values currently used in code are provisional and carry no approval. Every provisional
field carries an `openItem` citation into this section, and each appears in the
`provisional[]` block of the committed analysis plan — so a provisional value is visible
in the plan hash itself, not only in documentation.

---

## 4. Open questions and risks

| Item | Assessment |
|---|---|
| **Arc mainnet by Sept 30** | Hard external deadline. M1 is contracts for this reason. |
| **M0 was not complete** | `ROADMAP.md` §3. Interfaces, tests and the development log carried into M1. |
| **Real Tier 0 acquisition** | **Resolved for the current site.** The parcel is in the interior Creston Valley (−116.58, 49.13), not coastal BC, and 72 usable Sentinel-2 scenes were acquired across three seasons — 61 of 72 usable over the parcel after SCL masking. The general rule stands for any new site: pick the parcel and window from actual archive availability, not the reverse. |
| **Control-set matching quality** | The scientific weak point. Poorly matched controls produce a confidently wrong estimate. Mitigations: pre-registered selection rule, mandatory parallel-trend diagnostic, matched parcels rendered in the UI so the assumption is inspectable, and `INSUFFICIENT_EVIDENCE` rather than a forced settlement. |
| **Interval calibration** | The whole financial argument rests on the bound meaning what it says. The empirical coverage check is the defence; if coverage is materially below nominal, the settlement rule is not yet sound and that must be reported, not hidden. |
| **Financial additionality** | Not measurable from imagery. The encumbrance registry is a procedural handle, not a solution. State the limitation plainly. |
| **Metric standardisation** | Woody cover gain is a proxy, not a biodiversity metric. The registry is versioned so better metrics can be added without changing contracts. Metric choice remains open (§3). |
| **Guardian not stood up** | Deliberate. The risk is a reader taking the drop-in point for vapour. Current state: the seam is built and the exact `setDocument()`/`issueByPartition` calldata is prepared, but `guardian/issuance.ts` hardcodes `broadcast: false` and reports it as not sent — deliberately, since claiming otherwise would fabricate an integration. Mitigation is therefore *demonstrating the prepared calldata and the outbox honestly*, not broadcasting. Broadcasting would require a funded Hedera account and belongs to M4, not to a doc-satisfying change. |
| **Reversal is built, not inherited** | Neither Guardian nor ATS has a reversal primitive. ERC-1644 is the closest fit and is being used in a novel way. Budget for it. |
| **Demand-side assumption** | Load-bearing. Regulation pricing assurance is the commercial foundation, and the CSRD scope-and-timing rollback narrows it. Flagged as a risk, not treated as given. Mitigation is the restatement-risk framing. |
| **Latency to settlement** | Sentinel revisit plus processing means verification is days to weeks, not blocks. The UI represents pending verification honestly. A property of the physical world, not a defect. |
| **Subgraph indexing lag** | Eventual consistency after confirmation. Poll `_meta`, render optimistically, do not pretend it is instant. |
| **Cross-chain link** | Arc and Hedera share only a hash. No value crosses. Stub the attestation path early so integration is not discovery. |
| **x402 conflict of interest** | Per-request metering creates the incentive pre-registration closes. The two ship together or x402 does not ship (`X402.md` §5). |
| **Peatland inverts the trust model** | Not a risk for the Kootenay site; recorded because it blocks the obvious next site. For peatland rewetting the outcome variable is water table, measured by the most spoofable tier, and greenness can move the wrong way after successful rewetting. Any peatland extension needs InSAR peat surface motion and SAR-derived surface wetness as the satellite-side arbiter. |

---

## 5. Constraints that are not open to revision

These are not preferences. Changing any of them changes what the system claims to be.

* **No AI-generated numerical result may directly determine financial settlement.**
* **Tier 0 is real; Tiers 1–3 are simulated and must be labelled as such everywhere they
  appear**, including in the interface and the video.
* **The analysis plan is committed before the outcome is observable.** Controls are drawn
  by a committed rule, never chosen at verification time.
* **Settlement pays the lower bound of the declared uncertainty interval**, never the
  point estimate — **paired with a difficulty premium in pricing.** These two are one
  rule, not two. The lower bound alone puts all measurement uncertainty on the restorer,
  including the uncontrollable part, which pays best for large uniform temperate plantings
  and penalises exactly the biomes where restoration need is highest. Price is set against
  the ex-ante expected interval width for the biome and parcel-size class, so the restorer
  bears only the deviation from expectation. Implementing the bound without the premium is
  partly self-cancelling. See `VERIFICATION.md` §11.
* **`INSUFFICIENT_EVIDENCE` is a valid, expected outcome.** Refusing to settle is a
  feature.
