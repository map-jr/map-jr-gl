/**
 * The type check of an expression, with the texts of MapLibre GL JS (style specification 26), for the development build
 * only: src/mistakes.ts imports it, and the production build does not check the types of expressions (#1748). The
 * compiler of src/expr.ts makes functions and does not know types, so this file follows the method of `ParsingContext`
 * and of the `parse` of each expression of MapLibre's style specification (BSD-3-Clause), in new code. It folds
 * constants only where MapLibre reports an error from that: an assertion, and a coercion to a string, a number or a
 * color, of values that are known.
 */
import {parseColor} from './expr.ts';

/** A type: its kind, or for an array, the type of its items and its length. */
type T = string | {i: T; n?: number};
/** A parsed expression: its type and what it depends on. `lit` marks a literal, and `v` is its value when `known`. */
interface N { t: T; lit?: boolean; known?: boolean; v?: unknown; k: boolean; f: boolean; z: boolean; g: boolean; s: boolean }
interface Ctx { path: number[]; want?: T; scope: Record<string, N>; errors: {key: string; error: string}[] }
export interface ExprError { key: string; error: string }

const kind = (t: T) => typeof t === 'string' ? t : 'array';
const arr = (i: T, n?: number): T => ({i, n});
export const typeName = (t: T): string => typeof t === 'string' ? t
    : typeof t.n === 'number' ? `array<${typeName(t.i)}, ${t.n}>` : t.i === 'value' ? 'array' : `array<${typeName(t.i)}>`;
const members: T[] = ['null', 'number', 'string', 'boolean', 'color', 'projectionDefinition', 'formatted', 'object', arr('value'), 'padding', 'numberArray', 'colorArray',
    'resolvedImage', 'variableAnchorOffsetCollection'];
/** '' when `t` fits `want`, or else MapLibre's text. */
const subtype = (want: T, t: T): string => {
    if (t === 'error') return '';
    if (typeof want !== 'string') { if (typeof t !== 'string' && (t.n === 0 && t.i === 'value' || !subtype(want.i, t.i)) && (typeof want.n !== 'number' || want.n === t.n)) return ''; }
    else if (want === kind(t)) return '';
    else if (want === 'value' && members.some(m => !subtype(m, t))) return '';
    return `Expected ${typeName(want)} but found ${typeName(t)} instead.`;
};
const typeOf = (v: unknown): T => {
    if (v === null) return 'null';
    if (Array.isArray(v)) {
        let item: T | undefined;
        for (const e of v) { const t = typeOf(e); if (!item) item = t; else if (item !== t) { item = 'value'; break; } }
        return arr(item ?? 'value', v.length);
    }
    return ['string', 'boolean', 'number'].includes(typeof v) ? typeof v : 'object';
};
const isValue = (v: unknown): boolean => v === null || ['string', 'boolean', 'number'].includes(typeof v) || (typeof v === 'object' && Object.values(v as object).every(isValue));
const toText = (v: unknown) => v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);

const at = (x: Ctx, i?: number, want?: T, scope?: Record<string, N>): Ctx => ({path: i === undefined ? x.path : [...x.path, i], want, scope: scope ?? x.scope, errors: x.errors});
const fail = (x: Ctx, error: string, ...keys: number[]): null => { x.errors.push({key: [...x.path, ...keys].map(k => `[${k}]`).join(''), error}); return null; };
const check = (x: Ctx, want: T, t: T) => { const e = subtype(want, t); if (e) fail(x, e); return e; };

/** A node of the type `t` over `kids`. `o` gives what the node itself reads: f, the feature; z, the zoom; g, a global
 * value that is not constant (the zoom too); s, the feature state; x, that it is never constant; a, that it is a type annotation. */
