<!--
  Stop 7: the install command, the migration prompt with a copy button, and the migration guides. The prompt is the block of
  docs/migrate/prompt.md that /raw/migrate/prompt.md serves, as on the docs pages.
-->
<script setup lang="ts">
const command = 'pnpm add @map-jr/map-jr-gl';
const copied = ref('');
async function copy(name: string, text: () => Promise<string>) {
    try {
        await navigator.clipboard.writeText(await text());
        copied.value = name;
        setTimeout(() => { if (copied.value === name) copied.value = ''; }, 2000);
    } catch {
        if (name === 'prompt') window.open('/raw/migrate/prompt.md', '_blank');
    }
}
const prompt = async () => {
    const text = await $fetch<string>('/raw/migrate/prompt.md', {responseType: 'text'});
    return /^```[^\n]*\n([\s\S]*?)\n```$/m.exec(text)?.[1] ?? text;
};
</script>

<template>
  <div>
    <h2 class="font-display text-3xl tracking-tight text-highlighted">Install it</h2>
    <p class="mt-4 flex items-center justify-between gap-3 border border-accented bg-(--site-pre-bg) px-3 py-2 figure-text">
      <span><span class="select-none text-dimmed" aria-hidden="true">$ </span>{{ command }}</span>
      <UButton size="xs" color="neutral" variant="ghost" :icon="copied === 'install' ? 'i-lucide-check' : 'i-lucide-copy'" aria-label="Copy the install command" @click="copy('install', async () => command)" />
    </p>
    <p class="mt-5 text-toned">To move a project from MapLibre GL JS, give a coding agent the migration prompt.</p>
    <div class="mt-3 flex flex-wrap gap-3">
      <UButton :icon="copied === 'prompt' ? 'i-lucide-check' : 'i-lucide-sparkles'" @click="copy('prompt', prompt)">{{ copied === 'prompt' ? 'Copied' : 'Copy the migration prompt' }}</UButton>
      <UButton to="/migrate/from-maplibre" color="neutral" variant="outline">Migration guide</UButton>
    </div>
    <p class="mt-3 text-sm text-muted">
      More guides: <NuxtLink class="underline" to="/migrate/wrappers">wrappers such as react-map-gl</NuxtLink> and <NuxtLink class="underline" to="/migrate/compat-to-main-api">from the compat entry to the main API</NuxtLink>.
    </p>
  </div>
</template>
