import { TrackSegment, ObstacleData, BoosterData, GameMode } from './types';
import { NORMAL_PHYSICS, HARD_PHYSICS, calculateJumpReach, rampLaunchSpeed, PLATFORM_HEIGHT } from './physics';

export interface GeneratorState {
  nextZ: number;
  currentX: number;
  currentY: number;
  segmentIndex: number;
  mode: GameMode;
  seed: number;
}

export function createInitialGeneratorState(mode: GameMode, seed = Date.now()): GeneratorState {
  return {
    nextZ: 0,
    currentX: 0,
    currentY: 0,
    segmentIndex: 0,
    mode,
    seed,
  };
}

// Pseudo-random helper with seed for deterministic tests if needed
function pseudoRandom(state: GeneratorState): number {
  state.seed = (state.seed * 9301 + 49297) % 233280;
  return state.seed / 233280;
}

export function generateNextSegments(state: GeneratorState): TrackSegment[] {
  const isHard = state.mode === 'hard';
  const phys = isHard ? HARD_PHYSICS : NORMAL_PHYSICS;
  const rand = () => pseudoRandom(state);
  const distance = state.nextZ;

  const segmentId = `seg_${state.segmentIndex++}`;

  // Safe starting stretch (first 70 meters)
  if (distance < 70) {
    const length = 40;
    const behindStart = distance === 0 ? 10 : 0;
    const width = isHard ? 10 : 12;
    const seg: TrackSegment = {
      id: segmentId,
      type: 'straight',
      x: state.currentX,
      y: state.currentY,
      z: state.nextZ + (length - behindStart) / 2,
      width,
      length: length + behindStart,
      height: PLATFORM_HEIGHT,
      obstacles: [],
      boosters: [],
    };

    // Add a gentle booster pad at distance 35 to give exciting early speed feel
    if (distance === 0) {
      seg.boosters.push({
        id: `boost_start`,
        x: 0,
        y: state.currentY + 0.6,
        z: 35,
        width: 3.5,
        depth: 6,
        boostFactor: 1.25,
      });
    }

    state.nextZ += length;
    return [seg];
  }

  // Segment types selection based on distance & mode
  const currentSpeed = Math.min(
    phys.maxSpeed,
    phys.baseSpeed + (distance / 100) * phys.speedRampRate
  );

  // Available segment archetypes
  const r = rand();
  let segType: TrackSegment['type'] = 'straight';

  if (r < 0.22) {
    segType = 'obstacle';
  } else if (r < 0.38) {
    segType = 'narrow';
  } else if (r < 0.52) {
    segType = 'offset';
  } else if (r < 0.68) {
    segType = 'ramp';
  } else if (r < 0.82) {
    segType = 'tunnel';
  } else {
    segType = 'straight';
  }

  const baseWidth = isHard ? 7.5 : 10.5;
  let segWidth = baseWidth;
  let segLength = 40;
  const obstacles: ObstacleData[] = [];
  const boosters: BoosterData[] = [];
  let hasRamp = false;
  let rampAngle = 0;
  let hasTunnel = false;

  // Handle segment archetype construction
  if (segType === 'narrow') {
    segWidth = isHard ? 3.6 : 5.0; // Narrow bridge
    segLength = isHard ? 45 : 35;
  } else if (segType === 'offset') {
    // Smooth lateral shift: targetX shifts left or right by 2 to 4 meters
    const maxShift = isHard ? 4.5 : 3.5;
    const shiftDir = rand() > 0.5 ? 1 : -1;
    const shiftAmount = (1.5 + rand() * (maxShift - 1.5)) * shiftDir;
    // Bound track within [-12, 12] so it doesn't wander infinitely
    let newX = state.currentX + shiftAmount;
    if (newX > 10) newX = 10 - rand() * 3;
    if (newX < -10) newX = -10 + rand() * 3;
    state.currentX = newX;
    segLength = 35;
  } else if (segType === 'ramp') {
    // Ramp launches ball over an upcoming gap!
    hasRamp = true;
    rampAngle = 0.16 + rand() * 0.08; // ~9 to 14 degrees
    segLength = 28;
    // Put a booster on the ramp for thrilling speed
    boosters.push({
      id: `ramp_boost_${state.segmentIndex}`,
      x: state.currentX,
      y: state.currentY + 0.6,
      z: state.nextZ + segLength / 2,
      width: segWidth * 0.6,
      depth: 6,
      boostFactor: 1.35,
    });
  } else if (segType === 'tunnel') {
    hasTunnel = true;
    segLength = 36;
  } else if (segType === 'obstacle') {
    segLength = 50;
    // Guaranteed generous passage width: at least 4.2m on Normal, 3.5m on Hard
    const passageWidth = isHard ? 3.5 : 4.4;
    const obsTypeChoice = rand();

    if (obsTypeChoice < 0.5) {
      // Single side obstacle: left OR right blocked, other side has wide open corridor
      const blockLeft = rand() > 0.5;
      const obsWidth = Math.max(2.0, segWidth - passageWidth);
      const obsX = blockLeft
        ? state.currentX - segWidth / 2 + obsWidth / 2
        : state.currentX + segWidth / 2 - obsWidth / 2;

      obstacles.push({
        id: `obs_${state.segmentIndex}`,
        type: 'block',
        x: obsX,
        y: state.currentY + 1.6,
        z: state.nextZ + segLength * 0.5,
        width: obsWidth,
        height: 2.4,
        depth: 3.0,
        minX: obsX - obsWidth / 2,
        maxX: obsX + obsWidth / 2,
      });
    } else if (obsTypeChoice < 0.8) {
      // Center pillar with wide corridors on BOTH sides
      const pillarWidth = isHard ? 2.2 : 1.8;
      obstacles.push({
        id: `obs_pillar_${state.segmentIndex}`,
        type: 'pillar',
        x: state.currentX,
        y: state.currentY + 1.8,
        z: state.nextZ + segLength * 0.5,
        width: pillarWidth,
        height: 2.6,
        depth: 2.6,
        minX: state.currentX - pillarWidth / 2,
        maxX: state.currentX + pillarWidth / 2,
      });
    } else {
      // Smoothly sweeping obstacle beam
      // Only introduce after 160m (or 100m on hard mode)
      if (distance > (isHard ? 100 : 160)) {
        const sweepSpan = Math.max(2.0, segWidth - passageWidth - 1.0);
        obstacles.push({
          id: `obs_moving_${state.segmentIndex}`,
          type: 'moving_horizontal',
          x: state.currentX,
          y: state.currentY + 1.5,
          z: state.nextZ + segLength * 0.5,
          width: 2.0,
          height: 2.0,
          depth: 2.0,
          minX: state.currentX - sweepSpan / 2,
          maxX: state.currentX + sweepSpan / 2,
          speed: isHard ? 2.4 : 1.6,
          phase: rand() * Math.PI * 2,
        });
      } else {
        // Fallback to center pillar for early game
        obstacles.push({
          id: `obs_pillar_early_${state.segmentIndex}`,
          type: 'pillar',
          x: state.currentX,
          y: state.currentY + 1.8,
          z: state.nextZ + segLength * 0.5,
          width: 1.8,
          height: 2.4,
          depth: 2.4,
          minX: state.currentX - 0.9,
          maxX: state.currentX + 0.9,
        });
      }
    }
  }

  // Occasional booster pad on straight segments for exhilarating speed
  if (segType === 'straight' && rand() < 0.35) {
    boosters.push({
      id: `boost_${state.segmentIndex}`,
      x: state.currentX,
      y: state.currentY + 0.6,
      z: state.nextZ + segLength * 0.5,
      width: Math.min(4.0, segWidth * 0.5),
      depth: 6.0,
      boostFactor: 1.35,
    });
  }

  // Construct segment object
  const segment: TrackSegment = {
    id: segmentId,
    type: segType,
    x: state.currentX,
    y: state.currentY,
    z: state.nextZ + segLength / 2,
    width: segWidth,
    length: segLength,
    height: PLATFORM_HEIGHT,
    hasRamp,
    rampAngle: hasRamp ? rampAngle : undefined,
    obstacles,
    boosters,
    hasTunnel,
    tunnelColor: isHard ? '#ff0055' : '#00ff88',
  };

  state.nextZ += segLength;

  // If this was a ramp, follow it with a gap and safe landing platform
  if (hasRamp) {
    // Calculate guaranteed reachable gap length
    const launchSpeed = currentSpeed;
    const launchVy = rampLaunchSpeed(launchSpeed, rampAngle);
    const rampRise = Math.tan(rampAngle) * segLength;
    const maxJumpReach = calculateJumpReach(launchSpeed, launchVy, rampRise);
    // Fair, guaranteed gap length well within reach
    const gapLength = Math.max(14, Math.min(22, maxJumpReach * 0.55));

    // Next platform starts after the gap
    state.nextZ += gapLength;

    // Guaranteed wide and long landing zone (55m long, 14m wide)
    const landingLength = 55;
    const landingWidth = Math.max(segWidth * 1.35, 14);
    const landingSeg: TrackSegment = {
      id: `seg_landing_${state.segmentIndex++}`,
      type: 'straight',
      x: state.currentX,
      y: state.currentY,
      z: state.nextZ + landingLength / 2,
      width: landingWidth,
      length: landingLength,
      height: PLATFORM_HEIGHT,
      obstacles: [],
      boosters: [],
    };
    state.nextZ += landingLength;
    return [segment, landingSeg];
  }

  return [segment];
}

/**
 * Ensures track has sufficient segments ahead of player
 */
export function populateTrack(
  segments: TrackSegment[],
  state: GeneratorState,
  playerZ: number,
  lookaheadDistance = 260
): TrackSegment[] {
  const oldest = segments[0];
  const cutoff = playerZ - 45;
  if (oldest && oldest.z + oldest.length / 2 > cutoff && state.nextZ >= playerZ + lookaheadDistance) {
    return segments;
  }
  const updated = segments.filter(seg => seg.z + seg.length / 2 > cutoff);

  // 2. Generate new segments while track extent is less than playerZ + lookaheadDistance
  while (state.nextZ < playerZ + lookaheadDistance) {
    const nextSegs = generateNextSegments(state);
    for (const s of nextSegs) {
      updated.push(s);
    }
  }

  return updated;
}
