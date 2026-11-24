export const EXTENT = 4096;
export const TILE_SIZE = 512;
const MAX_LAT = 85.051129;
/** The highest pitch that the camera takes (degrees), as in MapLibre GL JS. Above 90 the camera looks up. */
export const MAX_PITCH = 180;
/**
 * The change of zoom that keeps the size of the globe on the screen when the center moves from one latitude to
 * another (MapLibre's `getZoomAdjustment`). Past 85.05° the size of the globe stays that of 85.05°.
 */
export const keepSize = (from: number, to: number) => {
    const cos = (lat: number) => Math.cos(Math.min(Math.abs(lat), MAX_LAT) * Math.PI / 180);
    return Math.log2(cos(to) / cos(from));
};

/** 2D affine matrix in CSS `matrix(a b c d e f)` order: x' = a*x + c*y + e, y' = b*x + d*y + f. */
export type Mat = [number, number, number, number, number, number];
/**
 * A position: `[lng, lat]` or an object. The array is `readonly number[]` and not a pair, because TypeScript gives an
 * array that is declared apart from its use (`const NYC = [-74, 40.7]`) the type `number[]`.
 */
export type LngLatLike = readonly number[] | {lng: number; lat: number} | {lon: number; lat: number};

export interface TileID { z: number; x: number; y: number; w: number; key: string }

/** With 3D terrain, heights are kept on the CPU as one grid of this many samples a side per elevation tile. */
export const HEIGHT_GRID = 256;
/**
 * Ground height in meters at a mercator position, from height grids keyed "z/x/y": the deepest one at or above
 * zoom `from` that covers the point, or `unknown` if there is none.
 */
