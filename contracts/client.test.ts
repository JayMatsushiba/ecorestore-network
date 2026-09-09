import { decodeFunctionData } from 'viem';
import { describe, expect, it } from 'vitest';
import { verify } from '../verification/engine.js';
import { loadEvidenceBundle } from '../verification/fixtures.js';
import { injectSyntheticEffect } from '../verification/scenario.js';
import { encodeVerifyMilestone, planHashOf, RESTORATION_DEED_ABI, toQuantity, VERDICT_STATUS_INDEX, verifyMilestoneArgs } from './client.js';

const { parcel, plan, evidence } = loadEvidenceBundle();
const planHash = planHashOf(plan);
const real = verify({ projectId: 'p', parcel, plan, evidence, runIndex: 3, computedAt: '2026-09-10T00:00:00Z' });
const scenario = verify({ projectId: 'p', parcel, plan, evidence: { ...evidence, tier0: injectSyntheticEffect(evidence.tier0, plan, 0.25) }, runIndex: 4, computedAt: '2026-09-10T00:00:00Z' });

describe('RestorationDeed client', () => {
  it('scales quantities to 4 decimals and clamps negatives to zero', () => {
    expect(toQuantity(11.2)).toBe(112_000n);
    expect(toQuantity(-4.5)).toBe(0n);
  });

  it('encodes verifyMilestone from a result and round-trips through the ABI', () => {
    const args = verifyMilestoneArgs(scenario, 1n, 1, planHash);
    expect(args.status).toBe(VERDICT_STATUS_INDEX.PARTIAL);
    expect(args.lowerBoundQuantity).toBe(toQuantity(scenario.lowerBound));
    expect(args.runIndex).toBe(4);
    const data = encodeVerifyMilestone(args);
    const decoded = decodeFunctionData({ abi: RESTORATION_DEED_ABI, data });
    expect(decoded.functionName).toBe('verifyMilestone');
    expect(decoded.args).toEqual([1n, 1, 4, scenario.resultHash, planHash, 1, args.lowerBoundQuantity, toQuantity(42)]);
  });

  it('a NOT_ADDITIONAL result carries a zero lower bound and the matching status', () => {
    const args = verifyMilestoneArgs(real, 1n, 1, planHash);
    expect(args.status).toBe(VERDICT_STATUS_INDEX.NOT_ADDITIONAL);
    expect(args.lowerBoundQuantity).toBe(0n);
  });

  it('refuses a result computed under a different plan or with a tampered hash', () => {
    expect(() => verifyMilestoneArgs(real, 1n, 1, '0x' + '11'.repeat(32) as `0x${string}`)).toThrow(/plan/);
    const tampered = { ...real, settledQuantity: 99 };
    expect(() => verifyMilestoneArgs(tampered, 1n, 1, planHash)).toThrow(/hash/);
  });
});
