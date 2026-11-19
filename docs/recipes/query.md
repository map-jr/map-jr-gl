# Query what is at a position

A click on the map lists the features of the tile data at that position, also those that the style does not draw.

<!-- example:query:start -->
**Main API**

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

export default function (container, {show}) {
  // The answer shows in a box in a corner of the map. The box takes no pointer events, so a click on it reaches the map.
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;top:8px;left:8px;z-index:1;pointer-events:none;max-width:240px;padding:8px 10px;border-radius:8px;background:#fff;color:#222;font:12px/1.5 system-ui,sans-serif;box-shadow:0 1px 6px #0004';
  box.hidden = true;

  let clicks = 0;
  const map = createMap(container, {
    style,
    initialView: {center: NYC, zoom: 16.2},
    attribution: {compact: true},
    cursor: 'crosshair',   // a click asks about one position
    onClick: async e => {
      const click = ++clicks;
      // `querySource` reads the tile data of one source within 8 pixels of the click. It also finds
      // features that the style does not draw. "openmaptiles" is the id of the vector source in this style.
      // A query fails when its tile cannot be loaded: the answer is then `null` here.
      const features = await map.querySource('openmaptiles', e.lngLat, {radius: 8}).catch(() => null);
      // An earlier click can get its answer after a later click. Only the last click is shown.
      if (click !== clicks) return;

      box.replaceChildren();
      for (const f of features?.slice(0, 8) ?? []) {
        const line = box.appendChild(document.createElement('div'));
        line.appendChild(document.createElement('b')).textContent = f.sourceLayer;
        line.append(' ' + (f.properties.name ?? f.properties.class ?? ''));
      }
      if (!features?.length) box.textContent = features ? 'Nothing here' : 'The tile data did not load';
      box.hidden = false;
      show(features ? `${features.length} features within 8 pixels` : 'The query failed');
    },
  });
  container.append(box);
  show('Click the map to list what is there.');
  return map;
}
```

**MapLibre compat**

```js [MapLibre compat]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

export default function (container, {show}) {
  const map = new Map({container, style, center: NYC, zoom: 16.2, attributionControl: {compact: true}});
  map.setCursor('crosshair');

  // The answer shows in a box in a corner of the map. The box takes no pointer events, so a click on it reaches the map.
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;top:8px;left:8px;z-index:1;pointer-events:none;max-width:240px;padding:8px 10px;border-radius:8px;background:#fff;color:#222;font:12px/1.5 system-ui,sans-serif;box-shadow:0 1px 6px #0004';
  box.hidden = true;
  map.getContainer().append(box);

  let clicks = 0;
  map.on('click', async e => {
    const click = ++clicks;
    // `querySource` is an addition of this library. It reads the tile data of one source within
    // 8 pixels of the click, and it also finds features that the style does not draw. "openmaptiles" is the id of
    // the vector source in this style. (`queryRenderedFeatures` of MapLibre GL JS is there also.)
    // A query fails when its tile cannot be loaded: the answer is then `null` here.
    const features = await map.querySource('openmaptiles', e.lngLat, {radius: 8}).catch(() => null);
    // An earlier click can get its answer after a later click. Only the last click is shown.
    if (click !== clicks) return;

    box.replaceChildren();
    for (const f of features?.slice(0, 8) ?? []) {
      const line = box.appendChild(document.createElement('div'));
      line.appendChild(document.createElement('b')).textContent = f.sourceLayer;
      line.append(' ' + (f.properties.name ?? f.properties.class ?? ''));
    }
    if (!features?.length) box.textContent = features ? 'Nothing here' : 'The tile data did not load';
    box.hidden = false;
    show(features ? `${features.length} features within 8 pixels` : 'The query failed');
  });
  return map;
}
```

**Vue**

```vue [Vue]
<script setup>
import {shallowRef, useTemplateRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];
// The answer shows in a box in a corner of the map. The box takes no pointer events, so a click on it reaches the map.
const box = 'position:absolute;top:8px;left:8px;z-index:1;pointer-events:none;max-width:240px;padding:8px 10px;border-radius:8px;background:#fff;color:#222;font:12px/1.5 system-ui,sans-serif;box-shadow:0 1px 6px #0004';

const map = useTemplateRef('map');
const found = shallowRef(null);
let clicks = 0;

async function ask(event) {
  const click = ++clicks;
  // `querySource` reads the tile data of one source within 8 pixels of the click. It also finds
  // features that the style does not draw. "openmaptiles" is the id of the vector source in this style.
  // A query fails when its tile cannot be loaded: the answer is then `null` here.
  const features = await map.value.map.querySource('openmaptiles', event.lngLat, {radius: 8}).catch(() => null);
  // An earlier click can get its answer after a later click. Only the last click is shown.
  if (click === clicks) found.value = {features};
}
</script>

