/**
 * The verify pipeline — one scenario, end to end:
 *
 *   evidence → analysis (in-process or the Python service) → canonical
 *   VerificationResult → signed verdict VC → Guardian externalDataBlock
 *   request → ATS issuance calldata → RestorationDeed verification and
 *   settlement (only when a chain is configured) → assurance bundle.
 *
 * Shared by `scripts/demo.ts` (CLI, three scenarios to out/demo/) and
 * `verify/server.ts` (HTTP, one scenario per request). This module holds
 * the verifier identity and the Guardian target; it is the only place that
 * signs and the only place that submits.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, defineChain, http, parseEventLogs, type Address, type Hex } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { audit, type AuditReport } from '../auditor/agent.js';
import { encodeVerifyMilestone, MILESTONE_TYPE, planHashOf, RESTORATION_DEED_ABI, toQuantity, verifyMilestoneArgs } from '../contracts/client.js';
import {
  buildExternalDataRequest,
  buildPresentation,
  issueVerdictCredential,
  submitToGuardian,
  verifyVerdictCredential,
  type CredentialCheck,
  type SubmissionOutcome,
  type VerdictCredential,
  type VerdictPresentation,
  type VerifierIdentity,
} from '../guardian/adapter.js';
import { prepareIssuance, type IssuancePackage } from '../guardian/issuance.js';
import type { AnalysisBackend } from '../verification/analysis-contract.js';
import { keccakOf } from '../verification/canonical.js';
import { verifyWith } from '../verification/engine.js';
import { loadEvidenceBundle } from '../verification/fixtures.js';
import { parcelIdentity } from '../verification/geometry.js';
import type { AnalysisPlan, EvidenceBundle, ParcelRecord, VerificationResult } from '../verification/models.js';
import { injectSyntheticEffect } from '../verification/scenario.js';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, '..');

export const SYNTHETIC_DELTA = 0.25;
export const SCENARIO_IDS = ['real', 'synthetic', 'trend-failure'] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

export interface Scenario {
  name: ScenarioId;
  description: string;
  evidence: EvidenceBundle;
  plan: AnalysisPlan;
}

export function isScenarioId(x: string): x is ScenarioId {
  return (SCENARIO_IDS as readonly string[]).includes(x);
}

export function buildScenarios(): { parcel: ParcelRecord; list: Scenario[] } {
  const { parcel, plan, evidence } = loadEvidenceBundle();
  return {
    parcel,
    list: [
      { name: 'real', description: 'REAL Tier 0 as acquired. No intervention occurred here; the honest outcome is no settlement.', evidence, plan },
      {
        name: 'synthetic',
        description: `SIMULATED Tier 0: +${SYNTHETIC_DELTA} NDVI injected into post-window parcel observations of the real series. Sensitivity scenario to exercise settlement and issuance.`,
        evidence: { ...evidence, tier0: injectSyntheticEffect(evidence.tier0, plan, SYNTHETIC_DELTA) },
        plan,
      },
      {
        name: 'trend-failure',
        description: 'REAL Tier 0 under a plan variant whose parallel-trend criterion cannot pass → INSUFFICIENT_EVIDENCE, no settlement.',
        evidence,
        plan: { ...plan, parallelTrend: { ...plan.parallelTrend, maxAbsSlopeDiffPerYear: 0.000001, alpha: 0.999 } },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Optional on-chain execution
// ---------------------------------------------------------------------------

export interface ChainContext {
  rpcUrl: string;
  chainId: number;
  deed: Address;
  usdc: Address;
  accounts: Record<'sponsor' | 'restorer' | 'steward' | 'verifier' | 'lender' | 'bufferPool', ReturnType<typeof mnemonicToAccount>>;
}

export async function setupChain(rpcUrl: string, log: (s: string) => void, mnemonic?: string): Promise<ChainContext> {
  // `||`, not `??`: compose passes unset variables through as empty strings.
  const phrase = mnemonic || 'test test test test test test test test test test test junk';
  const roles = ['sponsor', 'restorer', 'steward', 'verifier', 'lender', 'bufferPool'] as const;
  const accounts = Object.fromEntries(roles.map((r, i) => [r, mnemonicToAccount(phrase, { addressIndex: i })])) as ChainContext['accounts'];
  const probe = createPublicClient({ transport: http(rpcUrl) });
  const chainId = await probe.getChainId();
  const chain = defineChain({ id: chainId, name: `demo-${chainId}`, nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
  const pub = createPublicClient({ chain, transport: http(rpcUrl) });
  const wallet = (who: keyof ChainContext['accounts']) => createWalletClient({ account: accounts[who], chain, transport: http(rpcUrl) });

  const artifact = (name: string) => {
    const p = join(ROOT, 'contracts', 'out', `${name}.sol`, `${name}.json`);
    if (!existsSync(p)) throw new Error(`missing artifact ${p}; run \`npm run build:contracts\``);
    return JSON.parse(readFileSync(p, 'utf8')) as { abi: readonly unknown[]; bytecode: { object: Hex } };
  };
  const usdcArt = artifact('MockUSDC');
  const deedArt = artifact('RestorationDeed');
  const deploy = async (art: ReturnType<typeof artifact>, args: unknown[]) => {
    const hash = await wallet('sponsor').deployContract({ abi: art.abi as never, bytecode: art.bytecode.object, args: args as never });
    const rc = await pub.waitForTransactionReceipt({ hash });
    if (!rc.contractAddress) throw new Error('deployment failed');
    return rc.contractAddress;
  };
  const usdc = await deploy(usdcArt, []);
  const deed = await deploy(deedArt, [usdc]);
  log(`chain ${chainId}: MockUSDC ${usdc}, RestorationDeed ${deed}`);
  const usdcAbi = usdcArt.abi as never;
  const mint = await wallet('sponsor').writeContract({ address: usdc, abi: usdcAbi, functionName: 'mint', args: [accounts.sponsor.address, 1_000_000_000_000n] });
  await pub.waitForTransactionReceipt({ hash: mint });
  const approve = await wallet('sponsor').writeContract({ address: usdc, abi: usdcAbi, functionName: 'approve', args: [deed, 2n ** 255n] });
  await pub.waitForTransactionReceipt({ hash: approve });
  return { rpcUrl, chainId, deed, usdc, accounts };
}

export interface ChainRun {
  deedId: bigint;
  runIndex: number;
  txs: Array<{ step: string; hash: Hex }>;
  balances: Record<string, string>;
  milestoneState: string;
}

const MILESTONE_STATES = ['PENDING', 'VERIFIED', 'INSUFFICIENT', 'FAILED', 'RELEASED', 'RECLAIMED'];

export async function runOnChain(
  ctx: ChainContext,
  sc: Scenario,
  parcel: ParcelRecord,
  computeResult: (runIndex: number) => Promise<VerificationResult>,
  log: (s: string) => void,
): Promise<{ result: VerificationResult; chain: ChainRun }> {
  const chain = defineChain({ id: ctx.chainId, name: 'demo', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [ctx.rpcUrl] } } });
  const pub = createPublicClient({ chain, transport: http(ctx.rpcUrl) });
  const wallet = (who: keyof ChainContext['accounts']) => createWalletClient({ account: ctx.accounts[who], chain, transport: http(ctx.rpcUrl) });
  const txs: ChainRun['txs'] = [];
  const send = async (step: string, who: keyof ChainContext['accounts'], functionName: string, args: unknown[]) => {
    const hash = await wallet(who).writeContract({ address: ctx.deed, abi: RESTORATION_DEED_ABI, functionName: functionName as never, args: args as never });
    const rc = await pub.waitForTransactionReceipt({ hash });
    if (rc.status !== 'success') throw new Error(`${step} reverted`);
    txs.push({ step, hash });
    log(`  ${step}: ${hash}`);
    return rc;
  };

  const identity = parcelIdentity(parcel.parcelId, parcel.geometry, parcel.h3Resolution);
  const projectRc = await send('createProject', 'restorer', 'createProject', [{
    h3Root: identity.h3Root,
    geometryHash: identity.geometryHash,
    baselineRef: keccakOf({ baseline: sc.plan.windows.pre }),
    metricId: keccakOf(sc.plan.metric.id),
    tenureAttestationHash: parcel.tenureAttestation.documentHash,
    tenureType: 3,
    encumbranceHash: keccakOf(parcel.encumbrances),
    restorer: ctx.accounts.restorer.address,
    steward: ctx.accounts.steward.address,
  }]);
  const projectId = parseEventLogs({ abi: RESTORATION_DEED_ABI, logs: projectRc.logs, eventName: 'ProjectCreated' })[0]!.args.projectId;
  const planHash = planHashOf(sc.plan);
  const now = BigInt(Math.floor(Date.now() / 1000));
  const deedRc = await send('createDeed', 'sponsor', 'createDeed', [
    { projectId, verifier: ctx.accounts.verifier.address, analysisPlanHash: planHash, methodologyVersion: keccakOf('ecorestore-did-leakage-lowerbound-1.0.0'), confidenceBps: 9500, benefitShareBps: 1000, retentionBps: 1500, bufferPool: ctx.accounts.bufferPool.address },
    [
      { mType: MILESTONE_TYPE.MOBILISATION, amount: 20_000_000_000n, thresholdQuantity: 0n, notBefore: 0n, deadline: 0n },
      { mType: MILESTONE_TYPE.ESTABLISHMENT, amount: 100_000_000_000n, thresholdQuantity: toQuantity(42), notBefore: 0n, deadline: now + 86_400n * 365n },
      { mType: MILESTONE_TYPE.PERSISTENCE, amount: 80_000_000_000n, thresholdQuantity: toQuantity(42), notBefore: now + 86_400n * 300n, deadline: now + 86_400n * 800n },
    ],
  ]);
  const deedId = parseEventLogs({ abi: RESTORATION_DEED_ABI, logs: deedRc.logs, eventName: 'DeedCreated' })[0]!.args.deedId;
  await send('fundDeed', 'sponsor', 'fundDeed', [deedId, 200_000_000_000n]);
  const erc20 = [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }] as const;
  const bal = async (who: keyof ChainContext['accounts']) => (await pub.readContract({ address: ctx.usdc, abi: erc20, functionName: 'balanceOf', args: [ctx.accounts[who].address] })) as bigint;
  const before = { restorer: await bal('restorer'), steward: await bal('steward') };
  await send(`submitEvidence(tier0 ${sc.evidence.tier0.provenance})`, 'restorer', 'submitEvidence', [deedId, 1, 0, sc.evidence.tier0.provenance !== 'REAL', `snapshot:${sc.evidence.tier0.snapshotHash}`]);
  await send('submitEvidence(tier3 SIMULATED)', 'restorer', 'submitEvidence', [deedId, 1, 3, true, `bundle:${sc.evidence.tier3.bundleHash}`]);

  // Mobilisation: effort attested by the verifier from the (simulated) planting records.
  await send('recordVerificationRun(effort)', 'verifier', 'recordVerificationRun', [deedId, planHash]);
  await send('verifyMilestone(mobilisation)', 'verifier', 'verifyMilestone', [deedId, 0, 1, keccakOf({ effort: sc.evidence.tier3.bundleHash, deedId: deedId.toString() }), planHash, 0, 0n, 0n]);
  await send('drawMobilisation', 'restorer', 'drawMobilisation', [deedId, 0]);

  // Outcome verification: record the run first, cite it in the result.
  const runRc = await send('recordVerificationRun(outcome)', 'verifier', 'recordVerificationRun', [deedId, planHash]);
  const runLog = parseEventLogs({ abi: RESTORATION_DEED_ABI, logs: runRc.logs, eventName: 'VerificationRunRecorded' })[0]!;
  const runIndex = Number(runLog.args.runIndex);
  const result = await computeResult(runIndex);
  const args = verifyMilestoneArgs(result, deedId, 1, planHash);
  await send('verifyMilestone(establishment)', 'verifier', 'verifyMilestone', [args.deedId, args.milestoneId, args.runIndex, args.resultHash, args.analysisPlanHash, args.status, args.lowerBoundQuantity, args.claimedQuantity]);
  const milestone = await pub.readContract({ address: ctx.deed, abi: RESTORATION_DEED_ABI, functionName: 'getMilestone', args: [deedId, 1] });
  let stateName = MILESTONE_STATES[milestone.state] ?? String(milestone.state);
  if (stateName === 'VERIFIED') {
    await send('releaseTranche(establishment)', 'sponsor', 'releaseTranche', [deedId, 1]);
    stateName = 'RELEASED';
  } else {
    log(`  releaseTranche skipped: milestone state ${stateName}`);
  }
  const ms = await pub.readContract({ address: ctx.deed, abi: RESTORATION_DEED_ABI, functionName: 'availableEscrow', args: [deedId] });
  const deedState = await pub.readContract({ address: ctx.deed, abi: RESTORATION_DEED_ABI, functionName: 'getDeed', args: [deedId] });
  const balances: Record<string, string> = {
    restorerReceived: fmtUsdc((await bal('restorer')) - before.restorer),
    stewardReceived: fmtUsdc((await bal('steward')) - before.steward),
    retained: fmtUsdc(deedState.retained),
    escrowAvailable: fmtUsdc(ms),
  };
  return { result, chain: { deedId, runIndex, txs, balances, milestoneState: stateName } };
}

function fmtUsdc(x: bigint): string {
  return `${(Number(x) / 1e6).toFixed(2)} USDC`;
}

// ---------------------------------------------------------------------------
// Trajectory — the additionality view's data
// ---------------------------------------------------------------------------

export interface TrajectoryPoint {
  sceneId: string;
  date: string;
  parcel: number | null;
  far: { mean: number; sd: number; n: number } | null;
  near: { mean: number; sd: number; n: number } | null;
}

/**
 * Per-scene NDVI for the parcel, the matched far-ring control envelope
 * (mean ± sd) and the matched near-ring mean.
 */
