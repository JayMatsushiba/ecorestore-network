import { describe, expect, it } from "vitest";
import { evaluateQualityGate } from "../calculations/qualityGate.js";

describe("evaluateQualityGate", () => {
  it("returns PASS only when evidence is sufficient, trend PASSed, and uncertainty is VALID", () => {
    expect(
      evaluateQualityGate({ hasSufficientEvidence: true, parallelTrendStatus: "PASS", uncertaintyStatus: "VALID" }),
    ).toBe("PASS");
  });

  it("returns INSUFFICIENT_EVIDENCE when evidence is insufficient, regardless of trend/uncertainty", () => {
    expect(
      evaluateQualityGate({ hasSufficientEvidence: false, parallelTrendStatus: "PASS", uncertaintyStatus: "VALID" }),
    ).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("returns INSUFFICIENT_EVIDENCE when the parallel-trend diagnostic FAILed", () => {
    expect(
      evaluateQualityGate({ hasSufficientEvidence: true, parallelTrendStatus: "FAIL", uncertaintyStatus: null }),
    ).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("returns INSUFFICIENT_EVIDENCE when the parallel-trend diagnostic itself was INSUFFICIENT_EVIDENCE", () => {
    expect(
      evaluateQualityGate({
        hasSufficientEvidence: true,
        parallelTrendStatus: "INSUFFICIENT_EVIDENCE",
        uncertaintyStatus: null,
      }),
    ).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("returns INVALID_RESULT when evidence is sufficient and trend PASSed but uncertainty is invalid", () => {
    expect(
      evaluateQualityGate({
        hasSufficientEvidence: true,
        parallelTrendStatus: "PASS",
        uncertaintyStatus: "INVALID_CONFIGURATION",
      }),
    ).toBe("INVALID_RESULT");
  });

  it("never returns PASS when the parallel-trend diagnostic did not PASS, even with a large nominal effect implied elsewhere", () => {
    // This test encodes the hard invariant from the M1 prompt: a failed
    // parallel-trend diagnostic must never be overridden by the quality
    // gate, no matter what other inputs look like.
    const result = evaluateQualityGate({
      hasSufficientEvidence: true,
      parallelTrendStatus: "FAIL",
      uncertaintyStatus: "VALID",
    });
    expect(result).not.toBe("PASS");
    expect(result).toBe("INSUFFICIENT_EVIDENCE");
  });
});
