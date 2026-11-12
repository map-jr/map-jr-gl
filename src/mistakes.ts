/**
 * The checks for mistakes in a description (`MapSpec`) or in a query of the main API, and the texts of their warnings.
 * `src/host.ts` loads this file on demand after the map has started, so the page script does not carry it.
 */
import type {Map} from './map.ts';
import type {FeatureOptions, MapSpec, StyleExtension} from './host.ts';

/** What a check reads of one map. `warned` has the warnings that the map gave: each mistake gives one warning for each map. */
export interface Checked { map: Map; warned: Set<string>; spec(): MapSpec; /** The map exists and has loaded the style of the description. */ ready(): boolean }

const texts: ((a: string, b: string) => string)[] = [
    /* 0 */ () => 'createMap(): the container has height 0, so the map shows nothing. Give the container a height in CSS.',
    /* 1 */ a => `interactiveLayers: the style has no layer "${a}". Write the id of a layer of the style or of "extend".`,
    /* 2 */ a => `data: the style has no GeoJSON source "${a}". Add "${a}": {type: 'geojson', data: {type: 'FeatureCollection', features: []}} to the sources of the style or of "extend".`,
    /* 3 */ a => `queryFeatures(): the style has no layer "${a}". In "layers", write the id of a layer of the style or of "extend".`,
    /* 4 */ a => `queryFeatures(): the style has no source "${a}". In "sources", write the id of a source of the style or of "extend".`,
    /* 5 */ (a, b) => `extend: the layer "${a}" has before: "${b}", but the style has no layer "${b}", so the layer goes on top. Write the id of a layer of the style.`,
    /* 6 */ (a, b) => `extend: the layer "${a}" uses the source "${b}", which the style does not have. Add "${b}" to "sources" of "extend".`,
    /* 7 */ a => `markers: two marker layers have the id "${a}". Give each marker layer its own id.`,
    /* 8 */ a => `update(): "${a}" changed, but it is read only when the map is made. ${a === 'initialView' ? 'To move the map, change "view" or call moveTo().' : 'To change it, destroy the map and make a new one.'}`,
    /* 9 */ a => `queryFeatures(): ${a} is not a place. Write a point of the screen {x, y}, a position [lng, lat], or a rectangle [{x, y}, {x, y}].`,
    /* 10 */ a => `queryFeatures(): "${a}" has an effect only in a query with "sources". This query ignores it.`,
    /* 11 */ a => `queryFeatures(): "${a}" has an effect only in a query with "sources" at a point or a position. This query ignores it.`,
    /* 12 */ () => 'queryFeatures(): "layers" has no effect in a query with "sources". Remove "layers", or remove "sources" to ask for what the style layers draw.',
];

/** The message with the number `code` for the names `a` and `b`. */
export const mistake = (code: number, a = '', b = '') => '[map-jr-gl] ' + texts[code](a, b);

/** The fields of `MapSetup`, and `initialView`: a change of one of them in `update` has no effect. */
const setupOnly = ['renderer', 'fonts', 'fontFamily', 'glyphs', 'interactive', 'antialias', 'attribution', 'hash', 'initialView'] as const;
const differ = (a: unknown, b: unknown) => a !== b && JSON.stringify(a) !== JSON.stringify(b);

/**
 * One check of a map. The kinds: 0, the container, a second after the map is made; 1, the ids of the description, when
 * the map is idle; 2, a description (`a`) after the description before it (`b`, none for the first); 3, a query for
 * features at `a` with the options `b`; 4, the additions of `extend` (`b`) to the style `a`.
 */
export function check(c: Checked, kind: number, a?: any, b?: any) {
    const {map} = c;
    const warn = (code: number, x = '', y = '') => {
        const key = code + ' ' + x;
        if (!c.warned.has(key)) { c.warned.add(key); console.warn(mistake(code, x, y)); }
    };
    /** Warns for each id that is not a layer (or a source) of the style. */
    const known = (code: number, ids: string[] | undefined, source?: boolean) => { for (const id of ids ?? []) if (!(source ? map.getSource(id) : map.getLayer(id))) warn(code, id); };
    if (kind === 0) {
        // (An element that is hidden or not in the page has no rectangle: that is not this mistake.)
        const el = map.getContainer();
        if (el.isConnected && el.getClientRects().length && !el.clientHeight) warn(0);
    } else if (kind === 1) {
        if (!c.ready()) return;
        const spec = c.spec();
        known(1, spec.interactiveLayers);
        for (const id in spec.data) if (!(map.getSource(id) as {setData?: unknown} | undefined)?.setData) warn(2, id);
    } else if (kind === 2) {
        const next = a as MapSpec, before = b as MapSpec | undefined, ids = new Set<string>();
        for (const m of next.markers ?? []) { if (ids.has(m.id)) warn(7, m.id); ids.add(m.id); }
        if (before) for (const k of setupOnly) if (differ(next[k], before[k])) warn(8, k);
    } else if (kind === 3) {
        const o = b as FeatureOptions, place = !!a && !(Array.isArray(a) && typeof a[0] !== 'number');
        if (c.ready()) { known(3, o.layers); known(4, o.sources, true); }
        if (o.sources && o.layers) warn(12);
        if (!o.sources && o.sourceLayers) warn(10, 'sourceLayers');
        if (!o.sources || !place) { if (o.radius !== undefined) warn(11, 'radius'); if (o.geometry === false) warn(11, 'geometry'); }
    } else if (b) {
        const extend = b as StyleExtension, sources = {...a.sources, ...extend.sources}, ids = new Set<string>(a.layers.map((l: {id: string}) => l.id));
        for (const {id, before, source} of extend.layers ?? []) {
            if (before && !ids.has(before)) warn(5, id, before);
            if (source && !sources[source as string]) warn(6, id, source as string);
            ids.add(id);
        }
    }
}
