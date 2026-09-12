type Tone = "ok" | "warn" | "danger" | "neutral";

const TONE_BY_STATUS: Record<string, Tone> = {
  PASS: "ok",
  VERIFIED: "ok",
  PARTIAL: "ok",
  CONSISTENT: "ok",
  OK: "ok",
  SETTLED: "ok",
  FUNDED: "neutral",
  CREATED: "neutral",
  CREDENTIAL_ISSUED: "ok",
  VERIFICATION_AUTHORIZED: "ok",
  VERIFICATION_SUBMITTED: "neutral",
  EVIDENCE_SUBMITTED: "neutral",
  FAIL: "danger",
  FAILED: "danger",
  INVALID_RESULT: "danger",
  ANOMALOUS: "danger",
  CANCELLED: "danger",
  REFUNDED: "warn",
  INSUFFICIENT_EVIDENCE: "warn",
  NOT_FOUND: "warn",
  UNAVAILABLE: "warn",
  DATA_UNAVAILABLE: "warn",
  NO_SUBMISSION: "neutral",
};

export function StatusPill({ status }: { status: string }) {
  const tone = TONE_BY_STATUS[status] ?? "neutral";
  return <span className={`status-pill status-pill--${tone}`}>{status.replaceAll("_", " ")}</span>;
}
