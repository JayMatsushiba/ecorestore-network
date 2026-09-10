/**
 * Canonical types for the Ecorestore verification engine.
 *
 * Authority: the engine owns the *scientific result*. Nothing in this module
 * knows about wallets, payments, Guardian or the Auditor.
 *
 * Provenance discipline (CLAUDE.md, docs/VERIFICATION.md §3): Tier 0 satellite evidence
 * is REAL; Tiers 1-3 are SIMULATED and carry the banner wherever they appear.
 */

export type Provenance = 'REAL' | 'SIMULATED';

export const SIMULATED_BANNER =
  'SIMULATED DEMONSTRATION DATA — NOT REAL FIELD, SENSOR OR REGULATORY MEASUREMENT.';

/** ISO calendar date, YYYY-MM-DD. */
export type IsoDate = string;
/** 0x-prefixed lowercase hex string. */
export type Hex = `0x${string}`;

export interface ObservationWindow {
  label: string;
  start: IsoDate;
  end: IsoDate;
}

// ---------------------------------------------------------------------------
// Parcel identity (docs/ARCHITECTURE.md §5)
// ---------------------------------------------------------------------------

export interface ParcelPolygon {
  type: 'Polygon';
  /** GeoJSON ring(s), [lng, lat] pairs, WGS84. */
  coordinates: number[][][];
}

export interface ParcelRecord {
  parcelId: string;
  name: string;
  /** Real location; no claim that an intervention occurred there. */
  locationNote: string;
  geometry: ParcelPolygon;
  /** Canonical H3 resolution used for the identity cell set. */
  h3Resolution: number;
  ecosystem: string;
  tenureAttestation: {
    type: 'freehold' | 'lease' | 'customary' | 'co_management';
    attestorDid: string;
    documentHash: Hex;
    /** Simulated for the demonstration. */
    provenance: Provenance;
  };
  encumbrances: {
    legalObligations: string[];
    publicSubsidy: string[];
    existingClaims: string[];
    provenance: Provenance;
  };
}

export interface ParcelIdentity {
  parcelId: string;
  /** keccak256 of the canonical GeoJSON polygon. */
  geometryHash: Hex;
  /** Merkle root of the sorted H3 cell set at `h3Resolution`. */
  h3Root: Hex;
  h3Resolution: number;
  h3CellCount: number;
  /** Geodesic area from polygon geometry — never from cell counts. */
  areaHa: number;
}

// ---------------------------------------------------------------------------
// Pre-registered analysis plan (docs/VERIFICATION.md §6)
// ---------------------------------------------------------------------------

export interface RingGeometry {
  innerM: number;
  outerM: number;
}

export interface AnalysisPlan {
  planVersion: string;
  metric: {
    id: string;
    version: string;
    unit: 'ha';
    description: string;
  };
  index: {
    name: 'NDVI';
    version: string;
    /** Sentinel-2 SCL classes accepted as valid observations. */
    sclClassesValid: number[];
    maxSceneCloudCoverPct: number;
    /** A unit-scene observation is used only if this fraction of its pixels is valid. */
    minValidPixelFraction: number;
    /** Per-season aggregation of scene observations. */
    compositing: 'median';
    /**
     * DN → surface reflectance for the named collection. Earth Search v1
     * `sentinel-2-l2a` COGs are already BOA-offset-harmonised, so only the
     * scale applies; the STAC-advertised offset is recorded but not applied.
     */
    dnToReflectance: { scale: number; offset: number; note: string };
  };
  windows: {
    /** Growing-season windows before the (constructed) treatment date. Fixed dates. */
    pre: ObservationWindow[];
    /** Growing-season windows after treatment. Fixed dates. */
    post: ObservationWindow[];
    treatmentDate: IsoDate;
  };
  /** Minimum usable scenes per window; fewer → INSUFFICIENT_EVIDENCE. */
  minScenesPerWindow: number;
  controlRule: {
    /** H3 resolution of candidate control units drawn inside each ring. */
    unitResolution: number;
    /** H3 resolution of sub-parcel cells used for the no-net-loss gate. */
    parcelCellResolution: number;
    nearRing: RingGeometry;
    farRing: RingGeometry;
    matching: {
      covariates: Array<'pre_level' | 'pre_slope'>;
      /** Caliper in pooled standard deviations of each covariate. */
      caliperSd: number;
      /** Number of nearest units retained per ring. */
      k: number;
      /** Fewer matched far-ring units than this → INSUFFICIENT_EVIDENCE. */
      minMatched: number;
    };
    /** Units with a valid-pixel water fraction above this are excluded. */
    maxWaterFraction: number;
  };
  parallelTrend: {
    test: 'pre_period_slope_interaction_ols_v1';
    /** Interaction p-value below alpha → FAIL. */
    alpha: number;
    /** Absolute slope difference (NDVI / year) above this → FAIL. */
    maxAbsSlopeDiffPerYear: number;
  };
  leakage: {
    method: 'near_far_divergence_v1';
    floorAtZero: boolean;
  };
  uncertainty: {
    confidenceLevel: number;
    bootstrapIterations: number;
    seed: number;
    /** Index → physical quantity transfer: fractional woody cover per unit ΔNDVI. */
    modelTransfer: { coefficient: number; sd: number; source: string };
    /**
     * Control-matching error (docs/VERIFICATION.md §10, term 1): the parcel is one draw
     * from the same population of unit-level shocks as its controls, so the
     * counterfactual error is not the standard error of the control mean alone.
     * `far_ring_residual_v1` adds a draw from the matched far-ring residual
     * distribution to each bootstrap iteration; `none` omits it.
     */
    controlMatchingShock: { method: 'far_ring_residual_v1' | 'none' };
    coverage: {
      method: 'placebo_in_space_far_ring_v1';
      maxPlacebos: number;
      bootstrapIterations: number;
    };
  };
  gates: {
    noNetHabitatLoss: { ndviDropThreshold: number; maxLossCellFraction: number };
    nativeSpeciesFraction: { min: number };
    conditionFloor: { minPostNdvi: number };
  };
  processingGraphVersion: string;
  /**
   * Fields whose values are provisional defaults awaiting explicit approval
   * (docs/DECISIONS.md §3). Recorded in the plan so the hash commits to that state.
   */
  provisional: Array<{ field: string; openItem: string; note: string }>;
}

