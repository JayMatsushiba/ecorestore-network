import { Badge, StatusBadge, type BuildStatus } from './Badge';

/**
 * What Ecorestore Network is for, how it works, and what is actually built.
 *
 * The status table is the one place on the page that claims build state. It mirrors
 * `docs/ARCHITECTURE.md` §8; whoever moves a row there updates this table. No unbuilt
 * component appears in the present tense anywhere else on the page.
 */

interface ComponentRow {
  component: string;
  job: string;
  status: BuildStatus;
  note: string;
}

const COMPONENTS: ComponentRow[] = [
  { component: 'Spatial Verification Engine', job: 'Produces the scientific verification result.', status: 'runs', note: 'Deterministic, on real Sentinel-2 L2A scenes. It matches controls on pre-treatment level and slope only. Sentinel-1, Landsat and ICESat-2 ingest and terrain, soil and climate covariates are not built.' },
  { component: 'Hedera Guardian', job: 'Holds the methodology, workflow, credentials and outcomes.', status: 'prepared', note: 'The engine signs a verdict credential and builds the Guardian request. No Guardian instance runs in this demonstration; requests are staged, not submitted. Issuance calldata for the outcome token is prepared, never broadcast.' },
  { component: 'Arc Restoration Deed', job: 'Holds the escrow and decides settlement.', status: 'prepared', note: 'Built and covered by 31 contract tests. Not deployed to Arc Testnet: this environment holds no deployer key. The settlement call is prepared as calldata and never broadcast.' },
  { component: 'The Graph', job: 'Indexes blockchain history and serves reads.', status: 'not-built', note: 'No subgraph exists.' },
  { component: 'Auditor', job: 'Orchestrates the work and explains it.', status: 'runs', note: 'A rule-based boundary that writes a deterministic template. No language model narrates; that is not built.' },
  { component: 'React application', job: 'Presents the result.', status: 'runs', note: 'This page. It recomputes nothing.' },
  { component: 'x402 payment gateway', job: 'Charges for API access only. It never settles anything.', status: 'not-built', note: 'No endpoint charges for access.' },
  { component: 'Production financial settlement', job: 'Moves USDC against a verified outcome.', status: 'not-built', note: 'Demonstration outcomes are not regulatory credits and not certification.' },
];

export function About({ onBack }: { onBack: (e: React.MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <article className="about">
      <h2>What Ecorestore Network is for</h2>
      <p className="lede">
        Ecorestore Network releases capital for ecological restoration only against evidence of ecological change that is measured from space, bounded by its own uncertainty, and adjusted for what would have happened anyway.
      </p>
      <p>
        Today, restoration capital is paid at planting. Checking the outcome later costs too much with conventional monitoring, so nobody pays for the outcome. Free, continuous satellite observation removes that cost. That makes long-dated conditional payment affordable, and it lets a buyer hold an outcome that would survive an audit rather than a promise that might be restated.
      </p>
      <p>
        The buyer is a corporate reporting entity in a voluntary biodiversity market. The value it buys is insurance against restatement: one hectare that survives assurance is worth more than three that get restated.
      </p>

      <h2>How it works</h2>
      <p>The loop is short, and every step is on this page's dashboard.</p>
      <ol className="loop">
        <li><strong>Evidence.</strong> Sentinel-2 scenes over the parcel and over the land around it. Drone, sensor and ground reports corroborate; they never set the number.</li>
        <li><strong>Deterministic verification.</strong> A rule committed before the outcome was observable draws comparison land in two rings around the parcel, tests that parcel and controls moved together before treatment, measures the parcel's change against the controls, deducts leakage, and bootstraps an uncertainty interval.</li>
        <li><strong>Methodology workflow.</strong> The verdict is signed as a credential and handed to a methodology workflow that holds the policy, the review steps and the outcome record.</li>
        <li><strong>Programmable settlement.</strong> A deed holding escrowed USDC releases capital at the <em>lower bound</em> of the interval, never at the point estimate. If the lower bound is not above zero, it releases nothing.</li>
        <li><strong>Verified restoration outcome.</strong> The settled quantity becomes an outcome a buyer can hold, audit and retire.</li>
        <li><strong>Indexed history.</strong> Every verdict, run and settlement is readable afterwards.</li>
      </ol>
      <p>
        Three things make this different from a monitoring report. The comparison with nearby land sits inside the rule that moves money, not in a methodology document. The control set is drawn by a committed rule, not chosen at verification time. And settlement pays the lower bound, so an honest claim that the measurement cannot defend is not paid.
      </p>

      <h3>Each component has one job</h3>
      <p>The table below names every component and its one job. No component takes over another's. Two rules follow, and neither has an exception:</p>
      <ul className="rules">
        <li><strong>An AI-generated number never decides a financial settlement.</strong> The Auditor may run the engine and explain its result. It cannot alter the result or release funds.</li>
        <li><strong>Paying for an API request never triggers, influences or replaces a milestone settlement.</strong> Settlement is USDC on Arc. API payment is HBAR or HTS on Hedera. These are different networks, different accounts and different authority.</li>
      </ul>

      <h2>What you are looking at</h2>
      <h3>Which evidence is real</h3>
      <p>
        <Badge p="REAL" /> <strong>Tier 0 satellite evidence is real.</strong> Every Sentinel-2 L2A scene the dashboard cites is a real acquisition over a real parcel on the east bank of the Kootenay River in British Columbia. The page shows its scene identifiers and the processing graph version. The parcel is real ground; the deed, the intervention and its date are constructed, and no claim is made that a restoration took place there.
      </p>
      <p>
        <Badge p="SIMULATED" /> <strong>Tiers 1 to 3 are simulated.</strong> Drone plots, soil-moisture sensors and ground reports are generated from realistic parameters for the demonstration. They are labelled simulated everywhere they appear, and they never set the settled quantity.
      </p>
      <p>
        One run on the dashboard, <em>Injected effect</em>, adds a labelled synthetic gain to the real satellite series so the settlement path can be exercised. Its Tier 0 is marked simulated for that reason, and the run says which real snapshot it perturbed.
      </p>

      <h3>What is built</h3>
      <p>
        Some components in the loop are not running. The table is the one place this page states build state; it mirrors the milestone boundary in the project's architecture document. <StatusBadge s="runs" /> runs in this demonstration. <StatusBadge s="prepared" /> is built and produces its output, and that output is deliberately not sent. <StatusBadge s="not-built" /> does not exist.
      </p>
      <div className="table-scroll">
        <table className="components">
          <thead>
            <tr><th>Component</th><th>Its one job</th><th>Status</th><th>What that means here</th></tr>
          </thead>
          <tbody>
            {COMPONENTS.map((c) => (
              <tr key={c.component}>
                <th scope="row">{c.component}</th>
                <td>{c.job}</td>
                <td><StatusBadge s={c.status} /></td>
                <td className="muted">{c.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        Every outcome on the dashboard is a demonstration outcome. It is not a regulatory credit and not certification.
      </p>
      <p><a href="./" onClick={onBack}>Back to the dashboard</a></p>
    </article>
  );
}
