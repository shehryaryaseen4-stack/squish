# PARADOX: The Impossible Worlds

A 3D logic puzzle adventure for Android-focused mobile web (installable PWA) and desktop
browsers. Guide a glowing energy cube through five impossible worlds and 100 handcrafted
levels: push stones, route light, step through rifts, ride drifting platforms, turn gravity
on its head, record time echoes of yourself, and walk through seams joining places that
cannot touch.

Built with **Three.js + TypeScript + Vite**. Every model, texture and sound is generated at
runtime from code. No external art or audio files are needed, and none can go missing.

This folder is a self-contained project. It does not touch the file-converter site in the
repository root.

## Quick start

```bash
cd paradox
npm install
npm run dev          # http://localhost:5173  (add ?unlockall to unlock every level in dev)
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload. Uses the labelled **mock** ad provider. |
| `npm run typecheck` | TypeScript checks for the game and the Node scripts. |
| `npm test` | Vitest: engine rules, saves, economy, daily systems, and all 100 levels (stored solutions replayed, non-echo levels re-solved by BFS). |
| `npm run build` | Typecheck, then production build into `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm run smoke` | Browser smoke test (needs `npm run build` first). Drives headless Chromium through menu → map → level 1 → hints → pause → daily → save/reload → offline reload → gravity and echo levels → Level 100 → ending, and writes screenshots to `test-results/`. |
| `npm run solve` | Re-verifies every level; stored solutions are kept if still valid, otherwise the BFS solver searches. `-- --write` saves `src/data/solutions.json`; `-- --force` re-solves all. |
| `npm run icons` | Regenerates the PNG app icons. |

The smoke test uses `playwright-core` with the Chromium in `PLAYWRIGHT_BROWSERS_PATH`
(or set `CHROMIUM_PATH`). WebGL runs through SwiftShader in headless mode.

## How to play

- **Move:** swipe, arrow keys / WASD, the on-screen pad, or tap a tile to walk there.
- **Undo:** Undo button, `Z` or Backspace (unlimited). **Restart:** Restart button.
- **Wait:** hourglass button or Space (levels with timing).
- **Echo:** Echo button or `R`: first press records, second press rewinds time and your echo replays.
- **Reverse gravity:** Reverse button or `F` (limited per level).
- **Turn the view:** rotate buttons or `Q` / `E` (top-down levels).
- **Pause:** `Esc` / `P`. **Hint:** `H`.

Falling or touching a hazard is never a hard fail: the cube shatters and steps back one move.

## Worlds and levels

| World | Levels | Mechanics |
|---|---|---|
| 1 The Awakening | 1–20 | movement, shards, keys and locks, stones, pressure plates, switches, pits, light beams, mirrors, crystal-powered gates, hazards |
| 2 The Fractured Realm | 21–40 | paired rifts (portals) for you, stones and light; moving platforms; hourglass (timed) gates; light bridges |
| 3 The Gravity Labyrinth | 41–60 | side-view gravity chambers, gravity pads, wall walking, limited reversals, falling stones, phase blocks; the chamber rotates so down is always down |
| 4 The Timeless Abyss | 61–80 | time echoes (record and replay), clockwork gates, pulsing rifts, wave bridges, combined timing puzzles |
| 5 The Final Paradox | 81–100 | 81–84 rift logic, 85–88 gravity reversal, 89–92 time echoes, 93–96 seams (non-Euclidean links), 97–99 multi-stage trials, 100 the Paradox Core |

**Level 100 (The Paradox Core)** is a real puzzle using the implemented systems, not a
scripted win. You turn a floor mirror so the beam travels through a rift pair to a crystal that
opens a gate. Then you reverse gravity to rise through a gap to the upper level and take a pad
to the top chamber. There you drop a stone into one plate pit and leave a time echo on the
second plate, so both gates stay open at once. A switch aligns two seams, one for you and one
for the light. Entering the Core with its crystal lit triggers the original ending sequence and
unlocks the *Paradox* skin and *The Loop Closes* achievement.

A rotating pool of 7 validated daily puzzles provides the daily challenge.

### Level format

Levels are data (`src/data/levels/world*.ts`): an ASCII map plus optional legend, links,
gravity, reversals and echo limit. Each level also has a title, objective, difficulty,
optional tutorial text, a hint and an optional story line. For example:

```ts
L(6, {
  title: 'Pressure', objective: 'Keep the pressure plate held to open the door.',
  difficulty: 1, hint: 'Push the block onto the plate.',
  map: String.raw`
    #######
    #S.B.p#
    #.....#
    ###P###
      #E#
  `,
}),
```

Default characters: `#` wall, `.` floor, space void, `S` start, `E` exit, `x` hazard, `o` pit,
`B` stone, `k` key, `L` lock, `*` shard, `p/q` plates → `P/Q` doors, `t/u` switches (`T/U` are
inverted doors), `> < ^ v` emitters, `/ \` mirrors, `R` exit crystal, `() [] {}` rift pairs,
`n e s w` gravity pads, `=` platform on `-` rail, `b/d` bridges. Anything else (timers,
clockwork, channel receivers, conditional hazards) is declared in the level's `legend`.

Par moves, three-star targets and hints come from `src/data/solutions.json`: one verified
action sequence per level (`N E S W` moves, `.` wait, `R` echo, `F` reverse).

## Architecture

```
src/
  main.ts                    boot, WebGL failure screen, service worker registration
  game/
    core/                    pure deterministic simulation (no DOM, no Three.js)
      types.ts compile.ts    level format → compiled level
      engine.ts              rules: step(level, state, action) → new state + events
      solver.ts              BFS solver used by tests, tooling and hints
    Game.ts                  orchestrator and screen router
    GameController.ts        one level: input → actions → view, death/win flow
    GameSession.ts           state, undo history, tap-to-move routing, timer
    InputManager.ts          keyboard, swipe, tap (screen-relative directions)
    HintManager.ts           next moves from the stored solution or a bounded search
    SaveManager.ts           versioned, validated localStorage save with migration, export/import
    ProgressionManager.ts    unlocks, stars, first-clear and star rewards, world rewards
    RewardManager.ts         validated currency, hint tokens, cosmetics, ad rewards
    AchievementManager.ts    milestone checks, each paid once
    DailyManager.ts          daily gift, daily challenge, comeback bonus, free daily hint
    AudioManager.ts          Web Audio synthesised effects and per-world ambient music
    ads/                     AdProvider interface, mock, none and native-bridge providers
    render/                  Stage (renderer, sky, light, particles), BoardView (level
                             diorama + animation), CameraController, MenuScene, textures
  ui/                        DOM helpers, icons, one module per screen
  data/                      worlds, levels, daily pool, cosmetics, achievements, solutions
  i18n/                      UI strings (English) and t() helper
