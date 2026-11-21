/**
 * The checks for mistakes in a description (`MapDescription`) or in a query of the main API, and the texts of their warnings.
 * `src/host.ts` loads this file on demand after the map has started, so the page script does not carry it.
 */
import type {Map} from './map.ts';
import type {FeatureOptions, MapDescription, MapInstance, SourceOptions} from './host.ts';
import type {Given} from './unset.ts';
import {isStylePair, templateSlots} from './markers.ts';
import {maplibreMembers} from './maplibre-members.ts';

/** What a check reads of one map. `warned` has the warnings that the map gave: each mistake gives one warning for each map. */
export interface Checked { map: Map; warned: Set<string>; spec(): Given; /** The map exists and has loaded the style of the description. */ ready(): boolean }

const texts: (((a: string, b: string) => string) | undefined)[] = [
    /* 0 */ a => a + ': the container has height 0, so the map shows nothing. Give the container a height in CSS.',
    /* 1 */ a => `interactiveLayers: the style has no layer "${a}". Write the id of a layer of the style or of "layers".`,
    /* 2 */ (a, b) => `the layer "${a}" uses the source "${b}", which the map does not have. A key of "data" makes a source only while it is in "data": keep "${b}" in "data", or remove the layer.`,
    /* 3 */ a => `queryFeatures(): the style has no layer "${a}". In "layers" of the query, write the id of a layer of the style or of "layers" of the description.`,
    /* 4 */ a => `querySource(): the style has no source "${a}". Write the id of a source of the style or of "sources".`,
    /* 5 */ (a, b) => `layers: the layer "${a}" has before: "${b}", but the style has no layer "${b}", so the layer goes on top. Write the id of a layer of the style.`,
    /* 6 */ (a, b) => `layers: the layer "${a}" uses the source "${b}", which the style does not have. Add "${b}" to "sources", or give its GeoJSON as "${b}" in "data".`,
    /* 7 */ () => '', // (a check of the removed marker layers, #499)
    /* 8 */ a => `update(): "${a}" changed, but it is read only when the map is made. ${a === 'initialView' ? 'To move the map, change "view" or call moveTo().' : 'To change it, destroy the map and make a new one.'}`,
    /* 9 */ a => `queryFeatures(): ${a} is not a place. Write a point of the screen {x, y}, a position [lng, lat], or a rectangle [{x, y}, {x, y}].`,
    /* 10 */ a => `querySource(): ${a} is not the id of a source. Write querySource("id", at, options) with the id of a source of the style.`,
    /* 11 */ a => `querySource(): "${a}" has an effect only in a query at a point or a position. This query ignores it.`,
    /* 12 */ (a, b) => b ? `querySource(): "${a}" is not an option of querySource, which reads the tile data of one source. To find what the style layers draw, call queryFeatures(at, {layers}).` : `queryFeatures(): "${a}" is not an option of queryFeatures, which finds what the style layers draw. To read the tile data of a source, call querySource(sourceId, at, options).`,
    /* 13 */ a => `${a}(): "radius" has an effect only in a query at a point or a position. This query ignores it.`,
    /* 14 */ (a, b) => `images: a layer gives the parameter "${a}" to the image "${b}", but that image has no slot {{${a}}}, so the parameter has no effect. Write {{${a}}} in the SVG of "${b}" in "images", or remove the parameter.`,
    /* 15 */ () => '', // (a check of the removed marker layers, #499)
    /* 16 */ () => '', // (a check of the removed marker layers, #499)
    /* 17 */ () => '', // (a check of the removed marker layers, #499)
    /* 18 */ () => '', // (a check of the removed marker layers, #499)
    /* 19 */ () => '', // (a check of the removed marker layers, #499)
    /* 20 */ () => 'The description has "glyphs". That field was removed and has no effect: the map loads the glyph files of the style. Remove "glyphs" from the description. To draw text with the fonts of the browser, remove "glyphs" from the style.',
    /* 21 */ a => `points(): the record ${a} has no position of two finite numbers, so it is left out. Make "lngLat" return [lng, lat] for each record.`,
    /* 22 */ a => `globalState: the value of "${a}" is not JSON (a function, a class instance, NaN or a cycle), so the style cannot read it as it is. Give a string, a number, a boolean, an array or a plain object.`,
    /* 23 */ () => 'moveTo(): "fitPadding" and "fitMaxZoom" have an effect only with "bounds", so this call ignores them. To set the padding of the map, give "padding" in the description.',
];
// A new text, and a new kind of check (below), takes the number of its issue, for example texts[544]; a second one for
// the same issue takes that number plus 10000. Branches that run at the same time then cannot take the same number,
// and `pnpm test:consistency` fails when a number is taken twice. The production build has none of these numbers.
texts[1151] = a => `<MapJr>: the template ref has no method "${a}" until the map has loaded. Call it from @load or later, or use useMapInstance() in a component inside MapJr.`;
// The methods of the map (`MapInstance`): a template ref of the Vue component has them before the map has loaded.
type Method = {[K in keyof MapInstance]: MapInstance[K] extends Function ? K : never}[keyof MapInstance];
const methods = {update: 1, patch: 1, getResolvedDescription: 1, destroy: 1, queryFeatures: 1, querySource: 1, watchFeatures: 1, watchSource: 1, setFeatureState: 1, removeFeatureState: 1, queryElevation: 1, toBlob: 1, clusterExpansionZoom: 1, clusterChildren: 1, clusterLeaves: 1, moveTo: 1, fitBounds: 1, project: 1, unproject: 1, overlay: 1, listen: 1, once: 1} satisfies Record<Method, 1>;
export const earlyMethod = (k: PropertyKey) => Object.hasOwn(methods, k);
texts[1190] = () => 'update(): "view" is a view that the map reported earlier, so the map does not move. The map ignores such a view so that a slow application does not pull it back while the user moves it. To return to a stored view, call moveTo(view).';
texts[1147] = (a, b) => `${a}: "${b}" is not an option of a fit, so it has no effect. For the fit of "bounds", write "fit${b[0].toUpperCase() + b.slice(1)}". "${b}" of the description applies to the map for good.`;
texts[1189] = a => `sources: the GeoJSON source "${a}" has no "data", and "data" of the description has no key "${a}", so the source has no features. Give the source its own "data", or write the features as "data: {${a}: geojson}".`;
texts[30] = a => `hoverState: a feature of the layer "${a}" has no id, so it gets no feature state "hover". Give the features ids, or set "promoteId" of the source to a property that has one, or "generateId: true" for a GeoJSON source.`;
texts[685] = a => `locale: ${a}. Pass an object of strings by the keys of MapLibre GL JS, such as {"NavigationControl.ZoomIn": "Zoom avant"}.`;
texts[40] = a => `colorScheme: ${a} is not a colour scheme, so the map uses the light colours. Write 'auto', 'light' or 'dark'.`;
texts[45] = () => 'style: the object is not a style, because it has no "version" and "layers", and it is not a pair {light, dark}. Give a style object, the URL of a style, or {light: style, dark: style}.';
texts[46] = (a, b) => `style: the pair has no "${a}", so the map uses "${b}" in both colour schemes. Give both "light" and "dark".`;
texts[524] = a => `the description has no field "${a}", so the map ignores it. Check the spelling against MapDescription in docs/api.md, or remove "${a}".`;
texts[10524] = () => 'the description has no field "extend", so the map ignores it. Write "sources", "layers" and "terrain" at the root of the description.';
texts[826] = (a, b) => `<map-jr>: the attribute ${a} cannot be read, so the element ignores it. ${({n: 'Write a number, for example zoom="11".', c: 'Write the longitude and the latitude with a comma between them, for example center="13.4,52.52".', p: 'Write "globe" or "mercator".'} as Record<string, string>)[b] ?? ''}`;
texts[1258] = (a, b) => b === 'o'
    ? `<map-jr>: the attribute ${a}="false" switches the option off all the same, because an attribute that is there takes effect, whatever its value. To keep the option on, remove ${a}.`
    : `<map-jr>: the attribute ${a}="false" switches the option on all the same, because an attribute that is there takes effect, whatever its value. To switch it off, remove ${a}.`;
