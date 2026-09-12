/**
 * Ecorestore Network — TheGraphProvider (M5)
 *
 * The real GraphProvider implementation: queries a local Graph Node's
 * GraphQL endpoint (default http://localhost:8000/subgraphs/name/
 * ecorestore/restoration-deed — see subgraph/package.json's
 * "deploy-local" script and docs/GRAPH.md). This is the ONLY component
 * that talks to Graph Node; the Auditor never queries Postgres, Graph
 * Node's internal storage, or Hardhat event logs directly
 * (docs/ARCHITECTURE.md, "GraphQL boundary").
 *
 * Uses the platform `fetch` (Node 18+) — no additional HTTP dependency.
 */

import { GraphUnavailableError, type GraphProvider } from "./provider.js";
import type { DeedHistory, IndexedProject, IndexedVerification } from "./types.js";

export const DEFAULT_GRAPHQL_URL = "http://localhost:8000/subgraphs/name/ecorestore/restoration-deed";

const DEED_HISTORY_FIELDS = `
  id
  deedId
  projectId
  parcelH3Root
  sponsor
  beneficiary
  authorizedVerifier
  escrowAmount
  unitPriceUSDC
  quantityDecimals
  fundedAmount
  verificationId
  settledQuantityScaled
  settlementAmount
  releasedAmount
  status
  createdAt
  createdBlock
  createdTxHash
  updatedAt
  updatedBlock
  updatedTxHash
  verifications {
    id
    verificationId
    financiallyEligible
    settledQuantityScaled
    settlementAmount
    timestamp
    blockNumber
    transactionHash
  }
  settlements {
    id
    verification { id }
    beneficiary
    settlementAmount
    refundedRemainder
    timestamp
    blockNumber
    transactionHash
  }
  fundings {
    id
    sponsor
    amount
    timestamp
    blockNumber
    transactionHash
  }
  refunds {
    id
    sponsor
    amount
    timestamp
    blockNumber
    transactionHash
  }
  cancellations {
    id
    timestamp
    blockNumber
    transactionHash
  }
`;

interface GraphQLResponse<T> {
  readonly data?: T;
  readonly errors?: ReadonlyArray<{ message: string }>;
}

function toDeedHistory(raw: any): DeedHistory {
  return {
    deed: {
      id: raw.id,
      deedId: raw.deedId,
      projectId: raw.projectId,
      parcelH3Root: raw.parcelH3Root,
      sponsor: raw.sponsor,
      beneficiary: raw.beneficiary,
      authorizedVerifier: raw.authorizedVerifier,
      escrowAmount: raw.escrowAmount,
      unitPriceUSDC: raw.unitPriceUSDC,
      quantityDecimals: raw.quantityDecimals,
      fundedAmount: raw.fundedAmount,
      verificationId: raw.verificationId ?? null,
      settledQuantityScaled: raw.settledQuantityScaled ?? null,
      settlementAmount: raw.settlementAmount ?? null,
      releasedAmount: raw.releasedAmount ?? null,
      status: raw.status,
      createdAt: raw.createdAt,
      createdBlock: raw.createdBlock,
      createdTxHash: raw.createdTxHash,
      updatedAt: raw.updatedAt,
      updatedBlock: raw.updatedBlock,
      updatedTxHash: raw.updatedTxHash,
    },
    verifications: (raw.verifications ?? []).map((v: any) => ({
      id: v.id,
      deedId: raw.id,
      verificationId: v.verificationId,
      financiallyEligible: v.financiallyEligible,
      settledQuantityScaled: v.settledQuantityScaled,
      settlementAmount: v.settlementAmount,
      timestamp: v.timestamp,
      blockNumber: v.blockNumber,
      transactionHash: v.transactionHash,
    })),
    settlements: (raw.settlements ?? []).map((s: any) => ({
      id: s.id,
      deedId: raw.id,
      verificationId: s.verification.id,
      beneficiary: s.beneficiary,
      settlementAmount: s.settlementAmount,
      refundedRemainder: s.refundedRemainder,
      timestamp: s.timestamp,
      blockNumber: s.blockNumber,
      transactionHash: s.transactionHash,
    })),
    fundings: (raw.fundings ?? []).map((f: any) => ({
      id: f.id,
      deedId: raw.id,
      sponsor: f.sponsor,
      amount: f.amount,
      timestamp: f.timestamp,
      blockNumber: f.blockNumber,
      transactionHash: f.transactionHash,
    })),
    refunds: (raw.refunds ?? []).map((r: any) => ({
      id: r.id,
      deedId: raw.id,
      sponsor: r.sponsor,
      amount: r.amount,
      timestamp: r.timestamp,
      blockNumber: r.blockNumber,
      transactionHash: r.transactionHash,
    })),
    cancellations: (raw.cancellations ?? []).map((c: any) => ({
      id: c.id,
      deedId: raw.id,
      timestamp: c.timestamp,
      blockNumber: c.blockNumber,
      transactionHash: c.transactionHash,
    })),
  };
}

