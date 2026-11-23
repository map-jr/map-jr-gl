<!--
  The map of a style on its page of /styles (website/build/styles.ts writes the block): the light and the dark branch side
  by side, or one map for a style that does not read `color-scheme` (`single`). Each map has `data-map-state`, which
  is "idle" when the map is drawn and ready.
-->
<script setup lang="ts">
const props = defineProps<{styleUrl: string; single?: boolean}>();
const schemes = computed(() => props.single ? ['light'] as const : ['light', 'dark'] as const);
const state = reactive<Record<string, 'loading' | 'idle' | 'error'>>({light: 'loading', dark: 'loading'});
const controls = [navigationControl()];
</script>

<template>
  <div class="my-5 grid gap-4" :class="single ? '' : 'sm:grid-cols-2'">
    <figure v-for="scheme in schemes" :key="scheme" class="min-w-0">
      <div class="border border-inverted bg-(--site-sheet) p-1">
        <div class="h-72 border border-accented" :data-map-state="state[scheme]" :data-color-scheme="scheme">
          <MapJr
            :map-style="styleUrl"
            :initial-view="homeView"
            :color-scheme="scheme"
            :controls="controls"
            cooperative-gestures
            @idle="state[scheme] = 'idle'"
            @error="state[scheme] = 'error'"
          />
        </div>
      </div>
      <figcaption v-if="!single" class="mt-1.5 figure-text text-muted">{{ scheme === 'light' ? 'Light' : 'Dark' }}: <code>colorScheme: '{{ scheme }}'</code></figcaption>
    </figure>
  </div>
</template>
