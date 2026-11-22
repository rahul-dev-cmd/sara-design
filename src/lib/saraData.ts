import fallbackPartsJson from '../../public/parts.json';

export type StatusTag = 'PLANNED' | 'CAD ESTIMATE' | 'PLACEHOLDER' | 'CONCEPT' | 'DATASHEET';

export type ViewMode = 'outer' | 'inner' | 'explode' | 'simulate';

export type SegmentType = 'head' | 'joint' | 'module' | 'tail';

export interface SegmentDimension {
  id: string;
  label: string;
  type: SegmentType;
  lengthMm: number;
  massG: number;
  massLabel: string;
  lengthStatus: StatusTag;
  massStatus: StatusTag;
}

export interface MaterialDef {
  name: string;
  color: string;
  roughness: number;
  metalness: number;
  clearcoat: number;
  reason: string;
}

export interface PartSpec {
  id: string;
  name: string;
  segment: string;
  category: string;
  material: string;
  mass: string;
  dimensions: string;
  source: string;
  status: StatusTag;
  isHeartbeat?: boolean;
  description: string;
}

export interface BomGroup {
  group: string;
  items: string;
  source: string;
  costInr: number;
  status: StatusTag;
}

export interface CurrentBudgetRail {
  rail: string;
  converter: string;
  typicalRange: string;
  limitA: number;
  estimatedPeakA: number;
  breakdown: string;
  assessment: string;
  riskLevel: 'nominal' | 'caution' | 'warning';
  status: StatusTag;
}

export interface SaraPartsData {
  _comment: string;
  project: {
    name: string;
    fullName: string;
    award: string;
    applicationId: string;
    track: string;
    subTheme: string;
    statusLabel: string;
    headline: string;
    oneLiner: string;
    team: string[];
    mentorNote: string;
    githubUrl: string;
    renderCredit: string;
  };
  overall: {
    totalLengthMm: { value: number; unit: string; status: StatusTag; source: string };
    crossSectionMm: { width: number; height: number; unit: string; status: StatusTag; source: string };
    innerTubeDiameterMm: { value: number; unit: string; status: StatusTag; source: string };
    coreHoleDiameterMm: { value: number; unit: string; status: StatusTag; source: string };
    petgWallThicknessMm: { value: number; unit: string; status: StatusTag; source: string };
    partCount: { value: number; unit: string; status: StatusTag; source: string };
    massPrintedKg: { value: number; display: string; unit: string; status: StatusTag; source: string };
    massSolidKg: { value: number; unit: string; status: StatusTag; source: string };
    speed: { display: string; note: string; status: StatusTag };
    runtime: { display: string; note: string; status: StatusTag };
    ipRating: { display: string; note: string; status: StatusTag };
    tetherStatus: { display: string; status: StatusTag };
  };
  dimensions: {
    segmentLengthsNote: string;
    outerDiameterMm: number;
    beltOuterSpanMm: number;
    noseLengthMm: number;
    segments: SegmentDimension[];
  };
  materials: Record<'petg' | 'tpu' | 'al6061' | 'steel' | 'heartbeat', MaterialDef>;
  parts: PartSpec[];
  bom: {
    currency: string;
    symbol: string;
    honestNote: string;
    heartbeatNote: string;
    contingencyPercent: number;
    groups: BomGroup[];
  };
  currentBudget: CurrentBudgetRail[];
  pinMap: {
    esp32: Array<{ func: string; gpio: string; connectsTo: string }>;
    piZero: Array<{ pin: string; connectsTo: string }>;
    note: string;
  };
  userJourney: {
    before: string[];
    after: string[];
    honestNote: string;
  };
  safety: {
    statusNote: string;
    rows: Array<{ failureMode: string; hazard: string; failsafe: string; status: StatusTag }>;
    physicalFailsafes: string[];
  };
  risks: Array<{ risk: string; detail: string; backup: string; status: StatusTag }>;
  roadmap: Array<{ month: string; date: string; title: string; tasks: string; status: StatusTag }>;
  stage3Target: string;
}

