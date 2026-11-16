// Unit test for #463: a glyph file that arrives does not throw away the labels on the map (they blinked after the
// switch from the globe to the flat map, which needed a new glyph file).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../../src/engine.ts';

test('glyphs arrived: the labels keep their state, and the labels are placed again at the next frame', () => {
    let invalidated = 0;
    const labels = new Map([['a', {opacity: 1}], ['b', {opacity: 0.5}]]);
    const e = Object.assign(Object.create(Engine.prototype), {labels, lastPlace: 1234, invalidate() { invalidated++; }});
    e.glyphsArrived();
    assert.equal(e.labels.size, 2, 'the labels on the map were thrown away, so they vanish and fade in again');
    assert.deepEqual(e.labels.get('a'), {opacity: 1});
    assert.equal(e.lastPlace, -Infinity, 'the labels that waited for the file are placed at the next frame');
    assert.equal(invalidated, 1);
});
