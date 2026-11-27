<script setup>
// The map fills its parent element, so give the parent a height.
import {ref} from 'vue';
import {defaultPin} from '@map-jr/map-jr-gl';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/vue';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const pin = ref([-74.0065, 40.7085]);
const moving = ref(false);
// The default pin of Marker, as an element that the overlay shows. The tip of the pin is at the position.
const addPin = el => { if (el && !el.firstChild) el.append(defaultPin({color: '#d6453d'})); };
</script>

<template>
  <MapJr :map-style="style" :initial-view="{center: pin, zoom: 14}" :attribution="{compact: true}">
    <!-- The new position comes with dragend. The pin stays where it was dropped until lng-lat changes. -->
    <MapOverlay :lng-lat="pin" anchor="bottom" draggable @dragstart="moving = true" @dragend="p => { pin = p; moving = false; }">
      <div :ref="addPin"></div>
    </MapOverlay>
    <p class="note">{{ moving ? 'Moving' : `Pin at ${pin[0].toFixed(5)}, ${pin[1].toFixed(5)}` }}</p>
  </MapJr>
</template>
