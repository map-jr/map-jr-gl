<script setup>
import {shallowRef} from 'vue';
import {MapJr, MapOverlay} from 'map-jr-gl/vue';
import {style, NYC} from './shared.js';
import {manyMarkers, dot, pin} from '../../demo/markers.mjs';

// shallowRef: Vue does not make 50,000 markers reactive. To change them, give a new array.
const places = shallowRef(manyMarkers(50000, NYC, 0.35).data);
const some = shallowRef(places.value.slice(0, 500));
const selected = shallowRef(null);
const map = shallowRef(null);

// The click on a marker is an event of the map.
function started() {
  map.value.host.listen('markerclick', e => { selected.value = e.marker; });
}
</script>

<template>
  <MapJr
    ref="map"
    :map-style="style"
    :initial-view="{center: NYC, zoom: 11.4}"
    :markers="[
      {id: 'dots', svg: dot, width: 12, height: 12, anchor: 'center', data: places.slice(500)},
      {id: 'dots-below-pins', svg: dot, width: 12, height: 12, anchor: 'center', maxZoom: 12, data: some},
      {id: 'pins', svg: pin, width: 24, height: 31, anchor: 'bottom', minZoom: 12, overlap: 'hide', collide: true, data: some},
    ]"
    @load="started"
  >
    <MapOverlay v-if="selected" :lng-lat="selected.lngLat" :offset="[0, -30]" popup @close="selected = null">
      Marker at {{ selected.lngLat.map(v => v.toFixed(3)).join(', ') }}
    </MapOverlay>
  </MapJr>
</template>
