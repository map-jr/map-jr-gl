/**
 * Style expressions compiled once into plain closures (no interpreter objects, no `new Function`, so CSP-safe).
 * Covers the commonly used subset of the MapLibre expression language plus legacy filters and legacy `stops` functions.
 */
export interface Feature { type: number; id?: number | string; properties: Record<string, any>; /** Set while a tile is built: the feature's state, for `feature-state`. */ state?: Record<string, unknown> }
export interface Ctx { zoom: number; f: Feature | null; /** The value so far, when a cluster property is combined from its points. */ accumulated?: unknown; /** Heatmap colour ramps are evaluated over this, from 0 to 1. */ density?: number }
export type Fn = (c: Ctx) => any;
export interface Flags { dd: boolean; zoom: boolean }
export type RGBA = [number, number, number, number];
import {bezier} from './geo.ts';

// Every CSS colour name, as "name:hex" pairs in one string (much smaller in the bundle than an object literal).
const NAMED: Record<string, string> = Object.fromEntries('aliceblue:f0f8ff antiquewhite:faebd7 aqua:0ff aquamarine:7fffd4 azure:f0ffff beige:f5f5dc bisque:ffe4c4 black:000 blanchedalmond:ffebcd blue:00f blueviolet:8a2be2 brown:a52a2a burlywood:deb887 cadetblue:5f9ea0 chartreuse:7fff00 chocolate:d2691e coral:ff7f50 cornflowerblue:6495ed cornsilk:fff8dc crimson:dc143c cyan:0ff darkblue:00008b darkcyan:008b8b darkgoldenrod:b8860b darkgray:a9a9a9 darkgreen:006400 darkgrey:a9a9a9 darkkhaki:bdb76b darkmagenta:8b008b darkolivegreen:556b2f darkorange:ff8c00 darkorchid:9932cc darkred:8b0000 darksalmon:e9967a darkseagreen:8fbc8f darkslateblue:483d8b darkslategray:2f4f4f darkslategrey:2f4f4f darkturquoise:00ced1 darkviolet:9400d3 deeppink:ff1493 deepskyblue:00bfff dimgray:696969 dimgrey:696969 dodgerblue:1e90ff firebrick:b22222 floralwhite:fffaf0 forestgreen:228b22 fuchsia:f0f gainsboro:dcdcdc ghostwhite:f8f8ff gold:ffd700 goldenrod:daa520 gray:808080 green:008000 greenyellow:adff2f grey:808080 honeydew:f0fff0 hotpink:ff69b4 indianred:cd5c5c indigo:4b0082 ivory:fffff0 khaki:f0e68c lavender:e6e6fa lavenderblush:fff0f5 lawngreen:7cfc00 lemonchiffon:fffacd lightblue:add8e6 lightcoral:f08080 lightcyan:e0ffff lightgoldenrodyellow:fafad2 lightgray:d3d3d3 lightgreen:90ee90 lightgrey:d3d3d3 lightpink:ffb6c1 lightsalmon:ffa07a lightseagreen:20b2aa lightskyblue:87cefa lightslategray:789 lightslategrey:789 lightsteelblue:b0c4de lightyellow:ffffe0 lime:0f0 limegreen:32cd32 linen:faf0e6 magenta:f0f maroon:800000 mediumaquamarine:66cdaa mediumblue:0000cd mediumorchid:ba55d3 mediumpurple:9370db mediumseagreen:3cb371 mediumslateblue:7b68ee mediumspringgreen:00fa9a mediumturquoise:48d1cc mediumvioletred:c71585 midnightblue:191970 mintcream:f5fffa mistyrose:ffe4e1 moccasin:ffe4b5 navajowhite:ffdead navy:000080 oldlace:fdf5e6 olive:808000 olivedrab:6b8e23 orange:ffa500 orangered:ff4500 orchid:da70d6 palegoldenrod:eee8aa palegreen:98fb98 paleturquoise:afeeee palevioletred:db7093 papayawhip:ffefd5 peachpuff:ffdab9 peru:cd853f pink:ffc0cb plum:dda0dd powderblue:b0e0e6 purple:800080 rebeccapurple:639 red:f00 rosybrown:bc8f8f royalblue:4169e1 saddlebrown:8b4513 salmon:fa8072 sandybrown:f4a460 seagreen:2e8b57 seashell:fff5ee sienna:a0522d silver:c0c0c0 skyblue:87ceeb slateblue:6a5acd slategray:708090 slategrey:708090 snow:fffafa springgreen:00ff7f steelblue:4682b4 tan:d2b48c teal:008080 thistle:d8bfd8 tomato:ff6347 turquoise:40e0d0 violet:ee82ee wheat:f5deb3 white:fff whitesmoke:f5f5f5 yellow:ff0 yellowgreen:9acd32'.split(' ').map(pair => { const [name, hex] = pair.split(':'); return [name, '#' + hex]; }));
const colorCache = new Map<string, RGBA | null>();
/** Arrays known to be colours, so interpolation can treat them differently from plain number arrays. */
const COLORS = new WeakSet<object>();
const color = (c: RGBA): RGBA => { COLORS.add(c); return c; };

