import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectMap } from "./ProjectMap";
import { classifyParcel, PARCELS_LAYER_LABEL, S2_CLOUDLESS_LAYER_LABEL } from "./projectMapLayers";
import type { ParcelFeature, ParcelFeatureCollection } from "../api/types";

function feature(parcelId: string, role: ParcelFeature["properties"]["role"], extra: Partial<ParcelFeature["properties"]> = {}): ParcelFeature {
  return {
    type: "Feature",
    id: parcelId,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-116.58, 49.126],
          [-116.57, 49.126],
          [-116.57, 49.132],
          [-116.58, 49.132],
          [-116.58, 49.126],
        ],
      ],
    },
    properties: { parcelId, role, areaHectares: 46.5, landCover: "riparian_forest", synthetic: true, ...extra },
  };
}

const EXTENT: ParcelFeatureCollection = {
  type: "FeatureCollection",
  features: [
    feature("KOOT-T-01", "treated"),
    feature("KOOT-C-01", "control_candidate"),
    feature("KOOT-C-02", "control_candidate", { contaminationReason: "known_concurrent_intervention" }),
  ],
};

describe("classifyParcel", () => {
  it("draws every control as an undifferentiated candidate until the engine's eligibility list is supplied", () => {
    expect(classifyParcel(EXTENT.features[0]!, "KOOT-T-01")).toBe("treated");
    expect(classifyParcel(EXTENT.features[1]!, "KOOT-T-01")).toBe("candidate_control");
    expect(classifyParcel(EXTENT.features[2]!, "KOOT-T-01")).toBe("candidate_control");
  });

  it("splits controls into eligible and excluded strictly by the supplied list", () => {
    expect(classifyParcel(EXTENT.features[1]!, "KOOT-T-01", ["KOOT-C-01"])).toBe("eligible_control");
    expect(classifyParcel(EXTENT.features[2]!, "KOOT-T-01", ["KOOT-C-01"])).toBe("excluded_control");
  });
});

describe("ProjectMap", () => {
  it("renders a Leaflet map with one polygon per parcel and the imagery layer off by default", () => {
    const { container } = render(<ProjectMap extent={EXTENT} treatedParcelId="KOOT-T-01" eligibleControlParcelIds={["KOOT-C-01"]} />);

    expect(container.querySelector(".leaflet-container")).not.toBeNull();
    expect(container.querySelectorAll("path.leaflet-interactive")).toHaveLength(3);

    const parcelsToggle = screen.getByLabelText(new RegExp(PARCELS_LAYER_LABEL.replace(/[()]/g, "\\$&"))) as HTMLInputElement;
    const imageryToggle = screen.getByLabelText(/Sentinel-2 cloudless mosaic/) as HTMLInputElement;
    expect(parcelsToggle.checked).toBe(true);
    expect(imageryToggle.checked).toBe(false);
    expect(screen.getByText(new RegExp(S2_CLOUDLESS_LAYER_LABEL.split(" — ")[1]!))).toBeInTheDocument();

    // Only OpenStreetMap tiles are requested until the imagery toggle is turned on.
    const tileHosts = Array.from(container.querySelectorAll("img.leaflet-tile")).map((img) => new URL((img as HTMLImageElement).src).host);
    expect(tileHosts.length).toBeGreaterThan(0);
    expect(new Set(tileHosts)).toEqual(new Set(["tile.openstreetmap.org"]));
  });

  it("shows a legend for exactly the parcel classes present", () => {
    render(<ProjectMap extent={EXTENT} treatedParcelId="KOOT-T-01" eligibleControlParcelIds={["KOOT-C-01"]} />);
    const legend = screen.getByLabelText("Map legend");
    expect(legend).toHaveTextContent("Treated parcel");
    expect(legend).toHaveTextContent("Eligible control (matched by the M1 engine)");
    expect(legend).toHaveTextContent("Excluded control candidate");
    expect(legend).not.toHaveTextContent("Candidate control parcel");
  });
});
