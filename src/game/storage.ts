import { GameSettings, LeaderboardEntry, GameMode } from './types';

const SETTINGS_KEY = 'slide_down_settings';
const PLAYER_NAME_KEY = 'slide_down_player_name';
const RECORDS_KEY = 'slide_down_records';
const BEST_NORMAL_KEY = 'slide_down_best_normal';
const BEST_HARD_KEY = 'slide_down_best_hard';

export const DEFAULT_SETTINGS: GameSettings = {
  sound: true,
  music: true,
  sensitivity: 1.0,
  graphics: 'high',
};

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

export function loadPlayerName(): string {
  try {
    const name = localStorage.getItem(PLAYER_NAME_KEY);
    if (name && name.trim()) return name.trim().slice(0, 16);
  } catch {}
  return 'RUNNER_01';
}

export function savePlayerName(name: string): void {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name.trim().slice(0, 16));
  } catch {}
}

export function loadBestScore(mode: GameMode): number {
  try {
    const key = mode === 'hard' ? BEST_HARD_KEY : BEST_NORMAL_KEY;
    const val = localStorage.getItem(key);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

export function saveBestScore(mode: GameMode, score: number): void {
  try {
    const key = mode === 'hard' ? BEST_HARD_KEY : BEST_NORMAL_KEY;
    const current = loadBestScore(mode);
    if (score > current) {
      localStorage.setItem(key, score.toString());
    }
  } catch {}
}

export function loadRecords(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return [];
}

export function addRecord(entry: Omit<LeaderboardEntry, 'id'>): LeaderboardEntry[] {
  try {
    const records = loadRecords();
    const newEntry: LeaderboardEntry = {
      ...entry,
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    records.push(newEntry);
    // Sort descending by score
    records.sort((a, b) => b.score - a.score);
    // Keep top 20
    const trimmed = records.slice(0, 20);
    localStorage.setItem(RECORDS_KEY, JSON.stringify(trimmed));
    return trimmed;
  } catch {
    return [];
  }
}

export function clearAllRecords(): void {
  try {
    localStorage.removeItem(RECORDS_KEY);
    localStorage.removeItem(BEST_NORMAL_KEY);
    localStorage.removeItem(BEST_HARD_KEY);
  } catch {}
}
