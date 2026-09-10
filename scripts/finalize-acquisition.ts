/**
 * Finalise a Tier 0 snapshot produced by the Python acquisition job.
 *
 * `ecorestore-acquire` writes `tier0-<parcelId>.unhashed.json`: the full
 * snapshot minus `geometryHash`, `h3Root` and `snapshotHash`. Python must
 * not compute those — exactly one canonicaliser exists (`canonical.ts`).
 * This script attaches them from the parcel fixture and the canonical
 * hashing rule, validates the document, compares it against the currently
 * committed fixture, and writes the fixture (or `--out <path>`).
 *
 *   npm run acquire:finalize -- out/acquire/tier0-kootenay-riparian-001.unhashed.json
 *   npm run acquire:finalize -- out/acquire/tier0-kootenay-riparian-001.unhashed.json --out /tmp/preview.json
 *
 * Promoting a new snapshot changes every downstream hash; do it deliberately.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { finalizeSnapshot, FIXTURES_DIR, loadParcel } from '../verification/acquire.js';
import { parcelIdentity } from '../verification/geometry.js';
import type { Tier0Snapshot } from '../verification/models.js';

type Unhashed = Omit<Tier0Snapshot, 'geometryHash' | 'h3Root' | 'snapshotHash'>;

function fail(msg: string): never {
  console.error(`finalize: ${msg}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
if (!input) fail('usage: finalize-acquisition <tier0-<parcelId>.unhashed.json> [--out <path>]');
const outIdx = args.indexOf('--out');
const doc = JSON.parse(readFileSync(resolve(input), 'utf8')) as Unhashed & Partial<Pick<Tier0Snapshot, 'geometryHash' | 'h3Root' | 'snapshotHash'>>;

if (doc.provenance !== 'REAL') fail(`provenance is ${String(doc.provenance)}, expected REAL`);
if (doc.tier !== 0) fail('tier must be 0');
if ('snapshotHash' in doc || 'geometryHash' in doc || 'h3Root' in doc) fail('input already carries hashes; refusing to re-hash');
const parcel = loadParcel();
if (doc.parcelId !== parcel.parcelId) fail(`parcelId ${doc.parcelId} does not match the parcel fixture ${parcel.parcelId}`);
if (!Array.isArray(doc.scenes) || doc.scenes.length === 0) fail('no scenes');
if (!Array.isArray(doc.units) || doc.units[0]?.zone !== 'parcel') fail('units[0] must be the parcel');
for (const s of doc.scenes) {
  const o = doc.observations[s.sceneId];
  if (!o) fail(`scene ${s.sceneId} has no observation row`);
  if (o.ndvi.length !== doc.units.length || o.validFraction.length !== doc.units.length || o.waterFraction.length !== doc.units.length) fail(`observation row for ${s.sceneId} is not aligned with units`);
}

const identity = parcelIdentity(parcel.parcelId, parcel.geometry, parcel.h3Resolution);
const snapshot = finalizeSnapshot({ ...doc, geometryHash: identity.geometryHash, h3Root: identity.h3Root });

const current = join(FIXTURES_DIR, `tier0-${parcel.parcelId}.json`);
if (existsSync(current)) {
  const prev = JSON.parse(readFileSync(current, 'utf8')) as Tier0Snapshot;
  const prevParcel = prev.units.findIndex((u) => u.zone === 'parcel');
  const newParcel = snapshot.units.findIndex((u) => u.zone === 'parcel');
  const common = snapshot.scenes.filter((s) => prev.observations[s.sceneId]);
  const diffs = common
    .map((s) => ({ a: prev.observations[s.sceneId]!.ndvi[prevParcel], b: snapshot.observations[s.sceneId]!.ndvi[newParcel] }))
    .filter((d): d is { a: number; b: number } => d.a != null && d.b != null)
    .map((d) => Math.abs(d.a - d.b));
  const maxDiff = diffs.length ? Math.max(...diffs) : NaN;
  console.log(`current fixture: graph ${prev.processingGraphVersion}, ${prev.scenes.length} scenes, ${prev.units.length} units, snapshotHash ${prev.snapshotHash}`);
  console.log(`new snapshot:    graph ${snapshot.processingGraphVersion}, ${snapshot.scenes.length} scenes, ${snapshot.units.length} units, snapshotHash ${snapshot.snapshotHash}`);
  console.log(`parcel NDVI over ${diffs.length} scenes in common: max |Δ| ${Number.isFinite(maxDiff) ? maxDiff.toFixed(4) : 'n/a'}`);
  console.log(`geometryHash ${snapshot.geometryHash === prev.geometryHash ? 'unchanged' : 'CHANGED'}, h3Root ${snapshot.h3Root === prev.h3Root ? 'unchanged' : 'CHANGED'}`);
}

const outPath = outIdx >= 0 ? resolve(args[outIdx + 1] ?? fail('--out needs a path')) : current;
writeFileSync(outPath, JSON.stringify(snapshot));
console.log(`wrote ${outPath} (${snapshot.scenes.length} scenes, snapshotHash ${snapshot.snapshotHash})`);
