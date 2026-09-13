const PIPELINE_STAGES: { stage: string; tools: string }[] = [
  { stage: "Environmental evidence", tools: "Synthetic satellite/ground observations — TypeScript fixtures" },
  {
    stage: "Deterministic spatial verification",
    tools: "Control matching, difference-in-differences, additionality, uncertainty — TypeScript verification engine",
  },
  {
    stage: "Guardian workflow",
    tools: "Methodology validation, verification authorization, credential issuance — Guardian adapter (models Hedera Guardian's role)",
  },
  { stage: "Financial settlement", tools: "Escrow, verification, and settlement on-chain — Solidity, OpenZeppelin, Hardhat" },
  { stage: "Vertical integration", tools: "Orchestrates verification → workflow → settlement into one flow — TypeScript" },
  { stage: "Blockchain indexing", tools: "Indexes on-chain deed events for query — The Graph Node, AssemblyScript subgraph, GraphQL" },
  { stage: "Auditor", tools: "Cross-checks on-chain and off-chain records — TypeScript, read-only correlation" },
  { stage: "Presentation", tools: "Read-only UI over the pipeline — React, TypeScript, Vite" },
];

export function About() {
  return (
    <div>
      <h1>About this prototype</h1>
      <p className="page__lede">
        Ecorestore Network is a prototype for spatially-verified restoration finance. This page states plainly what
        is real, what is local, what is mocked, and what is deferred — see <code>docs/DEVELOPMENT_LOG.md</code> for
        the full dated record.
      </p>

      <div className="panel">
        <h2>Architecture</h2>
        <p style={{ color: "var(--color-text-muted)", marginTop: -6 }}>
          The pipeline this prototype actually runs, stage by stage, and the tools behind each one.
        </p>
        <div className="pipeline" style={{ flexDirection: "column", alignItems: "stretch" }}>
          {PIPELINE_STAGES.map((s, i) => (
            <div key={s.stage}>
              <div className="pipeline__step">
                <div style={{ fontWeight: 600 }}>{s.stage}</div>
                <div style={{ color: "var(--color-text-muted)", fontWeight: 400, marginTop: 2 }}>{s.tools}</div>
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <div style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "2px 0" }} aria-hidden="true">
                  ↓
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Real / Local / Mock / Deferred</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Component</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>M1 verification engine</td>
              <td>Real</td>
            </tr>
            <tr>
              <td>RestorationDeed.sol execution</td>
              <td>Real Solidity, local Hardhat network</td>
            </tr>
            <tr>
              <td>Graph Node indexing</td>
              <td>Real Graph Node, local Docker stack</td>
            </tr>
            <tr>
              <td>Auditor correlation</td>
              <td>Real</td>
            </tr>
            <tr>
              <td>Hedera Guardian</td>
              <td>Mock adapter — no live Hedera deployment</td>
            </tr>
            <tr>
              <td>USDC</td>
              <td>MockUSDC — local test token, not real USDC</td>
            </tr>
            <tr>
              <td>Hosted / decentralized Graph Network</td>
              <td>Deferred</td>
            </tr>
            <tr>
              <td>AWS demo hosting</td>
              <td>CI/CD pipeline built (deploys this local demo stack to one EC2 host)</td>
            </tr>
            <tr>
              <td>Production hosting</td>
              <td>Deferred</td>
            </tr>
            <tr>
              <td>Production blockchain transactions</td>
              <td>Deferred — never performed by this prototype</td>
            </tr>
          </tbody>
        </table>
        <p className="boundary-note">
          <code>RestorationDeed.sol</code> and <code>MockUSDC</code> are already written to deploy to Arc Testnet
          unchanged — no contract code needs to change to go there. What's withheld is the actual connection: a real
          RPC endpoint, a funded testnet wallet, and a real testnet USDC address, none of which this prototype holds.
          Until that connection is supplied, every deed here is created, funded, and settled on a local, in-memory
          Hardhat network instead.
        </p>
      </div>

      <div className="panel">
        <h2>Synthetic data</h2>
        <p>
          "Kootenay Riparian Restoration" is a fictional project. Every observation, parcel characteristic, and
          measurement value in this application was authored to exercise the verification pipeline — none of it
          describes a real place, a real restoration effort, or a real environmental measurement. It must never be
          presented as field data, satellite data, or a regulatory environmental credit.
        </p>
      </div>
    </div>
  );
}
