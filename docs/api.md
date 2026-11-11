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

The library compares each field with the field of the last description. A field that is the same object is not
looked at again. Thus:

- To change a field, give a new object or array. Do not change the old one in place.
- To leave a field as it is, give the same object again.

## The description

| Field | Meaning |
|---|---|
| `style` | A style object or the URL of a style (the MapLibre style specification). Required. A new object or URL is a new style. |
| `initialView` | The view at the start: `center` (`[lng, lat]`), `zoom`, `bearing`, `pitch`. The user then moves the map. |
| `view`, `onViewChange` | A view that your application owns. See below. |
| `markers` | A list of marker layers, each with an `id`. See [Markers](markers.md). A layer with a new `data` array gets the new data. |
| `interactiveLayers` | The ids of style layers. The features of these layers under the pointer are in `state.hover` and in `onClick`. |
| `onClick` | A function that is called for a click, with `point`, `lngLat` and `features`. |
| `minZoom`, `maxZoom`, `maxPitch`, `maxBounds` | The limits of the camera. |
| `cursor` | The mouse cursor over the map. Without it, the cursor is a pointer over a feature of `interactiveLayers`. |

These fields are read only when the map is made:

| Field | Meaning |
|---|---|
| `renderer` | `'auto'` (the default), `'worker'` or `'main'`: the thread that draws. See [Loading](loading.md). |
| `fonts`, `fontFamily` | Web fonts for the labels. |
| `interactive` | `false` for a map that the user cannot move. |
| `antialias` | Multisample antialiasing for the canvas. |
| `attribution` | `false` to show the credits yourself, or options for the built-in credits. |
| `hash` | Keeps the view in the fragment of the URL. |

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

```js
// The features that style layers draw at a point of the screen, the top one first:
const drawn = await map.queryFeatures({x: 200, y: 150}, {layers: ['roads', 'places']});

// In a rectangle of the screen:
const inBox = await map.queryFeatures([{x: 0, y: 0}, {x: 400, y: 300}], {layers: ['places']});

// The features of the tile data near a point. You do not need a style layer for this:
const data = await map.queryFeatures({x: 200, y: 150}, {sources: ['openmaptiles'], radius: 10});
```

The tile data is in a worker, so each query returns a promise.

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

- Controls (zoom buttons, scale, fullscreen), `Marker` and `Popup` are in `map-jr-gl/maplibre-compat` only. They
  will become separate entries of this API.
- The features under the pointer are found with one query for each pointer position, from the page. Later the
  engine will find them itself.
