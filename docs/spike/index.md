---
title: Spike home
description: A throwaway page of the spike for the docs site.
---

# Spike home

A marker in every form. This page has seven labels.

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl';
createMap(document.getElementById('map'), {style: 'https://styles.map-jr.org/1/elevation-zero.json'});
```

```vue [Vue]
<template><MapJr map-style="https://styles.map-jr.org/1/elevation-zero.json" /></template>
```

```vue [Nuxt]
<template><LazyMapJr map-style="https://styles.map-jr.org/1/elevation-zero.json" hydrate-on-visible /></template>
```

```jsx [React]
import {MapJr} from '@map-jr/map-jr-gl/react';
export default () => <MapJr mapStyle="https://styles.map-jr.org/1/elevation-zero.json" />;
```

```svelte [Svelte]
<div use:mapJr={{style: 'https://styles.map-jr.org/1/elevation-zero.json'}}></div>
```

```html [Element]
<map-jr map-style="https://styles.map-jr.org/1/elevation-zero.json"></map-jr>
```

```js [MapLibre compat]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';
new Map({container: 'map', style: 'https://styles.map-jr.org/1/elevation-zero.json'});
```

A paragraph between the groups.

```js [Main API]
map.update({style, view: {center: [0, 0], zoom: 2}});
```

```vue [Vue]
<MapJr :map-style="style" v-model:view="view" />
```

A single fence with no label stays as it is:

```sh
pnpm add @map-jr/map-jr-gl
```

A single fence with a label stays a single block:

```ts [nuxt.config.ts]
export default defineNuxtConfig({modules: ['@map-jr/map-jr-gl/nuxt']});
```

See [the second page](guide/second.md).
