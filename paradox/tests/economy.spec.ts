import { describe, expect, it } from 'vitest';
import { ALL_LEVELS, RUSH_LEVELS } from '../src/data/levels/index';
import { RewardManager, MAX_AD_HINTS_PER_DAY } from '../src/game/RewardManager';
import { FIRST_CLEAR_COINS, ProgressionManager, SPEED_BONUS, STAR_COINS, parMoves, starsFor } from '../src/game/ProgressionManager';
import { AchievementManager } from '../src/game/AchievementManager';
import { guardCallbacks } from '../src/game/ads/AdProvider';
import { freshSaves } from './helpers';

const setup = () => {
  const saves = freshSaves();
  const rewards = new RewardManager(saves);
  const progress = new ProgressionManager(saves, rewards);
  return { saves, rewards, progress };
};

describe('stars', () => {
  it('awards three stars at par, two within the margin, one otherwise', () => {
    const def = ALL_LEVELS[0];
    const par = parMoves(def);
    expect(par).toBeGreaterThan(0);
    expect(starsFor(def, par)).toBe(3);
    expect(starsFor(def, par + 1)).toBe(2);
    expect(starsFor(def, par + 1000)).toBe(1);
  });
});

describe('currency integrity', () => {
  it('never goes negative and rejects invalid amounts', () => {
    const { rewards } = setup();
    expect(rewards.spendCoins(1)).toBe(false);
    expect(rewards.addCoins(-5)).toBe(false);
    expect(rewards.addCoins(2.5)).toBe(false);
    expect(rewards.addCoins(10)).toBe(true);
    expect(rewards.spendCoins(11)).toBe(false);
    expect(rewards.coins).toBe(10);
    expect(rewards.spendCoins(10)).toBe(true);
    expect(rewards.coins).toBe(0);
  });

  it('spends hint tokens only when available', () => {
    const { rewards } = setup();
    expect(rewards.hints).toBe(3);
    for (let i = 0; i < 3; i++) expect(rewards.spendHint()).toBe(true);
    expect(rewards.spendHint()).toBe(false);
    expect(rewards.hints).toBe(0);
  });

  it('buys cosmetics once and requires enough coins', () => {
    const { rewards } = setup();
    expect(rewards.buy('skin-ember')).toBe('insufficient');
    rewards.addCoins(1000);
    expect(rewards.buy('skin-ember')).toBe('ok');
    expect(rewards.buy('skin-ember')).toBe('owned');
    expect(rewards.coins).toBe(850);
    expect(rewards.buy('skin-gold')).toBe('unavailable'); // world reward, not for sale
    expect(rewards.equip('skin-gold')).toBe(false);
    expect(rewards.equip('skin-ember')).toBe(true);
  });
});

describe('completion rewards', () => {
  it('pays first-clear coins once and star coins only for improvements', () => {
    const { progress, rewards } = setup();
    const def = ALL_LEVELS[0];
    const par = parMoves(def);
    const r1 = progress.complete(def, par + 1000, 9999, false);
    expect(r1.firstClear).toBe(true);
    expect(r1.coins).toBe(FIRST_CLEAR_COINS(1) + STAR_COINS * 1);
    const r2 = progress.complete(def, par + 1000, 9999, false);
    expect(r2.firstClear).toBe(false);
    expect(r2.coins).toBe(0);
    const r3 = progress.complete(def, par, 9999, false);
    expect(r3.coins).toBe(STAR_COINS * 2);
    const r4 = progress.complete(def, par, 9999, false);
    expect(r4.coins).toBe(0);
    expect(rewards.coins).toBe(FIRST_CLEAR_COINS(1) + STAR_COINS * 3);
  });

  it('grants the world reward exactly once', () => {
    const { progress, rewards } = setup();
    let worldReward = 0;
    for (const def of ALL_LEVELS.slice(0, 20)) {
      const r = progress.complete(def, parMoves(def), 5, false);
      if (r.worldCompleted) worldReward++;
    }
    expect(worldReward).toBe(1);
    expect(rewards.owns('skin-gold')).toBe(true);
    const again = progress.complete(ALL_LEVELS[19], parMoves(ALL_LEVELS[19]), 5, false);
    expect(again.worldCompleted).toBeNull();
  });

  it('gives a hint token every fifth first clear', () => {
    const { progress } = setup();
    const hintsPaid = ALL_LEVELS.slice(0, 10).map((d) => progress.complete(d, 999, 1, true).hints);
    expect(hintsPaid.filter((h) => h > 0)).toHaveLength(2);
  });
});

