import { describe, expect, it } from "vitest";
import { DEFAULT_METHODOLOGY_CONFIG, STRICT_METHODOLOGY_CONFIG } from "../config.js";
import { verifyProject } from "../engine.js";
import {
  FIXTURE_FULL_SETTLEMENT,
  FIXTURE_INSUFFICIENT_CONTROLS,
  FIXTURE_INVALID_CLAIM,
  FIXTURE_MISSING_POST_EVIDENCE,
  FIXTURE_PARALLEL_TREND_FAIL,
  FIXTURE_PARTIAL_SETTLEMENT,
} from "../fixtures.js";

describe("verifyProject — successful verification (PARTIAL)", () => {
  const result = verifyProject(FIXTURE_PARTIAL_SETTLEMENT, DEFAULT_METHODOLOGY_CONFIG);

  it("passes the quality gate and the parallel-trend diagnostic", () => {
    expect(result.parallelTrendStatus).toBe("PASS");
    expect(result.qualityGateStatus).toBe("PASS");
  });

  it("computes the expected observed/control/additionality figures", () => {
    expect(result.observedChange).toBeCloseTo(61.0, 6);
    expect(result.controlChange).toBeCloseTo(15.0, 6);
    expect(result.additionalityAdjusted).toBeCloseTo(21.39, 6);
  });

  it("settles at the uncertainty lower bound, which is below the claim -> PARTIAL", () => {
    expect(result.lowerBound).toBeCloseTo(18.1815, 4);
    expect(result.settledQuantity).toBeCloseTo(result.lowerBound, 10);
    expect(result.settledQuantity).toBeLessThan(result.claimedQuantity);
    expect(result.verificationStatus).toBe("PARTIAL");
  });

  it("never settles above the declared lower bound", () => {
    expect(result.settledQuantity).toBeLessThanOrEqual(result.uncertainty.lowerBound + 1e-9);
  });

  it("carries the methodology version and metric from the config", () => {
    expect(result.methodologyVersion).toBe(DEFAULT_METHODOLOGY_CONFIG.methodologyVersion);
    expect(result.metric).toBe(DEFAULT_METHODOLOGY_CONFIG.metric);
  });

  it("produces a stable, non-empty parcel H3 root and evidence hash", () => {
    expect(result.parcelH3Root).toMatch(/^h3sim_[0-9a-f]{8}$/);
    expect(result.evidenceHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("does not populate evidenceCid in M1 (no storage integration exists yet)", () => {
    expect(result.evidenceCid).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(result, "evidenceCid")).toBe(false);
  });

  it("exposes intermediate diagnostics rather than hiding the calculation", () => {
    expect([...result.diagnostics.eligibleControlParcelIds].sort()).toEqual(["KOOT-C-01", "KOOT-C-04"]);
    expect(result.diagnostics.excludedContaminatedControls).toEqual([
      { parcelId: "KOOT-C-02", reason: "known_concurrent_intervention" },
    ]);
    expect(result.diagnostics.excludedNonMatchingControlParcelIds).toEqual(["KOOT-C-03"]);
  });
});

describe("verifyProject — successful verification (VERIFIED)", () => {
  it("settles as VERIFIED when the settled quantity fully covers a lower claim", () => {
    const result = verifyProject(FIXTURE_FULL_SETTLEMENT, DEFAULT_METHODOLOGY_CONFIG);
    expect(result.qualityGateStatus).toBe("PASS");
    expect(result.settledQuantity).toBeGreaterThanOrEqual(result.claimedQuantity);
    expect(result.verificationStatus).toBe("VERIFIED");
  });
});

describe("verifyProject — CRITICAL INVARIANT: failed parallel-trend blocks settlement", () => {
  const result = verifyProject(FIXTURE_PARALLEL_TREND_FAIL, DEFAULT_METHODOLOGY_CONFIG);

  it("reports the parallel-trend diagnostic as FAIL", () => {
    expect(result.parallelTrendStatus).toBe("FAIL");
  });

  it("does NOT produce a valid settlement quantity, even though the post-treatment value looks like a large gain", () => {
    expect(result.qualityGateStatus).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.verificationStatus).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.settledQuantity).toBe(0);
    expect(result.additionalityAdjusted).toBe(0);
  });

  it("never resolves to PASS or a positive settlement under any circumstance for this fixture", () => {
    // Re-run with the stricter config too — a failed parallel-trend result
    // must block settlement regardless of downstream configuration.
    const strict = verifyProject(FIXTURE_PARALLEL_TREND_FAIL, STRICT_METHODOLOGY_CONFIG);
    expect(strict.qualityGateStatus).not.toBe("PASS");
    expect(strict.settledQuantity).toBe(0);
  });
});

