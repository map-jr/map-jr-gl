/**
 * Style expressions compiled once into plain closures (no interpreter objects, no `new Function`, so CSP-safe).
 * Covers the commonly used subset of the MapLibre expression language plus legacy filters and legacy `stops` functions.
 */
export interface Feature { type: number; id?: number; properties: Record<string, any> }
export interface Ctx { zoom: number; f: Feature | null }
export type Fn = (c: Ctx) => any;
export interface Flags { dd: boolean; zoom: boolean }
export type RGBA = [number, number, number, number];

const NAMED: Record<string, string> = {
    black: '#000', white: '#fff', red: '#f00', green: '#008000', blue: '#00f', yellow: '#ff0', gray: '#808080', grey: '#808080',
    orange: '#ffa500', purple: '#800080', brown: '#a52a2a', pink: '#ffc0cb', cyan: '#0ff', magenta: '#f0f', silver: '#c0c0c0',
    lightgray: '#d3d3d3', lightgrey: '#d3d3d3', darkgray: '#a9a9a9', darkgrey: '#a9a9a9', navy: '#000080', teal: '#008080',
    olive: '#808000', maroon: '#800000', lime: '#0f0', aqua: '#0ff', beige: '#f5f5dc', ivory: '#fffff0', khaki: '#f0e68c',
    lightblue: '#add8e6', lightgreen: '#90ee90', whitesmoke: '#f5f5f5', gainsboro: '#dcdcdc', dimgray: '#696969', tan: '#d2b48c',
};
const colorCache = new Map<string, RGBA | null>();

export function parseColor(input: string): RGBA | null {
    let c = colorCache.get(input);
    if (c !== undefined) return c;
    c = parseColorUncached(input.trim().toLowerCase());
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
    if (!warned.has(msg)) { warned.add(msg); console.warn('[tessera] ' + msg); }
}

function lerp(a: any, b: any, t: number): any {
    if (typeof a === 'number') return a + (b - a) * t;
    if (Array.isArray(a)) return a.map((v, i) => v + (b[i] - v) * t);
    return t < 1 ? a : b;
}

/** Interpolation outputs written as colour strings are converted once, at compile time or first use. */
function colorize(v: any): any {
    return typeof v === 'string' ? (parseColor(v) ?? v) : v;
}

function interpolator(base: number, stops: number[], outs: Fn[], input: Fn, step: boolean): Fn {
    const n = stops.length;
    return c => {
        const x = input(c);
        if (typeof x !== 'number' || x <= stops[0]) return colorize(outs[0](c));
        if (x >= stops[n - 1]) return colorize(outs[n - 1](c));
        let i = 1;
        while (stops[i] <= x) i++;
        if (step) return colorize(outs[i - 1](c));
        const x0 = stops[i - 1], x1 = stops[i];
        const t = base === 1 ? (x - x0) / (x1 - x0) : (base ** (x - x0) - 1) / (base ** (x1 - x0) - 1);
        return lerp(colorize(outs[i - 1](c)), colorize(outs[i](c)), t);
    };
}

const cmp: Record<string, (a: any, b: any) => boolean> = {
    '==': (a, b) => a === b, '!=': (a, b) => a !== b, '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b,
};
const math1: Record<string, (a: number) => number> = {
    abs: Math.abs, ceil: Math.ceil, floor: Math.floor, round: Math.round, sqrt: Math.sqrt, ln: Math.log, log10: Math.log10, log2: Math.log2,
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
};

