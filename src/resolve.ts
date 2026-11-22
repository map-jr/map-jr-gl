// The part of style handling that the page needs: types, and turning a style into one that is ready for the
// engine (its sources and sprite found, its layers checked). The page script loads this file, so it must not import
// the expression compiler or the text shaper: those are for the engine and the tile workers.
import {httpError} from './requests.ts';
import type {GeoJSONOptions} from './geojson.ts';
// (The reader for PMTiles archives is loaded only for a style that has one: the page script stays small.)
const PM_PREFIX = 'pmtiles://';
/** A URL of a custom protocol (`addProtocol`), which can have another URL inside: `cog://https://example.com/a.tif`. */
const CUSTOM = /^(?!https?:\/\/)[a-z][a-z0-9+.-]*:\/\//i;
/**
 * `url` as a complete URL: a relative URL is joined to `base`. A URL of a custom protocol stays as it is written,
 * because the URL parser removes the colon of the URL inside it (`cog://https//example.com/a.tif`).
 */
export const absolute = (url: string, base?: string) => !base || CUSTOM.test(url) ? url : new URL(url, base).href;
import type {ContourConfig} from './contour.ts';

/** The fonts for labels when the style and the page name none that is available. */
export const DEFAULT_FONT = '"Noto Sans", "Helvetica Neue", Arial, sans-serif';

/** The layer types that the library draws. (style.ts has the properties of each.) */
export const LAYER_TYPES = new Set(['background', 'fill', 'line', 'fill-extrusion', 'circle', 'heatmap', 'raster', 'hillshade', 'color-relief', 'symbol']);

export interface LayerJSON {
    /** The page changes the visibility of this layer: its tiles are built also while it is hidden (see `layerRules`). */
    keep?: boolean;
    id: string; type: string; source?: string; 'source-layer'?: string; minzoom?: number; maxzoom?: number;
    filter?: any; paint?: Record<string, any>; layout?: Record<string, any>; metadata?: Record<string, any>;
    /** A layer of the type "custom" of the compat entry: the object of the user (see `addLayer` in compat-map.ts). */
    implementation?: object;
}

/** The light on buildings, as in the style specification. The position is a distance, an azimuth and a polar angle. */
/** The root property `sky` of a style. Each value can be a zoom function or an expression. */
export interface Sky { 'sky-color'?: unknown; 'horizon-color'?: unknown; 'fog-color'?: unknown; 'sky-horizon-blend'?: unknown; 'horizon-fog-blend'?: unknown; 'fog-ground-blend'?: unknown; 'atmosphere-blend'?: unknown }
export interface Light { anchor?: 'map' | 'viewport'; position?: unknown; color?: unknown; intensity?: unknown }

export interface SourceInfo {
    type: 'vector' | 'raster' | 'raster-dem' | 'geojson' | 'contour' | 'image' | 'video' | 'canvas';
    /**
     * Image, video and canvas sources: the picture's address (none for a video or a canvas, whose frames the page sends)
     * and where its corners go (top left, top right, bottom right, bottom left; longitude, latitude).
     */
    url?: string; coordinates?: [number, number][];
    /** Contour sources: how to derive lines from their elevation source. */
    contour?: ContourConfig;
    /** GeoJSON sources carry their data; it is handed to the tile workers, which cut tiles from it. */
    data?: unknown; /** GeoJSON sources: clusters and the id property. */ options?: GeoJSONOptions; tiles: string[]; minzoom: number; maxzoom: number; tileSize: number; attribution?: string; /** A PMTiles archive: its URL and its first bytes (header and root directory). */ head?: {url: string; bytes: Uint8Array}; /** The rows of tiles are counted from the south (`scheme: 'tms'`). */ tms?: boolean; /** Vector sources: the ids of `vector_layers` of the TileJSON (for the compat entry). */ layerIds?: string[]; encoding?: 'terrarium' | 'mapbox' | number[];
    /** Vector sources: the property that gives the id of a feature, or such a property for each source layer. */
    promoteId?: string | Record<string, string>;
    /** The area that has tiles: west, south, east, north. A tile outside it is not requested. */
    bounds?: number[];
}

