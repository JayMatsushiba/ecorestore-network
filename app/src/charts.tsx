import { useMemo, useState } from 'react';
import type { TrajectoryPoint, VerificationResult } from './types';

const COLORS = { parcel: 'var(--series-parcel)', far: 'var(--series-far)', near: 'var(--series-near)' };

function dateToX(date: string, x0: number, x1: number, t0: number, t1: number): number {
  const t = Date.parse(`${date}T00:00:00Z`);
  return x0 + ((t - t0) / (t1 - t0)) * (x1 - x0);
}

/**
 * Additionality view: parcel NDVI trajectory against the far-ring control
 * envelope (mean ± sd), near ring shown separately so leakage is visible.
 * Every scene is a real acquisition; seasons are drawn as separate segments.
 */
export function TrajectoryChart({ points, treatmentDate, tier0Provenance }: { points: TrajectoryPoint[]; treatmentDate: string; tier0Provenance: string }) {
  const W = 880;
  const H = 300;
  const m = { l: 44, r: 16, t: 16, b: 34 };
  const [hover, setHover] = useState<number | null>(null);

  const geom = useMemo(() => {
    const dates = points.map((p) => Date.parse(`${p.date}T00:00:00Z`));
    const t0 = Math.min(...dates) - 15 * 86_400_000;
    const t1 = Math.max(...dates) + 15 * 86_400_000;
    const vals = points.flatMap((p) => [p.parcel ?? NaN, p.far ? p.far.mean + p.far.sd : NaN, p.far ? p.far.mean - p.far.sd : NaN, p.near?.mean ?? NaN]).filter(Number.isFinite);
    const yMin = Math.floor(Math.min(...vals) * 10) / 10;
    const yMax = Math.ceil(Math.max(...vals) * 10) / 10;
    const x = (d: string) => dateToX(d, m.l, W - m.r, t0, t1);
    const y = (v: number) => H - m.b - ((v - yMin) / (yMax - yMin)) * (H - m.t - m.b);
    // Break polylines between seasons (gap > 60 days).
    const segments = (get: (p: TrajectoryPoint) => number | null) => {
      const segs: string[][] = [[]];
      let prev: number | null = null;
      for (const p of points) {
        const v = get(p);
        const t = Date.parse(`${p.date}T00:00:00Z`);
        if (prev !== null && t - prev > 60 * 86_400_000) segs.push([]);
        if (v !== null) segs[segs.length - 1]!.push(`${x(p.date).toFixed(1)},${y(v).toFixed(1)}`);
        prev = t;
      }
      return segs.filter((s) => s.length > 1).map((s) => s.join(' '));
    };
    const bands = (() => {
      const out: string[] = [];
      let cur: TrajectoryPoint[] = [];
      let prev: number | null = null;
      const flush = () => {
        const pts = cur.filter((p) => p.far);
        if (pts.length > 1) {
          const top = pts.map((p) => `${x(p.date).toFixed(1)},${y(p.far!.mean + p.far!.sd).toFixed(1)}`);
          const bot = [...pts].reverse().map((p) => `${x(p.date).toFixed(1)},${y(p.far!.mean - p.far!.sd).toFixed(1)}`);
          out.push([...top, ...bot].join(' '));
        }
        cur = [];
      };
      for (const p of points) {
        const t = Date.parse(`${p.date}T00:00:00Z`);
        if (prev !== null && t - prev > 60 * 86_400_000) flush();
        cur.push(p);
        prev = t;
      }
      flush();
      return out;
    })();
    const yTicks = Array.from({ length: Math.round((yMax - yMin) / 0.1) + 1 }, (_, i) => +(yMin + i * 0.1).toFixed(1));
    const years = [...new Set(points.map((p) => p.date.slice(0, 4)))];
    return { x, y, segments, bands, yTicks, years, t0, t1, yMin, yMax };
  }, [points]);

  const hp = hover !== null ? points[hover] : null;
  const treatX = geom.x(treatmentDate);

  return (
    <div className="chart-wrap">
      <div className="legend" aria-label="legend">
        <span><i className="swatch" style={{ background: COLORS.parcel }} />Parcel ({tier0Provenance})</span>
        <span><i className="swatch" style={{ background: COLORS.far }} />Far-ring controls, mean ± sd (drawn by the committed rule)</span>
        <span><i className="swatch" style={{ background: COLORS.near, height: 2, borderTop: '2px dashed var(--series-near)', backgroundColor: 'transparent' }} />Near-ring controls (leakage-exposed)</span>
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Parcel NDVI against control rings over time"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          let best = 0;
          let bd = Infinity;
          points.forEach((p, i) => { const d = Math.abs(geom.x(p.date) - px); if (d < bd) { bd = d; best = i; } });
          setHover(best);
        }}>
        <g className="axis">
          {geom.yTicks.map((v) => (
            <g key={v}>
              <line className="grid-line" x1={m.l} x2={W - m.r} y1={geom.y(v)} y2={geom.y(v)} />
              <text x={m.l - 6} y={geom.y(v) + 4} textAnchor="end">{v.toFixed(1)}</text>
            </g>
          ))}
          {geom.years.map((yr) => (
            <text key={yr} x={geom.x(`${yr}-07-31`)} y={H - 10} textAnchor="middle">{yr} growing season</text>
          ))}
          <text x={m.l - 6} y={m.t - 4} textAnchor="end">NDVI</text>
        </g>
        {geom.bands.map((d, i) => <polygon key={i} points={d} fill={COLORS.far} opacity={0.18} />)}
        {geom.segments((p) => p.far?.mean ?? null).map((d, i) => <polyline key={`f${i}`} points={d} fill="none" stroke={COLORS.far} strokeWidth={2} />)}
        {geom.segments((p) => p.near?.mean ?? null).map((d, i) => <polyline key={`n${i}`} points={d} fill="none" stroke={COLORS.near} strokeWidth={2} strokeDasharray="5 4" />)}
        {geom.segments((p) => p.parcel).map((d, i) => <polyline key={`p${i}`} points={d} fill="none" stroke={COLORS.parcel} strokeWidth={2.5} />)}
        <line x1={treatX} x2={treatX} y1={m.t} y2={H - m.b} stroke="var(--text-muted)" strokeDasharray="3 3" />
        <text x={treatX + 4} y={m.t + 10}>treatment date (constructed)</text>
        {hp && (
          <g>
            <line x1={geom.x(hp.date)} x2={geom.x(hp.date)} y1={m.t} y2={H - m.b} stroke="var(--text-secondary)" strokeWidth={1} />
            {hp.parcel !== null && <circle cx={geom.x(hp.date)} cy={geom.y(hp.parcel)} r={4.5} fill={COLORS.parcel} stroke="var(--surface-1)" strokeWidth={2} />}
            {hp.far && <circle cx={geom.x(hp.date)} cy={geom.y(hp.far.mean)} r={4.5} fill={COLORS.far} stroke="var(--surface-1)" strokeWidth={2} />}
            {hp.near && <circle cx={geom.x(hp.date)} cy={geom.y(hp.near.mean)} r={4.5} fill={COLORS.near} stroke="var(--surface-1)" strokeWidth={2} />}
          </g>
        )}
      </svg>
      {hp && (
        <div className="tooltip" style={{ left: `${(geom.x(hp.date) / W) * 100}%`, top: 40, transform: geom.x(hp.date) > W * 0.7 ? 'translateX(-105%)' : 'translateX(12px)' }}>
          <div className="mono">{hp.sceneId}</div>
          <div>{hp.date}</div>
          <div>Parcel {hp.parcel === null ? 'masked' : hp.parcel.toFixed(3)}</div>
          <div>Far ring {hp.far ? `${hp.far.mean.toFixed(3)} ± ${hp.far.sd.toFixed(3)} (n ${hp.far.n})` : 'masked'}</div>
          <div>Near ring {hp.near ? `${hp.near.mean.toFixed(3)} (n ${hp.near.n})` : 'masked'}</div>
        </div>
      )}
    </div>
  );
}

