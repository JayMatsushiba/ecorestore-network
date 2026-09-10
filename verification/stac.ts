/**
 * STAC search against the public Earth Search catalogue (AWS Open Data).
 * Sentinel-2 L2A Cloud-Optimized GeoTIFFs; no credentials required.
 *
 * This is REAL Tier 0 acquisition. Scene IDs returned here are recorded in every
 * result so a third party can re-run the derivation.
 */
import type { ObservationWindow, SceneRecord } from './models.js';

export const EARTH_SEARCH_URL = 'https://earth-search.aws.element84.com/v1';
export const S2_L2A_COLLECTION = 'sentinel-2-l2a';

interface StacAsset {
  href: string;
  'raster:bands'?: Array<{ scale?: number; offset?: number; nodata?: number }>;
}

interface StacItem {
  id: string;
  properties: Record<string, unknown>;
  assets: Record<string, StacAsset>;
}

export interface StacSearchOptions {
  bbox: [number, number, number, number];
  windows: ObservationWindow[];
  maxCloudCoverPct: number;
  fetchImpl?: typeof fetch;
}

export async function searchSentinel2(opts: StacSearchOptions): Promise<SceneRecord[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const scenes = new Map<string, SceneRecord>();
  for (const w of opts.windows) {
    let next: string | undefined;
    do {
      const body: Record<string, unknown> = {
        collections: [S2_L2A_COLLECTION],
        bbox: opts.bbox,
        datetime: `${w.start}T00:00:00Z/${w.end}T23:59:59Z`,
        limit: 100,
        query: { 'eo:cloud_cover': { lt: opts.maxCloudCoverPct } },
        ...(next ? { token: next } : {}),
      };
      const res = await fetchImpl(`${EARTH_SEARCH_URL}/search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`STAC search failed: ${res.status} ${await res.text()}`);
      const json = (await res.json()) as { features: StacItem[]; links?: Array<{ rel: string; body?: { token?: string } }> };
      for (const item of json.features) {
        const rec = toSceneRecord(item);
        if (rec) scenes.set(rec.sceneId, rec);
      }
      next = json.links?.find((l) => l.rel === 'next')?.body?.token;
    } while (next);
  }
  // `sceneId` breaks datetime ties. Two granules of the same pass share an
  // acquisition datetime; without the tie-break the order is the catalogue's
  // paging order, and this array is canonicalised into `snapshotHash`.
  // Must match `analysis/ecorestore_analysis/stac.py`.
  return [...scenes.values()].sort((a, b) => a.datetime.localeCompare(b.datetime) || a.sceneId.localeCompare(b.sceneId));
}

function toSceneRecord(item: StacItem): SceneRecord | null {
  const red = item.assets['red'];
  const nir = item.assets['nir'];
  const scl = item.assets['scl'];
  if (!red || !nir || !scl) return null;
  const band = red['raster:bands']?.[0] ?? {};
  const p = item.properties;
  return {
    sceneId: item.id,
    datetime: String(p['datetime']),
    platform: String(p['platform'] ?? ''),
    cloudCoverPct: Number(p['eo:cloud_cover']),
    processingBaseline: String(p['s2:processing_baseline'] ?? ''),
    epsg: Number(p['proj:epsg'] ?? p['proj:code']?.toString().replace('EPSG:', '') ?? 0),
    assets: { red: red.href, nir: nir.href, scl: scl.href },
    stacAdvertisedReflectance: { scale: band.scale ?? 0.0001, offset: band.offset ?? 0 },
  };
}