export class TheGraphProvider implements GraphProvider {
  constructor(private readonly graphqlUrl: string = DEFAULT_GRAPHQL_URL) {}

  private async query<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    let response: Response;
    try {
      response = await fetch(this.graphqlUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, variables }),
      });
    } catch (err) {
      throw new GraphUnavailableError(err);
    }

    if (!response.ok) {
      throw new GraphUnavailableError(`HTTP ${response.status} ${response.statusText}`);
    }

    let body: GraphQLResponse<T>;
    try {
      body = (await response.json()) as GraphQLResponse<T>;
    } catch (err) {
      throw new GraphUnavailableError(err);
    }

    if (body.errors && body.errors.length > 0) {
      throw new GraphUnavailableError(body.errors.map((e) => e.message).join("; "));
    }
    if (body.data === undefined) {
      throw new GraphUnavailableError("GraphQL response had no data field");
    }
    return body.data;
  }

  async getDeedHistory(deedId: string): Promise<DeedHistory | null> {
    const data = await this.query<{ restorationDeed: any | null }>(
      `query DeedHistory($id: ID!) {
        restorationDeed(id: $id) { ${DEED_HISTORY_FIELDS} }
      }`,
      { id: deedId },
    );
    return data.restorationDeed ? toDeedHistory(data.restorationDeed) : null;
  }

  async getDeedsByProject(projectId: string): Promise<readonly DeedHistory[]> {
    const data = await this.query<{ restorationDeeds: any[] }>(
      `query DeedsByProject($projectId: Bytes!) {
        restorationDeeds(where: { projectId: $projectId }) { ${DEED_HISTORY_FIELDS} }
      }`,
      { projectId },
    );
    return data.restorationDeeds.map(toDeedHistory);
  }

  async getVerification(verificationId: string): Promise<IndexedVerification | null> {
    const data = await this.query<{ verification: any | null }>(
      `query Verification($id: ID!) {
        verification(id: $id) {
          id
          verificationId
          financiallyEligible
          settledQuantityScaled
          settlementAmount
          timestamp
          blockNumber
          transactionHash
          deed { id }
        }
      }`,
      { id: verificationId },
    );
    if (!data.verification) return null;
    return {
      id: data.verification.id,
      deedId: data.verification.deed.id,
      verificationId: data.verification.verificationId,
      financiallyEligible: data.verification.financiallyEligible,
      settledQuantityScaled: data.verification.settledQuantityScaled,
      settlementAmount: data.verification.settlementAmount,
      timestamp: data.verification.timestamp,
      blockNumber: data.verification.blockNumber,
      transactionHash: data.verification.transactionHash,
    };
  }

  async getProject(projectId: string): Promise<IndexedProject | null> {
    const data = await this.query<{ project: IndexedProject | null }>(
      `query Project($id: ID!) {
        project(id: $id) { id parcelH3Root createdAt createdBlock createdTxHash }
      }`,
      { id: projectId },
    );
    return data.project;
  }
}
