/**
 * The checks for mistakes in a description (`MapDescription`) or in a query of the main API, and the texts of their warnings.
 * `src/host.ts` loads this file on demand after the map has started, so the page script does not carry it.
 */
import type {Map} from './map.ts';
import type {FeatureOptions, MapDescription, MapInstance, SourceOptions} from './host.ts';
import type {Given} from './unset.ts';
import {isStylePair, templateSlots} from './markers.ts';
import {maplibreMembers} from './maplibre-members.ts';
import {SPEC} from './style.ts';

/** What a check reads of one map. `warned` has the warnings that the map gave: each mistake gives one warning for each map. */
export interface Checked { map: Map; warned: Set<string>; /** The name that made the map, such as `createMap()` or `<MapJr>`. */ name: string; spec(): Given; /** The map exists and has loaded the style of the description. */ ready(): boolean }

const texts: (((a: string, b: string) => string) | undefined)[] = [
    /* 0 */ call => call + ': the container has height 0, so the map shows nothing. Give the container a height in CSS.',
    /* 1 */ layerId => `interactiveLayers: the style has no layer "${layerId}". Write the id of a layer of the style or of "layers".`,
    /* 2 */ (layerId, sourceId) => `the layer "${layerId}" uses the source "${sourceId}", which the map does not have. A key of "data" makes a source only while it is in "data": keep "${sourceId}" in "data", or remove the layer.`,
    /* 3 */ layerId => `queryFeatures(): the style has no layer "${layerId}". In "layers" of the query, write the id of a layer of the style or of "layers" of the description.`,
    /* 4 */ sourceId => `querySource(): the style has no source "${sourceId}". Write the id of a source of the style or of "sources".`,
    /* 5 */ (layerId, beforeId) => `layers: the layer "${layerId}" has before: "${beforeId}", but the style has no layer "${beforeId}", so the layer goes on top. Write the id of a layer of the style.`,
    /* 6 */ (layerId, sourceId) => `layers: the layer "${layerId}" uses the source "${sourceId}", which the style does not have. Add "${sourceId}" to "sources", or give its GeoJSON as "${sourceId}" in "data".`,
    /* 7 */ () => '', // (a check of the removed marker layers, #499)
    /* 8 */ option => `update(): "${option}" changed, but it is read only when the map is made. ${option === 'initialView' ? 'To move the map, change "view" or call moveTo().' : 'To change it, destroy the map and make a new one.'}`,
    /* 9 */ place => `queryFeatures(): ${place} is not a place. Write a point of the screen {x, y}, a position [lng, lat], or a rectangle [{x, y}, {x, y}].`,
    /* 10 */ firstArgument => `querySource(): ${firstArgument} is not the id of a source. Write querySource("id", at, options) with the id of a source of the style.`,
    /* 11 */ option => `querySource(): "${option}" has an effect only in a query at a point or a position. This query ignores it.`,
    /* 12 */ (option, inSourceQuery) => inSourceQuery ? `querySource(): "${option}" is not an option of querySource, which reads the tile data of one source. To find what the style layers draw, call queryFeatures(at, {layers}).` : `queryFeatures(): "${option}" is not an option of queryFeatures, which finds what the style layers draw. To read the tile data of a source, call querySource(sourceId, at, options).`,
    /* 13 */ method => `${method}(): "radius" has an effect only in a query at a point or a position. This query ignores it.`,
    /* 14 */ (parameter, imageId) => `images: a layer gives the parameter "${parameter}" to the image "${imageId}", but that image has no slot {{${parameter}}}, so the parameter has no effect. Write {{${parameter}}} in the SVG of "${imageId}" in "images", or remove the parameter.`,
    /* 15 */ () => '', // (a check of the removed marker layers, #499)
    /* 16 */ () => '', // (a check of the removed marker layers, #499)
    /* 17 */ () => '', // (a check of the removed marker layers, #499)
    /* 18 */ () => '', // (a check of the removed marker layers, #499)
    /* 19 */ () => '', // (a check of the removed marker layers, #499)
    /* 20 */ () => 'The description has "glyphs". That field was removed and has no effect: the map loads the glyph files of the style. Remove "glyphs" from the description. To draw text with the fonts of the browser, remove "glyphs" from the style.',
    /* 21 */ record => `points(): the record ${record} has no position of two finite numbers, so it is left out. Make "lngLat" return [lng, lat] for each record.`,
    /* 22 */ key => `globalState: the value of "${key}" is not JSON (a function, a class instance, NaN or a cycle), so the style cannot read it as it is. Give a string, a number, a boolean, an array or a plain object.`,
    /* 23 */ () => 'moveTo(): "fitPadding" and "fitMaxZoom" have an effect only with "bounds", so this call ignores them. To set the padding of the map, give "padding" in the description.',
];
// A new text, and a new kind of check (below), takes the number of its issue, for example texts[544]; a second one for
// the same issue takes that number plus 10000. Branches that run at the same time then cannot take the same number,
// and `pnpm test:consistency` fails when a number is taken twice. The production build has none of these numbers.
texts[1151] = method => `<MapJr>: the template ref has no method "${method}" until the map has loaded. Call it from @load or later, or use useMapInstance() in a component inside MapJr.`;
// The methods of the map (`MapInstance`): a template ref of the Vue component has them before the map has loaded.
type Method = {[K in keyof MapInstance]: MapInstance[K] extends Function ? K : never}[keyof MapInstance];
const methods = {update: 1, patch: 1, getResolvedDescription: 1, destroy: 1, queryFeatures: 1, querySource: 1, watchFeatures: 1, watchSource: 1, setFeatureState: 1, removeFeatureState: 1, queryElevation: 1, toBlob: 1, clusterExpansionZoom: 1, clusterChildren: 1, clusterLeaves: 1, moveTo: 1, fitBounds: 1, project: 1, unproject: 1, overlay: 1, listen: 1, once: 1} satisfies Record<Method, 1>;
export const earlyMethod = (k: PropertyKey) => Object.hasOwn(methods, k);
texts[1148] = call => `${call}: the description has both "view" and "initialView.bounds". "view" wins, so the map does not fit "initialView.bounds". Remove "view" to fit the bounds, or remove "bounds" from "initialView".`;
texts[1190] = () => 'update(): "view" is a view that the map reported earlier, so the map does not move. The map ignores such a view so that a slow application does not pull it back while the user moves it. To return to a stored view, call moveTo(view).';
texts[1147] = (target, option) => `${target}: "${option}" is not an option of a fit, so it has no effect. For the fit of "bounds", write "fit${option[0].toUpperCase() + option.slice(1)}". "${option}" of the description applies to the map for good.`;
texts[1189] = sourceId => `sources: the GeoJSON source "${sourceId}" has no "data", and "data" of the description has no key "${sourceId}", so the source has no features. Give the source its own "data", or write the features as "data: {${sourceId}: geojson}".`;
texts[30] = (layerId, sourceType) => `hoverState: a feature of the layer "${layerId}" has no id, so it gets no feature state "hover". ${sourceType === 'geojson' ? 'Give the features ids, or set "promoteId" of the source to a property that has one, or "generateId: true" for the source.' : 'Write a numeric id for each feature into the tiles when you build them, or set "promoteId" of the source to a property that has one.'}`;
texts[685] = problem => `locale: ${problem}. Pass an object of strings by the keys of MapLibre GL JS, such as {"NavigationControl.ZoomIn": "Zoom avant"}.`;
texts[40] = scheme => `colorScheme: ${scheme} is not a color scheme, so the map uses the light colors. Write 'auto', 'light' or 'dark'.`;
texts[45] = () => 'style: the object is not a style, because it has no "version" and "layers", and it is not a pair {light, dark}. Give a style object, the URL of a style, or {light: style, dark: style}.';
texts[46] = (missing, used) => `style: the pair has no "${missing}", so the map uses "${used}" in both color schemes. Give both "light" and "dark".`;
texts[524] = field => `the description has no field "${field}", so the map ignores it. Check the spelling against MapDescription in docs/reference/description.md, or remove "${field}".`;
texts[10524] = () => 'the description has no field "extend", so the map ignores it. Write "sources", "layers" and "terrain" at the root of the description.';
texts[826] = (attribute, kind) => `<map-jr>: the attribute ${attribute} cannot be read, so the element ignores it. ${({n: 'Write a number, for example zoom="11".', c: 'Write the longitude and the latitude with a comma between them, for example center="13.4,52.52".', p: 'Write "globe" or "mercator".'} as Record<string, string>)[kind] ?? ''}`;
texts[1258] = (attribute, kind) => kind === 'o'
    ? `<map-jr>: the attribute ${attribute}="false" switches the option off all the same, because an attribute that is there takes effect, whatever its value. To keep the option on, remove ${attribute}.`
    : `<map-jr>: the attribute ${attribute}="false" switches the option on all the same, because an attribute that is there takes effect, whatever its value. To switch it off, remove ${attribute}.`;
