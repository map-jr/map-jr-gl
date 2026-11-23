# Show terrain and contours

This example shows the Matterhorn in 3D with relief shading and labelled contour lines, and reads the height of the
ground at a click. Two buttons switch the contour lines between feet and metres and turn the 3D terrain on and off.

<!-- example:terrain:start -->
**Map Jr**

```js [Map Jr]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. Below the map, it adds a line of text with the elevation at a
// click and two buttons.
import {createMap} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation.json';
const MATTERHORN = [7.6586, 45.9763];
const thresholds = {
  ft: {
    9: [500, 1000],
    11: [200, 1000],
    12: [100, 500],
    14: [50, 200],
    15: [20, 100],
  },
  m: {
    9: [200, 1000],
    11: [100, 500],
    12: [50, 200],
    14: [20, 100],
    15: [10, 50],
  },
};

// Additions to the style, which has the elevation source "terrarium" and relief
// shading: contour lines and stronger 3D terrain. `null` makes the map flat,
// although the style has a terrain. The style shows the heights of peaks in the
// unit of its state "elevation-unit", so `globalState` sets the unit of the
// contour lines there too.
const elevation = (unit, terrain) => ({
  terrain: terrain ? {source: 'terrarium', exaggeration: 1.5} : null,
  globalState: {'elevation-unit': unit},
  sources: {
    // For each zoom level, `thresholds` sets the interval between lines and
    // between major lines, in feet or metres.
    contours: {
      type: 'contour',
      source: 'terrarium',
      multiplier: unit === 'ft' ? 3.28084 : 1,
      thresholds: thresholds[unit],
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
        'line-color': 'hsla(25, 30%, 35%, 0.55)',
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
        'text-font': ['Noto Sans Bold'],
        'text-field': [
          'concat',
          ['number-format', ['get', 'ele'], {}],
          unit === 'ft' ? "'" : ' m',
        ],
      },
      paint: {
        'text-color': '#6b5a48',
        'text-halo-color': '#fff',
        'text-halo-width': 1.5,
      },
    },
  ],
});

const container = document.getElementById('map');
const readout = document.createElement('p');
const units = Object.assign(document.createElement('button'), {
  textContent: 'Contours in metres',
});
const flat = Object.assign(document.createElement('button'), {
  textContent: 'Flat map',
});
container.after(readout, units, flat);

let unit = 'ft',
  terrain = true;
const describe = () => ({
  style,
  ...elevation(unit, terrain),
  initialView: {center: MATTERHORN, zoom: 12.4, pitch: 60, bearing: 25},
  attribution: {compact: true},
  onClick: async e => {
    const metres = await map.queryElevation(e.lngLat);
    const feet = metres * 3.28084;
    readout.textContent =
      metres === null
        ? 'No elevation data here'
        : `${metres.toFixed(0)} m (${feet.toFixed(0)} ft) above sea level`;
  },
});
const map = createMap(container, describe());

units.onclick = () => {
  unit = unit === 'ft' ? 'm' : 'ft';
  units.textContent = unit === 'ft' ? 'Contours in metres' : 'Contours in feet';
  map.update(describe());
};
flat.onclick = () => {
  terrain = !terrain;
  flat.textContent = terrain ? 'Flat map' : '3D terrain';
  map.update(describe());
};
readout.textContent = 'Click the map to read the elevation';
```

**MapLibre**

