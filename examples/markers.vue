<script setup>
// The map fills its parent element, so give the parent a height.
import {shallowRef} from 'vue';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/vue';
import {points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];
const dot = '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';
const pin = '<svg viewBox="0 0 24 31"><path d="M12 30C12 30 2 19 2 11.5a10 10 0 1 1 20 0C22 19 12 30 12 30z" fill="{{color}}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="11.5" r="4" fill="#fff"/></svg>';

// 50,000 places around the center, in five colors.
const colors = ['#d6453d', '#2f7fd1', '#2e9d5b', '#8a4fd3', '#e08a1e'];
const places = Array.from({length: 50000}, (_, i) => {
  const r = Math.sqrt(Math.random()) * 0.35, a = Math.random() * 2 * Math.PI;
  return {lngLat: [NYC[0] + r * Math.cos(a) * 1.3, NYC[1] + r * Math.sin(a)], props: {color: colors[i % 5]}};
});
const some = places.slice(0, 500);

// A GeoJSON FeatureCollection with a point for each place. The properties of a point are the `props` of its place.
const pointsOf = list => points(list, {lngLat: p => p.lngLat, properties: p => p.props});
// Each key of `data` makes a GeoJSON source with that id. (A plain object, not a ref: Vue does not make 50,000 points reactive.)
const data = {rest: pointsOf(places.slice(500)), some: pointsOf(some)};
const always = {'icon-image': 'dot', 'icon-allow-overlap': true, 'icon-ignore-placement': true};
// Symbol layers draw an image at each point of a source.
const layers = [
  // Icons that are always shown: the cost of a frame does not grow with their number.
  {id: 'dots', type: 'symbol', source: 'rest', layout: always},
  // 500 of the places are pins when the zoom is 12 or more, and dots below that.
  {id: 'dots-below-pins', type: 'symbol', source: 'some', maxzoom: 12, layout: always},
  // (Without `icon-allow-overlap`, the pins do not pile up, and map labels keep clear.)
  {id: 'pins', type: 'symbol', source: 'some', minzoom: 12, layout: {'icon-image': 'pin', 'icon-anchor': 'bottom'}},
];
// A click finds the features of the layers in `interactive-layers`. The feature under the click, or null.
const selected = shallowRef(null);
</script>

<template>
  <!-- An image is an SVG template with {{slots}}. Each feature fills the slots from its properties. -->
  <MapJr
    :map-style="style"
    :initial-view="{center: NYC, zoom: 11.4}"
    :images="{dot, pin}"
    :data="data"
    :layers="layers"
    :interactive-layers="['pins', 'dots-below-pins', 'dots']"
    @click="e => selected = e.features[0] ?? null"
  >
    <MapOverlay v-if="selected" :lng-lat="selected.geometry.coordinates" :offset="[0, selected.layer.id === 'pins' ? -30 : -6]" popup @close="selected = null">
      Marker at {{ selected.geometry.coordinates.map(v => v.toFixed(3)).join(', ') }}
    </MapOverlay>
  </MapJr>
</template>
