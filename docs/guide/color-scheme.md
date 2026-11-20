# Light and dark maps

This page shows how to draw the map in light or dark colours, follow the setting of the operating system, and let the
user switch.

## Follow the colour scheme of the system

Set [`colorScheme`](../reference/description.md#colorscheme-and-oncolorschemechange) to `'auto'`. The map then follows
the media query `prefers-color-scheme` of the browser, also when it changes while the page is open.

**Main API**

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl';
import {navigation} from '@map-jr/map-jr-gl/controls';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13},
  controls: [navigation()],
  colorScheme: 'auto',
});
```

**Vue**

```vue [Vue]
<script setup>
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {navigation} from '@map-jr/map-jr-gl/controls';

const controls = [navigation()];
</script>

<template>
  <div style="height: 400px">
    <MapJr
      map-style="https://styles.map-jr.org/1/elevation-zero.json"
      :initial-view="{center: [-74.0065, 40.7085], zoom: 13}"
      :controls="controls"
      color-scheme="auto"
    />
  </div>
</template>
```

**React**

```jsx [React]
import {MapJr} from '@map-jr/map-jr-gl/react';
import {navigation} from '@map-jr/map-jr-gl/controls';

const controls = [navigation()];

export function CityMap() {
  return (
    <div style={{height: 400}}>
      <MapJr
        mapStyle="https://styles.map-jr.org/1/elevation-zero.json"
        initialView={{center: [-74.0065, 40.7085], zoom: 13}}
        controls={controls}
        colorScheme="auto"
      />
    </div>
  );
}
```

On a system with a dark appearance, the map, the controls and the attribution are dark.

- `colorScheme` is `'light'` (the default), `'dark'` or `'auto'`. Without the field, the map is light also on a dark
  system, so write `colorScheme: 'auto'` to follow the system.
- The scheme sets the colours of the controls, the popups and the attribution. While the scheme is dark, the
  container of the map has the class `map-jr-dark`.
- The canvas follows the scheme only when the style reads it. Of the official styles at
  `https://styles.map-jr.org/1/`, `elevation-zero.json`, `elevation.json` and `elevation-radar.json` read it. The
  `openfreemap-*` styles do not. For another style, see
  [Write a style that follows the scheme](#write-a-style-that-follows-the-scheme) and
  [Use a light style and a dark style](#use-a-light-style-and-a-dark-style).
- The scheme that the map shows, `'light'` or `'dark'`, is `colorScheme` of [the state](../reference/state.md#mapstate), the store of the values that the map reports:
  `map.state.get().colorScheme`.

The compat entry has no `colorScheme`. See [In the compat entry](#in-the-compat-entry).

## Let the user switch the scheme

The control `colorScheme()` of `@map-jr/map-jr-gl/controls` is a button that switches the map between light and dark.
It shows a sun while the map is light and a moon while it is dark.

**Main API**

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, colorScheme} from '@map-jr/map-jr-gl/controls';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13},
  controls: [navigation(), colorScheme()],
  colorScheme: 'auto',
});
```

**Vue**

```vue [Vue]
<script setup>
import {ref} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {navigation, colorScheme} from '@map-jr/map-jr-gl/controls';

const controls = [navigation(), colorScheme()];
// v-model writes the value that the button sets back into `scheme`.
const scheme = ref('auto');
</script>

<template>
  <div style="height: 400px">
    <MapJr
      map-style="https://styles.map-jr.org/1/elevation-zero.json"
      :initial-view="{center: [-74.0065, 40.7085], zoom: 13}"
      :controls="controls"
      v-model:color-scheme="scheme"
    />
  </div>