export function parseColor(input: string): RGBA | null {
    let c = colorCache.get(input);
    if (c !== undefined) return c;
    c = parseColorUncached(input.trim().toLowerCase());
    if (c) COLORS.add(c);
    if (colorCache.size > 4096) colorCache.clear(); // (styles and data from other parties: the cache has a limit)
    colorCache.set(input, c);
    return c;
}

function parseColorUncached(s: string): RGBA | null {
    if (s === 'transparent') return [0, 0, 0, 0];
    if (NAMED[s]) s = NAMED[s];
    if (s[0] === '#') {
        const h = s.slice(1);
        if (!/^[0-9a-f]+$/.test(h)) return null;
        if (h.length === 3 || h.length === 4) {
            const v = [...h].map(ch => parseInt(ch + ch, 16) / 255);
            return [v[0], v[1], v[2], v[3] ?? 1];
        }
        if (h.length === 6 || h.length === 8) {
            const v = [0, 2, 4, 6].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
            return [v[0], v[1], v[2], h.length === 8 ? v[3] : 1];
        }
        return null;
    }
    const m = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(s);
    if (!m) return null;
    const parts = m[2].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const num = (p: string, pctScale: number) => p.endsWith('%') ? parseFloat(p) / 100 * pctScale : parseFloat(p);
    const a = parts[3] === undefined ? 1 : num(parts[3], 1);
    if (m[1][0] === 'r') return [num(parts[0], 255) / 255, num(parts[1], 255) / 255, num(parts[2], 255) / 255, a];
    const h = ((parseFloat(parts[0]) % 360) + 360) % 360 / 360, sat = num(parts[1], 1), l = num(parts[2], 1);
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p = 2 * l - q;
    const hue = (t: number) => {
        t = (t + 1) % 1;
        return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    };
    return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3), a];
}

const GEOM = ['Unknown', 'Point', 'LineString', 'Polygon'];
const warned = new Set<string>();
function warnOnce(msg: string) {
    if (!warned.has(msg)) { warned.add(msg); console.warn('[map-jr-gl] ' + msg); }
}

function lerp(a: any, b: any, t: number): any {
    if (typeof a === 'number') return a + (b - a) * t;
    // Colours interpolate channel by channel without premultiplying alpha, matching the current style specification.
    if (COLORS.has(a) && COLORS.has(b)) return color(a.map((v: number, i: number) => v + (b[i] - v) * t) as RGBA);
    if (Array.isArray(a)) return a.map((v, i) => v + (b[i] - v) * t);
    return t < 1 ? a : b;
}

/** Interpolation outputs written as colour strings are converted once, at compile time or first use. */
/**
 * The state of one map on this thread: an engine or a tile builder has one. Two maps on a page (or in one tile
 * worker) each have their own, so that they do not read the state of the other.
 */
export interface MapStates {
    /** The style's global state (`state` in the style, changed with `setGlobalStateProperty`), read by `global-state`. */
    g: Record<string, unknown>;
    /** Feature state by source, then by "sourceLayer|id" (`setFeatureState`). Tiles are rebuilt when it changes. */
    f: Record<string, Record<string, Record<string, unknown>>>;
}
/** The states that expressions are compiled for. An expression keeps the object, and reads it when it is evaluated. */
let compiling: MapStates = {g: {}, f: {}};
/** Sets the map that the expressions compiled from now on (in this turn of the thread) belong to. */
export function compileFor(states: MapStates) { compiling = states; }

