import { api } from "../api/client";
import { AsyncBlock } from "../components/AsyncBlock";
import { useApi } from "../hooks/useApi";
import { useFixture } from "../fixtureContext";
import { StatusPill } from "../components/StatusPill";

export function GuardianPage() {
  const { fixture } = useFixture();
  const state = useApi(() => api.guardian(fixture), [fixture]);

  return (
    <div>
      <h1>Guardian</h1>
      <p className="page__lede">
        Hedera Guardian's role is environmental methodology, verification workflow, and credential issuance — never
        scientific calculation and never financial settlement. This page shows the real M2 workflow output for a
        mock Guardian adapter (<code>MockGuardianAdapter</code>), not a live Hedera Guardian deployment.
      </p>

      <AsyncBlock state={state} subsystem="Guardian workflow">
        {(data) => (
          <>
            <div className="panel">
              <h2>Workflow lifecycle</h2>
              <div className="field-grid">
                <div className="field">
                  <span className="field__label">Lifecycle state</span>
                  <StatusPill status={data.guardian.lifecycleState} />
                </div>
                <div className="field">
                  <span className="field__label">Submission accepted</span>
                  <StatusPill status={data.guardian.submission.accepted ? "OK" : "FAILED"} />
                </div>
                <div className="field">
                  <span className="field__label">Authorization</span>
                  <StatusPill
                    status={data.guardian.authorization === null ? "NOT_FOUND" : data.guardian.authorization.accepted ? "OK" : "FAILED"}
                  />
                </div>
                <div className="field">
                  <span className="field__label">Credential issued</span>
                  <StatusPill status={data.guardian.credential ? "CREDENTIAL_ISSUED" : "NOT_FOUND"} />
                </div>
              </div>
              {!data.guardian.submission.accepted && (
                <p className="boundary-note">Guardian rejected the submission: {data.guardian.submission.reason}</p>
              )}
              {data.guardian.authorization && !data.guardian.authorization.accepted && (
                <p className="boundary-note">Guardian refused authorization: {data.guardian.authorization.reason}</p>
              )}
            </div>

            {data.guardian.credential && (
              <div className="panel">
                <h2>Guardian credential</h2>
                <div className="field-grid">
                  <div className="field">
                    <span className="field__label">Credential ID</span>
                    <span className="field__value field__value--mono">{data.guardian.credential.credentialId}</span>
                  </div>
                  <div className="field">
                    <span className="field__label">Verifier</span>
                    <span className="field__value field__value--mono">{data.guardian.credential.verifierId}</span>
                  </div>
                  <div className="field">
                    <span className="field__label">Guardian policy version</span>
                    <span className="field__value field__value--mono">{data.guardian.credential.guardianPolicyVersion}</span>
                  </div>
                  <div className="field">
                    <span className="field__label">Methodology version</span>
                    <span className="field__value field__value--mono">{data.guardian.credential.methodologyVersion}</span>
                  </div>
                  <div className="field">
                    <span className="field__label">Settled quantity (copied from M1)</span>
                    <span className="field__value">{data.guardian.credential.settledQuantity.toFixed(2)} ha</span>
                  </div>
                  <div className="field">
                    <span className="field__label">Issued at</span>
                    <span className="field__value">{data.guardian.credential.issuedAt}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="panel">
              <h2>Financial eligibility</h2>
              <p>
                Guardian marks a submission <strong>financially eligible</strong> if and only if <code>qualityGateStatus === "PASS"</code>{" "}
                — it never independently decides eligibility. Current quality gate:{" "}
                <StatusPill status={data.verificationResult.qualityGateStatus} />
              </p>
              <p className="boundary-note">
                Real: {data.real}. Mock: {data.mock}.
              </p>
            </div>
          </>
        )}
      </AsyncBlock>
    </div>
  );
}
