import { api } from "../api/client";
import { AsyncBlock } from "../components/AsyncBlock";
import { AuditSummary } from "../components/AuditSummary";
import { useApi } from "../hooks/useApi";
import { useFixture } from "../fixtureContext";

export function AuditorPage() {
  const { fixture } = useFixture();
  const state = useApi(() => api.audit(fixture), [fixture]);

  return (
    <div>
      <h1>Auditor</h1>
      <p className="page__lede">
        The real output of <code>auditDeed()</code> (M5) — it retrieves the Graph-indexed history and cross-checks it
        against the selected M1 verification result and M2 credential. It cannot calculate a scientific result,
        choose a settlement quantity, or authorize anything; every outcome below is a plain report, never a repair.
      </p>

      <AsyncBlock state={state} subsystem="Auditor">
        {(data) => (
          <>
            <div className="panel">
              <h2>Audit report</h2>
              <AuditSummary data={data} />
            </div>

            <div className="panel">
              <h2>Authority boundary</h2>
              <ul>
                <li>Cannot calculate M1 scientific truth (never calls the verification engine's calculations directly)</li>
                <li>Cannot modify a VerificationResult</li>
                <li>Cannot choose or alter a settlement quantity</li>
                <li>Cannot authorize a verification or settlement</li>
                <li>Cannot release funds — no write path to Guardian, the Graph, or RestorationDeed exists here</li>
              </ul>
            </div>
          </>
        )}
      </AsyncBlock>
    </div>
  );
}
