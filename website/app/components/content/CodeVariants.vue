<!--
  A group of fences, one for each variant of the code, or one for each package manager when `set` is "pm"
  (website/build/markdown.ts makes it from adjacent fences with labels of one set). Each fence is a panel in the
  default slot, and every panel is in the HTML. CSS shows the panel and marks the tab that the reader's choice
  selects (app/assets/css/main.css, "Code variants"), so the first paint needs no script of the page. A click on a
  tab changes the choice of its set on the whole site. The panels differ in height, and the choice also changes the
  groups above, so a choice scrolls the page by what moved the tab bar: the tab bar stays where the reader clicked it
  (#1538). Reserving the height of the tallest panel would leave up to about 550 px empty under a short one.
-->
<script setup lang="ts">
import {setOfId, showsOf, shownVariant, variantOfSlug} from '~~/build/variants';

const props = defineProps<{id: string; variants: string; set?: string}>();
const set = setOfId(props.set ?? 'code');
const {choice, choose} = useCodeVariant(set);

const slugs = computed(() => props.variants.split(' ').filter(slug => variantOfSlug(slug, set)));
const shows = computed(() => showsOf(slugs.value, set));
const shown = computed(() => shownVariant(slugs.value, choice.value, set));
const tabs = useTemplateRef<HTMLButtonElement[]>('tabs');
const tablist = useTemplateRef<HTMLElement>('tablist');

// `choose` sets the attribute on <html> at once. The parts that Vue draws from the choice (the line of a live example)
// follow on the next tick, and the map frame of a live example takes the height of its new document later, so the tab
// bar is held at its place while the page changes size, for two seconds or until the reader scrolls.
let release: (() => void) | undefined;
function chooseInPlace(slug: string) {
    release?.();
    const bar = tablist.value;
    const place = bar?.getBoundingClientRect().top;
    choose(slug);
    if (!bar || place === undefined) return;
    const hold = () => {
        const moved = bar.getBoundingClientRect().top - place;
        if (Math.abs(moved) >= 1) window.scrollBy({top: moved, behavior: 'instant'});
    };
    const observer = new ResizeObserver(hold);
    observer.observe(document.body);
    const stop = () => release?.();
    const timer = setTimeout(stop, 2000);
    addEventListener('wheel', stop, {passive: true});
    addEventListener('touchmove', stop, {passive: true});
    addEventListener('keydown', stop);
    release = () => {
        observer.disconnect();
        clearTimeout(timer);
        removeEventListener('wheel', stop);
        removeEventListener('touchmove', stop);
        removeEventListener('keydown', stop);
        release = undefined;
    };
    void nextTick(hold);
}
onBeforeUnmount(() => release?.());

// The arrow keys, Home and End move between the tabs and select the tab, as in the tabs pattern of WAI-ARIA.
function onKeydown(event: KeyboardEvent, index: number) {
    const last = slugs.value.length - 1;
    const next = {ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: last}[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const target = next < 0 ? last : next > last ? 0 : next;
    chooseInPlace(slugs.value[target]!);
    tabs.value?.[target]?.focus();
}
</script>

<template>
  <div :id="props.id" class="code-variants my-5">
    <div ref="tablist" role="tablist" :aria-label="set.name" class="flex items-center gap-1 overflow-x-auto rounded-t-md border border-b-0 border-muted bg-(--site-pre-header-bg) p-2">
      <button
        v-for="(slug, index) in slugs" :id="`${props.id}-tab-${slug}`" :key="slug" ref="tabs" type="button" role="tab"
        :aria-controls="`${props.id}-${slug}`" :aria-selected="shown === slug" :tabindex="shown === slug ? 0 : -1"
        v-bind="{[set.showsAttribute]: shows[slug]}"
        class="code-variants-tab shrink-0 rounded-md px-2 py-1.5 text-sm text-default transition-colors hover:bg-elevated/50 outline-primary/25 focus-visible:outline-3"
        @click="chooseInPlace(slug)" @keydown="onKeydown($event, index)"
      >
        {{ variantOfSlug(slug, set)!.label }}
      </button>
    </div>
    <slot />
  </div>
</template>