```js [MapLibre]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. Below the map, it adds a line of text with the elevation at a
// click and two buttons.
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation.json';
const MATTERHORN = [7.6586, 45.9763];
const thresholds = {
  ft: {
    9: [500, 1000],
    11: [200, 1000],
    12: [100, 500],
    14: [50, 200],
    15: [20, 100],
  },
  m: {
    9: [200, 1000],
    11: [100, 500],
    12: [50, 200],
    14: [20, 100],
    15: [10, 50],
  },
};

const map = new Map({
  container: 'map',
  style,
  center: MATTERHORN,
  zoom: 12.4,
  pitch: 60,
  bearing: 25,
  attributionControl: {compact: true},
});
const readout = document.createElement('p');
const units = Object.assign(document.createElement('button'), {
  textContent: 'Contours in metres',
});
const flat = Object.assign(document.createElement('button'), {
  textContent: 'Flat map',
});
map.getContainer().after(readout, units, flat);

let unit = 'ft',
  terrain = true;
// Adds the contour lines and their labels in the current unit. A contour source
// is an addition of this library: it makes lines from the elevation tiles. For
// each zoom level, `thresholds` sets the interval between lines and between
// major lines, in feet or metres.
function addContours() {
  map.addSource('contours', {
    type: 'contour',
    source: 'terrarium',
    multiplier: unit === 'ft' ? 3.28084 : 1,
    thresholds: thresholds[unit],
  });
  map.addLayer(
    {
      id: 'contour-lines',
      type: 'line',
      source: 'contours',
      'source-layer': 'contours',
      paint: {
        'line-color': 'hsla(25, 30%, 35%, 0.55)',
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
      'text-font': ['Noto Sans Bold'],
      'text-field': [
        'concat',
        ['number-format', ['get', 'ele'], {}],
        unit === 'ft' ? "'" : ' m',
      ],
    },
    paint: {
      'text-color': '#6b5a48',
      'text-halo-color': '#fff',
      'text-halo-width': 1.5,
    },
  });
}

map.on('load', () => {
  // The style has the elevation source "terrarium", relief shading and a
  // terrain with exaggeration 0.5.
  map.setTerrain({source: 'terrarium', exaggeration: 1.5});
  addContours();
});

map.on('click', async e => {
  const metres = await map.queryElevation(e.lngLat);
  const feet = metres * 3.28084;
  readout.textContent =
    metres === null
      ? 'No elevation data here'
      : `${metres.toFixed(0)} m (${feet.toFixed(0)} ft) above sea level`;
});

units.onclick = () => {
  unit = unit === 'ft' ? 'm' : 'ft';
  units.textContent = unit === 'ft' ? 'Contours in metres' : 'Contours in feet';
  // The style shows the heights of peaks in the unit of its state
  // "elevation-unit".
  map.setGlobalStateProperty('elevation-unit', unit);
  // The options of a source do not change after it is added, so the source and
  // its layers are added again.
  map.removeLayer('contour-labels');
  map.removeLayer('contour-lines');
  map.removeSource('contours');
  addContours();
};
flat.onclick = () => {
  terrain = !terrain;
  flat.textContent = terrain ? 'Flat map' : '3D terrain';
  map.setTerrain(terrain ? {source: 'terrarium', exaggeration: 1.5} : null);
};
readout.textContent = 'Click the map to read the elevation';
```

**Vue**

```vue [Vue]
<script setup>
// The map fills its parent element, so give the parent a height.
import {computed, ref, useTemplateRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

const style = 'https://styles.map-jr.org/1/elevation.json';
const MATTERHORN = [7.6586, 45.9763];
const thresholds = {
  ft: {
    9: [500, 1000],
    11: [200, 1000],
    12: [100, 500],
    14: [50, 200],
    15: [20, 100],
  },
  m: {
    9: [200, 1000],
    11: [100, 500],
    12: [50, 200],
    14: [20, 100],
    15: [10, 50],
  },
};

// Additions to the style, which has the elevation source "terrarium" and relief
// shading: contour lines and stronger 3D terrain. `null` makes the map flat,
// although the style has a terrain. The style shows the heights of peaks in the
// unit of its state "elevation-unit", so `globalState` sets the unit of the
// contour lines there too.
const elevation = (unit, terrain) => ({
  terrain: terrain ? {source: 'terrarium', exaggeration: 1.5} : null,
  globalState: {'elevation-unit': unit},
  sources: {
    // For each zoom level, `thresholds` sets the interval between lines and
    // between major lines, in feet or metres.
    contours: {
      type: 'contour',
      source: 'terrarium',
      multiplier: unit === 'ft' ? 3.28084 : 1,
      thresholds: thresholds[unit],
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
        'line-color': 'hsla(25, 30%, 35%, 0.55)',
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
        'text-font': ['Noto Sans Bold'],
        'text-field': [
          'concat',
          ['number-format', ['get', 'ele'], {}],
          unit === 'ft' ? "'" : ' m',
        ],
      },
      paint: {
        'text-color': '#6b5a48',
        'text-halo-color': '#fff',
        'text-halo-width': 1.5,
      },
    },
  ],
});

const unit = ref('ft'),
  terrain = ref(true),
  height = ref(null);
// Other additions when the unit or the terrain changes. The map finds what is
// different.
const additions = computed(() => elevation(unit.value, terrain.value));
const map = useTemplateRef('map');

async function read(event) {
  height.value = await map.value.queryElevation(event.lngLat);
}
</script>

<template>
  <MapJr
    ref="map"
    :map-style="style"
    v-bind="additions"
    :initial-view="{center: MATTERHORN, zoom: 12.4, pitch: 60, bearing: 25}"
    @click="read"
  />
  <p>
    {{
      height === null
        ? 'Click the map to read the elevation'
        : `${height.toFixed(0)} m above sea level`
    }}
  </p>
  <button @click="unit = unit === 'ft' ? 'm' : 'ft'">
    Contours in {{ unit === 'ft' ? 'metres' : 'feet' }}
  </button>
  <button @click="terrain = !terrain">
    {{ terrain ? 'Flat map' : '3D terrain' }}
  </button>
</template>
```

