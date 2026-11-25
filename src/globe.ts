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
const PI = Math.PI, RAD = PI / 180;
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

/** Whether the horizon hides a Mercator position (with a margin of `slack` radii). */
export function hidden(tr: Transform, mx: number, my: number, slack = 0): boolean {
    const h = frame(tr).horizon;
    return dot(sphere(mx, my), h) + h[3] < -slack;
}

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
    const p = surface(tr, px, py, 1 + metres / 6371008.8), lat = Math.asin(clamp(p[1], -1, 1)) / RAD, lng = Math.atan2(p[0], p[2]) / RAD;
    // (A globe has one world: the longitude is between -180 and 180, as in MapLibre GL JS.)
    return [mercX(lng), mercY(clamp(lat, -85.051129, 85.051129))];
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


type Plane = [number, number, number, number];
const cross = (a: number[], b: number[]): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: number[]): V3 => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const side = (p: number[], q: number[]) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2] + p[3];
/** The point where three planes meet. */
const meet = (a: Plane, b: Plane, c: Plane): V3 => {
    const bc = cross(b, c), ca = cross(c, a), ab = cross(a, b), det = dot(a, bc);
    return [0, 1, 2].map(i => -(a[3] * bc[i] + b[3] * ca[i] + c[3] * ab[i]) / det) as V3;
};

/**
 * The view as a convex volume in the space of the unit sphere (#1922): its corner points and its planes, each with
 * the inside on the positive side. The near plane is half a pixel in front of the camera, and the far plane goes no
 * further than the horizon, as in MapLibre GL JS 6.17.
 */
function viewVolume(tr: Transform, f: GlobeFrame): {points: V3[]; planes: Plane[]} {
    const R = f.radius, d = tr.cameraDistance, cam = f.cam, fwd = unit(view(tr, [0, 0, -1]));
    const dirs = [[0, 0], [tr.width, 0], [tr.width, tr.height], [0, tr.height]].map(([px, py]) => view(tr, [(px - tr.cx) / d, (tr.cy - py) / d, -1]));
    const near = 0.5 / R, far = (d + 2 * R) / R, h = f.horizon;
    // How far along each corner ray the far corner goes: to the horizon plane at most, and not past the farthest point
    // of the circle of the horizon in the direction of the view.
    const lens = dirs.map(v => far * Math.hypot(...v)), units = dirs.map(unit);
    let reach = 0;
    units.forEach((u, i) => { const den = dot(u, h), t = den ? -(dot(cam, h) + h[3]) / den : -1; reach = Math.max(reach, t >= 0 ? t : lens[i]); });
    const along = fwd.map((v, i) => v - h[i] * dot(fwd, h)), al = Math.hypot(...along);
    if (al > 1e-9) {
        const r = Math.sqrt(Math.max(0, 1 - h[3] * h[3])), edge = h.slice(0, 3).map((v, i) => -v * h[3] + along[i] / al * r);
        reach = Math.min(reach, dot(fwd, edge.map((v, i) => v - cam[i])) / dot(units[0], fwd));
    }
    const nearPts = dirs.map(v => cam.map((c, i) => c + v[i] * near) as V3);
    const farPts = units.map((u, i) => cam.map((c, j) => c + u[j] * Math.min(reach, lens[i])) as V3);
    const points = [...nearPts, ...farPts], mid = [0, 1, 2].map(i => points.reduce((s, p) => s + p[i], 0) / 8);
    const plane = (a: V3, b: V3, c: V3): Plane => {
        const n = unit(cross(b.map((v, i) => v - a[i]), c.map((v, i) => v - a[i]))), p: Plane = [...n, -dot(n, a)];
        return side(p, mid) < 0 ? [-p[0], -p[1], -p[2], -p[3]] : p;
    };
    const planes = [plane(nearPts[0], nearPts[1], nearPts[2]), plane(farPts[0], farPts[1], farPts[2])];
    for (let i = 0; i < 4; i++) planes.push(plane(nearPts[i], nearPts[(i + 1) % 4], farPts[i]));
    return {points, planes};
}