const node = (t: T, kids: (N | null | undefined)[], o: {f?: boolean; z?: boolean; g?: boolean; s?: boolean; x?: boolean; a?: boolean} = {}): N => {
    const k = kids.filter(Boolean) as N[], any = (p: 'f' | 'z' | 'g' | 's') => !!o[p] || k.some(c => c[p]);
    const n: N = {t, k: false, f: any('f'), z: any('z') || !!o.z, g: any('g') || !!o.z, s: any('s')};
    n.k = !o.x && (o.a ? k.every(c => c.k) : k.every(c => c.lit)) && !n.f && !n.g;
    return n;
};
const literal = (t: T, v: unknown): N => ({t, lit: true, known: true, v, k: true, f: false, z: false, g: false, s: false});
/** An assertion (`a`) or a coercion of `kids` to `t`, folded when its values are known. The error of a fold is MapLibre's. */
const annotate = (x: Ctx, t: T, kids: N[], a: boolean): N | null => {
    const n = node(t, kids, {a: true});
    if (!n.k || !kids.every(c => c.known) || kind(t) === 'resolvedImage') return n;
    const vs = kids.map(c => c.v), last = vs[vs.length - 1];
    if (a) {
        const i = vs.findIndex(v => !subtype(t, typeOf(v)));
        return i < 0 ? fail(x, `Expected value to be of type ${typeName(t)}, but found ${typeName(typeOf(last))} instead.`) : literal(t, vs[i]);
    }
    if (t === 'string') return literal(t, toText(vs[0]));
    if (t === 'boolean') return literal(t, Boolean(vs[0]));
    if (t === 'number') {
        for (const v of vs) { if (v === null) return literal(t, 0); if (!isNaN(Number(v))) return literal(t, Number(v)); }
        return fail(x, `Could not convert ${JSON.stringify(last)} to number.`);
    }
    if (t === 'color' && !vs.some(v => Array.isArray(v) || typeof v === 'string' && parseColor(v)))
        return fail(x, `Could not parse color from value '${typeof last === 'string' ? last : JSON.stringify(last)}'`);
    return {...n, lit: true};
};

// The expressions of `CompoundExpression` of MapLibre: "<names>:<type>:<signature>|<signature>", separated by ";". A
// type is a kind, or "[<item><length>]" for an array; a signature is a list of types, or "*type" for any number of arguments.
const compound: Record<string, [T, (T[] | T)[]]> = {};
const ty = (s: string): T => { const m = /^\[([a-z]+)(\d*)\]$/.exec(s); return m ? arr(m[1], m[2] ? +m[2] : undefined) : s; };
for (const line of ('error:error:string;typeof:string:value;to-rgba:[number4]:color;rgb:color:number,number,number;rgba:color:number,number,number,number;' +
    'has:boolean:string|string,object;get:value:string|string,object;feature-state:value:string;properties:object:;geometry-type:string:;id:value:;' +
    'zoom heatmap-density elevation line-progress ln2 pi e:number:;accumulated:value:;+ * min max:number:*number;-:number:number,number|number;' +
    '/ % ^:number:number,number;sqrt log10 ln log2 sin cos tan asin acos atan abs round floor ceil:number:number;all any:boolean:boolean,boolean|*boolean;' +
    '!:boolean:boolean;is-supported-script:boolean:string;upcase downcase:string:string;concat:string:*value;split:[string]:string,string;' +
    'join:string:[string],string;resolved-locale:string:collator').split(';')) {
    const [names, type, sigs] = line.split(':');
    for (const name of names.split(' ')) compound[name] = [ty(type), sigs.split('|').map(s => s[0] === '*' ? ty(s.slice(1)) : s ? s.split(',').map(ty) : [])];
}
const feature = ['properties', 'geometry-type', 'id', 'feature-state'], globals = ['zoom', 'heatmap-density', 'elevation', 'line-progress', 'accumulated', 'is-supported-script'];
const sig = (s: T[] | T) => Array.isArray(s) ? `(${s.map(typeName).join(', ')})` : `(${typeName(s)}...)`;