**React**

```jsx [React]
// The map fills its parent element, so give the parent a height.
import {useMemo, useRef, useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';

const style = 'https://styles.map-jr.org/1/elevation.json';
const MATTERHORN = [7.6586, 45.9763];
const thresholds = {
  ft: {
    9: [500, 1000],
    11: [200, 1000],
    12: [100, 500],
    14: [50, 200],
    15: [20, 100],
  },
  m: {
    9: [200, 1000],
    11: [100, 500],
    12: [50, 200],
    14: [20, 100],
    15: [10, 50],
  },
};

// Additions to the style, which has the elevation source "terrarium" and relief
// shading: contour lines and stronger 3D terrain. `null` makes the map flat,
// although the style has a terrain. The style shows the heights of peaks in the
// unit of its state "elevation-unit", so `globalState` sets the unit of the
// contour lines there too.
const elevation = (unit, terrain) => ({
  terrain: terrain ? {source: 'terrarium', exaggeration: 1.5} : null,
  globalState: {'elevation-unit': unit},
  sources: {
    // For each zoom level, `thresholds` sets the interval between lines and
    // between major lines, in feet or metres.
    contours: {
      type: 'contour',
      source: 'terrarium',
      multiplier: unit === 'ft' ? 3.28084 : 1,
      thresholds: thresholds[unit],
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
        'line-color': 'hsla(25, 30%, 35%, 0.55)',
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
        'text-font': ['Noto Sans Bold'],
        'text-field': [
          'concat',
          ['number-format', ['get', 'ele'], {}],
          unit === 'ft' ? "'" : ' m',
        ],
      },
      paint: {
        'text-color': '#6b5a48',
        'text-halo-color': '#fff',
        'text-halo-width': 1.5,
      },
    },
  ],
});

export default function Terrain() {
  const [unit, setUnit] = useState('ft'),
    [terrain, setTerrain] = useState(true),
    [height, setHeight] = useState(null);
  // Other additions when the unit or the terrain changes. The map finds what is
  // different.
  const additions = useMemo(() => elevation(unit, terrain), [unit, terrain]);
  const map = useRef(null);

  return (
    <>
      <MapJr
        ref={map}
        mapStyle={style}
        {...additions}
        initialView={{center: MATTERHORN, zoom: 12.4, pitch: 60, bearing: 25}}
        onClick={async e =>
          setHeight(await map.current.queryElevation(e.lngLat))
        }
      />
      <p>
        {height === null
          ? 'Click the map to read the elevation'
          : `${height.toFixed(0)} m above sea level`}
      </p>
      <button onClick={() => setUnit(unit === 'ft' ? 'm' : 'ft')}>
        Contours in {unit === 'ft' ? 'metres' : 'feet'}
      </button>
      <button onClick={() => setTerrain(!terrain)}>
        {terrain ? 'Flat map' : '3D terrain'}
      </button>
    </>
  );
}
```

**Svelte**

