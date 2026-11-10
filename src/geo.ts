export const EXTENT = 4096;
export const TILE_SIZE = 512;
const MAX_LAT = 85.051129;

/** 2D affine matrix in CSS `matrix(a b c d e f)` order: x' = a*x + c*y + e, y' = b*x + d*y + f. */
export type Mat = [number, number, number, number, number, number];
export type LngLatLike = [number, number] | {lng: number; lat: number};

export interface TileID { z: number; x: number; y: number; w: number; key: string }

/** With 3D terrain, heights are kept on the CPU as one grid of this many samples a side per elevation tile. */
export const HEIGHT_GRID = 128;
/**
 * Ground height in metres at a mercator position, from height grids keyed "z/x/y": the deepest one at or above
 * zoom `from` that covers the point, or `unknown` if there is none.
 */
export function groundHeight(grids: Map<string, Float32Array>, mx: number, my: number, from: number, to = 0, unknown = 0): number {
    mx -= Math.floor(mx);
    for (let z = from; z >= to; z--) {
        const n = 2 ** z, h = grids.get(`${z}/${Math.floor(mx * n)}/${Math.floor(my * n)}`);
        if (!h) continue;
        const G = HEIGHT_GRID, fx = clamp((mx * n % 1) * G - 0.5, 0, G - 1), fy = clamp((my * n % 1) * G - 0.5, 0, G - 1);
        const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(G - 1, x0 + 1), y1 = Math.min(G - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
        return (h[y0 * G + x0] * (1 - tx) + h[y0 * G + x1] * tx) * (1 - ty) + (h[y1 * G + x0] * (1 - tx) + h[y1 * G + x1] * tx) * ty;
    }
    return unknown;
}

export const mercX = (lng: number) => (lng + 180) / 360;
export const mercY = (lat: number) => {
    const s = Math.sin(lat * Math.PI / 180);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};
export const lngFromMerc = (x: number) => x * 360 - 180;
export const latFromMerc = (y: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;

export function toLngLat(v: LngLatLike): [number, number] {
    return Array.isArray(v) ? v : [v.lng, v.lat];
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

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
    minZoom = 0;
    maxZoom = 22;
    maxPitch = 60;
    minPitch = 0;
    /**
     * Space at the edges (top, right, bottom, left, in pixels) covered by other things, such as a side panel. The map
     * centre, and the point the camera looks at, sit in the middle of what is left.
     */
    padding: [number, number, number, number] = [0, 0, 0, 0];
    /** Where on screen the map centre is drawn. */
    get cx() { return this.width / 2 + (this.padding[3] - this.padding[1]) / 2; }
    get cy() { return this.height / 2 + (this.padding[0] - this.padding[2]) / 2; }
    /** If set, the map centre is kept inside this box: west, south, east, north. */
    maxBounds: [number, number, number, number] | null = null;

    /**
     * With 3D terrain: the height of the ground at the map centre, in (exaggerated) metres. The camera looks at that
     * point rather than at sea level, so it rides over mountains instead of ending up inside them.
     */
    elevation = 0;
    /** With 3D terrain: (exaggerated) ground height in metres at a mercator position, used to lift labels onto the surface. */
    heightAt?: (mx: number, my: number) => number;
    /** With 3D terrain: the lowest and highest ground in view, in the same metres. Tile selection covers both extremes. */
    groundRange?: [number, number];

    get worldSize() { return TILE_SIZE * 2 ** this.zoom; }
    private get angle() { return -this.bearing * Math.PI / 180; }

    set(center: LngLatLike | undefined, zoom?: number, bearing?: number, pitch?: number) {
        if (pitch !== undefined) this.pitch = clamp(pitch, this.minPitch, this.maxPitch);
        if (center) [this.lng, this.lat] = toLngLat(center);
        this.constrain();
        if (zoom !== undefined) this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
        if (bearing !== undefined) this.bearing = ((bearing + 180) % 360 + 360) % 360 - 180;
    }

    /** Keeps the centre on the map, and inside `maxBounds` if there are any. */
    constrain() {
        this.lat = clamp(this.lat, -MAX_LAT, MAX_LAT);
        const b = this.maxBounds;
        if (b) { this.lng = clamp(this.lng, b[0], b[2]); this.lat = clamp(this.lat, b[1], b[3]); }
    }

    /** Distance from the camera to the map centre in pixels; fixes the field of view at MapLibre's 36.87 degrees. */
    get cameraDistance() { return 0.5 / Math.tan(0.6435011087932844 / 2) * this.height; }
    /** Pixels per metre of height at the map centre. */
    get pixelsPerMetre() { return this.worldSize / (40075016.686 * Math.cos(this.lat * Math.PI / 180)); }

    /**
     * The camera model, shared by every projection below. A point (dx, dy) pixels from the centre on the map plane
     * (and z pixels above the height of the ground at the centre) is rotated by the bearing, tilted by the pitch, then seen in perspective from
     * `cameraDistance` away. With no pitch this reduces to the plain 2D rotation.
     */
    private view(dx: number, dy: number, z = 0): [number, number, number] {
        const a = this.angle, cos = Math.cos(a), sin = Math.sin(a), p = this.pitch * Math.PI / 180, d = this.cameraDistance;
        const rx = cos * dx - sin * dy, ry = sin * dx + cos * dy;
        const depth = d - ry * Math.sin(p) - z * Math.cos(p), k = d / depth;
        return [rx * k + this.cx, (ry * Math.cos(p) - z * Math.sin(p)) * k + this.cy, depth];
    }

    /** Mercator [0..1] coordinates to screen pixels (on the ground surface, with 3D terrain). */
    mercToScreen(mx: number, my: number): [number, number] {
        const z = this.heightAt ? (this.heightAt(mx, my) - this.elevation) * this.pixelsPerMetre : 0;
        const ws = this.worldSize, [x, y] = this.view((mx - mercX(this.lng)) * ws, (my - mercY(this.lat)) * ws, z);
        return [x, y];
    }

    /** Screen pixels to the mercator position on the ground under them (`z` pixels above the height of the map centre). */
    screenToMerc(px: number, py: number, z = 0): [number, number] {
        const ws = this.worldSize, a = this.angle, cos = Math.cos(a), sin = Math.sin(a), p = this.pitch * Math.PI / 180, d = this.cameraDistance;
        const sx = px - this.cx, sy = py - this.cy;
        // Invert the perspective for a point on that plane. Above the horizon there is no ground; clamp just below it.
        const denom = Math.max(Math.cos(p) * d + sy * Math.sin(p), d * 0.02);
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
        if (!this.heightAt || this.pitch < 1) return false;
        const p = this.pitch * Math.PI / 180, d = this.cameraDistance, ws = this.worldSize, ppm = this.pixelsPerMetre, a = this.angle;
        // The camera sits back from the map centre along the view direction, above the ground there.
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
        // Ground level with the camera or above it has no sensible footprint, so heights are capped well below the camera.
        const ppm = this.pixelsPerMetre, top = this.cameraDistance * Math.cos(this.pitch * Math.PI / 180) * 0.6;
        const planes = this.groundRange ? this.groundRange.map(h => Math.min(top, (h - this.elevation) * ppm)) : [0];
        return planes.map(z => [[0, 0], [this.width, 0], [this.width, this.height], [0, this.height]].map(([x, y]) => this.screenToMerc(x, y, z)));
    }

    /** A point in a tile (tile units, optional height in metres) to screen pixels. */
    projectTile(id: TileID, x: number, y: number, metres?: number): [number, number] {
        const ws = this.worldSize, n = 2 ** id.z, s = ws / n / EXTENT;
        metres ??= this.heightAt ? this.heightAt((id.x + x / EXTENT) / n, (id.y + y / EXTENT) / n) : this.elevation;
        const [sx, sy] = this.view((id.x + id.w * n) * ws / n - mercX(this.lng) * ws + x * s, id.y * ws / n - mercY(this.lat) * ws + y * s, (metres - this.elevation) * this.pixelsPerMetre);
        return [sx, sy];
    }

    /** Tile units (x, y) and metres (z) to clip space, as a column-major 4x4 matrix for the GPU. */
    tileMatrix4(id: TileID): Float32Array {
        const ws = this.worldSize, n = 2 ** id.z, s = ws / n / EXTENT;
        const a = this.angle, cos = Math.cos(a), sin = Math.sin(a), p = this.pitch * Math.PI / 180, cp = Math.cos(p), sp = Math.sin(p);
        const d = this.cameraDistance, ppm = this.pixelsPerMetre;
        const ox = (id.x + id.w * n) * ws / n - mercX(this.lng) * ws, oy = id.y * ws / n - mercY(this.lat) * ws;
        const tx = cos * ox - sin * oy, ty = sin * ox + cos * oy, kx = 2 * d / this.width, ky = -2 * d / this.height;
        // A tight depth range (everything visible at the steepest pitch fits) keeps depth precise even in a 16-bit buffer.
        // With 3D terrain, ground far below the map centre is seen from higher up and so reaches further away.
        const drop = this.groundRange ? Math.max(0, this.elevation - this.groundRange[0]) * ppm : 0;
        const near = d / 10, far = Math.min(60, 4 * (1 + drop / (d * cp))) * d, A = (far + near) / (far - near), B = -2 * far * near / (far - near);
        // Rows: X = kx * xc, Y = ky * yc, W = depth, Z = A * depth + B (so Z/W runs -1..1 from near to far).
        const X = [cos * s * kx, -sin * s * kx, 0, tx * kx];
        const Y = [sin * s * cp * ky, cos * s * cp * ky, -ppm * sp * ky, ty * cp * ky];
        const W = [-sin * s * sp, -cos * s * sp, -ppm * cp, d - ty * sp];
        // The ground at the map centre sits at height `elevation`: shift everything down by that much.
        Y[3] -= Y[2] * this.elevation; W[3] -= W[2] * this.elevation;
        // Padding moves the point the camera looks at away from the middle of the screen.
        const px = (this.cx - this.width / 2) * 2 / this.width, py = (this.cy - this.height / 2) * 2 / this.height;
        for (let i = 0; i < 4; i++) { X[i] += W[i] * px; Y[i] -= W[i] * py; }
        const Z = [A * W[0], A * W[1], A * W[2], A * W[3] + B];
        return new Float32Array([X[0], Y[0], Z[0], W[0], X[1], Y[1], Z[1], W[1], X[2], Y[2], Z[2], W[2], X[3], Y[3], Z[3], W[3]]);
    }

    project(lng: number, lat: number): [number, number] {
        // Pick the world copy nearest the centre so markers stay put across the antimeridian.
        let mx = mercX(lng);
        const cx = mercX(this.lng);
        mx += Math.round(cx - mx);
        return this.mercToScreen(mx, mercY(lat));
    }

    unproject(px: number, py: number): [number, number] {
        const [mx, my] = this.screenToGround(px, py);
        return [lngFromMerc(mx), latFromMerc(clamp(my, 0, 1))];
    }

    /** Screen pixels to the position under them on the level plane through the map centre (ignoring 3D terrain). */
    unprojectFlat(px: number, py: number): [number, number] {
        const [mx, my] = this.screenToMerc(px, py);
        return [lngFromMerc(mx), latFromMerc(clamp(my, 0, 1))];
    }

    /** With 3D terrain: where the camera itself is (mercator), and its height in the same metres as the terrain. */
    cameraPosition(): [number, number, number] {
        const p = this.pitch * Math.PI / 180, d = this.cameraDistance, back = d * Math.sin(p) / this.worldSize, a = this.angle;
        return [mercX(this.lng) + Math.sin(a) * back, mercY(this.lat) + Math.cos(a) * back, this.elevation + d * Math.cos(p) / this.pixelsPerMetre];
    }

    /**
     * With 3D terrain: makes the map centre the point of ground the camera is actually looking at, without moving
     * the camera. The centre slides along the line of sight to the surface, and the zoom changes to match the new
     * distance, so the picture stays exactly as it was. (This is what MapLibre does when a movement ends.)
     * Returns whether anything changed.
     */
    recenterOnGround(): boolean {
        if (!this.heightAt) return false;
        const p = this.pitch * Math.PI / 180, d = this.cameraDistance, ppm = this.pixelsPerMetre;
        const [mx, my] = this.screenToGround(this.cx, this.cy), h = this.heightAt(mx, my), z = (h - this.elevation) * ppm;
        const dist = d - z / Math.cos(p); // camera to that point, in pixels at the current scale
        if (Math.abs(z) < 0.25 || dist < d * 0.05) return false;
        const lat = latFromMerc(clamp(my, 0, 1));
        // The same distance in metres must come out as `d` pixels at the new zoom and latitude.
        const zoom = Math.log2(d / (dist / ppm) * 40075016.686 * Math.cos(lat * Math.PI / 180) / TILE_SIZE);
        this.lng = lngFromMerc(mx); this.lat = clamp(lat, -MAX_LAT, MAX_LAT);
        this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
        this.elevation = h;
        return true;
    }

    /** Move the camera so that `lngLat` sits under screen point (px, py). Used for zoom-around-cursor. */
    setLocationAt(lng: number, lat: number, px: number, py: number, height?: number) {
        height ??= this.heightAt ? this.heightAt(mercX(lng), mercY(lat)) : this.elevation;
        const z = (height - this.elevation) * this.pixelsPerMetre;
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
    coveringTiles(minzoom: number, maxzoom: number, tileSize = TILE_SIZE, round = false): TileID[] {
        // Image tiles switch level at the half-way point (as MapLibre does) so they are never stretched more than about 1.4x.
        const want = (round ? Math.round : Math.floor)(this.zoom + Math.log2(TILE_SIZE / tileSize));
        // Below a source's minimum zoom nothing is drawn (as in MapLibre); shrinking its coarsest tiles would mean
        // loading ever more of them the further out the map goes.
        if (want < minzoom) return [];
        const z = Math.min(want, maxzoom), n = 2 ** z;
        if (this.pitch > 0.5) return this.coveringPitched(z);
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

    /**
     * Tile cover for a tilted camera. The view is a trapezoid on the ground whose far edge covers much more area,
     * drawn much smaller, so tiles are chosen by descending a quadtree and stopping earlier the farther away a tile is.
     */
    private coveringPitched(maxZ: number): TileID[] {
        // The area to cover: the screen's footprint on the ground (with 3D terrain, the hull of its lowest and highest footprints).
        const pts = this.footprints().flat().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
        const cross = (o: number[], p: number[], q: number[]) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
        const half = (list: [number, number][]) => { const h: [number, number][] = []; for (const p of list) { while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop(); h.push(p); } h.pop(); return h; };
        const quad = pts.length > 4 ? [...half(pts), ...half([...pts].reverse())] : this.footprints()[0];
        const mid = [quad.reduce((t, q) => t + q[0], 0) / quad.length, quad.reduce((t, q) => t + q[1], 0) / quad.length];
        const d = this.cameraDistance, ws = this.worldSize, cx = mercX(this.lng), cy = mercY(this.lat);
        const depthAt = (mx: number, my: number) => this.view((mx - cx) * ws, (my - cy) * ws)[2];
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
            const near = Math.min(depthAt(clamp(cx, x0, x1), clamp(cy, y0, y1)), depthAt(x0, y0), depthAt(x1, y0), depthAt(x0, y1), depthAt(x1, y1));
            const wanted = maxZ - Math.max(0, Math.floor(Math.log2(Math.max(near, 1) / d) + 0.35));
            if (z >= maxZ || z >= wanted) { out.push({z, x, y, w, key: `${z}/${x}/${y}`}); return; }
            for (let i = 0; i < 4; i++) visit(z + 1, x * 2 + (i & 1), y * 2 + (i >> 1), w);
        };
        const w0 = Math.floor(Math.min(...quad.map(q => q[0]))), w1 = Math.floor(Math.max(...quad.map(q => q[0])));
        for (let w = w0; w <= w1; w++) visit(0, 0, 0, w);
        const dist = (t: TileID) => { const n = 2 ** t.z; return ((t.x + 0.5) / n + t.w - cx) ** 2 + ((t.y + 0.5) / n - cy) ** 2; };
        return out.sort((a, b) => dist(a) - dist(b));
    }
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