/** An image inside label text (`format` with `image`) travels through the text as its name between these two characters. */
/** Rich text (`format` with options): the size, font and colour of the text that follows, between these two characters. */
export const STYLE_OPEN = '\uE002', STYLE_CLOSE = '\uE003';
export const IMAGE_OPEN = '\uE000', IMAGE_CLOSE = '\uE001', IMAGE_IN_TEXT = /\uE000([^\uE001]*)\uE001/g;

/**
 * A heatmap's colour for each density from 0 to 1, as 256 premultiplied RGBA pixels: the `heatmap-color` expression
 * evaluated once, so the GPU only has to look colours up.
 */
export function colorRamp(expression: unknown): Uint8Array {
    const fn = compileExpr(expression as any, {dd: false, zoom: false}), out = new Uint8Array(256 * 4), ctx: Ctx = {zoom: 0, f: null, density: 0};
    for (let i = 0; i < 256; i++) {
        ctx.density = i / 255;
        const v = fn(ctx), c = Array.isArray(v) ? v : (typeof v === 'string' && parseColor(v)) || [0, 0, 0, 0];
        out.set([c[0] * c[3] * 255, c[1] * c[3] * 255, c[2] * c[3] * 255, c[3] * 255], i * 4);
    }
    return out;
}

/** The `colorSpace` of a legacy function. */
const SPACES: Record<string, 'hcl' | 'lab' | undefined> = {hcl: 'hcl', lab: 'lab'};
const SURROGATE = /[\ud800-\udfff]/;

// Colours in the CIELAB space (and its polar form, HCL), with the constants that MapLibre uses.
const XN = 0.96422, ZN = 0.82521, T0 = 4 / 29, T1 = 6 / 29, T2 = 3 * T1 * T1, T3 = T1 * T1 * T1;
const toLinear = (v: number) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const fromLinear = (v: number) => Math.min(1, Math.max(0, v <= 0.00304 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
const labF = (t: number) => t > T3 ? Math.cbrt(t) : t / T2 + T0, labInv = (t: number) => t > T1 ? t * t * t : T2 * (t - T0);
function toLab([r, g, b, a]: RGBA): number[] {
    r = toLinear(r); g = toLinear(g); b = toLinear(b);
    const x = labF((0.4360747 * r + 0.3850649 * g + 0.1430804 * b) / XN), y = labF(0.2225045 * r + 0.7168786 * g + 0.0606169 * b), z = labF((0.0139322 * r + 0.0971045 * g + 0.7141733 * b) / ZN);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z), a];
}
function fromLab([l, a, b, alpha]: number[]): RGBA {
    let y = (l + 16) / 116, x = y + a / 500, z = y - b / 200;
    x = XN * labInv(x); y = labInv(y); z = ZN * labInv(z);
    return color([fromLinear(3.1338561 * x - 1.6168667 * y - 0.4906146 * z), fromLinear(-0.9787684 * x + 1.9161415 * y + 0.0334540 * z), fromLinear(0.0719453 * x - 0.2289914 * y + 1.4052427 * z), alpha]);
}
/** Interpolates two colours in Lab, or in HCL where the hue takes the short way round. */
function lerpInSpace(from: RGBA, to: RGBA, t: number, space: 'hcl' | 'lab'): RGBA {
    const a = toLab(from), b = toLab(to), mix = (i: number) => a[i] + (b[i] - a[i]) * t;
    if (space === 'lab') return fromLab([mix(0), mix(1), mix(2), mix(3)]);
    const c0 = Math.hypot(a[1], a[2]), c1 = Math.hypot(b[1], b[2]);
    let h0 = Math.atan2(a[2], a[1]), h1 = Math.atan2(b[2], b[1]);
    // A grey has no hue of its own: it takes the hue of the other colour.
    if (c0 < 1e-4) h0 = h1; else if (c1 < 1e-4) h1 = h0;
    let dh = h1 - h0;
    if (dh > Math.PI) dh -= 2 * Math.PI; else if (dh < -Math.PI) dh += 2 * Math.PI;
    const h = h0 + dh * t, ch = c0 + (c1 - c0) * t;
    return fromLab([mix(0), Math.cos(h) * ch, Math.sin(h) * ch, mix(3)]);
}

function colorize(v: any): any {
    return typeof v === 'string' ? (parseColor(v) ?? v) : v;
}

