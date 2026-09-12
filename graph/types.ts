/**
 * Ecorestore Network — Graph Provider Types (M5)
 *
 * Plain TypeScript mirrors of the subgraph's indexed entities
 * (subgraph/schema.graphql). These types describe ONLY what the Graph
 * genuinely indexes from RestorationDeed.sol's events — see
 * docs/GRAPH.md's field-source table. Deliberately absent:
 *
 *  - methodologyVersion on IndexedDeed: not emitted by any event, and an
 *    eth_call to read it from contract storage reproducibly fails against
 *    this project's local Hardhat node (docs/GRAPH.md). Callers that need
 *    it must supply it from the off-chain M1/M2 objects.
 *  - evidenceHash: never emitted or stored on-chain at all.
 *  - Guardian credential contents: M2's domain, not the Graph's.
 *
 * All quantities are decimal strings (not `number`), matching GraphQL's
 * BigInt scalar serialization — callers that need arithmetic should parse
 * with BigInt(), never Number(), to avoid precision loss.
 */

export type DeedStatus = "CREATED" | "FUNDED" | "VERIFIED" | "SETTLED" | "FAILED" | "CANCELLED" | "REFUNDED";

export interface IndexedProject {
  readonly id: string; // projectId (bytes32 hex)
  readonly parcelH3Root: string;
  readonly createdAt: string;
  readonly createdBlock: string;
  readonly createdTxHash: string;
}

export interface IndexedDeed {
  readonly id: string; // deedId as a decimal string
  readonly deedId: string;
  readonly projectId: string;
  readonly parcelH3Root: string;
  readonly sponsor: string;
  readonly beneficiary: string;
  readonly authorizedVerifier: string;
  readonly escrowAmount: string;
  readonly unitPriceUSDC: string;
  readonly quantityDecimals: number;
  readonly fundedAmount: string;
  readonly verificationId: string | null;
  readonly settledQuantityScaled: string | null;
  readonly settlementAmount: string | null;
  readonly releasedAmount: string | null;
  readonly status: DeedStatus;
  readonly createdAt: string;
  readonly createdBlock: string;
  readonly createdTxHash: string;
  readonly updatedAt: string;
  readonly updatedBlock: string;
  readonly updatedTxHash: string;
}

export interface IndexedVerification {
  readonly id: string; // verificationId (bytes32 hex) — canonical, globally unique
  readonly deedId: string;
  readonly verificationId: string;
  readonly financiallyEligible: boolean;
  readonly settledQuantityScaled: string;
  readonly settlementAmount: string;
  readonly timestamp: string;
  readonly blockNumber: string;
  readonly transactionHash: string;
}

export interface IndexedSettlement {
  readonly id: string;
  readonly deedId: string;
  readonly verificationId: string;
  readonly beneficiary: string;
  readonly settlementAmount: string;
  readonly refundedRemainder: string;
  readonly timestamp: string;
  readonly blockNumber: string;
  readonly transactionHash: string;
}

export interface IndexedFunding {
  readonly id: string;
  readonly deedId: string;
  readonly sponsor: string;
  readonly amount: string;
  readonly timestamp: string;
}

export interface IndexedRefund {
  readonly id: string;
  readonly deedId: string;
  readonly sponsor: string;
  readonly amount: string;
  readonly timestamp: string;
}

export interface IndexedCancellation {
  readonly id: string;
  readonly deedId: string;
  readonly timestamp: string;
}

/** The full indexed history for one deed, as the Auditor needs it. */
export interface DeedHistory {
  readonly deed: IndexedDeed;
  readonly verifications: readonly IndexedVerification[];
  readonly settlements: readonly IndexedSettlement[];
  readonly fundings: readonly IndexedFunding[];
  readonly refunds: readonly IndexedRefund[];
  readonly cancellations: readonly IndexedCancellation[];
}
