# Switch between map styles

This example adds a control that lets the user choose one of three styles, and keeps the chosen style in the
description of the map. A button below the map hides and shows four sights of Lucerne, which stay on every style.

<!-- example:styles:start -->
**Map Jr**

```js [Map Jr]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. A button of the map opens a list of three styles. Below the
// map, a line of text names the chosen style, and a button hides and shows four
// sights.
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, styles} from '@map-jr/map-jr-gl/controls';

const base = 'https://styles.map-jr.org/1/';
const entries = [
  {label: 'Elevation', style: base + 'elevation-zero.json'},
  {label: 'Positron', style: base + 'openfreemap-positron.json'},
  {label: 'Dark', style: base + 'openfreemap-dark.json'},
];
const sights = {
  type: 'FeatureCollection',
  features: [
    ['Chapel Bridge', 8.3077, 47.0516],
    ['Lion Monument', 8.3103, 47.0584],
    ['KKL Luzern', 8.3125, 47.0502],
    ['Swiss Museum of Transport', 8.3357, 47.0527],
  ].map(([name, lng, lat]) => ({
    type: 'Feature',
    properties: {name},
    geometry: {type: 'Point', coordinates: [lng, lat]},
  })),
};
const sightsLayer = {
  id: 'sights',
  type: 'circle',
  source: 'sights',
  paint: {
    'circle-radius': 7,
    'circle-color': '#d6453d',
    'circle-stroke-color': '#fff',
    'circle-stroke-width': 2,
  },
};

const container = document.getElementById('map');
const readout = document.createElement('p');
const toggle = document.createElement('button');
container.after(readout, toggle);

let entry = entries[0],
  shown = true;
const show = () => {
  readout.textContent = `Style: ${entry.label}`;
  toggle.textContent = shown ? 'Hide sights' : 'Show sights';
};
// The control sets the style of a choice on the map. `onStyleChange` keeps the
// entry, so that the next description passes the chosen style and not the first
// one.
const controls = [
  navigation(),
  styles({
    entries,
    onStyleChange: chosen => {
      entry = chosen;
      show();
    },
  }),
];
const describe = () => ({
  style: entry.style,
  initialView: {center: [8.32, 47.054], zoom: 13.5},
  data: {sights},
  layers: shown ? [sightsLayer] : [],
  controls,
  attribution: {compact: true},
});
const map = createMap(container, describe());

toggle.onclick = () => {
  shown = !shown;
  show();
  map.update(describe());
};
show();
```

**MapLibre**

```js [MapLibre]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. The compat entry has no control for styles, so a control of
// your own in the top left corner has a list of three styles and calls
// setStyle. Below the map, a line of text names the chosen style, and a button
// hides and shows four sights.
import {Map, NavigationControl} from '@map-jr/map-jr-gl/maplibre-compat';

const base = 'https://styles.map-jr.org/1/';
const entries = [
  {label: 'Elevation', style: base + 'elevation-zero.json'},
  {label: 'Positron', style: base + 'openfreemap-positron.json'},
  {label: 'Dark', style: base + 'openfreemap-dark.json'},
];
const sights = {
  type: 'FeatureCollection',
  features: [
    ['Chapel Bridge', 8.3077, 47.0516],
    ['Lion Monument', 8.3103, 47.0584],
    ['KKL Luzern', 8.3125, 47.0502],
    ['Swiss Museum of Transport', 8.3357, 47.0527],
  ].map(([name, lng, lat]) => ({
    type: 'Feature',
    properties: {name},
    geometry: {type: 'Point', coordinates: [lng, lat]},
  })),
};
let shown = true;

// A control of MapLibre GL JS: an object with onAdd, which returns the element
// of the control, and onRemove.
class StylesControl {
  onAdd(map) {
    this.container = document.createElement('div');
    // The class maplibregl-ctrl lets the element take clicks. Its look is
    // yours.
    this.container.className = 'maplibregl-ctrl';
    const select = this.container.appendChild(document.createElement('select'));
    select.setAttribute('aria-label', 'Style');
    for (const entry of entries)
      select.append(
        Object.assign(document.createElement('option'), {
          textContent: entry.label,
          value: entry.style,
        }),
      );
    select.addEventListener('change', () => {
      map.setStyle(select.value);
      readout.textContent = `Style: ${select.selectedOptions[0].text}`;
    });
    return this.container;
  }
  onRemove() {
    this.container.remove();
  }
}

const map = new Map({
  container: 'map',
  style: entries[0].style,
  center: [8.32, 47.054],
  zoom: 13.5,
  attributionControl: {compact: true},
});
map.addControl(new NavigationControl());
map.addControl(new StylesControl(), 'top-left');

// setStyle replaces the whole style, with the sources and layers that addSource
// and addLayer added. They are added again each time a style has loaded.
map.on('style.load', () => {
  map.addSource('sights', {type: 'geojson', data: sights});
  map.addLayer({
    id: 'sights',
    type: 'circle',
    source: 'sights',
    layout: {visibility: shown ? 'visible' : 'none'},
    paint: {
      'circle-radius': 7,
      'circle-color': '#d6453d',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
  });
});

const readout = document.createElement('p');
const toggle = document.createElement('button');
map.getContainer().after(readout, toggle);
readout.textContent = `Style: ${entries[0].label}`;
toggle.textContent = 'Hide sights';
toggle.onclick = () => {
  shown = !shown;
  toggle.textContent = shown ? 'Hide sights' : 'Show sights';
  map.setLayoutProperty('sights', 'visibility', shown ? 'visible' : 'none');
};
```