/** The counterfactual reveal: claim → gross → controls → leakage → additional → lower bound → settled. */
export function CounterfactualChart({ r }: { r: VerificationResult }) {
  const m = r.measured;
  const rows = [
    { label: 'Claimed (SIMULATED Tier 3)', value: r.claimedQuantity, kind: 'claim' },
    { label: 'Gross parcel change (Tier 0)', value: m.parcelChangeHa, kind: 'measure' },
    { label: 'Far-ring control change', value: -m.controlChangeFarRingHa, kind: 'deduct' },
    { label: 'Leakage (near/far divergence)', value: -m.leakageHa, kind: 'deduct' },
    { label: 'Biophysical additionality', value: m.additionalBiophysicalHa, kind: 'measure' },
    { label: `Lower ${Math.round(r.uncertainty.interval.confidenceLevel * 100)}% bound`, value: r.lowerBound, kind: 'measure' },
    { label: 'Settled', value: r.settledQuantity, kind: 'settled' },
  ];
  const W = 560;
  const rowH = 30;
  const H = rows.length * rowH + 30;
  const labelW = 210;
  const maxAbs = Math.max(1, ...rows.map((x) => Math.abs(x.value)));
  const zero = labelW + ((W - labelW - 60) * maxAbs) / (2 * maxAbs);
  const scale = (W - labelW - 60) / (2 * maxAbs);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="chart-wrap">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="From claim to settlement">
        <line x1={zero} x2={zero} y1={8} y2={H - 20} stroke="var(--border)" />
        {rows.map((row, i) => {
          const y = 12 + i * rowH;
          const w = Math.abs(row.value) * scale;
          const x = row.value >= 0 ? zero : zero - w;
          const fill = row.kind === 'settled' ? 'var(--series-parcel)' : row.kind === 'claim' ? 'var(--simulated)' : row.kind === 'deduct' ? 'var(--neutral-band)' : 'var(--text-muted)';
          return (
            <g key={row.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={labelW} y={y - 4} width={W - labelW} height={rowH - 2} fill="transparent" />
              <text x={labelW - 8} y={y + 12} textAnchor="end">{row.label}</text>
              <rect x={x} y={y} width={Math.max(w, 1)} height={16} fill={fill} rx={row.value >= 0 ? 0 : 3} ry={3} opacity={hover === null || hover === i ? 1 : 0.6} />
              <text x={row.value >= 0 ? x + w + 6 : x - 6} y={y + 12} textAnchor={row.value >= 0 ? 'start' : 'end'}>{row.value.toFixed(2)} ha</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
