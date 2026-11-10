import {compileFilter, compileProp, type Fn, type Prop, type PropKind} from './expr.ts';

/** Supported properties per layer type: [style-spec name, kind, default]. Anything else in a style is ignored. */
const SPEC: Record<string, Record<string, [string, PropKind, any]>> = {
    background: {color: ['background-color', 'color', '#000'], opacity: ['background-opacity', 'number', 1]},
    fill: {color: ['fill-color', 'color', '#000'], opacity: ['fill-opacity', 'number', 1]},
    line: {
        color: ['line-color', 'color', '#000'], opacity: ['line-opacity', 'number', 1], width: ['line-width', 'number', 1],
        gap: ['line-gap-width', 'number', 0], dash: ['line-dasharray', 'discrete', null], cap: ['line-cap', 'string', 'butt'], join: ['line-join', 'string', 'miter'],
    },
    // Without camera pitch a building extrusion is just its footprint, so it is drawn as a fill.
    'fill-extrusion': {color: ['fill-extrusion-color', 'color', '#000'], opacity: ['fill-extrusion-opacity', 'number', 1]},
    circle: {
        color: ['circle-color', 'color', '#000'], opacity: ['circle-opacity', 'number', 1], radius: ['circle-radius', 'number', 5],
        strokeColor: ['circle-stroke-color', 'color', '#000'], strokeWidth: ['circle-stroke-width', 'number', 0],
    },
    symbol: {
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
    filter?: any; paint?: Record<string, any>; layout?: Record<string, any>;
}

export interface CompiledLayer {
    id: string; type: string; source?: string; sourceLayer?: string; minzoom: number; maxzoom: number;
    visible: boolean; filter: Fn | null; p: Record<string, Prop>;
}

export function compileLayer(l: LayerJSON): CompiledLayer | null {
    const spec = SPEC[l.type];
    if (!spec) return null;
    const p: Record<string, Prop> = {};
    for (const k in spec) {
        const [name, kind, def] = spec[k];
        p[k] = compileProp(l.paint?.[name] ?? l.layout?.[name], kind, def);
    }
    return {
        id: l.id, type: l.type === 'fill-extrusion' ? 'fill' : l.type, source: l.source, sourceLayer: l['source-layer'],
        minzoom: l.minzoom ?? 0, maxzoom: l.maxzoom ?? 24,
        // Pattern fills need sprite images, which are not supported yet; hiding them beats drawing solid black.
        visible: l.layout?.visibility !== 'none' && !l.paint?.['fill-pattern'] && !l.paint?.['line-pattern'], filter: compileFilter(l.filter), p,
    };
}

export interface SourceInfo { tiles: string[]; minzoom: number; maxzoom: number; attribution?: string }

/** A style with everything network-dependent already resolved, so it can be posted to a worker as plain JSON. */
export interface ResolvedStyle { layers: LayerJSON[]; sources: Record<string, SourceInfo>; unsupported: string[] }

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
        if (raw.type !== 'vector') continue;
        let src = raw;
        if (!src.tiles && src.url) {
            const url = base ? new URL(src.url, base).href : src.url;
            const res = await fetchFn(url);
            if (!res.ok) throw new Error(`Failed to load source ${url}: ${res.status}`);
            src = {...await res.json(), ...Object.fromEntries(Object.entries(raw).filter(([k]) => k !== 'url'))};
            src.tiles = src.tiles.map((t: string) => decodeURI(new URL(t, url).href));
        } else if (base) {
            src = {...src, tiles: src.tiles.map((t: string) => decodeURI(new URL(t, base).href))};
        }
        sources[name] = {tiles: src.tiles, minzoom: src.minzoom ?? 0, maxzoom: src.maxzoom ?? 14, attribution: src.attribution};
    }
    const unsupported = new Set<string>();
    const layers = (style.layers as LayerJSON[]).filter(l => {
        const ok = !!SPEC[l.type] && (l.type === 'background' || !!sources[l.source!]);
        if (!ok) unsupported.add(l.type);
        return ok;
    });
    return {layers, sources, unsupported: [...unsupported]};
}

export function tileURL(src: SourceInfo, z: number, x: number, y: number) {
    return src.tiles[(x + y) % src.tiles.length].replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}
