// The `on` of the compat `Evented`, and so of `Marker`, `Popup` and the evented controls, returns a `Subscription`
// as in MapLibre GL JS 6.17, and `unsubscribe()` removes that listener (#1901).
import {test} from 'node:test';
import assert from 'node:assert/strict';

const g = globalThis as any;
g.__DEV__ = false; g.__VERSION__ = 'test';
const {Evented, FullscreenControl} = await import('../../src/maplibre-compat.ts') as any;

for (const [name, make] of [['Evented', () => new Evented()], ['FullscreenControl', () => new FullscreenControl()]] as const) {
    test(`${name}: on returns a Subscription whose unsubscribe removes the listener`, () => {
        const o = make(), heard: string[] = [];
        const sub = o.on('x', () => heard.push('on'));
        assert.notEqual(sub, o);
        assert.equal(typeof sub.unsubscribe, 'function');
        o.once('x', () => heard.push('once'));
        (o.events ?? o).fire('x');
        sub.unsubscribe();
        (o.events ?? o).fire('x');
        assert.deepEqual(heard, ['on', 'once']);
        assert.equal(o.once('x', () => {}), o);
        assert.equal(o.off('x', () => {}), o);
    });
}
