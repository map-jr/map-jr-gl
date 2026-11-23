<!--
  The one live map of the home page (pages/index.vue). It fills the stage behind the text. The first paint is the SVG
  of the server renderer from a file of the repository, and the map takes over when it has loaded. The map takes no pointer, wheel or key until
  `exploring` is true: the wrapper is `inert` before that, so the page scrolls over it.

  A new `scene` changes the props of the map, and the camera moves to the camera of the scene: a flight, or a cut when
  the system asks for reduced motion. `data-map-state` is "idle" when the map is drawn and ready, "error" when it
  cannot be shown (the SVG stays), and the checks read it.

  When the map is idle, the component sends `measure`: the time from the load of the page to idle, and the size of the
  files of the library that the browser fetched: its chunks (the page script) and the worker file, each counted once.
-->
<script setup lang="ts">
import type {MapJrExposed} from '@map-jr/map-jr-gl/vue';
import type {Scene} from '~/utils/home-scenes';
// The first paint: a render of the first scene by the server renderer, written by scripts/first-paint.mjs. It is a file of
// the repository, so the build needs no network (#1391).
import firstPaint from '~/assets/home-first-paint.html?raw';

// Windows up to 1000 px wide and 1060 px high have a stage of at most 1000 by 1000 and take the inline SVG of 1000 by 1000. Other
// windows take the SVG of 2560 by 1600 from public/, which starts to load with the HTML only for them (scripts/first-paint.mjs).
const small = '(max-width: 1000px) and (max-height: 1060px)';
// The dark pictures load only on a page with the class `dark` on <html>, which the color mode of the site sets in the head before the
// first paint. A preload cannot read the class, so it follows `prefers-color-scheme`, which is the color mode unless the visitor has
// stored the other one: then the picture loads when the style sheet applies, a little later.
const wideMedia = (scheme: string) => `((width > 1000px) or (height > 1060px)) and (prefers-color-scheme: ${scheme})`;
useHead({link: [
    {rel: 'preload', as: 'image', href: '/home-first-paint-wide.svg', media: wideMedia('light')},
    {rel: 'preload', as: 'image', href: '/home-first-paint-wide-dark.svg', media: wideMedia('dark')},
    {rel: 'preload', as: 'image', href: '/home-first-paint-dark.svg', media: `${small} and (prefers-color-scheme: dark)`},
]});

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

// The checks read the map through the element (`__homeMap`) to compare its places with those of the first paint.
const root = useTemplateRef<HTMLElement & {__homeMap?: unknown}>('root');
function onLoad() {
    ready = true;
    if (root.value) root.value.__homeMap = map.value;
    // The map is at its first view already. A flight here would show a half-drawn map under the first paint.
    const now = props.scene.camera;
    if (now.center[0] === first.center[0] && now.center[1] === first.center[1] && now.zoom === first.zoom && (now.bearing ?? 0) === (first.bearing ?? 0) && (now.pitch ?? 0) === (first.pitch ?? 0)) return;
    move(now);
}

function onIdle() {
    state.value = 'idle';
    // The first paint covers the map and its controls until the map has drawn its first view. It goes in the same frame
    // as the idle state, so the map and the controls show together (#1416).
    showFirst.value = false;
    if (measured) return;
    measured = true;
    // The files of the library: the chunks of the build that keep "map-jr-gl" in their names (nuxt.config.ts) and the worker
    // file. A file is counted once, also when the browser lists it twice (a preload and an import). The number is the
    // size of the body as the server sent it (`encodedBodySize`): gzip on a server that compresses.
    const scripts = new Map<string, number>();
    for (const entry of performance.getEntriesByType('resource') as PerformanceResourceTiming[]) {
        const path = new URL(entry.name, location.href).pathname;
        if (path.startsWith('/_nuxt/map-jr-gl') && path.endsWith('.js')) scripts.set(path, entry.encodedBodySize);
    }
    const bytes = [...scripts.values()].reduce((sum, size) => sum + size, 0);
    emit('measure', {idleMs: Math.round(performance.now()), bytes, files: scripts.size});
}

// Without WebGL 2 the map cannot start, and the library would show a message. The first paint is outside of the map and stays,
// and the live map is not made.
const showFirst = ref(true);
const unsupported = ref(false);
function hasWebGL2() {
    try {
        const gl = document.createElement('canvas').getContext('webgl2');
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
        return !!gl;
    } catch { return false; }
}
onMounted(() => {
    if (hasWebGL2()) return;
    unsupported.value = true;
    state.value = 'error';
});
type View = {center: [number, number]; zoom: number};
const onView = (next: View) => { view.value = {center: next.center, zoom: next.zoom}; };
</script>

<template>
  <div ref="root" class="absolute inset-0" :class="exploring ? '' : 'pointer-events-none'" :inert="!exploring" data-home-map :data-map-state="state" :data-camera="how">
    <p v-if="unsupported" class="absolute inset-x-0 top-3 mx-auto w-fit max-w-[90%] border border-accented bg-default/90 px-3 py-1 text-center text-sm text-muted">This browser has no WebGL 2, so the map is a still picture.</p>
    <MapJr
      v-if="!unsupported"
      ref="map"
      v-bind="scene.props"
      :initial-view="first"
      :color-scheme="colorMode.value === 'dark' ? 'dark' : 'light'"
      :controls="controls"
      @update:view="onView"
      @load="onLoad"
      @idle="onIdle"
      @error="state = 'error'"
    />
    <!-- eslint-disable-next-line vue/no-v-html -- a file of the repository, not input -->
    <div v-if="showFirst" class="absolute inset-0 z-10 overflow-hidden" data-home-first>
      <div class="home-first-wide" role="img" aria-label="Map" />
      <div class="absolute inset-0" v-html="firstPaint" />
    </div>
  </div>
</template>

<style>
.home-first-wide { position: absolute; inset: 0; background: url('/home-first-paint-wide.svg') 50% 50% / 2560px 1600px no-repeat; }
.dark .home-first-wide { background-image: url('/home-first-paint-wide-dark.svg'); }
.home-first-small-dark { display: none; position: absolute; inset: 0; background: url('/home-first-paint-dark.svg') 50% 50% / 1000px 1000px no-repeat; }
.dark .home-first-small-dark { display: block; }
.dark .home-first-small { display: none; }
@media (max-width: 1000px) and (max-height: 1060px) { .home-first-wide { display: none; } }
@media not all and (max-width: 1000px) and (max-height: 1060px) { .home-first-small, .dark .home-first-small-dark { display: none; } }
/* The controls come in the light and the dark colors: the rules of the dark ones sit under `.map-jr-dark` in the sheet of the file. */
.dark .home-first-light, :root:not(.dark) .home-first-dark { display: none; }
/* The controls and the credits of the first paint are at the corners of the stage, in the form that the map has at this width. */
@media (max-width: 640px) { .home-first-regular { display: none; } }
@media (min-width: 641px) { .home-first-compact { display: none; } }
</style>
