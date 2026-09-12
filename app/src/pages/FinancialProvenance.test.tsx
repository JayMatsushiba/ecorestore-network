import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Layout } from "../components/Layout";
import { FixtureProvider } from "../fixtureContext";
import { Financial } from "./Financial";
import { Provenance } from "./Provenance";

function jsonResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  } as Response);
}

const DEED_OK = {
  status: "OK",
  deployment: { deedId: "0", settledQuantity: 18.1815 },
  history: {
    deed: {
      id: "0",
      deedId: "0",
      projectId: "0xproj",
      parcelH3Root: "0xparcel",
      sponsor: "0xsponsor",
      beneficiary: "0xbeneficiary",
      authorizedVerifier: "0xverifier",
      escrowAmount: "100000000",
      unitPriceUSDC: "1000000",
      quantityDecimals: 6,
      fundedAmount: "100000000",
      verificationId: "0xverif",
      settledQuantityScaled: "18181500",
      settlementAmount: "18181500",
      releasedAmount: "18181500",
      status: "SETTLED",
      createdAt: "1",
      createdBlock: "3",
      createdTxHash: "0xcreatetx",
      updatedAt: "2",
      updatedBlock: "8",
      updatedTxHash: "0xupdatetx",
    },
    verifications: [
      {
        id: "0xverif",
        deedId: "0",
        verificationId: "0xverif",
        financiallyEligible: true,
        settledQuantityScaled: "18181500",
        settlementAmount: "18181500",
        timestamp: "1",
        blockNumber: "7",
        transactionHash: "0xvtx",
      },
    ],
    settlements: [
      {
        id: "0xstx",
        deedId: "0",
        verificationId: "0xverif",
        beneficiary: "0xbeneficiary",
        settlementAmount: "18181500",
        refundedRemainder: "81818500",
        timestamp: "1",
        blockNumber: "8",
        transactionHash: "0xstx",
      },
    ],
    fundings: [{ id: "0xftx", deedId: "0", sponsor: "0xsponsor", amount: "100000000", timestamp: "1", blockNumber: "6", transactionHash: "0xftx" }],
    refunds: [],
    cancellations: [],
  },
};

const AUDIT_CONSISTENT = {
  fixtureKey: "partial",
  status: "CONSISTENT",
  deedId: "0",
  history: DEED_OK.history,
  anomalies: [],
  explanation: "Deed 0 (status SETTLED) is internally consistent.",
};

const AUDIT_ANOMALOUS = {
  fixtureKey: "trendFail",
  status: "ANOMALOUS",
  deedId: "0",
  history: DEED_OK.history,
  anomalies: [
    {
      code: "QUANTITY_MISMATCH",
      message: "Off-chain M1 settledQuantity (0, scaled = 0) does not match the on-chain indexed settledQuantityScaled (18181500).",
    },
  ],
  explanation: "Deed 0 (status SETTLED) has 1 anomaly: QUANTITY_MISMATCH.",
};

const ARC_INELIGIBLE = {
  fixtureKey: "trendFail",
  eligible: false,
  reason: "Guardian did not issue a credential for this fixture (fails closed before Arc).",
};

function mockFetch() {
  return vi.fn((url: string) => {
    if (url.includes("/api/deed")) return jsonResponse(DEED_OK);
    if (url.includes("/api/audit?fixture=partial")) return jsonResponse(AUDIT_CONSISTENT);
    if (url.includes("/api/audit?fixture=trendFail")) return jsonResponse(AUDIT_ANOMALOUS);
    if (url.includes("/api/arc-payload-preview?fixture=trendFail")) return jsonResponse(ARC_INELIGIBLE);
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAt(path: string, element: React.ReactElement) {
  window.location.hash = `#${path}`;
  return render(
    <FixtureProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path={path.slice(1)} element={element} />
          </Route>
        </Routes>
      </HashRouter>
    </FixtureProvider>,
  );
}

describe("Financial page reflects the contract audit for the selected verification case", () => {
  it("shows CONSISTENT for the success case and ANOMALOUS after switching to the failure case", async () => {
    vi.stubGlobal("fetch", mockFetch());
    renderAt("/financial", <Financial />);

    await waitFor(() => expect(screen.getByText("SETTLED")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("CONSISTENT")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Verification case/i), { target: { value: "trendFail" } });

    await waitFor(() => expect(screen.getByText("ANOMALOUS")).toBeInTheDocument());
    expect(screen.getByText(/QUANTITY MISMATCH/)).toBeInTheDocument();
    // The on-chain deed panel is unaffected by the selector — still the settled deed.
    expect(screen.getByText("SETTLED")).toBeInTheDocument();
  });
});

describe("Provenance page reflects the contract audit for the selected verification case", () => {
  it("shows CONSISTENT for the success case and ANOMALOUS after switching to the failure case", async () => {
    vi.stubGlobal("fetch", mockFetch());
    renderAt("/provenance", <Provenance />);

    await waitFor(() => expect(screen.getByText(/DeedCreated/)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("CONSISTENT")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Verification case/i), { target: { value: "trendFail" } });

    await waitFor(() => expect(screen.getByText("ANOMALOUS")).toBeInTheDocument());
    expect(screen.getByText(/QUANTITY MISMATCH/)).toBeInTheDocument();
    // The timeline itself is unaffected by the selector — still the real settled-deed history.
    expect(screen.getByText(/DeedCreated/)).toBeInTheDocument();
  });
});
