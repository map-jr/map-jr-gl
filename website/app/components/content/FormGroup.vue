<script setup lang="ts">
// A code group that keeps the choice by label, and not by index as `sync` of the code group of Nuxt UI does.
// A group that does not have the chosen label shows its first tab and does not change the choice.
import type {VNode} from 'vue';

const slots = defineSlots<{default(): VNode[]}>();
const labels = computed(() => (slots.default?.() || [])
    .flatMap(node => (typeof node.type === 'symbol' ? (node.children as VNode[]) : [node]))
    .map(node => String(node.props?.filename ?? '')));

const key = 'map-jr-docs-form';
const chosen = useState<string | null>(key, () => null);
onMounted(() => {
    if (chosen.value === null) {
        try { chosen.value = localStorage.getItem(key); } catch { /* storage can be blocked */ }
    }
});
const model = computed({
    get: () => String(Math.max(0, labels.value.indexOf(chosen.value ?? ''))),
    set: (index: string) => {
        chosen.value = labels.value[Number(index)] ?? null;
        try { if (chosen.value) localStorage.setItem(key, chosen.value); } catch { /* storage can be blocked */ }
    },
});
</script>

<template>
  <ProseCodeGroup v-model="model">
    <slot />
  </ProseCodeGroup>
</template>
