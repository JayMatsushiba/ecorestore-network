import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { VerificationFlow } from "./VerificationFlow";
import type { EvidenceObservation } from "../api/types";

function obs(id: string, source: string): EvidenceObservation {
  return {
    evidenceId: id,
    parcelId: "KOOT-T-01",
    metric: "canopy_cover_fraction_pct",
    period: "pre_treatment",
    value: 40,
    observedAt: "2024-03-01",
    source,
    synthetic: true,
  } as EvidenceObservation;
}

function renderFlow(evidence: EvidenceObservation[]) {
  return render(
    <MemoryRouter>
      <VerificationFlow evidence={evidence} />
    </MemoryRouter>,
  );
}

describe("VerificationFlow", () => {
  it("lists the pipeline stages in the engine's order, marking the gates and the output", () => {
    renderFlow([]);
    const stages = screen.getAllByTestId("flow-stage");
    expect(stages.map((s) => s.querySelector(".flow__node-title")?.textContent?.replace(/^\d+/, "").replace(/gate$/, ""))).toEqual([
      "Evidence sufficiency",
      "Control matching",
      "Parallel-trend diagnostic",
      "Difference-in-differences",
      "Additionality",
      "Uncertainty",
      "Conservative lower bound",
      "Quality gate",
      "VerificationResult",
    ]);
    const gates = stages.filter((s) => s.classList.contains("flow__stage--gate"));
    expect(gates.map((s) => s.textContent)).toHaveLength(4);
    expect(stages[stages.length - 1]).toHaveClass("flow__stage--output");
  });

  it("reports per-source record counts from the loaded evidence without inventing sources", () => {
    renderFlow([
      obs("e1", "synthetic_satellite_optical"),
      obs("e2", "synthetic_satellite_optical"),
      obs("e3", "synthetic_satellite_optical"),
      obs("e4", "synthetic_ground_report"),
    ]);

    const optical = screen.getByTestId("flow-source-synthetic_satellite_optical");
    expect(within(optical).getByText("3 synthetic observations in this fixture")).toBeInTheDocument();
    expect(optical).toHaveClass("flow__source--present");

    const ground = screen.getByTestId("flow-source-synthetic_ground_report");
    expect(within(ground).getByText("1 synthetic observation in this fixture")).toBeInTheDocument();

    const sar = screen.getByTestId("flow-source-synthetic_satellite_sar");
    expect(within(sar).getByText("In the data model — none in this fixture")).toBeInTheDocument();
    expect(sar).toHaveClass("flow__source--absent");

    const drone = screen.getByTestId("flow-source-future_drone_iot");
    expect(within(drone).getByText("Not yet in the data model")).toBeInTheDocument();
  });

  it("says every source is synthetic and links to the Verification page for the real result", () => {
    renderFlow([obs("e1", "synthetic_satellite_optical")]);
    expect(screen.getByText(/all sources are synthetic/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Verification page" })).toHaveAttribute("href", "/verification");
  });
});
