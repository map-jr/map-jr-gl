# Terrain and elevation

This page shows how to draw mountains in 3D, shade the relief, color the ground by its height, draw contour lines
and ask for the height of the ground at a position. Each of these reads an elevation source: a source of the type
`raster-dem`, whose tiles store a height for each pixel.

## Show 3D terrain

The style `elevation.json` has an elevation source with the id `terrarium` and a terrain with an exaggeration of
0.5. This example draws the same terrain with an exaggeration of 1.5 over the Matterhorn.

**Map Jr**

```js [Map Jr]
import {createMap} from '@map-jr/map-jr-gl';

// The page has <div id="map" style="height: 400px"></div>.
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation.json',
  initialView: {center: [7.6586, 45.9763], zoom: 12.4, pitch: 60},
  terrain: {source: 'terrarium', exaggeration: 1.5},
});
```

**MapLibre**

```js [MapLibre]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

// The page has <div id="map" style="height: 400px"></div>.
const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation.json',
  center: [7.6586, 45.9763],
  zoom: 12.4,
  pitch: 60,
});

map.on('load', () => map.setTerrain({source: 'terrarium', exaggeration: 1.5}));
```

**Vue**

```vue [Vue]
<script setup>
import {MapJr} from '@map-jr/map-jr-gl/vue';
</script>

<template>
  <div style="height: 400px">
    <MapJr
      map-style="https://styles.map-jr.org/1/elevation.json"
      :initial-view="{center: [7.6586, 45.9763], zoom: 12.4, pitch: 60}"
      :terrain="{source: 'terrarium', exaggeration: 1.5}"
    />
  </div>
</template>
```

**React**

```jsx [React]
import {MapJr} from '@map-jr/map-jr-gl/react';

const initialView = {center: [7.6586, 45.9763], zoom: 12.4, pitch: 60};
const terrain = {source: 'terrarium', exaggeration: 1.5};

export default function Matterhorn() {
  return (
    <div style={{height: 400}}>
      <MapJr
        mapStyle="https://styles.map-jr.org/1/elevation.json"
        initialView={initialView}
        terrain={terrain}
      />
    </div>
  );
}
```