function interpolator(base: number, stops: number[], outs: Fn[], input: Fn, step: boolean, ease?: (t: number) => number, space?: 'hcl' | 'lab'): Fn {
    const n = stops.length;
    return c => {
        const x = input(c);
        if (typeof x !== 'number' || x <= stops[0]) return colorize(outs[0](c));
        if (x >= stops[n - 1]) return colorize(outs[n - 1](c));
        let i = 1;
        while (stops[i] <= x) i++;
        while (i > 1 && stops[i - 1] === x && stops[i - 2] === x) i--; // of stops with the same input, the first one applies
        if (step) return colorize(outs[i - 1](c));
        const x0 = stops[i - 1], x1 = stops[i];
        if (x1 === x0) return colorize(outs[i - 1](c));
        const t = ease ? ease((x - x0) / (x1 - x0)) : base === 1 ? (x - x0) / (x1 - x0) : (base ** (x - x0) - 1) / (base ** (x1 - x0) - 1);
        const from = colorize(outs[i - 1](c)), to = colorize(outs[i](c));
        return mixValues(from, to, t, space);
    };
}
/** Interpolates numbers, colours (in the colour space, if one is given) and arrays of these. */
function mixValues(from: any, to: any, t: number, space?: 'hcl' | 'lab'): any {
    if (Array.isArray(from) && Array.isArray(to) && !COLORS.has(from) && typeof from[0] !== 'number') return from.map((v, i) => mixValues(colorize(v), colorize(to[i]), t, space));
    return space && COLORS.has(from) && COLORS.has(to) ? lerpInSpace(from as RGBA, to as RGBA, t, space) : lerp(from, to, t);
}

const cmp: Record<string, (a: any, b: any) => boolean> = {
    '==': (a, b) => a === b, '!=': (a, b) => a !== b, '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b,
};
const math1: Record<string, (a: number) => number> = {
    abs: Math.abs, ceil: Math.ceil, floor: Math.floor, sqrt: Math.sqrt, ln: Math.log, log10: Math.log10, log2: Math.log2,
    sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
    round: v => v < 0 ? -Math.round(-v) : Math.round(v), // halves round away from zero
};

