// The production form of the messages (#2148, step 2; scripts/message-codes.mjs): the build keeps the code, the link and
// the values of a message, and drops its text.
import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error (a module of the build, without types)
import {productionMessages} from '../../scripts/message-codes.mjs';

/** The source after the edits of the build. */
const built = (code: string, file = '/x/src/a.ts'): string => productionMessages(code, file)?.code ?? code;
/** The message that the built source gives, with `x` and `y` as values. */
const said = (expression: string) => new Function('x', 'y', 'return ' + built(expression))('roads', 404);

test('a string with a code keeps the prefix, the code and the link', () => {
    assert.equal(said(`'[map-jr-gl] E97 The map has no container.'`), '[map-jr-gl] E97 https://map-jr.org/e/97');
    assert.equal(said(`'E259 addControl(): the argument is not a control.'`), 'E259 https://map-jr.org/e/259');
});

test('a template keeps its values in their order, with a space before each, and drops a choice between two texts', () => {
    assert.equal(said('`[map-jr-gl] E1163 the request for the ${x} failed: HTTP ${y}.`'), '[map-jr-gl] E1163 https://map-jr.org/e/1163 roads 404');
    assert.equal(said('`[map-jr-gl] E255 getSource("${x}").${y > 1 ? \'setUrl(url): wrong\' : \'setTiles(tiles): wrong\'}.`'), '[map-jr-gl] E255 https://map-jr.org/e/255 roads');
});

test('a chain of + keeps its values and drops each piece of text, and a ? : of two texts', () => {
    assert.equal(said(`'[map-jr-gl] E65 the container ' + x + ' is ' + (y > 1 ? 'big' : 'small') + '.'`), '[map-jr-gl] E65 https://map-jr.org/e/65 roads');
    assert.equal(said('`[map-jr-gl] E20017 The map cannot be shown: ${x}.` + (/W/.test(x) ? \' Call supported().\' : \'\')'), '[map-jr-gl] E20017 https://map-jr.org/e/20017 roads');
});

test('a text with no code, and a text with a code after the name of a method, are not changed', () => {
    assert.equal(said(`'[map-jr-gl] ' + x`), '[map-jr-gl] roads');
    assert.equal(said('`[map-jr-gl] ${x}(): ${y}`'), '[map-jr-gl] roads(): 404');
});

test('the messages of src/host.ts whose code is added at run time keep the code and the link', () => {
    const code = "const reject = (code, a, short) => Promise.reject(1).then(() => '', () => '[map-jr-gl] E' + code + ' ' + short);\n"
        + 'function complete(spec, method, fix) { if (!spec?.style) throw new Error(`[map-jr-gl] E57 ${method}(): the description has no "style". ${fix}`); }\n'
        + "complete({}, 'createMap', 'Pass a style.'); reject(9, 'x', 'queryFeatures(): the place is not a place.');";
    const out = built(code, '/x/src/host.ts');
    assert.ok(out.includes("'[map-jr-gl] E' + code + ' https://map-jr.org/e/' + code"), out);
    assert.ok(out.includes('throw new Error(`[map-jr-gl] E57 https://map-jr.org/e/57 ${method}`)'), out);
    assert.ok(out.includes("complete({}, 'createMap', '')") && out.includes("reject(9, 'x', '')"), out);
    assert.throws(() => built("const said = '[map-jr-gl] E1 text';", '/x/src/host.ts'), /src\/host\.ts has no text/);
});
