import {EXTENT} from './geo.ts';
import {decodeElevation} from './query.ts';
import type {TileLayers} from './tile.ts';

/**
 * Contour lines computed from elevation tiles, in the tile workers. A `contour` source names a `raster-dem` source
 * and says which intervals to draw at which zooms; its tiles then behave like any vector tiles, with one line
 * layer whose features carry the elevation and how "major" the line is. Modelled on maplibre-contour.
 */
export interface ContourConfig {
    /** Tile URL template, encoding, size and deepest zoom of the elevation source the contours are derived from. */
    tiles: string[]; encoding: string; demMaxzoom: number; demMinzoom: number;
    /** Intervals by zoom: `{9: [200, 1000], 12: [50, 200]}` draws 200 (minor) and 1000 (major) from zoom 9, and so on. */
    thresholds: Record<string, number[]>;
    /** Elevation is multiplied by this first; 3.28084 turns metres into feet. */
    multiplier: number;
    /** Use elevation tiles this many levels shallower than the contour tile: fewer downloads, smoother lines. */
    overzoom: number;
    contourLayer: string; elevationKey: string; levelKey: string;
}
export interface DEM { width: number; height: number; data: Float32Array }
export type DEMLoader = (url: string) => Promise<DEM | null>;

/** Decodes an elevation tile image into metres. Needs a canvas, so it works in browsers and workers but not on a bare server. */
export async function decodeDEM(bytes: Uint8Array, encoding: string): Promise<DEM> {
    if (typeof createImageBitmap === 'undefined' || typeof OffscreenCanvas === 'undefined') throw new Error('Decoding elevation tiles needs a browser or worker environment');
    const image = await createImageBitmap(new Blob([bytes as BlobPart]), {premultiplyAlpha: 'none', colorSpaceConversion: 'none'});
    const {width, height} = image; // read before close(), which zeroes them
    const ctx = new OffscreenCanvas(width, height).getContext('2d', {willReadFrequently: true})!;
    ctx.drawImage(image, 0, 0);
    image.close();
    const px = ctx.getImageData(0, 0, width, height).data, data = new Float32Array(width * height);
    for (let i = 0; i < data.length; i++) data[i] = decodeElevation(px, i * 4, encoding);
    return {width, height, data};
}

/** The intervals in force at a zoom: those of the nearest zoom at or below it. */
export function thresholdsAt(thresholds: Record<string, number[]>, z: number): number[] | null {
    let best = -1;
    for (const key of Object.keys(thresholds)) { const k = +key; if (k <= z && k > best) best = k; }
    return best < 0 ? null : thresholds[best];
}

/**
 * Marching squares over a grid of `n` x `n` heights. Returns, per contour value, the polylines it forms in grid
 * coordinates (flat x, y pairs). Crossing points are identified by the grid edge they lie on, so the pieces from
 * neighbouring cells join exactly.
 */
export function isolines(v: Float32Array, n: number, interval: number): Map<number, number[][]> {
    // Per level: segments as [edgeA, ax, ay, edgeB, bx, by].
    const segments = new Map<number, number[]>();
    for (let y = 0; y < n - 1; y++) {
        for (let x = 0; x < n - 1; x++) {
            const tl = v[y * n + x], tr = v[y * n + x + 1], bl = v[(y + 1) * n + x], br = v[(y + 1) * n + x + 1];
            const lo = Math.min(tl, tr, bl, br), hi = Math.max(tl, tr, bl, br);
            if (!(hi > lo)) continue; // flat, or missing data
            for (let L = Math.ceil(lo / interval) * interval; L <= hi; L += interval) {
                const c = (tl >= L ? 8 : 0) | (tr >= L ? 4 : 0) | (br >= L ? 2 : 0) | (bl >= L ? 1 : 0);
                if (c === 0 || c === 15) continue;
                const top = y * n + x, left = top, eTop = top * 2, eLeft = left * 2 + 1, eBottom = ((y + 1) * n + x) * 2, eRight = (y * n + x + 1) * 2 + 1;
                // Where the level crosses each edge of the cell.
                const T = [eTop, x + (L - tl) / (tr - tl), y], R = [eRight, x + 1, y + (L - tr) / (br - tr)];
                const B = [eBottom, x + (L - bl) / (br - bl), y + 1], Lf = [eLeft, x, y + (L - tl) / (bl - tl)];
                let list = segments.get(L);
                if (!list) segments.set(L, list = []);
                const seg = (a: number[], b: number[]) => list!.push(a[0], a[1], a[2], b[0], b[1], b[2]);
                switch (c) {
                    case 1: case 14: seg(Lf, B); break;
                    case 2: case 13: seg(B, R); break;
                    case 3: case 12: seg(Lf, R); break;
                    case 4: case 11: seg(T, R); break;
                    case 6: case 9: seg(T, B); break;
                    case 7: case 8: seg(Lf, T); break;
                    // Saddles: the cell's average decides which pair of corners is connected.
                    case 5: if ((tl + tr + bl + br) / 4 >= L) { seg(Lf, T); seg(B, R); } else { seg(Lf, B); seg(T, R); } break;
                    case 10: if ((tl + tr + bl + br) / 4 >= L) { seg(Lf, B); seg(T, R); } else { seg(Lf, T); seg(B, R); } break;
                }
            }
        }
    }
    const out = new Map<number, number[][]>();
    for (const [level, s] of segments) {
        // Each crossing point touches at most two segments; follow them end to end.
        const at = new Map<number, number[]>(), count = s.length / 6, used = new Uint8Array(count);
        for (let i = 0; i < count; i++) for (const e of [s[i * 6], s[i * 6 + 3]]) { const l = at.get(e); if (l) l.push(i); else at.set(e, [i]); }
        const lines: number[][] = [];
        const walk = (start: number, fromEdge: number) => {
            const line: number[] = [];
            let i = start, edge = fromEdge;
            for (;;) {
                used[i] = 1;
                const forward = s[i * 6] === edge, a = forward ? i * 6 : i * 6 + 3, b = forward ? i * 6 + 3 : i * 6;
                if (!line.length) line.push(s[a + 1], s[a + 2]);
                line.push(s[b + 1], s[b + 2]);
                edge = s[b];
                const next = at.get(edge)!.find(j => !used[j]);
                if (next === undefined) break;
                i = next;
            }
            return line;
        };
        // Open lines first (they start on an edge only one segment touches), then closed rings.
        for (let i = 0; i < count; i++) {
            if (used[i]) continue;
            for (const e of [s[i * 6], s[i * 6 + 3]]) if (!used[i] && at.get(e)!.length === 1) lines.push(walk(i, e));
        }
        for (let i = 0; i < count; i++) if (!used[i]) lines.push(walk(i, s[i * 6]));
        out.set(level, lines);
    }
    return out;
}

