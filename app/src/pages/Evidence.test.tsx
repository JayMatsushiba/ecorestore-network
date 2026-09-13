import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Evidence } from "./Evidence";
import { FixtureProvider } from "../fixtureContext";

const EVIDENCE_RESPONSE = {
  fixtureKey: "partial",
  disclaimer: "SYNTHETIC DEMONSTRATION DATA",
  metric: "canopy_cover_fraction_pct",
  evidence: [
    {
      evidenceId: "ev-1",
      parcelId: "KOOT-T-01",
      metric: "canopy_cover_fraction_pct",
      period: "pre_treatment",
      value: 41.2,
      observedAt: "2024-03-01",
      source: "synthetic_satellite_optical",
      synthetic: true,
    },
    {
      evidenceId: "ev-2",
      parcelId: "KOOT-C-01",
      metric: "canopy_cover_fraction_pct",
      period: "post_treatment",
      value: 43.0,
      observedAt: "2026-03-01",
      source: "synthetic_satellite_optical",
      synthetic: true,
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Evidence page", () => {
  it("shows the pipeline flow diagram before the observations tables", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/api/evidence")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(EVIDENCE_RESPONSE) } as Response);
        }
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }),
    );

    render(
      <MemoryRouter>
        <FixtureProvider>
          <Evidence />
        </FixtureProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText(/Observations — Canopy cover fraction/)).toBeInTheDocument());

    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["How evidence becomes a verification finding", "Observations — Canopy cover fraction (%)"]);

    // The diagram counts the fixture's records per source; it does not invent any.
    expect(screen.getByText("2 synthetic observations in this fixture")).toBeInTheDocument();
    expect(screen.getByText("Not yet in the data model")).toBeInTheDocument();

    // The tables underneath are unchanged.
    expect(screen.getByText("KOOT-T-01")).toBeInTheDocument();
    expect(screen.getByText("KOOT-C-01")).toBeInTheDocument();
  });
});