function parseCompound(e: any[], x: Ctx): N | null {
    const [type, all] = compound[e[0]], overloads = all.filter(s => !Array.isArray(s) || s.length === e.length - 1);
    let errors: Ctx['errors'] = [];
    for (const s of overloads) {
        errors = [];
        const sx: Ctx = {path: x.path, scope: x.scope, errors}, args: N[] = [];
        let ok = true;
        for (let i = 1; i < e.length; i++) { const a = parse(e[i], at(sx, i, Array.isArray(s) ? s[i - 1] : s)); if (!a) { ok = false; break; } args.push(a); }
        if (!ok) continue;
        args.forEach((a, i) => check(at(sx, i + 1), Array.isArray(s) ? s[i] : s, a.t));
        if (!errors.length) {
            const op = e[0], own = (op === 'get' || op === 'has') && args.length === 1 || feature.includes(op);
            const n = node(type, args, {f: own, s: op === 'feature-state', z: op === 'zoom', g: globals.includes(op), x: op === 'error'});
            // (The one value of a compound expression that is folded: "get" from a literal object.)
            if (op === 'get' && args.length === 2 && args.every(a => a.known)) return literal(type, Object.hasOwn(args[1].v as object, args[0].v as string) ? (args[1].v as any)[args[0].v as string] ?? null : null);
            return n;
        }
    }
    if (overloads.length === 1) { x.errors.push(...errors); return null; }
    const found: string[] = [];
    for (let i = 1; i < e.length; i++) { const a = parse(e[i], at(x, i)); if (!a) return null; found.push(typeName(a.t)); }
    return fail(x, `Expected arguments of type ${(overloads.length ? overloads : all).map(sig).join(' | ')}, but found (${found.join(', ')}) instead.`);
}

const basic = ['boolean', 'string', 'number', 'null', 'value'];
const interpolatable = (t: T) => ['number', 'projectionDefinition', 'color', 'padding', 'numberArray', 'colorArray', 'variableAnchorOffsetCollection'].includes(kind(t))
    || typeof t !== 'string' && t.i === 'number' && typeof t.n === 'number';
/** The output type that `case`, `match`, `coalesce`, `step` and `interpolate` take from the expected type. */
const output = (x: Ctx): T | undefined => x.want && x.want !== 'value' ? x.want : undefined;