/**
 * A convex volume around a tile on the unit sphere, as MapLibre GL JS 6.17 builds it: a box for zoom 0 and 1; above,
 * the planes of its west and east meridians, two planes across the tile toward the north and the south, and two planes
 * along the normal at its center (above the bulge and below the corners).
 */
function tileVolume(z: number, x: number, y: number): {points: V3[]; planes: Plane[]} {
    if (z < 2) {
        const lo = z ? [x ? 0 : -1, y ? -1 : 0, -1] : [-1, -1, -1], hi = z ? [x ? 1 : 0, y ? 0 : 1, 1] : [1, 1, 1];
        const points = [...Array(8).keys()].map(i => [0, 1, 2].map(k => (i >> k & 1 ? hi : lo)[k]) as V3);
        return {points, planes: [0, 1, 2].flatMap(k => { const e = [0, 0, 0]; e[k] = 1; return [[...e, -lo[k]] as Plane, [-e[0], -e[1], -e[2], hi[k]] as Plane]; })};
    }
    const n = 2 ** z, at = (i: number, j: number) => sphere((x + i) / n, (y + j) / n);
    const c = [at(0, 0), at(1, 0), at(1, 1), at(0, 1)], mid = at(0.5, 0.5), north = unit(cross(mid, unit(cross([0, 1, 0], mid))));
    const ext = [...c, mid, at(0.5, y >= n / 2 ? 0 : 1)];
    if (y === 0) ext.push([0, 1, 0]);
    if (y === n - 1) ext.push([0, -1, 0]);
    const span = (a: number[]) => { const v = ext.map(p => dot(a, p)); return [Math.min(...v), Math.max(...v)]; };
    const [lo, hi] = span(mid), [s, nn] = span(north);
    const up: Plane = [-mid[0], -mid[1], -mid[2], hi], down: Plane = [...mid, -lo], toN: Plane = [-north[0], -north[1], -north[2], nn], toS: Plane = [...north, -s];
    const east: Plane = [...unit(cross(c[2], c[1])), 0], west: Plane = [...unit(cross(c[0], c[3])), 0];
    const points = [...(y === 0 ? [meet(west, east, up), meet(west, east, down)] : [meet(toN, east, up), meet(toN, east, down), meet(toN, west, up), meet(toN, west, down)]),
        ...(y === n - 1 ? [meet(west, east, up), meet(west, east, down)] : [meet(toS, east, up), meet(toS, east, down), meet(toS, west, up), meet(toS, west, down)])];
    return {points, planes: [up, down, toN, toS, east, west]};
}

/** 0 when a tile's volume is outside the view or behind the horizon, 2 when it is all inside both, 1 otherwise. */
function cull(v: {points: V3[]; planes: Plane[]}, tile: {points: V3[]; planes: Plane[]}, horizon: Plane): number {
    let all = true;
    for (const p of v.planes) {
        const n = tile.points.filter(q => side(p, q) >= 0).length;
        if (!n) return 0;
        if (n < tile.points.length) all = false;
    }
    // (The separating planes of the tile: the view is outside one of them.)
    if (!all && tile.planes.some(p => v.points.every(q => side(p, q) < 0))) return 0;
    const n = tile.points.filter(q => side(horizon, q) >= 0).length;
    return !n ? 0 : all && n === tile.points.length ? 2 : 1;
}

/**
 * The tiles that the globe shows, nearest first: a quadtree from zoom 0 in one world. A tile is left out when all its
 * sample points are behind the horizon or outside the view, or when a convex volume around it is outside the view or
 * behind the plane of the horizon, as in MapLibre GL JS 6.17 (#1922). The level that a tile gets falls with the
 * distance from the camera to its nearest sample point, as with 3D terrain (geo.ts); below zoom 5 it is usually one level lower
 * than MapLibre GL JS's, on purpose (#1828).
 */