// ---------------------------------------------------------------------------
// Tier 0 — real satellite snapshot produced by `acquire.ts`
// ---------------------------------------------------------------------------

export type UnitZone = 'parcel' | 'parcel_cell' | 'near' | 'far';

export interface SpatialUnit {
  unitId: string;
  zone: UnitZone;
  /** Geodesic area from the unit's polygon geometry. */
  areaHa: number;
  pixelCount: number;
  centroid: [number, number];
}

export interface SceneRecord {
  sceneId: string;
  datetime: string;
  platform: string;
  cloudCoverPct: number;
  processingBaseline: string;
  epsg: number;
  assets: { red: string; nir: string; scl: string };
  /** As advertised by the STAC raster:bands metadata; recorded for provenance, see AnalysisPlan.index.dnToReflectance. */
  stacAdvertisedReflectance: { scale: number; offset: number };
}

export interface SceneObservation {
  /** Mean NDVI over valid pixels per unit, aligned with `Tier0Snapshot.units`. null if below minValidPixelFraction. */
  ndvi: Array<number | null>;
  /** Valid pixel fraction per unit. */
  validFraction: number[];
  /** Water (SCL 6) fraction among valid pixels per unit. */
  waterFraction: number[];
}

export interface Tier0Snapshot {
  /**
   * REAL for acquired satellite data. SIMULATED only for a sensitivity
   * scenario in which a synthetic treatment effect has been injected into a
   * real series; such a snapshot must carry `syntheticEffectNote` and every
   * downstream artefact inherits the SIMULATED label.
   */
  provenance: Provenance;
  syntheticEffectNote?: string;
  tier: 0;
  source: {
    catalog: string;
    collection: string;
    assetHost: string;
  };
  processingGraphVersion: string;
  acquiredAt: string;
  parcelId: string;
  geometryHash: Hex;
  h3Root: Hex;
  crs: string;
  window: {
    bbox: [number, number, number, number];
    pixelWindow: [number, number, number, number];
    /** The pixel-snapped read grid; recorded by processing graph 2.0.0 (Python), absent in 1.0.0. */
    grid?: { originX: number; originY: number; resolution: number; width: number; height: number };
  };
  scenes: SceneRecord[];
  units: SpatialUnit[];
  observations: Record<string, SceneObservation>;
  /** keccak256 of the canonical snapshot minus this field. */
  snapshotHash: Hex;
}

// ---------------------------------------------------------------------------
// Tiers 1-3 — simulated, labelled
// ---------------------------------------------------------------------------

export interface SimulatedTierBase {
  provenance: 'SIMULATED';
  banner: typeof SIMULATED_BANNER;
  generator: { name: string; version: string; seed: number };
  bundleHash: Hex;
}

export interface Tier1DroneEvidence extends SimulatedTierBase {
  tier: 1;
  surveyDate: IsoDate;
  orthomosaicRef: string;
  plots: Array<{
    plotId: string;
    h3Cell: string;
    canopyFractionPre: number;
    canopyFractionPost: number;
    stemsDetected: number;
    nativeStems: number;
  }>;
  nativeSpeciesFraction: number;
}

