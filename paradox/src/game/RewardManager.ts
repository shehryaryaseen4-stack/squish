import { COSMETICS, Cosmetic, cosmeticById } from '../data/cosmetics';
import type { SaveManager } from './SaveManager';

export const MAX_AD_HINTS_PER_DAY = 3;

/** Every change to currency or cosmetics goes through here and is validated. */
export class RewardManager {
  constructor(private saves: SaveManager) {}

  private get d() {
    return this.saves.data;
  }

  get coins() {
    return this.d.coins;
  }
  get hints() {
    return this.d.hints;
  }

  addCoins(amount: number): boolean {
    if (!Number.isInteger(amount) || amount <= 0 || amount > 100000) return false;
    this.d.coins = Math.min(10_000_000, this.d.coins + amount);
    return true;
  }

  spendCoins(amount: number): boolean {
    if (!Number.isInteger(amount) || amount <= 0 || this.d.coins < amount) return false;
    this.d.coins -= amount;
    return true;
  }

  addHints(amount: number): boolean {
    if (!Number.isInteger(amount) || amount <= 0 || amount > 50) return false;
    this.d.hints = Math.min(999, this.d.hints + amount);
    return true;
  }

  spendHint(): boolean {
    if (this.d.hints <= 0) return false;
    this.d.hints -= 1;
    return true;
  }

  owns(id: string) {
    return this.d.owned.includes(id);
  }

  /** Grants a cosmetic from a non-shop source. Returns false if unknown or already owned. */
  grantCosmetic(id: string): boolean {
    if (!cosmeticById(id) || this.owns(id)) return false;
    this.d.owned.push(id);
    return true;
  }

  buy(id: string): 'ok' | 'owned' | 'unavailable' | 'insufficient' {
    const c = cosmeticById(id);
    if (!c || c.price === undefined) return 'unavailable';
    if (this.owns(id)) return 'owned';
    if (!this.spendCoins(c.price)) return 'insufficient';
    this.d.owned.push(id);
    this.saves.save();
    return 'ok';
  }

  equip(id: string): boolean {
    const c = cosmeticById(id);
    if (!c || !this.owns(id)) return false;
    this.d.equipped[c.slot] = id;
    this.saves.save();
    return true;
  }

  equipped(slot: Cosmetic['slot']): Cosmetic {
    return cosmeticById(this.d.equipped[slot]) ?? COSMETICS.find((c) => c.slot === slot && c.source === 'default')!;
  }

  adHintsLeftToday(today: string) {
    if (this.d.ads.date !== today) return MAX_AD_HINTS_PER_DAY;
    return Math.max(0, MAX_AD_HINTS_PER_DAY - this.d.ads.hintRewards);
  }

  /**
   * Applies a reward confirmed by the ad provider. `txId` must be unique per
   * completed ad so duplicate callbacks can never pay out twice.
   */
  applyAdReward(txId: string, kind: 'hint' | 'cosmetic', today: string): boolean {
    if (!txId || this.d.ads.processed.includes(txId)) return false;
    if (kind === 'hint') {
      if (this.adHintsLeftToday(today) <= 0) return false;
      if (this.d.ads.date !== today) {
        this.d.ads.date = today;
        this.d.ads.hintRewards = 0;
      }
      this.d.ads.hintRewards++;
      this.addHints(1);
    } else if (!this.grantCosmetic('skin-prism')) return false;
    this.d.ads.processed = [...this.d.ads.processed, txId].slice(-50);
    this.saves.save();
    return true;
  }
}
