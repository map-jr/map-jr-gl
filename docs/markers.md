# Markers

A map can show markers in two ways.

| Way | Use it for | How it is drawn |
|---|---|---|
| A symbol layer with an image | Many markers that look the same or almost the same | On the map canvas, by the GPU |
| An element of the page (`map.overlay`, or `Marker` and `Popup` of the compat entry) | A small number of markers with HTML content, or markers that the user moves | As HTML elements above the map |

A symbol layer is a layer of the style. A click finds its features, the layer has a place in the layer order, and it
can have a filter, text beside the icon and expressions.

## Many markers: a symbol layer

With `@map-jr/map-jr-gl` (and the adapters for Vue, React and Svelte), three fields of the description (`MapDescription`)
draw many markers:

- `images` has the image, by name. The image can be an SVG template: write `{{name}}` where a value must go, and
  each feature fills the slot from its property with that name.
- `data` has the points. A key of `data` that is not the id of a source of the style makes a GeoJSON source with
  that id. `points()` makes the GeoJSON from records of your application.
- `layers` has a symbol layer that draws the image at each point of that source.

```js
import {createMap, points} from '@map-jr/map-jr-gl';

const pin = '<svg viewBox="0 0 24 31"><path fill="{{color}}" stroke="#fff" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>';
const records = [
  {id: 1, lng: -74.006, lat: 40.7128, color: '#d6453d', name: 'City Hall'},
  {id: 2, lng: -73.9857, lat: 40.7484, color: '#2f7fd1', name: 'Empire State Building'},
];
let description = {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  initialView: {center: [-73.996, 40.73], zoom: 11.5},
  images: {pin},
  data: {places: points(records, {lngLat: r => [r.lng, r.lat], id: r => r.id})},
  layers: [{
    id: 'places', type: 'symbol', source: 'places',
    layout: {'icon-image': 'pin', 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true},
  }],
};
const map = createMap(document.getElementById('map'), description);
```

