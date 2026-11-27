import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkSphereAABBCollision,
  createInitialBallState,
  stepBallPhysics,
  calculateJumpReach,
  NORMAL_PHYSICS,
  HARD_PHYSICS,
  BALL_RADIUS,
  platformTopAt,
} from './physics';
import { createInitialGeneratorState, generateNextSegments, populateTrack } from './trackGenerator';
import { TrackSegment } from './types';

test('checkSphereAABBCollision detects direct hit and safe distance', () => {
  // Box at center (0, 0, 10), dimensions: 2x2x2 -> bounds: [-1, 1], [-1, 1], [9, 11]
  const box = {
    minX: -1, maxX: 1,
    minY: -1, maxY: 1,
    minZ: 9, maxZ: 11,
  };

  // Ball at (0, 0, 9.5) -> inside box
  assert.equal(
    checkSphereAABBCollision(0, 0, 9.5, BALL_RADIUS, box.minX, box.maxX, box.minY, box.maxY, box.minZ, box.maxZ),
    true
  );

  // Ball at (0, 0, 8.5) -> radius 0.6 touches 9.0 (dist 0.5 < 0.6)
  assert.equal(
    checkSphereAABBCollision(0, 0, 8.5, BALL_RADIUS, box.minX, box.maxX, box.minY, box.maxY, box.minZ, box.maxZ),
    true
  );

  // Ball at (3, 0, 10) -> well clear horizontally
  assert.equal(
    checkSphereAABBCollision(3, 0, 10, BALL_RADIUS, box.minX, box.maxX, box.minY, box.maxY, box.minZ, box.maxZ),
    false
  );
});

test('Ball advances forward and remains grounded on flat platform', () => {
  const ball = createInitialBallState();
  const flatSegment: TrackSegment = {
    id: 'seg-1',
    type: 'straight',
    x: 0,
    y: 0,
    z: 50,
    width: 10,
    length: 120,
    height: 1.2,
    obstacles: [],
    boosters: [],
  };

  const dt = 0.016;
  const result = stepBallPhysics(ball, 0, 1.0, NORMAL_PHYSICS, [flatSegment], dt);

  assert.equal(result.ball.alive, true);
  assert.equal(result.ball.grounded, true);
  assert.ok(result.ball.z > ball.z, 'Ball moved forward in Z');
  assert.equal(result.ball.y, BALL_RADIUS + flatSegment.height / 2, 'Ball stands on top of platform');
});

test('Ball steers left and right continuously with acceleration and damping', () => {
  const ball = createInitialBallState();
  const flatSegment: TrackSegment = {
    id: 'seg-1',
    type: 'straight',
    x: 0,
    y: 0,
    z: 50,
    width: 20,
    length: 120,
    height: 1.2,
    obstacles: [],
    boosters: [],
  };

  // Steer right with input = 1
  let current = ball;
  for (let i = 0; i < 10; i++) {
    const res = stepBallPhysics(current, 1.0, 1.0, NORMAL_PHYSICS, [flatSegment], 0.016);
    current = res.ball;
  }
  assert.ok(current.vx < 0, 'Screen right is negative world X');
  assert.ok(current.x < 0, 'Ball position moved right');

  const left = stepBallPhysics(ball, -1, 1, NORMAL_PHYSICS, [flatSegment], 0.016);
  assert.ok(left.ball.x > 0, 'Screen left is positive world X');

  // Release input (input = 0) -> velocity dampens
  const speedBefore = current.vx;
  for (let i = 0; i < 15; i++) {
    const res = stepBallPhysics(current, 0, 1.0, NORMAL_PHYSICS, [flatSegment], 0.016);
    current = res.ball;
  }
  assert.ok(Math.abs(current.vx) < Math.abs(speedBefore), 'Lateral velocity decayed after input released');
});

