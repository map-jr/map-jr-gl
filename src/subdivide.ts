/**
 * The cut of tile geometry for the globe (#463). On a globe, a straight edge of a tile is a chord under the curve of the
 * sphere, so a long edge would cut through it. The tile worker cuts fills and lines along a grid of cells, so that each
 * edge is short enough to follow the curve when the vertex shader puts its ends on the sphere. A map that draws Mercator
 * never asks for this: its tiles are built as before.
 *
 * The method follows the subdivision of MapLibre GL JS (BSD-3-Clause): the triangles of a polygon are clipped to the
 * cells of a grid and share their vertices, and a tile at the north or south edge of the world gets triangles from its
 * border to the pole, with the special y values of MapLibre for the pole vertices. The code is new, and the size of the
 * grid is our own (see `globeGrid` in tile.ts). The code is a part of the worker that loads on demand (`subdivide` in
 * parts.ts): only a map that can show the globe needs it.
 */
import {EXTENT} from './geo.ts';
// (Through tile.ts, so that the part `subdivide` of the worker reads earcut from the worker file: see build.mjs.)
import {earcut, type GlobeBuild} from './tile.ts';

/** The y values that stand for the poles. No other vertex of a cut fill has them: the cut keeps fills inside the tile. */
export const NORTH_POLE = -32768, SOUTH_POLE = 32767;

/**
 * The border of a tile gets a vertex every BORDER tile units (128 a side), whatever its grid. A neighboring tile of
 * another zoom has another grid, so without this the vertices of the two sides of a shared border would not meet: a
 * straight edge of one side lies under the curve that the vertices of the other side follow, and the background
 * shows through (T-junctions). With these vertices, the gap between the two sides is below 0.03 pixel.
 */
const BORDER = EXTENT / 128;
/** Points of the border of the tile between two points of a piece, when both are on the same side of the border. */
function borderPoints(ax: number, ay: number, bx: number, by: number, out: number[]) {
    const axis = ax === bx && (ax === 0 || ax === EXTENT) ? 1 : ay === by && (ay === 0 || ay === EXTENT) ? 0 : -1;
    if (axis < 0) return;
    const from = axis ? ay : ax, to = axis ? by : bx, dir = Math.sign(to - from);
    for (let v = (dir > 0 ? Math.floor(from / BORDER) + 1 : Math.ceil(from / BORDER) - 1) * BORDER; dir > 0 ? v < to : v > to; v += dir * BORDER) out.push(axis ? ax : v, axis ? v : ay);
}

/** The lines of the grid, in whole tile units, so that both sides of a line get the same points. */
const gridLines = (grid: number) => Array.from({length: grid + 1}, (_, k) => Math.round(k * EXTENT / grid));

/** The cell that a coordinate is in (the last cell for the far border). */
function cellOf(lines: number[], v: number): number {
    let k = 0;
    while (k < lines.length - 2 && v >= lines[k + 1]) k++;
    return k;
}

/**
 * Appends the points of a line to `out`, with a point added where it crosses a line of the grid. `closed`: the line is
 * a ring, and the last point connects to the first, which is repeated at the end.
 */
export function cutLine(c: ArrayLike<number>, start: number, end: number, grid: number, out: number[], closed = false): void {
    const lines = gridLines(grid);
    for (let i = start; i < end + (closed ? 1 : 0); i++) {
        const j = i === end ? start : i, x = c[j * 2], y = c[j * 2 + 1];
        if (i > start) {
            const px = out[out.length - 2], py = out[out.length - 1], ts: number[] = [];
            for (const v of lines) {
                if ((px - v) * (x - v) < 0) ts.push((v - px) / (x - px));
                if ((py - v) * (y - v) < 0) ts.push((v - py) / (y - py));
            }
            // (A segment that crosses a corner of a cell crosses two lines at the same point: it gets one point.)
            ts.sort((a, b) => a - b).forEach((t, k) => { if (!k || t !== ts[k - 1]) out.push(Math.round(px + (x - px) * t), Math.round(py + (y - py) * t)); });
        }
        out.push(x, y);
    }
}

/**
 * Cuts the polygons of a fill for the globe. `features` has for each feature its polygons as earcut takes them (the flat
 * coordinates of the rings, and the offsets of the holes). Returns the vertices and triangles of all features, with the
 * first vertex of each feature, and for a tile at a pole the triangles from the border of the tile to the pole. The
 * parts of a polygon outside the tile are left out: on a globe the buffer of a tile would lie over the next tile.
 */
