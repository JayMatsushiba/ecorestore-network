# Review — Ecorestore Network proposal (Idea 0.2)

**Reviewing for:** does this mechanism actually incentivise ecological restoration and nature-based solutions, or does it only make existing restoration finance more auditable?

**Date:** 2026-09-09

---

## Verdict

The verification design is genuinely stronger than the incumbent market. The **finance** design is not yet an incentive mechanism — it is an audit mechanism attached to a conventional results-based payment.

Three things follow from that:

1. As specified, the mechanism **selects for well-capitalised operators, easy-to-measure biomes, and large parcels**. Those are the segments where restoration finance already flows. It is regressive with respect to ecological need.
2. The most novel financial primitive available here — a pre-funded escrow with deterministic release conditions is *collateral* — is unused. Adding it is what converts this from "better MRV" to "new finance".
3. The additionality apparatus is scientifically careful but **procedurally unprotected**: nothing forces the analysis plan to be fixed before the outcome is known.

None of these are fatal. All three are cheap to fix at the proposal stage, and fixing them makes the submission stronger on its own terms, because each one is a *contract* feature — i.e. it lands in the sponsor tracks (Arc conditional payments, Hedera lifecycle) rather than adding scope to the spatial pipeline.

---

## Part 1 — Where the incentive logic genuinely holds

Worth stating plainly, because the criticism below is dense.

- **Ex-post issuance against measured change.** Removing forward crediting removes the single largest source of phantom credits. Correct and non-negotiable.
- **Additionality by construction, not by attestation.** Difference-in-differences against matched controls with a parallel-trend diagnostic is the right estimator, and putting it *inside the settlement rule* rather than in a methodology PDF is the actual contribution.
- **Persistence tranches exploiting near-zero marginal monitoring cost.** This is the strongest idea in the document and it is under-sold. The economic insight is that continuous free satellite observation makes the marginal cost of re-verification approximately zero, which makes *long-dated conditional payment* economically viable for the first time. Conventional MRV cost is what forced the pay-at-planting norm. Lead with this.
- **Inverting trust against precision** ("the tier that measures best is the tier that lies easiest") is a sharp and correct framing, and treating tier divergence as signal rather than averaging it away is right.
- **Reproducibility as the defensibility claim** — named scene IDs plus a versioned processing graph, re-derivable by a third party — is correctly identified as the thing that matters, more than the ledger. §3.9's closing paragraph is the best paragraph in the document.

---

## Part 2 — Where the incentive logic breaks

Ranked by how much each one changes the answer to "will this cause more restoration to happen".

### 2.1 Working capital — the binding constraint, and the biggest missed opportunity

**Problem.** Outcome-based payment means the restorer fronts everything: land access, stock, labour, three years of maintenance, plus the drone flights and sensors the design encourages them to buy. Payment arrives at 12/24/36 months, against a lower bound that in your own worked example is **31% of the claim**.

The parties you name as the supply side — NGOs, land trusts, Indigenous-led stewardship organisations, smallholders — are precisely the parties with the least access to working capital. §2 says they "need... to not be forced to buy a satellite programme to get paid", and then the instrument requires them to self-finance three years of operations and their own MRV.

A mechanism that only well-capitalised operators can enter does not increase the amount of restoration. It reallocates existing restoration toward better-verified operators. That is a real but much smaller good.

**Fix — and this is the highest-value addition to the whole proposal.** The deed already holds committed USDC with deterministic, machine-evaluable release conditions. That is a better credit instrument than the restorer's balance sheet. Three additions, all contract-layer:

- **Mobilisation tranche** (10–20%) released against verified *effort*, not outcome — planting records, Tier 1 orthomosaic, receipts. You partly have this in the establishment tranche, but it is framed ex-post. Make the first slice explicitly a cost-recovery advance and say so.
- **Assignable receivable.** Let the restorer pledge or assign a future tranche to a third-party lender on-chain. `assignTranche(milestoneId, assignee)`. A conditional claim on escrowed USDC, where the condition is evaluated by a published pipeline against free public imagery, is exactly the kind of cashflow that can be discounted. This is a genuinely novel primitive and it is *four lines of Solidity*.
- **MRV cost pass-through.** Fund Tier 1/2 measurement from the escrow rather than from the restorer's pocket, drawn at verification time. Otherwise §3.8's "restorer has an incentive to fund better measurement" only holds for restorers who have the cash to act on the incentive.

This single change is the difference between "outcome finance for people who already have money" and "outcome finance". It is also the most defensible answer to a judge who asks "who actually uses this?".

### 2.2 The analysis is p-hackable — no pre-registration

**Problem.** §3.7 constructs a matched control set and §3.8 propagates uncertainty, but nothing in the document fixes *when* those choices are made. As written, the control set is selected and the analysis is run at verification time, by a service the restorer pays per request (§4.4).

That is a researcher-degrees-of-freedom problem with money attached. Run the verification against several candidate control sets, several observation windows, several index choices, and submit the favourable one. Every number in the verdict stays honest; the estimator is still biased. This is the same failure mode that pre-registration exists to solve in clinical trials, and metered per-request verification actively creates the incentive.

**Fix.** Commit the analysis plan hash at `createDeed()`, before any outcome is observable:

```text
metric_id + version
observation windows (fixed dates, not "a 6-month window")
control selection RULE (covariates, calipers, k, exclusion buffer) — not the selected parcels
index and masking chain version
confidence level
parallel-trend diagnostic and its pass criterion
```

