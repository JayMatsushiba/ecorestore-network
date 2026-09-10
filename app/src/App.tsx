import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { CounterfactualChart, TrajectoryChart } from './charts';
import type { AssuranceBundle, BundleSource } from './types';

const SCENARIOS: Array<{ id: AssuranceBundle['scenario']; label: string }> = [
  { id: 'real', label: 'Real Tier 0' },
  { id: 'synthetic', label: 'Synthetic effect (labelled)' },
  { id: 'trend-failure', label: 'Parallel-trend failure' },
];

const TREATMENT_DATE = '2024-10-15';
/** The verify service, proxied by nginx in the container and by Vite in development. */
const API = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`;

function Badge({ p }: { p: 'REAL' | 'SIMULATED' }) {
  return <span className={`badge ${p === 'REAL' ? 'real' : 'simulated'}`}>{p}</span>;
}

function fmt(x: number, d = 2): string {
  return x.toFixed(d);
}

/**
 * Presentation only. The page asks the verify service to run the scenario
 * now; if the service is unreachable it falls back to the committed bundle
 * shipped with the page and says so. Nothing is recomputed here.
 */
async function loadBundle(scenario: AssuranceBundle['scenario'], signal: AbortSignal): Promise<{ bundle: AssuranceBundle; source: BundleSource }> {
  const started = performance.now();
  let liveError: string;
  try {
    const res = await fetch(`${API}/verify/${scenario}`, { method: 'POST', signal });
    if (res.ok) return { bundle: (await res.json()) as AssuranceBundle, source: { kind: 'live', elapsedMs: Math.round(performance.now() - started) } };
    liveError = `verify service responded ${res.status}`;
  } catch (e) {
    if (signal.aborted) throw e;
    liveError = `verify service unreachable (${(e as Error).message})`;
  }
  const res = await fetch(`${import.meta.env.BASE_URL}demo/${scenario}/assurance-bundle.json`, { signal });
  if (!res.ok) throw new Error(`${liveError}; committed bundle also unavailable (${res.status}). Start the stack with \`docker compose up\`, or run \`npm run demo\` and copy out/demo into app/public/demo.`);
  return { bundle: (await res.json()) as AssuranceBundle, source: { kind: 'static', reason: liveError } };
}

/** A Guardian response counts as acknowledged delivery only on 2xx. */
function guardianAccepted(httpStatus: number | undefined): boolean {
  return httpStatus !== undefined && httpStatus >= 200 && httpStatus < 300;
}