export function compileExpr(e: any, flags: Flags): Fn {
    if (!Array.isArray(e)) {
        return () => e;
    }
    if (typeof e[0] !== 'string') {
        // A plain array whose items may themselves be expressions, e.g. a text-offset of [0, ["get", "dy"]].
        const items = e.map(x => compileExpr(x, flags));
        return c => items.map(f => f(c));
    }
    const op = e[0];
    const arg = (i: number) => compileExpr(e[i], flags);
    const args = (from = 1) => e.slice(from).map((x: any) => compileExpr(x, flags)) as Fn[];
    switch (op) {
        case 'literal': { const v = e[1]; return () => v; }
        case 'collator': {
            const o = e[1] ?? {}, caseFn = compileExpr(o['case-sensitive'] ?? false, flags), marks = compileExpr(o['diacritic-sensitive'] ?? false, flags), locale = compileExpr(o.locale ?? null, flags);
            const made = new Map<string, Intl.Collator>();
            return c => {
                const cs = !!caseFn(c), ds = !!marks(c), lang = locale(c), key = `${cs}|${ds}|${lang}`;
                let k = made.get(key);
                if (!k) {
                    const options: Intl.CollatorOptions = {sensitivity: cs ? (ds ? 'variant' : 'case') : ds ? 'accent' : 'base', usage: 'search'};
                    try { k = new Intl.Collator(lang ?? undefined, options); } catch { k = new Intl.Collator(undefined, options); } // a language tag that the browser does not know
                    made.set(key, k);
                }
                return k;
            };
        }
        case 'resolved-locale': { const k = arg(1); return c => { const v = k(c); return v instanceof Intl.Collator ? v.resolvedOptions().locale : null; }; }
        case 'semiliteral': {
            // An array whose items can be expressions; other values are literals.
            const v = e[1];
            if (!Array.isArray(v)) return () => v;
            const items = v.map(x => Array.isArray(x) ? compileExpr(x, flags) : () => x);
            return c => items.map(f => f(c));
        }
        case 'get': {
            flags.dd = true;
            if (typeof e[1] === 'string' && e.length === 2) { const k = e[1]; return c => c.f?.properties[k] ?? null; }
            const k = arg(1);
            if (e.length === 2) return c => c.f?.properties[k(c)] ?? null;
            const o = arg(2);
            return c => o(c)?.[k(c)] ?? null;
        }
        case 'has': {
            const k = arg(1);
            if (e.length > 2) { const o = arg(2); return c => { const obj = o(c); return !!obj && k(c) in obj; }; }
            flags.dd = true;
            return c => !!c.f && k(c) in c.f.properties;
        }
        case 'accumulated': flags.dd = true; return c => c.accumulated ?? null;
        case 'id': flags.dd = true; return c => c.f?.id ?? null;
        case 'properties': flags.dd = true; return c => c.f?.properties ?? {};
        case 'geometry-type': flags.dd = true; return c => GEOM[c.f?.type ?? 0];
        case 'zoom': flags.zoom = true; return c => c.zoom;
        case 'heatmap-density': case 'line-progress': return c => c.density ?? 0;
        case 'feature-state': { const key = e[1]; flags.dd = true; return c => c.f?.state?.[key] ?? null; }
        case 'global-state': {
            // Read when evaluated, so one compiled style follows later changes. Marked like a zoom dependency so the
            // value is never folded into a constant.
            const key = e[1];
            flags.zoom = true;
            const states = compiling;
            return () => states.g[key] ?? null;
        }
        case '==': case '!=': case '<': case '<=': case '>': case '>=': {
            const a = arg(1), b = arg(2), f = cmp[op];
            if (e.length > 3) {
                // With a collator, texts are compared by the rules of a language (for example, without case).
                const collator = arg(3);
                return c => { const x = a(c), y = b(c), k = collator(c); return k instanceof Intl.Collator && typeof x === 'string' && typeof y === 'string' ? f(k.compare(x, y), 0) : f(x, y); };
            }
            return c => f(a(c), b(c));
        }
        case 'all': { const a = args(); return c => a.every(f => f(c)); }
        case 'any': { const a = args(); return c => a.some(f => f(c)); }
        case '!': { const a = arg(1); return c => !a(c); }
        case 'case': {
            const a = args();
            return c => {
                for (let i = 0; i + 1 < a.length; i += 2) if (a[i](c)) return a[i + 1](c);
                return a[a.length - 1](c);
            };
        }
        case 'match': {
            const input = arg(1), table = new Map<any, Fn>();
            for (let i = 2; i + 1 < e.length; i += 2) {
                const out = arg(i + 1);
                for (const label of Array.isArray(e[i]) ? e[i] : [e[i]]) table.set(label, out);
            }
            const fallback = arg(e.length - 1);
            return c => (table.get(input(c)) ?? fallback)(c);
        }
        case 'coalesce': {
            const a = args();
            return c => {
                for (const f of a) { const v = f(c); if (v !== null && v !== undefined) return v; }
                return null;
            };
        }
        case 'step': {
            const input = arg(1), stops = [-Infinity], outs = [arg(2)];
            for (let i = 3; i + 1 < e.length; i += 2) { stops.push(e[i]); outs.push(arg(i + 1)); }
            return interpolator(1, stops, outs, input, true);
        }
        case 'interpolate': case 'interpolate-hcl': case 'interpolate-lab': {
            const kind = e[1], input = arg(2), stops: number[] = [], outs: Fn[] = [];
            for (let i = 3; i + 1 < e.length; i += 2) { stops.push(e[i]); outs.push(arg(i + 1)); }
            return interpolator(kind[0] === 'exponential' ? kind[1] : 1, stops, outs, input, false,
                kind[0] === 'cubic-bezier' ? bezier(kind[1], kind[2], kind[3], kind[4]) : undefined, op === 'interpolate-hcl' ? 'hcl' : op === 'interpolate-lab' ? 'lab' : undefined);
        }
        case 'to-string': {
            const a = arg(1);
            return c => {
                const v = a(c);
                if (v === null || v === undefined) return '';
                if (COLORS.has(v)) return `rgba(${Math.round(v[0] * 255)},${Math.round(v[1] * 255)},${Math.round(v[2] * 255)},${v[3]})`;
                return typeof v === 'object' ? JSON.stringify(v) : String(v);
            };
        }
        case 'to-rgba': { const a = arg(1); return c => { const v = colorize(a(c)); return Array.isArray(v) ? [v[0] * 255, v[1] * 255, v[2] * 255, v[3]] : null; }; }
        case 'join': { const a = arg(1), b = arg(2); return c => (a(c) ?? []).join(b(c) ?? ''); }
        case 'split': { const a = arg(1), b = arg(2); return c => String(a(c) ?? '').split(b(c) ?? ''); }
        case 'ln2': return () => Math.LN2;
        case 'to-number': case 'number': {
            const a = args();
            return c => {
                for (const f of a) {
                    const v = f(c);
                    if (v === null && op === 'to-number') return 0; // as in MapLibre: no value converts to zero
                    const n = op === 'number' ? v : Number(v);
                    if (typeof n === 'number' && !isNaN(n) && v !== null && !Array.isArray(v)) return n;
                }
                return 0;
            };
        }
        case 'to-boolean': { const a = arg(1); return c => !!a(c); }
        case 'to-color': {
            const a = args();
            return c => {
                for (const f of a) {
                    const v = f(c);
                    if (typeof v === 'string') { const p = parseColor(v); if (p) return p; } else if (COLORS.has(v)) return v;
                    else if (Array.isArray(v) && v.length >= 3) return color([v[0] / 255, v[1] / 255, v[2] / 255, v[3] ?? 1]);
                }
                return null;
            };
        }
        case 'string': case 'boolean': case 'object': case 'array': {
            const a = args(), t = op === 'array' ? 'object' : op;
            return c => {
                for (const f of a) { const v = f(c); if (typeof v === t && v !== null) return v; }
                return null;
            };
        }
        case 'typeof': { const a = arg(1); return c => { const v = a(c); return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v; }; }
        case 'concat': { const a = args(); return c => a.map(f => f(c) ?? '').join(''); }
        case 'upcase': { const a = arg(1); return c => String(a(c) ?? '').toUpperCase(); }
        case 'downcase': { const a = arg(1); return c => String(a(c) ?? '').toLowerCase(); }
        case 'length': { const a = arg(1); return c => { const v = a(c); return typeof v === 'string' ? [...v].length : v?.length ?? 0; }; }
        case 'in': { const a = arg(1), b = arg(2); return c => { const h = b(c); return h ? h.indexOf(a(c)) >= 0 : false; }; }
        case 'index-of': {
            const a = arg(1), b = arg(2), from = e.length > 3 ? arg(3) : null;
            return c => {
                const hay = b(c), needle = a(c), start = from ? from(c) : undefined;
                if (typeof hay !== 'string' || !SURROGATE.test(hay)) return hay?.indexOf(needle, start) ?? -1;
                // Positions count whole characters, also for characters that take two code units.
                const chars = [...hay], offset = chars.slice(0, start ?? 0).join('').length, at = hay.indexOf(needle, offset);
                return at < 0 ? -1 : [...hay.slice(0, at)].length;
            };
        }
        case 'at': { const a = arg(1), b = arg(2); return c => b(c)?.[a(c)] ?? null; }
        case 'slice': {
            const a = args();
            return c => {
                const v = a[0](c), from = a[1](c), to = a[2] ? a[2](c) : undefined;
                if (typeof v === 'string' && SURROGATE.test(v)) return [...v].slice(from, to).join('');
                return v?.slice(from, to) ?? null;
            };
        }
        case '+': { const a = args(); return c => a.reduce((s, f) => s + f(c), 0); }
        case '*': { const a = args(); return c => a.reduce((s, f) => s * f(c), 1); }
        case '-': { const a = args(); return a.length === 1 ? c => -a[0](c) : c => a[0](c) - a[1](c); }
        case '/': { const a = arg(1), b = arg(2); return c => a(c) / b(c); }
        case '%': { const a = arg(1), b = arg(2); return c => a(c) % b(c); }
        case '^': { const a = arg(1), b = arg(2); return c => a(c) ** b(c); }
        case 'min': { const a = args(); return c => Math.min(...a.map(f => f(c))); }
        case 'max': { const a = args(); return c => Math.max(...a.map(f => f(c))); }
        case 'pi': return () => Math.PI;
        case 'e': return () => Math.E;
        case 'rgb': case 'rgba': {
            const a = args();
            return c => color([a[0](c) / 255, a[1](c) / 255, a[2](c) / 255, a[3] ? a[3](c) : 1]);
        }
        case 'format': {
            // Rich text is flattened to plain text, except for images, which stay in the string as markers (see
            // IMAGE_OPEN) and are drawn in line with the text.
            const parts: Fn[] = [];
            for (let i = 1; i < e.length; i++) {
                const part = e[i];
                if (Array.isArray(part) && part[0] === 'image') { const name = compileExpr(part[1], flags); parts.push(c => { const n = name(c); return n ? IMAGE_OPEN + n + IMAGE_CLOSE : ''; }); }
                else if (typeof part !== 'object' || Array.isArray(part)) {
                    // The options after a section change its size, font or colour. They go in the string as a marker
                    // before the section (see STYLE_OPEN); an empty marker after the section ends them.
                    const text = arg(i), o = e[i + 1], styled = o && typeof o === 'object' && !Array.isArray(o) && (o['font-scale'] != null || o['text-font'] != null || o['text-color'] != null);
                    if (!styled) { parts.push(text); continue; }
                    const scale = compileExpr(o['font-scale'] ?? null, flags), font = compileExpr(o['text-font'] ?? null, flags), tint = compileExpr(o['text-color'] ?? null, flags);
                    parts.push(c => {
                        const t = text(c);
                        if (t == null || t === '') return '';
                        const f = font(c), col = colorize(tint(c));
                        return `${STYLE_OPEN}${scale(c) ?? ''}|${Array.isArray(f) ? f[0] : f ?? ''}|${Array.isArray(col) ? col.join(',') : ''}${STYLE_CLOSE}${t}${STYLE_OPEN}${STYLE_CLOSE}`;
                    });
                }
            }
            return c => parts.map(f => f(c) ?? '').join('');
        }
        case 'image': return arg(1);
        case 'number-format': {
            const a = arg(1), o = e[2] ?? {}, cache = new Map<string, Intl.NumberFormat>();
            const opt = (k: string) => o[k] === undefined ? null : compileExpr(o[k], flags);
            const locale = opt('locale'), min = opt('min-fraction-digits'), max = opt('max-fraction-digits'), currency = opt('currency');
            return c => {
                const l = locale?.(c), mn = min?.(c), mx = max?.(c), cur = currency?.(c), key = `${l}|${mn}|${mx}|${cur}`;
                let f = cache.get(key);
                if (!f) cache.set(key, f = new Intl.NumberFormat(l ?? undefined, {minimumFractionDigits: mn ?? undefined, maximumFractionDigits: mx ?? undefined, ...(cur ? {style: 'currency', currency: cur} : {})}));
                return f.format(a(c));
            };
        }
        case 'let': {
            // Variables are substituted structurally at compile time.
            let body = e[e.length - 1];
            for (let i = e.length - 3; i >= 1; i -= 2) body = substitute(body, e[i], e[i + 1]);
            return compileExpr(body, flags);
        }
        default:
            if (math1[op]) { const a = arg(1), f = math1[op]; return c => f(a(c)); }
            warnOnce(`Unsupported expression "${op}"`);
            return () => null;
    }
}

