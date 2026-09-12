/**
 * Ecorestore Network — M5 Subgraph Mappings
 *
 * Translates RestorationDeed.sol's actual emitted events (verified against
 * the compiled ABI, not assumed — see docs/GRAPH.md) into the entities
 * defined in schema.graphql. This file computes nothing scientific and
 * nothing financial: every field is copied directly from an event. No
 * entity here fabricates evidence, a Guardian credential, or a
 * scientific/settlement quantity — every settlement-related number already
 * exists on-chain by the time this mapping runs, produced by
 * RestorationDeed.sol itself (M3/M3.1), which in turn only ever consumes
 * an already-computed M1/M2 result (M4).
 *
 * NOTE on methodologyVersion: it is not emitted by any event. An eth_call
 * to getDeed() to read it from contract storage was implemented and
 * tested, and reproducibly failed — graph-node v0.45.0's Alloy-based
 * Ethereum client sends both `data` and `input` fields in every eth_call,
 * which Hardhat's JSON-RPC server rejects as a duplicate key
 * (NomicFoundation/hardhat#4603, closed by the Hardhat team as "not
 * planned" — this will not be fixed upstream). No eth_call from any
 * mapping can succeed against this project's local Hardhat node with this
 * graph-node version. methodologyVersion is therefore NOT indexed here;
 * the Auditor correlates it off-chain from the M2 GuardianCredential via
 * verificationId instead. See docs/GRAPH.md for the full write-up.
 */

import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  DeedCancelled,
  DeedCreated,
  DeedFunded,
  RefundExecuted,
  SettlementExecuted,
  VerificationSubmitted,
} from "../generated/RestorationDeed/RestorationDeed";
import {
  Cancellation,
  Funding,
  Project,
  Refund,
  RestorationDeed,
  Settlement,
  Verification,
} from "../generated/schema";

function eventLogId(txHash: Bytes, logIndex: BigInt): Bytes {
  return txHash.concatI32(logIndex.toI32());
}

export function handleDeedCreated(event: DeedCreated): void {
  let deedId = event.params.deedId;
  let entity = new RestorationDeed(deedId.toString());

  // Fields present directly on the event (verified against the ABI).
  entity.deedId = deedId;
  entity.projectId = event.params.projectId;
  entity.parcelH3Root = event.params.parcelH3Root;
  entity.sponsor = event.params.sponsor;
  entity.beneficiary = event.params.beneficiary;
  entity.authorizedVerifier = event.params.authorizedVerifier;
  entity.escrowAmount = event.params.escrowAmount;
  entity.unitPriceUSDC = event.params.unitPriceUSDC;
  entity.quantityDecimals = event.params.quantityDecimals;

  entity.fundedAmount = BigInt.zero();
  entity.verificationId = null;
  entity.settledQuantityScaled = null;
  entity.settlementAmount = null;
  entity.releasedAmount = null;
  entity.status = "CREATED";

  entity.createdAt = event.block.timestamp;
  entity.createdBlock = event.block.number;
  entity.createdTxHash = event.transaction.hash;
  entity.updatedAt = event.block.timestamp;
  entity.updatedBlock = event.block.number;
  entity.updatedTxHash = event.transaction.hash;

  // Resolve (or create) the Project this deed belongs to. Two deeds
  // sharing the same projectId (e.g. a resubmission after a refund)
  // resolve to the same Project entity — see docs/GRAPH.md §7.
  let project = Project.load(event.params.projectId);
  if (project == null) {
    project = new Project(event.params.projectId);
    project.parcelH3Root = event.params.parcelH3Root;
    project.createdAt = event.block.timestamp;
    project.createdBlock = event.block.number;
    project.createdTxHash = event.transaction.hash;
    project.save();
  }
  entity.project = project.id;

  entity.save();
}

export function handleDeedFunded(event: DeedFunded): void {
  let deed = RestorationDeed.load(event.params.deedId.toString());
  if (deed == null) {
    return;
  }

  let funding = new Funding(eventLogId(event.transaction.hash, event.logIndex));
  funding.deed = deed.id;
  funding.sponsor = event.params.sponsor;
  funding.amount = event.params.amount;
  funding.timestamp = event.block.timestamp;
  funding.blockNumber = event.block.number;
  funding.transactionHash = event.transaction.hash;
  funding.logIndex = event.logIndex;
  funding.save();

  deed.fundedAmount = event.params.amount;
  deed.status = "FUNDED";
  deed.updatedAt = event.block.timestamp;
  deed.updatedBlock = event.block.number;
  deed.updatedTxHash = event.transaction.hash;
  deed.save();
}

