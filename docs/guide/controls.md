# Controls

This page shows how to add the buttons of the map (zoom, compass, scale, full screen and others), change their texts
and their look, and put a button of your own into a corner of the map.

## Add controls to the map

In the main API and the adapters, [`controls`](../reference/description.md#controls) is the list of the controls that
the map shows. Each function of `@map-jr/map-jr-gl/controls` creates one item of the list.

**Main API**

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, scale, fullscreen} from '@map-jr/map-jr-gl/controls';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13},
  controls: [
    navigation(),
    scale({position: 'bottom-left'}),
    fullscreen({position: 'top-left'}),
  ],
});
```

**MapLibre compat**

```js [MapLibre compat]
import {
  Map,
  NavigationControl,
  ScaleControl,
  FullscreenControl,
} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 13,
});

map.addControl(new NavigationControl());
map.addControl(new ScaleControl(), 'bottom-left');
map.addControl(new FullscreenControl(), 'top-left');
```

**Vue**

```vue [Vue]
<script setup>
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {navigation, scale, fullscreen} from '@map-jr/map-jr-gl/controls';

const controls = [
  navigation(),
  scale({position: 'bottom-left'}),
  fullscreen({position: 'top-left'}),
];
</script>

<template>
  <div style="height: 400px">
    <MapJr
      map-style="https://styles.map-jr.org/1/elevation-zero.json"
      :initial-view="{center: [-74.0065, 40.7085], zoom: 13}"
      :controls="controls"
    />
  </div>
</template>
```

**React**

```jsx [React]
import {MapJr} from '@map-jr/map-jr-gl/react';
import {navigation, scale, fullscreen} from '@map-jr/map-jr-gl/controls';

const controls = [
  navigation(),
  scale({position: 'bottom-left'}),
  fullscreen({position: 'top-left'}),
];

export function CityMap() {
  return (
    <div style={{height: 400}}>
      <MapJr
        mapStyle="https://styles.map-jr.org/1/elevation-zero.json"
        initialView={{center: [-74.0065, 40.7085], zoom: 13}}
        controls={controls}
      />
    </div>
  );
}
```

The map shows the zoom buttons and the compass in the top right corner, the scale bar in the bottom left corner and
the button for the full screen in the top left corner.

- `position` is `'top-right'` (the default), `'top-left'`, `'bottom-left'` or `'bottom-right'`. When the map is
  created, the first control of a corner in the list is nearest to the corner. A control that a later description
  adds goes after the controls that the corner has.
- In the main API, a control appears a moment after the map is created, because the map loads the code of the
  controls when it adds the first one. Importing the functions does not load that code.
- The attribution of the data is not in this list. The map shows it without a control: see
  [`attribution`](../reference/description.md#attribution) to change it or to turn it off.

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
| `custom({key, element})` | A control of your own: see [Add a control of your own](#add-a-control-of-your-own) | |

See [Controls](../api.md#controls) for what each option does.

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
[The texts of the controls](../api.md#the-texts-of-the-controls) for every key and its English text. The library
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

**Main API**

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, custom} from '@map-jr/map-jr-gl/controls';

const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
let current = 0;

const button = document.createElement('button');
button.textContent = 'Next style';
button.addEventListener('click', () => {
  current = (current + 1) % styles.length;
  map.patch({style: `https://styles.map-jr.org/1/${styles[current]}.json`});
});

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13},
  controls: [
    navigation(),
    custom({key: 'next-style', position: 'top-left', element: button}),
  ],
});
```

**MapLibre compat**

```js [MapLibre compat]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
let current = 0;

// A control of MapLibre GL JS: an object with onAdd, which returns the element,
// and onRemove.
class NextStyleControl {
  onAdd(map) {
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl';
    const button = document.createElement('button');
    button.textContent = 'Next style';
    button.addEventListener('click', () => {
      current = (current + 1) % styles.length;
      map.setStyle(`https://styles.map-jr.org/1/${styles[current]}.json`);
    });
    this.container.append(button);
    return this.container;
  }
  onRemove() {
    this.container.remove();
  }
}

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 13,
});
map.addControl(new NextStyleControl(), 'top-left');
```

**Vue**

```vue [Vue]
<script setup>
import {onMounted, ref, shallowRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {navigation, custom} from '@map-jr/map-jr-gl/controls';

const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
const current = ref(0);
const corner = shallowRef(null);
const controls = shallowRef([navigation()]);
// The element is created in the browser only, because `document` does not exist
// during server rendering.
// The map puts it into its corner, and <Teleport> renders the button into it.
onMounted(() => {
  corner.value = document.createElement('div');
  controls.value = [
    navigation(),
    custom({key: 'next-style', position: 'top-left', element: corner.value}),
  ];
});
</script>

<template>
  <div style="height: 400px">
    <MapJr
      :map-style="`https://styles.map-jr.org/1/${styles[current]}.json`"
      :initial-view="{center: [-74.0065, 40.7085], zoom: 13}"
      :controls="controls"
    />
  </div>
  <Teleport v-if="corner" :to="corner">
    <button @click="current = (current + 1) % styles.length">Next style</button>
  </Teleport>
</template>
```

**React**

```jsx [React]
import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {MapJr} from '@map-jr/map-jr-gl/react';
import {navigation, custom} from '@map-jr/map-jr-gl/controls';

const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];

export function StyleSwitcher() {
  const [current, setCurrent] = useState(0);
  const [corner, setCorner] = useState(null);
  // The element is created in the browser only, because `document` does not
  // exist during server rendering.
  // The map puts it into its corner, and the portal renders the button into it.
  useEffect(() => setCorner(document.createElement('div')), []);
  const [controls, setControls] = useState([navigation()]);
  useEffect(() => {
    if (corner)
      setControls([
        navigation(),
        custom({key: 'next-style', position: 'top-left', element: corner}),
      ]);
  }, [corner]);

  return (
    <>
      <div style={{height: 400}}>
        <MapJr
          mapStyle={`https://styles.map-jr.org/1/${styles[current]}.json`}
          initialView={{center: [-74.0065, 40.7085], zoom: 13}}
          controls={controls}
        />
      </div>
      {corner &&
        createPortal(
          <button onClick={() => setCurrent((current + 1) % styles.length)}>
            Next style
          </button>,
          corner,
        )}
    </>
  );
}
```

A button "Next style" shows in the top left corner, and each click shows the next style.

- The element of `custom` shows at once, before the code of the other controls has loaded.
- The map adds the class `map-jr-ctrl` to the element. Without it, the element receives no clicks. Add your own
  classes with `classList.add`: an assignment to `className` after the control is added removes `map-jr-ctrl`.
- The map keeps the element that it received first for a `key`. To show another element, pass it with a new `key`.

A control written for MapLibre GL JS also works in the main API. Pass its methods to `custom`:
`custom({key: 'ruler', onAdd: map => ruler.onAdd(map), onRemove: map => ruler.onRemove(map)})`. `onAdd` receives the
map on which the main API is built, and not the object that `createMap` returns. That map has methods such as `on`,
`off`, `getContainer`, `getCanvas`, `project`, `unproject`, `getZoom`, `getCenter` and `getBearing`, but not every
method of a map of MapLibre GL JS. A control that calls another method, such as `queryRenderedFeatures` or
`loadImage`, works only in the compat entry.

## See also

- [`controls`](../reference/description.md#controls), [`locale`](../reference/description.md#locale) and
  [`attribution`](../reference/description.md#attribution) in the reference of the description.
- [Controls](../api.md#controls) for every option of each control.
- [Light and dark maps](color-scheme.md) for the colours of the controls in a dark map.
