import { api } from "../api/client";
import { AsyncBlock } from "../components/AsyncBlock";
import { VerificationFlow } from "../components/VerificationFlow";
import { useApi } from "../hooks/useApi";
import { useFixture } from "../fixtureContext";
import { formatEvidenceSource, formatMetricLabel } from "../format";
import type { EvidenceObservation } from "../api/types";

function groupByParcel(evidence: EvidenceObservation[]): Map<string, EvidenceObservation[]> {
  const map = new Map<string, EvidenceObservation[]>();
  for (const obs of evidence) {
    const list = map.get(obs.parcelId) ?? [];
    list.push(obs);
    map.set(obs.parcelId, list);
  }
  return map;
}

export function Evidence() {
  const { fixture } = useFixture();
  const state = useApi(() => api.evidence(fixture), [fixture]);

  return (
    <div>
      <h1>Evidence</h1>
      <p className="page__lede">
        Every observation below is synthetic — authored for this prototype to exercise the verification pipeline, not
        measured from a real satellite pass or field visit. Values are plausible for canopy-cover monitoring, but no
        claim of a real measurement is made.
      </p>

      <AsyncBlock state={state} subsystem="Evidence data">
        {(data) => (
          <>
            <div className="panel">
              <h2>How evidence becomes a verification finding</h2>
              <p style={{ color: "var(--color-text-muted)", marginTop: -6 }}>
                The deterministic spatial verification pipeline: where observations come from, how they are structured,
                and the gated steps that turn them into a settled quantity.
              </p>
              <VerificationFlow evidence={data.evidence} />
            </div>

            <div className="panel">
              <h2>Observations — {formatMetricLabel(data.metric)}</h2>
              {Array.from(groupByParcel(data.evidence)).map(([parcelId, obs]) => (
                <div key={parcelId} style={{ marginBottom: 18 }}>
                  <h3>{parcelId}</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th>Observed at</th>
                        <th>Value (%)</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {obs.map((o) => (
                        <tr key={o.evidenceId}>
                          <td>{o.period.replace("_", "-")}</td>
                          <td>{o.observedAt}</td>
                          <td>{o.value.toFixed(1)}</td>
                          <td>{formatEvidenceSource(o.source)} (synthetic)</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              <p className="boundary-note">
                These are the exact <code>EvidenceObservation</code> records M1 consumes (
                <code>verification/fixtures.ts</code>) — this page does not derive, adjust, or reformat any value beyond
                display rounding.
              </p>
            </div>
          </>
        )}
      </AsyncBlock>
    </div>
  );
}
