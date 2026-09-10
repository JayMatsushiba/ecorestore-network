/**
 * The verify service — HTTP surface over `pipeline.ts`.
 *
 *   GET  /health                    analysis, Guardian and chain reachability
 *   GET  /api/scenarios             the three demonstration scenarios
 *   POST /api/verify/:scenario      run one scenario now; returns the assurance bundle
 *   GET  /api/results/:scenario     the last bundle computed for that scenario
 *   GET  /api/results               summary of everything computed since start
 *
 * This process holds VERIFIER_SEED and is the only one that can reach
 * Guardian or a chain RPC. The analysis service it calls holds nothing.
 *
 * Environment:
 *   ANALYSIS_URL      the Python analysis service; unset → in-process TypeScript reference
 *   GUARDIAN_URL      Guardian's web proxy or gateway; unset → requests staged to the outbox
 *   GUARDIAN_POLICY_ID, GUARDIAN_BLOCK_TAG, GUARDIAN_POLICY_TAG
 *   DEMO_RPC_URL      a local chain (anvil); unset → calldata prepared, not broadcast
 *   VERIFIER_SEED     deterministic verifier DID; unset → 'ecorestore-demo-verifier'
 *   VERIFY_PORT       default 8080
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import { createVerifierIdentity } from '../guardian/adapter.js';
import { analysisServiceInfo, remoteBackend } from '../verification/analysis-client.js';
import type { AnalysisBackend } from '../verification/analysis-contract.js';
import { localBackend } from '../verification/engine.js';
import { buildScenarios, guardianTargetFromEnv, isScenarioId, ROOT, runScenario, setupChain, type AssuranceBundle, type ChainContext, type ScenarioId } from './pipeline.js';

const PORT = Number(process.env['VERIFY_PORT'] ?? 8080);
const ANALYSIS_URL = process.env['ANALYSIS_URL'] || undefined;
const DEMO_RPC_URL = process.env['DEMO_RPC_URL'] || undefined;
const OUTBOX = process.env['GUARDIAN_OUTBOX_DIR'] || join(ROOT, 'guardian', 'outbox');
const guardian = guardianTargetFromEnv();
const identity = createVerifierIdentity(process.env['VERIFIER_SEED'] || 'ecorestore-demo-verifier');
const log = (s: string) => console.log(`[verify] ${s}`);

const { parcel, list: scenarios } = buildScenarios();
const results = new Map<ScenarioId, AssuranceBundle>();
const inflight = new Map<ScenarioId, Promise<AssuranceBundle>>();
let chainCtx: ChainContext | null | undefined;

async function backend(): Promise<AnalysisBackend> {
  if (!ANALYSIS_URL) return localBackend;
  const info = await analysisServiceInfo({ baseUrl: ANALYSIS_URL });
  return remoteBackend({ baseUrl: ANALYSIS_URL }, info.engine);
}

async function chain(): Promise<ChainContext | null> {
  if (chainCtx !== undefined) return chainCtx;
  if (!DEMO_RPC_URL) return (chainCtx = null);
  chainCtx = await setupChain(DEMO_RPC_URL, log, process.env['DEMO_MNEMONIC']);
  return chainCtx;
}

async function probe(url: string | undefined, path: string): Promise<{ url: string | null; reachable: boolean; status?: number; detail?: string }> {
  if (!url) return { url: null, reachable: false, detail: 'not configured' };
  try {
    const res = await fetch(new URL(path, url), { signal: AbortSignal.timeout(4_000) });
    return { url, reachable: true, status: res.status };
  } catch (e) {
    return { url, reachable: false, detail: (e as Error).message };
  }
}

async function health() {
  const analysis = ANALYSIS_URL
    ? await analysisServiceInfo({ baseUrl: ANALYSIS_URL }).then((i) => ({ url: ANALYSIS_URL, reachable: true, engine: i.engine })).catch((e: Error) => ({ url: ANALYSIS_URL, reachable: false, error: e.message }))
    : { url: null, reachable: true, engine: localBackend.engine, note: 'ANALYSIS_URL unset: in-process TypeScript reference' };
  // Any HTTP response from Guardian's gateway, including 401, proves reachability.
  const g = await probe(guardian.baseUrl, '/api/v1/settings/environment');
  const rpc = DEMO_RPC_URL
    ? await fetch(DEMO_RPC_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }), signal: AbortSignal.timeout(4_000) })
        .then(async (r) => ({ url: DEMO_RPC_URL, reachable: true, chainId: parseInt(((await r.json()) as { result: string }).result, 16) }))
        .catch((e: Error) => ({ url: DEMO_RPC_URL, reachable: false, error: e.message }))
    : { url: null, reachable: false, note: 'DEMO_RPC_URL unset: calldata prepared, not broadcast' };
  return {
    ok: true,
    service: 'ecorestore-verify',
    verifierDid: identity.did,
    analysis,
    guardian: { ...g, policyId: guardian.policyId, blockTag: guardian.blockTag, policyTag: guardian.policyTag, mode: guardian.baseUrl ? 'submit' : 'outbox' },
    chain: rpc,
    computed: [...results.keys()],
  };
}

async function verifyScenario(id: ScenarioId): Promise<AssuranceBundle> {
  const pending = inflight.get(id);
  if (pending) return pending;
  const run = (async () => {
    const sc = scenarios.find((s) => s.name === id)!;
    const t0 = Date.now();
    const bundle = await runScenario(sc, parcel, {
      backend: await backend(),
      identity,
      guardian,
      outboxDir: OUTBOX,
      chain: await chain(),
      log,
      guardianDisplayUrl: process.env['GUARDIAN_PUBLIC_URL'] || undefined,
    });
    results.set(id, bundle);
    log(`${id}: ${bundle.result.verificationStatus} settled ${bundle.result.settledQuantity} ha via ${bundle.result.analysisEngine.name} ${bundle.result.analysisEngine.version}; Guardian ${bundle.guardianSubmission.outcome.mode}; ${Date.now() - t0} ms`);
    return bundle;
  })();
  inflight.set(id, run);
  try {
    return await run;
  } finally {
    inflight.delete(id);
  }
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store',
  });
  res.end(json);
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const method = req.method ?? 'GET';
  if (method === 'OPTIONS') return send(res, 204, null);
  if (url.pathname === '/health' && method === 'GET') return send(res, 200, await health());
  if (url.pathname === '/api/scenarios' && method === 'GET') {
    return send(res, 200, scenarios.map((s) => ({ id: s.name, description: s.description, tier0Provenance: s.evidence.tier0.provenance, computed: results.has(s.name) })));
  }
  const verifyMatch = /^\/api\/verify\/([a-z-]+)$/.exec(url.pathname);
  if (verifyMatch && method === 'POST') {
    const id = verifyMatch[1]!;
    if (!isScenarioId(id)) return send(res, 404, { error: `unknown scenario ${id}` });
    try {
      return send(res, 200, await verifyScenario(id));
    } catch (e) {
      log(`${id} failed: ${(e as Error).stack ?? e}`);
      return send(res, 502, { error: (e as Error).message });
    }
  }
  const resultMatch = /^\/api\/results\/([a-z-]+)$/.exec(url.pathname);
  if (resultMatch && method === 'GET') {
    const id = resultMatch[1]!;
    if (!isScenarioId(id)) return send(res, 404, { error: `unknown scenario ${id}` });
    const b = results.get(id);
    return b ? send(res, 200, b) : send(res, 404, { error: `scenario ${id} has not been verified yet; POST /api/verify/${id}` });
  }
  if (url.pathname === '/api/results' && method === 'GET') {
    return send(res, 200, [...results.values()].map((b) => ({ scenario: b.scenario, status: b.result.verificationStatus, settledQuantity: b.result.settledQuantity, resultHash: b.result.resultHash, analysisEngine: b.result.analysisEngine, guardian: b.guardianSubmission.outcome.mode, computedAt: b.runtime.computedAt })));
  }
  return send(res, 404, { error: 'not found' });
}

const server = createServer((req, res) => {
  route(req, res).catch((e) => {
    log(`unhandled: ${(e as Error).stack ?? e}`);
    if (!res.headersSent) send(res, 500, { error: 'internal error' });
  });
});

server.listen(PORT, () => {
  log(`listening on :${PORT}`);
  log(`verifier DID ${identity.did}`);
  log(`analysis: ${ANALYSIS_URL ?? 'in-process TypeScript reference'}`);
  log(`guardian: ${guardian.baseUrl ? `${guardian.baseUrl} (policy ${guardian.policyId}, block ${guardian.blockTag})` : 'GUARDIAN_URL unset — requests staged to outbox, NOT submitted'}`);
  log(`chain: ${DEMO_RPC_URL ?? 'DEMO_RPC_URL unset — calldata prepared, not broadcast'}`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    log(`${sig}: shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2_000).unref();
  });
}
