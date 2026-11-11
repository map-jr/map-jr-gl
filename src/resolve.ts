// The part of style handling that the page needs: types, and turning a style into one that is ready for the
// engine (its sources and sprite found, its layers checked). The page script loads this file, so it must not import
// the expression compiler or the text shaper: those are for the engine and the tile workers.
import type {GeoJSONOptions} from './geojson.ts';
// (The reader for PMTiles archives is loaded only for a style that has one: the page script stays small.)
const PM_PREFIX = 'pmtiles://';
import type {ContourConfig} from './contour.ts';

/** The fonts for labels when the style and the page name none that is available. */
export const DEFAULT_FONT = '"Noto Sans", "Helvetica Neue", Arial, sans-serif';

/** The layer types that the library draws. (style.ts has the properties of each.) */
export const LAYER_TYPES = new Set(['background', 'fill', 'line', 'fill-extrusion', 'circle', 'heatmap', 'raster', 'hillshade', 'symbol']);

export interface LayerJSON {
    id: string; type: string; source?: string; 'source-layer'?: string; minzoom?: number; maxzoom?: number;
    filter?: any; paint?: Record<string, any>; layout?: Record<string, any>; metadata?: Record<string, any>;
}

/** The light on buildings, as in the style specification. The position is a distance, an azimuth and a polar angle. */
export interface Light { anchor?: 'map' | 'viewport'; position?: unknown; color?: unknown; intensity?: unknown }

export interface SourceInfo {
    type: 'vector' | 'raster' | 'raster-dem' | 'geojson' | 'contour' | 'image';
    /** Image sources: the picture's address and where its corners go (top left, top right, bottom right, bottom left; longitude, latitude). */
    url?: string; coordinates?: [number, number][];
    /** Contour sources: how to derive lines from their elevation source. */
    contour?: ContourConfig;
    /** GeoJSON sources carry their data; it is handed to the tile workers, which cut tiles from it. */
    data?: unknown; /** GeoJSON sources: clusters and the id property. */ options?: GeoJSONOptions; tiles: string[]; minzoom: number; maxzoom: number; tileSize: number; attribution?: string; /** The rows of tiles are counted from the south (`scheme: 'tms'`). */ tms?: boolean; encoding?: 'terrarium' | 'mapbox';
    /** The area that has tiles: west, south, east, north. A tile outside it is not requested. */
    bounds?: number[];
}

