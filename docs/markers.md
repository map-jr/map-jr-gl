# Markers

The library has two types of marker.

| Type | Use it for | How it is drawn |
|---|---|---|
| Marker layer | Many markers that look the same or almost the same | On the map canvas, by the GPU |
| Element of the page (`map.overlay`, or `Marker` and `Popup`) | A small number of markers with HTML content, or markers that the user moves | As HTML elements above the map |

A marker layer is shorthand. It stands for a GeoJSON source with one point for each marker, and a symbol layer of
the style that draws an image at each point. What a symbol layer can do, a marker layer can do: a click finds its
markers, and the layer has a place in the layer order.

- With `@map-jr/map-jr-gl` (and the adapters for Vue, React and Svelte), marker layers are the field `markers` of
  the description. See [With the main API](#with-the-main-api).
- With `@map-jr/map-jr-gl/maplibre-compat`, write the source and the symbol layer yourself, as with MapLibre GL JS.
  See [With the API of MapLibre GL JS](#with-the-api-of-maplibre-gl-js).

## With the main API

A marker layer is an object in the list `markers` of the description (`MapSpec`). It names an image of the field
`images`. The image can be an SVG template: write `{{name}}` where a value must go, and each marker fills the slot
from its `props`.

```js
import {createMap} from '@map-jr/map-jr-gl';

const pin = '<svg viewBox="0 0 24 31"><path fill="{{color}}" stroke="#fff" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>';
let places = {
  id: 'places',
  image: 'pin',
  anchor: 'bottom',
  data: [
    {lngLat: [-74.006, 40.7128], props: {color: '#d6453d', name: 'City Hall'}},
    {lngLat: [-73.9857, 40.7484], props: {color: '#2f7fd1', name: 'Empire State Building'}},
  ],
};
let description = {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  initialView: {center: [-73.996, 40.73], zoom: 11.5},
  images: {pin},
  markers: [places],
};
const map = createMap(document.getElementById('map'), description);
```

The library draws the template one time for each different set of values. It then draws all the markers from a
buffer on the GPU. The number of markers has almost no effect on the speed of a frame.

### Options

| Option | Default | Effect |
|---|---|---|
| `id` | Required | The id of the layer and of its source. Use it in `interactiveLayers`, and as `before` of other layers. |
| `image` | Required | The name of an image: of `images` in the description, or of the sprite of the style. See [Images for style layers](api.md#images-for-style-layers). |
| `data` | Required | The markers: a list of `{lngLat, props}`. `lngLat` is `[lng, lat]`. `props` has the values for the slots of the image, and your own values. |
| `anchor` | `'center'` | The part of the image that is on the position: `'bottom'`, `'top-left'` and the other values of `icon-anchor`. |
| `collide` | `false` | When `true`, map labels keep away from the markers. |
| `overlap` | `'show'` | When `'hide'`, a marker that would cover another marker or a label does not show, and map labels keep away from the markers. |
| `minZoom`, `maxZoom` | None | The zoom range in which the layer shows. |
| `before` | None | The id of a style layer: the markers are drawn below it. Without it, they are drawn above each layer of the style. |

The size of a marker is the size of its image. Give the size with the image: `images: {pin: {image: pin, width: 36,
height: 46}}`. Without a size, an SVG has the size of its `viewBox`.

To change how a marker looks with zoom, make two layers with the same data and different zoom ranges. For example,
make small dots below zoom 12 and full pins from zoom 12.

### What a marker layer stands for

The marker layer `places` above is the same as this source and this layer of the style:

```js
const source = {type: 'geojson', data: {type: 'FeatureCollection', features: [
  {type: 'Feature', id: 0, properties: {color: '#d6453d', name: 'City Hall'}, geometry: {type: 'Point', coordinates: [-74.006, 40.7128]}},
  {type: 'Feature', id: 1, properties: {color: '#2f7fd1', name: 'Empire State Building'}, geometry: {type: 'Point', coordinates: [-73.9857, 40.7484]}},
]}};
const layer = {
  id: 'places', type: 'symbol', source: 'places',
  layout: {'icon-image': 'pin', 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true},
};
```

- The `id` of a feature is the index of its marker in `data`, and its properties are the `props` of the marker.
- With `collide: true`, `icon-ignore-placement` is `false`. With `overlap: 'hide'`, `icon-allow-overlap` and
  `icon-ignore-placement` are `false`.
- When you need more than the options give (a filter, text beside the icon, an expression for the image), write
  the source and the layer yourself in `extend`, and give the data in the field `data`. See
  [Images for style layers](api.md#images-for-style-layers).

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

When only `data` is different, the source gets the new data and the style stays as it is. When another option is
different, the map gets the style again with the new layer. The Vue component accepts changes in place of a
reactive array: see [Vue and Nuxt](vue.md).

### A click on a marker, and a popup

A marker is a feature of its layer. Put the id of the marker layer into `interactiveLayers`: a click then has the
marker in `features`, and `state.hover` has the marker under the pointer.

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
    // `marker.id` is the index in `data`, and `marker.properties` are the `props`.
    const text = document.createElement('div');
    text.textContent = marker.properties.name;
    // A popup that points at the marker, 30 pixels above its position.
    popup = map.overlay(text, {lngLat: marker.geometry.coordinates, popup: true, offset: [0, -30]});
  },
});
```

A marker is found where its image is drawn, also with the anchor `bottom`.

### Elements of the page

For a small number of markers with HTML content, use `map.overlay(element, {lngLat, anchor, popup})`. See
[Elements of the page on the map](api.md#elements-of-the-page-on-the-map).

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
- The layer has no `symbol-sort-key`, and `icon-anchor`, `icon-offset`, `icon-rotation-alignment` and `icon-color`
  have one value for the layer. `icon-size`, `icon-rotate` and `icon-opacity` can have a value for each feature.

A marker layer without `overlap: 'hide'` is such a layer. The library places other icons with the labels, and their
cost grows with their number.

Labels keep away from such an icon, unless the layer has `icon-ignore-placement: true` (a marker layer has it
without `collide`). The map then gives each icon its space each time it places the labels. That work grows with the
number of icons in view.

These are measurements with software WebGL (headless Chromium, the main-thread renderer, 500 different images),
for the script time of one frame while the map moves. They were not made on a GPU.

| Icons | Always shown, labels do not keep away | Always shown, labels keep away |
|---|---|---|
| 10,000 | 6 ms | 6 ms |
| 100,000 | 5 to 8 ms | 14 ms |

The data of a marker layer is cut into tiles when it is given. With 100,000 markers the map was ready 2 to 3
seconds after that in the same measurement.

## Groups of markers (clustering)

A GeoJSON source can make the groups: write the source yourself with `cluster: true`, as in MapLibre GL JS. You can
also calculate the groups in your application and give the result as the `data` of a marker layer. Do this again
when the `moveend` event occurs (`map.listen('moveend', ...)`).

## Markers on the server

`renderToSVG` and `renderToImage` accept `markers` and `images` as the description does. An image must be an SVG
document. See [Server rendering](server-rendering.md).

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

Each `Marker` is an HTML element. The browser becomes slow with thousands of them. Use a marker layer or a symbol
layer for large numbers.

## 3D terrain

With 3D terrain, the two types of marker stay on the ground surface. Ground in front of a marker on the canvas does
not hide it.
