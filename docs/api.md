# The main API

The entry `map-jr-gl` makes a map from one description. To change the map, you give a new description. The library
finds what is different and changes only that. The state of the map is in a store that your code can watch.

This model fits how the library works: the map draws in a worker, and one description goes to it as one message.
It also fits frameworks, which describe what the page must show and do not call methods one after the other.

For the API of MapLibre GL JS (`new Map`, `map.addLayer`), use the entry `map-jr-gl/maplibre-compat`. See
[MapLibre compatibility](maplibre-compatibility.md).

## Make a map

```js
import {createMap} from 'map-jr-gl';

const map = createMap(document.getElementById('map'), {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});
```

`createMap(container, description)` returns the map. The container is an element or the `id` of an element. The map
fills the container, so give the container a height.

### A browser without WebGL2

The map requires WebGL2. `supported()` returns `false` in a browser that has no WebGL2, so that the application
can show other content. The first call makes a WebGL2 context on a canvas that is not in the page, and later calls
return the same answer.

```js
import {createMap, supported} from 'map-jr-gl';

const container = document.getElementById('map');
if (supported()) {
  createMap(container, {
    style: 'https://tiles.openfreemap.org/styles/liberty',
    initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
  });
} else {
  container.textContent = 'This browser cannot show the map. Our address is 1 Example Street.';
}
```

A map that is made in such a browser does not load. It reports one error (`onError` and `state.error`) with the
message `[map-jr-gl] The map cannot be shown: WebGL2 is not available. Call supported() before you make a map, and
show other content when it returns false.` It also puts an element into the container with the class
`map-jr-unavailable` and the text "This browser cannot show the map.". The element fills the container. To change
its look, write CSS rules for `.map-jr-unavailable`: a rule of the application wins over the rule of the library.
To show other text, set the `textContent` of that element in `onError`, or hide the element with `display: none`.
`destroy()` removes the element. `supported()` does not test whether a worker can draw: where a worker cannot, the
map draws on the main thread (see [Loading](loading.md)).

## Change the map

```js
let description = {style, initialView, markers: [pins]};
const map = createMap(container, description);

// Later: other markers. Give the complete description again.
description = {...description, markers: [{...pins, data: newData}]};
map.update(description);
```

`update` takes the complete description, not only the changed fields:

- A description with no `style` throws an error, in `update` and in `createMap`. Write
  `map.update({...description, cursor: 'crosshair'})`, not `map.update({cursor: 'crosshair'})`.
- A field that the new description leaves out is removed from the map. This holds for `markers`, `controls`,
  `cursor`, `extend` and the limits of the camera. A source keeps the last data that `data` gave it.
- The fields that are read when the map is made (`renderer`, `fonts`, `fontFamily`, `glyphs`, `interactive`,
  `antialias`, `attribution`, `hash`) and `initialView` have no effect in `update`. A change of one of them gives a
  warning.

The map writes a warning to the console with `console.warn`, once for each map, for each of these mistakes:

- The container is in the page, is not hidden, and has height 0 one second after the map is made.
- An id in `interactiveLayers`, or in `layers` or `sources` of `queryFeatures`, is not in the style.
- A key of `data` is not the id of a GeoJSON source of the style.
- A layer of `extend` names a `before` layer or a source that the style does not have.
- Two marker layers have the same `id`.
- An option of `queryFeatures` has no effect in that kind of query.

The ids of the description are compared each time that the map is idle, so a layer or a source that the application
adds itself in `load` gives no warning.

The checks run in the development build only. `package.json` names that build under the `development` condition, so
a bundler that sets the condition takes it in development and takes the production build otherwise. Vite does so
(ran with Vite 8: the development server takes the development build, and `vite build` takes the production build).
Node.js resolves the development build with `--conditions=development`. Webpack and Nuxt are not checked. The
production build makes no request for the checks and gives none of these warnings.

