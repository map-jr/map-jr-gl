import {EXTENT, mercX, mercY} from './geo.ts';

/**
 * GeoJSON as a tile source. The data is projected once, then cut into tiles on demand with the same feature
 * interface the vector-tile decoder exposes, so everything downstream (styling, labels, queries) is shared.
 */
export const GEOJSON_PREFIX = 'geojson://';
export const GEOJSON_LAYER = '_geojson';
const BUFFER = 128;

interface Prepared {
    type: 1 | 2 | 3; id?: number; properties: Record<string, unknown>;
    /** Rings or lines as flat mercator coordinates in 0..1. */
    rings: Float64Array[];
    bbox: [number, number, number, number];
}
export interface SlicedFeature {
    type: number; id?: number; properties: Record<string, any>;
    geometry(extent: number, coords: number[], ringEnds: number[]): number;
}

export function prepareGeoJSON(data: any): Prepared[] {
    const out: Prepared[] = [];
    const features = !data ? [] : data.type === 'FeatureCollection' ? data.features : data.type === 'Feature' ? [data] : [{type: 'Feature', geometry: data, properties: {}}];
    const ring = (pts: number[][]) => {
        const r = new Float64Array(pts.length * 2);
        pts.forEach((p, i) => { r[i * 2] = mercX(p[0]); r[i * 2 + 1] = mercY(Math.max(-85.051129, Math.min(85.051129, p[1]))); });
        return r;
    };
    const add = (f: any, type: 1 | 2 | 3, rings: Float64Array[]) => {
        const bbox: Prepared['bbox'] = [Infinity, Infinity, -Infinity, -Infinity];
        for (const r of rings) for (let i = 0; i < r.length; i += 2) {
            bbox[0] = Math.min(bbox[0], r[i]); bbox[1] = Math.min(bbox[1], r[i + 1]); bbox[2] = Math.max(bbox[2], r[i]); bbox[3] = Math.max(bbox[3], r[i + 1]);
        }
        if (rings.length) out.push({type, id: typeof f.id === 'number' ? f.id : undefined, properties: f.properties ?? {}, rings, bbox});
    };
    const walk = (f: any, g: any) => {
        if (!g) return;
        const c = g.coordinates;
        switch (g.type) {
            case 'Point': add(f, 1, [ring([c])]); break;
            case 'MultiPoint': add(f, 1, c.map((p: number[]) => ring([p]))); break;
            case 'LineString': add(f, 2, [ring(c)]); break;
            case 'MultiLineString': add(f, 2, c.map(ring)); break;
            // Closing points are dropped: rings are implicitly closed, as in vector tiles.
            case 'Polygon': add(f, 3, c.map((r: number[][]) => ring(r.slice(0, -1)))); break;
            case 'MultiPolygon': add(f, 3, c.flat().map((r: number[][]) => ring(r.slice(0, -1)))); break;
            case 'GeometryCollection': for (const part of g.geometries) walk(f, part); break;
        }
    };
    for (const f of features) walk(f, f.geometry);
    return out;
}

/** Clips a polygon ring to a rectangle (Sutherland-Hodgman). */
function clipRing(pts: number[], lo: number, hi: number): number[] {
    for (const [axis, bound, keepBelow] of [[0, lo, false], [0, hi, true], [1, lo, false], [1, hi, true]] as const) {
        const out: number[] = [], n = pts.length / 2;
        const inside = (i: number) => keepBelow ? pts[i * 2 + axis] <= bound : pts[i * 2 + axis] >= bound;
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const a = inside(j), b = inside(i);
            if (a !== b) {
                const t = (bound - pts[j * 2 + axis]) / (pts[i * 2 + axis] - pts[j * 2 + axis]);
                out.push(pts[j * 2] + (pts[i * 2] - pts[j * 2]) * t, pts[j * 2 + 1] + (pts[i * 2 + 1] - pts[j * 2 + 1]) * t);
            }
            if (b) out.push(pts[i * 2], pts[i * 2 + 1]);
        }
        pts = out;
        if (!pts.length) break;
    }
    return pts;
}

