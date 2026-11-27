// The plugin minify-css of build.mjs: the page scripts get CONTROL_CSS without its line breaks, and the rules stay the same (#2342).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// @ts-expect-error a script without type declarations
import {minifyControlCss} from '../../scripts/minify-css.mjs';
import {CONTROL_CSS} from '../../src/controls.ts';

const apply = (code: string) => {
    let out = code;
    for (const [start, end, text] of [...minifyControlCss(code)].reverse()) out = out.slice(0, start) + text + out.slice(end);
    return out;
};

test('a line break of CONTROL_CSS goes after { } ; and , and is one space elsewhere (#2342)', () => {
    const code = 'const a = `x\ny`;\nexport const CONTROL_CSS = `\n.a{b:c}\n.d\n  .e{f:g;\n  h:i}\n` +\n// a comment\n`.j,\n.k{l:m}\n`;\nconst n = `o\np`;\n';
    assert.equal(apply(code), 'const a = `x\ny`;\nexport const CONTROL_CSS = `.a{b:c}.d .e{f:g;h:i}` +\n// a comment\n`.j,.k{l:m}`;\nconst n = `o\np`;\n');
});

test('CONTROL_CSS of src/controls.ts loses only its line breaks and the indentation after them (#2342)', () => {
    const source = readFileSync(new URL('../../src/controls.ts', import.meta.url), 'utf8');
    const out = apply(source), start = out.indexOf('export const CONTROL_CSS = `');
    const built = new Function(`return ${out.slice(start + 'export const CONTROL_CSS = '.length, out.indexOf('`;\n', start) + 1)};`)() as string;
    assert.ok(!built.includes('\n'));
    assert.equal(built, CONTROL_CSS.replace(/\n[ \t]*/g, ''));
});