| How the page gets `map-jr-gl` | Checks |
|---|---|
| A bundler in development that sets the `development` condition | Yes. The map loads a file of about 1.3 KB (gzip) after it has started. |
| A bundler that builds for production | No. |
| The file `dist/map-jr-gl.js` by URL, with no bundler | No. Import `dist/map-jr-gl.dev.js` instead while you develop. |
| The standalone file (`map-jr-gl/standalone`) | Yes. The checks are inside the file. |

When the file of the checks does not load, the map works and gives none of these warnings.

The library compares each field with the field of the last description:

- A field that is the same object as before is not looked at again. This is the fast path: keep the object when
  nothing changed.
- A field that is a new object is compared by its content (the style, the limits, the lists of layers and
  controls). So a description that your code makes again each time does not make the map do work.
- Marker data is compared by identity only, because it can be large. To change the markers of a layer, give a new
  `data` array. Do not change the old array in place. (The Vue component does this for you: see
  [Vue and Nuxt](vue.md).)

## The description

| Field | Meaning |
|---|---|
| `style` | A style object or the URL of a style (the MapLibre style specification). Required. A new object or URL is a new style. |
| `extend` | Your own sources and layers on a style from a URL. See below. |
| `initialView` | The view at the start: `center` (`[lng, lat]`), `zoom`, `bearing`, `pitch`. The user then moves the map. |
| `view`, `onViewChange` | A view that your application owns. See below. |
| `data` | GeoJSON data for GeoJSON sources, by the id of the source. The source is in the style or in `extend.sources`. See below. |
| `markers` | A list of marker layers, each with an `id`. See [Markers](markers.md). A layer with a new `data` array gets the new data. |
| `controls` | A list of controls. See below. |
| `interactiveLayers` | The ids of style layers. The features of these layers under the pointer are in `state.hover` and in `onClick`. |
| `onClick` | A function that is called for a click, with `point`, `lngLat` and `features`. |
| `onError` | A function that is called with each error of the map (an `Error`): a style or a source that does not load, a mistake in a style edit, a failure of the renderer. Use it to send errors to your error tracker. Without it, the map writes each error to the console with `console.error`. |
| `minZoom`, `maxZoom`, `maxPitch`, `maxBounds` | The limits of the camera. |
| `cursor` | The mouse cursor over the map. Without it, the cursor is a pointer over a feature of `interactiveLayers`. |

These fields are read only when the map is made:

| Field | Meaning |
|---|---|
| `renderer` | `'auto'` (the default), `'worker'` or `'main'`: the thread that draws. See [Loading](loading.md). |
| `fonts`, `fontFamily` | Web fonts for the labels. |
| `glyphs` | `false`: do not load the glyph files of the style (its `glyphs` URL). Text then uses the fonts of the device or the web fonts of `fonts`: no requests for fonts, and labels show at once. The default loads the glyph files, unless `fonts` is given. |
| `interactive` | `false` for a map that the user cannot move. |
| `antialias` | Multisample antialiasing for the canvas. |
| `attribution` | `false` to show the credits yourself, or options for the built-in credits. |
| `hash` | Keeps the view in the fragment of the URL. |

## Your own layers on a style from a URL

```js
createMap(container, {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  extend: {
    sources: {routes: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
    layers: [{id: 'routes', type: 'line', source: 'routes', before: 'water_name', paint: {'line-color': '#d6453d', 'line-width': 3}}],
    terrain: {source: 'dem', exaggeration: 1.5},   // if the style or `sources` has an elevation source
  },
});
```

`extend` adds sources and layers to the style when the style has loaded. A layer with `before` goes below the layer
with that id; without it, the layer goes on top. Give `extend` with other content to change the additions. (A style
from a URL is then requested again; the browser has it in its cache.)

## GeoJSON data that changes

Put the source into the style with no features, and give the data in the field `data`:

```js
const style = {
  ...baseStyle,
  sources: {...baseStyle.sources, routes: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
  layers: [...baseStyle.layers, {id: 'routes', type: 'line', source: 'routes', paint: {'line-color': '#d6453d', 'line-width': 3}}],
};

const map = createMap(container, {style, data: {routes: firstRoutes}});

// Later: other data. The style is the same object, so the map does not look at it again.
map.update({style, data: {routes: nextRoutes}});
```