texts[10826] = () => '<map-jr>: the element has no style, so it shows no map. Write the URL of a style in the attribute "map-style", or set the property "mapStyle".';
texts[20826] = () => '<map-jr>: the attribute "map-style" was removed and the element has no "mapStyle", so the map keeps the style that it has. To change the style, give another URL in "map-style" or set "mapStyle".';
texts[1057] = (where, reason) => `${where}: ${reason} The map draws it, but MapLibre GL JS rejects the style. Write ["zoom"] only as the input of one ["step", ["zoom"], ...] or ["interpolate", ..., ["zoom"], ...] at the top of the expression (or as the result of a top-level "let", or as one argument of a top-level "coalesce"), and put the other parts in its outputs.`;
texts[1195] = (control, custom) => custom
    ? `controls: two custom() controls have the key "${control}", so the map adds only the first. Give each custom() control its own "key".`
    : `controls: ${control}() is in the list twice with the same options, so the map adds it once. Remove the second ${control}().`;
/** The option of an overlay that `option` is with another case of its letters, such as `lngLat` for `lnglat`. */
const overlayOption = (option: string) => overlayOptions.find(k => k.toLowerCase() === option.toLowerCase());
texts[1647] = (option, call) => `${call}: "${option}" is not an option of an overlay, so it has no effect. ${overlayOption(option) ? `Write "${overlayOption(option)}". ` : ''}The options are ${overlayOptions.join(', ')}.`;
texts[1139] = (where, near) => `${where}: a layer of this type has no such property in the style specification, so the map ignores it. ${near ? `Write "${near}".` : 'Check the name in the style specification, or remove it.'}`;
texts[1748] = (where, why) => `${where}: ${why}. The map draws what it can, but MapLibre GL JS rejects the style. Add what the style specification requires.`;
texts[11139] = (where, near) => `${where}: unknown property "${where.slice(where.lastIndexOf('.') + 1)}". The map draws the layer without it, but MapLibre GL JS rejects the style. ${near ? `Write "${near}".` : 'Check the name in the style specification, or remove it.'}`;
texts[55] = sprite => `sprite: ${sprite} is not a list of sprites. Write a list of {id, url}, for example [{id: 'pins', url: 'https://example.com/sprites/pins'}], and name an image of it in "icon-image" as "pins:name".`;

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
/** The options of `overlay()` (`OverlayOptions`). `pnpm test:consistency` compares the list with src/host.ts. Other options warn (#1647). */
const overlayOptions = ['lngLat', 'anchor', 'offset', 'popup', 'onClose', 'draggable', 'onDragStart', 'onDrag', 'onDragEnd'];
/** A query at a point or a position, and not in a rectangle or on the whole map. */
const place = (at: unknown) => !!at && !(Array.isArray(at) && typeof at[0] !== 'number');
/** MapLibre GL JS's error for the expression `e` of a property when `e` uses ["zoom"] where MapLibre does not accept it,
 * or ''. ["zoom"] may only be the input of one zoom-based `step` or `interpolate`, which stands at the top, as the
 * result of a top-level `let` or as an argument of a top-level `coalesce`. This follows `findZoomCurve` of MapLibre's
 * style specification on the JSON of the expression, with the same texts (#1057, #1087). */