The control set is then *drawn deterministically by the committed rule* at verification, not chosen. Re-runs are permitted but every run is recorded on-chain, and the verdict cites the run index. A parcel with eleven verification runs and one submitted result is visible.

This is cheap, it is squarely in the spirit of the project, and it is the kind of detail that separates a proposal that has thought about adversarial behaviour from one that has not. It also strengthens §6.1's "project history as a real input" — run count *is* history.

### 2.3 The uncertainty rule is scientifically right and economically regressive

**Problem.** §3.8 places 100% of measurement uncertainty on the restorer. The stated benefit — restorers are incentivised to fund better measurement — holds only for the *controllable* fraction of uncertainty. Most of the interval is not controllable by the restorer:

- **Biome.** Cloud frequency, canopy density, phenological noise, and index saturation are properties of where the ecosystem is. A Gulf of Thailand mangrove restorer and a Fraser Valley riparian restorer doing equally good work are paid differently because of the sky.
- **Parcel size.** Mixed-pixel boundary error scales with perimeter-to-area. Small parcels have structurally wider relative intervals. A 4 ha community planting is penalised against a 400 ha corporate one for geometry reasons alone.
- **Ecosystem type.** Peatland and dryland — the two biomes where restoration need is highest and measurement is hardest — are penalised hardest.

Net effect: the mechanism pays best for **large, uniform, temperate, dense-canopy plantings**, which is both the easiest thing to measure and the thing most likely to be a monoculture. That is the opposite of the NbS priority ordering.

**Fix.** Decouple the two roles the interval is playing. Right now it is doing conservatism *and* pricing.

- Price per unit is a deed parameter set against the **ex-ante expected interval width for that biome/parcel-size class** (a difficulty premium). The restorer then bears only the deviation from expectation — the controllable part — and the incentive to improve measurement survives intact.
- State the equilibrium honestly in §3.8: if price does not adjust for expected uncertainty, buyers will bid for easily-measured projects and the clearing price for hard-to-measure biomes collapses. The current text ("a risk-tolerant buyer can accept 80% and pay more per unit") gestures at this in one clause and then drops it. It deserves a paragraph, because a sharp judge will spot that the lower-bound rule as stated is partly self-cancelling.

### 2.4 Biophysical additionality ≠ financial additionality

**Problem.** DiD against matched controls answers *"did this parcel change more than comparable parcels?"* It cannot answer *"would this have happened without the payment?"* — which is the question that determines whether the money caused any restoration.

This is not academic. §2 lists **UK BNG** (statutory 10% uplift, 30-year maintenance) and the **EU Nature Restoration Regulation** (member-state targets) as demand drivers. Those are *legal obligations*. Restoration performed to discharge a statutory obligation will show beautiful additionality against unfunded controls and is, as finance, entirely non-additional. Paying for legally mandated work is the most common and most damaging criticism levelled at credit markets, and the proposal currently walks straight into it while citing the regulations as a selling point.

Related: your H3 set-intersection check (§3.10) prevents the same *hectare* being sold twice. It does not prevent the same *outcome* being claimed once as a BNG obligation discharge and once as a voluntary outcome unit. Spatial double-counting is solved; claim double-counting is not.

**Fix — an encumbrance registry, which is the same primitive you already built, extended.** At parcel registration, require a declaration:

```text
legal_obligations[]      BNG unit registration, NRR designation, planning condition, s.106
public_subsidy[]         agri-environment / ELM / CAP payments received on the parcel
existing_claims[]        credits issued under other registries, with registry + serial
tenure_basis             see 2.8
```

The outcome unit then carries an `obligation_status` attribute — `voluntary_additional`, `obligation_linked`, or `subsidy_overlapping` — and permissioned transfer can restrict who may buy which. This is cheap, it composes with the H3 root, it is a real differentiator (no existing registry has encumbrance as a protocol primitive), and it converts the "we cite regulation as demand" liability into a feature.

### 2.5 The metric creates the wrong planting incentive — most acutely at your flagship demo site

**Problem.** The settled metric is `canopy_cover_gain_ha`. Money released against canopy cover makes the profit-maximising strategy fast, dense, uniform canopy: eucalyptus, acacia, pine. The §3.11 quality gate is a *detector* run post-hoc as pass/fail, and detectors get gamed — a mixed-age eucalypt block with scrappy understory passes a heterogeneity test.

Sharper: **your featured demo site is Sahel drylands, and canopy-cover gain is close to the worst available metric for drylands.** The ecologically correct interventions there are largely *not* planting — assisted natural regeneration, farmer-managed natural regeneration, grazing exclosure, water harvesting. A canopy-gain metric underprices all of them and actively rewards afforestation of native grassland and savanna, which is a well-documented harm. §11 concedes "canopy cover gain is not a biodiversity metric" and calls it a defensible proxy; in drylands specifically it is not a defensible proxy, it is a perverse one.

**Fix.**

- Make ecological conditions **gates on issuance, not scores in a verdict**: native/functional species fraction (Tier 1/3), no-net-loss of existing habitat inside the parcel over the window (Tier 0 can verify you did not clear intact scrub to plant), and biome-specific condition floors.
- Give the dryland site a **biome-appropriate metric**: woody cover *plus* herbaceous productivity and bare-soil fraction, or explicitly a regeneration-density metric, so that ANR/FMNR are payable. This also makes the demo more interesting, not less — "the naive metric would have paid for the wrong intervention" is a better story than "the naive metric would have paid too much".
- Keep §3.9's versioned metric registry framing; just be explicit that metric choice is itself an incentive design decision, not a measurement decision.