const forms: Record<string, (e: any[], x: Ctx) => N | null> = {
    literal(e, x) {
        if (e.length !== 2) return fail(x, `'literal' expression requires exactly one argument, but found ${e.length - 1} instead.`);
        if (!isValue(e[1])) return fail(x, `invalid value of type "${typeof e[1]}"`);
        let t = typeOf(e[1]);
        const w = x.want;
        if (typeof t !== 'string' && t.n === 0 && w && typeof w !== 'string' && (typeof w.n !== 'number' || w.n === 0)) t = w;
        return literal(t, e[1]);
    },
    semiliteral(e, x) {
        if (e.length !== 2) return fail(x, `'semiliteral' expression requires exactly one argument, but found ${e.length - 1} instead.`);
        if (!isValue(e[1])) return fail(x, `invalid value of type "${typeof e[1]}"`);
        if (!Array.isArray(e[1])) return literal(typeOf(e[1]), e[1]);
        const items: N[] = [];
        for (let i = 0; i < e[1].length; i++) { const a = parse(e[1][i], at(at(x, 1), i, 'value')); if (!a) return null; items.push(a); }
        let item: T | undefined;
        for (const a of items) { if (!item) item = a.t; else if (item !== a.t) { item = 'value'; break; } }
        return node(arr(item ?? 'value', items.length), items);
    },
    array(e, x) {
        if (e.length < 2) return fail(x, 'Expected at least one argument.');
        let i = 1, item: T = 'value', n: number | undefined;
        if (e.length > 2) {
            if (!['string', 'number', 'boolean'].includes(e[1])) return fail(x, 'The item type argument of "array" must be one of string, number, boolean', 1);
            item = e[1]; i++;
        }
        if (e.length > 3) {
            if (e[2] !== null && (typeof e[2] !== 'number' || e[2] < 0 || e[2] !== Math.floor(e[2]))) return fail(x, 'The length argument to "array" must be a positive integer literal', 2);
            n = e[2] ?? undefined; i++;
        }
        return assertion(e, x, arr(item, n), i);
    },
    var(e, x) {
        if (e.length !== 2 || typeof e[1] !== 'string') return fail(x, "'var' expression requires exactly one string literal argument.");
        const b = Object.hasOwn(x.scope, e[1]) ? x.scope[e[1]] : undefined;
        if (!b) return fail(x, `Unknown variable "${e[1]}". Make sure "${e[1]}" has been bound in an enclosing "let" expression before using it.`, 1);
        // (A variable has no children in MapLibre, so it does not make an expression depend on the feature or the zoom.)
        return {t: b.t, k: b.k, f: false, z: false, g: false, s: false};
    },
    let(e, x) {
        if (e.length < 4) return fail(x, `Expected at least 3 arguments, but found ${e.length - 1} instead.`);
        const scope = {...x.scope}, kids: N[] = [];
        for (let i = 1; i < e.length - 1; i += 2) {
            if (typeof e[i] !== 'string') return fail(x, `Expected string, but found ${typeof e[i]} instead.`, i);
            if (/[^a-zA-Z0-9_]/.test(e[i])) return fail(x, "Variable names must contain only alphanumeric characters or '_'.", i);
            const v = parse(e[i + 1], at(x, i + 1));
            if (!v) return null;
            scope[e[i]] = v; kids.push(v);
        }
        const r = parse(e[e.length - 1], at(x, e.length - 1, x.want, scope));
        return r && node(r.t, [...kids, r]);
    },
    at(e, x) {
        if (e.length !== 3) return fail(x, `Expected 2 arguments, but found ${e.length - 1} instead.`);
        const i = parse(e[1], at(x, 1, 'number')), a = parse(e[2], at(x, 2, arr(x.want || 'value')));
        return i && a && node((a.t as {i: T}).i, [i, a]);
    },
    in(e, x) {
        if (e.length !== 3) return fail(x, `Expected 2 arguments, but found ${e.length - 1} instead.`);
        return needle(e, x);
    },
    'index-of'(e, x) {
        if (e.length <= 2 || e.length >= 5) return fail(x, `Expected 2 or 3 arguments, but found ${e.length - 1} instead.`);
        return needle(e, x);
    },
    slice(e, x) {
        if (e.length <= 2 || e.length >= 5) return fail(x, `Expected 2 or 3 arguments, but found ${e.length - 1} instead.`);
        const a = parse(e[1], at(x, 1, 'value')), b = parse(e[2], at(x, 2, 'number'));
        if (!a || !b) return null;
        if (!['array', 'string', 'value'].includes(kind(a.t))) return fail(x, `Expected first argument to be of type array or string, but found ${typeName(a.t)} instead`);
        const c = e.length === 4 ? parse(e[3], at(x, 3, 'number')) : undefined;
        return c === null ? null : node(a.t, [a, b, c]);
    },
    length(e, x) {
        if (e.length !== 2) return fail(x, `Expected 1 argument, but found ${e.length - 1} instead.`);
        const a = parse(e[1], at(x, 1));
        if (!a) return null;
        return ['array', 'string', 'value'].includes(kind(a.t)) ? node('number', [a]) : fail(x, `Expected argument of type string or array, but found ${typeName(a.t)} instead.`);
    },
    case(e, x) {
        if (e.length < 4) return fail(x, `Expected at least 3 arguments, but found only ${e.length - 1}.`);
        if (e.length % 2 !== 0) return fail(x, 'Expected an odd number of arguments.');
        let out = output(x);
        const kids: N[] = [];
        for (let i = 1; i < e.length - 1; i += 2) {
            const test = parse(e[i], at(x, i, 'boolean'));
            if (!test) return null;
            const r = parse(e[i + 1], at(x, i + 1, out));
            if (!r) return null;
            out ??= r.t; kids.push(test, r);
        }
        const r = parse(e[e.length - 1], at(x, e.length - 1, out));
        return r && node(out!, [...kids, r]);
    },
    match(e, x) {
        if (e.length < 5) return fail(x, `Expected at least 4 arguments, but found only ${e.length - 1}.`);
        if (e.length % 2 !== 1) return fail(x, 'Expected an even number of arguments.');
        let input: T | undefined, out = output(x);
        const seen = new Set<string>(), kids: N[] = [];
        for (let i = 2; i < e.length - 1; i += 2) {
            const labels = Array.isArray(e[i]) ? e[i] : [e[i]], lx = at(x, i);
            if (!labels.length) return fail(lx, 'Expected at least one branch label.');
            for (const l of labels) {
                if (typeof l !== 'number' && typeof l !== 'string') return fail(lx, 'Branch labels must be numbers or strings.');
                if (typeof l === 'number' && Math.abs(l) > Number.MAX_SAFE_INTEGER) return fail(lx, `Branch labels must be integers no larger than ${Number.MAX_SAFE_INTEGER}.`);
                if (typeof l === 'number' && Math.floor(l) !== l) return fail(lx, 'Numeric branch labels must be integer values.');
                if (!input) input = typeOf(l);
                else if (check(lx, input, typeOf(l))) return null;
                if (seen.has(String(l))) return fail(lx, 'Branch labels must be unique.');
                seen.add(String(l));
            }
            const r = parse(e[i + 1], at(x, i, out));
            if (!r) return null;
            out ??= r.t; kids.push(r);
        }
        const a = parse(e[1], at(x, 1, 'value'));
        if (!a) return null;
        const r = parse(e[e.length - 1], at(x, e.length - 1, out));
        if (!r) return null;
        if (a.t !== 'value' && check(at(x, 1), input!, a.t)) return null;
        return node(out!, [a, ...kids, r]);
    },
    coalesce(e, x) {
        if (e.length < 2) return fail(x, 'Expected at least one argument.');
        let out = output(x);
        const kids: N[] = [];
        for (let i = 1; i < e.length; i++) {
            const a = parse(e[i], at(x, i, out), 'omit');
            if (!a) return null;
            out ??= a.t; kids.push(a);
        }
        return node(x.want && kids.some(a => subtype(x.want!, a.t)) ? 'value' : out!, kids);
    },
    step(e, x) {
        if (e.length - 1 < 4) return fail(x, `Expected at least 4 arguments, but found only ${e.length - 1}.`);
        if ((e.length - 1) % 2 !== 0) return fail(x, 'Expected an even number of arguments.');
        const input = parse(e[1], at(x, 1, 'number'));
        return input && stops(e, x, 'step', 1, output(x), [input]);
    },
    interpolate(e, x) {
        const [op, how] = e;
        if (!Array.isArray(how) || !how.length) return fail(x, 'Expected an interpolation type expression.', 1);
        if (how[0] === 'exponential') { if (typeof how[1] !== 'number') return fail(x, 'Exponential interpolation requires a numeric base.', 1, 1); }
        else if (how[0] === 'cubic-bezier') {
            if (how.length !== 5 || how.slice(1).some(t => typeof t !== 'number' || t < 0 || t > 1)) return fail(x, 'Cubic bezier interpolation requires four numeric arguments with values between 0 and 1.', 1);
        } else if (how[0] !== 'linear') return fail(x, `Unknown interpolation type ${String(how[0])}`, 1, 0);
        if (e.length - 1 < 4) return fail(x, `Expected at least 4 arguments, but found only ${e.length - 1}.`);
        if ((e.length - 1) % 2 !== 0) return fail(x, 'Expected an even number of arguments.');
        const input = parse(e[2], at(x, 2, 'number'));
        if (!input) return null;
        const n = stops(e, x, 'interpolate', 3, op !== 'interpolate' && x.want !== 'colorArray' ? 'color' : output(x), [input]);
        return n && (interpolatable(n.t) ? n : fail(x, `Type ${typeName(n.t)} is not interpolatable.`));
    },
    collator(e, x) {
        if (e.length !== 2) return fail(x, 'Expected one argument.');
        const o = e[1];
        if (typeof o !== 'object' || Array.isArray(o) || o === null) return fail(x, 'Collator options argument must be an object.');
        const kids: (N | null)[] = [parse(o['case-sensitive'] ?? false, at(x, 1, 'boolean'))];
        if (!kids[0]) return null;
        if (!(kids[1] = parse(o['diacritic-sensitive'] ?? false, at(x, 1, 'boolean')))) return null;
        if (o.locale && !(kids[2] = parse(o.locale, at(x, 1, 'string')))) return null;
        return node('collator', kids, {x: true});
    },
    format(e, x) {
        if (e.length < 2) return fail(x, 'Expected at least one argument.');
        if (!Array.isArray(e[1]) && typeof e[1] === 'object') return fail(x, 'First argument must be an image or text section.');
        const kids: N[] = [];
        let options = false;
        for (let i = 1; i < e.length; i++) {
            const a = e[i];
            if (options && typeof a === 'object' && !Array.isArray(a) && a !== null) {
                options = false;
                for (const [k, t] of [['font-scale', 'number'], ['text-font', arr('string')], ['text-color', 'color'], ['vertical-align', 'string']] as [string, T][]) {
                    if (!a[k]) continue;
                    if (k === 'vertical-align' && typeof a[k] === 'string' && !['bottom', 'center', 'top'].includes(a[k]))
                        return fail(x, `'vertical-align' must be one of: 'bottom', 'center', 'top' but found '${a[k]}' instead.`);
                    const p = parse(a[k], at(x, 1, t));
                    if (!p) return null;
                    kids.push(p);
                }
            } else {
                const c = parse(a, at(x, 1, 'value'));
                if (!c) return null;
                if (!['string', 'value', 'null', 'resolvedImage'].includes(kind(c.t))) return fail(x, "Formatted text type must be 'string', 'value', 'image' or 'null'.");
                options = true; kids.push(c);
            }
        }
        return node('formatted', kids);
    },
    image(e, x) {
        if (e.length !== 2) return fail(x, 'Expected two arguments.');
        const name = parse(e[1], at(x, 1, 'string'));
        return name ? node('resolvedImage', [name]) : fail(x, 'No image name provided.');
    },
    'number-format'(e, x) {
        if (e.length !== 3) return fail(x, 'Expected two arguments.');
        const kids = [parse(e[1], at(x, 1, 'number'))], o = e[2];
        if (!kids[0]) return null;
        if (typeof o !== 'object' || Array.isArray(o) || o === null) return fail(x, 'NumberFormat options argument must be an object.');
        for (const [k, t] of [['locale', 'string'], ['currency', 'string'], ['unit', 'string'], ['min-fraction-digits', 'number'], ['max-fraction-digits', 'number']]) {
            if (k === 'min-fraction-digits' && o.currency && o.unit) return fail(x, 'NumberFormat options `currency` and `unit` are mutually exclusive');
            if (o[k] && !kids[kids.push(parse(o[k], at(x, 1, t))) - 1]) return null;
        }
        return node('string', kids);
    },
    within(e, x) {
        if (e.length !== 2) return fail(x, `'within' expression requires exactly one argument, but found ${e.length - 1} instead.`);
        const g = e[1], poly = (t: unknown) => t === 'Polygon' || t === 'MultiPolygon';
        const ok = isValue(g) && g && (g.type === 'FeatureCollection' ? g.features?.some((f: any) => poly(f?.geometry?.type)) : g.type === 'Feature' ? poly(g.geometry?.type) : poly(g.type));
        return ok ? node('boolean', [], {f: true, x: true}) : fail(x, "'within' expression requires valid geojson object that contains polygon geometry type.");
    },
    distance(e, x) {
        if (e.length !== 2) return fail(x, `'distance' expression requires exactly one argument, but found ${e.length - 1} instead.`);
        const g = e[1];
        const ok = isValue(g) && g && typeof g === 'object' && (g.type === 'FeatureCollection' || g.type === 'Feature' || 'type' in g && 'coordinates' in g);
        return ok ? node('number', [], {f: true, x: true}) : fail(x, "'distance' expression requires valid geojson object that contains polygon geometry type.");
    },
    'global-state'(e, x) {
        if (e.length !== 2) return fail(x, `Expected 1 argument, but found ${e.length - 1} instead.`);
        if (e[1] == null) return fail(x, 'Global state property must be defined.');
        if (typeof e[1] !== 'string') return fail(x, `Global state property must be string, but found ${typeof e[1]} instead.`);
        return node('value', [], {x: true});
    },
};
forms['interpolate-hcl'] = forms['interpolate-lab'] = forms.interpolate;
for (const t of ['string', 'number', 'boolean', 'object']) forms[t] = (e, x) => e.length < 2 ? fail(x, 'Expected at least one argument.') : assertion(e, x, t, 1);
for (const t of ['boolean', 'color', 'number', 'string']) forms['to-' + t] = (e, x) => {
    if (e.length < 2) return fail(x, 'Expected at least one argument.');
    if ((t === 'boolean' || t === 'string') && e.length !== 2) return fail(x, 'Expected one argument.');
    const kids: N[] = [];
    for (let i = 1; i < e.length; i++) { const a = parse(e[i], at(x, i, 'value')); if (!a) return null; kids.push(a); }
    return annotate(x, t, kids, false);
};
for (const op of ['==', '!=', '>', '<', '>=', '<=']) forms[op] = (e, x) => {
    if (e.length !== 3 && e.length !== 4) return fail(x, 'Expected two or three arguments.');
    const order = op !== '==' && op !== '!=', fits = (t: T) => (order ? ['string', 'number', 'value'] : basic).includes(kind(t));
    const a = parse(e[1], at(x, 1, 'value'));
    if (!a) return null;
    if (!fits(a.t)) return fail(at(x, 1), `"${op}" comparisons are not supported for type '${typeName(a.t)}'.`);
    const b = parse(e[2], at(x, 2, 'value'));
    if (!b) return null;
    if (!fits(b.t)) return fail(at(x, 2), `"${op}" comparisons are not supported for type '${typeName(b.t)}'.`);
    if (kind(a.t) !== kind(b.t) && a.t !== 'value' && b.t !== 'value') return fail(x, `Cannot compare types '${typeName(a.t)}' and '${typeName(b.t)}'.`);
    let c: N | null = null;
    if (e.length === 4) {
        if (![a.t, b.t].some(t => t === 'string' || t === 'value')) return fail(x, 'Cannot use collator to compare non-string types.');
        if (!(c = parse(e[3], at(x, 3, 'collator')))) return null;
    }
    return node('boolean', [a, b, c]);
};