export function trajectory(evidence: EvidenceBundle, result: VerificationResult): { window: VerificationResult['window']; tier0Provenance: string; points: TrajectoryPoint[] } {
  const t0 = evidence.tier0;
  const idx = new Map(t0.units.map((u, i) => [u.unitId, i]));
  const parcelIdx = idx.get('parcel')!;
  const far = result.controlSets.find((c) => c.ring === 'far')!.matchedUnitIds.map((id) => idx.get(id)!);
  const near = result.controlSets.find((c) => c.ring === 'near')!.matchedUnitIds.map((id) => idx.get(id)!);
  const stats = (obs: Array<number | null>, ids: number[]) => {
    const v = ids.map((i) => obs[i]).filter((x): x is number => x !== null && x !== undefined);
    if (v.length === 0) return null;
    const m = v.reduce((s, x) => s + x, 0) / v.length;
    const sd = v.length > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1)) : 0;
    return { mean: +m.toFixed(4), sd: +sd.toFixed(4), n: v.length };
  };
  const scenes = new Set(result.stacSceneIds);
  return {
    window: result.window,
    tier0Provenance: t0.provenance,
    points: t0.scenes
      .filter((s) => scenes.has(s.sceneId))
      .map((s) => {
        const obs = t0.observations[s.sceneId]!;
        return { sceneId: s.sceneId, date: s.datetime.slice(0, 10), parcel: obs.ndvi[parcelIdx] ?? null, far: stats(obs.ndvi, far), near: stats(obs.ndvi, near) };
      }),
  };
}

