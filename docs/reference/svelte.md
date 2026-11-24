# The Svelte action and store

The entry `@map-jr/map-jr-gl/svelte` creates a map of `@map-jr/map-jr-gl` in a Svelte page. `mapJr` is an action
that creates the map in an element from a [description](description.md), and `mapState` returns the
[state of the map](state.md#mapstate) as a Svelte store. The entry does not import Svelte and has no component. The
examples on this page use the runes of Svelte 5 (`$state`, `$derived`, `$props`).

```svelte
<script>
  import {mapJr, mapState} from '@map-jr/map-jr-gl/svelte';
  import {navigation} from '@map-jr/map-jr-gl/controls';

  let map = $state(null);
  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
    controls: [navigation()],
  };
  const live = $derived(map && mapState(map));
</script>

<div
  use:mapJr={{description, ready: instance => (map = instance)}}
  style="height: 400px"
></div>
{#if live}<p>Zoom {$live.view.zoom.toFixed(1)}</p>{/if}
```

## `mapJr`

```ts
mapJr(
  node: HTMLElement,
  options: MapAction,
): {update(options: MapAction): void; destroy(): void}
```

Creates a map in `node` with `options.description`, and calls `options.ready` with the map. Write it as
`use:mapJr={options}` on the element that contains the map, and give that element a height.

<!-- ref:SvelteMapAction:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `description` **required** | [`MapDescription`](description.md#mapdescription) | | The description of the map. |
| `ready` | `(map: `[`MapInstance`](map.md#mapinstance)`) => void` | | Called with the map once it is created. |
<!-- ref:SvelteMapAction:end -->

When the value of `use:mapJr` changes, Svelte calls `update`, and the map applies `description` as
[`update`](map.md#update) of the main API does. To change the map, pass a new description object, for
example from `$derived`, as in the example below. The map then applies what is different. A new object or
list with the same content does no work, and the map compares each value of [`data`](description.md#data) by
identity. `update` reads `description` only: a new `ready` is not called. When the element is removed, the map is
destroyed.

`ready` is the only way to reach the map, a [`MapInstance`](map.md#mapinstance) of the main API. Call its methods there:
`map.listen(type, fn)` for an event of the map ([Events](events.md#mapevents)), and `map.overlay(element, options)`
for a marker or a popup ([Elements of the page on the map](map.md#overlay)).

```svelte
<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';

  let stations = $state([
    [-74.0065, 40.7085],
    [-73.9857, 40.7484],
  ]);
  // A new object when `stations` changes, so the action passes it to the map.
  const description = $derived({
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-73.996, 40.73], zoom: 11.5},
    data: {
      stations: {
        type: 'FeatureCollection',
        features: stations.map(c => ({
          type: 'Feature',
          properties: {},
          geometry: {type: 'Point', coordinates: c},
        })),
      },
    },
    layers: [
      {
        id: 'stations',
        type: 'circle',
        source: 'stations',
        paint: {'circle-radius': 6, 'circle-color': '#d6453d'},
      },
    ],
  });

  function ready(map) {
    map.listen('moveend', () => console.log(map.state.get().view.center));
  }
</script>

<div use:mapJr={{description, ready}} style="height: 400px"></div>
```

The control `colorScheme()` of `@map-jr/map-jr-gl/controls` calls
[`onColorSchemeChange`](description.md#colorscheme-and-oncolorschemechange) of the description. Keep the value in
state and pass it back as `colorScheme`, or the next description sets the old value again.

The control [`terrain()`](controls.md#terrain) calls its option `onTerrainChange` with the new `terrain` after a click.
Keep that value in state and pass it back as `terrain` of the description, or the next description overrides the
click.

## `mapState`

```ts
mapState(map: MapInstance): {
  subscribe(fn: (state: MapState) => void): () => void;
}
```

Returns the state of `map` as a readable Svelte store. `subscribe` calls `fn` at once with the state, and again
after each change. In a component, read it with `$`: `$live.view.zoom`.

| Parameter | Type | Description |
|---|---|---|
| `map` | `MapInstance` | The map that `ready` receives. |

**Returns** a store of `MapState`.

## A first view from the server

The entry has no option for server rendering. [`renderFirstView`](server.md#renderfirstview) of
`@map-jr/map-jr-gl/server` returns the HTML of a first view, and [Server rendering](../guide/server-rendering.md)
shows how a page uses it.

## See also

- [The description](description.md) for every field of `description`.
- [The state](state.md#mapstate) for the members of the store of `mapState`.
