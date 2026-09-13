/**
 * Ecorestore Network — M6 UI
 *
 * Static flow diagram of the deterministic spatial verification pipeline:
 * how evidence sources (satellite imagery, field visits, …) become
 * structured observations, and how those observations pass through M1's
 * gated pipeline to a VerificationResult.
 *
 * Presentation only. The stage list mirrors docs/VERIFICATION.md §2 and the
 * order of calls in verification/engine.ts; the source families mirror the
 * `EvidenceSource` union in verification/models.ts plus the future inputs
 * docs/VERIFICATION.md §3 lists. The only thing read from live data is a
 * count of observation records per source, so the diagram can say honestly
 * which sources the loaded fixture actually contains. It computes no
 * verification value — the Verification page shows the real result of
 * running the pipeline on the same fixture.
 */
import { Link } from "react-router-dom";
import type { EvidenceObservation } from "../api/types";

interface SourceFamily {
  /** Matches `EvidenceObservation.source` for modelled sources. */
  key: string;
  label: string;
  detail: string;
  /** Whether verification/models.ts's `EvidenceSource` union has this member. */
  modelled: boolean;
}

const SOURCE_FAMILIES: readonly SourceFamily[] = [
  {
    key: "synthetic_satellite_optical",
    label: "Optical satellite imagery",
    detail: "Multispectral scenes reduced to a canopy-cover fraction per parcel and date.",
    modelled: true,
  },
  {
    key: "synthetic_satellite_sar",
    label: "Radar satellite imagery (SAR)",
    detail: "Cloud-independent vegetation-structure signal on the same parcel/date grid.",
    modelled: true,
  },
  {
    key: "synthetic_ground_report",
    label: "Field visits / ground reports",
    detail: "Plot surveys by field crews, recorded per parcel and date.",
    modelled: true,
  },
  {
    key: "future_drone_iot",
    label: "Drone & IoT sensors",
    detail: "Listed as future inputs in docs/VERIFICATION.md §3.",
    modelled: false,
  },
];

type StageKind = "gate" | "compute" | "output";

interface Stage {
  label: string;
  detail: string;
  kind: StageKind;
}

/** Order follows verification/engine.ts `verifyProject()`. */
const STAGES: readonly Stage[] = [
  {
    label: "Evidence sufficiency",
    detail: "Enough pre- and post-treatment observations for the treated parcel and each candidate control?",
    kind: "gate",
  },
  {
    label: "Control matching",
    detail: "Candidate controls matched on parcel characteristics; contaminated parcels excluded; minimum control count enforced.",
    kind: "gate",
  },
  {
    label: "Parallel-trend diagnostic",
    detail: "Pre-treatment slopes of treated and control parcels must not diverge beyond tolerance.",
    kind: "gate",
  },
  {
    label: "Difference-in-differences",
    detail: "Observed change on the treated parcel minus the mean change on eligible controls.",
    kind: "compute",
  },
  {
    label: "Additionality",
    detail: "Adjusted change converted to hectares of the treated parcel.",
    kind: "compute",
  },
  {
    label: "Uncertainty",
    detail: "Lower and upper bound around the point estimate at a declared confidence level.",
    kind: "compute",
  },
  {
    label: "Conservative lower bound",
    detail: "The settled quantity is the lower bound, never the point estimate.",
    kind: "compute",
  },
  {
    label: "Quality gate",
    detail: "Every prior gate must PASS and the uncertainty interval must be valid.",
    kind: "gate",
  },
  {
    label: "VerificationResult",
    detail: "Status, claimed vs settled quantity, evidence hash, diagnostics — the finding Guardian and Arc consume.",
    kind: "output",
  },
];

function countBySource(evidence: readonly EvidenceObservation[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const obs of evidence) {
    counts.set(obs.source, (counts.get(obs.source) ?? 0) + 1);
  }
  return counts;
}

