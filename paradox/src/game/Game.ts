import { ALL_LEVELS, DAILY_LEVELS, WORLDS_LEVELS } from '../data/levels/index';
import { WORLDS } from '../data/worlds';
import { cosmeticById } from '../data/cosmetics';
import type { AchievementDef } from '../data/achievements';
import type { LevelDef } from './core/types';
import { AchievementManager } from './AchievementManager';
import { AudioManager } from './AudioManager';
import { DailyManager } from './DailyManager';
import { GameController } from './GameController';
import { InputManager } from './InputManager';
import { ProgressionManager } from './ProgressionManager';
import { RewardManager } from './RewardManager';
import { SaveManager } from './SaveManager';
import { createAdProvider } from './ads/index';
import type { AdProvider } from './ads/AdProvider';
import { CameraController } from './render/CameraController';
import { MenuScene } from './render/MenuScene';
import { Stage, detectQuality } from './render/Stage';
import type { SkinColors } from './render/BoardView';
import { setLanguage } from '../i18n/index';
import { toast } from '../ui/dom';
import { screens, ScreenName } from '../ui/screens/index';

export type ScreenParams = Record<string, unknown>;

/**
 * Top-level orchestrator: owns persistent managers, the 3D stage, the active
 * level and the screen router.
 */
export class Game {
  readonly saves: SaveManager;
  readonly rewards: RewardManager;
  readonly progress: ProgressionManager;
  readonly achievements: AchievementManager;
  readonly daily: DailyManager;
  readonly audio = new AudioManager();
  readonly ads: AdProvider;
  readonly stage: Stage;
  readonly camera: CameraController;
  readonly menuScene: MenuScene;
  readonly input: InputManager;
  controller: GameController | null = null;
  current: ScreenName = 'menu';
  private cleanup: (() => void) | null = null;
  readonly ui: HTMLElement;

