/**
 * The globe projection (#463): the maths that puts the map on a sphere. `Transform` (geo.ts) uses it when its field
 * `globe` holds this module and the projection draws a globe at the zoom of the map (`Transform.globeness`). The
 * engine imports it with the rest of the engine; the page loads it on demand, only for a map with a globe.
 *
 * The method follows the globe of MapLibre GL JS 6.17 (BSD-3-Clause): the radius of the sphere makes the scale at the
 * center that of Mercator at the same zoom, one matrix per frame takes the unit sphere to clip space, a plane through
 * the horizon hides the far side, and between zoom 11 and 12 the position mixes with the Mercator position in clip
 * space. The code is new.
 */
import {EXTENT, TILE_SIZE, clamp, keepSize as sizeZoom, latFromMerc, lngFromMerc, mercX, mercY, type TileID, type Transform} from './geo.ts';

type V3 = [number, number, number];
const PI = Math.PI, RAD = PI / 180, EARTH = 6371008.8;
/** Column-major 4x4 matrices, as WebGL takes them. */
const mul = (a: number[], b: number[]) => {
    const o = new Array(16).fill(0);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    return o;
};
const rot = (axis: 0 | 1 | 2, a: number) => {
    const c = Math.cos(a), s = Math.sin(a), m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const [i, j] = axis === 0 ? [1, 2] : axis === 1 ? [2, 0] : [0, 1];
    m[i * 4 + i] = c; m[j * 4 + j] = c; m[i * 4 + j] = s; m[j * 4 + i] = -s;
    return m;
};
const move = (z: number) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, z, 1];
/** Turns a vector by the rotation part of a matrix. */
const turn = (m: number[], v: number[]): V3 => [0, 1, 2].map(r => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2]) as V3;
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** A Mercator position (0..1) on the unit sphere: x to the east at longitude 90°, y to the north, z out at longitude 0. */
export function sphere(mx: number, my: number): V3 {
    const a = (mx - 0.5) * 2 * PI, e = Math.exp(PI - my * 2 * PI), c = 2 * e / (e * e + 1);
    return [Math.sin(a) * c, (e * e - 1) / (e * e + 1), Math.cos(a) * c];
}

/** What one frame needs: the matrix from the unit sphere to clip space, the camera (in radii), and the plane of the horizon. */
export interface GlobeFrame { m: number[]; cam: V3; horizon: [number, number, number, number]; radius: number }
const frames = new WeakMap<Transform, {key: string; f: GlobeFrame}>();

/** The globe of a transform as it is now (kept until the camera or the size changes). */
export function frame(tr: Transform): GlobeFrame {
    const key = [tr.width, tr.height, tr.lng, tr.lat, tr.zoom, tr.bearing, tr.pitch, tr.elevation, ...tr.padding].join();
    const kept = frames.get(tr);
    if (kept?.key === key) return kept.f;
    // The radius in pixels: the scale at the center of the view is that of Mercator at the same zoom (as in MapLibre).
    // (Past the edge of Mercator the radius stays that of 85.05°, as MapLibre's planetScaleAtLatitude does.)
    const R = tr.worldSize / (2 * PI * Math.cos(Math.min(Math.abs(tr.lat), 85.051129) * RAD)), d = tr.cameraDistance, w = tr.width, h = tr.height;
    // (z and w of clip space are the distance along the view; the shader replaces z by the side of the horizon.)
    const proj = [2 * d / w, 0, 0, 0, 0, 2 * d / h, 0, 0, -(tr.cx - w / 2) * 2 / w, (tr.cy - h / 2) * 2 / h, -1, -1, 0, 0, 0, 0];
    // With 3D terrain the camera looks at the ground under the center: the sphere moves down by its height (`elevation`).
    const lift = 1 + tr.elevation / 6371008.8;
    const view = [move(-d), rot(0, -tr.pitch * RAD), rot(2, tr.bearing * RAD), move(-R * lift), rot(0, tr.lat * RAD), rot(1, -tr.lng * RAD), [R, 0, 0, 0, 0, R, 0, 0, 0, 0, R, 0, 0, 0, 0, 1]].reduce(mul);
    // The camera: the inverse of the view applied to the origin, in radii.
    let cam: number[] = [0, 0, d / R];
    cam = turn(rot(0, tr.pitch * RAD), cam); cam = turn(rot(2, -tr.bearing * RAD), cam); cam[2] += lift;
    cam = turn(rot(0, -tr.lat * RAD), cam); cam = turn(rot(1, tr.lng * RAD), cam);
    const len = Math.hypot(cam[0], cam[1], cam[2]);
    // A point p of the sphere is on the near side when dot(p, cam / |cam|) is at least 1 / |cam| (the tangent points).
    const f: GlobeFrame = {m: mul(proj, view), cam: cam as V3, horizon: [cam[0] / len, cam[1] / len, cam[2] / len, -1 / len], radius: R};
    frames.set(tr, {key, f});
    return f;
}

