import { BallPhysics, TrackSegment, ObstacleData, BoosterData } from './types';

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
  dt: number
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
    const targetVx = inputAxis * params.lateralSpeed * sensitivity * controlMultiplier;

    if (Math.abs(inputAxis) > 0.02) {
      // Accelerating in direction of input
      const accel = params.lateralAccel * controlMultiplier;
      ball.vx += (targetVx - ball.vx) * Math.min(1, accel * subDt);
    } else {
      // Decelerating smoothly
      ball.vx *= Math.pow(params.lateralDamping, subDt * 60);
      if (Math.abs(ball.vx) < 0.05) ball.vx = 0;
    }

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

    // 3. Platform surface detection with swept vertical collision
    let foundGround = false;
    let groundY = -999;
    let groundSegmentId: string | null = null;

    // Check candidate platforms under the ball
    for (const seg of segments) {
      const halfLength = seg.length / 2;
      const minZ = seg.z - halfLength;
      const maxZ = seg.z + halfLength;

      // Generous Z overlap to prevent any seam gaps between segments
      const zOverlap = 0.8;
      if (ball.z >= minZ - zOverlap && ball.z <= maxZ + zOverlap) {
        // Platform X boundaries
        const halfWidth = seg.width / 2;
        const minX = seg.x - halfWidth;
        const maxX = seg.x + halfWidth;

        // Check if ball is horizontally on the platform (plus slight tolerance)
        if (ball.x >= minX - 0.05 && ball.x <= maxX + 0.05) {
          // Surface height calculation
          let surfaceY = seg.y + seg.height / 2;

          // If segment is a ramp, compute slope height at this Z
          if (seg.hasRamp && seg.rampAngle) {
            const relZ = Math.max(0, Math.min(1, (ball.z - minZ) / seg.length));
            const rampRise = Math.tan(seg.rampAngle) * (relZ * seg.length);
            surfaceY += rampRise;
          }

          const prevBottom = prevY - ball.radius;
          const currentBottom = ball.y - ball.radius;

          // Continuous swept collision:
          // 1) Ball was at or above surface and crossed down into/through surface
          // 2) OR ball was grounded and riding slightly bumpy seams
          // 3) OR ball is falling onto landing pad at high speed
          const crossedSurface = (prevBottom >= surfaceY - 0.25 && currentBottom <= surfaceY + 0.35);
          const ridingSurface = (ball.grounded && Math.abs(currentBottom - surfaceY) < 0.65);
          const fallingOntoSurface = (ball.vy <= 0 && currentBottom <= surfaceY + 0.25 && currentBottom >= surfaceY - 3.5);

          if ((crossedSurface || ridingSurface || fallingOntoSurface) && ball.vy <= 3.0) {
            foundGround = true;
            groundY = Math.max(groundY, surfaceY + ball.radius);
            groundSegmentId = seg.id;

            // Check ramp launch at the end of a ramp segment
            if (seg.hasRamp && seg.rampAngle && (maxZ - ball.z) < 1.2) {
              // Upward ballistic impulse launch
              ball.vy = Math.max(ball.vy, ball.vz * Math.sin(seg.rampAngle) * 0.95 + 4.5);
              foundGround = false;
              jumpTriggered = true;
            }

            // Check boosters on this segment
            for (const b of seg.boosters) {
              const bMinZ = b.z - b.depth / 2 - 0.5;
              const bMaxZ = b.z + b.depth / 2 + 0.5;
              const bMinX = b.x - b.width / 2 - 0.2;
              const bMaxX = b.x + b.width / 2 + 0.2;

              if (ball.z >= bMinZ && ball.z <= bMaxZ && ball.x >= bMinX && ball.x <= bMaxX) {
                ball.boostTimer = 2.4;
                ball.vz = Math.max(ball.vz, rampedBaseSpeed * b.boostFactor);
                if (b.jumpImpulse) {
                  ball.vy = Math.max(ball.vy, b.jumpImpulse);
                  foundGround = false;
                  jumpTriggered = true;
                }
                boostTriggered = true;
              }
            }

            break;
          }
        }
      }
    }

    if (foundGround) {
      ball.grounded = true;
      ball.y = groundY;
      ball.vy = 0;
      ball.onPlatformId = groundSegmentId;
    } else {
      ball.grounded = false;
      ball.onPlatformId = null;
    }

    // 4. Obstacle collision detection
    for (const seg of segments) {
      if (Math.abs(seg.z - ball.z) > seg.length + 5) continue;

      for (const obs of seg.obstacles) {
        // Calculate dynamic obstacle bounds if moving
        let currentObsX = obs.x;
        if (obs.type === 'moving_horizontal' && obs.speed !== undefined && obs.phase !== undefined) {
          const t = Date.now() / 1000 * obs.speed + obs.phase;
          const pingPong = Math.sin(t);
          currentObsX = obs.x + pingPong * ((obs.maxX - obs.minX) / 2);
        }

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
