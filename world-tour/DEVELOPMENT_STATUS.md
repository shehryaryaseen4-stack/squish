# World Tour: Development Status

**Milestone 1 (first playable): code complete, not yet run inside Unity.**
There was no Unity Editor in the development environment. The work was verified as follows:
- `Tests/CoreTests`: 58 automated checks on the engine-independent logic, all passing.
- `Tests/UnityCompileCheck`: every script compiles against the UnityEngine 2021.3 reference assemblies, with warnings treated as errors.
- The world map image was rendered and checked by eye.

Gameplay feel, visuals, performance and the Android build have **not** been tested. The first job is to run it in the Editor.

## Browser preview

`WebPreview/` contains a single-page browser version of the same milestone, built from the same JSON data, so the game can be tried from a link without Unity. It uses Three.js and saves progress in the browser.
- Build it with `python3 -I WebPreview/build.py out.html` (add `--standalone` to open the file directly).
- The full loop was played through in headless Chromium on desktop and phone sizes: book ISB→LHE (−120), first-visit reward (+200), four landmark visits (+75 each), then reload and Continue. There were no console errors.
- The Unity project is still the main target; the preview is for quick checking only.

## Completed

- **Project setup.** Separate Unity project in `world-tour/`; the rest of the repo is untouched. The game starts itself from code, so no scene authoring is needed.
- **Data-driven world.** Countries, airports, destinations and economy settings live in JSON and are separate from presentation code.
- **World map.**
  - Real borders for 177 countries from Natural Earth (public domain), drawn into a 2048×1024 texture at startup.
  - Zoom with buttons, mouse wheel or pinch; pan by dragging.
  - Country names appear by zoom level. Airports appear at zoom ≥4; landmarks, mountains, lakes and coasts appear at zoom ≥7.
  - Tapping a country shows its info. Destination search matches name, country, airport code or landmark.
  - Legend distinguishes the current location, explorable 3D destinations, and map-only destinations.
- **Destinations.** 13 destinations in all 7 requested countries:
  - Pakistan: Lahore, Islamabad, Karachi, Hunza, Skardu.
  - France: Paris. UAE: Dubai. Japan: Tokyo. Italy: Rome. UK: London.
  - Switzerland: Zurich, Zermatt, Interlaken.
- **Player profile.**
  - Starting coins and starting city come from `economy.json`.
  - Visited destinations and landmarks, flight count, and totals spent and earned.
  - Spending history (last 200 transactions).
- **Travel booking.**
  - Fares are computed from great-circle distance plus surcharges (fictional values).
  - Route rules: international airports connect worldwide; regional airports (GIL, KDU) connect only to domestic hubs.
  - The confirmation shows the balance before and after.
  - If the player can't afford a flight, the shortfall is shown with ways to earn coins.
- **Simulated flight.** Boarding, takeoff, cruise and landing, with the plane moving along the great-circle route on the map. Skippable.
- **Arrival screen.** Pays a first-visit reward.
- **Explorable 3D destination: Lahore.** Built from data by `CityBuilder`:
  - Road grid, city blocks with varied buildings, pocket parks and an arrival plaza.
  - Four landmarks: Badshahi Mosque, Lahore Fort, Minar-e-Pakistan in a park, and Anarkali Bazaar.
  - The layout is stylised and compressed, not to real scale.
- **Exploring on foot.**
  - Third-person walking character with a camera that avoids clipping through walls.
  - On-screen joystick plus drag-to-look on touch; WASD and mouse on desktop.
  - Sightseeing objectives, a "next sight" direction arrow with distance and compass heading, and a Visit button that pays a one-time reward.
- **Menus.** Main menu (Continue / New Game / Settings / Quit) and pause menu (Resume / Save / World map / Profile / Settings / Main menu).
- **Settings.** UI size, graphics quality, camera sensitivity, and reset progress. Android Back button supported.
- **Saving.**
  - Autosaves after every purchase, landing and landmark visit, and when the app is paused or closed. Manual save from the pause menu.
  - A flight in progress resumes after reload.
  - A corrupt save is moved aside instead of crashing the game.

## Known limitations

- Only **Lahore** has a 3D area. Booking to the other 12 destinations is blocked with the message "3D area not built yet". So after Lahore there is currently nowhere new to fly.
- The only ways to earn coins are the first-visit reward and landmark rewards. There are no daily challenges or missions yet.
- The UI uses Unity IMGUI, which works but is not optimal for mobile. Plan: move to uGUI or UI Toolkit.
- The 3D world is built from primitives with flat colours. There are no textures, animated characters, NPCs, traffic, vehicles, taxis, hotels, restaurants or shops yet.
- The map is a single 2048×1024 raster from 1:110m data, so it gets blurry at high zoom and small islands are missing.
- There are no airport or airplane interiors; the flight is a map sequence.
- Disputed borders follow Natural Earth's default view.

## Remaining (by phase)

- **Phase 2:** driveable vehicle (enter/exit, steering, braking, camera).
- **Phase 3:** airport arrival area in 3D; second explorable city (e.g. Islamabad or Paris) so destination switching is exercised end to end.
- **Phase 4:** taxis, rentals/purchase, fuel/repair, hotels, restaurants, shops, souvenirs, more earning activities, daily challenges, achievements.
- **Phase 5:** more destinations and landmark builders; higher-resolution map tiles (Natural Earth 1:50m/10m, optionally OpenStreetMap-derived city data with attribution).
- **Phase 6:** world streaming (Addressables / downloadable region packs), LODs, NPCs and traffic, texture atlases, Android profiling.
- **Phase 7:** device testing, save/load QA, signed Android build.

## Next recommended step

Open the project in Unity 2021.3+ and play through the full loop:

**New Game → book Islamabad→Lahore → flight → arrival → walk to all 4 landmarks → save → reload.**

Fix any runtime issues, then make one Android test build and check the frame rate and touch controls. After that, start Phase 2 (driveable vehicle in Lahore).
