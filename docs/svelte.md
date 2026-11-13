# Svelte

The entry `@map-jr/map-jr-gl/svelte` has an action and a store for [the main API](api.md). They do not need the Svelte
package, so they work with each version of Svelte.

```svelte
<script>
  import {mapJr, mapState} from '@map-jr/map-jr-gl/svelte';
  import {navigation} from '@map-jr/map-jr-gl/controls';

  let {places} = $props();
  let map = $state(null);
  const pins = $derived({
    id: 'places',
    svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="{{color}}"/></svg>',
    width: 24, height: 24,
    data: places.map(p => ({lngLat: p.lngLat, props: {color: p.color}})),
  });
  const description = $derived({
    style: 'https://tiles.openfreemap.org/styles/liberty',
    initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
    markers: [pins],
    controls: [navigation()],
  });
  const live = $derived(map && mapState(map));
</script>

<div use:mapJr={{description, ready: host => map = host}} style="height: 400px"></div>
{#if live}<p>Zoom {$live.view.zoom.toFixed(1)}</p>{/if}
```

- `mapJr` is an action. It makes the map in the element, gives the map each new description, and removes the map
  with the element.
- `ready` gets the map (for `queryFeatures`, `moveTo`, `overlay`).
- `mapState(map)` is a store with the state of the map.
- The description is the description of [the main API](api.md). A part that is made again with the same content
  does no work. Marker data and the values of `data` are compared by identity: `$derived` keeps them until their
  inputs change.

There is no component for Svelte, and no server rendering in this entry yet. On a server, call `renderFirstView`
from `@map-jr/map-jr-gl/server` and put the HTML into the element (`{@html firstView}`): the map takes it over. This is not
tested with SvelteKit.
