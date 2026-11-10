import earcut from 'earcut';
import {EXTENT} from './geo.ts';
import {decodeVectorTile} from './mvt.ts';
import {GEOJSON_LAYER} from './geojson.ts';
import {parseFontName, type CompiledLayer} from './style.ts';
import {featureStateOf, type Feature, type RGBA} from './expr.ts';

/**
 * Renderer-neutral tile geometry: flat rings in tile units plus per-feature paint values.
 * The SVG backend turns this straight into paths; `tessellate` turns it into GPU buffers.
 */
export interface Geom {
    coords: Int16Array;
    /** Cumulative point count at the end of each ring. */
    ringEnds: Uint32Array;
    /** Cumulative ring count at the end of each feature. */
    featEnds: Uint32Array;
}
export interface Batch {
    type: 'fill' | 'line' | 'circle';
    geom: Geom;
    /** Per-feature straight-alpha RGBA, present only when colour or opacity is data-driven. */
    color?: Uint8Array;
    width?: Float32Array;
    radius?: Float32Array;
    cap?: string;
    join?: string;
    /** Fill layers with an explicit outline colour. */
    outline?: boolean;
    /** False when the style turns edge smoothing off for a fill layer. */
    antialias?: boolean;
    /** Building extrusions: per-feature top and bottom heights in metres. */
    height?: Float32Array;
    base?: Float32Array;
}
export interface LabelSrc {
    x: number; y: number; text: string;
    /** Direction of the line at the anchor in tile space (radians), or null for point labels. */
    angle: number | null;
    /** Length of the line the label sits on, in tile units. */
    len: number;
    /** For text that follows a line: the nearby stretch of line as flat tile coordinates, and which of its points is the anchor. */
    path?: number[];
    pathIndex?: number;
    size0: number; size1: number; color: RGBA; halo: RGBA; haloWidth: number; haloBlur: number;
    /** How the lines of a multi-line label align with each other: -1 left, 0 centre, 1 right. */
    justify: number;
    /** `text-rotate`, in radians clockwise. */
    rotate: number;
    /** Line height in ems, and a fixed shift on screen in pixels. */
    lineHeight: number; translate: [number, number];
    font: string; maxWidth: number; spacing: number; offset: [number, number]; anchor: string; padding: number; overlap: boolean;
    /** Text stays upright instead of following the line it is placed on (e.g. road shields). */
    upright: boolean;
    textOptional: boolean; ignore: boolean; varAnchor: string[] | null; radial: number;
    icon?: {
        name: string; size: number; /** Size at the next zoom level, to interpolate towards. */ size1: number; offset: [number, number]; rotate: number; fit: string; fitPad: [number, number, number, number];
        opacity: number; anchor: string; color: RGBA; ignore: boolean; padding: number; translate: [number, number];
        overlap: boolean; optional: boolean; upright: boolean;
    };
}
export interface TileIR { layers: Record<string, Batch>; labels: Record<string, LabelSrc[]> }

export type GLBatch =
    | {type: 'fill'; pos: Int16Array; idx: Uint32Array; color?: Uint8Array; /** Polygon edges as vertex index pairs, drawn as one-pixel antialiased lines. */ edges?: Uint32Array}
    | {type: 'extrusion'; v: Float32Array; idx: Uint32Array; color?: Uint8Array}
    | {type: 'line'; /** Packed vertices, LINE_VERTEX bytes each: see tessellateLine. */ v: Uint8Array; idx: Uint32Array; color?: Uint8Array; width?: Float32Array}
    | {type: 'circle'; /** x, y, cornerX, cornerY per vertex */ pos: Int16Array; idx: Uint32Array; color?: Uint8Array; radius?: Float32Array};
export interface TileGL { layers: Record<string, GLBatch>; labels: Record<string, LabelSrc[]> }
/** A raster tile as the SVG backend sees it: just somewhere to load the image from. */
export interface TileImage { href: string }

/** "Open Sans Semibold Italic" -> "italic 600|Open Sans": CSS style and weight, then the family named by the style. */
function fontStyle(names: any): string {
    const f = parseFontName(String(Array.isArray(names) ? names[0] : names));
    return (f.style === 'italic' ? 'italic ' : '') + f.weight + '|' + f.family;
}

function pushColor(out: number[], c: RGBA, alpha: number) {
    out.push(Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255), Math.round(c[3] * alpha * 255));
}

