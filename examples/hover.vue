<script setup>
import {ref} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const landings = [
  {id: 1, name: 'Whitehall Terminal', lngLat: [-74.0131, 40.7013]},
  {id: 2, name: 'Pier 11 / Wall St', lngLat: [-74.0067, 40.7034]},
  {id: 3, name: 'Battery Park City', lngLat: [-74.0181, 40.7147]},
  {id: 4, name: 'Dumbo', lngLat: [-73.9946, 40.7036]},
  {id: 5, name: 'Governors Island', lngLat: [-74.0189, 40.6928]},
  {id: 6, name: 'Corlears Hook', lngLat: [-73.9785, 40.7116]},
  {id: 7, name: 'Brooklyn Bridge Park Pier 6', lngLat: [-73.9997, 40.6930]},
];
// The map can set the state `hover` only on a feature that has an id. `points` takes it from `id`.
const data = {landings: points(landings, {lngLat: l => l.lngLat, id: l => l.id, properties: l => ({name: l.name})})};
// The layer reads the state `hover` with `feature-state`: the landing under the pointer is larger and red.
const hovered = ['boolean', ['feature-state', 'hover'], false];
const layers = [{
  id: 'landings', type: 'circle', source: 'landings',
  paint: {
    'circle-radius': ['case', hovered, 11, 7],
    'circle-color': ['case', hovered, '#d6453d', '#2f7fd1'],
    'circle-stroke-width': 2, 'circle-stroke-color': '#fff',
  },
}];
// The features under the pointer, from the event `hover`.
const hover = ref([]);
</script>

<template>
  <!-- With `hover-state`, the map gives the top feature of `interactive-layers` under the pointer the feature state
       `hover: true`, and removes it when the pointer leaves the feature. -->
  <MapJr :map-style="style" :initial-view="{center: NYC, zoom: 13.6}" :data="data" :layers="layers" :interactive-layers="['landings']" hover-state
    :attribution="{compact: true}" @hover="hover = $event" />
  <p>{{ hover[0]?.properties.name ?? 'Move the pointer over a ferry landing.' }}</p>
</template>
