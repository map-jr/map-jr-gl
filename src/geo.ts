export const EXTENT = 4096;
export const TILE_SIZE = 512;
const MAX_LAT = 85.051129;

/** 2D affine matrix in CSS `matrix(a b c d e f)` order: x' = a*x + c*y + e, y' = b*x + d*y + f. */
export type Mat = [number, number, number, number, number, number];
export type LngLatLike = [number, number] | {lng: number; lat: number};

export interface TileID { z: number; x: number; y: number; w: number; key: string }

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

    get worldSize() { return TILE_SIZE * 2 ** this.zoom; }
    private get angle() { return -this.bearing * Math.PI / 180; }

    set(center: LngLatLike | undefined, zoom?: number, bearing?: number, pitch?: number) {
        if (pitch !== undefined) this.pitch = clamp(pitch, 0, this.maxPitch);
        if (center) {
            const [lng, lat] = toLngLat(center);
            this.lng = lng;
            this.lat = clamp(lat, -MAX_LAT, MAX_LAT);
        }
        if (zoom !== undefined) this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
        if (bearing !== undefined) this.bearing = ((bearing + 180) % 360 + 360) % 360 - 180;
    }

    /** Distance from the camera to the map centre in pixels; fixes the field of view at MapLibre's 36.87 degrees. */
    get cameraDistance() { return 0.5 / Math.tan(0.6435011087932844 / 2) * this.height; }
    /** Pixels per metre of height at the map centre. */
    get pixelsPerMetre() { return this.worldSize / (40075016.686 * Math.cos(this.lat * Math.PI / 180)); }

    /**
     * The camera model, shared by every projection below. A point (dx, dy) pixels from the centre on the map plane
     * (and z pixels above it) is rotated by the bearing, tilted by the pitch, then seen in perspective from
     * `cameraDistance` away. With no pitch this reduces to the plain 2D rotation.
     */
    private view(dx: number, dy: number, z = 0): [number, number, number] {
        const a = this.angle, cos = Math.cos(a), sin = Math.sin(a), p = this.pitch * Math.PI / 180, d = this.cameraDistance;
        const rx = cos * dx - sin * dy, ry = sin * dx + cos * dy;
        const depth = d - ry * Math.sin(p) - z * Math.cos(p), k = d / depth;
        return [rx * k + this.width / 2, (ry * Math.cos(p) - z * Math.sin(p)) * k + this.height / 2, depth];
    }

    /** Mercator [0..1] coordinates to screen pixels. */
    mercToScreen(mx: number, my: number): [number, number] {
        const ws = this.worldSize, [x, y] = this.view((mx - mercX(this.lng)) * ws, (my - mercY(this.lat)) * ws);
        return [x, y];
    }

    /** Screen pixels to the mercator position on the ground under them. */
    screenToMerc(px: number, py: number): [number, number] {
        const ws = this.worldSize, a = this.angle, cos = Math.cos(a), sin = Math.sin(a), p = this.pitch * Math.PI / 180, d = this.cameraDistance;
        const sx = px - this.width / 2, sy = py - this.height / 2;
        // Invert the perspective for a point on the ground plane. Above the horizon there is no ground; clamp just below it.
        const denom = Math.max(Math.cos(p) * d + sy * Math.sin(p), d * 0.02);
        const ry = sy * d / denom, rx = sx * (d - ry * Math.sin(p)) / d;
        return [mercX(this.lng) + (cos * rx + sin * ry) / ws, mercY(this.lat) + (-sin * rx + cos * ry) / ws];
    }

    /** A point in a tile (tile units, optional height in metres) to screen pixels. */
    projectTile(id: TileID, x: number, y: number, metres = 0): [number, number] {
        const ws = this.worldSize, n = 2 ** id.z, s = ws / n / EXTENT;
        const [sx, sy] = this.view((id.x + id.w * n) * ws / n - mercX(this.lng) * ws + x * s, id.y * ws / n - mercY(this.lat) * ws + y * s, metres * this.pixelsPerMetre);
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
        const near = d / 10, far = d * 4, A = (far + near) / (far - near), B = -2 * far * near / (far - near);
        // Rows: X = kx * xc, Y = ky * yc, W = depth, Z = A * depth + B (so Z/W runs -1..1 from near to far).
        const X = [cos * s * kx, -sin * s * kx, 0, tx * kx];
        const Y = [sin * s * cp * ky, cos * s * cp * ky, -ppm * sp * ky, ty * cp * ky];
        const W = [-sin * s * sp, -cos * s * sp, -ppm * cp, d - ty * sp];
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
        const [mx, my] = this.screenToMerc(px, py);
        return [lngFromMerc(mx), latFromMerc(clamp(my, 0, 1))];
    }

    /** Move the camera so that `lngLat` sits under screen point (px, py). Used for zoom-around-cursor. */
    setLocationAt(lng: number, lat: number, px: number, py: number) {
        const [mx, my] = this.screenToMerc(px, py);
        const cx = mercX(this.lng) + mercX(lng) - mx;
        const cy = mercY(this.lat) + mercY(lat) - my;
        this.lng = lngFromMerc(cx);
        this.lat = clamp(latFromMerc(clamp(cy, 0, 1)), -MAX_LAT, MAX_LAT);
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
            cos * ox - sin * oy + this.width / 2, sin * ox + cos * oy + this.height / 2];
    }

    /** `tileSize` shifts the zoom level chosen: 256px tiles are fetched one level deeper than 512px ones. */
    coveringTiles(minzoom: number, maxzoom: number, tileSize = TILE_SIZE, round = false): TileID[] {
        // Image tiles switch level at the half-way point (as MapLibre does) so they are never stretched more than about 1.4x.
        const z = clamp((round ? Math.round : Math.floor)(this.zoom + Math.log2(TILE_SIZE / tileSize)), minzoom, maxzoom), n = 2 ** z;
        if (this.pitch > 0.5) return this.coveringPitched(z);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [px, py] of [[0, 0], [this.width, 0], [0, this.height], [this.width, this.height]]) {
            const [mx, my] = this.screenToMerc(px, py);
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
        const quad = [[0, 0], [this.width, 0], [this.width, this.height], [0, this.height]].map(([x, y]) => this.screenToMerc(x, y));
        const d = this.cameraDistance, ws = this.worldSize, cx = mercX(this.lng), cy = mercY(this.lat);
        const depthAt = (mx: number, my: number) => this.view((mx - cx) * ws, (my - cy) * ws)[2];
        // Separating-axis test between the ground trapezoid and a tile's square.
        const overlaps = (x0: number, y0: number, x1: number, y1: number) => {
            if (Math.max(...quad.map(q => q[0])) < x0 || Math.min(...quad.map(q => q[0])) > x1 || Math.max(...quad.map(q => q[1])) < y0 || Math.min(...quad.map(q => q[1])) > y1) return false;
            for (let i = 0; i < 4; i++) {
                const [ax, ay] = quad[i], [bx, by] = quad[(i + 1) % 4], nx = by - ay, ny = ax - bx;
                const side = (x: number, y: number) => (x - ax) * nx + (y - ay) * ny;
                const inside = Math.sign(side(quad[(i + 2) % 4][0], quad[(i + 2) % 4][1]));
                if ([[x0, y0], [x1, y0], [x1, y1], [x0, y1]].every(([x, y]) => Math.sign(side(x, y)) === -inside)) return false;
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
