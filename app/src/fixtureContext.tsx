import { createContext, useContext, useState, type ReactNode } from "react";

export type FixtureKey = "partial" | "trendFail";

interface FixtureContextValue {
  fixture: FixtureKey;
  setFixture: (f: FixtureKey) => void;
}

const FixtureContext = createContext<FixtureContextValue | null>(null);

/**
 * Lets a judge/developer switch the Verification/Guardian/Auditor pages
 * between the real success-path fixture (FIXTURE_PARTIAL_SETTLEMENT) and
 * the real failure-path fixture (FIXTURE_PARALLEL_TREND_FAIL) — both are
 * genuine M1 fixtures (verification/fixtures.ts), not UI-invented states.
 * The on-chain deed/Graph history always reflects the "partial" run,
 * since that is the only one actually settled on-chain.
 */
export function FixtureProvider({ children }: { children: ReactNode }) {
  const [fixture, setFixture] = useState<FixtureKey>("partial");
  return <FixtureContext.Provider value={{ fixture, setFixture }}>{children}</FixtureContext.Provider>;
}

export function useFixture(): FixtureContextValue {
  const ctx = useContext(FixtureContext);
  if (!ctx) throw new Error("useFixture must be used within FixtureProvider");
  return ctx;
}
