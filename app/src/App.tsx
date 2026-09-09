import { useEffect, useState } from 'react';
import './App.css';
import { CounterfactualChart, TrajectoryChart } from './charts';
import type { AssuranceBundle } from './types';

const SCENARIOS: Array<{ id: AssuranceBundle['scenario']; label: string }> = [
  { id: 'real', label: 'Real Tier 0' },
  { id: 'synthetic', label: 'Synthetic effect (labelled)' },
  { id: 'trend-failure', label: 'Parallel-trend failure' },
];

const TREATMENT_DATE = '2024-10-15';

function Badge({ p }: { p: 'REAL' | 'SIMULATED' }) {
  return <span className={`badge ${p === 'REAL' ? 'real' : 'simulated'}`}>{p}</span>;
}

function fmt(x: number, d = 2): string {
  return x.toFixed(d);
}

export default function App() {
  const [scenario, setScenario] = useState<AssuranceBundle['scenario']>('real');
  const [bundle, setBundle] = useState<AssuranceBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBundle(null);
    setError(null);
    fetch(`${import.meta.env.BASE_URL}demo/${scenario}/assurance-bundle.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((b: AssuranceBundle) => setBundle(b))
      .catch((e: Error) => setError(`Could not load demo bundle (${e.message}). Run \`npm run demo\` and copy out/demo into app/public/demo.`));
  }, [scenario]);

  const r = bundle?.result;
  const ci = r?.uncertainty.interval;

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
      {!bundle && !error && <p className="muted">Loading…</p>}

      {bundle && r && ci && (
        <>
          <p className={`banner ${bundle.tier0Provenance.provenance === 'REAL' ? 'real' : ''}`}>
            <Badge p={bundle.tier0Provenance.provenance} /> Tier 0 — {bundle.tier0Provenance.provenance === 'REAL' ? `${r.stacSceneIds.length} real Sentinel-2 L2A acquisitions (${bundle.tier0Provenance.collection}), processing graph ${r.processingGraphVersion}.` : bundle.tier0Provenance.note}
            {' '}<Badge p="SIMULATED" /> Tiers 1–3 — {bundle.simulatedTiersBanner}
          </p>

          <div className="grid">
            <section className="card span-8">
              <h2>Assurance-adjusted comparison</h2>
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
                <dt>Guardian</dt><dd>{bundle.presentation.guardian.stoodUp ? 'stood up' : 'not stood up'} · {bundle.guardianSubmission.outcome.mode === 'sent' ? 'submitted' : 'request staged, NOT submitted'}</dd>
                <dt>Endpoint</dt><dd className="mono">{bundle.guardianSubmission.request.method} {bundle.guardianSubmission.request.path}</dd>
                <dt>Issuance</dt>
                <dd>{bundle.issuance.partition ? <>{bundle.issuance.valueHa} ha into partition <span className="mono">{bundle.issuance.partition.slice(0, 14)}…</span> — calldata prepared, <strong>not broadcast</strong></> : <span className="muted">{bundle.issuance.reason}</span>}</dd>
                <dt>Obligation status</dt><dd className="mono">{r.obligationStatus}</dd>
              </dl>
            </section>

            <section className="card span-4">
              <h2>Restoration Deed (Arc)</h2>
              {bundle.contract.chain ? (
                <dl className="kv">
                  <dt>Chain</dt><dd>local demo chain · deed {bundle.contract.chain.deedId} · run {bundle.contract.chain.runIndex}</dd>
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
