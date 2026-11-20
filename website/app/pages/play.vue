<!--
  /play: the visitor edits a description of the Main API, and the map beside it follows each change
  (components/MapFrame.vue, the form "description"). The address keeps the state: `code` is the code, compressed with
  deflate and written in base64url, and `view` the view as zoom/lat/lng/bearing/pitch. A copied address shows the same
  code and the same view. This page replaces site/playground.html of the gallery.
-->
<script setup lang="ts">
import type {FrameView} from '~/utils/map-frame';
import {firstPlayExample, playGroups} from '~/utils/play-examples';

useSeoMeta({title: 'Play', description: 'Edit the description of a map and see the map change.'});

const first = firstPlayExample;
// The menu of the examples: a label for each group, and the examples of the group below it.
const menu = playGroups.map(group => [
    {type: 'label' as const, label: group.label},
    ...group.examples.map(example => ({label: example.label, icon: example.icon, onSelect: () => begin(example.code)})),
]);

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
</script>

<template>
  <div class="grid grid-cols-1 lg:h-[calc(100dvh-var(--ui-header-height))] lg:grid-cols-2">
    <section class="flex min-h-0 min-w-0 flex-col border-muted lg:border-e">
      <div class="flex flex-wrap items-center gap-2 border-b border-muted px-4 py-3">
        <h1 class="me-auto font-display text-2xl text-highlighted">Play</h1>
        <UDropdownMenu :items="menu" :content="{align: 'start'}">
          <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-layout-list" trailing-icon="i-lucide-chevron-down">Examples</UButton>
        </UDropdownMenu>
        <UButton size="sm" icon="i-lucide-link" @click="copy">Copy the link</UButton>
      </div>
      <p v-if="problem" class="border-b border-muted px-4 py-2 text-sm text-error" role="status">{{ problem }}</p>
      <LazyCodeEditor
        v-if="code !== undefined" v-model="code" language="js" label="The description of the map"
        class="h-[50vh] lg:h-auto lg:flex-1" @run="send"
      />
      <div v-else class="h-[50vh] lg:flex-1" />
    </section>
    <MapFrame
      v-if="code !== undefined" :key="frameKey" form="description" :code="sent" :view="start" title="The map of the description"
      class="h-[70vh] lg:h-full" @view="onView"
    />
    <div v-else class="h-[70vh] lg:h-full" />
  </div>
</template>
