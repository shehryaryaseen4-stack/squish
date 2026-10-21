import { describe, expect, it } from 'vitest';
import { DAILY_LEVELS } from '../src/data/levels/index';
import { COMEBACK_REWARD, DAILY_CHALLENGE_REWARD, DailyManager, GIFT_TABLE, localDate, localDayNumber, msUntilLocalMidnight } from '../src/game/DailyManager';
import { RewardManager } from '../src/game/RewardManager';
import { freshSaves } from './helpers';

const DAY = 86400000;
const make = (start: number) => {
  let now = start;
  const saves = freshSaves();
  saves.data.lastPlayed = start;
  const rewards = new RewardManager(saves);
  const daily = new DailyManager(saves, rewards, () => now);
  return { saves, rewards, daily, advance: (ms: number) => (now += ms) };
};

describe('daily systems', () => {
  const start = new Date(2026, 9, 21, 10, 0, 0).getTime();

  it('formats local dates and counts down to midnight', () => {
    expect(localDate(start)).toBe('2026-10-21');
    expect(msUntilLocalMidnight(start)).toBe(14 * 3600000);
  });

  it('pays the gift once per day and never resets the track for missed days', () => {
    const { daily, rewards, advance } = make(start);
    expect(daily.claimGift()).toEqual(GIFT_TABLE[0]);
    expect(daily.claimGift()).toBeNull();
    advance(5 * DAY); // missed several days
    expect(daily.claimGift()).toEqual(GIFT_TABLE[1]);
    expect(rewards.coins).toBe(GIFT_TABLE[0].coins + GIFT_TABLE[1].coins);
  });

  it('picks a deterministic challenge and pays it once per day', () => {
    const { daily, rewards, advance } = make(start);
    const a = daily.challenge();
    expect(DAILY_LEVELS).toContain(a);
    expect(daily.challenge()).toBe(a);
    expect(daily.completeChallenge('daily-999')).toBe(false);
    expect(daily.completeChallenge(a.id)).toBe(true);
    expect(daily.completeChallenge(a.id)).toBe(false);
    expect(rewards.coins).toBe(DAILY_CHALLENGE_REWARD.coins);
    advance(DAY);
    expect(daily.challenge().id).not.toBe(a.id);
    expect(localDayNumber(start + DAY) - localDayNumber(start)).toBe(1);
  });

  it('offers a gentle comeback bonus once after a long absence', () => {
    const saves = freshSaves();
    saves.data.levels['w1-01'] = { done: true, stars: 1, bestMoves: 1, bestTime: 1, hintFree: true };
    saves.data.lastPlayed = start - 4 * DAY;
    const rewards = new RewardManager(saves);
    const daily = new DailyManager(saves, rewards, () => start);
    expect(daily.comebackAvailable()).toBe(true);
    expect(daily.claimComeback()).toBe(true);
    expect(daily.claimComeback()).toBe(false);
    expect(rewards.coins).toBe(COMEBACK_REWARD.coins);
  });

  it('does not offer a comeback after a short break', () => {
    const { daily } = make(start);
    expect(daily.comebackAvailable()).toBe(false);
  });

  it('allows one free path hint per day', () => {
    const { daily, advance } = make(start);
    expect(daily.useFreeHint()).toBe(true);
    expect(daily.useFreeHint()).toBe(false);
    advance(DAY);
    expect(daily.useFreeHint()).toBe(true);
  });
});
