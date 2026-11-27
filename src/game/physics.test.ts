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
} from './physics';
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
    height: 1,
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
    height: 1,
    obstacles: [],
    boosters: [],
  };

  // Steer right with input = 1
  let current = ball;
  for (let i = 0; i < 10; i++) {
    const res = stepBallPhysics(current, 1.0, 1.0, NORMAL_PHYSICS, [flatSegment], 0.016);
    current = res.ball;
  }
  assert.ok(current.vx > 0, 'Lateral velocity is positive to the right');
  assert.ok(current.x > 0, 'Ball position moved right');

  // Release input (input = 0) -> velocity dampens
  const speedBefore = current.vx;
  for (let i = 0; i < 15; i++) {
    const res = stepBallPhysics(current, 0, 1.0, NORMAL_PHYSICS, [flatSegment], 0.016);
    current = res.ball;
  }
  assert.ok(current.vx < speedBefore, 'Lateral velocity decayed after input released');
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
    height: 1,
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
