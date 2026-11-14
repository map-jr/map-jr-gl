/**
 * The checks for mistakes in a description (`MapSpec`) or in a query of the main API, and the texts of their warnings.
 * `src/host.ts` loads this file on demand after the map has started, so the page script does not carry it.
 */
import type {Map} from './map.ts';
import type {FeatureOptions, MapSpec, StyleExtension} from './host.ts';
import {templateSlots} from './markers.ts';

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
    /* 13 */ () => 'queryFeatures(): "radius" has an effect only in a query at a point or a position. This query ignores it.',
    /* 14 */ (a, b) => `images: a layer gives the parameter "${a}" to the image "${b}", but that image has no slot {{${a}}}, so the parameter has no effect. Write {{${a}}} in the SVG of "${b}" in "images", or remove the parameter.`,
    /* 15 */ a => `markers: the marker layer "${a}" has no "image". Give the SVG in "images" of the description, and its name as "image" of the marker layer. (The fields "svg", "width" and "height" of a marker layer are gone.)`,
    /* 16 */ a => `markers: a marker layer has the image "${a}", and the map has no image with that name. Add "${a}" to "images" of the description, or correct "image" of the marker layer.`,
    /* 17 */ (a, b) => `markers: the marker layer "${a}" has the id of a ${b} of the style, and takes its place. Give the marker layer an id that the style and "extend" do not have.`,
    /* 18 */ (a, b) => `markers: the marker layer "${a}" has before: "${b}", but the style has no layer "${b}", so the markers go on top. Write the id of a layer of the style.`,
    /* 19 */ (a, b) => `markers: the marker ${b} of the marker layer "${a}" has no position, so it is not drawn. Give each marker "lngLat" as [lng, lat].`,
];

/** The message with the number `code` for the names `a` and `b`. */
export const mistake = (code: number, a = '', b = '') => '[map-jr-gl] ' + texts[code](a, b);

/** The fields of `MapSetup`, and `initialView`: a change of one of them in `update` has no effect. */
const setupOnly = ['renderer', 'fonts', 'fontFamily', 'glyphs', 'interactive', 'antialias', 'attribution', 'hash', 'initialView'] as const;
const differ = (a: unknown, b: unknown) => a !== b && JSON.stringify(a) !== JSON.stringify(b);

/**
 * One check of a map. The kinds: 0, the container, a second after the map is made; 1, the ids of the description, when
 * the map is idle; 2, a description (`a`) after the description before it (`b`, none for the first); 3, a query for
 * features at `a` with the options `b`; 4, the style `a` and the additions of `extend` (`b`) to it; 5, an image with
 * the name `a` that a marker layer has and the map does not have.
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
        if (el.isConnected && el.getClientRects().length && !el.clientHeight) warn(0);
    } else if (kind === 1) {
        if (!c.ready()) return;
        const spec = c.spec();
        known(1, spec.interactiveLayers);
        for (const id in spec.data) if (!(map.getSource(id) as {setData?: unknown} | undefined)?.setData) warn(2, id);
    } else if (kind === 2) {
        const next = a as MapSpec, before = b as MapSpec | undefined, ids = new Set<string>();
        for (const m of next.markers ?? []) {
            if (ids.has(m.id)) warn(7, m.id);
            ids.add(m.id);
            if (!m.image) warn(15, m.id);
            // (The first marker with no position. The data is read one time for each array.)
            if (m.data !== before?.markers?.find(o => o.id === m.id)?.data) { const bad = m.data.findIndex(d => !Number.isFinite(+(d?.lngLat?.[0] as number)) || !Number.isFinite(+(d?.lngLat?.[1] as number))); if (bad >= 0) warn(19, m.id, String(bad)); }
        }
        // (A template that is replaced by one with other slots: the layers of the map give it the same parameters.)
        if (before && differ(next.images, before.images) && c.ready()) slots(map.getStyle()?.layers ?? [], [], next.images);
        if (before) for (const k of setupOnly) if (differ(next[k], before[k])) warn(8, k);
    } else if (kind === 3) {
        const o = b as FeatureOptions, place = !!a && !(Array.isArray(a) && typeof a[0] !== 'number');
        if (c.ready()) { known(3, o.layers); known(4, o.sources, true); }
        if (o.sources && o.layers) warn(12);
        if (!o.sources && o.sourceLayers) warn(10, 'sourceLayers');
        if (!place && o.radius !== undefined) warn(13);
        if (!o.sources || !place) { if (o.geometry === false) warn(11, 'geometry'); if (o.zoom !== undefined) warn(11, 'zoom'); }
    } else if (kind === 5) warn(16, a);
    else {
        slots(a.layers, b?.layers);
        // A marker layer is a source and a layer with its id: the id must be free, and `before` must name a layer.
        const all = new Set<string>([...a.layers, ...b?.layers ?? []].map((l: {id: string}) => l.id)), named = {...a.sources, ...b?.sources};
        for (const m of c.spec().markers ?? []) {
            if (all.has(m.id)) warn(17, m.id, 'layer'); else if (named[m.id]) warn(17, m.id, 'source');
            if (m.before && !all.has(m.before)) warn(18, m.id, m.before);
        }
        if (!b) return;
        const extend = b as StyleExtension, sources = {...a.sources, ...extend.sources}, ids = new Set<string>(a.layers.map((l: {id: string}) => l.id));
        for (const {id, before, source} of extend.layers ?? []) {
            if (before && !ids.has(before)) warn(5, id, before);
            if (source && !sources[source as string]) warn(6, id, source as string);
            ids.add(id);
        }
    }
}
