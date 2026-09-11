import { useMemo, useState } from 'react';
import { Badge } from './Badge';
import type { Bbox, LngLat, PolygonGeometry, Provenance, SpatialBlock } from './types';

/**
 * The evidence view for the additionality claim: where the parcel is, the rings the
 * committed rule drew around it, and the cells it matched as controls.
 *
 * Presentation only. Every polygon arrives serialised from the engine's own geometry
 * helpers; nothing here is derived from satellite data. There is no basemap: the map
 * draws its own graticule and scale bar, so it renders offline and needs no third party
 * during a demonstration. The numbers in the cards stay authoritative; the text block
 * under the map is the alternative for a reader who cannot see it.
 */

type LayerId = 'parcel' | 'near' | 'far' | 'matchedFar' | 'matchedNear' | 'readWindow' | 'evidence';

interface Layer {
  id: LayerId;
  label: string;
  provenance: Provenance;
  swatch: 'parcel' | 'ring' | 'cell' | 'window' | 'point';
  count?: string;
}

const W = 880;
const PAD = 28;

function unionBbox(boxes: Bbox[]): Bbox {
  return boxes.reduce<Bbox>((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])], [Infinity, Infinity, -Infinity, -Infinity]);
}

function pointsBbox(points: LngLat[]): Bbox | null {
  if (points.length === 0) return null;
  return unionBbox(points.map(([x, y]) => [x, y, x, y]));
}

function polygonRings(g: PolygonGeometry): LngLat[][] {
  return g.type === 'Polygon' ? g.coordinates : g.coordinates.flat();
}

function dms(value: number, axis: 'lat' | 'lng'): string {
  const hemi = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  return `${Math.abs(value).toFixed(3)}°${hemi}`;
}

