import type { AuditResponse } from "../api/types";
import { StatusPill } from "./StatusPill";

/**
 * Renders one auditDeed() (M5) result: status, explanation, and any
 * anomalies. Shared by the Auditor page and by Financial/Provenance so the
 * same real cross-check (does the on-chain deed match the currently
 * selected verification case?) is visible wherever deed state is shown,
 * not only on a separate page a viewer might not open.
 */
export function AuditSummary({ data }: { data: AuditResponse }) {
  return (
    <>
      <div className="field-grid">
        <div className="field">
          <span className="field__label">Contract audit</span>
          <StatusPill status={data.status} />
        </div>
        <div className="field">
          <span className="field__label">Deed ID</span>
          <span className="field__value">{data.deedId ?? "—"}</span>
        </div>
      </div>
      <p style={{ marginTop: 12 }}>{data.explanation}</p>
      {data.anomalies.length > 0 && (
        <ul className="anomaly-list">
          {data.anomalies.map((a, i) => (
            <li key={i}>
              <strong>{a.code.replaceAll("_", " ")}</strong>: {a.message}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
