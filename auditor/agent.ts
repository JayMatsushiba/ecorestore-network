/**
 * Ecorestore Network — Restoration Auditor (M5)
 *
 * The Auditor retrieves on-chain-indexed history through a `GraphProvider`
 * (graph/provider.ts) and, when the caller supplies the real off-chain M1
 * `VerificationResult` and/or M2 `GuardianCredential` alongside it,
 * cross-checks the two for consistency. It computes nothing scientific and
 * nothing financial itself — every quantity it compares was already
 * produced by `verifyProject()` (M1), Guardian (M2), or RestorationDeed.sol
 * (M3/M3.1) before this module ever sees it (docs/AUDITOR.md, docs/
 * ARCHITECTURE.md §2).
 *
 * AUTHORITY BOUNDARY:
 *  - The Auditor may retrieve, correlate, and explain. It does not
 *    calculate M1 scientific truth, modify a VerificationResult, choose a
 *    settlement quantity, authorize a verification, authorize a
 *    settlement, or release funds. Nothing in this file writes to the
 *    Graph, Guardian, or RestorationDeed — every function here is
 *    read-only.
 *  - A detected anomaly is reported, never auto-repaired. There is no
 *    financial action anywhere in this module.
 *
 * KNOWN LIMITATION carried from the Graph layer (docs/GRAPH.md):
 * `methodologyVersion` is not indexed on-chain (no event emits it, and the
 * one eth_call attempt to read it from contract storage reproducibly
 * failed against this project's local Hardhat node — a real upstream
 * graph-node/Hardhat RPC incompatibility, not a design choice). The
 * methodology cross-check below therefore compares the off-chain M1
 * result against the off-chain M2 credential only; it cannot independently
 * verify either against the on-chain deed's methodologyVersion, because
 * the Graph does not expose that field. On-chain methodology enforcement
 * still happens — at the contract level, in `submitVerification`
 * (`VerificationIdentityMismatch`) — this module just cannot observe it
 * after the fact through the Graph.
 */

import type { GraphProvider } from "../graph/provider.js";
import { GraphUnavailableError } from "../graph/provider.js";
import type { DeedHistory } from "../graph/types.js";
import { scaleQuantity } from "../arc/identifiers.js";
import type { GuardianCredential } from "../guardian/models.js";
import type { VerificationResult } from "../verification/models.js";

export type AnomalyCode =
  | "DEED_VERIFICATION_ID_MISMATCH"
  | "SETTLED_WITHOUT_SETTLEMENT_EVENT"
  | "SETTLEMENT_AMOUNT_MISMATCH"
  | "SETTLEMENT_WITHOUT_ELIGIBLE_VERIFICATION"
  | "METHODOLOGY_MISMATCH"
  | "QUANTITY_MISMATCH";

export interface Anomaly {
  readonly code: AnomalyCode;
  readonly message: string;
}

export type AuditStatus = "CONSISTENT" | "ANOMALOUS" | "NOT_FOUND" | "DATA_UNAVAILABLE";

export interface AuditReport {
  readonly status: AuditStatus;
  readonly deedId: string;
  readonly history: DeedHistory | null;
  readonly anomalies: readonly Anomaly[];
  readonly explanation: string;
}

export interface AuditInput {
  readonly graphProvider: GraphProvider;
  readonly deedId: string;
  /** The real M1 result this deed's verification should trace back to, if the caller has it. */
  readonly verificationResult?: VerificationResult;
  /** The real M2 credential issued for that result, if the caller has it. */
  readonly credential?: GuardianCredential;
}

/** Mirrors RestorationDeed.sol's Math.mulDiv(settledQuantityScaled, unitPriceUSDC, 10**quantityDecimals) exactly, to detect indexing/data corruption — not to compute a new financial quantity. */
function expectedSettlementAmount(settledQuantityScaled: bigint, unitPriceUSDC: bigint, quantityDecimals: number): bigint {
  return (settledQuantityScaled * unitPriceUSDC) / 10n ** BigInt(quantityDecimals);
}

/**
 * Audits one deed's indexed on-chain history, optionally cross-checked
 * against the real off-chain M1/M2 objects that should have produced it.
 * Read-only; never throws for a data inconsistency (that becomes an
 * `Anomaly`) — it only throws for a truly unexpected internal error. A
 * Graph outage becomes `status: "DATA_UNAVAILABLE"`, not a thrown error to
 * the caller.
 */
