import { HashRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { FixtureProvider } from "./fixtureContext";
import { Overview } from "./pages/Overview";
import { Evidence } from "./pages/Evidence";
import { Verification } from "./pages/Verification";
import { GuardianPage } from "./pages/Guardian";
import { Financial } from "./pages/Financial";
import { Provenance } from "./pages/Provenance";
import { AuditorPage } from "./pages/AuditorPage";
import { About } from "./pages/About";

export default function App() {
  return (
    <FixtureProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="evidence" element={<Evidence />} />
            <Route path="verification" element={<Verification />} />
            <Route path="guardian" element={<GuardianPage />} />
            <Route path="financial" element={<Financial />} />
            <Route path="provenance" element={<Provenance />} />
            <Route path="auditor" element={<AuditorPage />} />
            <Route path="about" element={<About />} />
          </Route>
        </Routes>
      </HashRouter>
    </FixtureProvider>
  );
}
