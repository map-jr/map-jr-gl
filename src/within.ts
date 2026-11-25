/**
 * The expressions `within` and `distance`: a part of the worker that loads on demand (parts.ts, #1707). It follows
 * MapLibre GL JS so that its results agree: it is a close translation, changed, of `within.ts`, `distance.ts` and
 * `geometry_util.ts` of maplibre-style-spec and of cheap-ruler for the distances (see ACKNOWLEDGEMENTS.md). The search of MapLibre GL JS that skips
 * parts of a long geometry by their boxes is left out: each pair of points and segments is compared, which gives the
 * same nearest distance.
 */
import type {Feature} from './expr.ts';

type P = [number, number];
type Ring = P[];
/** The feature as the expression sees it: a TileFeature, whose geometry the part reads. */
type GeoFeature = Feature & {geometry?(extent: number, coords: number[], ringEnds: number[]): number};
/** The tile of the feature: zoom, x, y. */
export type TileId = [number, number, number];

/** The extent of tile coordinates in MapLibre GL JS, which its results depend on through rounding. */
const EXTENT = 8192;

const mercX = (lng: number) => (180 + lng) / 360;
const mercY = (lat: number) => (180 - 180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))) / 360;
/** A position of GeoJSON in coordinates of the world at the zoom of the tile, rounded as MapLibre GL JS rounds it. */
const toWorld = (p: number[], z: number): P => [Math.round(mercX(p[0]) * 2 ** z * EXTENT), Math.round(mercY(p[1]) * 2 ** z * EXTENT)];
const toLngLat = (x: number, y: number, [z, tx, ty]: TileId): P => {
    const n = 2 ** z, mx = (x / EXTENT + tx) / n, my = (y / EXTENT + ty) / n;
    return [mx * 360 - 180, 360 / Math.PI * Math.atan(Math.exp((180 - my * 360) * Math.PI / 180)) - 90];
};

/** The rings of the feature in tile coordinates of extent 8192. */
function rings(f: GeoFeature): Ring[] {
    const coords: number[] = [], ends: number[] = [], out: Ring[] = [];
    f.geometry?.(EXTENT, coords, ends);
    let start = 0;
    for (const end of ends) { const r: Ring = []; for (let i = start; i < end; i++) r.push([coords[2 * i], coords[2 * i + 1]]); out.push(r); start = end; }
    return out;
}

type Box = [number, number, number, number];
const box = (): Box => [Infinity, Infinity, -Infinity, -Infinity];
const grow = (b: Box, p: P) => { b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); };
const boxInBox = (a: Box, b: Box) => a[0] > b[0] && a[2] < b[2] && a[1] > b[1] && a[3] < b[3];