export async function auditDeed(input: AuditInput): Promise<AuditReport> {
  const { graphProvider, deedId, verificationResult, credential } = input;

  let history: DeedHistory | null;
  try {
    history = await graphProvider.getDeedHistory(deedId);
  } catch (err) {
    if (err instanceof GraphUnavailableError) {
      return {
        status: "DATA_UNAVAILABLE",
        deedId,
        history: null,
        anomalies: [],
        explanation: `Could not audit deed ${deedId}: the Graph is unavailable (${err.message}). No financial or scientific conclusion can be drawn from missing data; this is reported, not repaired.`,
      };
    }
    throw err;
  }

  if (history === null) {
    return {
      status: "NOT_FOUND",
      deedId,
      history: null,
      anomalies: [],
      explanation: `No indexed history exists for deed ${deedId}. Either it was never created on-chain, or the subgraph has not indexed it yet.`,
    };
  }

  const anomalies: Anomaly[] = [];
  const { deed, verifications, settlements } = history;

  // Deed <-> Verification identity (task acceptance criterion I).
  let matchedVerification = null;
  if (deed.verificationId !== null) {
    matchedVerification = verifications.find((v) => v.verificationId === deed.verificationId) ?? null;
    if (matchedVerification === null) {
      anomalies.push({
        code: "DEED_VERIFICATION_ID_MISMATCH",
        message: `Deed ${deedId} references verificationId ${deed.verificationId}, but no Verification with that id is indexed for this deed.`,
      });
    }
  }

  // Deed state <-> settlement event (task acceptance criterion I).
  if (deed.status === "SETTLED") {
    if (settlements.length === 0) {
      anomalies.push({
        code: "SETTLED_WITHOUT_SETTLEMENT_EVENT",
        message: `Deed ${deedId} has status SETTLED but no Settlement event is indexed for it.`,
      });
    } else {
      for (const settlement of settlements) {
        if (deed.settlementAmount !== null && settlement.settlementAmount !== deed.settlementAmount) {
          anomalies.push({
            code: "SETTLEMENT_AMOUNT_MISMATCH",
            message: `Settlement ${settlement.id} paid ${settlement.settlementAmount}, but deed ${deedId}'s recorded settlementAmount is ${deed.settlementAmount}.`,
          });
        }
        if (
          deed.settledQuantityScaled !== null &&
          expectedSettlementAmount(
            BigInt(deed.settledQuantityScaled),
            BigInt(deed.unitPriceUSDC),
            deed.quantityDecimals,
          ).toString() !== settlement.settlementAmount
        ) {
          anomalies.push({
            code: "SETTLEMENT_AMOUNT_MISMATCH",
            message: `Settlement ${settlement.id}'s amount (${settlement.settlementAmount}) does not match settledQuantityScaled x unitPriceUSDC / 10^quantityDecimals recomputed from indexed deed fields.`,
          });
        }

        const settlementVerification = verifications.find((v) => v.verificationId === settlement.verificationId);
        if (settlementVerification !== undefined && !settlementVerification.financiallyEligible) {
          anomalies.push({
            code: "SETTLEMENT_WITHOUT_ELIGIBLE_VERIFICATION",
            message: `Settlement ${settlement.id} references verification ${settlement.verificationId}, which is indexed as financiallyEligible=false. A settlement should never exist for an ineligible verification.`,
          });
        }
      }
    }
  }

  // Off-chain M1 result <-> on-chain indexed quantity (task acceptance criterion I / §10).
  if (verificationResult !== undefined && matchedVerification !== null) {
    const expectedScaled = scaleQuantity(verificationResult.settledQuantity, deed.quantityDecimals).toString();
    if (expectedScaled !== matchedVerification.settledQuantityScaled) {
      anomalies.push({
        code: "QUANTITY_MISMATCH",
        message: `Off-chain M1 settledQuantity (${verificationResult.settledQuantity}, scaled = ${expectedScaled}) does not match the on-chain indexed settledQuantityScaled (${matchedVerification.settledQuantityScaled}) for verification ${matchedVerification.verificationId}.`,
      });
    }
  }

  // Off-chain M1 result <-> off-chain M2 credential methodology (see the
  // module-level KNOWN LIMITATION note: this cannot also be checked
  // against the on-chain deed, since methodologyVersion is not indexed).
  if (verificationResult !== undefined && credential !== undefined) {
    if (verificationResult.methodologyVersion !== credential.methodologyVersion) {
      anomalies.push({
        code: "METHODOLOGY_MISMATCH",
        message: `Off-chain M1 methodologyVersion (${verificationResult.methodologyVersion}) does not match the M2 GuardianCredential's methodologyVersion (${credential.methodologyVersion}).`,
      });
    }
  }

  const status: AuditStatus = anomalies.length > 0 ? "ANOMALOUS" : "CONSISTENT";
  const explanation =
    status === "CONSISTENT"
      ? `Deed ${deedId} (status ${deed.status}) is internally consistent across ${verifications.length} verification(s) and ${settlements.length} settlement(s) indexed by the Graph.` +
        (verificationResult !== undefined
          ? ` Its indexed settled quantity traces back to the supplied M1 result (${verificationResult.settledQuantity}).`
          : "")
      : `Deed ${deedId} (status ${deed.status}) has ${anomalies.length} anomal${anomalies.length === 1 ? "y" : "ies"}: ${anomalies.map((a) => a.code).join(", ")}.`;

  return { status, deedId, history, anomalies, explanation };
}
