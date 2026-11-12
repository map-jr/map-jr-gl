# Terrain and elevation

One elevation source (`raster-dem`) gives you four features:

- 3D terrain
- relief shading (the `hillshade` layer)
- contour lines
- elevation queries

The two entries of the library set these features up in different ways:

- With `map-jr-gl` (and the adapters for Vue, React and Svelte), the elevation source, its layers and the terrain
  are in the style or in the field `extend` of the description. See [With the main API](#with-the-main-api).
- With `map-jr-gl/maplibre-compat`, they are in the style or are added with methods (`map.addSource`,
  `map.addLayer`, `map.setTerrain`). The examples in the other sections use this entry, where `map` is a `Map`
  whose style has loaded.

The options of the sources and layers, and the behaviour of terrain, are the same for the two entries.

## With the main API

`extend` adds sources and layers to a style from a URL, and sets the terrain. A layer with `before` goes below the
layer with that id.

```js
import {createMap} from 'map-jr-gl';
import {navigation} from 'map-jr-gl/controls';

const elevation = on => ({
  sources: {
    dem: {type: 'raster-dem', tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'], encoding: 'terrarium', tileSize: 512, maxzoom: 12},
    contours: {type: 'contour', source: 'dem', thresholds: {11: [100, 500], 12: [50, 200], 14: [20, 100]}},
  },
  layers: [
    {id: 'relief', type: 'hillshade', source: 'dem', before: 'water'},
    {id: 'contour-lines', type: 'line', source: 'contours', 'source-layer': 'contours', before: 'water'},
  ],
  // 3D terrain. `null` makes the map flat.
  terrain: on ? {source: 'dem', exaggeration: 1.5} : null,
});

let description = {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  initialView: {center: [7.6586, 45.9763], zoom: 12.4, pitch: 60},
  extend: elevation(true),
  controls: [navigation()],
};
const map = createMap(document.getElementById('map'), description);

// Later: a flat map. Give the complete description again.
description = {...description, extend: elevation(false)};
map.update(description);

// The height of the ground in metres. This query does not need 3D terrain.
const metres = await map.queryElevation([7.6586, 45.9763]);
```

- When your own style object has the elevation source, the layers and `"terrain"`, you do not need `extend`.
- The control `terrain({source: 'dem', exaggeration: 1.5})` from `map-jr-gl/controls` is a button that turns 3D
  terrain on and off. Put it in `controls`.
- `map.queryElevation(where)` takes a position (`[lng, lat]`) or a point of the screen (`{x, y}`). The result is a
  promise, and it is `null` where there is no data.

The gallery has this example as a complete page for each entry and adapter (`site/examples/terrain.*`).

## The elevation source

```js
map.addSource('dem', {
  type: 'raster-dem',
  tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
  encoding: 'terrarium',
  tileSize: 512,
  maxzoom: 12,
});
```

The library reads the `terrarium` and `mapbox` encodings. A PMTiles archive also works as a source. Use the
prefix `pmtiles://` before the URL of the file.

## 3D terrain

```js
map.setTerrain({source: 'dem', exaggeration: 1.5});
map.setTerrain(null);                       // make the map flat again
```

You can also put `"terrain": {"source": "dem", "exaggeration": 1.5}` in the style.

How terrain behaves:

- When you look vertically down, the library draws a flat map. A flat map is sharper and faster. The terrain
  appears gradually during the first 10 degrees of tilt.
- Buildings, labels, marker layers, `Marker` and `Popup` stay on the ground surface.
- A label behind a mountain does not show.
- `project`, `unproject` and the positions in pointer events use the ground surface.
- When you drag the map, the ground below the pointer stays below the pointer.
- When a movement stops, the view does not move. The values of `getCenter()` and `getZoom()` can change a small
  quantity at that time. This is because the map centre goes to the ground that the camera looks at. MapLibre GL JS
  does the same.

Current limits:

- Markers behind a mountain continue to show.
- The roof of a building follows the slope below it.
- There is no sky and no fog.
- The server renderer does not draw terrain.

## Relief shading

```js
map.addLayer({
  id: 'relief',
  type: 'hillshade',
  source: 'dem',
  paint: {'hillshade-exaggeration': 0.4, 'hillshade-shadow-color': '#5a4a3a'},
});
```

## Contour lines

A contour source makes contour lines from an elevation source. The tile workers calculate the lines. You do not need a
plugin.

```js
map.addSource('contours', {
  type: 'contour',
  source: 'dem',
  multiplier: 3.28084,
  thresholds: {
    9: [500, 1000],
    11: [200, 1000],
    12: [100, 500],
    14: [50, 200],
    15: [20, 100],
  },
});

map.addLayer({
  id: 'contour-lines',
  type: 'line',
  source: 'contours',
  'source-layer': 'contours',
  paint: {'line-color': '#8a6f55', 'line-width': ['match', ['get', 'level'], 1, 1.2, 0.5]},
});

map.addLayer({
  id: 'contour-labels',
  type: 'symbol',
  source: 'contours',
  'source-layer': 'contours',
  filter: ['>', ['get', 'level'], 0],
  layout: {'symbol-placement': 'line', 'text-size': 10, 'text-field': ['concat', ['get', 'ele'], ' ft']},
});
```

### Options of a contour source

| Option | Default | Meaning |
|---|---|---|
| `source` | Required | The name of a `raster-dem` source |
| `thresholds` | Required | The intervals for each zoom level. See below. |
| `multiplier` | `1` | The library multiplies each elevation by this number. Use `3.28084` for feet. |
| `overzoom` | `1` | The number of levels by which the elevation tiles are less detailed than the contour tiles. A larger number gives smoother lines and fewer downloads. |
| `contourLayer` | `'contours'` | The name of the layer in the contour tiles |
| `elevationKey` | `'ele'` | The property that contains the elevation of a line |
| `levelKey` | `'level'` | The property that is `1` for a major line and `0` for a minor line |
| `maxzoom` | `15` | The most detailed zoom level of the contour tiles |

### Thresholds

Each entry of `thresholds` is a zoom level and two numbers. The first number is the interval between lines. The
second number is the interval between major lines.

An entry applies from its zoom level to the next entry. With the example above, zoom 12 and zoom 13 have a line
each 100 units and a major line each 500 units.

Below the lowest zoom level in `thresholds`, the map shows no contour lines.

## Elevation queries

```js
const metres = await map.queryElevation([7.6586, 45.9763]);
```

- The result is in metres above sea level. It is `null` where there is no data.
- This query does not need 3D terrain.
- The position can be outside the screen.
- When the style has more than one elevation source, give the name: `map.queryElevation(lngLat, {source: 'dem'})`.

With 3D terrain, these methods are also available:

- `map.getCenterElevation()` gives the height of the ground at the map centre, with the exaggeration applied.
- `map.queryTerrainElevation(lngLat)` gives the height of the ground at a position in metres above sea level, with
  the exaggeration applied. This is the same as MapLibre GL JS version 5 and later. (Earlier versions gave the
  height above the map centre.)

## On the server

`renderToSVG` draws contour lines. It reads elevation tiles in PNG format and in lossless WebP format. For other
formats, give a `decodeImage` function. See [Server rendering](server-rendering.md).

The server renderer does not draw relief shading or 3D terrain.
