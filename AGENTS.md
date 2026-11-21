# Map Jr. GL for coding agents

This file is for an agent that works in a project that installs `@map-jr/map-jr-gl`. It ships in the package at
`node_modules/@map-jr/map-jr-gl/AGENTS.md`. An agent that works on the library itself follows `CLAUDE.md` in the
repository.

Map Jr. GL is a WebGL map library that reads MapLibre styles. It has two entries for the same map, and the choice
decides which API you write.

| Entry | Import from | Use it for |
|---|---|---|
| Main API | `@map-jr/map-jr-gl` | New code. One description object (`MapDescription`) states the map. |
| Compat entry | `@map-jr/map-jr-gl/maplibre-compat` | Code and plugins written for MapLibre GL JS 6. |
| Adapters | `@map-jr/map-jr-gl/vue`, `/nuxt`, `/react`, `/svelte`, `/element` | Components and the element `<map-jr>`, built on the main API. |

## Read the docs of the installed version

The package contains its documentation as markdown, so you read the version that the project uses.

- `node_modules/@map-jr/map-jr-gl/docs/guide/which-entry.md` chooses the entry.
- `node_modules/@map-jr/map-jr-gl/docs/reference/` has every option, method, event and type.
- `node_modules/@map-jr/map-jr-gl/docs/recipes/` has complete examples.
- `node_modules/@map-jr/map-jr-gl/docs/maplibre-compatibility.md` lists each difference from MapLibre GL JS.
- The same pages are at `https://map-jr.org/raw/<path>.md`, and `https://map-jr.org/llms.txt` lists them.

## Migrate from MapLibre GL JS

Follow `node_modules/@map-jr/map-jr-gl/docs/migrate/prompt.md`. It tells you how to find the use of MapLibre GL JS,
which entry to choose, which names change, what not to do, and how to check the result. The pages beside it hold the
steps with code: `from-maplibre.md`, `compat-to-main-api.md` and `wrappers.md`.

## Rules

- Look up each name in `docs/reference/` before you use it. Do not assume that a method of MapLibre GL JS exists in
  the main API.
- Import the compat entry by its full path (`@map-jr/map-jr-gl/maplibre-compat`). Do not mix both entries on one map.
- The library loads its own worker file and adds its own styles. Do not import `maplibre-gl.css` or set a worker URL.
- `queryRenderedFeatures` and `querySourceFeatures` of the compat entry return promises: use `await`.
- The development build (Vite and Nuxt select it in development) writes a warning that starts with `[map-jr-gl]` for
  a mistake or for an option that has no effect. Read the browser console after a change and fix each warning.
- Check a type error against `node_modules/@map-jr/map-jr-gl/dist/types/` before you change the code that reports it.
