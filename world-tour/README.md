# World Tour — Open World Travel Simulator (Unity prototype)

A 3D travel game for Android built with Unity and C#. This folder is a separate Unity project; it does not touch the rest of the repository.

## Open and play

1. Install Unity **2021.3 LTS or newer** (2022.3 and Unity 6 should also work) with **Android Build Support**.
2. In Unity Hub choose **Add → Add project from disk** and select this `world-tour` folder.
3. Open any scene (a new empty scene is fine) and press **Play**. The game creates everything from code at startup (`GameBootstrap`), so no scene setup is needed.
4. Player Settings → *Active Input Handling* must be **Input Manager (Old)** or **Both** (the default in new projects).

Controls: WASD/arrows + mouse drag on desktop; on-screen joystick + drag-to-look on touch screens. **E** or the on-screen button visits a landmark. **Esc**/Android Back opens the pause menu.

### Android build
File → Build Settings → Android → *Switch Platform*, add the open scene, then *Build*. Recommended: IL2CPP, ARM64, landscape orientation.

## Layout

```
Assets/WorldTour/
  Resources/WorldTourData/   countries.json, airports.json, destinations.json, economy.json
  Scripts/Core/              engine-independent logic (no UnityEngine): data, economy, travel, saves, map math
  Scripts/Runtime/           Unity layer: UI screens, flight sequence, city builder, player, camera, input
Tests/CoreTests/             dotnet test runner for Core (dotnet run)
Tests/UnityCompileCheck/     compiles all scripts against UnityEngine 2021.3 reference assemblies (dotnet build)
Tools/convert_natural_earth.py   regenerates countries.json from Natural Earth GeoJSON
```

## Adding a destination

Add an entry to `destinations.json` (and its airport to `airports.json` if new). With `"detail": "mapOnly"` it appears on the map and in search. To make it explorable, set `"detail": "explorable"` and add an `environment` block (see Lahore). Landmark `type`s supported by `CityBuilder` are `mosque`, `fort`, `minar`, `bazaar`, and `generic`.

## Data and licences

- Country boundaries: [Natural Earth](https://www.naturalearthdata.com) 1:110m Admin 0 — public domain. Boundaries follow Natural Earth's default (de facto) view.
- Coordinates of cities, airports and landmarks are approximate public reference points.
- Fares and rewards are fictional game-economy values (`economy.json`), not real airline prices.
- All 3D content is generated from Unity primitives at runtime; no third-party models or textures.
