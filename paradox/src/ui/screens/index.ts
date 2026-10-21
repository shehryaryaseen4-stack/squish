import type { Game, ScreenParams } from '../../game/Game';
import { menuScreen } from './menu';
import { mapScreen } from './map';
import { levelsScreen } from './levels';
import { gameScreen } from './game';
import { dailyScreen } from './daily';
import { achievementsScreen } from './achievements';
import { rewardsScreen } from './rewards';
import { settingsScreen } from './settings';
import { creditsScreen } from './credits';
import { endingScreen } from './ending';

export type Screen = (game: Game, root: HTMLElement, params: ScreenParams) => void | (() => void);

export const screens = {
  menu: menuScreen,
  map: mapScreen,
  levels: levelsScreen,
  game: gameScreen,
  daily: dailyScreen,
  achievements: achievementsScreen,
  rewards: rewardsScreen,
  settings: settingsScreen,
  credits: creditsScreen,
  ending: endingScreen,
} satisfies Record<string, Screen>;

export type ScreenName = keyof typeof screens;