- The data of each source is compared by identity. Give a new object to change it.
- Only the data goes to the map. A style with the data inside it would be compared and sent as a whole.
- The data stays when the style changes.
- The source can also be in `extend.sources`. Use this for a style from a URL: `extend` adds the source with no
  features, and `data` gives it the features.

```js
const extend = {
  sources: {routes: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
  layers: [{id: 'routes', type: 'line', source: 'routes', paint: {'line-color': '#d6453d', 'line-width': 3}}],
};
const url = 'https://tiles.openfreemap.org/styles/liberty';

const map = createMap(container, {style: url, extend, data: {routes: firstRoutes}});

// Later: other data. `extend` is the same object, so the style is not requested again.
map.update({style: url, extend, data: {routes: nextRoutes}});
```

## Controls

```js
import {navigation, scale, fullscreen, geolocate, terrain} from 'map-jr-gl/controls';

createMap(container, {
  style,
  controls: [navigation(), scale({position: 'bottom-left'}), fullscreen({position: 'top-left'})],
});
```

Each function returns the description of a control. The map adds the control, and removes it when a later
description does not have it. A page loads only the code of the controls that it imports.

| Function | Control | Options (each also has `position`) |
|---|---|---|
| `navigation` | Zoom buttons and a compass | `showZoom`, `showCompass` |
| `scale` | A scale bar | `maxWidth`, `unit` (`'metric'` or `'imperial'`) |
| `fullscreen` | A button for the full screen | |
| `geolocate` | A button that moves the map to the position of the user | `zoom`, `positionOptions` |
| `terrain` | A button that turns 3D terrain on and off | `source` (required), `exaggeration` |

