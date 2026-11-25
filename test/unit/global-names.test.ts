// The plugin global-names of build.mjs: in the worker file, each read of a member of Math (and Array.isArray) becomes a
// name of one module, which the minifier shortens (#1948).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// @ts-expect-error a script without type declarations
import {aliasGlobals, globalsModule} from '../../scripts/global-names.mjs';

const apply = (code: string) => {
    const {edits, import: line} = aliasGlobals(code);
    let out = code;
    for (const [start, end, text] of [...edits].reverse()) out = out.slice(0, start) + text + out.slice(end);
    return out + (line ?? '');
};

test('Math.NAME and Array.isArray become the names of the module, and other reads stay', () => {
    assert.equal(apply('const a = Math.floor(x) * Math.PI; Array.isArray(a); Array.from(a); JSON.stringify(a); m.Math.max; Math[k];'),
        'const a = Math_floor(x) * Math_PI; Array_isArray(a); Array.from(a); JSON.stringify(a); m.Math.max; Math[k];\nimport {Math_floor, Math_PI, Array_isArray} from "\\u0000map-jr-globals";\n');
    assert.equal(apply('const a = 1;'), 'const a = 1;');
});

test('a module that has a name of the plugin, or that assigns to Math, stops the build', () => {
    assert.throws(() => aliasGlobals('const Math_floor = 1; Math.floor(2);'), /has the name Math_floor/);
    assert.throws(() => aliasGlobals('Math.random = () => 4;'), /assigns to Math\.random/);
});

test('the module exports each member of Math with its value', () => {
    const text = globalsModule();
    assert.match(text, /^export const Math_floor = Math\.floor;$/m);
    assert.match(text, /^export const Math_PI = Math\.PI;$/m);
    assert.match(text, /^export const Array_isArray = Array\.isArray;$/m);
    assert.doesNotMatch(text, /Array_from|Promise_/);
});

test('the built worker file reads no member of Math from Math', () => {
    // (The module of the names reads each member once.)
    const code = readFileSync('dist/map-jr-gl-worker.js', 'utf8'), reads = code.match(/\bMath\.\w+/g) ?? [];
    assert.equal(reads.length, new Set(reads).size, reads.join(' '));
});