// ---------------------------------------------------------------------------
// One scenario, end to end
// ---------------------------------------------------------------------------

export interface GuardianTargetConfig {
  baseUrl?: string | undefined;
  policyId: string;
  blockTag: string;
  policyTag: string;
}

export function guardianTargetFromEnv(env: NodeJS.ProcessEnv = process.env): GuardianTargetConfig {
  return {
    baseUrl: env['GUARDIAN_URL'] || undefined,
    policyId: env['GUARDIAN_POLICY_ID'] || 'ecorestore-policy-not-deployed',
    blockTag: env['GUARDIAN_BLOCK_TAG'] || 'ecorestore_verdict_ingest',
    policyTag: env['GUARDIAN_POLICY_TAG'] || 'Ecorestore_Riparian_v1',
  };
}

export interface PipelineOptions {
  backend: AnalysisBackend;
  identity: VerifierIdentity;
  guardian: GuardianTargetConfig;
  outboxDir: string;
  chain?: ChainContext | null;
  computedAt?: string;
  log?: (s: string) => void;
  /** Where the request would be sent on a Guardian reachable from the host, for display. */
  guardianDisplayUrl?: string | undefined;
}

export interface AssuranceBundle {
  scenario: ScenarioId;
  description: string;
  tier0Provenance: VerificationResult['tier0Provenance'];
  trajectory: ReturnType<typeof trajectory>;
  simulatedTiersBanner: string;
  assuranceAdjustedComparison: string;
  result: VerificationResult;
  verdictCredential: VerdictCredential;
  credentialCheck: CredentialCheck;
  /** `document` is the full Verifiable Presentation, so a third party can re-hash it against the ERC-1643 documentHash. */
  presentation: { presentationHash: Hex; guardian: { stoodUp: false; note: string }; document: VerdictPresentation };
  guardianSubmission: { request: { method: 'POST'; path: string; url: string | null }; outcome: SubmissionOutcome };
  issuance: (Omit<IssuancePackage, 'value' | 'hcs'> & { value: string; hcs: { topicId: string; sequenceNumber: string; note: string } }) | { prepared: false; reason: string };
  contract: {
    broadcast: boolean;
    chain: (Omit<ChainRun, 'deedId'> & { deedId: string }) | null;
    verifyMilestone: { deedId: string; milestoneId: number; runIndex: number; resultHash: Hex; analysisPlanHash: Hex; status: number; lowerBoundQuantity: string; claimedQuantity: string; calldata: Hex };
  };
  auditorReport: AuditReport;
  runtime: { analysisEngine: VerificationResult['analysisEngine']; computedAt: string };
}

