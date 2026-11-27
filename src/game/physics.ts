import { BallPhysics, TrackSegment, ObstacleData } from './types';

export const GRAVITY = 32; // m/s² for snappy responsive arcade physics
export const BALL_RADIUS = 0.6;
export const PLATFORM_HEIGHT = 1.2;
export const PLATFORM_TOP_Y = PLATFORM_HEIGHT / 2; // 0.6
export const INITIAL_BALL_Y = PLATFORM_TOP_Y + BALL_RADIUS; // 1.2
export const FALL_KILL_Y = -22;

export interface PhysicsParams {
  baseSpeed: number;
  maxSpeed: number;
  speedRampRate: number; // speed increase per 100 meters
  lateralSpeed: number;
  lateralAccel: number;
  lateralDamping: number;
  airControlFactor: number;
}

export const NORMAL_PHYSICS: PhysicsParams = {
  baseSpeed: 24,
  maxSpeed: 42,
  speedRampRate: 0.65,
  lateralSpeed: 14,
  lateralAccel: 28,
  lateralDamping: 0.82,
  airControlFactor: 0.42,
};

export const HARD_PHYSICS: PhysicsParams = {
  baseSpeed: 32,
  maxSpeed: 54,
  speedRampRate: 1.1,
  lateralSpeed: 17,
  lateralAccel: 34,
  lateralDamping: 0.84,
  airControlFactor: 0.38,
};

export function createInitialBallState(): BallPhysics {
  return {
    x: 0,
    y: INITIAL_BALL_Y, // 1.2 - sits right on top of platform (0.6 + 0.6)
    z: 0,
    vx: 0,
    vy: 0,
    vz: NORMAL_PHYSICS.baseSpeed,
    pitch: 0,
    roll: 0,
    yaw: 0,
    radius: BALL_RADIUS,
    grounded: true,
    onPlatformId: null,
    boostTimer: 0,
    alive: true,
    causeOfDeath: null,
  };
}

/**
 * Checks sphere-AABB intersection
 */
export function checkSphereAABBCollision(
  sphereX: number,
  sphereY: number,
  sphereZ: number,
  radius: number,
  boxMinX: number,
  boxMaxX: number,
  boxMinY: number,
  boxMaxY: number,
  boxMinZ: number,
  boxMaxZ: number
): boolean {
  const closestX = Math.max(boxMinX, Math.min(sphereX, boxMaxX));
  const closestY = Math.max(boxMinY, Math.min(sphereY, boxMaxY));
  const closestZ = Math.max(boxMinZ, Math.min(sphereZ, boxMaxZ));

  const dx = sphereX - closestX;
  const dy = sphereY - closestY;
  const dz = sphereZ - closestZ;

  return dx * dx + dy * dy + dz * dz < radius * radius;
}

export function platformTopAt(seg: TrackSegment, z: number): number {
  const along = Math.max(0, Math.min(seg.length, z - (seg.z - seg.length / 2)));
  return seg.y + seg.height / 2 + along * Math.tan(seg.rampAngle ?? 0);
}

export function obstacleXAt(obs: ObstacleData, time: number): number {
  if (obs.type !== 'moving_horizontal') return obs.x;
  const phase = time * (obs.speed ?? 0) + (obs.phase ?? 0);
  return obs.x + Math.sin(phase) * (obs.maxX - obs.minX) / 2;
}

export function rampLaunchSpeed(forwardSpeed: number, angle: number): number {
  return forwardSpeed * Math.sin(angle) * 0.95 + 4.5;
}

export interface StepPhysicsResult {
  ball: BallPhysics;
  boostTriggered: boolean;
  jumpTriggered: boolean;
  hitObstacle: boolean;
  fellInVoid: boolean;
}

/**
 * Pure physics update function with sub-stepping for anti-tunneling
 */