export interface ComputedSegmentPlacement {
  id: string;
  label: string;
  type: SegmentType;
  lengthMm: number;
  startMm: number;
  endMm: number;
  centerMm: number;
  /** Centered coordinate along body X-axis in scene units (1 unit = 100 mm, head at -X, tail at +X) */
  centerX: number;
  lengthUnits: number;
}

export interface BomSummary {
  subtotalInr: number;
  contingencyInr: number;
  totalInr: number;
}

export interface SensorReadings {
  cameraConfidence: number; // 0..100
  thermalMatch: boolean;
  co2Elevated: boolean;
  audioDetected: boolean;
  heartbeatDetected: boolean;
  bpm: number | null;
}

export interface VictimPriorityResult {
  priorityRank: 1 | 2 | 3;
  priorityTitle: string;
  markerColor: 'green' | 'amber';
  statusHeadline: string;
  guidance: string;
  evidenceScore: number; // 0..100 concept score
}

export const NO_VITAL_SIGN_LABEL = 'NO VITAL SIGN DETECTED, UNCONFIRMED';
export const OPERATOR_DECISION_NOTICE = 'Operator makes the final decision. The AI never declares a death.';

export const DEFAULT_PARTS_DATA: SaraPartsData = fallbackPartsJson as SaraPartsData;

/**
 * Fetches ./parts.json at runtime so editing parts.json updates the 3D model,
 * part inspector, specs, and BOM immediately without rebuilding.
 * Falls back cleanly to bundled JSON if opened from file:// or offline.
 */
export async function loadPartsData(): Promise<SaraPartsData> {
  try {
    const response = await fetch('./parts.json', { cache: 'no-store' });
    if (!response.ok) {
      return DEFAULT_PARTS_DATA;
    }
    const parsed = (await response.json()) as SaraPartsData;
    if (!parsed?.dimensions?.segments?.length || !parsed?.bom?.groups?.length) {
      return DEFAULT_PARTS_DATA;
    }
    return parsed;
  } catch {
    return DEFAULT_PARTS_DATA;
  }
}

/**
 * Computes exact axial placement of all 9 SARA segments from parts.json.
 * Scale: 1 Three.js world unit = 100 mm (so 707 mm = 7.07 units).
 * Head sits toward -X and Tail Bay sits toward +X, centered at X = 0.
 */
export function computeSegmentLayout(
  segments: SegmentDimension[]
): { totalLengthMm: number; totalMassG: number; placements: ComputedSegmentPlacement[] } {
  const totalLengthMm = segments.reduce((sum, seg) => sum + seg.lengthMm, 0);
  const totalMassG = segments.reduce((sum, seg) => sum + seg.massG, 0);
  const halfLen = totalLengthMm / 2;

  let cursorMm = 0;
  const placements: ComputedSegmentPlacement[] = segments.map((seg) => {
    const startMm = cursorMm;
    const endMm = cursorMm + seg.lengthMm;
    const centerMm = startMm + seg.lengthMm / 2;
    cursorMm = endMm;
    return {
      id: seg.id,
      label: seg.label,
      type: seg.type,
      lengthMm: seg.lengthMm,
      startMm,
      endMm,
      centerMm,
      centerX: (centerMm - halfLen) / 100,
      lengthUnits: seg.lengthMm / 100,
    };
  });

  return { totalLengthMm, totalMassG, placements };
}

/**
 * Computes smooth exploded axial offsets for each segment (0 = assembled, 1 = fully exploded).
 */
export function computeExplodedCenters(
  placements: ComputedSegmentPlacement[],
  explodeFactor: number,
  gapPerBoundaryUnits = 0.42
): number[] {
  const clamped = Math.max(0, Math.min(1, explodeFactor));
  const midIndex = (placements.length - 1) / 2;
  return placements.map((p, idx) => p.centerX + (idx - midIndex) * gapPerBoundaryUnits * clamped);
}

