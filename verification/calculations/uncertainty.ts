/**
 * Ecorestore Network — Uncertainty (M1)
 *
 * Simplified deterministic uncertainty model: a fixed relative margin
 * around the point estimate.
 *
 * M1 SIMPLIFICATION: this is NOT a statistically derived confidence
 * interval. It does not model atmospheric correction residuals, control-
 * matching error, or any of the other sources listed in
 * docs/VERIFICATION.md §10. It exists to (a) force every downstream
 * consumer to handle an interval rather than a bare point estimate, and
 * (b) give the conservative settlement rule something concrete to take a
 * lower bound from. Replacing this with a validated statistical model is a
 * production task — see docs/VERIFICATION.md "Known Limitations". The
 * model id and every parameter live in `MethodologyConfiguration`
 * specifically so this can be swapped later without touching the engine's
 * pipeline shape (M1 prompt §11).
 *
 * `config.confidenceLevel` is carried through as a declared label on the
 * result; this simplified model does not derive the margin from it.
 */

import type { MethodologyConfiguration, Uncertainty } from "../models.js";

export function computeUncertainty(pointEstimate: number, config: MethodologyConfiguration): Uncertainty {
  const { relativeUncertaintyFraction, confidenceLevel, uncertaintyModel } = config;

  const configurationIsValid =
    Number.isFinite(pointEstimate) &&
    Number.isFinite(relativeUncertaintyFraction) &&
    relativeUncertaintyFraction >= 0 &&
    relativeUncertaintyFraction < 1 &&
    Number.isFinite(confidenceLevel) &&
    confidenceLevel > 0 &&
    confidenceLevel < 1;

  if (!configurationIsValid) {
    return {
      model: uncertaintyModel,
      confidenceLevel,
      pointEstimate,
      lowerBound: pointEstimate,
      upperBound: pointEstimate,
      status: "INVALID_CONFIGURATION",
    };
  }

  const margin = Math.abs(pointEstimate) * relativeUncertaintyFraction;
  const lowerBound = pointEstimate - margin;
  const upperBound = pointEstimate + margin;

  if (lowerBound > upperBound) {
    return {
      model: uncertaintyModel,
      confidenceLevel,
      pointEstimate,
      lowerBound: pointEstimate,
      upperBound: pointEstimate,
      status: "INVALID_INTERVAL",
    };
  }

  return {
    model: uncertaintyModel,
    confidenceLevel,
    pointEstimate,
    lowerBound,
    upperBound,
    status: "VALID",
  };
}
