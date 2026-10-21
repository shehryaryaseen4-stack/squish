import type { LevelDef } from '../../game/core/types';
import { WORLD1 } from './world1';
import { WORLD2 } from './world2';
import { WORLD3 } from './world3';
import { WORLD4 } from './world4';
import { WORLD5 } from './world5';
import { DAILY } from './daily';
import { RUSH } from './rush';

export const WORLDS_LEVELS: LevelDef[][] = [WORLD1, WORLD2, WORLD3, WORLD4, WORLD5];
export const ALL_LEVELS: LevelDef[] = WORLDS_LEVELS.flat();
export const DAILY_LEVELS: LevelDef[] = DAILY;
/** Coin Rush arcade mode (separate from the 100-level campaign). */
export const RUSH_LEVELS: LevelDef[] = RUSH;

export const levelById = (id: string): LevelDef | undefined =>
  ALL_LEVELS.find((l) => l.id === id) ?? DAILY_LEVELS.find((l) => l.id === id) ?? RUSH_LEVELS.find((l) => l.id === id);
