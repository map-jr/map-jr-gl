// The production form of the messages (#2148, step 2; scripts/message-codes.mjs): the build keeps the code, the link and
// the values of a message, and drops its text.
import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error (a module of the build, without types)
import {productionMessages, productionNames} from '../../scripts/message-codes.mjs';

/** The source after the edits of the build. */
const built = (code: string, file = '/x/src/a.ts'): string => productionMessages(code, file)?.code ?? code;
/** The message that the built source gives, with `source` and `status` as values. */
const said = (expression: string) => new Function('source', 'status', 'return ' + built(expression))('roads', 404);

test('a string with a code keeps the prefix, the code and the link', () => {
    assert.equal(said(`'[map-jr-gl] E97 The map has no container.'`), '[map-jr-gl] E97 https://map-jr.org/e/97');
    assert.equal(said(`'E259 addControl(): the argument is not a control.'`), 'E259 https://map-jr.org/e/259');
});

test('a template keeps its values in their order, with a space before each, and drops a choice between two texts', () => {
    assert.equal(said('`[map-jr-gl] E1163 the request for the ${source} failed: HTTP ${status}.`'), '[map-jr-gl] E1163 https://map-jr.org/e/1163 source="roads" status=404');
    assert.equal(said('`[map-jr-gl] E255 getSource("${source}").${status > 1 ? \'setUrl(url): wrong\' : \'setTiles(tiles): wrong\'}.`'), '[map-jr-gl] E255 https://map-jr.org/e/255 source="roads"');
});

test('a chain of + keeps its values and drops each piece of text, and a ? : of two texts', () => {
    assert.equal(said(`'[map-jr-gl] E65 the container ' + source + ' is ' + (status > 1 ? 'big' : 'small') + '.'`), '[map-jr-gl] E65 https://map-jr.org/e/65 source="roads"');
    assert.equal(said('`[map-jr-gl] E20017 The map cannot be shown: ${source}.` + (/W/.test(source) ? \' Call supported().\' : \'\')'), '[map-jr-gl] E20017 https://map-jr.org/e/20017 source="roads"');
});

test('a text that ends with a space keeps one, so that a message after it stays apart', () => {
    assert.equal(said('`[map-jr-gl] E2106 The source "${source}": `') + 'E1163', '[map-jr-gl] E2106 https://map-jr.org/e/2106 source="roads" E1163');
    assert.equal(said(`'[map-jr-gl] E798 Worker rendering unavailable: '`), '[map-jr-gl] E798 https://map-jr.org/e/798 ');
});

test('a text with no code, a text with a code after the name of a method, and a text that a test of a message compares are not changed', () => {
    assert.equal(said(`'[map-jr-gl] ' + source`), '[map-jr-gl] roads');
    assert.equal(said('`[map-jr-gl] ${source}(): ${status}`'), '[map-jr-gl] roads(): 404');
    assert.equal(said(`source.startsWith('[map-jr-gl] E20017 ')`), false);
});

test('the messages of src/host.ts whose code is added at run time keep the code and the link', () => {
    const code = "const reject = (code, a, short) => Promise.reject(1).then(() => '', () => '[map-jr-gl] E' + code + ' ' + short);\n"
        + 'function complete(spec, method, fix) { if (!spec?.style) throw new Error(`[map-jr-gl] E57 ${method}(): the description has no "style". ${fix}`); }\n'
        + "complete({}, 'createMap', 'Pass a style.'); reject(9, 'x', 'queryFeatures(): the place is not a place.');";
    const out = built(code, '/x/src/host.ts');
    assert.ok(out.includes("'[map-jr-gl] E' + code + ' https://map-jr.org/e/' + code"), out);
    assert.ok(out.includes('throw new Error(`[map-jr-gl] E57 https://map-jr.org/e/57 method=${__mjrValue(method)}`)'), out);
    assert.ok(out.includes("complete({}, 'createMap', '')") && out.includes("reject(9, 'x', '')"), out);
    assert.throws(() => built("const said = '[map-jr-gl] E1 text';", '/x/src/host.ts'), /src\/host\.ts has no text/);
});

test('each value prints with the plain word of its expression as its name, a string in quotes and a number without', () => {
    const run = (expression: string) => new Function('layer', 'list', 'MAX_RUNS', 'return ' + built(expression))({id: 'roads'}, ['a', 'b'], 64);
    assert.equal(run('`[map-jr-gl] E2040 layer "${layer.id}": ${list.join(", ")} more than ${MAX_RUNS} runs of "${layer.id}".`'),
        '[map-jr-gl] E2040 https://map-jr.org/e/2040 id="roads" list="a, b" maxRuns=64');
    assert.throws(() => built('`[map-jr-gl] E1 the value ${v} is wrong.`'), /has no clear name\. Add it to the list "valueNames"/);
});

test('a path of Windows finds the names of valueNames, as a path with slashes does', () => {
    const code = '`[map-jr-gl] E2145 the member ${name} is not supported.`';
    for (const file of ['/x/src/compat-map.ts', 'D:\\a\\map-jr-gl\\src\\compat-map.ts']) {
        assert.deepEqual(productionNames(code, file), [[2145, ['member']]], file);
        assert.match(productionMessages(code, file)?.code ?? '', /E2145 https:\/\/map-jr\.org\/e\/2145 member=/, file);
    }
});
