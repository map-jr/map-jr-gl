<!--
  The panel beside the map of the home page. It has six demos (utils/home-scenes.ts), and each choice changes the map
  (`update:mapProps`, `update:camera`, `update:scheme`). Below the choices is the description of `@map-jr/map-jr-gl` that
  makes the same map; a line that a choice changed is marked for a moment.

  `map` gives the map once it has loaded, `view` is its view, `click` is the last click on it, and `renderer` is the thread
  that draws it (components/home/HomeMap.vue).

  - "styles": the color scheme of the map starts as the color mode of the site and follows a change of that mode. A
    choice of the panel changes the map only.
  - "markers": a click on the map adds a marker.
  - "camera": a slider sets one value of the view, and a place is a flight.
  - "query": a click asks the map for the features and the elevation at the point.
  - "worker": the button turns the map and then blocks the thread of the page for two seconds. The bar of that demo moves
    one step in each frame of the page, so it stands still while the page is blocked.
-->
<script setup lang="ts">
import {countChoices, demoCamera, demoCode, demoProps, exaggerationChoices, firstState, languageChoices, paletteChoices, placeChoices, shapeChoices, styleChoices, type Camera, type DemoId, type HomeClick, type HomeView} from '~/utils/home-scenes';

type Feature = {properties: Record<string, unknown>; layer: {id: string; type: string}; sourceLayer?: string};
type MapLike = {
    moveTo: (to: Record<string, unknown>) => void;
    queryFeatures: (at: {x: number; y: number}) => Promise<Feature[]>;
    queryElevation: (at: [number, number]) => Promise<number | null>;
    toBlob: (type?: string) => Promise<Blob>;
};
const props = defineProps<{map: () => MapLike | null; view?: HomeView; click?: HomeClick; renderer: string}>();
const emit = defineEmits<{'update:mapProps': [Record<string, unknown>]; 'update:camera': [Camera]; 'update:scheme': ['light' | 'dark']}>();

const demos: {id: DemoId; label: string; icon: string; text: string; link: string; linkLabel: string}[] = [
    {id: 'styles', label: 'Styles', icon: 'i-lucide-palette', link: '/styles', linkLabel: 'The styles',
        text: 'One style has the light and the dark colors and the names in each language of the tiles. A choice sets one value of the description, and the map loads no new style.'},
    {id: 'markers', label: 'Markers', icon: 'i-lucide-map-pin', link: '/guide/markers-and-popups', linkLabel: 'Guide: markers and popups',
        text: 'One symbol layer draws every marker from an SVG template, and each point fills the slot {{color}} of the template from its data. Click the map to add a marker of your own.'},
    {id: 'terrain', label: 'Terrain', icon: 'i-lucide-mountain', link: '/guide/terrain', linkLabel: 'Guide: terrain and elevation',
        text: '3D terrain, hillshade and contour lines come from one elevation source. The library makes the contour lines in the browser.'},
    {id: 'camera', label: 'Camera', icon: 'i-lucide-video', link: '/guide/view-and-camera', linkLabel: 'Guide: the view and the camera',
        text: 'The view of the map is state that your code reads and sets. Drag a slider or the map, and the numbers follow.'},
    {id: 'query', label: 'Query', icon: 'i-lucide-mouse-pointer-click', link: '/recipes/query', linkLabel: 'Recipe: query what is at a position',
        text: 'Click the map. The map answers with the features that it draws at the point and the elevation of the ground there, each as a promise.'},
    {id: 'worker', label: 'Worker', icon: 'i-lucide-cpu', link: '/guide/browser-support#what-each-renderer-needs', linkLabel: 'What each renderer needs',
        text: 'The map draws in a worker where the browser can draw there. The button turns the map and then keeps the thread of the page busy for two seconds.'},
];
const demo = ref<DemoId>('styles');
const current = computed(() => demos.find(item => item.id === demo.value)!);
const state = reactive(firstState());

