/**
 * The checks for mistakes in a description (`MapSpec`) or in a query of the main API, and the texts of their warnings.
 * `src/host.ts` loads this file on demand after the map has started, so the page script does not carry it.
 */
import type {Map} from './map.ts';
import type {FeatureOptions, MapSpec} from './host.ts';
import {templateSlots} from './markers.ts';
import {maplibreMembers} from './maplibre-members.ts';

/** What a check reads of one map. `warned` has the warnings that the map gave: each mistake gives one warning for each map. */
export interface Checked { map: Map; warned: Set<string>; spec(): MapSpec; /** The map exists and has loaded the style of the description. */ ready(): boolean }

const texts: ((a: string, b: string) => string)[] = [
    /* 0 */ a => a + ': the container has height 0, so the map shows nothing. Give the container a height in CSS.',
    /* 1 */ a => `interactiveLayers: the style has no layer "${a}". Write the id of a layer of the style or of "layers".`,
    /* 2 */ (a, b) => `the layer "${a}" uses the source "${b}", which the map does not have. A key of "data" makes a source only while it is in "data": keep "${b}" in "data", or remove the layer.`,
    /* 3 */ a => `queryFeatures(): the style has no layer "${a}". In "layers", write the id of a layer of the style or of "extend".`,
    /* 4 */ a => `queryFeatures(): the style has no source "${a}". In "sources", write the id of a source of the style or of "extend".`,
    /* 5 */ (a, b) => `layers: the layer "${a}" has before: "${b}", but the style has no layer "${b}", so the layer goes on top. Write the id of a layer of the style.`,
    /* 6 */ (a, b) => `layers: the layer "${a}" uses the source "${b}", which the style does not have. Add "${b}" to "sources", or give its GeoJSON as "${b}" in "data".`,
    /* 7 */ () => '', // (a check of the removed marker layers, #499)
    /* 8 */ a => `update(): "${a}" changed, but it is read only when the map is made. ${a === 'initialView' ? 'To move the map, change "view" or call moveTo().' : 'To change it, destroy the map and make a new one.'}`,
    /* 9 */ a => `queryFeatures(): ${a} is not a place. Write a point of the screen {x, y}, a position [lng, lat], or a rectangle [{x, y}, {x, y}].`,
    /* 10 */ a => `queryFeatures(): "${a}" has an effect only in a query with "sources". This query ignores it.`,
    /* 11 */ a => `queryFeatures(): "${a}" has an effect only in a query with "sources" at a point or a position. This query ignores it.`,
    /* 12 */ () => 'queryFeatures(): "layers" has no effect in a query with "sources". Remove "layers", or remove "sources" to ask for what the style layers draw.',
    /* 13 */ () => 'queryFeatures(): "radius" has an effect only in a query at a point or a position. This query ignores it.',
    /* 14 */ (a, b) => `images: a layer gives the parameter "${a}" to the image "${b}", but that image has no slot {{${a}}}, so the parameter has no effect. Write {{${a}}} in the SVG of "${b}" in "images", or remove the parameter.`,
    /* 15 */ () => '', // (a check of the removed marker layers, #499)
    /* 16 */ () => '', // (a check of the removed marker layers, #499)
    /* 17 */ () => '', // (a check of the removed marker layers, #499)
    /* 18 */ () => '', // (a check of the removed marker layers, #499)
    /* 19 */ () => '', // (a check of the removed marker layers, #499)
    /* 20 */ () => 'The description has "glyphs". That field was removed and has no effect: the map loads the glyph files of the style. Remove "glyphs" from the description. To draw text with the fonts of the browser, remove "glyphs" from the style.',
    /* 21 */ a => `points(): the record ${a} has no position of two finite numbers, so it is left out. Make "lngLat" return [lng, lat] for each record.`,
    /* 22 */ a => `globalState: the value of "${a}" is not JSON (a function, a class instance, NaN or a cycle), so the style cannot read it as it is. Give a string, a number, a boolean, an array or a plain object.`,
];

/** The message with the number `code` for the names `a` and `b`. */
export const mistake = (code: number, a = '', b = '') => '[map-jr-gl] ' + texts[code](a, b);

