# Getting started

This page shows how to install Map Jr. GL and how to show a first map with each entry and adapter. To choose between
them, see [Which entry to use](which-entry.md).

## Install the package

```sh
npm install @map-jr/map-jr-gl
```

The package has ES modules only, so load it with `import`. `require('@map-jr/map-jr-gl')` throws an error. The map
needs a browser with WebGL2, and it needs no CSS file.

## Show a map

Each example shows a street map of Lower Manhattan in an element that is 400 pixels high. The style is a URL of a
MapLibre style, here an official style of the library.

**Main API**

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl';

// The page has <div id="map" style="height: 400px"></div>.
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});

// The state of the map is a store. This function runs each time that the zoom changes.
map.state.subscribe(state => state.view.zoom, zoom => console.log(zoom));
```

**MapLibre compat**

```js [MapLibre compat]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

// The page has <div id="map" style="height: 400px"></div>.
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
    <MapJr map-style="https://styles.map-jr.org/1/elevation-zero.json" v-model:view="view" />
  </div>
  <p>Zoom {{ view.zoom.toFixed(1) }}</p>
</template>
```

**Nuxt**

```vue [Nuxt]
<!-- nuxt.config.ts has: export default defineNuxtConfig({modules: ['@map-jr/map-jr-gl/nuxt']}) -->
<script setup>
const view = ref({center: [-74.0065, 40.7085], zoom: 13.6});
</script>

<template>
  <div style="height: 400px">
    <MapJr map-style="https://styles.map-jr.org/1/elevation-zero.json" v-model:view="view" ssr />
  </div>
  <p>Zoom {{ view.zoom.toFixed(1) }}</p>
</template>
```

**React**

```jsx [React]
import {useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';

export function CityMap() {
  const [view, setView] = useState({center: [-74.0065, 40.7085], zoom: 13.6});
  return (
    <>
      <div style={{height: 400}}>
        <MapJr mapStyle="https://styles.map-jr.org/1/elevation-zero.json" view={view} onViewChange={setView} />
      </div>
      <p>Zoom {view.zoom.toFixed(1)}</p>
    </>
  );
}
```

**Svelte**

```svelte [Svelte]
<script>
  import {mapJr, mapState} from '@map-jr/map-jr-gl/svelte';

  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
  };
  let map = $state(null);
  const live = $derived(map && mapState(map));
</script>

<div use:mapJr={{description, ready: instance => map = instance}} style="height: 400px"></div>
{#if live}<p>Zoom {$live.view.zoom.toFixed(1)}</p>{/if}
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8">
<script type="module">import '@map-jr/map-jr-gl/element';</script>

<map-jr map-style="https://styles.map-jr.org/1/elevation-zero.json" center="-74.0065,40.7085" zoom="13.6"
        style="height: 400px"></map-jr>
```

The map shows the streets around City Hall, and the console or the paragraph shows the zoom when the user zooms.

- The style is `style` in the main API and in the compat entry, and `map-style` (`mapStyle` in React) in the
  adapters and the element, because `style` is already an attribute of every element.
- The main API and Svelte pass one object, the description ([`MapDescription`](../reference/description.md)). The
  components and the element set the fields of the same description as props and attributes.
- In Nuxt, the module registers `MapJr`, so the page has no imports. With `ssr`, the server renders the first view into the page, and the map takes over in the browser. See
  [The module for Nuxt](../vue.md#the-module-for-nuxt).
- In Svelte, the action `mapJr` creates the map, and `ready` receives the map for its methods. See
  [Svelte](../svelte.md).

## Give the container a height

The map fills its container. In the main API and the compat entry, the container is the element that you pass. The
components fill their parent element, and `<map-jr>` is the container itself.

A container with no height shows nothing. A parent that has only `min-height` gives a component a height of 0,
because a percentage height needs a parent with a set height. Set `height` on the parent, or make the parent a flex
or grid container. The [development build](../api.md#change-the-map) warns once when the container has a height of 0
one second after the map was created.

## Load the library without a bundler

A page without a bundler loads the built file from a CDN in a module script. Name the version in the URL, because
the page file and the worker file must come from the same version.

**Main API**

```html [Main API]
<!doctype html>
<meta charset="utf-8">
<div id="map" style="height: 400px"></div>
<script type="module">
  import {createMap} from 'https://unpkg.com/@map-jr/map-jr-gl@0.9.0/dist/map-jr-gl.js';

  createMap('map', {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
  });
</script>
```

**MapLibre compat**

```html [MapLibre compat]
<!doctype html>
<meta charset="utf-8">
<div id="map" style="height: 400px"></div>
<script type="module">
  import {Map} from 'https://unpkg.com/@map-jr/map-jr-gl@0.9.0/dist/map-jr-gl-maplibre-compat.js';

  new Map({container: 'map', style: 'https://styles.map-jr.org/1/elevation-zero.json', center: [-74.0065, 40.7085], zoom: 13.6});
</script>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8">
<script type="module" src="https://unpkg.com/@map-jr/map-jr-gl@0.9.0/dist/element.js"></script>

<map-jr map-style="https://styles.map-jr.org/1/elevation-zero.json" center="-74.0065,40.7085" zoom="13.6"
        style="height: 400px"></map-jr>
```

The library starts its worker from the same CDN with no setting. A page with a Content Security Policy needs
`worker-src blob:`. See [Loading](../loading.md) for the policy, for one file that contains the worker, and for files on
your own server.

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
  container.textContent = 'This browser cannot show the map. The office is at 1 Centre Street, New York.';
}
```

Without the check, the map reports an error to `onError` and shows the text "This browser cannot show the map." in
the container. See [A browser without WebGL2](../api.md#a-browser-without-webgl2) for how to change that text.

## See also

- [Which entry to use](which-entry.md) to choose between the main API, the compat entry and the adapters.
- [The description](../reference/description.md) for every field of `MapDescription`.
- [The main API](../api.md) for `update`, `patch`, the state and the queries.
- [Vue and Nuxt](../vue.md), [React](../react.md), [Svelte](../svelte.md) and [The element](../element.md) for each
  adapter.
- [From MapLibre GL JS](../migrate/from-maplibre.md) to move an application to the compat entry.
- [Markers and popups](markers-and-popups.md) for the next step.