function assertion(e: any[], x: Ctx, t: T, from: number): N | null {
    const kids: N[] = [];
    for (let i = from; i < e.length; i++) { const a = parse(e[i], at(x, i, 'value')); if (!a) return null; kids.push(a); }
    return annotate(x, t, kids, true);
}
function needle(e: any[], x: Ctx): N | null {
    const a = parse(e[1], at(x, 1, 'value')), b = parse(e[2], at(x, 2, 'value'));
    if (!a || !b) return null;
    if (!basic.includes(kind(a.t))) return fail(x, `Expected first argument to be of type boolean, string, number or null, but found ${typeName(a.t)} instead`);
    const c = e.length === 4 ? parse(e[3], at(x, 3, 'number')) : undefined;
    return c === null ? null : node(e[0] === 'in' ? 'boolean' : 'number', [a, b, c]);
}
function stops(e: any[], x: Ctx, name: string, first: number, out: T | undefined, kids: N[]): N | null {
    let last = -Infinity;
    for (let i = first; i < e.length; i += 2) {
        const label = name === 'step' && i === 1 ? -Infinity : e[i], vi = i + 1;
        if (typeof label !== 'number') return fail(x, `Input/output pairs for "${name}" expressions must be defined using literal numeric values (not computed expressions) for the input values.`, i);
        if (kids.length > 1 && last >= label) return fail(x, `Input/output pairs for "${name}" expressions must be arranged with input values in strictly ascending order.`, i);
        const r = parse(e[vi], at(x, vi, out));
        if (!r) return null;
        out ??= r.t; last = label; kids.push(r);
    }
    return node(out!, kids);
}

