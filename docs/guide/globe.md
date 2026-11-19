# The globe

This page shows how to draw the map on a sphere, how to let the user switch between the globe and the flat map, and
what changes on the globe. The flat map is the Web Mercator projection (`mercator`), which every map uses by default.

## Show the map as a globe

The field [`projection`](../reference/description.md#projection) of the description selects the projection. It
overrides the `projection` of the style.

**Main API**

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl';

// The page has <div id="map" style="height: 400px"></div>.
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [10, 30], zoom: 1.5},
  projection: {type: 'globe'},
});
```

**MapLibre compat**

```js [MapLibre compat]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

// The page has <div id="map" style="height: 400px"></div>.
const map = new Map({container: 'map', style: 'https://styles.map-jr.org/1/elevation-zero.json', center: [10, 30], zoom: 1.5});

// Each new style sets its own projection, so set the globe after each one.
map.on('style.load', () => map.setProjection({type: 'globe'}));
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
      :initial-view="{center: [10, 30], zoom: 1.5}"
      :projection="{type: 'globe'}"
    />
  </div>
</template>
```

**React**

```jsx [React]
import {MapJr} from '@map-jr/map-jr-gl/react';

const initialView = {center: [10, 30], zoom: 1.5};
const projection = {type: 'globe'};

export default function World() {
  return (
    <div style={{height: 400}}>
      <MapJr mapStyle="https://styles.map-jr.org/1/elevation-zero.json" initialView={initialView} projection={projection} />
    </div>
  );
}
```

The map accepts three projections:

| `type` | The map draws |
|---|---|
| `'mercator'` | The flat map. |
| `'globe'` | A globe, which turns into the flat map between zoom 11 and zoom 12, as in MapLibre GL JS. |
| `'vertical-perspective'` | A globe at every zoom. |

`type` can also be an `interpolate` expression of `["zoom"]` between two of these names, as in the MapLibre style
specification. Another name writes one warning, and the map draws `mercator`.

With `projection: null` or no field, the map uses the root property `projection` of the style, and `mercator` when
the style has none.

A new `projection` switches the projection without loading the style again. Pass it to
[`update`](../api.md#change-the-map) with the complete description, or to `patch` with only the fields that change. When the map switches from the flat map to the globe, it shows the flat map until the tiles of the view
are ready for the globe, for at most 1 second.

## Let the user switch to the globe

The control [`globe`](../api.md#controls) is a button that switches the projection between `globe` and `mercator`.

**Main API**

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl';
import {globe, navigation} from '@map-jr/map-jr-gl/controls';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [10, 30], zoom: 1.5},
  controls: [navigation(), globe()],
});

map.listen('projectiontransition', e => console.log(`The map is now ${e.newProjection}`));
```

**MapLibre compat**

```js [MapLibre compat]
import {Map, NavigationControl, GlobeControl} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({container: 'map', style: 'https://styles.map-jr.org/1/elevation-zero.json', center: [10, 30], zoom: 1.5});
map.addControl(new NavigationControl());
map.addControl(new GlobeControl());

map.on('projectiontransition', e => console.log(`The map is now ${e.newProjection}`));
```

A `patch` of another field keeps the projection of a click. A `projection` that differs from that of the last
description replaces it, and so does a new `style`. The map then uses the `projection` of the description, or the
projection of the style when the description has none. While the projection is
`globe`, the button has the class `map-jr-ctrl-globe-enabled` and `aria-pressed="true"`.

The event `projectiontransition` fires when the name of the projection changes and when a new style loads.
`newProjection` is `'mercator'`, `'globe'` or `'vertical-perspective'`.

## What the globe draws

On the globe, the map draws the layers of the types `background`, `fill`, `line`, `circle`, `heatmap`, `raster`,
`hillshade` and `symbol`. The background covers only the sphere, and the space around the sphere is transparent. To
fill it, set the CSS `background` of the container, the element that you pass to `createMap` or as `container`.

- The map draws no [3D terrain](terrain.md) and no `fill-extrusion` layers on the globe. For each of the two, it
  writes one warning per map. With `globe`, they show past zoom 12, where the map is flat. The styles of
  `https://styles.map-jr.org/1/` have a `fill-extrusion` layer for buildings, so a globe with one of them writes that
  warning. The warning changes nothing else, and the buildings show past zoom 12.
- A custom layer of the MapLibre compat entry is drawn on the globe too, with no warning.
- With a `sky` in the style, the map draws the atmosphere around the globe, as MapLibre GL JS does. It draws no sky
  gradient and no fog on the globe. The property `atmosphere-blend` of `sky` sets the opacity of the atmosphere.
- A label whose anchor turns to the far side of the globe is hidden. A `Marker` of the MapLibre compat entry on the far
  side takes the opacity `opacityWhenCovered` (0.2 by default).
- The [server renderer](../server-rendering.md) draws the flat map.

## How the camera moves on the globe

- A drag turns the globe and keeps the bearing, as in MapLibre GL JS.
- A move to a new centre without a `zoom` keeps the size of the globe on the screen. The map then changes the zoom
  of the view with the latitude: a view at zoom 1.5 at the equator is at zoom -0.05 at 70 degrees north. A `zoom` that you
  pass is applied unchanged.
- [`maxBounds`](../reference/description.md#maxbounds) has no effect on the globe.

## See also

- [`projection`](../reference/description.md#projection) of the description.
- [Controls](../api.md#controls) for the options of `globe` and the other controls.
- [Terrain and elevation](terrain.md) for 3D terrain on the flat map.