function sourceStatus(family: SourceFamily, count: number): { text: string; present: boolean } {
  if (count > 0) {
    return { text: `${count} synthetic observation${count === 1 ? "" : "s"} in this fixture`, present: true };
  }
  if (family.modelled) {
    return { text: "In the data model — none in this fixture", present: false };
  }
  return { text: "Not yet in the data model", present: false };
}

export function VerificationFlow({ evidence }: { evidence: readonly EvidenceObservation[] }) {
  const counts = countBySource(evidence);

  return (
    <figure className="flow" aria-label="Flow diagram: evidence sources to verification finding">
      <section className="flow__band">
        <h3 className="flow__band-title">1 · Evidence sources</h3>
        <ul className="flow__sources">
          {SOURCE_FAMILIES.map((family) => {
            const status = sourceStatus(family, counts.get(family.key) ?? 0);
            return (
              <li
                key={family.key}
                className={`flow__node flow__source${status.present ? " flow__source--present" : " flow__source--absent"}`}
                data-testid={`flow-source-${family.key}`}
              >
                <div className="flow__node-title">{family.label}</div>
                <div className="flow__node-detail">{family.detail}</div>
                <div className="flow__source-status">{status.text}</div>
              </li>
            );
          })}
        </ul>
        <div className="flow__merge" aria-hidden="true" />
      </section>

      <section className="flow__band">
        <h3 className="flow__band-title">2 · Structured evidence</h3>
        <div className="flow__node flow__node--wide">
          <div className="flow__node-title">
            One <code>EvidenceObservation</code> record per parcel, metric and date
          </div>
          <div className="flow__node-detail">
            parcel · metric · period (pre- or post-treatment) · value · observed date · source · <code>synthetic: true</code>.
            The engine hashes this set into the evidence hash carried by the result.
          </div>
        </div>
        <div className="flow__split" aria-hidden="true">
          <span />
          <span />
        </div>
        <div className="flow__pair">
          <div className="flow__node">
            <div className="flow__node-title">Treated parcel</div>
            <div className="flow__node-detail">Pre-treatment baseline and post-treatment observations of the restored parcel.</div>
          </div>
          <div className="flow__node">
            <div className="flow__node-title">Candidate control parcels</div>
            <div className="flow__node-detail">Untreated parcels observed over the same periods — the counterfactual.</div>
          </div>
        </div>
        <div className="flow__merge" aria-hidden="true" />
      </section>

      <section className="flow__band">
        <h3 className="flow__band-title">
          3 · Deterministic pipeline — <code>verifyProject()</code>
        </h3>
        <ol className="flow__stages">
          {STAGES.map((stage, i) => (
            <li key={stage.label} className={`flow__stage flow__stage--${stage.kind}`} data-testid="flow-stage">
              <div className="flow__node-title">
                <span className="flow__stage-index">{i + 1}</span>
                {stage.label}
                {stage.kind === "gate" && <span className="flow__tag">gate</span>}
              </div>
              <div className="flow__node-detail">{stage.detail}</div>
            </li>
          ))}
        </ol>
        <ul className="flow__legend">
          <li>
            <span className="flow__swatch flow__swatch--gate" /> Gate — a failure here stops the pipeline: status{" "}
            <code>INSUFFICIENT_EVIDENCE</code>, settled quantity 0.
          </li>
          <li>
            <span className="flow__swatch flow__swatch--compute" /> Calculation — pure, deterministic, no AI component.
          </li>
          <li>
            <span className="flow__swatch flow__swatch--output" /> Output — the finding shown on the{" "}
            <Link to="/verification">Verification page</Link>.
          </li>
        </ul>
      </section>

      <figcaption className="boundary-note">
        This diagram describes the pipeline in <code>verification/engine.ts</code> (docs/VERIFICATION.md §2). The
        source counts above are record counts from the loaded fixture; every other value on this page is displayed as
        received. In this prototype all sources are synthetic — no real satellite scene or field visit has been
        ingested.
      </figcaption>
    </figure>
  );
}