</template>
```

**React**

```jsx [React]
import {useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';
import {navigation, colorScheme} from '@map-jr/map-jr-gl/controls';

const controls = [navigation(), colorScheme()];

export function CityMap() {
  const [scheme, setScheme] = useState('auto');
  return (
    <div style={{height: 400}}>
      <MapJr
        mapStyle="https://styles.map-jr.org/1/elevation-zero.json"
        initialView={{center: [-74.0065, 40.7085], zoom: 13}}
        controls={controls}
        colorScheme={scheme}
        onColorSchemeChange={setScheme}
      />
    </div>
  );
}
```

A click on the button changes `colorScheme` of the map and then calls
[`onColorSchemeChange`](../reference/description.md#colorscheme-and-oncolorschemechange) with the new value.

- Store the new value where the description comes from, as the Vue and React examples do. Otherwise the next
  description passes the old value, and the map changes back.
- With `'auto'`, the first click sets the opposite of the system, `'light'` or `'dark'`. The next click returns to the
  scheme of the system and sets `'auto'` again.
- With `'light'` or `'dark'`, each click sets the other value.
- To switch the scheme with a button of your own, pass the value: `map.patch({colorScheme: 'dark'})`.

The control is a prototype: its look and its behaviour can change in a later version.

## Write a style that follows the scheme

The map sets the global state property `color-scheme` of the style to `'light'` or `'dark'`. An expression of the
style reads it with `['global-state', 'color-scheme']`.

```js
import {createMap} from '@map-jr/map-jr-gl';

// The dark colour when the scheme is dark, and the light colour otherwise.
const scheme = (dark, light) => [
  'match',
  ['global-state', 'color-scheme'],
  'dark',
  dark,
  light,
];

const map = createMap('map', {
  style: {
    version: 8,
    // The default is the value for MapLibre GL JS and the compat entry, which
    // do not set the property.
    state: {'color-scheme': {default: 'light'}},
    sources: {
      parks: {
        type: 'geojson',
        data: {
          type: 'Polygon',
          coordinates: [
            [
              [-73.981, 40.768],
              [-73.958, 40.8],
              [-73.949, 40.797],
              [-73.973, 40.764],
              [-73.981, 40.768],
            ],
          ],
        },
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {'background-color': scheme('#1b1d21', '#f4f1ea')},
      },
      {
        id: 'parks',
        type: 'fill',
        source: 'parks',
        paint: {'fill-color': scheme('#2f5d3a', '#b9dca0')},
      },
    ],
  },
  initialView: {center: [-73.965, 40.782], zoom: 12},
  colorScheme: 'auto',
});
```

The background and Central Park are light on a light system and dark on a dark system.

- A change of the scheme requests neither the style nor the tiles. A paint property that reads `color-scheme` changes
  at the next frame.
- A layout property, a filter, and a parameter of an [image template](../api.md#an-image-that-is-a-template) (a value
  that `params` of the `image` expression sets) that read `color-scheme` are part of the tiles.
  The map builds the tiles of their sources again, from the data that it has.
- A style that already uses a state property `color-scheme` for something else receives the value of the map. Rename
  the property of the style.

### Keep the map dark while the controls follow the system

A value for `color-scheme` in [`globalState`](../reference/description.md#globalstate) overrides the scheme in the
style. The controls still follow `colorScheme`.

```js
import {createMap} from '@map-jr/map-jr-gl';
import {navigation} from '@map-jr/map-jr-gl/controls';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13},
  controls: [navigation()],
  colorScheme: 'auto',
  globalState: {'color-scheme': 'dark'},
});
```

When a later description leaves `color-scheme` out of `globalState`, the style follows the scheme again.

## Use a light style and a dark style

When a provider publishes a light style and a dark style, set `style` to the pair `{light, dark}`. Each value is the
URL of a style or a style object.

**Main API**

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: {
    light: 'https://styles.map-jr.org/1/openfreemap-positron.json',
    dark: 'https://styles.map-jr.org/1/openfreemap-dark.json',
  },
  initialView: {center: [-74.0065, 40.7085], zoom: 13},
  colorScheme: 'auto',
});
```

**Vue**

```vue [Vue]
<script setup>
import {MapJr} from '@map-jr/map-jr-gl/vue';

const styles = {
  light: 'https://styles.map-jr.org/1/openfreemap-positron.json',
  dark: 'https://styles.map-jr.org/1/openfreemap-dark.json',
};
</script>

<template>
  <div style="height: 400px">
    <MapJr
      :map-style="styles"
      :initial-view="{center: [-74.0065, 40.7085], zoom: 13}"
      color-scheme="auto"
    />
  </div>
</template>
```

**React**

```jsx [React]
import {MapJr} from '@map-jr/map-jr-gl/react';

const styles = {
  light: 'https://styles.map-jr.org/1/openfreemap-positron.json',
  dark: 'https://styles.map-jr.org/1/openfreemap-dark.json',
};

export function CityMap() {
  return (
    <div style={{height: 400}}>
      <MapJr
        mapStyle={styles}
        initialView={{center: [-74.0065, 40.7085], zoom: 13}}
        colorScheme="auto"
      />
    </div>
  );
}
```

The map draws the style of the scheme that it shows.

- A change of the scheme loads the other style: the map requests it and draws the map from the start. The view, and
  the `sources`, `layers`, `data` and `images` of the description, stay.
- A style that reads `color-scheme` changes its colours without a request. Prefer it when you can write or edit the
  style.
- A pair with only one of the two values uses that style for both schemes, and the
  development build warns once. The development build is the build of the `development` export condition, which
  bundlers such as Vite use in their development server.

## In the compat entry

The compat entry (`@map-jr/map-jr-gl/maplibre-compat`) has no `colorScheme`, and its controls keep the light look of
MapLibre GL JS. A style that reads `color-scheme` follows the scheme when the page sets the property.

```js
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 13,
});

const dark = window.matchMedia('(prefers-color-scheme: dark)');
const applyScheme = () =>
  map.setGlobalStateProperty('color-scheme', dark.matches ? 'dark' : 'light');
map.on('load', applyScheme);
dark.addEventListener('change', applyScheme);
```

For two styles, call `map.setStyle` with the other style when the media query changes.

## See also

- [`colorScheme` and `onColorSchemeChange`](../reference/description.md#colorscheme-and-oncolorschemechange),
  [`style`](../reference/description.md#style) and [`globalState`](../reference/description.md#globalstate) in the
  reference of the description.
- [Change the look of the controls](controls.md#change-the-look-of-the-controls) for the colours of the controls in
  each scheme.
- [Server rendering](../server-rendering.md) for the scheme of an image that a server renders.