The attribution of the data shows without a control of your own. To change it or to turn it off, see `attribution`
in [The description](#the-description).

## The state

`map.state` is a store. It has `get()` and `subscribe()`.

```js
map.state.get().view.zoom;

// Each change:
const stop = map.state.subscribe(state => { /* ... */ });

// Only when one part changes:
map.state.subscribe(state => state.hover, features => showTooltip(features[0]));

stop(); // stops the first subscription
```

| Field | Meaning |
|---|---|
| `loaded` | The style and the first tiles have loaded. |
| `idle` | Nothing moves and nothing loads. |
| `moving` | The camera moves. |
| `view` | `{center, zoom, bearing, pitch}` |
| `hover` | The features of `interactiveLayers` under the pointer, the top one first. |
| `renderer` | `'worker'` or `'main'`, when the map has started. |
| `error` | The last error only. An earlier error is not kept: use `onError` in the description to get each one. |

A state object never changes. Each change makes a new object, and a part that did not change is the same object as
before. This is the contract that frameworks use: `useSyncExternalStore` in React, a `shallowRef` in Vue, a store
in Svelte, `from` in Solid.

## A view that the application owns

```js
let view = {center: [-74.0065, 40.7085], zoom: 13.6, bearing: 0, pitch: 0};
const describe = () => ({style, view, onViewChange: next => { view = next; map.update(describe()); }});
const map = createMap(container, describe());

// To move the map, change the view:
view = {...view, zoom: 15};
map.update(describe());
```

The map draws in a worker, so it does not wait for your application. It reports each change of the view with
`onViewChange`. When your application gives a view back that the map reported, the map does not apply it again. Thus
a slow application does not pull the map back while the user moves it. A view that the map did not report moves the
map.

The map keeps the last 60 views that it reported, with no time limit. It ignores a `view` whose `center`, `zoom`,
`bearing` and `pitch` are all equal to those of one of them. So `update` with a view that your application stored a
moment ago (a button "back to where I was") can have no effect. For such a movement, call `map.moveTo(stored)`:
`moveTo` always moves the map.

To move the map one time with an animation, use `map.moveTo({zoom: 15, duration: 500})` or `map.fitBounds(bounds)`.

## Queries

There is one method to find features: `queryFeatures(at, options)`.

- **Where (`at`):** a point of the screen (`{x, y}`), a position (`[lng, lat]`), a rectangle of the screen (two points), or
  nothing for the whole map.
- **What (`options`):** without `sources`, the features that the style layers draw, the top one first (`layers` selects layers).
  With `sources`, the features of the tile data of those sources. These need no style layer, and at a position they
  need not be on the screen: the map fetches the tile if necessary.

```js
// The features that style layers draw at a point of the screen:
const drawn = await map.queryFeatures({x: 200, y: 150}, {layers: ['roads', 'places']});

// In a rectangle of the screen, and on the whole map:
const inBox = await map.queryFeatures([{x: 0, y: 0}, {x: 400, y: 300}], {layers: ['places']});
const all = await map.queryFeatures(undefined, {layers: ['places']});

// The data of a source at a position. You do not need a style layer for this, and the position can be off screen:
const data = await map.queryFeatures([-75.16, 39.92], {sources: ['rain']});

// All the features of a source in the tiles of the view:
const inView = await map.queryFeatures(undefined, {sources: ['rain'], sourceLayers: ['rain']});
```

The options (`FeatureOptions`) depend on the kind of query:

| Option | Meaning | Has an effect |
|---|---|---|
| `layers` | The ids of the style layers to look in. The default is all style layers. | Without `sources`. |
| `sources` | The ids of the sources to look in. With it, the query reads the tile data and not what the style layers draw. | |
| `sourceLayers` | The names of the layers of a vector tile source to look in. The default is all of them. | With `sources`. |
| `filter` | A filter expression of the MapLibre style specification, for example `['==', ['get', 'class'], 'park']`. The query returns only the features that pass it. | In each query. |
| `radius` | The distance around the place, in pixels of the screen, within which a feature is found. The default is 3. | With `sources`, at a point or a position. |
| `geometry` | `true` to give each feature a `geometry` (GeoJSON, in longitude and latitude). The default is `false`, which keeps the answer small. | With `sources`, at a point or a position. In each other query, the features always have a `geometry`. |

An option that has no effect in a query is ignored, and the map writes one warning for it: `layers` with `sources`,
`sourceLayers` without `sources`, and `radius` or `geometry: false` in a query that is not a query with `sources` at
a point or a position. A place that is not one of the three forms (for example `{lng, lat}`) in a query without
`sources` rejects the promise with an error that names the forms.

A feature of a query without `sources` has `id`, `properties`, `geometry`, `source`, `sourceLayer`, `layer` (the
style layer) and `state`. A feature of a query with `sources` has `id`, `properties`, `source`, `sourceLayer`,
`type` (`'Point'`, `'LineString'` or `'Polygon'`) and, as the table says, `geometry`.

`watchFeatures(at, options, listener)` asks the same question and keeps the answer up to date. The listener gets
the answer now, and again each time that it changes: new tiles, a change of the style, and (for a place on the
screen) a movement of the map. It returns a function that stops it. Use it in place of listeners for `idle` and
`sourcedata`:

```js
// The band of rain under a marker, also while the layers of the map change:
const stop = map.watchFeatures([-75.16, 39.92], {sources: ['rain']}, features => show(features[0]?.properties));
```

A query whose map goes away is rejected, so that code that awaits it does not wait for ever. This holds for
`queryFeatures` and for `queryElevation`:

| When | The promise rejects with an `Error` whose message is |
|---|---|
| `destroy()` is called before the answer has come, or the query is asked after `destroy()`. | `[map-jr-gl] The query has no answer: the map was removed.` |
| The browser takes the WebGL context away before the answer has come. | `[map-jr-gl] The query has no answer: the map lost its WebGL context. Ask again.` A query that is asked again waits for the new context and is answered then. |

Catch the error where a query can be open while the map is removed, for example in a handler of a component that
can unmount. `watchFeatures` needs no such code: it does not call its listener after `destroy()`, and after a lost
context it asks again by itself. When its listener throws, the browser reports the error as an unhandled rejection,
and the watch goes on.

For users of MapLibre GL JS: `queryRenderedFeatures` is `queryFeatures` without `sources`, and
`querySourceFeatures` is `queryFeatures(undefined, {sources: [id]})`. The two MapLibre methods are in the entry
`map-jr-gl/maplibre-compat`.

The tile data is in a worker, so each query returns a promise.

## Elements of the page on the map

```js
// A marker with your own content:
const el = document.createElement('img');
el.src = '/pin.svg';
const marker = map.overlay(el, {lngLat: [-74.0065, 40.7085], anchor: 'bottom'});

marker.update({lngLat: [-74.0, 40.71], anchor: 'bottom'}); // moves it
marker.remove();

// A popup: the element in a box with a pointer to the position.
const popup = map.overlay(content, {lngLat, popup: true, onClose: () => popup.remove()});
```

`overlay` puts an element of the page at a position of the map. The element moves with the map.

| Option | Meaning |
|---|---|
| `lngLat` | The position. Required. |
| `anchor` | The part of the element that is at the position: `'center'` (the default), `'bottom'`, `'top-left'` and others. |
| `offset` | A distance in pixels from the position, to the right and down. |
| `popup` | `true` to show the element in a box with a pointer to the position. |
| `onClose` | For a popup: the box gets a button to close it, and this function is called. |

Use an overlay for some elements with content of the page (a photo, a form, a popup). For many markers, use a
marker layer (`markers` in the description): it is drawn on the canvas, and 100,000 markers cost about the same
as ten. See [Markers](markers.md).

## Other members of the map

| Member | Meaning |
|---|---|
| `update(description)` | Changes the map to a new description. Takes the complete description. See [Change the map](#change-the-map). |
| `destroy()` | Removes the map and frees its memory. It can be called while the map loads. Call it before you make another map in the same element: a second map in an element that has a map leaves two canvases in the element, and the library warns in the console. |
| `moveTo(view)` | Moves the camera now. With `duration` (milliseconds), with an animation. |
| `fitBounds(bounds, options)` | Shows an area. |
| `queryFeatures(at, options)`, `watchFeatures(at, options, listener)` | Find features, one time or kept up to date. See [Queries](#queries). |
| `queryElevation(at)` | The height of the ground in metres at a position (`[lng, lat]`) or a point of the screen (`{x, y}`), from the elevation source of the style. A promise; `null` where there is no data. |
| `project(lngLat)`, `unproject(point)` | Change between a position on the map and a point of the screen. |
| `listen(type, fn)` | Calls `fn` for each event of that type. Returns a function that stops it. See [Events](#events). |
| `container` | The element of the map. |
| `map` | The map object behind this API, for a need that this API does not cover yet. It can change between versions. |

## Events

`map.listen(type, fn)` calls `fn` for each event of that type and returns a function that stops it. The state
(`map.state`) and the callbacks of the description (`onClick`, `onViewChange`, `onError`) cover the common needs;
use `listen` for the rest.

```js
import {createMap} from 'map-jr-gl';

const map = createMap('map', {style: 'https://demotiles.maplibre.org/style.json'});
const stop = map.listen('moveend', event => console.log(event.target.getZoom()));
stop();
```

A listener that throws does not stop the other listeners of the event. The map reports what it threw as an
`error` event (`onError` of the description gets it, or the console when there is no `onError`). What a listener
of `error` throws is written to the console.

Each event has `type` (the name of the event) and `target` (the map object, the `map` member above). The table
has the other members. In TypeScript, the type `MapEvents` has the event of each name, so the parameter of `fn`
has the right type, and a name that is not in the table does not compile.

| Type | When | Other members of the event |
|---|---|---|
| `load` | The style and the first tiles have loaded. | |
| `idle` | Nothing moves and nothing loads. | |
| `render` | The map has drawn a frame. | |
| `resize` | The size of the map has changed. | |
| `remove` | The map is removed. | |
| `movestart`, `move`, `moveend` | The view changes. | |
| `zoomstart`, `zoom`, `zoomend` | The zoom changes. | |
| `rotatestart`, `rotate`, `rotateend` | The bearing changes. | |
| `pitchstart`, `pitch`, `pitchend` | The pitch changes. | |
| `dragstart` | The user starts to drag the map. | |
| `click`, `dblclick`, `contextmenu`, `mousedown`, `mousemove`, `mouseup`, `mouseover`, `mouseout` | An event of the mouse on the map. | `point` (`{x, y}` in CSS pixels), `lngLat` (`{lng, lat}`), `originalEvent`, `preventDefault()`, `defaultPrevented`. `click` also has `marker`: the marker of a marker layer at the point as `{layer, index, marker}`, or `null`. |
| `wheel` | The user turns the wheel over the map. | The same as for the mouse; `originalEvent` is a `WheelEvent`. |
| `touchstart`, `touchmove`, `touchend`, `touchcancel` | An event of a touch on the map. | The same as for the mouse, and `points` and `lngLats`: one entry for each finger on the map. |
| `markerclick` | A click on a marker of a marker layer. See [Markers](markers.md). | The same as for the mouse, and `layer`, `index`, `marker`. |
| `markerenter`, `markerleave` | The pointer comes to a marker of a marker layer, or leaves it. | `layer`, `index`, `marker`. |
| `boxzoomstart`, `boxzoomend`, `boxzoomcancel` | A zoom to a box (the Shift key and a drag). | `originalEvent`. `boxzoomend` also has `boxZoomBounds`. |
| `styledata`, `style.load` | The style has changed; a complete style has loaded. | `styledata` has `dataType: 'style'`. |
| `sourcedata` | A source has new data. | `dataType: 'source'`, `sourceId`, `isSourceLoaded`, `source`. |
| `data` | Each time that `styledata` or `sourcedata` fires. | The members of that event. |
| `styledataloading`, `sourcedataloading`, `dataloading` | A style or a source starts to load. | `dataType`, and `sourceId` for a source. |
| `styleimagemissing` | The style names an image that the map does not have. | `id`. |
| `terrain` | The terrain has changed. | `terrain`: `{source, exaggeration}` or `null`. |
| `stats` | At most one time each second while the map draws. | `fps` (frames per second), `frameMs` (the CPU time of a frame in milliseconds). |
| `geolocate` | The geolocate control has a position. | `coords`. |
| `webglcontextlost`, `webglcontextrestored` | The browser has taken the WebGL context away, or the map has it again. The map starts again on a new canvas with the same view and data. A map with the worker renderer starts again on the main thread and writes one warning when the worker loses the context before its first frame, loses it twice within 10 seconds, or does not draw in the 5 seconds after a restart (it reports no first frame, or stops drawing after it). When the main thread then loses the context again before its first frame, or does not draw in the 15 seconds after the restart, the map fires `error` and does not start again. The time that the page is hidden, or that the map has no size, does not count. | |
| `error` | An error of the map. `onError` and `state.error` have the same errors as an `Error`. | `error`. |

In a mouse event, `lngLat` is an object (`{lng, lat}`). In `onClick`, `lngLat` is an array (`[lng, lat]`).

## Types

The entry `map-jr-gl` has TypeScript types for the description (`MapSpec`), the map (`MapHost`), the state
(`MapState`), the events (`MapEvents`) and the features (`RenderedFeature`, `QueriedFeature`).

- A position that you give (`center`, `lngLat`, the argument of `project`) has the type `Position`, which is
  `readonly number[]`. So an array that is declared apart from the call compiles without `as const`:
  `const NYC = [-74.0065, 40.7085]; createMap(el, {style, initialView: {center: NYC}})`. The map reads the first two
  numbers as `[lng, lat]`. A position that the map gives (`state.view.center`, the result of `unproject`, `lngLat`
  in `onClick`) is `[number, number]`.
- A feature of `state.hover` and of `onClick` has `layer`, the style layer that draws it, with the type `StyleLayer`
  (`id`, `type`, `source`, `paint` and the other members of a layer of the style). `queryFeatures` returns
  `(RenderedFeature | QueriedFeature)[]`: a `QueriedFeature` (a query with `sources`) has no style layer.

## What is not in this entry yet

- The features under the pointer are found with one query for each pointer position, from the page. Later the
  engine will find them itself.