/** MapLibre's `ParsingContext._parse`: the node of `e`, or null after it has added the errors to `x`. */
function parse(e: unknown, x: Ctx, annotation?: 'omit' | 'coerce'): N | null {
    if (e === null || ['string', 'boolean', 'number'].includes(typeof e)) e = ['literal', e];
    if (!Array.isArray(e)) return fail(x, e === undefined ? "'undefined' value invalid. Use null instead." : typeof e === 'object' ? 'Bare objects invalid. Use ["literal", {...}] instead.' : `Expected an array, but found ${typeof e} instead.`);
    if (!e.length) return fail(x, 'Expected an array with at least one element. If you wanted a literal array, use ["literal", []].');
    const op = e[0];
    if (typeof op !== 'string') return fail(x, `Expression name must be a string, but found ${typeof op} instead. If you wanted a literal array, use ["literal", [...]].`, 0);
    const form = Object.hasOwn(forms, op) ? forms[op] : Object.hasOwn(compound, op) ? parseCompound : undefined;
    if (!form) return fail(x, `Unknown expression "${op}". If you wanted a literal array, use ["literal", [...]].`, 0);
    let n = form(e, x);
    if (!n) return null;
    const w = x.want;
    if (w) {
        const want = kind(w), has = kind(n.t);
        const assert = ['string', 'number', 'boolean', 'object', 'array'].includes(want) && has === 'value';
        const coerce = want === 'projectionDefinition' && ['string', 'array', 'value'].includes(has) || ['color', 'formatted', 'resolvedImage'].includes(want) && ['value', 'string'].includes(has)
            || ['padding', 'numberArray'].includes(want) && ['value', 'number', 'array'].includes(has) || want === 'colorArray' && ['value', 'string', 'array'].includes(has)
            || want === 'variableAnchorOffsetCollection' && ['value', 'array'].includes(has);
        if (assert || coerce) { if (annotation !== 'omit' && !(n = annotate(x, w, [n], (annotation ?? (assert ? 'assert' : 'coerce')) === 'assert'))) return null; }
        else if (check(x, w, n.t)) return null;
    }
    // (A constant that is not a literal is folded, as MapLibre does, and its value is then unknown here.)
    if (!n.lit && kind(n.t) !== 'resolvedImage' && n.k) n = {...n, lit: true};
    return n;
}