const onEdge = (p: P, a: P, b: P) => {
    const x1 = p[0] - a[0], y1 = p[1] - a[1], x2 = p[0] - b[0], y2 = p[1] - b[1];
    return x1 * y2 - x2 * y1 === 0 && x1 * x2 <= 0 && y1 * y2 <= 0;
};
/** Ray casting. A point on an edge gives `edge`. */
function inPolygon(p: P, polygon: Ring[], edge = false): boolean {
    let inside = false;
    for (const r of polygon) for (let j = 0; j < r.length - 1; j++) {
        const a = r[j], b = r[j + 1];
        if (onEdge(p, a, b)) return edge;
        if (a[1] > p[1] !== b[1] > p[1] && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
}
/** Whether p and q are on different sides of the line through a and b. */
const sides = (p: P, q: P, a: P, b: P) => {
    const x3 = b[0] - a[0], y3 = b[1] - a[1], d1 = (p[0] - a[0]) * y3 - x3 * (p[1] - a[1]), d2 = (q[0] - a[0]) * y3 - x3 * (q[1] - a[1]);
    return d1 > 0 && d2 < 0 || d1 < 0 && d2 > 0;
};
/** Whether segment ab crosses segment cd (parallel segments do not). */
const crosses = (a: P, b: P, c: P, d: P) =>
    (d[0] - c[0]) * (b[1] - a[1]) - (d[1] - c[1]) * (b[0] - a[0]) !== 0 && sides(a, b, c, d) && sides(c, d, a, b);
function lineInPolygon(line: Ring, polygon: Ring[]): boolean {
    for (const p of line) if (!inPolygon(p, polygon)) return false;
    for (let i = 0; i < line.length - 1; i++) for (const r of polygon) for (let j = 0; j < r.length - 1; j++) if (crosses(line[i], line[i + 1], r[j], r[j + 1])) return false;
    return true;
}

/** The polygons of the GeoJSON of `within`, or null when it has none. */
function polygonsOf(g: any): number[][][][] | null {
    const out: number[][][][] = [];
    const add = (x: any) => { if (x?.type === 'Polygon') out.push(x.coordinates); else if (x?.type === 'MultiPolygon') out.push(...x.coordinates); };
    if (g?.type === 'FeatureCollection') for (const f of g.features ?? []) add(f?.geometry);
    else add(g?.type === 'Feature' ? g.geometry : g);
    return out.length && out.every(p => Array.isArray(p)) ? out : null;
}

/** Moves a point by one world toward the box of the polygons, as MapLibre GL JS does across the antimeridian. */
function shift(p: P, poly: Box, world: number) {
    if (p[0] >= poly[0] && p[0] <= poly[2]) return;
    const half = world / 2;
    let s = p[0] - poly[0] > half ? -world : poly[0] - p[0] > half ? world : 0;
    if (!s) s = p[0] - poly[2] > half ? -world : poly[2] - p[0] > half ? world : 0;
    p[0] += s;
}

const withinCache = new WeakMap<object, Map<number, {polygons: Ring[][]; box: Box}>>();
/** `["within", geojson]`: whether each point or line of the feature is inside the polygons. */
export function within(g: unknown, f: GeoFeature | null, tile: TileId | undefined): boolean {
    if (!f || !tile || f.type === 3 || !f.type || typeof g !== 'object' || !g) return false;
    const [z, x, y] = tile;
    let byZoom = withinCache.get(g);
    if (!byZoom) withinCache.set(g, byZoom = new Map());
    let polys = byZoom.get(z);
    if (!polys) {
        const b = box(), list = polygonsOf(g) ?? [];
        polys = {polygons: list.map(poly => poly.map(r => r.map(c => { const p = toWorld(c, z); grow(b, p); return p; }))), box: b};
        byZoom.set(z, polys);
    }
    if (!polys.polygons.length) return false;
    const world = 2 ** z * EXTENT, lines = rings(f).map(r => r.map(([px, py]): P => [px + x * EXTENT, py + y * EXTENT])), b = box();
    if (f.type === 1) for (const l of lines) for (const p of l) { shift(p, polys.box, world); grow(b, p); }
    else {
        for (const l of lines) for (const p of l) grow(b, p);
        if (b[2] - b[0] <= world / 2) { b.splice(0, 4, ...box()); for (const l of lines) for (const p of l) { shift(p, polys.box, world); grow(b, p); } }
    }
    if (!boxInBox(b, polys.box)) return false;
    const {polygons} = polys;
    return f.type === 1 ? lines.every(l => l.every(p => polygons.some(poly => inPolygon(p, poly))))
        : lines.every(l => polygons.some(poly => lineInPolygon(l, poly)));
}

/** The distances of cheap-ruler, in meters, near one latitude. */
class Ruler {
    private kx: number; private ky: number;
    constructor(lat: number) {
        const e2 = 1 / 298.257223563 * (2 - 1 / 298.257223563), m = Math.PI / 180 * 6378137, cos = Math.cos(lat * Math.PI / 180);
        const w2 = 1 / (1 - e2 * (1 - cos * cos)), w = Math.sqrt(w2);
        this.kx = m * w * cos; this.ky = m * w * w2 * (1 - e2);
    }
    private wrap(d: number) { while (d < -180) d += 360; while (d > 180) d -= 360; return d; }
    dist(a: P, b: P) { const dx = this.wrap(a[0] - b[0]) * this.kx, dy = (a[1] - b[1]) * this.ky; return Math.sqrt(dx * dx + dy * dy); }
    /** The distance from p to the nearest point of a line. */
    toLine(p: P, line: Ring) {
        let best = Infinity, bx = NaN, by = NaN;
        for (let i = 0; i < line.length - 1; i++) {
            let x = line[i][0], y = line[i][1];
            const dx = this.wrap(line[i + 1][0] - x) * this.kx, dy = (line[i + 1][1] - y) * this.ky;
            if (dx !== 0 || dy !== 0) {
                const t = (this.wrap(p[0] - x) * this.kx * dx + (p[1] - y) * this.ky * dy) / (dx * dx + dy * dy);
                if (t > 1) { x = line[i + 1][0]; y = line[i + 1][1]; } else if (t > 0) { x += dx / this.kx * t; y += dy / this.ky * t; }
            }
            const ex = this.wrap(p[0] - x) * this.kx, ey = (p[1] - y) * this.ky, sq = ex * ex + ey * ey;
            if (sq < best) { best = sq; bx = x; by = y; }
        }
        return this.dist(p, [bx, by]);
    }
}

const segToSeg = (p1: P, p2: P, q1: P, q2: P, r: Ruler) =>
    Math.min(r.toLine(p1, [q1, q2]), r.toLine(p2, [q1, q2]), r.toLine(q1, [p1, p2]), r.toLine(q2, [p1, p2]));
/** The segments of a polygon, each ring closed. */
function* edges(polygon: Ring[]): Generator<[P, P]> { for (const r of polygon) for (let j = 0, k = r.length - 1; j < r.length; k = j++) yield [r[k], r[j]]; }

function pointsToPoints(a: Ring, b: Ring, r: Ruler) { let d = Infinity; for (const p of a) for (const q of b) d = Math.min(d, r.dist(p, q)); return d; }
function pointsToLine(points: Ring, line: Ring, r: Ruler) { let d = Infinity; for (const p of points) d = Math.min(d, r.toLine(p, line)); return d; }
function lineToLine(a: Ring, b: Ring, r: Ruler) {
    let d = Infinity;
    for (let i = 0; i < a.length - 1; i++) for (let j = 0; j < b.length - 1; j++) {
        if (crosses(a[i], a[i + 1], b[j], b[j + 1])) return 0;
        d = Math.min(d, segToSeg(a[i], a[i + 1], b[j], b[j + 1], r));
    }
    return d;
}
function pointToPolygon(p: P, polygon: Ring[], r: Ruler) {
    if (inPolygon(p, polygon, true)) return 0;
    let d = Infinity;
    for (const ring of polygon) {
        const a = ring[0], b = ring[ring.length - 1];
        if (a !== b) d = Math.min(d, r.toLine(p, [b, a]));
        d = Math.min(d, r.toLine(p, ring));
    }
    return d;
}
function lineToPolygon(line: Ring, polygon: Ring[], r: Ruler) {
    for (const p of line) if (inPolygon(p, polygon, true)) return 0;
    let d = Infinity;
    for (let i = 0; i < line.length - 1; i++) for (const [q1, q2] of edges(polygon)) {
        if (crosses(line[i], line[i + 1], q1, q2)) return 0;
        d = Math.min(d, segToSeg(line[i], line[i + 1], q1, q2, r));
    }
    return d;
}
const someIn = (a: Ring[], b: Ring[]) => a.some(ring => ring.some(p => inPolygon(p, b, true)));
function polygonToPolygon(a: Ring[], b: Ring[], r: Ruler) {
    const ba = box(), bb = box();
    for (const ring of a) for (const p of ring) grow(ba, p);
    for (const ring of b) for (const p of ring) grow(bb, p);
    if (boxInBox(ba, bb) ? someIn(a, b) : someIn(b, a)) return 0;
    let d = Infinity;
    for (const [p1, p2] of edges(a)) for (const [q1, q2] of edges(b)) {
        if (crosses(p1, p2, q1, q2)) return 0;
        d = Math.min(d, segToSeg(p1, p2, q1, q2, r));
    }
    return d;
}

type Simple = {type: 'Point'; c: Ring} | {type: 'LineString'; c: Ring} | {type: 'Polygon'; c: Ring[]};
/** The geometries of the GeoJSON of `distance`, each multi-geometry split into its parts. */
function simpleOf(g: any): Simple[] {
    const one = (x: any): Simple[] => {
        const c = x?.coordinates;
        if (!Array.isArray(c)) return [];
        switch (x.type) {
            case 'Point': return [{type: 'Point', c: [c as P]}];
            case 'MultiPoint': return c.map((p: P) => ({type: 'Point', c: [p]}));
            case 'LineString': return [{type: 'LineString', c}];
            case 'MultiLineString': return c.map((l: Ring) => ({type: 'LineString', c: l}));
            case 'Polygon': return [{type: 'Polygon', c}];
            case 'MultiPolygon': return c.map((p: Ring[]) => ({type: 'Polygon', c: p}));
        }
        return [];
    };
    if (g?.type === 'FeatureCollection') return (g.features ?? []).flatMap((f: any) => one(f?.geometry));
    return one(g?.type === 'Feature' ? g.geometry : g);
}

const area = (r: Ring) => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[i][1] + r[j][1]); return s; };
/** Rings into polygons: a ring of the winding of the first one starts a polygon, and the others are its holes. */
function classify(list: Ring[]): Ring[][] {
    if (list.length <= 1) return [list];
    const out: Ring[][] = [];
    let poly: Ring[] | undefined, ccw: boolean | undefined;
    for (const r of list) {
        const a = area(r);
        if (a === 0) continue;
        ccw ??= a < 0;
        if (ccw === a < 0) { if (poly) out.push(poly); poly = [r]; } else poly?.push(r);
    }
    if (poly) out.push(poly);
    return out;
}

