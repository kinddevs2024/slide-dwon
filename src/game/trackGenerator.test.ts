import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialGeneratorState,
  generateNextSegments,
  populateTrack,
} from './trackGenerator';

test('Initial segments in safe zone have no obstacles and wide platform', () => {
  const state = createInitialGeneratorState('normal', 12345);
  const seg1 = generateNextSegments(state)[0];
  const seg2 = generateNextSegments(state)[0];

  assert.equal(seg1.obstacles.length, 0, 'First segment has no obstacles');
  assert.equal(seg2.obstacles.length, 0, 'Second segment in safe zone has no obstacles');
  assert.ok(seg1.width >= 10, 'First segment is wide for safe starting');
});

test('Obstacles in obstacle segments leave passable clearance for ball', () => {
  const state = createInitialGeneratorState('normal', 54321);
  state.nextZ = 120; // past safe zone

  let testedObstacle = false;
  for (let i = 0; i < 25; i++) {
    const segs = generateNextSegments(state);
    for (const seg of segs) {
      if (seg.obstacles.length > 0) {
        testedObstacle = true;
        for (const obs of seg.obstacles) {
          // Platform left and right edges
          const platMinX = seg.x - seg.width / 2;
          const platMaxX = seg.x + seg.width / 2;
          const leftClearance = (obs.x - obs.width / 2) - platMinX;
          const rightClearance = platMaxX - (obs.x + obs.width / 2);

          // At least one side must be passable (>= 2.4m)
          const passable = leftClearance >= 2.4 || rightClearance >= 2.4;
          assert.ok(
            passable,
            `Obstacle at z=${obs.z} must leave a passable corridor (left: ${leftClearance.toFixed(2)}, right: ${rightClearance.toFixed(2)})`
          );
        }
      }
    }
  }
  assert.ok(testedObstacle, 'Found obstacle segments to test');
});

test('populateTrack maintains lookahead and recycles passed segments', () => {
  const state = createInitialGeneratorState('normal', 999);
  let segments = populateTrack([], state, 0, 200);

  assert.ok(segments.length > 3, 'Populated initial segments');
  const lastSeg = segments[segments.length - 1];
  const maxExtent = lastSeg.z + lastSeg.length / 2;
  assert.ok(maxExtent >= 200, `Track extent (${maxExtent}) should reach at least 200m`);

  // Move player forward progressively to 400m
  for (let p = 50; p <= 400; p += 50) {
    segments = populateTrack(segments, state, p, 200);
  }
  const oldestSeg = segments[0];
  assert.ok(oldestSeg.z + oldestSeg.length / 2 >= 355, 'Passed segments behind player were cleaned up');
  const newLastSeg = segments[segments.length - 1];
  assert.ok(newLastSeg.z + newLastSeg.length / 2 >= 600, 'Generated forward to at least 600m');
});

test('Hard mode generates narrower platforms than Normal mode', () => {
  const stateNormal = createInitialGeneratorState('normal', 111);
  const stateHard = createInitialGeneratorState('hard', 111);

  // Advance past safe runway
  stateNormal.nextZ = 100;
  stateHard.nextZ = 100;

  let totalWidthNormal = 0;
  let countNormal = 0;
  let totalWidthHard = 0;
  let countHard = 0;

  for (let i = 0; i < 10; i++) {
    for (const s of generateNextSegments(stateNormal)) {
      totalWidthNormal += s.width;
      countNormal++;
    }
    for (const s of generateNextSegments(stateHard)) {
      totalWidthHard += s.width;
      countHard++;
    }
  }

  assert.ok(
    totalWidthHard / countHard < totalWidthNormal / countNormal,
    `Hard mode average width should be narrower than Normal mode`
  );
});
