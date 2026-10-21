import { describe, expect, it } from 'vitest';
import { SAVE_KEY, SAVE_VERSION, SaveManager, defaultSave, sanitize } from '../src/game/SaveManager';
import { memoryStorage } from './helpers';

describe('save system', () => {
  it('starts from defaults with no stored data', () => {
    const s = new SaveManager(memoryStorage());
    expect(s.data.version).toBe(SAVE_VERSION);
    expect(s.data.coins).toBe(0);
    expect(s.data.hints).toBe(3);
    expect(s.data.owned).toContain('skin-core');
  });

  it('round-trips through storage', () => {
    const store = memoryStorage();
    const a = new SaveManager(store);
    a.data.coins = 123;
    a.data.levels['w1-01'] = { done: true, stars: 3, bestMoves: 9, bestTime: 12, hintFree: true };
    a.save();
    const b = new SaveManager(store);
    expect(b.data.coins).toBe(123);
    expect(b.data.levels['w1-01'].stars).toBe(3);
  });

  it('recovers from malformed JSON without crashing and keeps a copy', () => {
    const store = memoryStorage({ [SAVE_KEY]: '{not json' });
    const s = new SaveManager(store);
    expect(s.recovered).toBe(true);
    expect(s.data.coins).toBe(0);
    expect(store.data[SAVE_KEY + '.corrupt']).toBe('{not json');
  });

  it('clamps and filters invalid values', () => {
    const d = sanitize(
      {
        version: 2,
        coins: -50,
        hints: 'lots',
        levels: { 'w1-01': { done: true, stars: 99, bestMoves: -3 }, bogus: 5 },
        owned: ['skin-ember', 'not-a-skin', 42],
        equipped: { skin: 'skin-gold', trail: 'skin-ember' },
        achievements: { 'first-level': 1000, fake: 1 },
        settings: { music: 7, quality: 'ultra', sensitivity: 0 },
        daily: { giftDate: 'yesterday' },
      },
      new Set(['w1-01']),
    );
    expect(d.coins).toBe(0);
    expect(d.hints).toBe(3);
    expect(d.levels['w1-01'].stars).toBe(3);
    expect(d.levels['w1-01'].bestMoves).toBe(0);
    expect(d.levels.bogus).toBeUndefined();
    expect(d.owned).toContain('skin-ember');
    expect(d.owned).not.toContain('not-a-skin');
    expect(d.equipped.skin).toBe('skin-core'); // gold is not owned
    expect(d.equipped.trail).toBe('trail-none'); // wrong slot
    expect(Object.keys(d.achievements)).toEqual(['first-level']);
    expect(d.settings.music).toBe(1);
    expect(d.settings.quality).toBe('auto');
    expect(d.settings.sensitivity).toBe(0.5);
    expect(d.daily.giftDate).toBeNull();
  });

  it('migrates version 1 saves', () => {
    const d = sanitize({ version: 1, levels: { 'w1-01': 2 }, coins: 10 });
    expect(d.levels['w1-01']).toMatchObject({ done: true, stars: 2 });
    expect(d.version).toBe(SAVE_VERSION);
  });

  it('exports and imports, rejecting garbage', () => {
    const a = new SaveManager(memoryStorage());
    a.data.coins = 77;
    const code = a.exportString();
    const b = new SaveManager(memoryStorage());
    expect(b.importString('hello')).toMatch(/does not look/);
    expect(b.importString(code)).toBeNull();
    expect(b.data.coins).toBe(77);
  });

  it('works without storage (private mode)', () => {
    const s = new SaveManager(null);
    s.data.coins = 5;
    expect(() => s.save()).not.toThrow();
    expect(s.persistent).toBe(false);
  });

  it('reset keeps settings but clears progress', () => {
    const s = new SaveManager(memoryStorage());
    s.data.coins = 500;
    s.data.settings.music = 0.1;
    s.reset();
    expect(s.data.coins).toBe(0);
    expect(s.data.settings.music).toBe(0.1);
    expect(defaultSave().settings.music).not.toBe(0.1);
  });
});