/** Clip-space x, y, w of a point of the unit sphere (lifted by `lift` radii). */
const clipOf = (f: GlobeFrame, s: number[], lift = 0) => {
    const k = 1 + lift, m = f.m, x = s[0] * k, y = s[1] * k, z = s[2] * k;
    return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[3] * x + m[7] * y + m[11] * z + m[15]];
};

/**
 * A Mercator position to screen pixels and the distance along the view, mixed with the Mercator position `flat`
 * ([x, y, depth] in pixels) by `globeness` in clip space, as the shader does.
 */
export function toScreen(tr: Transform, mx: number, my: number, metres: number, flat: [number, number, number]): [number, number, number] {
    const f = frame(tr), t = tr.globeness, g = clipOf(f, sphere(mx, my), metres / 6371008.8);
    const fx = (flat[0] / tr.width * 2 - 1) * flat[2], fy = (1 - flat[1] / tr.height * 2) * flat[2];
    const x = fx + (g[0] - fx) * t, y = fy + (g[1] - fy) * t, w = flat[2] + (g[2] - flat[2]) * t;
    return [(x / w + 1) / 2 * tr.width, (1 - y / w) / 2 * tr.height, w];
}

/** The side of the horizon of a Mercator position, in radii: negative where the horizon hides it. */
export function side(tr: Transform, mx: number, my: number, h = frame(tr).horizon): number {
    return dot(sphere(mx, my), h) + h[3];
}

/** Whether the horizon hides a Mercator position (with a margin of `slack` radii). */
export const hidden = (tr: Transform, mx: number, my: number, slack = 0) => side(tr, mx, my) < -slack;

/**
 * The bounds of what the globe shows [west, south, east, north], as MapLibre GL JS gives them: points along the
 * edges of the screen (a point off the globe gives the nearest point of the horizon, so the visible edge of the globe
 * is in), measured from the center; a pole in view makes the bounds reach it, with all longitudes.
 */
export function bounds(tr: Transform): [number, number, number, number] {
    const f = frame(tr), w = tr.width, h = tr.height, N = 16;
    let west = 0, east = 0, south = 90, north = -90;
    for (let i = 0; i <= N; i++) for (const [px, py] of [[w * i / N, 0], [w * i / N, h], [0, h * i / N], [w, h * i / N]]) {
        const [mx, my] = toMerc(tr, px, py), lat = latFromMerc(my), d = ((lngFromMerc(mx) - tr.lng) % 360 + 540) % 360 - 180;
        west = Math.min(west, d); east = Math.max(east, d); south = Math.min(south, lat); north = Math.max(north, lat);
    }
    for (const pole of [1, -1]) {
        const p = [0, pole, 0], c = clipOf(f, p);
        if (dot(p, f.horizon) + f.horizon[3] < 0 || c[2] <= 0) continue;
        const x = (c[0] / c[2] + 1) / 2 * w, y = (1 - c[1] / c[2]) / 2 * h;
        if (x < 0 || x > w || y < 0 || y > h) continue;
        if (pole > 0) north = 90; else south = -90;
        west = -180 - tr.lng; east = 180 - tr.lng;
    }
    return [tr.lng + west, Math.max(-90, south), tr.lng + east, Math.min(90, north)];
}

/** The direction of the ray through a screen point, in the space of the sphere. */
/** A vector of the camera's view in the space of the sphere. */
const view = (tr: Transform, v: number[]) => {
    v = turn(rot(0, tr.pitch * RAD), v); v = turn(rot(2, -tr.bearing * RAD), v);
    return turn(rot(1, tr.lng * RAD), turn(rot(0, -tr.lat * RAD), v));
};

function ray(tr: Transform, px: number, py: number): V3 {
    const d = tr.cameraDistance, v = view(tr, [(px - tr.cx) / d, (tr.cy - py) / d, -1]), l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
}

/** The rays of the screen as a 3×3 matrix (columns): the ray through screen pixels x, y is `rays · (x, y, 1)`, not of unit length. */
export function rays(tr: Transform): number[] {
    const d = tr.cameraDistance;
    return [...view(tr, [1 / d, 0, 0]), ...view(tr, [0, -1 / d, 0]), ...view(tr, [-tr.cx / d, tr.cy / d, -1])];
}

