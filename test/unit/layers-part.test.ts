// The size pass of #2215: the shaders and the drawing code of the layer types heatmap, hillshade and color-relief are
// the part `layers` of the worker (map-jr-gl-worker-layers.js), and the worker file and server.js do not have them.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sources = (file: string) => JSON.parse(readFileSync(`dist/${file}.map`, 'utf8')).sources.map((s: string) => s.replace(/^.*\/src\//, 'src/'));

test('the code of the layer types heatmap, hillshade and color-relief is the part layers, and not in the worker file or server.js', () => {
    assert.ok(!sources('map-jr-gl-worker.js').includes('src/layers-more.ts'));
    assert.ok(!sources('server.js').includes('src/layers-more.ts'));
    assert.ok(sources('map-jr-gl-worker-layers.js').includes('src/layers-more.ts'));
    assert.match(readFileSync('dist/map-jr-gl-worker-layers.js', 'utf8'), /^var MapJrPart=/m);
    // (.3989422804 is the factor of the Gaussian of `heat`, 1.875 the base of the slope of `hillshade`.)
    const worker = readFileSync('dist/map-jr-gl-worker.js', 'utf8'), part = readFileSync('dist/map-jr-gl-worker-layers.js', 'utf8');
    for (const glsl of ['.3989422804', '1.875-']) {
        assert.ok(!worker.includes(glsl), `the worker file has ${glsl}`);
        assert.ok(part.includes(glsl), `the part layers has no ${glsl}`);
    }
});
