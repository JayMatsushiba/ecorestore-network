/**
 * Ecorestore Network — Deterministic Verification Engine (M1)
 *
 * Pipeline (docs/VERIFICATION.md §2):
 *   Evidence -> Baseline -> Parcel Observation -> Matched Controls ->
 *   Parallel-Trend Diagnostic -> Difference-in-Differences -> Additionality ->
 *   Uncertainty -> Lower Bound -> Quality Gate -> VerificationResult
 *
 * `verifyProject` is a pure function: given identical `project` and `config`
 * values it always produces an identical `VerificationResult`. It performs
 * no I/O, no randomness, no wall-clock reads, and invokes no AI component.
 * See CLAUDE.md "AI Authority Boundary" and the M1 prompt §17 — M1 contains
 * no AI component at all.
 *
 * Hard invariant: if evidence is insufficient, too few eligible controls
 * exist, or the parallel-trend diagnostic does not PASS, this function
 * returns a result with `verificationStatus: "INSUFFICIENT_EVIDENCE"` and
 * `settledQuantity: 0` — it never computes or exposes a positive settlement
 * quantity on any of those paths (M1 prompt §8: "Do NOT force a successful
 * result").
 */

import type {
  ExcludedControl,
  MethodologyConfiguration,
  ParallelTrendStatus,
  Project,
  QualityGateStatus,
  VerificationDiagnostics,
  VerificationResult,
  VerificationStatus,
} from "./models.js";
import { computeAdditionality } from "./calculations/additionality.js";
import { selectMatchedControls } from "./calculations/controlMatching.js";
import { computeDifferenceInDifferences } from "./calculations/differenceInDifferences.js";
import { computeEvidenceHash } from "./calculations/evidenceHash.js";
import { validateEvidenceSufficiency } from "./calculations/inputValidation.js";
import { evaluateParallelTrend } from "./calculations/parallelTrend.js";
import { evaluateQualityGate } from "./calculations/qualityGate.js";
import { deriveParcelH3Root } from "./calculations/spatialIdentity.js";
import { computeUncertainty } from "./calculations/uncertainty.js";

export function verifyProject(project: Project, config: MethodologyConfiguration): VerificationResult {
  const parcelH3Root = deriveParcelH3Root(project.treatedParcel.parcelId);
  const evidenceHash = computeEvidenceHash(project.evidence);

  // --- Gate 1: basic evidence sufficiency -----------------------------------
  const evidenceCheck = validateEvidenceSufficiency(project, config);
  if (!evidenceCheck.valid) {
    return buildBlockedResult({
      project,
      config,
      parcelH3Root,
      evidenceHash,
      hasSufficientEvidence: false,
      parallelTrendStatus: "INSUFFICIENT_EVIDENCE",
      eligibleControlParcelIds: [],
      excludedContaminatedControls: [],
      excludedNonMatchingControlParcelIds: [],
      treatedPreTreatmentSlopePerYear: null,
      controlMeanPreTreatmentSlopePerYear: null,
      parallelTrendDivergenceRatio: null,
    });
  }

  // --- Gate 2: matched, uncontaminated control set ---------------------------
  const matchResult = selectMatchedControls(project.treatedParcel, project.candidateControlParcels, config.matchingTolerance);

  if (matchResult.eligibleControlParcelIds.length < config.minimumControlCount) {
    return buildBlockedResult({
      project,
      config,
      parcelH3Root,
      evidenceHash,
      hasSufficientEvidence: false,
      parallelTrendStatus: "INSUFFICIENT_EVIDENCE",
      eligibleControlParcelIds: matchResult.eligibleControlParcelIds,
      excludedContaminatedControls: matchResult.excludedContaminated,
      excludedNonMatchingControlParcelIds: matchResult.excludedNonMatching,
      treatedPreTreatmentSlopePerYear: null,
      controlMeanPreTreatmentSlopePerYear: null,
      parallelTrendDivergenceRatio: null,
    });
  }

  const eligibleControls = project.candidateControlParcels.filter((parcel) =>
    matchResult.eligibleControlParcelIds.includes(parcel.parcelId),
  );

  // --- Gate 3: parallel-trend diagnostic (hard gate) --------------------------
  const trend = evaluateParallelTrend(project.treatedParcel, eligibleControls, project.evidence, config);

  if (trend.status !== "PASS") {
    return buildBlockedResult({
      project,
      config,
      parcelH3Root,
      evidenceHash,
      hasSufficientEvidence: true,
      parallelTrendStatus: trend.status,
      eligibleControlParcelIds: matchResult.eligibleControlParcelIds,
      excludedContaminatedControls: matchResult.excludedContaminated,
      excludedNonMatchingControlParcelIds: matchResult.excludedNonMatching,
      treatedPreTreatmentSlopePerYear: trend.treatedSlopePerYear,
      controlMeanPreTreatmentSlopePerYear: trend.controlMeanSlopePerYear,
      parallelTrendDivergenceRatio: trend.divergenceRatio,
    });
  }

  // --- Diff-in-diff, additionality, uncertainty, conservative settlement -----
  const did = computeDifferenceInDifferences(project.treatedParcel, eligibleControls, project.evidence, config);
  const additionality = computeAdditionality(did, project.treatedParcel);
  const uncertainty = computeUncertainty(additionality.additionalityAdjustedHectares, config);

  const qualityGateStatus = evaluateQualityGate({
    hasSufficientEvidence: true,
    parallelTrendStatus: trend.status,
    uncertaintyStatus: uncertainty.status,
  });

  // Settlement never exceeds the declared lower bound, and never goes
  // negative (a negative "gain" is not a settleable restoration outcome in
  // this prototype). See docs/VERIFICATION.md §11.
  const settledQuantity = qualityGateStatus === "PASS" ? Math.max(0, uncertainty.lowerBound) : 0;
  const verificationStatus = deriveVerificationStatus(qualityGateStatus, project.claimedQuantity, settledQuantity);

  const diagnostics: VerificationDiagnostics = {
    treatedParcelId: project.treatedParcel.parcelId,
    eligibleControlParcelIds: matchResult.eligibleControlParcelIds,
    excludedContaminatedControls: matchResult.excludedContaminated,
    excludedNonMatchingControlParcelIds: matchResult.excludedNonMatching,
    treatedPreTreatmentLevel: did.treatedPreTreatmentLevel,
    treatedPostTreatmentLevel: did.treatedPostTreatmentLevel,
    treatedObservedChange: did.treatedObservedChange,
    controlPreTreatmentLevel: did.controlPreTreatmentLevel,
    controlPostTreatmentLevel: did.controlPostTreatmentLevel,
    controlObservedChange: did.controlObservedChange,
    treatedPreTreatmentSlopePerYear: trend.treatedSlopePerYear,
    controlMeanPreTreatmentSlopePerYear: trend.controlMeanSlopePerYear,
    parallelTrendDivergenceRatio: trend.divergenceRatio,
  };

  return {
    projectId: project.projectId,
    parcelH3Root,
    methodologyVersion: config.methodologyVersion,
    metric: config.metric,
    claimedQuantity: project.claimedQuantity,
    observedChange: did.treatedObservedChange,
    controlChange: did.controlObservedChange,
    additionalityAdjusted: additionality.additionalityAdjustedHectares,
    uncertainty,
    lowerBound: uncertainty.lowerBound,
    settledQuantity,
    parallelTrendStatus: trend.status,
    qualityGateStatus,
    verificationStatus,
    evidenceHash,
    window: project.window,
    diagnostics,
  };
}

