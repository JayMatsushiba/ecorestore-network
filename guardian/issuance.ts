/**
 * The ATS seam (docs/GUARDIAN.md §7): bind the signed verdict into the outcome
 * token via ERC-1643 `setDocument()` and issue into the vintage partition via
 * ERC-1410 `issueByPartition()`.
 *
 * This module prepares exact, ABI-encoded calldata. It does not broadcast:
 * no Hedera account or ATS deployment is configured in this prototype, and
 * saying otherwise would fabricate an integration. `broadcast: false` is part
 * of the returned object so nothing downstream can mistake preparation for
 * issuance.
 */
import { encodeAbiParameters, encodeFunctionData, keccak256, parseAbi, stringToHex, toBytes, type Address, type Hex } from 'viem';
import { canonicalize, cidV1Raw } from '../verification/canonical.js';
import type { VerificationResult } from '../verification/models.js';
import type { VerdictPresentation } from './adapter.js';

export const ERC1643_ABI = parseAbi(['function setDocument(bytes32 name, string uri, bytes32 documentHash)']);
export const ERC1410_ABI = parseAbi(['function issueByPartition(bytes32 partition, address tokenHolder, uint256 value, bytes data)']);

export const DOCUMENT_NAME = 'ecorestore-verdict-vc-v1';
/** Token amounts carry 4 decimals of the metric unit (0.0001 ha). */
export const QUANTITY_SCALE = 10_000n;

export function vintagePartition(parcelH3Root: Hex, windowStart: string, windowEnd: string): Hex {
  return keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'string' }, { type: 'string' }], [parcelH3Root, windowStart, windowEnd]));
}

export function toScaledQuantity(ha: number): bigint {
  if (!Number.isFinite(ha) || ha < 0) throw new Error(`quantity must be a non-negative finite number, got ${ha}`);
  return BigInt(Math.round(ha * Number(QUANTITY_SCALE)));
}

export interface IssuancePackage {
  broadcast: false;
  reason: string;
  holder: Address;
  partition: Hex;
  vintage: { parcelH3Root: Hex; windowStart: string; windowEnd: string };
  value: bigint;
  valueHa: number;
  document: { name: Hex; nameUtf8: string; uri: string; documentHash: Hex; pinned: false };
  hcs: { topicId: string; sequenceNumber: bigint; note: string };
  calls: Array<{ standard: 'ERC-1643' | 'ERC-1410'; function: string; data: Hex }>;
  guardianDropIn: string;
}

/**
 * Only a result whose status carries a positive settled quantity may be
 * issued. Everything else returns null — there is no forward issuance and no
 * issuance against an unsupported claim.
 */
export function prepareIssuance(result: VerificationResult, presentation: VerdictPresentation, holder: Address): IssuancePackage | null {
  if (!(result.verificationStatus === 'VERIFIED' || result.verificationStatus === 'PARTIAL') || result.settledQuantity <= 0) return null;
  const partition = vintagePartition(result.parcelH3Root, result.window.start, result.window.end);
  const vpBytes = new TextEncoder().encode(canonicalize(presentation));
  const uri = `ipfs://${cidV1Raw(vpBytes)}`;
  const documentHash = keccak256(toBytes(canonicalize(presentation)));
  const name = keccak256(stringToHex(DOCUMENT_NAME));
  const value = toScaledQuantity(result.settledQuantity);
  const hcsTopicId = '';
  const hcsSeq = 0n;
  const data = encodeAbiParameters([{ type: 'bytes32' }, { type: 'string' }, { type: 'uint64' }], [presentation.presentationHash, hcsTopicId, hcsSeq]);
  return {
    broadcast: false,
    reason: 'No ATS deployment or Hedera operator account is configured; calldata is prepared for review, not sent.',
    holder,
    partition,
    vintage: { parcelH3Root: result.parcelH3Root, windowStart: result.window.start, windowEnd: result.window.end },
    value,
    valueHa: result.settledQuantity,
    document: { name, nameUtf8: DOCUMENT_NAME, uri, documentHash, pinned: false },
    hcs: { topicId: hcsTopicId, sequenceNumber: hcsSeq, note: 'HCS topic and sequence are populated by a Guardian policy run; Guardian is not stood up.' },
    calls: [
      { standard: 'ERC-1643', function: 'setDocument(bytes32,string,bytes32)', data: encodeFunctionData({ abi: ERC1643_ABI, functionName: 'setDocument', args: [name, uri, documentHash] }) },
      { standard: 'ERC-1410', function: 'issueByPartition(bytes32,address,uint256,bytes)', data: encodeFunctionData({ abi: ERC1410_ABI, functionName: 'issueByPartition', args: [partition, holder, value, data] }) },
    ],
    guardianDropIn: 'In production the Guardian mintDocumentBlock produces the VP whose hash is bound here; the ERC-1643 document then points at the IPFS-pinned VP and the HCS message ID is carried in the issuance data.',
  };
}
