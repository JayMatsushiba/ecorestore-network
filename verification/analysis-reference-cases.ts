/**
 * The five parity cases, defined once.
 *
 * `scripts/dump-analysis-reference.ts` writes them to
 * `analysis/tests/reference/` for the Python suite to replay;
 * `analysis-reference.test.ts` recomputes them to prove the committed files
 * still match this engine. Both must use the same definitions or the check
 * proves nothing, so neither owns them.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AnalysisPlan, Tier0Snapshot } from './models.js';
import { injectSyntheticEffect } from './scenario.js';

export const REFERENCE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'analysis', 'tests', 'reference');
export const SYNTHETIC_DELTA = 0.25;

export interface ReferenceCase {
  name: string;
  plan: AnalysisPlan;
  tier0: Tier0Snapshot;
}

export function REFERENCE_CASES(plan: AnalysisPlan, real: Tier0Snapshot): ReferenceCase[] {
  const synthetic = injectSyntheticEffect(real, plan, SYNTHETIC_DELTA);
  return [
    { name: 'real', plan, tier0: real },
    { name: 'synthetic', plan, tier0: synthetic },
    { name: 'trend-failure', plan: { ...plan, parallelTrend: { ...plan.parallelTrend, maxAbsSlopeDiffPerYear: 0.000001, alpha: 0.999 } }, tier0: real },
    { name: 'few-scenes', plan: { ...plan, minScenesPerWindow: 500 }, tier0: real },
    { name: 'few-controls', plan: { ...plan, controlRule: { ...plan.controlRule, matching: { ...plan.controlRule.matching, caliperSd: 0.0001 } } }, tier0: real },
  ];
}
