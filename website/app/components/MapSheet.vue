<!--
  The live map of the home page, framed as a map sheet: a double border, the coordinates of the north-west corner and
  the zoom above it, and the centre and the south-east corner below it. `data-map-state` is "idle" when the map is drawn and ready (the checks read it).
-->
<script setup lang="ts">
const colorMode = useColorMode();
const view = useHomeView();
const state = ref<'loading' | 'idle' | 'error'>('loading');
const bounds = ref<[[number, number], [number, number]]>();
const controls = [navigationControl(), scaleControl()];

type View = {center: [number, number]; zoom: number; bounds: [[number, number], [number, number]]};
function onView(next: View) {
    view.value = {center: next.center, zoom: next.zoom};
    bounds.value = next.bounds;
}
</script>

<template>
  <figure class="min-w-0">
    <div class="mb-1.5 flex justify-between gap-4 figure-text text-muted whitespace-pre" aria-hidden="true">
      <span>{{ bounds ? formatCoordinates([bounds[0][0], bounds[1][1]]) : ' ' }}</span>
      <span>zoom {{ view.zoom.toFixed(1) }}</span>
    </div>
    <div class="border border-inverted bg-(--site-sheet) p-1">
      <div class="h-88 sm:h-112 border border-accented" :data-map-state="state">
        <MapJr
          map-style="https://styles.map-jr.org/1/elevation-zero.json"
          :initial-view="homeView"
          :color-scheme="colorMode.value === 'dark' ? 'dark' : 'light'"
          :controls="controls"
          cooperative-gestures
          @update:view="onView"
          @idle="state = 'idle'"
          @error="state = 'error'"
        />
      </div>
    </div>
    <figcaption class="mt-1.5 flex flex-wrap justify-between gap-x-4 figure-text text-muted whitespace-pre">
      <span class="hidden sm:inline">centre {{ formatCoordinates(view.center) }}</span>
      <span class="ms-auto" aria-hidden="true">{{ bounds ? formatCoordinates([bounds[1][0], bounds[0][1]]) : ' ' }}</span>
    </figcaption>
  </figure>
</template>
