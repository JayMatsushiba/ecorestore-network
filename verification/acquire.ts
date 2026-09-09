/**
 * REAL Tier 0 acquisition.
 *
 * Searches Earth Search for Sentinel-2 L2A scenes over the parcel for every
 * pre-registered window, reads the red, NIR and SCL bands over the sampling
 * frame via HTTP range requests, masks by SCL class, computes per-unit NDVI and
 * writes `verification/fixtures/tier0-<parcelId>.json`.
 *
 * Every scene ID and the processing-graph version are recorded so the
 * derivation can be re-run by a third party.
 *
 *   npm run acquire            # full run (network)
 *   npm run acquire -- --limit 5
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { keccakOf } from './canonical.js';
import { readCogWindow, type CogWindowRead } from './cog.js';
import { acquisitionBboxUtm, buildSamplingFrame, type FrameUnit, type SamplingFrame } from './frame.js';
import { parcelIdentity } from './geometry.js';
import type { AnalysisPlan, ParcelRecord, SceneObservation, SceneRecord, Tier0Snapshot } from './models.js';
import { searchSentinel2, EARTH_SEARCH_URL, S2_L2A_COLLECTION } from './stac.js';

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURES_DIR = join(here, 'fixtures');
const CACHE_DIR = join(here, 'cache');

export const PROCESSING_GRAPH_VERSION = '1.0.0';

export interface SceneBands {
  red: CogWindowRead;
  nir: CogWindowRead;
  scl: CogWindowRead;
}

/**
 * Per-unit NDVI statistics for one scene. Pure: given the three band windows
 * and the frame, returns the observation row. Exported for unit tests.
 */
export function observeScene(scene: SceneRecord, bands: SceneBands, units: FrameUnit[], plan: AnalysisPlan): SceneObservation {
  const { red, nir, scl } = bands;
  if (red.width !== nir.width || red.height !== nir.height) throw new Error(`${scene.sceneId}: red/nir window mismatch`);
  const validClasses = new Set(plan.index.sclClassesValid);
  const { scale, offset } = plan.index.dnToReflectance;
  const g = red.grid;
  const ndvi = new Float32Array(red.width * red.height);
  const valid = new Uint8Array(red.width * red.height);
  const water = new Uint8Array(red.width * red.height);
  for (let r = 0; r < red.height; r++) {
    const y = g.originY - (r + 0.5) * g.resolution;
    const sr = Math.floor((scl.grid.originY - y) / scl.grid.resolution);
    for (let c = 0; c < red.width; c++) {
      const i = r * red.width + c;
      const x = g.originX + (c + 0.5) * g.resolution;
      const sc = Math.floor((x - scl.grid.originX) / scl.grid.resolution);
      const sclVal = sr >= 0 && sr < scl.height && sc >= 0 && sc < scl.width ? scl.data[sr * scl.width + sc]! : 0;
      const dnR = red.data[i]!;
      const dnN = nir.data[i]!;
      if (dnR === 0 || dnN === 0 || !validClasses.has(sclVal)) continue;
      const rr = dnR * scale + offset;
      const nn = dnN * scale + offset;
      const denom = nn + rr;
      if (denom <= 0) continue;
      const v = (nn - rr) / denom;
      if (v < -1 || v > 1) continue;
      ndvi[i] = v;
      valid[i] = 1;
      if (sclVal === 6) water[i] = 1;
    }
  }
  const out: SceneObservation = { ndvi: [], validFraction: [], waterFraction: [] };
  for (const u of units) {
    let n = 0;
    let s = 0;
    let w = 0;
    for (const px of u.pixels) {
      if (!valid[px]) continue;
      n++;
      s += ndvi[px]!;
      w += water[px]!;
    }
    const vf = u.pixels.length > 0 ? n / u.pixels.length : 0;
    out.validFraction.push(round4(vf));
    out.waterFraction.push(n > 0 ? round4(w / n) : 0);
    out.ndvi.push(vf >= plan.index.minValidPixelFraction && n > 0 ? round4(s / n) : null);
  }
  return out;
}

function round4(x: number): number {
  return Math.round(x * 10_000) / 10_000;
}

export function loadParcel(): ParcelRecord {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, 'kootenay-parcel.json'), 'utf8')) as ParcelRecord;
}

export function loadPlan(): AnalysisPlan {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, 'analysis-plan.json'), 'utf8')) as AnalysisPlan;
}

export function finalizeSnapshot(partial: Omit<Tier0Snapshot, 'snapshotHash'>): Tier0Snapshot {
  return { ...partial, snapshotHash: keccakOf(partial) };
}

