/**
 * End-to-end demonstration:
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
 * With ANALYSIS_URL set the numbers come from the Python analysis service;
 * otherwise from the in-process TypeScript reference. With GUARDIAN_URL set
 * the verdict is POSTed to Guardian; otherwise staged to guardian/outbox/.
 *
 *   npm run demo
 *   DEMO_RPC_URL=http://127.0.0.1:8545 npm run demo
 *   ANALYSIS_URL=http://127.0.0.1:8000 GUARDIAN_URL=http://localhost:3000 npm run demo
 *
 * The pipeline itself lives in verify/pipeline.ts and is shared with the
 * verify HTTP service.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createVerifierIdentity } from '../guardian/adapter.js';
import { analysisServiceInfo, remoteBackend } from '../verification/analysis-client.js';
import { localBackend } from '../verification/engine.js';
import { buildScenarios, guardianTargetFromEnv, ROOT, runScenario, setupChain, type ChainContext } from '../verify/pipeline.js';

const OUT = join(ROOT, 'out', 'demo');
const OUTBOX = join(ROOT, 'guardian', 'outbox');
const COMPUTED_AT = process.env['DEMO_FIXED_TIME'] ?? new Date().toISOString();

async function main() {
  const log = (s: string) => console.log(s);
  mkdirSync(OUT, { recursive: true });
  const identity = createVerifierIdentity(process.env['VERIFIER_SEED'] ?? 'ecorestore-demo-verifier');
  const guardian = guardianTargetFromEnv();
  const analysisUrl = process.env['ANALYSIS_URL'];
  const backend = analysisUrl ? remoteBackend({ baseUrl: analysisUrl }, (await analysisServiceInfo({ baseUrl: analysisUrl })).engine) : localBackend;
  log(`analysis: ${backend.engine.name} ${backend.engine.version}${analysisUrl ? ` at ${analysisUrl}` : ' (in-process)'}`);
  let chainCtx: ChainContext | null = null;
  if (process.env['DEMO_RPC_URL']) chainCtx = await setupChain(process.env['DEMO_RPC_URL'], log, process.env['DEMO_MNEMONIC']);
  else log('DEMO_RPC_URL not set: contract calldata will be prepared, not broadcast.');
  if (!guardian.baseUrl) log('GUARDIAN_URL not set: Guardian requests will be staged to guardian/outbox/, NOT submitted.');

  const { parcel, list } = buildScenarios();
  const summary: string[] = ['# Ecorestore demo run', '', `Computed at ${COMPUTED_AT}. Verifier DID ${identity.did}. Analysis ${backend.engine.name} ${backend.engine.version}.`, ''];

  for (const sc of list) {
    log(`\n=== scenario: ${sc.name} ===`);
    log(sc.description);
    const dir = join(OUT, sc.name);
    mkdirSync(dir, { recursive: true });
    const bundle = await runScenario(sc, parcel, { backend, identity, guardian, outboxDir: OUTBOX, chain: chainCtx, computedAt: COMPUTED_AT, log });
    const { result, credentialCheck: check, guardianSubmission, issuance, contract } = bundle;
    const chain = contract.chain;

    writeFileSync(join(dir, 'verification-result.json'), JSON.stringify(result, null, 2));
    writeFileSync(join(dir, 'verdict-vc.json'), JSON.stringify(bundle.verdictCredential, null, 2));
    writeFileSync(join(dir, 'presentation.json'), JSON.stringify(bundle.presentation.document, null, 2));
    writeFileSync(join(dir, 'assurance-bundle.json'), JSON.stringify(bundle, null, 2));

    const issued = 'partition' in issuance;
    log(`status ${result.verificationStatus}: ${result.statusReason}`);
    log(`settled ${result.settledQuantity} ha of ${result.claimedQuantity} claimed; CI [${result.uncertainty.interval.lower}, ${result.uncertainty.interval.upper}]; coverage ${result.uncertainty.empiricalCoverage.empirical}`);
    log(`VC ${check.signatureValid && check.schemaValid && check.resultHashMatches ? 'verified' : 'FAILED'}; Guardian: ${guardianSubmission.outcome.detail}; issuance: ${issued ? `prepared ${issuance.valueHa} ha into partition ${issuance.partition.slice(0, 12)}… (not broadcast)` : 'none'}`);
    if (chain) log(`on-chain: milestone ${chain.milestoneState}; restorer +${chain.balances['restorerReceived']}, steward +${chain.balances['stewardReceived']}, retained ${chain.balances['retained']}, escrow ${chain.balances['escrowAvailable']}`);

    summary.push(`## ${sc.name}`, '', sc.description, '', `- status: **${result.verificationStatus}** — ${result.statusReason}`, `- claimed ${result.claimedQuantity} ha; gross parcel ${result.measured.parcelChangeHa} ha; far ring ${result.measured.controlChangeFarRingHa} ha; leakage ${result.measured.leakageHa} ha; additional ${result.measured.additionalBiophysicalHa} ha`, `- ${Math.round(result.uncertainty.interval.confidenceLevel * 100)}% CI [${result.uncertainty.interval.lower}, ${result.uncertainty.interval.upper}] ha; empirical coverage ${result.uncertainty.empiricalCoverage.empirical} over ${result.uncertainty.empiricalCoverage.placebos} placebos`, `- parallel trend ${result.parallelTrend.status} (p ${result.parallelTrend.pValue}); settled **${result.settledQuantity} ha**`, `- Tier 0 provenance: ${result.tier0Provenance.provenance}; VC signature ${check.signatureValid ? 'valid' : 'INVALID'}; Guardian ${guardianSubmission.outcome.mode}; issuance ${issued ? 'prepared (not broadcast)' : 'none'}`, chain ? `- on-chain (chain ${chainCtx!.chainId}): deed ${chain.deedId}, run ${chain.runIndex}, milestone ${chain.milestoneState}, restorer +${chain.balances['restorerReceived']}, steward +${chain.balances['stewardReceived']}, retained ${chain.balances['retained']}` : '- on-chain: not run (DEMO_RPC_URL unset); calldata prepared', '');
  }
  writeFileSync(join(OUT, 'summary.md'), summary.join('\n'));
  log(`\nwrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
