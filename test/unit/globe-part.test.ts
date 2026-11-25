// The size pass of #2006: the globe is a part of the worker (map-jr-gl-worker-globe.js), and the server renderer reads
// the members of Math through the names of the plugin global-names.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('the worker file has no globe code, and the part of the globe has it', () => {
    const sources = (file: string) => JSON.parse(readFileSync(`dist/${file}.map`, 'utf8')).sources.map((s: string) => s.replace(/^.*\/src\//, 'src/'));
    assert.ok(!sources('map-jr-gl-worker.js').includes('src/globe.ts'));
    assert.ok(sources('map-jr-gl-worker-globe.js').includes('src/globe.ts'));
    assert.match(readFileSync('dist/map-jr-gl-worker-globe.js', 'utf8'), /^var MapJrPart=/m);
});

test('the server renderer has no globe code and reads each member of Math once', () => {
    const code = readFileSync('dist/server.js', 'utf8'), reads = code.match(/\bMath\.\w+/g) ?? [];
    assert.ok(!JSON.parse(readFileSync('dist/server.js.map', 'utf8')).sources.some((s: string) => s.endsWith('/src/globe.ts')));
    assert.equal(reads.length, new Set(reads).size, reads.join(' '));
});
