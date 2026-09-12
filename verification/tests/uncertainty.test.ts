import { describe, expect, it } from "vitest";
import { DEFAULT_METHODOLOGY_CONFIG } from "../config.js";
import { computeUncertainty } from "../calculations/uncertainty.js";

describe("computeUncertainty", () => {
  it("computes a symmetric interval around the point estimate using the configured relative fraction", () => {
    const result = computeUncertainty(21.39, DEFAULT_METHODOLOGY_CONFIG);
    expect(result.status).toBe("VALID");
    expect(result.pointEstimate).toBeCloseTo(21.39, 6);
    // margin = 21.39 * 0.15 = 3.2085
    expect(result.lowerBound).toBeCloseTo(18.1815, 4);
    expect(result.upperBound).toBeCloseTo(24.5985, 4);
    expect(result.confidenceLevel).toBe(DEFAULT_METHODOLOGY_CONFIG.confidenceLevel);
  });

  it("flags an out-of-range relativeUncertaintyFraction as an invalid configuration", () => {
    const invalidConfig = { ...DEFAULT_METHODOLOGY_CONFIG, relativeUncertaintyFraction: 1.5 };
    const result = computeUncertainty(20, invalidConfig);
    expect(result.status).toBe("INVALID_CONFIGURATION");
    expect(result.lowerBound).toBe(result.pointEstimate);
    expect(result.upperBound).toBe(result.pointEstimate);
  });

  it("flags an out-of-range confidenceLevel as an invalid configuration", () => {
    const invalidConfig = { ...DEFAULT_METHODOLOGY_CONFIG, confidenceLevel: 1.2 };
    const result = computeUncertainty(20, invalidConfig);
    expect(result.status).toBe("INVALID_CONFIGURATION");
  });

  it("is deterministic across repeated calls with identical inputs", () => {
    const first = computeUncertainty(21.39, DEFAULT_METHODOLOGY_CONFIG);
    const second = computeUncertainty(21.39, DEFAULT_METHODOLOGY_CONFIG);
    expect(first).toEqual(second);
  });
});
