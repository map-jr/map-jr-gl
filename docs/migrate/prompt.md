# Migration prompt

This page has one prompt for a coding agent (Claude Code, Codex, Cursor and similar tools) that moves an application
from MapLibre GL JS to Map Jr. GL. Install the package first (`npm install @map-jr/map-jr-gl`), then copy the block
below into the agent. On this site, the button "Copy migration prompt" copies it. The agent reads the pages of
[Migrate](from-maplibre.md) from `node_modules/@map-jr/map-jr-gl/docs/`, so the package must be installed before it
starts.

```text
Migrate this project from MapLibre GL JS (the package `maplibre-gl`, or a wrapper such as react-map-gl) to Map Jr. GL (the package `@map-jr/map-jr-gl`). Work in the steps below and do not skip the checks.

## 1. Find the use of MapLibre GL JS

Search the source for `maplibre-gl`, `react-map-gl`, `vue-maplibre-gl`, `svelte-maplibre` and `@vis.gl`. List each file and each plugin or wrapper that you find, and what each one uses (Map, Marker, Popup, controls, sources, layers, events, queries). Read the version of `maplibre-gl` in `package.json`: the compat entry has the API of MapLibre GL JS 6.

## 2. Read the documentation of the installed package

The docs are in `node_modules/@map-jr/map-jr-gl/docs/`. Read these before you change code, and read a reference page when you need an exact name:

- `migrate/from-maplibre.md` for the compat entry.
- `migrate/compat-to-main-api.md` for the main API.
- `migrate/wrappers.md` for wrappers and plugins.
- `maplibre-compatibility.md` for every difference and for what is not available.
- `reference/` for `MapDescription`, the map and the state. `guide/which-entry.md` for the choice of entry.

## 3. Choose the entry

- The project uses a wrapper or a plugin for MapLibre GL JS that you must keep, or it uses many calls of the map such as `addLayer`, `setPaintProperty` and `on`: use the compat entry `@map-jr/map-jr-gl/maplibre-compat`. This is the default choice. It needs the fewest changes.
- The project has few map calls, or it is a Vue, Nuxt, React or Svelte application that can use the adapter (`@map-jr/map-jr-gl/vue`, `/react`, `/svelte`), or it is plain HTML (`@map-jr/map-jr-gl/element`): use the main API (`@map-jr/map-jr-gl`). Do this only when the user asked for it or when the code is small. Never mix both entries on one map.

Say which entry you chose and why, in one sentence, before you edit.

## 4. Apply the mapping

Compat entry:

| Before | After |
|---|---|
| `import ... from 'maplibre-gl'` | `import ... from '@map-jr/map-jr-gl/maplibre-compat'` |
| `import 'maplibre-gl/dist/maplibre-gl.css'` | Remove it. The library adds its styles. |
| `setWorkerUrl(...)`, `workerUrl` of react-map-gl, imports of `maplibre-gl-worker` | Remove them. |
| `map.queryRenderedFeatures(...)`, `map.querySourceFeatures(...)` | `await` the call. The result is a promise. |
| `getCanvas().toDataURL()` with `preserveDrawingBuffer` | `await map.toBlob('image/png')` |
| `map.transform`, `map.painter` and other private members | A public method such as `map.getZoom()`. |
| A custom layer (`type: 'custom'`) | Create the map with `renderer: 'main'`. |
| A wrapper or plugin that imports `maplibre-gl` itself | An alias of the exact name `maplibre-gl` to `@map-jr/map-jr-gl/maplibre-compat` in the bundler (`/^maplibre-gl$/` as a pattern, not a prefix). Keep `maplibre-gl` installed for its types. |

Main API (see `migrate/compat-to-main-api.md` for the full table):

| Before | After |
|---|---|
| `new Map({container, style, center, zoom})` | `createMap(container, {style, initialView: {center, zoom}})` |
| `addSource`, `addLayer` in `load` | `sources` and `layers` of the description |
| `setPaintProperty`, `setFilter`, `getSource(id).setData(data)` | `map.patch({layers})` or `map.patch({data: {[id]: data}})` |
| `map.on(type, fn)` | `map.listen(type, fn)`, which returns a function that removes the listener |
| `new Marker()`, `new Popup()` | `map.overlay(element, {lngLat, popup})` |
| `addControl(new NavigationControl())` | `controls: [navigation()]` from `@map-jr/map-jr-gl/controls` |
| `map.remove()` | `map.destroy()` |

## 5. Do not

- Do not remove `maplibre-gl` from `package.json` while a wrapper, a plugin or the types of the project still import it. When nothing imports it any more, remove it with the package manager and report that you did.
- Do not use an API that the docs do not list. Look up each name in `reference/` or in `maplibre-compatibility.md`; do not guess a method from MapLibre GL JS.
- Do not write an alias that matches `maplibre-gl/dist/...`. The build stops.
- Do not copy the style of a layer that the library cannot draw (video and canvas sources, `within` and `distance`, MapLibre Tiles). Report it to the user.
- Do not rewrite the application. Change imports, calls and options only, and leave the structure of the code.
- Do not add `strict: true` or a workaround to the final code. Remove `strict: true` after the check in step 6.
- Do not mark the work as done before the checks in step 6 pass.

## 6. Check the result

1. Run the type check and the build of the project (`tsc --noEmit`, `npm run build` or the equivalent) and fix each error.
2. Compat entry only: create the map with `strict: true` while you check. An option or a call that the map cannot carry out then throws an error, so you find each use of something that is not available.
3. Start the development server of the project (Vite and Nuxt load the development build of the library) and open the page. Read the browser console. The development build writes a warning that starts with `[map-jr-gl]` for each option or call that has no effect, and for common mistakes. Fix each warning, or tell the user why you left it.
   If you cannot run a browser, say so in the report instead of skipping the check in silence.
4. Confirm that the map reaches the `idle` event (`map.on('idle', ...)` in the compat entry, or the `idle` event of `map.listen` in the main API) and that the layers draw.

## 7. Report

End with a list of the files that you changed, the entry that you chose, each warning that remains, and each part of MapLibre GL JS that the project uses and that the library does not have.
```

The block above is also served as plain markdown at `https://map-jr.org/raw/migrate/prompt.md`.

## See also

- [From MapLibre GL JS](from-maplibre.md) for the steps and the differences, each with code.
- [Wrappers and plugins](wrappers.md) for the alias in each bundler.
- [From the compat entry to the main API](compat-to-main-api.md) for the move to the main API.