// The color scheme of the map. The server does not know the color mode of the visitor, so the page shows "light" until
// it runs in the browser.
const colorMode = useColorMode();
const scheme = ref<'light' | 'dark'>('light');
let armed = false;
onMounted(() => {
    scheme.value = colorMode.value === 'dark' ? 'dark' : 'light';
    nextTick(() => { armed = true; });
});
watch(() => colorMode.value, mode => { scheme.value = mode === 'dark' ? 'dark' : 'light'; });
watch(scheme, next => emit('update:scheme', next), {flush: 'sync'});

watch(() => demoProps(demo.value, state), next => emit('update:mapProps', next));
watch(() => demoCamera(demo.value, state), next => emit('update:camera', next));

// The lines of the description. The first lines of the page are not marked.
const lines = computed(() => demoCode(demo.value, state, scheme.value));
const marking = ref(false);
watch(lines, () => { if (armed) marking.value = true; }, {flush: 'sync'});

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// A click on the map: a marker in "markers", a query in "query".
let asked = 0;
const answer = ref<{lngLat: [number, number]; elevation: number | null; features: {name: string; layer: string; type: string}[]} | 'asking' | null>(null);
watch(() => props.click, async click => {
    const map = props.map();
    if (!click || !map) return;
    if (demo.value === 'markers') state.added = [...state.added, click.lngLat].slice(-200);
    if (demo.value !== 'query') return;
    state.picked = click.lngLat;
    const mine = ++asked;
    answer.value = 'asking';
    try {
        const [features, elevation] = await Promise.all([map.queryFeatures(click.point), map.queryElevation(click.lngLat)]);
        // A newer click has asked again.
        if (mine !== asked) return;
        const seen = new Set<string>();
        answer.value = {lngLat: click.lngLat, elevation, features: features.filter(feature => feature.layer.id !== 'picked' && !seen.has(feature.layer.id) && seen.add(feature.layer.id)).slice(0, 4)
            .map(feature => ({name: String(feature.properties['name:en'] ?? feature.properties.name ?? feature.properties.class ?? ''), layer: feature.layer.id, type: feature.layer.type}))};
    } catch {
        if (mine === asked) answer.value = null;
    }
});

// The demo "camera".
const set = (field: 'zoom' | 'pitch' | 'bearing', event: Event) => props.map()?.moveTo({[field]: Number((event.target as HTMLInputElement).value)});
const flyTo = (camera: Camera) => props.map()?.moveTo({center: camera.center, zoom: camera.zoom, pitch: camera.pitch ?? 0, bearing: camera.bearing ?? 0, ...(reducedMotion() ? {} : {fly: {maxDuration: 6000}})});
const sliders = [
    {field: 'zoom', label: 'Zoom', min: 1, max: 18, step: 0.1, unit: ''},
    {field: 'pitch', label: 'Pitch', min: 0, max: 85, step: 1, unit: '°'},
    {field: 'bearing', label: 'Bearing', min: -180, max: 180, step: 1, unit: '°'},
] as const;
// A turn of the globe or of the map, in a time. It returns false when the map cannot animate.
function animate(to: Record<string, unknown>, duration: number) {
    const map = props.map();
    if (!map || reducedMotion()) return false;
    map.moveTo({...to, duration});
    return true;
}
const spin = () => props.view && animate({center: [props.view.center[0] + 170, props.view.center[1]]}, 7000);

// The picture of the map as a PNG file.
const saving = ref(false);
async function save() {
    const map = props.map();
    if (!map || saving.value) return;
    saving.value = true;
    try {
        const url = URL.createObjectURL(await map.toBlob('image/png'));
        const link = Object.assign(document.createElement('a'), {href: url, download: 'map-jr-gl.png'});
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    } finally {
        saving.value = false;
    }
}

// The demo "worker".
const frames = ref(0);
const blocked = ref<'' | 'turning' | 'done' | 'still'>('');
let frame = 0;
const tick = () => { frames.value++; frame = requestAnimationFrame(tick); };
watch(demo, now => {
    cancelAnimationFrame(frame);
    if (now === 'worker') frame = requestAnimationFrame(tick);
    blocked.value = '';
    answer.value = null;
}, {flush: 'post'});
onBeforeUnmount(() => cancelAnimationFrame(frame));
const blockMs = 2000;
function block() {
    if (blocked.value === 'turning') return;
    const turns = animate({bearing: (props.view?.bearing ?? 0) + 150}, 4500);
    blocked.value = 'turning';
    // The map starts to turn first. Then this loop keeps the thread of the page busy.
    setTimeout(() => {
        const end = performance.now() + blockMs;
        while (performance.now() < end);
        blocked.value = turns ? 'done' : 'still';
    }, 500);
}
const rendererText = computed(() => props.renderer === 'worker' ? 'This map draws in a worker.' : props.renderer === 'main' ? 'In this browser the map draws on the thread of the page, so the map stops with the page.' : 'The map has not loaded yet.');
const degrees = (value: number) => value.toLocaleString('en', {maximumFractionDigits: 4});
</script>