public/                      manifest, service worker, icons
tests/                       Vitest suites
scripts/                     solver, icon generator, smoke test, screenshot gallery
```

The simulation is the single source of truth. The renderer only mirrors states and
animates the events each step returns (moves, pushes, teleports, falls, rewinds, and so on).
Because of that, the same code can drive the tests, the hints and the solver.

## Testing each world and Level 100 during development

- `npm run dev`, then open `http://localhost:5173/?unlockall`. This unlocks every level in
  the session (dev builds only, and it is not saved).
- In the browser console, `__paradox` is the game instance. For example,
  `__paradox.play(__paradox.worldLevels(5)[19])` opens Level 100, and
  `__paradox.controller.enqueue(1)` sends a move (0 N, 1 E, 2 S, 3 W, 4 wait, 5 echo, 6 reverse).
- Solutions for every level are in `src/data/solutions.json` if you want to watch one play.
- `npm run smoke` plays level 1, a gravity level, an echo level and Level 100 end to end.

## Economy and retention (fair by design)

- Coins come from first clears (10 + 5 × world), each newly earned star (5), world
  completion (100), achievements, the daily gift and the daily challenge. Replays pay only
  for stars you did not have before, so completions cannot be farmed.
- Hint tokens: start with 3, +1 every 5 first clears, +3 per world, from the daily
  challenge, achievements and (optionally) rewarded videos. The written hint is always free.
  The first path hint each day is free, and a revealed path stays free for the rest of that
  attempt.
