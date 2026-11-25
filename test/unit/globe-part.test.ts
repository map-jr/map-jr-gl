// The size passes of #2006 and #2075: the globe, with the GLSL of its programs, is a part of the worker
// (map-jr-gl-worker-globe.js), and the server renderer reads the members of Math through the names of the plugin global-names.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('the worker file has no globe code, and the part of the globe has it', () => {
    const sources = (file: string) => JSON.parse(readFileSync(`dist/${file}.map`, 'utf8')).sources.map((s: string) => s.replace(/^.*\/src\//, 'src/'));
    assert.ok(!sources('map-jr-gl-worker.js').includes('src/globe.ts'));
    assert.ok(sources('map-jr-gl-worker-globe.js').includes('src/globe.ts'));
    assert.match(readFileSync('dist/map-jr-gl-worker-globe.js', 'utf8'), /^var MapJrPart=/m);
});

test('the GLSL of the globe and of its atmosphere is in the part of the globe, and not in the worker file (#2075)', () => {
    // (32766.5 is the test for a pole of `GLOBE_GLSL`, 6471e3 the radius of the atmosphere of `HALO`.)
    const worker = readFileSync('dist/map-jr-gl-worker.js', 'utf8'), part = readFileSync('dist/map-jr-gl-worker-globe.js', 'utf8');
    for (const glsl of ['32766.5', '6471e3']) {
        assert.ok(!worker.includes(glsl), `the worker file has ${glsl}`);
        assert.ok(part.includes(glsl), `the part of the globe has no ${glsl}`);
    }
    assert.match(worker, /#ifdef GLOBE\nGLOBE_GLSL\n#else/, 'VS_COMMON keeps the place of the code of the globe');
});

test('the server renderer has no globe code and reads each member of Math once', () => {
    const code = readFileSync('dist/server.js', 'utf8'), reads = code.match(/\bMath\.\w+/g) ?? [];
    assert.ok(!JSON.parse(readFileSync('dist/server.js.map', 'utf8')).sources.some((s: string) => s.endsWith('/src/globe.ts')));
    assert.equal(reads.length, new Set(reads).size, reads.join(' '));
});