texts[10826] = () => '<map-jr>: the element has no style, so it shows no map. Write the URL of a style in the attribute "map-style", or set the property "mapStyle".';
texts[20826] = () => '<map-jr>: the attribute "map-style" was removed and the element has no "mapStyle", so the map keeps the style that it has. To change the style, give another URL in "map-style" or set "mapStyle".';
texts[1057] = (a, b) => `the layer "${a}" has in "${b}" a zoom-based "step" or "interpolate" that is inside another expression, or a second one. The map draws it, but MapLibre GL JS rejects the style. Write one ["step", ["zoom"], ...] or ["interpolate", ..., ["zoom"], ...] at the top of the expression (or as the result of a top-level "let", or as one argument of a top-level "coalesce"), and put the other parts in its outputs.`;
texts[55] = a => `sprite: ${a} is not a list of sprites. Write a list of {id, url}, for example [{id: 'pins', url: 'https://example.com/sprites/pins'}], and name an image of it in "icon-image" as "pins:name".`;

/** The message with the number `code` for the names `a` and `b`. */
export const mistake = (code: number, a = '', b = '') => '[map-jr-gl] ' + texts[code]!(a, b);

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
const setupOnly = ['renderer', 'fontFamily', 'interactive', 'antialias', 'attribution', 'hash', 'nonce', 'initialView'] as const;
/** The fields of `MapDescription` (and of `MapSetup`). `pnpm test:consistency` compares the list with src/host.ts. Other fields warn (#524). */
const descriptionFields = new Set(['renderer', 'fontFamily', 'interactive', 'antialias', 'attribution', 'hash', 'nonce', 'style', 'sources', 'layers', 'terrain', 'fonts', 'initialView', 'view', 'onViewChange', 'data', 'images', 'sprite', 'controls', 'projection', 'globalState', 'interactiveLayers', 'hoverState', 'onClick', 'onError', 'minZoom', 'maxZoom', 'maxPitch', 'maxBounds', 'cursor', 'cooperativeGestures', 'colorScheme', 'onColorSchemeChange', 'padding', 'transformRequest', 'locale']);
/** A query at a point or a position, and not in a rectangle or on the whole map. */
const place = (at: unknown) => !!at && !(Array.isArray(at) && typeof at[0] !== 'number');
/** True when the expression `e` has a zoom-based `step` or `interpolate` where MapLibre GL JS does not accept one: nested in
 * another expression, or twice. A curve may stand at the top, as the result of a top-level `let` and as one argument of
 * a top-level `coalesce` (#1057). */
