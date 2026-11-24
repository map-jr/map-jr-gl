// The identity of a control of the description does not depend on the order of the properties of its options (#1236).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scale, styles} from '../../src/control-specs.ts';

test('the key of a control is the same for its options in any order, nested too', () => {
    assert.equal(scale({unit: 'imperial', maxWidth: 80}).key, scale({maxWidth: 80, unit: 'imperial'}).key);
    assert.equal(styles({entries: [{label: 'A', style: 'https://example.com/a.json', terrain: null}], position: 'top-left'}).key,
        styles({position: 'top-left', entries: [{terrain: null, style: 'https://example.com/a.json', label: 'A'}]}).key);
    assert.notEqual(scale({unit: 'imperial'}).key, scale({unit: 'metric'}).key);
    // (The order of an array is kept: a list in another order is another control.)
    assert.notEqual(styles({entries: [{label: 'A', style: 'a'}, {label: 'B', style: 'b'}]}).key, styles({entries: [{label: 'B', style: 'b'}, {label: 'A', style: 'a'}]}).key);
});
