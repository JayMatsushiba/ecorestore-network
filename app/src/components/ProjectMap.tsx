/**
 * Ecorestore Network — Project extent map (M6 UI)
 *
 * Draws the synthetic parcel footprints served by `/api/geometry` on a
 * Leaflet map over OpenStreetMap tiles, with EOX's public Sentinel-2
 * cloudless mosaic available as a toggleable reference layer.
 *
 * Presentation only. The polygons are synthetic demonstration geometry
 * (server/spatialFixtures.ts) that the M1 engine never reads. The imagery
 * layer is a pre-rendered public annual mosaic fetched from EOX — context
 * for the viewer, not evidence consumed by the pipeline, whose observations
 * are synthetic values (see the Evidence page). Which control parcels count
 * as eligible comes from the real VerificationResult diagnostics passed in
 * by the caller; this component decides nothing.
 *
 * Network note: this is the one place the browser talks to anything other
 * than server/ — tiles are requested from tile.openstreetmap.org and
 * tiles.maps.eox.at directly (see app/nginx.conf).
 */
import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ParcelFeature, ParcelFeatureCollection } from "../api/types";
import {
  classifyParcel,
  LEGEND_ORDER,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  PARCEL_CLASS_LABELS,
  PARCEL_STYLES,
  PARCELS_LAYER_LABEL,
  S2_CLOUDLESS_ATTRIBUTION,
  S2_CLOUDLESS_LAYER_LABEL,
  S2_CLOUDLESS_TILE_URL,
  type ParcelMapClass,
} from "./projectMapLayers";

/** Popup body built from DOM nodes (no HTML string interpolation of server-supplied text). */
function buildPopup(feature: ParcelFeature, parcelClass: ParcelMapClass): HTMLElement {
  const { parcelId, areaHectares, landCover, contaminationReason } = feature.properties;
  const rows: [string, string][] = [
    ["Parcel", parcelId],
    ["Role", PARCEL_CLASS_LABELS[parcelClass]],
    ["Declared area", `${areaHectares} ha`],
    ["Land cover", landCover.replaceAll("_", " ")],
  ];
  if (contaminationReason) rows.push(["Contamination flag", contaminationReason.replaceAll("_", " ")]);
  rows.push(["Geometry", "synthetic demonstration extent"]);

  const root = document.createElement("div");
  root.className = "parcel-popup";
  for (const [label, value] of rows) {
    const row = document.createElement("div");
    row.className = "parcel-popup__row";
    const labelEl = document.createElement("span");
    labelEl.textContent = `${label}:`;
    const valueEl = document.createElement("span");
    valueEl.textContent = value;
    row.append(labelEl, valueEl);
    root.append(row);
  }
  return root;
}

interface ProjectMapProps {
  extent: ParcelFeatureCollection;
  treatedParcelId: string;
  /** From the real VerificationResult diagnostics; undefined while verification is still loading or unavailable. */
  eligibleControlParcelIds?: readonly string[] | undefined;
}

export function ProjectMap({ extent, treatedParcelId, eligibleControlParcelIds }: ProjectMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Stable dependency for the effect: the array identity changes on every render upstream.
  const eligibleKey = eligibleControlParcelIds ? eligibleControlParcelIds.join("|") : null;

  const legendClasses = useMemo(() => {
    const eligible = eligibleKey === null ? undefined : eligibleKey.split("|").filter((id) => id.length > 0);
    const present = new Set(extent.features.map((feature) => classifyParcel(feature, treatedParcelId, eligible)));
    return LEGEND_ORDER.filter((parcelClass) => present.has(parcelClass));
  }, [extent, treatedParcelId, eligibleKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const eligible = eligibleKey === null ? undefined : eligibleKey.split("|").filter((id) => id.length > 0);

    const map = L.map(container, { scrollWheelZoom: false });
    L.tileLayer(OSM_TILE_URL, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(map);
    const imagery = L.tileLayer(S2_CLOUDLESS_TILE_URL, {
      maxNativeZoom: 16,
      maxZoom: 19,
      attribution: S2_CLOUDLESS_ATTRIBUTION,
    });

    const parcels = L.geoJSON(extent as GeoJSON.FeatureCollection, {
      style: (feature) => PARCEL_STYLES[classifyParcel(feature as ParcelFeature, treatedParcelId, eligible)],
      onEachFeature: (feature, layer) => {
        const typed = feature as ParcelFeature;
        const parcelClass = classifyParcel(typed, treatedParcelId, eligible);
        layer.bindPopup(buildPopup(typed, parcelClass));
        layer.bindTooltip(typed.properties.parcelId, { direction: "center", className: "parcel-tooltip" });
      },
    }).addTo(map);

    L.control
      .layers({}, { [PARCELS_LAYER_LABEL]: parcels, [S2_CLOUDLESS_LAYER_LABEL]: imagery }, { collapsed: false })
      .addTo(map);
    L.control.scale({ imperial: false }).addTo(map);

    const bounds = parcels.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
    } else {
      map.setView([49.13, -116.57], 11);
    }

    // Keep the map's internal size in step with its container (window resizes,
    // responsive reflow). jsdom has no ResizeObserver, hence the guard.
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer?.observe(container);

    return () => {
      observer?.disconnect();
      map.remove();
    };
  }, [extent, treatedParcelId, eligibleKey]);

  return (
    <div className="project-map">
      <div ref={containerRef} className="project-map__canvas" role="region" aria-label="Map of the synthetic project extent" />
      <ul className="project-map__legend" aria-label="Map legend">
        {legendClasses.map((parcelClass) => (
          <li key={parcelClass}>
            <span className={`project-map__swatch project-map__swatch--${parcelClass}`} aria-hidden="true" />
            {PARCEL_CLASS_LABELS[parcelClass]}
          </li>
        ))}
      </ul>
    </div>
  );
}
