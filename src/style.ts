import {compileFilter, compileProp, type Fn, type Prop, type PropKind} from './expr.ts';
import {PM_PREFIX, archive} from './pmtiles.ts';
import type {ContourConfig} from './contour.ts';

/** Sources whose tiles are built into geometry by the tile workers (as opposed to images the engine draws directly). */
export const isGeometrySource = (s: {type: string}) => s.type === 'vector' || s.type === 'geojson' || s.type === 'contour';

/** Supported properties per layer type: [style-spec name, kind, default]. Anything else in a style is ignored. */
const SPEC: Record<string, Record<string, [string, PropKind, any]>> = {
    background: {color: ['background-color', 'color', '#000'], opacity: ['background-opacity', 'number', 1]},
    fill: {color: ['fill-color', 'color', '#000'], opacity: ['fill-opacity', 'number', 1], outline: ['fill-outline-color', 'color', 'rgba(0,0,0,0)'], antialias: ['fill-antialias', 'raw', true]},
    line: {
        color: ['line-color', 'color', '#000'], opacity: ['line-opacity', 'number', 1], width: ['line-width', 'number', 1],
        gap: ['line-gap-width', 'number', 0], dash: ['line-dasharray', 'discrete', null], cap: ['line-cap', 'string', 'butt'], join: ['line-join', 'string', 'miter'],
    },
    'fill-extrusion': {
        color: ['fill-extrusion-color', 'color', '#000'], opacity: ['fill-extrusion-opacity', 'number', 1],
        height: ['fill-extrusion-height', 'number', 0], base: ['fill-extrusion-base', 'number', 0],
    },
    circle: {
        color: ['circle-color', 'color', '#000'], opacity: ['circle-opacity', 'number', 1], radius: ['circle-radius', 'number', 5],
        strokeColor: ['circle-stroke-color', 'color', '#000'], strokeWidth: ['circle-stroke-width', 'number', 0],
        strokeOpacity: ['circle-stroke-opacity', 'number', 1], blur: ['circle-blur', 'number', 0], translate: ['circle-translate', 'string', [0, 0]],
    },
    raster: {opacity: ['raster-opacity', 'number', 1], saturation: ['raster-saturation', 'number', 0], contrast: ['raster-contrast', 'number', 0],
        brightnessMin: ['raster-brightness-min', 'number', 0], brightnessMax: ['raster-brightness-max', 'number', 1], hueRotate: ['raster-hue-rotate', 'number', 0]},
    hillshade: {
        shadow: ['hillshade-shadow-color', 'color', '#000'], highlight: ['hillshade-highlight-color', 'color', '#fff'], accent: ['hillshade-accent-color', 'color', '#000'],
        exaggeration: ['hillshade-exaggeration', 'number', 0.5], direction: ['hillshade-illumination-direction', 'number', 335],
        anchor: ['hillshade-illumination-anchor', 'string', 'viewport'],
    },
    symbol: {
        icon: ['icon-image', 'string', ''], iconSize: ['icon-size', 'number', 1], iconOffset: ['icon-offset', 'raw', [0, 0]], iconRotate: ['icon-rotate', 'number', 0],
        iconFit: ['icon-text-fit', 'string', 'none'], iconFitPad: ['icon-text-fit-padding', 'raw', [0, 0, 0, 0]], iconOverlap: ['icon-allow-overlap', 'raw', false],
        iconOptional: ['icon-optional', 'raw', false], textOptional: ['text-optional', 'raw', false], iconAlign: ['icon-rotation-alignment', 'string', 'auto'],
        textAlign: ['text-rotation-alignment', 'string', 'auto'], symbolSpacing: ['symbol-spacing', 'number', 250], varAnchor: ['text-variable-anchor', 'raw', null],
        radial: ['text-radial-offset', 'number', 0], ignore: ['text-ignore-placement', 'raw', false],
        color: ['text-color', 'color', '#000'], opacity: ['text-opacity', 'number', 1],
        haloColor: ['text-halo-color', 'color', 'rgba(0,0,0,0)'], haloWidth: ['text-halo-width', 'number', 0],
        field: ['text-field', 'string', ''], size: ['text-size', 'number', 16], font: ['text-font', 'raw', ['Regular']],
        maxWidth: ['text-max-width', 'number', 10], spacing: ['text-letter-spacing', 'number', 0],
        offset: ['text-offset', 'raw', [0, 0]], anchor: ['text-anchor', 'string', 'center'],
        transform: ['text-transform', 'string', 'none'], padding: ['text-padding', 'number', 2],
        overlap: ['text-allow-overlap', 'raw', false], placement: ['symbol-placement', 'string', 'point'],
    },
};

export interface LayerJSON {
    id: string; type: string; source?: string; 'source-layer'?: string; minzoom?: number; maxzoom?: number;
    filter?: any; paint?: Record<string, any>; layout?: Record<string, any>; metadata?: Record<string, any>;
}

/**
 * Per-layer adjustments for server-rendered output, read from `metadata["tessera:ssr"]` in the style. `metadata` is the
 * style specification's extension point, so a style carrying these stays valid for MapLibre, which ignores them.
 */