const WHITE: RGBA = [1, 1, 1, 1];

/** A decoded tile: named layers of features. Vector tiles and sliced GeoJSON both take this shape. */
export type TileLayers = Record<string, {features: TileFeature[]}>;
export interface TileFeature extends Feature { geometry(extent: number, coords: number[], ringEnds: number[]): number }

export function buildTile(data: Uint8Array | TileLayers, z: number, layers: CompiledLayer[], overscaled: boolean): TileIR {
    const vt: TileLayers = data instanceof Uint8Array ? decodeVectorTile(data) : data;
    const geomCache = new Map<TileFeature, {coords: number[]; ringEnds: number[]}>();
    const geometry = (f: TileFeature) => {
        let g = geomCache.get(f);
        if (!g) { g = {coords: [], ringEnds: []}; f.geometry(EXTENT, g.coords, g.ringEnds); geomCache.set(f, g); }
        return g;
    };
    const out: TileIR = {layers: {}, labels: {}};
    const ctx = {zoom: z, f: null as Feature | null};

    for (const L of layers) {
        if (L.type === 'background' || !L.visible) continue;
        // A tile is drawn from its own zoom up to the next one (further if it is the source's deepest level).
        if (L.minzoom >= z + 1 && !overscaled) continue;
        if (L.maxzoom <= z) continue;
        const vl = vt[L.sourceLayer ?? GEOJSON_LAYER];
        if (!vl) continue;
        const p = L.p;

        if (L.type === 'symbol') {
            const labels: LabelSrc[] = [], keys: number[] = [], sorted = p.sortKey.dd || p.sortKey.eval(z) !== 0;
            for (const f of vl.features) {
                ctx.f = f;
                f.state = featureStateOf(L.source, L.sourceLayer, f.id);
                if (L.filter && !L.filter(ctx)) continue;
                const tokens = (v: unknown) => String(v ?? '').replace(/\{([^}]+)\}/g, (_, k) => f.properties[k] ?? '').trim();
                let text = tokens(p.field.eval(z, f));
                const iconName = tokens(p.icon.eval(z, f));
                if (!text && !iconName) continue;
                const tt = p.transform.eval(z, f);
                if (tt === 'uppercase' || tt === 'lowercase') {
                    // (Image names inside the text are left as they are.)
                    const change = (t: string) => tt === 'uppercase' ? t.toUpperCase() : t.toLowerCase();
                    text = text.split(/(\uE000[^\uE001]*\uE001)/).map((part, i) => i % 2 ? part : change(part)).join('');
                }
                const color = p.color.eval(z, f) as RGBA, op = p.opacity.eval(z, f);
                const along = p.placement.eval(z, f) !== 'point';
                const base = {
                    text, size0: p.size.eval(z, f), size1: p.size.eval(z + 1, f),
                    color: [color[0], color[1], color[2], color[3] * op] as RGBA,
                    halo: p.haloColor.eval(z, f), haloWidth: p.haloWidth.eval(z, f), haloBlur: p.haloBlur.eval(z, f), rotate: p.rotate.eval(z, f) * Math.PI / 180, justify: justification(p.justify.eval(z, f), p.anchor.eval(z, f)), font: fontStyle(p.font.eval(z, f)),
                    maxWidth: p.maxWidth.eval(z, f), spacing: p.spacing.eval(z, f), offset: p.offset.eval(z, f), anchor: p.anchor.eval(z, f),
                    padding: p.padding.eval(z, f), overlap: overlaps(p.overlapMode.eval(z, f), p.overlap.eval(z, f)), lineHeight: p.lineHeight.eval(z, f), translate: p.translate.eval(z, f),
                    upright: p.textAlign.eval(z, f) === 'viewport', textOptional: !!p.textOptional.eval(z, f), ignore: !!p.ignore.eval(z, f),
                    varAnchor: p.varAnchor.eval(z, f), radial: p.radial.eval(z, f),
                    icon: iconName ? {
                        name: iconName, size: p.iconSize.eval(z, f), size1: p.iconSize.eval(z + 1, f), opacity: p.iconOpacity.eval(z, f), anchor: p.iconAnchor.eval(z, f), color: p.iconColor.eval(z, f), offset: p.iconOffset.eval(z, f), rotate: p.iconRotate.eval(z, f),
                        fit: p.iconFit.eval(z, f), fitPad: p.iconFitPad.eval(z, f), overlap: overlaps(p.iconOverlapMode.eval(z, f), p.iconOverlap.eval(z, f)), ignore: !!p.iconIgnore.eval(z, f), padding: p.iconPadding.eval(z, f), translate: p.iconTranslate.eval(z, f),
                        optional: !!p.iconOptional.eval(z, f), upright: p.iconAlign.eval(z, f) === 'viewport',
                    } : undefined,
                };
                // symbol-spacing is in pixels; tiles are EXTENT units across TILE_SIZE pixels.
                const g = geometry(f), spacing = p.symbolSpacing.eval(z, f) * EXTENT / 512;
                let start = 0;
                for (const end of g.ringEnds) {
                    // Enough line either side of the anchor to lay the text along it at this tile's own zoom (8 tile units per pixel).
                    const window = along && text && !base.upright ? text.length * Math.max(base.size0, base.size1) * 0.7 * 8 * 0.6 + 200 : 0;
                    for (const a of anchors(g.coords, start, end, f.type, along, spacing, !!text, window)) {
                        if (a[0] < 0 || a[0] >= EXTENT || a[1] < 0 || a[1] >= EXTENT) continue;
                        const label: LabelSrc = {...base, x: a[0], y: a[1], angle: along ? a[2] : null, len: a[3]};
                        if (a.length > 4) { label.pathIndex = a[4]; label.path = a.slice(5); }
                        labels.push(label);
                        if (sorted) keys.push(p.sortKey.eval(z, f));
                    }
                    start = end;
                    if (f.type === 3 && !along) break; // one label per polygon: outer ring only
                }
            }
            // symbol-sort-key: lower keys are placed first, so they win when labels compete for space.
            if (sorted) { const order = labels.map((_, i) => i).sort((a, b) => keys[a] - keys[b] || a - b); out.labels[L.id] = order.map(i => labels[i]); continue; }
            if (labels.length) out.labels[L.id] = labels;
            continue;
        }

        const extrude = L.type === 'fill-extrusion', kind = extrude ? 'fill' : L.type;
        const heights: number[] = [], bases: number[] = [];
        const want = kind === 'fill' ? 3 : L.type === 'circle' ? 1 : 0;
        const coords: number[] = [], ringEnds: number[] = [], featEnds: number[] = [];
        const ddColor = p.color.dd || p.opacity.dd;
        const color: number[] = [], scalar: number[] = [];
        const scalarProp = L.type === 'line' ? p.width : L.type === 'circle' ? p.radius : null;
        for (const f of vl.features) {
            if (want ? f.type !== want : f.type === 1) continue;
            ctx.f = f;
                f.state = featureStateOf(L.source, L.sourceLayer, f.id);
            if (L.filter && !L.filter(ctx)) continue;
            const g = geometry(f);
            let start = 0;
            for (const end of g.ringEnds) {
                for (let i = start * 2; i < end * 2; i++) coords.push(g.coords[i]);
                // Polygon rings drawn as lines need an explicit closing point.
                if (L.type === 'line' && f.type === 3) coords.push(g.coords[start * 2], g.coords[start * 2 + 1]);
                ringEnds.push(coords.length / 2);
                start = end;
            }
            featEnds.push(ringEnds.length);
            if (ddColor) pushColor(color, p.color.dd ? p.color.eval(z, f) : WHITE, p.opacity.dd ? p.opacity.eval(z, f) : 1);
            if (scalarProp?.dd) scalar.push(scalarProp.eval(z, f));
            if (extrude) { heights.push(p.height.eval(z, f)); bases.push(p.base.eval(z, f)); }
        }
        if (!featEnds.length) continue;
        const batch: Batch = {
            type: kind as Batch['type'],
            geom: {coords: Int16Array.from(coords), ringEnds: Uint32Array.from(ringEnds), featEnds: Uint32Array.from(featEnds)},
        };
        if (ddColor) batch.color = Uint8Array.from(color);
        if (scalarProp?.dd) batch[L.type === 'line' ? 'width' : 'radius'] = Float32Array.from(scalar);
        if (extrude) { batch.height = Float32Array.from(heights); batch.base = Float32Array.from(bases); }
        if (L.type === 'line') { batch.cap = p.cap.eval(z); batch.join = p.join.eval(z); }
        if (L.type === 'fill') { batch.outline = p.outline.eval(z)[3] > 0; batch.antialias = p.antialias.eval(z) !== false; }
        out.layers[L.id] = batch;
    }
    return out;
}

