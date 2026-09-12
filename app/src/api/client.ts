/**
 * Ecorestore Network — M6 API client
 *
 * Thin fetch wrappers around server/index.ts. No caching, no
 * transformation of values beyond JSON parsing — the UI must display what
 * the real M1-M5 pipeline produced, not a reshaped derivative of it.
 */
import type {
  ArcPayloadResponse,
  AuditResponse,
  DeedResponse,
  EvidenceResponse,
  GuardianResponse,
  ProjectResponse,
  VerificationResponse,
} from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function getJson<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`);
  } catch (err) {
    throw new ApiError(0, `Demo API server unreachable at ${BASE_URL}. Is it running (npm run server)?`);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error ?? `Request to ${path} failed with HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export const api = {
  project: (fixture: string) => getJson<ProjectResponse>(`/api/project?fixture=${fixture}`),
  evidence: (fixture: string) => getJson<EvidenceResponse>(`/api/evidence?fixture=${fixture}`),
  verification: (fixture: string) => getJson<VerificationResponse>(`/api/verification?fixture=${fixture}`),
  guardian: (fixture: string) => getJson<GuardianResponse>(`/api/guardian?fixture=${fixture}`),
  deed: () => getJson<DeedResponse>(`/api/deed`),
  audit: (fixture: string) => getJson<AuditResponse>(`/api/audit?fixture=${fixture}`),
  arcPayloadPreview: (fixture: string) => getJson<ArcPayloadResponse>(`/api/arc-payload-preview?fixture=${fixture}`),
};
