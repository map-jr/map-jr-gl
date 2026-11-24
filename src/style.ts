export * from './resolve.ts';
import type {LayerJSON} from './resolve.ts';
import {colorRamp, compileFilter, compileProp, parseColor, warnOnce, type Fn, type Prop, type PropKind} from './expr.ts';

/** Sources whose tiles are built into geometry by the tile workers (as opposed to images the engine draws directly). */
export const isGeometrySource = (s: {type: string}) => s.type === 'vector' || s.type === 'geojson' || s.type === 'contour';

/** Supported properties per layer type: [style-spec name, kind, default]. Anything else in a style is ignored. */
/** The values of `text-anchor` and `icon-anchor`. */
const ANCHORS = ['center', 'left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
export const SPEC: Record<string, Record<string, [string, PropKind, any, string[]?]>> = {
    custom: {},
    background: {
        color: ['background-color', 'color', '#000'],
        opacity: ['background-opacity', 'number', 1],
        pattern: ['background-pattern', 'string', null], // null when unset: an empty name draws nothing, as in MapLibre GL JS
    },
    fill: {
        color: ['fill-color', 'color', '#000'],
        opacity: ['fill-opacity', 'number', 1],
        outline: ['fill-outline-color', 'color', 'rgba(0,0,0,0)'],
        antialias: ['fill-antialias', 'raw', true],
        pattern: ['fill-pattern', 'string', ''],
        translate: ['fill-translate', 'string', [0, 0]],
        translateAnchor: ['fill-translate-anchor', 'string', 'map'],
        sortKey: ['fill-sort-key', 'number', 0],
        layerOpacity: ['fill-layer-opacity', 'number', 1],
        layerBlend: ['fill-layer-blend', 'string', 'normal'],
    },
    line: {
        color: ['line-color', 'color', '#000'],
        opacity: ['line-opacity', 'number', 1],
        width: ['line-width', 'number', 1],
        gap: ['line-gap-width', 'number', 0],
        pattern: ['line-pattern', 'string', ''],
        dash: ['line-dasharray', 'discrete', null],
        cap: ['line-cap', 'string', 'butt'],
        join: ['line-join', 'string', 'miter'],
        miterLimit: ['line-miter-limit', 'number', 2],
        roundLimit: ['line-round-limit', 'number', 1.05],
        offset: ['line-offset', 'number', 0],
        blur: ['line-blur', 'number', 0],
        translate: ['line-translate', 'string', [0, 0]],
        translateAnchor: ['line-translate-anchor', 'string', 'map'],
        sortKey: ['line-sort-key', 'number', 0],
        layerOpacity: ['line-layer-opacity', 'number', 1],
        layerBlend: ['line-layer-blend', 'string', 'normal'],
    },
    'fill-extrusion': {
        color: ['fill-extrusion-color', 'color', '#000'],
        opacity: ['fill-extrusion-opacity', 'number', 1],
        height: ['fill-extrusion-height', 'number', 0],
        base: ['fill-extrusion-base', 'number', 0],
        gradient: ['fill-extrusion-vertical-gradient', 'raw', true],
        pattern: ['fill-extrusion-pattern', 'string', ''],
        translate: ['fill-extrusion-translate', 'string', [0, 0]],
        translateAnchor: ['fill-extrusion-translate-anchor', 'string', 'map'],
    },
    circle: {
        color: ['circle-color', 'color', '#000'],
        opacity: ['circle-opacity', 'number', 1],
        radius: ['circle-radius', 'number', 5],
        strokeColor: ['circle-stroke-color', 'color', '#000'],
        strokeWidth: ['circle-stroke-width', 'number', 0],
        strokeOpacity: ['circle-stroke-opacity', 'number', 1],
        blur: ['circle-blur', 'number', 0],
        translate: ['circle-translate', 'string', [0, 0]],
        translateAnchor: ['circle-translate-anchor', 'string', 'map'],
        sortKey: ['circle-sort-key', 'number', 0],
        pitchAlign: ['circle-pitch-alignment', 'string', 'viewport'],
        pitchScale: ['circle-pitch-scale', 'string', 'map'],
    },
    heatmap: {
        // (`color` and `opacity` are also read by the code shared with other layer types; a heatmap's color is its ramp.)
        color: ['heatmap-no-such-property', 'raw', null],
        opacity: ['heatmap-opacity', 'number', 1],
        weight: ['heatmap-weight', 'number', 1],
        intensity: ['heatmap-intensity', 'number', 1],
        radius: ['heatmap-radius', 'number', 30],
    },
    raster: {
        opacity: ['raster-opacity', 'number', 1],
        saturation: ['raster-saturation', 'number', 0],
        contrast: ['raster-contrast', 'number', 0],
        brightnessMin: ['raster-brightness-min', 'number', 0],
        brightnessMax: ['raster-brightness-max', 'number', 1],
        hueRotate: ['raster-hue-rotate', 'number', 0],
        // (`resampling` is the newer name; MapLibre GL JS reads it before `raster-resampling`.)
        resampling: ['resampling', 'string', null],
        rasterResampling: ['raster-resampling', 'string', 'linear'],
        layerBlend: ['raster-layer-blend', 'string', 'normal'],
    },
    hillshade: {
        shadow: ['hillshade-shadow-color', 'colorArray', '#000'],
        highlight: ['hillshade-highlight-color', 'colorArray', '#fff'],
        accent: ['hillshade-accent-color', 'color', '#000'],
        exaggeration: ['hillshade-exaggeration', 'number', 0.5],
        direction: ['hillshade-illumination-direction', 'numberArray', 335],
        anchor: ['hillshade-illumination-anchor', 'string', 'viewport'],
        method: ['hillshade-method', 'string', 'standard'],
        altitude: ['hillshade-illumination-altitude', 'numberArray', 45],
        resampling: ['resampling', 'string', 'linear'],
    },
    'color-relief': {
        opacity: ['color-relief-opacity', 'number', 1],
        resampling: ['resampling', 'string', 'linear'],
    },
    symbol: {
        icon: ['icon-image', 'string', ''],
        iconSize: ['icon-size', 'number', 1],
        iconOffset: ['icon-offset', 'string', [0, 0]],
        iconRotate: ['icon-rotate', 'number', 0],
        rotate: ['text-rotate', 'number', 0],
        lineHeight: ['text-line-height', 'number', 1.2],
        translate: ['text-translate', 'string', [0, 0]],
        iconTranslate: ['icon-translate', 'string', [0, 0]],
        translateAnchor: ['text-translate-anchor', 'raw', 'map'],
        iconTranslateAnchor: ['icon-translate-anchor', 'raw', 'map'],
        iconIgnore: ['icon-ignore-placement', 'raw', false],
        iconPadding: ['icon-padding', 'padding', 2],
        sortKey: ['symbol-sort-key', 'number', 0],
        zOrder: ['symbol-z-order', 'string', 'auto'],
        overlapMode: ['text-overlap', 'string', ''],
        iconOverlapMode: ['icon-overlap', 'string', ''],
        iconOpacity: ['icon-opacity', 'number', 1],
        iconAnchor: ['icon-anchor', 'string', 'center', ANCHORS],
        iconColor: ['icon-color', 'color', '#000'],
        iconHalo: ['icon-halo-color', 'color', 'rgba(0,0,0,0)'],
        iconHaloWidth: ['icon-halo-width', 'number', 0],
        iconHaloBlur: ['icon-halo-blur', 'number', 0],
        iconFit: ['icon-text-fit', 'string', 'none'],
        iconFitPad: ['icon-text-fit-padding', 'raw', [0, 0, 0, 0]],
        iconOverlap: ['icon-allow-overlap', 'raw', false],
        iconOptional: ['icon-optional', 'raw', false],
        textOptional: ['text-optional', 'raw', false],
        iconAlign: ['icon-rotation-alignment', 'string', 'auto'],
        iconPitch: ['icon-pitch-alignment', 'string', 'auto'],
        textAlign: ['text-rotation-alignment', 'string', 'auto'],
        textPitch: ['text-pitch-alignment', 'string', 'auto'],
        symbolSpacing: ['symbol-spacing', 'number', 250],
        varAnchor: ['text-variable-anchor', 'raw', null],
        varOffset: ['text-variable-anchor-offset', 'raw', null],
        maxAngle: ['text-max-angle', 'number', 45],
        keepUpright: ['text-keep-upright', 'raw', true],
        iconKeepUpright: ['icon-keep-upright', 'raw', false],
        radial: ['text-radial-offset', 'number', 0],
        ignore: ['text-ignore-placement', 'raw', false],
        color: ['text-color', 'color', '#000'],
        opacity: ['text-opacity', 'number', 1],
        haloColor: ['text-halo-color', 'color', 'rgba(0,0,0,0)'],
        haloWidth: ['text-halo-width', 'number', 0],
        haloBlur: ['text-halo-blur', 'number', 0],
        justify: ['text-justify', 'string', 'center', ['auto', 'left', 'center', 'right']],
        field: ['text-field', 'string', ''],
        size: ['text-size', 'number', 16],
        font: ['text-font', 'raw', ['Open Sans Regular', 'Arial Unicode MS Regular']],
        maxWidth: ['text-max-width', 'number', 10],
        spacing: ['text-letter-spacing', 'number', 0],
        offset: ['text-offset', 'string', [0, 0]],
        anchor: ['text-anchor', 'string', 'center', ANCHORS],
        transform: ['text-transform', 'string', 'none', ['none', 'uppercase', 'lowercase']],
        padding: ['text-padding', 'number', 2],
        overlap: ['text-allow-overlap', 'raw', false],
        placement: ['symbol-placement', 'string', 'point'],
        avoidEdges: ['symbol-avoid-edges', 'raw', false],
    },
};


/**
 * Per-layer adjustments for server-rendered output, read from `metadata["map-jr:ssr"]` in the style. `metadata` is the
 * style specification's extension point, so a style carrying these stays valid for MapLibre, which ignores them.
 */
export interface SSROverrides {
    /** Leave the layer out of server output. */
    hidden?: boolean;
    /**
     * An extra filter that features must also pass, e.g. to keep only major roads. It can read `["zoom"]`, which is the
     * whole zoom of the render (of an over-zoomed tile too), as in a layer filter of MapLibre: a render at zoom 13.5 uses tiles of zoom 13,
     * so `["step", ["zoom"], false, 13, true]` keeps the features there and `[">=", ["zoom"], 13.5]` keeps none.
     */
    filter?: unknown;
    /** Replaces the `minzoom` of the layer in server output. */
    minzoom?: number;
    /** Replaces the `maxzoom` of the layer in server output. */
    maxzoom?: number;
    /** Paint properties for server output; each replaces the property of the same name of the layer, and the others stay. */
    paint?: Record<string, unknown>;
    /** Layout properties for server output; each replaces the property of the same name of the layer, and the others stay. */
    layout?: Record<string, unknown>;
    /** Drop vertices closer together than this many pixels (default 0.6). */
    simplify?: number;
    /**
     * Drop features smaller than this many pixels (default 0.8). The tiles cut a road into many short pieces, and each
     * piece is tested on its own, so a large value on a line layer leaves gaps in the roads; keep it to a few pixels there.
     */
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

/** The style specification's default heatmap colors. */
const HEATMAP_COLORS = ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0, 0, 255, 0)', 0.1, 'royalblue', 0.3, 'cyan', 0.5, 'lime', 0.7, 'yellow', 1, 'red'];

export interface CompiledLayer {
    id: string; type: string; source?: string; sourceLayer?: string; minzoom: number; maxzoom: number;
    visible: boolean; /** Built also while it is not visible. */ keep?: boolean; filter: Fn | null; p: Record<string, Prop>;
    /** The paint values as JSON, as they were when the layer was compiled (the page can change the style object in place). */
    paint: Record<string, string>;
    ssr?: SSROverrides;
    /** Heatmap layers: the color for each density (see colorRamp). Line layers: the colors of `line-gradient` along the line. */
    ramp?: Uint8Array;
    /**
     * `color-relief` layers: the elevations in meters of the stops of `color-relief-color`, in rising order. `ramp` has
     * the color at each. As in MapLibre GL JS, only an `interpolate` expression gives stops, and the color between two
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
    // (A value that is no array moves nothing.)
    const [x = 0, y = 0] = (Array.isArray(t) ? t : []) as number[];
    if (anchor === 'viewport' || !bearing || !(x || y)) return [x, y];
    const a = -bearing * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return [x * c - y * s, x * s + y * c];
}

/**
 * The lights of a `hillshade` layer at a zoom, as the `hillshade` program takes them. `method` is 0 for `standard`,
 * 1 for `combined`, 2 for `igor` and 3 for `basic` and `multidirectional`. `sun` has the direction (with `bearing`
 * added) and the altitude of each light in radians, and `shadow` and `highlight` have a premultiplied color for each.
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

/**
 * Draws with the filter `filter` on the bound texture, and gives the texture back its usual filter (linear) after: the
 * textures of tiles are shared with other layers and with 3D terrain, which must not see `nearest` (#1013).
 */
export function withFilter(gl: Pick<WebGL2RenderingContext, 'texParameteri' | 'TEXTURE_2D' | 'TEXTURE_MIN_FILTER' | 'TEXTURE_MAG_FILTER' | 'LINEAR'>, filter: number, draw: () => void) {
    const set = (f: number) => { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f); };
    if (filter !== gl.LINEAR) set(filter);
    draw();
    if (filter !== gl.LINEAR) set(gl.LINEAR);
}

export function compileLayer(l: LayerJSON): CompiledLayer | null {
    const spec = SPEC[l.type];
    if (!spec) return null;
    const p: Record<string, Prop> = {};
    for (const k in spec) {
        const [name, kind, def, values] = spec[k];
        const v = l.paint?.[name] ?? l.layout?.[name];
        // These properties of a hillshade layer take one value or a list of values, one for each light. A list is kept as it is.
        p[k] = l.type === 'hillshade' && LIGHT_PROPS.includes(k) && Array.isArray(v) ? compileProp(typeof v[0] !== 'string' || parseColor(v[0]) ? ['literal', v] : v, 'string', def) : compileProp(v, kind, def, values);
    }
    const fade = l.paint?.['raster-fade-duration'];
    if (l.type === 'raster' && fade != null && fade !== 0) warnOnce(`raster-fade-duration: the property has no effect, and a raster tile shows at once when it has loaded. Remove it, or write 0.`);
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
        // `visibility` can be an expression of the global state (as in MapLibre GL JS); a change of that state compiles the layers again.
        visible: (Array.isArray(l.layout?.visibility) ? compileProp(l.layout.visibility, 'string', 'visible').eval(0) : l.layout?.visibility) !== 'none', keep: l.keep, filter: own && extra ? c => own(c) && extra(c) : own ?? extra, p,
        paint: Object.fromEntries(Object.entries(l.paint ?? {}).map(([k, v]) => [k, JSON.stringify(v)])),
    };
}

