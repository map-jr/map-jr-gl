import earcut from 'earcut';
import {EXTENT} from './geo.ts';
import {decodeVectorTile, type VTFeature} from './mvt.ts';
import type {CompiledLayer} from './style.ts';
import type {Feature, RGBA} from './expr.ts';

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
}
export interface LabelSrc {
    x: number; y: number; text: string;
    /** Direction of the line at the anchor in tile space (radians), or null for point labels. */
    angle: number | null;
    /** Length of the line the label sits on, in tile units. */
    len: number;
    size0: number; size1: number; color: RGBA; halo: RGBA; haloWidth: number;
    font: string; maxWidth: number; spacing: number; offset: [number, number]; anchor: string; padding: number; overlap: boolean;
}
export interface TileIR { layers: Record<string, Batch>; labels: Record<string, LabelSrc[]> }

export type GLBatch =
    | {type: 'fill'; pos: Int16Array; idx: Uint32Array; color?: Uint8Array}
    | {type: 'line'; v: Float32Array; idx: Uint32Array; color?: Uint8Array; width?: Float32Array}
    | {type: 'circle'; pos: Int16Array; color?: Uint8Array; radius?: Float32Array};
export interface TileGL { layers: Record<string, GLBatch>; labels: Record<string, LabelSrc[]> }

/** "Noto Sans Bold Italic" -> "italic 700". The family is supplied by the host so fonts stay consistent per app. */
function fontStyle(names: any): string {
    const n = String(Array.isArray(names) ? names[0] : names).toLowerCase();
    const weight = /black|heavy/.test(n) ? 900 : /extra ?bold/.test(n) ? 800 : /semi ?bold|demi/.test(n) ? 600 : /bold/.test(n) ? 700 :
        /medium/.test(n) ? 500 : /light/.test(n) ? 300 : 400;
    return (/italic|oblique/.test(n) ? 'italic ' : '') + weight;
}

function pushColor(out: number[], c: RGBA, alpha: number) {
    out.push(Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255), Math.round(c[3] * alpha * 255));
}

const WHITE: RGBA = [1, 1, 1, 1];

export function buildTile(bytes: Uint8Array, z: number, layers: CompiledLayer[], overscaled: boolean): TileIR {
    const vt = decodeVectorTile(bytes);
    const geomCache = new Map<VTFeature, {coords: number[]; ringEnds: number[]}>();
    const geometry = (f: VTFeature) => {
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
        const vl = vt[L.sourceLayer!];
        if (!vl) continue;
        const p = L.p;

        if (L.type === 'symbol') {
            const labels: LabelSrc[] = [];
            for (const f of vl.features) {
                ctx.f = f;
                if (L.filter && !L.filter(ctx)) continue;
                let text = p.field.eval(z, f);
                if (text === null || text === undefined || text === '') continue;
                text = String(text).replace(/\{([^}]+)\}/g, (_, k) => f.properties[k] ?? '').trim();
                if (!text) continue;
                const tt = p.transform.eval(z, f);
                if (tt === 'uppercase') text = text.toUpperCase(); else if (tt === 'lowercase') text = text.toLowerCase();
                const color = p.color.eval(z, f) as RGBA, op = p.opacity.eval(z, f);
                const base = {
                    text, size0: p.size.eval(z, f), size1: p.size.eval(z + 1, f),
                    color: [color[0], color[1], color[2], color[3] * op] as RGBA,
                    halo: p.haloColor.eval(z, f), haloWidth: p.haloWidth.eval(z, f), font: fontStyle(p.font.eval(z, f)),
                    maxWidth: p.maxWidth.eval(z, f), spacing: p.spacing.eval(z, f), offset: p.offset.eval(z, f), anchor: p.anchor.eval(z, f),
                    padding: p.padding.eval(z, f), overlap: !!p.overlap.eval(z, f),
                };
                const g = geometry(f), along = p.placement.eval(z, f) !== 'point';
                let start = 0;
                for (const end of g.ringEnds) {
                    for (const a of anchors(g.coords, start, end, f.type, along)) {
                        if (a[0] >= 0 && a[0] < EXTENT && a[1] >= 0 && a[1] < EXTENT) labels.push({...base, x: a[0], y: a[1], angle: along ? a[2] : null, len: a[3]});
                    }
                    start = end;
                    if (f.type === 3 && !along) break; // one label per polygon: outer ring only
                }
            }
            if (labels.length) out.labels[L.id] = labels;
            continue;
        }

        const want = L.type === 'fill' ? 3 : L.type === 'circle' ? 1 : 0;
        const coords: number[] = [], ringEnds: number[] = [], featEnds: number[] = [];
        const ddColor = p.color.dd || p.opacity.dd;
        const color: number[] = [], scalar: number[] = [];
        const scalarProp = L.type === 'line' ? p.width : L.type === 'circle' ? p.radius : null;
        for (const f of vl.features) {
            if (want ? f.type !== want : f.type === 1) continue;
            ctx.f = f;
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
        }
        if (!featEnds.length) continue;
        const batch: Batch = {
            type: L.type as Batch['type'],
            geom: {coords: Int16Array.from(coords), ringEnds: Uint32Array.from(ringEnds), featEnds: Uint32Array.from(featEnds)},
        };
        if (ddColor) batch.color = Uint8Array.from(color);
        if (scalarProp?.dd) batch[L.type === 'line' ? 'width' : 'radius'] = Float32Array.from(scalar);
        out.layers[L.id] = batch;
    }
    return out;
}