export function ParcelMap({ spatial, tier0Provenance }: { spatial: SpatialBlock | undefined; tier0Provenance: Provenance }) {
  const [visible, setVisible] = useState<Record<LayerId, boolean>>({ parcel: true, near: true, far: true, matchedFar: true, matchedNear: true, readWindow: true, evidence: true });
  const [hover, setHover] = useState<string | null>(null);

  const geom = useMemo(() => {
    if (!spatial) return null;
    const evidence = [...spatial.evidencePoints.tier1Plots, ...spatial.evidencePoints.tier2Nodes, ...spatial.evidencePoints.tier3Photos];
    const extent = unionBbox([spatial.readWindow.bboxLngLat, ...spatial.rings.map((r) => r.bbox), spatial.parcel.bbox, ...(pointsBbox(evidence.map((p) => p.lngLat)) ? [pointsBbox(evidence.map((p) => p.lngLat))!] : [])]);
    const [minLng, minLat, maxLng, maxLat] = extent;
    const lat0 = (minLat + maxLat) / 2;
    const kx = Math.cos((lat0 * Math.PI) / 180);
    const scale = (W - 2 * PAD) / ((maxLng - minLng) * kx);
    const H = Math.round((maxLat - minLat) * scale + 2 * PAD);
    const x = (lng: number) => PAD + (lng - minLng) * kx * scale;
    const y = (lat: number) => PAD + (maxLat - lat) * scale;
    const path = (g: PolygonGeometry) => polygonRings(g).map((ring) => ring.map(([lng, lat], i) => `${i === 0 ? 'M' : 'L'}${x(lng).toFixed(1)},${y(lat).toFixed(1)}`).join(' ') + 'Z').join(' ');
    const ringPath = (ring: LngLat[]) => path({ type: 'Polygon', coordinates: [ring] });
    const box = (b: Bbox) => ({ x: x(b[0]), y: y(b[3]), width: x(b[2]) - x(b[0]), height: y(b[1]) - y(b[3]) });
    // Graticule every 0.01°, which is about 1.1 km north–south here.
    const step = 0.01;
    const lngs: number[] = [];
    for (let v = Math.ceil(minLng / step) * step; v < maxLng; v += step) lngs.push(+v.toFixed(3));
    const lats: number[] = [];
    for (let v = Math.ceil(minLat / step) * step; v < maxLat; v += step) lats.push(+v.toFixed(3));
    // Scale bar: 500 m of latitude, drawn from metres per degree.
    const barPx = (500 / 111_320) * scale;
    return { H, x, y, path, ringPath, box, lngs, lats, barPx, evidence, extent };
  }, [spatial]);

  if (!spatial || !geom) {
    return (
      <p className="muted">
        This bundle carries no geometry, so the map cannot draw the parcel or its controls. Bundles written before the map view existed lack the <span className="mono">spatial</span> block; re-run verification to produce one.
      </p>
    );
  }

  const far = spatial.rings.find((r) => r.ring === 'far');
  const near = spatial.rings.find((r) => r.ring === 'near');
  const controlsProvenance = spatial.controls.provenance;
  const layers: Layer[] = [
    { id: 'parcel', label: `Parcel, ${spatial.parcel.areaHa.toFixed(2)} ha`, provenance: tier0Provenance, swatch: 'parcel' },
    { id: 'near', label: `Near ring, ${near?.innerM ?? 0}–${near?.outerM ?? 0} m (leakage-exposed)`, provenance: 'REAL', swatch: 'ring' },
    { id: 'far', label: `Far ring, ${far?.innerM ?? 0}–${far?.outerM ?? 0} m (comparison land)`, provenance: 'REAL', swatch: 'ring' },
    { id: 'matchedFar', label: 'Matched far-ring control cells', provenance: controlsProvenance, swatch: 'cell', count: `${spatial.controls.far.matched.length} of ${spatial.controls.far.candidates} candidates` },
    { id: 'matchedNear', label: 'Matched near-ring control cells', provenance: controlsProvenance, swatch: 'cell', count: `${spatial.controls.near.matched.length} of ${spatial.controls.near.candidates} candidates` },
    { id: 'readWindow', label: 'Pixel window the pipeline read', provenance: spatial.readWindow.provenance, swatch: 'window', count: `${spatial.readWindow.pixelWindow[2]} × ${spatial.readWindow.pixelWindow[3]} px` },
    { id: 'evidence', label: 'Tier 1–3 evidence locations', provenance: 'SIMULATED', swatch: 'point', count: `${geom.evidence.length} records` },
  ];
  const toggle = (id: LayerId) => setVisible((v) => ({ ...v, [id]: !v[id] }));
  const parcelSimulated = tier0Provenance !== 'REAL';
  const hovered = hover ? [...spatial.controls.far.matched.map((c) => ({ ...c, ring: 'far' })), ...spatial.controls.near.matched.map((c) => ({ ...c, ring: 'near' }))].find((c) => c.unitId === hover) : null;
  const osm = `https://www.openstreetmap.org/?mlat=${spatial.parcel.centroid[1].toFixed(5)}&mlon=${spatial.parcel.centroid[0].toFixed(5)}#map=14/${spatial.parcel.centroid[1].toFixed(5)}/${spatial.parcel.centroid[0].toFixed(5)}`;

  return (
    <div className="map">
      <fieldset className="layers">
        <legend>Layers. Each carries its own provenance; simulated layers are hatched or dashed, not only coloured.</legend>
        {layers.map((l) => (
          <label key={l.id} className="layer">
            <input type="checkbox" checked={visible[l.id]} onChange={() => toggle(l.id)} />
            <i className={`map-swatch ${l.swatch} ${l.provenance === 'SIMULATED' ? 'simulated' : ''}`} aria-hidden="true" />
            <span>{l.label}{l.count ? <span className="muted"> · {l.count}</span> : null}</span> <Badge p={l.provenance} />
          </label>
        ))}
      </fieldset>

      <div className="chart-scroll">
        <svg className="chart map-svg" viewBox={`0 0 ${W} ${geom.H}`} role="img" aria-label="Map of the parcel, its control rings, the matched control cells and the pixel window the pipeline read" onMouseLeave={() => setHover(null)}>
          <defs>
            <pattern id="hatch-simulated" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="var(--simulated)" strokeWidth="2.5" />
            </pattern>
          </defs>
          <rect x={0} y={0} width={W} height={geom.H} fill="var(--surface-2)" />
          <g className="graticule">
            {geom.lngs.map((v) => (
              <g key={`lng${v}`}>
                <line x1={geom.x(v)} x2={geom.x(v)} y1={PAD} y2={geom.H - PAD} />
                <text x={geom.x(v)} y={geom.H - 8} textAnchor="middle">{dms(v, 'lng')}</text>
              </g>
            ))}
            {geom.lats.map((v) => (
              <g key={`lat${v}`}>
                <line x1={PAD} x2={W - PAD} y1={geom.y(v)} y2={geom.y(v)} />
                <text x={PAD - 4} y={geom.y(v) + 4} textAnchor="end" transform={`rotate(-90 ${PAD - 4} ${geom.y(v) + 4})`}>{dms(v, 'lat')}</text>
              </g>
            ))}
          </g>
          {visible.readWindow && <rect {...geom.box(spatial.readWindow.bboxLngLat)} fill="none" stroke="var(--map-window)" strokeWidth={1.5} strokeDasharray={spatial.readWindow.provenance === 'REAL' ? undefined : '6 4'} />}
          {visible.far && far && <path d={geom.path(far.geometry)} fill="var(--series-far)" fillOpacity={0.14} stroke="var(--series-far)" strokeWidth={1.5} fillRule="evenodd" />}
          {visible.near && near && <path d={geom.path(near.geometry)} fill="var(--series-near)" fillOpacity={0.14} stroke="var(--series-near)" strokeWidth={1.5} strokeDasharray="5 4" fillRule="evenodd" />}
          {visible.matchedFar && spatial.controls.far.matched.map((c) => (
            <path key={c.unitId} d={geom.ringPath(c.boundary)} fill={controlsProvenance === 'REAL' ? 'var(--series-far)' : 'url(#hatch-simulated)'} fillOpacity={hover === c.unitId ? 1 : 0.75} stroke="var(--surface-1)" strokeWidth={0.8} onMouseEnter={() => setHover(c.unitId)} />
          ))}
          {visible.matchedNear && spatial.controls.near.matched.map((c) => (
            <path key={c.unitId} d={geom.ringPath(c.boundary)} fill={controlsProvenance === 'REAL' ? 'var(--series-near)' : 'url(#hatch-simulated)'} fillOpacity={hover === c.unitId ? 1 : 0.75} stroke="var(--surface-1)" strokeWidth={0.8} onMouseEnter={() => setHover(c.unitId)} />
          ))}
          {visible.parcel && <path d={geom.path(spatial.parcel.geometry)} fill={parcelSimulated ? 'url(#hatch-simulated)' : 'var(--series-parcel)'} fillOpacity={parcelSimulated ? 1 : 0.45} stroke={parcelSimulated ? 'var(--simulated)' : 'var(--series-parcel)'} strokeWidth={2.5} />}
          {visible.evidence && geom.evidence.map((p) => {
            const cx = geom.x(p.lngLat[0]);
            const cy = geom.y(p.lngLat[1]);
            return <polygon key={p.id} points={`${cx},${cy - 6} ${cx + 6},${cy} ${cx},${cy + 6} ${cx - 6},${cy}`} fill="var(--surface-1)" stroke="var(--simulated)" strokeWidth={1.5} strokeDasharray="2 1.5"><title>{p.label} (SIMULATED)</title></polygon>;
          })}
          <g className="scalebar" transform={`translate(${W - PAD - geom.barPx}, ${PAD + 6})`}>
            <rect x={0} y={0} width={geom.barPx} height={4} fill="var(--text-primary)" />
            <text x={geom.barPx / 2} y={16} textAnchor="middle">500 m</text>
          </g>
          <text x={PAD} y={PAD - 8} className="map-title">{spatial.parcel.name}</text>
        </svg>
      </div>

      <p className="muted map-caption">
        {hovered
          ? <>Cell <span className="mono">{hovered.unitId}</span>: one of the {hovered.ring === 'far' ? spatial.controls.far.matched.length : spatial.controls.near.matched.length} matched {hovered.ring}-ring controls. Its NDVI series is folded into the {hovered.ring}-ring mean in step 1; per-cell series are not in the bundle.</>
          : <>Hover a control cell for its id. The rule matched cells on pre-treatment level and slope only, from the plan committed before the outcome was observable. <a href={osm} target="_blank" rel="noreferrer">Open this location in OpenStreetMap</a>.</>}
      </p>

      <details className="map-text">
        <summary>Read the map as text</summary>
        <ul>
          <li>Parcel <span className="mono">{spatial.parcel.parcelId}</span>, {spatial.parcel.areaHa.toFixed(2)} ha, centred at {dms(spatial.parcel.centroid[1], 'lat')} {dms(spatial.parcel.centroid[0], 'lng')}. Real ground; the deed and the intervention are constructed.</li>
          <li>{spatial.parcel.locationNote}</li>
          <li>Near ring {near?.innerM}–{near?.outerM} m from the parcel edge: {spatial.controls.near.matched.length} cells matched of {spatial.controls.near.candidates} candidates.</li>
          <li>Far ring {far?.innerM}–{far?.outerM} m from the parcel edge: {spatial.controls.far.matched.length} cells matched of {spatial.controls.far.candidates} candidates. Cells are H3 resolution {spatial.controls.resolution}.</li>
          <li>Pixel window read by the pipeline: {spatial.readWindow.pixelWindow[2]} × {spatial.readWindow.pixelWindow[3]} pixels in {spatial.readWindow.sourceCrs}, spanning {dms(geom.extent[1], 'lat')}–{dms(geom.extent[3], 'lat')} and {dms(geom.extent[0], 'lng')}–{dms(geom.extent[2], 'lng')}.</li>
          <li>Simulated evidence locations: {spatial.evidencePoints.tier1Plots.length} drone plots, {spatial.evidencePoints.tier2Nodes.length} soil-moisture nodes, {spatial.evidencePoints.tier3Photos.length} geotagged photos. Drawn for the demonstration; not field records.</li>
          {spatial.notShown.map((n) => <li key={n}>Not shown: {n}.</li>)}
        </ul>
      </details>
    </div>
  );
}