export function compileExpr(e: any, flags: Flags): Fn {
    if (!Array.isArray(e)) {
        return () => e;
    }
    const op = e[0];
    const arg = (i: number) => compileExpr(e[i], flags);
    const args = (from = 1) => e.slice(from).map((x: any) => compileExpr(x, flags)) as Fn[];
    switch (op) {
        case 'literal': { const v = e[1]; return () => v; }
        case 'get': {
            flags.dd = true;
            if (typeof e[1] === 'string' && e.length === 2) { const k = e[1]; return c => c.f?.properties[k] ?? null; }
            const k = arg(1);
            if (e.length === 2) return c => c.f?.properties[k(c)] ?? null;
            const o = arg(2);
            return c => o(c)?.[k(c)] ?? null;
        }
        case 'has': { flags.dd = true; const k = arg(1); return c => !!c.f && k(c) in c.f.properties; }
        case 'id': flags.dd = true; return c => c.f?.id ?? null;
        case 'properties': flags.dd = true; return c => c.f?.properties ?? {};
        case 'geometry-type': flags.dd = true; return c => GEOM[c.f?.type ?? 0];
        case 'zoom': flags.zoom = true; return c => c.zoom;
        case '==': case '!=': case '<': case '<=': case '>': case '>=': {
            const a = arg(1), b = arg(2), f = cmp[op];
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
            if (kind[0] === 'cubic-bezier') warnOnce('cubic-bezier interpolation is approximated as linear');
            return interpolator(kind[0] === 'exponential' ? kind[1] : 1, stops, outs, input, false);
        }
        case 'to-string': { const a = arg(1); return c => { const v = a(c); return v === null || v === undefined ? '' : String(v); }; }
        case 'to-number': case 'number': {
            const a = args();
            return c => {
                for (const f of a) { const v = f(c); const n = op === 'number' ? v : Number(v); if (typeof n === 'number' && !isNaN(n) && v !== null) return n; }
                return 0;
            };
        }
        case 'to-boolean': { const a = arg(1); return c => !!a(c); }
        case 'to-color': { const a = arg(1); return c => colorize(a(c)); }
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
        case 'length': { const a = arg(1); return c => a(c)?.length ?? 0; }
        case 'in': { const a = arg(1), b = arg(2); return c => { const h = b(c); return h ? h.indexOf(a(c)) >= 0 : false; }; }
        case 'index-of': { const a = arg(1), b = arg(2); return c => b(c)?.indexOf(a(c)) ?? -1; }
        case 'at': { const a = arg(1), b = arg(2); return c => b(c)?.[a(c)] ?? null; }
        case 'slice': { const a = args(); return c => a[0](c)?.slice(a[1](c), a[2] ? a[2](c) : undefined) ?? null; }
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
            return c => [a[0](c) / 255, a[1](c) / 255, a[2](c) / 255, a[3] ? a[3](c) : 1];
        }
        case 'format': {
            // Rich text sections are flattened to plain text for now.
            const parts: Fn[] = [];
            for (let i = 1; i < e.length; i++) if (typeof e[i] !== 'object' || Array.isArray(e[i])) parts.push(arg(i));
            return c => parts.map(f => f(c) ?? '').join('');
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
export type PropKind = 'color' | 'number' | 'string' | 'raw';

function legacyFunction(v: any, flags: Flags): Fn {
    const stops: any[][] = v.stops ?? [];
    const outs: Fn[] = stops.map(s => () => s[1]);
    if (v.property === undefined) {
        flags.zoom = true;
        const numeric = typeof stops[0]?.[1] === 'number' || typeof stops[0]?.[1] === 'string' && !!parseColor(stops[0][1]) || Array.isArray(stops[0]?.[1]);
        return interpolator(v.base ?? 1, stops.map(s => s[0]), outs, c => c.zoom, !numeric || v.type === 'interval');
    }
    flags.dd = true;
    const key = v.property, def = v.default ?? null;
    if (v.type === 'identity') return c => c.f?.properties[key] ?? def;
    if (v.type === 'categorical' || typeof stops[0]?.[0] !== 'number') {
        const table = new Map(stops.map(s => [s[0], s[1]]));
        return c => colorize(table.get(c.f?.properties[key]) ?? def);
    }
    const f = interpolator(v.base ?? 1, stops.map(s => s[0]), outs, c => c.f?.properties[key], v.type === 'interval');
    return c => typeof c.f?.properties[key] === 'number' ? f(c) : def;
}

export function compileProp(v: any, kind: PropKind, def: any): Prop {
    const flags: Flags = {dd: false, zoom: false};
    let fn: Fn;
    if (v === undefined || v === null) v = def;
    if (kind !== 'raw' && Array.isArray(v) && typeof v[0] === 'string') fn = compileExpr(v, flags);
    else if (kind !== 'raw' && v && typeof v === 'object' && !Array.isArray(v) && v.stops) fn = legacyFunction(v, flags);
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
