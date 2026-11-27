import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fontsMistake, mistake} from '../../src/mistakes.ts';
import {fontFaces} from '../../src/resolve.ts';

test('fontFaces gives no font for a value that is not an object of font faces (#2422)', () => {
    for (const wrong of [['a.woff2'], 'ab.woff2', 5, true, null, undefined]) assert.deepEqual(fontFaces(wrong as never), []);
    assert.equal(fontFaces({'Open Sans': '/a.woff2'}).length, 1);
});

test('fontsMistake accepts an object of font faces and gives what was written for another shape (#2265)', () => {
    assert.equal(fontsMistake(undefined), '');
    assert.equal(fontsMistake(null), '');
    assert.equal(fontsMistake({}), '');
    assert.equal(fontsMistake({'Open Sans': '/a.woff2', 'Noto Sans': [{url: '/b.woff2', 'unicode-range': ['U+0000-00FF']}]}), '');
    const array = fontsMistake([{family: 'Open Sans', src: '/a.woff2'}]);
    assert.equal(array, '[{"family":"Open Sans","src":"/a.woff2"}]');
    for (const wrong of ['/a.woff2', 5, {'Open Sans': 5}, {'Open Sans': [{src: '/a'}]}]) assert.notEqual(fontsMistake(wrong), '');
    assert.ok(fontsMistake([{family: 'x'.repeat(200)}]).endsWith('...'));
});

test('the message of E2265 names the call, what was written and the object to write (#2265)', () => {
    const text = mistake(2265, 'addFonts()', fontsMistake([{family: 'Open Sans', src: '/a.woff2'}]));
    assert.match(text, /^\[map-jr-gl\] E2265 addFonts\(\): \[\{"family":"Open Sans","src":"\/a\.woff2"\}\] is not an object of font faces/);
    assert.match(text, /\{"Open Sans": "https:\/\/example\.com\/open-sans\.woff2"\}/);
});
