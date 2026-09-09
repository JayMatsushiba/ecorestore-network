/**
 * TypeScript client for RestorationDeed: ABI, enum mappings, and calldata
 * encoding from a canonical VerificationResult.
 *
 * The bridge from the engine to the contract is deliberately narrow. Only the
 * result hash, the run index, the status, the lower bound and the claim cross
 * it — the contract enforces its own bounds and never sees a point estimate.
 */
import { createPublicClient, defineChain, encodeFunctionData, http, parseAbi, type Address, type Hex } from 'viem';
import { keccakOf } from '../verification/canonical.js';
import type { AnalysisPlan, VerificationResult, VerificationStatus } from '../verification/models.js';

export const ARC_TESTNET = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.io'] } },
  blockExplorers: { default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' } },
  testnet: true,
});

export const RESTORATION_DEED_ABI = parseAbi([
  'struct ProjectInput { bytes32 h3Root; bytes32 geometryHash; bytes32 baselineRef; bytes32 metricId; bytes32 tenureAttestationHash; uint8 tenureType; bytes32 encumbranceHash; address restorer; address steward; }',
  'struct MilestoneTerms { uint8 mType; uint256 amount; uint256 thresholdQuantity; uint64 notBefore; uint64 deadline; }',
  'struct DeedTerms { uint256 projectId; address verifier; bytes32 analysisPlanHash; bytes32 methodologyVersion; uint16 confidenceBps; uint16 benefitShareBps; uint16 retentionBps; address bufferPool; }',
  'struct Milestone { MilestoneTerms terms; uint8 state; bytes32 resultHash; uint32 runIndex; uint256 verifiedQuantity; address assignee; uint256 releasedGross; }',
  'struct Deed { DeedTerms terms; address sponsor; uint256 totalAmount; uint256 funded; uint256 releasedNet; uint256 retained; uint256 reclaimed; uint32 runCount; uint8 milestoneCount; bool retentionSettled; }',
  'function getMilestone(uint256 deedId, uint8 milestoneId) view returns (Milestone)',
  'function getDeed(uint256 deedId) view returns (Deed)',
  'function createProject(ProjectInput input) returns (uint256 projectId)',
  'function createDeed(DeedTerms terms, MilestoneTerms[] schedule) returns (uint256 deedId)',
  'function fundDeed(uint256 deedId, uint256 amount)',
  'function submitEvidence(uint256 deedId, uint8 milestoneId, uint8 tier, bool simulated, string cid)',
  'function recordVerificationRun(uint256 deedId, bytes32 analysisPlanHash) returns (uint32 runIndex)',
  'function verifyMilestone(uint256 deedId, uint8 milestoneId, uint32 runIndex, bytes32 resultHash, bytes32 analysisPlanHash, uint8 status, uint256 lowerBoundQuantity, uint256 claimedQuantity)',
  'function drawMobilisation(uint256 deedId, uint8 milestoneId)',
  'function releaseTranche(uint256 deedId, uint8 milestoneId)',
  'function assignTranche(uint256 deedId, uint8 milestoneId, address assignee)',
  'function withholdRetention(uint256 deedId, uint8 milestoneId)',
  'function releaseRetention(uint256 deedId)',
  'function reclaim(uint256 deedId, uint8 milestoneId)',
  'function availableEscrow(uint256 deedId) view returns (uint256)',
  'function resultHashUsed(bytes32) view returns (bool)',
  'event ProjectCreated(uint256 indexed projectId, bytes32 h3Root, bytes32 geometryHash, address restorer, address steward, uint8 tenureType)',
  'event DeedCreated(uint256 indexed deedId, uint256 indexed projectId, address sponsor, address verifier, bytes32 analysisPlanHash, uint256 totalAmount)',
  'event VerificationRunRecorded(uint256 indexed deedId, uint32 runIndex, bytes32 analysisPlanHash, address verifier)',
  'event MilestoneVerified(uint256 indexed deedId, uint8 indexed milestoneId, uint32 runIndex, bytes32 resultHash, uint8 status, uint256 lowerBoundQuantity, uint256 claimedQuantity, uint8 newState)',
  'event TrancheReleased(uint256 indexed deedId, uint8 indexed milestoneId, uint256 gross, uint256 retention, uint256 benefitShare, address payee, uint256 payeeAmount)',
]);

