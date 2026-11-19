<!--
  A group of fences, one for each variant of the code (website/build/markdown.ts makes it from adjacent fences with
  a variant label). Each fence is a panel in the default slot, and every panel is in the HTML. CSS shows the panel
  and marks the tab that the reader's choice selects (app/assets/css/main.css, "Code variants"), so the first paint
  needs no script of the page. A click on a tab changes the choice of the whole site.
-->
<script setup lang="ts">
import {showsOf, shownVariant, variantOfSlug} from '~~/build/variants';

const props = defineProps<{id: string; variants: string}>();
const {choice, choose} = useCodeVariant();

const slugs = computed(() => props.variants.split(' ').filter(slug => variantOfSlug(slug)));
const shows = computed(() => showsOf(slugs.value));
const shown = computed(() => shownVariant(slugs.value, choice.value));
const tabs = useTemplateRef<HTMLButtonElement[]>('tabs');

// The arrow keys, Home and End move between the tabs and select the tab, as in the tabs pattern of WAI-ARIA.
function onKeydown(event: KeyboardEvent, index: number) {
    const last = slugs.value.length - 1;
    const next = {ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: last}[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const target = next < 0 ? last : next > last ? 0 : next;
    choose(slugs.value[target]!);
    tabs.value?.[target]?.focus();
}
</script>

<template>
  <div :id="props.id" class="code-variants my-5">
    <div role="tablist" aria-label="Variant of the code" class="flex items-center gap-1 overflow-x-auto rounded-t-md border border-b-0 border-muted bg-default p-2">
      <button
        v-for="(slug, index) in slugs" :id="`${props.id}-tab-${slug}`" :key="slug" ref="tabs" type="button" role="tab"
        :aria-controls="`${props.id}-${slug}`" :aria-selected="shown === slug" :tabindex="shown === slug ? 0 : -1"
        :data-shows="shows[slug]"
        class="code-variants-tab shrink-0 rounded-md px-2 py-1.5 text-sm text-default transition-colors hover:bg-elevated/50 outline-primary/25 focus-visible:outline-3"
        @click="choose(slug)" @keydown="onKeydown($event, index)"
      >
        {{ variantOfSlug(slug)!.label }}
      </button>
    </div>
    <slot />
  </div>
</template>