export function cutFill(features: {coords: ArrayLike<number>; holes: number[]}[][], build: GlobeBuild): {pos: number[]; idx: number[]; featStarts: number[]} {
    const lines = gridLines(Math.max(1, build.grid)), pos: number[] = [], idx: number[] = [], featStarts: number[] = [];
    for (const polygons of features) {
        featStarts.push(pos.length / 2);
        // The vertices of one feature are shared through this map. (Each feature has its own color.)
        const seen = new Map<number, number>();
        const vertex = (x: number, y: number) => {
            const key = (x + 32768) * 65536 + y + 32768;
            let i = seen.get(key);
            if (i === undefined) { seen.set(key, i = pos.length / 2); pos.push(x, y); }
            return i;
        };
        for (const {coords, holes} of polygons) {
            const tris = earcut(coords as number[], holes);
            for (let t = 0; t < tris.length; t += 3) {
                const tri = [tris[t], tris[t + 1], tris[t + 2]].flatMap(i => [coords[i * 2], coords[i * 2 + 1]]);
                const xs = [tri[0], tri[2], tri[4]], ys = [tri[1], tri[3], tri[5]];
                const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
                if (x1 <= 0 || y1 <= 0 || x0 >= EXTENT || y0 >= EXTENT) continue;
                for (let cx = cellOf(lines, Math.max(0, x0)); cx <= cellOf(lines, Math.min(EXTENT, x1)); cx++) {
                    for (let cy = cellOf(lines, Math.max(0, y0)); cy <= cellOf(lines, Math.min(EXTENT, y1)); cy++) {
                        const clipped = clipConvex(tri, lines[cx], lines[cy], lines[cx + 1], lines[cy + 1]), piece: number[] = [], ids: number[] = [];
                        for (let k = 0; k < clipped.length; k += 2) {
                            const j = (k + 2) % clipped.length;
                            piece.push(clipped[k], clipped[k + 1]);
                            borderPoints(clipped[k], clipped[k + 1], clipped[j], clipped[j + 1], piece);
                        }
                        for (let k = 0; k < piece.length; k += 2) { const i = vertex(piece[k], piece[k + 1]); if (ids[ids.length - 1] !== i && ids[0] !== i) ids.push(i); }
                        // A piece with points on the border is a fan around its middle, so that each of those points is a
                        // corner of a triangle. (A fan from a corner would leave them in the middle of a long edge.)
                        const fan = piece.length > clipped.length && ids.length > 2;
                        if (fan) {
                            let mx = 0, my = 0;
                            for (const i of ids) { mx += pos[i * 2]; my += pos[i * 2 + 1]; }
                            ids.unshift(vertex(Math.round(mx / ids.length), Math.round(my / ids.length)));
                            ids.push(ids[1]);
                        }
                        for (let k = 1; k + 1 < ids.length; k++) {
                            const a = ids[0], b = ids[k], c = ids[k + 1];
                            // (A piece that rounding made flat adds nothing.)
                            if ((pos[b * 2] - pos[a * 2]) * (pos[c * 2 + 1] - pos[a * 2 + 1]) === (pos[c * 2] - pos[a * 2]) * (pos[b * 2 + 1] - pos[a * 2 + 1])) continue;
                            idx.push(a, b, c);
                            // An edge on the north or south border of a tile at the edge of the world goes on to the pole.
                            for (const [p, q] of [[a, b], [b, c], [c, a]]) {
                                const py = pos[p * 2 + 1], qy = pos[q * 2 + 1];
                                const pole = build.north && py === 0 && qy === 0 ? NORTH_POLE : build.south && py === EXTENT && qy === EXTENT ? SOUTH_POLE : 0;
                                if (!pole) continue;
                                const pp = vertex(pos[p * 2], pole), qp = vertex(pos[q * 2], pole);
                                idx.push(p, q, qp, p, qp, pp);
                            }
                        }
                    }
                }
            }
        }
    }
    return {pos, idx, featStarts};
}

/**
 * Clips a triangle (flat coordinates) to a rectangle. A point where an edge of the triangle crosses a side of the
 * rectangle is computed from the two corners of that edge, in a fixed order, and rounded to whole units, so that the
 * pieces on both sides of the side get the same point. (Computed from the points of an earlier clip, it could round
 * the other way, and leave a crack.) Each edge of the polygon carries what it lies on: an edge of the triangle
 * (four numbers) or a side of the rectangle (axis and value).
 */
function clipConvex(tri: number[], x0: number, y0: number, x1: number, y1: number): number[] {
    let p = tri, on: number[][] = [0, 1, 2].map(i => [tri[i * 2], tri[i * 2 + 1], tri[(i + 1) % 3 * 2], tri[(i + 1) % 3 * 2 + 1]]);
    for (const [axis, v, low] of [[0, x0, true], [0, x1, false], [1, y0, true], [1, y1, false]] as const) {
        const out: number[] = [], outOn: number[][] = [], n = p.length / 2, inside = (i: number) => low ? p[i * 2 + axis] >= v : p[i * 2 + axis] <= v;
        const cross = (c: number[]): [number, number] => {
            // On a side of the rectangle: the corner. On an edge of the triangle: from its end with the lower coordinates.
            if (c.length === 2) return axis ? [c[1], v] : [v, c[1]];
            let [ax, ay, bx, by] = c;
            if (ax > bx || (ax === bx && ay > by)) [ax, ay, bx, by] = [bx, by, ax, ay];
            const t = axis ? (v - ay) / (by - ay) : (v - ax) / (bx - ax);
            return axis ? [Math.round(ax + (bx - ax) * t), v] : [v, Math.round(ay + (by - ay) * t)];
        };
        for (let i = 0; i < n; i++) {
            const a = inside(i), b = inside((i + 1) % n);
            if (a) { out.push(p[i * 2], p[i * 2 + 1]); outOn.push(on[i]); }
            if (a !== b) { out.push(...cross(on[i])); outOn.push(a ? [axis, v] : on[i]); }
        }
        p = out; on = outOn;
        if (p.length < 6) return p;
    }
    return p;
}
