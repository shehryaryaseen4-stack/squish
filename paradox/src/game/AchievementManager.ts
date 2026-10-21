import { ACHIEVEMENTS, AchievementDef } from '../data/achievements';
import { ALL_LEVELS } from '../data/levels/index';
import { COSMETICS } from '../data/cosmetics';
import type { SaveManager } from './SaveManager';
import type { RewardManager } from './RewardManager';
import type { ProgressionManager } from './ProgressionManager';

/** Checks milestone conditions against the save and pays each reward once. */
export class AchievementManager {
  constructor(private saves: SaveManager, private rewards: RewardManager, private progress: ProgressionManager) {}

  has(id: string) {
    return !!this.saves.data.achievements[id];
  }

  private conditions(): Record<string, boolean> {
    const d = this.saves.data;
    const perfect = Object.values(d.levels).filter((l) => l.stars >= 3).length;
    const stars = this.progress.totalStars();
    const worldDone = (w: number) => this.progress.worldProgress(w).done === 20;
    const doneWith = (pred: (id: string) => boolean) => ALL_LEVELS.some((l) => pred(l.id) && d.levels[l.id]?.done);
    const nonDefault = Object.values(d.equipped).some((id) => COSMETICS.find((c) => c.id === id)?.source !== 'default');
    return {
      'first-level': this.progress.completedCount() >= 1,
      'perfect-1': perfect >= 1,
      'perfect-10': perfect >= 10,
      'hint-free-10': d.stats.hintFreeClears >= 10,
      'world-1': worldDone(1),
      'world-2': worldDone(2),
      'world-3': worldDone(3),
      'world-4': worldDone(4),
      paradox: !!d.levels['w5-20']?.done,
      'echo-first': doneWith((id) => !!ALL_LEVELS.find((l) => l.id === id)?.echo),
      'gravity-first': doneWith((id) => ALL_LEVELS.find((l) => l.id === id)?.gravity !== undefined),
      'stars-100': stars >= 100,
      'stars-300': stars >= 300,
      'daily-1': !!d.daily.challengeDate,
      'falls-10': d.stats.falls >= 10,
      stylish: nonDefault,
    };
  }

  /** Unlocks every newly satisfied achievement and returns them. */
  check(): AchievementDef[] {
    const cond = this.conditions();
    const unlocked: AchievementDef[] = [];
    for (const a of ACHIEVEMENTS) {
      if (this.has(a.id) || !cond[a.id]) continue;
      this.saves.data.achievements[a.id] = Date.now();
      this.rewards.addCoins(a.coins);
      if (a.hints) this.rewards.addHints(a.hints);
      const cos = COSMETICS.find((c) => c.source === 'achievement' && c.sourceRef === a.id);
      if (cos) this.rewards.grantCosmetic(cos.id);
      unlocked.push(a);
    }
    if (unlocked.length) this.saves.save();
    return unlocked;
  }
}
