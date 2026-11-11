<script setup>
import {MapJr} from 'map-jr-gl/vue';
import {navigation, scale, fullscreen} from 'map-jr-gl/controls';
import {style, NYC} from './shared.js';
</script>

<template>
  <MapJr
    :map-style="style"
    :initial-view="{center: NYC, zoom: 13.6}"
    :controls="[navigation(), scale({position: 'bottom-left'}), fullscreen({position: 'top-left'})]"
    :attribution="{compact: true}"
    v-slot="{state}"
  >
    <p class="note">{{ state?.renderer ? `${state.renderer} rendering` : 'Starting' }}</p>
  </MapJr>
</template>
