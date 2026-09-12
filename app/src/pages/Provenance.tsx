import { api } from "../api/client";
import { AsyncBlock } from "../components/AsyncBlock";
import { useApi } from "../hooks/useApi";

interface TimelineEntry {
  key: string;
  title: string;
  blockNumber: string;
  transactionHash: string;
}

export function Provenance() {
  const state = useApi(() => api.deed(), []);

  return (
    <div>
      <h1>Provenance / Event History</h1>
      <p className="page__lede">
        The indexed event history for this deed, read from the local Graph Node (M5) — not a database this
        application writes to directly. Each entry corresponds to one <code>RestorationDeed.sol</code> event.
      </p>

      <div className="panel">
        <AsyncBlock state={state} subsystem="Graph event history">
          {(data) => {
            if (data.status !== "OK") {
              return <p>{data.reason}</p>;
            }
            const { history } = data;
            const entries: TimelineEntry[] = [
              { key: "created", title: `DeedCreated — deed ${history.deed.deedId}`, blockNumber: history.deed.createdBlock, transactionHash: history.deed.createdTxHash },
              ...history.fundings.map((f) => ({ key: f.id, title: "DeedFunded", blockNumber: f.blockNumber, transactionHash: f.transactionHash })),
              ...history.verifications.map((v) => ({
                key: v.id,
                title: `VerificationSubmitted — financiallyEligible=${v.financiallyEligible}`,
                blockNumber: v.blockNumber,
                transactionHash: v.transactionHash,
              })),
              ...history.settlements.map((s) => ({ key: s.id, title: "SettlementExecuted", blockNumber: s.blockNumber, transactionHash: s.transactionHash })),
              ...history.refunds.map((r) => ({ key: r.id, title: "RefundExecuted", blockNumber: r.blockNumber, transactionHash: r.transactionHash })),
              ...history.cancellations.map((c) => ({ key: c.id, title: "DeedCancelled", blockNumber: c.blockNumber, transactionHash: c.transactionHash })),
            ].sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber));

            return (
              <ul className="timeline">
                {entries.map((e) => (
                  <li key={e.key} className="timeline__item">
                    <div className="timeline__title">{e.title}</div>
                    <div className="timeline__meta">
                      block {e.blockNumber} — {e.transactionHash}
                    </div>
                  </li>
                ))}
              </ul>
            );
          }}
        </AsyncBlock>
      </div>
      <p className="boundary-note">
        The Graph is a read/index layer only — it cannot alter scientific results or financial state, and this page
        cannot write back to it.
      </p>
    </div>
  );
}
