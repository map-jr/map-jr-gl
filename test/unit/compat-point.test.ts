// The compat `Point` has every method of `Point` of `@mapbox/point-geometry` (as MapLibre GL JS bundles it), with the same results (#1718).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const g = globalThis as any;
g.__DEV__ = false; g.__VERSION__ = 'test';
const {Point} = await import('../../src/maplibre-compat.ts') as any;
// The test takes the source of `Point` from the bundle of MapLibre GL JS, which has it inline.
const bundle = readFileSync(new URL('../../node_modules/maplibre-gl/dist/maplibre-gl-dev.mjs', import.meta.url), 'utf8');
const start = bundle.indexOf('function Point(x, y)'), end = bundle.indexOf('};', bundle.indexOf('Point.convert = function')) + 2;
const Ref = new Function(`${bundle.slice(start, end)}; return Point;`)();

test('Point has each method of @mapbox/point-geometry with the same result', () => {
    const names = Object.keys(Ref.prototype).filter(n => n !== 'constructor');
    assert.ok(names.length >= 30, names.join());
    const args: Record<string, unknown[]> = {matMult: [[1, 2, 3, 4]], _matMult: [[1, 2, 3, 4]], rotate: [0.7], _rotate: [0.7],
        rotateAround: [0.7, {x: 2, y: -1}], _rotateAround: [0.7, {x: 2, y: -1}], mult: [2.5], _mult: [2.5], div: [3], _div: [3], angleWithSep: [2, -5]};
    for (const name of names) {
        const a = new Point(3.4, -7.6), b = new Ref(3.4, -7.6), arg = args[name] ?? [{x: 1.5, y: 2.5}];
        assert.equal(typeof a[name], 'function', name);
        const ra = a[name](...arg), rb = b[name](...arg);
        if (rb instanceof Ref) {
            assert.ok(ra instanceof Point, name);
            assert.deepEqual([ra.x, ra.y], [rb.x, rb.y], name);
            assert.equal(ra === a, rb === b, `${name} returns the same point`);
        } else assert.equal(ra, rb, name);
        assert.deepEqual([a.x, a.y], [b.x, b.y], `${name} changes the point the same way`);
    }
    assert.deepEqual(Point.convert({x: '1', y: 2}), new Point(1, 2));
    assert.throws(() => Point.convert({}), /Expected \[x, y\]/);
});