/** Screen pixels to the Mercator position of the globe there; off the globe, the nearest point of the horizon (as in MapLibre). */
export function toMerc(tr: Transform, px: number, py: number, metres = tr.elevation): [number, number] {
    const [lng, lat] = toLngLat(tr, px, py, metres);
    return [mercX(lng), mercY(clamp(lat, -85.051129, 85.051129))];
}

/** Screen pixels to the position on the globe there, with the latitude up to ±90° (as MapLibre's unprojectScreenPoint). */
export function toLngLat(tr: Transform, px: number, py: number, metres = tr.elevation): [number, number] {
    const p = surface(tr, px, py, 1 + metres / 6371008.8);
    // (A globe has one world: the longitude is between -180 and 180, as in MapLibre GL JS.)
    return [Math.atan2(p[0], p[2]) / RAD, Math.asin(clamp(p[1], -1, 1)) / RAD];
}

/** Screen pixels to the point of the sphere of radius `r` there, scaled to the unit sphere, also past 85.05° (off the globe, the nearest point of the horizon). */
function surface(tr: Transform, px: number, py: number, r = 1): V3 {
    const {cam} = frame(tr), dir = ray(tr, px, py), b = dot(cam, dir), c = dot(cam, cam) - r * r, disc = b * b - c;
    let p: number[];
    if (disc >= 0 && -b - Math.sqrt(disc) > 0) { const t = -b - Math.sqrt(disc); p = cam.map((v, i) => (v + dir[i] * t) / r); }
    else {
        // The point of the horizon in the plane of the camera, the center of the globe and the ray.
        const cl = Math.hypot(...cam), u = cam.map(v => v / cl), q = cam.map((v, i) => v + dir[i] * Math.max(0, -b)), along = dot(q, u);
        const side = q.map((v, i) => v - u[i] * along), sl = Math.hypot(...side) || 1, hd = 1 / cl, r = Math.sqrt(Math.max(0, 1 - hd * hd));
        p = u.map((v, i) => v * hd + side[i] / sl * r);
    }
    return p as V3;
}

/**
 * Turns the globe so that the place lng, lat comes under the screen point (a drag, or a zoom around the pointer).
 * A few steps of a fixed-point iteration: each step moves the center by the angle between where the place is and
 * where it should be. A change of latitude changes the zoom so that the planet keeps its size (MapLibre's
 * `getZoomAdjustment`), when `keepSize` is set.
 */
export function turnTo(tr: Transform, lng: number, lat: number, px: number, py: number, keepSize = true) {
    const lat0 = tr.lat, zoom0 = tr.zoom;
    for (let i = 0; i < 12; i++) {
        const [mx, my] = toMerc(tr, px, py), dl = ((lng - lngFromMerc(mx)) % 360 + 540) % 360 - 180, dp = lat - latFromMerc(my);
        if (Math.abs(dl) < 1e-9 && Math.abs(dp) < 1e-9) break;
        tr.lng = ((tr.lng + dl + 540) % 360 + 360) % 360 - 180;
        tr.lat = clamp(tr.lat + dp, -85.051129, 85.051129);
        if (keepSize) tr.zoom = clamp(zoom0 + sizeZoom(lat0, tr.lat), tr.minZoom, tr.maxZoom);
    }
}

/**
 * The point of the sphere that a drag aims at for a screen point (MapLibre's `panSurfaceLocation`): the point under
 * it, except within the outer tenth of the angle to the horizon, where the curve eases off and stops short of the far
 * side. (Exact tracking would race away there: the edge of the globe has degrees of the globe in each pixel.)
 */
function aim(tr: Transform, px: number, py: number): V3 {
    const {cam} = frame(tr), dist = Math.hypot(...cam), dir = ray(tr, px, py);
    // (Not through Mercator, which ends at 85.05°: a pointer over the area around a pole aims at the place there.)
    const exact = () => surface(tr, px, py);
    if (dist <= 1) return exact();
    const u = cam.map(v => v / dist), c = -dot(dir, u), lateral = dir.map((v, i) => v + u[i] * c), s = Math.hypot(...lateral);
    if (s < 1e-9) return exact();
    const angle = Math.atan2(s, c), handover = Math.asin(1 / dist) * 0.9;
    if (angle < handover) return exact();
    const sinH = dist * Math.sin(handover), atHandover = Math.asin(clamp(sinH, -1, 1)) - handover;
    const slope = dist * Math.cos(handover) / Math.sqrt(Math.max(1 - sinH * sinH, 1e-12)) - 1, room = PI * 0.98 - atHandover, excess = angle - handover;
    const target = clamp(atHandover + room * (slope * excess) / (room + slope * excess), 0, PI * 0.98);
    const p = u.map((v, i) => v * Math.cos(target) + lateral[i] / s * Math.sin(target)), l = Math.hypot(...p);
    return p.map(v => v / l) as V3;
}