/** Yields [x, y, angle, length, (anchor index in path, ...path)] label anchors for one ring. */
function anchors(c: number[], start: number, end: number, type: number, along: boolean, spacing: number, hasText: boolean, window = 0): number[][] {
    if (type === 1) return [[c[start * 2], c[start * 2 + 1], 0, 0]];
    if (type === 3 && !along) {
        let a = 0, cx = 0, cy = 0;
        for (let i = start, j = end - 1; i < end; j = i++) {
            const x0 = c[j * 2], y0 = c[j * 2 + 1], x1 = c[i * 2], y1 = c[i * 2 + 1], k = x0 * y1 - x1 * y0;
            a += k; cx += (x0 + x1) * k; cy += (y0 + y1) * k;
        }
        return a ? [[cx / (3 * a), cy / (3 * a), 0, 0]] : [];
    }
    let len = 0;
    for (let i = start + 1; i < end; i++) len += Math.hypot(c[i * 2] - c[i * 2 - 2], c[i * 2 + 1] - c[i * 2 - 1]);
    if (!len) return [];
    const at = (d: number): [number, number] => {
        for (let i = start + 1; i < end; i++) {
            const seg = Math.hypot(c[i * 2] - c[i * 2 - 2], c[i * 2 + 1] - c[i * 2 - 1]);
            if (d <= seg && seg) { const t = d / seg; return [c[i * 2 - 2] + (c[i * 2] - c[i * 2 - 2]) * t, c[i * 2 - 1] + (c[i * 2 + 1] - c[i * 2 - 1]) * t]; }
            d -= seg;
        }
        return [c[end * 2 - 2], c[end * 2 - 1]];
    };
    // Named lines always get one label; icon-only symbols (one-way arrows) need a reasonable run of line.
    let n = along ? Math.floor(len / spacing) : 1;
    if (!n) { if (!hasText && len < spacing / 4) return []; n = 1; }
    const out: number[][] = [];
    for (let i = 0; i < n; i++) {
        const d = (i + 0.5) / n * len, span = Math.min(d, len - d, 250);
        const [x, y] = at(d), [ax, ay] = at(d - span), [bx, by] = at(d + span);
        const anchor = [x, y, Math.atan2(by - ay, bx - ax), len];
        if (along && window > 0) {
            // The stretch of line around the anchor, for text that follows the curve: its points, then the index of the anchor among them.
            const d0 = Math.max(0, d - window), d1 = Math.min(len, d + window), path = [...at(d0)];
            let run = 0, index = -1;
            for (let k = start + 1; k < end; k++) {
                const before = run;
                run += Math.hypot(c[k * 2] - c[k * 2 - 2], c[k * 2 + 1] - c[k * 2 - 1]);
                if (index < 0 && d <= run && d >= before) { index = path.length / 2; path.push(x, y); }
                if (run > d0 && run < d1 && run !== d) path.push(c[k * 2], c[k * 2 + 1]);
            }
            if (index < 0) { index = path.length / 2; path.push(x, y); }
            path.push(...at(d1));
            anchor.push(index, ...path.map(Math.round));
        }
        out.push(anchor);
    }
    return out;
}

