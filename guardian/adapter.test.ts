import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verify } from '../verification/engine.js';
import { loadEvidenceBundle } from '../verification/fixtures.js';
import { injectSyntheticEffect } from '../verification/scenario.js';
import {
  base58btc,
  buildExternalDataRequest,
  buildPresentation,
  createVerifierIdentity,
  decodeBase58btc,
  issueVerdictCredential,
  publicKeyFromDidKey,
  submitToGuardian,
  toSubject,
  validateSubject,
  verifyVerdictCredential,
} from './adapter.js';
import { prepareIssuance, vintagePartition } from './issuance.js';

const { parcel, plan, evidence } = loadEvidenceBundle();
const realResult = verify({ projectId: 'p', parcel, plan, evidence, runIndex: 1, computedAt: '2026-09-10T00:00:00Z' });
const scenarioResult = verify({
  projectId: 'p',
  parcel,
  plan,
  evidence: { ...evidence, tier0: injectSyntheticEffect(evidence.tier0, plan, 0.25) },
  runIndex: 2,
  computedAt: '2026-09-10T00:00:00Z',
});
const identity = createVerifierIdentity('ecorestore-test-verifier');

describe('did:key identity', () => {
  it('base58 round-trips', () => {
    const bytes = Uint8Array.from([0, 0, 1, 2, 3, 255, 128]);
    expect(decodeBase58btc(base58btc(bytes))).toEqual(bytes);
  });

  it('derives a deterministic Ed25519 did:key and recovers the public key from it', () => {
    expect(identity.did).toMatch(/^did:key:z6Mk/);
    expect(createVerifierIdentity('ecorestore-test-verifier').did).toBe(identity.did);
    expect(createVerifierIdentity('other').did).not.toBe(identity.did);
    const pub = publicKeyFromDidKey(identity.did);
    expect(pub.export({ type: 'spki', format: 'der' })).toEqual(identity.publicKey.export({ type: 'spki', format: 'der' }));
  });
});

describe('verdict credential', () => {
  it('subject validates against the published Guardian-compatible schema', () => {
    const check = validateSubject(toSubject(realResult));
    expect(check.errors).toEqual([]);
    expect(check.valid).toBe(true);
  });

  it('rejects a subject with an invented field or a bad hash', () => {
    expect(validateSubject({ ...toSubject(realResult), extra: 1 }).valid).toBe(false);
    expect(validateSubject({ ...toSubject(realResult), resultHash: '0x12' }).valid).toBe(false);
  });

  it('signs and verifies, and detects tampering with the settled quantity', () => {
    const vc = issueVerdictCredential(realResult, identity, '2026-09-10T00:00:01Z');
    const ok = verifyVerdictCredential(vc, realResult);
    expect(ok.errors).toEqual([]);
    expect(ok.signatureValid && ok.schemaValid && ok.resultHashMatches).toBe(true);

    const tampered = structuredClone(vc);
    tampered.credentialSubject[0].settledQuantity = 42;
    const bad = verifyVerdictCredential(tampered, realResult);
    expect(bad.signatureValid).toBe(false);
  });

  it('carries Tier 0 provenance and the simulated-tiers banner', () => {
    const vc = issueVerdictCredential(scenarioResult, identity, '2026-09-10T00:00:01Z');
    expect(vc.credentialSubject[0].tier0Provenance).toBe('SIMULATED');
    expect(vc.credentialSubject[0].simulatedTiersBanner).toMatch(/SIMULATED DEMONSTRATION DATA/);
    expect(vc.issuer).toBe(identity.did);
  });
});

describe('Guardian externalDataBlock request', () => {
  it('builds the documented request body and stages it when no Guardian URL is configured', async () => {
    const vc = issueVerdictCredential(realResult, identity, '2026-09-10T00:00:01Z');
    const req = buildExternalDataRequest(vc, { policyId: 'policy-1', blockTag: 'ecorestore_verdict', policyTag: 'Ecorestore_v1', ownerDid: identity.did });
    expect(req.path).toBe('/api/v1/external/policy-1/ecorestore_verdict');
    expect(req.url).toBeNull();
    expect(req.body.owner).toBe(identity.did);
    expect(req.body.document.credentialSubject[0].type).toBe('#ecorestore-verification-result-1.0.0');
    const dir = mkdtempSync(join(tmpdir(), 'guardian-outbox-'));
    const outcome = await submitToGuardian(req, { outboxDir: dir });
    expect(outcome.mode).toBe('outbox');
    const staged = JSON.parse(readFileSync(outcome.outboxPath!, 'utf8')) as { note: string };
    expect(staged.note).toMatch(/NOT submitted/);
  });

  it('posts to Guardian when a URL is configured', async () => {
    const vc = issueVerdictCredential(realResult, identity, '2026-09-10T00:00:01Z');
    const req = buildExternalDataRequest(vc, { baseUrl: 'https://guardian.example/', policyId: 'p', blockTag: 'b', policyTag: 't', ownerDid: identity.did });
    expect(req.url).toBe('https://guardian.example/api/v1/external/p/b');
    const calls: string[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push(String(url));
      expect(init?.method).toBe('POST');
      return new Response('true', { status: 200 });
    }) as typeof fetch;
    const outcome = await submitToGuardian(req, { outboxDir: tmpdir(), fetchImpl });
    expect(outcome.mode).toBe('sent');
    expect(outcome.httpStatus).toBe(200);
    expect(calls).toEqual(['https://guardian.example/api/v1/external/p/b']);
  });
});

describe('ATS seam', () => {
  const holder = '0x1111111111111111111111111111111111111111' as const;

  it('refuses to prepare issuance for a result with no settled quantity', () => {
    const vc = issueVerdictCredential(realResult, identity, '2026-09-10T00:00:01Z');
    const vp = buildPresentation(vc, realResult, identity.did);
    expect(prepareIssuance(realResult, vp, holder)).toBeNull();
  });

  it('prepares setDocument and issueByPartition calldata for a PARTIAL result, unbroadcast', () => {
    const vc = issueVerdictCredential(scenarioResult, identity, '2026-09-10T00:00:01Z');
    const vp = buildPresentation(vc, scenarioResult, identity.did);
    const pkg = prepareIssuance(scenarioResult, vp, holder)!;
    expect(pkg).not.toBeNull();
    expect(pkg.broadcast).toBe(false);
    expect(pkg.partition).toBe(vintagePartition(scenarioResult.parcelH3Root, scenarioResult.window.start, scenarioResult.window.end));
    expect(pkg.value).toBe(BigInt(Math.round(scenarioResult.settledQuantity * 10_000)));
    expect(pkg.document.uri).toMatch(/^ipfs:\/\/bafkrei/);
    expect(pkg.document.pinned).toBe(false);
    expect(pkg.calls.map((c) => c.standard)).toEqual(['ERC-1643', 'ERC-1410']);
    // setDocument selector
    expect(pkg.calls[0]!.data.startsWith('0x010648ca')).toBe(true);
    expect(vp.guardian.stoodUp).toBe(false);
  });
});