export const zoomCurveError = (e: unknown): string => {
    const nested = '"zoom" expression may only be used as input to a top-level "step" or "interpolate" expression.';
    const seen = new globalThis.Map<unknown[], unknown>();
    const expr = (e: unknown): e is unknown[] => Array.isArray(e) && typeof e[0] === 'string' && e[0] !== 'literal';
    /** The curve of `e` (an array), an error (a string) or null. */
    const find = (e: unknown[]): unknown => {
        if (seen.has(e)) return seen.get(e);
        const op = e[0];
        let r: unknown = null;
        if (op === 'let') r = expr(e[e.length - 1]) ? find(e[e.length - 1] as unknown[]) : null;
        else if (op === 'coalesce') { for (const a of e.slice(1)) if (expr(a) && (r = find(a))) break; }
        else if ((op === 'step' || op === 'interpolate' || op === 'interpolate-hcl' || op === 'interpolate-lab') && JSON.stringify(e[op === 'step' ? 1 : 2]) === '["zoom"]') r = e;
        if (typeof r !== 'string') for (const c of e.slice(1)) {
            const cr = expr(c) ? find(c) : null;
            if (typeof cr === 'string') r = cr;
            else if (!r && cr) r = nested;
            else if (r && cr && r !== cr) r = 'Only one zoom-based "step" or "interpolate" subexpression may be used in an expression.';
        }
        seen.set(e, r);
        return r;
    };
    const usesZoom = (e: unknown): boolean => expr(e) && (e[0] === 'zoom' || e.some(usesZoom));
    if (!expr(e)) return '';
    // (A copy, so that each place in the expression is its own array, as each is its own object in MapLibre's parsed
    // expression: the same array given twice is two curves.)
    const r = find(JSON.parse(JSON.stringify(e)));
    return typeof r === 'string' ? r : !r && usesZoom(e) ? nested : '';
};
/** For the compat entry (src/compat-map.ts): calls `report` with an `error` for each property of `style` whose
 * expression MapLibre GL JS rejects for its ["zoom"] (see `zoomCurveError`), once for each layer, property and value on
 * the map (`reported`). The property is named as in MapLibre's error of `setPaintProperty` (#1087). It does the same,
 * once for each layer and property, for a property that the style specification does not have for the type of the layer (#1139).
 * Unless `noValidate` (the option `validate: false`), it does the same for a required field that is missing (`validateStyle`, #1748). */
