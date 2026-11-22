import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PARTS_DATA,
  NO_VITAL_SIGN_LABEL,
  computeBomTotals,
  computeExplodedCenters,
  computeSegmentLayout,
  evaluateRescuePriority,
  getVisibleParts,
} from './saraData';

test('parts.json segment lengths sum exactly to 707 mm and BOM totals match 36,333 INR', () => {
  const layout = computeSegmentLayout(DEFAULT_PARTS_DATA.dimensions.segments);
  assert.equal(layout.totalLengthMm, 707);
  assert.equal(layout.placements.length, 9);
  assert.equal(layout.placements[0].id, 'head');
  assert.equal(layout.placements[8].id, 'tail');

  const bom = computeBomTotals(
    DEFAULT_PARTS_DATA.bom.groups,
    DEFAULT_PARTS_DATA.bom.contingencyPercent
  );
  assert.equal(bom.subtotalInr, 33030);
  assert.equal(bom.contingencyInr, 3303);
  assert.equal(bom.totalInr, 36333);
});

test('updating a single segment length dynamically reflows downstream CAD positions', () => {
  const base = computeSegmentLayout(DEFAULT_PARTS_DATA.dimensions.segments);
  const modifiedSegments = DEFAULT_PARTS_DATA.dimensions.segments.map((seg) =>
    seg.id === 'head' ? { ...seg, lengthMm: 140 } : seg
  );
  const updated = computeSegmentLayout(modifiedSegments);
  assert.equal(updated.totalLengthMm, 727);
  // Head expanded by +20 mm (0.20 units), so total span grows and every segment stays contiguous
  for (let i = 1; i < updated.placements.length; i++) {
    assert.equal(updated.placements[i].startMm, updated.placements[i - 1].endMm);
  }
  assert.notEqual(updated.placements[8].centerX, base.placements[8].centerX);
});

test('explode offsets preserve monotonic axial ordering and return assembled centers at 0', () => {
  const layout = computeSegmentLayout(DEFAULT_PARTS_DATA.dimensions.segments);
  const assembled = computeExplodedCenters(layout.placements, 0);
  const exploded = computeExplodedCenters(layout.placements, 1);

  for (let i = 0; i < layout.placements.length; i++) {
    assert.equal(assembled[i], layout.placements[i].centerX);
    if (i > 0) {
      assert.ok(exploded[i] > exploded[i - 1], 'exploded segments must stay strictly ordered');
      assert.ok(
        exploded[i] - exploded[i - 1] > assembled[i] - assembled[i - 1],
        'exploded spacing must exceed assembled spacing'
      );
    }
  }
});

test('heartbeat toggle cleanly adds and removes the concept vital-sign module', () => {
  const withoutHeartbeat = getVisibleParts(DEFAULT_PARTS_DATA.parts, false);
  const withHeartbeat = getVisibleParts(DEFAULT_PARTS_DATA.parts, true);

  assert.equal(
    withoutHeartbeat.some((p) => p.id === 'heartbeat_module'),
    false
  );
  assert.equal(
    withHeartbeat.some((p) => p.id === 'heartbeat_module'),
    true
  );
  assert.equal(withHeartbeat.length, withoutHeartbeat.length + 1);
});

test('rescue priority logic follows 3-tier rules and never uses the word dead', () => {
  const personAWithHb = evaluateRescuePriority(
    {
      cameraConfidence: 84,
      thermalMatch: true,
      co2Elevated: true,
      audioDetected: true,
      heartbeatDetected: true,
      bpm: 76,
    },
    true
  );
  assert.equal(personAWithHb.priorityRank, 1);
  assert.equal(personAWithHb.markerColor, 'green');
  assert.match(personAWithHb.statusHeadline, /76 BPM/);

  const personAWithoutHb = evaluateRescuePriority(
    {
      cameraConfidence: 84,
      thermalMatch: true,
      co2Elevated: true,
      audioDetected: true,
      heartbeatDetected: true,
      bpm: 76,
    },
    false
  );
  assert.equal(personAWithoutHb.priorityRank, 2);
  assert.equal(personAWithoutHb.markerColor, 'amber');

  const personBNoVital = evaluateRescuePriority(
    {
      cameraConfidence: 20,
      thermalMatch: false,
      co2Elevated: false,
      audioDetected: false,
      heartbeatDetected: false,
      bpm: null,
    },
    true
  );
  assert.equal(personBNoVital.priorityRank, 3);
  assert.equal(personBNoVital.markerColor, 'amber');
  assert.equal(personBNoVital.statusHeadline, NO_VITAL_SIGN_LABEL);
  assert.equal(/\bdead\b/i.test(personBNoVital.statusHeadline), false);
  assert.equal(/\bdead\b/i.test(personBNoVital.guidance), false);
});

test('honesty guardrail: nothing in parts.json claims MEASURED status', () => {
  const jsonText = JSON.stringify(DEFAULT_PARTS_DATA);
  assert.equal(/"status"\s*:\s*"MEASURED"/i.test(jsonText), false);
  assert.match(DEFAULT_PARTS_DATA._comment, /cad\/sara_cad\.py/);
});

test('parts.json specifies CNC brushed Aluminium outer body, visible N20 motors, and internal wiring harness', () => {
  assert.match(DEFAULT_PARTS_DATA.materials.petg.name, /Aluminium/i);
  assert.ok(DEFAULT_PARTS_DATA.materials.petg.metalness >= 0.8);

  const headShell = DEFAULT_PARTS_DATA.parts.find((p) => p.id === 'head_shell');
  const tailShell = DEFAULT_PARTS_DATA.parts.find((p) => p.id === 'tail_shell');
  const motors = DEFAULT_PARTS_DATA.parts.find((p) => p.id === 'n20_motors');
  const wiring = DEFAULT_PARTS_DATA.parts.find((p) => p.id === 'wiring_harness');

  assert.ok(headShell && /Aluminium/i.test(headShell.material));
  assert.ok(tailShell && /Aluminium/i.test(tailShell.material));
  assert.ok(motors && /12/.test(motors.name));
  assert.ok(wiring && /wiring/i.test(wiring.name));
});

