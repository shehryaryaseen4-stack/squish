import { COSMETICS, DEFAULT_EQUIPPED } from '../data/cosmetics';
import { ACHIEVEMENTS } from '../data/achievements';

export const SAVE_VERSION = 2;
export const SAVE_KEY = 'paradox.save';

export type Quality = 'auto' | 'low' | 'medium' | 'high';

export interface LevelRecord {
  done: boolean;
  stars: number;
  bestMoves: number;
  bestTime: number;
  /** Completed at least once without a path hint. */
  hintFree: boolean;
}

export interface Settings {
  music: number;
  sfx: number;
  vibration: boolean;
  quality: Quality;
  sensitivity: number;
  reducedMotion: boolean;
  showPad: boolean;
  language: string;
}

export interface SaveData {
  version: number;
  createdAt: number;
  lastPlayed: number;
  levels: Record<string, LevelRecord>;
  coins: number;
  hints: number;
  owned: string[];
  equipped: { skin: string; trail: string; portal: string };
  achievements: Record<string, number>;
  /** World completion rewards already granted (world ids). */
  worldRewards: number[];
  settings: Settings;
  daily: {
    giftDate: string | null;
    giftStreak: number;
    challengeDate: string | null;
    comebackClaimed: number;
    freeHintDate: string | null;
  };
  ads: { date: string | null; hintRewards: number; processed: string[] };
  stats: { falls: number; undos: number; pathHints: number; hintFreeClears: number; echoes: number };
  seen: string[];
  endingSeen: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  music: 0.5,
  sfx: 0.8,
  vibration: true,
  quality: 'auto',
  sensitivity: 1,
  reducedMotion: false,
  showPad: true,
  language: 'en',
};

export function defaultSave(now = Date.now()): SaveData {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastPlayed: now,
    levels: {},
    coins: 0,
    hints: 3,
    owned: COSMETICS.filter((c) => c.source === 'default').map((c) => c.id),
    equipped: { ...DEFAULT_EQUIPPED },
    achievements: {},
    worldRewards: [],
    settings: { ...DEFAULT_SETTINGS },
    daily: { giftDate: null, giftStreak: 0, challengeDate: null, comebackClaimed: 0, freeHintDate: null },
    ads: { date: null, hintRewards: 0, processed: [] },
    stats: { falls: 0, undos: 0, pathHints: 0, hintFreeClears: 0, echoes: 0 },
    seen: [],
    endingSeen: false,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, d: number, min = -Infinity, max = Infinity) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
const int = (v: unknown, d: number, min = 0, max = Number.MAX_SAFE_INTEGER) => Math.round(num(v, d, min, max));
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const str = (v: unknown, d: string | null) => (typeof v === 'string' && v.length < 64 ? v : d);
const dateStr = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** Migrate older save layouts in place. */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  const v = int(raw.version, 1);
  if (v < 2) {
    // v1 stored completed levels as { [id]: stars } and had no world rewards.
    if (isObj(raw.levels)) {
      const out: Record<string, unknown> = {};
      for (const [id, s] of Object.entries(raw.levels)) {
        out[id] = typeof s === 'number' ? { done: true, stars: s, bestMoves: 0, bestTime: 0, hintFree: false } : s;
      }
      raw.levels = out;
    }
    raw.version = 2;
  }
  return raw;
}