function ringArea(c: Int16Array, start: number, end: number) {
    let a = 0;
    for (let i = start, j = end - 1; i < end; j = i++) a += (c[j * 2] - c[i * 2]) * (c[i * 2 + 1] + c[j * 2 + 1]);
    return a;
}

/** `text-overlap` / `icon-overlap` ('never', 'always', 'cooperative') take precedence over the older allow-overlap flags. */
const overlaps = (mode: string, allow: unknown) => mode ? mode !== 'never' : !!allow;

/** `text-justify` as a number; `auto` follows the side the text is anchored on. */
function justification(justify: string, anchor: string): number {
    const side = justify === 'auto' ? anchor : justify;
    return side.includes('left') ? -1 : side.includes('right') ? 1 : 0;
}

/** Expands a neutral batch into vertex and index buffers for the GPU. */
export function tessellate(b: Batch): GLBatch | null {
    const {coords, ringEnds, featEnds} = b.geom;
    if (b.type === 'circle') {
        // Four vertices per point (position plus which corner), drawn as ordinary indexed triangles. Instancing would
        // be more compact but is many times slower on software renderers.
        const n = ringEnds.length, pos = new Int16Array(n * 16), idx = new Uint32Array(n * 6);
        const color = b.color ? new Uint8Array(n * 16) : undefined, radius = b.radius ? new Float32Array(n * 4) : undefined;
        for (let f = 0, r = 0; f < featEnds.length; f++) {
            for (; r < featEnds[f]; r++) {
                const i = ringEnds[r] - 1;
                for (let k = 0; k < 4; k++) {
                    pos.set([coords[i * 2], coords[i * 2 + 1], k & 1 ? 1 : -1, k & 2 ? 1 : -1], (r * 4 + k) * 4);
                    if (color) color.set(b.color!.subarray(f * 4, f * 4 + 4), (r * 4 + k) * 4);
                    if (radius) radius[r * 4 + k] = b.radius![f];
                }
                idx.set([r * 4, r * 4 + 1, r * 4 + 2, r * 4 + 1, r * 4 + 3, r * 4 + 2], r * 6);
            }
        }
        return {type: 'circle', pos, idx, color, radius};
    }
    const idx: number[] = [];
    if (b.type === 'fill') {
        if (b.height) return tessellateExtrusion(b);
        const color = b.color ? new Uint8Array(coords.length * 2) : undefined;
        for (let f = 0; f < featEnds.length; f++) {
            eachPolygon(b.geom, f, (p0, p1, holes) => {
                const tris = earcut(coords.subarray(p0 * 2, p1 * 2) as any, holes);
                for (let i = 0; i < tris.length; i++) idx.push(tris[i] + p0);
                if (color) for (let i = p0; i < p1; i++) color.set(b.color!.subarray(f * 4, f * 4 + 4), i * 4);
            });
        }
        if (!idx.length) return null;
        // Without multisampling, triangle edges are jagged; a one-pixel line along every polygon edge smooths them
        // (and carries the outline colour when the style sets one). Edges created by clipping at the tile border are skipped.
        let edges: Uint32Array | undefined;
        if (b.antialias !== false || b.outline) {
            const list: number[] = [], out = (i: number, j: number, k: number) => (coords[i * 2 + k] <= 0 && coords[j * 2 + k] <= 0) || (coords[i * 2 + k] >= EXTENT && coords[j * 2 + k] >= EXTENT);
            for (let r = 0; r < ringEnds.length; r++) {
                const s = r ? ringEnds[r - 1] : 0, e = ringEnds[r];
                for (let i = s, j = e - 1; i < e; j = i++) if (!out(i, j, 0) && !out(i, j, 1)) list.push(j, i);
            }
            edges = Uint32Array.from(list);
        }
        return {type: 'fill', pos: coords, idx: Uint32Array.from(idx), color, edges};
    }

    return tessellateLine(b);
}