function substitute(body: any, name: string, value: any): any {
    if (!Array.isArray(body)) return body;
    if (body[0] === 'var' && body[1] === name) return value;
    // An inner `let` that gives the name a new value hides the outer one in its body (but not in its own values).
    if (body[0] === 'let') { for (let i = 1; i + 1 < body.length; i += 2) if (body[i] === name) return body.map((x, k) => k % 2 === 0 && k > 0 && k < body.length - 1 ? substitute(x, name, value) : x); }
    return body.map(x => substitute(x, name, value));
}

function isExpressionFilter(f: any): boolean {
    if (f === true || f === false) return true;
    if (!Array.isArray(f) || f.length === 0) return false;
    switch (f[0]) {
        case 'has': return f.length >= 2 && f[1] !== '$id' && f[1] !== '$type';
        case 'in': return f.length >= 3 && (typeof f[1] !== 'string' || Array.isArray(f[2]));
        case '!in': case '!has': case 'none': return false;
        case '==': case '!=': case '>': case '>=': case '<': case '<=':
            return f.length !== 3 || Array.isArray(f[1]) || Array.isArray(f[2]);
        case 'any': case 'all':
            return f.slice(1).every((x: any) => isExpressionFilter(x) || typeof x === 'boolean');
        default: return true;
    }
}

