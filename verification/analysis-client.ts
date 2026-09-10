/**
 * HTTP client for the Python analysis service (`analysis/`), implementing the
 * boundary in `analysis-contract.ts`.
 *
 * The service is a pure function over the request: it holds no keys, has no
 * chain or Guardian access, and returns numbers. This client checks the
 * receipts it echoes back so verify can never assemble a result over an
 * analysis of something other than what it sent.
 */
import type { AnalysisBackend, AnalysisEngineId, AnalysisOutput, AnalysisRequest } from './analysis-contract.js';

export interface RemoteAnalysisOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface AnalysisServiceInfo {
  engine: AnalysisEngineId;
  status: 'ok';
  /**
   * Resolved versions of the libraries the service's floats come from. The
   * engine identity is a declaration; this is what is actually installed, so a
   * stack that has drifted from `analysis/constraints.txt` is visible from
   * `/health` rather than only when the parity suite is next run.
   */
  numericStack?: Record<string, string>;
}

export async function analysisServiceInfo(opts: RemoteAnalysisOptions): Promise<AnalysisServiceInfo> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl(new URL('/health', opts.baseUrl), { signal: AbortSignal.timeout(opts.timeoutMs ?? 5_000) });
  if (!res.ok) throw new Error(`analysis service /health responded ${res.status}`);
  return (await res.json()) as AnalysisServiceInfo;
}

export function remoteBackend(opts: RemoteAnalysisOptions, engine: AnalysisEngineId): AnalysisBackend {
  const fetchImpl = opts.fetchImpl ?? fetch;
  return {
    engine,
    async analyse(req: AnalysisRequest): Promise<AnalysisOutput> {
      const res = await fetchImpl(new URL('/analyse', opts.baseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
      });
      if (!res.ok) throw new Error(`analysis service responded ${res.status}: ${await res.text()}`);
      const out = (await res.json()) as AnalysisOutput;
      if (out.planHash !== req.planHash) throw new Error(`analysis echoed plan ${out.planHash}, sent ${req.planHash}`);
      if (out.snapshotHash !== req.snapshotHash) throw new Error(`analysis echoed snapshot ${out.snapshotHash}, sent ${req.snapshotHash}`);
      // The identity was read from /health one request earlier. A rollout or a
      // reconfigured service between the two calls would otherwise let the result
      // commit to one engine while callers report another — and `analysisEngine`
      // is inside the result hash, so the two must be the same engine.
      if (out.engine.name !== engine.name || out.engine.version !== engine.version) {
        throw new Error(`analysis answered as ${out.engine.name} ${out.engine.version}, bound to ${engine.name} ${engine.version}`);
      }
      return out;
    },
  };
}

/** Connect to the service, read its engine identity, and return a backend bound to it. */
export async function connectRemoteBackend(opts: RemoteAnalysisOptions): Promise<AnalysisBackend> {
  const info = await analysisServiceInfo(opts);
  return remoteBackend(opts, info.engine);
}