The library draws the template one time for each different set of values. It then draws all the markers from a
buffer on the GPU. The number of markers has almost no effect on the speed of a frame (see
[Which icons are fast](#which-icons-are-fast)).

`points(records, {lngLat, id, properties})` gives a `FeatureCollection` with a point for each record. `lngLat` is
required and returns `[lng, lat]`. Without `id`, the features have no id. Without `properties`, the properties of a
feature are the record itself. A record whose position is not two finite numbers is left out, and the development
build warns once.

### The layout properties for markers

| What you want | Layout property |
|---|---|
| The part of the image that is on the position | `icon-anchor`: `'bottom'`, `'top-left'` and the other values; the default is `'center'` |
| Every marker shows, also where markers cover each other | `icon-allow-overlap: true` |
| Map labels do not keep away from the markers | `icon-ignore-placement: true` |
| A zoom range | `minzoom` and `maxzoom` of the layer |
| A place in the layer order | `before` of the layer in `layers`: the id of a layer of the style |
| Text beside the icon | `text-field`, as for any symbol layer |

The size of a marker is the size of its image. Give the size with the image: `images: {pin: {image: pin, width: 36,
height: 46}}`. Without a size, an SVG has the size of its `viewBox`, or else of its `width` and `height` attributes
(see [Images for style layers](api.md#images-for-style-layers)).

To change how a marker looks with zoom, make two layers with the same source and different zoom ranges. For example,
make small dots below zoom 12 and full pins from zoom 12.

### The image of a marker

- Write `{{name}}` in the SVG where a property of the feature must go. The library makes the value safe for XML.
- The SVG can contain an `<image>` element with a photograph.
- Keep the number of different value sets small. Each different set is drawn one time and uses space in a texture.
  [An image that is a template](api.md#an-image-that-is-a-template) has the limits.
- `icon-image` can give a slot the value of an expression, for example the state of a feature
  (`['image', 'pin', {params: {...}}]`).

### Change the markers

Call `map.update` with the complete description and a new object for the key of `data`. The library compares the
data of a source by identity, so a change inside the old object has no effect.

```js
// Change one marker: new GeoJSON from the changed records.
records[1] = {...records[1], color: '#2e9d5b'};
description = {...description, data: {places: points(records, {lngLat: r => [r.lng, r.lat], id: r => r.id})}};
map.update(description);

// Remove the markers: a description without the layer and without the key of `data`.
description = {...description, data: {}, layers: []};
map.update(description);
```

When only `data` is different, the source gets the new data and the style stays as it is. A change of `paint`,
`layout` or `filter` of the layer is an edit of the map, and the style also stays. The Vue component, too, needs a
new object for a change of the data: see [Vue and Nuxt](vue.md).

### A click on a marker, and a popup

A marker is a feature of its layer. Put the id of the layer into `interactiveLayers`: a click then has the marker in
`features`, and `state.hover` has the marker under the pointer.

```js
let popup = null;
map.update(description = {
  ...description,
  interactiveLayers: ['places'],
  onClick: event => {
    popup?.remove();
    popup = null;
    const marker = event.features[0];
    if (!marker) return;
    // `marker.id` is the id that `points()` gave, and `marker.properties` is the record.
    const text = document.createElement('div');
    text.textContent = marker.properties.name;
    // A popup that points at the marker, 30 pixels above its position.
    popup = map.overlay(text, {lngLat: marker.geometry.coordinates, popup: true, offset: [0, -30]});
  },
});
```

A marker is found where its image is drawn, also with the anchor `bottom`. When markers cover each other, the one
that is drawn on top is the first of `features`.

### Coming from the field `markers`

Before version 0.6.0, the description had a field `markers` with marker layers. It was removed (#499). This table
says what to write now.

| Before | Now |
|---|---|
| `markers: [{id, image, data}]` | `data: {[id]: points(records, {lngLat})}` and `layers: [{id, type: 'symbol', source: id, layout: {'icon-image': image}}]` |
| `{lngLat, props}` of a marker | A record of `points()`: `lngLat` returns the position, and `properties` the properties (the record itself by default) |
| The index of a marker as the id of its feature | `id` of `points()`, or no id |
| `anchor` | `layout['icon-anchor']` |
| No `overlap`, or `overlap: 'show'` | `layout['icon-allow-overlap']: true` |
| `overlap: 'hide'` | `icon-allow-overlap` and `icon-ignore-placement` are `false` (the defaults) |
| `collide: true` | `layout['icon-ignore-placement']: false`; without it, `true` |
| `minZoom`, `maxZoom` | `minzoom`, `maxzoom` of the layer |
| `before` | `before` of the layer in `layers` |
| The prop `markers` of the Vue component, React and Svelte | The props `data` and `layers` |
| `markers` of `renderToSVG` and `renderToImage` | `data` and `layers` |

## Elements of the page

For a small number of markers with HTML content, use `map.overlay(element, {lngLat, anchor, popup})`. With
`draggable: true` and `onDragEnd`, the user can move the marker, and `onDragEnd` gets the new `[lng, lat]`.
`defaultPin()` makes the default pin of `Marker`, for a marker with the same look. In Vue and React, `MapOverlay` has
the same props. See [Elements of the page on the map](api.md#elements-of-the-page-on-the-map). With the worker renderer, an element of the page can trail the map by about one frame during some movements;
see [How closely an element of the page follows the map](#how-closely-an-element-of-the-page-follows-the-map).


## With the API of MapLibre GL JS

With `@map-jr/map-jr-gl/maplibre-compat`, `map` is a `Map`. Markers on the canvas are a GeoJSON source and a symbol
layer, as in MapLibre GL JS. One thing is an addition of this library: the image can be an SVG template, and each
feature fills its slots from its properties.

```js
import {Map, Popup} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({container: 'map', style: 'https://tiles.openfreemap.org/styles/liberty', center: [-73.996, 40.73], zoom: 11.5});
const pin = '<svg viewBox="0 0 24 31"><path fill="{{color}}" stroke="#fff" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>';

map.on('load', async () => {
  await map.addImage('pin', pin);
  map.addSource('places', {type: 'geojson', data: {type: 'FeatureCollection', features: [
    {type: 'Feature', properties: {color: '#d6453d', name: 'City Hall'}, geometry: {type: 'Point', coordinates: [-74.006, 40.7128]}},
  ]}});
  map.addLayer({
    id: 'places', type: 'symbol', source: 'places',
    layout: {'icon-image': 'pin', 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true},
  });
});

map.on('click', 'places', event => {
  const place = event.features[0];
  new Popup({offset: 30}).setLngLat(place.geometry.coordinates).setText(place.properties.name).addTo(map);
});
```

To change the markers, call `map.getSource('places').setData(...)`. To remove them, call `map.removeLayer('places')`
and `map.removeSource('places')`.

## Which icons are fast

A symbol layer draws an icon from a buffer on the GPU when the icon needs no place among the labels. The cost of a
frame then does not grow with the number of icons. That is the case when all of these are true:

- The feature has no text.
- `symbol-placement` is `point` (the default).
- `icon-allow-overlap` is `true`. The icon is then always shown.
- `icon-text-fit` is `none` (the default), and the icon has no halo (`icon-halo-width`).
- The layer has no `symbol-sort-key`, and `icon-anchor`, `icon-offset`, `icon-rotation-alignment`, `icon-color` and
  `icon-padding` have one value for the layer. `icon-size`, `icon-rotate` and `icon-opacity` can have a value for
  each feature.

A symbol layer with `icon-allow-overlap: true` and no text, as in the examples above, is such a layer. The library places other icons with the labels, and their
cost grows with their number.

An icon from a buffer differs from a placed icon in these points:

- With 3D terrain it stands on the ground, and ground in front of it does not hide it. (MapLibre GL JS and a placed
  icon are hidden.)
- It shows with its tile and does not fade in.
- The icons of a layer that is above each layer with labels are drawn over the labels. The icons of another layer
  are drawn below all labels and below all placed icons.
- The map asks for the image of each icon of a tile (`styleimagemissing`), also for an icon outside the view.

Labels of the layers below keep away from such an icon, unless the layer of the icon has
`icon-ignore-placement: true`. The map then gives each icon its space each
time it places the labels, which is some times a second while the map moves. That work grows with the number of
icons in view. Use `icon-ignore-placement: true` for very many icons.

These are measurements with software WebGL (headless Chromium, the main-thread renderer, 500 different images),
for the script time of one frame while the map moves. They were not made on a GPU.

| Icons | Always shown, labels do not keep away | Always shown, labels keep away |
|---|---|---|
| 10,000 | 6 ms | 6 ms |
| 100,000 | 5 to 8 ms | 14 to 20 ms on average; the frames that place the labels took more than 100 ms each |

The data of a GeoJSON source is cut into tiles when it is given. With 100,000 points the map was ready 2 to 3
seconds after that in the same measurement, and with 200,000 points after 7 seconds or more.

## Groups of markers (clustering)

A GeoJSON source can make the groups: write the source yourself in `sources` with `cluster: true`, as in MapLibre
GL JS, and give the points in `data`. You can also calculate the groups in your application and give the result in
`data`. Do this again when the `moveend` event occurs (`map.listen('moveend', ...)`).

## Markers on the server

`renderToSVG` and `renderToImage` accept `images`, `data`, `sources` and `layers` as the description does. An image
must be an SVG document. See [Server rendering](server-rendering.md).

## `Marker` and `Popup`

These classes have the API of MapLibre GL JS. They are in the entry `@map-jr/map-jr-gl/maplibre-compat`. With
`@map-jr/map-jr-gl`, use `map.overlay` (see [Elements of the page](#elements-of-the-page)).

```js
import {Marker, Popup} from '@map-jr/map-jr-gl/maplibre-compat';

const marker = new Marker({draggable: true})
  .setLngLat([-74.006, 40.7128])
  .setPopup(new Popup().setHTML('<strong>City Hall</strong>'))
  .addTo(map);

marker.on('dragend', () => console.log(marker.getLngLat()));
```

Each `Marker` is an HTML element. The browser becomes slow with thousands of them. Use a symbol layer for large numbers.

### How closely an element of the page follows the map

An element of the page (`Marker`, `Popup`, or `map.overlay` of `@map-jr/map-jr-gl`) is placed by the page, and the
map is drawn by the engine. With the main-thread renderer, both change in the same frame. With the worker renderer
(the default where the browser supports it), the engine draws in a worker:

- During a drag with one finger or the mouse, the element moves in the same frame as the map. The page moves its own
  camera at each pointer move and places the element one frame later, when the worker draws that move. The page needs
  the ground point that the engine grabbed, which comes with the first camera of the drag, so in the first one or two
  frames of a drag the element can still trail by a frame.
- During a movement that the engine makes (`easeTo`, `flyTo`, `fitBounds`, the fling after a drag, a pinch), the element
  can trail the map by about one frame. The page learns the camera from the engine after the frame is drawn.

A symbol layer is drawn with the map, so it never trails. Measured on 2026-11-15 in Chrome with a GPU: during a drag
the element was 0 frames behind on an Apple M4 and 0.1 frames behind on a Galaxy S21. During `easeTo` it was about one
frame behind on the Galaxy S21, and on the Apple M4 it was one frame behind in one run of three.

To keep markers exactly on the map in every movement, choose one of these:

- Draw the markers as an image in a symbol layer. This is the better choice for more than a few
  markers, and it works with both renderers.
- Keep elements of the page, and draw the map on the main thread: `renderer: 'main'` in the description (`MapDescription`)
  of `@map-jr/map-jr-gl`, or in the options of `new Map()` of `@map-jr/map-jr-gl/maplibre-compat`. The page then does
  more work in each frame, which matters on a slow phone.

## 3D terrain

With 3D terrain, the two types of marker stay on the ground surface. Ground in front of a marker on the canvas does
not hide it.
