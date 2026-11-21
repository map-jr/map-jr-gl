<!--
  The one live map of the home page (pages/index.vue). It fills the stage behind the text. The first paint is the SVG
  of the server renderer (`ssr`), and the map takes over when it has loaded. The map takes no pointer, wheel or key until
  `exploring` is true: the wrapper is `inert` before that, so the page scrolls over it.

  A new `scene` changes the props of the map, and the camera moves to the camera of the scene: a flight, or a cut when
  the system asks for reduced motion. `data-map-state` is "idle" when the map is drawn and ready, "error" when it
  cannot be shown (the SVG stays), and the checks read it.

  When the map is idle, the component sends `measure`: the time from the load of the page to idle, and the bytes of the
  scripts that the browser fetched from the moment that this component mounted. The page script of the map and the
  worker file are among them.
-->
<script setup lang="ts">
import type {MapJrExposed} from '@map-jr/map-jr-gl/vue';
import type {Scene} from '~/utils/home-scenes';

const props = defineProps<{scene: Scene; exploring: boolean}>();
const emit = defineEmits<{measure: [{idleMs: number; bytes: number; files: number}]; state: [string]}>();

const colorMode = useColorMode();
const view = useHomeView();
const state = ref<'loading' | 'idle' | 'error'>('loading');
const map = useTemplateRef<MapJrExposed>('map');
const controls = [navigationControl(), scaleControl()];
// The camera of the first scene is the first view of the map, and a later scene moves the camera.
const first = props.scene.camera;
let ready = false;
let mountedAt = 0;
let measured = false;
// How the last move went, "fly" or "cut" (the checks read it).
const how = ref('');

watch(state, value => emit('state', value));

function move(camera: Scene['camera']) {
    if (!ready || !map.value) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = {center: camera.center, zoom: camera.zoom, bearing: camera.bearing ?? 0, pitch: camera.pitch ?? 0};
    // A cut for a reader who prefers reduced motion. (The library also jumps then.)
    how.value = reduced ? 'cut' : 'fly';
    map.value.moveTo(reduced ? target : {...target, fly: {maxDuration: 5000}});
}
watch(() => props.scene, scene => move(scene.camera));

function onLoad() {
    ready = true;
    move(props.scene.camera);
}

function onIdle() {
    state.value = 'idle';
    if (measured) return;
    measured = true;
    const scripts = performance.getEntriesByType('resource').filter(entry => entry.startTime >= mountedAt - 1 && new URL(entry.name, location.href).pathname.endsWith('.js')) as PerformanceResourceTiming[];
    const bytes = scripts.reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize), 0);
    emit('measure', {idleMs: Math.round(performance.now()), bytes, files: scripts.length});
}

// Without WebGL 2 the map cannot start, and the library would replace the first paint with a message. The page keeps the
// SVG: it moves the nodes of the server render out of the map, and the live map is not made.
const holder = useTemplateRef<HTMLElement>('holder');
const unsupported = ref(false);
function hasWebGL2() {
    try {
        const gl = document.createElement('canvas').getContext('webgl2');
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
        return !!gl;
    } catch { return false; }
}
onMounted(() => {
    mountedAt = performance.now();
    if (hasWebGL2()) return;
    holder.value?.append(...document.querySelectorAll('[data-home-map] [data-map-jr-ssr]'));
    unsupported.value = true;
    state.value = 'error';
});
type View = {center: [number, number]; zoom: number};
const onView = (next: View) => { view.value = {center: next.center, zoom: next.zoom}; };
</script>

<template>
  <div class="absolute inset-0" :class="exploring ? '' : 'pointer-events-none'" :inert="!exploring" data-home-map :data-map-state="state" :data-camera="how">
    <div ref="holder" class="absolute inset-0 overflow-hidden" />
    <p v-if="unsupported" class="absolute inset-x-0 top-3 mx-auto w-fit max-w-[90%] border border-accented bg-default/90 px-3 py-1 text-center text-sm text-muted">This browser has no WebGL 2, so the map is a still picture.</p>
    <MapJr
      v-if="!unsupported"
      ref="map"
      v-bind="scene.props"
      :initial-view="first"
      :ssr="{width: 1280, height: 800, requestTimeout: 30000, timeout: 120000}"
      :color-scheme="colorMode.value === 'dark' ? 'dark' : 'light'"
      :controls="controls"
      @update:view="onView"
      @load="onLoad"
      @idle="onIdle"
      @error="state = 'error'"
    />
  </div>
</template>