<template>
  <MapJr ref="map" :map-style="style" :initial-view="{center: NYC, zoom: 16.2}" cursor="crosshair" @click="ask">
    <div v-if="found" :style="box">
      <div v-for="f in found.features?.slice(0, 8)"><b>{{ f.sourceLayer }}</b> {{ f.properties.name ?? f.properties.class }}</div>
      <div v-if="!found.features">The tile data did not load</div>
      <div v-else-if="!found.features.length">Nothing here</div>
    </div>
  </MapJr>
</template>
```

**React**

```jsx [React]
import {useRef, useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];
// The answer shows in a box in a corner of the map. The box takes no pointer events, so a click on it reaches the map.
const box = {position: 'absolute', top: '8px', left: '8px', zIndex: 1, pointerEvents: 'none', maxWidth: '240px', padding: '8px 10px', borderRadius: '8px', background: '#fff', color: '#222', font: '12px/1.5 system-ui,sans-serif', boxShadow: '0 1px 6px #0004'};

export default function Query() {
  const map = useRef(null);
  const [found, setFound] = useState(null);
  const clicks = useRef(0);

  async function ask(event) {
    const click = ++clicks.current;
    // `querySource` reads the tile data of one source within 8 pixels of the click. It also finds
    // features that the style does not draw. "openmaptiles" is the id of the vector source in this style.
    // A query fails when its tile cannot be loaded: the answer is then `null` here.
    const features = await map.current.querySource('openmaptiles', event.lngLat, {radius: 8}).catch(() => null);
    // An earlier click can get its answer after a later click. Only the last click is shown.
    if (click === clicks.current) setFound({features});
  }

  return (
    <MapJr ref={map} mapStyle={style} initialView={{center: NYC, zoom: 16.2}} cursor="crosshair" onClick={ask}>
      {found && (
        <div style={box}>
          {found.features?.slice(0, 8).map((f, i) => <div key={i}><b>{f.sourceLayer}</b> {f.properties.name ?? f.properties.class}</div>)}
          {!found.features ? 'The tile data did not load' : !found.features.length && 'Nothing here'}
        </div>
      )}
    </MapJr>
  );
}
```
<!-- example:query:end -->

## How it works

- [`querySource(sourceId, at, options)`](../api.md#queries) reads the tile data of one source. `'openmaptiles'` is the
  id of the vector source of this style: use the id of a source of your style.
- `at` is the position of the click as `[lng, lat]`, and `radius` is the distance around it in pixels of the screen.
  The default radius is 3.
- The result is a promise of a list of features (`QueriedFeature`). Each has `id`, `properties`, `source`,
  `sourceLayer` and `type`.
- The promise rejects when the tile does not load, and when the map is removed before the answer comes. The example
  catches the rejection and shows a text.
- The answers of two clicks can arrive in the other order. The example counts the clicks and shows only the answer
  of the last one.

In the files for the main API and the compat entry, the default export is a function that receives the container
of the map. `show` writes a line of text beside the map. In Vue, `map.value.map` is the map of the component. In
React, the ref of `MapJr` is the map.

## Variations

### Ask only for what the style draws

`queryFeatures` finds the features that the style layers draw at a point of the screen, the top one first. Each
feature has `layer`, the style layer that draws it.

```js
const features = await map.queryFeatures(e.point, {radius: 8}).catch(() => null);
```

### Ask for some layers of the source, or filter

```js
const features = await map.querySource('openmaptiles', e.lngLat, {
  radius: 8,
  sourceLayers: ['transportation'],
  filter: ['==', ['get', 'class'], 'path'],
}).catch(() => null);
```

### Get the geometry of each feature

At a position, a feature has no `geometry` unless the query asks for it.

```js
const features = await map.querySource('openmaptiles', e.lngLat, {radius: 8, geometry: true}).catch(() => null);
```

### Ask for everything in the view

Without a position, `querySource` returns the features of the tiles of the view, each with its `geometry`.

```js
const buildings = await map.querySource('openmaptiles', {sourceLayers: ['building']});
```

## See also

- [Queries](../api.md#queries) for every option, and for `watchFeatures` and `watchSource`, which keep an answer up
  to date.
- [`interactiveLayers`](../reference/description.md#interactivelayers) and
  [`onClick`](../reference/description.md#onclick): a click reports the features of some style layers with no query.
- [Markers and popups](../guide/markers-and-popups.md) to show the answer in a popup.