### 2.6 Leakage biases the DiD estimate *upward* — the one place the design is not conservative

**Problem.** Excluding grazing, fuelwood collection, or cultivation from a funded parcel frequently displaces that pressure to adjacent land. Your control set is drawn from **nearby** parcels. So displaced pressure degrades the controls at the same time the parcel improves, and the difference-in-differences **overstates** additionality on both sides simultaneously.

§3.7 mentions "excluding parcels with plausible treatment spillover" in a subordinate clause. That is not enough weight for a bias that runs in the anti-conservative direction, in a design whose entire selling point is conservatism.

**Fix.** Treat leakage as a first-class term:

- Two control rings — a near ring (leakage-exposed) and a far ring (matched, buffered beyond plausible displacement distance). The estimate uses the far ring; the *divergence between rings* is a direct leakage estimate.
- Report leakage explicitly in the verdict JSON and deduct it, rather than assuming the buffer handles it.
- This is a small addition to work you are already doing and it closes the most credible scientific attack on the headline number.

### 2.7 Permanence: a 36-month instrument against a 30-year obligation

**Problem.** §4.2's retention tranches stop at 36 months. §2 sells against BNG's 30-year maintenance obligation and carbon permanence norms of 40–100 years. The 27+ year gap is the entire liability the buyer is trying to discharge.

Your own argument defeats the 36-month limit: if marginal monitoring cost is near zero, why stop? And after the final tranche releases, a detected reversal has no financial consequence at all — the unit is flagged, and the buyer eats the loss. Buyers will price that risk in, which lowers the price paid to the restorer, which weakens the incentive to restore.

**Fix.**

- **Monitoring commitment decoupled from payment schedule.** Payment ends at 36 months; observation and reversal-flagging continue for the full obligation term. This costs you almost nothing and is directly the "instrument nobody has" that §2 claims BNG needs.
- **Reversal buffer pool.** Withhold a fraction of every issuance into a shared pool that covers reversals across the portfolio. Standard practice in carbon registries — but here the buffer can be **actuarially sized from observed portfolio reversal rates**, because your monitoring is continuous and free, rather than set by negotiated guess. That is a real innovation, it is a small contract addition, and it converts idiosyncratic reversal risk into pooled risk, which raises the clearing price and therefore the restorer's revenue. Good economics *and* good for restoration.

### 2.8 Tenure, consent, and benefit-sharing are absent

**Problem.** Nothing in the document addresses land tenure, free prior and informed consent, or benefit-sharing. §2 names Indigenous-led stewardship organisations as supply-side users. As specified, any party can register an H3 cell set and sell outcomes over it with no tenure attestation and no consent requirement.

That is the precise mechanism by which carbon projects have generated land conflict and dispossession. For a project whose whole thesis is verification rigour, tenure is a conspicuous hole — and it is the social-licence risk that would end a real deployment regardless of how good the remote sensing is.

**Fix — minimum viable, and genuinely differentiating.**

- Parcel registration requires a **tenure/rights attestation** from an identified party, hashed into the parcel record, with the attestation type recorded (freehold, lease, customary, co-management agreement).
- The deed carries a **benefit-sharing split**: a fixed fraction of every tranche routes to a named steward address at release, enforced by the contract rather than promised in a side agreement.

Both are trivial on-chain and no registry currently has either as a protocol primitive. This is arguably the second-strongest differentiator in the whole design after the persistence tranches.

### 2.9 The demand-side assumption is load-bearing and unexamined

**Problem.** Rigorous verification issues *fewer units per dollar of restoration* than lax verification. Your own worked example: claim 42 ha, settle 13.1 ha. A budget-constrained ESG buyer comparing your unit against a certifier-blessed 42 ha credit at the same price buys the certifier's, unless assurance and litigation risk are priced.

The proposal asserts regulation will price it (CSRD/ESRS E4, TNFD, greenwashing litigation) and gives that assumption one bullet in §2. It is the commercial foundation of the entire project. It also has a live risk you do not mention: the CSRD scope-and-timing rollback process has been narrowing that specific driver — worth flagging as a risk rather than treating as a given.

Also, the demo framing works against you. "The payout was still three times too high" reads to a corporate buyer as *"this platform gives me a third of the credits"*.

**Fix.** Reframe the value proposition as **insurance against restatement**, not as unit count. The comparison is not units-per-dollar; it is expected write-down. A unit that survives assurance is worth more than three units that get restated, and restatement is the thing a sustainability lead is personally exposed to. Put an explicit assurance-adjusted comparison in the UI — "13.1 ha defensible vs. 42 ha at risk" — and make it a named view. This is a one-slide change that fixes the framing across the demo, the video, and the pitch.

### 2.10 MRV cost excludes the parcel sizes that matter most

**Problem.** A Tier 1 drone sortie is roughly £1–5k; a sensor array is £2–10k installed plus maintenance; plus pipeline compute per verification. On a 40 ha planting at $1–3k/ha, MRV is plausibly 10–30% of project cost. On the 1–10 ha parcels that dominate BNG and community restoration, it is prohibitive. §3.8's "cheap MRV is self-penalising" therefore cuts against exactly the projects that most need to participate.

**Fix — cohort verification, and it is directly enabled by the H3 index you already have.** Aggregate many small parcels into a cohort that shares one control set, one drone sortie, and one calibration transfer function; verify at cohort level and allocate to parcels. This amortises Tier 1 across parcels, is a natural extension of the pooled-deed idea in §4.6, and makes the mechanism reach smallholders. It is also a good demo: two views of the same globe, one parcel and one cohort.