export function groundHeight(grids: Map<string, Float32Array>, mx: number, my: number, from: number, to = 0, unknown = 0): number {
    mx -= Math.floor(mx);
    // Which grid has the heights of a place is found once for each tile of the deepest level and kept (the search
    // makes a text key for each level, which is slow when it is done for thousands of points in a frame).
    let found = foundGrids.get(grids);
    if (!found) foundGrids.set(grids, found = new Map());
    const nf = 2 ** from, key = (from * 65536 + Math.floor(mx * nf)) * 65536 + Math.floor(my * nf);
    let g = found.get(key);
    if (g === undefined) {
        g = null;
        for (let z = from; z >= to && !g; z--) {
            const n = 2 ** z, h = grids.get(`${z}/${Math.floor(mx * n)}/${Math.floor(my * n)}`);
            if (h) g = {h, n};
        }
        if (found.size > 20000) found.clear();
        found.set(key, g);
    }
    if (!g) return unknown;
    const {h, n} = g, G = HEIGHT_GRID, fx = clamp((mx * n % 1) * G - 0.5, 0, G - 1), fy = clamp((my * n % 1) * G - 0.5, 0, G - 1);
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(G - 1, x0 + 1), y1 = Math.min(G - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
    return (h[y0 * G + x0] * (1 - tx) + h[y0 * G + x1] * tx) * (1 - ty) + (h[y1 * G + x0] * (1 - tx) + h[y1 * G + x1] * tx) * ty;
}
const foundGrids = new WeakMap<object, Map<number, {h: Float32Array; n: number} | null>>();
/** Call this after a grid is added to or removed from `grids`: what groundHeight remembers about them is then out of date. */
export function heightsChanged(grids: Map<string, Float32Array>) { foundGrids.get(grids)?.clear(); }

export const mercX = (lng: number) => (lng + 180) / 360;
export const mercY = (lat: number) => {
    const s = Math.sin(lat * Math.PI / 180);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};
export const lngFromMerc = (x: number) => x * 360 - 180;
/** The default vertical field of view in radians (36.87 degrees, as in MapLibre GL JS). */
export const FOV = 0.6435011087932844;
export const latFromMerc = (y: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;

/** Padding in CSS pixels: one number for all sides, or some of the sides. */
export type PaddingInput = number | Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;
/**
 * The center and zoom that fit the box [west, south, east, north] into a view of `width` by `height` pixels, less
 * `pad` ([top, right, bottom, left]) on each side, as `cameraForBoxAndBearing` of MapLibre GL JS 6.17 does in Mercator.
 * The box is turned by `bearing` (degrees) before it is fitted. `shift` is the part of the padding that moves the
 * center, and `offset` ([x, y] in CSS pixels at the end) moves it further.
 */
export function fitBox([w, s, e, n]: number[], width: number, height: number, pad: number[], shift: number[], maxZoom: number, bearing = 0, [ox, oy] = [0, 0]) {
    // An east edge west of the west edge crosses the antimeridian: the box goes one world further east.
    const x0 = mercX(w), x1 = mercX(e < w ? e + 360 : e), y0 = mercY(n), y1 = mercY(s), dx = x1 - x0, dy = y1 - y0;
    const r = bearing * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r), ac = Math.abs(c), as = Math.abs(sn);
    const zoom = Math.min(maxZoom, Math.log2(Math.min(Math.max(1, width - pad[1] - pad[3]) / Math.max(dx * ac + dy * as, 1e-12), Math.max(1, height - pad[0] - pad[2]) / Math.max(dx * as + dy * ac, 1e-12)) / 512));
    // Shift the center so the box sits in the middle of the area inside `shift` (along the turned axes), then by `offset`.
    const world = 512 * 2 ** zoom, px = (shift[3] - shift[1]) / 2, py = (shift[0] - shift[2]) / 2;
    return {center: {lng: lngFromMerc((x0 + x1) / 2 - (ox + c * px - sn * py) / world), lat: latFromMerc((y0 + y1) / 2 - (oy + sn * px + c * py) / world)}, zoom};
}
/** `PaddingInput` as [top, right, bottom, left]. */
export const sides = (p: PaddingInput = 0) => typeof p === 'number' ? [p, p, p, p] : [p.top ?? 0, p.right ?? 0, p.bottom ?? 0, p.left ?? 0];

export function toLngLat(v: LngLatLike): [number, number] {
    // (The casts are for the type check only: `Array.isArray` does not separate a readonly array from the objects.)
    return Array.isArray(v) ? v as [number, number] : ['lng' in v ? (v as {lng: number}).lng : (v as {lon: number}).lon, (v as {lat: number}).lat];
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** Whether two tiles cover some of the same ground: one is the other, or contains it. */
export const touches = (a: TileID, b: TileID) => {
    const d = a.z - b.z;
    return a.w === b.w && (d >= 0 ? a.x >> d === b.x && a.y >> d === b.y : b.x >> -d === a.x && b.y >> -d === a.y);
};


/**
 * How much of a globe the projection `type` of a style draws, as stops [zoom, globeness, ...] (1 is the globe, 0 is
 * Mercator), or null for Mercator. `globe` turns into Mercator between zoom 11 and 12, as in MapLibre GL JS. An
 * `interpolate` on `zoom` between the names gives its stops; another expression gives the stops of `globe`.
 */
export function globeStops(type: unknown): number[] | null {
    if (type === 'globe') return [11, 1, 12, 0];
    if (type === 'vertical-perspective') return [0, 1];
    if (!Array.isArray(type)) return null;
    if (type[0] === 'interpolate' && type[2]?.[0] === 'zoom') {
        const stops: number[] = [];
        for (let i = 3; i + 1 < type.length; i += 2) stops.push(+type[i], type[i + 1] === 'mercator' ? 0 : 1);
        return stops.every(Number.isFinite) && stops.some((v, i) => i % 2 && v) ? stops : null;
    }
    return [11, 1, 12, 0];
}

/**
 * Camera state plus the pure maths that turns it into screen positions.
 * No DOM access: the same class runs in the browser, a worker and on the server.
 */
export class Transform {
    width = 0;
    height = 0;
    lng = 0;
    lat = 0;
    zoom = 0;
    bearing = 0;
    /** Camera tilt in degrees: 0 looks straight down. */
    pitch = 0;
    minZoom = -2;
    maxZoom = 22;
    maxPitch = 60;
    minPitch = 0;
    /**
     * Space at the edges (top, right, bottom, left, in pixels) covered by other things, such as a side panel. The map
     * center, and the point the camera looks at, sit in the middle of what is left.
     */
    padding: [number, number, number, number] = [0, 0, 0, 0];
    /** Where on screen the map center is drawn. */
    get cx() { return this.width / 2 + (this.padding[3] - this.padding[1]) / 2; }
    get cy() { return this.height / 2 + (this.padding[0] - this.padding[2]) / 2; }
    /** If set, the view is kept inside this box: west, south, east, north. */
    maxBounds: [number, number, number, number] | null = null;

    /**
     * With 3D terrain: the height of the ground at the map center, in (exaggerated) meters. The camera looks at that
     * point rather than at sea level, so it rides over mountains instead of ending up inside them.
     */
    elevation = 0;
    /**
     * The height of the ground above the map center in pixels without 3D terrain: 0, or below the center when the
     * center has a height of its own (`setCenterElevation`), since the ground is then at sea level.
     */
    get flatZ() { return this.heightAt ? 0 : -this.elevation * this.pixelsPerMetre; }
    /**
     * A plane `z` pixels above the map center, kept at least 1% of the camera distance above or below the camera. A camera
     * in the plane (at a pitch of 90 on the ground) sees it as a line, and every pixel would map to one point.
     */
    private apart(z: number) {
        const d = this.cameraDistance, c = d * Math.cos(this.pitch * Math.PI / 180);
        return Math.abs(c - z) < 0.01 * d ? c + (z > c ? 0.01 : -0.01) * d : z;
    }
    /** With 3D terrain: (exaggerated) ground height in meters at a mercator position, used to lift labels onto the surface. */
    heightAt?: (mx: number, my: number) => number;
    /** With 3D terrain: the lowest and highest ground in view, in the same meters. Tile selection covers both extremes. */
    groundRange?: [number, number];

    /** The globe (globe.ts) once it has loaded, and the stops of the projection (see `globeStops`). */
    globe?: typeof import('./globe.ts');
    globeStops: number[] | null = null;
    /** How much of a globe is drawn at this zoom: 1 is the globe, 0 is Mercator (and always 0 until globe.ts has loaded). */
    get globeness() { return this.globe ? globenessAt(this.globeStops, this.zoom) : 0; }

    get worldSize() { return TILE_SIZE * 2 ** this.zoom; }
    private get angle() { return -this.bearing * Math.PI / 180; }

    set(center: LngLatLike | undefined, zoom?: number, bearing?: number, pitch?: number) {
        if (pitch !== undefined) this.pitch = clamp(pitch, this.minPitch, Math.min(MAX_PITCH, this.maxPitch));
        const lat0 = this.lat;
        if (center) [this.lng, this.lat] = toLngLat(center);
        if (zoom !== undefined) this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
        this.constrain();
        // On the globe a new center without a zoom keeps the size of the globe on the screen, and the zoom changes
        // with the latitude instead, as in MapLibre GL JS. (The zoom decides how near a pole the center can be, so the
        // center is constrained again.)
        if (center && zoom === undefined && globenessAt(this.globeStops, this.zoom)) {
            this.zoom = clamp(this.zoom + keepSize(lat0, this.lat), this.minZoom, this.maxZoom);
            [this.lng, this.lat] = toLngLat(center);
            this.constrain();
        }
        if (bearing !== undefined) this.bearing = ((bearing + 180) % 360 + 360) % 360 - 180;
    }

    /** The lowest zoom: `minZoom`, or the zoom at which the world is as tall as the view (not on a globe, which can be smaller than the view). */
    get zoomFloor() { return globenessAt(this.globeStops, this.minZoom) ? this.minZoom : Math.max(this.minZoom, Math.log2(this.height / TILE_SIZE)); }

    /** Keeps the view on the map, and inside `maxBounds` if there are any (as MapLibre GL JS does). */
    /** A function that replaces this constraint (`setTransformConstrain` of the compat entry). */
    customConstrain?: ((tr: Transform) => void) | null;
    constrain() {
        if (this.customConstrain) return this.customConstrain(this);
        // As in MapLibre, the view does not go past the top or the bottom of the world (when the world is taller than the view).
        // (A latitude that needs no change is left exactly as it was given.)
        // The world is never less tall than the view: the zoom stops there (as in MapLibre).
        this.zoom = Math.max(this.zoom, this.zoomFloor);
        // (On a globe the center only stays between the latitudes that Mercator reaches. MapLibre does not keep a globe
        // inside maxBounds either.)
        // (The stops decide this, also before globe.ts has loaded, so that a camera at the start is not moved.)
        if (globenessAt(this.globeStops, this.zoom)) {
            // The center reaches the pole only while the area past the edge of Mercator fits in the view, and eases back
            // to that edge as it outgrows it (MapLibre's _getMaxLatitude).
            const area = (90 - MAX_LAT) * Math.PI / 180, areaPx = this.worldSize / (2 * Math.PI * Math.cos(MAX_LAT * Math.PI / 180)) * area, reach = Math.min(this.width, this.height) / 2;
            // (The center stops a millionth of a degree short of the pole, where the Mercator y of the center, which
            // the view uses, is infinite.)
            const centrePx = Math.min(areaPx, reach) * clamp(1 - (areaPx - reach) / (reach * 3), 0, 1), max = Math.min(MAX_LAT + area * centrePx / areaPx * 180 / Math.PI, 90 - 1e-6);
            this.lat = clamp(this.lat, -max, max);
            return;
        }
        const half = Math.min(0.5, this.height / 2 / this.worldSize), y = mercY(this.lat = clamp(this.lat, -MAX_LAT, MAX_LAT)), inside = clamp(y, half, 1 - half);
        if (inside !== y) this.lat = latFromMerc(inside);
        const b = this.maxBounds;
        if (!b) return;
        // As MapLibre's Mercator transform does, the view stays inside the bounds: the canvas less the padding, as if
        // there were no bearing and no pitch. When the bounds are smaller than that, the zoom rises until they fill it,
        // centered on them (and can then go past maxZoom, as in MapLibre).
        const [pt, pr, pb, pl] = this.padding, vw = this.width - pl - pr, vh = this.height - pt - pb;
        // As in MapLibre, both edges are wrapped into one world, and an east edge west of the west edge (bounds that
        // cross the antimeridian) lies one world further east. The center is then wrapped to the copy nearest the bounds.
        const ws = this.worldSize, wrap = (v: number, lo: number) => { const r = ((v - lo) % ws + ws) % ws + lo; return r === lo ? lo + ws : r; };
        const x0 = wrap(mercX(b[0]) * ws, 0), y0 = mercY(b[3]) * ws, y1 = mercY(b[1]) * ws;
        let x1 = wrap(mercX(b[2]) * ws, 0);
        if (x1 <= x0) x1 += ws;
        const sx = x1 - x0 < vw ? vw / (x1 - x0) : 0, sy = y1 - y0 < vh ? vh / (y1 - y0) : 0;
        const xw = wrap(mercX(this.lng) * ws, (x0 + x1 - ws) / 2);
        let x = xw, y2 = mercY(this.lat) * ws;
        if (sx || sy) {
            if (sx) x = (x0 + x1) / 2;
            if (sy) y2 = (y0 + y1) / 2;
            this.zoom += Math.log2(Math.max(sx, sy));
        } else {
            const w = vw / 2, h = vh / 2;
            x = x - w < x0 ? x0 + w : x + w > x1 ? x1 - w : x;
            y2 = y2 - h < y0 ? y0 + h : y2 + h > y1 ? y1 - h : y2;
        }
        // As in MapLibre, a center that moves is wrapped into (-180, 180].
        const dy = y2 !== mercY(this.lat) * ws;
        if (x !== xw || dy) { const l = ((lngFromMerc(x === xw ? mercX(this.lng) : x / ws) + 180) % 360 + 360) % 360 - 180; this.lng = l === -180 ? 180 : l; }
        if (dy) this.lat = latFromMerc(y2 / ws);
    }

    /** The vertical field of view in radians: 36.87 degrees by default, as in MapLibre GL JS (`setVerticalFieldOfView` of the compat entry). */
    fov = FOV;
    /** Distance from the camera to the map center in pixels, from the vertical field of view. */
    get cameraDistance() { return 0.5 / Math.tan(this.fov / 2) * this.height; }
    /** Pixels per meter of height at the map center. */
    get pixelsPerMetre() { return this.worldSize / (40075016.686 * Math.cos(this.lat * Math.PI / 180)); }

    /**
     * The camera model, shared by every projection below. A point (dx, dy) pixels from the center on the map plane
     * (and z pixels above the height of the ground at the center) is rotated by the bearing, tilted by the pitch, then seen in perspective from
     * `cameraDistance` away. With no pitch this reduces to the plain 2D rotation.
     */
    private view(dx: number, dy: number, z = 0, out?: [number, number, number]): [number, number, number] {
        const a = this.angle, cos = Math.cos(a), sin = Math.sin(a), p = this.pitch * Math.PI / 180, d = this.cameraDistance;
        const rx = cos * dx - sin * dy, ry = sin * dx + cos * dy;
        const depth = d - ry * Math.sin(p) - z * Math.cos(p), k = d / depth;
        const o = out ?? [0, 0, 0];
        o[0] = rx * k + this.cx; o[1] = (ry * Math.cos(p) - z * Math.sin(p)) * k + this.cy; o[2] = depth;
        return o;
    }

    /**
     * The pixels from the map center up to the horizon on the screen, as MapLibre GL JS draws it (`getMercatorHorizon`):
     * a little below the true horizon, so that the ground ends at a finite distance.
     */
    horizon(): number {
        const p = this.pitch * Math.PI / 180;
        return this.cameraDistance * Math.min(0.85 * Math.tan(Math.PI / 2 - p), Math.tan((89.25 * Math.PI / 180) - p));
    }

    /**
     * Above a pitch of 90, when the camera is below the plane `z` pixels above the map center: the pixels from the map
     * center down to the screen line above which the camera sees that plane from below. It mirrors `horizon` at 180 less
     * the pitch, so that the ground ends a little before the line where the view rays turn upward. Otherwise null: the
     * camera is above the plane and sees it below `horizon`.
     */
    underside(z = this.flatZ): number | null {
        const p = this.pitch, R = Math.PI / 180, d = this.cameraDistance;
        return p > 90 && d * Math.cos(p * R) < this.apart(z) ? d * Math.min(0.85 * Math.tan((p - 90) * R), Math.tan((p - 90.75) * R)) : null;
    }

    /** Mercator [0..1] coordinates to screen pixels (on the ground surface, with 3D terrain). */
    mercToScreen(mx: number, my: number): [number, number] {
        const z = this.heightAt ? (this.heightAt(mx, my) - this.elevation) * this.pixelsPerMetre : this.flatZ;
        const ws = this.worldSize, flat = this.view((mx - mercX(this.lng)) * ws, (my - mercY(this.lat)) * ws, z);
        if (this.globeness) { const [x, y] = this.globe!.toScreen(this, mx, my, this.heightAt ? this.heightAt(mx, my) : this.elevation, flat); return [x, y]; }
        return [flat[0], flat[1]];
    }

    /** Screen pixels to the mercator position on the ground under them (`z` pixels above the height of the map center). */
    screenToMerc(px: number, py: number, z = this.flatZ): [number, number] {
        if (this.globeness) return this.globe!.toMerc(this, px, py, this.elevation + z / this.pixelsPerMetre);
        z = this.apart(z);
        const ws = this.worldSize, a = this.angle, cos = Math.cos(a), sin = Math.sin(a), p = this.pitch * Math.PI / 180, d = this.cameraDistance;
        const sx = px - this.cx, cp = Math.cos(p), sp = Math.sin(p), floor = d * Math.min(0.02, 0.1 * Math.abs(cp)), under = this.underside(z);
        // Invert the perspective for a point on that plane. Above the horizon there is no ground: a point there is taken
        // on the horizon, and the floor keeps planes above the map center (with 3D terrain) below their own horizon.
        // A camera below the plane sees it above the line of `underside`, and a point below that line is taken on it.
        const sy = under !== null ? Math.min(py - this.cy, under) : Math.max(py - this.cy, -this.horizon());
        const denom = under !== null ? Math.min(cp * d + sy * sp, -floor) : Math.max(cp * d + sy * sp, floor);
        const ry = (sy * (d - z * Math.cos(p)) + d * z * Math.sin(p)) / denom, rx = sx * (d - ry * Math.sin(p) - z * Math.cos(p)) / d;
        return [mercX(this.lng) + (cos * rx + sin * ry) / ws, mercY(this.lat) + (-sin * rx + cos * ry) / ws];
    }

    /**
     * Screen pixels to the mercator position of the ground actually seen there: with 3D terrain, the nearest point
     * of the surface along the view ray.
     */
    screenToGround(px: number, py: number): [number, number] {
        if (!this.heightAt) return this.screenToMerc(px, py);
        // Walk the view ray from the highest ground down to the lowest and stop where it first goes under the surface,
        // then narrow that step down. (Raising or lowering the assumed plane moves along the ray.)
        const ppm = this.pixelsPerMetre, [lo, hi] = this.groundRange ?? [this.elevation, this.elevation];
        const below = (h: number) => { const m = this.screenToMerc(px, py, (h - this.elevation) * ppm); return this.heightAt!(m[0], m[1]) >= h; };
        let a = hi + 1, b = lo - 1;
        for (let i = 1; i <= 96; i++) { const h = hi + (lo - hi) * i / 96; if (below(h)) { b = h; break; } a = h; }
        for (let i = 0; i < 12; i++) { const mid = (a + b) / 2; if (below(mid)) b = mid; else a = mid; }
        return this.screenToMerc(px, py, ((a + b) / 2 - this.elevation) * ppm);
    }

    /** With 3D terrain: whether the ground hides a point on the surface (a label behind a ridge, say) from the camera. */
    occluded(mx: number, my: number): boolean {
        if (!this.heightAt || this.pitch < 1 || this.globeness) return false;
        const p = this.pitch * Math.PI / 180, d = this.cameraDistance, ws = this.worldSize, ppm = this.pixelsPerMetre, a = this.angle;
        // The camera sits back from the map center along the view direction, above the ground there.
        const back = d * Math.sin(p) / ws, camX = mercX(this.lng) + Math.sin(a) * back, camY = mercY(this.lat) + Math.cos(a) * back;
        const camH = this.elevation + d * Math.cos(p) / ppm, h = this.heightAt(mx, my), slack = (camH - this.elevation) * 0.008;
        for (let i = 1; i < 40; i++) {
            const t = i / 40 * 0.98; // stop short of the point itself
            if (this.heightAt(camX + (mx - camX) * t, camY + (my - camY) * t) > camH + (h - camH) * t + slack) return true;
        }
        return false;
    }

    /** The screen's corners on the ground: one quad on flat ground, two (lowest and highest ground in view) with 3D terrain. */
    private footprints(): [number, number][][] {
        // Ground level with the camera has no sensible footprint, so a height is kept well below the camera, or well above
        // it when the camera is below the lowest ground (above a pitch of 90).
        const ppm = this.pixelsPerMetre, d = this.cameraDistance, cam = d * Math.cos(this.pitch * Math.PI / 180), gap = 0.4 * Math.max(Math.abs(cam), 0.01 * d);
        const zs = this.groundRange ? this.groundRange.map(h => (h - this.elevation) * ppm) : [this.flatZ], below = zs[0] < cam;
        const planes = zs.map(z => below ? Math.min(cam - gap, z) : Math.max(cam + gap, z));
        return planes.map(z => [[0, 0], [this.width, 0], [this.width, this.height], [0, this.height]].map(([x, y]) => this.screenToMerc(x, y, z)));
    }

    /** A point in a tile (tile units, optional height in meters) to screen pixels. */
    /**
     * Tile units to screen pixels. The third value is the distance from the camera, in pixels along the view direction.
     * With `out`, the result is written into it and it is returned (on the globe, a new array is still made).
     */
    projectTile(id: TileID, x: number, y: number, metres?: number, out?: [number, number, number]): [number, number, number] {
        const ws = this.worldSize, n = 2 ** id.z, s = ws / n / EXTENT;
        metres ??= this.heightAt ? this.heightAt((id.x + x / EXTENT) / n, (id.y + y / EXTENT) / n) : this.globeness ? this.elevation : 0;
        if (this.globeness) {
            const flat = this.view((id.x + id.w * n) * ws / n - mercX(this.lng) * ws + x * s, id.y * ws / n - mercY(this.lat) * ws + y * s, (metres - this.elevation) * this.pixelsPerMetre);
            return this.globe!.toScreen(this, (id.x + x / EXTENT) / n, (id.y + y / EXTENT) / n, metres, flat);
        }
        return this.view((id.x + id.w * n) * ws / n - mercX(this.lng) * ws + x * s, id.y * ws / n - mercY(this.lat) * ws + y * s, (metres - this.elevation) * this.pixelsPerMetre, out);
    }

    /** The distances of the near and the far plane from the camera, in pixels (the w of a point in clip space). */
    depthRange(): [number, number] {
        const p = this.pitch * Math.PI / 180, cp = Math.cos(p), sp = Math.sin(p), d = this.cameraDistance;
        // With 3D terrain, ground far below the map center is seen from higher up and so reaches further away.
        const drop = this.groundRange ? Math.max(0, this.elevation - this.groundRange[0]) * this.pixelsPerMetre : Math.max(0, -this.flatZ);
        // The far plane reaches the ground at the top of the screen or at the horizon, whichever is nearer (and at least 4
        // times the camera distance, for buildings beyond that ground at a low pitch).
        const top = Math.min(this.cy, Math.max(0, this.horizon())), reach = cp * d - top * sp > 1e-6 ? d + top * d * sp / (cp * d - top * sp) : 100 * d;
        return [d / 10, Math.min(100 * d, Math.max(4 * d, reach * 1.01) * (1 + drop / (d * Math.max(cp, 1e-3))))];
    }

    /**
     * The near and far distances of MapLibre GL JS's fog (its fog matrix): the near one is the camera's distance to sea
     * level along the view, and the far one is its far plane, which it works out for ground at sea level.
     */
    fogRange(): [number, number] {
        const p = this.pitch * Math.PI / 180, lp = Math.min(p, 89.25 * Math.PI / 180), d = this.cameraDistance, h = this.horizon();
        const near = Math.max(d / 2, d + this.elevation * this.pixelsPerMetre / Math.cos(lp)), oy = this.cy - this.height / 2;
        const ground = Math.PI / 2 + p, far = (a: number) => Math.sin(a) * near / Math.sin(clamp(Math.PI - ground - a, 0.01, Math.PI - 0.01));
        const ha = Math.atan(h / d), min = (90 - 89.25) * Math.PI / 180;
        const top = Math.min(far(this.fov * (0.5 + oy / this.height)), far(ha > min ? 2 * ha * (0.5 + oy / (h * 2)) : min));
        return [near, (Math.sin(lp) * top + near) * 1.01];
    }

    /** Tile units (x, y) and meters (z) to clip space, as a column-major 4x4 matrix for the GPU. */
    tileMatrix4(id: TileID): Float32Array {
        const ws = this.worldSize, n = 2 ** id.z, s = ws / n / EXTENT;
        const a = this.angle, cos = Math.cos(a), sin = Math.sin(a), p = this.pitch * Math.PI / 180, cp = Math.cos(p), sp = Math.sin(p);
        const d = this.cameraDistance, ppm = this.pixelsPerMetre;
        const ox = (id.x + id.w * n) * ws / n - mercX(this.lng) * ws, oy = id.y * ws / n - mercY(this.lat) * ws;
        const tx = cos * ox - sin * oy, ty = sin * ox + cos * oy, kx = 2 * d / this.width, ky = -2 * d / this.height;
        // A tight depth range (everything visible at the steepest pitch fits) keeps depth precise even in a 16-bit buffer.
        // With 3D terrain, ground far below the map center is seen from higher up and so reaches further away.
        const [near, far] = this.depthRange(), A = (far + near) / (far - near), B = -2 * far * near / (far - near);
        // Rows: X = kx * xc, Y = ky * yc, W = depth, Z = A * depth + B (so Z/W runs -1..1 from near to far).
        const X = [cos * s * kx, -sin * s * kx, 0, tx * kx];
        const Y = [sin * s * cp * ky, cos * s * cp * ky, -ppm * sp * ky, ty * cp * ky];
        const W = [-sin * s * sp, -cos * s * sp, -ppm * cp, d - ty * sp];
        // The ground at the map center sits at height `elevation`: shift everything down by that much.
        Y[3] -= Y[2] * this.elevation; W[3] -= W[2] * this.elevation;
        // Padding moves the point the camera looks at away from the middle of the screen.
        const px = (this.cx - this.width / 2) * 2 / this.width, py = (this.cy - this.height / 2) * 2 / this.height;
        for (let i = 0; i < 4; i++) { X[i] += W[i] * px; Y[i] -= W[i] * py; }
        const Z = [A * W[0], A * W[1], A * W[2], A * W[3] + B];
        return new Float32Array([X[0], Y[0], Z[0], W[0], X[1], Y[1], Z[1], W[1], X[2], Y[2], Z[2], W[2], X[3], Y[3], Z[3], W[3]]);
    }

    project(lng: number, lat: number): [number, number] {
        // Pick the world copy nearest the center so markers stay put across the antimeridian.
        let mx = mercX(lng);
        const cx = mercX(this.lng);
        mx += Math.round(cx - mx);
        return this.mercToScreen(mx, mercY(lat));
    }

    unproject(px: number, py: number): [number, number] {
        const [mx, my] = this.screenToGround(px, py);
        return [lngFromMerc(mx), latFromMerc(clamp(my, 0, 1))];
    }

    /**
     * The center after the view moves by (sx, sy) screen pixels: a pan with the keys, a fling. On the globe the center
     * moves along the latitude and the meridian (as MapLibre's computeGlobePanCenter does), so that a horizontal fling
     * does not drift north or south.
     */
    panned(sx: number, sy: number): [number, number] {
        if (!this.globeness) return this.unprojectFlat(this.cx + sx, this.cy + sy);
        const a = this.angle, east = Math.cos(a) * sx + Math.sin(a) * sy, south = -Math.sin(a) * sx + Math.cos(a) * sy;
        // Degrees per pixel at the center, and the speed of longitude: 1 / cos(latitude), or with the latitude capped at
        // 60° while the globe is small (zoom 3 at the equator and less), as MapLibre's computeGlobePanCenter does.
        const cos = (lat: number) => Math.cos(Math.min(Math.abs(lat), MAX_LAT) * Math.PI / 180), perPx = 360 * cos(this.lat) / this.worldSize;
        const zoom0 = this.zoom + Math.log2(cos(this.lat)), t = clamp((7 - zoom0) / 4, 0, 1);
        const lngSpeed = 1 / cos(this.lat) + (1 / cos(Math.min(Math.abs(this.lat), 60)) - 1 / cos(this.lat)) * t;
        return [this.lng + east * perPx * lngSpeed, clamp(this.lat - south * perPx, -90, 90)];
    }

    /** Screen pixels to the position under them on the level plane through the map center (ignoring 3D terrain). */
    unprojectFlat(px: number, py: number): [number, number] {
        const [mx, my] = this.screenToMerc(px, py);
        return [lngFromMerc(mx), latFromMerc(clamp(my, 0, 1))];
    }

    /** With 3D terrain: where the camera itself is (mercator), and its height in the same meters as the terrain. */
    cameraPosition(): [number, number, number] {
        const p = this.pitch * Math.PI / 180, d = this.cameraDistance, back = d * Math.sin(p) / this.worldSize, a = this.angle;
        return [mercX(this.lng) + Math.sin(a) * back, mercY(this.lat) + Math.cos(a) * back, this.elevation + d * Math.cos(p) / this.pixelsPerMetre];
    }

    /**
     * With 3D terrain: makes the map center the point of ground the camera is actually looking at, without moving
     * the camera. The center slides along the line of sight to the surface, and the zoom changes to match the new
     * distance, so the picture stays exactly as it was. (This is what MapLibre does when a movement ends.)
     * Returns whether anything changed.
     */
    recenterOnGround(): boolean {
        if (!this.heightAt) return false;
        const p = this.pitch * Math.PI / 180, d = this.cameraDistance, ppm = this.pixelsPerMetre;
        // A center that is on the ground stays. (The walk of screenToGround can step over a narrow peak under the center
        // and find the ground behind it; the center then went back and forth between the two, #1459.)
        if (Math.abs(this.heightAt(mercX(this.lng), mercY(this.lat)) - this.elevation) * ppm < 0.25) return false;
        const [mx, my] = this.screenToGround(this.cx, this.cy), h = this.heightAt(mx, my), z = (h - this.elevation) * ppm;
        const dist = d - z / Math.cos(p); // camera to that point, in pixels at the current scale
        if (Math.abs(z) < 0.25 || dist < d * 0.05) return false;
        const lat = latFromMerc(clamp(my, 0, 1));
        // The same distance in meters must come out as `d` pixels at the new zoom and latitude.
        const zoom = Math.log2(d / (dist / ppm) * 40075016.686 * Math.cos(lat * Math.PI / 180) / TILE_SIZE);
        this.lng = lngFromMerc(mx); this.lat = clamp(lat, -MAX_LAT, MAX_LAT);
        this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
        this.elevation = h;
        return true;
    }

    /** Move the camera so that `lngLat` sits under screen point (px, py). Used for zoom-around-cursor. */
    setLocationAt(lng: number, lat: number, px: number, py: number, height?: number) {
        if (this.globeness) { this.globe!.turnTo(this, lng, lat, px, py); this.constrain(); return; }
        const z = height !== undefined ? (height - this.elevation) * this.pixelsPerMetre : this.heightAt ? (this.heightAt(mercX(lng), mercY(lat)) - this.elevation) * this.pixelsPerMetre : this.flatZ;
        const [mx, my] = this.screenToMerc(px, py, z);
        const cx = mercX(this.lng) + mercX(lng) - mx;
        const cy = mercY(this.lat) + mercY(lat) - my;
        this.lng = lngFromMerc(cx);
        this.lat = latFromMerc(clamp(cy, 0, 1));
        this.constrain();
    }

    /** Pixels per tile unit for a tile at zoom z. */
    tileScale(z: number) { return this.worldSize / 2 ** z / EXTENT; }

    /** Tile units (0..EXTENT) to screen pixels. The one matrix both the WebGL and SVG backends consume. */
    tileMatrix(id: TileID): Mat {
        const ws = this.worldSize, n = 2 ** id.z, s = ws / n / EXTENT;
        const a = this.angle, cos = Math.cos(a), sin = Math.sin(a);
        const ox = (id.x + id.w * n) * ws / n - mercX(this.lng) * ws;
        const oy = id.y * ws / n - mercY(this.lat) * ws;
        return [cos * s, sin * s, -sin * s, cos * s,
            cos * ox - sin * oy + this.cx, sin * ox + cos * oy + this.cy];
    }

    /** `tileSize` shifts the zoom level chosen: 256px tiles are fetched one level deeper than 512px ones. */
    tileCover(minzoom: number, maxzoom: number, tileSize = TILE_SIZE, round = false, lod?: number[]): TileID[] {
        // Image tiles switch level at the half-way point (as MapLibre does) so they are never stretched more than about 1.4x.
        // (Below zoom 0 the tiles of zoom 0 are drawn smaller.)
        const want = Math.max(0, (round ? Math.round : Math.floor)(this.zoom + Math.log2(TILE_SIZE / tileSize)));
        // Below a source's minimum zoom nothing is drawn (as in MapLibre); shrinking its coarsest tiles would mean
        // loading ever more of them the further out the map goes.
        if (this.globeness) return this.globe!.covering(this, minzoom, maxzoom, tileSize, round);
        if (want < minzoom) return [];
        const z = Math.min(want, maxzoom), n = 2 ** z;
        // (With 3D terrain, ground that is nearer to the camera than the center can take a deeper level, as in MapLibre.)
        if (this.pitch > 0.5) return this.coveringPitched(this.mlRule(lod) ? maxzoom : z, this.zoom + Math.log2(TILE_SIZE / tileSize), round, lod, minzoom);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [mx, my] of this.footprints().flat()) {
            x0 = Math.min(x0, mx); x1 = Math.max(x1, mx);
            y0 = Math.min(y0, my); y1 = Math.max(y1, my);
        }
        const out: TileID[] = [];
        const cx = mercX(this.lng) * n, cy = mercY(this.lat) * n;
        const ty0 = clamp(Math.floor(y0 * n), 0, n - 1), ty1 = clamp(Math.floor(y1 * n), 0, n - 1);
        for (let tx = Math.floor(x0 * n); tx <= Math.floor(x1 * n); tx++) {
            const w = Math.floor(tx / n), x = tx - w * n;
            for (let y = ty0; y <= ty1; y++) out.push({z, x, y, w, key: `${z}/${x}/${y}`});
        }
        const d = (t: TileID) => (t.x + t.w * n + 0.5 - cx) ** 2 + (t.y + 0.5 - cy) ** 2;
        return out.sort((a, b) => d(a) - d(b));
    }

    /** Whether the tile cover of a tilted camera takes the rule of MapLibre GL JS (see `coveringPitched`). */
    private mlRule(lod?: number[]) { return !!this.heightAt || !!lod && this.pitch > 60 || this.fov !== FOV && this.pitch > clamp(78.5 - this.fov * 90 / Math.PI, 0, 60); }

    /**
     * Tile cover for a tilted camera. The view is a trapezoid on the ground whose far edge covers much more area,
     * drawn much smaller, so tiles are chosen by descending a quadtree and stopping earlier the farther away a tile is.
     */
    private coveringPitched(maxZ: number, exact: number, round: boolean, lod?: number[], minZ = 0): TileID[] {
        // The area to cover: the screen's footprint on the ground (with 3D terrain, the hull of its lowest and highest footprints).
        const pts = this.footprints().flat().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
        const cross = (o: number[], p: number[], q: number[]) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
        const half = (list: [number, number][]) => { const h: [number, number][] = []; for (const p of list) { while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop(); h.push(p); } h.pop(); return h; };
        const quad = pts.length > 4 ? [...half(pts), ...half([...pts].reverse())] : this.footprints()[0];
        const mid = [quad.reduce((t, q) => t + q[0], 0) / quad.length, quad.reduce((t, q) => t + q[1], 0) / quad.length];
        const d = this.cameraDistance, ws = this.worldSize, cx = mercX(this.lng), cy = mercY(this.lat);
        const gz = this.flatZ, depthAt = (mx: number, my: number) => this.view((mx - cx) * ws, (my - cy) * ws, gz)[2];
        // (The rule takes the distance of the camera from the plane of the center, or from the ground without 3D terrain:
        // above a pitch of 90 the camera can be below that plane.)
        const cam = this.cameraPosition(), camZ = Math.max(1e-3 * d, Math.abs(Math.cos(this.pitch * Math.PI / 180) * d - gz)) / ws;
        // Separating-axis test between that convex area and a tile's square.
        const overlaps = (x0: number, y0: number, x1: number, y1: number) => {
            if (Math.max(...quad.map(q => q[0])) < x0 || Math.min(...quad.map(q => q[0])) > x1 || Math.max(...quad.map(q => q[1])) < y0 || Math.min(...quad.map(q => q[1])) > y1) return false;
            for (let i = 0; i < quad.length; i++) {
                const [ax, ay] = quad[i], [bx, by] = quad[(i + 1) % quad.length], nx = by - ay, ny = ax - bx;
                const side = (x: number, y: number) => (x - ax) * nx + (y - ay) * ny;
                const inside = Math.sign(side(mid[0], mid[1]));
                if (inside && [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].every(([x, y]) => Math.sign(side(x, y)) === -inside)) return false;
            }
            return true;
        };
        const out: TileID[] = [];
        const visit = (z: number, x: number, y: number, w: number) => {
            const n = 2 ** z, x0 = (x + w * n) / n, y0 = y / n, x1 = x0 + 1 / n, y1 = y0 + 1 / n;
            if (!overlaps(x0, y0, x1, y1)) return;
            // Depth of the tile's nearest point decides how much detail it needs: half the on-screen scale, one level less.
            let wanted: number;
            if (this.mlRule(lod)) {
                // With 3D terrain, with the parameters of `setSourceTileLodParams` above a pitch of 60°, or with a field of
                // view that is not the default above the pitch where MapLibre GL JS starts to vary the zoom of its tiles
                // (78.5° less half the field of view, at most 60°), the rule is that of MapLibre GL JS, so that both show the same tiles.
                wanted = Math.min(maxZ, (round ? Math.round : Math.floor)(lodZoom(lod ?? [9.314, 3], exact,
                    Math.hypot(clamp(cam[0], x0, x1) - cam[0], clamp(cam[1], y0, y1) - cam[1]), camZ, d / ws, this.fov)));
            } else {
                const near = Math.min(depthAt(clamp(cx, x0, x1), clamp(cy, y0, y1)), depthAt(x0, y0), depthAt(x1, y0), depthAt(x0, y1), depthAt(x1, y1));
                wanted = maxZ - Math.max(0, Math.floor(Math.log2(Math.max(near, 1) / d) + 0.35));
            }
            // Far ground that wants a level below the source's minimum zoom has no tile, as in MapLibre (#1480).
            if (z >= maxZ || z >= wanted) { if (z >= minZ) out.push({z, x, y, w, key: `${z}/${x}/${y}`}); return; }
            for (let i = 0; i < 4; i++) visit(z + 1, x * 2 + (i & 1), y * 2 + (i >> 1), w);
        };
        const w0 = Math.floor(Math.min(...quad.map(q => q[0]))), w1 = Math.floor(Math.max(...quad.map(q => q[0])));
        for (let w = w0; w <= w1; w++) visit(0, 0, 0, w);
        const dist = (t: TileID) => { const n = 2 ** t.z; return ((t.x + 0.5) / n + t.w - cx) ** 2 + ((t.y + 0.5) / n - cy) ** 2; };
        return out.sort((a, b) => dist(a) - dist(b));
    }
}

/**
 * The zoom that a tile wants in a pitched view, as `createCalculateTileZoomFunction` of MapLibre GL JS computes it:
 * less detail with the distance from the camera to the nearest point of the tile, less again for ground seen at a flat
 * angle (more so with more `levels` on screen), and less everywhere when the view would need more than `ratio` times
 * the tiles of an unpitched view. `d2` is the distance on the ground, `dz` the height of the camera and `d3` the
 * distance to the center, all in the same unit.
 */
function lodZoom([levels, ratio]: number[], zoom: number, d2: number, dz: number, d3: number, f: number) {
    const H = 89.25 * Math.PI / 180, b = 2 * ((levels - 1) / Math.log2(Math.cos(H - f) / Math.cos(H)) - 1);
    const sum = (a: number, c: number) => { let s = 0; for (let i = 0; i < 10; i++) s += Math.cos(a + (i + 0.5) / 10 * (c - a)) ** (b - 1); return s * (c - a) / 10; };
    const pitch = Math.acos(dz / d3), hi = Math.min(H, pitch + f / 2), lo = Math.min(hi, pitch - f / 2), d = Math.hypot(d2, dz);
    return zoom + Math.log2(d3 / d / Math.max(0.5, Math.cos(f / 2))) + b * Math.log2(dz / d) / 2 - Math.log2(Math.max(1, sum(lo, hi) / sum(-f / 2, f / 2) / ratio)) / 2;
}

/** The globeness at a zoom from stops [zoom, value, ...]: linear between stops, and the nearest stop outside them. */
export function globenessAt(stops: number[] | null, zoom: number): number {
    if (!stops?.length) return 0;
    if (zoom <= stops[0]) return stops[1];
    for (let i = 2; i < stops.length; i += 2) if (zoom < stops[i]) return stops[i - 1] + (stops[i + 1] - stops[i - 1]) * (zoom - stops[i - 2]) / (stops[i] - stops[i - 2]);
    return stops[stops.length - 1];
}

export function apply(m: Mat, x: number, y: number): [number, number] {
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** CSS-style cubic bezier easing: returns y for a given x on the curve (0,0) (x1,y1) (x2,y2) (1,1). */
export function bezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    return x => {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        let t = x;
        for (let i = 0; i < 8; i++) {
            const err = ((ax * t + bx) * t + cx) * t - x, d = (3 * ax * t + 2 * bx) * t + cx;
            if (Math.abs(err) < 1e-5 || Math.abs(d) < 1e-6) break;
            t -= err / d;
        }
        t = Math.max(0, Math.min(1, t));
        return ((ay * t + by) * t + cy) * t;
    };
}

/**
 * Records a sample of a rotate drag: the samples of one 16 ms window (one frame, as `HandlerInertia` of MapLibre GL JS
 * has one entry for each frame) merge into one with the latest time and value, and samples older than 160 ms go.
 * `w` is the time at which the window of a sample begins, so that moves that are always less than 16 ms apart still
 * leave one sample for each window (#939).
 */
export function addTurnSample(samples: {t: number; x: number; y: number; w?: number}[], s: {t: number; x: number; y: number}) {
    const last = samples[samples.length - 1], w = last && s.t - (last.w ?? last.t) < 16 ? samples.pop()!.w ?? last.t : s.t;
    samples.push({...s, w});
    while (samples[0].t < s.t - 160) samples.shift();
}

/**
 * The samples that the inertia of a drag is measured between, as `HandlerInertia` of MapLibre GL JS takes them: the
 * first sample of the last 60 ms before the release (or the last but one) and the last sample. Samples older than
 * 160 ms do not count. Returns nothing when fewer than two samples are left.
 */
export function inertiaSpan<S extends {t: number}>(samples: S[], now: number): [S, S] | [] {
    samples = samples.filter(s => s.t >= now - 160);
    const last = samples[samples.length - 1], from = samples.find(s => now - s.t <= 60 && s !== last) ?? samples[samples.length - 2];
    return from ? [from, last] : [];
}

/**
 * The inertia after a rotate drag, as `HandlerInertia` of MapLibre GL JS computes it: the change of the bearing (`x`)
 * and the pitch (`y`) from the first sample of the last 60 ms (or the last but one) to the last sample, over the time
 * up to the release, gives a speed (at most 360 degrees per second for the bearing, 90 for the pitch) that decelerates
 * by 1000 degrees per second. Samples older than 160 ms count as in MapLibre GL JS: not at all. Returns the turn and the tilt still to come and the duration in ms, or nothing.
 */
export function turnInertia(samples: {t: number; x: number; y: number}[], now: number) {
    const [from, last] = inertiaSpan(samples, now);
    if (!from || !last) return;
    const speed = (d: number, max: number) => clamp(d * 300 / (now - from.t), -max, max), b = speed(last.x - from.x, 360), p = speed(last.y - from.y, 90);
    if (b || p) return {bearing: clamp(b * Math.abs(b) / 600, -179, 179), pitch: p * Math.abs(p) / 600, duration: Math.max(Math.abs(b), Math.abs(p)) * 10 / 3};
}