/**
 * Splits a feature's rings into polygons (an outer ring followed by its holes) and reports each as a point range
 * plus hole offsets, the form earcut wants. Ring direction relative to the first ring tells outers from holes.
 */
function eachPolygon(g: Geom, f: number, cb: (p0: number, p1: number, holes: number[]) => void) {
    const {coords, ringEnds, featEnds} = g, first = f ? featEnds[f - 1] : 0, last = featEnds[f];
    let polyStart = first, outerSign = 0;
    const flush = (endRing: number) => {
        if (endRing <= polyStart) return;
        const p0 = polyStart ? ringEnds[polyStart - 1] : 0, holes: number[] = [];
        for (let h = polyStart; h < endRing - 1; h++) holes.push(ringEnds[h] - p0);
        cb(p0, ringEnds[endRing - 1], holes);
    };
    for (let r = first; r < last; r++) {
        const area = ringArea(coords, r ? ringEnds[r - 1] : 0, ringEnds[r]);
        if (!area) continue;
        const sign = area > 0 ? 1 : -1;
        if (!outerSign) outerSign = sign;
        if (sign === outerSign && r > polyStart) { flush(r); polyStart = r; }
    }
    flush(last);
}

/** Buildings: a roof at the feature's height and a wall under every edge, each vertex carrying a baked light level. */
function tessellateExtrusion(b: Batch): GLBatch | null {
    const {coords, featEnds} = b.geom, v: number[] = [], idx: number[] = [], color: number[] = [];
    let count = 0;
    for (let f = 0; f < featEnds.length; f++) {
        const top = b.height![f], bottom = Math.min(b.base ? b.base[f] : 0, top);
        const vert = (x: number, y: number, z: number, light: number) => {
            v.push(x, y, z, light);
            if (b.color) color.push(b.color[f * 4], b.color[f * 4 + 1], b.color[f * 4 + 2], b.color[f * 4 + 3]);
            return count++;
        };
        eachPolygon(b.geom, f, (p0, p1, holes) => {
            const roof = count, tris = earcut(coords.subarray(p0 * 2, p1 * 2) as any, holes);
            for (let i = p0; i < p1; i++) vert(coords[i * 2], coords[i * 2 + 1], top, 1);
            for (let i = 0; i < tris.length; i++) idx.push(roof + tris[i]);
            if (top <= bottom) return;
            const bounds = [0, ...holes, p1 - p0];
            for (let r = 0; r + 1 < bounds.length; r++) {
                const s = p0 + bounds[r], e = p0 + bounds[r + 1];
                for (let i = s, j = e - 1; i < e; j = i++) {
                    const ax = coords[j * 2], ay = coords[j * 2 + 1], bx = coords[i * 2], by = coords[i * 2 + 1], len = Math.hypot(bx - ax, by - ay);
                    if (!len) continue;
                    // Walls facing the light (from the north-west) are brighter; all are darker towards the ground.
                    const light = 0.6 + 0.28 * Math.abs(((by - ay) * -0.6 - (bx - ax) * 0.8) / len);
                    const q = vert(ax, ay, bottom, light * 0.9);
                    vert(bx, by, bottom, light * 0.9); vert(bx, by, top, light); vert(ax, ay, top, light);
                    idx.push(q, q + 1, q + 2, q, q + 2, q + 3);
                }
            }
        });
    }
    if (!idx.length) return null;
    const out: GLBatch = {type: 'extrusion', v: Float32Array.from(v), idx: Uint32Array.from(idx)};
    if (b.color) out.color = Uint8Array.from(color);
    return out;
}

