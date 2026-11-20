<script>
  import {mapJr, mapState} from '@map-jr/map-jr-gl/svelte';
  import {points} from '@map-jr/map-jr-gl';

  const NYC = [-74.0065, 40.7085];
  const dot = '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';
  const places = [[-74.0134, 40.7033], [-74.009, 40.7061], [-74.006, 40.7127], [-73.9969, 40.7061]];
  // A symbol layer that draws the image at each point of the source "pins".
  const pinLayer = {id: 'pins', type: 'symbol', source: 'pins', layout: {'icon-image': 'dot', 'icon-allow-overlap': true, 'icon-ignore-placement': true}};

  // (`$state.raw`: the map gets the view object itself, not a proxy of it.)
  let view = $state.raw({center: NYC, zoom: 13.6, bearing: 0, pitch: 0});
  let shown = $state(false);
  // A key of `data` makes a GeoJSON source with that id. The data is compared by identity: $derived keeps the
  // object until `shown` changes.
  const pins = $derived(points(shown ? places : [], {lngLat: p => p, properties: () => ({color: '#d6453d'})}));
  // A change is a new description. The map finds what is different.
  const description = $derived({
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    view,
    onViewChange: next => view = next,
    // The image of the markers: an SVG template, 14 pixels wide and high.
    images: {dot: {image: dot, width: 14, height: 14}},
    data: {pins},
    layers: [pinLayer],
    interactiveLayers: ['park', 'water'],
    attribution: {compact: true},
  });
  let map = $state(null);
  // The state of the map as a store: `$live.hover` has the features under the pointer.
  const live = $derived(map && mapState(map));
</script>

<div use:mapJr={{description, ready: instance => map = instance}} style="height: 500px"></div>
<p>zoom {view.zoom.toFixed(2)} · under the pointer: {$live?.hover[0]?.layer.id ?? 'nothing'}</p>
<button onclick={() => shown = !shown}>{shown ? 'Remove markers' : 'Add markers'}</button>
<button onclick={() => view = {...view, pitch: view.pitch ? 0 : 50}}>Tilt</button>
