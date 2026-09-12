import { useEffect, useState } from "react";

export type AsyncState<T> = { status: "loading" } | { status: "error"; error: string } | { status: "ok"; data: T };

/** Loads data via `fetcher` on mount and whenever `deps` changes. No caching, no retries — a fresh real call every time, matching the rest of this project's "no invented data" rule. */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ status: "ok", data });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: "error", error: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
