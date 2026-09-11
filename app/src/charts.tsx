import { useMemo, useState } from 'react';
import { Badge } from './Badge';
import { fmt } from './copy';
import type { Provenance, TrajectoryPoint, VerificationResult } from './types';

function dateToX(date: string, x0: number, x1: number, t0: number, t1: number): number {
  const t = Date.parse(`${date}T00:00:00Z`);
  return x0 + ((t - t0) / (t1 - t0)) * (x1 - x0);
}

/**
 * Additionality view: parcel NDVI trajectory against the far-ring control envelope
 * (mean ± sd), with the near ring shown separately so leakage is visible. Every scene is
 * a real acquisition; seasons are drawn as separate segments. The two control series
 * share one cool, neutral family and differ by weight and dash, so they read as one
 * category, comparison land, distinct from the parcel. The amber range is reserved for
 * simulated provenance, so the parcel line turns amber only when its Tier 0 is simulated.
 */
const W = 880;
const H = 320;
const m = { l: 50, r: 16, t: 20, b: 38 };

export function TrajectoryChart({ points, treatmentDate, tier0Provenance, controlProvenance, rings }: { points: TrajectoryPoint[]; treatmentDate: string; tier0Provenance: Provenance; controlProvenance: Provenance; rings: { near: { innerM: number; outerM: number } | undefined; far: { innerM: number; outerM: number } | undefined } }) {
  const [hover, setHover] = useState<number | null>(null);
  const parcelColor = tier0Provenance === 'REAL' ? 'var(--series-parcel)' : 'var(--simulated)';

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
        <span><i className="swatch" style={{ background: parcelColor }} />Parcel <Badge p={tier0Provenance} /></span>
        <span><i className="swatch fill" style={{ background: 'var(--series-far)' }} />Comparison land, far ring {rings.far ? `${rings.far.innerM}–${rings.far.outerM} m` : ''}: mean ± sd of the matched cells <Badge p={controlProvenance} /></span>
        <span><i className="swatch dashed" style={{ borderColor: 'var(--series-near)' }} />Comparison land, near ring {rings.near ? `${rings.near.innerM}–${rings.near.outerM} m` : ''}, leakage-exposed <Badge p={controlProvenance} /></span>
      </div>
      <div className="chart-scroll">
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Parcel NDVI against comparison land over time, one point per Sentinel-2 scene"
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
              <text key={yr} x={geom.x(`${yr}-07-31`)} y={H - 12} textAnchor="middle">{yr} growing season</text>
            ))}
            <text x={m.l - 6} y={m.t - 6} textAnchor="end">NDVI</text>
          </g>
          {geom.bands.map((d, i) => <polygon key={i} points={d} fill="var(--series-far)" opacity={0.22} />)}
          {geom.segments((p) => p.far?.mean ?? null).map((d, i) => <polyline key={`f${i}`} points={d} fill="none" stroke="var(--series-far)" strokeWidth={2} />)}
          {geom.segments((p) => p.near?.mean ?? null).map((d, i) => <polyline key={`n${i}`} points={d} fill="none" stroke="var(--series-near)" strokeWidth={1.5} strokeDasharray="5 4" />)}
          {geom.segments((p) => p.parcel).map((d, i) => <polyline key={`p${i}`} points={d} fill="none" stroke={parcelColor} strokeWidth={2.75} />)}
          <line x1={treatX} x2={treatX} y1={m.t} y2={H - m.b} stroke="var(--text-muted)" strokeDasharray="3 3" />
          <text x={treatX + 4} y={m.t + 12}>treatment date (constructed)</text>
          {hp && (
            <g>
              <line x1={geom.x(hp.date)} x2={geom.x(hp.date)} y1={m.t} y2={H - m.b} stroke="var(--text-secondary)" strokeWidth={1} />
              {hp.parcel !== null && <circle cx={geom.x(hp.date)} cy={geom.y(hp.parcel)} r={4.5} fill={parcelColor} stroke="var(--surface-1)" strokeWidth={2} />}
              {hp.far && <circle cx={geom.x(hp.date)} cy={geom.y(hp.far.mean)} r={4.5} fill="var(--series-far)" stroke="var(--surface-1)" strokeWidth={2} />}
              {hp.near && <circle cx={geom.x(hp.date)} cy={geom.y(hp.near.mean)} r={4.5} fill="var(--series-near)" stroke="var(--surface-1)" strokeWidth={2} />}
            </g>
          )}
        </svg>
      </div>
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

interface Row {
  label: string;
  value: number;
  kind: 'measure' | 'deduct' | 'result' | 'settled';
}

/**
 * From the claim to the settled quantity. The claim is a reference line, not a bar: it
 * is the simulated number and it would set the scale for everything real. Every row is
 * an operation, so the sign and the word agree. A zero settlement is drawn as a marked
 * tick that carries its value, never as absence.
 */
export function CounterfactualChart({ r }: { r: VerificationResult }) {
  const m = r.measured;
  const level = Math.round(r.uncertainty.interval.confidenceLevel * 100);
  const rows: Row[] = [
    { label: 'Gross change measured on the parcel', value: m.parcelChangeHa, kind: 'measure' },
    { label: 'less the change on far-ring comparison land', value: -m.controlChangeFarRingHa, kind: 'deduct' },
    { label: 'less leakage, where the near ring diverges from the far ring', value: -m.leakageHa, kind: 'deduct' },
    { label: 'equals biophysical additionality', value: m.additionalBiophysicalHa, kind: 'result' },
    { label: `Lower ${level}% bound of that, the quantity that would survive an audit`, value: r.lowerBound, kind: 'result' },
    { label: 'Settled', value: r.settledQuantity, kind: 'settled' },
  ];
  const maxAbs = Math.max(1, ...rows.map((x) => Math.abs(x.value)));
  const [hover, setHover] = useState<number | null>(null);
  const pct = (v: number) => (Math.abs(v) / maxAbs) * 50;
  const ratio = r.claimedQuantity / maxAbs;
  return (
    <div className="waterfall">
      <p className="waterfall-claim">
        <span className="claim-value">{fmt(r.claimedQuantity)} ha</span> claimed by the restorer <Badge p="SIMULATED" />
        <span className="muted"> · the reference every bar below is measured against{ratio > 1.5 ? `, ${ratio.toFixed(1)} times wider than the widest bar` : ''}. The rule walks it down to what the measurement can defend.</span>
      </p>
      <table className="waterfall-table">
        <caption className="sr-only">Each step from the claimed quantity to the settled quantity, in hectares</caption>
        <tbody>
          {rows.map((row, i) => {
            const zeroSettled = row.kind === 'settled' && row.value === 0;
            return (
              <tr key={row.label} className={`wf-${row.kind} ${hover !== null && hover !== i ? 'dim' : ''}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <th scope="row">{row.label}</th>
                <td className="track" aria-hidden="true">
                  <span className="zero" />
                  {zeroSettled
                    ? <span className="tick" title="0.00 ha settled" />
                    : <span className="bar" style={row.value >= 0 ? { left: '50%', width: `${pct(row.value)}%` } : { right: '50%', width: `${pct(row.value)}%` }} />}
                </td>
                <td className="num value">{fmt(row.value)} ha{zeroSettled ? <span className="muted"> · nothing released</span> : null}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
