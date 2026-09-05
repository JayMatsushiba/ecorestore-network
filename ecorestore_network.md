# Ecorestore Network - Decentralized Autonomous Organization

## 1. Objective 

The objective is to build a protocol for **outcome-verified ecological restoration** — where funding is released at key stages of restoration process when measurable, transparent conditions are met. For example, looking at satellite imagery and drone footage to identify condition before and after restoration efforts to confirm effectiveness and deployment of resources towards restoration. 

I've spent years building the environmental-value layers this depends on: blue carbon maps of UK waters, Marine Net Gain estimates, island-wide conservation prioritization, and species distribution models from satellite and remote-sensing data. The recurring problem across all of it is *trust* — carbon credits and restoration offsets are issued up front, verified by central certifiers, and easy to game. Smart contracts replace that trust with verifiable outcomes.

## 2. Implementation

Three parts:

1. **Discovery** — a spatial pipeline scores land parcels for restoration *potential* (degraded land adjacent to intact habitat, low biomass, high ecological value) and publishes candidate plots on-chain as restoration bounties.　In addition to the restoration bounties themselves, the estimated increased value of the plot in the restored state due to reduced maintenance costs, alternative income streams (ex. tourism), and from ecological services (ex. carbon sequestration) is included in the pipeline.  
2. **Funding** — a funder locks payment into an escrow contract against a specific plot and a target state, e.g. "recover native vegetation index to X" or "maintain undisturbed natural state for N months."
3. **Settlement** — satellite imagery used for verifying the state of the parcel. A classification model re-assesses the plot over time; when the contract's terms are met, funds release to the restorer automatically, with each imagery snapshot pinned (IPFS/Filecoin) as tamper-proof evidence.

The result is a marketplace where nature restoration becomes a verifiable, results-based, tradable instrument — no central certifier required.

## 3. Datasets

Global 100m Projections of Biodiversity Intactness for the years 2017-2025 (v1.1)
https://source.coop/vizzuality/biodiversity-intactness-100m-v1-1 
