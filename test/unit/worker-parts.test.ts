// The parts of the worker that load on demand (#79, src/parts.ts).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setPartLoader, part, type PartName} from '../../src/parts.ts';
import {TileBuilder} from '../../src/tiles.ts';

const src = (f: string) => readFileSync(new URL(`../../src/${f}`, import.meta.url), 'utf8');
const parts = [...src('parts.ts').matchAll(/^ {4}(\w+): \(\) => import\('\.\/([\w-]+)\.ts'\),$/gm)].map(m => ({name: m[1], file: m[2]}));

test('each part of the worker has its URL on the page, and the worker file exports what the part imports', () => {
    assert.deepEqual(parts.map(p => p.name), ['geojson', 'dem', 'pmtiles', 'within', 'globe', 'subdivide', 'layers', 'query', 'colors']);
    const loader = src('loader.ts'), worker = src('worker.ts');
    const exported = new Set([...worker.matchAll(/^export \{([^}]+)\} from/gm)].flatMap(m => m[1].split(',').map(s => s.trim())));
    for (const {name, file} of parts) {
        assert.ok(loader.includes(`${name}: at('${name}', () => new URL(/* @vite-ignore */ './map-jr-gl-worker-${name}.js?no-inline', import.meta.url))`), `loader.ts has no URL for the part ${name}`);
        // (A part file reads the modules that it imports from the worker file: a name that is not exported would be undefined.)
        // (A part made of other modules, as dem.ts is, imports what they import.)
        const own = [file, ...[...src(file + '.ts').matchAll(/^export \* from '\.\/([\w-]+)\.ts';$/gm)].map(m => m[1])];
        // (The import of one of these modules by another, as engine-query.ts imports query.ts, is inside the part file.)
        for (const m of own.map(f => src(f + '.ts')).join('\n').matchAll(/^import \{([^}]+)\} from '\.\/([\w-]+)\.ts';$/gm))
            if (!own.includes(m[2])) for (const n of m[1].split(',').map(s => s.trim().split(' as ')[0]).filter(s => !s.startsWith('type '))) assert.ok(exported.has(n), `worker.ts does not export ${n}, which the part ${name} imports`);
    }
});

test('a tile of a GeoJSON source that is asked for while the part loads waits for the data, and a part that fails is asked for once', async () => {
    const asked: PartName[] = [];
    setPartLoader(async name => {
        asked.push(name);
        await new Promise(r => setTimeout(r, 30));
        if (name === 'dem') throw new Error('no dem part');
        return import(`../../src/${name}.ts`);
    });
    const b = new TileBuilder();
    b.setStyle([{id: 'c', type: 'circle', source: 'g'}]);
    b.setGeoJSON('g', {type: 'Point', coordinates: [10, 20]});
    const ir = await b.loadIR({id: 1, source: 'g', url: 'geojson://g/0/0/0', z: 0, overscaled: false});
    assert.ok(Object.keys(ir.layers).length > 0, JSON.stringify(ir));
    await assert.rejects(part('dem'), /no dem part/);
    await assert.rejects(part('dem'), /no dem part/);
    assert.deepEqual(asked, ['geojson', 'dem']);
});

test('a style that uses "within" loads its part once, and its tiles wait for the part and get its result (#1707)', async () => {
    const asked: PartName[] = [];
    setPartLoader(async name => { asked.push(name); await new Promise(r => setTimeout(r, 30)); return import(`../../src/${name}.ts`); });
    const b = new TileBuilder(), square = {type: 'Polygon', coordinates: [[[0, 0], [0, 5], [5, 5], [5, 0], [0, 0]]]};
    b.setStyle([{id: 'c', type: 'circle', source: 'g', paint: {'circle-color': ['case', ['within', square], '#f00', '#00f']}}]);
    b.setGeoJSON('g', {type: 'FeatureCollection', features: [[2, 2], [8, 8]].map(c => ({type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: c}}))});
    const ir = await b.loadIR({id: 1, source: 'g', url: 'geojson://g/0/0/0', z: 0, at: [0, 0, 0], overscaled: false});
    assert.deepEqual(Array.from((ir.layers.c as any).color), [255, 0, 0, 255, 0, 0, 255, 255]);
    assert.equal(asked.filter(n => n === 'within').length, 1);
});
