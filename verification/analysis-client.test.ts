/**
 * The remote backend's guards. Each one exists because the result hash commits
 * to what these values say: the plan, the snapshot and the engine.
 */
import { describe, expect, it } from 'vitest';
import { remoteBackend } from './analysis-client.js';
import type { AnalysisEngineId, AnalysisRequest } from './analysis-contract.js';

const BOUND: AnalysisEngineId = { name: 'ecorestore-analysis-py', version: '1.0.0' };
const REQ: AnalysisRequest = {
  planCanonical: '{}',
  planHash: `0x${'a'.repeat(64)}`,
  tier0Canonical: '{}',
  snapshotHash: `0x${'b'.repeat(64)}`,
};

function serviceReturning(body: Record<string, unknown>): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
}

const wellFormed = { engine: BOUND, planHash: REQ.planHash, snapshotHash: REQ.snapshotHash };

describe('remoteBackend', () => {
  it('accepts a response whose receipts and engine match', async () => {
    const backend = remoteBackend({ baseUrl: 'http://analysis', fetchImpl: serviceReturning(wellFormed) }, BOUND);
    await expect(backend.analyse(REQ)).resolves.toMatchObject({ engine: BOUND });
  });

  it('rejects a response from an engine other than the one it bound to', async () => {
    // /health said one thing; /analyse answered as something else — a rollout
    // between the two calls, or a misrouted request.
    const impostor = { ...wellFormed, engine: { name: 'ecorestore-analysis-py', version: '1.1.0' } };
    const backend = remoteBackend({ baseUrl: 'http://analysis', fetchImpl: serviceReturning(impostor) }, BOUND);
    await expect(backend.analyse(REQ)).rejects.toThrow(/answered as ecorestore-analysis-py 1\.1\.0, bound to ecorestore-analysis-py 1\.0\.0/);
  });

  it('rejects a response computed under a different plan', async () => {
    const backend = remoteBackend({ baseUrl: 'http://analysis', fetchImpl: serviceReturning({ ...wellFormed, planHash: `0x${'c'.repeat(64)}` }) }, BOUND);
    await expect(backend.analyse(REQ)).rejects.toThrow(/echoed plan/);
  });

  it('rejects a response computed over a different snapshot', async () => {
    const backend = remoteBackend({ baseUrl: 'http://analysis', fetchImpl: serviceReturning({ ...wellFormed, snapshotHash: `0x${'d'.repeat(64)}` }) }, BOUND);
    await expect(backend.analyse(REQ)).rejects.toThrow(/echoed snapshot/);
  });
});
