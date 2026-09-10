# Ecorestore Network — Product

## 1. One-page summary

**What it is.** Capital for ecological restoration is released against spatially
verified, uncertainty-bounded, additionality-adjusted evidence of ecological change. The
verified outcome becomes an auditable asset a corporate buyer can hold, audit and retire.

**The loop.** Evidence → deterministic verification → methodology workflow →
programmable settlement → verified restoration outcome → indexed history.

**What is actually novel.** Three things, in order:

1. **Difference-in-differences additionality inside the settlement rule.** Not in a
   methodology PDF — in the code path that moves money. Regen has the registry, Open
   Forest Protocol the MRV, Silvi and Solid World the forward finance, Renoster the
   counterfactual analysis. The join is unoccupied.
2. **Persistence payment made economically viable by near-zero marginal monitoring
   cost.** Conventional MRV cost is what forced the pay-at-planting norm. Continuous free
   satellite observation removes it, which makes long-dated conditional payment
   affordable for the first time.
3. **A pre-registered analysis plan committed on-chain before the outcome is
   observable.** The control set is *drawn by a committed rule*, not chosen at
   verification time. This is what separates an estimator from a negotiation.

**What makes it reach operators who currently cannot access outcome finance.** The deed
holds committed USDC against machine-evaluable release conditions — a better credit
instrument than a small restorer's balance sheet. A mobilisation tranche, an assignable
receivable, and MRV cost paid from escrow convert "outcome finance for people who
already have money" into outcome finance.

**The value proposition is insurance against restatement, not units per dollar.** A unit
that survives assurance is worth more than three units that get restated.

---

## 2. Positioning

Ecorestore Network is **dMRV infrastructure a registry or standard could adopt.** Not a
parallel registry.

The claim "no central certifier required" is **deleted** and must not return. It is
precisely the positioning that got Toucan killed when Verra banned tokenizing retired
credits in May 2023. Every survivor in this space works *with* registries. Verra runs on
Hedera Guardian as of 2025; the Guardian integration (`GUARDIAN.md`) is the concrete
surface that makes the claim credible rather than aspirational.

### Market sizing is cited honestly

Bundled biodiversity-credit CAGR figures are **not** used. They mix compliance offsets
and mitigation banking, and an informed reader discounts anything that quotes them. The
honest numbers:

* **UK BNG — £93M across 312 registered gain sites in 2026.** Statutory credits, the
  last-resort backstop, took £426,100 in FY2025–26.
* **EU Roadmap towards Nature Credits**, published July 2025; pilots 2025–27; framework
  targeted around 2027.
* Voluntary biodiversity credit transactions globally: low tens of millions.
* VCM transaction volume fell from ~$2B (2021) to ~$535M (2024).

---

## 3. Primary buyer: corporate sponsors

The purchasing driver is regulatory and assurance pressure, which is what makes spatially
explicit evidence a requirement rather than a nicety:

* **CSRD / ESRS E4** — in-scope EU undertakings face biodiversity and ecosystem
  disclosure requirements including location-specific information for material impacts
  and risks. *Risk, stated plainly: the CSRD scope-and-timing rollback process has been
  narrowing this specific driver. It is a demand signal, not a guarantee.*
* **TNFD** — the LEAP approach is explicitly spatial; *Locate* is step one.
* **SBTN** — science-based targets for nature require baselines and measured change.
* **UK BNG** — statutory 10% uplift with a 30-year maintenance obligation.
* **EU Nature Restoration Regulation** — member-state targets.

The product must serve an approval workflow, an audit trail, a reproducible verification
record and a data export. It is not a donation application.

### The framing correction

Rigorous verification issues *fewer units per dollar of restoration* than lax
verification. A budget-constrained buyer comparing a settled 2.2 ha against a
certifier-blessed 42 ha at the same price buys the certifier's — unless assurance and
litigation risk are priced.

So the comparison presented is never units-per-dollar. It is **expected write-down**. The
interface carries a named assurance-adjusted view, generated from the result rather than
written by hand — on the current demonstration data it reads *"2.2271 ha defensible vs. 42
ha at risk"* for the synthetic scenario and *"0 ha defensible vs. 42 ha at risk"* for the
two that settle nothing. Restatement is the thing a sustainability lead is personally
exposed to.

---

## 4. Supply side

Restoration operators, conservation NGOs, land trusts, Indigenous-led stewardship
organisations, and landowners who hold the parcel and do the work.

