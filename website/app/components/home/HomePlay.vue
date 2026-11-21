<!--
  Stop 3: an editor for the description of the map (the main entry), and the map behind the page follows each change that
  parses. The editor (CodeMirror) loads when this stop is first near the screen (`near`). The code is the visitor's own
  text and runs in this page only (utils/home-scenes.ts); a mistake shows as a message below the editor.
-->
<script setup lang="ts">
import {playScene, playText, type Scene} from '~/utils/home-scenes';

defineProps<{near: boolean}>();
const emit = defineEmits<{scene: [Scene]}>();

const code = ref(playText);
const problem = ref('');
let timer: ReturnType<typeof setTimeout> | undefined;

function run() {
    try {
        emit('scene', playScene(code.value));
        problem.value = '';
    } catch (error) {
        problem.value = error instanceof Error ? error.message : String(error);
    }
}
watch(code, () => {
    clearTimeout(timer);
    timer = setTimeout(run, 400);
});
onBeforeUnmount(() => clearTimeout(timer));
defineExpose({run});
</script>

<template>
  <div>
    <h2 class="font-display text-3xl font-medium tracking-tight text-highlighted">Edit the map</h2>
    <p class="mt-3 text-toned">A map is one description. Change the <code>zoom</code>, the <code>pitch</code> or the <code>style</code> below, and the map behind the page follows. This editor takes the description of <code>@map-jr/map-jr-gl</code>.</p>
    <div class="mt-4 h-60 border border-accented bg-(--site-sheet)" data-home-editor>
      <LazyCodeEditor v-if="near" v-model="code" language="js" label="The description of the map" @run="run" />
    </div>
    <p v-if="problem" class="mt-2 font-mono text-sm text-error" role="alert">{{ problem }}</p>
    <p class="mt-3"><UButton to="/play" variant="link" trailing-icon="i-lucide-arrow-right" class="px-0">Open the playground</UButton></p>
  </div>
</template>