const ARC_STEP = Math.PI / 5;

/**
 * Lines: each vertex becomes a pair extruded along its normal in the vertex shader. Vertex layout is
 * x, y, normalX, normalY, side (-1..1 across the line, for edge antialiasing), distance along the line (for dashes).
 */
/**
 * A line vertex is 16 bytes: position x, y (int16, tile units); the direction to push it sideways (int16, times
 * LINE_NORMAL; it is longer than 1 at a mitred corner); which side of the line it is on (int16: -1, 0, 1); two unused
 * bytes; and the distance along the line (float32, for dashes).
 */
export const LINE_VERTEX = 16, LINE_NORMAL = 8192;

function tessellateLine(b: Batch): GLBatch | null {
    const {coords, ringEnds, featEnds} = b.geom;
    const v: number[] = [], idx: number[] = [], color: number[] = [], width: number[] = [];
    const round = b.join === 'round', miter = !round && b.join !== 'bevel';
    let count = 0, f = 0;
    const vert = (x: number, y: number, nx: number, ny: number, side: number, dist: number) => {
        v.push(x, y, nx, ny, side, dist);
        if (b.color) color.push(b.color[f * 4], b.color[f * 4 + 1], b.color[f * 4 + 2], b.color[f * 4 + 3]);
        if (b.width) width.push(b.width[f]);
        return count++;
    };
    /** A fan around (x, y) sweeping `sweep` radians from angle `from`: used for round joins and caps. */
    const fan = (x: number, y: number, from: number, sweep: number, dist: number) => {
        const steps = Math.max(1, Math.ceil(Math.abs(sweep) / ARC_STEP)), centre = vert(x, y, 0, 0, 0, dist);
        let prev = vert(x, y, Math.cos(from), Math.sin(from), 1, dist);
        for (let k = 1; k <= steps; k++) {
            const a = from + sweep * k / steps, cur = vert(x, y, Math.cos(a), Math.sin(a), 1, dist);
            idx.push(centre, prev, cur);
            prev = cur;
        }
    };
    for (let r = 0; f < featEnds.length; f++) {
        for (; r < featEnds[f]; r++) {
            // Drop repeated points, then walk the segments.
            const xs: number[] = [], ys: number[] = [];
            for (let i = r ? ringEnds[r - 1] : 0; i < ringEnds[r]; i++) {
                const x = coords[i * 2], y = coords[i * 2 + 1], n = xs.length;
                if (!n || x !== xs[n - 1] || y !== ys[n - 1]) { xs.push(x); ys.push(y); }
            }
            const n = xs.length;
            if (n < 2) continue;
            let last = -1, dist = 0, pdx = 0, pdy = 0;
            const pair = (x: number, y: number, nx: number, ny: number, ox = 0, oy = 0) => {
                const a = vert(x, y, nx + ox, ny + oy, 1, dist);
                vert(x, y, -nx + ox, -ny + oy, -1, dist);
                if (last >= 0) idx.push(last, last + 1, a, last + 1, a + 1, a);
                last = a;
            };
            for (let i = 0; i < n - 1; i++) {
                const x = xs[i], y = ys[i], ex = xs[i + 1] - x, ey = ys[i + 1] - y, len = Math.hypot(ex, ey);
                const dx = ex / len, dy = ey / len, nx = -dy, ny = dx;
                if (i === 0) {
                    if (b.cap === 'round') fan(x, y, Math.atan2(ny, nx), Math.PI, dist);
                    pair(x, y, nx, ny, ...(b.cap === 'square' ? [-dx, -dy] : [0, 0]));
                } else {
                    const pnx = -pdy, pny = pdx, mx = pnx + nx, my = pny + ny, ml = Math.hypot(mx, my);
                    const cos = ml ? (mx * pnx + my * pny) / ml : 0;
                    if (cos > (miter ? 0.5 : 0.98)) pair(x, y, mx / (ml * cos), my / (ml * cos));
                    else {
                        // Two pairs at the corner give a bevel; a fan on the outer side rounds it off.
                        pair(x, y, pnx, pny);
                        if (round) {
                            const outer = pnx * dx + pny * dy < 0 ? 1 : -1, a0 = Math.atan2(outer * pny, outer * pnx);
                            let sweep = Math.atan2(outer * ny, outer * nx) - a0;
                            if (sweep > Math.PI) sweep -= 2 * Math.PI; else if (sweep < -Math.PI) sweep += 2 * Math.PI;
                            fan(x, y, a0, sweep, dist);
                        }
                        pair(x, y, nx, ny);
                    }
                }
                dist += len;
                pdx = dx; pdy = dy;
                if (i === n - 2) {
                    const px = xs[n - 1], py = ys[n - 1];
                    pair(px, py, nx, ny, ...(b.cap === 'square' ? [dx, dy] : [0, 0]));
                    if (b.cap === 'round') fan(px, py, Math.atan2(ny, nx), -Math.PI, dist);
                }
            }
        }
    }
    if (!idx.length) return null;
    // Packed to 16 bytes a vertex (it was 24 as plain floats): lines are most of a tile, and every byte is uploaded.
    const packed = new ArrayBuffer(count * LINE_VERTEX), view = new DataView(packed);
    for (let i = 0, o = 0; i < count; i++, o += LINE_VERTEX) {
        view.setInt16(o, Math.round(v[i * 6]), true); view.setInt16(o + 2, Math.round(v[i * 6 + 1]), true);
        view.setInt16(o + 4, Math.round(v[i * 6 + 2] * LINE_NORMAL), true); view.setInt16(o + 6, Math.round(v[i * 6 + 3] * LINE_NORMAL), true);
        view.setInt16(o + 8, v[i * 6 + 4], true);
        view.setFloat32(o + 12, v[i * 6 + 5], true);
    }
    const out: GLBatch = {type: 'line', v: new Uint8Array(packed), idx: Uint32Array.from(idx)};
    if (b.color) out.color = Uint8Array.from(color);
    if (b.width) out.width = Float32Array.from(width);
    return out;
}

export function toGL(ir: TileIR): {tile: TileGL; transfer: ArrayBuffer[]} {
    const tile: TileGL = {layers: {}, labels: ir.labels}, transfer = new Set<ArrayBuffer>();
    for (const id in ir.layers) {
        const b = ir.layers[id];
        const g = tessellate(b);
        if (!g) continue;
        tile.layers[id] = g;
        for (const a of Object.values(g)) if (ArrayBuffer.isView(a)) transfer.add(a.buffer as ArrayBuffer);
    }
    return {tile, transfer: [...transfer]};
}
