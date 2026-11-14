import {EXTENT, mercX, mercY} from './geo.ts';
import {compileExpr, compileFilter} from './expr.ts';

/**
 * GeoJSON as a tile source. The data is projected once, then cut into tiles on demand with the same feature
 * interface the vector-tile decoder exposes, so everything downstream (styling, labels, queries) is shared.
 */
export const GEOJSON_PREFIX = 'geojson://';
export const GEOJSON_LAYER = '_geojson';
const BUFFER = 128;

interface Prepared {
    type: 1 | 2 | 3; id?: number | string; properties: Record<string, unknown>;
    /** Rings or lines as flat mercator coordinates in 0..1. */
    rings: Float64Array[];
    bbox: [number, number, number, number];
}
export interface SlicedFeature {
    type: number; id?: number | string; properties: Record<string, any>;
    geometry(extent: number, coords: number[], ringEnds: number[]): number;
}

/** The options of a GeoJSON source that change its features: clusters of points, and which property is the id. */
export interface GeoJSONOptions {
    cluster?: boolean; clusterRadius?: number; clusterMaxZoom?: number; clusterMinPoints?: number;
    /** For each name: how to combine values (an operator or an expression with `accumulated`), and the value of one point. */
    clusterProperties?: Record<string, [unknown, unknown]>;
    promoteId?: string | Record<string, string>;
    /** Only features that pass this filter are in the source. */
    filter?: unknown;
}

interface ClusterNode { x: number; y: number; count: number; id: number; props: Record<string, unknown>; children?: ClusterNode[]; taken: number; leaf?: Prepared }

/**
 * Clusters of the points of a GeoJSON source, for each zoom level. The method is the one of the supercluster
 * library: from the largest zoom down, each point takes its neighbours within the radius into one cluster at their
 * weighted centre. A cluster's id is the same wherever the index is made from the same data.
 */
export class ClusterIndex {
    /** levels[z] holds what a tile of zoom z shows; zooms above `maxZoom` show the points themselves. */
    private levels: Prepared[][] = [];
    private byId = new Map<number, ClusterNode>();
    readonly maxZoom: number;
    private total: number;
    constructor(points: Prepared[], o: GeoJSONOptions, sourceMaxZoom: number) {
        this.maxZoom = Math.min(o.clusterMaxZoom ?? sourceMaxZoom - 1, 24);
        const radius = o.clusterRadius ?? 50, minPoints = o.clusterMinPoints ?? 2;
        const names = Object.keys(o.clusterProperties ?? {});
        const mapFns = names.map(k => compileExpr(o.clusterProperties![k][1] as any, {dd: false, zoom: false}));
        const reduceFns = names.map(k => { const r = o.clusterProperties![k][0]; return compileExpr((typeof r === 'string' ? [r, ['accumulated'], ['get', k]] : r) as any, {dd: false, zoom: false}); });
        let nodes: ClusterNode[] = points.map((p, i) => {
            const props: Record<string, unknown> = {};
            names.forEach((k, n) => { props[k] = mapFns[n]({zoom: 0, f: {type: 1, id: p.id, properties: p.properties} as any}); });
            return {x: p.rings[0][0], y: p.rings[0][1], count: 1, id: i, props, taken: Infinity, leaf: p};
        });
        const total = this.total = points.length;
        for (let z = this.maxZoom; z >= 0; z--) {
            const r = radius / (512 * 2 ** z), cells = new Map<number, ClusterNode[]>(), size = Math.ceil(1 / r) + 2;
            const cell = (n: ClusterNode) => Math.floor(n.x / r) + 1 + (Math.floor(n.y / r) + 1) * size;
            for (const n of nodes) { const c = cell(n), list = cells.get(c); if (list) list.push(n); else cells.set(c, [n]); }
            const next: ClusterNode[] = [];
            nodes.forEach((n, i) => {
                if (n.taken <= z) return;
                n.taken = z;
                const near: ClusterNode[] = [], c = cell(n);
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const m of cells.get(c + dx + dy * size) ?? []) {
                    if (m !== n && m.taken > z && (m.x - n.x) ** 2 + (m.y - n.y) ** 2 <= r * r) near.push(m);
                }
                const count = near.reduce((sum, m) => sum + m.count, n.count);
                if (near.length && count >= minPoints) {
                    let x = n.x * n.count, y = n.y * n.count;
                    const props = {...n.props};
                    for (const m of near) {
                        m.taken = z; x += m.x * m.count; y += m.y * m.count;
                        names.forEach((k, j) => { props[k] = reduceFns[j]({zoom: 0, f: {type: 1, properties: {[k]: m.props[k]}} as any, accumulated: props[k]}); });
                    }
                    const cluster: ClusterNode = {x: x / count, y: y / count, count, id: (i << 5) + (z + 1) + total, props, children: [n, ...near], taken: Infinity};
                    this.byId.set(cluster.id, cluster);
                    next.push(cluster);
                } else next.push(n);
            });
            for (const n of next) n.taken = Infinity;
            nodes = next;
            this.levels[z] = nodes.map(n => this.feature(n));
        }
    }
    private feature(n: ClusterNode): Prepared {
        if (n.leaf) return n.leaf;
        const short = n.count >= 10000 ? Math.round(n.count / 1000) + 'k' : n.count >= 1000 ? Math.round(n.count / 100) / 10 + 'k' : n.count;
        return {type: 1, id: n.id, rings: [Float64Array.of(n.x, n.y)], bbox: [n.x, n.y, n.x, n.y],
            properties: {...n.props, cluster: true, cluster_id: n.id, point_count: n.count, point_count_abbreviated: short}};
    }
    /** The clusters and single points for a zoom level, or null where the points themselves show. */
    at(z: number): Prepared[] | null { return z > this.maxZoom ? null : this.levels[z]; }
    /** The zoom level at which a cluster divides. */
    expansionZoom(id: number): number {
        const n = this.byId.get(id);
        if (!n) throw new Error('No cluster with the specified id.');
        return (id - this.total) & 31; // the id holds the zoom level after the one where the cluster was made
    }
    private toGeoJSON(n: ClusterNode) {
        const f = this.feature(n), lng = n.x * 360 - 180, lat = 360 / Math.PI * Math.atan(Math.exp((180 - n.y * 360) * Math.PI / 180)) - 90;
        return {type: 'Feature', id: f.id, properties: f.properties, geometry: {type: 'Point', coordinates: [lng, lat]}};
    }
    /** The clusters and points that a cluster divides into. */
    children(id: number) {
        const n = this.byId.get(id);
        if (!n) throw new Error('No cluster with the specified id.');
        return n.children!.map(c => this.toGeoJSON(c));
    }
    /** The points of a cluster. As in supercluster, the walk stops only when the result has exactly `limit` points, so -1, 0 and Infinity return all of them. */
    leaves(id: number, limit = 10, offset = 0) {
        const n = this.byId.get(id), out: ClusterNode[] = [];
        if (!n) throw new Error('No cluster with the specified id.');
        let skipped = 0;
        const walk = (m: ClusterNode): boolean => {
            if (m.children) return m.children.some(walk);
            if (skipped < offset) skipped++; else out.push(m);
            return out.length === limit;
        };
        walk(n);
        return out.map(c => this.toGeoJSON(c));
    }
}