/** A style with everything network-dependent already resolved, so it can be posted to a worker as plain JSON. */
export interface FontSource { family: string; src: string; weight?: string | number; style?: string; unicodeRange?: string }
export interface ResolvedStyle { layers: LayerJSON[]; sources: Record<string, SourceInfo>; unsupported: string[]; sprite?: string; fonts?: FontSource[];
    /** 3D terrain: the raster-dem source that shapes the ground, and how much to exaggerate it. */
    terrain?: {source: string; exaggeration: number};
    /** The light on buildings (the `light` of the style). */
    light?: Light;
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
    const family = name.replace(/\b(thin|extra ?light|light|regular|normal|book|medium|semi ?bold|demi ?bold|demi|extra ?bold|bold|black|heavy|italic|oblique)\b/gi, '').replace(/\s+/g, ' ').trim().replace(/["\\]/g, '');
    return {family, weight, style: /italic|oblique/.test(n) ? 'italic' : 'normal'};
}

export async function resolveStyle(style: any, fetchFn: typeof fetch = (...a) => fetch(...a), base?: string): Promise<ResolvedStyle> {
    if (typeof style === 'string') {
        const url = base ? new URL(style, base).href : style;
        const res = await fetchFn(url);
        if (!res.ok) throw new Error(`Failed to load style ${url}: ${res.status}`);
        base = url;
        style = await res.json();
    }
    const sources: Record<string, SourceInfo> = {};
    for (const [name, raw] of Object.entries<any>(style.sources ?? {})) {
        if (raw.type === 'geojson') {
            let data = raw.data;
            if (typeof data === 'string') {
                const url = base ? new URL(data, base).href : data, res = await fetchFn(url);
                if (!res.ok) throw new Error(`Failed to load GeoJSON ${url}: ${res.status}`);
                data = await res.json();
            }
            sources[name] = {type: 'geojson', data, options: raw.cluster || raw.promoteId || raw.filter ? {filter: raw.filter, cluster: raw.cluster, clusterRadius: raw.clusterRadius, clusterMaxZoom: raw.clusterMaxZoom, clusterMinPoints: raw.clusterMinPoints, clusterProperties: raw.clusterProperties, promoteId: raw.promoteId} : undefined, tiles: [`geojson://${name}/{z}/{x}/{y}`], minzoom: 0, maxzoom: raw.maxzoom ?? 18, tileSize: 512, attribution: raw.attribution};
            continue;
        }
        if (raw.type === 'image' && raw.url && raw.coordinates?.length === 4) {
            sources[name] = {type: 'image', url: base ? new URL(raw.url, base).href : raw.url, coordinates: raw.coordinates, tiles: [], minzoom: 0, maxzoom: 22, tileSize: 512};
            continue;
        }
        if (raw.type !== 'vector' && raw.type !== 'raster' && raw.type !== 'raster-dem') continue;
        let src = raw;
        if (typeof src.url === 'string' && src.url.startsWith(PM_PREFIX)) {
            // A PMTiles archive: its header supplies the zoom range, and tiles are addressed inside the archive.
            const {archive} = await import('./pmtiles-info.ts');
            const at = src.url.slice(PM_PREFIX.length), file = base ? new URL(at, base).href : at, info = await archive(file, fetchFn).info();
            src = {minzoom: info.minzoom, maxzoom: info.maxzoom, attribution: info.attribution, ...raw, tiles: [`${PM_PREFIX}${file}/{z}/{x}/{y}`]};
        } else if (!src.tiles && src.url) {
            const url = base ? new URL(src.url, base).href : src.url;
            const res = await fetchFn(url);
            if (!res.ok) throw new Error(`Failed to load source ${url}: ${res.status}`);
            src = {...await res.json(), ...Object.fromEntries(Object.entries(raw).filter(([k]) => k !== 'url'))};
            src.tiles = src.tiles.map((t: string) => decodeURI(new URL(t, url).href));
        } else if (base) {
            src = {...src, tiles: src.tiles.map((t: string) => t.startsWith(PM_PREFIX) ? t : decodeURI(new URL(t, base).href))};
        }
        sources[name] = {
            type: raw.type, tiles: src.tiles, minzoom: src.minzoom ?? 0, maxzoom: src.maxzoom ?? (raw.type === 'vector' ? 14 : 22),
            tileSize: raw.type === 'vector' ? 512 : src.tileSize ?? 512, attribution: src.attribution, tms: src.scheme === 'tms', bounds: src.bounds,
            encoding: raw.type === 'raster-dem' ? (src.encoding === 'terrarium' ? 'terrarium' : 'mapbox') : undefined, // (from the source or from its TileJSON)
        };
    }
    // Contour sources (an extension to the style specification) are resolved last: each needs its elevation source.
    for (const [name, raw] of Object.entries<any>(style.sources ?? {})) {
        if (raw.type !== 'contour') continue;
        const dem = sources[raw.source];
        if (!dem || dem.type !== 'raster-dem') throw new Error(`Contour source "${name}" needs "source" to name a raster-dem source`);
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
        const ok = LAYER_TYPES.has(l.type) && (l.type === 'background' || !!sources[l.source!]);
        if (!ok) unsupported.add(l.type);
        return ok;
    });
    // A style has one sprite (a URL) or a list of sprites with ids. A list goes to the engine as text (see loadIcons).
    const spriteURL = (u: string) => base ? new URL(u, base).href : u;
    const sprite = typeof style.sprite === 'string' ? spriteURL(style.sprite)
        : Array.isArray(style.sprite) && style.sprite.length ? JSON.stringify(style.sprite.map((s: {id: string; url: string}) => ({id: s.id, url: spriteURL(s.url)}))) : undefined;
    // The style specification's `font-faces`: font files per `text-font` name, optionally limited to unicode ranges.
    const fonts: FontSource[] = [];
    for (const [name, value] of Object.entries<any>(style['font-faces'] ?? {})) {
        const face = parseFontName(name);
        for (const entry of typeof value === 'string' ? [{url: value}] : value) {
            fonts.push({...face, src: base ? new URL(entry.url, base).href : entry.url, unicodeRange: entry['unicode-range']?.join(', ')});
        }
    }
    const rawTerrain = (style as any).terrain;
    const terrain = rawTerrain?.source && sources[rawTerrain.source]?.type === 'raster-dem' ? {source: rawTerrain.source as string, exaggeration: rawTerrain.exaggeration ?? 1} : undefined;
    // `state` in a style gives each property a default; values set at runtime arrive already resolved.
    const rawState = (style as any).state as Record<string, any> | undefined;
    const state = rawState && Object.fromEntries(Object.entries(rawState).map(([k, v]) => [k, v && typeof v === 'object' && 'default' in v ? v.default : v]));
    return {layers, sources, unsupported: [...unsupported], sprite, fonts, terrain, state, light: (style as any).light};
}

export function tileURL(src: SourceInfo, z: number, x: number, y: number) {
    // `{bbox-epsg-3857}` is for WMS servers: the edges of the tile in metres of Web Mercator (west, south, east, north).
    const edge = (v: number) => (v / 2 ** z - 0.5) * 40075016.68557849;
    // The scheme `tms` counts the rows from the south. `{quadkey}` is the tile as one number in base 4 (Bing Maps).
    return src.tiles[(x + y) % src.tiles.length].replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(src.tms ? 2 ** z - 1 - y : y))
        .replace('{bbox-epsg-3857}', () => [edge(x), -edge(y + 1), edge(x + 1), -edge(y)].join())
        .replace('{quadkey}', () => { let key = ''; for (let i = z; i > 0; i--) key += (x >> i - 1 & 1) + (y >> i - 1 & 1) * 2; return key; });
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
}
export interface Sprite { icons: Record<string, SpriteIcon>; image: string; width: number; height: number }

/** Loads a sprite sheet's index. `image` is the URL of its PNG; the caller decides how to load pixels. */
export async function loadSprite(url: string, highDensity: boolean, fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<Sprite> {
    const base = url + (highDensity ? '@2x' : '');
    const res = await fetchFn(base + '.json');
    if (!res.ok) throw new Error(`Failed to load sprite ${base}.json: ${res.status}`);
    const icons = await res.json() as Record<string, SpriteIcon>;
    let width = 0, height = 0;
    for (const i of Object.values(icons)) { width = Math.max(width, i.x + i.width); height = Math.max(height, i.y + i.height); }
    return {icons, image: base + '.png', width, height};
}
