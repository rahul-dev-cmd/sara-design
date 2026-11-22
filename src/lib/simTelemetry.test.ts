import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TELEMETRY_WINDOW_SEC,
  pushTelemetrySample,
  sampleConceptTelemetry,
  seedTelemetryHistory,
} from './simTelemetry';

test('pushTelemetrySample enforces a strict 10-second sliding window with relSec in [-10, 0]', () => {
  let history = [] as ReturnType<typeof pushTelemetrySample>;

  for (let t = 0; t <= 14; t += 0.5) {
    const sample = sampleConceptTelemetry(0.3 + t * 0.02, t, false);
    history = pushTelemetrySample(history, sample, TELEMETRY_WINDOW_SEC);
  }

  assert.ok(history.length > 0, 'history should contain recent points');
  assert.equal(history[history.length - 1].timeSec, 14);
  assert.equal(history[history.length - 1].relSec, 0);
  assert.ok(history[0].timeSec >= 4, 'points older than 10 seconds must be pruned');
  assert.ok(history[0].relSec >= -10 && history[0].relSec <= 0);

  for (let i = 1; i < history.length; i++) {
    assert.ok(
      history[i].timeSec > history[i - 1].timeSec,
      'samples must remain strictly chronological'
    );
    assert.ok(
      history[i].relSec > history[i - 1].relSec,
      'relative timestamps must increase monotonically toward 0s'
    );
  }
});

test('evidence score rises cleanly near Person A and reflects Heartbeat toggle cap rules', () => {
  const corridorEntry = sampleConceptTelemetry(0.18, 2.0, false);
  const personANoHb = sampleConceptTelemetry(0.56, 8.0, false);
  const personAWithHb = sampleConceptTelemetry(0.56, 8.0, true);

  assert.ok(
    personANoHb.evidenceScore > corridorEntry.evidenceScore + 40,
    'evidence score must climb substantially as SARA approaches Person A'
  );
  assert.ok(
    personANoHb.evidenceScore <= 82,
    'without heartbeat module, concept evidence score stays capped at 82'
  );
  assert.equal(personANoHb.heartbeatScore, null);

  assert.ok(
    personAWithHb.evidenceScore > personANoHb.evidenceScore,
    'enabling heartbeat module near Person A boosts evidence score'
  );
  assert.ok(personAWithHb.heartbeatScore !== null && personAWithHb.heartbeatScore > 80);
  assert.ok(personAWithHb.bpm !== null && personAWithHb.bpm >= 68 && personAWithHb.bpm <= 80);
});

test('Person B pocket keeps thermal/CO2/heartbeat low and never fabricates a pulse', () => {
  const personB = sampleConceptTelemetry(0.86, 12.0, true);
  assert.equal(personB.bpm, null, 'Person B must never report a detected BPM');
  assert.ok(personB.heartbeatScore !== null && personB.heartbeatScore < 20);
  assert.ok(personB.evidenceScore < 45, 'Person B evidence remains low / unconfirmed');
});

test('seedTelemetryHistory generates ordered non-empty trail ending at relSec = 0', () => {
  const seeded = seedTelemetryHistory(0.46, 6.0, true, 1, 5.0, 0.25);
  assert.ok(seeded.length >= 15);
  assert.equal(seeded[seeded.length - 1].relSec, 0);
  assert.ok(seeded[0].relSec >= -10 && seeded[0].relSec < 0);
});