export function zoomCurveErrors(style: {sources?: Record<string, any>; layers?: any[]} | undefined, reported: Set<string>, report: (error: Error) => void, noValidate?: boolean) {
    if (!noValidate) validateStyle(style, (where, why) => { const key = where + ' ' + why; if (!reported.has(key)) { reported.add(key); report(new Error(mistake(1748, where, why))); } });
    for (const l of style?.layers ?? []) for (const g of ['paint', 'layout']) for (const k in l?.[g]) {
        const why = zoomCurveError(l[g][k]), key = `${l.id} ${g} ${k} ${JSON.stringify(l[g][k])}`;
        if (why && !reported.has(key)) { reported.add(key); report(new Error(mistake(1057, `layers.${l.id}.${g}.${k}`, why))); }
    }
    unknownProperties(style?.layers, (l, g, k, near) => { const key = `${l.id} ${g} ${k}`; if (!reported.has(key)) { reported.add(key); report(new Error(mistake(11139, `layers.${l.id}.${g}.${k}`, near))); } });
}
/**
 * Calls `found` with the place and MapLibre's text (GL JS 6.17, style specification 26) for each required field that a
 * layer or a source of `style` lacks: the `id`, `type` and `source` of a layer (no source for `background`), the
 * `source-layer` of a layer of a vector source, the `type` of a source, `data` of a GeoJSON source, and `urls` and
 * `coordinates` of an image or video source (#1748). The types of values are not checked here.
 */