const badZoomCurve = (e: unknown): boolean => {
    let bad = false;
    /** The number of curves in `e`, where `top` says that a curve may stand at `e`. */
    const count = (e: unknown, top: boolean): number => {
        if (!Array.isArray(e) || e[0] === 'literal') return 0;
        const op = e[0], curve = (op === 'step' || op === 'interpolate' || op === 'interpolate-hcl' || op === 'interpolate-lab') && JSON.stringify(e[op === 'step' ? 1 : 2]) === '["zoom"]';
        let n = 0;
        e.forEach((x, i) => { n += count(x, top && ((op === 'let' && i === e.length - 1) || op === 'coalesce')); });
        if (curve) { if (n || !top) bad = true; return 1; }
        if (n > 1 || (n && !top)) bad = true;
        return n;
    };
    count(e, true);
    return bad;
};
const differ = (a: unknown, b: unknown) => a !== b && JSON.stringify(a) !== JSON.stringify(b);

/**
 * One check of a map. The kinds: 0, the container (`a` is the name that the user wrote), a second after the map is made; 1, the ids of the description, when
 * the map is idle; 2, a description (`a`) after the description before it (`b`, none for the first); 3, a query for
 * features at `a` with the options `b`; 6, a query of `querySource` at `a` with the options and the `id` of the source in `b`; 4, the style `a` and the `sources` and `layers` of the description (`b`) to it; 9, a feature with no id under the pointer in the layer `a`
 * with `hoverState`; 1189, a GeoJSON source of `sources` with no `data` and no key in `data`; 7, `moveTo` with `fitPadding` or `fitMaxZoom` and no `bounds`; 1190, `update` with a `view` that the map reported earlier and ignores; 1147, `padding` or `maxZoom` (the old names) in the options `b` of `a` (`initialView`, `moveTo()` or `fitBounds()`).
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
        const next = a as Given, before = b as Given | undefined;
        // (A template that is replaced by one with other slots: the layers of the map give it the same parameters.)
        if (before && differ(next.images, before.images) && c.ready()) slots(map.getStyle()?.layers ?? [], [], next.images);
        if (!before && 'glyphs' in next) warn(20);
        for (const id in next.sources) { const x = next.sources[id] as {type?: string; data?: unknown} | null; if (x?.type === 'geojson' && x.data == null && !(next.data && id in next.data)) warn(1189, id); }
        for (const k in next) if (k !== 'glyphs' && !descriptionFields.has(k)) k === 'extend' ? warn(10524) : warn(524, k);
        if (next.sprite !== before?.sprite && next.sprite != null && !(Array.isArray(next.sprite) && next.sprite.every(s => typeof s?.id === 'string' && typeof s.url === 'string'))) warn(55, JSON.stringify(next.sprite));
        for (const name in next.globalState) if (next.globalState[name] !== before?.globalState?.[name] && !isJson(next.globalState[name])) warn(22, name);
        if (next.locale != null && next.locale !== before?.locale) {
            if (typeof next.locale !== 'object' || Array.isArray(next.locale)) warn(685, 'the value is not an object');
            else for (const k in next.locale) if (typeof next.locale[k] !== 'string') warn(685, `the value of "${k}" is not a string`);
        }
        if (next.colorScheme != null && next.colorScheme !== before?.colorScheme && !['auto', 'light', 'dark'].includes(next.colorScheme)) warn(40, JSON.stringify(next.colorScheme));
        const st = next.style as Record<string, unknown> | undefined;
        if (st && typeof st === 'object' && differ(st, before?.style)) {
            if (isStylePair(st)) { if (!st.light !== !st.dark) warn(46, st.light ? 'dark' : 'light', st.light ? 'light' : 'dark'); }
            else if (!('version' in st && 'layers' in st)) warn(45);
        }
        if (before) for (const k of setupOnly) if (differ(next[k], before[k])) warn(8, k);
    } else if (kind === 3) {
        const o = b as FeatureOptions;
        if (c.ready()) known(3, o.layers);
        for (const k of ['sources', 'sourceLayers', 'geometry', 'zoom']) if (k in o) warn(12, k);
        if (!place(a) && o.radius !== undefined) warn(13, 'queryFeatures');
    } else if (kind === 6) {
        const o = b as SourceOptions & {id: string};
        if (c.ready()) known(4, [o.id], true);
        for (const k of ['layers', 'sources']) if (k in o) warn(12, k, 's');
        if (!place(a)) { if (o.radius !== undefined) warn(13, 'querySource'); if (o.zoom !== undefined) warn(11, 'zoom'); }
    } else if (kind === 9) warn(30, a);
    else if (kind === 7) warn(23);
    else if (kind === 1190) warn(1190);
    else if (kind === 1147) { for (const k of ['padding', 'maxZoom']) if (k in b) warn(1147, a, k); }
    else {
        slots(a.layers, b?.layers);
        for (const l of [...a.layers, ...b?.layers ?? []]) for (const group of [l.paint, l.layout]) for (const k in group) if (badZoomCurve(group[k])) warn(1057, l.id, k);
        if (!b) return;
        const extend = b as Pick<MapDescription, 'sources' | 'layers'>, sources = {...a.sources, ...extend.sources}, ids = new Set<string>(a.layers.map((l: {id: string}) => l.id));
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