/** A value that JSON keeps as it is: no function, `undefined` in an array, number that is not finite, class instance or cycle. */
const isJson = (v: unknown, seen: unknown[] = []): boolean => {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return true;
    if (typeof v === 'number') return Number.isFinite(v);
    if (typeof v !== 'object' || seen.includes(v)) return false;
    const proto = Object.getPrototypeOf(v);
    if (!Array.isArray(v) && proto !== Object.prototype && proto !== null) return false;
    return Object.values(v).every(x => isJson(x, [...seen, v]));
};
/** For `points()` (src/points.ts): the warning with the number `code` for `a`, once for each code on the page. */
const pageWarned = new Set<number>();
export const warnOnce = (code: number, a = '') => { if (!pageWarned.has(code)) { pageWarned.add(code); console.warn(mistake(code, a)); } };

/** The fields of `MapSetup`, and `initialView`: a change of one of them in `update` has no effect. */
const setupOnly = ['renderer', 'fonts', 'fontFamily', 'interactive', 'antialias', 'attribution', 'hash', 'nonce', 'initialView'] as const;
const differ = (a: unknown, b: unknown) => a !== b && JSON.stringify(a) !== JSON.stringify(b);

/**
 * One check of a map. The kinds: 0, the container (`a` is the name that the user wrote), a second after the map is made; 1, the ids of the description, when
 * the map is idle; 2, a description (`a`) after the description before it (`b`, none for the first); 3, a query for
 * features at `a` with the options `b`; 4, the style `a` and the `sources` and `layers` of the description (`b`) to it.
 */
export function check(c: Checked, kind: number, a?: any, b?: any) {
    const {map} = c;
    const warn = (code: number, x = '', y = '') => {
        const key = code + ' ' + x + ' ' + y;
        if (!c.warned.has(key)) { c.warned.add(key); console.warn(mistake(code, x, y)); }
    };
    /** Warns for each id that is not a layer (or a source) of the style. */
    const known = (code: number, ids: string[] | undefined, source?: boolean) => { for (const id of ids ?? []) if (!(source ? map.getSource(id) : map.getLayer(id))) warn(code, id); };
    /** Warns for each parameter that a layer gives to an image (`['image', name, {params}]`, also in `format`) and that is not a slot of the image. */
    const slots = (layers: any[], more: any[] = [], images = c.spec().images ?? {}) => {
        const params = (e: unknown) => {
            if (!Array.isArray(e)) return;
            if (e[0] === 'image' && typeof e[1] === 'string' && e[2]?.params) {
                const v = images[e[1]] as unknown, svg = String((v as {image?: unknown})?.image ?? v ?? '');
                // (Only for an image that the description has now: an image can come with a later description.)
                if (svg.trimStart().startsWith('<')) for (const k in e[2].params) if (!templateSlots(svg).includes(k)) warn(14, k, e[1]);
            }
            e.forEach(params);
        };
        for (const l of [...layers, ...more]) { params(l.layout?.['icon-image']); params(l.layout?.['text-field']); }
    };
    if (kind === 0) {
        // (An element that is hidden or not in the page has no rectangle: that is not this mistake.)
        const el = map.getContainer();
        if (el.isConnected && el.getClientRects().length && !el.clientHeight) warn(0, a);
    } else if (kind === 1) {
        if (!c.ready()) return;
        const spec = c.spec();
        known(1, spec.interactiveLayers);
        for (const l of map.getStyle()?.layers ?? []) { const src = (l as {source?: unknown}).source; if (typeof src === 'string' && !map.getSource(src) && !c.warned.has(`6 ${l.id} ${src}`)) warn(2, l.id, src); }
    } else if (kind === 2) {
        const next = a as MapSpec, before = b as MapSpec | undefined;
        // (A template that is replaced by one with other slots: the layers of the map give it the same parameters.)
        if (before && differ(next.images, before.images) && c.ready()) slots(map.getStyle()?.layers ?? [], [], next.images);
        if (!before && 'glyphs' in next) warn(20);
        for (const name in next.globalState) if (next.globalState[name] !== before?.globalState?.[name] && !isJson(next.globalState[name])) warn(22, name);
        if (before) for (const k of setupOnly) if (differ(next[k], before[k])) warn(8, k);
    } else if (kind === 3) {
        const o = b as FeatureOptions, place = !!a && !(Array.isArray(a) && typeof a[0] !== 'number');
        if (c.ready()) { known(3, o.layers); known(4, o.sources, true); }
        if (o.sources && o.layers) warn(12);
        if (!o.sources && o.sourceLayers) warn(10, 'sourceLayers');
        if (!place && o.radius !== undefined) warn(13);
        if (!o.sources || !place) { if (o.geometry === false) warn(11, 'geometry'); if (o.zoom !== undefined) warn(11, 'zoom'); }
    } else {
        slots(a.layers, b?.layers);
        if (!b) return;
        const extend = b as Pick<MapSpec, 'sources' | 'layers'>, sources = {...a.sources, ...extend.sources}, ids = new Set<string>(a.layers.map((l: {id: string}) => l.id));
        for (const {id, before, source} of extend.layers ?? []) {
            if (before && !ids.has(before)) warn(5, id, before);
            if (source && !sources[source as string] && !Object.hasOwn(c.spec().data ?? {}, source as string)) warn(6, id, source as string);
            ids.add(id);
        }
    }
}

