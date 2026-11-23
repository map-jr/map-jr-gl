<script setup>
// The map fills its parent element, so give the parent a height.
import {ref} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {navigation, colorScheme} from '@map-jr/map-jr-gl/controls';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const controls = [navigation(), colorScheme()];
// v-model writes the value that the button sets back into `scheme`.
const scheme = ref('auto');
</script>

<template>
  <MapJr
    :map-style="style"
    :initial-view="{center: [-74.0065, 40.7085], zoom: 13}"
    :controls="controls"
    :attribution="{compact: true}"
    v-model:color-scheme="scheme"
  >
    <p class="note">Scheme: {{ scheme }}</p>
  </MapJr>
</template>
