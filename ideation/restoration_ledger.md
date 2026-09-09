> **HISTORICAL.** Early technical guidance, merged into Idea 0.2 and superseded by
> `proposals/idea-0.3.md`.

# Restoration Ledger — ETHOnline Technical Guidance

## 1. Build Objective

Build a functional prototype of **Restoration Ledger**, a programmable restoration-finance system that connects environmental funding to evidence-based milestone verification and automated settlement.

The prototype must demonstrate one complete lifecycle:

**Fund a restoration project → submit restoration evidence → evaluate the evidence → verify or reject the milestone → release funds when verified → generate a verified restoration achievement.**

The project should feel like a working product rather than a collection of sponsor demos. Technicality, originality, practicality, usability, and wow factor are the stated finalist judging dimensions, so the implementation should prioritize a coherent end-to-end workflow.

## 2. Scope

Implement one fictional restoration project with one funding campaign and a small number of milestones.

Recommended demonstration scenario:

**Fraser Riparian Recovery**

Target:

**500 native plants established**

Funding:

**500 USDC**

The project should contain:

* project identity and location;
* restoration target;
* funding amount;
* milestone requirements;
* submitted evidence;
* verification status;
* settlement status;
* participant achievement.

Do not attempt to build a complete environmental MRV platform, carbon-credit system, NFT ecosystem, DAO, generalized marketplace, or multi-chain application.

## 3. Sponsor Integrations

Use exactly **three ETHOnline sponsor integrations**:

### Arc — Financial Settlement

Arc provides the restoration funding mechanism. A smart contract should hold the USDC associated with the Restoration Deed and release milestone funds after successful verification.

The contract should implement only the functions required by the prototype:

```text
createProject()
createDeed()
fundDeed()
submitMilestone()
verifyMilestone()
releasePayment()
```

The objective is to demonstrate programmable restoration finance and an agent-triggered settlement workflow.

Arc has an additional post-hackathon requirement for relevant prize eligibility: work developed on testnet must subsequently be deployed to Arc mainnet by the stated deadline.

### The Graph — Project State and History

Create a minimal Subgraph representing the project's onchain lifecycle.

Core entities:

```text
Project
Deed
Contribution
Milestone
Evidence
Verification
Payment
Achievement
```

The application should use Graph queries to reconstruct project state and retrieve historical events. The Restoration Auditor must use this indexed data as an actual input to its verification process. This makes the Graph integration functional and load-bearing rather than decorative.

### Privy — Participant Wallet

Privy provides the participant's wallet/account experience. The user should be able to enter the application, obtain the required wallet functionality, and fund the Restoration Deed through the interface.

The blockchain experience should remain largely invisible to the user.

No fourth sponsor integration should be added. ETHGlobal permits a maximum of three sponsor companies and explicitly recommends prioritizing high-quality integrations over forcing multiple sponsor technologies into a project.

## 4. Restoration Auditor

Use one focused intelligent component rather than a multi-agent architecture.

The **Restoration Auditor** receives:

```text
project requirements
claimed restoration quantity
submitted evidence
previous project events
verification thresholds
```

It queries the indexed project history through The Graph and evaluates the submitted claim.

Demonstration case:

```text
Required:       500 plants
Claimed:        500 plants
Evidence:       463 plants
Threshold:      495 plants

Result: REVIEW_REQUIRED
```

The application then accepts additional evidence:

```text
Updated evidence: 498 plants

Result: VERIFIED
```

A successful verification should trigger the settlement workflow.

The agent output should be structured so the result can be consumed programmatically:

```json
{
  "status": "VERIFIED",
  "claimed": 500,
  "verified": 498,
  "variance": 2,
  "reason": "Evidence satisfies the milestone threshold."
}
```

## 5. Evidence Model

Keep environmental evidence simple and structured. Use a controlled demonstration dataset rather than building complex computer vision or remote-sensing infrastructure.

Example fields:

```text
project_id
milestone_id
quantity
latitude
longitude
timestamp
observer
photo_hash
document_hash
```

Actual files remain off-chain. Relevant hashes and project events can be associated with the blockchain record.

The prototype should demonstrate the relationship:

**claim → evidence → verification → payment**

## 6. User Interface

Build a small web application with five primary views:

**Project** — restoration target, location, funding, and status.

**Restoration Deed** — participant contribution and project commitment.

**Evidence** — submitted evidence and verification status.

**Audit** — discrepancy analysis and Restoration Auditor result.

**Restoration Passport** — verified contributions and achievements.

A simple map may display the restoration project and its verification status. GIS functionality should remain visual and contextual rather than becoming a separate subsystem.

## 7. Gamification

Implement only three gamification features:

**Restoration Passport** — records verified restoration contributions and achievements.

**Community Restoration Challenge** — aggregates verified project outcomes toward a target.

**Proof of Stewardship** — achievement generated following a verified restoration milestone.

Gamification must depend on verified project state. A user earns progress because an underlying restoration event has passed the verification process.

## 8. Development Sequence

Use a vertical-slice development process with frequent public commits.

1. Build the frontend and core data structures.
2. Implement and deploy the Arc contract.
3. Integrate Privy and complete the funding flow.
4. Build the The Graph Subgraph and live queries.
5. Implement the Restoration Auditor.
6. Connect verification to Arc settlement.
7. Add the passport, challenge, and achievement screens.
8. Polish the complete demonstration path.

ETHGlobal requires projects to be built publicly with a meaningful commit history, and AI coding tools are permitted when their use is appropriately attributed.

Keep commits understandable and incremental so the repository clearly demonstrates development during the event.

## 9. Final Demonstration

The final application should support this uninterrupted sequence:

```text
Create Restoration Deed
        ↓
Fund with Privy
        ↓
Arc escrow receives funds
        ↓
Submit restoration claim
        ↓
The Graph provides project history
        ↓
Restoration Auditor detects discrepancy
        ↓
Submit additional evidence
        ↓
Milestone becomes VERIFIED
        ↓
Agent initiates Arc payment
        ↓
Payment recorded
        ↓
Achievement unlocked
        ↓
Community restoration progress updated
```

The required ETHOnline demo video must be **2–4 minutes**, at least **720p**, narrated with clear spoken audio, and contain no music. The demonstration should emphasize the functioning product and technical workflow rather than an extended presentation of the concept.

The target is not feature quantity. The target is a technically credible, publicly developed prototype in which **programmable money, indexed blockchain history, intelligent verification, and verified ecological outcomes form one functioning system**.
