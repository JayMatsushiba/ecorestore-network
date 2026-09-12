import type { ReactNode } from "react";
import type { AsyncState } from "../hooks/useApi";

/**
 * Renders a subsystem-specific loading/error message rather than a generic
 * "Something went wrong" (M6 prompt §10 — demo failure testing). `subsystem`
 * names what actually failed (e.g. "Demo API server", "Local Graph endpoint")
 * so the failure is legible to someone who did not write the code.
 */
export function AsyncBlock<T>({
  state,
  subsystem,
  children,
}: {
  state: AsyncState<T>;
  subsystem: string;
  children: (data: T) => ReactNode;
}) {
  if (state.status === "loading") {
    return <div className="async-loading">Loading {subsystem}…</div>;
  }
  if (state.status === "error") {
    return (
      <div className="async-error">
        <strong>{subsystem} unavailable.</strong> {state.error}
      </div>
    );
  }
  return <>{children(state.data)}</>;
}
