// The parts of the worker that load on demand (#79, src/parts.ts).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setPartLoader, part, type PartName} from '../../src/parts.ts';
import {TileBuilder} from '../../src/tiles.ts';

const src = (f: string) => readFileSync(new URL(`../../src/${f}`, import.meta.url), 'utf8');
const parts = [...src('parts.ts').matchAll(/^ {4}(\w+): \(\) => import\('\.\/([\w-]+)\.ts'\),$/gm)].map(m => ({name: m[1], file: m[2]}));

test('each part of the worker has its URL on the page, and the worker file exports what the part imports', () => {
    assert.deepEqual(parts.map(p => p.name), ['geojson', 'contour', 'pmtiles']);
    const loader = src('loader.ts'), worker = src('worker.ts');
    const exported = new Set([...worker.matchAll(/^export \{([^}]+)\} from/gm)].flatMap(m => m[1].split(',').map(s => s.trim())));
    for (const {name, file} of parts) {
        assert.ok(loader.includes(`${name}: at('${name}', new URL(/* @vite-ignore */ './map-jr-gl-worker-${name}.js?no-inline', import.meta.url))`), `loader.ts has no URL for the part ${name}`);
        // (A part file reads the modules that it imports from the worker file: a name that is not exported would be undefined.)
        for (const m of src(file + '.ts').matchAll(/^import \{([^}]+)\} from '\.\/[\w-]+\.ts';$/gm))
            for (const n of m[1].split(',').map(s => s.trim()).filter(s => !s.startsWith('type '))) assert.ok(exported.has(n), `worker.ts does not export ${n}, which the part ${name} imports`);
    }
});

test('a tile of a GeoJSON source that is asked for while the part loads waits for the data, and a part that fails is asked for once', async () => {
    const asked: PartName[] = [];
    setPartLoader(async name => {
        asked.push(name);
        await new Promise(r => setTimeout(r, 30));
        if (name === 'contour') throw new Error('no contour part');
        return import(`../../src/${name}.ts`);
    });
    const b = new TileBuilder();
    b.setStyle([{id: 'c', type: 'circle', source: 'g'}]);
    b.setGeoJSON('g', {type: 'Point', coordinates: [10, 20]});
    const ir = await b.loadIR({id: 1, source: 'g', url: 'geojson://g/0/0/0', z: 0, overscaled: false});
    assert.ok(Object.keys(ir.layers).length > 0, JSON.stringify(ir));
    await assert.rejects(part('contour'), /no contour part/);
    await assert.rejects(part('contour'), /no contour part/);
    assert.deepEqual(asked, ['geojson', 'contour']);
});
