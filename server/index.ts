/**
 * Ecorestore Network — M6 Demo API Server
 *
 * A thin, read-mostly HTTP layer between the React UI (app/) and the real
 * M1-M5 implementation. It exists only because a browser cannot directly
 * run the Node-based verification/guardian/graph code (node:crypto,
 * node:fs, and process-local state are unavailable there) — it is NOT a
 * second implementation of anything. Every response is built by calling
 * the real functions (`verifyProject`, `MockGuardianAdapter`,
 * `prepareSettlementAuthorization`, `TheGraphProvider`, `auditDeed`) and
 * serializing their actual output. No route recomputes a scientific or
 * financial value, and no route can write to the Graph, Guardian, or
 * RestorationDeed — this server holds no private key and never sends a
 * blockchain transaction (docs/ARCHITECTURE.md's authority model, CLAUDE.md).
 *
 * LOCAL DEMO ONLY: plain node:http, an allow-all CORS header, and no auth
 * — appropriate for a judge/developer running this on localhost, not for
 * any network-exposed deployment. See docs/M6_M7_READINESS_REPORT.md for
 * what production hosting would need to add.
 */

import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { auditDeed } from "../auditor/agent.js";
import { buildDeedIdentity, buildVerificationAuthorization } from "../arc/payload.js";
import { TheGraphProvider } from "../graph/theGraphProvider.js";
import { createMockGuardianAdapter } from "../guardian/adapter.js";
import { computeVerificationResultId } from "../guardian/identifiers.js";
import { GUARDIAN_POLICY_VERSION } from "../guardian/policy/methodologyRegistry.js";
import { DEFAULT_METHODOLOGY_CONFIG, M1_METRIC_ID } from "../verification/config.js";
import { verifyProject } from "../verification/engine.js";
import {
  FIXTURE_PARALLEL_TREND_FAIL,
  FIXTURE_PARTIAL_SETTLEMENT,
} from "../verification/fixtures.js";
import type { Project, VerificationResult } from "../verification/models.js";
import type { GuardianCredential } from "../guardian/models.js";
import { buildProjectExtent } from "./spatialFixtures.js";

const PORT = Number(process.env.PORT ?? 4000);
const VERIFIER_ID = "guardian-verifier-kootenay-001";
const QUANTITY_DECIMALS = 6;
const DEMO_TIMESTAMPS = {
  submittedAt: "2026-09-12T00:00:00.000Z",
  authorizedAt: "2026-09-12T01:00:00.000Z",
  issuedAt: "2026-09-12T02:00:00.000Z",
};

const FIXTURES: Record<string, Project> = {
  partial: FIXTURE_PARTIAL_SETTLEMENT,
  trendFail: FIXTURE_PARALLEL_TREND_FAIL,
};

function resolveFixture(query: URLSearchParams): { key: string; project: Project } {
  const key = query.get("fixture") ?? "partial";
  const project = FIXTURES[key];
  if (!project) {
    throw new HttpError(400, `unknown fixture "${key}"; expected one of: ${Object.keys(FIXTURES).join(", ")}`);
  }
  return { key, project };
}

class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Runs the real M1 -> M2 chain for one fixture project. Never invented, never cached across calls. */
function runVerificationAndGuardian(project: Project): {
  verificationResult: VerificationResult;
  guardian: ReturnType<typeof buildGuardianOutcome>;
} {
  const verificationResult = verifyProject(project, DEFAULT_METHODOLOGY_CONFIG);
  const guardian = buildGuardianOutcome(verificationResult);
  return { verificationResult, guardian };
}

