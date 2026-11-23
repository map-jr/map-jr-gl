<!--
  The panel beside the map of the home page. It has four demos (utils/home-scenes.ts), and each choice changes the map
  (`update:mapProps`, `update:camera`). Below the choices is the description of `@map-jr/map-jr-gl` that makes the same map;
  a line that a choice changed is marked for a moment.

  The demo "worker" blocks the thread of the page for two seconds while the map turns. `turn` starts the turn (HomeMap.vue),
  and `renderer` is the thread that draws the map. The bar of that demo moves one step in each frame of the page, so it
  stands still while the page is blocked.
-->
<script setup lang="ts">
import {countChoices, demoCamera, demoCode, demoProps, exaggerationChoices, firstState, languageChoices, paletteChoices, shapeChoices, styleChoices, type Camera, type DemoId} from '~/utils/home-scenes';

const props = defineProps<{renderer: string; turn: (degrees: number, duration: number) => boolean}>();
const emit = defineEmits<{'update:mapProps': [Record<string, unknown>]; 'update:camera': [Camera]}>();

const demos: {id: DemoId; label: string; icon: string; text: string; link: string; linkLabel: string}[] = [
    {id: 'styles', label: 'Styles', icon: 'i-lucide-palette', link: '/styles', linkLabel: 'The styles',
        text: 'One style has the light and the dark colours and the names in each language of the tiles. A choice sets one value of the description, and the map loads no new style.'},
    {id: 'markers', label: 'Markers', icon: 'i-lucide-map-pin', link: '/guide/markers-and-popups', linkLabel: 'Guide: markers and popups',
        text: 'One symbol layer draws every marker from an SVG template. Each point fills the slot {{color}} of the template from its data.'},
    {id: 'terrain', label: 'Terrain', icon: 'i-lucide-mountain', link: '/guide/terrain', linkLabel: 'Guide: terrain and elevation',
        text: '3D terrain, hillshade and contour lines come from one elevation source. The library makes the contour lines in the browser.'},
    {id: 'worker', label: 'Worker', icon: 'i-lucide-cpu', link: '/guide/browser-support#what-each-renderer-needs', linkLabel: 'What each renderer needs',
        text: 'The map draws in a worker where the browser can draw there. The button turns the map and then keeps the thread of the page busy for two seconds.'},
];
const demo = ref<DemoId>('styles');
const current = computed(() => demos.find(item => item.id === demo.value)!);
const state = reactive(firstState());

const colorMode = useColorMode();
// The server does not know the colour mode of the visitor, so the page shows "light" until it runs in the browser.
const mounted = ref(false);
let armed = false;
onMounted(() => { mounted.value = true; nextTick(() => { armed = true; }); });
const scheme = computed<'light' | 'dark'>(() => mounted.value && colorMode.value === 'dark' ? 'dark' : 'light');

watch(() => demoProps(demo.value, state), next => emit('update:mapProps', next));
watch(() => demoCamera(demo.value, state), next => emit('update:camera', next));

// The lines of the description. A line that is new after a choice gets the class `home-code-new` (a new key makes a new
// element, and the animation of the class runs once). The first lines of the page are not marked.
const lines = computed(() => demoCode(demo.value, state, scheme.value));
const marking = ref(false);
watch(lines, () => { if (armed) marking.value = true; }, {flush: 'sync'});

// The demo "worker".
const frames = ref(0);
const blocked = ref<'' | 'turning' | 'done' | 'still'>('');
let frame = 0;
const tick = () => { frames.value++; frame = requestAnimationFrame(tick); };
watch(demo, now => {
    cancelAnimationFrame(frame);
    if (now === 'worker') frame = requestAnimationFrame(tick);
    blocked.value = '';
}, {flush: 'post'});
onBeforeUnmount(() => cancelAnimationFrame(frame));
const blockMs = 2000;
function block() {
    if (blocked.value === 'turning') return;
    const turns = props.turn(150, 4500);
    blocked.value = 'turning';
    // The map starts to turn first. Then this loop keeps the thread of the page busy.
    setTimeout(() => {
        const end = performance.now() + blockMs;
        while (performance.now() < end);
        blocked.value = turns ? 'done' : 'still';
    }, 500);
}
const rendererText = computed(() => props.renderer === 'worker' ? 'This map draws in a worker.' : props.renderer === 'main' ? 'In this browser the map draws on the thread of the page, so the map stops with the page.' : 'The map has not loaded yet.');
</script>

