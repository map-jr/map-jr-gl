<!--
  /play: the visitor edits a description of the Main API, and the map beside it follows each change
  (components/MapFrame.vue, the form "description"). The address keeps the state: `code` is the code, compressed with
  deflate and written in base64url, and `view` the view as zoom/lat/lng/bearing/pitch. A copied address shows the same
  code and the same view. This page replaces site/playground.html of the gallery.
-->
<script setup lang="ts">
import type {FrameView} from '~/utils/map-frame';

useSeoMeta({title: 'Play', description: 'Edit the description of a map and see the map change.'});

const controls = `import {navigation, scale} from '@map-jr/map-jr-gl/controls';`;
const starts = [
    {label: 'New York', code: `${controls}

// The description of the map (MapDescription). The map changes when you change it.
export default {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
  controls: [navigation(), scale({position: 'bottom-left'})],
  attribution: {compact: true},
};
`},
    {label: 'Pitch 85', code: `${controls}

// Lower Manhattan at pitch 85. maxPitch is 60 when the description leaves it out.
export default {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0119, 40.7069], zoom: 16, pitch: 85, bearing: 30},
  maxPitch: 85,
  controls: [navigation({visualizePitch: true}), scale({position: 'bottom-left'})],
  attribution: {compact: true},
};
`},
    {label: 'Terrain', code: `${controls}

// The Matterhorn in 3D. The style has the elevation source "terrarium".
export default {
  style: 'https://styles.map-jr.org/1/elevation.json',
  terrain: {source: 'terrarium', exaggeration: 1.5},
  initialView: {center: [7.6586, 45.9763], zoom: 12.4, pitch: 60, bearing: 25},
  controls: [navigation({visualizePitch: true}), scale({position: 'bottom-left'})],
  attribution: {compact: true},
};
`},
    {label: 'Globe', code: `import {navigation, globe} from '@map-jr/map-jr-gl/controls';

// The world as a globe. Past zoom 12 the globe turns into the flat map.
export default {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  projection: {type: 'globe'},
  initialView: {center: [10, 30], zoom: 1.5},
  controls: [navigation(), globe()],
  attribution: {compact: true},
};
`},
];
const first = starts[0]!.code;

// The longest code that the address can give, in characters. The address comes from anyone who sends a link.
const longest = 100_000;

async function pack(text: string): Promise<string> {
    const bytes = new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function unpack(packed: string): Promise<string> {
    const bytes = Uint8Array.from(atob(packed.replace(/-/g, '+').replace(/_/g, '/')), character => character.charCodeAt(0));
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).pipeThrough(new TextDecoderStream()).getReader();
    let text = '';
    for (let part = await reader.read(); !part.done; part = await reader.read()) {
        text += part.value;
        if (text.length > longest) { await reader.cancel(); throw new Error(`the code is longer than ${longest} characters`); }
    }
    return text;
}
function readView(value: string | null): FrameView | undefined {
    const numbers = value?.split('/').map(Number) ?? [];
    const [zoom = NaN, lat = NaN, lng = NaN, bearing = 0, pitch = 0] = numbers;
    if (numbers.length < 3 || numbers.length > 5 || ![zoom, lat, lng, bearing, pitch].every(Number.isFinite)) return undefined;
    if (Math.abs(lat) > 90 || zoom < -2 || zoom > 24 || pitch < 0 || pitch > 90) return undefined;
    return {center: [lng, lat], zoom, bearing, pitch};
}
const writeView = (view: FrameView) => [view.zoom.toFixed(2), view.center[1].toFixed(5), view.center[0].toFixed(5), view.bearing.toFixed(1), view.pitch.toFixed(1)].map(part => part.replace(/\.?0+$/, '') || '0').join('/');

// `code` is the text of the editor, `sent` the code that the map has, and `start` the view of the first map. The
// state is undefined on the server and until the address has been read.
const code = ref<string>();
const sent = ref('');
const start = ref<FrameView>();
const view = ref<FrameView>();
const problem = ref('');
const frameKey = ref(0);
const route = useRoute();

onMounted(async () => {
    // (The router has the hash of the address; `location.hash` is empty while the page hydrates.)
    const params = new URLSearchParams(route.hash.slice(1));
    start.value = view.value = readView(params.get('view'));
    let text = first;
    if (params.get('code')) {
        try {
            text = await unpack(params.get('code')!);
        } catch (error) {
            problem.value = `The code in the address could not be read (${error instanceof Error ? error.message : error}). The page shows the first example.`;
        }
    }
    code.value = sent.value = text;
});

// The address follows the code and the view, half a second after the last change.
let timer: ReturnType<typeof setTimeout> | undefined;
async function writeAddress() {
    clearTimeout(timer);
    timer = undefined;
    // (Both values are safe in an address, so they are written as they are: the view keeps its slashes.)
    const parts: string[] = [];
    if (code.value !== undefined && code.value !== first) parts.push('code=' + await pack(code.value));
    if (view.value) parts.push('view=' + writeView(view.value));
    const hash = parts.join('&');
    history.replaceState(history.state, '', hash ? '#' + hash : location.pathname + location.search);
}
const later = () => { clearTimeout(timer); timer = setTimeout(writeAddress, 500); };