/** A style with everything network-dependent already resolved, so it can be posted to a worker as plain JSON. */
export interface FontSource { family: string; src: string; weight?: string | number; style?: string; unicodeRange?: string; /** The `text-font` name that the face is for, for messages. */ name?: string }
/** The web fonts of `font-faces` of the style specification: a URL or a list of `{url, 'unicode-range'}`, by `text-font` name. */
export type FontFaces = Record<string, string | {url: string; 'unicode-range'?: string[]}[]>;

/** The font files of `font-faces`, one for each URL, with relative URLs joined to `base`. */
export function fontFaces(faces: FontFaces | undefined, base?: string): FontSource[] {
    const fonts: FontSource[] = [];
    for (const [name, value] of Object.entries(faces ?? {})) {
        const face = parseFontName(name);
        for (const entry of typeof value === 'string' ? [{url: value} as {url: string; 'unicode-range'?: string[]}] : Array.isArray(value) ? value : []) {
            if (typeof entry?.url === 'string') fonts.push({...face, name, src: base ? new URL(entry.url, base).href : entry.url, unicodeRange: entry['unicode-range']?.join(', ')});
        }
    }
    return fonts;
}
export interface ResolvedStyle { layers: LayerJSON[]; sources: Record<string, SourceInfo>; unsupported: string[]; /** The URL of the glyph files of the style, with `{fontstack}` and `{range}`. */ glyphs?: string; /** A source is still on its way (see `Partial`): the map is not idle. */ waiting?: boolean; sprite?: string; fonts?: FontSource[];
    /** The names of the images in `metadata["map-jr:images"]` of the style: they win over the sprite images of the same name (#1199). */
    own?: string[];
    /** 3D terrain: the raster-dem source that shapes the ground, and how much to exaggerate it. */
    terrain?: {source: string; exaggeration: number};
    /** The root property `projection` of the style, as it is (see `globeStops` in geo.ts). */
    projection?: {type?: unknown};
    /** The light on buildings (the `light` of the style). */
    light?: Light;
    /** The sky above the horizon and the fog on 3D terrain (the `sky` of the style). */
    sky?: Sky;
    /** The root property `transition` of the style (#960). */
    transition?: {duration?: number; delay?: number};
    /** Global state: the values `global-state` expressions read. */
    state?: Record<string, unknown> }

/**
 * Splits a style font name such as "Open Sans Semibold Italic" into a CSS family, weight and style, so text can be drawn
 * with ordinary web fonts. The same split is applied to `text-font` values and to the names in a style's `font-faces`.
 */