function deriveVerificationStatus(
  qualityGateStatus: QualityGateStatus,
  claimedQuantity: number,
  settledQuantity: number,
): VerificationStatus {
  if (qualityGateStatus === "INSUFFICIENT_EVIDENCE") return "INSUFFICIENT_EVIDENCE";
  if (qualityGateStatus === "INVALID_RESULT") return "INVALID_RESULT";
  return settledQuantity >= claimedQuantity ? "VERIFIED" : "PARTIAL";
}

interface BlockedResultInput {
  readonly project: Project;
  readonly config: MethodologyConfiguration;
  readonly parcelH3Root: string;
  readonly evidenceHash: string;
  readonly hasSufficientEvidence: boolean;
  readonly parallelTrendStatus: ParallelTrendStatus;
  readonly eligibleControlParcelIds: readonly string[];
  readonly excludedContaminatedControls: readonly ExcludedControl[];
  readonly excludedNonMatchingControlParcelIds: readonly string[];
  readonly treatedPreTreatmentSlopePerYear: number | null;
  readonly controlMeanPreTreatmentSlopePerYear: number | null;
  readonly parallelTrendDivergenceRatio: number | null;
}

/**
 * Builds a canonical result for any path that must not produce a valid
 * settlement quantity (missing evidence, too few eligible controls, or a
 * parallel-trend diagnostic that did not PASS). `settledQuantity` is always
 * `0`, and `additionalityAdjusted` / `observedChange` / `controlChange` are
 * `0` placeholders — the pipeline deliberately does not compute
 * DiD/additionality/uncertainty past a blocking gate.
 */
function buildBlockedResult(input: BlockedResultInput): VerificationResult {
  const qualityGateStatus = evaluateQualityGate({
    hasSufficientEvidence: input.hasSufficientEvidence,
    parallelTrendStatus: input.parallelTrendStatus,
    uncertaintyStatus: null,
  });

  const verificationStatus = deriveVerificationStatus(qualityGateStatus, input.project.claimedQuantity, 0);

  const uncertainty = {
    model: input.config.uncertaintyModel,
    confidenceLevel: input.config.confidenceLevel,
    pointEstimate: 0,
    lowerBound: 0,
    upperBound: 0,
    status: "NOT_EVALUATED" as const,
  };

  const diagnostics: VerificationDiagnostics = {
    treatedParcelId: input.project.treatedParcel.parcelId,
    eligibleControlParcelIds: input.eligibleControlParcelIds,
    excludedContaminatedControls: input.excludedContaminatedControls,
    excludedNonMatchingControlParcelIds: input.excludedNonMatchingControlParcelIds,
    treatedPreTreatmentLevel: 0,
    treatedPostTreatmentLevel: 0,
    treatedObservedChange: 0,
    controlPreTreatmentLevel: 0,
    controlPostTreatmentLevel: 0,
    controlObservedChange: 0,
    treatedPreTreatmentSlopePerYear: input.treatedPreTreatmentSlopePerYear,
    controlMeanPreTreatmentSlopePerYear: input.controlMeanPreTreatmentSlopePerYear,
    parallelTrendDivergenceRatio: input.parallelTrendDivergenceRatio,
  };

  return {
    projectId: input.project.projectId,
    parcelH3Root: input.parcelH3Root,
    methodologyVersion: input.config.methodologyVersion,
    metric: input.config.metric,
    claimedQuantity: input.project.claimedQuantity,
    observedChange: 0,
    controlChange: 0,
    additionalityAdjusted: 0,
    uncertainty,
    lowerBound: 0,
    settledQuantity: 0,
    parallelTrendStatus: input.parallelTrendStatus,
    qualityGateStatus,
    verificationStatus,
    evidenceHash: input.evidenceHash,
    window: input.project.window,
    diagnostics,
  };
}
