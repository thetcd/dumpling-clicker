import { DEFAULT_AVATAR } from './config/parts';

export const SAVE_VERSION = 1;

export interface AvatarDesign {
  color: string;
  eyes: string;
  mouth: string;
  accessory: string;
}

export interface GameState {
  version: number;
  savedAt: number; // epoch ms of last save — offline progress derives from this
  dumplings: number;
  totalEarned: number;
  producers: Record<string, number>; // producer id -> count owned
  upgrades: string[]; // purchased upgrade ids
  frenzyUntil: number; // epoch ms a golden-dumpling frenzy runs until; 0 = none
  prestige: number; // rebirths completed; gates designer parts and scales income
  runEarned: number; // earned since the last rebirth — what the gate measures
  avatar: AvatarDesign;
  designed: boolean; // has the player been through the creator yet
  settings: { sound: boolean; music: boolean };
  stats: { totalClicks: number; playtimeMs: number; createdAt: number };
}

export function createInitialState(now: number): GameState {
  return {
    version: SAVE_VERSION,
    savedAt: now,
    dumplings: 0,
    totalEarned: 0,
    producers: {},
    upgrades: [],
    frenzyUntil: 0,
    prestige: 0,
    runEarned: 0,
    avatar: { ...DEFAULT_AVATAR },
    designed: false,
    settings: { sound: true, music: true },
    stats: { totalClicks: 0, playtimeMs: 0, createdAt: now },
  };
}
