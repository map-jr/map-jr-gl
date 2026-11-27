import {EXTENT, clamp, latFromMerc, lngFromMerc, mercX, mercY, type Transform} from './geo.ts';
import {decodeVectorTile} from './mvt.ts';
import {GEOJSON_LAYER} from './geojson.ts';
import {compileFilter, compileProp, type MapStates} from './expr.ts';
import type {TileLayers} from './tile.ts';
import type {GeoJSONGeometry} from './host.ts';

/** A feature found by a query. It comes straight from the tile data, whether or not any style layer draws it. */
export interface QueriedFeature {
    /** The id of the source. */
    source: string;
    /** The layer of the vector tile. */
    sourceLayer: string;
    /** The id of the feature in its source, if it has one. */
    id?: number | string;
    /** The type of the geometry. */
    type: 'Point' | 'LineString' | 'Polygon';
    /** Not set by `querySource`. */
    layer?: string;
    /** The properties of the feature. */
    properties: Record<string, unknown>;
    /** The geometry as GeoJSON, in longitude and latitude. `querySource` sets it only with `geometry: true`. */
    geometry?: Exclude<GeoJSONGeometry, {type: 'GeometryCollection'}>;
}
export interface TileQuery {
    source: string; z: number; x: number; y: number;
    /** The zoom that the filters of `sets` see, when it is not `z`: the over-zoomed zoom of a tile past the source's `maxzoom`, as in MapLibre GL JS. */
    zoom?: number;
    /** Query position and tolerance in tile units (0..EXTENT). */
    px: number; py: number; radius: number;
    sourceLayers?: string[];
    filter?: unknown;
    geometry?: boolean;
    /** A rectangle in tile units to search, in place of the position. */
    box?: [number, number, number, number];
    /** Several questions in one pass: for each, a style layer's name, source layer, filters and tolerance in tile units. */
    sets?: QuerySet[];
}
/** A feature of a GeoJSON source as a tile gives it for a rectangle: `index` is its place in the data of the source. The engine removes it. */
export type FoundFeature = QueriedFeature & {index?: number};
/**
 * A key for a feature that several tiles hold, so that a query gives the feature one time: for a GeoJSON feature its
 * place in the data, and for another feature its id. Two GeoJSON features with the same id are two results, as in
 * MapLibre GL JS. It is empty for a feature that has neither. It removes `index`.
 */
export function featureKey(f: FoundFeature): string {
    const i = f.index;
    delete f.index;
    return f.id === undefined && i === undefined ? '' : `${i ?? ''}|${f.layer}|${f.source}|${f.sourceLayer}|${i === undefined ? f.id : ''}`;
}
export interface QuerySet {
    layer: string; sourceLayer?: string; filter?: unknown; also?: unknown; radius: number;
    /** A line layer: the rings of a polygon are drawn as lines, so a feature of a polygon is found near its rings only. */
    ring?: boolean;
    /** A circle layer: the first value is true when `circle-pitch-alignment` is `map`, the second when `circle-pitch-scale` is `map`. */
    pitch?: [boolean, boolean];
    /**
     * A circle or line layer whose size depends on the feature, which each feature is tested with at the zoom of the
     * map, as in MapLibre GL JS: for a circle `a` is `circle-radius` and `b` is `circle-stroke-width`; for a line (`line`)
     * `a` is `line-width` and `b` is `line-gap-width`, all in pixels. `scale` is the tile units of one pixel; without
     * it the set's `radius` is used. For a line `o` is `line-offset` in pixels: the line is tested where it is drawn,
     * moved to the right of its direction, as MapLibre GL JS does (`offsetLine`).
     */
    size?: {line?: boolean; a: unknown; b: unknown; o?: unknown; zoom: number; scale?: number};
    /**
     * A circle or line layer whose size depends on the feature: the largest `circle-radius` and `circle-stroke-width`, or
     * `line-width`, `line-gap-width` and `line-offset` (without its sign), in pixels of its features in the data that the
     * map has, as MapLibre GL JS takes from each bucket (`getMaximumPaintValue`).
     */
    most?: number[];
    /** A circle, fill, line or fill-extrusion layer with `*-translate`: how far it is drawn from its features, in pixels of the screen. */
    translate?: [number, number];
}

