/**
 * Consistency checks for the synthetic parcel extents the demo map draws.
 * These guard the one thing the geometry promises — that it agrees with the
 * fixture record it decorates — not any scientific property.
 */
import { describe, expect, it } from "vitest";
import { FIXTURE_PARALLEL_TREND_FAIL, FIXTURE_PARTIAL_SETTLEMENT } from "../verification/fixtures.js";
import type { Project } from "../verification/models.js";
import { buildProjectExtent, SYNTHETIC_PARCEL_EXTENTS, type Position } from "./spatialFixtures.js";

/** The two fixtures server/index.ts serves to the UI. */
const SERVED_FIXTURES: Project[] = [FIXTURE_PARTIAL_SETTLEMENT, FIXTURE_PARALLEL_TREND_FAIL];

const METRES_PER_DEGREE_LATITUDE = 111_320;

/** Planar (equirectangular) area of a closed lon/lat ring in hectares — adequate at sub-kilometre scale. */
function ringAreaHectares(ring: readonly Position[]): number {
  const meanLatitude = ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length;
  const metresPerDegreeLongitude = METRES_PER_DEGREE_LATITUDE * Math.cos((meanLatitude * Math.PI) / 180);
  let twiceArea = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [lon1, lat1] = ring[index]!;
    const [lon2, lat2] = ring[index + 1]!;
    const x1 = lon1 * metresPerDegreeLongitude;
    const y1 = lat1 * METRES_PER_DEGREE_LATITUDE;
    const x2 = lon2 * metresPerDegreeLongitude;
    const y2 = lat2 * METRES_PER_DEGREE_LATITUDE;
    twiceArea += x1 * y2 - x2 * y1;
  }
  return Math.abs(twiceArea) / 2 / 10_000;
}

function boundingBox(ring: readonly Position[]): [number, number, number, number] {
  const lons = ring.map(([lon]) => lon);
  const lats = ring.map(([, lat]) => lat);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

describe("synthetic parcel extents", () => {
  it("every ring is a closed polygon inside British Columbia's Kootenay region", () => {
    for (const [parcelId, ring] of Object.entries(SYNTHETIC_PARCEL_EXTENTS)) {
      expect(ring.length, parcelId).toBeGreaterThanOrEqual(4);
      expect(ring[0], parcelId).toEqual(ring[ring.length - 1]);
      for (const [lon, lat] of ring) {
        expect(lon, parcelId).toBeGreaterThan(-117.5);
        expect(lon, parcelId).toBeLessThan(-115.5);
        expect(lat, parcelId).toBeGreaterThan(48.9);
        expect(lat, parcelId).toBeLessThan(49.6);
      }
    }
  });

  it.each(SERVED_FIXTURES.map((project) => [project.projectId, project] as const))(
    "%s: every parcel has an extent whose area matches its declared hectares",
    (_projectId, project) => {
      const { collection, parcelsWithoutGeometry } = buildProjectExtent(project);
      expect(parcelsWithoutGeometry).toEqual([]);
      expect(collection.features).toHaveLength(1 + project.candidateControlParcels.length);

      for (const feature of collection.features) {
        const ring = feature.geometry.coordinates[0]!;
        const area = ringAreaHectares(ring);
        const tolerance = feature.properties.areaHectares * 0.005;
        expect(Math.abs(area - feature.properties.areaHectares), feature.id).toBeLessThanOrEqual(tolerance);
        expect(feature.properties.synthetic).toBe(true);
      }
    },
  );

  it("copies role, land cover and contamination flags from the fixture without inventing any", () => {
    const { collection } = buildProjectExtent(FIXTURE_PARTIAL_SETTLEMENT);
    const byId = new Map(collection.features.map((feature) => [feature.id, feature.properties]));

    expect(byId.get("KOOT-T-01")).toMatchObject({ role: "treated", landCover: "riparian_forest", areaHectares: 46.5 });
    expect(byId.get("KOOT-C-02")).toMatchObject({ role: "control_candidate", contaminationReason: "known_concurrent_intervention" });
    expect(byId.get("KOOT-C-03")).toMatchObject({ role: "control_candidate", landCover: "montane_grassland" });
    expect(byId.get("KOOT-C-01")).not.toHaveProperty("contaminationReason");
  });

  it("parcels of one project do not overlap each other", () => {
    for (const project of SERVED_FIXTURES) {
      const boxes = buildProjectExtent(project).collection.features.map((feature) => ({
        id: feature.id,
        box: boundingBox(feature.geometry.coordinates[0]!),
      }));
      for (let a = 0; a < boxes.length; a += 1) {
        for (let b = a + 1; b < boxes.length; b += 1) {
          const [aMinLon, aMinLat, aMaxLon, aMaxLat] = boxes[a]!.box;
          const [bMinLon, bMinLat, bMaxLon, bMaxLat] = boxes[b]!.box;
          const disjoint = aMaxLon < bMinLon || bMaxLon < aMinLon || aMaxLat < bMinLat || bMaxLat < aMinLat;
          expect(disjoint, `${boxes[a]!.id} vs ${boxes[b]!.id}`).toBe(true);
        }
      }
    }
  });

  it("lists parcels it has no extent for instead of inventing one", () => {
    const project: Project = {
      ...FIXTURE_PARTIAL_SETTLEMENT,
      treatedParcel: { ...FIXTURE_PARTIAL_SETTLEMENT.treatedParcel, parcelId: "KOOT-T-99" },
    };
    const { collection, parcelsWithoutGeometry } = buildProjectExtent(project);
    expect(parcelsWithoutGeometry).toEqual(["KOOT-T-99"]);
    expect(collection.features.map((feature) => feature.id)).not.toContain("KOOT-T-99");
  });
});
