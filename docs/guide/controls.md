# Controls

This page shows how to add the buttons of the map (zoom, compass, scale, full screen and others), change their texts
and their look, and put a button of your own into a corner of the map.

## Add controls to the map

In the main API and the adapters, [`controls`](../reference/description.md#controls) is the list of the controls that
the map shows. Each function of `@map-jr/map-jr-gl/controls` creates one item of the list.

<!-- example:basic:start -->
**Main API**

```js [Main API]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. A line of text below the map says which thread draws it.
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, scale, fullscreen} from '@map-jr/map-jr-gl/controls';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const container = document.getElementById('map');
const readout = document.createElement('p');
container.after(readout);
const show = text => {
  readout.textContent = text;
};

const map = createMap(container, {
  style,
  initialView: {center: NYC, zoom: 13.6},
  controls: [
    navigation(),
    scale({position: 'bottom-left'}),
    fullscreen({position: 'top-left'}),
  ],
  attribution: {compact: true},
});

// The thread that draws is known when the map has started.
map.state.subscribe(
  state => state.renderer,
  renderer => show(`${renderer} rendering`),
);
map.listen('stats', e => {
  const fps = e.fps.toFixed(0);
  show(`${map.state.get().renderer} rendering, ${fps} frames per second`);
});
show('Starting');
```

**MapLibre compat**

```js [MapLibre compat]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. A line of text below the map says which thread draws it.
import {
  Map,
  NavigationControl,
  ScaleControl,
  FullscreenControl,
} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const map = new Map({
  container: 'map',
  style,
  center: NYC,
  zoom: 13.6,
  attributionControl: {compact: true},
});
const readout = document.createElement('p');
map.getContainer().after(readout);

map.addControl(new NavigationControl());
map.addControl(new ScaleControl(), 'bottom-left');
map.addControl(new FullscreenControl(), 'top-left');

map.once('load', () => {
  readout.textContent = `${map.renderer} rendering`;
});
readout.textContent = 'Starting';
```

**Vue**

```vue [Vue]
<script setup>
// The map fills its parent element, so give the parent a height.
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {navigation, scale, fullscreen} from '@map-jr/map-jr-gl/controls';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];
</script>

<template>
  <MapJr
    :map-style="style"
    :initial-view="{center: NYC, zoom: 13.6}"
    :controls="[
      navigation(),
      scale({position: 'bottom-left'}),
      fullscreen({position: 'top-left'}),
    ]"
    :attribution="{compact: true}"
    v-slot="{state}"
  >
    <p class="note">
      {{ state?.renderer ? `${state.renderer} rendering` : 'Starting' }}
    </p>
  </MapJr>
</template>
```

**Nuxt**

```vue [Nuxt]
<script setup>
// A page of a Nuxt app whose nuxt.config.ts has modules:
// ['@map-jr/map-jr-gl/nuxt']. The map fills its parent element, so give the
// parent a height.

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];
</script>

<template>
  <MapJr
    :map-style="style"
    :initial-view="{center: NYC, zoom: 13.6}"
    :controls="[
      navigationControl(),
      scaleControl({position: 'bottom-left'}),
      fullscreenControl({position: 'top-left'}),
    ]"
    :attribution="{compact: true}"
    v-slot="{state}"
  >
    <p class="note">
      {{ state?.renderer ? `${state.renderer} rendering` : 'Starting' }}
    </p>
  </MapJr>
</template>
```

**React**

```jsx [React]
// The map fills its parent element, so give the parent a height.
import {MapJr, useMapState} from '@map-jr/map-jr-gl/react';
import {navigation, scale, fullscreen} from '@map-jr/map-jr-gl/controls';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

function Renderer() {
  const renderer = useMapState(state => state.renderer);
  return (
    <p className="note">{renderer ? `${renderer} rendering` : 'Starting'}</p>
  );
}

export default function Basic() {
  return (
    <MapJr
      mapStyle={style}
      initialView={{center: NYC, zoom: 13.6}}
      controls={[
        navigation(),
        scale({position: 'bottom-left'}),
        fullscreen({position: 'top-left'}),
      ]}
      attribution={{compact: true}}
    >
      <Renderer />
    </MapJr>
  );
}
```

**Svelte**

```svelte [Svelte]
<script>
  import {mapJr, mapState} from '@map-jr/map-jr-gl/svelte';
  import {navigation, scale, fullscreen} from '@map-jr/map-jr-gl/controls';

  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
    controls: [
      navigation(),
      scale({position: 'bottom-left'}),
      fullscreen({position: 'top-left'}),
    ],
    attribution: {compact: true},
  };
  let map = $state(null);
  // The state of the map as a store, once the map exists.
  const live = $derived(map && mapState(map));
</script>

<div
  use:mapJr={{description, ready: instance => (map = instance)}}
  style="height: 500px"
></div>
<p>{$live?.renderer ? `${$live.renderer} rendering` : 'Starting'}</p>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8" />
<title>A MapLibre style, drawn off the main thread</title>
<!--
  A line of text below the map
  says which thread draws it.
-->
<map-jr
  id="map"
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  center="-74.0065,40.7085"
  zoom="13.6"
  style="height: 500px"
></map-jr>
<p id="readout">Starting</p>
<script type="module">
  import '@map-jr/map-jr-gl/element';
  import {navigation, scale, fullscreen} from '@map-jr/map-jr-gl/controls';

  const map = document.getElementById('map');
  const readout = document.getElementById('readout');
  // Objects are properties of the
  // element. Set before the map
  // starts, they are part of the
  // first description.
  map.controls = [
    navigation(),
    scale({position: 'bottom-left'}),
    fullscreen({position: 'top-left'}),
  ];
  map.attribution = {compact: true};

  // The thread that draws is
  // known when the map has
  // started.
  map.addEventListener('map-ready', () => {
    map.state.subscribe(
      state => state.renderer,
      renderer => {
        readout.textContent = `${renderer} rendering`;
      },
    );
  });
  map.addEventListener('map-stats', event => {
    readout.textContent = `${map.state.get().renderer} rendering, ${event.detail.fps.toFixed(0)} frames per second`;
  });
</script>
```
<!-- example:basic:end -->

The map shows the zoom buttons and the compass in the top right corner, the scale bar in the bottom left corner and
the button for the full screen in the top left corner. A line of text below the map names the thread that renders the
map and the frames per second.

- `position` is `'top-right'` (the default), `'top-left'`, `'bottom-left'` or `'bottom-right'`. When the map is
  created, the first control of a corner in the list is nearest to the corner. A control that a later description
  adds goes after the controls that the corner has.
- In the main API, a control appears a moment after the map is created, because the map loads the code of the
  controls when it adds the first one. Importing the functions does not load that code.
- The attribution of the data is not in this list. The map shows it without a control: see
  [`attribution`](../reference/description.md#attribution) to change it or to turn it off. The example makes it compact.
- In the compat entry, each control is a class of MapLibre GL JS that `addControl` adds.
- The map renders in a worker when the browser can render there, and on the main thread otherwise.
  [`renderer`](../reference/state.md#mapstate) of the state is `'worker'` or `'main'` once the map has loaded, and
  `undefined` before. In the compat entry, `map.renderer` names the thread. The
  [`stats`](../reference/events.md#mapevents) event reports the frames per second about once a second while the map
  renders. To choose the thread, set [`renderer`](../reference/description.md#renderer) of the description to `'auto'` (the
  default), `'worker'` or `'main'`. `'worker'` renders as `'auto'` does, and warns once when the map renders on the
  main thread instead.

These functions are available. Each one also accepts `position`.

| Function | Control | Options and their defaults |
|---|---|---|
| `navigation()` | Buttons to zoom in and out, and a compass that turns the map to the north | `showZoom: true`, `showCompass: true`, `visualizePitch: false` |
| `scale()` | A scale bar | `maxWidth: 100` (CSS pixels), `unit: 'metric'` (or `'imperial'`, `'nautical'`) |
| `fullscreen()` | A button that shows the map on the full screen | |
| `geolocate()` | A button that moves the map to the position of the user | `zoom: 14`, `positionOptions`, `trackUserLocation: false`, `showUserLocation: true` |
| `terrain({source})` | A button that turns 3D terrain on and off | `source` (required): the id of an elevation source of the style; `exaggeration` |
| `globe()` | A button that switches the projection between the globe and Mercator | |
| `colorScheme()` | A button that switches the map between light and dark: see [Light and dark maps](color-scheme.md#let-the-user-switch-the-scheme) | |
| `styles({entries})` | A button that opens a list of styles with a picture of each, and sets the chosen style: see [`styles()`](../reference/controls.md#styles) | `entries` (required): `{label, style, colorSchemes}` for each style, with `terrain` and `globalState` where an entry sets them; `preview`, `onStyleChange` |
| `custom({key, element})` | A control of your own: see [Add a control of your own](#add-a-control-of-your-own) | |

See [Controls](controls.md) for what each option does.

## Change or remove a control

Pass a new list of controls in the description. In the main API, [`map.patch`](../reference/map.md#patch) replaces the
fields that it is passed and keeps the other fields of the description, and `map.update` takes the complete
description.

```js
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, scale} from '@map-jr/map-jr-gl/controls';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13},
  controls: [navigation(), scale()],
});

function useMiles() {
  map.patch({controls: [navigation(), scale({unit: 'imperial'})]});
}

function hideControls() {
  map.patch({controls: []});
}
```

The map keeps a control that the new list has with the same options. It removes a control that the list no longer
has, and it replaces a control whose options changed. In `useMiles`, the zoom buttons stay, and the scale bar is
removed and added again with miles.

In the compat entry, call `map.removeControl(control)` with the object that `addControl` was passed.

## Let the user choose the style

The control [`styles()`](../reference/controls.md#styles) of `@map-jr/map-jr-gl/controls` is a button that opens a
list of styles with a picture of each. A choice sets `style` and keeps the camera. In a component, keep the style in
your own state with `onStyleChange`, because the component passes its `style` again at the next change. This example
uses the component `MapJr` of `@map-jr/map-jr-gl/vue`:

```vue
<script setup>
import {ref} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {navigation, styles} from '@map-jr/map-jr-gl/controls';

const entries = [
  {
    label: 'Elevation',
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
  },
  {
    label: 'Positron',
    style: 'https://styles.map-jr.org/1/openfreemap-positron.json',
  },
  {label: 'Dark', style: 'https://styles.map-jr.org/1/openfreemap-dark.json'},
];
const mapStyle = ref(entries[0].style);
const controls = [
  navigation(),
  styles({
    entries,
    onStyleChange: entry => {
      mapStyle.value = entry.style;
    },
  }),
];
</script>

<template>
  <div style="height: 400px">
    <MapJr
      :map-style="mapStyle"
      :initial-view="{center: [8.33, 47.03], zoom: 11}"
      :controls="controls"
    />
  </div>
</template>
```

The pictures are drawn by a small second map after the map is first idle, so they do not delay the map. A click on
the button before that opens the list with its labels, and the pictures appear as they are ready.

An entry with `colorSchemes: true` (for a style that reads the global state `color-scheme`, as the official styles
do) or with `style: {light, dark}` shows a light and a dark picture. A choice of one sets the style and `colorScheme`,
so a list of such entries replaces the control `colorScheme()`. See
[An entry with a light and a dark form](../reference/controls.md#an-entry-with-a-light-and-a-dark-form).

## Translate the texts of the controls

[`locale`](../reference/description.md#locale) sets the texts of the buttons, by the keys of the option `locale` of
MapLibre GL JS. A key that is not set keeps the English text.

**Main API**

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, fullscreen} from '@map-jr/map-jr-gl/controls';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [2.3522, 48.8566], zoom: 12},
  controls: [navigation(), fullscreen()],
  locale: {
    'NavigationControl.ZoomIn': 'Zoom avant',
    'NavigationControl.ZoomOut': 'Zoom arrière',
    'NavigationControl.ResetBearing': 'Orienter vers le nord',
    'FullscreenControl.Enter': 'Plein écran',
    'FullscreenControl.Exit': 'Quitter le plein écran',
  },
});
```

**MapLibre compat**

```js [MapLibre compat]
import {
  Map,
  NavigationControl,
  FullscreenControl,
} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [2.3522, 48.8566],
  zoom: 12,
  locale: {
    'NavigationControl.ZoomIn': 'Zoom avant',
    'NavigationControl.ZoomOut': 'Zoom arrière',
    'NavigationControl.ResetBearing': 'Orienter vers le nord',
    'FullscreenControl.Enter': 'Plein écran',
    'FullscreenControl.Exit': 'Quitter le plein écran',
  },
});

map.addControl(new NavigationControl());
map.addControl(new FullscreenControl());
```

The texts are the labels that a screen reader reads and the titles that the browser shows over a button. See
[The texts of the controls](../reference/controls.md#the-texts-of-the-controls) for every key and its English text. The library
includes no translations, and `locale` does not change the language of the labels of the map.

## Change the look of the controls

Set these CSS custom properties on the container of the map or on an element above it. They also apply to the
attribution, the scale bar and the popup.

```css
#map {
  --map-control-size: 40px;
  --map-control-color: #1d3557;
  --map-control-background: #f1faee;
}
```

| Custom property | What it sets | Default |
|---|---|---|
| `--map-control-size` | The width and the height of a button | `32px`, and `44px` on a touch screen |
| `--map-control-color` | The colour of the icons and the text | `#222`, dark `#e6e6e6`. The text of the attribution and the scale bar: `rgb(0 0 0 / .62)`, dark `rgb(255 255 255 / .66)` |
| `--map-control-background` | The background of a group of buttons | white, dark `rgb(30 30 34)`, both translucent |
| `--map-control-opacity` | The opacity of that background, from 0 to 1 (main API only) | `.55`, dark `.45` |
| `--map-control-radius` | The radius of the corners of a group of buttons | half of `--map-control-size` |
| `--map-control-focus` | The colour of the outline of the button that has the keyboard focus | `#2f7fd1` |
| `--map-attribution-background` | The background of the attribution and the scale bar | as the controls |
| `--map-popup-background` | The background of a popup | white at `.65`, dark `rgb(43 43 43)` at `.55` |
| `--map-popup-color` | The text of a popup | `#222`, dark `#e6e6e6` |

The defaults in the table are those of the main API. The dark values apply while the
[colour scheme](color-scheme.md) of the map is dark. A rule of your page for these elements overrides the rules of the
library.

The controls of the main API are translucent and blur the map behind them. A browser without `backdrop-filter` shows
opaque controls with corners of 6 pixels. The compat entry reads the same custom properties except
`--map-control-opacity`. Its defaults are those of the controls of MapLibre GL JS: opaque white controls with corners
of 6 pixels.

## Add a control of your own

`custom` puts an element of your page into a corner of the map. `key` names the control, and the map keeps the
control while the list has a control with that `key`.

<!-- example:control:start -->
**Main API**

```js [Main API]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. A button of your own in the top left corner of the map shows
// the next style, and a line of text below the map names the style.
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, custom} from '@map-jr/map-jr-gl/controls';

const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
const styleUrl = name => `https://styles.map-jr.org/1/${name}.json`;
let current = 0;

const container = document.getElementById('map');
const readout = document.createElement('p');
container.after(readout);
readout.textContent = `Style: ${styles[current]}`;

// The element of the control. The map places it in its corner and gives it the
// class map-jr-ctrl, which lets it take clicks. Its look is yours.
const button = document.createElement('button');
button.textContent = 'Next style';
button.style.cssText =
  'padding:6px 12px;border:0;border-radius:16px;background:#fff;color:#222;font:13px system-ui,sans-serif;box-shadow:0 1px 4px #0004;cursor:pointer';
button.addEventListener('click', () => {
  current = (current + 1) % styles.length;
  map.patch({style: styleUrl(styles[current])});
  readout.textContent = `Style: ${styles[current]}`;
});

const map = createMap(container, {
  style: styleUrl(styles[current]),
  initialView: {center: [-74.0065, 40.7085], zoom: 13},
  attribution: {compact: true},
  // `key` names the control: the map keeps it while the list has a control with
  // this key.
  controls: [
    navigation(),
    custom({key: 'next-style', position: 'top-left', element: button}),
  ],
});
```

**MapLibre compat**

```js [MapLibre compat]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. A button of your own in the top left corner of the map shows
// the next style, and a line of text below the map names the style.
import {Map, NavigationControl} from '@map-jr/map-jr-gl/maplibre-compat';

const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
const styleUrl = name => `https://styles.map-jr.org/1/${name}.json`;
let current = 0;

// A control of MapLibre GL JS: an object with onAdd, which returns the element
// of the control, and onRemove.
class NextStyleControl {
  onAdd(map) {
    this.container = document.createElement('div');
    // The class maplibregl-ctrl lets the element take clicks. Its look is
    // yours.
    this.container.className = 'maplibregl-ctrl';
    const button = this.container.appendChild(document.createElement('button'));
    button.textContent = 'Next style';
    button.style.cssText =
      'padding:6px 12px;border:0;border-radius:16px;background:#fff;color:#222;font:13px system-ui,sans-serif;box-shadow:0 1px 4px #0004;cursor:pointer';
    button.addEventListener('click', () => {
      current = (current + 1) % styles.length;
      map.setStyle(styleUrl(styles[current]));
      readout.textContent = `Style: ${styles[current]}`;
    });
    return this.container;
  }
  onRemove() {
    this.container.remove();
  }
}

const map = new Map({
  container: 'map',
  style: styleUrl(styles[current]),
  center: [-74.0065, 40.7085],
  zoom: 13,
  attributionControl: {compact: true},
});
map.addControl(new NavigationControl());
map.addControl(new NextStyleControl(), 'top-left');
const readout = document.createElement('p');
map.getContainer().after(readout);
readout.textContent = `Style: ${styles[current]}`;
```

**Vue**

```vue [Vue]
<script setup>
// The map fills its parent element, so give the parent a height.
import {onMounted, ref, shallowRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {navigation, custom} from '@map-jr/map-jr-gl/controls';

const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
const current = ref(0);
// The element of the control, made in the browser only, because `document` does
// not exist during server rendering. The map places it in its corner, and
// <Teleport> renders the button into it.
const corner = shallowRef(null);
const controls = shallowRef([navigation()]);
onMounted(() => {
  corner.value = document.createElement('div');
  // `key` names the control: the map keeps it while the list has a control with
  // this key.
  controls.value = [
    navigation(),
    custom({key: 'next-style', position: 'top-left', element: corner.value}),
  ];
});
</script>

<template>
  <MapJr
    :map-style="`https://styles.map-jr.org/1/${styles[current]}.json`"
    :initial-view="{center: [-74.0065, 40.7085], zoom: 13}"
    :controls="controls"
    :attribution="{compact: true}"
  />
  <p>Style: {{ styles[current] }}</p>
  <Teleport v-if="corner" :to="corner">
    <button
      style="
        padding: 6px 12px;
        border: 0;
        border-radius: 16px;
        background: #fff;
        color: #222;
        font:
          13px system-ui,
          sans-serif;
        box-shadow: 0 1px 4px #0004;
        cursor: pointer;
      "
      @click="current = (current + 1) % styles.length"
    >
      Next style
    </button>
  </Teleport>
</template>
```

**Nuxt**

```vue [Nuxt]
<script setup>
// A page of a Nuxt app whose nuxt.config.ts has modules:
// ['@map-jr/map-jr-gl/nuxt']. The map fills its parent element, so give the
// parent a height.

const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
const current = ref(0);
// The element of the control, made in the browser only, because `document` does
// not exist during server rendering. The map places it in its corner, and
// <Teleport> renders the button into it.
const corner = shallowRef(null);
const controls = shallowRef([navigationControl()]);
onMounted(() => {
  corner.value = document.createElement('div');
  // `key` names the control: the map keeps it while the list has a control with
  // this key.
  controls.value = [
    navigationControl(),
    customControl({
      key: 'next-style',
      position: 'top-left',
      element: corner.value,
    }),
  ];
});
</script>

<template>
  <MapJr
    :map-style="`https://styles.map-jr.org/1/${styles[current]}.json`"
    :initial-view="{center: [-74.0065, 40.7085], zoom: 13}"
    :controls="controls"
    :attribution="{compact: true}"
  />
  <p>Style: {{ styles[current] }}</p>
  <Teleport v-if="corner" :to="corner">
    <button
      style="
        padding: 6px 12px;
        border: 0;
        border-radius: 16px;
        background: #fff;
        color: #222;
        font:
          13px system-ui,
          sans-serif;
        box-shadow: 0 1px 4px #0004;
        cursor: pointer;
      "
      @click="current = (current + 1) % styles.length"
    >
      Next style
    </button>
  </Teleport>
</template>
```

**React**

```jsx [React]
// The map fills its parent element, so give the parent a height.
import {useEffect, useMemo, useState} from 'react';
import {createPortal} from 'react-dom';
import {MapJr} from '@map-jr/map-jr-gl/react';
import {navigation, custom} from '@map-jr/map-jr-gl/controls';

const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
const button = {
  padding: '6px 12px',
  border: 0,
  borderRadius: '16px',
  background: '#fff',
  color: '#222',
  font: '13px system-ui,sans-serif',
  boxShadow: '0 1px 4px #0004',
  cursor: 'pointer',
};

export default function Control() {
  const [current, setCurrent] = useState(0);
  // The element of the control, made in the browser only, because `document`
  // does not exist during server rendering. The map places it in its corner,
  // and the portal renders the button into it.
  const [corner, setCorner] = useState(null);
  useEffect(() => setCorner(document.createElement('div')), []);
  // `key` names the control: the map keeps it while the list has a control with
  // this key.
  const controls = useMemo(
    () =>
      corner
        ? [
            navigation(),
            custom({key: 'next-style', position: 'top-left', element: corner}),
          ]
        : [navigation()],
    [corner],
  );

  return (
    <>
      <MapJr
        mapStyle={`https://styles.map-jr.org/1/${styles[current]}.json`}
        initialView={{center: [-74.0065, 40.7085], zoom: 13}}
        controls={controls}
        attribution={{compact: true}}
      />
      <p>Style: {styles[current]}</p>
      {corner &&
        createPortal(
          <button
            style={button}
            onClick={() => setCurrent((current + 1) % styles.length)}
          >
            Next style
          </button>,
          corner,
        )}
    </>
  );
}
```

**Svelte**

```svelte [Svelte]
<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';
  import {navigation, custom} from '@map-jr/map-jr-gl/controls';

  const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
  let current = $state(0);
  // The element of the control. The map moves it into its corner once the
  // element exists. (The <div> around it stays where it is, so that Svelte
  // finds its own elements when it removes the component.)
  let button = $state(null);
  // A change is a new description. The map finds what is different.
  const description = $derived({
    style: `https://styles.map-jr.org/1/${styles[current]}.json`,
    initialView: {center: [-74.0065, 40.7085], zoom: 13},
    attribution: {compact: true},
    // `key` names the control: the map keeps it while the list has a control
    // with this key.
    controls: button
      ? [
          navigation(),
          custom({key: 'next-style', position: 'top-left', element: button}),
        ]
      : [navigation()],
  });
</script>

<div use:mapJr={{description}} style="height: 500px"></div>
<p>Style: {styles[current]}</p>
<div hidden>
  <button
    bind:this={button}
    class="next"
    onclick={() => (current = (current + 1) % styles.length)}>Next style</button
  >
</div>

<style>
  .next {
    padding: 6px 12px;
    border: 0;
    border-radius: 16px;
    background: #fff;
    color: #222;
    font:
      13px system-ui,
      sans-serif;
    box-shadow: 0 1px 4px #0004;
    cursor: pointer;
  }
</style>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8" />
<title>A control of your own</title>
<!--
  A button of your own in the top
  left corner of the map shows the
  next style, and a line of text
  below the map names the style.
-->
<map-jr
  id="map"
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  center="-74.0065,40.7085"
  zoom="13"
  attribution-compact
  style="height: 500px"
></map-jr>
<p id="readout">Style: elevation-zero</p>
<script type="module">
  import '@map-jr/map-jr-gl/element';
  import {navigation, custom} from '@map-jr/map-jr-gl/controls';

  const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
  let current = 0;
  const map = document.getElementById('map');
  const readout = document.getElementById('readout');

  // The element of the control.
  // The map places it in its
  // corner and gives it the class
  // map-jr-ctrl, which lets it
  // take clicks. Its look is
  // yours.
  const button = document.createElement('button');
  button.textContent = 'Next style';
  button.style.cssText =
    'padding:6px 12px;border:0;border-radius:16px;background:#fff;color:#222;font:13px system-ui,sans-serif;box-shadow:0 1px 4px #0004;cursor:pointer';
  button.addEventListener('click', () => {
    current = (current + 1) % styles.length;
    map.setAttribute(
      'map-style',
      `https://styles.map-jr.org/1/${styles[current]}.json`,
    );
    readout.textContent = `Style: ${styles[current]}`;
  });
  // `key` names the control: the
  // map keeps it while the list
  // has a control with this key.
  map.controls = [
    navigation(),
    custom({key: 'next-style', position: 'top-left', element: button}),
  ];
</script>
```
<!-- example:control:end -->

A button "Next style" shows in the top left corner, and each click shows the next style. A line of text below the map
names the style.

- The element of `custom` shows at once, before the code of the other controls has loaded.
- The map adds the class `map-jr-ctrl` to the element. Without it, the element receives no clicks. Add your own
  classes with `classList.add`: an assignment to `className` after the control is added removes `map-jr-ctrl`.
- The map keeps the element that it received first for a `key`. To show another element, pass it with a new `key`.
- In Vue and React, the element is a `<div>` that the component creates once in the browser, because `document` does
  not exist during server rendering. `<Teleport>` or `createPortal` renders the button into it, so the button is part
  of the component. In Svelte, `bind:this` gives the button itself to `custom`.
- In the compat entry, a control is an object with `onAdd(map)` and `onRemove(map)`, which `addControl` adds, as in
  MapLibre GL JS.

A control written for MapLibre GL JS also works in the main API. Pass its methods to `custom`:
`custom({key: 'ruler', onAdd: map => ruler.onAdd(map), onRemove: map => ruler.onRemove(map)})`. `onAdd` receives the
map on which the main API is built, and not the object that `createMap` returns. That map has methods such as `on`,
`off`, `getContainer`, `getCanvas`, `project`, `unproject`, `getZoom`, `getCenter` and `getBearing`, but not every
method of a map of MapLibre GL JS. A control that calls another method, such as `queryRenderedFeatures` or
`loadImage`, works only in the compat entry.

## See also

- [`controls`](../reference/description.md#controls), [`locale`](../reference/description.md#locale) and
  [`attribution`](../reference/description.md#attribution) in the reference of the description.
- [Controls](controls.md) for every option of each control.
- [Light and dark maps](color-scheme.md) for the colours of the controls in a dark map.
