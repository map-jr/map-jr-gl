# Which entry to use

Map Jr. GL has two APIs for the same map: the main API, in which one object states what the map shows, and the
compat entry, which has the API of MapLibre GL JS. The adapters for Vue, Nuxt, React and Svelte and the element
`<map-jr>` are built on the main API. This page helps you choose one.

| You have | Use | Import from |
|---|---|---|
| A new application in plain JavaScript or TypeScript | The main API | `@map-jr/map-jr-gl` |
| An application with Vue or Nuxt | The Vue component `MapJr` | `@map-jr/map-jr-gl/vue`, and the module `@map-jr/map-jr-gl/nuxt` |
| An application with React | The React component `MapJr` | `@map-jr/map-jr-gl/react` |
| An application with Svelte | The action `mapJr` | `@map-jr/map-jr-gl/svelte` |
| Plain HTML, a CMS, or a framework with no adapter (Angular, Lit, Solid) | The element `<map-jr>` | `@map-jr/map-jr-gl/element` |
| Code or plugins written for MapLibre GL JS | The compat entry | `@map-jr/map-jr-gl/maplibre-compat` |

Use the main API or its adapter when you start a new application. Use the compat entry when you have code or a plugin
for MapLibre GL JS that you want to keep.

## The main API and its adapters

The description ([`MapDescription`](../reference/description.md)) is one object that states everything that a map
shows: the style, the data, the view and the controls. [`createMap`](../api.md#make-a-map) creates a map from a
description. To change the map, pass a new description to [`update`](../api.md#change-the-map), and the map applies
what is different. The state of the map, such as the view and the feature under the pointer, is a store that your
code can subscribe to.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});

function showRelief() {
  // A new description in place of the old one. The map changes only the style.
  map.update({...map.description, style: 'https://styles.map-jr.org/1/elevation.json'});
}
```

The adapters set the fields of the description from props or attributes, so a framework re-renders the map as it
re-renders the rest of the page. A component of Vue or React and the element `<map-jr>` have the same fields as the
description, with the names of props and attributes (`map-style` for `style`). New features reach this API first.

| Adapter | Form | Server rendering of the first view |
|---|---|---|
| [Vue and Nuxt](../vue.md) | Components `MapJr`, `MapOverlay` and `MapImage`, and composables | The `ssr` prop |
| [React](../react.md) | Components `MapJr`, `MapOverlay` and `MapImage`, and hooks | The `firstView` prop, from `renderFirstView` of `@map-jr/map-jr-gl/server` |
| [Svelte](../svelte.md) | The action `mapJr` and the store `mapState` | `renderFirstView` of `@map-jr/map-jr-gl/server` |
| [The element](../element.md) | The custom element `<map-jr>` | `renderElement` of `@map-jr/map-jr-gl/server` |

## The compat entry

`@map-jr/map-jr-gl/maplibre-compat` has the API of MapLibre GL JS 6: `new Map({...})`, `map.on(...)`,
`map.addLayer(...)`, the controls, `Marker` and `Popup`. Code and plugins for MapLibre GL JS run with a change of the
import. The calls that differ, such as queries that return a promise, are listed in
[From MapLibre GL JS](../migrate/from-maplibre.md).

```js
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({container: 'map', style: 'https://styles.map-jr.org/1/elevation-zero.json', center: [-74.0065, 40.7085], zoom: 13.6});

map.on('load', () => {
  map.addSource('office', {type: 'geojson', data: {type: 'Point', coordinates: [-74.0065, 40.7085]}});
  map.addLayer({id: 'office', type: 'circle', source: 'office', paint: {'circle-radius': 8, 'circle-color': '#d6453d'}});
});
```

A wrapper of MapLibre GL JS for a framework, such as react-map-gl 8, works with the compat entry through an alias of
the module name `maplibre-gl`. See [MapLibre compatibility](../maplibre-compatibility.md) for the alias and for the
differences in behaviour.

## Use both entries in one application

Both entries draw with the same renderer and read the same styles, so one application can use the compat entry for
old pages and the main API for new pages. A map belongs to one entry: a map of `createMap` has no `addLayer`, and a
`new Map` has no `update`. In the main API, a layer is added with
[`layers`](../reference/description.md#layers) of the description.

## See also

- [Getting started](getting-started.md) to install the package and show a first map in each variant.
- [The description](../reference/description.md) for every field of `MapDescription`.
- [The main API](../api.md) for `update`, `patch`, the state and the queries.
- [From MapLibre GL JS](../migrate/from-maplibre.md) for the steps to move an application to the compat entry.