/** The rectangle of the screen that a set is tested with: moved back by its translation, as MapLibre GL JS does. */
export const setBox = (box: number[], s: QuerySet) => s.translate ? [box[0] - s.translate[0], box[1] - s.translate[1], box[2] - s.translate[0], box[3] - s.translate[1]] : box;

/**
 * The largest absolute value of a size that depends only on the zoom: a number, a function with `stops` on the zoom,
 * or `interpolate` or `step` on `["zoom"]` with numbers as outputs. Any other size gives `Infinity`.
 */
function bound(v: any): number {
    const most = (o: unknown[]) => o.every(x => typeof x === 'number') ? Math.max(...o.map(x => Math.abs(x as number))) : Infinity;
    if (typeof v === 'number') return Math.abs(v);
    if (v && Array.isArray(v.stops) && v.property === undefined) return most(v.stops.map((s: unknown[]) => s[1]));
    if (!Array.isArray(v) || !Array.isArray(v[v[0] === 'step' ? 1 : 2]) || v[v[0] === 'step' ? 1 : 2][0] !== 'zoom') return Infinity;
    return /^interpolate/.test(v[0]) ? most(v.filter((_, k) => k > 3 && k % 2 === 0)) : v[0] === 'step' ? most(v.filter((_, k) => k > 1 && k % 2 === 0)) : Infinity;
}

/**
 * How far from its features a set draws in pixels of the screen, which the choice of tiles of a query grows by: its
 * `radius`, or for a size that depends only on the zoom its largest value. A size of a circle that depends on the
 * feature, or a width, gap or offset of a line that does, takes the largest value in `most`. Any other size keeps its `radius`.
 */
export function setReach(s: QuerySet): number {
    if (!s.size) return s.radius;
    const z = s.size, d = (v: unknown, x: number, i: number) => { const n = bound(v ?? x); return n < Infinity ? n : s.most?.[i] ?? n; }, w = d(z.a, z.line ? 1 : 5, 0), b = d(z.b, 0, 1);
    const r = (z.line ? (b > 0 ? b + 2 * w : w) / 2 : w + b) + (z.o === undefined ? 0 : d(z.o, 0, 2));
    return r < Infinity ? r : s.radius;
}

function outside(c: number[]) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < c.length; i += 2) x0 = Math.min(x0, c[i]), x1 = Math.max(x1, c[i]), y0 = Math.min(y0, c[i + 1]), y1 = Math.max(y1, c[i + 1]);
    return x1 < 0 || y1 < 0 || x0 > EXTENT || y0 > EXTENT;
}

const TYPES = ['Point', 'Point', 'LineString', 'Polygon'] as const;

