/**
 * Ecorestore Network — M1 Methodology Configuration
 *
 * A `MethodologyConfiguration` bundles every tunable parameter the engine
 * uses, so behaviour is driven by explicit, versioned configuration rather
 * than magic numbers scattered through `calculations/*.ts` (M1 prompt §15,
 * §18).
 */

import type { MethodologyConfiguration } from "./models.js";

/**
 * The M1 prototype methodology version. This identifies the exact
 * deterministic calculation rules implemented in `verification/calculations/*`
 * and `verification/engine.ts` — it is a version label for this codebase's
 * methodology, not a scientifically validated or externally certified
 * methodology. See docs/VERIFICATION.md "Known Limitations".
 */
export const M1_METHODOLOGY_VERSION = "ecorestore-m1-v0.1";

/**
 * The single metric M1 supports. See docs/VERIFICATION.md "Known
 * Limitations" — production methodology will support multiple metrics.
 */
export const M1_METRIC_ID = "canopy_cover_fraction_pct";

/**
 * Default methodology configuration for the M1 prototype engine.
 *
 * All thresholds here are prototype/demonstration values chosen to exercise
 * the pipeline's decision paths against the synthetic fixtures in
 * `fixtures.ts`. They are not derived from a validated ecological or
 * statistical study — see docs/VERIFICATION.md.
 */
export const DEFAULT_METHODOLOGY_CONFIG: MethodologyConfiguration = {
  methodologyVersion: M1_METHODOLOGY_VERSION,
  metric: M1_METRIC_ID,
  confidenceLevel: 0.85,
  parallelTrendToleranceRatio: 0.2,
  parallelTrendMinimumSlopeDenominator: 0.01,
  uncertaintyModel: "m1-fixed-fraction-v0.1",
  relativeUncertaintyFraction: 0.15,
  minimumControlCount: 2,
  matchingTolerance: {
    elevationMeters: 150,
    slopeDegrees: 8,
  },
};

/**
 * A second, stricter configuration used only to demonstrate/test that the
 * engine's behaviour is driven by `MethodologyConfiguration` rather than
 * hard-coded constants (M1 prompt §19: "different methodology
 * versions/configurations"). This is not a claim that this is a validated
 * alternative methodology — it exists for test coverage only.
 */
export const STRICT_METHODOLOGY_CONFIG: MethodologyConfiguration = {
  ...DEFAULT_METHODOLOGY_CONFIG,
  methodologyVersion: "ecorestore-m1-v0.1-strict-demo",
  relativeUncertaintyFraction: 0.05,
  parallelTrendToleranceRatio: 0.05,
};
