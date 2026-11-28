// The plugin spec-names of build.mjs: the built files leave the layer type out of the names of `SPEC` and put it back when
// the module loads, so `SPEC` has the same names as in src/style.ts (#2342).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// @ts-expect-error a script without type declarations
import {specNames} from '../../scripts/spec-names.mjs';
import {SPEC} from '../../src/style.ts';

const apply = (code: string) => {
    let out = code;
    for (const [start, end, text] of [...specNames(code)].reverse()) out = out.slice(0, start) + text + out.slice(end);
    return out;
};

test('the built SPEC leaves out the layer types (`text` in a symbol layer) and has the names of src/style.ts after it runs (#2342)', () => {
    const source = readFileSync(new URL('../../src/style.ts', import.meta.url), 'utf8');
    const start = source.indexOf('\nexport const SPEC'), end = source.indexOf('\n};\n', start) + 3;
    const out = apply(source.slice(start, end) + '\n');
    for (const name of ["'fill-opacity'", "'fill-extrusion-height'", "'line-dasharray'", "'color-relief-opacity'", "'text-field'"]) assert.ok(!out.includes(name), name);
    for (const name of ["'-opacity'", "'-height'", "'-field'", "'icon-image'", "'symbol-placement'", "'resampling'"]) assert.ok(out.includes(name), name);
    // (The literal of SPEC, without its types, run with the loop that follows it.)
    const js = out.replace(/^\nexport const SPEC: [^=]+= /, 'const SPEC = ') + '\nreturn SPEC;';
    const built = new Function('ANCHORS', js)([]) as typeof SPEC;
    for (const type of Object.keys(SPEC)) for (const key of Object.keys(SPEC[type])) assert.equal(built[type][key][0], SPEC[type][key][0], `${type}.${key}`);
});

test('specNames gives the same edits on a CRLF copy of a small SPEC (#2610)', () => {
    const lf = "\nexport const SPEC: X = {\n    fill: {\n        opacity: ['fill-opacity', 1],\n    },\n};\n";
    const crlf = lf.replace(/\n/g, '\r\n');
    assert.equal(specNames(crlf).length, specNames(lf).length);
    assert.ok(!apply(crlf).includes("'fill-opacity'"));
});
