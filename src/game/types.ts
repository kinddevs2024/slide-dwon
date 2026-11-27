export type GameMode = 'normal' | 'hard';

export type GameState = 'title' | 'playing' | 'gameover';

export interface GameSettings {
  sound: boolean;
  music: boolean;
  sensitivity: number; // 0.5 to 1.5, default 1.0
  graphics: 'low' | 'high';
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  mode: GameMode;
  date: string;
}

export interface BallPhysics {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  pitch: number; // rotation X
  roll: number;  // rotation Z
  yaw: number;   // rotation Y
  radius: number;
  grounded: boolean;
  onPlatformId: string | null;
  boostTimer: number;
  alive: boolean;
  causeOfDeath: 'fall' | 'obstacle' | null;
}

export interface AABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export type ObstacleType = 'pillar' | 'block' | 'moving_horizontal' | 'overhead';

export interface ObstacleData {
  id: string;
  type: ObstacleType;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  minX: number;
  maxX: number;
  speed?: number;
  phase?: number;
}

export interface BoosterData {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  boostFactor: number; // e.g. 1.4x speed
  jumpImpulse?: number;
}

export interface TrackSegment {
  id: string;
  type: 'straight' | 'narrow' | 'offset' | 'gap' | 'ramp' | 'slope' | 'tunnel' | 'obstacle';
  x: number;
  y: number;
  z: number;
  width: number;
  length: number;
  height: number;
  slopeAngle?: number; // radians pitching up/down
  hasRamp?: boolean;
  rampAngle?: number;
  obstacles: ObstacleData[];
  boosters: BoosterData[];
  hasTunnel?: boolean;
  tunnelColor?: string;
}