export function stepBallPhysics(
  currentBall: BallPhysics,
  inputAxis: number, // -1 to +1
  sensitivity: number,
  params: PhysicsParams,
  segments: TrackSegment[],
  dt: number,
  time = 0 // simulation time at the end of this frame, in seconds
): StepPhysicsResult {
  if (!currentBall.alive) {
    return {
      ball: currentBall,
      boostTriggered: false,
      jumpTriggered: false,
      hitObstacle: false,
      fellInVoid: false,
    };
  }

  // Clone ball state to avoid mutation of input
  const ball: BallPhysics = { ...currentBall };
  let boostTriggered = false;
  let jumpTriggered = false;
  let hitObstacle = false;
  let fellInVoid = false;

  // Clamped dt
  const clampedDt = Math.min(dt, 0.05);

  // Calculate forward target speed based on distance traveled and boost
  const distance = Math.max(0, ball.z);
  const rampedBaseSpeed = Math.min(
    params.maxSpeed,
    params.baseSpeed + (distance / 100) * params.speedRampRate
  );

  let targetForwardSpeed = rampedBaseSpeed;
  if (ball.boostTimer > 0) {
    targetForwardSpeed *= 1.35;
    ball.boostTimer = Math.max(0, ball.boostTimer - clampedDt);
  }

  // Smoothly adjust forward velocity vz towards target speed
  ball.vz += (targetForwardSpeed - ball.vz) * Math.min(1, clampedDt * 4);

  // Sub-stepping for collision stability: 3 sub-steps per frame
  const subSteps = 3;
  const subDt = clampedDt / subSteps;

  for (let s = 0; s < subSteps; s++) {
    // 1. Lateral steering logic
    const controlMultiplier = ball.grounded ? 1.0 : params.airControlFactor;
    // Looking along +Z, screen right points toward world -X.
    const targetVx = -inputAxis * params.lateralSpeed * sensitivity * controlMultiplier;

    if (Math.abs(inputAxis) > 0.02) {
      // Accelerating in direction of input
      const accel = params.lateralAccel * controlMultiplier;
      ball.vx += (targetVx - ball.vx) * Math.min(1, accel * subDt);
    } else {
      // Decelerating smoothly
      ball.vx *= Math.pow(params.lateralDamping, subDt * 60);
      if (Math.abs(ball.vx) < 0.05) ball.vx = 0;
    }

    const prevX = ball.x;
    const prevY = ball.y;
    const prevZ = ball.z;

    // 2. Vertical gravity
    if (!ball.grounded) {
      ball.vy -= GRAVITY * subDt;
    }

    // Advance position
    ball.x += ball.vx * subDt;
    ball.y += ball.vy * subDt;
    ball.z += ball.vz * subDt;

    // Ball rotation: rolling corresponds to actual distance traveled
    ball.pitch += (ball.vz * subDt) / ball.radius;
    ball.roll -= (ball.vx * subDt) / ball.radius;
    ball.yaw = -ball.vx * 0.04; // subtle lean into turns

    // Resolve the floor against the same footprint and slope used for drawing.
    const previousSupport = ball.onPlatformId;
    ball.grounded = false;
    ball.onPlatformId = null;

    for (const seg of segments) {
      const start = seg.z - seg.length / 2;
      const end = seg.z + seg.length / 2;

      if (seg.rampAngle && previousSupport === seg.id && prevZ <= end && ball.z > end) {
        const fraction = (end - prevZ) / (ball.z - prevZ);
        const lipX = prevX + (ball.x - prevX) * fraction;
        if (Math.abs(lipX - seg.x) <= seg.width / 2) {
          ball.vy = rampLaunchSpeed(ball.vz, seg.rampAngle);
          ball.y = platformTopAt(seg, end) + ball.radius + ball.vy * subDt * (1 - fraction);
          jumpTriggered = true;
          break;
        }
      }

      if (ball.z < start || ball.z >= end || Math.abs(ball.x - seg.x) > seg.width / 2) continue;
      const top = platformTopAt(seg, ball.z);
      const previousTop = platformTopAt(seg, prevZ);
      const epsilon = 1e-6;
      if (ball.vy > 0 || prevY - ball.radius < previousTop - epsilon ||
          ball.y - ball.radius > top + epsilon) continue;

      ball.y = top + ball.radius;
      ball.vy = 0;
      ball.grounded = true;
      ball.onPlatformId = seg.id;

      for (const pad of seg.boosters) {
        if (Math.abs(ball.z - pad.z) > pad.depth / 2 || Math.abs(ball.x - pad.x) > pad.width / 2) continue;
        boostTriggered ||= ball.boostTimer === 0;
        ball.boostTimer = 2.4;
        ball.vz = Math.max(ball.vz, rampedBaseSpeed * pad.boostFactor);
        if (pad.jumpImpulse) {
          ball.vy = pad.jumpImpulse;
          ball.grounded = false;
          ball.onPlatformId = null;
          jumpTriggered = true;
        }
      }
      break;
    }

    // 4. Obstacle collision detection
    for (const seg of segments) {
      if (Math.abs(seg.z - ball.z) > seg.length + 5) continue;

      for (const obs of seg.obstacles) {
        const currentObsX = obstacleXAt(obs, time - (subSteps - 1 - s) * subDt);

        const halfW = obs.width / 2;
        const halfH = obs.height / 2;
        const halfD = obs.depth / 2;

        const boxMinX = currentObsX - halfW;
        const boxMaxX = currentObsX + halfW;
        const boxMinY = obs.y - halfH;
        const boxMaxY = obs.y + halfH;
        const boxMinZ = obs.z - halfD;
        const boxMaxZ = obs.z + halfD;

        if (
          checkSphereAABBCollision(
            ball.x,
            ball.y,
            ball.z,
            ball.radius * 0.9, // slightly forgiving collision cylinder/sphere
            boxMinX,
            boxMaxX,
            boxMinY,
            boxMaxY,
            boxMinZ,
            boxMaxZ
          )
        ) {
          hitObstacle = true;
          ball.alive = false;
          ball.causeOfDeath = 'obstacle';
          break;
        }
      }
      if (!ball.alive) break;
    }
    if (!ball.alive) break;

    // 5. Fall into void detection
    if (ball.y < FALL_KILL_Y) {
      fellInVoid = true;
      ball.alive = false;
      ball.causeOfDeath = 'fall';
      break;
    }
  }

  return {
    ball,
    boostTriggered,
    jumpTriggered,
    hitObstacle,
    fellInVoid,
  };
}

/**
 * Computes ballistic distance reach for a jump over a gap
 */
export function calculateJumpReach(
  forwardSpeed: number,
  verticalSpeed: number,
  dropHeight: number
): number {
  // y(t) = y0 + vy * t - 0.5 * g * t^2 = y0 - dropHeight
  // 0.5 * g * t^2 - vy * t - dropHeight = 0
  const a = 0.5 * GRAVITY;
  const b = -verticalSpeed;
  const c = -dropHeight;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return 0;
  const flightTime = (-b + Math.sqrt(discriminant)) / (2 * a);
  return forwardSpeed * flightTime;
}
