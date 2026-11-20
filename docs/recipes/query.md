# Query what is at a position

To find what is at a position of the map, query the data of a source. This example lists every feature within 8 pixels
of a click, also features that the style does not draw.

Each block below is a complete file of the [gallery](https://map-jr.github.io/map-jr-gl/). The two `js` files are the
module script of a page that has `<div id="map" style="height: 500px"></div>`, and each one creates the line of text
below the map itself. The Vue and React components fill their parent element, so give the parent a height. The Svelte
component and the `<map-jr>` page give the element of the map a height of 500 pixels.

In Nuxt, the code is the Vue code without the imports, because the [module for Nuxt](../reference/nuxt.md) imports the
components, the composables and the controls automatically.

<!-- example:query:start -->
**Main API**

```js [Main API]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. The answer to a click shows in a box on the map, and a line of
// text below the map counts the features.
import {createMap} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const container = document.getElementById('map');
const readout = document.createElement('p');
container.after(readout);
const show = text => {
  readout.textContent = text;
};

// The answer shows in a box in a corner of the map. The box takes no pointer
// events, so a click on it reaches the map.
const box = document.createElement('div');
box.style.cssText =
  'position:absolute;top:8px;left:8px;z-index:1;pointer-events:none;max-width:240px;padding:8px 10px;border-radius:8px;background:#fff;color:#222;font:12px/1.5 system-ui,sans-serif;box-shadow:0 1px 6px #0004';
box.hidden = true;

let clicks = 0;
const map = createMap(container, {
  style,
  initialView: {center: NYC, zoom: 16.2},
  attribution: {compact: true},
  cursor: 'crosshair', // a click asks about one position
  onClick: async e => {
    const click = ++clicks;
    // `querySource` reads the features of one source within 8 pixels of the
    // click. It also finds features that the style does not draw.
    // "openmaptiles" is the id of the vector source in this style. When the
    // tile does not load, the query rejects, and the example shows a text
    // instead.
    const features = await map
      .querySource('openmaptiles', e.lngLat, {radius: 8})
      .catch(() => null);
    // An earlier click can get its answer after a later click. Only the last
    // click is shown.
    if (click !== clicks) return;

    box.replaceChildren();
    for (const f of features?.slice(0, 8) ?? []) {
      const line = box.appendChild(document.createElement('div'));
      line.appendChild(document.createElement('b')).textContent = f.sourceLayer;
      line.append(' ' + (f.properties.name ?? f.properties.class ?? ''));
    }
    if (!features?.length)
      box.textContent = features
        ? 'Nothing here'
        : 'The tile data did not load';
    box.hidden = false;
    show(
      features
        ? `${features.length} features within 8 pixels`
        : 'The query failed',
    );
  },
});
container.append(box);
show('Click the map to list what is there.');
```

**MapLibre compat**

```js [MapLibre compat]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. The answer to a click shows in a box on the map, and a line of
// text below the map counts the features.
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const map = new Map({
  container: 'map',
  style,
  center: NYC,
  zoom: 16.2,
  attributionControl: {compact: true},
});
map.setCursor('crosshair');
const readout = document.createElement('p');
map.getContainer().after(readout);

// The answer shows in a box in a corner of the map. The box takes no pointer
// events, so a click on it reaches the map.
const box = document.createElement('div');
box.style.cssText =
  'position:absolute;top:8px;left:8px;z-index:1;pointer-events:none;max-width:240px;padding:8px 10px;border-radius:8px;background:#fff;color:#222;font:12px/1.5 system-ui,sans-serif;box-shadow:0 1px 6px #0004';
box.hidden = true;
map.getContainer().append(box);

let clicks = 0;
map.on('click', async e => {
  const click = ++clicks;
  // `querySource` is an addition of this library. It reads the features of one
  // source within 8 pixels of the click, and it also finds features that the
  // style does not draw. "openmaptiles" is the id of the vector source in this
  // style. (`queryRenderedFeatures` of MapLibre GL JS is there also.) When the
  // tile does not load, the query rejects, and the example shows a text
  // instead.
  const features = await map
    .querySource('openmaptiles', e.lngLat, {radius: 8})
    .catch(() => null);
  // An earlier click can get its answer after a later click. Only the last
  // click is shown.
  if (click !== clicks) return;

  box.replaceChildren();
  for (const f of features?.slice(0, 8) ?? []) {
    const line = box.appendChild(document.createElement('div'));
    line.appendChild(document.createElement('b')).textContent = f.sourceLayer;
    line.append(' ' + (f.properties.name ?? f.properties.class ?? ''));
  }
  if (!features?.length)
    box.textContent = features ? 'Nothing here' : 'The tile data did not load';
  box.hidden = false;
  readout.textContent = features
    ? `${features.length} features within 8 pixels`
    : 'The query failed';
});
readout.textContent = 'Click the map to list what is there.';
```

**Vue**

```vue [Vue]
<script setup>
import {shallowRef, useTemplateRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];
// The answer shows in a box in a corner of the map. The box takes no pointer
// events, so a click on it reaches the map.
const box =
  'position:absolute;top:8px;left:8px;z-index:1;pointer-events:none;max-width:240px;padding:8px 10px;border-radius:8px;background:#fff;color:#222;font:12px/1.5 system-ui,sans-serif;box-shadow:0 1px 6px #0004';

const map = useTemplateRef('map');
const found = shallowRef(null);
let clicks = 0;

async function ask(event) {
  const click = ++clicks;
  // `querySource` reads the features of one source within 8 pixels of the
  // click. It also finds features that the style does not draw. "openmaptiles"
  // is the id of the vector source in this style. When the tile does not load,
  // the query rejects, and the example shows a text instead.
  const features = await map.value.map
    .querySource('openmaptiles', event.lngLat, {radius: 8})
    .catch(() => null);
  // An earlier click can get its answer after a later click. Only the last
  // click is shown.
  if (click === clicks) found.value = {features};
}
</script>

<template>
  <MapJr
    ref="map"
    :map-style="style"
    :initial-view="{center: NYC, zoom: 16.2}"
    cursor="crosshair"
    @click="ask"
  >
    <div v-if="found" :style="box">
      <div v-for="f in found.features?.slice(0, 8)">
        <b>{{ f.sourceLayer }}</b> {{ f.properties.name ?? f.properties.class }}
      </div>
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
// The answer shows in a box in a corner of the map. The box takes no pointer
// events, so a click on it reaches the map.
const box = {
  position: 'absolute',
  top: '8px',
  left: '8px',
  zIndex: 1,
  pointerEvents: 'none',
  maxWidth: '240px',
  padding: '8px 10px',
  borderRadius: '8px',
  background: '#fff',
  color: '#222',
  font: '12px/1.5 system-ui,sans-serif',
  boxShadow: '0 1px 6px #0004',
};

export default function Query() {
  const map = useRef(null);
  const [found, setFound] = useState(null);
  const clicks = useRef(0);

  async function ask(event) {
    const click = ++clicks.current;
    // `querySource` reads the features of one source within 8 pixels of the
    // click. It also finds features that the style does not draw.
    // "openmaptiles" is the id of the vector source in this style. When the
    // tile does not load, the query rejects, and the example shows a text
    // instead.
    const features = await map.current
      .querySource('openmaptiles', event.lngLat, {radius: 8})
      .catch(() => null);
    // An earlier click can get its answer after a later click. Only the last
    // click is shown.
    if (click === clicks.current) setFound({features});
  }

  return (
    <MapJr
      ref={map}
      mapStyle={style}
      initialView={{center: NYC, zoom: 16.2}}
      cursor="crosshair"
      onClick={ask}
    >
      {found && (
        <div style={box}>
          {found.features?.slice(0, 8).map((f, i) => (
            <div key={i}>
              <b>{f.sourceLayer}</b> {f.properties.name ?? f.properties.class}
            </div>
          ))}
          {!found.features
            ? 'The tile data did not load'
            : !found.features.length && 'Nothing here'}
        </div>
      )}
    </MapJr>
  );
}
```

**Svelte**

```svelte [Svelte]
<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';

  let map = null,
    clicks = 0;
  // The answer to the last click: `{features}`, where `features` is `null` when
  // the query failed.
  let found = $state.raw(null);
  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-74.0065, 40.7085], zoom: 16.2},
    attribution: {compact: true},
    cursor: 'crosshair', // a click asks about one position
    onClick: async e => {
      const click = ++clicks;
      // `querySource` reads the features of one source within 8 pixels of the
      // click. It also finds features that the style does not draw.
      // "openmaptiles" is the id of the vector source in this style. When the
      // tile does not load, the query rejects, and the example shows a text
      // instead.
      const features = await map
        .querySource('openmaptiles', e.lngLat, {radius: 8})
        .catch(() => null);
      // An earlier click can get its answer after a later click. Only the last
      // click is shown.
      if (click === clicks) found = {features};
    },
  };
</script>

<!--
  The answer shows in a box in a corner of the map. The box takes no pointer
  events, so a click on it reaches the map.
-->
<div
  use:mapJr={{description, ready: instance => (map = instance)}}
  style="height: 500px"
>
  {#if found}
    <div class="answer">
      {#each found.features?.slice(0, 8) ?? [] as f}
        <div>
          <b>{f.sourceLayer}</b>
          {f.properties.name ?? f.properties.class ?? ''}
        </div>
      {:else}
        {found.features ? 'Nothing here' : 'The tile data did not load'}
      {/each}
    </div>
  {/if}
</div>
<p>
  {found
    ? found.features
      ? `${found.features.length} features within 8 pixels`
      : 'The query failed'
    : 'Click the map to list what is there.'}
</p>

<style>
  .answer {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 1;
    pointer-events: none;
    max-width: 240px;
    padding: 8px 10px;
    border-radius: 8px;
    background: #fff;
    color: #222;
    font:
      12px/1.5 system-ui,
      sans-serif;
    box-shadow: 0 1px 6px #0004;
  }
</style>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8" />
<title>Ask the map what is at a position</title>
<!--
  The answer to a click shows in a
  box on the map, and a line of
  text below the
  map counts the features. The box
  takes no pointer events, so a
  click on it
  reaches the map.
-->
<map-jr
  id="map"
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  center="-74.0065,40.7085"
  zoom="16.2"
  cursor="crosshair"
  style="height: 500px"
>
  <div
    id="answer"
    hidden
    style="
      position: absolute;
      top: 8px;
      left: 8px;
      z-index: 1;
      pointer-events: none;
      max-width: 240px;
      padding: 8px 10px;
      border-radius: 8px;
      background: #fff;
      color: #222;
      font:
        12px/1.5 system-ui,
        sans-serif;
      box-shadow: 0 1px 6px #0004;
    "
  ></div>
</map-jr>
<p id="readout">Click the map to list what is there.</p>
<script type="module">
  import '@map-jr/map-jr-gl/element';

  const map = document.getElementById('map');
  const box = document.getElementById('answer');
  const readout = document.getElementById('readout');
  map.attribution = {compact: true};

  let clicks = 0;
  map.addEventListener('map-click', async event => {
    const click = ++clicks;
    // `querySource` reads the
    // features of one source
    // within 8 pixels of the
    // click. It also finds
    // features that the style
    // does not draw.
    // "openmaptiles" is the id of
    // the vector source in this
    // style. When the tile does
    // not load, the query
    // rejects, and the example
    // shows a text instead.
    const features = await map.map
      .querySource('openmaptiles', event.detail.lngLat, {radius: 8})
      .catch(() => null);
    // An earlier click can get
    // its answer after a later
    // click. Only the last click
    // is shown.
    if (click !== clicks) return;

    box.replaceChildren();
    for (const f of features?.slice(0, 8) ?? []) {
      const line = box.appendChild(document.createElement('div'));
      line.appendChild(document.createElement('b')).textContent = f.sourceLayer;
      line.append(' ' + (f.properties.name ?? f.properties.class ?? ''));
    }
    if (!features?.length)
      box.textContent = features
        ? 'Nothing here'
        : 'The tile data did not load';
    box.hidden = false;
    readout.textContent = features
      ? `${features.length} features within 8 pixels`
      : 'The query failed';
  });
</script>
```
<!-- example:query:end -->

## How it works

- [`querySource(sourceId, at, options)`](../reference/map.md#querysource) reads the features of one source, from its
  tiles. `'openmaptiles'` is the id of the vector source of this style. For another style, the ids of the sources are
  the keys of `sources` in the style JSON, and its layers name the source layers in `source-layer`.
- `at` is the position of the click as `[lng, lat]`; a point of the screen, `{x, y}` in CSS pixels, is also accepted.
  `radius` is the distance around it in pixels of the screen. The default radius is 3.
- The result is a promise of a list of features (`QueriedFeature`). Each has `id`, `properties`, `source`, `sourceLayer`
  and `type`, the type of its geometry: `'Point'`, `'LineString'` or `'Polygon'`.
- The promise rejects when the tile does not load, and when the map is removed before the answer comes. The example
  catches the rejection and shows a text.
- The answers of two clicks can arrive in the other order. The example counts the clicks and shows only the answer of
  the last one.

To call a method of the map in a framework: in Vue, the template ref of `MapJr` has the map in its member `map` (see
[the template ref](../reference/vue.md#the-template-ref)). In React, the ref of `MapJr` is the map. In Svelte, the
action `mapJr` calls `ready` with the map. On the element `<map-jr>`, the property `map` is the map.

## Variations

Each variation replaces the query in the click handler of the example. `e` is the event of the click, and `map` is the
map.

### Ask only for what the style draws

`queryFeatures` returns the features that the style layers draw at a point of the screen, the top one first. Each
feature has `layer`, the style layer that draws it. In the compat entry, `queryRenderedFeatures` of MapLibre GL JS
answers the same question.

```js
const features = await map
  .queryFeatures(e.point, {radius: 8})
  .catch(() => null);
```

### Ask for some layers of the source, or filter

```js
const features = await map
  .querySource('openmaptiles', e.lngLat, {
    radius: 8,
    sourceLayers: ['transportation'],
    filter: ['==', ['get', 'class'], 'path'],
  })
  .catch(() => null);
```

### Get the geometry of each feature

At a position, a feature has no `geometry` unless the query sets `geometry: true`. The geometry is GeoJSON in longitude
and latitude, and it is the part of the feature that lies in its tile.

```js
const features = await map
  .querySource('openmaptiles', e.lngLat, {radius: 8, geometry: true})
  .catch(() => null);
```

### Ask for everything in the view

`at` is optional. Without it, `querySource(sourceId, options)` returns the features of the source in the view, each with
its `geometry`.

```js
const features = await map
  .querySource('openmaptiles', {sourceLayers: ['building']})
  .catch(() => null);
```

## See also

- [`querySource`](../reference/map.md#querysource) for every option, and
  [`watchFeatures`](../reference/map.md#watchfeatures) and [`watchSource`](../reference/map.md#watchsource), which keep
  an answer up to date.
- [`interactiveLayers`](../reference/description.md#interactivelayers) and
  [`onClick`](../reference/description.md#onclick): a click reports the features of some style layers with no query.
- [Markers and popups](../guide/markers-and-popups.md) to show the answer in a popup.