**Vue**

```vue [Vue]
<script setup>
// The map fills its parent element, so give the parent a height.
import {computed, ref, shallowRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {navigation, styles} from '@map-jr/map-jr-gl/controls';

const base = 'https://styles.map-jr.org/1/';
const entries = [
  {label: 'Elevation', style: base + 'elevation-zero.json'},
  {label: 'Positron', style: base + 'openfreemap-positron.json'},
  {label: 'Dark', style: base + 'openfreemap-dark.json'},
];
const sights = {
  type: 'FeatureCollection',
  features: [
    ['Chapel Bridge', 8.3077, 47.0516],
    ['Lion Monument', 8.3103, 47.0584],
    ['KKL Luzern', 8.3125, 47.0502],
    ['Swiss Museum of Transport', 8.3357, 47.0527],
  ].map(([name, lng, lat]) => ({
    type: 'Feature',
    properties: {name},
    geometry: {type: 'Point', coordinates: [lng, lat]},
  })),
};
const data = {sights};
const sightsLayer = {
  id: 'sights',
  type: 'circle',
  source: 'sights',
  paint: {
    'circle-radius': 7,
    'circle-color': '#d6453d',
    'circle-stroke-color': '#fff',
    'circle-stroke-width': 2,
  },
};

// The component passes `map-style` again at each change of another prop.
// `onStyleChange` keeps the chosen entry, so that the map keeps the chosen
// style.
const entry = shallowRef(entries[0]);
const shown = ref(true);
const layers = computed(() => (shown.value ? [sightsLayer] : []));
const controls = [
  navigation(),
  styles({
    entries,
    onStyleChange: chosen => {
      entry.value = chosen;
    },
  }),
];
</script>

<template>
  <MapJr
    :map-style="entry.style"
    :initial-view="{center: [8.32, 47.054], zoom: 13.5}"
    :data="data"
    :layers="layers"
    :controls="controls"
    :attribution="{compact: true}"
  />
  <p>Style: {{ entry.label }}</p>
  <button @click="shown = !shown">
    {{ shown ? 'Hide sights' : 'Show sights' }}
  </button>
</template>
```

**Nuxt**

```vue [Nuxt]
<script setup>
// A page of a Nuxt app whose nuxt.config.ts has modules:
// ['@map-jr/map-jr-gl/nuxt']. The map fills its parent element, so give the
// parent a height.

const base = 'https://styles.map-jr.org/1/';
const entries = [
  {label: 'Elevation', style: base + 'elevation-zero.json'},
  {label: 'Positron', style: base + 'openfreemap-positron.json'},
  {label: 'Dark', style: base + 'openfreemap-dark.json'},
];
const sights = {
  type: 'FeatureCollection',
  features: [
    ['Chapel Bridge', 8.3077, 47.0516],
    ['Lion Monument', 8.3103, 47.0584],
    ['KKL Luzern', 8.3125, 47.0502],
    ['Swiss Museum of Transport', 8.3357, 47.0527],
  ].map(([name, lng, lat]) => ({
    type: 'Feature',
    properties: {name},
    geometry: {type: 'Point', coordinates: [lng, lat]},
  })),
};
const data = {sights};
const sightsLayer = {
  id: 'sights',
  type: 'circle',
  source: 'sights',
  paint: {
    'circle-radius': 7,
    'circle-color': '#d6453d',
    'circle-stroke-color': '#fff',
    'circle-stroke-width': 2,
  },
};

// The component passes `map-style` again at each change of another prop.
// `onStyleChange` keeps the chosen entry, so that the map keeps the chosen
// style.
const entry = shallowRef(entries[0]);
const shown = ref(true);
const layers = computed(() => (shown.value ? [sightsLayer] : []));
const controls = [
  navigationControl(),
  stylesControl({
    entries,
    onStyleChange: chosen => {
      entry.value = chosen;
    },
  }),
];
</script>

<template>
  <MapJr
    :map-style="entry.style"
    :initial-view="{center: [8.32, 47.054], zoom: 13.5}"
    :data="data"
    :layers="layers"
    :controls="controls"
    :attribution="{compact: true}"
  />
  <p>Style: {{ entry.label }}</p>
  <button @click="shown = !shown">
    {{ shown ? 'Hide sights' : 'Show sights' }}
  </button>
</template>
```