/** The unit vector of a place, in the frame of `sphere`. */
const toVector = (lng: number, lat: number): V3 => [Math.sin(lng * RAD) * Math.cos(lat * RAD), Math.sin(lat * RAD), Math.cos(lng * RAD) * Math.cos(lat * RAD)];
/** Turns a vector about a unit axis by an angle (Rodrigues). */
const rotate = (v: V3, k: V3, a: number): V3 => {
    const c = Math.cos(a), s = Math.sin(a), kv = dot(k, v);
    return [0, 1, 2].map(i => v[i] * c + (k[(i + 1) % 3] * v[(i + 2) % 3] - k[(i + 2) % 3] * v[(i + 1) % 3]) * s + k[i] * kv * (1 - c)) as V3;
};

/**
 * One step of a drag on the globe, from the pointer at (x0, y0) to (x1, y1), as MapLibre GL JS 6.17 does it
 * (`versorSetLocationAtPoint`): the globe turns by the shortest rotation that takes the place aimed at under the old
 * pointer to the new pointer, and the bearing stays. Near a pole the pointer turns the globe like a dial around the
 * pole, so the drag stays smooth there. The zoom changes with the latitude, so that the planet keeps its size.
 */
export function drag(tr: Transform, x0: number, y0: number, x1: number, y1: number) {
    // (A pointer off the globe turns it as a drag of the same length at the center of the view does, as in MapLibre.)
    const {cam} = frame(tr), dir = ray(tr, x1, y1), b = dot(cam, dir);
    if (b * b - dot(cam, cam) + 1 < 0 || b > 0) { x0 = tr.cx - (x1 - x0); y0 = tr.cy - (y1 - y0); x1 = tr.cx; y1 = tr.cy; }
    const from = aim(tr, x0, y0), to = aim(tr, x1, y1), axis = [from[1] * to[2] - from[2] * to[1], from[2] * to[0] - from[0] * to[2], from[0] * to[1] - from[1] * to[0]], l = Math.hypot(...axis);
    if (l < 1e-12) return;
    const k = axis.map(v => v / l) as V3, angle = Math.acos(clamp(dot(from, to), -1, 1));
    // The camera moves the other way: the center turns by the rotation from `to` back to `from`.
    const oldLng = tr.lng, oldLat = tr.lat, oldZoom = tr.zoom, c = rotate(toVector(oldLng, oldLat), k, -angle);
    let lat = Math.asin(clamp(c[1], -1, 1)) / RAD;
    const swingLng = Math.atan2(c[0], c[2]) / RAD;
    // A swing over a pole turns the north of the view around: with the bearing held, the center stops at the pole.
    const north = (lng: number, la: number): V3 => [-Math.sin(la * RAD) * Math.sin(lng * RAD), Math.cos(la * RAD), -Math.sin(la * RAD) * Math.cos(lng * RAD)];
    if (dot(rotate(north(oldLng, oldLat), k, -angle), north(swingLng, lat)) < 0) lat = lat > 0 ? 90 : -90;
    // Within 12 degrees of the edge of the Mercator world, the longitude comes more and more from the turn of the
    // pointer around the pole on the screen (MapLibre's dial).
    const t = clamp(1 - (85.051129 - Math.abs(oldLat)) / 12, 0, 1), dial = t * t * (3 - 2 * t), poleSign = oldLat >= 0 ? 1 : -1;
    let dialLng = 0;
    if (dial > 0) {
        const f = frame(tr), p = clipOf(f, [0, poleSign, 0]), px = (p[0] / p[2] + 1) / 2 * tr.width, py = (1 - p[1] / p[2]) / 2 * tr.height;
        const rx = x1 - px, ry = y1 - py;
        dialLng = poleSign * (rx * (y1 - y0) - ry * (x1 - x0)) / Math.max(rx * rx + ry * ry, 400) / RAD;
    }
    const swing = ((swingLng - oldLng) % 360 + 540) % 360 - 180;
    tr.lng = ((oldLng + (1 - dial) * swing + dial * dialLng) % 360 + 540) % 360 - 180;
    // (The caller keeps the center inside the latitudes that the zoom allows: see `constrain`.)
    tr.lat = clamp(lat, -90, 90);
    // (Past the edge of Mercator the radius stays that of 85.05°, so the zoom stays too: see `keepSize` in geo.ts.)
    tr.zoom = clamp(oldZoom + sizeZoom(oldLat, tr.lat), tr.minZoom, tr.maxZoom);
}


