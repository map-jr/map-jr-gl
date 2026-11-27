<script setup>
// The map fills its parent element, so give the parent a height.
import {ref} from 'vue';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/vue';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const pin = ref([-74.0065, 40.7085]);
const moving = ref(false);
</script>

<template>
  <MapJr :map-style="style" :initial-view="{center: pin, zoom: 14}" :attribution="{compact: true}">
    <!-- Without content, MapOverlay shows the default pin. The new position comes with dragend. The pin stays where it was dropped until lng-lat changes. -->
    <MapOverlay :lng-lat="pin" anchor="bottom" color="#d6453d" draggable @dragstart="moving = true" @dragend="p => { pin = p; moving = false; }"/>
    <p class="note">{{ moving ? 'Moving' : `Pin at ${pin[0].toFixed(5)}, ${pin[1].toFixed(5)}` }}</p>
  </MapJr>
</template>