function legacyFilter(f: any): Fn {
    if (!Array.isArray(f) || !f.length) return () => true;
    const op = f[0];
    if (op === 'all' || op === 'any' || op === 'none') {
        const subs: Fn[] = f.slice(1).map(legacyFilter);
        return op === 'all' ? c => subs.every(s => s(c)) : op === 'any' ? c => subs.some(s => s(c)) : c => !subs.some(s => s(c));
    }
    const key = f[1];
    const get: Fn = key === '$type' ? c => GEOM[c.f!.type] : key === '$id' ? c => c.f!.id : c => c.f!.properties[key];
    if (op === 'has') return c => key in c.f!.properties;
    if (op === '!has') return c => !(key in c.f!.properties);
    if (op === 'in' || op === '!in') {
        const set = new Set(f.slice(2)), want = op === 'in';
        return c => set.has(get(c)) === want;
    }
    const test = cmp[op], v = f[2];
    if (!test) { warnOnce(`Unsupported filter "${op}"`); return () => true; }
    return c => { const x = get(c); return x !== undefined && x !== null ? test(x, v) : op === '!='; };
}

export function compileFilter(f: any): Fn | null {
    if (f === undefined || f === null) return null;
    return isExpressionFilter(f) ? compileExpr(f, {dd: true, zoom: false}) : legacyFilter(f);
}