<template>
  <section class="home-demo" aria-labelledby="home-demo-title" data-home-demo :data-demo="demo">
    <h2 id="home-demo-title" class="label-text font-medium text-muted">Try it on the map</h2>
    <div class="mt-3 grid grid-cols-4 border border-accented" role="tablist" aria-label="Demos">
      <button
        v-for="item in demos" :id="`home-tab-${item.id}`" :key="item.id" type="button" role="tab" :aria-selected="demo === item.id" aria-controls="home-demo-panel"
        class="home-tab" :data-demo-tab="item.id" @click="demo = item.id"
      >
        <UIcon :name="item.icon" class="size-4 shrink-0" />
        <span>{{ item.label }}</span>
      </button>
    </div>

    <div id="home-demo-panel" role="tabpanel" :aria-labelledby="`home-tab-${demo}`" class="mt-4">
      <p class="text-sm text-pretty text-toned">{{ current.text }}</p>

      <div class="mt-4 space-y-3">
        <template v-if="demo === 'styles'">
          <div class="home-row">
            <span class="home-row-label">Style</span>
            <div class="home-choices" role="group" aria-label="Style">
              <button v-for="choice in styleChoices" :key="choice.id" type="button" class="home-choice" :aria-pressed="state.style === choice.id" :data-choice="choice.id" @click="state.style = choice.id">{{ choice.label }}</button>
            </div>
          </div>
          <div class="home-row">
            <span class="home-row-label">Colours</span>
            <div class="home-choices" role="group" aria-label="Colour scheme">
              <button v-for="choice in (['light', 'dark'] as const)" :key="choice" type="button" class="home-choice capitalize" :aria-pressed="scheme === choice" :data-choice="choice" @click="colorMode.preference = choice">{{ choice }}</button>
            </div>
          </div>
          <div class="home-row">
            <span class="home-row-label">Names</span>
            <div class="home-choices" role="group" aria-label="Language of the names">
              <button v-for="choice in languageChoices" :key="choice.id" type="button" class="home-choice" :aria-pressed="state.language === choice.id" :data-choice="choice.id || 'local'" :lang="choice.id || undefined" @click="state.language = choice.id">{{ choice.label }}</button>
            </div>
          </div>
          <div class="home-row">
            <span class="home-row-label">Projection</span>
            <div class="home-choices" role="group" aria-label="Projection">
              <button type="button" class="home-choice" :aria-pressed="!state.globe" data-choice="mercator" @click="state.globe = false">Mercator</button>
              <button type="button" class="home-choice" :aria-pressed="state.globe" data-choice="globe" @click="state.globe = true">Globe</button>
            </div>
          </div>
        </template>

        <template v-else-if="demo === 'markers'">
          <div class="home-row">
            <span class="home-row-label">Markers</span>
            <div class="home-choices" role="group" aria-label="Number of markers">
              <button v-for="choice in countChoices" :key="choice" type="button" class="home-choice figure-text" :aria-pressed="state.count === choice" :data-choice="choice" @click="state.count = choice">{{ choice.toLocaleString('en') }}</button>
            </div>
          </div>
          <div class="home-row">
            <span class="home-row-label">Template</span>
            <div class="home-choices" role="group" aria-label="Template of the marker">
              <button v-for="choice in shapeChoices" :key="choice.id" type="button" class="home-choice" :aria-pressed="state.shape === choice.id" :data-choice="choice.id" @click="state.shape = choice.id">{{ choice.label }}</button>
            </div>
          </div>
          <div class="home-row">
            <span class="home-row-label">Colours</span>
            <div class="home-choices" role="group" aria-label="Colours of the markers">
              <button v-for="choice in paletteChoices" :key="choice.id" type="button" class="home-choice" :aria-pressed="state.palette === choice.id" :data-choice="choice.id" @click="state.palette = choice.id">
                <span class="flex" aria-hidden="true"><span v-for="(color, index) in new Set(choice.colors)" :key="index" class="size-2.5 border border-default" :style="{backgroundColor: color}" /></span>
                {{ choice.label }}
              </button>
            </div>
          </div>
        </template>

        <template v-else-if="demo === 'terrain'">
          <div class="home-row">
            <span class="home-row-label">3D terrain</span>
            <div class="home-choices" role="group" aria-label="3D terrain">
              <button type="button" class="home-choice" :aria-pressed="state.terrain" data-choice="terrain-on" @click="state.terrain = true">On</button>
              <button type="button" class="home-choice" :aria-pressed="!state.terrain" data-choice="terrain-off" @click="state.terrain = false">Off</button>
            </div>
          </div>
          <div class="home-row">
            <span class="home-row-label">Exaggeration</span>
            <div class="home-choices" role="group" aria-label="Exaggeration of the terrain">
              <button v-for="choice in exaggerationChoices" :key="choice" type="button" class="home-choice figure-text" :disabled="!state.terrain" :aria-pressed="state.exaggeration === choice" :data-choice="`x${choice}`" @click="state.exaggeration = choice">{{ choice }}×</button>
            </div>
          </div>
          <div class="home-row">
            <span class="home-row-label">Contour lines</span>
            <div class="home-choices" role="group" aria-label="Contour lines">
              <button type="button" class="home-choice" :aria-pressed="state.contours" data-choice="contours-on" @click="state.contours = true">On</button>
              <button type="button" class="home-choice" :aria-pressed="!state.contours" data-choice="contours-off" @click="state.contours = false">Off</button>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="flex flex-wrap items-center gap-3">
            <UButton icon="i-lucide-hourglass" :disabled="blocked === 'turning'" data-home-block @click="block">Block the page for 2 seconds</UButton>
            <span class="text-sm text-muted" data-home-renderer :data-renderer="renderer">{{ rendererText }}</span>
          </div>
          <div>
            <div class="flex justify-between gap-3 figure-text text-muted"><span>Frames of the page</span><span data-home-frames>{{ frames.toLocaleString('en') }}</span></div>
            <div class="relative mt-1 h-3 border border-accented bg-(--site-sheet)" aria-hidden="true"><div class="absolute inset-y-0 w-3 bg-primary" :style="{left: `calc(${(frames % 120) / 120} * (100% - 0.75rem))`}" /></div>
          </div>
          <p class="min-h-10 text-sm text-muted" role="status">
            <template v-if="blocked === 'done'">The page drew no frame for 2 seconds, and the bar above stood still.</template>
            <template v-else-if="blocked === 'still'">The page was blocked for 2 seconds. The map did not turn, because it has not loaded or your system asks for reduced motion.</template>
            <template v-else>Watch the map while the bar stands still.</template>
          </p>
        </template>
      </div>

      <div class="mt-5 border border-accented bg-(--site-pre-bg)">
        <div class="flex items-center justify-between gap-3 border-b border-accented bg-(--site-pre-header-bg) px-3 py-1.5">
          <span class="label-text text-muted">The description of this map</span>
          <span class="figure-text text-dimmed">@map-jr/map-jr-gl</span>
        </div>
        <pre class="overflow-x-auto p-3 font-mono text-[0.75rem] leading-relaxed text-(--site-pre-fg)" data-home-code><code><span v-for="line in lines" :key="line" class="block" :class="marking ? 'home-code-new' : ''">{{ line }}</span></code></pre>
      </div>
      <p class="mt-3 flex flex-wrap gap-x-5 gap-y-1">
        <UButton :to="current.link" variant="link" trailing-icon="i-lucide-arrow-right" class="px-0">{{ current.linkLabel }}</UButton>
        <UButton to="/play" variant="link" color="neutral" trailing-icon="i-lucide-arrow-right" class="px-0">Edit a map in the playground</UButton>
      </p>
    </div>
  </section>