---

## Part 3 — Technical and scientific corrections

Concrete items to fix in the text.

| # | Item | Issue |
|---|---|---|
| 1 | **GEDI at Flow Country** | GEDI flies on the ISS at 51.6° inclination, so coverage stops near ±51.6°. Flow Country (~58.4°N) has **no GEDI footprints at all**. Fraser Valley (~49°N) is marginal. §3.2 lists GEDI as a structure source without this caveat. Use ICESat-2 (near-polar, ~±88°) for the high-latitude sites, and state the latitude limit. |
| 2 | **Peatland inverts your own trust model** | For peatland rewetting the outcome variable is water table, which is measured by Tier 2 point sensors — your *most spoofable* tier. Greenness is near-useless as a success indicator and can move the wrong way after successful rewetting. §3.2's "satellite is the arbiter" principle breaks for the Flow Country site. Either acknowledge it explicitly, or add InSAR peat surface motion (bog breathing / subsidence-uplift) and SAR-derived surface wetness as the satellite-side arbiter. Currently the strongest unaddressed contradiction in the document. |
| 3 | **C-band coherence in vegetation** | §3.2 and §4.2 use interferometric coherence loss as a clearing/disturbance detector. C-band temporally decorrelates severely over dense vegetation at 6–12 day baselines — coherence is often near noise floor in exactly the tropical and mangrove settings you name. Build the reversal detector primarily on backscatter change plus dNBR, with coherence as corroboration where geometry and baseline permit. §3.2 already hedges on SLC vs GRD; extend the hedge to interpretability. |
| 4 | **Sentinel-1 constellation history** | Revisit interval is not constant across the archive (S1B failed in 2021; the constellation was single-satellite for a period before S1C). Any coherence or backscatter time series spanning that period has a discontinuity in temporal baseline. Verify the current constellation state and note the archive discontinuity in §12. |
| 5 | **H3 cells are not equal-area** | Cell area varies within a resolution (icosahedral distortion, plus 12 pentagons). Do not derive hectares from cell counts. Use H3 for **identity and indexing**, polygon geometry for **quantities** — state this explicitly in §3.10, since the verdict JSON reports hectares. |
| 6 | **H3 non-overlap ≠ parcel non-overlap** | Two adjacent parcels can legitimately share a boundary cell, and centroid-in vs. full-cover containment materially changes both area and the intersection test. §3.10 says the encoding must be canonical; it needs to specify the containment rule *and* a boundary tolerance, or the double-counting check produces false positives on every adjacent pair. |
| 7 | **Uncertainty sources are the wrong ones** | §3.8 lists atmospheric residuals, BRDF, mixed pixels, co-registration. In a DiD estimate the dominant error terms are almost always **control-matching error** and **index→physical-quantity model transfer error**. The listed sources are second-order. Reorder, and add both. |
| 8 | **Validate interval coverage empirically** | Analytically propagated intervals are routinely mis-calibrated. Add a coverage check: on held-out ground-truth plots, does the nominal 95% interval contain truth ~95% of the time? Reporting an empirical coverage figure alongside the nominal one is cheap, and it is the single most credible thing you can show an ecology-literate judge. It also directly defends the settlement rule, since the whole financial argument rests on the bound meaning what it says. |
| 9 | **"Additionality" is used for two different things** | The document uses it for the DiD adjustment only. Split the vocabulary — *biophysical additionality* (DiD) and *financial additionality* (§2.4) — and say which one the mechanism measures. Conflating them is the criticism that gets levelled hardest. |

---

## Part 4 — Scope and schedule

**§5.2 puts a hard Arc deadline at September 30. Today is September 9 — that is 21 days.** The build sequence in §9 puts Arc contracts at step 4 of 12, behind a full spatial pipeline, control matching, and a deck.gl globe. That ordering cannot meet the deadline it is written against. If the Arc track is genuinely the highest-EV prize (two winners, $3,500), the contracts move to steps 1–2 and the pipeline builds against a deployed contract, not the reverse.

Separately, §9 is a 6-month plan: 12 steps, 4 demo sites, 2 chains, 3+ sponsor integrations, a production-grade spatial pipeline, a Subgraph, an agent, and a 7-view 3D globe. §9's risk paragraph says to cut the reversal path and the fourth site first. That cut list is far too shallow.

**Recommended cut, hard:**

- **One site** — the dryland, with a biome-appropriate metric per §2.5.
- **Tier 0 genuinely real** (this is non-negotiable and §11 already says so). **Tiers 1–3 simulated from realistic parameters and labelled as simulated, on screen, in the video.**
- **Depth on:** additionality + pre-registration commitment + the assurance export. Those three are the thesis.
- The globe is the demo's surface; it is also the biggest time sink for the least thesis value. Two views done well beat seven views half-done — the **additionality chart** (§7.2 correctly calls it the most important chart in the product) and the **assurance export**.

The counterfactual reveal is the entire demonstration. Everything that does not serve it is cuttable.

---

## Part 5 — Market landscape and positioning

Researched September 2026. Sources listed at the end of Part 6.

### 5.1 There are three markets, and they barely talk to each other

**Compliance / statutory — real money, zero smart contracts.** UK BNG reached **£93M across 312 registered gain sites in 2026**, administered through Natural England's Biodiversity Gain Site Register. Statutory credits (the last-resort backstop) took only **£426,100 in FY2025–26**. The EU published its **Roadmap towards Nature Credits** in July 2025, with pilots running 2025–27 and a framework targeted around 2027. The regulation §2 cites as demand is real and firming — and none of it touches a blockchain or is asking for one.

