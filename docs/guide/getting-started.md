# Getting started

This page shows how to install Map Jr. GL and how to show a first map with each entry and adapter. To choose between
them, see [Which entry to use](which-entry.md).

## Install the package

**npm**

```sh [npm]
npm install @map-jr/map-jr-gl
```

**pnpm**

```sh [pnpm]
pnpm add @map-jr/map-jr-gl
```

**yarn**

```sh [yarn]
yarn add @map-jr/map-jr-gl
```

**bun**

```sh [bun]
bun add @map-jr/map-jr-gl
```

The map needs a browser with WebGL2. It needs no CSS file: the library adds the styles of its controls and popups to
the page.

## Show a map

Each example shows a street map of Lower Manhattan in an element that is 400 pixels high. The style is the URL of a
MapLibre style.

<!-- example:first-map:start -->
**Map Jr**

```js [Map Jr]
// The module script of a page that has <div id="map" style="height:
// 400px"></div>.
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});

// The state of the map is a store. The function runs after each change of the
// zoom, and not at the start.
map.state.subscribe(
  state => state.view.zoom,
  zoom => console.log(zoom),
);
```

**MapLibre**

```js [MapLibre]
// The module script of a page that has <div id="map" style="height:
// 400px"></div>.
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 13.6,
});

map.on('zoomend', () => console.log(map.getZoom()));
```

**Vue**

```vue [Vue]
<script setup>
import {ref} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

const view = ref({center: [-74.0065, 40.7085], zoom: 13.6});
</script>

<template>
  <div style="height: 400px">
    <MapJr
      map-style="https://styles.map-jr.org/1/elevation-zero.json"
      v-model:view="view"
    />
  </div>
  <p>Zoom {{ view.zoom.toFixed(1) }}</p>
</template>
```

**Nuxt**

```vue [Nuxt]
<script setup>
// A page of a Nuxt app whose nuxt.config.ts has modules:
// ['@map-jr/map-jr-gl/nuxt'].
const view = ref({center: [-74.0065, 40.7085], zoom: 13.6});
</script>

<template>
  <div style="height: 400px">
    <MapJr
      map-style="https://styles.map-jr.org/1/elevation-zero.json"
      v-model:view="view"
    />
  </div>
  <p>Zoom {{ view.zoom.toFixed(1) }}</p>
</template>
```

**React**

```jsx [React]
import {useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';

export default function CityMap() {
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
    </>
  );
}
```

**Svelte**

```svelte [Svelte]
<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';

  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
  };
  let zoom = $state(13.6);
  // The state of the map is a store. The function runs after each change of the
  // zoom, and not at the start.
  const ready = map =>
    map.state.subscribe(
      state => state.view.zoom,
      value => (zoom = value),
    );
</script>

<div use:mapJr={{description, ready}} style="height: 400px"></div>
<p>Zoom {zoom.toFixed(1)}</p>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8" />
<title>A first map</title>
<map-jr
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  center="-74.0065,40.7085"
  zoom="13.6"
  style="height: 400px"
></map-jr>
<script type="module">
  import '@map-jr/map-jr-gl/element';
</script>
```
<!-- example:first-map:end -->

The map shows the streets around City Hall, and the console or the paragraph shows the zoom when the user zooms.

- The main API and Svelte pass one object, the description ([`MapDescription`](../reference/description.md)). The
  components of Vue and React and the element set the fields of the same description as props and attributes.
- The style is `style` in the description. The components and the element name it `map-style`, and React names it
  `mapStyle`, because `style` is already an attribute of every element.
- [`map.state`](../reference/state.md#mapstate) is the state of the map. `subscribe` returns a function that stops the calls.
- In Vue, [`v-model:view`](../reference/vue.md#view) sets the view of the map and receives each new view.
  React does the same with `view` and `onViewChange`.
- The Nuxt module provides `MapJr`, `MapOverlay` and `MapImage`. See
  [The module for Nuxt](../reference/nuxt.md).
- In Svelte, the action `mapJr` creates the map, and `ready` receives the map when it is created. A new description
  for the action updates the map. See [Svelte](../reference/svelte.md).
- `<map-jr>` follows changes of its attributes. See [Attributes](../reference/element.md#attributes) for each attribute and
  its format.

## Give the container a height

The map fills its container. In the main API and the compat entry, the container is the element that you pass. The
components fill their parent element, and `<map-jr>` is the container itself.

A container with no height shows nothing. A parent that has only `min-height` gives a component a height of 0,
because a percentage height needs a parent with a set height. Set `height` on the parent, or make the parent a flex
or grid container.

## Load the library without a bundler

A page without a bundler loads the built file from a CDN in a module script. Name the version in the URL, because
the page file and the worker file must come from the same version. Replace the version in the URLs with the version that you use:
[npm](https://www.npmjs.com/package/@map-jr/map-jr-gl) shows the latest.

**Map Jr**

```html [Map Jr]
<!doctype html>
<meta charset="utf-8" />
<div id="map" style="height: 400px"></div>
<script type="module">
  const {createMap} = await import(
    'https://unpkg.com/@map-jr/map-jr-gl@0.10.0/dist/map-jr-gl.js'
  );

  createMap('map', {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
  });
</script>
```

**MapLibre**

```html [MapLibre]
<!doctype html>
<meta charset="utf-8" />
<div id="map" style="height: 400px"></div>
<script type="module">
  const cdn = 'https://unpkg.com/@map-jr/map-jr-gl@0.10.0/dist/';
  const {Map} = await import(cdn + 'map-jr-gl-maplibre-compat.js');

  new Map({
    container: 'map',
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    center: [-74.0065, 40.7085],
    zoom: 13.6,
  });
</script>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8" />
<script
  type="module"
  src="https://unpkg.com/@map-jr/map-jr-gl@0.10.0/dist/element.js"
></script>

<map-jr
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  center="-74.0065,40.7085"
  zoom="13.6"
  style="height: 400px"
></map-jr>
```

A page with a Content Security Policy needs the CDN in `script-src` and `blob:` in `worker-src`. See
[Content Security Policy](loading.md#content-security-policy) for the complete policy, and [Loading](loading.md)
for one file that contains the worker and for files on your own server.

## Show other content in a browser without WebGL2

`supported()` returns `false` in a browser that has no WebGL2. Call it before you create the map, and show other
content when it returns `false`.

```js
import {createMap, supported} from '@map-jr/map-jr-gl';

const container = document.getElementById('map');
if (supported()) {
  createMap(container, {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
  });
} else {
  container.textContent =
    'This browser cannot show the map. The office is at 1 Center Street, NYC.';
}
```

Without the check, the map reports an error to `onError` of the [description](../reference/description.md#mapdescription),
or to the console when the description has no `onError`. It also shows the text "This browser cannot show the map." in
the container. See [A browser without WebGL2](../reference/create-map.md#a-browser-without-webgl2) for how to change that text.

## See also

- [Which entry to use](which-entry.md) to choose between the main API, the compat entry and the adapters.
- [The description](../reference/description.md) for every field of `MapDescription`.
- [The main API](../reference/create-map.md) for `update`, `patch`, the state and the queries.
- [Vue and Nuxt](../reference/vue.md), [React](../reference/react.md), [Svelte](../reference/svelte.md) and [The element](../reference/element.md) for each
  adapter.
- [From MapLibre GL JS](../migrate/from-maplibre.md) to move an application to the compat entry.
- [Markers and popups](markers-and-popups.md) for the next step.
