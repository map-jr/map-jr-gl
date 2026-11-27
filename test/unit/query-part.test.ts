// The size pass of #2342: the queries of features (src/engine-query.ts and src/query.ts) are the part `query` of the
// worker (map-jr-gl-worker-query.js), and the worker file and server.js do not have them.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sources = (file: string) => JSON.parse(readFileSync(`dist/${file}.map`, 'utf8')).sources.map((s: string) => s.replace(/^.*\/src\//, 'src/'));

test('the code of the queries of features is the part query, and not in the worker file or server.js', () => {
    for (const file of ['src/engine-query.ts', 'src/query.ts']) {
        assert.ok(!sources('map-jr-gl-worker.js').includes(file), `the worker file has ${file}`);
        assert.ok(!sources('server.js').includes(file), `server.js has ${file}`);
        assert.ok(sources('map-jr-gl-worker-query.js').includes(file), `the part query has no ${file}`);
    }
    // (The elevation of 3D terrain and of the contour lines stays in the worker file.)
    assert.ok(sources('map-jr-gl-worker.js').includes('src/elevation.ts'));
    assert.match(readFileSync('dist/map-jr-gl-worker-query.js', 'utf8'), /^var MapJrPart=/m);
    const worker = readFileSync('dist/map-jr-gl-worker.js', 'utf8'), part = readFileSync('dist/map-jr-gl-worker-query.js', 'utf8');
    assert.ok(!worker.includes('The query covers too many tiles'));
    assert.ok(part.includes('The query covers too many tiles'));
});
