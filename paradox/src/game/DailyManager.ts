import { DAILY_LEVELS } from '../data/levels/index';
import type { LevelDef } from './core/types';
import type { SaveManager } from './SaveManager';
import type { RewardManager } from './RewardManager';

/** Local calendar date as YYYY-MM-DD. Uses the device clock, so it also works offline. */
export function localDate(t = Date.now()): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function msUntilLocalMidnight(t = Date.now()): number {
  const d = new Date(t);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - t;
}

/** Whole days since 1970-01-01 in local time. */
export function localDayNumber(t = Date.now()): number {
  const d = new Date(t);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

export const GIFT_TABLE = [
  { coins: 10, hints: 0 },
  { coins: 15, hints: 0 },
  { coins: 20, hints: 0 },
  { coins: 25, hints: 1 },
  { coins: 30, hints: 0 },
  { coins: 35, hints: 0 },
  { coins: 50, hints: 1 },
];
export const DAILY_CHALLENGE_REWARD = { coins: 50, hints: 1 };
export const COMEBACK_DAYS = 3;
export const COMEBACK_REWARD = { coins: 30, hints: 1 };

/**
 * Daily gift, daily challenge and comeback bonus. Missing days never resets or
 * reduces anything: the gift cycle only advances when a gift is claimed.
 */
export class DailyManager {
  /** lastPlayed captured at startup, before this session touched the save. */
  private previousVisit: number;

  constructor(private saves: SaveManager, private rewards: RewardManager, private now = () => Date.now()) {
    this.previousVisit = saves.data.lastPlayed;
  }

  get today() {
    return localDate(this.now());
  }

  giftAvailable() {
    return this.saves.data.daily.giftDate !== this.today;
  }

  nextGift() {
    return GIFT_TABLE[this.saves.data.daily.giftStreak % GIFT_TABLE.length];
  }

  claimGift(): { coins: number; hints: number } | null {
    if (!this.giftAvailable()) return null;
    const g = this.nextGift();
    this.saves.data.daily.giftDate = this.today;
    this.saves.data.daily.giftStreak++;
    this.rewards.addCoins(g.coins);
    if (g.hints) this.rewards.addHints(g.hints);
    this.saves.save();
    return g;
  }

  comebackAvailable(): boolean {
    const d = this.saves.data;
    const away = this.now() - this.previousVisit;
    const hasPlayed = Object.keys(d.levels).length > 0;
    return hasPlayed && away >= COMEBACK_DAYS * 86400000 && d.daily.comebackClaimed < this.previousVisit;
  }

  claimComeback(): boolean {
    if (!this.comebackAvailable()) return false;
    this.saves.data.daily.comebackClaimed = this.now();
    this.rewards.addCoins(COMEBACK_REWARD.coins);
    this.rewards.addHints(COMEBACK_REWARD.hints);
    this.saves.save();
    return true;
  }

  challenge(): LevelDef {
    return DAILY_LEVELS[localDayNumber(this.now()) % DAILY_LEVELS.length];
  }

  challengeDoneToday() {
    return this.saves.data.daily.challengeDate === this.today;
  }

  /** Pays the daily challenge reward at most once per calendar day. */
  completeChallenge(id: string): boolean {
    if (id !== this.challenge().id || this.challengeDoneToday()) return false;
    this.saves.data.daily.challengeDate = this.today;
    this.rewards.addCoins(DAILY_CHALLENGE_REWARD.coins);
    this.rewards.addHints(DAILY_CHALLENGE_REWARD.hints);
    this.saves.save();
    return true;
  }

  freeHintAvailable() {
    return this.saves.data.daily.freeHintDate !== this.today;
  }

  useFreeHint(): boolean {
    if (!this.freeHintAvailable()) return false;
    this.saves.data.daily.freeHintDate = this.today;
    this.saves.save();
    return true;
  }
}
