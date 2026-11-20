# The view and the camera

The view is the position of the camera. This page shows how to set the first view, move the camera from code, keep
the view in the state of the application, and read the view.

| Member | Type | Meaning |
|---|---|---|
| `center` | `[lng, lat]` | The position at the centre of the map. |
| `zoom` | `number` | The zoom level. |
| `bearing` | `number` | The compass direction at the top of the map, in degrees: 90 puts east at the top. |
| `pitch` | `number` | The tilt in degrees: 0 looks straight down. The largest pitch is `maxPitch` of the description, 60 by default. |

## Set the first view

[`initialView`](../reference/description.md#initialview) sets the camera once, when the map is created. After that,
the user moves the map.

**Main API**

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl';

createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6, pitch: 30},
});
```

**MapLibre compat**

```js [MapLibre compat]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 13.6,
  pitch: 30,
});
```

**Vue**

```vue [Vue]
<script setup>
import {MapJr} from '@map-jr/map-jr-gl/vue';
</script>

<template>
  <div style="height: 400px">
    <MapJr
      map-style="https://styles.map-jr.org/1/elevation-zero.json"
      :initial-view="{center: [-74.0065, 40.7085], zoom: 13.6, pitch: 30}"
    />
  </div>
</template>
```

**React**

```jsx [React]
import {MapJr} from '@map-jr/map-jr-gl/react';

export function Harbor() {
  return (
    <div style={{height: 400}}>
      <MapJr
        mapStyle="https://styles.map-jr.org/1/elevation-zero.json"
        initialView={{center: [-74.0065, 40.7085], zoom: 13.6, pitch: 30}}
      />
    </div>
  );
}
```

A member that is not set has the value 0: `center` is `[0, 0]`, and `zoom`, `bearing` and `pitch` are 0. A map
without `initialView` starts at that view.

To show an area whatever the size of the map, set `bounds` in place of `center` and `zoom`. The map fits the box
into the view:

**Main API**

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl';

createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  // [[west, south], [east, north]]; [west, south, east, north] works too.
  initialView: {
    bounds: [
      [-74.05, 40.68],
      [-73.9, 40.82],
    ],
    padding: 40,
  },
});
```

**MapLibre compat**

```js [MapLibre compat]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  bounds: [
    [-74.05, 40.68],
    [-73.9, 40.82],
  ],
  fitBoundsOptions: {padding: 40},
});
```

Two options belong to the fit:

| Option | Main API | MapLibre compat | Default | Effect |
|---|---|---|---|---|
| `padding` | in `initialView` | in `fitBoundsOptions` | `0` | The space in CSS pixels between the box and the edges of the map, for this fit only. |
| `maxZoom` | in `initialView` | in `fitBoundsOptions` | `maxZoom` of the map | The largest zoom of the fit. |