/**
 * The tiles that the globe shows, nearest first: a quadtree from zoom 0 in one world. A tile is left out when all its
 * sample points are behind the horizon (with the bulge of a large tile), or outside the view, or when a hull around it
 * is more than 60 pixels outside one edge of the view, as MapLibre GL JS 6.17 culls a volume around the tile (#1922).
 * The level that a tile gets falls with the distance from the camera to its nearest sample point, as with 3D terrain
 * (geo.ts). Below zoom 5 it is often lower than in MapLibre GL JS 6.17, on purpose (#1828, #2061). Measured at latitude 0
 * and pitch 0 on a map of 497x509 pixels, with the same result at DPR 1 and 2: a vector source (512 px, `round` false)
 * gets the level of MapLibre GL JS at zoom 0.5, 1 and 1.5 and one level lower at zoom 2.5 (z1 for z2). A raster source
 * (256 px, `round` true) gets one level lower at zoom 0.5, 1 and 2.5 (z1 for z2, z3 for z4) and two levels lower at
 * zoom 1.5 (z1 for z3).
 */
export function covering(tr: Transform, minzoom: number, maxzoom: number, tileSize: number, round: boolean, cap = 160): TileID[] {
    const f = frame(tr), exact = tr.zoom + Math.log2(TILE_SIZE / tileSize), out: (TileID & {near: number})[] = [];
    // The camera distance in radii, at which the tile of the zoom of the map is wanted.
    const unit = tr.cameraDistance / f.radius, margin = 0.15, edge = [1 + 120 / tr.width, 1 + 120 / tr.height];
    // The lowest and highest ground in view, in meters (the sphere of `frame` is at sea level).
    const [lo, hi] = tr.groundRange ?? [tr.elevation, tr.elevation];
    // The point of the sphere under the camera, in Mercator units: the nearest point of a tile is its point nearest to this one.
    const cl = Math.hypot(...f.cam), under = [mercX(Math.atan2(f.cam[0], f.cam[2]) / RAD), mercY(clamp(Math.asin(f.cam[1] / cl) / RAD, -85.051129, 85.051129))];
    // The places under nine points of the screen: a tile that has one of them is in view, however large it is.
    const seen: number[][] = [];
    for (const sx of [0, 0.5, 1]) for (const sy of [0, 0.5, 1]) seen.push(toMerc(tr, sx * tr.width, sy * tr.height));
    const has = (x: number, y: number, n: number, p: number[]) => { const px = (p[0] - Math.floor(p[0])) * n, py = p[1] * n; return px >= x && px <= x + 1 && py >= y && py <= y + 1; };
    const visit = (z: number, x: number, y: number) => {
        const n = 2 ** z, pts: number[][] = [];
        // Sample points of the tile (5 x 5, and the pole for a tile at the edge of the world). A tile is in view when one
        // of them is on the near side of the horizon and on the screen, or when it has a place under the screen.
        for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) pts.push(sphere((x + i / 4) / n, (y + j / 4) / n));
        if (y === 0) pts.push([0, 1, 0]);
        if (y === n - 1) pts.push([0, -1, 0]);
        const inView = seen.some(p => has(x, y, n, p)) || pts.some(p => {
            if (dot(p, f.horizon) + f.horizon[3] < -1e-3) return false;
            const c = clipOf(f, p);
            return c[2] > 1e-6 && Math.abs(c[0] / c[2]) <= 1 + margin && Math.abs(c[1] / c[2]) <= 1 + margin;
        });
        // The tile is also left out when all of a hull around it is more than 60 pixels outside one edge of the view (#1922),
        // so that a label of a tile at the edge can still reach the screen. The hull has the sample points and a row 1/16 of
        // a tile past the edge toward the equator (where the parallel bows out of the hull), at the lowest ground of 3D
        // terrain, and these points at the highest ground, lifted above the bulge of the sphere between them.
        const lifts = [lo / EARTH, (1 + hi / EARTH) / Math.cos(PI / 2 ** (z + 1)) - 1], hull = [...pts, ...[0, 1, 2, 3, 4].map(i => sphere((x + i / 4) / n, (y < n / 2 ? y + 1 + 1 / 16 : y - 1 / 16) / n))];
        if (!inView || z > 1 && [0, 1, 2, 3].some(k => hull.every(p => lifts.every(l => { const c = clipOf(f, p, l); return (k & 2 ? c[k & 1] : -c[k & 1]) > c[2] * edge[k & 1]; })))) return;
        const ux = under[0] - Math.floor(under[0] - x / n + 0.5 - 0.5 / n), nearest = sphere(clamp(ux, x / n, (x + 1) / n), clamp(under[1], y / n, (y + 1) / n));
        const near = Math.min(...[...pts, nearest].map(p => Math.hypot(p[0] - f.cam[0], p[1] - f.cam[1], p[2] - f.cam[2])));
        // A tile far from the latitude of the center has other pixels on the sphere: Mercator tiles get smaller toward
        // the poles, by the cosine of the latitude (pts[12] is the middle of the tile).
        const cos = Math.max(1e-3, Math.sqrt(1 - pts[12][1] ** 2)) / Math.cos(Math.min(Math.abs(tr.lat), 85.051129) * RAD);
        const wanted = Math.min(maxzoom, (round ? Math.round : Math.floor)(exact + Math.log2(unit / Math.max(near, 1e-9) * cos)));
        if (z >= maxzoom || z >= wanted) { if (z >= minzoom) out.push({z, x, y, w: 0, key: `${z}/${x}/${y}`, near}); return; }
        for (let i = 0; i < 4; i++) visit(z + 1, x * 2 + (i & 1), y * 2 + (i >> 1));
    };
    visit(0, 0, 0);
    return out.sort((a, b) => a.near - b.near).slice(0, cap).map(({near: _, ...t}) => t);
}

