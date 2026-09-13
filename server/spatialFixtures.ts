/**
 * Ecorestore Network — Synthetic parcel extents for the demo map (M6 UI)
 *
 * ============================================================================
 * SYNTHETIC DEMONSTRATION GEOMETRY. These polygons give the fictional
 * "Kootenay Riparian Restoration" parcels (verification/fixtures.ts) a
 * footprint the React UI can draw on a web map. They were drawn for this
 * prototype and sized so their planar area matches each parcel's declared
 * `areaHectares`. They are placed along the Kootenay River in the Creston
 * Valley, British Columbia, only so the map shows a plausible riparian
 * setting — no restoration project, land tenure, survey, or field boundary
 * at these coordinates is represented, and no claim about that ground is
 * made.
 * ============================================================================
 *
 * The M1 engine never reads this file. Spatial identity in M1 is a
 * placeholder hash of the parcel id
 * (verification/calculations/spatialIdentity.ts), the evidence hash covers
 * only the tabular observations, and no verification, Guardian, or
 * settlement value depends on these coordinates. This is presentation data,
 * served read-only by server/index.ts (`/api/geometry`) and drawn by
 * app/src/components/ProjectMap.tsx. It is not a spatial-verification
 * input, and adding it here does not implement the H3/STAC geospatial stack
 * described in proposals/idea-0.2.md.
 */

import type { ParcelRole, Project } from "../verification/models.js";

/** GeoJSON position: [longitude, latitude] in WGS 84 (EPSG:4326). */
export type Position = readonly [longitude: number, latitude: number];

export interface PolygonGeometry {
  readonly type: "Polygon";
  readonly coordinates: readonly (readonly Position[])[];
}

export interface ParcelFeatureProperties {
  readonly parcelId: string;
  readonly role: ParcelRole;
  readonly areaHectares: number;
  readonly landCover: string;
  readonly contaminationReason?: string;
  /** Always true — see the file header. */
  readonly synthetic: true;
}

export interface ParcelFeature {
  readonly type: "Feature";
  readonly id: string;
  readonly geometry: PolygonGeometry;
  readonly properties: ParcelFeatureProperties;
}

export interface ParcelFeatureCollection {
  readonly type: "FeatureCollection";
  readonly features: readonly ParcelFeature[];
}

/**
 * One closed exterior ring per parcel id, WGS 84 [lon, lat], counter-
 * clockwise. Generated from hand-drawn outlines scaled to the declared
 * hectares (planar equirectangular area, within 0.2% of `areaHectares`);
 * server/spatialFixtures.test.ts checks that agreement.
 */
export const SYNTHETIC_PARCEL_EXTENTS: Readonly<Record<string, readonly Position[]>> = {
  // FIXTURE_PARTIAL_SETTLEMENT / FIXTURE_FULL_SETTLEMENT — east bank, Creston Valley
  "KOOT-T-01": [[-116.58024, 49.12687], [-116.57614, 49.12625], [-116.57095, 49.12652], [-116.56862, 49.1284], [-116.56931, 49.13117], [-116.57327, 49.13215], [-116.57805, 49.13179], [-116.58065, 49.12974], [-116.58024, 49.12687]],
  "KOOT-C-01": [[-116.58131, 49.13671], [-116.57599, 49.13622], [-116.57194, 49.13738], [-116.57118, 49.14019], [-116.57422, 49.14193], [-116.57903, 49.14169], [-116.58195, 49.13995], [-116.58131, 49.13671]],
  "KOOT-C-04": [[-116.5774, 49.11602], [-116.5709, 49.11577], [-116.5683, 49.11798], [-116.56921, 49.12113], [-116.57402, 49.12206], [-116.57818, 49.1207], [-116.57896, 49.11832], [-116.5774, 49.11602]],
  // Adjacent to KOOT-T-01 — the fixture flags it as a known concurrent intervention.
  "KOOT-C-02": [[-116.56772, 49.12782], [-116.56306, 49.12738], [-116.5595, 49.1284], [-116.55883, 49.13087], [-116.5615, 49.1324], [-116.56572, 49.13218], [-116.56828, 49.13065], [-116.56772, 49.12782]],
  // Montane grassland bench up the east valley side — the fixture's non-matching control.
  "KOOT-C-03": [[-116.51297, 49.13999], [-116.50739, 49.13927], [-116.50015, 49.13963], [-116.49876, 49.14236], [-116.50182, 49.14473], [-116.50948, 49.14492], [-116.51352, 49.14309], [-116.51297, 49.13999]],
  // FIXTURE_PARALLEL_TREND_FAIL — a second fictional reach a few kilometres downstream
  "KOOT-T-02": [[-116.58725, 49.09825], [-116.58017, 49.09798], [-116.57733, 49.10039], [-116.57832, 49.10382], [-116.58357, 49.10484], [-116.5881, 49.10336], [-116.58895, 49.10076], [-116.58725, 49.09825]],
  "KOOT-C-05": [[-116.60282, 49.09084], [-116.59902, 49.09026], [-116.59421, 49.09051], [-116.59205, 49.09225], [-116.59269, 49.09482], [-116.59636, 49.09574], [-116.60079, 49.09541], [-116.6032, 49.0935], [-116.60282, 49.09084]],
  "KOOT-C-06": [[-116.58264, 49.0873], [-116.57647, 49.08652], [-116.56951, 49.08678], [-116.5661, 49.08816], [-116.56715, 49.08996], [-116.57371, 49.09056], [-116.58054, 49.09022], [-116.58304, 49.08902], [-116.58264, 49.0873]],
};

export interface ProjectExtent {
  readonly collection: ParcelFeatureCollection;
  /** Parcels of the project that have no synthetic extent (drawn nowhere, listed so the UI can say so). */
  readonly parcelsWithoutGeometry: readonly string[];
}

/**
 * Assembles a GeoJSON FeatureCollection for a project's treated parcel and
 * every candidate control parcel, copying the descriptive fields the map
 * needs straight from the fixture's `Parcel` records. It derives nothing:
 * eligibility, matching, and contamination decisions stay with the M1 engine
 * (`VerificationResult.diagnostics`), which the UI reads separately.
 */
export function buildProjectExtent(project: Project): ProjectExtent {
  const parcels = [project.treatedParcel, ...project.candidateControlParcels];
  const features: ParcelFeature[] = [];
  const parcelsWithoutGeometry: string[] = [];

  for (const parcel of parcels) {
    const ring = SYNTHETIC_PARCEL_EXTENTS[parcel.parcelId];
    if (!ring) {
      parcelsWithoutGeometry.push(parcel.parcelId);
      continue;
    }
    features.push({
      type: "Feature",
      id: parcel.parcelId,
      geometry: { type: "Polygon", coordinates: [ring] },
      properties: {
        parcelId: parcel.parcelId,
        role: parcel.role,
        areaHectares: parcel.areaHectares,
        landCover: parcel.characteristics.landCover,
        ...(parcel.contaminationReason !== undefined ? { contaminationReason: parcel.contaminationReason } : {}),
        synthetic: true,
      },
    });
  }

  return { collection: { type: "FeatureCollection", features }, parcelsWithoutGeometry };
}