export function covering(tr: Transform, minzoom: number, maxzoom: number, tileSize: number, round: boolean, cap = 160): TileID[] {
    const f = frame(tr), exact = tr.zoom + Math.log2(TILE_SIZE / tileSize), out: (TileID & {near: number})[] = [];
    // The camera distance in radii, at which the tile of the zoom of the map is wanted.
    const unit = tr.cameraDistance / f.radius, margin = 0.15;
    // The point of the sphere under the camera, in Mercator units: the nearest point of a tile is its point nearest to this one.
    const cl = Math.hypot(...f.cam), under = [mercX(Math.atan2(f.cam[0], f.cam[2]) / RAD), mercY(clamp(Math.asin(f.cam[1] / cl) / RAD, -85.051129, 85.051129))];
    // The places under nine points of the screen: a tile that has one of them is in view, however large it is.
    const seen: number[][] = [];
    for (const sx of [0, 0.5, 1]) for (const sy of [0, 0.5, 1]) seen.push(toMerc(tr, sx * tr.width, sy * tr.height));
    const has = (x: number, y: number, n: number, p: number[]) => { const px = (p[0] - Math.floor(p[0])) * n, py = p[1] * n; return px >= x && px <= x + 1 && py >= y && py <= y + 1; };
    const vol = viewVolume(tr, f);
    // (A tile inside a tile whose volume is all in view is not tested against the volume again, as in MapLibre.)
    const visit = (z: number, x: number, y: number, inside: boolean) => {
        const n = 2 ** z, pts: number[][] = [];
        if (!inside) {
            const c = cull(vol, tileVolume(z, x, y), f.horizon);
            if (!c) return;
            inside = c === 2;
        }
        // Sample points of the tile (5 x 5, and the pole for a tile at the edge of the world). The tile is also left out
        // unless one of them is on the near side of the horizon and on the screen, or it has a place under the screen,
        // so that the volume adds no tile to this test (#1922).
        for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) pts.push(sphere((x + i / 4) / n, (y + j / 4) / n));
        if (y === 0) pts.push([0, 1, 0]);
        if (y === n - 1) pts.push([0, -1, 0]);
        const inView = seen.some(p => has(x, y, n, p)) || pts.some(p => {
            if (dot(p, f.horizon) + f.horizon[3] < -1e-3) return false;
            const c = clipOf(f, p);
            return c[2] > 1e-6 && Math.abs(c[0] / c[2]) <= 1 + margin && Math.abs(c[1] / c[2]) <= 1 + margin;
        });
        if (!inView) return;
        const ux = under[0] - Math.floor(under[0] - x / n + 0.5 - 0.5 / n), nearest = sphere(clamp(ux, x / n, (x + 1) / n), clamp(under[1], y / n, (y + 1) / n));
        const near = Math.min(...[...pts, nearest].map(p => Math.hypot(p[0] - f.cam[0], p[1] - f.cam[1], p[2] - f.cam[2])));
        // A tile far from the latitude of the center has other pixels on the sphere: Mercator tiles get smaller toward
        // the poles, by the cosine of the latitude (pts[12] is the middle of the tile).
        const cos = Math.max(1e-3, Math.sqrt(1 - pts[12][1] ** 2)) / Math.cos(Math.min(Math.abs(tr.lat), 85.051129) * RAD);
        const wanted = Math.min(maxzoom, (round ? Math.round : Math.floor)(exact + Math.log2(unit / Math.max(near, 1e-9) * cos)));
        if (z >= maxzoom || z >= wanted) { if (z >= minzoom) out.push({z, x, y, w: 0, key: `${z}/${x}/${y}`, near}); return; }
        for (let i = 0; i < 4; i++) visit(z + 1, x * 2 + (i & 1), y * 2 + (i >> 1), inside);
    };
    visit(0, 0, 0, false);
    return out.sort((a, b) => a.near - b.near).slice(0, cap).map(({near: _, ...t}) => t);
}

/** The position of a tile in Mercator units, for the shader: x and y of its corner and the size of a tile unit. */
export const tileMerc = (id: TileID): [number, number, number, number] => {
    const n = 2 ** id.z;
    return [id.x / n, id.y / n, 1 / n / EXTENT, 1 / n / EXTENT];
};