export default function App() {
  const [scenario, setScenario] = useState<AssuranceBundle['scenario']>('real');
  const [bundle, setBundle] = useState<AssuranceBundle | null>(null);
  const [source, setSource] = useState<BundleSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);
  const rerun = useCallback(() => setRunId((n) => n + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    setBundle(null);
    setSource(null);
    setError(null);
    loadBundle(scenario, ctrl.signal)
      .then(({ bundle: b, source: s }) => {
        setBundle(b);
        setSource(s);
      })
      .catch((e: Error) => {
        if (!ctrl.signal.aborted) setError(e.message);
      });
    return () => ctrl.abort();
  }, [scenario, runId]);

  const r = bundle?.result;
  const ci = r?.uncertainty.interval;
  const engine = r?.analysisEngine ?? bundle?.runtime?.analysisEngine;

  const exportBundle = () => {
    if (!bundle) return;
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ecorestore-assurance-${bundle.scenario}-${bundle.result.resultHash.slice(2, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="shell">
      <header className="masthead">
        <h1>Ecorestore Network <span>/ Kootenay Riparian Restoration · prototype verification</span></h1>
        <nav className="tabs" aria-label="scenario">
          {SCENARIOS.map((s) => (
            <button key={s.id} aria-pressed={scenario === s.id} onClick={() => setScenario(s.id)}>{s.label}</button>
          ))}
        </nav>
      </header>

      {error && <p className="banner">{error}</p>}
      {!bundle && !error && <p className="muted">Verifying {scenario} — controls, parallel trend, DiD, leakage, 2000-draw bootstrap, placebo coverage…</p>}

      {bundle && r && ci && (
        <>
          <p className={`banner ${bundle.tier0Provenance.provenance === 'REAL' ? 'real' : ''}`}>
            <Badge p={bundle.tier0Provenance.provenance} /> Tier 0 — {bundle.tier0Provenance.provenance === 'REAL' ? `${r.stacSceneIds.length} real Sentinel-2 L2A acquisitions (${bundle.tier0Provenance.collection}), processing graph ${r.processingGraphVersion}.` : bundle.tier0Provenance.note}
            {' '}<Badge p="SIMULATED" /> Tiers 1–3 — {bundle.simulatedTiersBanner}
          </p>

          <p className="muted runtime">
            {source?.kind === 'live'
              ? <>Verified just now by the verify service in {(source.elapsedMs / 1000).toFixed(1)} s · analysis: <span className="mono">{engine?.name ?? 'unknown'} {engine?.version ?? ''}</span> · result <span className="mono">{r.resultHash.slice(0, 14)}…</span></>
              : <>Showing the committed demonstration bundle — {source?.reason ?? 'live verification unavailable'} · analysis: <span className="mono">{engine?.name ?? 'ecorestore-analysis-ts'} {engine?.version ?? ''}</span></>}
            {' '}<button className="linklike" onClick={rerun}>Re-run verification</button>
          </p>

          <div className="grid">
            <section className="card span-8">
              <h2>Assurance-adjusted comparison</h2>
              {bundle.tier0Provenance.provenance !== 'REAL' && (
                <p className="banner inset"><Badge p="SIMULATED" /> {bundle.simulatedTiersBanner} This settlement is driven by a synthetic treatment effect injected into the real series.</p>
              )}
              <div className="hero">
                <div>
                  <div className="big">{fmt(r.settledQuantity)}<small>ha defensible</small></div>
                  <div className="sub">settled at the lower {Math.round(ci.confidenceLevel * 100)}% bound · {r.settlementBasis}</div>
                </div>
                <div>
                  <div className="big" style={{ color: 'var(--text-muted)' }}>{fmt(r.claimedQuantity)}<small>ha at risk</small></div>
                  <div className="sub">claimed by the restorer (SIMULATED Tier 3)</div>
                </div>
                <div>
                  <div><span className="badge status">{r.verificationStatus}</span></div>
                  <div className="sub">{r.statusReason}</div>
                </div>
              </div>
            </section>

            <section className="card span-4">
              <h2>Interval, not a point</h2>
              <dl className="kv">
                <dt>Additional (point)</dt><dd>{fmt(r.measured.additionalBiophysicalHa)} ha</dd>
                <dt>{Math.round(ci.confidenceLevel * 100)}% interval</dt><dd>[{fmt(ci.lower)}, {fmt(ci.upper)}] ha</dd>
                <dt>Empirical coverage</dt><dd>{r.uncertainty.empiricalCoverage.empirical ?? 'n/a'} vs {r.uncertainty.empiricalCoverage.nominal} nominal · {r.uncertainty.empiricalCoverage.placebos} placebos</dd>
                <dt>Parallel trend</dt><dd className={r.parallelTrend.status === 'PASS' ? 'gate-pass' : 'gate-fail'}>{r.parallelTrend.status} · p {r.parallelTrend.pValue} · n {r.parallelTrend.nObservations}</dd>
                <dt>Run index</dt><dd>{r.runIndex}</dd>
              </dl>
            </section>

            <section className="card span-12">
              <h2>Additionality view — parcel against the control rings</h2>
              <TrajectoryChart points={bundle.trajectory.points} treatmentDate={TREATMENT_DATE} tier0Provenance={bundle.tier0Provenance.provenance} />
              <p className="muted" style={{ marginBottom: 0 }}>
                Far ring {r.controlSets.find((c) => c.ring === 'far')?.geometry.innerM}–{r.controlSets.find((c) => c.ring === 'far')?.geometry.outerM} m, {r.controlSets.find((c) => c.ring === 'far')?.matched} of {r.controlSets.find((c) => c.ring === 'far')?.candidates} candidates matched · near ring 0–{r.controlSets.find((c) => c.ring === 'near')?.geometry.outerM} m, {r.controlSets.find((c) => c.ring === 'near')?.matched} matched. Controls are drawn by the plan committed at deed creation ({r.analysisPlanHash.slice(0, 12)}…), never chosen at verification time.
              </p>
            </section>

            <section className="card span-6">
              <h2>From claim to settlement</h2>
              <CounterfactualChart r={r} />
            </section>

            <section className="card span-6">
              <h2>Evidence ladder</h2>
              <table>
                <thead><tr><th>Tier</th><th>Source</th><th className="num">Corroboration</th><th>Note</th></tr></thead>
                <tbody>
                  {r.tierCorroboration.map((t) => (
                    <tr key={t.tier}>
                      <td>{t.tier}</td>
                      <td>{t.label} <Badge p={t.provenance} /></td>
                      <td className="num">{t.score.toFixed(2)}</td>
                      <td className="muted">{t.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h2 style={{ marginTop: 14 }}>Gates</h2>
              <table>
                <tbody>
                  {r.qualityGate.gates.map((g) => (
                    <tr key={g.name}>
                      <td className="mono">{g.name}</td>
                      <td className={g.status === 'PASS' ? 'gate-pass' : g.status === 'FAIL' ? 'gate-fail' : 'gate-na'}>{g.status}</td>
                      <td className="muted">{g.detail} <Badge p={g.provenance} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="card span-4">
              <h2>Verdict credential</h2>
              <dl className="kv">
                <dt>Issuer</dt><dd className="mono">{bundle.verdictCredential.issuer}</dd>
                <dt>Signature</dt><dd className={bundle.credentialCheck.signatureValid ? 'gate-pass' : 'gate-fail'}>{bundle.credentialCheck.signatureValid ? 'valid (Ed25519)' : 'INVALID'}</dd>
                <dt>Schema</dt><dd className={bundle.credentialCheck.schemaValid ? 'gate-pass' : 'gate-fail'}>{bundle.credentialCheck.schemaValid ? 'valid' : 'INVALID'}</dd>
                <dt>Result hash</dt><dd className="mono">{r.resultHash}</dd>
                <dt>Evidence CID</dt><dd className="mono">{r.evidenceCid} <span className="muted">(computed, not pinned)</span></dd>
              </dl>
            </section>

            <section className="card span-4">
              <h2>Guardian &amp; outcome token</h2>
              <dl className="kv">
                <dt>Guardian</dt>
                <dd>
                  {/*
                    `sent` means the gateway answered, not that it accepted: the adapter
                    reports any HTTP response as `sent`. Only a 2xx earns acknowledgement
                    wording, and even then it is delivery rather than a policy run.
                  */}
                  {bundle.guardianSubmission.outcome.mode === 'sent'
                    ? guardianAccepted(bundle.guardianSubmission.outcome.httpStatus)
                      ? <><span className="gate-pass">submitted · HTTP {bundle.guardianSubmission.outcome.httpStatus}</span> — gateway acknowledgement only; a policy run is confirmed inside Guardian</>
                      : <><span className="gate-fail">rejected · HTTP {bundle.guardianSubmission.outcome.httpStatus}</span> — the gateway refused the document; NOT submitted and no policy run</>
                    : bundle.guardianSubmission.outcome.mode === 'failed'
                      ? <span className="gate-fail">Guardian unreachable — request staged, NOT submitted</span>
                      : 'not configured — request staged, NOT submitted'}
                </dd>
                <dt>Endpoint</dt><dd className="mono">{bundle.guardianSubmission.request.method} {bundle.guardianSubmission.request.url ?? bundle.guardianSubmission.request.path}</dd>
                <dt>Issuance</dt>
                <dd>{bundle.issuance.partition ? <>{bundle.issuance.valueHa} ha into partition <span className="mono">{bundle.issuance.partition.slice(0, 14)}…</span> — calldata prepared, <strong>not broadcast</strong></> : <span className="muted">{bundle.issuance.reason}</span>}</dd>
                <dt>Obligation status</dt><dd className="mono">{r.obligationStatus}</dd>
              </dl>
            </section>

            <section className="card span-4">
              <h2>Restoration Deed (Arc)</h2>
              {bundle.contract.chain ? (
                <dl className="kv">
                  <dt>Chain</dt><dd>local demo chain (anvil, not Arc Testnet) · deed {bundle.contract.chain.deedId} · run {bundle.contract.chain.runIndex}</dd>
                  <dt>Milestone</dt><dd className="mono">{bundle.contract.chain.milestoneState}</dd>
                  <dt>Restorer</dt><dd>+{bundle.contract.chain.balances['restorerReceived']}</dd>
                  <dt>Steward share</dt><dd>+{bundle.contract.chain.balances['stewardReceived']}</dd>
                  <dt>Retained</dt><dd>{bundle.contract.chain.balances['retained']}</dd>
                  <dt>Escrow</dt><dd>{bundle.contract.chain.balances['escrowAvailable']}</dd>
                </dl>
              ) : (
                <p className="muted">Not broadcast. verifyMilestone calldata prepared: <span className="mono">{bundle.contract.verifyMilestone.calldata.slice(0, 26)}…</span></p>
              )}
              {bundle.contract.chain && (
                <ol className="tx-list">
                  {bundle.contract.chain.txs.map((t) => <li key={t.hash}>{t.step} <span className="mono muted">{t.hash.slice(0, 12)}…</span></li>)}
                </ol>
              )}
            </section>

            <section className="card span-8">
              <h2>Auditor explanation <span className="muted">(deterministic template · no LLM)</span></h2>
              <p className="narrative">{bundle.auditorReport.narrative}</p>
            </section>

            <section className="card span-4">
              <h2>Assurance export</h2>
              <p className="muted">Quantities with bounds, empirical coverage, provenance, {r.stacSceneIds.length} STAC scene IDs, processing graph, control-set and ring geometry, plan hash and run index, obligation status, verdict VC and transaction references.</p>
              <div className="actions"><button onClick={exportBundle}>Download assurance bundle (JSON)</button></div>
              <p className="muted" style={{ marginTop: 10 }}>Demonstration outcome. Not a regulatory credit, not certification.</p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
