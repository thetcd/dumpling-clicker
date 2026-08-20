// Versioned persistence. deserialize() never throws and never returns a state
// the game can't run on: unknown shapes → null, missing fields → defaults,
// non-finite numbers → defaults. Corrupt localStorage saves are backed up
// before being replaced so nothing is silently destroyed.
import {
  createInitialState,
  SAVE_VERSION,
  type AvatarDesign,
  type GameState,
} from './state';

const KEY = 'dumpling-save';
const BACKUP_KEY = 'dumpling-save-backup';

// Future schema changes: add `2: (old) => new`, bump SAVE_VERSION.
const migrations: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {};

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(raw: string): GameState | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  let d = data as Record<string, unknown>;
  if (typeof d.version !== 'number') return null;
  if (d.version > SAVE_VERSION) return null; // newer build's save — don't guess
  for (let v = d.version; v < SAVE_VERSION; v++) {
    const step = migrations[v + 1];
    if (!step) return null;
    d = step(d);
  }
  return heal(d);
}

/** Fill gaps and reject garbage field-by-field instead of crashing. */
function heal(d: Record<string, unknown>): GameState {
  const base = createInitialState(0);
  const settings = asRecord(d.settings);
  const stats = asRecord(d.stats);
  return {
    version: SAVE_VERSION,
    savedAt: finite(d.savedAt, base.savedAt),
    dumplings: finite(d.dumplings, 0),
    totalEarned: finite(d.totalEarned, 0),
    producers: healProducers(d.producers),
    upgrades: Array.isArray(d.upgrades)
      ? d.upgrades.filter((u): u is string => typeof u === 'string')
      : [],
    // Not a migration: heal() defaults every missing field, so pre-frenzy
    // saves load fine and SAVE_VERSION stays at 1. Bumping it without
    // registering migrations[2] would make deserialize() return null and
    // wipe every existing save.
    frenzyUntil: finite(d.frenzyUntil, 0),
    avatar: healAvatar(d.avatar, base.avatar),
    designed: d.designed === true,
    settings: {
      sound: typeof settings.sound === 'boolean' ? settings.sound : true,
      music: typeof settings.music === 'boolean' ? settings.music : true,
    },
    stats: {
      totalClicks: finite(stats.totalClicks, 0),
      playtimeMs: finite(stats.playtimeMs, 0),
      createdAt: finite(stats.createdAt, base.stats.createdAt),
    },
  };
}

function healProducers(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, count] of Object.entries(asRecord(v))) {
    if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
      out[id] = count;
    }
  }
  return out;
}

function healAvatar(v: unknown, fallback: AvatarDesign): AvatarDesign {
  const a = asRecord(v);
  return {
    color: typeof a.color === 'string' ? a.color : fallback.color,
    eyes: typeof a.eyes === 'string' ? a.eyes : fallback.eyes,
    mouth: typeof a.mouth === 'string' ? a.mouth : fallback.mouth,
    accessory: typeof a.accessory === 'string' ? a.accessory : fallback.accessory,
  };
}

function finite(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

// --- localStorage wrappers (thin; exercised by hand, not unit tests) ---

export function loadFromStorage(): GameState | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null; // storage blocked (private mode edge cases) — run unsaved
  }
  if (raw === null) return null;
  const state = deserialize(raw);
  if (state === null) {
    // Don't destroy evidence: stash the unreadable blob before starting fresh.
    try {
      localStorage.setItem(BACKUP_KEY, raw);
    } catch {
      /* best effort */
    }
  }
  return state;
}

export function saveToStorage(state: GameState, now: number): void {
  state.savedAt = now;
  try {
    localStorage.setItem(KEY, serialize(state));
  } catch {
    /* storage full/blocked — nothing sensible to do */
  }
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
