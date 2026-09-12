import { api } from "../api/client";
import { AsyncBlock } from "../components/AsyncBlock";
import { AuditSummary } from "../components/AuditSummary";
import { useApi } from "../hooks/useApi";
import { useFixture } from "../fixtureContext";
import { StatusPill } from "../components/StatusPill";

function formatUsdc(raw: string | null, decimals = 6): string {
  if (raw === null) return "—";
  const n = Number(raw) / 10 ** decimals;
  return `${n.toFixed(2)} mUSDC`;
}

export function Financial() {
  const { fixture } = useFixture();
  const deedState = useApi(() => api.deed(), []);
  const arcState = useApi(() => api.arcPayloadPreview(fixture), [fixture]);
  const auditState = useApi(() => api.audit(fixture), [fixture]);

  return (
    <div>
      <h1>Financial / Restoration Deed</h1>
      <p className="page__lede">
        <code>RestorationDeed.sol</code> is the sole financial authority — it holds escrow and executes settlement.
        This page shows its real on-chain state (via the local Graph Node) for the one deed this prototype actually
        funded and settled. <strong>MockUSDC on a local Hardhat network — not real USDC, not a live deployment.</strong>
      </p>

      <div className="panel">
        <h2>Contract audit (selected verification case vs. on-chain deed)</h2>
        <p style={{ color: "var(--color-text-muted)", marginTop: -6 }}>
          The real output of <code>auditDeed()</code> (M5), cross-checking the deed below against the currently
          selected verification case above the page nav. The on-chain deed itself never changes when you switch
          cases — this is how a mismatch (e.g. selecting the Failure case) becomes visible.
        </p>
        <AsyncBlock state={auditState} subsystem="Auditor">{(data) => <AuditSummary data={data} />}</AsyncBlock>
      </div>

      <div className="panel">
        <h2>On-chain deed state (real, local Hardhat + Graph Node)</h2>
        <AsyncBlock state={deedState} subsystem="Graph-indexed deed data">
          {(data) => {
            if (data.status !== "OK") {
              return (
                <p>
                  <StatusPill status={data.status} /> — {data.reason}
                </p>
              );
            }
            const { deed } = data.history;
            return (
              <div className="field-grid">
                <div className="field">
                  <span className="field__label">Deed ID</span>
                  <span className="field__value">{deed.deedId}</span>
                </div>
                <div className="field">
                  <span className="field__label">Status</span>
                  <StatusPill status={deed.status} />
                </div>
                <div className="field">
                  <span className="field__label">Sponsor</span>
                  <span className="field__value field__value--mono">{deed.sponsor}</span>
                </div>
                <div className="field">
                  <span className="field__label">Beneficiary</span>
                  <span className="field__value field__value--mono">{deed.beneficiary}</span>
                </div>
                <div className="field">
                  <span className="field__label">Authorized verifier (address)</span>
                  <span className="field__value field__value--mono">{deed.authorizedVerifier}</span>
                </div>
                <div className="field">
                  <span className="field__label">Escrow / funded</span>
                  <span className="field__value">
                    {formatUsdc(deed.escrowAmount)} / {formatUsdc(deed.fundedAmount)}
                  </span>
                </div>
                <div className="field">
                  <span className="field__label">Verification ID</span>
                  <span className="field__value field__value--mono">{deed.verificationId ?? "—"}</span>
                </div>
                <div className="field">
                  <span className="field__label">Settled quantity (scaled)</span>
                  <span className="field__value">{deed.settledQuantityScaled ?? "—"}</span>
                </div>
                <div className="field">
                  <span className="field__label">Settlement amount</span>
                  <span className="field__value">{formatUsdc(deed.settlementAmount)}</span>
                </div>
                <div className="field">
                  <span className="field__label">Released amount</span>
                  <span className="field__value">{formatUsdc(deed.releasedAmount)}</span>
                </div>
              </div>
            );
          }}
        </AsyncBlock>
      </div>

      <div className="panel">
        <h2>Arc authorization payload (preview, selected verification case)</h2>
        <p style={{ color: "var(--color-text-muted)", marginTop: -6 }}>
          This is what <code>arc/payload.ts</code> would submit to <code>RestorationDeed.submitVerification()</code>{" "}
          for the currently-selected verification case above the page nav — computed here read-only; this UI never
          holds a signing key and never sends a transaction.
        </p>
        <AsyncBlock state={arcState} subsystem="Arc payload preview">
          {(data) =>
            data.eligible ? (
              <div className="field-grid">
                <div className="field">
                  <span className="field__label">Financially eligible</span>
                  <StatusPill status="OK" />
                </div>
                <div className="field">
                  <span className="field__label">Verification ID (hash)</span>
                  <span className="field__value field__value--mono">{data.onChainAuthorization?.verificationId}</span>
                </div>
                <div className="field">
                  <span className="field__label">Settled quantity (scaled)</span>
                  <span className="field__value">{data.onChainAuthorization?.settledQuantityScaled}</span>
                </div>
              </div>
            ) : (
              <p>
                <StatusPill status="FAILED" /> Not eligible — {data.reason}
              </p>
            )
          }
        </AsyncBlock>
      </div>

      <p className="boundary-note">
        Financial authority boundary: <code>RestorationDeed.authorizedVerifier</code> is the sole mechanism that can
        submit a verification for this deed. This UI cannot authorize, settle, or refund anything.
      </p>
    </div>
  );
}
