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

## Change the map

```js
let description = {style, initialView, markers: [pins]};
const map = createMap(container, description);

// Later: other markers. Give the complete description again.
description = {...description, markers: [{...pins, data: newData}]};
map.update(description);
```

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
| `data` | GeoJSON data for sources of the style, by the id of the source. See below. |
| `markers` | A list of marker layers, each with an `id`. See [Markers](markers.md). A layer with a new `data` array gets the new data. |
| `controls` | A list of controls. See below. |
| `interactiveLayers` | The ids of style layers. The features of these layers under the pointer are in `state.hover` and in `onClick`. |
| `onClick` | A function that is called for a click, with `point`, `lngLat` and `features`. |
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

The credits of the data show without a control of your own. See `attribution` below.

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
| `error` | The last error. |

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
`onViewChange`. When your application gives a view back that the map reported a short time before, the map does not
apply it again. Thus a slow application does not pull the map back while the user moves it. A view that the map did
not report moves the map.

To move the map one time with an animation, use `map.moveTo({zoom: 15, duration: 500})` or `map.fitBounds(bounds)`.

## Queries

There is one method to find features: `queryFeatures(where, options)`.

- **Where:** a point of the screen (`{x, y}`), a position (`[lng, lat]`), a rectangle of the screen (two points), or
  nothing for the whole map.
- **What:** without `sources`, the features that the style layers draw, the top one first (`layers` selects layers).
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

`watchFeatures(where, options, listener)` asks the same question and keeps the answer up to date. The listener gets
the answer now, and again each time that it changes: new tiles, a change of the style, and (for a place on the
screen) a movement of the map. It returns a function that stops it. Use it in place of listeners for `idle` and
`sourcedata`:

```js
// The band of rain under a marker, also while the layers of the map change:
const stop = map.watchFeatures([-75.16, 39.92], {sources: ['rain']}, features => show(features[0]?.properties));
```

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
| `update(description)` | Changes the map to a new description. |
| `destroy()` | Removes the map and frees its memory. |
| `moveTo(view)` | Moves the camera now. With `duration` (milliseconds), with an animation. |
| `fitBounds(bounds, options)` | Shows an area. |
| `project(lngLat)`, `unproject(point)` | Change between a position on the map and a point of the screen. |
| `listen(type, fn)` | Calls `fn` for each event of that type (`'click'`, `'move'`, `'load'` and others). Returns a function that stops it. |
| `container` | The element of the map. |
| `map` | The map object behind this API, for a need that this API does not cover yet. It can change between versions. |

## What is not in this entry yet

- The features under the pointer are found with one query for each pointer position, from the page. Later the
  engine will find them itself.
