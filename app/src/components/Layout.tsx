import { NavLink, Outlet } from "react-router-dom";
import { useFixture } from "../fixtureContext";

const NAV_ITEMS = [
  { to: "/", label: "Overview", end: true },
  { to: "/evidence", label: "Evidence" },
  { to: "/verification", label: "Verification" },
  { to: "/guardian", label: "Guardian" },
  { to: "/financial", label: "Financial / Deed" },
  { to: "/provenance", label: "Provenance" },
  { to: "/auditor", label: "Auditor" },
  { to: "/about", label: "About" },
];

export function Layout() {
  const { fixture, setFixture } = useFixture();

  return (
    <>
      <div className="disclaimer-banner">
        SYNTHETIC DEMONSTRATION DATA — not field measurements, not satellite observations, not a regulatory
        environmental credit.
      </div>
      <header className="app-header">
        <div className="app-header__bar">
          <div>
            <div className="app-header__title">Ecorestore Network</div>
            <div className="app-header__subtitle">Spatially-verified restoration finance — prototype demonstration</div>
          </div>
          <nav className="app-nav">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? "active" : "")}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <label className="fixture-toggle">
            Verification case:
            <select value={fixture} onChange={(e) => setFixture(e.target.value as typeof fixture)}>
              <option value="partial">Success (PARTIAL settlement)</option>
              <option value="trendFail">Failure (insufficient evidence)</option>
            </select>
          </label>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
      <footer className="app-footer">
        Ecorestore Network prototype — local demonstration only. No live Hedera Guardian, Arc, or Graph Network
        deployment. See <code>docs/DEMO.md</code>.
      </footer>
    </>
  );
}
