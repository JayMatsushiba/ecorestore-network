import { useEffect, useState } from 'react';
import './App.css';
import { About } from './About';
import { Badge } from './Badge';
import { CounterfactualChart, TrajectoryChart } from './charts';
import { fmt, gateGloss, loadingCopy, outcomeFor, SCENARIOS, verdictFor } from './copy';
import { ParcelMap } from './Map';
import { hrefFor, useRoute } from './route';
import type { AssuranceBundle, BundleSource, ScenarioId, VerificationStatus } from './types';

const TREATMENT_DATE = '2024-10-15';
/** The verify service, proxied by nginx in the container and by Vite in development. */
const API = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`;

/**
 * Presentation only. The page asks the verify service to run the scenario
 * now; if the service is unreachable it falls back to the committed bundle
 * shipped with the page and says so. Nothing is recomputed here.
 */
async function loadBundle(scenario: ScenarioId, signal: AbortSignal): Promise<{ bundle: AssuranceBundle; source: BundleSource }> {
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
  const [route, navigate] = useRoute();
  const go = (r: 'dashboard' | 'about') => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navigate(r);
  };
  return (
    <div className="shell">
      <header className="masthead">
        <h1>
          <a href={hrefFor('dashboard')} onClick={go('dashboard')}>Ecorestore Network</a>
          <span> / Kootenay Riparian Restoration · prototype verification</span>
        </h1>
        <nav className="site-nav" aria-label="site">
          <a href={hrefFor('dashboard')} onClick={go('dashboard')} aria-current={route === 'dashboard' ? 'page' : undefined}>Dashboard</a>
          <a href={hrefFor('about')} onClick={go('about')} aria-current={route === 'about' ? 'page' : undefined}>About</a>
        </nav>
      </header>
      {/* The dashboard stays mounted behind the About page, so a route change never discards a loaded run or starts another. */}
      {route === 'about' && <About onBack={go('dashboard')} />}
      <div hidden={route === 'about'}><Dashboard /></div>
    </div>
  );
}

function Dashboard() {
  const [scenario, setScenario] = useState<ScenarioId>('real');
  const [bundle, setBundle] = useState<AssuranceBundle | null>(null);
  const [source, setSource] = useState<BundleSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);
  // Status of each run once it has loaded, so its tab states what the rule did rather than what the scenario was built to show.
  const [outcomes, setOutcomes] = useState<Partial<Record<ScenarioId, VerificationStatus>>>({});
  // A new load clears the previous result at the event that starts it, not inside the
  // effect (react-hooks/set-state-in-effect).
  const clear = () => {
    setBundle(null);
    setSource(null);
    setError(null);
  };
  const select = (s: ScenarioId) => {
    if (s === scenario) return;
    clear();
    setScenario(s);
  };
  const rerun = () => {
    clear();
    setRunId((n) => n + 1);
  };

  useEffect(() => {
    const ctrl = new AbortController();
    loadBundle(scenario, ctrl.signal)
      .then(({ bundle: b, source: s }) => {
        setBundle(b);
        setSource(s);
        setOutcomes((o) => ({ ...o, [b.scenario]: b.result.verificationStatus }));
      })
      .catch((e: Error) => {
        if (!ctrl.signal.aborted) setError(e.message);
      });
    return () => ctrl.abort();
  }, [scenario, runId]);

  const r = bundle?.result;
  const ci = r?.uncertainty.interval;
  const engine = r?.analysisEngine ?? bundle?.runtime?.analysisEngine;
  const verdict = r ? verdictFor(r) : null;
  const farSet = r?.controlSets.find((c) => c.ring === 'far');
  const nearSet = r?.controlSets.find((c) => c.ring === 'near');
  const level = ci ? Math.round(ci.confidenceLevel * 100) : 95;

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
    <>
      <section className="runs" aria-labelledby="runs-heading">
        <div className="runs-intro">
          <h2 id="runs-heading">One committed rule, three runs</h2>
          <p className="muted">The same parcel, the same plan committed before the outcome was observable. Each run shows what the rule does with different evidence.</p>
        </div>
        <nav className="tabs" aria-label="scenario">
          {SCENARIOS.map((s) => (
            <button key={s.id} aria-pressed={scenario === s.id} onClick={() => select(s.id)} title={s.hint}>
              <span className="tab-label">{s.label}</span>
              <span className="tab-outcome">{outcomes[s.id] ? outcomeFor(outcomes[s.id]!) : s.outcome}</span>
            </button>
          ))}
        </nav>
      </section>

      {/* One live region: a scenario change is announced, and the retry sits beside the status it belongs to. */}
      <div className="status-line" role="status" aria-live="polite">
        {error && <p className="banner">{error} <button className="retry" onClick={rerun}>Re-run verification</button></p>}
        {!bundle && !error && <p className="muted">{loadingCopy(scenario)}</p>}
        {bundle && r && (
          <p className="muted runtime">
            {source?.kind === 'live'
              ? <>Verified just now by the verify service in {(source.elapsedMs / 1000).toFixed(1)} s · analysis <span className="mono">{engine?.name ?? 'unknown'} {engine?.version ?? ''}</span> · result <span className="mono">{r.resultHash.slice(0, 14)}…</span></>
              : <>Showing the committed demonstration bundle: {source?.reason ?? 'live verification unavailable'} · analysis <span className="mono">{engine?.name ?? 'ecorestore-analysis-ts'} {engine?.version ?? ''}</span></>}
            {' '}<button className="retry" onClick={rerun}>Re-run verification</button>
          </p>
        )}
      </div>

      {bundle && r && ci && verdict && (
        <>
          <p className={`banner ${bundle.tier0Provenance.provenance === 'REAL' ? 'real' : ''}`}>
            <Badge p={bundle.tier0Provenance.provenance} /> Tier 0 — {bundle.tier0Provenance.provenance === 'REAL' ? `${r.stacSceneIds.length} real Sentinel-2 L2A acquisitions (${bundle.tier0Provenance.collection}), processing graph ${r.processingGraphVersion}.` : bundle.tier0Provenance.note}
            {' '}<Badge p="SIMULATED" /> Tiers 1–3 — {bundle.simulatedTiersBanner}
          </p>

          <section className="band primary" aria-labelledby="band-1">
            <h2 id="band-1">What was claimed, and what settled</h2>
            <div className="grid">
              <div className={`card span-12 verdict ${verdict.released ? 'released' : 'withheld'}`}>
                {bundle.tier0Provenance.provenance !== 'REAL' && (
                  <p className="banner inset"><Badge p="SIMULATED" /> {bundle.simulatedTiersBanner} This settlement is driven by a synthetic treatment effect injected into the real series.</p>
                )}
                <p className="verdict-headline">{verdict.headline}</p>
                <p className="verdict-explain">{verdict.explanation}</p>
                <div className="hero">
                  <div>
                    <div className="big">{fmt(r.settledQuantity)}<small>ha defensible</small></div>
                    <div className="sub">would survive an audit · settled at the lower {level}% bound</div>
                  </div>
                  <div>
                    <div className="big claimed">{fmt(r.claimedQuantity)}<small>ha claimed</small></div>
                    <div className="sub">at risk of restatement · claimed by the restorer <Badge p="SIMULATED" /></div>
                  </div>
                  <div className="trace">
                    <div><span className="badge status">{r.verificationStatus}</span></div>
                    <div className="sub">engine record: <span className="mono">{r.statusReason}</span></div>
                  </div>
                </div>
              </div>

              <section className="card span-12">
                <h3>From the claim to the settled quantity</h3>
                <CounterfactualChart r={r} />
              </section>
            </div>
          </section>

          <section className="band" aria-labelledby="band-2">
            <h2 id="band-2">How that number was reached</h2>
            <p className="muted band-intro">The derivation is a sequence. Each step below feeds the next.</p>
            <div className="grid">
              <section className="card span-12 step">
                <h3><span className="step-n">1</span> Did the parcel outgrow comparable land nearby?</h3>
                <TrajectoryChart points={bundle.trajectory.points} treatmentDate={TREATMENT_DATE} tier0Provenance={bundle.tier0Provenance.provenance} controlProvenance={bundle.spatial?.controls.provenance ?? bundle.tier0Provenance.provenance} rings={{ near: nearSet?.geometry, far: farSet?.geometry }} />
                <p className="muted" style={{ marginBottom: 0 }}>
                  Parcel change {fmt(r.measured.parcelChangeHa)} ha against {fmt(r.measured.controlChangeFarRingHa)} ha on far-ring comparison land. Far ring {farSet?.geometry.innerM}–{farSet?.geometry.outerM} m, {farSet?.matched} of {farSet?.candidates} candidates matched · near ring 0–{nearSet?.geometry.outerM} m, {nearSet?.matched} matched. The plan committed at deed creation ({r.analysisPlanHash.slice(0, 12)}…) draws the controls; nobody chooses them at verification time.
                </p>
              </section>

              <section className="card span-12 step">
                <h3><span className="step-n">2</span> Where the parcel is, and which land it was compared with</h3>
                <ParcelMap spatial={bundle.spatial} tier0Provenance={bundle.tier0Provenance.provenance} />
              </section>

              <section className="card span-6 step">
                <h3><span className="step-n">3</span> How certain the measurement is</h3>
                <dl className="kv">
                  <dt>Best estimate</dt><dd>{fmt(r.measured.additionalBiophysicalHa)} ha additional</dd>
                  <dt>{level}% interval</dt><dd>[{fmt(ci.lower)}, {fmt(ci.upper)}] ha · the rule pays the lower end</dd>
                  <dt>Empirical coverage</dt><dd>{r.uncertainty.empiricalCoverage.empirical ?? 'n/a'} against {r.uncertainty.empiricalCoverage.nominal} nominal, over {r.uncertainty.empiricalCoverage.placebos} placebo parcels</dd>
                  <dt>Parallel trend</dt>
                  <dd>
                    <span className={r.parallelTrend.status === 'PASS' ? 'gate-pass' : r.parallelTrend.status === 'FAIL' ? 'gate-fail' : 'gate-na'}>{r.parallelTrend.status}</span>
                    {' '}· p {r.parallelTrend.pValue ?? 'n/a'} · Δslope {r.parallelTrend.slopeDiffPerYear ?? 'n/a'} NDVI/yr · n {r.parallelTrend.nObservations}
                    <div className="criterion">against the committed criterion: <span className="mono">{r.parallelTrend.criterion}</span></div>
                  </dd>
                  <dt>Run index</dt><dd>{r.runIndex}</dd>
                </dl>
              </section>

              <section className="card span-6 step">
                <h3><span className="step-n">4</span> What each source of evidence contributed</h3>
                <div className="table-scroll">
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
                </div>
                <h4>Gates the plan set</h4>
                <div className="table-scroll">
                  <table>
                    <tbody>
                      {r.qualityGate.gates.map((g) => (
                        <tr key={g.name}>
                          <td>{gateGloss(g.name)} <span className="mono muted">{g.name}</span></td>
                          <td className={g.status === 'PASS' ? 'gate-pass' : g.status === 'FAIL' ? 'gate-fail' : 'gate-na'}>{g.status}</td>
                          <td className="muted">{g.detail}{g.name === 'parallel_trend' ? <> · criterion <span className="mono">{r.parallelTrend.criterion}</span></> : null} <Badge p={g.provenance} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </section>

          <section className="band" aria-labelledby="band-3">
            <h2 id="band-3">What is on record</h2>
            <div className="grid">
              <section className="card span-12 build-state">
                <h3>What ran for this run, what is prepared, and why</h3>
                <dl className="kv">
                  <dt>Ran live</dt>
                  <dd>
                    The deterministic engine, <span className="mono">{engine?.name ?? 'unknown'} {engine?.version ?? ''}</span>, on {r.stacSceneIds.length} {bundle.tier0Provenance.provenance === 'REAL' ? 'real' : 'real, then synthetically perturbed,'} Sentinel-2 L2A scenes. The verdict credential is signed and checked on this page.
                    {bundle.contract.chain ? <> The Restoration Deed executed this verdict on a local demonstration chain (anvil, not Arc Testnet).</> : null}
                  </dd>
                  <dt>Prepared, not broadcast</dt>
                  <dd>
                    {bundle.contract.chain ? <>Nothing on Arc: the deed ran on the local chain above. </> : <>The <span className="mono">verifyMilestone</span> calldata for the Restoration Deed. </>}
                    {bundle.issuance.partition ? <>The outcome-token issuance calldata for {bundle.issuance.valueHa} ha.</> : <>No outcome token: {bundle.issuance.reason}.</>}
                  </dd>
                  <dt>{bundle.guardianSubmission.outcome.mode === 'sent' ? 'Delivered to Guardian' : 'Staged for Guardian'}</dt>
                  <dd>
                    {bundle.guardianSubmission.outcome.mode === 'sent'
                      ? guardianAccepted(bundle.guardianSubmission.outcome.httpStatus)
                        ? <>The gateway acknowledged the verdict document (HTTP {bundle.guardianSubmission.outcome.httpStatus}). No published policy has consumed it, so this is delivery, not a policy run.</>
                        : <>The gateway refused the verdict document (HTTP {bundle.guardianSubmission.outcome.httpStatus}). Nothing was submitted.</>
                      : bundle.guardianSubmission.outcome.mode === 'failed'
                        ? <>The verify service could not reach Guardian. The verdict document is staged, not submitted.</>
                        : <>No Guardian is configured. The verify service wrote the verdict document to its outbox and did not submit it.</>}
                  </dd>
                  <dt>Why</dt>
                  <dd>This page never broadcasts a transaction. The verify service holds no Arc deployer key and no Hedera operator account, so it prepares each record below and states whether it sent it. It computes the evidence CID and does not pin it.</dd>
                </dl>
              </section>

              <section className="card span-4">
                <h3>The verdict credential</h3>
                <dl className="kv">
                  <dt>Issuer</dt><dd className="mono">{bundle.verdictCredential.issuer}</dd>
                  <dt>Signature</dt><dd className={bundle.credentialCheck.signatureValid ? 'gate-pass' : 'gate-fail'}>{bundle.credentialCheck.signatureValid ? 'valid (Ed25519)' : 'INVALID'}</dd>
                  <dt>Schema</dt><dd className={bundle.credentialCheck.schemaValid ? 'gate-pass' : 'gate-fail'}>{bundle.credentialCheck.schemaValid ? 'valid' : 'INVALID'}</dd>
                  <dt>Result hash</dt><dd className="mono">{r.resultHash}</dd>
                  <dt>Evidence CID</dt><dd className="mono">{r.evidenceCid} <span className="muted">(computed, not pinned)</span></dd>
                </dl>
              </section>

              <section className="card span-4">
                <h3>Verdict delivery status</h3>
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
                  <dt>Outcome token</dt>
                  <dd>{bundle.issuance.partition ? <>{bundle.issuance.valueHa} ha into partition <span className="mono">{bundle.issuance.partition.slice(0, 14)}…</span> — calldata prepared, <strong>not broadcast</strong></> : <span className="muted">{bundle.issuance.reason}</span>}</dd>
                  <dt>Obligation status</dt><dd className="mono">{r.obligationStatus}</dd>
                </dl>
              </section>

              <section className="card span-4">
                <h3>Restoration Deed (Arc)</h3>
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
                  <p className="muted">Not broadcast. <span className="mono">verifyMilestone</span> calldata prepared: <span className="mono">{bundle.contract.verifyMilestone.calldata.slice(0, 26)}…</span></p>
                )}
                {bundle.contract.chain && (
                  <ol className="tx-list">
                    {bundle.contract.chain.txs.map((t) => <li key={t.hash}>{t.step} <span className="mono muted">{t.hash.slice(0, 12)}…</span></li>)}
                  </ol>
                )}
              </section>

              <section className="card span-8">
                <h3>Auditor explanation <span className="muted">(deterministic template · no LLM)</span></h3>
                <p className="narrative">{bundle.auditorReport.narrative}</p>
              </section>

              <section className="card span-4">
                <h3>Assurance export</h3>
                <p className="muted">Quantities with bounds, empirical coverage, provenance, {r.stacSceneIds.length} STAC scene IDs, processing graph, control-set and ring geometry, plan hash and run index, obligation status, verdict VC and transaction references.</p>
                <div className="actions"><button onClick={exportBundle}>Download assurance bundle (JSON)</button></div>
                <p className="muted" style={{ marginTop: 10 }}>Demonstration outcome. Not a regulatory credit, not certification.</p>
              </section>
            </div>
          </section>
        </>
      )}
    </>
  );
}