**React**

```jsx [React]
// The map fills its parent element, so give the parent a height.
import {useMemo, useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';
import {navigation, styles} from '@map-jr/map-jr-gl/controls';

const base = 'https://styles.map-jr.org/1/';
const entries = [
  {label: 'Elevation', style: base + 'elevation-zero.json'},
  {label: 'Positron', style: base + 'openfreemap-positron.json'},
  {label: 'Dark', style: base + 'openfreemap-dark.json'},
];
const sights = {
  type: 'FeatureCollection',
  features: [
    ['Chapel Bridge', 8.3077, 47.0516],
    ['Lion Monument', 8.3103, 47.0584],
    ['KKL Luzern', 8.3125, 47.0502],
    ['Swiss Museum of Transport', 8.3357, 47.0527],
  ].map(([name, lng, lat]) => ({
    type: 'Feature',
    properties: {name},
    geometry: {type: 'Point', coordinates: [lng, lat]},
  })),
};
const data = {sights};
const sightsLayer = {
  id: 'sights',
  type: 'circle',
  source: 'sights',
  paint: {
    'circle-radius': 7,
    'circle-color': '#d6453d',
    'circle-stroke-color': '#fff',
    'circle-stroke-width': 2,
  },
};
const initialView = {center: [8.32, 47.054], zoom: 13.5};

export default function StyleSwitcher() {
  // The component passes `mapStyle` again at each render. `onStyleChange` keeps
  // the chosen entry, so that the map keeps the chosen style.
  const [entry, setEntry] = useState(entries[0]);
  const [shown, setShown] = useState(true);
  const controls = useMemo(
    () => [navigation(), styles({entries, onStyleChange: setEntry})],
    [],
  );
  const layers = useMemo(() => (shown ? [sightsLayer] : []), [shown]);

  return (
    <>
      <MapJr
        mapStyle={entry.style}
        initialView={initialView}
        data={data}
        layers={layers}
        controls={controls}
        attribution={{compact: true}}
      />
      <p>Style: {entry.label}</p>
      <button onClick={() => setShown(!shown)}>
        {shown ? 'Hide sights' : 'Show sights'}
      </button>
    </>
  );
}
```

**Svelte**

```svelte [Svelte]
<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';
  import {navigation, styles} from '@map-jr/map-jr-gl/controls';

  const base = 'https://styles.map-jr.org/1/';
  const entries = [
    {label: 'Elevation', style: base + 'elevation-zero.json'},
    {label: 'Positron', style: base + 'openfreemap-positron.json'},
    {label: 'Dark', style: base + 'openfreemap-dark.json'},
  ];
  const sights = {
    type: 'FeatureCollection',
    features: [
      ['Chapel Bridge', 8.3077, 47.0516],
      ['Lion Monument', 8.3103, 47.0584],
      ['KKL Luzern', 8.3125, 47.0502],
      ['Swiss Museum of Transport', 8.3357, 47.0527],
    ].map(([name, lng, lat]) => ({
      type: 'Feature',
      properties: {name},
      geometry: {type: 'Point', coordinates: [lng, lat]},
    })),
  };
  const sightsLayer = {
    id: 'sights',
    type: 'circle',
    source: 'sights',
    paint: {
      'circle-radius': 7,
      'circle-color': '#d6453d',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
  };

  // A change is a new description, which passes `style` again. `onStyleChange`
  // keeps the chosen entry, so that the map keeps the chosen style.
  let entry = $state.raw(entries[0]);
  let shown = $state(true);
  const controls = [
    navigation(),
    styles({entries, onStyleChange: chosen => (entry = chosen)}),
  ];
  const description = $derived({
    style: entry.style,
    initialView: {center: [8.32, 47.054], zoom: 13.5},
    data: {sights},
    layers: shown ? [sightsLayer] : [],
    controls,
    attribution: {compact: true},
  });
</script>

<div use:mapJr={{description}} style="height: 500px"></div>
<p>Style: {entry.label}</p>
<button onclick={() => (shown = !shown)}
  >{shown ? 'Hide sights' : 'Show sights'}</button
>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8" />
<title>Switch between styles</title>
<!--
  A button of the map opens a list
  of three styles. Below the map,
  a line of text names the chosen
  style, and a button hides and
  shows four sights.
-->
<map-jr
  id="map"
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  center="8.32,47.054"
  zoom="13.5"
  attribution-compact
  style="height: 500px"
></map-jr>
<p id="readout">Style: Elevation</p>
<button id="toggle">Hide sights</button>
<script type="module">
  import '@map-jr/map-jr-gl/element';
  import {navigation, styles} from '@map-jr/map-jr-gl/controls';

  const base = 'https://styles.map-jr.org/1/';
  const entries = [
    {label: 'Elevation', style: base + 'elevation-zero.json'},
    {label: 'Positron', style: base + 'openfreemap-positron.json'},
    {label: 'Dark', style: base + 'openfreemap-dark.json'},
  ];
  const sights = {
    type: 'FeatureCollection',
    features: [
      ['Chapel Bridge', 8.3077, 47.0516],
      ['Lion Monument', 8.3103, 47.0584],
      ['KKL Luzern', 8.3125, 47.0502],
      ['Swiss Museum of Transport', 8.3357, 47.0527],
    ].map(([name, lng, lat]) => ({
      type: 'Feature',
      properties: {name},
      geometry: {type: 'Point', coordinates: [lng, lat]},
    })),
  };
  const sightsLayer = {
    id: 'sights',
    type: 'circle',
    source: 'sights',
    paint: {
      'circle-radius': 7,
      'circle-color': '#d6453d',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
  };

  const map = document.getElementById('map');
  const readout = document.getElementById('readout');
  const toggle = document.getElementById('toggle');
  let shown = true;
  map.data = {sights};
  map.layers = [sightsLayer];
  // Store the chosen style on the
  // element. Otherwise the next
  // change of a property passes
  // the attribute map-style
  // again, and the map shows the
  // first style again.
  map.controls = [
    navigation(),
    styles({
      entries,
      onStyleChange: entry => {
        map.mapStyle = entry.style;
        readout.textContent = `Style: ${entry.label}`;
      },
    }),
  ];
  toggle.addEventListener('click', () => {
    shown = !shown;
    toggle.textContent = shown ? 'Hide sights' : 'Show sights';
    map.layers = shown ? [sightsLayer] : [];
  });
</script>
```
<!-- example:styles:end -->