/** The members of the map that are private state of MapLibre GL JS, and what to use instead. (`painter` has its own
 * warning in src/compat-map.ts, and the map has a `style` for wrappers.) */
const privateState: Record<string, string> = {
    transform: 'Use getCenter(), getZoom(), getBearing(), getPitch() and project(). react-map-gl 8 does not read it.',
};
/** The names that have warned, on the page: each name warns once. */
const reported = new Set<string>();
/** For each prototype that has a list: the name of its class in MapLibre GL JS and the public members of that class. */
const lists = new globalThis.Map<object, [string, Set<string>]>();
let watcher: object | undefined;

/**
 * The development build of the entry maplibre-compat calls this with its classes by the names of MapLibre GL JS. Reading
 * a public member of the MapLibre class that the class here does not have warns once for each name. A proxy goes at the
 * end of the prototype chain of each class, so it sees only the names that the instance, its classes and `Object` do
 * not have: a member that exists costs nothing, and the instances stay the same objects.
 */
export function watchMembers(classes: Record<string, {prototype: object}>, members: Record<string, string[]> = Object.fromEntries(Object.entries(maplibreMembers).map(([c, n]) => [c, n.split(' ')]))) {
    watcher ??= new Proxy(Object.prototype, {get(target, key, receiver) {
        // (Symbols and names that start with `_`, `$` or `@` are what frameworks probe and what MapLibre has as private
        // members: Vue reads `__v_skip`, React `$$typeof`. `then` and `toJSON` are not members of MapLibre, so they do not warn.)
        if (typeof key === 'string' && !/^[_$@]/.test(key)) for (let p = receiver; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
            const found = lists.get(p);
            if (!found) continue;
            const [cls, list] = found, name = (cls === 'Map' ? 'map.' : cls + '.') + key;
            if (list.has(key) && !reported.has(name)) {
                reported.add(name);
                console.warn(cls === 'Map' && privateState[key]
                    ? `[map-jr-gl] ${name} is private state of MapLibre GL JS and does not exist in @map-jr/map-jr-gl/maplibre-compat. ${privateState[key]}`
                    : `[map-jr-gl] ${name} is not available in @map-jr/map-jr-gl/maplibre-compat. Remove the use, or see docs/maplibre-compatibility.md for what replaces it.`);
            }
            break;
        }
        return Reflect.get(target, key, receiver);
    }});
    for (const cls in classes) {
        if (!members[cls]) continue;
        let root = classes[cls].prototype;
        lists.set(root, [cls, new Set(members[cls])]);
        while (Object.getPrototypeOf(root) !== Object.prototype && Object.getPrototypeOf(root) !== watcher) root = Object.getPrototypeOf(root);
        if (Object.getPrototypeOf(root) === Object.prototype) Object.setPrototypeOf(root, watcher);
    }
}