<template>
  <section class="home-demo" aria-labelledby="home-demo-title" data-home-demo :data-demo="demo">
    <h2 id="home-demo-title" class="label-text font-medium text-muted">Try it on the map</h2>
    <div class="home-tabs mt-3" role="tablist" aria-label="Demos">
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
            <span class="home-row-label">Colors</span>
            <div class="home-choices" role="group" aria-label="Color scheme of the map">
              <button v-for="choice in (['light', 'dark'] as const)" :key="choice" type="button" class="home-choice capitalize" :aria-pressed="scheme === choice" :data-choice="choice" @click="scheme = choice">{{ choice }}</button>
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
              <button v-if="state.globe" type="button" class="home-choice" data-choice="spin" @click="spin"><UIcon name="i-lucide-rotate-3d" class="size-4" />Spin</button>
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
            <span class="home-row-label">Colors</span>
            <div class="home-choices" role="group" aria-label="Colors of the markers">
              <button v-for="choice in paletteChoices" :key="choice.id" type="button" class="home-choice" :aria-pressed="state.palette === choice.id" :data-choice="choice.id" @click="state.palette = choice.id">
                <span class="flex" aria-hidden="true"><span v-for="(color, index) in choice.colors" :key="index" class="size-2.5" :style="{backgroundColor: color}" /></span>
                {{ choice.label }}
              </button>
            </div>
          </div>
          <label class="home-row">
            <span class="home-row-label">Size</span>
            <span class="flex items-center gap-3"><input v-model.number="state.markerSize" type="range" min="0.5" max="2" step="0.1" class="home-range" data-home-size-range><span class="figure-text w-10 text-end text-muted">{{ state.markerSize.toFixed(1) }}×</span></span>
          </label>
          <div class="home-row">
            <span class="home-row-label">Yours</span>
            <div class="home-choices">
              <span class="text-sm text-muted" data-home-added>{{ state.added.length ? `${state.added.length} added with a click.` : 'Click the map to add one.' }}</span>
              <button v-if="state.added.length" type="button" class="home-choice" @click="state.added = []">Clear</button>
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
          <div class="home-row">
            <span class="home-row-label">Peak labels</span>
            <div class="home-choices" role="group" aria-label="Unit of the peak labels">
              <button type="button" class="home-choice" :aria-pressed="state.unit === 'm'" data-choice="unit-m" @click="state.unit = 'm'">Meters</button>
              <button type="button" class="home-choice" :aria-pressed="state.unit === 'ft'" data-choice="unit-ft" @click="state.unit = 'ft'">Feet</button>
            </div>
          </div>
        </template>

        <template v-else-if="demo === 'camera'">
          <label v-for="slider in sliders" :key="slider.field" class="home-row">
            <span class="home-row-label">{{ slider.label }}</span>
            <span class="flex items-center gap-3">
              <input type="range" :min="slider.min" :max="slider.max" :step="slider.step" :value="view?.[slider.field] ?? 0" class="home-range" :data-home-slider="slider.field" @input="set(slider.field, $event)">
              <span class="figure-text w-12 text-end text-muted">{{ (view?.[slider.field] ?? 0).toFixed(slider.field === 'zoom' ? 1 : 0) }}{{ slider.unit }}</span>
            </span>
          </label>
          <div class="home-row">
            <span class="home-row-label">Fly to</span>
            <div class="home-choices">
              <button v-for="place in placeChoices" :key="place.label" type="button" class="home-choice" :data-choice="`place-${place.label}`" @click="flyTo(place.camera)">{{ place.label }}</button>
            </div>
          </div>
          <p class="figure-text text-muted" data-home-view>state.view.center: [{{ view ? `${degrees(view.center[0])}, ${degrees(view.center[1])}` : '…' }}]</p>
        </template>

        <template v-else-if="demo === 'query'">
          <div class="min-h-28 border border-accented bg-(--site-sheet) p-3 text-sm" role="status" data-home-answer>
            <p v-if="!answer" class="text-muted">Nothing is asked yet. Click a road, a lake or a village.</p>
            <p v-else-if="answer === 'asking'" class="text-muted">Asking the map…</p>
            <template v-else>
              <p class="figure-text text-muted">[{{ degrees(answer.lngLat[0]) }}, {{ degrees(answer.lngLat[1]) }}]</p>
              <p class="mt-1 text-highlighted"><span class="font-medium">queryElevation:</span> {{ answer.elevation === null ? 'no elevation here' : `${Math.round(answer.elevation).toLocaleString('en')} m` }}</p>
              <p class="mt-2 font-medium text-highlighted">queryFeatures:</p>
              <ul class="mt-1 space-y-0.5">
                <li v-for="feature in answer.features" :key="feature.layer" class="flex justify-between gap-3"><span class="truncate text-toned">{{ feature.name || '(no name)' }}</span><span class="figure-text shrink-0 text-muted">{{ feature.layer }} · {{ feature.type }}</span></li>
                <li v-if="!answer.features.length" class="text-muted">No style layer draws a feature here.</li>
              </ul>
            </template>
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
        <div class="flex items-center justify-between gap-3 border-b border-accented bg-(--site-pre-header-bg) py-1 ps-3 pe-1">
          <span class="label-text text-muted">The code of this map</span>
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-image-down" :loading="saving" data-home-save @click="save">Save as PNG</UButton>
        </div>
        <HomeCode :code="lines" :mark="marking" class="p-3" data-home-code />
      </div>
      <p class="mt-3 flex flex-wrap gap-x-5 gap-y-1">
        <UButton :to="current.link" variant="link" trailing-icon="i-lucide-arrow-right" class="px-0">{{ current.linkLabel }}</UButton>
        <UButton to="/play" variant="link" color="neutral" trailing-icon="i-lucide-arrow-right" class="px-0">Edit a map in the playground</UButton>
      </p>
    </div>
  </section>