/**
 * Computes Bill of Materials subtotal, contingency (rounded to nearest rupee), and total.
 */
export function computeBomTotals(groups: BomGroup[], contingencyPercent: number): BomSummary {
  const subtotalInr = groups.reduce((acc, g) => acc + g.costInr, 0);
  const contingencyInr = Math.round((subtotalInr * contingencyPercent) / 100);
  const totalInr = subtotalInr + contingencyInr;
  return { subtotalInr, contingencyInr, totalInr };
}

/**
 * Filters parts list based on whether the future Heartbeat module is toggled on.
 */
export function getVisibleParts(parts: PartSpec[], includeHeartbeat: boolean): PartSpec[] {
  return parts.filter((part) => includeHeartbeat || !part.isHeartbeat);
}

/**
 * Evaluates the concept-simulation rescue priority logic for a detected subject.
 * Strict honesty & safety wording rules:
 * 1) Heartbeat detected (when module enabled) + supporting evidence -> Priority 1, rescue first (green).
 * 2) Other evidence only (heat, CO2, sound, camera) without heartbeat -> Priority 2, high priority, re-check (amber).
 * 3) No vital sign detected -> Priority 3, "NO VITAL SIGN DETECTED, UNCONFIRMED" (amber, never "dead").
 */
export function evaluateRescuePriority(
  readings: SensorReadings,
  heartbeatModuleEnabled: boolean
): VictimPriorityResult {
  const hasOtherEvidence =
    readings.thermalMatch ||
    readings.co2Elevated ||
    readings.audioDetected ||
    readings.cameraConfidence >= 40;

  let baseScore = 0;
  if (readings.cameraConfidence >= 40) baseScore += Math.round(readings.cameraConfidence * 0.25);
  if (readings.thermalMatch) baseScore += 22;
  if (readings.co2Elevated) baseScore += 18;
  if (readings.audioDetected) baseScore += 15;

  if (heartbeatModuleEnabled && readings.heartbeatDetected) {
    const score = Math.min(99, baseScore + 25);
    return {
      priorityRank: 1,
      priorityTitle: 'Priority 1 — Rescue First',
      markerColor: 'green',
      statusHeadline: readings.bpm
        ? `HEARTBEAT DETECTED (~${Math.round(readings.bpm)} BPM)`
        : 'HEARTBEAT DETECTED',
      guidance: 'Confirmed by heartbeat plus multi-sensor evidence. Operator makes final decision.',
      evidenceScore: score,
    };
  }

  if (hasOtherEvidence) {
    const score = Math.min(82, Math.max(35, baseScore));
    return {
      priorityRank: 2,
      priorityTitle: 'Priority 2 — High Priority, Re-check',
      markerColor: 'amber',
      statusHeadline: heartbeatModuleEnabled
        ? `OTHER EVIDENCE ONLY — ${NO_VITAL_SIGN_LABEL}`
        : 'MULTI-SENSOR EVIDENCE (HEARTBEAT MODULE OFF)',
      guidance: heartbeatModuleEnabled
        ? 'Heat, CO2, sound, or camera evidence present without confirmed pulse. Weak pulse can be missed through rubble — re-check.'
        : 'Camera, thermal, CO2, and sound evidence detected. Toggle concept heartbeat module to preview future vital-sign triage.',
      evidenceScore: score,
    };
  }

  return {
    priorityRank: 3,
    priorityTitle: 'Priority 3 — Lowest Priority, Re-check Later',
    markerColor: 'amber',
    statusHeadline: NO_VITAL_SIGN_LABEL,
    guidance: 'A weak pulse can be missed through rubble. Re-check later — AI never declares a death.',
    evidenceScore: Math.min(28, baseScore),
  };
}

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