function buildGuardianOutcome(verificationResult: VerificationResult) {
  const adapter = createMockGuardianAdapter();
  const submission = adapter.submitVerificationResult(verificationResult, DEMO_TIMESTAMPS.submittedAt);
  if (!submission.accepted) {
    return { submission, authorization: null, credential: null, lifecycleState: adapter.getLifecycleState(verificationResult.projectId, verificationResult.parcelH3Root) };
  }

  const verificationResultId = computeVerificationResultId(verificationResult);
  const authorization = adapter.authorizeVerification(verificationResultId, VERIFIER_ID, verificationResult, DEMO_TIMESTAMPS.authorizedAt);
  if (!authorization.accepted) {
    return { submission, authorization, credential: null, lifecycleState: adapter.getLifecycleState(verificationResult.projectId, verificationResult.parcelH3Root) };
  }

  const credentialOutcome = adapter.issueCredential(verificationResultId, VERIFIER_ID, DEMO_TIMESTAMPS.issuedAt);
  return {
    submission,
    authorization,
    credential: credentialOutcome.accepted ? credentialOutcome.credential : null,
    lifecycleState: adapter.getLifecycleState(verificationResult.projectId, verificationResult.parcelH3Root),
    guardianPolicyVersion: GUARDIAN_POLICY_VERSION,
  };
}

// Both overridable so docker-compose.yml can point this container at the
// shared deployment record and the `graph-node` container; the defaults are
// the hand-started local stack from README.md.
const deploymentPath =
  process.env.DEMO_DEPLOYMENT_FILE ?? fileURLToPath(new URL("../subgraph/deployment.local.json", import.meta.url));
const graphProvider = new TheGraphProvider(process.env.GRAPH_QUERY_URL);

async function handleProject(query: URLSearchParams) {
  const { key, project } = resolveFixture(query);
  return {
    fixtureKey: key,
    disclaimer: "SYNTHETIC DEMONSTRATION DATA — not real field, satellite, sensor, or regulatory measurement.",
    metric: M1_METRIC_ID,
    methodologyVersion: DEFAULT_METHODOLOGY_CONFIG.methodologyVersion,
    project: {
      projectId: project.projectId,
      name: project.name,
      location: project.location,
      claimedQuantity: project.claimedQuantity,
      window: project.window,
      treatedParcel: project.treatedParcel,
      candidateControlParcels: project.candidateControlParcels,
    },
  };
}

async function handleEvidence(query: URLSearchParams) {
  const { key, project } = resolveFixture(query);
  return {
    fixtureKey: key,
    disclaimer: "SYNTHETIC DEMONSTRATION DATA — every observation below was authored for this prototype, not measured in the field or from a real satellite pass.",
    metric: M1_METRIC_ID,
    evidence: project.evidence,
  };
}

async function handleGeometry(query: URLSearchParams) {
  // Synthetic parcel footprints for the Overview map (server/spatialFixtures.ts).
  // Presentation data only: the M1 engine never reads geometry, and nothing
  // here is derived — control eligibility stays with verifyProject()'s diagnostics.
  const { key, project } = resolveFixture(query);
  const { collection, parcelsWithoutGeometry } = buildProjectExtent(project);
  return {
    fixtureKey: key,
    disclaimer:
      "SYNTHETIC DEMONSTRATION GEOMETRY — parcel footprints drawn for this prototype, not surveyed, tenured, or observed boundaries. The verification engine does not read them.",
    projectId: project.projectId,
    treatedParcelId: project.treatedParcel.parcelId,
    parcelsWithoutGeometry,
    extent: collection,
  };
}

async function handleVerification(query: URLSearchParams) {
  const { key, project } = resolveFixture(query);
  const verificationResult = verifyProject(project, DEFAULT_METHODOLOGY_CONFIG);
  return { fixtureKey: key, verificationResult };
}

async function handleGuardian(query: URLSearchParams) {
  const { key, project } = resolveFixture(query);
  const { verificationResult, guardian } = runVerificationAndGuardian(project);
  return {
    fixtureKey: key,
    real: "M1 verificationResult, Guardian workflow logic",
    mock: "MockGuardianAdapter — not a live Hedera Guardian deployment",
    verificationResult,
    guardian,
  };
}