let sending: ReturnType<typeof setTimeout> | undefined;
function send() {
    clearTimeout(sending);
    if (code.value !== undefined) sent.value = code.value;
}
watch(code, () => {
    clearTimeout(sending);
    sending = setTimeout(send, 400);
    later();
});
function onView(next: FrameView) {
    view.value = next;
    later();
}
// A starting point makes a new map at its first view.
function begin(text: string) {
    problem.value = '';
    start.value = view.value = undefined;
    code.value = sent.value = text;
    frameKey.value++;
}

const toast = useToast();
async function copy() {
    await writeAddress();
    try {
        await navigator.clipboard.writeText(location.href);
        toast.add({title: 'The link is copied', description: 'It opens this page with the same code and view.', icon: 'i-lucide-link'});
    } catch {
        toast.add({title: 'The link could not be copied', description: 'Copy the address of the page.', color: 'error'});
    }
}
onBeforeUnmount(() => {
    clearTimeout(sending);
    clearTimeout(timer);
});

// The split: the width of the editor, in percent of the page, at the width "lg" and above. The grabber between the editor
// and the map moves it with a pointer (the drag keeps the pointer, so it goes on over the frame of the map) and with the
// keys. The value is kept while the visitor moves around the site, and it is not in the address.
const splitMin = 20;
const splitMax = 80;
const splitStep = 2;
const split = useState('play-split', () => 50);
const grid = useTemplateRef<HTMLElement>('grid');
const dragging = ref(false);
let dragFrom: {x: number; split: number; width: number} | undefined;
const setSplit = (value: number) => { split.value = Math.min(splitMax, Math.max(splitMin, Math.round(value * 10) / 10)); };
function onGrab(event: PointerEvent) {
    if (event.button !== 0 || !grid.value) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    dragFrom = {x: event.clientX, split: split.value, width: grid.value.getBoundingClientRect().width};
    dragging.value = true;
}
function onDrag(event: PointerEvent) {
    if (dragFrom) setSplit(dragFrom.split + (event.clientX - dragFrom.x) / dragFrom.width * 100);
}
function onRelease() {
    dragFrom = undefined;
    dragging.value = false;
}
function onSplitKey(event: KeyboardEvent) {
    const next = {ArrowLeft: split.value - splitStep, ArrowRight: split.value + splitStep, Home: splitMin, End: splitMax}[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setSplit(next);
}
</script>

<template>
  <div
    ref="grid" class="grid grid-cols-1 lg:h-[calc(100dvh-var(--ui-header-height))] lg:grid-cols-[minmax(0,var(--split))_minmax(0,1fr)]"
    :style="{'--split': split + '%'}"
  >
    <section class="relative flex min-h-0 min-w-0 flex-col border-muted lg:border-e">
      <div class="flex flex-wrap items-center gap-2 border-b border-muted px-4 py-3">
        <h1 class="me-auto font-display text-2xl text-highlighted">Play</h1>
        <span class="text-sm text-muted">Start from</span>
        <UButton v-for="item in starts" :key="item.label" size="sm" color="neutral" variant="outline" @click="begin(item.code)">{{ item.label }}</UButton>
        <UButton size="sm" icon="i-lucide-link" @click="copy">Copy the link</UButton>
      </div>
      <p class="border-b border-muted px-4 py-2 text-sm text-muted">
        The code is a module of the Main API whose default export is a
        <NuxtLink to="/reference/description" class="text-primary">description</NuxtLink>. The map changes when the code
        changes. The address of the page keeps the code and the view, so a copied link shows the same map.
      </p>
      <p v-if="problem" class="border-b border-muted px-4 py-2 text-sm text-error" role="status">{{ problem }}</p>
      <LazyCodeEditor
        v-if="code !== undefined" v-model="code" language="js" label="The description of the map"
        class="h-[50vh] lg:h-auto lg:flex-1" @run="send"
      />
      <div v-else class="h-[50vh] lg:flex-1" />
      <div
        role="separator" aria-orientation="vertical" aria-label="Width of the editor and the map" tabindex="0"
        :aria-valuenow="Math.round(split)" :aria-valuemin="splitMin" :aria-valuemax="splitMax" :aria-valuetext="`Editor ${Math.round(split)}%, map ${100 - Math.round(split)}%`"
        class="split-grabber absolute inset-y-0 -end-1.5 z-10 hidden w-3 cursor-col-resize touch-none select-none outline-none lg:block"
        :class="{'is-dragging': dragging}"
        @pointerdown="onGrab" @pointermove="onDrag" @pointerup="onRelease" @pointercancel="onRelease" @keydown="onSplitKey"
      />
    </section>
    <MapFrame
      v-if="code !== undefined" :key="frameKey" form="description" :code="sent" :view="start" title="The map of the description"
      class="h-[70vh] lg:h-full" @view="onView"
    />
    <div v-else class="h-[70vh] lg:h-full" />
  </div>
</template>

<style>
.split-grabber::after { content: ''; position: absolute; inset-block: 0; inset-inline-start: 50%; width: 2px; margin-inline-start: -1px; background: transparent; }
.split-grabber:hover::after, .split-grabber:focus-visible::after, .split-grabber.is-dragging::after { background: var(--ui-primary); }
</style>