/** The types of the codes of `expressionCode` in scripts/style-spec-values.mjs. */
const types: Record<string, T> = {n: 'number', S: 'string', e: 'string', b: 'boolean', c: 'color', f: 'formatted', i: 'resolvedImage', p: 'padding', N: 'numberArray', C: 'colorArray',
    v: 'variableAnchorOffsetCollection', P: 'projectionDefinition', V: 'value'};
/** The top-level zoom curve of `e` ("step", "interpolate" or ""), as MapLibre's `findZoomCurve` finds it when it finds no error. */
const curve = (e: any): string => !Array.isArray(e) ? '' : e[0] === 'let' ? curve(e[e.length - 1]) : e[0] === 'coalesce' ? e.slice(1).map(curve).find(Boolean) ?? ''
    : /^(step|interpolate)/.test(e[0]) && JSON.stringify(e[e[0] === 'step' ? 1 : 2]) === '["zoom"]' ? e[0] : '';

/**
 * MapLibre's errors for the expression `e` of a property whose type and flags are `code` (see `expressionCode` in
 * scripts/style-spec-values.mjs), as `createPropertyExpression` and `validateExpression` give them, each with the key
 * of its place in `e` ('' for the whole expression). `layout` marks a layout property (or 'filter', a filter, whose code has no type: MapLibre expects none), where "feature-state" is not
 * supported. The errors of ["zoom"] in the wrong place are not here: `zoomCurveError` of src/mistakes.ts has them.
 */
export function expressionErrors(e: unknown, code: string, layout?: boolean | 'filter'): ExprError[] {
    const [type, flags] = code.split(' ');
    const want = type[0] === 'A' ? arr(types[type[1]], type.length > 2 ? +type.slice(2) : undefined) : types[type];
    const x: Ctx = {path: [], want, scope: {}, errors: []};
    const n = parse(e, x, type === 'S' ? 'coerce' : undefined);
    if (!n) return x.errors;
    const one = (error: string) => [{key: '', error}];
    if (n.f && !flags.includes('d')) return one('data expressions not supported');
    if (n.z && !flags.includes('z')) return one('zoom expressions not supported');
    if (curve(e).startsWith('interpolate') && !flags.includes('i')) return one('"interpolate" expressions cannot be used with this property');
    if (layout && n.s) return one(`"feature-state" data expressions are not supported with ${layout === true ? 'layout properties' : 'filters'}.`);
    return [];
}
