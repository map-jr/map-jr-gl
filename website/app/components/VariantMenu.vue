<!--
  The choice of the variant of the code, in the header. It shows on a page that has a group of variants, and lists
  the variants of that page. The label of the button is in the HTML once for each variant, and CSS shows the one
  that the reader's choice selects, so that the button has its final width at the first paint.
-->
<script setup lang="ts">
import type {DropdownMenuItem} from '@nuxt/ui';
import {showsOf, shownVariant, variantOfSlug} from '~~/build/variants';

const route = useRoute();
const {pages} = await useDocs();
const {choice, choose} = useCodeVariant();

const slugs = computed(() => {
    const path = route.path.replace(/(.)\/$/, '$1');
    return (pages.value.find(page => page.path === path)?.variants ?? []).filter(slug => variantOfSlug(slug));
});
const shows = computed(() => showsOf(slugs.value));
const shown = computed(() => shownVariant(slugs.value, choice.value));
const items = computed<DropdownMenuItem[]>(() => [
    {label: 'Show the code for', type: 'label'},
    ...slugs.value.map(slug => ({
        label: variantOfSlug(slug)!.label,
        type: 'checkbox' as const,
        checked: shown.value === slug,
        onSelect: () => choose(slug),
    })),
]);
</script>

<template>
  <UDropdownMenu v-if="slugs.length" :items="items" :content="{align: 'end'}">
    <UButton
      color="neutral" variant="outline" size="sm" icon="i-lucide-code-xml" trailing-icon="i-lucide-chevron-down"
      class="variant-menu max-w-36 sm:max-w-none"
    >
      <span class="truncate">
        <span class="sr-only">Variant of the code: </span>
        <span v-for="slug in slugs" :key="slug" class="variant-label" :data-shows="shows[slug]">{{ variantOfSlug(slug)!.label }}</span>
      </span>
    </UButton>
  </UDropdownMenu>
</template>