/** Mirrors `enum VerdictStatus` in RestorationDeed.sol, in declaration order. */
export const VERDICT_STATUS_INDEX: Record<VerificationStatus, number> = {
  VERIFIED: 0,
  PARTIAL: 1,
  NOT_ADDITIONAL: 2,
  INSUFFICIENT_EVIDENCE: 3,
  GATE_FAILED: 4,
  INVALID_RESULT: 5,
};

export const MILESTONE_TYPE = { MOBILISATION: 0, ESTABLISHMENT: 1, PERSISTENCE: 2 } as const;

/** Metric units are committed on-chain with 4 decimals (0.0001 ha). */
export const QUANTITY_SCALE = 10_000n;

export function toQuantity(ha: number): bigint {
  if (!Number.isFinite(ha)) throw new Error('quantity must be finite');
  return BigInt(Math.round(Math.max(0, ha) * Number(QUANTITY_SCALE)));
}

export function planHashOf(plan: AnalysisPlan): Hex {
  return keccakOf(plan);
}

export interface VerifyMilestoneArgs {
  deedId: bigint;
  milestoneId: number;
  runIndex: number;
  resultHash: Hex;
  analysisPlanHash: Hex;
  status: number;
  lowerBoundQuantity: bigint;
  claimedQuantity: bigint;
}

/**
 * The only path from a result to the contract. It refuses to submit a result
 * whose run index or plan hash disagree with the deed it targets.
 */
export function verifyMilestoneArgs(result: VerificationResult, deedId: bigint, milestoneId: number, deedPlanHash: Hex): VerifyMilestoneArgs {
  if (result.analysisPlanHash !== deedPlanHash) {
    throw new Error(`result was computed under plan ${result.analysisPlanHash}, deed commits to ${deedPlanHash}`);
  }
  if (!Number.isInteger(result.runIndex) || result.runIndex < 1) throw new Error('result must cite a recorded run index');
  const { resultHash, ...rest } = result;
  if (keccakOf(rest) !== resultHash) throw new Error('result hash does not match result content');
  return {
    deedId,
    milestoneId,
    runIndex: result.runIndex,
    resultHash,
    analysisPlanHash: result.analysisPlanHash,
    status: VERDICT_STATUS_INDEX[result.verificationStatus],
    lowerBoundQuantity: toQuantity(result.lowerBound),
    claimedQuantity: toQuantity(result.claimedQuantity),
  };
}

export function encodeVerifyMilestone(a: VerifyMilestoneArgs): Hex {
  return encodeFunctionData({
    abi: RESTORATION_DEED_ABI,
    functionName: 'verifyMilestone',
    args: [a.deedId, a.milestoneId, a.runIndex, a.resultHash, a.analysisPlanHash, a.status, a.lowerBoundQuantity, a.claimedQuantity],
  });
}

export function encodeRecordRun(deedId: bigint, analysisPlanHash: Hex): Hex {
  return encodeFunctionData({ abi: RESTORATION_DEED_ABI, functionName: 'recordVerificationRun', args: [deedId, analysisPlanHash] });
}

export function encodeReleaseTranche(deedId: bigint, milestoneId: number): Hex {
  return encodeFunctionData({ abi: RESTORATION_DEED_ABI, functionName: 'releaseTranche', args: [deedId, milestoneId] });
}

export function arcTestnetClient(rpcUrl = ARC_TESTNET.rpcUrls.default.http[0]) {
  return createPublicClient({ chain: ARC_TESTNET, transport: http(rpcUrl) });
}

export type { Address };