/** Turn any parsed JSON into a valid save, keeping whatever is usable. */
export function sanitize(input: unknown, knownLevels?: Set<string>): SaveData {
  const d = defaultSave();
  if (!isObj(input)) return d;
  const raw = migrate({ ...input });
  const s: SaveData = d;
  s.createdAt = int(raw.createdAt, d.createdAt);
  s.lastPlayed = int(raw.lastPlayed, d.lastPlayed);
  s.coins = int(raw.coins, 0, 0, 10_000_000);
  s.hints = int(raw.hints, 3, 0, 999);
  if (isObj(raw.levels)) {
    for (const [id, r] of Object.entries(raw.levels)) {
      if (knownLevels && !knownLevels.has(id)) continue;
      if (!isObj(r)) continue;
      s.levels[id] = {
        done: bool(r.done, false),
        stars: int(r.stars, 0, 0, 3),
        bestMoves: int(r.bestMoves, 0, 0, 100000),
        bestTime: num(r.bestTime, 0, 0, 1e7),
        hintFree: bool(r.hintFree, false),
      };
    }
  }
  const validCosmetic = new Set(COSMETICS.map((c) => c.id));
  if (Array.isArray(raw.owned)) {
    for (const id of raw.owned) if (typeof id === 'string' && validCosmetic.has(id) && !s.owned.includes(id)) s.owned.push(id);
  }
  if (isObj(raw.equipped)) {
    for (const slot of ['skin', 'trail', 'portal'] as const) {
      const id = raw.equipped[slot];
      if (typeof id === 'string' && s.owned.includes(id) && COSMETICS.find((c) => c.id === id)?.slot === slot) s.equipped[slot] = id;
    }
  }
  const validAch = new Set(ACHIEVEMENTS.map((a) => a.id));
  if (isObj(raw.achievements)) {
    for (const [id, t] of Object.entries(raw.achievements)) if (validAch.has(id)) s.achievements[id] = int(t, Date.now());
  }
  if (Array.isArray(raw.worldRewards)) s.worldRewards = [...new Set(raw.worldRewards.filter((w) => Number.isInteger(w) && w >= 1 && w <= 5))] as number[];
  if (isObj(raw.settings)) {
    const st = raw.settings;
    s.settings = {
      music: num(st.music, DEFAULT_SETTINGS.music, 0, 1),
      sfx: num(st.sfx, DEFAULT_SETTINGS.sfx, 0, 1),
      vibration: bool(st.vibration, DEFAULT_SETTINGS.vibration),
      quality: (['auto', 'low', 'medium', 'high'] as const).includes(st.quality as Quality) ? (st.quality as Quality) : 'auto',
      sensitivity: num(st.sensitivity, 1, 0.5, 2),
      reducedMotion: bool(st.reducedMotion, false),
      showPad: bool(st.showPad, true),
      language: str(st.language, 'en') ?? 'en',
    };
  }
  if (isObj(raw.daily)) {
    s.daily = {
      giftDate: dateStr(raw.daily.giftDate),
      giftStreak: int(raw.daily.giftStreak, 0, 0, 10000),
      challengeDate: dateStr(raw.daily.challengeDate),
      comebackClaimed: int(raw.daily.comebackClaimed, 0),
      freeHintDate: dateStr(raw.daily.freeHintDate),
    };
  }
  if (isObj(raw.ads)) {
    s.ads = {
      date: dateStr(raw.ads.date),
      hintRewards: int(raw.ads.hintRewards, 0, 0, 100),
      processed: Array.isArray(raw.ads.processed) ? raw.ads.processed.filter((x): x is string => typeof x === 'string').slice(-50) : [],
    };
  }
  if (isObj(raw.stats)) {
    for (const k of Object.keys(s.stats) as (keyof SaveData['stats'])[]) s.stats[k] = int(raw.stats[k], 0);
  }
  if (Array.isArray(raw.seen)) s.seen = raw.seen.filter((x): x is string => typeof x === 'string').slice(0, 500);
  s.endingSeen = bool(raw.endingSeen, false);
  s.version = SAVE_VERSION;
  return s;
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function safeStorage(): StorageLike | null {
  try {
    const ls = globalThis.localStorage;
    const probe = '__paradox_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

/** Loads/saves progress. Falls back to memory when storage is unavailable. */
export class SaveManager {
  data: SaveData;
  readonly persistent: boolean;
  recovered = false;
  private storage: StorageLike | null;
  private listeners = new Set<() => void>();

  constructor(storage: StorageLike | null = safeStorage(), private knownLevels?: Set<string>) {
    this.storage = storage;
    this.persistent = !!storage;
    this.data = this.load();
  }

  private load(): SaveData {
    if (!this.storage) return defaultSave();
    let text: string | null = null;
    try {
      text = this.storage.getItem(SAVE_KEY);
    } catch {
      return defaultSave();
    }
    if (!text) return defaultSave();
    try {
      return sanitize(JSON.parse(text), this.knownLevels);
    } catch {
      // Corrupt save: keep a copy for diagnosis and start fresh rather than crash.
      this.recovered = true;
      try {
        this.storage.setItem(SAVE_KEY + '.corrupt', text.slice(0, 200000));
      } catch {
        /* ignore */
      }
      return defaultSave();
    }
  }

  save() {
    this.data.lastPlayed = Date.now();
    if (this.storage) {
      try {
        this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
      } catch {
        /* quota or private mode: progress stays in memory for this session */
      }
    }
    this.listeners.forEach((l) => l());
  }

  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  exportString(): string {
    return btoa(unescape(encodeURIComponent(JSON.stringify(this.data))));
  }

  /** Returns an error message, or null on success. */
  importString(text: string): string | null {
    let parsed: unknown;
    try {
      const t = text.trim();
      parsed = JSON.parse(t.startsWith('{') ? t : decodeURIComponent(escape(atob(t))));
    } catch {
      return 'That does not look like a PARADOX save code.';
    }
    if (!isObj(parsed) || typeof parsed.version !== 'number') return 'That does not look like a PARADOX save code.';
    this.data = sanitize(parsed, this.knownLevels);
    this.save();
    return null;
  }

  reset() {
    const settings = this.data.settings;
    this.data = defaultSave();
    this.data.settings = settings;
    this.save();
  }
}