/** Builds one contour tile. `loadDEM` fetches and decodes (and should cache) elevation tiles by URL. */
export async function contourTile(cfg: ContourConfig, z: number, x: number, y: number, loadDEM: DEMLoader): Promise<TileLayers> {
    const levels = thresholdsAt(cfg.thresholds, z);
    if (!levels?.length) return {};
    const dz = Math.max(cfg.demMinzoom, Math.min(cfg.demMaxzoom, z - cfg.overzoom)), k = z - dz;
    if (k < 0) return {};
    const url = (tx: number, ty: number) => {
        const n = 2 ** dz;
        if (ty < 0 || ty >= n) return null;
        const wx = ((tx % n) + n) % n;
        return cfg.tiles[(wx + ty) % cfg.tiles.length].replace('{z}', String(dz)).replace('{x}', String(wx)).replace('{y}', String(ty));
    };
    const tx = Math.floor(x / 2 ** k), ty = Math.floor(y / 2 ** k), centre = await loadDEM(url(tx, ty)!);
    if (!centre) return {};
    const P = centre.width, S = P / 2 ** k, X0 = (x - tx * 2 ** k) * S, Y0 = (y - ty * 2 ** k) * S;
    // Lines must meet across tile edges, so heights along an edge are sampled from the neighbouring elevation
    // tile too whenever this tile reaches the edge of its own.
    const tiles = new Map<string, DEM | null>([['0,0', centre]]);
    const need: [number, number][] = [];
    for (const oy of [-1, 0, 1]) for (const ox of [-1, 0, 1]) {
        if (!ox && !oy) continue;
        if ((ox < 0 && X0 >= 1) || (ox > 0 && X0 + S <= P - 1) || (oy < 0 && Y0 >= 1) || (oy > 0 && Y0 + S <= P - 1)) continue;
        need.push([ox, oy]);
    }
    await Promise.all(need.map(async ([ox, oy]) => { const u = url(tx + ox, ty + oy); tiles.set(`${ox},${oy}`, u ? await loadDEM(u).catch(() => null) : null); }));
    const pixel = (px: number, py: number) => {
        const ox = px < 0 ? -1 : px >= P ? 1 : 0, oy = py < 0 ? -1 : py >= P ? 1 : 0, t = tiles.get(`${ox},${oy}`);
        if (!t) return centre.data[Math.max(0, Math.min(P - 1, py)) * P + Math.max(0, Math.min(P - 1, px))];
        return t.data[(py - oy * P) * P + (px - ox * P)];
    };
    // A grid of at most 256 cells a side; small source areas (deep overzoom) are interpolated up to at least 64.
    const G = Math.min(256, Math.max(64, Math.round(S))), n = G + 1, heights = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
            const fx = X0 + i * S / G - 0.5, fy = Y0 + j * S / G - 0.5, px = Math.floor(fx), py = Math.floor(fy), ax = fx - px, ay = fy - py;
            heights[j * n + i] = ((pixel(px, py) * (1 - ax) + pixel(px + 1, py) * ax) * (1 - ay) + (pixel(px, py + 1) * (1 - ax) + pixel(px + 1, py + 1) * ax) * ay) * cfg.multiplier;
        }
    }
    const features: TileLayers[string]['features'] = [], scale = EXTENT / G;
    for (const [ele, lines] of isolines(heights, n, levels[0])) {
        // How "major" the line is: the last interval in the list that its elevation is a multiple of.
        let level = 0;
        for (let i = 1; i < levels.length; i++) if (Math.abs(ele / levels[i] - Math.round(ele / levels[i])) < 1e-6) level = i;
        const properties = {[cfg.elevationKey]: ele, [cfg.levelKey]: level};
        for (const line of lines) {
            if (line.length < 4) continue;
            features.push({type: 2, properties, geometry(extent, coords, ringEnds) {
                const m = scale * extent / EXTENT;
                for (let i = 0; i < line.length; i++) coords.push(Math.round(line[i] * m));
                ringEnds.push(coords.length / 2);
                return 1;
            }});
        }
    }
    return features.length ? {[cfg.contourLayer]: {features}} : {};
}
