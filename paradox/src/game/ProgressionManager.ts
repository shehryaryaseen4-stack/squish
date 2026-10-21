import { ALL_LEVELS, WORLDS_LEVELS } from '../data/levels/index';
import SOLUTIONS from '../data/solutions.json';
import { COSMETICS } from '../data/cosmetics';
import type { LevelDef } from './core/types';
import type { SaveManager } from './SaveManager';
import type { RewardManager } from './RewardManager';

export const solutions = SOLUTIONS as Record<string, string>;

export function parMoves(def: LevelDef): number {
  return solutions[def.id]?.length ?? 0;
}

/** Target time in seconds for the best-time display. */
export function parTime(def: LevelDef): number {
  return Math.round(parMoves(def) * 1.6 + 15);
}

/** Stars are based on actions taken (moves, waits, echoes and reversals). */
export function starsFor(def: LevelDef, moves: number): number {
  const par = parMoves(def);
  if (!par) return 1;
  if (moves <= par) return 3;
  if (moves <= par + Math.max(3, Math.ceil(par * 0.5))) return 2;
  return 1;
}

export function starThresholds(def: LevelDef): [number, number] {
  const par = parMoves(def);
  return [par, par + Math.max(3, Math.ceil(par * 0.5))];
}

export interface CompletionResult {
  firstClear: boolean;
  stars: number;
  previousStars: number;
  coins: number;
  hints: number;
  worldCompleted: number | null;
  cosmetic: string | null;
  newBestMoves: boolean;
}

export const FIRST_CLEAR_COINS = (world: number) => 10 + 5 * world;
export const STAR_COINS = 5;

export class ProgressionManager {
  devUnlockAll = false;
  constructor(private saves: SaveManager, private rewards: RewardManager) {}

  private get d() {
    return this.saves.data;
  }

  record(id: string) {
    return this.d.levels[id];
  }

  isDone(id: string) {
    return !!this.d.levels[id]?.done;
  }

  /** Level n (1-based campaign number) unlocks when level n-1 is complete. */
  isUnlocked(def: LevelDef): boolean {
    if (def.world === 0) return true;
    if (this.devUnlockAll || def.number === 1) return true;
    const prev = ALL_LEVELS[def.number - 2];
    return !!prev && this.isDone(prev.id);
  }

  isWorldUnlocked(world: number): boolean {
    return this.isUnlocked(WORLDS_LEVELS[world - 1][0]);
  }

  worldProgress(world: number) {
    const levels = WORLDS_LEVELS[world - 1];
    const done = levels.filter((l) => this.isDone(l.id)).length;
    const stars = levels.reduce((a, l) => a + (this.d.levels[l.id]?.stars ?? 0), 0);
    return { done, total: levels.length, stars, maxStars: levels.length * 3 };
  }

  totalStars() {
    return ALL_LEVELS.reduce((a, l) => a + (this.d.levels[l.id]?.stars ?? 0), 0);
  }

  completedCount() {
    return ALL_LEVELS.filter((l) => this.isDone(l.id)).length;
  }

  highestUnlockedWorld() {
    let w = 1;
    for (let i = 1; i <= 5; i++) if (this.isWorldUnlocked(i)) w = i;
    return w;
  }

  /** First unlocked level that is not completed yet, or the last level. */
  nextRecommended(): LevelDef {
    return ALL_LEVELS.find((l) => this.isUnlocked(l) && !this.isDone(l.id)) ?? ALL_LEVELS[ALL_LEVELS.length - 1];
  }

  /**
   * Records a completion and pays rewards. Coins are paid once per first clear
   * and once per newly earned star, so replays cannot be farmed.
   */
  complete(def: LevelDef, moves: number, seconds: number, usedPathHint: boolean): CompletionResult {
    const prev = this.d.levels[def.id];
    const stars = starsFor(def, moves);
    const firstClear = !prev?.done;
    const previousStars = prev?.stars ?? 0;
    const res: CompletionResult = {
      firstClear,
      stars,
      previousStars,
      coins: 0,
      hints: 0,
      worldCompleted: null,
      cosmetic: null,
      newBestMoves: !prev?.done || moves < prev.bestMoves,
    };
    const rec = prev ?? { done: false, stars: 0, bestMoves: 0, bestTime: 0, hintFree: false };
    rec.done = true;
    rec.stars = Math.max(rec.stars, stars);
    rec.bestMoves = rec.bestMoves ? Math.min(rec.bestMoves, moves) : moves;
    rec.bestTime = rec.bestTime ? Math.min(rec.bestTime, seconds) : seconds;
    if (!usedPathHint && !rec.hintFree) {
      rec.hintFree = true;
      this.d.stats.hintFreeClears++;
    }
    this.d.levels[def.id] = rec;

    if (def.world === 0) {
      this.saves.save();
      return res;
    }
    if (firstClear) {
      res.coins += FIRST_CLEAR_COINS(def.world);
      if (this.completedCount() % 5 === 0) res.hints += 1;
    }
    const gained = Math.max(0, stars - previousStars);
    res.coins += gained * STAR_COINS;

    const wp = this.worldProgress(def.world);
    if (wp.done === wp.total && !this.d.worldRewards.includes(def.world)) {
      this.d.worldRewards.push(def.world);
      res.worldCompleted = def.world;
      res.coins += 100;
      res.hints += 3;
      const skin = COSMETICS.find((c) => c.source === 'world' && c.sourceRef === String(def.world));
      if (skin && this.rewards.grantCosmetic(skin.id)) res.cosmetic = skin.id;
      if (def.world === 5 && this.rewards.grantCosmetic('skin-paradox')) res.cosmetic = 'skin-paradox';
    }
    if (res.coins) this.rewards.addCoins(res.coins);
    if (res.hints) this.rewards.addHints(res.hints);
    this.saves.save();
    return res;
  }
}