**Blockchain-in-nature-markets — boomed, crashed, re-formed institutionally.** The 2021–22 crypto-carbon wave largely died: **Flowcarbon** never launched despite ~$70M from a16z and refunded buyers; **Nori** closed September 2024 after seven years; **Toucan**'s core mechanism was killed when Verra banned tokenizing retired credits in May 2023, and Toucan handed the protocol to the community as open source in 2025. **KlimaDAO** relaunched as Klima Protocol on Base in February 2026 at much smaller scale with identity verification. VCM transaction volume fell from ~$2B (2021) to ~$535M (2024).

Then it inverted. **Verra partnered with the Hedera Foundation in 2025** to integrate Guardian into its Project Hub and digitize 20+ methodologies, and in **2026 approved its first credits under a dMRV pilot** — monthly issuance rather than multi-year verification cycles. **JPMorgan's Kinexys** is tokenizing at registry level with S&P Global, EcoRegistry and ICR. The institutions that banned tokenization are now building it themselves.

**Satellite MRV — rigorous measurement, no programmable settlement.** Pachama (acquired by Carbon Direct), Chloris Geospatial, Space Intelligence, Treeconomy (UK, explicitly targeting smallholders), Renoster (satellite ratings across 360+ projects, comparing performance before vs. after crediting start — crude additionality). All sell analysis or ratings. None settle anything.

### 5.2 Crypto-native players closest to this project

| Project | What it does | Overlap |
|---|---|---|
| **Regen Network** | Ecological state protocols, own registry, methodologies extending to biodiversity | Nearest analogue. Registry + methodology, not conditional escrow |
| **Open Forest Protocol** (NEAR) | Open MRV for forest projects, community validators, tokenized credits | Closest on MRV→token. Validator attestation, not counterfactual measurement |
| **Silvi** | Tree stewardship, per-tree verification, steward payouts; **piloting "tree-forwards"** | Prior art for §2.1's pre-financing recommendation |
| **Solid World** | Forward carbon liquidity pools on Polygon, CRISP risk score, **working capital before certification** | Prior art for §2.1's assignable receivable |
| **Astral Protocol** | EAS-based location attestations + verifiable geospatial computation | Direct overlap with §3.10 — see §6.6 |

### 5.3 The whitespace is real but narrower than the proposal assumes

A targeted search for outcome-based conditional payment tied to satellite verification returns only generic escrow patterns. **Nobody is wiring difference-in-differences additionality into a settlement rule.** Regen has the registry, OFP the MRV, Silvi and Solid World the forward finance, Renoster the counterfactual analysis. The join is genuinely unoccupied. That claim survives contact with the landscape.

### 5.4 Two positioning changes this forces

**Drop "no central certifier required."** It is in `ecorestore_network.md` and it is precisely the positioning that got Toucan killed. Every survivor works *with* registries. Reposition as **dMRV infrastructure a registry or standard could adopt** — now a validated business, because Verra is doing exactly that with Guardian.

**Stop quoting market-size reports.** The $7.1B→$8.8B biodiversity credit figures from Polaris/Grand View are definitionally loose, bundling compliance offsets and mitigation banking. The honest numbers are UK BNG at £93M and voluntary biodiversity credit transactions in the low tens of millions globally. Cite BNG and the EU roadmap; an informed judge will discount you for the CAGR reports.

---

## Part 6 — Hedera Guardian, ATS, and Astral

### 6.1 Guardian is the elephant, and the proposal does not mention it

**Hedera Guardian** is an open-source **policy workflow engine** for digitizing environmental methodologies end to end — not a token standard. Components that matter here:

- **Policy Workflow Engine** with **40+ blocks**: `requestVCDocument` (form capture), `externalDataBlock` (third-party API pull — Global Forest Watch and FIRMS are named integrations), `customLogicBlock` (Python calculation over raw measurements), `documentValidator` / `multiSign` (approval quorums), `timer` (scheduled actions), `aggregateDocument` (MRV aggregation and splitting), `mintDocument` / `tokenAction`.
- **Schemas** — five types, with conditional visibility, validation rules, nested tables, and **geo-fields for location data**.
- **DIDs / VCs / VPs** to W3C standards, documents on IPFS, producing a **trust chain**: complete lineage from raw submission through approvals to retirement.
- **Roles**: Standard Registry, Project Developer, VVB, Auditor.
- **Token Retirement Contract** — per-policy retirement rules enforced on-chain.
- Minting via **HTS**, audit trail via **HCS**.

It is the incumbent on the chosen chain, Verra adopted it in 2025, and DOVU and Tolam Earth are built on it. Proposing environmental asset issuance on Hedera without naming Guardian is a scoring risk in front of a Hedera judge.

### 6.2 Guardian/ATS overlap — the §4.3 justification does not hold as written

| §4.3 requirement | Guardian + HTS | ATS |
|---|---|---|
| Issue on verified milestone | **Native** — `mintDocument`, gated on policy completion | Yes, via SDK/UI; no MRV gating of its own |
| Bind evidence (H3 root, CID, metric version) | **Native** — VC/VP trust chain, IPFS, geo-fields | ERC-1643 document linking; no evidence model |
| KYC'd counterparties only | **Yes** — HTS KYC key, consensus-enforced | **Yes** — identity registry + modular compliance |
| Transfer under compliance controls | Binary allow / deny / freeze | **Rule-based**, per transfer, with reason codes |
| Retire | **Native** — Token Retirement Contract | "Redeem" (burn); no retirement concept |
| Flag / mark reversed | Not native | Not native (ERC-1644 is closest) |
| Partition by vintage | No | **Yes** — ERC-1410 partitions |
| Dividends / coupons / snapshots | No | Yes — irrelevant here |

