# Markers

The library has two types of marker.

| Type | Use it for | How it is drawn |
|---|---|---|
| Marker layer | Many markers that look the same or almost the same | On the map canvas, by the GPU |
| Element of the page (`map.overlay`, or `Marker` and `Popup`) | A small number of markers with HTML content, or markers that the user moves | As HTML elements above the map |

The two entries of the library give markers to the map in different ways:

- With `@map-jr/map-jr-gl` (and the adapters for Vue, React and Svelte), marker layers are the field `markers` of the
  description. See [With the main API](#with-the-main-api).
- With `@map-jr/map-jr-gl/maplibre-compat`, marker layers are made with the method `map.addMarkerLayer`. The examples in
  [Marker layers](#marker-layers) use this entry.

The template and the options are the same for the two entries.

## With the main API

A marker layer is an object in the list `markers` of the description (`MapSpec`). Each layer has an `id`.

```js
import {createMap} from '@map-jr/map-jr-gl';

let places = {
  id: 'places',
  svg: '<svg viewBox="0 0 24 31"><path fill="{{color}}" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>',
  width: 24,
  height: 31,
  anchor: 'bottom',
  data: [
    {lngLat: [-74.006, 40.7128], props: {color: '#d6453d', name: 'City Hall'}},
    {lngLat: [-73.9857, 40.7484], props: {color: '#2f7fd1', name: 'Empire State Building'}},
  ],
};
let description = {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  initialView: {center: [-73.996, 40.73], zoom: 11.5},
  markers: [places],
};
const map = createMap(document.getElementById('map'), description);
```

### Change the markers

Call `map.update` with the complete description and a new `data` array. The library compares marker data by
identity, so a change inside the old array has no effect.

```js
// Change one marker: a new array with a new object for that marker.
places = {...places, data: places.data.map((marker, i) => i === 1 ? {...marker, props: {...marker.props, color: '#2e9d5b'}} : marker)};
description = {...description, markers: [places]};
map.update(description);

// Remove the layer: a description without it.
description = {...description, markers: []};
map.update(description);
```

When only `data` is different, the layer keeps its images. When another option is different, the library makes the
layer again. The Vue component accepts changes in place of a reactive array: see [Vue and Nuxt](vue.md).

### Events and callouts

`map.listen(type, fn)` calls `fn` for the events `markerclick`, `markerenter` and `markerleave`. It returns a
function that stops the listener. The event has `marker` (the object from `data`), `index` (its place in `data`)
and `layer`.

```js
const stop = map.listen('markerclick', event => {
  console.log(event.marker.props.name, event.index);
  // Makes the marker larger and opens a callout that points at it. The content is text or an HTML element.
  event.layer.openPopup(event.index, event.marker.props.name);
});
```

`event.layer.select(index)` makes a marker larger without a callout, and `event.layer.select(null)` makes it the
usual size again.

### Elements of the page

For a small number of markers with HTML content, use `map.overlay(element, {lngLat, anchor, popup})`. See
[Elements of the page on the map](api.md#elements-of-the-page-on-the-map).

## Marker layers

The examples in this section use the entry `@map-jr/map-jr-gl/maplibre-compat`, where `map` is a `Map`. The template and the
options also apply to the field `markers` of `@map-jr/map-jr-gl`.

A marker layer has an SVG template and a list of markers. The library draws the template one time for each
different set of values. It then draws all the markers in one operation. The number of markers has almost no effect
on speed.

```js
const layer = map.addMarkerLayer({
  id: 'places',
  svg: '<svg viewBox="0 0 24 31"><path fill="{{color}}" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>',
  width: 24,
  height: 31,
  anchor: 'bottom',
  data: [
    {lngLat: [-74.006, 40.7128], props: {color: '#d6453d', name: 'City Hall'}},
  ],
});
```

### The template

- Write `{{name}}` where a value from `props` must go. The library makes the value safe for XML.
- The template can contain an `<image>` element with a photograph.
- Keep the number of different value sets small. Each different set uses space in a texture.

### Options

| Option | Default | Effect |
|---|---|---|
| `width`, `height` | Required | The size of a marker in CSS pixels. A layer without them throws an error. |
| `anchor` | `'center'` | The part of the marker that is on the position, for example `'bottom'` |
| `collide` | `false` | When `true`, map labels do not go below the markers |
| `minZoom`, `maxZoom` | None | The zoom range in which the layer shows. The layer fades at the two ends of the range. |
| `overlap` | `'show'` | When `'hide'`, a marker that would cover an earlier marker does not show |

To change how a marker looks with zoom, make two layers with the same data and different zoom ranges. For example,
make small dots below zoom 12 and full pins from zoom 12.

### Change the markers

```js
layer.setData(newMarkers);                    // replace all markers
layer.setProps(3, {color: '#2f7fd1'});        // change the values of marker 3
layer.select(3);                              // make marker 3 larger
layer.select(null);                           // make it the usual size again
map.removeMarkerLayer('places');
```

### Events

```js
map.on('markerclick', event => console.log(event.marker.props, event.index, event.layer));
map.on('markerenter', event => event.layer.setProps(event.index, {stroke: '#222'}));
map.on('markerleave', event => event.layer.setProps(event.index, {stroke: '#fff'}));
```

`map.queryMarkers(point)` gives the marker at a screen position, or `null`.

### Callouts

`openPopup` makes the marker larger and opens a callout that points at it. Map labels move away from the marker and
from the callout.

```js
map.on('markerclick', event => {
  event.layer.openPopup(event.index, event.marker.props.name);
});
```

The content can be text or an HTML element.

### Groups of markers (clustering)

Clustering is not part of the library. Calculate the groups in your application and give the result to a marker
layer with `setData`. Do this again when the `moveend` event occurs.

With `@map-jr/map-jr-gl`, give the result as a new `data` array in `map.update`, and listen with
`map.listen('moveend', ...)`.

### Markers on the server

`renderToSVG` and `renderToImage` accept the same marker layer options. See [Server rendering](server-rendering.md).

## `Marker` and `Popup`

These classes have the API of MapLibre GL JS. They are in the entry `@map-jr/map-jr-gl/maplibre-compat`. With `@map-jr/map-jr-gl`,
use `map.overlay` (see [Elements of the page](#elements-of-the-page)).

```js
import {Marker, Popup} from '@map-jr/map-jr-gl/maplibre-compat';

const marker = new Marker({draggable: true})
  .setLngLat([-74.006, 40.7128])
  .setPopup(new Popup().setHTML('<strong>City Hall</strong>'))
  .addTo(map);

marker.on('dragend', () => console.log(marker.getLngLat()));
```

Each `Marker` is an HTML element. The browser becomes slow with thousands of them. Use a marker layer for large
numbers.

## 3D terrain

With 3D terrain, the two types of marker stay on the ground surface.
