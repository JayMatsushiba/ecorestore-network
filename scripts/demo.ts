/**
 * End-to-end demonstration (Idea 0.3 §10):
 *
 *   evidence → deterministic verification → signed verdict VC → Guardian
 *   externalDataBlock request → ATS issuance calldata → RestorationDeed
 *   verification and settlement.
 *
 * Three scenarios are run and written to out/demo/<scenario>/:
 *
 *   real            REAL Tier 0 as acquired. No intervention took place on this
 *                   ground, so the honest outcome is no settlement.
 *   synthetic       The same real series with a SYNTHETIC treatment effect
 *                   injected and labelled SIMULATED at Tier 0. Exercises the
 *                   settlement, VC, Guardian and issuance path.
 *   trend-failure   The real snapshot under a plan whose parallel-trend
 *                   criterion cannot be met → INSUFFICIENT_EVIDENCE.
 *
 * On-chain steps run only when DEMO_RPC_URL is set (e.g. a local anvil);
 * otherwise the exact calldata is written and reported as NOT broadcast.
 *
 *   npm run demo
 *   DEMO_RPC_URL=http://127.0.0.1:8545 npm run demo
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, defineChain, http, parseEventLogs, type Address, type Hex } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { audit } from '../auditor/agent.js';
import { encodeVerifyMilestone, MILESTONE_TYPE, planHashOf, RESTORATION_DEED_ABI, toQuantity, verifyMilestoneArgs } from '../contracts/client.js';
import { buildExternalDataRequest, buildPresentation, createVerifierIdentity, issueVerdictCredential, submitToGuardian, verifyVerdictCredential } from '../guardian/adapter.js';
import { prepareIssuance } from '../guardian/issuance.js';
import { keccakOf } from '../verification/canonical.js';
import { verify } from '../verification/engine.js';
import { loadEvidenceBundle } from '../verification/fixtures.js';
import { parcelIdentity } from '../verification/geometry.js';
import type { AnalysisPlan, EvidenceBundle, VerificationResult } from '../verification/models.js';
import { injectSyntheticEffect } from '../verification/scenario.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const OUT = join(ROOT, 'out', 'demo');
const OUTBOX = join(ROOT, 'guardian', 'outbox');
const SYNTHETIC_DELTA = 0.25;
const COMPUTED_AT = process.env['DEMO_FIXED_TIME'] ?? new Date().toISOString();

interface Scenario {
  name: 'real' | 'synthetic' | 'trend-failure';
  description: string;
  evidence: EvidenceBundle;
  plan: AnalysisPlan;
}

function scenarios(): { parcel: ReturnType<typeof loadEvidenceBundle>['parcel']; list: Scenario[] } {
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

interface ChainContext {
  rpcUrl: string;
  chainId: number;
  deed: Address;
  usdc: Address;
  accounts: Record<'sponsor' | 'restorer' | 'steward' | 'verifier' | 'lender' | 'bufferPool', ReturnType<typeof mnemonicToAccount>>;
}

async function setupChain(log: (s: string) => void): Promise<ChainContext | null> {
  const rpcUrl = process.env['DEMO_RPC_URL'];
  if (!rpcUrl) return null;
  const mnemonic = process.env['DEMO_MNEMONIC'] ?? 'test test test test test test test test test test test junk';
  const roles = ['sponsor', 'restorer', 'steward', 'verifier', 'lender', 'bufferPool'] as const;
  const accounts = Object.fromEntries(roles.map((r, i) => [r, mnemonicToAccount(mnemonic, { addressIndex: i })])) as ChainContext['accounts'];
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

interface ChainRun {
  deedId: bigint;
  runIndex: number;
  txs: Array<{ step: string; hash: Hex }>;
  balances: Record<string, string>;
  milestoneState: string;
}

const MILESTONE_STATES = ['PENDING', 'VERIFIED', 'INSUFFICIENT', 'FAILED', 'RELEASED', 'RECLAIMED'];

async function runOnChain(ctx: ChainContext, sc: Scenario, parcel: ReturnType<typeof loadEvidenceBundle>['parcel'], computeResult: (runIndex: number) => VerificationResult, log: (s: string) => void): Promise<{ result: VerificationResult; chain: ChainRun }> {
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
  const result = computeResult(runIndex);
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

/**
 * Per-scene NDVI for the parcel, the matched far-ring control envelope
 * (mean ± sd) and the matched near-ring mean — the additionality view's data.
 */
