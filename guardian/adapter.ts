/**
 * Hedera Guardian adapter (docs/GUARDIAN.md).
 *
 * Guardian is the issuance authority and is NOT stood up for the hackathon.
 * This module makes the seam real:
 *
 *   1. the verdict schema is published (schema/verification-result.vc.schema.json);
 *   2. the deterministic VerificationResult is wrapped as a W3C Verifiable
 *      Credential and DID-signed by the Ecorestore verifier (Ed25519, did:key);
 *   3. the VC is packaged as the exact `POST /api/v1/external/{policyId}/{blockTag}`
 *      request body Guardian's externalDataBlock accepts;
 *   4. with GUARDIAN_URL unset the request is written to an outbox instead of
 *      sent, and that is reported as such — never as a completed policy run.
 *
 * Nothing here alters a verification quantity. The adapter signs what the
 * engine produced and can prove that it did.
 */
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import AjvModule from 'ajv';
import type { Ajv, ValidateFunction } from 'ajv';
import AjvFormatsModule from 'ajv-formats';
import type { FormatsPlugin } from 'ajv-formats';
import { canonicalize, keccakOf } from '../verification/canonical.js';
import { SIMULATED_BANNER, type Hex, type VerificationResult } from '../verification/models.js';
import schemaJson from './schema/verification-result.vc.schema.json' with { type: 'json' };

export const VC_CONTEXT = ['https://www.w3.org/2018/credentials/v1', 'https://ecorestore.network/contexts/verification/v1'];
export const VC_TYPE = ['VerifiableCredential', 'EcorestoreVerificationResult'];
export const SUBJECT_TYPE = '#ecorestore-verification-result-1.0.0';

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export interface VerifierIdentity {
  did: string;
  verificationMethod: string;
  privateKey: KeyObject;
  publicKey: KeyObject;
  /** Raw 32-byte Ed25519 public key, hex. */
  publicKeyHex: Hex;
}

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58btc(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j]! << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = '1'.repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) out += BASE58[digits[i]!];
  return out;
}

export function decodeBase58btc(s: string): Uint8Array {
  const bytes = [0];
  for (const ch of s) {
    let carry = BASE58.indexOf(ch);
    if (carry < 0) throw new Error(`invalid base58 character ${ch}`);
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j]! * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  let zeros = 0;
  while (zeros < s.length && s[zeros] === '1') zeros++;
  return Uint8Array.from([...Array<number>(zeros).fill(0), ...bytes.reverse()]);
}

function rawEd25519Public(publicKey: KeyObject): Uint8Array {
  const spki = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
  return new Uint8Array(spki.subarray(spki.length - 32));
}

function didKeyFromRaw(raw: Uint8Array): string {
  const prefixed = new Uint8Array(2 + raw.length);
  prefixed[0] = 0xed; // multicodec ed25519-pub
  prefixed[1] = 0x01;
  prefixed.set(raw, 2);
  return `did:key:z${base58btc(prefixed)}`;
}

/**
 * Deterministic identity from a seed (tests, demo) or a fresh random keypair.
 * The seed path derives the 32-byte Ed25519 private scalar from sha256(seed).
 */
export function createVerifierIdentity(seed?: string): VerifierIdentity {
  let privateKey: KeyObject;
  if (seed !== undefined) {
    const raw = createHash('sha256').update(seed).digest();
    const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
    privateKey = createPrivateKey({ key: Buffer.concat([pkcs8Prefix, raw]), format: 'der', type: 'pkcs8' });
  } else {
    privateKey = generateKeyPairSync('ed25519').privateKey;
  }
  const publicKey = createPublicKey(privateKey);
  const raw = rawEd25519Public(publicKey);
  const did = didKeyFromRaw(raw);
  return { did, verificationMethod: `${did}#${did.slice('did:key:'.length)}`, privateKey, publicKey, publicKeyHex: `0x${Buffer.from(raw).toString('hex')}` };
}