## How it works

- The control [`styles()`](../reference/controls.md#styles) of `@map-jr/map-jr-gl/controls` is a button that opens a
  list of the `entries`, with a picture of each style. A choice sets `style` with one
  [`patch`](../reference/map.md#patch), so the camera stays.
- The control calls `onStyleChange` with the chosen entry, and the example keeps that entry in its own state. Each
  new description sets `style` again: the button of the Map Jr example calls [`update`](../reference/map.md#update),
  and the Vue, React and Svelte components pass the style again when another prop changes. Without the kept entry,
  the next description sets the first style again.
- The `<map-jr>` example stores the chosen style in the property [`mapStyle`](../reference/element.md#mapjrelement),
  which overrides the attribute `map-style`.
- The sights are a GeoJSON source of [`data`](../reference/description.md#data) and a circle layer of
  [`layers`](../reference/description.md#layers). The map adds both to each style that the user chooses, above the
  layers of the style.

The compat entry `@map-jr/map-jr-gl/maplibre-compat` has no control for styles. The compat example adds a control of
its own with a `<select>`, which calls `setStyle` with the URL of the chosen style. `setStyle` replaces the whole
style, including the sources and layers that `addSource` and `addLayer` added, so the example adds the source and the
layer of the sights again at each `style.load`.

## Variations

Each variation changes the Map Jr example: `base` is the URL of the folder of the official styles, and `describe`
returns the description that `createMap` and `update` are called with.

### Offer a light and a dark form of each style

```js
const entries = [
  {label: 'Elevation', style: base + 'elevation-zero.json', colorSchemes: true},
  {
    label: 'Positron and Dark',
    style: {
      light: base + 'openfreemap-positron.json',
      dark: base + 'openfreemap-dark.json',
    },
  },
];
```

Each entry then shows a light and a dark picture. A choice of a picture also sets
[`colorScheme`](../reference/description.md#colorscheme-and-oncolorschemechange) and calls `onColorSchemeChange` of
the description. Keep that value as the example keeps the style: write `let scheme = 'auto';`, and in `describe` add
`colorScheme: scheme` and `onColorSchemeChange: value => { scheme = value; }`.

### Show one style with and without 3D terrain

```js
const elevation = base + 'elevation.json';
const entries = [
  {label: 'Elevation 3D', style: elevation},
  {label: 'Elevation flat', style: elevation, terrain: null},
  {label: 'Positron', style: base + 'openfreemap-positron.json'},
];
```

In `describe`, add `terrain: entry.terrain`. An entry with `terrain: null` overrides the terrain of the style and
shows a flat map. An entry without `terrain` shows the terrain of its style.

## See also

- [`styles()`](../reference/controls.md#styles) for the pictures, the `preview` option and entries that set
  `globalState`.
- [Let the user choose the style](../guide/controls.md#let-the-user-choose-the-style) in the guide to controls.
- [Use a light style and a dark style](../guide/color-scheme.md#use-a-light-style-and-a-dark-style).