**Both issue, both gate to KYC'd holders, both can end the token's life.** That is most of §4.3.

**The problem.** ATS is a **securities** toolkit — ERC-1400 core (ERC-1410 partitions, ERC-1594 transfer validation, ERC-1643 documents, ERC-1644 controller operations) plus **ERC-3643 dual-standard support added ~November 2025**, diamond proxy (EIP-2535), Reg D 506(b)/506(c) and Reg S coverage, dividends and coupons. The Restoration Outcome Unit is explicitly not a security — §4.3 says it is not even a regulatory biodiversity credit. So most of ATS's machinery is irrelevant, and the one capability §4.3 names as the reason for choosing it — *"permissioned transfer... which a plain ERC-20 cannot express"* — **HTS already provides natively via the KYC key**, without ATS.

That sentence will not survive a Hedera judge who knows their own stack. It needs rewriting, not deleting: a good justification exists, it just is not the one currently written.

**Two further §4.3 inconsistencies:**

1. **The fee argument is attached to the wrong component.** "Hedera's low, predictable fees make per-parcel, per-vintage issuance economically sensible" is true of native HTS operations. ATS is Solidity on Hedera's EVM behind a diamond proxy — contract calls, meaningfully more expensive. The fee argument supports Guardian/HTS more than ATS.
2. **Reversal is unowned in both stacks.** Neither Guardian nor ATS has a "mark reversed" primitive. §4.2 and §4.3 treat it as given; it is the one lifecycle operation genuinely being built from scratch, and it currently reads as though it comes free.

### 6.3 Three options

**A — Guardian only.** Most architecturally honest: purpose-built for environmental assets, native retirement, native evidence provenance, adopted by Verra. Costs: heavy to stand up; worse fit for the "Tokenization of Anything" track framing; and a philosophical tension — Guardian's model is *a human VVB approves the submission*, which is the thing this project argues should be computed.

**B — ATS only, justification rewritten.** Simplest build. The honest case for ATS:
- **ERC-1410 partitions** make vintages first-class rather than metadata — useful when a parcel issues against multiple observation windows.
- **ERC-3643 modular compliance** evaluates rules *per transfer* (jurisdiction, holder caps, lockups) rather than a binary account flag, which is what a corporate legal team asks for.
- **ERC-1644 controller operations** are the closest existing primitive to the reversal flag — a regulator-style forced action on an already-transferred unit. Nobody has used ERC-1644 for environmental reversal handling; framing it that way is a novel and defensible claim.

**C — both, with a clean seam.** Detailed below.

### 6.4 Option C in detail

Guardian and ATS sit at different layers of one pipeline and neither currently reaches the other. Guardian's minting path terminates in an HTS token; ATS starts from an issuer who has already decided to issue.

**Guardian is the issuance authority. ATS is the instrument.** Guardian decides whether and how much to issue and carries the provenance; ATS is what the buyer holds and transfers.

**The seam.** A completed Guardian policy run produces a **Verifiable Presentation** bundling the trust chain (project registration, MRV submission, verdict, mint authorization), each VC DID-signed by its issuer, pinned to IPFS, written to an HCS topic, hash-addressable.

**ERC-1643 exists precisely to bind off-chain compliance documents to a security token.** A Guardian VP *is* an off-chain compliance document:

```text
Guardian VP  ─────────────────────────────────►  ATS token

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

Two standards otherwise ignored start doing real work: **ERC-1410 partitions become vintages** (transfers and retirements happen per observation window, which is what disclosure accounting needs), and **ERC-1643 documents become the evidence binding** — the standard's intended use, not a custom metadata field.

**What guarantees the seam: public verifiability, not on-chain enforcement.** HCS messages are not readable from Hedera's EVM, so no contract can check the VP. Instead the mint records the VP hash and HCS message ID, and anyone can fetch the HCS message, fetch the IPFS document, re-hash, and confirm the token corresponds to a real completed policy run. This is the same argument §3.9 already makes about the spatial pipeline — reproducibility as the defensibility mechanism. The seam is consistent with the project's philosophy rather than a weaker exception to it.

**Architecture:**

```text
┌──────────────────────────────────────────────────────────┐
│  Spatial pipeline (§3)          unchanged                │
│  STAC · COG · Zarr · H3 · controls · uncertainty          │
└────────────────────────┬─────────────────────────────────┘
                         │ verdict JSON
                         ▼
┌──────────────────────────────────────────────────────────┐
│  GUARDIAN — policy workflow                               │
│    requestVCDocument   restorer submits claim             │
│    externalDataBlock   ← auditor verdict enters here      │
│    customLogicBlock    settlement rule (lower bound, %)   │
│    documentValidator   diagnostics gate                   │
│    timer               ← persistence re-verification      │
│    mintDocument        authorises issuance                │
│  output: VP (IPFS CID + hash) + HCS message               │
└──────────┬───────────────────────────────┬───────────────┘
           │ vp_hash                       │ vp_hash
           ▼                               ▼
