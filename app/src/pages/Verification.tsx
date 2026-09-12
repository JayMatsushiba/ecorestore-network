import { api } from "../api/client";
import { AsyncBlock } from "../components/AsyncBlock";
import { useApi } from "../hooks/useApi";
import { useFixture } from "../fixtureContext";
import { StatusPill } from "../components/StatusPill";
import type { VerificationResult } from "../api/types";

function UncertaintyBar({ result }: { result: VerificationResult }) {
  const { uncertainty } = result;
  if (uncertainty.status !== "VALID") {
    return <p style={{ color: "var(--color-text-muted)" }}>No uncertainty interval — {uncertainty.status.replaceAll("_", " ").toLowerCase()}.</p>;
  }
  const domainMin = Math.min(0, uncertainty.lowerBound);
  const domainMax = Math.max(uncertainty.upperBound, result.claimedQuantity) * 1.08;
  const pct = (v: number) => ((v - domainMin) / (domainMax - domainMin)) * 100;

  return (
    <div>
      <div className="uncertainty-bar">
        <div
          className="uncertainty-bar__range"
          style={{ left: `${pct(uncertainty.lowerBound)}%`, width: `${pct(uncertainty.upperBound) - pct(uncertainty.lowerBound)}%` }}
        />
        <div className="uncertainty-bar__point" style={{ left: `${pct(uncertainty.pointEstimate)}%` }} />
        <div className="uncertainty-bar__lower-marker" style={{ left: `${pct(result.settledQuantity)}%` }} />
      </div>
      <div className="uncertainty-legend">
        <span>Lower bound: {uncertainty.lowerBound.toFixed(2)} ha</span>
        <span>Point estimate: {uncertainty.pointEstimate.toFixed(2)} ha</span>
        <span>Upper bound: {uncertainty.upperBound.toFixed(2)} ha</span>
        <span>Declared confidence: {(uncertainty.confidenceLevel * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

function Pipeline({ result }: { result: VerificationResult }) {
  const steps: { label: string; ok: boolean; note: string }[] = [
    { label: "Control matching", ok: result.diagnostics.eligibleControlParcelIds.length > 0, note: `${result.diagnostics.eligibleControlParcelIds.length} eligible control(s)` },
    { label: "Parallel-trend diagnostic", ok: result.parallelTrendStatus === "PASS", note: result.parallelTrendStatus.replaceAll("_", " ") },
    { label: "Quality gate", ok: result.qualityGateStatus === "PASS", note: result.qualityGateStatus.replaceAll("_", " ") },
    {
      label: "Verification status",
      ok: result.verificationStatus === "VERIFIED" || result.verificationStatus === "PARTIAL",
      note: result.verificationStatus.replaceAll("_", " "),
    },
  ];
  return (
    <div className="pipeline">
      {steps.map((s) => (
        <div key={s.label} className={`pipeline__step pipeline__step--${s.ok ? "pass" : "fail"}`}>
          {s.label}: {s.note}
        </div>
      ))}
    </div>
  );
}

export function Verification() {
  const { fixture } = useFixture();
  const state = useApi(() => api.verification(fixture), [fixture]);

  return (
    <div>
      <h1>Verification</h1>
      <p className="page__lede">
        The actual output of <code>verifyProject()</code> — M1's deterministic pipeline (control matching →
        parallel-trend diagnostic → difference-in-differences → additionality → uncertainty → conservative lower
        bound). Nothing on this page is recalculated in the browser.
      </p>

      <AsyncBlock state={state} subsystem="Verification">
        {(data) => {
          const r = data.verificationResult;
          const did = r.observedChange - r.controlChange;
          return (
            <>
              <div className="panel">
                <h2>Pipeline</h2>
                <Pipeline result={r} />
              </div>

              <div className="panel">
                <h2>Result</h2>
                <div className="field-grid">
                  <div className="field">
                    <span className="field__label">Verification status</span>
                    <StatusPill status={r.verificationStatus} />
                  </div>
                  <div className="field">
                    <span className="field__label">Quality gate</span>
                    <StatusPill status={r.qualityGateStatus} />
                  </div>
                  <div className="field">
                    <span className="field__label">Claimed quantity</span>
                    <span className="field__value">{r.claimedQuantity.toFixed(2)} ha</span>
                  </div>
                  <div className="field">
                    <span className="field__label">Settled quantity (conservative)</span>
                    <span className="field__value">{r.settledQuantity.toFixed(2)} ha</span>
                  </div>
                  <div className="field">
                    <span className="field__label">Observed change (treated parcel)</span>
                    <span className="field__value">{r.observedChange.toFixed(2)} pp</span>
                  </div>
                  <div className="field">
                    <span className="field__label">Control change (counterfactual)</span>
                    <span className="field__value">{r.controlChange.toFixed(2)} pp</span>
                  </div>
                  <div className="field">
                    <span className="field__label">Difference-in-differences</span>
                    <span className="field__value">{did.toFixed(2)} pp</span>
                  </div>
                  <div className="field">
                    <span className="field__label">Additionality-adjusted</span>
                    <span className="field__value">{r.additionalityAdjusted.toFixed(2)} ha</span>
                  </div>
                  <div className="field">
                    <span className="field__label">Evidence hash</span>
                    <span className="field__value field__value--mono">{r.evidenceHash}</span>
                  </div>
                  <div className="field">
                    <span className="field__label">Parcel H3 root (simulated)</span>
                    <span className="field__value field__value--mono">{r.parcelH3Root}</span>
                  </div>
                </div>
              </div>

              <div className="panel">
                <h2>Uncertainty interval</h2>
                <UncertaintyBar result={r} />
                <p className="boundary-note">
                  The financial settlement quantity uses the <strong>lower bound</strong> of this interval, never the
                  point estimate — the conservative-settlement rule (docs/VERIFICATION.md §11).
                </p>
              </div>

              <div className="panel">
                <h2>Diagnostics</h2>
                <div className="field-grid">
                  <div className="field">
                    <span className="field__label">Eligible controls</span>
                    <span className="field__value">{r.diagnostics.eligibleControlParcelIds.join(", ") || "none"}</span>
                  </div>
                  <div className="field">
                    <span className="field__label">Excluded (contaminated)</span>
                    <span className="field__value">
                      {r.diagnostics.excludedContaminatedControls.map((c) => `${c.parcelId} (${c.reason.replaceAll("_", " ")})`).join(", ") || "none"}
                    </span>
                  </div>
                  <div className="field">
                    <span className="field__label">Excluded (non-matching)</span>
                    <span className="field__value">{r.diagnostics.excludedNonMatchingControlParcelIds.join(", ") || "none"}</span>
                  </div>
                  <div className="field">
                    <span className="field__label">Treated pre-treatment slope</span>
                    <span className="field__value">
                      {r.diagnostics.treatedPreTreatmentSlopePerYear?.toFixed(2) ?? "n/a"} pp/yr
                    </span>
                  </div>
                  <div className="field">
                    <span className="field__label">Control mean pre-treatment slope</span>
                    <span className="field__value">
                      {r.diagnostics.controlMeanPreTreatmentSlopePerYear?.toFixed(2) ?? "n/a"} pp/yr
                    </span>
                  </div>
                  <div className="field">
                    <span className="field__label">Parallel-trend divergence ratio</span>
                    <span className="field__value">{r.diagnostics.parallelTrendDivergenceRatio?.toFixed(3) ?? "n/a"}</span>
                  </div>
                </div>
              </div>
            </>
          );
        }}
      </AsyncBlock>
    </div>
  );
}
