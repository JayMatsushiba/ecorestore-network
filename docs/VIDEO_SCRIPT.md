# Ecorestore Network — 4-Minute Demonstration Script

This is the shooting script for the ETHOnline 2026 submission video. It runs 4:00.

Read it against `docs/DEMO.md`, which sets the demonstration flow and the provenance
rules, and against `docs/DEPLOYMENT.md` §12, which records what is actually running.

## How to use this script

- **NARRATION** is the spoken track. It totals about 590 words, which is 4:00 at a
  measured 148 words per minute. Do not speed up to fit more in — cut a shot instead.
- **ON SCREEN** is what the viewer sees. Every number in the narration appears on screen
  at the moment it is spoken.
- Every figure comes from `out/demo/summary.md`, produced by `npm run demo`. Re-run the
  demo before you record and reconcile any figure that has moved.

## Three rules for the recording

1. **Never show a simulated value without its label.** The `synthetic` scenario injects
   +0.25 NDVI into the real series. Its SIMULATED banner must be on screen for every
   frame that shows one of its numbers.
2. **Never claim unbuilt work.** Say "prepared", not "settled on Arc". The contract is
   not deployed to Arc Testnet. Guardian runs no policy. There is no subgraph, no x402
   and no LLM narrator.
3. **Never cut the scientific core.** If a shot has to go, cut the map fly-in and the
   architecture diagram. Keep additionality, leakage, uncertainty, pre-registration and
   the refusal cases.

---

## 0:00–0:22 — The problem

**ON SCREEN.** Title card, then a split: a planting photograph on the left, a PDF
verification report on the right. The PDF fades to a "RESTATED" stamp.

**NARRATION.**

> Restoration money is paid at planting, against a promise. Verification arrives years
> later as a PDF, and the units it blesses can be restated. So the buyer who is
> personally exposed to restatement treats these credits as a liability.
>
> Ecorestore Network releases capital a different way. Money moves only against evidence
> measured from space, bounded by its own uncertainty, and adjusted for what would have
> happened anyway.

---

## 0:22–0:50 — The commitment comes first

**ON SCREEN.** The Kootenay Riparian parcel in the Creston Valley, British Columbia, with
its near and far control rings drawn around it. Then the analysis plan hash, and the deed
funded in USDC.

**NARRATION.**

> Here is one parcel in British Columbia. Before any outcome is observable, the sponsor
> commits an analysis plan on-chain: the control rule, the gates, the confidence level.
>
> That commitment is the whole point. The control set is *drawn by the committed rule*,
> not chosen later when someone can see which choice pays. An estimator that is fixed
> before the answer is known is a measurement. One fixed afterwards is a negotiation.

---

## 0:50–1:28 — Real evidence

**ON SCREEN.** The evidence ladder. Tier 0 highlighted in the REAL treatment, with STAC
scene IDs scrolling and the processing graph version visible. Tiers 1–3 below it, each
carrying the SIMULATED banner.

**NARRATION.**

> The satellite layer is real. Seventy-two genuine Sentinel-2 Level 2A acquisitions over
> the parcel and both control rings, each with its STAC scene identifier and its
> processing graph version on screen.
>
> The drone, sensor and ground tiers are simulated for this demonstration, and they are
> labelled as simulated everywhere they appear. We never blur the two. The satellite
> layer is the scientific claim; fabricating it would undermine everything above it.

---

## 1:28–2:20 — From claim to settlement

**ON SCREEN.** The "From claim to settlement" waterfall, revealed one step at a time, with
the SIMULATED banner held on screen throughout. Then the "Interval, not a point" panel.

**NARRATION.**

> Now watch a claim become a payment. This run is the sensitivity scenario, so its Tier 0
> is simulated — the banner stays up.
>
> The restorer claims forty-two hectares. The parcel itself gains 13.67. The far control
> ring gains 1.01 over the same period. That gain is not the project's, so it comes off.
> Difference-in-differences leaves 12.65 hectares of additional change.
>
> That is still an estimate, so the engine bootstraps a ninety-five percent interval:
> 2.23 to 21.63 hectares, with empirical coverage measured over forty placebo runs.
>
> Settlement takes the lower bound. Two point two three hectares. Not the midpoint, not
> the claim. The uncertainty is paid by the party making the claim.

