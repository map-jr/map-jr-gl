<!--
  The code of an example of examples/ on a recipe page, with the map that it makes above it. website/build/markdown.ts
  makes this block from the marks "example:<id>:start" and "example:<id>:end" of docs/recipes/, and the default slot is
  the group of the variants of the code.

  The map runs the variant that the reader reads when a frame can run it (Main API, MapLibre compat, <map-jr>), and
  the Main API variant otherwise. "Edit" replaces the code with an editor of the code that the map runs; the editor
  (CodeEditor.vue, with CodeMirror) is loaded only then. The code comes from the code block of the page, so the
  editor starts with the text that the reader sees. The editor takes the height of the code that it replaces, so that
  the page does not move when the reader opens or closes it (#1538).
-->
<script setup lang="ts">
import {shownVariant, variantOfSlug} from '~~/build/variants';
import {languageOf, runsInFrame} from '~/utils/map-frame';

const props = defineProps<{id: string}>();
const {choice} = useCodeVariant();
const root = useTemplateRef<HTMLElement>('root');
const frame = useTemplateRef<{run: () => void}>('frame');
const variants = useTemplateRef<HTMLElement>('variants');

// The text of each variant of the group, by its slug, read from the code blocks once the page is in the browser.
const texts = ref<Record<string, string>>({});
const available = ref<string[]>([]);
onMounted(() => {
    for (const panel of root.value?.querySelectorAll<HTMLElement>('.code-variant[data-variant]') ?? []) {
        const pre = panel.querySelector('.code-desktop pre') ?? panel.querySelector('pre');
        if (pre?.textContent) texts.value[panel.dataset.variant!] = pre.textContent.replace(/\n$/, '');
    }
    available.value = Object.keys(texts.value);
});

const shown = computed(() => shownVariant(available.value, choice.value));
const running = computed(() => runsInFrame(shown.value) ? shown.value : 'main');
const label = (slug: string | undefined) => variantOfSlug(slug)?.label ?? '';

// While the reader edits, the map runs the edited form, also when the reader chooses another variant.
const editing = ref<'main' | 'compat' | 'element'>();
const draft = ref('');
const ran = ref('');
const editorHeight = ref(0);
const form = computed(() => editing.value ?? running.value);
const code = computed(() => editing.value ? ran.value : texts.value[running.value] ?? '');

function edit() {
    editorHeight.value = variants.value?.getBoundingClientRect().height ?? 0;
    editing.value = running.value;
    draft.value = ran.value = texts.value[running.value] ?? '';
}
function run() {
    if (ran.value === draft.value) frame.value?.run();
    else ran.value = draft.value;
}
function reset() {
    draft.value = texts.value[editing.value!] ?? '';
    run();
}
function close() {
    editing.value = undefined;
}
</script>

<template>
  <div :id="`example-${props.id}`" ref="root" class="live-example my-5">
    <div class="overflow-hidden rounded-md border border-muted bg-(--site-sheet)">
      <MapFrame v-if="code" ref="frame" :form="form" :code="code" :title="`The map of the ${label(form)} code`" />
      <div v-else class="h-130" />
      <div class="flex flex-wrap items-center gap-2 border-t border-muted px-3 py-2">
        <p class="me-auto text-sm text-muted">
          <template v-if="editing">Editing the {{ label(editing) }} code. Run it with Ctrl+Enter (⌘+Enter on a Mac).</template>
          <template v-else-if="shown && shown !== running">
            The map runs the Main API code. The {{ label(shown) }} code needs a {{ label(shown) }} application, so it does not run on this page.
          </template>
          <template v-else>The map runs the {{ label(running) }} code below.</template>
        </p>
        <template v-if="editing">
          <UButton size="sm" icon="i-lucide-play" @click="run">Run</UButton>
          <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-rotate-ccw" @click="reset">Reset</UButton>
          <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-x" @click="close">Close the editor</UButton>
        </template>
        <UButton v-else size="sm" color="neutral" variant="outline" icon="i-lucide-pencil" :disabled="!code" @click="edit">Edit the {{ label(running) }} code</UButton>
      </div>
    </div>
    <LazyCodeEditor
      v-if="editing" v-model="draft" :language="languageOf(editing)" :label="`The ${label(editing)} code of the example`"
      class="rounded-md border border-muted" :class="editorHeight ? '' : 'h-128'"
      :style="editorHeight ? {height: `${editorHeight}px`} : undefined" @run="run"
    />
    <div v-show="!editing" ref="variants">
      <slot />
    </div>
  </div>
</template>
