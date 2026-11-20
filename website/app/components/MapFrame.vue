<!--
  A map that runs code in a sandboxed iframe (utils/map-frame.ts), and the errors and console messages of that code as
  text below it. The recipes (content/LiveExample.vue) and /play use it.

  With the forms "main", "compat" and "element", a new `code` runs in a new document, and the frame takes the height of
  its document. With the form "description", the frame fills its parent, keeps its map, and sends each new `code` to
  the map, which changes to the new description. The frame starts when it comes near the screen.
  `data-map-state` is "idle" when the map of the form "description" is drawn and ready (the checks read it).
-->
<script setup lang="ts">
import {frameDocument, type FrameForm, type FrameMessage, type FrameView} from '~/utils/map-frame';

const props = defineProps<{form: FrameForm; code: string; title: string; view?: FrameView}>();
const emit = defineEmits<{view: [view: FrameView]}>();

const colorMode = useColorMode();
const scheme = () => colorMode.value === 'dark' ? 'dark' : 'light';
const root = useTemplateRef<HTMLElement>('root');
const frame = useTemplateRef<HTMLIFrameElement>('frame');
const srcdoc = ref('');
const height = ref(520);
const state = ref<'waiting' | 'loading' | 'idle'>('waiting');
const messages = ref<FrameMessage[]>([]);
const described = computed(() => props.form === 'description');

function run() {
    messages.value = [];
    state.value = 'loading';
    srcdoc.value = frameDocument({form: props.form, code: described.value ? '' : props.code, library: new URL('/lib/', location.href).href, scheme: scheme(), view: props.view});
}
const send = (data: Record<string, unknown>) => frame.value?.contentWindow?.postMessage(data, '*');

function onMessage(event: MessageEvent) {
    if (!frame.value || event.source !== frame.value.contentWindow || typeof event.data?.mapFrame !== 'string') return;
    const data = event.data;
    if (data.mapFrame === 'size' && !described.value) height.value = Math.max(100, Math.min(Number(data.height) || 0, 2000));
    if (data.mapFrame === 'state') state.value = data.state === 'idle' ? 'idle' : 'loading';
    if (data.mapFrame === 'view') emit('view', data.view);
    if (data.mapFrame === 'clear') messages.value = messages.value.filter(message => message.source !== data.source);
    if (data.mapFrame === 'message') {
        const message: FrameMessage = {level: data.level === 'warn' ? 'warn' : 'error', text: String(data.text).slice(0, 1000), line: Number(data.line) || undefined, source: data.source === 'code' ? 'code' : 'console'};
        if (messages.value.some(old => old.text === message.text && old.line === message.line)) return;
        messages.value = [...messages.value, message].slice(-5);
    }
}

// The document of the frame gets the colour scheme and, in the form "description", the code once it has loaded.
function onLoad() {
    send({mapFrame: 'scheme', scheme: scheme()});
    if (described.value) send({mapFrame: 'description', code: props.code});
}
watch(() => colorMode.value, () => send({mapFrame: 'scheme', scheme: scheme()}));
watch(() => props.code, code => {
    if (!srcdoc.value) return;
    if (described.value) send({mapFrame: 'description', code});
    else run();
});

let observer: IntersectionObserver | undefined;
onMounted(() => {
    addEventListener('message', onMessage);
    observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer?.disconnect();
        run();
    }, {rootMargin: '300px'});
    if (root.value) observer.observe(root.value);
});
onBeforeUnmount(() => {
    removeEventListener('message', onMessage);
    observer?.disconnect();
});
defineExpose({run});
</script>

<template>
  <div ref="root" class="map-frame flex min-h-0 flex-col" :data-map-state="state">
    <iframe
      v-if="srcdoc" ref="frame" :srcdoc="srcdoc" :title="title"
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" allow="fullscreen; geolocation"
      class="block w-full min-h-0 border-0" :class="described ? 'flex-1' : ''" :style="described ? undefined : {height: height + 'px'}"
      @load="onLoad"
    />
    <div v-else class="w-full" :class="described ? 'flex-1' : ''" :style="described ? undefined : {height: height + 'px'}" />
    <ul v-if="messages.length" class="map-frame-messages m-0 list-none space-y-1 border-t border-muted p-3 font-mono text-sm" role="log" aria-label="Errors and messages of the code">
      <li v-for="(message, index) in messages" :key="index" :class="message.level === 'error' ? 'text-error' : 'text-warning'">
        <span class="font-medium">{{ message.level === 'error' ? 'Error' : 'Warning' }}<template v-if="message.line">, line {{ message.line }}</template>:</span>
        {{ message.text }}
      </li>
    </ul>
  </div>
</template>
