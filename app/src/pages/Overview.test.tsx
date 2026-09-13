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
  verificationResult: {
    verificationStatus: "PARTIAL",
    qualityGateStatus: "PASS",
    settledQuantity: 18.1815,
    diagnostics: { eligibleControlParcelIds: ["KOOT-C-01", "KOOT-C-04"] },
  },
};

const SQUARE = [
  [-116.58, 49.126],
  [-116.57, 49.126],
  [-116.57, 49.132],
  [-116.58, 49.132],
  [-116.58, 49.126],
];

const GEOMETRY_RESPONSE = {
  fixtureKey: "partial",
  disclaimer: "SYNTHETIC DEMONSTRATION GEOMETRY",
  projectId: "kootenay-riparian-restoration-partial",
  treatedParcelId: "KOOT-T-01",
  parcelsWithoutGeometry: [],
  extent: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: "KOOT-T-01",
        geometry: { type: "Polygon", coordinates: [SQUARE] },
        properties: { parcelId: "KOOT-T-01", role: "treated", areaHectares: 46.5, landCover: "riparian_forest", synthetic: true },
      },
      {
        type: "Feature",
        id: "KOOT-C-01",
        geometry: { type: "Polygon", coordinates: [SQUARE.map(([lon, lat]) => [lon, lat + 0.01])] },
        properties: { parcelId: "KOOT-C-01", role: "control_candidate", areaHectares: 39, landCover: "riparian_forest", synthetic: true },
      },
    ],
  },
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
        if (url.includes("/api/geometry")) return jsonResponse(GEOMETRY_RESPONSE);
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

  it("draws the synthetic parcel extent map between the project panel and the status panel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/api/project")) return jsonResponse(PROJECT_RESPONSE);
        if (url.includes("/api/verification")) return jsonResponse(VERIFICATION_RESPONSE);
        if (url.includes("/api/geometry")) return jsonResponse(GEOMETRY_RESPONSE);
        if (url.includes("/api/deed")) return jsonResponse({ status: "UNAVAILABLE", reason: "no local demo deployment found" });
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }),
    );

    const { container } = render(
      <FixtureProvider>
        <Overview />
      </FixtureProvider>,
    );

    await waitFor(() => expect(screen.getByLabelText("Map of the synthetic project extent")).toBeInTheDocument());
    await waitFor(() => expect(container.querySelectorAll("path.leaflet-interactive")).toHaveLength(2));

    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["Kootenay Riparian Restoration (SYNTHETIC)", "Project extent", "Current status"]);

    // The eligibility colouring comes from the real verification diagnostics, so the legend names an eligible control.
    await waitFor(() => expect(screen.getByLabelText("Map legend")).toHaveTextContent("Eligible control"));
    expect(screen.getByLabelText(/Sentinel-2 cloudless mosaic/)).not.toBeChecked();
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