/** Yields [x, y, angle, length] label anchors for one ring. */
function anchors(c: number[], start: number, end: number, type: number, along: boolean): number[][] {
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
    const n = along ? Math.max(1, Math.floor(len / 2500)) : 1, out: number[][] = [];
    for (let i = 0; i < n; i++) {
        const d = (i + 0.5) / n * len, span = Math.min(d, len - d, 250);
        const [x, y] = at(d), [ax, ay] = at(d - span), [bx, by] = at(d + span);
        out.push([x, y, Math.atan2(by - ay, bx - ax), len]);
    }
    return out;
}

function ringArea(c: Int16Array, start: number, end: number) {
    let a = 0;
    for (let i = start, j = end - 1; i < end; j = i++) a += (c[j * 2] - c[i * 2]) * (c[i * 2 + 1] + c[j * 2 + 1]);
    return a;
}

/** Expands a neutral batch into vertex and index buffers for the GPU. */
export function tessellate(b: Batch): GLBatch | null {
    const {coords, ringEnds, featEnds} = b.geom;
    if (b.type === 'circle') {
        const out: GLBatch = {type: 'circle', pos: coords};
        // Each point is its own ring, so per-feature values are repeated per ring.
        const expand = <T extends Uint8Array | Float32Array>(src: T, size: number): T => {
            const dst = new (src.constructor as any)(ringEnds.length * size) as T;
            for (let f = 0, r = 0; f < featEnds.length; f++) for (; r < featEnds[f]; r++) for (let k = 0; k < size; k++) dst[r * size + k] = src[f * size + k];
            return dst;
        };
        if (b.color) out.color = expand(b.color, 4);
        if (b.radius) out.radius = expand(b.radius, 1);
        return out;
    }
    const idx: number[] = [];
    if (b.type === 'fill') {
        const color = b.color ? new Uint8Array(coords.length * 2) : undefined;
        for (let f = 0, r = 0; f < featEnds.length; f++) {
            const first = r;
            let polyStart = r, outerSign = 0;
            const flush = (endRing: number) => {
                if (endRing <= polyStart) return;
                const p0 = polyStart ? ringEnds[polyStart - 1] : 0, p1 = ringEnds[endRing - 1];
                const holes: number[] = [];
                for (let h = polyStart; h < endRing - 1; h++) holes.push(ringEnds[h] - p0);
                const tris = earcut(coords.subarray(p0 * 2, p1 * 2) as any, holes);
                for (let i = 0; i < tris.length; i++) idx.push(tris[i] + p0);
            };
            for (; r < featEnds[f]; r++) {
                const area = ringArea(coords, r ? ringEnds[r - 1] : 0, ringEnds[r]);
                if (!area) continue;
                const sign = area > 0 ? 1 : -1;
                if (r === first || !outerSign) outerSign = sign;
                if (sign === outerSign && r > polyStart) { flush(r); polyStart = r; }
            }
            flush(r);
            if (color) {
                const p0 = first ? ringEnds[first - 1] : 0, p1 = r ? ringEnds[r - 1] : 0;
                for (let i = p0; i < p1; i++) color.set(b.color!.subarray(f * 4, f * 4 + 4), i * 4);
            }
        }
        if (!idx.length) return null;
        return {type: 'fill', pos: coords, idx: Uint32Array.from(idx), color};
    }

    // Lines: each vertex becomes a pair extruded along the (miter-scaled) normal in the vertex shader.
    const v: number[] = [], color: number[] = [], width: number[] = [];
    let pairs = 0;
    for (let f = 0, r = 0; f < featEnds.length; f++) {
        const pair = (x: number, y: number, nx: number, ny: number) => {
            v.push(x, y, nx, ny, 1, x, y, -nx, -ny, -1);
            if (b.color) for (let k = 0; k < 2; k++) color.push(b.color[f * 4], b.color[f * 4 + 1], b.color[f * 4 + 2], b.color[f * 4 + 3]);
            if (b.width) width.push(b.width[f], b.width[f]);
            return pairs++;
        };
        for (; r < featEnds[f]; r++) {
            const s = r ? ringEnds[r - 1] : 0, e = ringEnds[r];
            let last = -1, px = 0, py = 0, pnx = 0, pny = 0, has = false;
            const link = (p: number) => {
                if (last >= 0) idx.push(last * 2, last * 2 + 1, p * 2, last * 2 + 1, p * 2 + 1, p * 2);
                last = p;
            };
            for (let i = s; i < e; i++) {
                const x = coords[i * 2], y = coords[i * 2 + 1];
                if (i === s) { px = x; py = y; continue; }
                const dx = x - px, dy = y - py, l = Math.hypot(dx, dy);
                if (!l) continue;
                const nx = -dy / l, ny = dx / l;
                if (!has) link(pair(px, py, nx, ny));
                else {
                    const mx = pnx + nx, my = pny + ny, ml = Math.hypot(mx, my), cos = ml ? (mx * pnx + my * pny) / ml : 0;
                    if (cos > 0.5) link(pair(px, py, mx / (ml * cos), my / (ml * cos)));
                    else { link(pair(px, py, pnx, pny)); link(pair(px, py, nx, ny)); } // sharp turn: bevel
                }
                px = x; py = y; pnx = nx; pny = ny; has = true;
            }
            if (has) link(pair(px, py, pnx, pny));
        }
    }
    if (!idx.length) return null;
    const out: GLBatch = {type: 'line', v: Float32Array.from(v), idx: Uint32Array.from(idx)};
    if (b.color) out.color = Uint8Array.from(color);
    if (b.width) out.width = Float32Array.from(width);
    return out;
}

export function toGL(ir: TileIR): {tile: TileGL; transfer: ArrayBuffer[]} {
    const tile: TileGL = {layers: {}, labels: ir.labels}, transfer = new Set<ArrayBuffer>();
    for (const id in ir.layers) {
        const g = tessellate(ir.layers[id]);
        if (!g) continue;
        tile.layers[id] = g;
        for (const a of Object.values(g)) if (ArrayBuffer.isView(a)) transfer.add(a.buffer as ArrayBuffer);
    }
    return {tile, transfer: [...transfer]};
}