export function validateStyle(style: {sources?: Record<string, any>; layers?: any[]} | undefined, found: (where: string, why: string) => void) {
    const need = (where: string, o: any, k: string) => { if (o[k] === undefined) found(where, `missing required property "${k}"`); };
    for (const [id, s] of Object.entries(style?.sources ?? {})) {
        if (!s || typeof s !== 'object') continue;
        const where = 'sources.' + id;
        if (s.type === undefined) found(where, '"type" is required');
        else if (s.type === 'geojson') need(where, s, 'data');
        else if (s.type === 'video' || s.type === 'image') { if (s.type === 'video') need(where, s, 'urls'); need(where, s, 'coordinates'); }
    }
    (style?.layers ?? []).forEach((l, i) => {
        if (!l || typeof l !== 'object') return;
        const where = `layers[${i}]`;
        if (l.type === undefined && l.ref === undefined) found(where, 'either "type" or "ref" is required');
        if (l.type !== undefined && l.type !== 'background' && l.type !== 'custom' && l.source === undefined) need(where, l, 'source');
        if (style?.sources?.[l.source]?.type === 'vector' && l['source-layer'] === undefined) found(where, `layer "${l.id}" must specify a "source-layer"`);
        need(where, l, 'id');
    });
}
const differ = (a: unknown, b: unknown) => a !== b && JSON.stringify(a) !== JSON.stringify(b);
/** The properties of the style specification that the map does not read (and so are not in `SPEC` of src/style.ts), by layer type. */
const unread: Record<string, string> = {line: 'line-gradient', symbol: 'symbol-avoid-edges symbol-height-offset symbol-height-anchor text-writing-mode', heatmap: 'heatmap-color',
    'fill-extrusion': 'fill-extrusion-rounded-corner-distance', raster: 'raster-fade-duration', 'color-relief': 'color-relief-color'};
/** The paint and layout properties of the style specification for the layer type `type`, or undefined for a type that the map does not know or that has none. */
export const layerProperties = (type: string) => Object.hasOwn(SPEC, type) && type !== 'custom'
    ? [...Object.values(SPEC[type]).map(p => p[0]).filter(n => n !== 'heatmap-no-such-property'), 'visibility', ...unread[type]?.split(' ') ?? []] : undefined;
/** The edit distance of `a` and `b` (Levenshtein). */
const distance = (a: string, b: string) => {
    let row = [...Array(b.length + 1).keys()];
    for (let i = 1; i <= a.length; i++) {
        const next = [i];
        for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        row = next;
    }
    return row[b.length];
};
/**
 * Calls `found` for each key of `paint` and `layout` of the layers that the style specification does not have for the
 * type of the layer, with the group, the key and the nearest property of that type ('' when none is near). A key of
 * `paint` that is a property and `-transition` is known. (#1139)
 */
export function unknownProperties(layers: unknown, found: (layer: {id: string; type: string}, group: string, key: string, near: string) => void) {
    for (const l of Array.isArray(layers) ? layers : []) {
        const known = layerProperties(l?.type);
        if (known) for (const g of ['paint', 'layout']) for (const k in l[g]) {
            if (known.includes(k) || g === 'paint' && k.endsWith('-transition') && known.includes(k.slice(0, -11))) continue;
            // (The nearest name within a third of the length of the key, so that a short key does not get an unrelated name.)
            const key = k.replace(/[A-Z_]/g, c => '-' + c.toLowerCase().replace('_', '')).replace(/-+/g, '-');
            let near = '', best = Math.max(2, Math.floor(k.length / 3)) + 1;
            for (const n of known) { const d = distance(key, n); if (d < best) { best = d; near = n; } }
            found(l, g, k, near);
        }
    }
}

