import {EXTENT, latFromMerc, lngFromMerc} from './geo.ts';
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
}

const TYPES = ['Point', 'Point', 'LineString', 'Polygon'] as const;

function segmentDistSq(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
    return (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
}

/** Finds every feature in a vector tile at (or within `radius` of) a position. */
export function queryTile(data: Uint8Array | TileLayers, q: TileQuery): QueriedFeature[] {
    const out: QueriedFeature[] = [], layers: TileLayers = data instanceof Uint8Array ? decodeVectorTile(data) : data, filter = compileFilter(q.filter), r2 = q.radius * q.radius;
    const n = 2 ** q.z, toLngLat = (x: number, y: number) => [lngFromMerc((q.x + x / EXTENT) / n), latFromMerc((q.y + y / EXTENT) / n)];
    for (const name in layers) {
        if (q.sourceLayers && !q.sourceLayers.includes(name)) continue;
        for (const f of layers[name].features) {
            if (filter && !filter({zoom: q.z, f})) continue;
            const c: number[] = [], ends: number[] = [];
            f.geometry(EXTENT, c, ends);
            let hit = false, inside = false, start = 0;
            for (const end of ends) {
                if (f.type === 1) hit ||= (c[start * 2] - q.px) ** 2 + (c[start * 2 + 1] - q.py) ** 2 <= r2;
                else {
                    for (let i = start, j = f.type === 3 ? end - 1 : start; i < end; j = i++) {
                        const ax = c[j * 2], ay = c[j * 2 + 1], bx = c[i * 2], by = c[i * 2 + 1];
                        if (i !== j && segmentDistSq(q.px, q.py, ax, ay, bx, by) <= r2) hit = true;
                        // Even-odd crossing test over all rings handles holes and multi-polygons alike.
                        if (f.type === 3 && (ay > q.py) !== (by > q.py) && q.px < (bx - ax) * (q.py - ay) / (by - ay) + ax) inside = !inside;
                    }
                }
                start = end;
            }
            if (!hit && !inside) continue;
            const feature: QueriedFeature = {source: q.source, sourceLayer: name === GEOJSON_LAYER ? '' : name, id: f.id, type: TYPES[f.type], properties: f.properties};
            if (q.geometry) {
                const rings: number[][][] = [];
                start = 0;
                for (const end of ends) {
                    const ring: number[][] = [];
                    for (let i = start; i < end; i++) ring.push(toLngLat(c[i * 2], c[i * 2 + 1]));
                    if (f.type === 3) ring.push(ring[0]);
                    rings.push(ring);
                    start = end;
                }
                feature.geometry = f.type === 1 ? (rings.length === 1 ? {type: 'Point', coordinates: rings[0][0]} : {type: 'MultiPoint', coordinates: rings.map(r => r[0])})
                    : f.type === 2 ? (rings.length === 1 ? {type: 'LineString', coordinates: rings[0]} : {type: 'MultiLineString', coordinates: rings})
                    : {type: 'Polygon', coordinates: rings}; // rings of several polygons are returned together; winding tells them apart
            }
            out.push(feature);
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
