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
| **x402 as a core component** | **Demoted** | Per-request metering conflicts with pre-registration by monetising specification search. Ships only with the coupling in `X402.md` §5, or not at all. |
| **Seven-view 3D globe** | **Cut** | The biggest time sink for the least thesis value. |
| **Four demonstration sites** | **Rejected** | One site. Kootenay Riparian Restoration, British Columbia. |
| **A dryland demonstration site** | **Rejected** | The underlying objection was that canopy gain is a perverse metric *for drylands*; the BC site resolves it without changing the site. The general principle — metric choice is incentive design — is retained. |
| **H3 as a non-overlap proof** | **Replaced** | H3 cells are not equal-area, and H3 non-overlap does not imply parcel non-overlap. Polygon geometry computes quantities and the intersection test; H3 is demoted to index and join key. Strictly simpler. |
| **Guardian stood up for the hackathon** | **Deferred** | 3–7 days of a 20-day budget. The seam is built and the drop-in point specified. |
| **Cohort verification** | **Deferred** | Specified in `ARC.md`, not built. |
| **Actuarial buffer sizing** | **Deferred** | The withholding mechanism ships; the actuarial model does not. |
| **GEDI for canopy structure** | **Replaced** | GEDI does not reach the demonstration site's latitude. ICESat-2 is used instead. |
| **Market sizing by bundled CAGR** | **Dropped** | Mixes compliance offsets and mitigation banking. Replaced with UK BNG and EU roadmap figures (`PRODUCT.md` §2). |

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

Values currently used in code are provisional and carry no approval. Where a provisional
value appears in a result, it is marked as such.

---

## 4. Open questions and risks

| Item | Assessment |
|---|---|
| **Arc mainnet by Sept 30** | Hard external deadline. M1 is contracts for this reason. |
| **M0 was not complete** | `ROADMAP.md` §3. Interfaces, tests and the development log carried into M1. |
| **Real Tier 0 acquisition** | Cloud cover in coastal BC is real and scene availability must be checked before analysis. Mitigation: pick the parcel and window from actual archive availability, not the reverse. |
| **Control-set matching quality** | The scientific weak point. Poorly matched controls produce a confidently wrong estimate. Mitigations: pre-registered selection rule, mandatory parallel-trend diagnostic, matched parcels rendered in the UI so the assumption is inspectable, and `INSUFFICIENT_EVIDENCE` rather than a forced settlement. |
| **Interval calibration** | The whole financial argument rests on the bound meaning what it says. The empirical coverage check is the defence; if coverage is materially below nominal, the settlement rule is not yet sound and that must be reported, not hidden. |
| **Financial additionality** | Not measurable from imagery. The encumbrance registry is a procedural handle, not a solution. State the limitation plainly. |
| **Metric standardisation** | Woody cover gain is a proxy, not a biodiversity metric. The registry is versioned so better metrics can be added without changing contracts. Metric choice remains open (§3). |
| **Guardian not stood up** | Deliberate. The risk is a reader taking the drop-in point for vapour. Mitigation: the ERC-1643 seam must actually work, with a real `setDocument()` call in the demo. |
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
  point estimate.
* **`INSUFFICIENT_EVIDENCE` is a valid, expected outcome.** Refusing to settle is a
  feature.
