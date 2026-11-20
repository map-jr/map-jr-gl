<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';
  import {points} from '@map-jr/map-jr-gl';

  const landings = [
    {id: 1, name: 'Whitehall Terminal', lngLat: [-74.0131, 40.7013]},
    {id: 2, name: 'Pier 11 / Wall St', lngLat: [-74.0067, 40.7034]},
    {id: 3, name: 'Battery Park City', lngLat: [-74.0181, 40.7147]},
    {id: 4, name: 'Dumbo', lngLat: [-73.9946, 40.7036]},
    {id: 5, name: 'Governors Island', lngLat: [-74.0189, 40.6928]},
    {id: 6, name: 'Corlears Hook', lngLat: [-73.9785, 40.7116]},
    {id: 7, name: 'Brooklyn Bridge Park Pier 6', lngLat: [-73.9997, 40.6930]},
  ];
  const layers = [{id: 'landings', type: 'circle', source: 'landings', paint: {'circle-radius': 7, 'circle-color': '#2f7fd1', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff'}}];

  let map = null;
  // The view before the last click, and the landing of that click.
  let last = $state.raw(null);
  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
    attribution: {compact: true},
    data: {landings: points(landings, {lngLat: l => l.lngLat, properties: l => ({name: l.name})})},
    layers,
    interactiveLayers: ['landings'],
    onClick: e => {
      const feature = e.features[0];
      if (!feature) return;
      // Store the view before the move, without `bounds`: a target with `bounds` fits that box instead.
      const {center, zoom, bearing, pitch} = map.state.get().view;
      last = {view: {center, zoom, bearing, pitch}, name: feature.properties.name};
      map.moveTo({center: feature.geometry.coordinates, zoom: 17, duration: 800});
    },
  };

  function goBack() {
    map.moveTo({...last.view, duration: 800});
    last = null;
  }
</script>

<div use:mapJr={{description, ready: instance => map = instance}} style="height: 500px"></div>
<p>{last ? `${last.name}. Press Back to return.` : 'Click a ferry landing to zoom in.'}</p>
<button disabled={!last} onclick={goBack}>Back</button>
