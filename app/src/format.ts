/**
 * Small, generic display-formatting helpers shared across pages. These
 * only reformat how a real value is displayed (spacing, casing, units) —
 * they never derive, adjust, or invent a value.
 */

const METRIC_LABELS: Record<string, string> = {
  canopy_cover_fraction_pct: "Canopy cover fraction (%)",
};

export function formatMetricLabel(metric: string): string {
  return METRIC_LABELS[metric] ?? metric.replaceAll("_", " ");
}

/** Evidence sources are all "synthetic_..." identifiers; strip that prefix here rather than showing "synthetic" twice next to the "(synthetic)" label already applied by the caller. */
export function formatEvidenceSource(source: string): string {
  return source.replace(/^synthetic_/, "").replaceAll("_", " ");
}