/** The position of a tile in Mercator units, for the shader: x and y of its corner and the size of a tile unit. */
export const tileMerc = (id: TileID): [number, number, number, number] => {
    const n = 2 ** id.z;
    return [id.x / n, id.y / n, 1 / n / EXTENT, 1 / n / EXTENT];
};

/**
 * The globe (#463): the variant of a map-space program that is compiled with `#define GLOBE` puts tile units on the
 * unit sphere (u_tileMerc: the corner of the tile in Mercator units and the size of a tile unit), takes them to clip
 * space with u_globe, and mixes that with the Mercator position of u_matrix by u_globeness (between zoom 11 and 12).
 * z becomes the side of the plane of the horizon (u_horizon), so that the GPU clips away the far side of the globe.
 * The y values -32768 and 32767 are the poles (see subdivide.ts). The method follows MapLibre GL JS (BSD-3-Clause).
 * Without `GLOBE` the programs are exactly those of a Mercator map. The text is here, in the part of the globe that
 * loads on demand, and the renderer puts it in the place of `GLOBE_GLSL` in `VS_COMMON` (gl.ts) when it links a program
 * for the globe.
 */
export const GLOBE_GLSL = `uniform mat4 u_globe; uniform vec4 u_horizon; uniform float u_globeness; uniform vec4 u_tileMerc; uniform float u_cosLat;
const float GLOBE_PI = 3.141592653589793;
bool isPole(vec2 t) { return t.y < -32767.5 || t.y > 32766.5; }
// A pole vertex on the border of its tile (for the clip test, and for the Mercator position in the change to the globe).
vec2 unpole(vec2 t) { return vec2(t.x, t.y < -32767.5 ? 0.0 : t.y > 32766.5 ? ${EXTENT}.0 : t.y); }
vec3 toSphere(vec2 t) {
  if (t.y < -32767.5) return vec3(0.0, 1.0, 0.0);
  if (t.y > 32766.5) return vec3(0.0, -1.0, 0.0);
  vec2 m = u_tileMerc.xy + u_tileMerc.zw * t;
  // (exp and rational arithmetic, not atan and sin: as precise near the equator as MapLibre's formula.)
  float e = exp(GLOBE_PI - m.y * 2.0 * GLOBE_PI), a = (m.x - 0.5) * 2.0 * GLOBE_PI, c = 2.0 * e / (e * e + 1.0);
  return vec3(sin(a) * c, (e * e - 1.0) / (e * e + 1.0), cos(a) * c);
}
// f is the Mercator position in clip space, s the point on the sphere (a radius of 1 is the ground).
vec4 mixClip(vec4 f, vec3 s, bool pole) {
  vec4 g = u_globe * vec4(s, 1.0);
  g.z = (1.0 - dot(s, u_horizon.xyz) - u_horizon.w) * g.w;
  if (u_globeness >= 1.0) return g;
  vec4 r = vec4(mix(f.xy, g.xy, u_globeness), mix(0.0, g.z, clamp((u_globeness - 0.2) / 0.8, 0.0, 1.0)), mix(f.w, g.w, u_globeness));
  // The caps at the poles show only in the last 2 percent of the change to the globe.
  if (pole && u_globeness < 0.98) r.z = 2.0 * r.w;
  return r;
}
vec4 toClip3(vec2 t, float h) {
  return mixClip(u_matrix * vec4(isPole(t) ? vec2(t.x, t.y < 0.0 ? 0.0 : ${EXTENT}.0) : t, h, 1.0), toSphere(t) * (1.0 + h / 6371008.8), isPole(t));
}
vec4 toClip(vec2 t) { return toClip3(t, 0.0); }
// The point t moved by o tile units in the plane that touches the sphere at t, as a circle with circle-pitch-alignment
// 'map' is drawn (MapLibre's globeRotateVector): the offset is an angle, the same at every latitude, and the quad
// lies flat on the sphere, so that it is foreshortened toward the edge of the globe.
vec4 toClipTurn(vec2 t, vec2 o, float h) {
  vec3 v = toSphere(t), r = normalize(vec3(v.z, 0.0, -v.x)), d = normalize(cross(r, v));
  vec2 a = tan(o * u_tileMerc.zw * 2.0 * GLOBE_PI * u_cosLat);
  return mixClip(u_matrix * vec4(t + o, h, 1.0), normalize(v + r * a.x + d * a.y) * (1.0 + h / 6371008.8), false);
}
// Buildings get a depth, so that their walls and roofs hide each other (MapLibre's projectTileFor3D). u_globe gives
// every point the same depth; here the depth grows with the distance w (in pixels) as in a projection with no far
// plane, whose near plane is at 0.0005 of the distance to the center of the sphere (below zoom 12 that is nearer than
// the ground under the camera). The far side of the globe is hidden by horizonSide: it is below zero for a point of the ground behind the horizon.
vec4 toClip3D(vec2 t, float h) {
  vec4 g = u_globe * vec4(toSphere(t) * (1.0 + h / 6371008.8), 1.0);
  g.z = g.w - 0.0005 * u_globe[3].w;
  if (u_globeness >= 1.0) return g;
  vec4 r = mix(u_matrix * vec4(unpole(t), h, 1.0), g, u_globeness);
  // The cap of 3D terrain at a pole shows only in the last 2 percent of the change to the globe, as in mixClip.
  if (isPole(t) && u_globeness < 0.98) r.z = 2.0 * r.w;
  return r;
}
float horizonSide(vec2 t) { return dot(toSphere(t), u_horizon.xyz) + u_horizon.w; }
// A tile unit is shorter toward the poles on the sphere: lines are made wider by as much (MapLibre's projectLineThickness).
float lineScale(vec2 t) { float e = exp(GLOBE_PI - (u_tileMerc.y + u_tileMerc.w * t.y) * 2.0 * GLOBE_PI); return mix(1.0, (e * e + 1.0) / (2.0 * e) * u_cosLat, u_globeness); }
bool shown(vec4 c) { return c.z <= c.w; }
`;

