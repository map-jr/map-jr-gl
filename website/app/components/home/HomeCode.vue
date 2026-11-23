<!--
  A block of code of the home page with the colors of the code blocks of the docs (utils/highlight.ts). `code` is the text
  or its lines. With `mark`, a line that is new since the last render is marked for a moment: a new key makes a new
  element, and the animation of the class runs once.
-->
<script setup lang="ts">
import {highlight} from '~/utils/highlight';

const props = defineProps<{code: string | string[]; mark?: boolean}>();
const lines = computed(() => (typeof props.code === 'string' ? props.code.split('\n') : props.code).map(line => ({line, pieces: highlight(line)})));
</script>

<template>
  <pre class="home-code"><code><span v-for="(item, index) in lines" :key="mark ? item.line : index" class="block" :class="mark ? 'home-code-new' : ''"><span v-for="(piece, at) in item.pieces" :key="at" :class="piece.kind ? `home-code-${piece.kind}` : ''">{{ piece.text }}</span>{{ item.line ? '' : ' ' }}</span></code></pre>
</template>

<style>
/* The colors of github-light-default and github-dark-default, the themes of the code blocks of the docs (nuxt.config.ts). */
.home-code { overflow-x: auto; font-family: var(--font-mono); font-size: 0.75rem; line-height: 1.65; color: var(--site-pre-fg); --c-comment: #6e7781; --c-string: #0a3069; --c-tag: #116329; --c-keyword: #cf222e; --c-number: #0550ae; --c-key: #0550ae; --c-call: #8250df; --c-added: #116329; --c-removed: #cf222e; }
.dark .home-code { --c-comment: #8b949e; --c-string: #a5d6ff; --c-tag: #7ee787; --c-keyword: #ff7b72; --c-number: #79c0ff; --c-key: #79c0ff; --c-call: #d2a8ff; --c-added: #7ee787; --c-removed: #ff7b72; }
.home-code-comment { color: var(--c-comment); }
.home-code-string { color: var(--c-string); }
.home-code-tag { color: var(--c-tag); }
.home-code-keyword { color: var(--c-keyword); }
.home-code-number { color: var(--c-number); }
.home-code-key { color: var(--c-key); }
.home-code-call { color: var(--c-call); }
.home-code-added { color: var(--c-added); }
.home-code-removed { color: var(--c-removed); }
@keyframes home-code-new { from { background-color: color-mix(in oklab, var(--ui-primary) 28%, transparent); } to { background-color: transparent; } }
.home-code-new { animation: home-code-new 1.6s ease-out; }
@media (prefers-reduced-motion: reduce) { .home-code-new { animation: none; } }
</style>
