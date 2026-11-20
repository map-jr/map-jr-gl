<script setup>
import {ref} from 'vue';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/vue';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
// The outline of the pin.
const pinPath = 'M13.5 0C6 0 0 6 0 13.5 0 23 13.5 41 13.5 41S27 23 27 13.5C27 6 21 0 13.5 0z';
const pin = ref([-74.0065, 40.7085]);
const moving = ref(false);
</script>

<template>
  <MapJr :map-style="style" :initial-view="{center: pin, zoom: 14}" :attribution="{compact: true}">
    <!-- The new position comes with dragend. The pin stays where it was dropped until lng-lat changes. -->
    <MapOverlay :lng-lat="pin" anchor="bottom" draggable @dragstart="moving = true" @dragend="p => { pin = p; moving = false; }">
      <svg width="27" height="41" viewBox="0 0 27 41"><path :d="pinPath" fill="#d6453d"/><circle cx="13.5" cy="13.5" r="5.5" fill="#fff"/></svg>
    </MapOverlay>
    <p class="note">{{ moving ? 'Moving' : `Pin at ${pin[0].toFixed(5)}, ${pin[1].toFixed(5)}` }}</p>
  </MapJr>
</template>
