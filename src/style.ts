export * from './resolve.ts';
import type {LayerJSON} from './resolve.ts';
import {colorRamp, compileFilter, compileProp, type Fn, type Prop, type PropKind} from './expr.ts';

/** Sources whose tiles are built into geometry by the tile workers (as opposed to images the engine draws directly). */
export const isGeometrySource = (s: {type: string}) => s.type === 'vector' || s.type === 'geojson' || s.type === 'contour';

/** Supported properties per layer type: [style-spec name, kind, default]. Anything else in a style is ignored. */
const SPEC: Record<string, Record<string, [string, PropKind, any]>> = {
    background: {color: ['background-color', 'color', '#000'], opacity: ['background-opacity', 'number', 1], pattern: ['background-pattern', 'string', '']},
    fill: {color: ['fill-color', 'color', '#000'], opacity: ['fill-opacity', 'number', 1], outline: ['fill-outline-color', 'color', 'rgba(0,0,0,0)'], antialias: ['fill-antialias', 'raw', true], pattern: ['fill-pattern', 'string', ''],
        translate: ['fill-translate', 'string', [0, 0]], translateAnchor: ['fill-translate-anchor', 'string', 'map'], sortKey: ['fill-sort-key', 'number', 0],
        layerOpacity: ['fill-layer-opacity', 'number', 1], layerBlend: ['fill-layer-blend', 'string', 'normal']},
    line: {
        color: ['line-color', 'color', '#000'], opacity: ['line-opacity', 'number', 1], width: ['line-width', 'number', 1],
        gap: ['line-gap-width', 'number', 0], pattern: ['line-pattern', 'string', ''], dash: ['line-dasharray', 'discrete', null], cap: ['line-cap', 'string', 'butt'], join: ['line-join', 'string', 'miter'],
        offset: ['line-offset', 'number', 0], blur: ['line-blur', 'number', 0],
        translate: ['line-translate', 'string', [0, 0]], translateAnchor: ['line-translate-anchor', 'string', 'map'], sortKey: ['line-sort-key', 'number', 0],
        layerOpacity: ['line-layer-opacity', 'number', 1], layerBlend: ['line-layer-blend', 'string', 'normal'],
    },
    'fill-extrusion': {
        color: ['fill-extrusion-color', 'color', '#000'], opacity: ['fill-extrusion-opacity', 'number', 1],
        height: ['fill-extrusion-height', 'number', 0], base: ['fill-extrusion-base', 'number', 0],
        gradient: ['fill-extrusion-vertical-gradient', 'raw', true],
        translate: ['fill-extrusion-translate', 'string', [0, 0]], translateAnchor: ['fill-extrusion-translate-anchor', 'string', 'map'],
    },
    circle: {
        color: ['circle-color', 'color', '#000'], opacity: ['circle-opacity', 'number', 1], radius: ['circle-radius', 'number', 5],
        strokeColor: ['circle-stroke-color', 'color', '#000'], strokeWidth: ['circle-stroke-width', 'number', 0],
        strokeOpacity: ['circle-stroke-opacity', 'number', 1], blur: ['circle-blur', 'number', 0], translate: ['circle-translate', 'string', [0, 0]], sortKey: ['circle-sort-key', 'number', 0],
    },
    heatmap: {
        // (`color` and `opacity` are also read by the code shared with other layer types; a heatmap's colour is its ramp.)
        color: ['heatmap-no-such-property', 'raw', null], opacity: ['heatmap-opacity', 'number', 1],
        weight: ['heatmap-weight', 'number', 1], intensity: ['heatmap-intensity', 'number', 1], radius: ['heatmap-radius', 'number', 30],
    },
    raster: {opacity: ['raster-opacity', 'number', 1], saturation: ['raster-saturation', 'number', 0], contrast: ['raster-contrast', 'number', 0],
        brightnessMin: ['raster-brightness-min', 'number', 0], brightnessMax: ['raster-brightness-max', 'number', 1], hueRotate: ['raster-hue-rotate', 'number', 0]},
    hillshade: {
        shadow: ['hillshade-shadow-color', 'color', '#000'], highlight: ['hillshade-highlight-color', 'color', '#fff'], accent: ['hillshade-accent-color', 'color', '#000'],
        exaggeration: ['hillshade-exaggeration', 'number', 0.5], direction: ['hillshade-illumination-direction', 'number', 335],
        anchor: ['hillshade-illumination-anchor', 'string', 'viewport'],
    },
    symbol: {
        icon: ['icon-image', 'string', ''], iconSize: ['icon-size', 'number', 1], iconOffset: ['icon-offset', 'string', [0, 0]], iconRotate: ['icon-rotate', 'number', 0],
        rotate: ['text-rotate', 'number', 0],
        lineHeight: ['text-line-height', 'number', 1.2], translate: ['text-translate', 'raw', [0, 0]], iconTranslate: ['icon-translate', 'raw', [0, 0]],
        iconIgnore: ['icon-ignore-placement', 'raw', false], iconPadding: ['icon-padding', 'number', 2], sortKey: ['symbol-sort-key', 'number', 0],
        overlapMode: ['text-overlap', 'string', ''], iconOverlapMode: ['icon-overlap', 'string', ''],
        iconOpacity: ['icon-opacity', 'number', 1], iconAnchor: ['icon-anchor', 'string', 'center'], iconColor: ['icon-color', 'color', '#000'], iconHalo: ['icon-halo-color', 'color', 'rgba(0,0,0,0)'], iconHaloWidth: ['icon-halo-width', 'number', 0],
        iconFit: ['icon-text-fit', 'string', 'none'], iconFitPad: ['icon-text-fit-padding', 'raw', [0, 0, 0, 0]], iconOverlap: ['icon-allow-overlap', 'raw', false],
        iconOptional: ['icon-optional', 'raw', false], textOptional: ['text-optional', 'raw', false], iconAlign: ['icon-rotation-alignment', 'string', 'auto'],
        textAlign: ['text-rotation-alignment', 'string', 'auto'], symbolSpacing: ['symbol-spacing', 'number', 250], varAnchor: ['text-variable-anchor', 'raw', null], varOffset: ['text-variable-anchor-offset', 'raw', null], maxAngle: ['text-max-angle', 'number', 45],
        radial: ['text-radial-offset', 'number', 0], ignore: ['text-ignore-placement', 'raw', false],
        color: ['text-color', 'color', '#000'], opacity: ['text-opacity', 'number', 1],
        haloColor: ['text-halo-color', 'color', 'rgba(0,0,0,0)'], haloWidth: ['text-halo-width', 'number', 0], haloBlur: ['text-halo-blur', 'number', 0], justify: ['text-justify', 'string', 'center'],
        field: ['text-field', 'string', ''], size: ['text-size', 'number', 16], font: ['text-font', 'raw', ['Open Sans Regular', 'Arial Unicode MS Regular']],
        maxWidth: ['text-max-width', 'number', 10], spacing: ['text-letter-spacing', 'number', 0],
        offset: ['text-offset', 'string', [0, 0]], anchor: ['text-anchor', 'string', 'center'],
        transform: ['text-transform', 'string', 'none'], padding: ['text-padding', 'number', 2],
        overlap: ['text-allow-overlap', 'raw', false], placement: ['symbol-placement', 'string', 'point'],
    },
};


