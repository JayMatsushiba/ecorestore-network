import type { Provenance } from './types';

/** The REAL / SIMULATED badge. One treatment at every level, from banner to table row. */
export function Badge({ p }: { p: Provenance }) {
  return <span className={`badge ${p === 'REAL' ? 'real' : 'simulated'}`}>{p}</span>;
}

export type BuildStatus = 'runs' | 'prepared' | 'not-built';

const STATUS_LABEL: Record<BuildStatus, string> = { runs: 'RUNS', prepared: 'PREPARED', 'not-built': 'NOT BUILT' };

/** Build-state marker, in the same badge treatment so the page has one visual language for status. */
export function StatusBadge({ s }: { s: BuildStatus }) {
  return <span className={`badge status-${s}`}>{STATUS_LABEL[s]}</span>;
}