---

## 2:20–2:52 — The system refuses to pay

**ON SCREEN.** Cut to the `real` scenario: status `NOT_ADDITIONAL`, settled 0 ha. Then the
`trend-failure` scenario: parallel-trend gate FAIL, status `INSUFFICIENT_EVIDENCE`,
settled 0 ha.

**NARRATION.**

> This next part matters more than the payment. Run the *unmodified* real data. No
> intervention took place on this ground, and the engine says so: not additional, lower
> bound below zero, nothing paid.
>
> And when the parallel-trend diagnostic fails, the engine does not fall back to a
> guess. It returns insufficient evidence and refuses to settle. A verification system
> that cannot say no is not a verification system.

---

## 2:52–3:24 — Who is allowed to decide what

**ON SCREEN.** The authority model, one row at a time. Then the signed verdict credential
with its DID and result hash, and the `RestorationDeed` test suite passing.

**NARRATION.**

> Each component has exactly one job. The engine produces the number. Hedera Guardian
> holds the methodology and the credential. The Arc Restoration Deed holds the escrow and
> decides settlement. The Auditor explains, and never decides.
>
> So no AI-generated number can release money. The verdict is signed as a W3C credential,
> and the contract checks the plan hash and rejects replays before it pays. Thirty-one
> tests hold that behaviour, and the whole lifecycle runs on a local chain: mobilisation
> draw, verification, release at the lower bound, benefit share to the steward.

---

## 3:24–3:44 — What is running, stated honestly

**ON SCREEN.** The live demonstration at its public address, all three scenarios verifying.
Then a plain list: deployed / prepared / not built.

**NARRATION.**

> What you have seen is live. The split stack — an isolated Python analysis service, a
> TypeScript verify service, a browser front end — runs on AWS and redeploys on every
> push.
>
> What is not done: the deed is not yet deployed to Arc Testnet, so the settlement
> calldata is prepared and never broadcast. Guardian runs no policy yet. We say so on the
> screen rather than in a footnote.

---

## 3:44–4:00 — Close

**ON SCREEN.** The assurance-adjusted comparison: **2.2271 ha defensible vs. 42 ha at
risk**. Hold to the end card.

**NARRATION.**

> Rigorous verification issues fewer units than lax verification. That is the honest
> trade, and it is the product.
>
> Two point two hectares that survive an audit, against forty-two that are waiting to be
> restated. We are selling the first number.

---

## Figures used, and where they come from

Every figure below is from the `synthetic` and `real` entries in `out/demo/summary.md`.

| Spoken | Value | Source |
|---|---|---|
| Sentinel-2 acquisitions | 72, REAL | `verification/fixtures/tier0-kootenay-riparian-001.json` |
| Claimed | 42 ha | all scenarios |
| Gross parcel change | 13.6658 ha | `synthetic` |
| Far ring change | 1.0144 ha | `synthetic` |
| Additional change | 12.6514 ha | `synthetic` |
| 95% interval | [2.2271, 21.6266] ha | `synthetic` |
| Empirical coverage | 0.875 over 40 placebos | `synthetic` |
| Settled | 2.2271 ha, status `PARTIAL` | `synthetic` |
| Real run | `NOT_ADDITIONAL`, 0 ha, lower bound −11.6192 | `real` |
| Trend failure | `INSUFFICIENT_EVIDENCE`, 0 ha | `trend-failure` |
| Contract tests | 31 Foundry tests | `contracts/` |

Leakage is 0 ha on the current data because the near and far rings do not diverge. Do not
narrate a leakage deduction that the run did not make.

## Recording checklist

- [ ] `npm run demo` re-run; every figure above reconciled against `out/demo/summary.md`
- [ ] SIMULATED banner visible in every frame showing a `synthetic` number
- [ ] STAC scene IDs legible at the recorded resolution
- [ ] No Sentinel-1, Landsat or ICESat-2 scene IDs anywhere on screen
- [ ] No frame implies an Arc Testnet deployment, a Guardian policy run, a subgraph or x402
- [ ] Narration timed at or under 4:00 without speeding up the read
