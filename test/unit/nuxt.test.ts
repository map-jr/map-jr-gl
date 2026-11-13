// What the module for Nuxt (src/nuxt.ts) registers, with a fake @nuxt/kit and a fake `nuxt`. Run with: pnpm test:unit
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
const fake = new URL('./fixtures/fake-nuxt-kit.mjs', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(
    `export async function resolve(s, c, next) { return s === '@nuxt/kit' ? {url: ${JSON.stringify(fake)}, shortCircuit: true} : next(s, c); }`));
const {calls} = await import(fake);
const mod = (await import('../../src/nuxt.ts')).default;

const nuxt = {options: {vite: {optimizeDeps: {exclude: ['other']}}}};
mod.setup({}, nuxt);

test('components and composables are registered by package specifier', () => {
    assert.deepEqual(calls.components.map((c: any) => [c.name, c.filePath]),
        [['MapJr', '@map-jr/map-jr-gl/vue'], ['MapOverlay', '@map-jr/map-jr-gl/vue'], ['MapImage', '@map-jr/map-jr-gl/vue']]);
    for (const i of calls.imports) assert.match(i.from, /^@map-jr\/map-jr-gl\/(vue|controls)$/);
    assert.ok(calls.imports.some((i: any) => i.as === 'navigationControl' && i.from === '@map-jr/map-jr-gl/controls'));
});

test('the package is excluded from the pre-bundling of Vite, and other entries are kept', () => {
    const ex = nuxt.options.vite.optimizeDeps.exclude;
    assert.ok(ex.includes('other') && ex.includes('@map-jr/map-jr-gl') && ex.includes('@map-jr/map-jr-gl/vue'));
    const bare: any = {options: {}};
    mod.setup({}, bare);
    assert.ok(bare.options.vite.optimizeDeps.exclude.includes('@map-jr/map-jr-gl'));
});