/**
 * One check of a map. The kinds: 0, the container (`a` is the name that the user wrote), a second after the map is made; 1, the ids of the description and the
 * properties of the layers of the map, when the map is idle; 2, a description (`a`) after the description before it (`b`, none for the first); 3, a query for
 * features at `a` with the options `b`; 6, a query of `querySource` at `a` with the options and the `id` of the source in `b`; 4, the style `a` and the `sources` and `layers` of the description (`b`) to it (also their ids, images, zoom curves and properties), or with no `b`, `{layers}` of an update() that went to the map as edits (#1684); 9, a feature with no id under the pointer in the layer `a` of the source `b`
 * with `hoverState`; 1189, a GeoJSON source of `sources` with no `data` and no key in `data`; 7, `moveTo` with `fitPadding` or `fitMaxZoom` and no `bounds`; 1148 is the first description (kind 2) with `view` and `initialView.bounds`; 1190, `update` with a `view` that the map reported earlier and ignores; 1147, `padding` or `maxZoom` (the old names) in the options `b` of `a` (`initialView`, `moveTo()` or `fitBounds()`); 1647, the options `b` of an overlay in the call `a` (`overlay()`, `update()` or `patch()`). Kind 2 also warns 1195 for a control that `controls` has twice.
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
    /** Warns for each property of the layers that the style specification does not have for the type of the layer (#1139). */
    const properties = (layers: unknown) => unknownProperties(layers, (l, g, k, near) => warn(1139, `the ${l.type} layer "${l.id}", ${g} property "${k}"`, near));
    if (kind === 0) {
        // (An element that is hidden or not in the page has no rectangle: that is not this mistake.)
        const el = map.getContainer();
        if (el.isConnected && el.getClientRects().length && !el.clientHeight) warn(0, a);
    } else if (kind === 1) {
        if (!c.ready()) return;
        const spec = c.spec();
        known(1, spec.interactiveLayers);
        properties(map.getStyle()?.layers);
        for (const l of map.getStyle()?.layers ?? []) { const src = (l as {source?: unknown}).source; if (typeof src === 'string' && !map.getSource(src) && !c.warned.has(`6 ${l.id} ${src}`)) warn(2, l.id, src); }
    } else if (kind === 2) {
        const next = a as Given, before = b as Given | undefined;
        // (A template that is replaced by one with other slots: the layers of the map give it the same parameters.)
        if (before && differ(next.images, before.images) && c.ready()) slots(map.getStyle()?.layers ?? [], [], next.images);
        if (!before && 'glyphs' in next) warn(20);
        if (!before && next.view && (next.initialView as {bounds?: unknown} | undefined)?.bounds) warn(1148, c.name);
        for (const id in next.sources) { const x = next.sources[id] as {type?: string; data?: unknown} | null; if (x?.type === 'geojson' && x.data == null && !(next.data && id in next.data)) warn(1189, id); }
        for (const k in next) if (k !== 'glyphs' && !descriptionFields.has(k)) k === 'extend' ? warn(10524) : warn(524, k);
        if (next.controls !== before?.controls) {
            const keys = new Set<string>();
            for (const {key} of next.controls ?? []) { if (keys.has(key)) key.startsWith('custom:') ? warn(1195, key.slice(7), 'c') : warn(1195, key.slice(0, key.indexOf('{'))); keys.add(key); }
        }
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
    } else if (kind === 9) warn(30, a, (map.getSource(b) as {type?: string} | undefined)?.type ?? 'geojson');
    else if (kind === 7) warn(23);
    // (Each unknown option warns once for each map, whichever of overlay(), update() and patch() gave it first.)
    else if (kind === 1647) { for (const k in b) if (!overlayOptions.includes(k) && !c.warned.has('1647 ' + k)) { c.warned.add('1647 ' + k); console.warn(mistake(1647, k, a)); } }
    else if (kind === 1190) warn(1190);
    else if (kind === 1147) { for (const k of ['padding', 'maxZoom']) if (k in b) warn(1147, a, k); }
    else {
        slots(a.layers, b?.layers);
        for (const l of [...a.layers, ...b?.layers ?? []]) for (const g of ['paint', 'layout'] as const) for (const k in l[g]) { const why = zoomCurveError(l[g][k]); if (why) warn(1057, `the layer "${l.id}", ${g} property "${k}"`, why); }
        properties([...a.layers, ...b?.layers ?? []]);
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
                    : `[map-jr-gl] ${name} is not available in @map-jr/map-jr-gl/maplibre-compat. Remove the use, or see docs/reference/maplibre-differences.md for what replaces it.`);
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