export interface SSROverrides {
    /** Leave the layer out of server output. */
    hidden?: boolean;
    /** An extra filter that features must also pass, e.g. to keep only major roads. */
    filter?: unknown;
    minzoom?: number; maxzoom?: number;
    paint?: Record<string, unknown>; layout?: Record<string, unknown>;
    /** Drop vertices closer together than this many pixels (default 0.6). */
    simplify?: number;
    /** Drop features smaller than this many pixels (default 0.8). */
    minSize?: number;
}
export const SSR_KEY = 'tessera:ssr';

/** Applies each layer's server overrides, returning the style layers to render on the server. */
export function applySSROverrides(layers: LayerJSON[]): LayerJSON[] {
    const out: LayerJSON[] = [];
    for (const l of layers) {
        const o = l.metadata?.[SSR_KEY] as SSROverrides | undefined;
        if (!o) { out.push(l); continue; }
        if (o.hidden) continue;
        out.push({...l, minzoom: o.minzoom ?? l.minzoom, maxzoom: o.maxzoom ?? l.maxzoom, paint: {...l.paint, ...o.paint}, layout: {...l.layout, ...o.layout},
            metadata: {...l.metadata, 'tessera:and-filter': o.filter}});
    }
    return out;
}

export interface CompiledLayer {
    id: string; type: string; source?: string; sourceLayer?: string; minzoom: number; maxzoom: number;
    visible: boolean; filter: Fn | null; p: Record<string, Prop>;
    ssr?: SSROverrides;
}

export function compileLayer(l: LayerJSON): CompiledLayer | null {
    const spec = SPEC[l.type];
    if (!spec) return null;
    const p: Record<string, Prop> = {};
    for (const k in spec) {
        const [name, kind, def] = spec[k];
        p[k] = compileProp(l.paint?.[name] ?? l.layout?.[name], kind, def);
    }
    // A server-only extra filter is compiled separately, so it can be an expression even when the layer's own filter is legacy syntax.
    const own = compileFilter(l.filter), extra = compileFilter(l.metadata?.['tessera:and-filter']);
    return {
        ssr: l.metadata?.[SSR_KEY],
        id: l.id, type: l.type, source: l.source, sourceLayer: l['source-layer'],
        minzoom: l.minzoom ?? 0, maxzoom: l.maxzoom ?? 24,
        // Pattern fills need sprite images, which are not supported yet; hiding them beats drawing solid black.
        visible: l.layout?.visibility !== 'none' && !l.paint?.['fill-pattern'] && !l.paint?.['line-pattern'], filter: own && extra ? c => own(c) && extra(c) : own ?? extra, p,
    };
}

export interface SourceInfo {
    type: 'vector' | 'raster' | 'raster-dem' | 'geojson' | 'contour';
    /** Contour sources: how to derive lines from their elevation source. */
    contour?: ContourConfig;
    /** GeoJSON sources carry their data; it is handed to the tile workers, which cut tiles from it. */
    data?: unknown; tiles: string[]; minzoom: number; maxzoom: number; tileSize: number; attribution?: string; encoding?: 'terrarium' | 'mapbox';
}

/** A style with everything network-dependent already resolved, so it can be posted to a worker as plain JSON. */
export interface FontSource { family: string; src: string; weight?: string | number; style?: string; unicodeRange?: string }
export interface ResolvedStyle { layers: LayerJSON[]; sources: Record<string, SourceInfo>; unsupported: string[]; sprite?: string; fonts?: FontSource[] }

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
            sources[name] = {type: 'geojson', data, tiles: [`geojson://${name}/{z}/{x}/{y}`], minzoom: 0, maxzoom: raw.maxzoom ?? 18, tileSize: 512, attribution: raw.attribution};
            continue;
        }
        if (raw.type !== 'vector' && raw.type !== 'raster' && raw.type !== 'raster-dem') continue;
        let src = raw;
        if (typeof src.url === 'string' && src.url.startsWith(PM_PREFIX)) {
            // A PMTiles archive: its header supplies the zoom range, and tiles are addressed inside the archive.
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
            tileSize: raw.type === 'vector' ? 512 : src.tileSize ?? 512, attribution: src.attribution,
            encoding: raw.type === 'raster-dem' ? (raw.encoding === 'terrarium' ? 'terrarium' : 'mapbox') : undefined,
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
        const ok = !!SPEC[l.type] && (l.type === 'background' || !!sources[l.source!]);
        if (!ok) unsupported.add(l.type);
        return ok;
    });
    const sprite = typeof style.sprite === 'string' ? (base ? new URL(style.sprite, base).href : style.sprite) : undefined;
    // The style specification's `font-faces`: font files per `text-font` name, optionally limited to unicode ranges.
    const fonts: FontSource[] = [];
    for (const [name, value] of Object.entries<any>(style['font-faces'] ?? {})) {
        const face = parseFontName(name);
        for (const entry of typeof value === 'string' ? [{url: value}] : value) {
            fonts.push({...face, src: base ? new URL(entry.url, base).href : entry.url, unicodeRange: entry['unicode-range']?.join(', ')});
        }
    }
    return {layers, sources, unsupported: [...unsupported], sprite, fonts};
}

export function tileURL(src: SourceInfo, z: number, x: number, y: number) {
    return src.tiles[(x + y) % src.tiles.length].replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}

export interface SpriteIcon { x: number; y: number; width: number; height: number; pixelRatio: number }
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
