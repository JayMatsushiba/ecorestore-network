/**
 * Dump the reference TypeScript analysis for each demo scenario as
 * (request, output) pairs. The Python service's test suite replays the
 * requests and must reproduce the outputs exactly — that is the parity
 * guarantee between the two implementations of the analysis boundary.
 *
 * The two Tier 0 snapshots (REAL, and REAL with the labelled synthetic effect)
 * are stored once each, gzip-compressed, and referenced by hash from every case.
 *
 *   npx tsx scripts/dump-analysis-reference.ts        # writes analysis/tests/reference/
 *
 * The cases live in `verification/analysis-reference-cases.ts` so that
 * `verification/analysis-reference.test.ts` can recompute exactly these and
 * fail if the committed files have gone stale against the TypeScript engine.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { REFERENCE_CASES, REFERENCE_DIR } from '../verification/analysis-reference-cases.js';
import { analyseTier0, analysisRequest } from '../verification/engine.js';
import { loadEvidenceBundle } from '../verification/fixtures.js';

const OUT = REFERENCE_DIR;

const { plan, evidence } = loadEvidenceBundle();
const cases = REFERENCE_CASES(plan, evidence.tier0);

mkdirSync(OUT, { recursive: true });
const snapshots = new Map<string, string>();
for (const c of cases) {
  const request = analysisRequest(c.plan, c.tier0);
  const output = analyseTier0(c.plan, c.tier0);
  snapshots.set(request.snapshotHash, request.tier0Canonical);
  const { tier0Canonical: _omitted, ...rest } = request;
  writeFileSync(join(OUT, `${c.name}.request.json`), JSON.stringify({ ...rest, tier0CanonicalFile: `tier0-${request.snapshotHash.slice(2, 18)}.canonical.json.gz` }, null, 2));
  writeFileSync(join(OUT, `${c.name}.output.json`), JSON.stringify(output, null, 2));
  console.log(`${c.name}: estimate ${output.estimate ? output.estimate.additional.toFixed(4) : 'null'}, interval ${output.interval ? `[${output.interval.lower}, ${output.interval.upper}]` : 'null'}, trend ${output.parallelTrend.status}, coverage ${output.coverage.empirical}`);
}
for (const [hash, canonical] of snapshots) {
  writeFileSync(join(OUT, `tier0-${hash.slice(2, 18)}.canonical.json.gz`), gzipSync(Buffer.from(canonical, 'utf8'), { level: 9 }));
}
console.log(`wrote ${OUT} (${snapshots.size} snapshots, ${cases.length} cases)`);
