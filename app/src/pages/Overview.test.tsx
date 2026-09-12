import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Overview } from "./Overview";
import { FixtureProvider } from "../fixtureContext";

function jsonResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  } as Response);
}

const PROJECT_RESPONSE = {
  fixtureKey: "partial",
  disclaimer: "SYNTHETIC DEMONSTRATION DATA",
  metric: "canopy_cover_fraction_pct",
  methodologyVersion: "ecorestore-m1-v0.1",
  project: {
    projectId: "kootenay-riparian-restoration-partial",
    name: "Kootenay Riparian Restoration (SYNTHETIC)",
    location: "Kootenay River riparian corridor, British Columbia, Canada",
    claimedQuantity: 35,
    window: { preTreatmentStart: "2023-03-01", preTreatmentEnd: "2025-03-01", postTreatmentStart: "2025-03-02", postTreatmentEnd: "2026-09-01" },
    treatedParcel: { parcelId: "KOOT-T-01", role: "treated", areaHectares: 46.5, characteristics: {} },
    candidateControlParcels: [],
  },
};

const VERIFICATION_RESPONSE = {
  fixtureKey: "partial",
  verificationResult: { verificationStatus: "PARTIAL", qualityGateStatus: "PASS", settledQuantity: 18.1815 },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Overview page", () => {
  it("renders the real project identity and verification status once data loads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/api/project")) return jsonResponse(PROJECT_RESPONSE);
        if (url.includes("/api/verification")) return jsonResponse(VERIFICATION_RESPONSE);
        if (url.includes("/api/deed")) return jsonResponse({ status: "UNAVAILABLE", reason: "no local demo deployment found" });
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }),
    );

    render(
      <FixtureProvider>
        <Overview />
      </FixtureProvider>,
    );

    expect(screen.getByText(/Loading Project data/)).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Kootenay Riparian Restoration (SYNTHETIC)")).toBeInTheDocument());
    expect(screen.getByText("kootenay-riparian-restoration-partial")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("PARTIAL")).toBeInTheDocument());
    expect(screen.getByText("UNAVAILABLE")).toBeInTheDocument();
  });

  it("shows a clear unavailable message when the demo API server itself cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network error"))),
    );

    render(
      <FixtureProvider>
        <Overview />
      </FixtureProvider>,
    );

    await waitFor(() => expect(screen.getByText(/Project data unavailable/)).toBeInTheDocument());
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });
});