const ease = (t: number) => 4 * (t < 0.5 ? t * t * t : 3 * (t - t * t) + t * t * t - 0.75);
const numbers = (a: any) => Array.isArray(a) && a.every(x => typeof x == 'number');
/** The value at `t` between `a` and `b`: numbers, and lists of numbers of one length (a color premultiplied), else `b`. */
function blend(a: any, b: any, t: number, color: boolean): any {
    if (typeof a == 'number' && typeof b == 'number') return a + (b - a) * t;
    // (A colorArray: each color of two lists of the same length.)
    if (Array.isArray(a?.[0]) && Array.isArray(b?.[0]) && a.length === b.length) return a.map((x: any, i: number) => blend(x, b[i], t, true));
    if (!numbers(a) || !numbers(b) || a.length !== b.length) return b;
    if (!color) return a.map((x: number, i: number) => x + (b[i] - x) * t);
    const alpha = a[3] + (b[3] - a[3]) * t;
    return [0, 1, 2].map(i => alpha && (a[i] * a[3] + (b[i] * b[3] - a[i] * a[3]) * t) / alpha).concat(alpha);
}

/**
 * Paint transitions (#960), as in MapLibre GL JS: a paint value of `l` (compiled from `json`) that differs from the one
 * of the same layer before (`was`, compiled from `old`) goes from the old value to the new one, eased, over the
 * `duration` after the `delay` (ms) of its `*-transition`, or else of the style's `transition`, or else 300 and 0.
 * Values that a feature decides, texts, and lists of another length change at once. Gives the end of the last one (0 for none).
 */
