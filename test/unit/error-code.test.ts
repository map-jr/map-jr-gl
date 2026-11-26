// The field `code` of a thrown error (#2148; scripts/message-codes.mjs `errorCodes`, src/error-code.ts): the build wraps each
// `new Error(text)` whose text has a code, and `name` stays `Error`.
import {test} from 'node:test';
import {stripTypeScriptTypes} from 'node:module';
import assert from 'node:assert/strict';
// @ts-expect-error (a module of the build, without types)
import {errorCodes, productionMessages} from '../../scripts/message-codes.mjs';

const wrap = (code: string): string => errorCodes.transform(code, '/x/src/a.ts')?.code ?? code;
const run = (code: string, production = false) => {
    let source = wrap(code);
    if (production) source = productionMessages(source, '/x/src/a.ts')?.code ?? source;
    try { new Function(stripTypeScriptTypes(source))(); } catch (e) { return e as Error & {code?: string}; }
    throw new Error('did not throw');
};

test('an error with a code in its text carries the code in the field `code`, and its name stays Error', () => {
    const e = run("throw new Error(`[map-jr-gl] E63 Style ${'x'}: HTTP 404`);");
    assert.equal(e.code, 'E63');
    assert.equal(e.name, 'Error');
});

test('the production message carries the same code', () => {
    const e = run("const style = 'x'; throw new Error(`[map-jr-gl] E63 Style ${style}: HTTP 404`);", true);
    assert.equal(e.code, 'E63');
    assert.match(e.message, /^\[map-jr-gl\] E63 https:\/\/map-jr\.org\/e\/63/);
});

test('a TypeError, a `+` chain and a text without the prefix carry the code', () => {
    assert.equal(run("throw new TypeError('[map-jr-gl] E278 on(): bad.');").code, 'E278');
    assert.equal(run("const c = 1; throw new Error('[map-jr-gl] E65 createMap(): the container is ' + c + '.');").code, 'E65');
    assert.equal(run("throw new Error('E217 not a source.');").code, 'E217');
});

test('an error with no code is not changed', () => {
    assert.equal(run("throw new Error('plain');").code, undefined);
});