The fit of `initialView` does not add the [`padding`](../reference/description.md#padding) of the description.

Two settings override `initialView`:

- [`view`](#keep-the-view-in-the-application) overrides each member that it sets. When the description has `view`,
  the map ignores `bounds`, also when `view` sets only some members.
- With [`hash`](../reference/description.md#hash), a view in the URL of the page overrides `center`, `zoom`,
  `bearing` and `pitch`. It does not override `bounds`.

## Move the camera from code

In the main API, [`map.moveTo`](../api.md#the-camera) moves the camera each time that it is called. It accepts the
members of the view, or `bounds` with `padding` and `maxZoom` as in `initialView`, and two members for the movement:

| Member | Type | Default | Effect |
|---|---|---|---|
| `duration` | `number` | `0` | The time of the movement in milliseconds. With 0 the camera jumps. |
| `fly` | `boolean \| FlyOptions` | `false` | The camera zooms out and back in on the way. See [Fly along a curve](#fly-along-a-curve) for the options. |

The examples read the current zoom from [`map.state`](#read-the-view).

**Main API**

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 12},
});

function zoomIn() {
  map.moveTo({zoom: map.state.get().view.zoom + 1, duration: 300});
}

function flyToParis() {
  map.moveTo({center: [2.35, 48.86], zoom: 12, fly: true});
}

function showManhattan() {
  map.moveTo({
    bounds: [
      [-74.05, 40.68],
      [-73.9, 40.82],
    ],
    padding: 40,
    duration: 800,
  });
}
```

**MapLibre compat**

```js [MapLibre compat]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 12,
});

function zoomIn() {
  map.easeTo({zoom: map.getZoom() + 1, duration: 300});
}

function flyToParis() {
  map.flyTo({center: [2.35, 48.86], zoom: 12});
}

function showManhattan() {
  map.fitBounds(
    [
      [-74.05, 40.68],
      [-73.9, 40.82],
    ],
    {padding: 40, duration: 800},
  );
}
```

**Vue**

```vue [Vue]
<script setup>
import {useTemplateRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

// `map` of the component is the map of the main API, or null before the
// component is mounted.
const component = useTemplateRef('component');
const flyToParis = () =>
  component.value.map.moveTo({center: [2.35, 48.86], zoom: 12, fly: true});
</script>

<template>
  <div style="height: 400px">
    <MapJr
      ref="component"
      map-style="https://styles.map-jr.org/1/elevation-zero.json"
      :initial-view="{center: [-74.0065, 40.7085], zoom: 12}"
    />
  </div>
  <button @click="flyToParis">Paris</button>
</template>
```

**React**

```jsx [React]
import {useRef} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';

export function Places() {
  // The ref is the map of the main API, or null before the component has
  // created it.
  const map = useRef(null);
  return (
    <>
      <div style={{height: 400}}>
        <MapJr
          ref={map}
          mapStyle="https://styles.map-jr.org/1/elevation-zero.json"
          initialView={{center: [-74.0065, 40.7085], zoom: 12}}
        />
      </div>
      <button
        onClick={() =>
          map.current?.moveTo({center: [2.35, 48.86], zoom: 12, fly: true})
        }
      >
        Paris
      </button>
    </>
  );
}
```

A member that `moveTo` is not passed keeps its value, so `{zoom: 15}` keeps the centre. With `bounds`:

- The map turns to bearing 0 unless `bearing` is set.
- `pitch` does not change the fit. The map computes the centre and the zoom of the fit at the current pitch, so with
  a different `pitch` the box can extend past the edges of the map. To fit a box at a pitch, set the pitch first.
- The `padding` of `moveTo` is added to the [`padding`](../reference/description.md#padding) of the description.
  `moveTo` does not change the `padding` of the description.

When the system asks for reduced motion (`prefers-reduced-motion: reduce`), the camera jumps.

[`map.fitBounds(bounds, options)`](../api.md#the-camera) is the same as `map.moveTo({bounds, ...options})`, except
that `duration` is 800 by default.

### Fly along a curve

`fly` is `true`, or an object with these options. They have the names and defaults of `flyTo` of MapLibre GL JS.

| Option | Type | Default | Effect |
|---|---|---|---|
| `curve` | `number` | `1.42` | How far the camera zooms out on the way. A larger value zooms out more. |
| `speed` | `number` | `1.2` | The average speed along the curve. A larger value is faster. |
| `screenSpeed` | `number` | | The average speed in screens per second. It overrides `speed`. |
| `minZoom` | `number` | | The zoom at the highest point of the curve. It overrides `curve`. |
| `maxDuration` | `number` | no limit | The longest flight in milliseconds. A longer flight is a jump. |

Without `duration`, the map computes the duration of the flight from the distance and the speed. A `duration`
overrides `speed` and `screenSpeed`, and the map then ignores `maxDuration`.

## Keep the view in the application

Set [`view` and `onViewChange`](../reference/description.md#view-and-onviewchange) when the application needs the
view in its own state, for example to show it or to store it in a URL. The map reports each change of the view to
`onViewChange`, and the application passes the view back in the next description. To move the map, the application
passes a different view.

**Main API**

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl';

let view = {center: [-74.0065, 40.7085], zoom: 13.6};
const describe = () => ({
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  view,
  // The map calls onViewChange only after createMap has returned, so `map` is
  // set here.
  onViewChange: next => {
    view = next;
    map.update(describe());
  },
});
const map = createMap('map', describe());

function showPier() {
  view = {...view, center: [-74.0134, 40.7033], zoom: 16};
  map.update(describe());
}
```

**Vue**

```vue [Vue]
<script setup>
import {ref} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

const view = ref({
  center: [-74.0065, 40.7085],
  zoom: 13.6,
  bearing: 0,
  pitch: 0,
});
</script>

<template>
  <div style="height: 400px">
    <MapJr
      map-style="https://styles.map-jr.org/1/elevation-zero.json"
      v-model:view="view"
    />
  </div>
  <p>Zoom {{ view.zoom.toFixed(1) }}</p>
  <button @click="view = {...view, center: [-74.0134, 40.7033], zoom: 16}">
    Pier A
  </button>
</template>
```

**React**

```jsx [React]
import {useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';

export function Harbor() {
  const [view, setView] = useState({center: [-74.0065, 40.7085], zoom: 13.6});
  return (
    <>
      <div style={{height: 400}}>
        <MapJr
          mapStyle="https://styles.map-jr.org/1/elevation-zero.json"
          view={view}
          onViewChange={setView}
        />
      </div>
      <p>Zoom {view.zoom.toFixed(1)}</p>
      <button
        onClick={() =>
          setView({...view, center: [-74.0134, 40.7033], zoom: 16})
        }
      >
        Pier A
      </button>
    </>
  );
}
```

The map applies a new `view` with no animation. To animate the camera, call `moveTo` with `duration` instead: the
map then reports the new views to `onViewChange` as it moves.

The map does not wait for the application. When the application passes back a view that the map reported, the map
ignores it, so a slow application does not pull the map back while the user moves it.

### Return to a stored view

A `view` has no effect when its `center`, `zoom`, `bearing` and `pitch` equal those of one of the last 60 views that
the map reported to `onViewChange`, however long ago. So a button "back to where I was" that sets `view` to a stored
view often does nothing. Call `moveTo` with the stored view instead: `moveTo` always moves the map. In the compat
entry, `jumpTo`, `easeTo` and `flyTo` always move the map, as in MapLibre GL JS.

**Main API**

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl';

let view = {center: [-74.0065, 40.7085], zoom: 13.6};
const describe = () => ({
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  view,
  // The map calls onViewChange only after createMap has returned, so `map` is
  // set here.
  onViewChange: next => {
    view = next;
    map.update(describe());
  },
});
const map = createMap('map', describe());
let stored = view;

function rememberView() {
  stored = view;
}

function backToStoredView() {
  map.moveTo({...stored, duration: 500});
}
```

**Vue**

```vue [Vue]
<script setup>
import {ref, useTemplateRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

const view = ref({
  center: [-74.0065, 40.7085],
  zoom: 13.6,
  bearing: 0,
  pitch: 0,
});
const component = useTemplateRef('component');
// The page does not show the stored view, so it needs no ref.
let stored = view.value;
const rememberView = () => {
  stored = view.value;
};
const backToStoredView = () =>
  component.value.map.moveTo({...stored, duration: 500});
</script>

<template>
  <div style="height: 400px">
    <MapJr
      ref="component"
      map-style="https://styles.map-jr.org/1/elevation-zero.json"
      v-model:view="view"
    />
  </div>
  <button @click="rememberView">Remember this view</button>
  <button @click="backToStoredView">Back to where I was</button>
</template>
```

**React**

```jsx [React]
import {useRef, useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';

const start = {center: [-74.0065, 40.7085], zoom: 13.6};

export function Harbor() {
  const map = useRef(null);
  const [view, setView] = useState(start);
  // The page does not show the stored view, so a ref holds it.
  const stored = useRef(start);
  return (
    <>
      <div style={{height: 400}}>
        <MapJr
          ref={map}
          mapStyle="https://styles.map-jr.org/1/elevation-zero.json"
          view={view}
          onViewChange={setView}
        />
      </div>
      <button
        onClick={() => {
          stored.current = view;
        }}
      >
        Remember this view
      </button>
      <button
        onClick={() => map.current?.moveTo({...stored.current, duration: 500})}
      >
        Back to where I was
      </button>
    </>
  );
}
```

## Read the view

In the main API, [`map.state`](../reference/state.md#mapstate) holds the current view in `view`, with one more member, `bounds`.
`bounds` is the smallest box `[[west, south], [east, north]]` that contains the visible map, also when the map is
rotated or pitched. It changes when the map moves and when the size of the map changes.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});

const showView = view => {
  document.title = `${view.center[1].toFixed(4)}, ${view.center[0].toFixed(4)} at zoom ${view.zoom.toFixed(1)}`;
};
// The listener runs only when the view changes, so show the current view first.
showView(map.state.get().view);
map.state.subscribe(state => state.view, showView);
```

`state.moving` is `true` while the camera moves. In the compat entry, call `getCenter()`, `getZoom()`,
`getBearing()`, `getPitch()` and `getBounds()`, as in MapLibre GL JS.

## See also

- [`initialView`](../reference/description.md#initialview), [`view` and `onViewChange`](../reference/description.md#view-and-onviewchange),
  [`padding`](../reference/description.md#padding), [`hash`](../reference/description.md#hash) and
  [`maxBounds`](../reference/description.md#maxbounds) in the reference of the description.
- [The camera](../api.md#the-camera) for `moveTo` and `fitBounds`.
- [The view of `v-model:view`](../vue.md#the-view-of-v-modelview) for the Vue component.