export function publicKeyFromDidKey(did: string): KeyObject {
  const m = /^did:key:z([1-9A-HJ-NP-Za-km-z]+)$/.exec(did);
  if (!m) throw new Error(`unsupported DID: ${did}`);
  const decoded = decodeBase58btc(m[1]!);
  if (decoded[0] !== 0xed || decoded[1] !== 0x01 || decoded.length !== 34) throw new Error('not an Ed25519 did:key');
  const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
  return createPublicKey({ key: Buffer.concat([spkiPrefix, Buffer.from(decoded.subarray(2))]), format: 'der', type: 'spki' });
}

// ---------------------------------------------------------------------------
// Credential
// ---------------------------------------------------------------------------

export interface VerdictSubject {
  type: typeof SUBJECT_TYPE;
  resultVersion: string;
  projectId: string;
  parcelId: string;
  parcelH3Root: Hex;
  geometryHash: Hex;
  parcelAreaHa: number;
  analysisPlanHash: Hex;
  runIndex: number;
  methodologyVersion: string;
  processingGraphVersion: string;
  tier0Provenance: 'REAL' | 'SIMULATED';
  stacSceneIds: string[];
  metricId: string;
  metricVersion: string;
  metricUnit: 'ha';
  windowStart: string;
  windowEnd: string;
  claimedQuantity: number;
  parcelChangeHa: number;
  controlChangeFarRingHa: number;
  controlChangeNearRingHa: number;
  leakageHa: number;
  additionalBiophysicalHa: number;
  confidenceLevel: number;
  intervalLower: number;
  intervalUpper: number;
  empiricalCoverage: number | null;
  parallelTrendStatus: string;
  parallelTrendPValue: number;
  qualityGateStatus: string;
  obligationStatus: string;
  verificationStatus: string;
  settledQuantity: number;
  settlementBasis: string;
  evidenceHash: Hex;
  evidenceCid: string;
  resultHash: Hex;
  simulatedTiersBanner: typeof SIMULATED_BANNER;
}

export interface Proof {
  type: 'Ed25519Signature2020';
  created: string;
  verificationMethod: string;
  proofPurpose: 'assertionMethod';
  /** Detached JWS (RFC 7797, b64=false) over the canonical unsigned credential. */
  jws: string;
}

export interface VerdictCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  credentialSubject: [VerdictSubject];
  proof?: Proof;
}

export function toSubject(r: VerificationResult): VerdictSubject {
  return {
    type: SUBJECT_TYPE,
    resultVersion: r.resultVersion,
    projectId: r.projectId,
    parcelId: r.parcelId,
    parcelH3Root: r.parcelH3Root,
    geometryHash: r.geometryHash,
    parcelAreaHa: r.parcelAreaHa,
    analysisPlanHash: r.analysisPlanHash,
    runIndex: r.runIndex,
    methodologyVersion: r.methodologyVersion,
    processingGraphVersion: r.processingGraphVersion,
    tier0Provenance: r.tier0Provenance.provenance,
    stacSceneIds: r.stacSceneIds,
    metricId: r.metric.id,
    metricVersion: r.metric.version,
    metricUnit: r.metric.unit,
    windowStart: r.window.start,
    windowEnd: r.window.end,
    claimedQuantity: r.claimedQuantity,
    parcelChangeHa: r.measured.parcelChangeHa,
    controlChangeFarRingHa: r.measured.controlChangeFarRingHa,
    controlChangeNearRingHa: r.measured.controlChangeNearRingHa,
    leakageHa: r.measured.leakageHa,
    additionalBiophysicalHa: r.measured.additionalBiophysicalHa,
    confidenceLevel: r.uncertainty.interval.confidenceLevel,
    intervalLower: r.uncertainty.interval.lower,
    intervalUpper: r.uncertainty.interval.upper,
    empiricalCoverage: r.uncertainty.empiricalCoverage.empirical,
    parallelTrendStatus: r.parallelTrend.status,
    parallelTrendPValue: r.parallelTrend.pValue,
    qualityGateStatus: r.qualityGate.status,
    obligationStatus: r.obligationStatus,
    verificationStatus: r.verificationStatus,
    settledQuantity: r.settledQuantity,
    settlementBasis: r.settlementBasis,
    evidenceHash: r.evidenceHash,
    evidenceCid: r.evidenceCid,
    resultHash: r.resultHash,
    simulatedTiersBanner: SIMULATED_BANNER,
  };
}

