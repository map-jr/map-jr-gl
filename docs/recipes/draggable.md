# Let the user move a pin

This example puts a pin on the map that the user drags with the mouse, a finger or a pen, and shows its position while
it moves and where it is dropped.

Each block below is a complete file of the [gallery](https://map-jr.github.io/map-jr-gl/). The two `js` files are the
module script of a page that has `<div id="map" style="height: 500px"></div>`, and each one creates the line of text
below the map itself. The Vue and React components fill their parent element, so give the parent a height. The Svelte
component and the `<map-jr>` page give the element of the map a height of 500 pixels.

<!-- example:draggable:start -->
**Main API**

```js [Main API]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. A line of text below the map gives the position of the pin.
import {createMap, defaultPin} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const container = document.getElementById('map');
const readout = document.createElement('p');
container.after(readout);
const show = text => {
  readout.textContent = text;
};
const at = ([lng, lat]) => `${lng.toFixed(5)}, ${lat.toFixed(5)}`;

const map = createMap(container, {
  style,
  initialView: {center: NYC, zoom: 14},
  attribution: {compact: true},
});

// The default pin of Marker, which the user can move. The tip of the pin is at
// the position.
map.overlay(defaultPin({color: '#d6453d'}), {
  lngLat: NYC,
  anchor: 'bottom',
  draggable: true,
  onDrag: lngLat => show(`Moving: ${at(lngLat)}`),
  onDragEnd: lngLat => show(`Dropped at ${at(lngLat)}`),
});
show(`Drag the pin. It is at ${at(NYC)}`);
```

**MapLibre compat**

```js [MapLibre compat]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. A line of text below the map gives the position of the pin.
import {Map, Marker} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const at = ({lng, lat}) => `${lng.toFixed(5)}, ${lat.toFixed(5)}`;

const map = new Map({
  container: 'map',
  style,
  center: NYC,
  zoom: 14,
  attributionControl: {compact: true},
});
const readout = document.createElement('p');
map.getContainer().after(readout);
const show = text => {
  readout.textContent = text;
};

const marker = new Marker({color: '#d6453d', draggable: true})
  .setLngLat(NYC)
  .addTo(map);
marker.on('drag', () => show(`Moving: ${at(marker.getLngLat())}`));
marker.on('dragend', () => show(`Dropped at ${at(marker.getLngLat())}`));
show(`Drag the pin. It is at ${at(marker.getLngLat())}`);
```

**Vue**

```vue [Vue]
<script setup>
import {ref} from 'vue';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/vue';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
// The outline of the pin.
const pinPath =
  'M13.5 0C6 0 0 6 0 13.5 0 23 13.5 41 13.5 41S27 23 27 13.5C27 6 21 0 13.5 0z';
const pin = ref([-74.0065, 40.7085]);
const moving = ref(false);
</script>

<template>
  <MapJr
    :map-style="style"
    :initial-view="{center: pin, zoom: 14}"
    :attribution="{compact: true}"
  >
    <!--
      The new position comes with dragend. The pin stays where it was dropped
      until lng-lat changes.
    -->
    <MapOverlay
      :lng-lat="pin"
      anchor="bottom"
      draggable
      @dragstart="moving = true"
      @dragend="
        p => {
          pin = p;
          moving = false;
        }
      "
    >
      <svg width="27" height="41" viewBox="0 0 27 41">
        <path :d="pinPath" fill="#d6453d" />
        <circle cx="13.5" cy="13.5" r="5.5" fill="#fff" />
      </svg>
    </MapOverlay>
    <p class="note">
      {{
        moving ? 'Moving' : `Pin at ${pin[0].toFixed(5)}, ${pin[1].toFixed(5)}`
      }}
    </p>
  </MapJr>
</template>
```

**React**

```jsx [React]
import {useState} from 'react';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/react';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];
// The outline of the pin.
const pinPath =
  'M13.5 0C6 0 0 6 0 13.5 0 23 13.5 41 13.5 41S27 23 27 13.5C27 6 21 0 13.5 0z';

export default function Draggable() {
  const [pin, setPin] = useState(NYC);
  const [moving, setMoving] = useState(false);
  return (
    <MapJr
      mapStyle={style}
      initialView={{center: NYC, zoom: 14}}
      attribution={{compact: true}}
    >
      {/* The new position comes with onDragEnd. The pin stays where it was dropped until lngLat changes. */}
      <MapOverlay
        lngLat={pin}
        anchor="bottom"
        draggable
        onDragStart={() => setMoving(true)}
        onDragEnd={p => {
          setPin(p);
          setMoving(false);
        }}
      >
        <svg width="27" height="41" viewBox="0 0 27 41">
          <path d={pinPath} fill="#d6453d" />
          <circle cx="13.5" cy="13.5" r="5.5" fill="#fff" />
        </svg>
      </MapOverlay>
      <p className="note">
        {moving
          ? 'Moving'
          : `Pin at ${pin[0].toFixed(5)}, ${pin[1].toFixed(5)}`}
      </p>
    </MapJr>
  );
}
```

**Svelte**

```svelte [Svelte]
<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';
  import {defaultPin} from '@map-jr/map-jr-gl';

  const NYC = [-74.0065, 40.7085];
  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: NYC, zoom: 14},
    attribution: {compact: true},
  };
  const at = ([lng, lat]) => `${lng.toFixed(5)}, ${lat.toFixed(5)}`;
  let text = $state(`Drag the pin. It is at ${at(NYC)}`);

  // The default pin of Marker, which the user can move. The tip of the pin is
  // at the position.
  function ready(map) {
    map.overlay(defaultPin({color: '#d6453d'}), {
      lngLat: NYC,
      anchor: 'bottom',
      draggable: true,
      onDrag: lngLat => (text = `Moving: ${at(lngLat)}`),
      onDragEnd: lngLat => (text = `Dropped at ${at(lngLat)}`),
    });
  }
</script>

<div use:mapJr={{description, ready}} style="height: 500px"></div>
<p>{text}</p>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8" />
<title>A pin that the user moves</title>
<!--
  A line of text below the map
  gives the position of the pin.
-->
<map-jr
  id="map"
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  center="-74.0065,40.7085"
  zoom="14"
  style="height: 500px"
></map-jr>
<p id="readout"></p>
<script type="module">
  import '@map-jr/map-jr-gl/element';
  import {defaultPin} from '@map-jr/map-jr-gl';

  const NYC = [-74.0065, 40.7085];
  const map = document.getElementById('map');
  const readout = document.getElementById('readout');
  const at = ([lng, lat]) => `${lng.toFixed(5)}, ${lat.toFixed(5)}`;
  map.attribution = {compact: true};

  // The default pin of Marker,
  // which the user can move. The
  // tip of the pin is at the
  // position.
  map.addEventListener('map-ready', event => {
    event.detail.overlay(defaultPin({color: '#d6453d'}), {
      lngLat: NYC,
      anchor: 'bottom',
      draggable: true,
      onDrag: lngLat => {
        readout.textContent = `Moving: ${at(lngLat)}`;
      },
      onDragEnd: lngLat => {
        readout.textContent = `Dropped at ${at(lngLat)}`;
      },
    });
  });
  readout.textContent = `Drag the pin. It is at ${at(NYC)}`;
</script>
```
<!-- example:draggable:end -->

## How it works

- [`overlay`](../reference/map.md#overlay) places an element of the page at a position of the map, and returns an object
  with `update` and `remove`.
- [`defaultPin`](../reference/exports.md#defaultpin) returns the pin of `Marker` of MapLibre GL JS as an element.
  `anchor: 'bottom'` puts the tip of the pin at the position.
- With `draggable: true`, a drag starts once the pointer has moved 3 CSS pixels, so a click stays a click. The map does
  not pan while the pin is dragged.
- `onDrag` receives the position as `[lng, lat]` at each move, and `onDragEnd` receives the position where the pin was
  dropped. See [`OverlayOptions`](../reference/map.md#overlayoptions) for every option.

In Vue and React, the `MapOverlay` component holds the pin, and its content is an SVG element in the template. The pin
stays where it was dropped until its `lng-lat` changes, so the `dragend` handler stores the new position. In the compat
entry, a `Marker` of MapLibre GL JS with `draggable: true` fires `drag` and `dragend`.

## Variations

The variation changes the call of `overlay` in the Main API example. `map`, `NYC`, `show` and `at` are the names of that
example.

### Put your own element on the map

Any element can be dragged. This one is a label:

```js
const label = document.createElement('div');
label.textContent = 'Meeting point';
map.overlay(label, {
  lngLat: NYC,
  draggable: true,
  onDragEnd: lngLat => show(`Dropped at ${at(lngLat)}`),
});
```

## See also

- [Put an element of the page on the map, and let the user move
  it](../guide/markers-and-popups.md#put-an-element-of-the-page-on-the-map-and-let-the-user-move-it).
- [Show many markers and open a popup on click](markers.md) for markers that the map draws.