function segmentDistSq(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
    return (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
}

/** True if the segment a-b touches the rectangle. */
function segmentInBox(ax: number, ay: number, bx: number, by: number, x0: number, y0: number, x1: number, y1: number) {
    if ((ax >= x0 && ax <= x1 && ay >= y0 && ay <= y1) || (bx >= x0 && bx <= x1 && by >= y0 && by <= y1)) return true;
    if (Math.max(ax, bx) < x0 || Math.min(ax, bx) > x1 || Math.max(ay, by) < y0 || Math.min(ay, by) > y1) return false;
    // Both ends are outside: the segment touches the rectangle only if the corners are not all on one side of it.
    const side = (x: number, y: number) => (bx - ax) * (y - ay) - (by - ay) * (x - ax), s = [side(x0, y0), side(x1, y0), side(x1, y1), side(x0, y1)];
    return !(s.every(v => v > 0) || s.every(v => v < 0));
}

/** True if a feature's geometry is at the position (within the radius), or touches the box when one is given. */
function touches(type: number, c: number[], ends: number[], px: number, py: number, radius: number, box?: number[]): boolean {
    const r2 = radius * radius, x0 = box ? box[0] - radius : 0, y0 = box ? box[1] - radius : 0, x1 = box ? box[2] + radius : 0, y1 = box ? box[3] + radius : 0;
    // For a box, "inside" asks if one corner of the box is in the polygon: that finds a polygon that contains the whole box.
    const qx = box ? box[0] : px, qy = box ? box[1] : py;
    let inside = false, start = 0;
    for (const end of ends) {
        if (type === 1) {
            const x = c[start * 2], y = c[start * 2 + 1];
            if (box ? x >= x0 && x <= x1 && y >= y0 && y <= y1 : (x - px) ** 2 + (y - py) ** 2 <= r2) return true;
        } else {
            for (let i = start, j = type === 3 ? end - 1 : start; i < end; j = i++) {
                const ax = c[j * 2], ay = c[j * 2 + 1], bx = c[i * 2], by = c[i * 2 + 1];
                if (i !== j && (box ? segmentInBox(ax, ay, bx, by, x0, y0, x1, y1) : segmentDistSq(px, py, ax, ay, bx, by) <= r2)) return true;
                // Even-odd crossing test over all rings handles holes and multi-polygons alike.
                if (type === 3 && (ay > qy) !== (by > qy) && qx < (bx - ax) * (qy - ay) / (by - ay) + ax) inside = !inside;
            }
        }
        start = end;
    }
    return inside;
}

/**
 * How far from its geometry a feature is found, in pixels: for a circle the radius `a` and the stroke `b`; for a line
 * half of the width `a`, or of the gap `b` and two widths when there is a gap, as MapLibre GL JS draws it (with no
 * minimum, as in MapLibre GL JS).
 */
export const sizeOf = (line: boolean | undefined, a: number, b: number) => line ? (b > 0 ? b + 2 * a : a) / 2 : a + b;

/** The lines of `c` (rings that end at `ends`) moved by `d` to the right of their direction, as `offsetLine` of MapLibre GL JS does. */
function offsetLine(c: number[], ends: number[], d: number) {
    const out = c.slice(), unit = (x: number, y: number) => { const l = Math.hypot(x, y); return l ? [x / l, y / l] : [0, 0]; };
    let start = 0;
    for (const end of ends) {
        for (let i = start; i < end; i++) {
            const x = c[i * 2], y = c[i * 2 + 1];
            // (The normal of a segment of zero length is zero, so a repeated point takes the normal of the other segment.)
            const ab = i > start ? unit(x - c[i * 2 - 2], y - c[i * 2 - 1]) : [0, 0], bc = i < end - 1 ? unit(c[i * 2 + 2] - x, c[i * 2 + 3] - y) : [0, 0];
            const n1 = [-ab[1], ab[0]], n2 = [-bc[1], bc[0]], [bx, by] = unit(n1[0] + n2[0], n1[1] + n2[1]), cos = bx * n2[0] + by * n2[1];
            out[i * 2] = x + bx * d / (cos || 1);
            out[i * 2 + 1] = y + by * d / (cos || 1);
        }
        start = end;
    }
    return out;
}

/** Finds every feature in a vector tile at (or within `radius` of) a position, or in a box. */
/** `states` is the feature state of the source (by "sourceLayer|id"), which a size that uses `feature-state` reads. */
export function queryTile(data: Uint8Array | TileLayers, q: TileQuery, states?: MapStates['f'][string]): FoundFeature[] {
    const out: FoundFeature[] = [], layers: TileLayers = data instanceof Uint8Array ? decodeVectorTile(data) : data;
    const n = 2 ** q.z, toLngLat = (x: number, y: number) => [lngFromMerc((q.x + x / EXTENT) / n), latFromMerc((q.y + y / EXTENT) / n)];
    // Without sets there is one question for all the data. With sets (the style layers of a rendered-features query)
    // each feature is read one time and tested for each set.
    const sets = (q.sets ?? [{layer: undefined as string | undefined, sourceLayer: undefined as string | undefined, filter: q.filter, also: undefined as unknown, radius: q.radius, ring: undefined as boolean | undefined}])
        .map(s => ({...s, test: compileFilter(s.filter), test2: compileFilter(s.also),
            size: 'size' in s && s.size?.scale ? {...s.size, r: compileProp(s.size.a, 'number', s.size.line ? 1 : 5), w: compileProp(s.size.b, 'number', 0), o: compileProp(s.size.o, 'number', 0)} : null}));
    for (const name in layers) {
        if (q.sourceLayers && !q.sourceLayers.includes(name)) continue;
        const mine = q.sets ? sets.filter(s => s.sourceLayer ? s.sourceLayer === name : name === GEOJSON_LAYER || !s.layer) : sets;
        if (!mine.length) continue;
        for (const f of layers[name].features) {
            f.state = f.id === undefined ? undefined : states?.[`${name === GEOJSON_LAYER ? '' : name}|${f.id}`];
            let c: number[] | null = null, geometry: QueriedFeature['geometry'];
            const ends: number[] = [];
            for (const set of mine) {
                if ((set.test && !set.test({zoom: q.zoom ?? q.z, f})) || (set.test2 && !set.test2({zoom: q.zoom ?? q.z, f}))) continue;
                if (!c) {
                    f.geometry(EXTENT, c = [], ends);
                    // A feature that has no id is in the buffer of a neighbor tile too. As in MapLibre GL JS, the
                    // tile gives it only when its bounding box touches the tile, so that a query gives it one time.
                    if (f.id === undefined && f.index === undefined && outside(c)) break;
                }
                const size = set.size, radius = size ? Math.min(Math.max(sizeOf(size.line, size.r.eval(size.zoom, f), size.w.eval(size.zoom, f)), 0), 1e4) * size.scale! : set.radius;
                const offset = size && f.type === 2 ? Math.min(Math.max(size.o.eval(size.zoom, f), -1e4), 1e4) * size.scale! : 0;
                // A line layer draws the rings of a polygon as lines (closed), so it finds them near the ring only.
                let tc: number[] = c, te = ends;
                const ring = set.ring && f.type === 3;
                if (ring) {
                    tc = []; te = [];
                    for (let i = 0, s = 0; i < ends.length; s = ends[i++]) tc.push(...c.slice(s * 2, ends[i] * 2), c[s * 2], c[s * 2 + 1]), te.push(tc.length / 2);
                }
                if (!touches(ring ? 2 : f.type, offset ? offsetLine(tc, te, offset) : tc, te, q.px, q.py, radius, q.box)) continue;
                const feature: FoundFeature = {source: q.source, sourceLayer: name === GEOJSON_LAYER ? '' : name, id: f.id, type: TYPES[f.type], properties: f.properties};
                if (set.layer !== undefined) feature.layer = set.layer;
                if (q.box && f.index !== undefined) feature.index = f.index;
                if (q.geometry) {
                    if (!geometry) {
                        const rings: number[][][] = [];
                        let start = 0;
                        for (const end of ends) {
                            const ring: number[][] = [];
                            for (let i = start; i < end; i++) ring.push(toLngLat(c[i * 2], c[i * 2 + 1]));
                            if (f.type === 3) ring.push(ring[0]);
                            rings.push(ring);
                            start = end;
                        }
                        geometry = f.type === 1 ? (rings.length === 1 ? {type: 'Point', coordinates: rings[0][0]} : {type: 'MultiPoint', coordinates: rings.map(r => r[0])})
                            : f.type === 2 ? (rings.length === 1 ? {type: 'LineString', coordinates: rings[0]} : {type: 'MultiLineString', coordinates: rings})
                            : {type: 'Polygon', coordinates: rings}; // rings of several polygons are returned together; winding tells them apart
                    }
                    feature.geometry = geometry;
                }
                out.push(feature);
            }
        }
    }
    return out;
}

/**
 * The encoding of the elevation of a `raster-dem` source: `'terrarium'`, `'mapbox'`, or for `encoding: 'custom'` the
 * factors of red, green and blue and the shift (`redFactor`, `greenFactor`, `blueFactor`, `baseShift`).
 */
export type DemEncoding = string | number[];

/** The factors of red, green and blue (0 to 255) and the shift that give the elevation in meters, for the shaders. */
export const demUnpack = (encoding: DemEncoding) => typeof encoding != 'string' ? encoding : encoding === 'terrarium' ? [256, 1, 1 / 256, 32768] : [6553.6, 25.6, 0.1, 10000];

/** Decodes one elevation sample from RGBA pixels. */
export function decodeElevation(d: ArrayLike<number>, i: number, encoding: DemEncoding) {
    return typeof encoding != 'string' ? d[i] * encoding[0] + d[i + 1] * encoding[1] + d[i + 2] * encoding[2] - encoding[3] : encoding === 'terrarium' ? d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768 : -10000 + (d[i] * 65536 + d[i + 1] * 256 + d[i + 2]) * 0.1;
}

/** Bilinear elevation lookup at fractional tile position (u, v in 0..1) in decoded elevation-tile pixels. */
export function sampleElevation(pixels: ArrayLike<number>, width: number, height: number, u: number, v: number, encoding: DemEncoding): number {
    const fx = Math.max(0, Math.min(width - 1, u * width - 0.5)), fy = Math.max(0, Math.min(height - 1, v * height - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
    const e = (x: number, y: number) => decodeElevation(pixels, (y * width + x) * 4, encoding);
    return (e(x0, y0) * (1 - tx) + e(x1, y0) * tx) * (1 - ty) + (e(x0, y1) * (1 - tx) + e(x1, y1) * tx) * ty;
}

/**
 * True if a circle of a circle layer at the mercator position (mx, my) touches the rectangle of the screen, as MapLibre
 * GL JS tests it (`circleIntersection`), and as the circle shader draws it. `r` is the radius with the stroke in pixels.
 * With `circle-pitch-alignment: map` the circle lies on the ground, and the rectangle is taken onto the ground. With
 * `circle-pitch-scale: map` a circle far from the camera is smaller.
 */
export function circleTouches(tr: Transform, mx: number, my: number, box: number[], r: number, [onMap, scaled]: [boolean, boolean]) {
    if (tr.worldCopies) mx += Math.round(mercX(tr.lng) - mx);
    const k = tr.perspectiveAt(mx, my), [x, y] = tr.mercToScreen(mx, my);
    if (x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3]) return true;
    if (!onMap) {
        const R = scaled ? r * k : r, dx = Math.max(box[0] - x, 0, x - box[2]), dy = Math.max(box[1] - y, 0, y - box[3]);
        return dx * dx + dy * dy <= R * R;
    }
    const R = (scaled ? r : r / k) / tr.worldSize, q = [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]].map(([a, b]) => tr.screenToGround(a, b));
    return q.some((a, i) => segmentDistSq(mx, my, a[0], a[1], q[(i + 1) % 4][0], q[(i + 1) % 4][1]) <= R * R);
}

/**
 * For a query on a tilted map: the rectangle grown by the farthest reach of the circles of the sets, and the sets
 * whose features `circleTouches` tests afterwards. Without pitch a circle is the same everywhere, and the tiles test
 * it with its radius.
 */
export function pitchedCircles(tr: Transform, box: number[], sets: QuerySet[]) {
    const circles = tr.pitch ? sets.filter(s => s.pitch) : [];
    if (!circles.length) return null;
    // A circle is largest at the bottom of the screen, which is nearest to the camera.
    const k = Math.max(1, tr.perspectiveAt(...tr.screenToGround(tr.width / 2, Math.max(box[3], tr.height))));
    // (A reach that is larger than the canvas is cut to it and one tile: the tiles that a map holds lie in about that distance around the view, and `circleTouches` decides each feature.)
    const r = Math.min(Math.max(...circles.map(s => setReach(s))), Math.max(tr.width, tr.height) + 512) * k;
    // (A translated circle is drawn away from its feature: the rectangle also reaches back by each translation.)
    const [x0, y0, x1, y1] = circles.reduce((b, s) => { const t = setBox(box, s); return [Math.min(b[0], t[0]), Math.min(b[1], t[1]), Math.max(b[2], t[2]), Math.max(b[3], t[3])]; }, box);
    return {box: [x0 - r, y0 - r, x1 + r, y1 + r], circles: new Set(circles), k};
}

const sizes = new WeakMap<QuerySet, {r: ReturnType<typeof compileProp>; w: ReturnType<typeof compileProp>}>();
/**
 * The radius with the stroke in pixels that a circle layer draws a found feature with: the set's `radius`, or for a
 * size that depends on the feature, its size at the zoom of the map with its state in `states` (as `queryTile` evaluates it).
 */
export function circleRadius(s: QuerySet, f: QueriedFeature, states?: MapStates['f'][string]): number {
    if (!s.size) return s.radius;
    let size = sizes.get(s);
    if (!size) sizes.set(s, size = {r: compileProp(s.size.a, 'number', 5), w: compileProp(s.size.b, 'number', 0)});
    const g = {type: TYPES.lastIndexOf(f.type as typeof TYPES[number]), id: f.id, properties: f.properties, state: f.id === undefined ? undefined : states?.[`${f.sourceLayer ?? ''}|${f.id}`]};
    return Math.min(Math.max(size.r.eval(s.size.zoom, g) + size.w.eval(s.size.zoom, g), 0), 1e4);
}

/** The positions of a geometry (in longitude and latitude) where a circle layer draws a circle. */
export function circleCenters(g: GeoJSONGeometry): number[][] {
    if (g.type === 'GeometryCollection') return g.geometries.flatMap(circleCenters);
    const c = g.coordinates as unknown[];
    return g.type === 'Point' ? [c as number[]] : c.flat(g.type === 'MultiPolygon' ? 2 : /^(Polygon|MultiLineString)$/.test(g.type) ? 1 : 0) as number[][];
}

/**
 * The tiles of one source under a rectangle of the screen, each with the rectangle in its own units and the number of
 * tile units for one screen pixel. When the map is turned or tilted, the rectangle is the one around the four corners.
 */
export function tilesUnderBox(tr: Transform, box: number[], minzoom: number, maxzoom: number, /** The tiles are chosen under the rectangle grown by this many pixels. */ pad = 0) {
    const span = ([x0, y0, x1, y1]: number[]) => {
        const c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => { const [lng, lat] = tr.unproject(x, y); return [mercX(lng), clamp(mercY(lat), 0, 1)]; });
        return [Math.min(...c.map(p => p[0])), Math.max(...c.map(p => p[0])), Math.min(...c.map(p => p[1])), Math.max(...c.map(p => p[1]))];
    };
    // (A reach without a bound, as a query of all features has, chooses no more tiles. A pad is at most the canvas and
    // one tile, as in `pitchedCircles`, and at most one tile when the larger pad would choose too many tiles.)
    const tile = 512 * 2 ** (tr.zoom % 1), [west, east, north, south] = span(box), z = clamp(Math.floor(tr.zoom), minzoom, maxzoom), n = 2 ** z;
    const range = (p: number) => { const g = span([box[0] - p, box[1] - p, box[2] + p, box[3] + p]); return [Math.floor(g[0] * n), Math.floor(g[1] * n), clamp(Math.floor(g[2] * n), 0, n - 1), clamp(Math.floor(g[3] * n), 0, n - 1)]; };
    const count = (r: number[]) => (r[1] - r[0] + 1) * (r[3] - r[2] + 1);
    pad = pad < Infinity ? Math.min(pad, Math.max(tr.width, tr.height) + tile) : 0;
    let r = range(pad);
    if (pad > tile && count(r) > 256) r = range(tile);
    const [tx0, tx1, ty0, ty1] = r, scale = EXTENT / (512 * 2 ** (tr.zoom - z)), out: {z: number; x: number; y: number; box: [number, number, number, number]; scale: number}[] = [];
    if (count(r) > 256) throw new Error('The query covers too many tiles');
    for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) {
        out.push({z, x: ((tx % n) + n) % n, y: ty, scale, box: [(west * n - tx) * EXTENT, (north * n - ty) * EXTENT, (east * n - tx) * EXTENT, (south * n - ty) * EXTENT]});
    }
    return out;
}