export function parseFontName(name: string): {family: string; weight: number; style: 'normal' | 'italic'} {
    const n = name.toLowerCase();
    const weight = /black|heavy/.test(n) ? 900 : /extra ?bold/.test(n) ? 800 : /semi ?bold|demi/.test(n) ? 600 : /bold/.test(n) ? 700 :
        /medium/.test(n) ? 500 : /light/.test(n) ? 300 : 400;
    const family = name.replace(/\b(thin|extra ?light|light|regular|normal|book|medium|semi ?bold|demi ?bold|demi|extra ?bold|bold|black|heavy|italic|oblique)\b/gi, '').replace(/\s+/g, ' ').trim().replace(/["\\|]/g, '');
    return {family, weight, style: /italic|oblique/.test(n) ? 'italic' : 'normal'};
}

/** The fields of a font key (see `fontKey`): a name of the stack can contain "|", so only the first two separate fields. */
export function splitFontKey(key: string): [variant: string, family: string, stack: string | undefined] {
    const a = key.indexOf('|'), b = key.indexOf('|', a + 1);
    return a < 0 ? [key, '', undefined] : b < 0 ? [key.slice(0, a), key.slice(a + 1), undefined] : [key.slice(0, a), key.slice(a + 1, b), key.slice(b + 1)];
}
/** The CSS generic family keywords: a `text-font` name that is one of them stays unquoted, so that it names the fonts of the system. */
const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|math|emoji|fangsong|ui-serif|ui-sans-serif|ui-monospace|ui-rounded)$/i;
/**
 * The CSS family list of a font stack ("Segoe UI Semibold,system-ui" -> `"Segoe UI", system-ui`): each name without its
 * weight and style words, in order, once each, quoted unless it is a generic family keyword.
 */
export function cssFamilies(stack: string): string {
    const out = new Set<string>();
    for (const name of stack.split(',')) {
        const f = parseFontName(name).family;
        if (f) out.add(GENERIC.test(f) ? f.toLowerCase() : `"${f}"`);
    }
    return [...out].join(', ');
}
/** "Open Sans Semibold Italic" -> "italic 600|Open Sans|Open Sans Semibold Italic": CSS style and weight of the first name, its family, and the font stack (for the CSS family list and the glyph files of the style). */
export function fontKey(names: unknown): string {
    const f = parseFontName(String(Array.isArray(names) ? names[0] : names));
    return (f.style === 'italic' ? 'italic ' : '') + f.weight + '|' + f.family + '|' + (Array.isArray(names) ? names.join(',') : names);
}

/** What the network gave for a source of a style (its TileJSON, its GeoJSON, the header of its archive), by source object. */
const told = new WeakSet<object>();
const fetched = new WeakMap<object, {url: string; p: Promise<any>; v?: any; err?: any; told?: WeakSet<object>; late?: () => void}>();
/** Puts data that the map fetched itself (`setData` with a URL) in the place of the kept result of a source. */
export function keep(raw: object, url: string, v: unknown) { fetched.set(raw, {url, p: Promise.resolve(v), v}); }
/** The kept result of a source for this URL, or undefined when the map has none (yet) or has it for another URL. */
export function kept(raw: object, url: string): unknown { const m = fetched.get(raw); return m?.url === url ? m.v : undefined; }
/** For a change of a style that is in use: a source whose data is not there yet is left out, and `late` is called when it is. */
export interface Partial { late(): void; fail(error: unknown): void }
const SKIP = Symbol();
/**
 * The network data of a source, fetched one time for the source object and its URL. A change of the style then
 * resolves without a request. With `partial`, a source that is still on its way gives SKIP.
 */
function once(raw: object, url: string, load: () => Promise<any>, partial?: Partial, fail?: (error: unknown) => void): any {
    let m = fetched.get(raw);
    if (m?.url !== url) {
        const made: NonNullable<typeof m> = m = {url, p: load()};
        fetched.set(raw, m);
        m.p.then(v => { made.v = v; made.late?.(); }, e => { made.err = e ?? 1; made.late?.(); });
    }
    // A failed request is not made again for the same source object, and each map hears of it one time, as in MapLibre
    // GL JS (#809). A new source object (a new style) makes a new request. Without `fail`, the whole style fails, and
    // a later call tries again.
    const report = (f: (e: unknown) => void, e: unknown) => { const t = m!.told ??= new WeakSet(); if (!t.has(f)) { t.add(f); f(e); } return SKIP; };
    if (!partial) return fail ? m.p.catch(e => report(fail, e)) : m.p.catch(e => { fetched.delete(raw); throw e; });
    if (m.err) return report(partial.fail, m.err);
    if (m.v === undefined) { m.late = partial.late; return SKIP; }
    return m.v;
}

/**
 * With `fail`, a source that cannot be used (its request failed, or it has no tiles) is reported to that function and
 * left out: the other sources and their layers are drawn. Without it, such a source makes the whole style fail.
 */
export async function resolveStyle(style: any, fetchFn: typeof fetch = (...a) => fetch(...a), base?: string, partial?: Partial, fail = partial?.fail, geojsonBuffer?: number): Promise<ResolvedStyle> {
    const bad = (error: unknown): typeof SKIP => { if (!fail) throw error; fail(error); return SKIP; };
    // (With `partial` or `fail`, `once` reports a failure itself, one time for each map.)
    const get = (raw: object, url: string, load: () => Promise<any>) => partial || fail ? once(raw, url, load, partial, fail) : once(raw, url, load);
    if (typeof style === 'string') {
        const url = absolute(style, base);
        const res = await fetchFn(url);
        if (!res.ok) throw httpError('style', url, res.status);
        base = url;
        style = await res.json();
    }
    // The sources are asked for at the same time: each TileJSON, GeoJSON file or archive header is a request of its own.
    const sources: Record<string, SourceInfo> = {}, raws = Object.entries<any>(style.sources ?? {});
    const made = await Promise.all(raws.map(async ([name, raw]): Promise<SourceInfo | undefined> => {
        if (raw.type === 'geojson') {
            let data = raw.data;
            if (typeof data === 'string') {
                const url = absolute(data, base);
                data = await get(raw, url, async () => {
                    const res = await fetchFn(url);
                    if (!res.ok) throw httpError('GeoJSON', url, res.status);
                    return res.json();
                });
                if (data === SKIP) return;
            }
            // (`geojsonBuffer` is the buffer of a source that gives none: 128 in the compat entry, as in MapLibre GL JS.)
            const buffer = raw.buffer ?? geojsonBuffer;
            return {type: 'geojson', data, options: raw.cluster || raw.promoteId || raw.filter || raw.generateId || buffer !== undefined ? {filter: raw.filter, buffer, cluster: raw.cluster, clusterRadius: raw.clusterRadius, clusterMaxZoom: raw.clusterMaxZoom, clusterMinPoints: raw.clusterMinPoints, clusterProperties: raw.clusterProperties, promoteId: raw.promoteId, generateId: raw.generateId} : undefined, tiles: [`geojson://${name}/{z}/{x}/{y}`], minzoom: 0, maxzoom: raw.maxzoom ?? 18, tileSize: 512, attribution: raw.attribution};
        }
        if ((raw.type === 'image' && raw.url || raw.type === 'video' && raw.urls?.length || raw.type === 'canvas' && raw.canvas) && raw.coordinates?.length === 4) {
            return {type: raw.type, url: raw.url && absolute(raw.url, base), coordinates: raw.coordinates, tiles: [], minzoom: 0, maxzoom: 22, tileSize: 512};
        }
        if (raw.type !== 'vector' && raw.type !== 'raster' && raw.type !== 'raster-dem') return;
        if (!raw.tiles && !raw.url) {
            // (Reported one time for the source object, not again for each change of the style.)
            if (!fetched.has(raw)) { fetched.set(raw, {url: '', p: Promise.resolve(), err: 1}); bad(new Error(`[map-jr-gl] The source "${name}" has no "tiles" and no "url". Give it one of them.`)); }
            return;
        }
        if (raw.type === 'vector' && raw.encoding === 'mlt') {
            // MapLibre Tiles are not decoded (#1436): the source is left out, and reported one time for the source object (#1438).
            if (!fetched.has(raw)) { fetched.set(raw, {url: '', p: Promise.resolve(), err: 1}); bad(new Error(`[map-jr-gl] The source "${name}" has encoding "mlt". MapLibre Tiles are not supported; use tiles with encoding "mvt".`)); }
            return;
        }
        let src = raw;
        if (typeof src.url === 'string' && src.url.startsWith(PM_PREFIX)) {
            // A PMTiles archive: its header supplies the zoom range, and tiles are addressed inside the archive.
            const at = src.url.slice(PM_PREFIX.length), file = base ? new URL(at, base).href : at;
            const info = await get(raw, file, async () => (await import('./pmtiles-info.ts')).archive(file, fetchFn).info());
            if (info === SKIP) return;
            src = {minzoom: info.minzoom, maxzoom: info.maxzoom, attribution: info.attribution, ...raw, tiles: [`${PM_PREFIX}${file}/{z}/{x}/{y}`], head: info.head && {url: file, bytes: info.head}};
        } else if (!src.tiles && src.url) {
            const url = absolute(src.url, base);
            const json = await get(raw, url, async () => {
                const res = await fetchFn(url);
                if (!res.ok) throw httpError('source', url, res.status);
                return res.json();
            });
            if (json === SKIP) return;
            src = {...json, ...Object.fromEntries(Object.entries(raw).filter(([k]) => k !== 'url'))};
            src.tiles = src.tiles.map((t: string) => CUSTOM.test(t) ? t : decodeURI(new URL(t, url).href));
        } else if (base) {
            src = {...src, tiles: src.tiles.map((t: string) => CUSTOM.test(t) ? t : decodeURI(new URL(t, base).href))};
        }
        return {
            type: raw.type, tiles: src.tiles, minzoom: src.minzoom ?? 0, maxzoom: src.maxzoom ?? (raw.type === 'vector' ? 14 : 22),
            tileSize: raw.type === 'vector' ? 512 : src.tileSize ?? 512, attribution: src.attribution, tms: src.scheme === 'tms', bounds: src.bounds,
            // (From the source or from its TileJSON. For `encoding: 'custom'`, the factors of red, green and blue and the shift:
            // the engine checks them, see `setStyle` there.)
            encoding: raw.type !== 'raster-dem' ? undefined : src.encoding === 'custom' ? [src.redFactor ?? 1, src.greenFactor ?? 1, src.blueFactor ?? 1, src.baseShift ?? 0] : src.encoding === 'terrarium' ? 'terrarium' : 'mapbox',
            head: src.head,
            promoteId: raw.type === 'vector' ? raw.promoteId : undefined,
            layerIds: Array.isArray(src.vector_layers) ? src.vector_layers.map((l: any) => String(l?.id)) : undefined,
        };
    }));
    // (In the order of the style, whichever answer came first.)
    raws.forEach(([name], i) => { if (made[i]) sources[name] = made[i]!; });
    // Contour sources (an extension to the style specification) are resolved last: each needs its elevation source.
    for (const [name, raw] of Object.entries<any>(style.sources ?? {})) {
        if (raw.type !== 'contour') continue;
        const dem = sources[raw.source];
        if (!dem || dem.type !== 'raster-dem') { bad(new Error(`Contour source "${name}" needs "source" to name a raster-dem source`)); continue; }
        const zooms = Object.keys(raw.thresholds ?? {}).map(Number);
        sources[name] = {
            type: 'contour', tiles: [`contour://${name}/{z}/{x}/{y}`], minzoom: Math.max(0, Math.min(...zooms, 24)), maxzoom: raw.maxzoom ?? 15, tileSize: 512, attribution: dem.attribution,
            contour: {
                tiles: dem.tiles, encoding: dem.encoding ?? 'mapbox', demMaxzoom: dem.maxzoom, demMinzoom: dem.minzoom, thresholds: raw.thresholds ?? {}, multiplier: raw.multiplier ?? 1,
                overzoom: raw.overzoom ?? 1, contourLayer: raw.contourLayer ?? 'contours', elevationKey: raw.elevationKey ?? 'ele', levelKey: raw.levelKey ?? 'level',
            },
        };
    }
    const unsupported = new Set<string>();
    const layers = (style.layers as LayerJSON[]).filter(l => {
        const ok = !!l.implementation || LAYER_TYPES.has(l.type) && (l.type === 'background' || !!sources[l.source!]);
        if (!ok && !LAYER_TYPES.has(l.type)) unsupported.add(l.type);
        return ok;
    });
    // A style has one sprite (a URL) or a list of sprites with ids. A list goes to the engine as text (see loadIcons).
    // An empty URL is no sprite, as in MapLibre GL JS (#760).
    const spriteURL = (u: string) => absolute(u, base);
    const sprite = typeof style.sprite === 'string' ? style.sprite ? spriteURL(style.sprite) : undefined
        : Array.isArray(style.sprite) && style.sprite.length ? JSON.stringify(style.sprite.map((s: {id: string; url: string}) => ({id: s.id, url: spriteURL(s.url)}))) : undefined;
    const fonts = fontFaces(style['font-faces'], base);
    const rawTerrain = (style as any).terrain;
    const terrain = rawTerrain?.source && sources[rawTerrain.source]?.type === 'raster-dem' ? {source: rawTerrain.source as string, exaggeration: rawTerrain.exaggeration ?? 1} : undefined;
    // `state` in a style gives each property a default; values set at runtime arrive already resolved.
    const rawState = (style as any).state as Record<string, any> | undefined;
    const state = rawState && Object.fromEntries(Object.entries(rawState).map(([k, v]) => [k, v && typeof v === 'object' && 'default' in v ? v.default : v]));
    // (A relative URL: joined by hand, because `{fontstack}` must stay as it is.)
    const g = style.glyphs, glyphs = typeof g !== 'string' ? undefined : /^[a-z][a-z0-9+.-]*:/i.test(g) || !base ? g : g.startsWith('//') ? new URL(base).protocol + g : g[0] === '/' ? new URL(base).origin + g : base.replace(/[?#].*$/, '').replace(/[^/]*$/, '') + g;
    const given = (style as any).metadata?.['map-jr:images'], own = given && typeof given === 'object' && !Array.isArray(given) ? Object.keys(given).slice(0, 500) : undefined;
    return {layers, sources, unsupported: [...unsupported], sprite, own, glyphs, fonts, terrain, state, light: (style as any).light, sky: (style as any).sky, transition: (style as any).transition, projection: (style as any).projection, waiting: partial && Object.keys(style.sources ?? {}).some(id => !sources[id] && fetched.get(style.sources[id]) && !fetched.get(style.sources[id])!.err)};
}

export function tileURL(src: SourceInfo, z: number, x: number, y: number, ratio = 1) {
    // `{bbox-epsg-3857}` is for WMS servers: the edges of the tile in metres of Web Mercator (west, south, east, north).
    const edge = (v: number) => (v / 2 ** z - 0.5) * 40075016.68557849;
    // The scheme `tms` counts the rows from the south. `{quadkey}` is the tile as one number in base 4 (Bing Maps).
    // `{prefix}` is two hex digits from the column and the row, and `{ratio}` is `@2x` on a screen with a pixel ratio
    // above 1, for every kind of source; both follow MapLibre GL JS (`CanonicalTileID.url`).
    return src.tiles[(x + y) % src.tiles.length].replace(/{prefix}/g, (x % 16).toString(16) + (y % 16).toString(16))
        .replace(/{z}/g, String(z)).replace(/{x}/g, String(x)).replace(/{y}/g, String(src.tms ? 2 ** z - 1 - y : y))
        .replace(/{ratio}/g, ratio > 1 ? '@2x' : '')
        .replace(/{bbox-epsg-3857}/g, () => [edge(x), -edge(y + 1), edge(x + 1), -edge(y)].join())
        .replace(/{quadkey}/g, () => { let key = ''; for (let i = z; i > 0; i--) key += (x >> i - 1 & 1) + (y >> i - 1 & 1) * 2; return key; });
}

export interface SpriteIcon {
    x: number; y: number; width: number; height: number; pixelRatio: number;
    /** Ranges of the image (in its pixels) that may stretch when the icon is fitted around text; the rest keeps its size. */
    stretchX?: [number, number][]; stretchY?: [number, number][];
    /** The part of the image the text should sit inside: left, top, right, bottom. */
    content?: [number, number, number, number];
    /** How each axis follows the text when the icon is fitted around it. `proportional` keeps the shape of the content box. */
    textFitWidth?: 'stretchOrShrink' | 'stretchOnly' | 'proportional'; textFitHeight?: 'stretchOrShrink' | 'stretchOnly' | 'proportional';
    /** A single-channel distance field rather than a picture: drawn in `icon-color`, and sharp at any size. */
    sdf?: boolean;
    /** The sheet of the icon in `sheets` of the sprite, for a sprite of several sheets (the server renderer). */
    sheet?: number;
}
export interface Sprite { icons: Record<string, SpriteIcon>; image: string; width: number; height: number; sheets?: {image: string; width: number; height: number}[] }

/** Loads a sprite sheet's index. `image` is the URL of its PNG; the caller decides how to load pixels. */
export async function loadSprite(url: string, highDensity: boolean, fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<Sprite> {
    const base = url + (highDensity ? '@2x' : '');
    const res = await fetchFn(base + '.json');
    if (!res.ok) throw httpError('sprite', base + '.json', res.status);
    const icons = await res.json() as Record<string, SpriteIcon>;
    let width = 0, height = 0;
    for (const i of Object.values(icons)) { width = Math.max(width, i.x + i.width); height = Math.max(height, i.y + i.height); }
    return {icons, image: base + '.png', width, height};
}

/** The `promoteId` of each vector source that has one, for the tile builders. */
export function promoteIds(style: ResolvedStyle): Record<string, string | Record<string, string>> {
    return Object.fromEntries(Object.entries(style.sources).filter(([, s]) => s.promoteId != null).map(([name, s]) => [name, s.promoteId!]));
}
