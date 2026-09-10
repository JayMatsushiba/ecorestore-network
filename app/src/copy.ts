/**
 * Plain-language copy the dashboard states in its own voice.
 *
 * The engine records (`statusReason`); the interface explains. Everything here is derived
 * from fields the result already carries, never from a number the page computes.
 */
import type { ScenarioId, VerificationResult, VerificationStatus } from './types';

export function fmt(x: number, d = 2): string {
  return x.toFixed(d);
}

export interface Verdict {
  /** One line, above the numbers. */
  headline: string;
  /** Two or three sentences a buyer can act on. */
  explanation: string;
  /** Whether the rule released capital. Drives the visual weight, not the wording. */
  released: boolean;
}

export function verdictFor(r: VerificationResult): Verdict {
  const level = Math.round(r.uncertainty.interval.confidenceLevel * 100);
  switch (r.verificationStatus) {
    case 'VERIFIED':
      return {
        released: true,
        headline: `The rule releases the full ${fmt(r.settledQuantity)} ha claim.`,
        explanation: `The lower ${level}% bound of what the measurement can defend meets the claimed quantity, so the rule releases the whole tranche. Whether the deed executed that decision is stated under What is on record.`,
      };
    case 'PARTIAL':
      return {
        released: true,
        headline: `The rule releases ${fmt(r.settledQuantity)} ha of a ${fmt(r.claimedQuantity)} ha claim.`,
        explanation: `The parcel grew faster than comparable land nearby. The rule pays only the lower ${level}% bound, the quantity that would survive an audit. The rest of the claim is regional change, leakage and uncertainty, and none of it is paid. Whether the deed executed that decision is stated under What is on record.`,
      };
    case 'NOT_ADDITIONAL':
      return {
        released: false,
        headline: 'The rule releases nothing.',
        explanation: 'Over this period the parcel did not grow faster than comparable land nearby, so there is nothing defensible to settle. This is the rule working as designed: it declines to pay for change the region would have shown anyway.',
      };
    case 'INSUFFICIENT_EVIDENCE':
      return {
        released: false,
        headline: 'The rule releases nothing, and gives no score.',
        explanation: 'The evidence did not pass a guard the committed plan set, so the rule refuses to compare the parcel with its controls at all. A refusal is not a zero. It says the comparison cannot be trusted under this plan.',
      };
    case 'GATE_FAILED':
      return {
        released: false,
        headline: 'The rule releases nothing.',
        explanation: 'The measurement is valid, but an issuance gate failed: habitat loss, native species or the condition floor. The rule withholds settlement until the gate passes.',
      };
    case 'INVALID_RESULT':
      return {
        released: false,
        headline: 'The rule releases nothing.',
        explanation: 'The uncertainty interval is not valid, so the rule cannot state a defensible quantity and pays nothing.',
      };
    default:
      return { released: false, headline: 'The rule releases nothing.', explanation: 'The rule did not release capital for this run.' };
  }
}

export interface ScenarioCopy {
  id: ScenarioId;
  /** The lesson, not the data condition. */
  label: string;
  /** What the scenario is built to show. Once a run has loaded, `outcomeFor()` its status replaces this. */
  outcome: string;
  hint: string;
}

/** One phrase per status, so a tab never disagrees with the verdict it leads to. */
export function outcomeFor(status: VerificationStatus): string {
  switch (status) {
    case 'VERIFIED':
      return 'settles the full claim';
    case 'PARTIAL':
      return 'settles the lower bound';
    case 'NOT_ADDITIONAL':
      return 'settles nothing';
    case 'INSUFFICIENT_EVIDENCE':
      return 'refuses to score';
    case 'GATE_FAILED':
      return 'withholds settlement';
    case 'INVALID_RESULT':
      return 'cannot state a quantity';
    default:
      return 'settles nothing';
  }
}

/**
 * One committed rule, three runs over the same parcel. The provenance detail stays in
 * the banner each bundle carries; a tab names the lesson.
 */
export const SCENARIOS: ScenarioCopy[] = [
  { id: 'real', label: 'Real data', outcome: 'settles nothing', hint: 'Real Sentinel-2 data and no intervention: the rule finds nothing defensible to pay.' },
  { id: 'synthetic', label: 'Injected effect', outcome: 'settles the lower bound', hint: 'A labelled synthetic gain added to the same real series: the rule pays only what it can defend.' },
  { id: 'trend-failure', label: 'Trend test fails', outcome: 'refuses to score', hint: 'The same real data under a plan whose pre-treatment trend test cannot pass: the rule declines to compare at all.' },
];

export function scenarioCopy(id: ScenarioId): ScenarioCopy {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]!;
}

/** Loading copy that names the data, not the scenario id. */
export function loadingCopy(id: ScenarioId): string {
  const data = id === 'synthetic' ? 'a labelled synthetic perturbation of real Sentinel-2 data' : 'real Sentinel-2 data';
  return `Running verification on ${data}: matching controls, testing parallel trends, bootstrapping the interval, checking placebo coverage.`;
}

/** Gate names are engine identifiers; the table glosses them once. */
export function gateGloss(name: string): string {
  if (name.startsWith('scenes:')) return `Enough usable scenes in ${name.slice('scenes:'.length).replace('-', ' ')}`;
  switch (name) {
    case 'controls:far_ring':
      return 'Enough matched far-ring controls';
    case 'parallel_trend':
      return 'Parcel and controls moved together before treatment';
    case 'no_net_habitat_loss':
      return 'No net habitat loss inside the parcel';
    case 'native_species_fraction':
      return 'Native species fraction above the floor';
    case 'condition_floor':
      return 'Parcel condition above the floor';
    default:
      return name;
  }
}
