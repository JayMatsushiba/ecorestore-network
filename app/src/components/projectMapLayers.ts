/**
 * Layer sources, labels and parcel styling for the Overview map
 * (components/ProjectMap.tsx). Kept apart from the component so the file
 * that renders exports only a component (fast refresh) and so tests can
 * exercise the classification without a map.
 *
 * Nothing here decides anything scientific: `classifyParcel` only reflects
 * the role recorded in the synthetic fixture and, when supplied, the real
 * engine's eligibility list.
 */
import type { PathOptions } from "leaflet";
import type { ParcelFeature } from "../api/types";

export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** EOX Sentinel-2 cloudless 2024, Web Mercator WMTS. CC BY-NC-SA 4.0 — attribution required, non-commercial use. */
export const S2_CLOUDLESS_TILE_URL =
  "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg";
export const S2_CLOUDLESS_ATTRIBUTION =
  '<a href="https://s2maps.eu">Sentinel-2 cloudless</a> by <a href="https://eox.at">EOX IT Services GmbH</a> ' +
  '(Contains modified Copernicus Sentinel data 2024), <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a>';

export const PARCELS_LAYER_LABEL = "Parcel extents (synthetic)";
export const S2_CLOUDLESS_LAYER_LABEL = "Sentinel-2 cloudless mosaic 2024 (EOX) — reference imagery, not pipeline evidence";

// Hex twins of the app's CSS tokens: Leaflet writes these straight into SVG
// stroke/fill attributes, which do not resolve var().
const COLOR_TREATED = "#2f5233"; // --color-primary
const COLOR_CONTROL = "#7a8f5c"; // --color-accent
const COLOR_EXCLUDED = "#8a8a82";

export type ParcelMapClass = "treated" | "eligible_control" | "excluded_control" | "candidate_control";

/**
 * Chooses how a parcel is drawn. Treated vs control comes from the feature's
 * own role; eligible vs excluded is only decided when the caller supplies the
 * engine's `eligibleControlParcelIds` — otherwise every control is drawn as
 * an undifferentiated candidate rather than guessed at.
 */
export function classifyParcel(
  feature: ParcelFeature,
  treatedParcelId: string,
  eligibleControlParcelIds?: readonly string[],
): ParcelMapClass {
  if (feature.properties.role === "treated" || feature.properties.parcelId === treatedParcelId) return "treated";
  if (!eligibleControlParcelIds) return "candidate_control";
  return eligibleControlParcelIds.includes(feature.properties.parcelId) ? "eligible_control" : "excluded_control";
}

export const PARCEL_CLASS_LABELS: Record<ParcelMapClass, string> = {
  treated: "Treated parcel",
  eligible_control: "Eligible control (matched by the M1 engine)",
  excluded_control: "Excluded control candidate",
  candidate_control: "Candidate control parcel",
};

export const PARCEL_STYLES: Record<ParcelMapClass, PathOptions> = {
  treated: { color: COLOR_TREATED, weight: 3, fillColor: COLOR_TREATED, fillOpacity: 0.28 },
  eligible_control: { color: COLOR_CONTROL, weight: 2, dashArray: "6 4", fillColor: COLOR_CONTROL, fillOpacity: 0.18 },
  candidate_control: { color: COLOR_CONTROL, weight: 2, dashArray: "6 4", fillColor: COLOR_CONTROL, fillOpacity: 0.18 },
  excluded_control: { color: COLOR_EXCLUDED, weight: 2, dashArray: "2 5", fillColor: COLOR_EXCLUDED, fillOpacity: 0.1 },
};

export const LEGEND_ORDER: readonly ParcelMapClass[] = ["treated", "eligible_control", "candidate_control", "excluded_control"];
