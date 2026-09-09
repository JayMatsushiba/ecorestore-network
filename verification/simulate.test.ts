import { describe, expect, it } from 'vitest';
import { loadParcel, loadPlan, simulatedTiers } from './fixtures.js';
import { SIMULATED_BANNER } from './models.js';

describe('simulated tiers', () => {
  const parcel = loadParcel();
  const plan = loadPlan();

  it('are deterministic for a seed and labelled SIMULATED with the banner', () => {
    const a = simulatedTiers(parcel, plan);
    const b = simulatedTiers(parcel, plan);
    expect(a).toEqual(b);
    for (const t of [a.tier1, a.tier2, a.tier3]) {
      expect(t.provenance).toBe('SIMULATED');
      expect(t.banner).toBe(SIMULATED_BANNER);
      expect(t.bundleHash).toMatch(/^0x[0-9a-f]{64}$/);
    }
  });

  it('change with the seed and honour overrides', () => {
    const a = simulatedTiers(parcel, plan);
    const c = simulatedTiers(parcel, plan, { seed: 1 });
    expect(c.tier1.bundleHash).not.toBe(a.tier1.bundleHash);
    const d = simulatedTiers(parcel, plan, { claimedHa: 12 });
    expect(d.tier3.claim.value).toBe(12);
  });

  it('place plots, nodes and photos on parcel cells and flatline one node', () => {
    const { tier1, tier2, tier3 } = simulatedTiers(parcel, plan);
    expect(tier1.plots.length).toBe(12);
    expect(tier1.nativeSpeciesFraction).toBeGreaterThan(0.7);
    expect(tier2.nodes.filter((n) => n.flatlined).length).toBe(1);
    expect(tier3.claim.metricId).toBe(plan.metric.id);
    expect(tier3.geotaggedPhotos.every((p) => p.h3Cell.length > 0)).toBe(true);
  });
});