export interface Tier2IotEvidence extends SimulatedTierBase {
  tier: 2;
  nodes: Array<{
    nodeId: string;
    h3Cell: string;
    metric: 'soil_moisture_vwc';
    series: Array<{ date: IsoDate; value: number }>;
    flatlined: boolean;
  }>;
  rainfallEvents: IsoDate[];
}

export interface Tier3GroundEvidence extends SimulatedTierBase {
  tier: 3;
  claim: { metricId: string; value: number; unit: 'ha'; window: ObservationWindow; submittedBy: string };
  plantingRecords: Array<{ date: IsoDate; species: string; stems: number; native: boolean }>;
  geotaggedPhotos: Array<{ photoId: string; h3Cell: string; date: IsoDate }>;
}

export interface EvidenceBundle {
  tier0: Tier0Snapshot;
  tier1: Tier1DroneEvidence;
  tier2: Tier2IotEvidence;
  tier3: Tier3GroundEvidence;
}

// ---------------------------------------------------------------------------
// Canonical VerificationResult (docs/VERIFICATION.md §13)
// ---------------------------------------------------------------------------

export type VerificationStatus =
  | 'VERIFIED'
  | 'PARTIAL'
  | 'NOT_ADDITIONAL'
  | 'INSUFFICIENT_EVIDENCE'
  | 'GATE_FAILED'
  | 'INVALID_RESULT';

export type GateStatus = 'PASS' | 'FAIL' | 'NOT_EVALUATED';

export type ObligationStatus = 'voluntary_additional' | 'obligation_linked' | 'subsidy_overlapping';

export interface Interval {
  lower: number;
  upper: number;
  confidenceLevel: number;
}

export interface TierCorroboration {
  tier: 0 | 1 | 2 | 3;
  label: string;
  provenance: Provenance;
  score: number;
  note?: string;
}

export interface ControlSetSummary {
  ring: 'near' | 'far';
  geometry: RingGeometry;
  candidates: number;
  excludedWater: number;
  matched: number;
  matchedUnitIds: string[];
  meanPreLevel: number;
  meanPreSlope: number;
  changeIndex: number;
}

export interface VerificationResult {
  resultVersion: '1.0.0';
  projectId: string;
  parcelId: string;
  parcelH3Root: Hex;
  geometryHash: Hex;
  parcelAreaHa: number;
  analysisPlanHash: Hex;
  runIndex: number;
  methodologyVersion: string;
  processingGraphVersion: string;
  /**
   * Which implementation of the analysis boundary produced the numbers
   * (`analysis-contract.ts`). Determinism is a per-runtime guarantee, so the
   * runtime is part of what the result hash commits to.
   */
  analysisEngine: { name: string; version: string };
  stacSceneIds: string[];
  tier0Provenance: { provenance: Provenance; catalog: string; collection: string; snapshotHash: Hex; note?: string };
  metric: { id: string; version: string; unit: 'ha' };
  window: ObservationWindow;
  claimedQuantity: number;
  /** All index-space quantities are ΔNDVI; hectare quantities apply the model transfer. */
  measured: {
    parcelChangeIndex: number;
    parcelChangeHa: number;
    controlChangeFarRingIndex: number;
    controlChangeFarRingHa: number;
    controlChangeNearRingIndex: number;
    controlChangeNearRingHa: number;
    leakageIndex: number;
    leakageHa: number;
    didIndex: number;
    additionalBiophysicalIndex: number;
    additionalBiophysicalHa: number;
  };
  controlSets: ControlSetSummary[];
  parallelTrend: {
    status: GateStatus;
    slopeDiffPerYear: number;
    pValue: number;
    nObservations: number;
    criterion: string;
  };
  uncertainty: {
    interval: Interval;
    method: string;
    bootstrapIterations: number;
    seed: number;
    empiricalCoverage: {
      nominal: number;
      empirical: number | null;
      method: string;
      placebos: number;
      basis: string;
    };
  };
  lowerBound: number;
  qualityGate: {
    status: GateStatus;
    gates: Array<{ name: string; status: GateStatus; detail: string; provenance: Provenance }>;
  };
  tierCorroboration: TierCorroboration[];
  obligationStatus: ObligationStatus;
  verificationStatus: VerificationStatus;
  statusReason: string;
  settledQuantity: number;
  settlementBasis: string;
  evidenceHash: Hex;
  evidenceCid: string;
  evidenceCidNote: string;
  simulatedTiersBanner: typeof SIMULATED_BANNER;
  computedAt: string;
  resultHash: Hex;
}