The field [`terrain`](../reference/description.md#terrain) of the description overrides the `terrain` of the style.
`terrain: null` draws no 3D terrain, also when the style has a `terrain`. Without the field, the map draws the terrain
of the style. `exaggeration` multiplies the heights and is 1 by default.

`source` is the id of a `raster-dem` source of the style or of [`sources`](../reference/description.md#sources).
The style [`elevation-zero.json`](https://map-jr.org/styles?style=elevation-zero) has no elevation source, so this example adds one in `sources`. `encoding` is
`mapbox` (the default), `terrarium` or `custom`. A PMTiles archive also works, with the prefix `pmtiles://` before
its URL.

**Map Jr**

```js [Map Jr]
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [7.6586, 45.9763], zoom: 12.4, pitch: 60},
  sources: {
    dem: {
      type: 'raster-dem',
      tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
      encoding: 'terrarium',
      tileSize: 512,
      maxzoom: 12,
    },
  },
  terrain: {source: 'dem', exaggeration: 1.5},
});
```

## Turn 3D terrain on and off

The control `terrain` of `@map-jr/map-jr-gl/controls` is a button that turns 3D terrain on and off. Its options are
the `source` and the `exaggeration` of the terrain that it turns on. See [Controls](controls.md) for how to add
controls to a map.

**Map Jr**

```js [Map Jr]
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, terrain} from '@map-jr/map-jr-gl/controls';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation.json',
  initialView: {center: [7.6586, 45.9763], zoom: 12.4, pitch: 60},
  terrain: null, // flat until the user clicks the button
  controls: [navigation(), terrain({source: 'terrarium', exaggeration: 1.5})],
});
```

**MapLibre**

```js [MapLibre]
import {
  Map,
  NavigationControl,
  TerrainControl,
} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation.json',
  center: [7.6586, 45.9763],
  zoom: 12.4,
  pitch: 60,
});
map.addControl(new NavigationControl());
map.addControl(new TerrainControl({source: 'terrarium', exaggeration: 1.5}));
```

To turn the terrain on and off from your own code, pass a new `terrain` to
[`patch`](../reference/map.md#patch) with the main API, or call `map.setTerrain(null)` with the MapLibre compat entry.
With the main API, a change of `terrain` does not load the style again.

A click on the control sets `terrain` of the description with `patch` and calls the option `onTerrainChange` of the
control with the new value. An application that passes its description again, as a component of Vue, React or Svelte does on each change of a prop, keeps the value in
`onTerrainChange` and passes it as `terrain`. Otherwise its next description replaces the terrain of the click: a
description without `terrain` gives the terrain of the style.

**Map Jr**

```js [Map Jr]
import {createMap} from '@map-jr/map-jr-gl';

// The page has <input type="checkbox" id="relief" checked> beside the map.
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation.json',
  initialView: {center: [7.6586, 45.9763], zoom: 12.4, pitch: 60},
  terrain: {source: 'terrarium', exaggeration: 1.5},
});

function showRelief(on) {
  map.patch({terrain: on ? {source: 'terrarium', exaggeration: 1.5} : null});
}
document
  .getElementById('relief')
  .addEventListener('change', e => showRelief(e.target.checked));
```

## What 3D terrain changes

- When the camera looks straight down, the map is flat. The terrain rises during the first 10 degrees of
  [pitch](../reference/description.md#initialview).
- Labels, symbols, buildings and elements of the page (markers and popups) are drawn at the height of the ground.
- `e.lngLat` of a pointer event and `unproject` return the position of the ground under the point. `project` returns
  the point of the screen where the ground at a position is drawn.
- A label behind a mountain is hidden. A marker behind a mountain stays visible.
- The roof of a building follows the slope of the ground under it.
- When a movement stops, the map moves the center of the view to the ground that the camera looks at. The view on the
  screen does not move, but the `center` and the `zoom` of the view change by a small amount.
- When the camera would be inside the terrain, it rises above the ground, and the map solves the pitch and the zoom
  again, as MapLibre GL JS does. `view` of the state reports the solved values, and so do `getPitch()` and
  `getZoom()` in `@map-jr/map-jr-gl/maplibre-compat`. A pitch or rotate gesture keeps its values.
- The heights come from the full elevation image, so `queryTerrainElevation` and the height of the camera agree with
  MapLibre GL JS within 5 %.
- With a `sky` in the style, the map draws fog on the terrain above a pitch of 60 degrees. The properties
  `fog-color`, `fog-ground-blend` and `horizon-fog-blend` of `sky` set the fog.
- On the [globe](globe.md), the map draws the 3D terrain on the sphere. It draws no fog there.
- The [server renderer](server-rendering.md) draws no 3D terrain.

## Shade the relief

A `hillshade` layer draws light and shadow from an elevation source. It does not need 3D terrain. The style
`elevation.json` has such a layer with the id `terrain-rgb-terrarium`. This example adds one with four lights to
`elevation-zero.json`. `before: 'water'` inserts the new layer below the style layer `water`, so that the water covers
the shading.

**Map Jr**

```js [Map Jr]
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [7.6586, 45.9763], zoom: 11},
  sources: {
    dem: {
      type: 'raster-dem',
      tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
      encoding: 'terrarium',
      tileSize: 512,
      maxzoom: 12,
    },
  },
  layers: [
    {
      id: 'relief',
      type: 'hillshade',
      source: 'dem',
      before: 'water',
      paint: {
        'hillshade-method': 'multidirectional',
        'hillshade-illumination-direction': [270, 315, 0, 45],
        'hillshade-illumination-altitude': [30, 30, 30, 30],
        'hillshade-highlight-color': '#ffffff',
        'hillshade-shadow-color': '#000000',
      },
    },
  ],
});
```

**MapLibre**

```js [MapLibre]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [7.6586, 45.9763],
  zoom: 11,
});

map.on('load', () => {
  map.addSource('dem', {
    type: 'raster-dem',
    tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
    encoding: 'terrarium',
    tileSize: 512,
    maxzoom: 12,
  });
  map.addLayer(
    {
      id: 'relief',
      type: 'hillshade',
      source: 'dem',
      paint: {
        'hillshade-method': 'multidirectional',
        'hillshade-illumination-direction': [270, 315, 0, 45],
        'hillshade-illumination-altitude': [30, 30, 30, 30],
        'hillshade-highlight-color': '#ffffff',
        'hillshade-shadow-color': '#000000',
      },
    },
    'water',
  );
});
```

`hillshade-method` selects how the layer shades the ground. The default is `standard`.

| `hillshade-method` | What it draws |
|---|---|
| `standard` | Shadows and highlights from one light, with `hillshade-accent-color` on steep slopes. Only this method uses that color. |
| `basic` | Ground that faces the light gets `hillshade-highlight-color`, and ground that faces away gets `hillshade-shadow-color`. |
| `combined` | The shading of `basic`, multiplied by the steepness of the ground. Level ground is transparent. |
| `igor` | The shading follows the direction that the ground faces, and steep slopes do not turn fully dark. |
| `multidirectional` | The shading of `basic` for several lights, averaged. |

`hillshade-illumination-altitude` is the height of the light above the horizon, in degrees from 0 to 90. The default
is 45. With `multidirectional`, the four properties of the example each accept one value or a list with a value for
each light. A list that is shorter than the longest list repeats its last value. The layer draws at most 8 lights.
The other methods use the first value of a list.

## Color the ground by its height

A `color-relief` layer gives each pixel a color from its height in meters. `color-relief-color` is an `interpolate`
expression of `["elevation"]`. Below the first stop, the layer has the color of the first stop, and above the last
stop it has the color of the last stop.

**Map Jr**

```js [Map Jr]
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [7.6586, 45.9763], zoom: 9},
  sources: {
    dem: {
      type: 'raster-dem',
      tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
      encoding: 'terrarium',
      tileSize: 512,
      maxzoom: 12,
    },
  },
  layers: [
    {
      id: 'heights',
      type: 'color-relief',
      source: 'dem',
      before: 'water',
      paint: {
        'color-relief-opacity': 0.8,
        'color-relief-color': [
          'interpolate',
          ['linear'],
          ['elevation'],
          0,
          '#2e7d32',
          1000,
          '#fdd835',
          2500,
          '#8d6e63',
          4000,
          '#ffffff',
        ],
      },
    },
  ],
});
```

**MapLibre**

```js [MapLibre]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [7.6586, 45.9763],
  zoom: 9,
});

map.on('load', () => {
  map.addSource('dem', {
    type: 'raster-dem',
    tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
    encoding: 'terrarium',
    tileSize: 512,
    maxzoom: 12,
  });
  map.addLayer(
    {
      id: 'heights',
      type: 'color-relief',
      source: 'dem',
      paint: {
        'color-relief-opacity': 0.8,
        'color-relief-color': [
          'interpolate',
          ['linear'],
          ['elevation'],
          0,
          '#2e7d32',
          1000,
          '#fdd835',
          2500,
          '#8d6e63',
          4000,
          '#ffffff',
        ],
      },
    },
    'water',
  );
});
```

The server renderer does not draw a `color-relief` layer.

## Draw contour lines

A source of the type `contour` creates vector tiles with contour lines from an elevation source. A `line` layer draws
the lines, and a `symbol` layer can label them. MapLibre GL JS has no such source and needs a plugin for it.

**Map Jr**

```js [Map Jr]
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation.json',
  initialView: {center: [7.6586, 45.9763], zoom: 13},
  sources: {
    contours: {
      type: 'contour',
      source: 'terrarium',
      multiplier: 3.28084,
      thresholds: {11: [200, 1000], 12: [100, 500], 14: [50, 200]},
    },
  },
  layers: [
    {
      id: 'contour-lines',
      type: 'line',
      source: 'contours',
      'source-layer': 'contours',
      before: 'water',
      paint: {
        'line-color': '#8a6f55',
        'line-width': ['match', ['get', 'level'], 1, 1.2, 0.5],
      },
    },
    {
      id: 'contour-labels',
      type: 'symbol',
      source: 'contours',
      'source-layer': 'contours',
      filter: ['>', ['get', 'level'], 0],
      layout: {
        'symbol-placement': 'line',
        'text-size': 10,
        'text-field': ['concat', ['get', 'ele'], ' ft'],
      },
    },
  ],
});
```

**MapLibre**

```js [MapLibre]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation.json',
  center: [7.6586, 45.9763],
  zoom: 13,
});

map.on('load', () => {
  map.addSource('contours', {
    type: 'contour',
    source: 'terrarium',
    multiplier: 3.28084,
    thresholds: {11: [200, 1000], 12: [100, 500], 14: [50, 200]},
  });
  map.addLayer(
    {
      id: 'contour-lines',
      type: 'line',
      source: 'contours',
      'source-layer': 'contours',
      paint: {
        'line-color': '#8a6f55',
        'line-width': ['match', ['get', 'level'], 1, 1.2, 0.5],
      },
    },
    'water',
  );
  map.addLayer({
    id: 'contour-labels',
    type: 'symbol',
    source: 'contours',
    'source-layer': 'contours',
    filter: ['>', ['get', 'level'], 0],
    layout: {
      'symbol-placement': 'line',
      'text-size': 10,
      'text-field': ['concat', ['get', 'ele'], ' ft'],
    },
  });
});
```

Each key of `thresholds` is a zoom level, and its value is two intervals in the unit of the heights. The first is the
interval between lines, and the second is the interval between major lines. An entry applies from its zoom level up
to the zoom level of the next entry. In the example, zoom 12 and zoom 13 have a line every 100 feet and a major line
every 500 feet. Below the lowest zoom level of `thresholds`, the source has no lines.

An interval that is not greater than 0 gives no lines, and the map warns one time in the console.

A contour tile has no lines when its lines would cross the cells of its grid of 256 by 256 heights more than 1,000,000
times, and the map warns one time for each source. A tile of steep mountains, with heights from 500 to 3500 m and a
line every 20 m, crosses about 250,000 times.

More crossings usually mean that the `encoding` of the `raster-dem` source is wrong: `terrarium` tiles read as `mapbox`
cross more than 10,000,000 times. They can also mean that the interval is too small for the zoom level.

Each line has the property `ele`, its height, and the property `level`, which is 1 for a major line and 0 for
another line. The options of a contour source:

| Option | Default | Description |
|---|---|---|
| `source` **required** | | The id of a `raster-dem` source. |
| `thresholds` | | The intervals for each zoom level. Without it, the source has no lines, and the map warns one time in the console. |
| `multiplier` | `1` | The map multiplies each height by this number. Use `3.28084` for feet. |
| `overzoom` | `1` | How many zoom levels the elevation tiles are below the contour tiles. `2` gives smoother, less exact lines from fewer requests. |
| `contourLayer` | `'contours'` | The name of the layer in the contour tiles, which `source-layer` names. |
| `elevationKey` | `'ele'` | The name of the property that has the height of a line. |
| `levelKey` | `'level'` | The name of the property that is 1 for a major line. |
| `maxzoom` | `15` | The most detailed zoom level of the contour tiles. |

The server renderer draws contour lines. See [Server rendering](server-rendering.md) for the formats of elevation
tiles that it reads.

## Ask for the height of the ground

`queryElevation` returns a promise of the height of the ground in meters above sea level, at a position
(`[lng, lat]`) or at a point of the screen (`{x, y}`). Over the sea, the elevation tiles of `elevation.json` give 0.
The query does not need 3D terrain, and the position can be outside the view.

The promise resolves to `null` when the source has no tile at the position. It rejects when the style has no
`raster-dem` source, for example after a change to a style without one. A `raster-dem` source of `sources` counts as
a source of the style.

**Map Jr**

```js [Map Jr]
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation.json',
  initialView: {center: [7.6586, 45.9763], zoom: 12},
  onClick: async e => {
    const meters = await map.queryElevation(e.lngLat);
    console.log(
      meters === null ? 'No elevation data here' : `${Math.round(meters)} m`,
    );
  },
});
```

**MapLibre**

```js [MapLibre]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation.json',
  center: [7.6586, 45.9763],
  zoom: 12,
});

map.on('click', async e => {
  const meters = await map.queryElevation(e.lngLat);
  console.log(
    meters === null ? 'No elevation data here' : `${Math.round(meters)} m`,
  );
});
```

`queryElevation` reads the first `raster-dem` source of the style, where the sources of
[`sources`](../reference/description.md#sources) count as sources of the style. To read another source, pass its id
as the second argument in both entries: `map.queryElevation(lngLat, {source: 'dem'})`. The option `zoom` sets the
zoom level of the elevation tile that the query reads, and a lower `zoom` reads a tile with less detail. See
[`queryElevation`](../reference/map.md#queryelevation) for the defaults.

The MapLibre compat entry also has the methods of MapLibre GL JS that read 3D terrain. They return a number at once, and
the number is the height multiplied by the exaggeration of the terrain:

| Method | Returns |
|---|---|
| `map.queryTerrainElevation(lngLat)` | The height at a position in meters above sea level, multiplied by the exaggeration, or `null` with no 3D terrain. |
| `map.getCenterElevation()` | The height of the map center in meters: the height that `setCenterElevation` gave, or else the height of the ground there, multiplied by the exaggeration (`0` with no 3D terrain). |

## See also

- [`terrain`](../reference/description.md#terrain), [`sources`](../reference/description.md#sources) and
  [`layers`](../reference/description.md#layers) of the description.
- [The globe](globe.md), which draws the 3D terrain on the sphere.
- [Server rendering](server-rendering.md) for contour lines in an image that a server renders.