let validator: ValidateFunction | undefined;
export function validateSubject(subject: unknown): { valid: boolean; errors: string[] } {
  if (!validator) {
    // Both packages are CommonJS; under Node ESM the callable lives on `.default`.
    const AjvCtor = (AjvModule as unknown as { default: typeof Ajv }).default;
    const addFormats = (AjvFormatsModule as unknown as { default: FormatsPlugin }).default;
    const ajv = new AjvCtor({ allErrors: true, strict: true });
    addFormats(ajv);
    validator = ajv.compile(schemaJson);
  }
  const valid = validator(subject) as boolean;
  return { valid, errors: (validator.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`.trim()) };
}

function b64url(bytes: Uint8Array | string): string {
  return Buffer.from(bytes).toString('base64url');
}

const JWS_HEADER = b64url(JSON.stringify({ alg: 'EdDSA', b64: false, crit: ['b64'] }));

function signingInput(unsigned: Omit<VerdictCredential, 'proof'>): Buffer {
  return Buffer.concat([Buffer.from(`${JWS_HEADER}.`), Buffer.from(canonicalize(unsigned))]);
}

export function issueVerdictCredential(result: VerificationResult, identity: VerifierIdentity, issuedAt: string): VerdictCredential {
  const subject = toSubject(result);
  const check = validateSubject(subject);
  if (!check.valid) throw new Error(`verdict subject fails schema: ${check.errors.join('; ')}`);
  const unsigned: Omit<VerdictCredential, 'proof'> = {
    '@context': VC_CONTEXT,
    id: `urn:ecorestore:verdict:${result.resultHash}`,
    type: VC_TYPE,
    issuer: identity.did,
    issuanceDate: issuedAt,
    credentialSubject: [subject],
  };
  const signature = sign(null, signingInput(unsigned), identity.privateKey);
  return {
    ...unsigned,
    proof: {
      type: 'Ed25519Signature2020',
      created: issuedAt,
      verificationMethod: identity.verificationMethod,
      proofPurpose: 'assertionMethod',
      jws: `${JWS_HEADER}..${b64url(signature)}`,
    },
  };
}

export interface CredentialCheck {
  signatureValid: boolean;
  schemaValid: boolean;
  /** True when a full result is supplied and its keccak equals the subject's resultHash. */
  resultHashMatches: boolean | null;
  errors: string[];
}

/**
 * Public verifiability: anyone holding the VC (and optionally the full result)
 * can confirm the issuer signed exactly this subject and that the subject
 * commits to the result.
 */
export function verifyVerdictCredential(vc: VerdictCredential, fullResult?: VerificationResult): CredentialCheck {
  const errors: string[] = [];
  const { proof, ...unsigned } = vc;
  let signatureValid = false;
  if (!proof) errors.push('missing proof');
  else {
    const [header, , sig] = proof.jws.split('.');
    if (header !== JWS_HEADER || sig === undefined) errors.push('unexpected JWS header or format');
    else {
      try {
        const pub = publicKeyFromDidKey(vc.issuer);
        signatureValid = verify(null, signingInput(unsigned), pub, Buffer.from(sig, 'base64url'));
        if (!signatureValid) errors.push('signature does not verify');
        if (!proof.verificationMethod.startsWith(vc.issuer)) errors.push('verificationMethod does not belong to issuer');
      } catch (e) {
        errors.push(`issuer key error: ${(e as Error).message}`);
      }
    }
  }
  const subject = vc.credentialSubject[0];
  const schema = validateSubject(subject);
  if (!schema.valid) errors.push(...schema.errors);
  let resultHashMatches: boolean | null = null;
  if (fullResult) {
    const { resultHash, ...rest } = fullResult;
    resultHashMatches = keccakOf(rest) === resultHash && resultHash === subject.resultHash;
    if (!resultHashMatches) errors.push('result hash mismatch');
  }
  return { signatureValid, schemaValid: schema.valid, resultHashMatches, errors };
}

// ---------------------------------------------------------------------------
// Presentation — what a Guardian policy run would emit for the token seam
// ---------------------------------------------------------------------------

export interface VerdictPresentation {
  '@context': string[];
  type: ['VerifiablePresentation'];
  holder: string;
  verifiableCredential: [VerdictCredential];
  /** The full canonical result travels with the VC so the hash can be re-derived. */
  ecorestoreResult: VerificationResult;
  /** keccak256 of the canonical presentation minus this field — the ERC-1643 documentHash. */
  presentationHash: Hex;
  guardian: {
    stoodUp: false;
    note: string;
    dropInPoint: {
      externalDataBlock: string;
      vvbReviewScope: string[];
      timerBlock: string;
      mintDocumentBlock: string;
    };
  };
}

export function buildPresentation(vc: VerdictCredential, result: VerificationResult, holderDid: string): VerdictPresentation {
  const partial: Omit<VerdictPresentation, 'presentationHash'> = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiablePresentation'],
    holder: holderDid,
    verifiableCredential: [vc],
    ecorestoreResult: result,
    guardian: {
      stoodUp: false,
      note: 'Guardian is not stood up for this prototype (docs/GUARDIAN.md). This presentation is emitted by the Ecorestore verifier occupying the slot a Guardian policy run would occupy. In production the VP is produced by Guardian, pinned to IPFS and written to an HCS topic.',
      dropInPoint: {
        externalDataBlock: 'POST /api/v1/external/{policyId}/{blockTag} with this VC as `document` — see buildExternalDataRequest()',
        vvbReviewScope: ['pipeline configuration', 'pre-registered analysis plan honoured (analysisPlanHash, runIndex)', 'parallel-trend diagnostic passing'],
        timerBlock: 'persistence re-verification at 12 / 24 / 36 months',
        mintDocumentBlock: 'settledQuantity → token amount; partition = keccak256(parcelH3Root, windowStart, windowEnd)',
      },
    },
  };
  return { ...partial, presentationHash: keccakOf(partial) };
}

// ---------------------------------------------------------------------------
// externalDataBlock request
// ---------------------------------------------------------------------------

export interface GuardianTarget {
  /** Guardian base URL, e.g. https://guardian.example/ — from GUARDIAN_URL. */
  baseUrl?: string | undefined;
  policyId: string;
  blockTag: string;
  policyTag: string;
  ownerDid: string;
}

export interface ExternalDataRequest {
  method: 'POST';
  path: string;
  url: string | null;
  body: { owner: string; policyTag: string; document: VerdictCredential };
}

export function buildExternalDataRequest(vc: VerdictCredential, target: GuardianTarget): ExternalDataRequest {
  const path = `/api/v1/external/${encodeURIComponent(target.policyId)}/${encodeURIComponent(target.blockTag)}`;
  return {
    method: 'POST',
    path,
    url: target.baseUrl ? new URL(path, target.baseUrl).toString() : null,
    body: { owner: target.ownerDid, policyTag: target.policyTag, document: vc },
  };
}

export interface SubmissionOutcome {
  mode: 'sent' | 'outbox';
  detail: string;
  httpStatus?: number;
  outboxPath?: string;
}

export async function submitToGuardian(
  req: ExternalDataRequest,
  opts: { outboxDir: string; fetchImpl?: typeof fetch },
): Promise<SubmissionOutcome> {
  if (req.url) {
    const fetchImpl = opts.fetchImpl ?? fetch;
    const res = await fetchImpl(req.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req.body) });
    return { mode: 'sent', httpStatus: res.status, detail: res.ok ? 'externalDataBlock accepted the document' : `Guardian responded ${res.status}: ${await res.text()}` };
  }
  mkdirSync(opts.outboxDir, { recursive: true });
  const name = `external-${req.body.document.credentialSubject[0].resultHash.slice(2, 18)}.json`;
  const outboxPath = join(opts.outboxDir, name);
  writeFileSync(outboxPath, JSON.stringify({ ...req, note: 'GUARDIAN_URL not set; request staged, NOT submitted. No Guardian policy run has occurred.' }, null, 2));
  return { mode: 'outbox', outboxPath, detail: 'GUARDIAN_URL not set; request written to outbox and NOT submitted' };
}