- The daily gift advances only when you claim it. Missing days never resets anything.
  A comeback bonus is offered once after 3+ days away. There are no notifications, timers
  that pressure you, or pay-to-win items. Cosmetics are purely visual.

## Rewarded ads

`src/game/ads/AdProvider.ts` defines `initialize()`, `isRewardedAdAvailable()` and
`showRewardedAd(onReward, onClosed, onError)`. Rewards are granted only from `onReward`
with a unique transaction id. `RewardManager.applyAdReward` rejects duplicate ids and
enforces a daily cap (3 hint tokens per day). `guardCallbacks` makes each callback fire at
most once. Ads are only offered from the hint dialog and the cosmetics screen, never during
active play.

Providers:
- **MockAdProvider**: development only. It shows an overlay labelled "MOCK AD ·
  DEVELOPMENT ONLY" that contacts no network. Closing it early grants nothing. It is the
  default in `npm run dev`, or set `VITE_AD_PROVIDER=mock` for a build.
- **NoAdProvider**: the production default. Ads are unavailable and players use earned
  tokens instead.
- **NativeBridgeAdProvider**: used automatically when a native wrapper exposes
  `window.ParadoxNativeAds` (`isReady()`, `show({reward, closed, error})`).

**What a real provider needs.** A plain browser PWA cannot load native mobile ad SDKs such
as Google AdMob. To show real rewarded videos on Android, wrap the build in a native shell
(for example Capacitor, or a Trusted Web Activity with a companion native module). Add the
SDK and your AdMob app and ad-unit IDs there, and implement the `ParadoxNativeAds` bridge
by calling `reward(txId)` only from the SDK's *user earned reward* callback (ideally after
server-side verification). Web ad networks with rewarded formats (for example Google Ad
Manager rewarded ads for the web) would need their own adapter class implementing
`AdProvider`, plus account approval. No credentials or ad IDs are stored in this
repository. Update the privacy screen and policy when a real network is added.

## Saves

Progress is saved to `localStorage` (`paradox.save`) immediately after important events.
The save is versioned (`SAVE_VERSION`), validated field by field, and migrated from older
layouts. Malformed data never crashes the game: it is copied to `paradox.save.corrupt` and
a fresh save starts. Settings offer export/import (copy a code or download a file), and a
reset that asks for confirmation first. Saves are local to the browser and do not sync
between devices.

## Deploying (Cloudflare Pages or any static host)

The build is fully static, and `base: './'` makes it work from any path.

- **Cloudflare Pages**: create a project from this repository with
  *Root directory* `paradox`, *Build command* `npm run build`, *Build output directory* `dist`,
  and Node 22 (set the `NODE_VERSION=22` environment variable; Vite 8 needs Node 20.19+ or 22.12+). No server functions are required.
- **Any static host**: run `npm run build` and upload `dist/`. Serve it over HTTPS so the
  service worker and install prompt work.

Leave `VITE_AD_PROVIDER` unset in production unless you want the mock.

## Known limitations

- Rewarded ads use the mock or no provider. A real network needs a native wrapper or a web
  ad-network adapter and credentials (see above).
- The 3D look and frame rate were checked in headless Chromium (software WebGL) at phone
  portrait, phone landscape and desktop sizes. They have not been profiled on physical
  mid-range Android phones. The renderer lowers resolution automatically if frames drop, and
  offers Low/Medium/High quality. Changing anti-aliasing (on for Medium and High) takes
  effect after a reload.
- The optional "retry reward" ad mentioned as possible in the design is not implemented,
  because undo and restart are already free.
- Only English is included. Strings for the interface live in `src/i18n`, but level text is
  stored with the level data.
- Hints in echo levels follow the stored solution. If an attempt has diverged, the hint
  suggests undoing to the last matching move rather than searching, because searching echo
  states is too expensive to run on a phone.
- Two of the hardest echo levels (72 "Shadow Play" and 80 "The Timeless Core") use
  hand-written solutions. The BFS budget is too small to search them, but the tests still
  replay those solutions through the engine.
