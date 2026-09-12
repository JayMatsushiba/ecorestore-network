import { describe, expect, it } from "vitest";
import { DEFAULT_METHODOLOGY_CONFIG } from "../config.js";
import { evaluateParallelTrend } from "../calculations/parallelTrend.js";
import { FIXTURE_PARALLEL_TREND_FAIL, FIXTURE_PARTIAL_SETTLEMENT } from "../fixtures.js";
import type { Parcel } from "../models.js";

function eligibleControls(project: typeof FIXTURE_PARTIAL_SETTLEMENT): readonly Parcel[] {
  return project.candidateControlParcels.filter(
    (p) => p.contaminationReason === undefined && p.characteristics.landCover === project.treatedParcel.characteristics.landCover,
  );
}

describe("evaluateParallelTrend", () => {
  it("PASSes when the treated parcel's pre-treatment slope matches its controls'", () => {
    const controls = eligibleControls(FIXTURE_PARTIAL_SETTLEMENT);
    const result = evaluateParallelTrend(
      FIXTURE_PARTIAL_SETTLEMENT.treatedParcel,
      controls,
      FIXTURE_PARTIAL_SETTLEMENT.evidence,
      DEFAULT_METHODOLOGY_CONFIG,
    );
    expect(result.status).toBe("PASS");
    // 2023-03-01 to 2025-03-01 is 731 days (spans a leap year), so the
    // 2-point slope is ~0.99932 pp/yr, not exactly 1.0 — precision here is
    // intentionally loose to reflect that real calendar arithmetic.
    expect(result.treatedSlopePerYear).toBeCloseTo(1.0, 2);
    expect(result.controlMeanSlopePerYear).toBeCloseTo(1.0, 2);
    expect(result.divergenceRatio).toBeCloseTo(0, 2);
  });

  it("FAILs when the treated parcel's pre-treatment slope diverges sharply from its controls'", () => {
    const result = evaluateParallelTrend(
      FIXTURE_PARALLEL_TREND_FAIL.treatedParcel,
      FIXTURE_PARALLEL_TREND_FAIL.candidateControlParcels,
      FIXTURE_PARALLEL_TREND_FAIL.evidence,
      DEFAULT_METHODOLOGY_CONFIG,
    );
    expect(result.status).toBe("FAIL");
    expect(result.treatedSlopePerYear).toBeCloseTo(5.0, 2);
    expect(result.controlMeanSlopePerYear).toBeCloseTo(1.0, 2);
    expect(result.divergenceRatio).toBeGreaterThan(DEFAULT_METHODOLOGY_CONFIG.parallelTrendToleranceRatio);
  });

  it("returns INSUFFICIENT_EVIDENCE when the treated parcel has fewer than two pre-treatment observations", () => {
    const singleObservationEvidence = FIXTURE_PARTIAL_SETTLEMENT.evidence.filter(
      (o) => !(o.parcelId === "KOOT-T-01" && o.evidenceId === "ev-a-t01-pre-early"),
    );
    const controls = eligibleControls(FIXTURE_PARTIAL_SETTLEMENT);
    const result = evaluateParallelTrend(
      FIXTURE_PARTIAL_SETTLEMENT.treatedParcel,
      controls,
      singleObservationEvidence,
      DEFAULT_METHODOLOGY_CONFIG,
    );
    expect(result.status).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.treatedSlopePerYear).toBeNull();
  });

  it("returns INSUFFICIENT_EVIDENCE when any eligible control lacks a computable slope", () => {
    const controls = eligibleControls(FIXTURE_PARTIAL_SETTLEMENT);
    const missingControlPreTrend = FIXTURE_PARTIAL_SETTLEMENT.evidence.filter(
      (o) => !(o.parcelId === "KOOT-C-01" && o.evidenceId === "ev-a-c01-pre-early"),
    );
    const result = evaluateParallelTrend(
      FIXTURE_PARTIAL_SETTLEMENT.treatedParcel,
      controls,
      missingControlPreTrend,
      DEFAULT_METHODOLOGY_CONFIG,
    );
    expect(result.status).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("is deterministic across repeated calls with identical inputs", () => {
    const controls = eligibleControls(FIXTURE_PARTIAL_SETTLEMENT);
    const first = evaluateParallelTrend(
      FIXTURE_PARTIAL_SETTLEMENT.treatedParcel,
      controls,
      FIXTURE_PARTIAL_SETTLEMENT.evidence,
      DEFAULT_METHODOLOGY_CONFIG,
    );
    const second = evaluateParallelTrend(
      FIXTURE_PARTIAL_SETTLEMENT.treatedParcel,
      controls,
      FIXTURE_PARTIAL_SETTLEMENT.evidence,
      DEFAULT_METHODOLOGY_CONFIG,
    );
    expect(first).toEqual(second);
  });
});