```svelte [Svelte]
<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';

  const thresholds = {
    ft: {
      9: [500, 1000],
      11: [200, 1000],
      12: [100, 500],
      14: [50, 200],
      15: [20, 100],
    },
    m: {
      9: [200, 1000],
      11: [100, 500],
      12: [50, 200],
      14: [20, 100],
      15: [10, 50],
    },
  };

  // Additions to the style, which has the elevation source "terrarium" and
  // relief shading: contour lines and stronger 3D terrain. `null` makes the map
  // flat, although the style has a terrain. The style shows the heights of
  // peaks in the unit of its state "elevation-unit", so `globalState` sets the
  // unit of the contour lines there too.
  const elevation = (unit, terrain) => ({
    terrain: terrain ? {source: 'terrarium', exaggeration: 1.5} : null,
    globalState: {'elevation-unit': unit},
    sources: {
      // For each zoom level, `thresholds` sets the interval between lines and
      // between major lines, in feet or metres.
      contours: {
        type: 'contour',
        source: 'terrarium',
        multiplier: unit === 'ft' ? 3.28084 : 1,
        thresholds: thresholds[unit],
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
          'line-color': 'hsla(25, 30%, 35%, 0.55)',
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
          'text-font': ['Noto Sans Bold'],
          'text-field': [
            'concat',
            ['number-format', ['get', 'ele'], {}],
            unit === 'ft' ? "'" : ' m',
          ],
        },
        paint: {
          'text-color': '#6b5a48',
          'text-halo-color': '#fff',
          'text-halo-width': 1.5,
        },
      },
    ],
  });

  let map = null;
  let unit = $state('ft'),
    terrain = $state(true),
    height = $state(null);
  // Other additions when the unit or the terrain changes. The map finds what is
  // different.
  const description = $derived({
    style: 'https://styles.map-jr.org/1/elevation.json',
    ...elevation(unit, terrain),
    initialView: {
      center: [7.6586, 45.9763],
      zoom: 12.4,
      pitch: 60,
      bearing: 25,
    },
    attribution: {compact: true},
    onClick: async e => {
      height = await map.queryElevation(e.lngLat);
    },
  });
</script>

<div
  use:mapJr={{description, ready: instance => (map = instance)}}
  style="height: 500px"
></div>
<p>
  {height === null
    ? 'Click the map to read the elevation'
    : `${height.toFixed(0)} m above sea level`}
</p>
<button onclick={() => (unit = unit === 'ft' ? 'm' : 'ft')}
  >Contours in {unit === 'ft' ? 'metres' : 'feet'}</button
>
<button onclick={() => (terrain = !terrain)}
  >{terrain ? 'Flat map' : '3D terrain'}</button
>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8" />
<title>
  3D terrain, relief shading and contour lines from one elevation source
</title>
<!--
  Below the map, a line of text
  gives the elevation at a click,
  and two buttons change the map.
-->
<map-jr
  id="map"
  map-style="https://styles.map-jr.org/1/elevation.json"
  center="7.6586,45.9763"
  zoom="12.4"
  pitch="60"
  bearing="25"
  style="height: 500px"
></map-jr>
<p id="readout">Click the map to read the elevation</p>
<button id="units">Contours in metres</button>
<button id="flat">Flat map</button>
<script type="module">
  import '@map-jr/map-jr-gl/element';

  const thresholds = {
    ft: {
      9: [500, 1000],
      11: [200, 1000],
      12: [100, 500],
      14: [50, 200],
      15: [20, 100],
    },
    m: {
      9: [200, 1000],
      11: [100, 500],
      12: [50, 200],
      14: [20, 100],
      15: [10, 50],
    },
  };

  const map = document.getElementById('map');
  const readout = document.getElementById('readout');
  const units = document.getElementById('units');
  const flat = document.getElementById('flat');
  map.attribution = {compact: true};

  // Additions to the style, which
  // has the elevation source
  // "terrarium" and relief
  // shading: contour lines and
  // stronger 3D terrain. `null`
  // makes the map flat, although
  // the style has a terrain. The
  // style shows the heights of
  // peaks in the unit of its
  // state "elevation-unit", so
  // `globalState` sets the unit
  // of the contour lines there
  // too.
  let unit = 'ft',
    terrain = true;
  const showElevation = () => {
    map.terrain = terrain ? {source: 'terrarium', exaggeration: 1.5} : null;
    map.globalState = {'elevation-unit': unit};
    map.sources = {
      // For each zoom level,
      // `thresholds` sets the
      // interval between lines
      // and between major lines,
      // in feet or metres.
      contours: {
        type: 'contour',
        source: 'terrarium',
        multiplier: unit === 'ft' ? 3.28084 : 1,
        thresholds: thresholds[unit],
      },
    };
    map.layers = [
      {
        id: 'contour-lines',
        type: 'line',
        source: 'contours',
        'source-layer': 'contours',
        before: 'water',
        paint: {
          'line-color': 'hsla(25, 30%, 35%, 0.55)',
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
          'text-font': ['Noto Sans Bold'],
          'text-field': [
            'concat',
            ['number-format', ['get', 'ele'], {}],
            unit === 'ft' ? "'" : ' m',
          ],
        },
        paint: {
          'text-color': '#6b5a48',
          'text-halo-color': '#fff',
          'text-halo-width': 1.5,
        },
      },
    ];
  };
  showElevation();

  map.addEventListener('map-click', async event => {
    const metres = await map.map.queryElevation(event.detail.lngLat);
    const feet = metres * 3.28084;
    readout.textContent =
      metres === null
        ? 'No elevation data here'
        : `${metres.toFixed(0)} m (${feet.toFixed(0)} ft) above sea level`;
  });
  units.onclick = () => {
    unit = unit === 'ft' ? 'm' : 'ft';
    units.textContent =
      unit === 'ft' ? 'Contours in metres' : 'Contours in feet';
    showElevation();
  };
  flat.onclick = () => {
    terrain = !terrain;
    flat.textContent = terrain ? 'Flat map' : '3D terrain';
    showElevation();
  };
</script>
```
<!-- example:terrain:end -->

