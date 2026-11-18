# Design: sky and fog

This file plans support for the root property `sky` of a style (MapLibre style specification) and the methods
`setSky` and `getSky` of the entry `@map-jr/map-jr-gl/maplibre-compat`. Today the library does not draw `sky`,
`setSky` has no effect and `getSky` returns `undefined` (`src/compat-map.ts:149`, `:437`). The plan comes from a
reading of MapLibre GL JS 6.17 and of this library on 2026-11-18. Claims marked "estimated" are not measured.

## Parts

The parts ship as three pull requests, in this order. Part B needs part A, because the horizon is in view only above
a pitch of about 64° (estimated: at pitch 60 the horizon is 0.74 of the height above the centre).

| Part | What it does | Estimated lines | Estimated size (gzip) |
|---|---|---|---|
| A | `maxPitch` up to 180, with a far plane and a tile cover that stop at the horizon, and the elevation of the camera above 90 | more than 30 | worker +150 B for the horizon; more for the elevation, not estimated |
| B | The sky gradient above the horizon, and fog on 3D terrain, in Mercator | 45 | worker +0.6 to 0.9 KB, compat page script +80 B |
| C | The atmosphere around the globe: first a simple halo (the owner's decision of 2026-11-18) | under 50 for the halo; 200 for a port | worker under 0.5 KB for the halo; +1.5 to 2 KB for a port |

### A. Pitch up to 180

- `setMaxPitch` caps the pitch at 60 (`src/map.ts:1000`); the constructor option does not. Raise the cap to 180, as
  MapLibre GL JS allows (the owner's decision of 2026-11-18). The default stays 60. Above 90 the camera looks up, so
  it needs its elevation (`setCenterElevation`, a no-op today), and the render tests `high-pitch/pitch95*` check it.
- The far plane in `tileMatrix4` (`src/geo.ts:318`) cuts the ground at about 4 times the camera distance at pitch 85,
  while the horizon of MapLibre GL JS is at about 7.6 times. Port the horizon of MapLibre GL JS
  (`getMercatorHorizon`, `mercator_transform.ts:880-917`): the horizon is at
  `d · min(0.85 · tan(90° − pitch), tan(89.25° − pitch))`.
- `screenToMerc` (`src/geo.ts:253`) clamps a ray at 0.02 of the camera distance, so the tile cover reaches about 16.7
  times the distance. Clamp it at the horizon instead. The cover (`coveringPitched`, `src/geo.ts:452`) already takes
  lower zooms far away: at 1024×768, zoom 14 and pitch 85 it gives 55 tiles on zooms 11 to 14 today (measured; 18 at
  pitch 60).
- The background quad (`src/gl.ts:1009-1017`) stops at the horizon.
- Labels with a perspective ratio below 0.6 are hidden, as `perspectiveRatioCutoff` of MapLibre GL JS does
  (`collision_index.ts:100,169`), in `src/placement.ts:165`.
- `test/conformance/render.mjs:96` passes `maxPitch` of the metadata of a test.

Risks: the terrain cover stops at 96 tiles (`src/engine.ts:572`); `unproject` and queries above the horizon; the
precision of a 16-bit depth buffer with a far plane about 80 times the near plane.

### B. Sky and fog in Mercator

- `sky` reaches the engine as `light` does (`src/resolve.ts:61-70`, `:222`, then `Scene` in `src/gl.ts`), and its
  values are evaluated with `compileProp`, so zoom functions and global state work.
- After the clear, one quad draws the sky. Let `blend` be the device pixels above the horizon line and
  `band = sky-horizon-blend · height / 2`. Inside the band the colour is `mix(sky-color, horizon-color, (1 − blend/band)²)`;
  above it the colour is `sky-color`. Nothing is drawn below the line.
- Fog exists in MapLibre GL JS only with 3D terrain and only in Mercator, in the fragment shader of the terrain:
  - `fogDepth` is 0 at the centre of the map and 1 at the far plane. Here it comes from `gl_Position.w` and one
    uniform with the near and far distances.
  - `opacity` is 0 below a pitch of 60 and rises linearly to 1 at 70.
  - `factor = (max(fogDepth − fog-ground-blend, 0) / (1 − fog-ground-blend))² · opacity`.
  - The fog colour is `mix(fog-color, horizon-color, smoothstep(0, 1, (fogDepth − horizon-fog-blend) / (1 − horizon-fog-blend)))`,
    and the result is `mix(surface, fog colour, factor)` in linear space (gamma 2.2).
- `setSky` and `getSky` edit the style as `setLight` does (`src/map.ts:1246`).
- The defaults of the specification are `sky-color` `#88C6FC`, `horizon-color` and `fog-color` `#ffffff`,
  `fog-ground-blend` 0.5, `horizon-fog-blend` 0.8, `sky-horizon-blend` 0.8 and `atmosphere-blend` 0.8. A style with no
  `sky` draws no sky and no fog.
- Not covered: transitions of the sky values, roll, and the server renderer.

### C. The atmosphere on the globe

First a simple halo: a radial gradient in the sky colours around the globe. A port of `atmosphere.fragment.glsl` and `drawAtmosphere` (`webgl/draw/draw_sky.ts`) of MapLibre GL JS: the sun
position comes from `light`, and the blend is `atmosphere-blend` times the transition of the projection, follows only if the halo is too far from the render tests. The worker
pays for it on every map, because the globe code is built into the worker file (`src/engine.ts:673`).

The halo shipped with #888 (worker +365 B gzip). It changes none of the 15 render tests of the atmosphere, because those tests show the scattering over the globe itself (a lit day side, a dark night side and a blue tint at zoom 5), and not a band around it.

## Render tests

All 26 tests under `sky/` are labelled "later" in `test/conformance/render-expectations.json`. The tests without
terrain (`sky-color`, `sky-horizon-blend`, `horizon-color`, `roll/roll-0`) are the checks of part A and B; the tests
with terrain (`fog-color`, `fog-ground-blend`, `horizon-fog-blend`, `terrain/fog*`) are the checks of fog; and
`atmosphere-blend/*` with `projection/globe/atmosphere/*` are the checks of part C.

## Licence

The shaders and formulas follow MapLibre GL JS (BSD-3-Clause). A pull request that copies or closely translates its
GLSL adds the notice to `THIRD-PARTY-LICENSES.md` and a line to `ACKNOWLEDGEMENTS.md`.
