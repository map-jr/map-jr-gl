<!--
  Stop 4: four places that show what the library draws. A button flies the map behind the page to a place and changes its
  description; each place has a link to its recipe. The scenes are in utils/home-scenes.ts. `show()` sends the chosen
  scene, for the moment that the stop becomes the active one.
-->
<script setup lang="ts">
import {showcases, type Scene} from '~/utils/home-scenes';

const emit = defineEmits<{scene: [Scene]}>();
const chosen = ref(showcases[0]!.id);
const current = computed(() => showcases.find(item => item.id === chosen.value)!);
const choose = (id: string) => { chosen.value = id; emit('scene', current.value.scene()); };
defineExpose({show: () => emit('scene', current.value.scene())});
</script>

<template>
  <div>
    <h2 class="font-display text-3xl font-medium tracking-tight text-highlighted">Four maps that are hard to make small</h2>
    <div class="mt-4 flex flex-wrap gap-2" role="group" aria-label="Places">
      <UButton v-for="item in showcases" :key="item.id" size="sm" color="neutral" :variant="chosen === item.id ? 'solid' : 'outline'" :aria-pressed="chosen === item.id" :data-showcase="item.id" @click="choose(item.id)">{{ item.label }}</UButton>
    </div>
    <p class="mt-4 text-toned">{{ current.caption }}</p>
    <p class="mt-3"><UButton :to="current.link" variant="link" trailing-icon="i-lucide-arrow-right" class="px-0">{{ current.linkLabel }}</UButton></p>
  </div>
</template>