</template>

<style>
.home-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; border: 1px solid var(--ui-border-accented); background: var(--ui-border-accented); }
.home-tab { display: flex; align-items: center; justify-content: center; gap: 0.375rem; padding: 0.5rem 0.25rem; font-size: 0.8125rem; font-weight: 500; color: var(--ui-text-muted); background: var(--ui-bg); }
.home-tab:hover { color: var(--ui-text-highlighted); }
.home-tab[aria-selected="true"] { color: var(--ui-primary); background: var(--site-sheet); box-shadow: inset 0 -2px 0 var(--ui-primary); }
.home-tab:focus-visible, .home-choice:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: 2px; }
.home-row { display: grid; grid-template-columns: 6.25rem minmax(0, 1fr); align-items: center; gap: 0.5rem; }
.home-row-label { font-family: var(--font-mono); font-size: 0.6875rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ui-text-muted); }
.home-choices { display: flex; flex-wrap: wrap; align-items: center; gap: 0.375rem; }
.home-choice { display: inline-flex; align-items: center; gap: 0.375rem; min-height: 1.875rem; padding: 0.125rem 0.625rem; font-size: 0.8125rem; border: 1px solid var(--ui-border-accented); background: var(--ui-bg); color: var(--ui-text-toned); }
.home-choice:hover:not(:disabled, [aria-pressed="true"]) { border-color: var(--ui-primary); color: var(--ui-primary); }
/* A chosen control has the survey color. Contrast of its text on it: 5.1 in the light mode and 6.8 in the dark mode (main.css). */
.home-choice[aria-pressed="true"] { background: var(--ui-primary); border-color: var(--ui-primary); color: var(--ui-text-inverted); }
.home-choice:disabled { opacity: 0.45; }
.home-range { flex: 1; min-width: 0; accent-color: var(--ui-primary); }
</style>