describe("verifyProject — insufficient evidence paths", () => {
  it("blocks settlement when the treated parcel has no post-treatment observation", () => {
    const result = verifyProject(FIXTURE_MISSING_POST_EVIDENCE, DEFAULT_METHODOLOGY_CONFIG);
    expect(result.qualityGateStatus).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.verificationStatus).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.settledQuantity).toBe(0);
  });

  it("blocks settlement when claimedQuantity is not positive", () => {
    const result = verifyProject(FIXTURE_INVALID_CLAIM, DEFAULT_METHODOLOGY_CONFIG);
    expect(result.qualityGateStatus).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.settledQuantity).toBe(0);
  });

  it("blocks settlement when fewer than minimumControlCount eligible controls remain after matching and contamination exclusion", () => {
    const result = verifyProject(FIXTURE_INSUFFICIENT_CONTROLS, DEFAULT_METHODOLOGY_CONFIG);
    expect(result.qualityGateStatus).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.settledQuantity).toBe(0);
    // The one clean, matching control should still show up as eligible in
    // diagnostics, and the contaminated one should be recorded as excluded —
    // this is a control-count shortfall, not a matching or contamination bug.
    expect(result.diagnostics.eligibleControlParcelIds).toEqual(["KOOT-C-09"]);
    expect(result.diagnostics.excludedContaminatedControls).toEqual([
      { parcelId: "KOOT-C-10", reason: "shared_hydrology_with_treated_parcel" },
    ]);
  });
});

describe("verifyProject — determinism", () => {
  it("CRITICAL: produces an identical canonical result for identical inputs, run repeatedly", () => {
    const first = verifyProject(FIXTURE_PARTIAL_SETTLEMENT, DEFAULT_METHODOLOGY_CONFIG);
    const second = verifyProject(FIXTURE_PARTIAL_SETTLEMENT, DEFAULT_METHODOLOGY_CONFIG);
    const third = verifyProject(FIXTURE_PARTIAL_SETTLEMENT, DEFAULT_METHODOLOGY_CONFIG);
    expect(first).toEqual(second);
    expect(second).toEqual(third);
  });

  it("is deterministic for the blocked (parallel-trend FAIL) path too", () => {
    const first = verifyProject(FIXTURE_PARALLEL_TREND_FAIL, DEFAULT_METHODOLOGY_CONFIG);
    const second = verifyProject(FIXTURE_PARALLEL_TREND_FAIL, DEFAULT_METHODOLOGY_CONFIG);
    expect(first).toEqual(second);
  });
});

describe("verifyProject — methodology configuration sensitivity", () => {
  it("produces a different methodologyVersion and tighter interval under the strict demo config", () => {
    const defaultResult = verifyProject(FIXTURE_PARTIAL_SETTLEMENT, DEFAULT_METHODOLOGY_CONFIG);
    const strictResult = verifyProject(FIXTURE_PARTIAL_SETTLEMENT, STRICT_METHODOLOGY_CONFIG);

    expect(strictResult.methodologyVersion).not.toBe(defaultResult.methodologyVersion);
    expect(strictResult.methodologyVersion).toBe(STRICT_METHODOLOGY_CONFIG.methodologyVersion);

    // Same point estimate (additionality math doesn't depend on the
    // uncertainty/trend-tolerance parameters that differ here)...
    expect(strictResult.additionalityAdjusted).toBeCloseTo(defaultResult.additionalityAdjusted, 6);
    // ...but a tighter uncertainty margin means a higher (less conservative)
    // lower bound / settled quantity under the strict config.
    expect(strictResult.settledQuantity).toBeGreaterThan(defaultResult.settledQuantity);
  });

  it("both configs still pass the parallel-trend diagnostic for this fixture (slopes match exactly)", () => {
    const defaultResult = verifyProject(FIXTURE_PARTIAL_SETTLEMENT, DEFAULT_METHODOLOGY_CONFIG);
    const strictResult = verifyProject(FIXTURE_PARTIAL_SETTLEMENT, STRICT_METHODOLOGY_CONFIG);
    expect(defaultResult.parallelTrendStatus).toBe("PASS");
    expect(strictResult.parallelTrendStatus).toBe("PASS");
  });
});

describe("verifyProject — evidenceHash and parcelH3Root stability", () => {
  it("evidenceHash is insensitive to the order of the evidence array (canonicalized before hashing)", () => {
    const reordered = {
      ...FIXTURE_PARTIAL_SETTLEMENT,
      evidence: [...FIXTURE_PARTIAL_SETTLEMENT.evidence].reverse(),
    };
    const original = verifyProject(FIXTURE_PARTIAL_SETTLEMENT, DEFAULT_METHODOLOGY_CONFIG);
    const reorderedResult = verifyProject(reordered, DEFAULT_METHODOLOGY_CONFIG);
    expect(reorderedResult.evidenceHash).toBe(original.evidenceHash);
  });

  it("parcelH3Root depends only on the treated parcel id, not on evidence content", () => {
    const result = verifyProject(FIXTURE_PARTIAL_SETTLEMENT, DEFAULT_METHODOLOGY_CONFIG);
    const resultAgain = verifyProject(FIXTURE_FULL_SETTLEMENT, DEFAULT_METHODOLOGY_CONFIG); // same treated parcel id
    expect(result.parcelH3Root).toBe(resultAgain.parcelH3Root);
  });
});