// The atmosphere on the globe: a port of atmosphere.fragment.glsl of MapLibre GL JS (BSD-3-Clause), which follows
// glsl-atmosphere (Rayleigh and Mie scattering, 5 steps along the ray and 3 toward the sun). u_rays gives the ray
// of a screen pixel in the space of the unit sphere, u_cam is the camera and u_sun the direction to the sun there.
// The globe is scaled to the radius of the earth. u_halo is the blend and the device pixels per pixel.
export const HALO: [string, string] = [`layout(location=0) in vec2 a_pos; void main() { gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0); }`, `
uniform mat3 u_rays; uniform vec3 u_cam; uniform vec3 u_sun; uniform vec2 u_halo; uniform vec2 u_view; out vec4 o;
const float RP = 6371e3, RA = 6471e3, HR = 8e3, HM = 1.2e3, KM = 21e-6, G = 0.758;
const vec3 KR = vec3(5.5e-6, 13.0e-6, 22.4e-6);
vec2 rsi(vec3 r0, vec3 rd, float sr) {
  float b = 2.0 * dot(rd, r0), d = b * b - 4.0 * (dot(r0, r0) - sr * sr);
  return d < 0.0 ? vec2(1e5, -1e5) : vec2(-b - sqrt(d), -b + sqrt(d)) / 2.0;
}
void main() {
  vec3 r = normalize(u_rays * vec3(gl_FragCoord.x / u_halo.y, u_view.y - gl_FragCoord.y / u_halo.y, 1.0)), r0 = u_cam * RP, s = normalize(u_sun);
  vec2 p = rsi(r0, r, RA);
  vec4 c = vec4(0.0, 0.0, 0.0, 1.0);
  if (p.x <= p.y) {
    p.x = max(p.x, 0.0);
    vec2 p2 = rsi(r0, r, RP);
    if (p2.x <= p2.y && p2.x > 0.0) p.y = min(p.y, p2.x);
    float st = (p.y - p.x) / 5.0, t = p.x + st * 0.5, odR = 0.0, odM = 0.0, mu = dot(r, s), gg = G * G;
    vec3 tR = vec3(0.0), tM = vec3(0.0);
    for (int i = 0; i < 5; i++) {
      vec3 q = r0 + r * t;
      float h = length(q) - RP, dR = exp(-h / HR) * st, dM = exp(-h / HM) * st, js = rsi(q, s, RA).y / 3.0, jt = js * 0.5, jR = 0.0, jM = 0.0;
      odR += dR; odM += dM;
      for (int j = 0; j < 3; j++) { float jh = length(q + s * jt) - RP; jR += exp(-jh / HR) * js; jM += exp(-jh / HM) * js; jt += js; }
      vec3 at = exp(-(KM * (odM + jM) + KR * (odR + jR)));
      tR += dR * at; tM += dM * at; t += st;
    }
    float pR = 3.0 / (16.0 * 3.141593) * (1.0 + mu * mu), pM = 3.0 / (8.0 * 3.141593) * ((1.0 - gg) * (mu * mu + 1.0)) / (pow(1.0 + gg - 2.0 * mu * G, 1.5) * (2.0 + gg));
    c = vec4(22.0 * (pR * KR * tR + pM * KM * tM), exp(-(length(KR) * length(tR) + KM * length(tM))));
  }
  c.rgb = 1.0 - exp(-c.rgb);
  c = pow(c, vec4(1.0 / 2.2));
  o = vec4(c.rgb, 1.0 - c.a) * u_halo.x;
}`];

