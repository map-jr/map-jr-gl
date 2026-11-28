<!--
  The one live map of the home page (pages/index.vue). The first paint is the SVG of the server renderer from a file of the
  repository, and the map takes over when it has loaded. The visitor can drag the map; the wheel zooms only with Ctrl (⌘ on a
  Mac) and a touch pans only with two fingers (`cooperativeGestures`), so the page scrolls over the map.

  `mapProps` are the props of the map, and a new `camera` moves the camera: a flight, or a cut when the system asks for
  reduced motion. The map draws the color scheme `scheme`, which the panel sets, and
  the stage has the paper of that scheme behind the map, so that nothing shows through around the globe. `data-map-state` is "idle" when the map is drawn and ready, "error" when it cannot be shown (the SVG
  stays), and the checks read it. `renderer` is the thread that draws, once the map has loaded, and again when it changes.
-->
<script setup lang="ts">
import type {MapJrExposed} from '@map-jr/map-jr-gl/vue';
import type {Camera, HomeClick, HomeView} from '~/utils/home-scenes';
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

const props = defineProps<{mapProps: Record<string, unknown>; camera: Camera; scheme: 'light' | 'dark'}>();
const emit = defineEmits<{state: [string]; renderer: [string]; view: [HomeView]; click: [HomeClick]}>();

const view = useHomeView();
const state = ref<'loading' | 'idle' | 'error'>('loading');
const map = useTemplateRef<MapJrExposed>('map');
const controls = [navigationControl(), scaleControl()];
// The camera of the first scene is the first view of the map, and a later scene moves the camera.
const first = props.camera;
let ready = false;
// How the last move went, "fly" or "cut" (the checks read it).
const how = ref('');

watch(state, value => emit('state', value));

function move(camera: Camera) {
    if (!ready || !map.value) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = {center: camera.center, zoom: camera.zoom, bearing: camera.bearing ?? 0, pitch: camera.pitch ?? 0};
    // A cut for a reader who prefers reduced motion. (The library also jumps then.)
    how.value = reduced ? 'cut' : 'fly';
    map.value.moveTo(reduced ? target : {...target, fly: {maxDuration: 5000}});
}
watch(() => props.camera, move);

// The checks read the map through the element (`__homeMap`) to compare its places with those of the first paint.
const root = useTemplateRef<HTMLElement & {__homeMap?: unknown}>('root');
let stopRenderer: (() => void) | undefined;
onBeforeUnmount(() => stopRenderer?.());
function onLoad() {
    ready = true;
    if (root.value) root.value.__homeMap = map.value;
    // The map is at its first view already. A flight here would show a half-drawn map under the first paint.
    // (The renderer can change after `load`, when the map moves to the main thread; #1840.)
    stopRenderer?.();
    stopRenderer = map.value?.state.subscribe(s => s.renderer, r => emit('renderer', r ?? ''));
    emit('renderer', map.value?.state.get().renderer ?? '');
    const now = props.camera;
    if (now.center[0] === first.center[0] && now.center[1] === first.center[1] && now.zoom === first.zoom && (now.bearing ?? 0) === (first.bearing ?? 0) && (now.pitch ?? 0) === (first.pitch ?? 0)) return;
    move(now);
}

function onIdle() {
    state.value = 'idle';
    // The first paint covers the map and its controls until the map has drawn its first view. It goes in the same frame
    // as the idle state, so the map and the controls show together (#1416).
    showFirst.value = false;
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
const onView = (next: HomeView) => {
    view.value = {center: next.center, zoom: next.zoom};
    emit('view', {center: next.center, zoom: next.zoom, bearing: next.bearing, pitch: next.pitch});
};
const onClick = (event: HomeClick) => emit('click', {point: event.point, lngLat: event.lngLat});

// The map, for the panel of demos: `null` until the map has loaded.
defineExpose({instance: () => ready ? map.value : null});
</script>

<template>
  <div ref="root" class="absolute inset-0" :style="{backgroundColor: scheme === 'dark' ? '#17181a' : '#f6f5f2'}" data-home-map :data-map-state="state" :data-camera="how">
    <p v-if="unsupported" class="absolute inset-x-0 top-3 mx-auto w-fit max-w-[90%] border border-accented bg-default/90 px-3 py-1 text-center text-sm text-muted">This browser has no WebGL 2, so the map is a still picture.</p>
    <MapJr
      v-if="!unsupported"
      ref="map"
      v-bind="mapProps"
      :initial-view="first"
      cooperative-gestures
      :color-scheme="scheme"
      :controls="controls"
      @update:view="onView"
      @click="onClick"
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
/* The controls and the credits of the first paint are at the corners of the stage, in the form that the map has at the width of the stage. */
[data-home-map] { container-type: inline-size; }
@container (max-width: 640px) { .home-first-regular { display: none; } }
@container (min-width: 641px) { .home-first-compact { display: none; } }
</style>
