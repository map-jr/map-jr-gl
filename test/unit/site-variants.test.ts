// The choice of the code variant on the docs site (website/build/variants.ts): which panel of a group shows, and the
// attribute `data-shows` that lets CSS show it before any script of the page runs.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {showsOf, shownVariant, variantHeadScript, variantKey, variants} from '../../website/build/variants.ts';

test('a group shows the chosen variant when it has it', () => {
    assert.equal(shownVariant(['main', 'compat', 'vue'], 'compat'), 'compat');
});

test('Nuxt falls back to Vue and Vue to Nuxt, any other choice to the first variant', () => {
    assert.equal(shownVariant(['main', 'vue', 'react'], 'nuxt'), 'vue');
    assert.equal(shownVariant(['main', 'nuxt'], 'vue'), 'nuxt');
    assert.equal(shownVariant(['main', 'vue'], 'svelte'), 'main');
    assert.equal(shownVariant(['main', 'vue'], null), 'main');
    assert.equal(shownVariant([], 'main'), undefined);
});

test('every choice and "none" show exactly one panel of a group, the one that shownVariant gives', () => {
    const available = ['compat', 'vue', 'react'];
    const shows = showsOf(available);
    for (const choice of [...variants.map(variant => variant.slug), 'none']) {
        const showing = available.filter(slug => shows[slug]!.split(' ').includes(choice));
        assert.deepEqual(showing, [shownVariant(available, choice === 'none' ? null : choice)], choice);
    }
});

function runHeadScript(stored: string | null | Error) {
    const attributes: Record<string, string> = {};
    const localStorage = {getItem(key: string) {
        assert.equal(key, variantKey);
        if (stored instanceof Error) throw stored;
        return stored;
    }};
    const document = {documentElement: {setAttribute: (name: string, value: string) => { attributes[name] = value; }}};
    new Function('localStorage', 'document', variantHeadScript)(localStorage, document);
    return attributes['data-variant'];
}

test('the script in the head sets data-variant from the storage, and "none" for a missing, unknown or blocked value', () => {
    assert.equal(runHeadScript('react'), 'react');
    assert.equal(runHeadScript(null), 'none');
    assert.equal(runHeadScript('react"><script>'), 'none');
    assert.equal(runHeadScript(new Error('SecurityError')), 'none');
});