## How it works

- The style `elevation.json` has the elevation source `terrarium`, relief shading and a terrain.
  [`terrain`](../reference/description.md#terrain) of the description overrides the terrain of the style, and `null`
  shows a flat map.
- A source of the type `contour` in [`sources`](../reference/description.md#sources) creates contour lines from the
  elevation source. Each key of `thresholds` is a zoom level, and its value is two intervals: between lines, and between
  major lines. The intervals are in metres multiplied by `multiplier`, so in feet with `3.28084`.
- The `line` layer draws the lines below the layer `water` of the style (`before`), and the `symbol` layer labels the
  major lines with the property `ele`.
- The style shows the heights of peaks in feet or metres, as its state `elevation-unit` says (`'ft'` by default).
  [`globalState`](../reference/description.md#globalstate) sets it to the unit of the contour lines, so that the labels
  of the peaks change with the button too.
- [`queryElevation`](../reference/map.md#queryelevation) resolves to the height of the ground in metres. It resolves to
  `null` when the elevation tile has no data, and it rejects when the style has no `raster-dem` source.
- Each button calls [`update`](../reference/map.md#update) with a new description from `describe`. A change of `terrain`
  or of a source in `sources` [loads the style again](../reference/description.md#style).

The compat example sets the terrain with `setTerrain` and adds the contour source and its two layers on `load`. Its
unit button sets the state with `setGlobalStateProperty`, and it removes the source and its layers and adds them again,
because the options of a source do not change after it is added. Its terrain button calls `setTerrain`, and `null`
shows a flat map.

## Variations

Each variation changes the Map Jr example. The buttons call `describe` again, so a change goes into `describe` or
`elevation`, not into one call of `update`.

### Start with a flat map

Write `let unit = 'ft', terrain = false;`. The button then turns the 3D terrain on.

### Change how high the terrain is drawn

In `elevation`, change `exaggeration: 1.5` to another number. `exaggeration` multiplies the heights of the ground as
they are drawn, and the default is `1`.

## See also

- [Terrain](../guide/terrain.md) for 3D terrain, relief shading, colour by height and the options of a contour source.
- [Ask for the height of the ground](../guide/terrain.md#ask-for-the-height-of-the-ground).
