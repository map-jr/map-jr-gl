export * from './resolve.ts';
import type {LayerJSON} from './resolve.ts';
import {colorRamp, compileFilter, compileProp, parseColor, warnOnce, type Fn, type Prop, type PropKind} from './expr.ts';

/** Sources whose tiles are built into geometry by the tile workers (as opposed to images the engine draws directly). */
export const isGeometrySource = (s: {type: string}) => s.type === 'vector' || s.type === 'geojson' || s.type === 'contour';

/** Supported properties per layer type: [style-spec name, kind, default]. Anything else in a style is ignored. */
const SPEC: Record<string, Record<string, [string, PropKind, any]>> = {
    custom: {},
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
        strokeOpacity: ['circle-stroke-opacity', 'number', 1], blur: ['circle-blur', 'number', 0], translate: ['circle-translate', 'string', [0, 0]], translateAnchor: ['circle-translate-anchor', 'string', 'map'], sortKey: ['circle-sort-key', 'number', 0],
        pitchAlign: ['circle-pitch-alignment', 'string', 'viewport'], pitchScale: ['circle-pitch-scale', 'string', 'map'],
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
        anchor: ['hillshade-illumination-anchor', 'string', 'viewport'], method: ['hillshade-method', 'string', 'standard'], altitude: ['hillshade-illumination-altitude', 'number', 45],
    },
    'color-relief': {opacity: ['color-relief-opacity', 'number', 1]},
    symbol: {
        icon: ['icon-image', 'string', ''], iconSize: ['icon-size', 'number', 1], iconOffset: ['icon-offset', 'string', [0, 0]], iconRotate: ['icon-rotate', 'number', 0],
        rotate: ['text-rotate', 'number', 0],
        lineHeight: ['text-line-height', 'number', 1.2], translate: ['text-translate', 'raw', [0, 0]], iconTranslate: ['icon-translate', 'raw', [0, 0]],
        translateAnchor: ['text-translate-anchor', 'raw', 'map'], iconTranslateAnchor: ['icon-translate-anchor', 'raw', 'map'],
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
    /**
     * `color-relief` layers: the elevations in metres of the stops of `color-relief-color`, in rising order. `ramp` has
     * the colour at each. As in MapLibre GL JS, only an `interpolate` expression gives stops, and the colour between two
     * stops is a linear mix. Any other value gives one transparent stop, so that the layer draws nothing.
     */
    relief?: Float32Array;
    /** Symbol layers: the same for layers that have the same data and layout. As in MapLibre, such layers share their labels. */
    group?: string;
}

/** The most lights that a `hillshade` layer with the method `multidirectional` draws. */
export const LIGHTS = 8;
const LIGHT_PROPS = ['direction', 'altitude', 'shadow', 'highlight'], HILLSHADE_METHODS = ['standard', 'combined', 'igor', 'multidirectional', 'basic'];

/**
 * A `*-translate` in pixels of the screen. With the anchor `map` (the default) the direction turns with the bearing of
 * the map, and with `viewport` it stays fixed on the screen. A pitch does not change the result.
 */
export function screenTranslate(t: unknown, anchor: unknown, bearing: number): [number, number] {
    // (A value that is no array, which a legacy function of the zoom gives here at present, moves nothing.)
    const [x = 0, y = 0] = (Array.isArray(t) ? t : []) as number[];
    if (anchor === 'viewport' || !bearing || !(x || y)) return [x, y];
    const a = -bearing * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return [x * c - y * s, x * s + y * c];
}

/**
 * The lights of a `hillshade` layer at a zoom, as the `hillshade` program takes them. `method` is 0 for `standard`,
 * 1 for `combined`, 2 for `igor` and 3 for `basic` and `multidirectional`. `sun` has the direction (with `bearing`
 * added) and the altitude of each light in radians, and `shadow` and `highlight` have a premultiplied colour for each.
 * As in MapLibre GL JS, only `multidirectional` has more than one light, and a list that is shorter than the longest
 * list repeats its last value.
 */