export function handleDeedCancelled(event: DeedCancelled): void {
  let deed = RestorationDeed.load(event.params.deedId.toString());
  if (deed == null) {
    return;
  }

  let cancellation = new Cancellation(eventLogId(event.transaction.hash, event.logIndex));
  cancellation.deed = deed.id;
  cancellation.timestamp = event.block.timestamp;
  cancellation.blockNumber = event.block.number;
  cancellation.transactionHash = event.transaction.hash;
  cancellation.logIndex = event.logIndex;
  cancellation.save();

  deed.status = "CANCELLED";
  deed.updatedAt = event.block.timestamp;
  deed.updatedBlock = event.block.number;
  deed.updatedTxHash = event.transaction.hash;
  deed.save();
}

export function handleVerificationSubmitted(event: VerificationSubmitted): void {
  let deed = RestorationDeed.load(event.params.deedId.toString());
  if (deed == null) {
    return;
  }

  // verificationId is the entity's id: it is globally unique and
  // replay-protected contract-wide (RestorationDeed.consumedVerificationIds),
  // so it is a genuine canonical domain identity, not just a per-event key.
  let verification = new Verification(event.params.verificationId);
  verification.deed = deed.id;
  verification.verificationId = event.params.verificationId;
  verification.financiallyEligible = event.params.financiallyEligible;
  verification.settledQuantityScaled = event.params.settledQuantityScaled;
  verification.settlementAmount = event.params.settlementAmount;
  verification.timestamp = event.block.timestamp;
  verification.blockNumber = event.block.number;
  verification.transactionHash = event.transaction.hash;
  verification.logIndex = event.logIndex;
  verification.save();

  deed.verificationId = event.params.verificationId;
  if (event.params.financiallyEligible) {
    deed.settledQuantityScaled = event.params.settledQuantityScaled;
    deed.settlementAmount = event.params.settlementAmount;
    deed.status = "VERIFIED";
  } else {
    deed.status = "FAILED";
  }
  deed.updatedAt = event.block.timestamp;
  deed.updatedBlock = event.block.number;
  deed.updatedTxHash = event.transaction.hash;
  deed.save();
}

export function handleSettlementExecuted(event: SettlementExecuted): void {
  let deed = RestorationDeed.load(event.params.deedId.toString());
  if (deed == null) {
    return;
  }

  let settlement = new Settlement(eventLogId(event.transaction.hash, event.logIndex));
  settlement.deed = deed.id;
  settlement.verification = event.params.verificationId;
  settlement.beneficiary = event.params.beneficiary;
  settlement.settlementAmount = event.params.settlementAmount;
  settlement.refundedRemainder = event.params.refundedRemainder;
  settlement.timestamp = event.block.timestamp;
  settlement.blockNumber = event.block.number;
  settlement.transactionHash = event.transaction.hash;
  settlement.logIndex = event.logIndex;
  settlement.save();

  deed.releasedAmount = event.params.settlementAmount;
  deed.status = "SETTLED";
  deed.updatedAt = event.block.timestamp;
  deed.updatedBlock = event.block.number;
  deed.updatedTxHash = event.transaction.hash;
  deed.save();
}

export function handleRefundExecuted(event: RefundExecuted): void {
  let deed = RestorationDeed.load(event.params.deedId.toString());
  if (deed == null) {
    return;
  }

  let refund = new Refund(eventLogId(event.transaction.hash, event.logIndex));
  refund.deed = deed.id;
  refund.sponsor = event.params.sponsor;
  refund.amount = event.params.amount;
  refund.timestamp = event.block.timestamp;
  refund.blockNumber = event.block.number;
  refund.transactionHash = event.transaction.hash;
  refund.logIndex = event.logIndex;
  refund.save();

  deed.status = "REFUNDED";
  deed.updatedAt = event.block.timestamp;
  deed.updatedBlock = event.block.number;
  deed.updatedTxHash = event.transaction.hash;
  deed.save();
}
