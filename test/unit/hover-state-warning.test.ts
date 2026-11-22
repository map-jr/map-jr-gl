// The warning of `hoverState` for a feature with no id gives the advice that works for the type of the source (#1159).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {check, type Checked} from '../../src/mistakes.ts';

const said = (type: string) => {
    const warnings: string[] = [], warn = console.warn;
    console.warn = (m: string) => { warnings.push(m); };
    try {
        const c = {map: {getSource: (id: string) => id === 's' ? {type} : undefined}, warned: new Set<string>(), spec: () => ({}), ready: () => false} as unknown as Checked;
        check(c, 9, 'fills', 's');
    } finally { console.warn = warn; }
    return warnings.join('\n');
};

test('hoverState: a GeoJSON source gets the advice for promoteId and generateId', () => {
    const w = said('geojson');
    assert.ok(w.includes('"promoteId" of the source') && w.includes('generateId: true'), w);
});

test('hoverState: a vector source is advised to write ids into the tiles or to set promoteId, not generateId', () => {
    const w = said('vector');
    assert.ok(w.includes('layer "fills"') && w.includes('into the tiles') && w.includes('"promoteId"') && !w.includes('generateId'), w);
});
