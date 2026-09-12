import { describe, expect, it } from "vitest";
import { selectMatchedControls } from "../calculations/controlMatching.js";
import type { Parcel } from "../models.js";

const treated: Parcel = {
  parcelId: "T",
  role: "treated",
  areaHectares: 10,
  characteristics: {
    landCover: "riparian_forest",
    elevationMeters: 600,
    slopeDegrees: 6,
    aspect: "SW",
    soilType: "alluvial_loam",
    climateZone: "interior_temperate_wet",
  },
};

const tolerance = { elevationMeters: 150, slopeDegrees: 8 };

function withCharacteristics(overrides: Partial<Parcel["characteristics"]>, parcelId: string): Parcel {
  return {
    parcelId,
    role: "control_candidate",
    areaHectares: 10,
    characteristics: { ...treated.characteristics, ...overrides },
  };
}

describe("selectMatchedControls", () => {
  it("includes a candidate whose characteristics match within tolerance", () => {
    const candidate = withCharacteristics({ elevationMeters: 650, slopeDegrees: 7 }, "C1");
    const result = selectMatchedControls(treated, [candidate], tolerance);
    expect(result.eligibleControlParcelIds).toEqual(["C1"]);
    expect(result.excludedContaminated).toEqual([]);
    expect(result.excludedNonMatching).toEqual([]);
  });

  it("excludes a candidate outside the elevation tolerance", () => {
    const candidate = withCharacteristics({ elevationMeters: 1000 }, "C2");
    const result = selectMatchedControls(treated, [candidate], tolerance);
    expect(result.eligibleControlParcelIds).toEqual([]);
    expect(result.excludedNonMatching).toEqual(["C2"]);
  });

  it("excludes a candidate with a different land cover regardless of other characteristics", () => {
    const candidate = withCharacteristics({ landCover: "montane_grassland" }, "C3");
    const result = selectMatchedControls(treated, [candidate], tolerance);
    expect(result.eligibleControlParcelIds).toEqual([]);
    expect(result.excludedNonMatching).toEqual(["C3"]);
  });

  it("excludes a contaminated candidate even when its characteristics match", () => {
    const candidate: Parcel = {
      ...withCharacteristics({}, "C4"),
      contaminationReason: "known_concurrent_intervention",
    };
    const result = selectMatchedControls(treated, [candidate], tolerance);
    expect(result.eligibleControlParcelIds).toEqual([]);
    expect(result.excludedContaminated).toEqual([{ parcelId: "C4", reason: "known_concurrent_intervention" }]);
    expect(result.excludedNonMatching).toEqual([]);
  });

  it("is deterministic across repeated calls with identical inputs", () => {
    const candidates = [
      withCharacteristics({ elevationMeters: 650 }, "C1"),
      withCharacteristics({ elevationMeters: 1500 }, "C2"),
    ];
    const first = selectMatchedControls(treated, candidates, tolerance);
    const second = selectMatchedControls(treated, candidates, tolerance);
    expect(first).toEqual(second);
  });
});
