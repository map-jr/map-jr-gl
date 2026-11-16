# Svelte

The entry `@map-jr/map-jr-gl/svelte` has an action and a store for [the main API](api.md). They do not need the Svelte
package, so they work with each version of Svelte.

```svelte
<script>
  import {mapJr, mapState} from '@map-jr/map-jr-gl/svelte';
  import {navigation} from '@map-jr/map-jr-gl/controls';
  import {points} from '@map-jr/map-jr-gl';

  let {places} = $props();
  let map = $state(null);
  const dot = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="{{color}}"/></svg>';
  // A point for each place: its properties are the place, so the slot {{color}} gets its colour.
  const pins = $derived(points(places, {lngLat: p => p.lngLat}));
  const description = $derived({
    style: 'https://tiles.openfreemap.org/styles/liberty',
    initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
    images: {dot},
    data: {places: pins},
    layers: [{id: 'places', type: 'symbol', source: 'places', layout: {'icon-image': 'dot', 'icon-allow-overlap': true}}],
    controls: [navigation()],
  });
  const live = $derived(map && mapState(map));
</script>

<div use:mapJr={{description, ready: instance => map = instance}} style="height: 400px"></div>
{#if live}<p>Zoom {$live.view.zoom.toFixed(1)}</p>{/if}
```

- `mapJr` is an action. It makes the map in the element, gives the map each new description, and removes the map
  with the element.
- `ready` gets the map (for `queryFeatures`, `moveTo`, `overlay`). For an element that the user moves, call
  `map.overlay(element, {lngLat, draggable: true, onDragEnd})`; `defaultPin()` of `@map-jr/map-jr-gl` makes the default
  pin of `Marker`. See [Elements of the page on the map](api.md#elements-of-the-page-on-the-map).
- `mapState(map)` is a store with the state of the map.
- `$live.view.bounds` is the visible box, `[[west, south], [east, north]]`, for loading data for the visible area.
  `initialView` can be a box too: `{bounds, padding}`. See [the main API](api.md).
- For an event of the map, call `map.listen(type, fn)` on the map that `ready` gives. See [Events](api.md#events).
- The description is the description of [the main API](api.md). A part that is made again with the same content
  does no work. The values of `data` are compared by identity: `$derived` keeps them until their inputs change.
- The control `colorScheme()` of `@map-jr/map-jr-gl/controls` changes `colorScheme` of the map and calls
  `onColorSchemeChange` of the description with the new value. Keep the value in your state and put it in the
  description, or the next description sets the old value again.
- `transformRequest` in the description changes each request of the map, also those of the tile workers. The map
  calls the function of the last description.

There is no component for Svelte, and no server rendering in this entry yet. On a server, call `renderFirstView`
from `@map-jr/map-jr-gl/server` and put the HTML into the element (`{@html firstView}`): the map takes it over. This is not
tested with SvelteKit.