export interface Prop { dd: boolean; zoom: boolean; eval(zoom: number, f?: Feature | null): any }
/** 'discrete' values (e.g. dash arrays) step between stops instead of interpolating. */
export type PropKind = 'color' | 'number' | 'string' | 'discrete' | 'raw';

function legacyFunction(v: any, flags: Flags, discrete = false): Fn {
    const stops: any[][] = v.stops ?? [];
    if (stops[0]?.[0] && typeof stops[0][0] === 'object') {
        // Zoom-and-property function: one property function per zoom level, blended across zoom.
        const zooms = [...new Set(stops.map(s => s[0].zoom as number))].sort((a, b) => a - b);
        const per = zooms.map(z => legacyFunction({...v, stops: stops.filter(s => s[0].zoom === z).map(s => [s[0].value, s[1]])}, flags, discrete));
        flags.zoom = true;
        return interpolator(1, zooms, per, c => c.zoom, discrete);
    }
    const outs: Fn[] = stops.map(s => () => s[1]);
    if (v.property === undefined) {
        flags.zoom = true;
        const numeric = typeof stops[0]?.[1] === 'number' || typeof stops[0]?.[1] === 'string' && !!parseColor(stops[0][1]) || Array.isArray(stops[0]?.[1]);
        return interpolator(v.base ?? 1, stops.map(s => s[0]), outs, c => c.zoom, !numeric || discrete || v.type === 'interval', undefined, SPACES[v.colorSpace]);
    }
    flags.dd = true;
    const key = v.property, def = v.default ?? null;
    if (v.type === 'identity') return c => c.f?.properties[key] ?? def;
    if (v.type === 'categorical' || typeof stops[0]?.[0] !== 'number') {
        const table = new Map(stops.map(s => [s[0], s[1]]));
        return c => colorize(table.get(c.f?.properties[key]) ?? def);
    }
    const f = interpolator(v.base ?? 1, stops.map(s => s[0]), outs, c => c.f?.properties[key], v.type === 'interval', undefined, SPACES[v.colorSpace]);
    return c => typeof c.f?.properties[key] === 'number' ? f(c) : def;
}

export function compileProp(v: any, kind: PropKind, def: any): Prop {
    const flags: Flags = {dd: false, zoom: false};
    let fn: Fn;
    if (v === undefined || v === null) v = def;
    if (kind !== 'raw' && Array.isArray(v) && typeof v[0] === 'string') fn = compileExpr(v, flags);
    else if (kind !== 'raw' && v && typeof v === 'object' && !Array.isArray(v) && (v.stops || v.type === 'identity')) fn = legacyFunction(v, flags, kind === 'discrete');
    else { const k = v; fn = () => k; }
    const defColor = kind === 'color' ? (typeof def === 'string' ? parseColor(def) : def) ?? [0, 0, 0, 1] : null;
    const finish = kind === 'color'
        ? (x: any) => Array.isArray(x) ? x : (typeof x === 'string' && parseColor(x)) || defColor
        : kind === 'number' ? (x: any) => typeof x === 'number' && !isNaN(x) ? x : def
        : (x: any) => x ?? def;
    if (!flags.dd && !flags.zoom) {
        const k = finish(fn({zoom: 0, f: null}));
        return {dd: false, zoom: false, eval: () => k};
    }
    const ctx: Ctx = {zoom: 0, f: null};
    return {
        dd: flags.dd, zoom: flags.zoom,
        eval(zoom, f) { ctx.zoom = zoom; ctx.f = f ?? null; return finish(fn(ctx)); },
    };
}
