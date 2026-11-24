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

test('the composable is auto-imported as useMapJr, not useMap (#389)', () => {
    const names = calls.imports.filter((i: any) => i.from === '@map-jr/map-jr-gl/vue').map((i: any) => i.as ?? i.name);
    assert.ok(names.includes('useMapJr'));
    assert.ok(!names.includes('useMap'));
});

test('the package is excluded from the pre-bundling of Vite, and other entries are kept', () => {
    const ex = nuxt.options.vite.optimizeDeps.exclude;
    assert.ok(ex.includes('other') && ex.includes('@map-jr/map-jr-gl') && ex.includes('@map-jr/map-jr-gl/vue'));
    const bare: any = {options: {}};
    mod.setup({}, bare);
    assert.ok(bare.options.vite.optimizeDeps.exclude.includes('@map-jr/map-jr-gl'));
});

test('every control of src/control-specs.ts is auto-imported as <name>Control (#1126)', async () => {
    const {readFile} = await import('node:fs/promises');
    const src = await readFile(new URL('../../src/control-specs.ts', import.meta.url), 'utf8');
    const exported = [...src.matchAll(/^export const (\w+)/gm)].map(m => m[1]);
    assert.ok(exported.length >= 8);
    // (The test above calls setup a second time, so each import is there twice.)
    const imported = calls.imports.filter((i: any) => i.from === '@map-jr/map-jr-gl/controls');
    assert.deepEqual([...new Set(imported.map((i: any) => i.name))].sort(), exported.sort());
    for (const i of imported) assert.equal(i.as, i.name + 'Control');
});

test('options of the module, such as the key mapJr of nuxt.config, give one warning (#1241)', () => {
    const warn = console.warn, seen: string[] = [];
    console.warn = (...args: unknown[]) => { seen.push(args.join(' ')); };
    try {
        mod.setup({}, {options: {}});
        assert.equal(seen.length, 0);
        mod.setup({style: 'x'}, {options: {}});
    } finally { console.warn = warn; }
    assert.equal(seen.length, 1);
    assert.match(seen[0], /^\[map-jr-gl\] nuxt\.config: .*has no options, so it ignores "style"\./);
});