async function handleDeed() {
  if (!existsSync(deploymentPath)) {
    return {
      status: "UNAVAILABLE" as const,
      reason:
        "No local demo deployment found. Run: npx hardhat node --hostname 0.0.0.0, then npm run demo:local (see README.md).",
    };
  }
  const deployment = JSON.parse(readFileSync(deploymentPath, "utf8")) as {
    deedId: string;
    projectId: string;
    parcelH3Root: string;
    settledQuantity: number;
  };

  let history;
  try {
    history = await graphProvider.getDeedHistory(deployment.deedId);
  } catch (err) {
    return {
      status: "UNAVAILABLE" as const,
      reason: `Local Graph Node endpoint unreachable: ${err instanceof Error ? err.message : String(err)}. Is the Docker stack running (cd subgraph && docker compose up -d)?`,
    };
  }

  if (!history) {
    return { status: "NOT_FOUND" as const, reason: `Deed ${deployment.deedId} is not indexed yet.` };
  }

  return { status: "OK" as const, deployment, history };
}

async function handleAudit(query: URLSearchParams) {
  const { key, project } = resolveFixture(query);
  const verificationResult = verifyProject(project, DEFAULT_METHODOLOGY_CONFIG);
  const guardianOutcome = buildGuardianOutcome(verificationResult);
  const credential: GuardianCredential | null = guardianOutcome.credential;

  if (!existsSync(deploymentPath)) {
    return {
      fixtureKey: key,
      status: "DATA_UNAVAILABLE",
      anomalies: [],
      history: null,
      explanation: "No local demo deployment found — the Graph has nothing indexed yet.",
    };
  }
  const deployment = JSON.parse(readFileSync(deploymentPath, "utf8")) as { deedId: string };

  const report = await auditDeed({
    graphProvider,
    deedId: deployment.deedId,
    verificationResult,
    ...(credential ? { credential } : {}),
  });
  return { fixtureKey: key, ...report };
}

async function handleArcPayloadPreview(query: URLSearchParams) {
  // Demonstrates the M4 arc/ payload construction (read-only preview; never
  // submitted to a contract from here — this server holds no signer).
  const { key, project } = resolveFixture(query);
  const verificationResult = verifyProject(project, DEFAULT_METHODOLOGY_CONFIG);
  const guardianOutcome = buildGuardianOutcome(verificationResult);
  if (!guardianOutcome.credential) {
    return { fixtureKey: key, eligible: false, reason: "Guardian did not issue a credential for this fixture (fails closed before Arc)." };
  }
  const onChainAuthorization = buildVerificationAuthorization(verificationResult, guardianOutcome.credential, QUANTITY_DECIMALS);
  const deedIdentity = buildDeedIdentity(verificationResult);
  return {
    fixtureKey: key,
    eligible: true,
    deedIdentity,
    onChainAuthorization: {
      ...onChainAuthorization,
      settledQuantityScaled: onChainAuthorization.settledQuantityScaled.toString(),
    },
  };
}

function jsonReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  try {
    let body: unknown;
    switch (url.pathname) {
      case "/api/health":
        body = { status: "OK" };
        break;
      case "/api/project":
        body = await handleProject(url.searchParams);
        break;
      case "/api/evidence":
        body = await handleEvidence(url.searchParams);
        break;
      case "/api/verification":
        body = await handleVerification(url.searchParams);
        break;
      case "/api/geometry":
        body = await handleGeometry(url.searchParams);
        break;
      case "/api/guardian":
        body = await handleGuardian(url.searchParams);
        break;
      case "/api/deed":
        body = await handleDeed();
        break;
      case "/api/audit":
        body = await handleAudit(url.searchParams);
        break;
      case "/api/arc-payload-preview":
        body = await handleArcPayloadPreview(url.searchParams);
        break;
      default:
        throw new HttpError(404, `no such route: ${url.pathname}`);
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(body, jsonReplacer));
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Ecorestore demo API listening on http://localhost:${PORT}`);
});
