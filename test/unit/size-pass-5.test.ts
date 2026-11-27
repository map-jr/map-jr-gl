// The size pass of #2342, in the built files: the worker file has one value function for its messages, one text for a
// part without a URL, no Symbol.toStringTag on its global and no comment in a shader, and the page script has
// CONTROL_CSS without the line breaks, which the standalone files and server.js keep. It runs after `pnpm build`.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';

const count = (text: string, part: string) => text.split(part).length - 1;

test('the worker file does not repeat the value function of its messages or the text of a part without a URL (#2342)', () => {
    const worker = readFileSync('dist/map-jr-gl-worker.js', 'utf8');
    assert.equal(count(worker, '==`string`?JSON.stringify('), 1);
    assert.equal(count(worker, 'The page sent no URL for the part'), 1);
    assert.ok(!worker.includes('Symbol.toStringTag'));
    assert.ok(!/`[^`]*\/\*[^`]*\*\/[^`]*void main/.test(worker), 'a shader of the worker file has a block comment');
    // (The names of SPEC leave out their layer type, which the module puts back.)
    assert.ok(!worker.includes('`fill-extrusion-height`') && worker.includes('`-height`'));
});

test('the page script has CONTROL_CSS without line breaks, and server.js keeps them (#2342)', () => {
    // (The chunks of the map of the production build and of the development build.)
    const map = readdirSync('dist').filter(f => f.endsWith('.js') && !f.includes('standalone') && f !== 'server.js').map(f => readFileSync('dist/' + f, 'utf8')).filter(code => code.includes(':where(.map-jr-map){position:relative'));
    assert.ok(map.length >= 2);
    for (const code of map) assert.ok(code.includes(':where(.map-jr-map){position:relative;overflow:hidden;font:12px/1.3 system-ui,sans-serif}:where(.map-jr-interactive)'));
    assert.ok(readFileSync('dist/server.js', 'utf8').includes('system-ui,sans-serif}\n:where(.map-jr-interactive)'));
});
