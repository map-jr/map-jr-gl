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
  controls: [navigation(), scale({position: 'bottom-left'}), fullscreen({position: 'top-left'})],
});
```

**MapLibre compat**

```js [MapLibre compat]
import {Map, NavigationControl, ScaleControl, FullscreenControl} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({container: 'map', style: 'https://styles.map-jr.org/1/elevation-zero.json', center: [-74.0065, 40.7085], zoom: 13});

map.addControl(new NavigationControl());
map.addControl(new ScaleControl(), 'bottom-left');
map.addControl(new FullscreenControl(), 'top-left');
```

**Vue**

```vue [Vue]
<script setup>
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {navigation, scale, fullscreen} from '@map-jr/map-jr-gl/controls';

const controls = [navigation(), scale({position: 'bottom-left'}), fullscreen({position: 'top-left'})];
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

const controls = [navigation(), scale({position: 'bottom-left'}), fullscreen({position: 'top-left'})];

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

- `position` is `'top-right'` (the default), `'top-left'`, `'bottom-left'` or `'bottom-right'`. Of the controls in
  one corner, the first of the list is nearest to the corner.
- In the main API, a control appears a moment after the map is created, because the map loads the code of the
  controls when it adds the first one. Importing the functions does not load that code.
- The attribution of the data is not in this list. The map shows it without a control: see
  [`attribution`](../reference/description.md#attribution) to change it or to turn it off.

These functions are available. See [Controls](../api.md#controls) for the options of each one.

| Function | Control |
|---|---|
| `navigation()` | Buttons to zoom in and out, and a compass. A click on the compass turns the map to the north. |
| `scale()` | A scale bar, in metric units by default. |
| `fullscreen()` | A button that shows the map on the full screen. |
| `geolocate()` | A button that moves the map to the position of the user. |
| `terrain({source})` | A button that turns 3D terrain on and off. `source` is the id of an elevation source of the style. |
| `globe()` | A button that switches the projection between the globe and Mercator. |
| `colorScheme()` | A button that switches the map between light and dark: see [Light and dark maps](color-scheme.md#let-the-user-switch-the-scheme). |
| `custom({key, element})` | A control of your own: see [Add a control of your own](#add-a-control-of-your-own). |

## Change or remove a control

Pass a new list of controls in the description. In the main API, [`map.patch`](../api.md#change-the-map) replaces the
fields that it is passed and keeps the other fields of the description.

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
import {Map, NavigationControl, FullscreenControl} from '@map-jr/map-jr-gl/maplibre-compat';

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
| `--map-control-color` | The colour of the icons and the text | `#222`, dark `#e6e6e6` |
| `--map-control-background` | The background of a group of buttons | white, dark `rgb(30 30 34)`, both translucent |
| `--map-control-opacity` | The opacity of that background, from 0 to 1 (main API only) | `.55`, dark `.45` |
| `--map-control-radius` | The radius of the corners of a group of buttons | half of `--map-control-size` |
| `--map-control-focus` | The colour of the outline of the button that has the keyboard focus | `#2f7fd1` |
| `--map-attribution-background` | The background of the attribution and the scale bar | as the controls |
| `--map-popup-background` | The background of a popup | white, dark `rgb(30 30 34)`, both translucent |
| `--map-popup-color` | The text of a popup | `#222`, dark `#e6e6e6` |

The defaults in the table are those of the main API. The dark values apply while the [colour scheme](color-scheme.md) of the map is dark. A rule of your page overrides
the rules of the library, because those have no specificity.

The controls of the main API are translucent and blur the map behind them. They need Safari 18, Chrome 120 or
Firefox 121. An older browser shows opaque controls with corners of 6 pixels. The controls of the compat entry have
the look of the controls of MapLibre GL JS.

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
  controls: [navigation(), custom({key: 'next-style', position: 'top-left', element: button})],
});
```

**MapLibre compat**

```js [MapLibre compat]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
let current = 0;

// A control of MapLibre GL JS: an object with onAdd, which returns the element, and onRemove.
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

const map = new Map({container: 'map', style: 'https://styles.map-jr.org/1/elevation-zero.json', center: [-74.0065, 40.7085], zoom: 13});
map.addControl(new NextStyleControl(), 'top-left');
```

**Vue**

```vue [Vue]
<script setup>
import {ref} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {navigation, custom} from '@map-jr/map-jr-gl/controls';

const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
const current = ref(0);
// The map puts this element into its corner, and <Teleport> renders the button into it.
const corner = document.createElement('div');
const controls = [navigation(), custom({key: 'next-style', position: 'top-left', element: corner})];
</script>

<template>
  <div style="height: 400px">
    <MapJr
      :map-style="`https://styles.map-jr.org/1/${styles[current]}.json`"
      :initial-view="{center: [-74.0065, 40.7085], zoom: 13}"
      :controls="controls"
    />
  </div>
  <Teleport :to="corner">
    <button @click="current = (current + 1) % styles.length">Next style</button>
  </Teleport>
</template>
```

**React**

```jsx [React]
import {useMemo, useState} from 'react';
import {createPortal} from 'react-dom';
import {MapJr} from '@map-jr/map-jr-gl/react';
import {navigation, custom} from '@map-jr/map-jr-gl/controls';

const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];

export function StyleSwitcher() {
  const [current, setCurrent] = useState(0);
  // The map puts this element into its corner, and the portal renders the button into it.
  const corner = useMemo(() => document.createElement('div'), []);
  const controls = useMemo(() => [navigation(), custom({key: 'next-style', position: 'top-left', element: corner})], [corner]);

  return (
    <>
      <div style={{height: 400}}>
        <MapJr
          mapStyle={`https://styles.map-jr.org/1/${styles[current]}.json`}
          initialView={{center: [-74.0065, 40.7085], zoom: 13}}
          controls={controls}
        />
      </div>
      {createPortal(<button onClick={() => setCurrent((current + 1) % styles.length)}>Next style</button>, corner)}
    </>
  );
}
```

A button "Next style" shows in the top left corner, and each click shows the next style.

- The element of `custom` shows at once, before the code of the other controls has loaded.
- The map adds the class `map-jr-ctrl` to the element, so that the element receives clicks. Style the element with a
  class of your own.
- Create the element once. A new element under the same `key` is ignored, because the map keeps the control that it
  has.
- With server rendering, create the element in the browser only (in `onMounted` or `useEffect`), because `document`
  does not exist on the server.

A control written for MapLibre GL JS also works in the main API. Pass its methods to `custom`:
`custom({key: 'ruler', onAdd: map => ruler.onAdd(map), onRemove: map => ruler.onRemove(map)})`. `onAdd` receives the
core map of the library, which has the methods of a map of MapLibre GL JS, and not the object that `createMap`
returns.

## See also

- [`controls`](../reference/description.md#controls), [`locale`](../reference/description.md#locale) and
  [`attribution`](../reference/description.md#attribution) in the reference of the description.
- [Controls](../api.md#controls) for every option of each control.
- [Light and dark maps](color-scheme.md) for the colours of the controls in a dark map.
