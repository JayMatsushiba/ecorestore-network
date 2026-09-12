import { describe, expect, it } from "vitest";
import { DEFAULT_METHODOLOGY_CONFIG } from "../config.js";
import { computeDifferenceInDifferences } from "../calculations/differenceInDifferences.js";
import { computeAdditionality } from "../calculations/additionality.js";
import { FIXTURE_PARTIAL_SETTLEMENT } from "../fixtures.js";

describe("computeDifferenceInDifferences", () => {
  const controls = FIXTURE_PARTIAL_SETTLEMENT.candidateControlParcels.filter((p) =>
    ["KOOT-C-01", "KOOT-C-04"].includes(p.parcelId),
  );

  it("computes treated change, control change, and DiD from the synthetic fixture", () => {
    const result = computeDifferenceInDifferences(
      FIXTURE_PARTIAL_SETTLEMENT.treatedParcel,
      controls,
      FIXTURE_PARTIAL_SETTLEMENT.evidence,
      DEFAULT_METHODOLOGY_CONFIG,
    );

    expect(result.treatedPreTreatmentLevel).toBeCloseTo(24.0, 6);
    expect(result.treatedPostTreatmentLevel).toBeCloseTo(85.0, 6);
    expect(result.treatedObservedChange).toBeCloseTo(61.0, 6);

    expect(result.controlPreTreatmentLevel).toBeCloseTo(24.0, 6); // mean(23, 25)
    expect(result.controlPostTreatmentLevel).toBeCloseTo(39.0, 6); // mean(40, 38)
    expect(result.controlObservedChange).toBeCloseTo(15.0, 6); // mean(17, 13)

    expect(result.differenceInDifferences).toBeCloseTo(46.0, 6); // 61 - 15
  });

  it("throws if a required observation is missing (engine-level invariant, not expected at runtime)", () => {
    const evidenceMissingTreatedPost = FIXTURE_PARTIAL_SETTLEMENT.evidence.filter(
      (o) => o.evidenceId !== "ev-a-t01-post",
    );
    expect(() =>
      computeDifferenceInDifferences(
        FIXTURE_PARTIAL_SETTLEMENT.treatedParcel,
        controls,
        evidenceMissingTreatedPost,
        DEFAULT_METHODOLOGY_CONFIG,
      ),
    ).toThrow();
  });

  it("is deterministic across repeated calls with identical inputs", () => {
    const first = computeDifferenceInDifferences(
      FIXTURE_PARTIAL_SETTLEMENT.treatedParcel,
      controls,
      FIXTURE_PARTIAL_SETTLEMENT.evidence,
      DEFAULT_METHODOLOGY_CONFIG,
    );
    const second = computeDifferenceInDifferences(
      FIXTURE_PARTIAL_SETTLEMENT.treatedParcel,
      controls,
      FIXTURE_PARTIAL_SETTLEMENT.evidence,
      DEFAULT_METHODOLOGY_CONFIG,
    );
    expect(first).toEqual(second);
  });
});

describe("computeAdditionality", () => {
  it("converts the DiD percentage-point estimate to hectares using the treated parcel area", () => {
    const controls = FIXTURE_PARTIAL_SETTLEMENT.candidateControlParcels.filter((p) =>
      ["KOOT-C-01", "KOOT-C-04"].includes(p.parcelId),
    );
    const did = computeDifferenceInDifferences(
      FIXTURE_PARTIAL_SETTLEMENT.treatedParcel,
      controls,
      FIXTURE_PARTIAL_SETTLEMENT.evidence,
      DEFAULT_METHODOLOGY_CONFIG,
    );
    const additionality = computeAdditionality(did, FIXTURE_PARTIAL_SETTLEMENT.treatedParcel);

    // 46.0 pp / 100 * 46.5 ha = 21.39 ha
    expect(additionality.additionalityAdjustedHectares).toBeCloseTo(21.39, 6);
    expect(additionality.conversionAreaHectares).toBe(46.5);
  });
});