/**
 * The direction to the sun for `HALO`, in the space of the unit sphere with the rays of the screen (`rays`; the ray
 * through x, y is A x + B y + C). `az` and `polar` are those of the light in degrees, and `onMap` is true for a light
 * with the anchor `map`.
 */
export function haloSun(tr: Transform, rays: number[], az: number, polar: number, onMap: boolean): number[] {
    const a = (az + 90) * PI / 180, p = polar * PI / 180, R = PI / 180;
    // The sun in view space (x right, y up, z toward the camera), as MapLibre's getSunPos.
    const sun = [-Math.cos(a) * Math.sin(p), -Math.sin(a) * Math.sin(p), -Math.cos(p)];
    const turn = (i: number, j: number, t: number) => { const c = Math.cos(t), n = Math.sin(t), u = sun[i], w = sun[j]; sun[i] = c * u - n * w; sun[j] = n * u + c * w; };
    if (onMap) { turn(2, 0, -tr.lng * R); turn(1, 2, tr.lat * R); turn(0, 1, tr.bearing * R); turn(1, 2, -tr.pitch * R); }
    const r = rays, d = tr.cameraDistance, ax = [0, 1, 2].map(i => r[i] * d), ay = [0, 1, 2].map(i => -r[3 + i] * d), az2 = [0, 1, 2].map(i => -r[6 + i] - tr.cx * r[i] - tr.cy * r[3 + i]);
    return [0, 1, 2].map(i => ax[i] * sun[0] + ay[i] * sun[1] + az2[i] * sun[2]);
}

/**
 * The grid that raster, hillshade and background tiles are drawn on with the globe, in tile units: 32 cells a side,
 * and a row of triangles to each pole (y -32768 and 32767). The indices of the grid come first, then those of the
 * north row, then those of the south row.
 */
export function globeMesh(gl: WebGL2RenderingContext): {vao: WebGLVertexArrayObject; main: number; pole: number} {
    const N = 32, pos: number[] = [], idx: number[] = [];
    for (let y = -1; y <= N + 1; y++) for (let x = 0; x <= N; x++) pos.push(x * EXTENT / N, y < 0 ? -32768 : y > N ? 32767 : y * EXTENT / N);
    const quad = (y: number) => { for (let x = 0; x < N; x++) { const i = y * (N + 1) + x; idx.push(i, i + 1, i + N + 1, i + 1, i + N + 2, i + N + 1); } };
    for (let y = 1; y <= N; y++) quad(y);
    quad(0); quad(N + 1);
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    return {vao, main: N * N * 6, pole: N * 6};
}