  constructor(canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.ui = ui;
    const known = new Set([...ALL_LEVELS, ...DAILY_LEVELS].map((l) => l.id));
    this.saves = new SaveManager(undefined, known);
    this.rewards = new RewardManager(this.saves);
    this.progress = new ProgressionManager(this.saves, this.rewards);
    this.achievements = new AchievementManager(this.saves, this.rewards, this.progress);
    this.daily = new DailyManager(this.saves, this.rewards);
    this.ads = createAdProvider();
    const q = this.saves.data.settings.quality;
    this.stage = new Stage(canvas, q === 'auto' ? detectQuality() : q);
    this.camera = new CameraController(this.stage.camera);
    this.menuScene = new MenuScene(this.stage);
    this.stage.addUpdater((dt, t) => {
      this.camera.update(dt, t);
      this.menuScene.update(dt, t);
    });
    this.input = new InputManager(canvas, {
      dir: (v) => this.controller?.screenDir(v),
      tap: (p) => this.controller?.tap(p),
      command: (c) => this.controller?.command(c),
    });
    if (new URLSearchParams(location.search).has('unlockall') && import.meta.env.DEV) this.progress.devUnlockAll = true;
    this.applySettings();
    void this.ads.initialize();
    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => this.onVisibility());
    // Browsers only allow audio after a user gesture.
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
  }

  start() {
    this.stage.setTheme(WORLDS[0]);
    this.stage.start();
    // Android back button / browser back: pause the level or go to the menu
    // instead of leaving the game.
    history.replaceState({ paradox: 'menu' }, '');
    window.addEventListener('popstate', () => this.onBack());
    this.show('menu');
  }

  private onBack() {
    if (document.querySelector('.modal-backdrop')) {
      // Close a dismissible dialog the same way Escape does; others stay open.
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      history.pushState({ paradox: this.current }, '');
      return;
    }
    if (this.current === 'game' && this.controller && !this.controller.finished) {
      history.pushState({ paradox: 'game' }, '');
      this.controller.command('pause');
      return;
    }
    if (this.current !== 'menu') this.show('menu');
  }

  applySettings() {
    const s = this.saves.data.settings;
    this.audio.setVolumes(s.sfx, s.music);
    const q = s.quality === 'auto' ? detectQuality() : s.quality;
    if (q !== this.stage.quality) this.stage.setQuality(q);
    this.stage.reducedMotion = s.reducedMotion;
    this.camera.reducedMotion = s.reducedMotion;
    this.input.sensitivity = s.sensitivity;
    document.body.classList.toggle('reduced-motion', s.reducedMotion);
    document.body.classList.toggle('hide-pad', !s.showPad);
    setLanguage(s.language);
  }

  vibrate(pattern: number | number[]) {
    if (this.saves.data.settings.vibration && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        /* unsupported */
      }
    }
  }

  click() {
    this.audio.unlock();
    this.audio.play('ui');
  }

  skinColors(): SkinColors {
    const skin = this.rewards.equipped('skin');
    const trail = this.rewards.equipped('trail');
    const portal = this.rewards.equipped('portal');
    return { cube: skin.color, cube2: skin.color2, trail: trail.id, trailColor: trail.color, portal: portal.color, portal2: portal.color2 };
  }

  show(name: ScreenName, params: ScreenParams = {}) {
    this.cleanup?.();
    this.cleanup = null;
    if (name !== 'game') this.endLevel();
    this.current = name;
    document.body.dataset.screen = name;
    if (name !== 'menu' && history.state?.paradox === 'menu') history.pushState({ paradox: name }, '');
    this.ui.innerHTML = '';
    const menuLike = name !== 'game' && name !== 'ending';
    this.menuScene.show(menuLike);
    if (menuLike) {
      this.camera.setMenu(true);
      this.menuScene.setSkin(cosmeticById(String(params.previewSkin ?? ''))?.color ?? this.rewards.equipped('skin').color);
      this.menuScene.setFragments(this.saves.data.worldRewards.length);
      const w = Number(params.world ?? this.progress.highestUnlockedWorld());
      this.stage.setTheme(WORLDS[Math.max(0, Math.min(4, w - 1))]);
      this.audio.startMusic(w);
    }
    const ret = screens[name](this, this.ui, params);
    if (typeof ret === 'function') this.cleanup = ret;
  }

  /** Start a level (campaign or daily). */
  play(def: LevelDef) {
    if (def.world > 0 && !this.progress.isUnlocked(def)) {
      toast('Complete the previous level first.', 'warn');
      return;
    }
    this.endLevel();
    const theme = WORLDS[(def.world || (this.daily.challenge().number % 5) + 1) - 1];
    this.stage.setTheme(theme);
    this.audio.startMusic(theme.id);
    this.show('game', { def });
  }

  /** Create the controller for the game screen. */
  createController(def: LevelDef, hooks: ConstructorParameters<typeof GameController>[7]) {
    this.endLevel();
    const theme = WORLDS[(def.world || (this.daily.challenge().number % 5) + 1) - 1];
    this.menuScene.show(false);
    this.controller = new GameController(def, this.stage, this.camera, this.audio, this.input, theme, this.skinColors(), hooks);
    this.input.enabled = true;
    return this.controller;
  }

  endLevel() {
    if (this.controller) {
      this.controller.dispose();
      this.controller = null;
    }
    this.input.enabled = false;
  }

  nextLevel(def: LevelDef): LevelDef | null {
    if (def.world === 0) return null;
    return ALL_LEVELS[def.number] ?? null;
  }

  worldLevels(world: number) {
    return WORLDS_LEVELS[world - 1];
  }

  /** Show unlocked achievements as toasts. */
  announce(list: AchievementDef[]) {
    list.forEach((a, i) =>
      setTimeout(() => {
        toast(`Achievement: ${a.name} (+${a.coins} coins${a.hints ? `, +${a.hints} hints` : ''})`, 'good', 3200);
        this.audio.play('coin');
      }, 600 + i * 900),
    );
  }

  checkAchievements() {
    this.announce(this.achievements.check());
  }

  private onResize() {
    this.stage.resize();
    if (this.controller) this.camera.fit(this.controller.session.L.w, this.controller.session.L.h);
  }

  private onVisibility() {
    if (document.hidden) {
      this.stage.stop();
      this.audio.suspend();
      if (this.controller && !this.controller.paused && !this.controller.finished) this.controller.session.pause();
    } else {
      this.stage.start();
      this.audio.resume();
      if (this.controller && !this.controller.paused) this.controller.session.resume();
    }
  }
}
