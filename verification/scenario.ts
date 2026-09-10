/**
 * Sensitivity scenario: inject a synthetic treatment effect into the REAL
 * parcel series so the settlement path can be exercised end to end.
 *
 * The returned snapshot is SIMULATED at Tier 0. It is never presented as an
 * observation. Its provenance flag, its note and every artefact derived from
 * it say so.
 */
import { keccakOf } from './canonical.js';
import type { AnalysisPlan, Tier0Snapshot } from './models.js';

export function injectSyntheticEffect(real: Tier0Snapshot, plan: AnalysisPlan, deltaNdvi: number): Tier0Snapshot {
  if (real.provenance !== 'REAL') throw new Error('inject only into a REAL snapshot');
  const parcelUnitIdx = new Set(real.units.map((u, i) => (u.zone === 'parcel' || u.zone === 'parcel_cell' ? i : -1)).filter((i) => i >= 0));
  const postStart = plan.windows.post[0]!.start;
  const observations: Tier0Snapshot['observations'] = {};
  for (const scene of real.scenes) {
    const obs = real.observations[scene.sceneId];
    if (!obs) continue;
    const isPost = scene.datetime.slice(0, 10) >= postStart;
    observations[scene.sceneId] = {
      ...obs,
      ndvi: obs.ndvi.map((v, i) => (v !== null && isPost && parcelUnitIdx.has(i) ? Math.min(1, Math.round((v + deltaNdvi) * 10_000) / 10_000) : v)),
    };
  }
  const { snapshotHash: _old, ...rest } = real;
  const partial: Omit<Tier0Snapshot, 'snapshotHash'> = {
    ...rest,
    provenance: 'SIMULATED',
    syntheticEffectNote: `SYNTHETIC TREATMENT EFFECT INJECTED: +${deltaNdvi} NDVI added to every post-window parcel observation of the real snapshot ${real.snapshotHash}. Sensitivity scenario only — not an observation.`,
    observations,
  };
  return { ...partial, snapshotHash: keccakOf(partial) };
}
