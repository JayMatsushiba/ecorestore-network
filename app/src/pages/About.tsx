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
        <div className="pipeline" style={{ flexDirection: "column", alignItems: "flex-start" }}>
          {[
            "Synthetic BC restoration project (Kootenay Riparian Restoration)",
            "M1 — deterministic spatial verification (real)",
            "M2 — Hedera Guardian methodology/credential workflow (Mock adapter)",
            "M3/M3.1 — RestorationDeed / Arc financial settlement (real Solidity, local Hardhat)",
            "M4 — vertical integration connecting M1 → M2 → Arc (real)",
            "M5 — The Graph indexing + Auditor correlation (real, local Graph Node)",
            "M6 — this React presentation layer",
          ].map((step) => (
            <div key={step} className="pipeline__step" style={{ width: "100%" }}>
              {step}
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
              <td>AWS / production hosting</td>
              <td>Deferred</td>
            </tr>
            <tr>
              <td>Production blockchain transactions</td>
              <td>Deferred — never performed by this prototype</td>
            </tr>
          </tbody>
        </table>
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