┌────────────────────────┐   ┌─────────────────────────────┐
│  ARC — money rail      │   │  ATS — the instrument       │
│  releaseTranche()      │   │  issueByPartition(vintage)  │
│  USDC escrow           │   │  setDocument(VP)            │
│  (Guardian holds       │   │  ERC-3643 transfer rules    │
│   no money)            │   │  ERC-1644 controller ops    │
└────────────────────────┘   └─────────────────────────────┘
```

**Three things fall out of this that improve the current design:**

- **§4.2's persistence tranches map onto a Guardian `timer` block.** Scheduled 12/24/36-month re-verification is a native primitive, not custom scheduling infrastructure.
- **§5.4's multi-chain justification gets stronger.** Currently "the bridge is the auditor's attestation, not a token bridge" is asserted. Here the shared artifact is a specific, hash-addressable, third-party-verifiable document with an HCS timestamp; Arc and Hedera both reference the same VP hash and nothing else crosses.
- **Reversal gets a home in both halves.** Guardian records a reversal VC into the trust chain; ATS acts via ERC-1644 controller operations against the affected partition.

**The risk nobody flags.** Adopting Guardian means adopting **Guardian's trust model**, built around a human VVB approving submissions — the thing this project argues should be computed. Either keep a VVB in the loop, contradicting the thesis, or rubber-stamp the role, which registries would reject.

The resolution is a better story than the current one and belongs in the proposal: **the pipeline does not remove the VVB, it changes what the VVB reviews** — from *"is this claim form plausible?"* to *"is the pipeline correctly configured, is the pre-registered analysis plan honoured (§2.2), and is the parallel-trend diagnostic passing?"* That is a role a registry would accept, and it makes the Guardian integration natural rather than awkward.

**Cost.** Guardian is ~10 microservices, MongoDB, IPFS, a vault, plus a Standard Registry testnet account. Realistically **1–3 days to stand up and understand**, then **2–4 days to author a minimal real policy** — the editor, 40+ block types and schema design are their own learning curve. That is 3–7 days of a 21-day budget already containing the spatial pipeline, Arc contracts with a mainnet deadline, a Subgraph, the auditor, x402, and a UI.

### 6.5 Recommendation: design for C, build B, make the seam real

Four steps, hours rather than days:

1. **Publish the verdict VC schema** as a Guardian-compatible JSON schema file in the repo.
2. **Emit the auditor verdict as a signed VC** against that schema. §6.2 already emits structured JSON; wrapping it as a W3C VC with a DID signature is a small addition.
3. **Bind that VC into the ATS token via a real `setDocument()` call** at issuance, partition set to the vintage. This is the seam actually working, with the auditor occupying the slot Guardian would occupy.
4. **One diagram and one paragraph** showing Guardian dropping into that slot, naming the `externalDataBlock` and `timer` mapping.

"We use ATS" is unremarkable. "We plan to integrate Guardian" is a promise. **A working ERC-1643 binding of a signed verdict VC into a partitioned security token, with the Guardian drop-in point specified** is a demonstrated architecture with a credible path — and the ERC-1643 / ERC-1410 / ERC-1644 usage is novel for environmental assets regardless of whether Guardian is in the loop yet.

### 6.6 Astral — relevant to §3.10, but do not take the dependency

**Two layers.** The **Location Protocol** is a spec for location attestations — signed spatial records (points, polygons, routes) stored via the **Ethereum Attestation Service**, referenced by UID, with revocation checking, GeoJSON as the documented format, queryable across **Arbitrum, Base, Celo and Sepolia** via REST and GraphQL. **Astral Location Services** is a verifiable geospatial computation oracle: PostGIS inside a TEE (EigenCompute) executing **distance, containment, intersection, within, area, length** and returning a signed answer consumable by contracts through an EAS resolver. SDK is `@decentralized-geo/astral-sdk`.

**Status caveat:** explicitly a **research preview**, MVP v0.1.0, "APIs may change", trust model described as "centralized service with known signer running in TEE". Not safe on a 21-day critical path.

**Why it matters anyway.** §3.10's double-counting prevention is a set-intersection check over parcel geometries — one of Astral's five core operations. The proposal designs a canonical H3 resolution, deterministic cell-set encoding, and on-chain Merkle root to make that check possible. Astral does it directly on attested polygons.

**This resolves two Part 3 corrections at once.** Items 5 and 6 flag that H3 cells are not equal-area (so hectares must not come from cell counts) and that H3 non-overlap does not prove parcel non-overlap at shared boundary cells. **Running the intersection test on real polygon geometry makes both problems disappear.** H3 then does the job it is good at — join key across tiers, datacube index — and stops doing the job it is bad at, representing legal parcel boundaries. This is a strict simplification of §3.10 whether or not Astral is used.

**Also worth noting:** §5.3 declined Chainlink CRE Confidential Workflows while conceding TEE processing of sensitive site coordinates is a real use case. Astral is already shipping that pattern. The instinct was right and there is now convergent evidence for it — worth a line in §5.3 rather than leaving it as a declined sponsor.

**Recommendation:** adopt the **Location Protocol attestation shape** for parcel records so interoperability is structural, cite it, and move the non-overlap check to polygon geometry. "Compatible with the Location Protocol" is a cheap credible sentence; "depends on a research-preview TEE oracle on Base" is live-demo risk on a chain not otherwise in use.

### Sources

- Hedera Guardian documentation — <https://guardian.hedera.com/guardian/>
- Guardian Token Retirement Contract — <https://docs.hedera.com/guardian/guardian/tokens/retirement-contract>
- Asset Tokenization Studio — <https://docs.hedera.com/hedera/open-source-solutions/asset-tokenization-studio-ats>
- ATS repository — <https://github.com/hashgraph/asset-tokenization-studio>
- Hedera integrates ERC-3643 into ATS — <https://hedera.com/blog/hedera-integrates-erc-3643-token-standard-into-asset-tokenization-studio/>
- HTS native tokenization and token keys — <https://docs.hedera.com/learn/core-concepts/tokens/hts-overview>
- Verra and Hedera partnership — <https://hedera.com/case-study/verra/>
- Astral Protocol — <https://www.astral.global/> · <https://docs.astral.global/introduction> · <https://github.com/AstralProtocol/astral-location-services>
- Blockchain and carbon markets in 2026 — <https://www.cryptoaltruists.com/blog/what-happened-to-crypto-carbon-blockchain-and-carbon-markets-in-2026>
- BNG market 2026 — <https://landbng.uk/blog/bng-market-prices-habitat-banks-2026/>
- BNG statutory credits report FY2025–26 — <https://www.gov.uk/government/publications/biodiversity-net-gain-bng-statutory-credit-reports-2025-to-2026/biodiversity-net-gain-bng-statutory-credits-report-1-april-2025-to-31-march-2026>
- EU Roadmap towards Nature Credits — <https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=COM:2025:374:FIN>
- Solid World forward carbon liquidity pools — <https://www.coindesk.com/business/2023/05/18/climate-finance-firm-solid-world-opens-forward-carbon-liquidity-pools-with-polygon>
- MRV startup landscape — <https://www.naturetechmemos.com/p/top-10-mrv-startups-revolutionizing-nature-based-solutions>

---

## Part 7 — Suggested edits to the document, in priority order

1. **Add §4.7 "Working capital and assignability"** — mobilisation tranche, assignable receivable, MRV cost pass-through from escrow. (§2.1)
2. **Add §3.7.1 "Pre-registration"** — analysis plan hash committed at `createDeed()`, control set drawn by committed rule, all runs recorded. (§2.2)
3. **Add an encumbrance/obligation registry** to §3.10's on-chain record and an `obligation_status` attribute to §4.3's unit. (§2.4)
4. **Add tenure attestation and a benefit-sharing split** to parcel registration and deed terms. (§2.8)
5. **Rewrite §3.8** to separate conservatism from pricing, and state the biome/parcel-size regressivity and its fix. (§2.3)
6. **Fix the dryland metric** in §3.11 and reframe the demo around "the naive metric pays for the wrong intervention". (§2.5)
7. **Promote leakage** to a numbered step in §3.6 with a two-ring control design, and add it to the verdict JSON. (§2.6)
8. **Extend §4.2** with a monitoring commitment decoupled from the payment schedule, plus a reversal buffer pool. (§2.7)
9. **Reframe §2 and §10** around restatement risk rather than unit count; add the assurance-adjusted comparison view. (§2.9)
10. **Add cohort verification** to §4.6. (§2.10)
11. Apply the Part 3 corrections.
12. Reorder §9 against the Sept 30 deadline; cut to one site and two UI views.
13. Add a **one-page summary** at the top. At 50KB the document is a design record, not a submission artifact, and no judge will read to §13.
14. **Rewrite the §4.3 ATS justification.** The stated reason (permissioned transfer a plain ERC-20 cannot express) is wrong — HTS provides it natively. Replace with ERC-1410 partitions as vintages, ERC-3643 per-transfer rule evaluation, and ERC-1644 controller operations as the reversal primitive. Move the low-fee argument off ATS onto HTS. State plainly that reversal is being built, not inherited. (§6.2)
15. **Add §4.3.1 "Guardian integration"** — the VP→ERC-1643 seam, the `externalDataBlock` and `timer` mapping, and the VVB reframing (the pipeline changes what the VVB reviews, it does not remove them). (§6.4–6.5)
16. **Simplify §3.10** — polygon geometry for the non-overlap test, H3 demoted to index and join key, Location Protocol attestation shape adopted. Strictly simpler than what is written and fixes Part 3 items 5 and 6 at once. (§6.6)
17. **Reposition §1 and §13** from parallel registry to dMRV source that registries call, and delete "no central certifier required" from `ecorestore_network.md`. That framing is what got Toucan killed; Guardian is the concrete integration surface that makes the new framing credible. (§5.4)
18. **Replace market-size citations** with UK BNG (£93M, 312 sites) and the EU Nature Credits Roadmap. Drop the CAGR reports. (§5.4)

---

## Bottom line

The verification half is strong and, with the Part 3 corrections, defensible in front of someone who does this for a living. The finance half is currently a payment schedule with an audit trail bolted on.

Items 2.1 (working capital / assignable receivable), 2.2 (pre-registration), 2.4 (encumbrance registry) and 2.8 (tenure and benefit-sharing) are the four that change the answer to the question you asked. All four are contract-layer, all four are cheap, and all four land inside the sponsor tracks you are already targeting rather than adding scope to the pipeline. Add those and the honest answer becomes yes — it incentivises restoration, and specifically it incentivises restoration by operators who currently cannot access outcome finance at all.

Without them, the honest answer is: it makes existing restoration finance harder to lie about, which is worth doing, but it is a smaller claim than the document makes.

Separately, and independent of the incentive question: the landscape work in Parts 5 and 6 says the whitespace you are aiming at is real — nobody is wiring difference-in-differences additionality into a settlement rule — but that the *positioning* around it needs to change. The projects that died in this space died fighting registries; the ones that survived work with them, and Verra now runs on Guardian. Position as the dMRV source a registry calls, not as a replacement for one. The §4.3 justification and the §3.10 geometry both need rework regardless, and both come out simpler.