function trajectory(evidence: EvidenceBundle, result: VerificationResult) {
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
// Main
// ---------------------------------------------------------------------------

async function main() {
  const log = (s: string) => console.log(s);
  mkdirSync(OUT, { recursive: true });
  const identity = createVerifierIdentity(process.env['VERIFIER_SEED'] ?? 'ecorestore-demo-verifier');
  const chainCtx = await setupChain(log);
  if (!chainCtx) log('DEMO_RPC_URL not set: contract calldata will be prepared, not broadcast.');
  const { parcel, list } = scenarios();
  const summary: string[] = ['# Ecorestore demo run', '', `Computed at ${COMPUTED_AT}. Verifier DID ${identity.did}.`, ''];

  for (const sc of list) {
    log(`\n=== scenario: ${sc.name} ===`);
    log(sc.description);
    const dir = join(OUT, sc.name);
    mkdirSync(dir, { recursive: true });
    const compute = (runIndex: number) => verify({ projectId: 'kootenay-demo', parcel, plan: sc.plan, evidence: sc.evidence, runIndex, computedAt: COMPUTED_AT });

    let result: VerificationResult;
    let chain: ChainRun | null = null;
    if (chainCtx) ({ result, chain } = await runOnChain(chainCtx, sc, parcel, compute, log));
    else result = compute(1);

    const vc = issueVerdictCredential(result, identity, COMPUTED_AT);
    const check = verifyVerdictCredential(vc, result);
    const vp = buildPresentation(vc, result, identity.did);
    const guardianReq = buildExternalDataRequest(vc, {
      baseUrl: process.env['GUARDIAN_URL'],
      policyId: process.env['GUARDIAN_POLICY_ID'] ?? 'ecorestore-policy-not-deployed',
      blockTag: process.env['GUARDIAN_BLOCK_TAG'] ?? 'ecorestore_verdict_ingest',
      policyTag: process.env['GUARDIAN_POLICY_TAG'] ?? 'Ecorestore_Riparian_v1',
      ownerDid: identity.did,
    });
    const submission = await submitToGuardian(guardianReq, { outboxDir: OUTBOX });
    const issuance = prepareIssuance(result, vp, (chainCtx?.accounts.sponsor.address ?? '0x0000000000000000000000000000000000000001') as Address);
    const report = audit(result, sc.evidence, { verificationRunCount: chain ? chain.runIndex : 1, submittedResultCount: 1, priorReversals: 0, priorClaims: [] });
    const deedPlanHash = planHashOf(sc.plan);
    const contractArgs = verifyMilestoneArgs(result, chain?.deedId ?? 1n, 1, deedPlanHash);
    const contract = {
      broadcast: chain !== null,
      chain: chain ? { ...chain, deedId: chain.deedId.toString() } : null,
      verifyMilestone: { ...contractArgs, deedId: contractArgs.deedId.toString(), lowerBoundQuantity: contractArgs.lowerBoundQuantity.toString(), claimedQuantity: contractArgs.claimedQuantity.toString(), calldata: encodeVerifyMilestone(contractArgs) },
    };

    const bundle = {
      scenario: sc.name,
      description: sc.description,
      tier0Provenance: result.tier0Provenance,
      trajectory: trajectory(sc.evidence, result),
      simulatedTiersBanner: result.simulatedTiersBanner,
      assuranceAdjustedComparison: `${result.settledQuantity} ha defensible vs. ${result.claimedQuantity} ha at risk`,
      result,
      verdictCredential: vc,
      credentialCheck: check,
      presentation: { presentationHash: vp.presentationHash, guardian: vp.guardian },
      guardianSubmission: { request: { method: guardianReq.method, path: guardianReq.path, url: guardianReq.url }, outcome: submission },
      issuance: issuance ? { ...issuance, value: issuance.value.toString(), hcs: { ...issuance.hcs, sequenceNumber: issuance.hcs.sequenceNumber.toString() } } : { prepared: false, reason: `no issuance for status ${result.verificationStatus}` },
      contract,
      auditorReport: report,
    };
    writeFileSync(join(dir, 'verification-result.json'), JSON.stringify(result, null, 2));
    writeFileSync(join(dir, 'verdict-vc.json'), JSON.stringify(vc, null, 2));
    writeFileSync(join(dir, 'presentation.json'), JSON.stringify(vp, null, 2));
    writeFileSync(join(dir, 'assurance-bundle.json'), JSON.stringify(bundle, null, 2));

    log(`status ${result.verificationStatus}: ${result.statusReason}`);
    log(`settled ${result.settledQuantity} ha of ${result.claimedQuantity} claimed; CI [${result.uncertainty.interval.lower}, ${result.uncertainty.interval.upper}]; coverage ${result.uncertainty.empiricalCoverage.empirical}`);
    log(`VC ${check.signatureValid && check.schemaValid && check.resultHashMatches ? 'verified' : 'FAILED'}; Guardian: ${submission.detail}; issuance: ${issuance ? `prepared ${issuance.valueHa} ha into partition ${issuance.partition.slice(0, 12)}… (not broadcast)` : 'none'}`);
    if (chain) log(`on-chain: milestone ${chain.milestoneState}; restorer +${chain.balances['restorerReceived']}, steward +${chain.balances['stewardReceived']}, retained ${chain.balances['retained']}, escrow ${chain.balances['escrowAvailable']}`);

    summary.push(`## ${sc.name}`, '', sc.description, '', `- status: **${result.verificationStatus}** — ${result.statusReason}`, `- claimed ${result.claimedQuantity} ha; gross parcel ${result.measured.parcelChangeHa} ha; far ring ${result.measured.controlChangeFarRingHa} ha; leakage ${result.measured.leakageHa} ha; additional ${result.measured.additionalBiophysicalHa} ha`, `- ${Math.round(result.uncertainty.interval.confidenceLevel * 100)}% CI [${result.uncertainty.interval.lower}, ${result.uncertainty.interval.upper}] ha; empirical coverage ${result.uncertainty.empiricalCoverage.empirical} over ${result.uncertainty.empiricalCoverage.placebos} placebos`, `- parallel trend ${result.parallelTrend.status} (p ${result.parallelTrend.pValue}); settled **${result.settledQuantity} ha**`, `- Tier 0 provenance: ${result.tier0Provenance.provenance}; VC signature ${check.signatureValid ? 'valid' : 'INVALID'}; Guardian ${submission.mode}; issuance ${issuance ? 'prepared (not broadcast)' : 'none'}`, chain ? `- on-chain (chain ${chainCtx!.chainId}): deed ${chain.deedId}, run ${chain.runIndex}, milestone ${chain.milestoneState}, restorer +${chain.balances['restorerReceived']}, steward +${chain.balances['stewardReceived']}, retained ${chain.balances['retained']}` : '- on-chain: not run (DEMO_RPC_URL unset); calldata prepared', '');
  }
  writeFileSync(join(OUT, 'summary.md'), summary.join('\n'));
  log(`\nwrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