describe('skips, board coins and the speed bonus', () => {
  it('skipping opens the next level but pays nothing and does not count as done', () => {
    const { progress, rewards } = setup();
    progress.skip(ALL_LEVELS[0]);
    expect(progress.isUnlocked(ALL_LEVELS[1])).toBe(true);
    expect(progress.isDone(ALL_LEVELS[0].id)).toBe(false);
    expect(rewards.coins).toBe(0);
    expect(progress.nextRecommended().id).toBe(ALL_LEVELS[1].id);
    progress.complete(ALL_LEVELS[0], 999, 999, false);
    expect(progress.record(ALL_LEVELS[0].id).skipped).toBe(false);
  });

  it('pays board coins only above the previous best', () => {
    const { progress } = setup();
    const d = ALL_LEVELS[2];
    expect(progress.complete(d, 999, 999, false, { boardCoins: 2 }).boardCoins).toBe(2);
    expect(progress.complete(d, 999, 999, false, { boardCoins: 2 }).boardCoins).toBe(0);
    expect(progress.complete(d, 999, 999, false, { boardCoins: 4 }).boardCoins).toBe(2);
  });

  it('pays the speed bonus once', () => {
    const { progress } = setup();
    const d = ALL_LEVELS[3];
    expect(progress.complete(d, 999, 1, false).speedBonus).toBe(SPEED_BONUS);
    expect(progress.complete(d, 999, 1, false).speedBonus).toBe(0);
    expect(progress.complete(ALL_LEVELS[4], 999, 99999, false).speedBonus).toBe(0);
  });

  it('runs Coin Rush as its own chain', () => {
    const { progress } = setup();
    expect(progress.isUnlocked(RUSH_LEVELS[0])).toBe(true);
    expect(progress.isUnlocked(RUSH_LEVELS[1])).toBe(false);
    const r = progress.complete(RUSH_LEVELS[0], 999, 999, false);
    expect(r.coins).toBeGreaterThanOrEqual(FIRST_CLEAR_COINS(6));
    expect(progress.isUnlocked(RUSH_LEVELS[1])).toBe(true);
    expect(progress.completedCount()).toBe(0); // campaign count unaffected
  });
});

describe('unlock progression', () => {
  it('unlocks levels in order', () => {
    const { progress } = setup();
    expect(progress.isUnlocked(ALL_LEVELS[0])).toBe(true);
    expect(progress.isUnlocked(ALL_LEVELS[1])).toBe(false);
    progress.complete(ALL_LEVELS[0], 99, 1, false);
    expect(progress.isUnlocked(ALL_LEVELS[1])).toBe(true);
    expect(progress.isWorldUnlocked(2)).toBe(false);
    for (const d of ALL_LEVELS.slice(1, 20)) progress.complete(d, 99, 1, false);
    expect(progress.isWorldUnlocked(2)).toBe(true);
    expect(progress.nextRecommended().id).toBe('w2-01');
  });

  it('makes Level 100 reachable only after Level 99', () => {
    const { progress } = setup();
    for (const d of ALL_LEVELS.slice(0, 98)) progress.complete(d, 99, 1, false);
    expect(progress.isUnlocked(ALL_LEVELS[99])).toBe(false);
    progress.complete(ALL_LEVELS[98], 99, 1, false);
    expect(progress.isUnlocked(ALL_LEVELS[99])).toBe(true);
  });
});

describe('achievements', () => {
  it('unlock once and pay once', () => {
    const { saves, rewards, progress } = setup();
    const ach = new AchievementManager(saves, rewards, progress);
    expect(ach.check()).toHaveLength(0);
    progress.complete(ALL_LEVELS[0], parMoves(ALL_LEVELS[0]), 1, false);
    const first = ach.check().map((a) => a.id);
    expect(first).toContain('first-level');
    expect(first).toContain('perfect-1');
    const coins = rewards.coins;
    expect(ach.check()).toHaveLength(0);
    expect(rewards.coins).toBe(coins);
  });
});

describe('rewarded ads', () => {
  it('pays only once per transaction and respects the daily cap', () => {
    const { rewards } = setup();
    const day = '2026-10-21';
    expect(rewards.applyAdReward('tx1', 'hint', day)).toBe(true);
    expect(rewards.applyAdReward('tx1', 'hint', day)).toBe(false);
    for (let i = 2; i <= MAX_AD_HINTS_PER_DAY; i++) expect(rewards.applyAdReward(`tx${i}`, 'hint', day)).toBe(true);
    expect(rewards.applyAdReward('txX', 'hint', day)).toBe(false);
    expect(rewards.applyAdReward('txY', 'hint', '2026-10-22')).toBe(true);
    expect(rewards.applyAdReward('', 'hint', '2026-10-23')).toBe(false);
  });

  it('grants the bonus cosmetic once', () => {
    const { rewards } = setup();
    expect(rewards.applyAdReward('a', 'cosmetic', 'd')).toBe(true);
    expect(rewards.owns('skin-prism')).toBe(true);
    expect(rewards.applyAdReward('b', 'cosmetic', 'd')).toBe(false);
  });

  it('guards provider callbacks against duplicates', () => {
    let rewarded = 0;
    let closed = 0;
    let errors = 0;
    const cb = guardCallbacks(
      () => rewarded++,
      () => closed++,
      () => errors++,
    );
    cb.reward('t');
    cb.reward('t2');
    cb.error('late error');
    cb.closed();
    cb.closed();
    expect([rewarded, closed, errors]).toEqual([1, 1, 0]);
    const cb2 = guardCallbacks(
      () => rewarded++,
      () => closed++,
      () => errors++,
    );
    cb2.error('no fill');
    cb2.reward('should not pay');
    expect([rewarded, errors]).toEqual([1, 1]);
  });
});
