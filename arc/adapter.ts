/**
 * Ecorestore Network — Arc Adapter (M3)
 *
 * The narrow integration boundary between the rest of the application and
 * the deployed RestorationDeed contract (M3 prompt §19). Isolates ABI
 * details, contract address configuration, and raw ethers.js calls so
 * verification/ and guardian/ never need to know Arc exists, and so a
 * future caller (a demo script, or M6's UI) has one clean surface to call
 * instead of hand-rolling contract calls.
 *
 * TEST COVERAGE NOTE: this class is a thin wrapper — every method is a
 * direct pass-through to the identically-named RestorationDeed function
 * using the same argument shapes `contracts/tests/*.test.cjs` already
 * exercises directly against the contract via Hardhat's own ethers
 * instance. Those tests are what actually prove RestorationDeed's
 * behavior; this file does not duplicate them with a second live-network
 * test harness (which would require standing up a separate JSON-RPC
 * connection to a Hardhat node from the vitest/ESM side of the repo — a
 * meaningful addition of moving parts for a hackathon-scope milestone).
 * `arc/tests/` covers the pure, deterministic logic in identifiers.ts and
 * payload.ts instead.
 */

import { Contract, type ContractTransactionResponse, type Provider, type Signer } from "ethers";
import type { OnChainVerificationAuthorization } from "./payload.js";

/** Mirrors RestorationDeed.sol's `DeedStatus` enum. Order matters — keep in sync with the contract. */
export const DEED_STATUS_NAMES = [
  "CREATED",
  "FUNDED",
  "VERIFIED",
  "SETTLED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
] as const;

export type DeedStatusName = (typeof DEED_STATUS_NAMES)[number];

export interface OnChainDeed {
  readonly projectId: string;
  readonly parcelH3Root: string;
  readonly methodologyVersion: string;
  readonly sponsor: string;
  readonly beneficiary: string;
  readonly authorizedVerifier: string;
  readonly escrowAmount: bigint;
  readonly unitPriceUSDC: bigint;
  readonly quantityDecimals: number;
  readonly fundedAmount: bigint;
  readonly verificationId: string;
  readonly settledQuantityScaled: bigint;
  readonly settlementAmount: bigint;
  readonly releasedAmount: bigint;
  readonly status: DeedStatusName;
}

/** The minimal RestorationDeed ABI this adapter needs — kept in sync with contracts/RestorationDeed.sol by hand, since M3 does not wire up cross-toolchain artifact loading (see file header). */
export const RESTORATION_DEED_ABI = [
  "function createDeed(bytes32 projectId, bytes32 parcelH3Root, bytes32 methodologyVersion, address beneficiary, address authorizedVerifier, uint256 escrowAmount, uint256 unitPriceUSDC, uint8 quantityDecimals) external returns (uint256 deedId)",
  "function cancelDeed(uint256 deedId) external",
  "function fundDeed(uint256 deedId) external",
  "function submitVerification(uint256 deedId, (bytes32 verificationId, bytes32 projectId, bytes32 parcelH3Root, bytes32 methodologyVersion, bytes32 evidenceHash, uint256 settledQuantityScaled, bool financiallyEligible) auth) external",
  "function settleDeed(uint256 deedId) external",
  "function refundDeed(uint256 deedId) external",
  "function getDeed(uint256 deedId) external view returns (tuple(bytes32 projectId, bytes32 parcelH3Root, bytes32 methodologyVersion, address sponsor, address beneficiary, address authorizedVerifier, uint256 escrowAmount, uint256 unitPriceUSDC, uint8 quantityDecimals, uint256 fundedAmount, bytes32 verificationId, uint256 settledQuantityScaled, uint256 settlementAmount, uint256 releasedAmount, uint8 status))",
  "function getDeedStatus(uint256 deedId) external view returns (uint8)",
  "function consumedVerificationIds(bytes32 verificationId) external view returns (bool)",
  "event DeedCreated(uint256 indexed deedId, bytes32 indexed projectId, bytes32 parcelH3Root, address indexed sponsor, address beneficiary, address authorizedVerifier, uint256 escrowAmount, uint256 unitPriceUSDC, uint8 quantityDecimals)",
  "event DeedFunded(uint256 indexed deedId, address indexed sponsor, uint256 amount)",
  "event DeedCancelled(uint256 indexed deedId)",
  "event VerificationSubmitted(uint256 indexed deedId, bytes32 indexed verificationId, bool financiallyEligible, uint256 settledQuantityScaled, uint256 settlementAmount)",
  "event SettlementExecuted(uint256 indexed deedId, bytes32 indexed verificationId, address indexed beneficiary, uint256 settlementAmount, uint256 refundedRemainder)",
  "event RefundExecuted(uint256 indexed deedId, address indexed sponsor, uint256 amount)",
] as const;