They need transparent milestone definitions, predictable payment, working capital
(`ARC.md` §4), and a verification system that does not require them to buy a satellite
programme to get paid.

**This is a design constraint, not a sentiment.** An instrument that requires the
restorer to self-finance three years of operations plus their own MRV selects for
well-capitalised operators, easy-to-measure biomes and large parcels — the segments where
restoration finance already flows. That mechanism reallocates existing restoration toward
better-verified operators rather than increasing the amount of restoration. The working
capital, benefit-share and encumbrance mechanisms exist to prevent that outcome.

---

## 5. Sponsor stack

ETHGlobal allows up to **3 partner prizes** at submission, and a partner with multiple
tracks counts as one slot while remaining eligible for all of its tracks. The strategy is
three partners with deep multi-track fit, not three partners with one track each.
*Verify against the ETHOnline 2026 submission page before finalising.*

| Partner | Slot | Tracks | Fit |
|---|---|---|---|
| **Hedera** | 1 | Tokenization of Anything; AI & Agentic Payments (x402) | Tokenization is strengthened by the ATS lifecycle and the ERC-1643 evidence binding. x402 is weakened by its demotion (`X402.md`). |
| **Arc** | 1 | Testnet→Mainnet; DeFi/Onchain Finance; Agentic Economy | Strengthened. The assignable receivable and mobilisation tranche make the DeFi track substantially more interesting than a payment schedule. |
| **The Graph** | 1 | AI Tooling; Composable Graph Products | Strengthened. Verification run count is part of project history, so the Subgraph is load-bearing for the Auditor rather than decorative. |
| **Privy** | 0 | (Best B2B Financial Product) | Built for product reasons (§6), not claimed. Swap in for The Graph only if the treasury flow becomes the demo centrepiece and the Subgraph ends up shallow. Decide at M6. |

**The honest trade on x402.** Demoting it costs addressable prize money on the Hedera AI
& Agentic Payments track. It is demoted anyway, because per-request metering conflicts
with pre-registration and because the schedule does not accommodate it alongside the Arc
deadline. If it returns, it returns **with** pre-registration coupling, not instead of it.

**Declined:** Chainlink CRE (slot scarcity only — strongest post-hackathon candidate),
World, Ledger, ENS, 1inch/Uniswap, Bazantic.

**Selection principle.** Do not add technology to claim a prize. A partner integration
must strengthen the core thesis.

---

## 6. Treasury controls and pooled deeds

*Both are designed, neither is built.*

**Privy — designed.** A corporate sponsor cannot have one person unilaterally moving
funds. The funding path would use policies, key quorums and intents: a sustainability lead
proposes a deed, finance approves under a spend policy, disbursement requires quorum
signing, and the approval trail becomes part of the audit record. Intended for product
reasons; see §5 on whether it claims a submission slot. No integration exists and it sits
in no milestone.

**Pooled deeds — designed, and the contract is not ready for them.** The intent is that
individual contributions aggregate into a single deed against one parcel, sharing the same
contracts and verification, with contributors holding a proportional claim and receiving
the identical evidence bundle.

`fundDeed()` already accepts USDC from any address, but it increments a single `funded`
scalar and stores no per-contributor balance, while `reclaim()` returns the entire
unreleased amount to the one address that called `createDeed()`. **A second contributor to
a deed today has no claim and can have their principal reclaimed by the sponsor.** Until
per-contributor accounting exists, pooled funding must not be offered — either restrict
`fundDeed()` to the sponsor or build the accounting first.

---

## 7. The central rule

The target is not feature count. It is a technically credible, publicly developed system
in which **rigorous remote sensing, explicit uncertainty, pre-registered additionality,
deterministic verification, programmable settlement and auditable restoration outcomes
form one working loop** — where the number the pipeline produces is the number that
releases the money, and where the buyer can re-derive that number themselves.

> Evidence produces the result.
> The methodology governs verification.
> The contract governs money.
> The index provides history.
> AI explains and orchestrates.
>
> No component silently becomes the authority for another component's responsibility.

**Does this incentivise restoration, or only make existing restoration finance more
auditable?**

With pre-registration, working capital and the encumbrance registry in the design, it
incentivises restoration — and specifically it incentivises restoration by operators who
currently cannot access outcome finance at all. Without them, it makes existing
restoration finance harder to lie about: worth doing, but a smaller claim.