</template>

<style>
.home-tab { display: flex; align-items: center; justify-content: center; gap: 0.375rem; padding: 0.5rem 0.25rem; font-size: 0.8125rem; font-weight: 500; color: var(--ui-text-muted); background: var(--ui-bg); }
.home-tab + .home-tab { border-inline-start: 1px solid var(--ui-border-accented); }
.home-tab:hover { color: var(--ui-text-highlighted); }
.home-tab[aria-selected="true"] { color: var(--ui-text-highlighted); background: var(--site-sheet); box-shadow: inset 0 -2px 0 var(--ui-primary); }
.home-tab:focus-visible, .home-choice:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: -2px; }
.home-row { display: grid; grid-template-columns: 6.25rem 1fr; align-items: baseline; gap: 0.5rem; }
.home-row-label { font-family: var(--font-mono); font-size: 0.6875rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ui-text-muted); }
.home-choices { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.home-choice { display: inline-flex; align-items: center; gap: 0.375rem; min-height: 1.875rem; padding: 0.125rem 0.625rem; font-size: 0.8125rem; border: 1px solid var(--ui-border-accented); background: var(--ui-bg); color: var(--ui-text-toned); }
.home-choice:hover:not(:disabled, [aria-pressed="true"]) { border-color: var(--ui-border-inverted); color: var(--ui-text-highlighted); }
.home-choice[aria-pressed="true"] { background: var(--ui-bg-inverted); border-color: var(--ui-bg-inverted); color: var(--ui-text-inverted); }
.home-choice:disabled { opacity: 0.45; }
@keyframes home-code-new { from { background-color: color-mix(in oklab, var(--ui-primary) 28%, transparent); } to { background-color: transparent; } }
.home-code-new { animation: home-code-new 1.6s ease-out; }
@media (prefers-reduced-motion: reduce) { .home-code-new { animation: none; box-shadow: inset 2px 0 0 var(--ui-primary); } }
</style>