test('Ball rolls off edge into void if steered too far sideways (no invisible walls)', () => {
  const ball = createInitialBallState();
  // Narrow platform from x = -2 to +2
  const narrowSegment: TrackSegment = {
    id: 'seg-narrow',
    type: 'narrow',
    x: 0,
    y: 0,
    z: 50,
    width: 4,
    length: 120,
    height: 1.2,
    obstacles: [],
    boosters: [],
  };

  // Ball position placed beyond the platform edge at x = 3.5
  ball.x = 3.5;
  ball.grounded = false;

  let current = ball;
  let fell = false;
  // Step multiple frames under gravity
  for (let i = 0; i < 40; i++) {
    const res = stepBallPhysics(current, 0, 1.0, NORMAL_PHYSICS, [narrowSegment], 0.03);
    current = res.ball;
    if (res.fellInVoid || !current.alive) {
      fell = true;
      break;
    }
  }

  assert.equal(current.grounded, false, 'Ball not grounded off the edge');
  assert.ok(current.vy < 0, 'Ball is in free fall with downward velocity');
});

test('calculateJumpReach calculates ballistic clearance properly', () => {
  // Speed 30 m/s, launch angle vy = 8 m/s, drop height = 2m
  const reach = calculateJumpReach(30, 8, 2);
  assert.ok(reach > 20, 'Jump reaches at least 20 meters with boost and ramp');
});


test('Both modes keep the ball supported across the starting runway and first seam', () => {
  for (const mode of ['normal', 'hard'] as const) {
    const params = mode === 'normal' ? NORMAL_PHYSICS : HARD_PHYSICS;
    for (const dt of [1 / 144, 1 / 60, 1 / 20]) {
      const segments = populateTrack([], createInitialGeneratorState(mode, 3), 0);
      let ball = createInitialBallState();
      ball.vz = params.baseSpeed;
      while (ball.z < 78) {
        ball = stepBallPhysics(ball, 0, 1, params, segments, dt).ball;
        assert.ok(ball.alive && ball.grounded);
        const support = segments.find(seg => seg.id === ball.onPlatformId)!;
        assert.ok(Math.abs(ball.y - ball.radius - platformTopAt(support, ball.z)) < 1e-6);
      }
    }
  }
});

test('Ramps launch at the lip and reach the landing with or without the speed pad', () => {
  for (const mode of ['normal', 'hard'] as const) {
    const state = createInitialGeneratorState(mode, 95);
    let sections: TrackSegment[];
    do { sections = generateNextSegments(state); } while (!sections[0].hasRamp);
    const [ramp, landing] = sections;
    const params = mode === 'normal' ? NORMAL_PHYSICS : HARD_PHYSICS;
    const lip = ramp.z + ramp.length / 2;
    for (const offset of [0, ramp.width * 0.42]) {
      for (const dt of [1 / 144, 1 / 60, 1 / 20]) {
        let ball = createInitialBallState();
        ball.x = ramp.x + offset;
        ball.z = ramp.z - ramp.length / 2;
        ball.vz = params.baseSpeed;
        let launches = 0;
        while (ball.alive && ball.z < landing.z + landing.length / 2) {
          const step = stepBallPhysics(ball, 0, 1, params, sections, dt);
          ball = step.ball;
          if (step.jumpTriggered) {
            launches++;
            assert.ok(ball.z >= lip);
          }
          if (ball.z < lip) assert.ok(ball.grounded);
          if (ball.onPlatformId === landing.id) break;
        }
        assert.equal(launches, 1);
        assert.equal(ball.onPlatformId, landing.id);
      }
    }
  }
});

test('A ball below the deck cannot snap onto the track from underneath', () => {
  const segments = generateNextSegments(createInitialGeneratorState('normal', 1));
  const ball = createInitialBallState();
  ball.y = -0.4;
  ball.vy = -2;
  ball.grounded = false;
  const step = stepBallPhysics(ball, 0, 1, NORMAL_PHYSICS, segments, 0.05);
  assert.ok(!step.ball.grounded && step.ball.y < ball.y);
});