async function readBands(scene: SceneRecord, bboxUtm: [number, number, number, number]): Promise<SceneBands> {
  const [red, nir, scl] = await Promise.all([
    readCogWindow(scene.assets.red, { bboxUtm, cacheDir: CACHE_DIR }),
    readCogWindow(scene.assets.nir, { bboxUtm, cacheDir: CACHE_DIR }),
    readCogWindow(scene.assets.scl, { bboxUtm, cacheDir: CACHE_DIR }),
  ]);
  return { red, nir, scl };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function acquire(opts: { limit?: number; concurrency?: number; log?: (s: string) => void } = {}): Promise<Tier0Snapshot> {
  const log = opts.log ?? ((s: string) => console.log(s));
  const parcel = loadParcel();
  const plan = loadPlan();
  const identity = parcelIdentity(parcel.parcelId, parcel.geometry, parcel.h3Resolution);
  const bboxUtm = acquisitionBboxUtm(parcel, plan);
  const [minLng, minLat, maxLng, maxLat] = bboxLngLat(parcel);
  log(`parcel ${parcel.parcelId}: ${identity.areaHa.toFixed(2)} ha, ${identity.h3CellCount} H3 r${parcel.h3Resolution} cells, geometryHash ${identity.geometryHash}`);

  let scenes = await searchSentinel2({
    bbox: [minLng, minLat, maxLng, maxLat],
    windows: [...plan.windows.pre, ...plan.windows.post],
    maxCloudCoverPct: plan.index.maxSceneCloudCoverPct,
  });
  if (opts.limit) scenes = scenes.slice(0, opts.limit);
  log(`STAC: ${scenes.length} Sentinel-2 L2A scenes under ${plan.index.maxSceneCloudCoverPct}% cloud`);

  // First scene defines the grid; every other scene must match it (same MGRS tile).
  const first = await readBands(scenes[0]!, bboxUtm);
  const grid = first.red.grid;
  let frame: SamplingFrame = buildSamplingFrame(parcel, plan, grid);
  log(`frame: ${frame.units.length} units (${count(frame, 'parcel_cell')} parcel cells, ${count(frame, 'near')} near, ${count(frame, 'far')} far) on a ${grid.width}x${grid.height} px grid`);

  const observations: Record<string, SceneObservation> = {};
  const kept: SceneRecord[] = [];
  const results = await mapLimit(scenes, opts.concurrency ?? 4, async (scene, i) => {
    const bands = i === 0 ? first : await readBands(scene, bboxUtm);
    const g = bands.red.grid;
    if (g.originX !== grid.originX || g.originY !== grid.originY || g.width !== grid.width || g.height !== grid.height) {
      log(`  skip ${scene.sceneId}: grid mismatch`);
      return null;
    }
    const obs = observeScene(scene, bands, frame.units, plan);
    log(`  ${scene.sceneId} ${scene.datetime.slice(0, 10)} cloud ${scene.cloudCoverPct.toFixed(1)}% parcel NDVI ${obs.ndvi[0] ?? 'masked'} (valid ${obs.validFraction[0]})`);
    return { scene, obs };
  });
  for (const r of results) {
    if (!r) continue;
    kept.push(r.scene);
    observations[r.scene.sceneId] = r.obs;
  }
  frame = { ...frame, units: frame.units };

  const snapshot = finalizeSnapshot({
    provenance: 'REAL',
    tier: 0,
    source: { catalog: EARTH_SEARCH_URL, collection: S2_L2A_COLLECTION, assetHost: 'sentinel-cogs.s3.us-west-2.amazonaws.com' },
    processingGraphVersion: PROCESSING_GRAPH_VERSION,
    acquiredAt: new Date().toISOString(),
    parcelId: parcel.parcelId,
    geometryHash: identity.geometryHash,
    h3Root: identity.h3Root,
    crs: 'EPSG:32611',
    window: { bbox: bboxUtm, pixelWindow: [0, 0, grid.width, grid.height] },
    scenes: kept,
    units: frame.units.map(({ pixels: _pixels, ...u }) => u),
    observations,
  });
  mkdirSync(FIXTURES_DIR, { recursive: true });
  const outPath = join(FIXTURES_DIR, `tier0-${parcel.parcelId}.json`);
  writeFileSync(outPath, JSON.stringify(snapshot));
  log(`wrote ${outPath} (${kept.length} scenes, snapshotHash ${snapshot.snapshotHash})`);
  return snapshot;
}

function count(frame: SamplingFrame, zone: string): number {
  return frame.units.filter((u) => u.zone === zone).length;
}

function bboxLngLat(parcel: ParcelRecord): [number, number, number, number] {
  const ring = parcel.geometry.coordinates[0]!;
  const lngs = ring.map((p) => p[0]!);
  const lats = ring.map((p) => p[1]!);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : undefined;
  acquire(limit ? { limit } : {}).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
