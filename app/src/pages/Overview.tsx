import { api } from "../api/client";
import { AsyncBlock } from "../components/AsyncBlock";
import { useApi } from "../hooks/useApi";
import { useFixture } from "../fixtureContext";
import { StatusPill } from "../components/StatusPill";
import { ProjectMap } from "../components/ProjectMap";
import { formatMetricLabel } from "../format";

export function Overview() {
  const { fixture } = useFixture();
  const projectState = useApi(() => api.project(fixture), [fixture]);
  const verificationState = useApi(() => api.verification(fixture), [fixture]);
  const deedState = useApi(() => api.deed(), []);
  const geometryState = useApi(() => api.geometry(fixture), [fixture]);
  // Read straight from the real M1 result so the map colours controls the way the engine judged them.
  const eligibleControlParcelIds =
    verificationState.status === "ok" ? verificationState.data.verificationResult.diagnostics.eligibleControlParcelIds : undefined;

  return (
    <div>
      <h1>Project Overview</h1>
      <p className="page__lede">
        A single synthetic restoration project, carried end to end through the actual M1-M5 pipeline: deterministic
        verification, a Guardian workflow credential, and (for the success case) a real local blockchain settlement
        indexed by a local Graph Node.
      </p>

      <AsyncBlock state={projectState} subsystem="Project data">
        {(data) => (
          <div className="panel">
            <h2>{data.project.name}</h2>
            <p style={{ color: "var(--color-text-muted)", marginTop: -6 }}>{data.project.location}</p>
            <div className="field-grid">
              <div className="field">
                <span className="field__label">Project ID</span>
                <span className="field__value field__value--mono">{data.project.projectId}</span>
              </div>
              <div className="field">
                <span className="field__label">Parcel</span>
                <span className="field__value">
                  {data.project.treatedParcel.parcelId} ({data.project.treatedParcel.areaHectares} ha)
                </span>
              </div>
              <div className="field">
                <span className="field__label">Methodology version</span>
                <span className="field__value field__value--mono">{data.methodologyVersion}</span>
              </div>
              <div className="field">
                <span className="field__label">Metric</span>
                <span className="field__value">{formatMetricLabel(data.metric)}</span>
              </div>
              <div className="field">
                <span className="field__label">Claimed restoration outcome</span>
                <span className="field__value">{data.project.claimedQuantity.toFixed(2)} ha</span>
              </div>
              <div className="field">
                <span className="field__label">Observation window</span>
                <span className="field__value">
                  {data.project.window.preTreatmentStart} → {data.project.window.postTreatmentEnd}
                </span>
              </div>
            </div>
          </div>
        )}
      </AsyncBlock>

      <AsyncBlock state={geometryState} subsystem="Parcel extent data">
        {(data) => (
          <div className="panel">
            <h2>Project extent</h2>
            <p className="page__lede" style={{ marginBottom: 12 }}>
              Synthetic demonstration geometry: parcel footprints drawn for this prototype along the Kootenay River in
              the Creston Valley so the map has a plausible riparian setting. They are not surveyed, tenured, or
              observed boundaries, and no restoration project at these coordinates is represented.
            </p>
            <ProjectMap extent={data.extent} treatedParcelId={data.treatedParcelId} eligibleControlParcelIds={eligibleControlParcelIds} />
            {data.parcelsWithoutGeometry.length > 0 && (
              <p className="project-map__missing">
                No synthetic extent exists for {data.parcelsWithoutGeometry.join(", ")} — those parcels are not drawn.
              </p>
            )}
            <p className="boundary-note">
              Polygons come from <code>server/spatialFixtures.ts</code> via <code>/api/geometry</code>; the M1 engine never
              reads them — its spatial identity is a placeholder hash of the parcel id (docs/VERIFICATION.md). The optional
              imagery layer is EOX&apos;s public Sentinel-2 cloudless mosaic, for orientation only: this pipeline consumes
              no imagery, and its observations are synthetic values (see Evidence). Control eligibility on the map is read
              from the real <code>verifyProject()</code> diagnostics, not decided here.
            </p>
          </div>
        )}
      </AsyncBlock>

      <div className="panel">
        <h2>Current status</h2>
        <div className="field-grid">
          <div className="field">
            <span className="field__label">Verification status</span>
            <AsyncBlock state={verificationState} subsystem="Verification">
              {(data) => <StatusPill status={data.verificationResult.verificationStatus} />}
            </AsyncBlock>
          </div>
          <div className="field">
            <span className="field__label">Deed status (on-chain, indexed)</span>
            <AsyncBlock state={deedState} subsystem="Graph / deed data">
              {(data) => (data.status === "OK" ? <StatusPill status={data.history.deed.status} /> : <StatusPill status={data.status} />)}
            </AsyncBlock>
          </div>
        </div>
        <p className="boundary-note">
          This overview reads the real output of <code>verifyProject()</code> (M1) and the real Graph-indexed
          on-chain deed (M5) — it does not compute or estimate anything itself. See the Verification, Guardian, and
          Financial pages for the full chain.
        </p>
      </div>
    </div>
  );
}
