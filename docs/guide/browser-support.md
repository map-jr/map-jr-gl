# Browser support

This page says what a browser needs to show a map, which renderer each browser uses, and which browsers the tests
run in. It applies to both entries, `@map-jr/map-jr-gl` and `@map-jr/map-jr-gl/maplibre-compat`.

## What a browser needs

| Requirement | Without it |
|---|---|
| WebGL2 | `supported()` returns `false`, and the map shows "This browser cannot show the map." in its container. |
| ES modules | The library does not load. The package has no CommonJS build and no build for a classic script. |
| ES2022 syntax | The built files do not parse. A bundler can compile them for an older browser. |

To show other content in a browser without WebGL2, call `supported()` before you create the map:

```js
import {createMap, supported} from '@map-jr/map-jr-gl';

// The page has <div id="map" style="height: 400px"></div>.
const container = document.getElementById('map');
if (supported()) {
  createMap(container, {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
  });
} else {
  container.textContent = 'This browser cannot show the map. The office is at 1 Centre Street, New York.';
}
```

`@map-jr/map-jr-gl/maplibre-compat` exports `supported()` too. See
[A browser without WebGL2](../api.md#a-browser-without-webgl2) to change the text that the map shows.

## What each renderer needs

The worker renderer draws the map in a worker, and the main-thread renderer draws it on the page. The option
`renderer` selects one of them. Its default, `'auto'`, selects the worker renderer when the browser has what it needs.
[Loading](loading.md#change-where-and-how-the-map-loads-its-files) says where each entry sets the option.

| Feature | What it needs | Without it |
|---|---|---|
| Worker renderer | `transferControlToOffscreen` on a canvas, and WebGL2 in a worker | The map draws on the main thread. |
| Main-thread renderer | WebGL2 on the page | The map shows no map, as in "What a browser needs". |
| Tile workers | A page that is allowed to start workers | The map builds the tiles on the main thread and writes a warning. |
| Elevation tiles: 3D terrain, hillshade, contour lines, elevation queries | `OffscreenCanvas` with a 2D context, and `createImageBitmap`, in a worker | The map does not decode elevation tiles. |

The map also changes to the main thread after it started, when the worker loses its WebGL context before its first
frame, loses it twice in 10 seconds, or draws nothing in the 5 seconds after its start.

To read the renderer that the map uses, read `map.state.get().renderer` in `@map-jr/map-jr-gl`, or `map.renderer` in
`@map-jr/map-jr-gl/maplibre-compat`. Read it after the map has loaded: before that, `state.renderer` is `undefined`
and `map.renderer` is `'main'`.

```js
import {createMap} from '@map-jr/map-jr-gl';

// The page has <div id="map" style="height: 400px"></div>.
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});
map.state.subscribe(state => state.renderer, renderer => console.log(renderer));
```

## Browsers that the tests run in

After each change, the workflow [Browsers](https://github.com/map-jr/map-jr-gl/tree/bench-results) runs the
behaviour tests and the benchmark page in the builds of Chromium, Firefox and WebKit that Playwright ships, on
virtual machines. The machines for Linux and Windows draw WebGL in software. The branch lists the result of each
test.

| System | Chromium | Firefox | WebKit |
|---|---|---|---|
| macOS | Worker renderer | Worker renderer | Worker renderer |
| Linux | Worker renderer | Worker renderer | Main-thread renderer, because WebKit has no WebGL2 in a worker there |
| Windows | Worker renderer | Worker renderer | Main-thread renderer, because WebKit has no `OffscreenCanvas` there, so elevation tiles are not decoded |

The WebKit of Playwright is not Safari. Safari 27.2 on macOS and Safari 26.5 in the iOS Simulator load the map,
when the workflow is started with Safari by hand. On the virtual machine for macOS, the worker renderer of Safari
takes several seconds to become idle.

## Browsers that no test covers

No test runs in these browsers. Their support is not known:

- a real iPhone or iPad, and Android in any browser;
- Safari before 16.4, which has no `OffscreenCanvas` in workers;
- Safari on a Mac with a GPU;
- a real GPU on Linux or Windows;
- the released builds of Chrome, Edge and Firefox.

To try a browser of this list, open [the benchmark page](https://map-jr.github.io/map-jr-gl/bench/) of the gallery
site in it. The page shows the GPU that the browser reports, and loads the map with each renderer.

## See also

- [Loading](loading.md) for the option `renderer` and what happens when a worker cannot start.
- [Size and speed](size-and-speed.md) for the speed of each browser of the workflow.
- [Getting started](getting-started.md) to show a first map.