/** Clips a line to a rectangle, returning the pieces that fall inside. */
function clipLine(pts: number[], lo: number, hi: number, ranges?: number[]): number[][] {
    const pieces: number[][] = [];
    let cur: number[] = [], from = 0, to = 0, done = 0;
    /** Ends a piece; `ranges` receives the distances along the whole line where it starts and ends. */
    const push = () => { pieces.push(cur); ranges?.push(from, to); cur = []; };
    for (let i = 0; i + 3 < pts.length; i += 2) {
        let x0 = pts[i], y0 = pts[i + 1], x1 = pts[i + 2], y1 = pts[i + 3], t0 = 0, t1 = 1;
        const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), before = done;
        done += len;
        let visible = true;
        // Liang-Barsky: narrow the visible parameter range against each edge.
        for (const [p, q] of [[-dx, x0 - lo], [dx, hi - x0], [-dy, y0 - lo], [dy, hi - y0]]) {
            if (p === 0) { if (q < 0) visible = false; } else {
                const r = q / p;
                if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
            }
        }
        if (!visible || t0 > t1) { if (cur.length) push(); continue; }
        const ax = x0 + dx * t0, ay = y0 + dy * t0, bx = x0 + dx * t1, by = y0 + dy * t1;
        if (!cur.length || t0 > 0) { if (cur.length) push(); cur = [ax, ay]; from = before + len * t0; }
        cur.push(bx, by);
        to = before + len * t1;
        if (t1 < 1) push();
    }
    if (cur.length) push();
    return pieces;
}

/** The features of one tile, clipped and in tile units. */
export function sliceGeoJSON(features: Prepared[], z: number, x: number, y: number, metrics = false): Record<string, {features: SlicedFeature[]}> {
    const n = 2 ** z, pad = BUFFER / EXTENT / n, x0 = x / n - pad, y0 = y / n - pad, x1 = (x + 1) / n + pad, y1 = (y + 1) / n + pad;
    const out: SlicedFeature[] = [];
    for (const f of features) {
        if (f.bbox[2] < x0 || f.bbox[0] > x1 || f.bbox[3] < y0 || f.bbox[1] > y1) continue;
        const rings: number[][] = [];
        const feature = (rings: number[][], properties: Record<string, unknown>) => out.push({
            type: f.type, id: f.id, properties,
            geometry(extent, coords, ringEnds) {
                const k = extent / EXTENT;
                for (const r of rings) { for (const v of r) coords.push(v * k); ringEnds.push(coords.length / 2); }
                return rings.length;
            },
        });
        for (const r of f.rings) {
            let pts: number[] = [];
            for (let i = 0; i < r.length; i += 2) {
                const tx = Math.round((r[i] * n - x) * EXTENT), ty = Math.round((r[i + 1] * n - y) * EXTENT), m = pts.length;
                if (m < 2 || tx !== pts[m - 2] || ty !== pts[m - 1]) pts.push(tx, ty); // also thins vertices closer than a tile unit
            }
            if (f.type === 2 && metrics) {
                // Each piece is a feature of its own that knows which part of the line it is, as in MapLibre.
                const ranges: number[] = [], pieces = clipLine(pts, -BUFFER, EXTENT + BUFFER, ranges);
                let total = 0;
                for (let i = 0; i + 3 < pts.length; i += 2) total += Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
                pieces.forEach((p, i) => feature([p], {...f.properties, mapbox_clip_start: ranges[i * 2] / total, mapbox_clip_end: ranges[i * 2 + 1] / total}));
                continue;
            }
            if (f.type === 1) { if (pts[0] >= -BUFFER && pts[0] <= EXTENT + BUFFER && pts[1] >= -BUFFER && pts[1] <= EXTENT + BUFFER) rings.push(pts); } else if (f.type === 2) rings.push(...clipLine(pts, -BUFFER, EXTENT + BUFFER).filter(p => p.length >= 4));
            else { pts = clipRing(pts, -BUFFER, EXTENT + BUFFER); if (pts.length >= 6) rings.push(pts.map(Math.round)); }
        }
        if (!rings.length) continue;
        feature(rings, f.properties);
    }
    return out.length ? {[GEOJSON_LAYER]: {features: out}} : {};
}