const simpleCache = new WeakMap<object, Simple[]>();
/** `["distance", geojson]`: the shortest distance in meters between the feature and the geometry, or NaN. */
export function distance(g: unknown, f: GeoFeature | null, tile: TileId | undefined): number {
    if (!f || !tile || !f.type || typeof g !== 'object' || !g) return NaN;
    let geoms = simpleCache.get(g);
    if (!geoms) simpleCache.set(g, geoms = simpleOf(g));
    const raw = rings(f);
    if (!raw.length || !raw[0].length) return NaN;
    const ll = (r: Ring) => r.map(([x, y]) => toLngLat(x, y, tile));
    let d = Infinity;
    if (f.type === 3) {
        const polygons = classify(raw).map(poly => poly.map(ll));
        if (!polygons.length || !polygons[0].length) return NaN;
        const r = new Ruler(polygons[0][0][0][1]);
        for (const s of geoms) for (const poly of polygons) {
            d = Math.min(d, s.type === 'Polygon' ? polygonToPolygon(poly, s.c, r) : s.type === 'LineString' ? lineToPolygon(s.c, poly, r) : pointToPolygon(s.c[0], poly, r));
            if (d === 0) return 0;
        }
        return d;
    }
    const pts = raw.flat().map(([x, y]) => toLngLat(x, y, tile)), r = new Ruler(pts[0][1]), line = f.type === 2;
    for (const s of geoms) {
        if (s.type === 'Point') d = Math.min(d, line ? pointsToLine(s.c, pts, r) : pointsToPoints(pts, s.c, r));
        else if (s.type === 'LineString') d = Math.min(d, line ? lineToLine(pts, s.c, r) : pointsToLine(pts, s.c, r));
        else if (line) d = Math.min(d, lineToPolygon(pts, s.c, r));
        else for (const p of pts) d = Math.min(d, pointToPolygon(p, s.c, r));
        if (d === 0) return 0;
    }
    return d;
}
