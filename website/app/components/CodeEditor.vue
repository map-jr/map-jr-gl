<!--
  An editor of code (CodeMirror 6). A page loads it as <LazyCodeEditor>, so its code and CodeMirror are a file of their
  own that the browser loads only when the editor shows. Ctrl+Enter (⌘+Enter on a Mac) emits `run`. The colors of the
  tokens are those of the code blocks of the site (github-light-default and github-dark-default, #1209).
-->
<script setup lang="ts">
import {basicSetup} from 'codemirror';
import {EditorView, keymap} from '@codemirror/view';
import {EditorState, Prec} from '@codemirror/state';
import {syntaxHighlighting} from '@codemirror/language';
import {classHighlighter} from '@lezer/highlight';
import {javascript} from '@codemirror/lang-javascript';
import {html} from '@codemirror/lang-html';

const props = defineProps<{modelValue: string; language: 'js' | 'html'; label: string}>();
const emit = defineEmits<{'update:modelValue': [value: string]; run: []}>();

const host = useTemplateRef<HTMLElement>('host');
let view: EditorView | undefined;

const theme = EditorView.theme({
    '&': {backgroundColor: 'var(--site-sheet)', color: 'var(--ui-text)', fontSize: '0.8125rem'},
    '&.cm-focused': {outline: 'none'},
    '.cm-scroller': {fontFamily: 'var(--font-mono)', lineHeight: '1.6'},
    '.cm-content': {caretColor: 'var(--ui-text-highlighted)'},
    '.cm-gutters': {backgroundColor: 'var(--site-sheet)', color: 'var(--ui-text-dimmed)', border: 'none'},
    '.cm-activeLine, .cm-activeLineGutter': {backgroundColor: 'color-mix(in srgb, var(--ui-text) 5%, transparent)'},
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {backgroundColor: 'color-mix(in srgb, var(--ui-primary) 25%, transparent) !important'},
});

onMounted(() => {
    view = new EditorView({
        parent: host.value!,
        state: EditorState.create({
            doc: props.modelValue,
            extensions: [
                Prec.highest(keymap.of([{key: 'Mod-Enter', run: () => { emit('run'); return true; }}])),
                basicSetup,
                props.language === 'html' ? html() : javascript(),
                syntaxHighlighting(classHighlighter),
                theme,
                EditorView.contentAttributes.of({'aria-label': props.label}),
                EditorView.updateListener.of(update => { if (update.docChanged) emit('update:modelValue', update.state.doc.toString()); }),
            ],
        }),
    });
});
// A new value from the page (a reset, or another starting point) replaces the text.
watch(() => props.modelValue, value => {
    if (view && value !== view.state.doc.toString()) view.dispatch({changes: {from: 0, to: view.state.doc.length, insert: value}});
});
onBeforeUnmount(() => view?.destroy());
defineExpose({focus: () => view?.focus()});
</script>

<template>
  <div ref="host" class="code-editor min-h-0 overflow-hidden" />
</template>

<style>
.code-editor .cm-editor { height: 100%; }
.code-editor { --tok-keyword: #cf222e; --tok-string: #0a3069; --tok-comment: #6e7781; --tok-number: #0550ae; --tok-function: #8250df; --tok-type: #116329; --tok-attribute: #0550ae; --tok-invalid: #82071e; }
.dark .code-editor { --tok-keyword: #ff7b72; --tok-string: #a5d6ff; --tok-comment: #8b949e; --tok-number: #79c0ff; --tok-function: #d2a8ff; --tok-type: #7ee787; --tok-attribute: #79c0ff; --tok-invalid: #ffa198; }
.code-editor .tok-keyword, .code-editor .tok-operator { color: var(--tok-keyword); }
.code-editor .tok-string, .code-editor .tok-string2 { color: var(--tok-string); }
.code-editor .tok-comment, .code-editor .tok-meta { color: var(--tok-comment); }
.code-editor .tok-number, .code-editor .tok-bool, .code-editor .tok-atom, .code-editor .tok-literal { color: var(--tok-number); }
.code-editor .tok-definition, .code-editor .tok-className { color: var(--tok-function); }
.code-editor .tok-typeName { color: var(--tok-type); }
.code-editor .tok-propertyName { color: var(--tok-attribute); }
.code-editor .tok-invalid { color: var(--tok-invalid); }
</style>
