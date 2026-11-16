// What the entry `@map-jr/map-jr-gl/maplibre-compat` has, read from the source as text: the methods of its `Map`, the
// methods that are accepted with no effect, the values and the types that it exports, and the events that it fires.
// ecosystem.mjs compares these with what plugins and wrappers for MapLibre GL JS use.
import {readFileSync} from 'node:fs';
import path from 'node:path';

/** The public method names of a class, read from source text (declaration files and the source of this library share this layout). */
export const methodsOf = (text, classNames) => {
    const names = new Set();
    for (const cls of classNames) {
        const start = text.search(new RegExp(`^(export )?(declare )?class ${cls.replace('$', '\\$')}\\b`, 'm'));
        if (start < 0) continue;
        for (const m of text.slice(start, text.indexOf('\n}', start)).matchAll(/^(?:\t|    |  )(?:(private|protected|static|readonly) )?(?:async )?([A-Za-z]\w*)(?:<[^>(]*>)?\(/gm)) {
            if (!m[1] && !['constructor', 'if', 'for', 'while', 'switch', 'return', 'function', 'catch'].includes(m[2])) names.add(m[2]);
        }
    }
    return names;
};

/**
 * The names that a module exports, read from its text. `values` has the classes, functions and constants, and `types`
 * has the names that exist only for TypeScript. A line `export * from` is not followed.
 */
export const exportsOf = text => {
    const values = new Set(), types = new Set();
    for (const m of text.matchAll(/^export (type )?\{([^}]*)\}/gm)) {
        for (const part of m[2].split(',').map(s => s.trim()).filter(Boolean)) {
            const isType = !!m[1] || part.startsWith('type ');
            (isType ? types : values).add(part.replace(/^type /, '').split(' as ').pop().trim());
        }
    }
    for (const m of text.matchAll(/^export (?:declare )?(?:abstract )?(?:const|let|var|function|class) (\w+)/gm)) values.add(m[1]);
    for (const m of text.matchAll(/^export (?:declare )?(?:type|interface) (\w+)/gm)) types.add(m[1]);
    return {values, types};
};

/** Reads the compat entry of the library at `root` (the folder that has `src/`). */
export function compatSurface(root) {
    const src = file => readFileSync(path.join(root, 'src', file), 'utf8');
    const core = src('map.ts'), compat = src('compat-map.ts'), entry = src('maplibre-compat.ts');
    // The map of the entry is the core class and the class that extends it.
    const methods = new Set([...methodsOf(core, ['Map']), ...methodsOf(compat, ['Map'])]);
    // The setters of the section "Accepted, with no effect" of src/compat-map.ts (the same rule as in api.mjs).
    const section = compat.split('// ---- Accepted, with no effect ----')[1]?.split('\n\n')[0] ?? '';
    const inert = new Set((section.match(/^    [a-z]\w*(?=\()/gm) ?? []).map(n => n.trim()).filter(n => /^set/.test(n)));
    const {values, types} = exportsOf(entry);
    // (The entry has `export type * from './compat-types.ts'`.)
    for (const name of exportsOf(src('compat-types.ts')).types) types.add(name);
    // An event counts if its name is in the source in quotes. The touch events are built from parts there, so they are listed.
    const sources = [core, compat, src('overlays.ts'), src('controls.ts')].join('\n');
    const events = new Set([...[...sources.matchAll(/'([a-z]+)'/g)].map(m => m[1]), 'touchstart', 'touchmove', 'touchend', 'touchcancel']);
    return {methods, inert, values, types, events};
}