function parseDeed(raw: unknown): OnChainDeed {
  const d = raw as Record<string, unknown>;
  const statusIndex = Number(d.status as bigint | number);
  const statusName = DEED_STATUS_NAMES[statusIndex];
  if (!statusName) {
    throw new Error(`unrecognized on-chain DeedStatus index: ${statusIndex}`);
  }
  return {
    projectId: d.projectId as string,
    parcelH3Root: d.parcelH3Root as string,
    methodologyVersion: d.methodologyVersion as string,
    sponsor: d.sponsor as string,
    beneficiary: d.beneficiary as string,
    authorizedVerifier: d.authorizedVerifier as string,
    escrowAmount: d.escrowAmount as bigint,
    unitPriceUSDC: d.unitPriceUSDC as bigint,
    quantityDecimals: Number(d.quantityDecimals as bigint | number),
    fundedAmount: d.fundedAmount as bigint,
    verificationId: d.verificationId as string,
    settledQuantityScaled: d.settledQuantityScaled as bigint,
    settlementAmount: d.settlementAmount as bigint,
    releasedAmount: d.releasedAmount as bigint,
    status: statusName,
  };
}

export interface CreateDeedParams {
  readonly projectId: string;
  readonly parcelH3Root: string;
  readonly methodologyVersion: string;
  readonly beneficiary: string;
  readonly authorizedVerifier: string;
  readonly escrowAmount: bigint;
  readonly unitPriceUSDC: bigint;
  readonly quantityDecimals: number;
}

/**
 * Thin wrapper around a deployed RestorationDeed contract. Construct one
 * per (contract address, signer) pair — e.g. one instance per role
 * (sponsor, verifier) in a demo script, each with its own signer, since
 * on-chain authorization is per-caller-address.
 */
export class ArcAdapter {
  private readonly contract: Contract;

  constructor(contractAddress: string, signerOrProvider: Signer | Provider) {
    this.contract = new Contract(contractAddress, RESTORATION_DEED_ABI, signerOrProvider);
  }

  async createDeed(params: CreateDeedParams): Promise<ContractTransactionResponse> {
    return this.contract.createDeed!(
      params.projectId,
      params.parcelH3Root,
      params.methodologyVersion,
      params.beneficiary,
      params.authorizedVerifier,
      params.escrowAmount,
      params.unitPriceUSDC,
      params.quantityDecimals,
    ) as Promise<ContractTransactionResponse>;
  }

  async cancelDeed(deedId: bigint | number): Promise<ContractTransactionResponse> {
    return this.contract.cancelDeed!(deedId) as Promise<ContractTransactionResponse>;
  }

  async fundDeed(deedId: bigint | number): Promise<ContractTransactionResponse> {
    return this.contract.fundDeed!(deedId) as Promise<ContractTransactionResponse>;
  }

  async submitVerification(
    deedId: bigint | number,
    auth: OnChainVerificationAuthorization,
  ): Promise<ContractTransactionResponse> {
    return this.contract.submitVerification!(deedId, {
      verificationId: auth.verificationId,
      projectId: auth.projectId,
      parcelH3Root: auth.parcelH3Root,
      methodologyVersion: auth.methodologyVersion,
      evidenceHash: auth.evidenceHash,
      settledQuantityScaled: auth.settledQuantityScaled,
      financiallyEligible: auth.financiallyEligible,
    }) as Promise<ContractTransactionResponse>;
  }

  async settleDeed(deedId: bigint | number): Promise<ContractTransactionResponse> {
    return this.contract.settleDeed!(deedId) as Promise<ContractTransactionResponse>;
  }

  async refundDeed(deedId: bigint | number): Promise<ContractTransactionResponse> {
    return this.contract.refundDeed!(deedId) as Promise<ContractTransactionResponse>;
  }

  async getDeed(deedId: bigint | number): Promise<OnChainDeed> {
    const raw = await this.contract.getDeed!(deedId);
    return parseDeed(raw);
  }

  async getDeedStatus(deedId: bigint | number): Promise<DeedStatusName> {
    const statusIndex = Number(await this.contract.getDeedStatus!(deedId));
    const statusName = DEED_STATUS_NAMES[statusIndex];
    if (!statusName) {
      throw new Error(`unrecognized on-chain DeedStatus index: ${statusIndex}`);
    }
    return statusName;
  }

  async isVerificationConsumed(verificationId: string): Promise<boolean> {
    return this.contract.consumedVerificationIds!(verificationId) as Promise<boolean>;
  }
}
