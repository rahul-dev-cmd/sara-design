export interface TelemetrySample {
  /** Monotonic simulation clock in seconds */
  timeSec: number;
  /** Relative offset from latest sample in seconds, in [-10, 0] */
  relSec: number;
  /** Crawl progress along rubble spline, in [0, 1] */
  progress: number;
  /** Composite concept evidence score (0..100) */
  evidenceScore: number;
  /** OV5647 RGB camera match confidence (0..100) */
  cameraScore: number;
  /** MLX90640 thermal signature strength (0..100) */
  thermalScore: number;
  /** MH-Z19B CO2 elevation index (0..100) */
  co2Score: number;
  /** INMP441 acoustic voice/tap confidence (0..100) */
  audioScore: number;
  /** Combined RGB + Audio cue index for clean chart readability (0..100) */
  avScore: number;
  /** Future concept heartbeat confidence (0..100) or null when module is OFF */
  heartbeatScore: number | null;
  /** Concept thermal delta above rubble ambient (°C) */
  thermalDeltaC: number;
  /** Concept CO2 reading (ppm) */
  co2Ppm: number;
  /** Concept heart rate when heartbeat module is ON near Person A */
  bpm: number | null;
}

export const TELEMETRY_WINDOW_SEC = 10;

// Spline progress locations matching Person A (mid pocket) & Person B (far pocket)
const PERSON_A_PROGRESS = 0.56;
const PERSON_B_PROGRESS = 0.86;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function gaussian(x: number, center: number, sigma: number): number {
  const z = (x - center) / sigma;
  return Math.exp(-0.5 * z * z);
}

/**
 * Computes deterministic, continuous concept sensor readings and the resulting
 * Evidence Score (0..100) for a given rubble crawl progress and simulation time.
 *
 * Strictly models the planned concept workflow:
 * - Person A (mid pocket): warm thermal signature, elevated CO2, voice/tap cues,
 *   and optional concept heartbeat signal when the heartbeat module is enabled.
 * - Person B (far pocket): partial visual silhouette only, no elevated thermal/CO2/pulse
 *   ("NO VITAL SIGN DETECTED, UNCONFIRMED" — never declares a death).
 */
export function sampleConceptTelemetry(
  progress: number,
  timeSec: number,
  includeHeartbeat: boolean
): TelemetrySample {
  const p = clamp(progress, 0, 1);

  // Smooth proximity envelopes around Person A and Person B
  const nearA = gaussian(p, PERSON_A_PROGRESS, 0.13);
  const nearACo2 = gaussian(p, PERSON_A_PROGRESS - 0.03, 0.17); // CO2 diffuses slightly wider
  const nearB = gaussian(p, PERSON_B_PROGRESS, 0.09);

  // Subtle deterministic sensor noise so live chart reads like real telemetry
  const n1 = Math.sin(timeSec * 3.1) * 2.1 + Math.cos(timeSec * 7.3) * 1.1;
  const n2 = Math.sin(timeSec * 2.3 + 1.4) * 1.9 + Math.cos(timeSec * 5.7) * 1.0;
  const n3 = Math.sin(timeSec * 1.7 + 2.8) * 1.6;
  const voiceBurst = Math.max(0, Math.sin(timeSec * 2.6)) * 12;

  const cameraScore = Math.round(
    clamp(14 + nearA * 76 + nearB * 24 + n1, 5, 98)
  );

  const thermalScore = Math.round(
    clamp(10 + nearA * 82 + nearB * 8 + n2, 4, 97)
  );

  const co2Score = Math.round(
    clamp(12 + nearACo2 * 78 + nearB * 5 + n3, 6, 95)
  );

  const audioScore = Math.round(
    clamp(8 + nearA * (64 + voiceBurst) + Math.abs(Math.sin(timeSec * 4.9)) * 4, 4, 94)
  );

  const avScore = Math.round((cameraScore * 0.58 + audioScore * 0.42));

  const heartbeatDetected = includeHeartbeat && nearA >= 0.24;
  const heartbeatScore = includeHeartbeat
    ? Math.round(
        clamp(
          4 + nearA * 90 + (heartbeatDetected ? Math.sin(timeSec * 6.8) * 3.5 : Math.sin(timeSec * 2.1) * 1.5),
          0,
          98
        )
      )
    : null;

  // Weighted fusion aligned with evaluateRescuePriority:
  // Without heartbeat module, score caps at 82 (Priority 2 — multi-sensor evidence only).
  // With heartbeat module + pulse, score reaches up to 99 (Priority 1 — rescue first).
  const baseFusion =
    cameraScore * 0.25 +
    thermalScore * 0.27 +
    co2Score * 0.22 +
    audioScore * 0.16;

  const evidenceScore = includeHeartbeat && heartbeatScore !== null
    ? Math.round(clamp(baseFusion * 0.85 + heartbeatScore * 0.27, 8, 99))
    : Math.round(clamp(baseFusion * 0.92, 8, 82));

  const thermalDeltaC = Number(clamp(0.4 + (thermalScore / 100) * 12.2, 0.2, 13.5).toFixed(1));
  const co2Ppm = Math.round(420 + (co2Score / 100) * 780);
  const bpm = heartbeatDetected
    ? Math.round(73 + Math.sin(timeSec * 1.4) * 3)
    : null;

  return {
    timeSec: Number(timeSec.toFixed(2)),
    relSec: 0,
    progress: p,
    evidenceScore,
    cameraScore,
    thermalScore,
    co2Score,
    audioScore,
    avScore,
    heartbeatScore,
    thermalDeltaC,
    co2Ppm,
    bpm,
  };
}

/**
 * Appends a new telemetry sample into a sliding time window (default 10 seconds),
 * pruning expired points and recomputing relative X-axis offsets in [-windowSec, 0].
 */
export function pushTelemetrySample(
  history: TelemetrySample[],
  nextSample: TelemetrySample,
  windowSec = TELEMETRY_WINDOW_SEC
): TelemetrySample[] {
  const cutoff = nextSample.timeSec - windowSec;
  const filtered = history.filter(
    (pt) => pt.timeSec >= cutoff && pt.timeSec < nextSample.timeSec
  );
  const combined = [...filtered, nextSample];
  const latestTime = nextSample.timeSec;

  return combined.map((pt) => ({
    ...pt,
    relSec: Number(clamp(pt.timeSec - latestTime, -windowSec, 0).toFixed(2)),
  }));
}

/**
 * Seeds a short trailing history window so the 10-second telemetry chart renders
 * a meaningful live evolution immediately upon entering Simulate mode.
 */
export function seedTelemetryHistory(
  currentProgress: number,
  currentTimeSec: number,
  includeHeartbeat: boolean,
  simSpeed: number,
  seedSpanSec = 5.0,
  stepSec = 0.25
): TelemetrySample[] {
  const count = Math.max(2, Math.floor(seedSpanSec / stepSec));
  let history: TelemetrySample[] = [];
  const speedRate = 0.055 * simSpeed;

  for (let i = count; i >= 0; i--) {
    const dtBack = i * stepSec;
    const t = Math.max(0, currentTimeSec - dtBack);
    let p = currentProgress - dtBack * speedRate;
    if (p < 0.08) {
      p = 0.08;
    }
    const sample = sampleConceptTelemetry(p, t, includeHeartbeat);
    history = pushTelemetrySample(history, sample, TELEMETRY_WINDOW_SEC);
  }
  return history;
}
