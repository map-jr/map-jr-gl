import {EXTENT, clamp, latFromMerc, lngFromMerc, mercX, mercY, type Transform} from './geo.ts';
import {decodeVectorTile} from './mvt.ts';
import {GEOJSON_LAYER} from './geojson.ts';
import {compileFilter} from './expr.ts';
import type {TileLayers} from './tile.ts';

/** A feature found by a query. It comes straight from the tile data, whether or not any style layer draws it. */
export interface QueriedFeature {
    source: string;
    sourceLayer: string;
    id?: number | string;
    type: 'Point' | 'LineString' | 'Polygon';
    /** For a rendered-features query: the id of the style layer that draws the feature. */
    layer?: string;
    properties: Record<string, unknown>;
    /** GeoJSON geometry in longitude/latitude, when requested. */
    geometry?: {type: string; coordinates: unknown};
}
export interface TileQuery {
    source: string; z: number; x: number; y: number;
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
export interface QuerySet { layer: string; sourceLayer?: string; filter?: unknown; also?: unknown; radius: number }

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

/** Finds every feature in a vector tile at (or within `radius` of) a position, or in a box. */
export function queryTile(data: Uint8Array | TileLayers, q: TileQuery): QueriedFeature[] {
    const out: QueriedFeature[] = [], layers: TileLayers = data instanceof Uint8Array ? decodeVectorTile(data) : data;
    const n = 2 ** q.z, toLngLat = (x: number, y: number) => [lngFromMerc((q.x + x / EXTENT) / n), latFromMerc((q.y + y / EXTENT) / n)];
    // Without sets there is one question for all the data. With sets (the style layers of a rendered-features query)
    // each feature is read one time and tested for each set.
    const sets = (q.sets ?? [{layer: undefined as string | undefined, sourceLayer: undefined as string | undefined, filter: q.filter, also: undefined as unknown, radius: q.radius}])
        .map(s => ({...s, test: compileFilter(s.filter), test2: compileFilter(s.also)}));
    for (const name in layers) {
        if (q.sourceLayers && !q.sourceLayers.includes(name)) continue;
        const mine = q.sets ? sets.filter(s => s.sourceLayer ? s.sourceLayer === name : name === GEOJSON_LAYER || !s.layer) : sets;
        if (!mine.length) continue;
        for (const f of layers[name].features) {
            let c: number[] | null = null, geometry: QueriedFeature['geometry'];
            const ends: number[] = [];
            for (const set of mine) {
                if ((set.test && !set.test({zoom: q.z, f})) || (set.test2 && !set.test2({zoom: q.z, f}))) continue;
                if (!c) f.geometry(EXTENT, c = [], ends);
                if (!touches(f.type, c, ends, q.px, q.py, set.radius, q.box)) continue;
                const feature: QueriedFeature = {source: q.source, sourceLayer: name === GEOJSON_LAYER ? '' : name, id: f.id, type: TYPES[f.type], properties: f.properties};
                if (set.layer !== undefined) feature.layer = set.layer;
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

/** Decodes one elevation sample from RGBA pixels. */
export function decodeElevation(d: ArrayLike<number>, i: number, encoding: string) {
    return encoding === 'terrarium' ? d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768 : -10000 + (d[i] * 65536 + d[i + 1] * 256 + d[i + 2]) * 0.1;
}

/** Bilinear elevation lookup at fractional tile position (u, v in 0..1) in decoded elevation-tile pixels. */
export function sampleElevation(pixels: ArrayLike<number>, width: number, height: number, u: number, v: number, encoding: string): number {
    const fx = Math.max(0, Math.min(width - 1, u * width - 0.5)), fy = Math.max(0, Math.min(height - 1, v * height - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
    const e = (x: number, y: number) => decodeElevation(pixels, (y * width + x) * 4, encoding);
    return (e(x0, y0) * (1 - tx) + e(x1, y0) * tx) * (1 - ty) + (e(x0, y1) * (1 - tx) + e(x1, y1) * tx) * ty;
}

/**
 * The tiles of one source under a rectangle of the screen, each with the rectangle in its own units and the number of
 * tile units for one screen pixel. When the map is turned or tilted, the rectangle is the one around the four corners.
 */
export function tilesUnderBox(tr: Transform, [x0, y0, x1, y1]: number[], minzoom: number, maxzoom: number) {
    const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => { const [lng, lat] = tr.unproject(x, y); return [mercX(lng), clamp(mercY(lat), 0, 1)]; });
    const west = Math.min(...corners.map(p => p[0])), east = Math.max(...corners.map(p => p[0])), north = Math.min(...corners.map(p => p[1])), south = Math.max(...corners.map(p => p[1]));
    const z = clamp(Math.floor(tr.zoom), minzoom, maxzoom), n = 2 ** z, scale = EXTENT / (512 * 2 ** (tr.zoom - z)), out: {z: number; x: number; y: number; box: [number, number, number, number]; scale: number}[] = [];
    const tx0 = Math.floor(west * n), tx1 = Math.floor(east * n), ty0 = clamp(Math.floor(north * n), 0, n - 1), ty1 = clamp(Math.floor(south * n), 0, n - 1);
    if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 256) throw new Error('The query covers too many tiles');
    for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) {
        out.push({z, x: ((tx % n) + n) % n, y: ty, scale, box: [(west * n - tx) * EXTENT, (north * n - ty) * EXTENT, (east * n - tx) * EXTENT, (south * n - ty) * EXTENT]});
    }
    return out;
}