export async function runScenario(sc: Scenario, parcel: ParcelRecord, opts: PipelineOptions): Promise<AssuranceBundle> {
  const log = opts.log ?? (() => {});
  const computedAt = opts.computedAt ?? new Date().toISOString();
  const compute = (runIndex: number) => verifyWith({ projectId: 'kootenay-demo', parcel, plan: sc.plan, evidence: sc.evidence, runIndex, computedAt }, opts.backend);

  let result: VerificationResult;
  let chain: ChainRun | null = null;
  if (opts.chain) ({ result, chain } = await runOnChain(opts.chain, sc, parcel, compute, log));
  else result = await compute(1);

  const vc = issueVerdictCredential(result, opts.identity, computedAt);
  const check = verifyVerdictCredential(vc, result);
  const vp = buildPresentation(vc, result, opts.identity.did);
  const guardianReq = buildExternalDataRequest(vc, { ...opts.guardian, ownerDid: opts.identity.did });
  const submission = await submitToGuardian(guardianReq, { outboxDir: opts.outboxDir });
  const issuance = prepareIssuance(result, vp, (opts.chain?.accounts.sponsor.address ?? '0x0000000000000000000000000000000000000001') as Address);
  const report = audit(result, sc.evidence, { verificationRunCount: chain ? chain.runIndex : 1, submittedResultCount: 1, priorReversals: 0, priorClaims: [] });
  const deedPlanHash = planHashOf(sc.plan);
  const contractArgs = verifyMilestoneArgs(result, chain?.deedId ?? 1n, 1, deedPlanHash);

  return {
    scenario: sc.name,
    description: sc.description,
    tier0Provenance: result.tier0Provenance,
    trajectory: trajectory(sc.evidence, result),
    simulatedTiersBanner: result.simulatedTiersBanner,
    assuranceAdjustedComparison: `${result.settledQuantity} ha defensible vs. ${result.claimedQuantity} ha at risk`,
    result,
    verdictCredential: vc,
    credentialCheck: check,
    presentation: { presentationHash: vp.presentationHash, guardian: vp.guardian, document: vp },
    guardianSubmission: { request: { method: guardianReq.method, path: guardianReq.path, url: opts.guardianDisplayUrl ? new URL(guardianReq.path, opts.guardianDisplayUrl).toString() : guardianReq.url }, outcome: submission },
    issuance: issuance ? { ...issuance, value: issuance.value.toString(), hcs: { ...issuance.hcs, sequenceNumber: issuance.hcs.sequenceNumber.toString() } } : { prepared: false, reason: `no issuance for status ${result.verificationStatus}` },
    contract: {
      broadcast: chain !== null,
      chain: chain ? { ...chain, deedId: chain.deedId.toString() } : null,
      verifyMilestone: { ...contractArgs, deedId: contractArgs.deedId.toString(), lowerBoundQuantity: contractArgs.lowerBoundQuantity.toString(), claimedQuantity: contractArgs.claimedQuantity.toString(), calldata: encodeVerifyMilestone(contractArgs) },
    },
    auditorReport: report,
    runtime: { analysisEngine: result.analysisEngine, computedAt },
  };
}