/**
 * Per-layer adjustments for server-rendered output, read from `metadata["map-jr:ssr"]` in the style. `metadata` is the
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
export const SSR_KEY = 'map-jr:ssr';

/** Applies each layer's server overrides, returning the style layers to render on the server. */
export function applySSROverrides(layers: LayerJSON[]): LayerJSON[] {
    const out: LayerJSON[] = [];
    for (const l of layers) {
        const o = l.metadata?.[SSR_KEY] as SSROverrides | undefined;
        if (!o) { out.push(l); continue; }
        if (o.hidden) continue;
        out.push({...l, minzoom: o.minzoom ?? l.minzoom, maxzoom: o.maxzoom ?? l.maxzoom, paint: {...l.paint, ...o.paint}, layout: {...l.layout, ...o.layout},
            metadata: {...l.metadata, 'map-jr:and-filter': o.filter}});
    }
    return out;
}

/** The style specification's default heatmap colours. */
const HEATMAP_COLORS = ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0, 0, 255, 0)', 0.1, 'royalblue', 0.3, 'cyan', 0.5, 'lime', 0.7, 'yellow', 1, 'red'];

export interface CompiledLayer {
    id: string; type: string; source?: string; sourceLayer?: string; minzoom: number; maxzoom: number;
    visible: boolean; /** Built also while it is not visible. */ keep?: boolean; filter: Fn | null; p: Record<string, Prop>;
    ssr?: SSROverrides;
    /** Heatmap layers: the colour for each density (see colorRamp). Line layers: the colours of `line-gradient` along the line. */
    ramp?: Uint8Array;
    /** Symbol layers: the same for layers that have the same data and layout. As in MapLibre, such layers share their labels. */
    group?: string;
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
    const own = compileFilter(l.filter), extra = compileFilter(l.metadata?.['map-jr:and-filter']);
    return {
        ssr: l.metadata?.[SSR_KEY],
        group: l.type === 'symbol' ? JSON.stringify([l.source, l['source-layer'], l.minzoom, l.maxzoom, l.filter, l.layout]) : undefined,
        ramp: l.type === 'heatmap' ? colorRamp(l.paint?.['heatmap-color'] ?? HEATMAP_COLORS) : l.type === 'line' && l.paint?.['line-gradient'] ? colorRamp(l.paint['line-gradient']) : undefined,
        id: l.id, type: l.type, source: l.source, sourceLayer: l['source-layer'],
        minzoom: l.minzoom ?? -2, maxzoom: l.maxzoom ?? 24,
        // Pattern fills need sprite images, which are not supported yet; hiding them beats drawing solid black.
        visible: l.layout?.visibility !== 'none', keep: l.keep, filter: own && extra ? c => own(c) && extra(c) : own ?? extra, p,
    };
}