export function hillshadeLights(p: Record<string, Prop>, zoom: number, bearing: number): {method: number; n: number; sun: number[]; shadow: number[]; highlight: number[]} {
    const name = p.method.eval(zoom), spec = SPEC.hillshade;
    let method = HILLSHADE_METHODS.indexOf(name);
    if (method < 0) { warnOnce(`hillshade-method: ${JSON.stringify(name)} is not a method, and the layer uses "standard". Write "standard", "basic", "combined", "igor" or "multidirectional".`); method = 0; }
    const [direction, altitude, shadow, highlight]: any[][] = LIGHT_PROPS.map((k, i) => {
        const v = p[k].eval(zoom), def = spec[k][2], list: any[] = Array.isArray(v) && (i < 2 || typeof v[0] !== 'number') ? v : [v];
        return (list.length ? list : [def]).map(x => i < 2 ? (typeof x === 'number' && !isNaN(x) ? x : def) * Math.PI / 180
            : Array.isArray(x) && x.length === 4 && typeof x[0] === 'number' ? x : (typeof x === 'string' && parseColor(x)) || parseColor(def));
    });
    let n = method === 3 ? Math.max(direction.length, altitude.length, shadow.length, highlight.length) : 1;
    if (n > LIGHTS) { warnOnce(`hillshade: a layer has ${n} lights, and the layer draws the first ${LIGHTS}. Give lists of at most ${LIGHTS} values.`); n = LIGHTS; }
    const out = {method: Math.min(method, 3), n, sun: [] as number[], shadow: [] as number[], highlight: [] as number[]};
    for (let i = 0; i < n; i++) {
        const at = (a: any[]) => a[Math.min(i, a.length - 1)];
        out.sun.push(at(direction) + bearing, at(altitude));
        for (const [to, c] of [[out.shadow, at(shadow)], [out.highlight, at(highlight)]] as [number[], number[]][]) to.push(c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]);
    }
    return out;
}

export function compileLayer(l: LayerJSON): CompiledLayer | null {
    const spec = SPEC[l.type];
    if (!spec) return null;
    const p: Record<string, Prop> = {};
    for (const k in spec) {
        const [name, kind, def] = spec[k];
        const v = l.paint?.[name] ?? l.layout?.[name];
        // These properties of a hillshade layer take one value or a list of values, one for each light. A list is kept as it is.
        p[k] = l.type === 'hillshade' && LIGHT_PROPS.includes(k) && Array.isArray(v) ? compileProp(typeof v[0] !== 'string' || parseColor(v[0]) ? ['literal', v] : v, 'string', def) : compileProp(v, kind, def);
    }
    // A server-only extra filter is compiled separately, so it can be an expression even when the layer's own filter is legacy syntax.
    let relief: Float32Array | undefined, ramp: Uint8Array | undefined;
    if (l.type === 'color-relief') {
        const e = l.paint?.['color-relief-color'], stops = Array.isArray(e) && /^interpolate/.test(e[0]) ? e.slice(3).filter((v, i) => i % 2 < 1 && typeof v === 'number').slice(0, 2048) : []; // (a texture of 2048 pixels is the most that every browser has)
        relief = Float32Array.from(stops.length > 1 ? stops : [stops[0] ?? 0, (stops[0] ?? 0) + 1]);
        ramp = colorRamp(stops.length ? e : 'transparent', relief);
    }
    const own = compileFilter(l.filter), extra = compileFilter(l.metadata?.['map-jr:and-filter']);
    return {
        ssr: l.metadata?.[SSR_KEY],
        group: l.type === 'symbol' ? JSON.stringify([l.source, l['source-layer'], l.minzoom, l.maxzoom, l.filter, l.layout]) : undefined,
        relief, ramp: ramp ?? (l.type === 'heatmap' ? colorRamp(l.paint?.['heatmap-color'] ?? HEATMAP_COLORS) : l.type === 'line' && l.paint?.['line-gradient'] ? colorRamp(l.paint['line-gradient']) : undefined),
        id: l.id, type: l.type, source: l.source, sourceLayer: l['source-layer'],
        minzoom: l.minzoom ?? -2, maxzoom: l.maxzoom ?? 24,
        // Pattern fills need sprite images, which are not supported yet; hiding them beats drawing solid black.
        visible: l.layout?.visibility !== 'none', keep: l.keep, filter: own && extra ? c => own(c) && extra(c) : own ?? extra, p,
    };
}