export function transition(l: CompiledLayer, json: LayerJSON, was: CompiledLayer, root: {duration?: number; delay?: number} | undefined, now: number): number {
    let last = 0;
    if (was.type !== l.type) return last;
    for (const k in l.p) {
        const [name, kind] = SPEC[l.type][k], from = was.p[k], to = l.p[k];
        if (kind === 'raw' || kind === 'discrete' || from.dd || to.dd) continue;
        // (A value that did not change keeps the transition that it is in.)
        if (l.paint[name] === was.paint[name]) { if ((from as any).end > now) { l.p[k] = from; last = Math.max(last, (from as any).end); } continue; }
        const o = {duration: 300, delay: 0, ...root, ...json.paint?.[name + '-transition']}, begin = now + (+o.delay || 0), span = +o.duration || 0, end = begin + span;
        if (end <= now) continue;
        last = Math.max(last, end);
        l.p[k] = {dd: false, zoom: true, tokens: to.tokens, end, to, eval(zoom, f) {
            const t = performance.now();
            if (t >= end) return to.eval(zoom, f);
            const a = from.eval(zoom, f);
            return t < begin ? a : blend(a, to.eval(zoom, f), ease((t - begin) / span), kind === 'color' || kind === 'colorArray');
        }} as Prop;
    }
    return last;
}