/** Features and, with `cluster`, the cluster index of a GeoJSON source. */
export interface PreparedSource { features: Prepared[]; clusters?: ClusterIndex; points?: Prepared[] }
export function prepareSource(data: unknown, o: GeoJSONOptions = {}, sourceMaxZoom = 18): PreparedSource {
    let all = prepareGeoJSON(data, typeof o.promoteId === 'string' ? o.promoteId : undefined);
    const keep = o.filter ? compileFilter(o.filter) : null;
    if (keep) all = all.filter(f => keep({zoom: 0, f: f as any}));
    if (!o.cluster) return {features: all};
    // Clusters are made of single points. Other features stay as they are.
    const points = all.filter(f => f.type === 1 && f.rings.length === 1), rest = all.filter(f => !(f.type === 1 && f.rings.length === 1));
    return {features: rest, points, clusters: new ClusterIndex(points, o, sourceMaxZoom)};
}

export function prepareGeoJSON(data: any, promoteId?: string): Prepared[] {
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
        const id = promoteId ? f.properties?.[promoteId] : f.id;
        if (rings.length) out.push({type, id: typeof id === 'number' || (promoteId && typeof id === 'string') ? id : undefined, properties: f.properties ?? {}, rings, bbox});
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
export function sliceGeoJSON(source: Prepared[] | PreparedSource, z: number, x: number, y: number, metrics = false): Record<string, {features: SlicedFeature[]}> {
    const src = Array.isArray(source) ? {features: source} : source;
    const features = src.clusters ? [...src.features, ...(src.clusters.at(z) ?? src.points!)] : src.features;
    const n = 2 ** z, pad = BUFFER / EXTENT / n, x0 = x / n - pad, y0 = y / n - pad, x1 = (x + 1) / n + pad, y1 = (y + 1) / n + pad;
    const out: SlicedFeature[] = [];
    // A feature past ±180° of longitude is also sliced shifted by one world, as the wrap step of geojson-vt does.
    for (const w of [0, -1, 1]) for (const f of features) {
        if (f.bbox[2] + w < x0 || f.bbox[0] + w > x1 || f.bbox[3] < y0 || f.bbox[1] > y1) continue;
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
                const tx = Math.round(((r[i] + w) * n - x) * EXTENT), ty = Math.round((r[i + 1] * n - y) * EXTENT), m = pts.length;
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
