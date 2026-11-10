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
    minZoom = 0;
    maxZoom = 22;

    get worldSize() { return TILE_SIZE * 2 ** this.zoom; }
    private get angle() { return -this.bearing * Math.PI / 180; }

    set(center: LngLatLike | undefined, zoom?: number, bearing?: number) {
        if (center) {
            const [lng, lat] = toLngLat(center);
            this.lng = lng;
            this.lat = clamp(lat, -MAX_LAT, MAX_LAT);
        }
        if (zoom !== undefined) this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
        if (bearing !== undefined) this.bearing = ((bearing + 180) % 360 + 360) % 360 - 180;
    }

    /** Mercator [0..1] coordinates to screen pixels. */
    mercToScreen(mx: number, my: number): [number, number] {
        const ws = this.worldSize, a = this.angle, cos = Math.cos(a), sin = Math.sin(a);
        const dx = (mx - mercX(this.lng)) * ws, dy = (my - mercY(this.lat)) * ws;
        return [cos * dx - sin * dy + this.width / 2, sin * dx + cos * dy + this.height / 2];
    }

    screenToMerc(px: number, py: number): [number, number] {
        const ws = this.worldSize, a = this.angle, cos = Math.cos(a), sin = Math.sin(a);
        const dx = px - this.width / 2, dy = py - this.height / 2;
        return [mercX(this.lng) + (cos * dx + sin * dy) / ws, mercY(this.lat) + (-sin * dx + cos * dy) / ws];
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
    coveringTiles(minzoom: number, maxzoom: number, tileSize = TILE_SIZE): TileID[] {
        const z = clamp(Math.floor(this.zoom + Math.log2(TILE_SIZE / tileSize)), minzoom, maxzoom), n = 2 ** z;
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
