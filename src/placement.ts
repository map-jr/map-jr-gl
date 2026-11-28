import {type Mat, type Transform, type TileID, EXTENT} from './geo.ts';
import {mapTranslate, type CompiledLayer, type SpriteIcon} from './style.ts';
import {anchors as lineAnchors, justification, type LabelSrc} from './tile.ts';
import {BASELINE, EM, type Shaped, type Shaper} from './text.ts';
import {CollisionGrid} from './collision.ts';

/** One tile (or part of one) scheduled for drawing this frame. */
export interface RenderItem<T> {
    id: TileID;
    /** Image sources: the picture's corners in this tile's units (x, y pairs, clockwise from top left). */
    corners?: number[];
    matrix: Mat;
    /** The same mapping with perspective, for the GPU. */
    matrix4: Float32Array;
    /** Pixels per tile unit. */
    scale: number;
    /** Visible sub-rectangle in tile units; smaller than the full tile when a parent stands in for a missing child. */
    clip: [number, number, number, number];
    tile: T;
    /** A raster tile that fades in (`raster-fade-duration`): when it arrived (`performance.now()`). */
    born?: number;
    /** A tile that stands in below a raster tile that fades in: drawn only by a raster layer whose fade is not 0. */
    under?: boolean;
}

export interface PlacedIcon {
    /** Center, size and rotation on screen. */
    x: number; y: number; w: number; h: number; angle: number;
    /** Source rectangle in the sprite sheet, in its pixels. */
    rect: [number, number, number, number];
    /** For stretchable icons: (source pixel, screen pixel) pairs along each axis, measured from the icon's left/top edge. */
    gx?: number[]; gy?: number[];
    /** The `icon-opacity` of the feature (1 when it is the same for the layer: the page draws that one at the zoom of the map). */
    opacity: number;
    /** The size of one pixel of the image on the screen, in pixels of the screen, for the halo of a distance-field icon. */
    k: number;
    /** An icon that lies on the ground of a tilted map: see `Placed.frame`. Its angle is then the angle of the first pair. */
    frame?: number[];
    /**
     * An icon on the ground of the globe: the Mercator position of its center and the Mercator steps of one pixel of the
     * icon across and down (x, y pairs), from which the engine projects its corners (`corners`).
     */
    merc?: number[];
    /** An icon on the ground of the globe in this frame: see `groundCorners`. It takes the place of `frame` in drawing. */
    corners?: number[];
    /** Drawn without the perspective ratio (see `CompiledLayer.fixedSize`). */
    fixedSize?: boolean;
    /** The `icon-translate` and `icon-translate-anchor` of the placement (see `moveLabel`). */
    tt?: unknown[];
    /** Set for distance-field icons, which are drawn in this color. */
    color?: number[];
    /** True for images added at runtime (drawn from the dynamic atlas) rather than the style's sprite sheet. */
    custom?: boolean;
    name: string;
}
export interface Placed {
    /** Center of the text block in screen pixels. */
    x: number; y: number;
    angle: number; size: number; shaped: Shaped | null; src: LabelSrc; icon?: PlacedIcon;
    /** Line alignment chosen at placement (`text-justify: auto` with a list of anchors); otherwise the label's own. */
    justify?: number;
    /** The anchor of `text-variable-anchor` (or `text-variable-anchor-offset`) that the placement chose. */
    anchor?: string;
    /** The `text-opacity` of the layer at the zoom of the map (1 when it is a value for each feature, which is in the colors). */
    alpha?: number;
    /** Text following a line: for each glyph, where its baseline starts relative to the label's anchor, and its rotation (x, y, angle triples). */
    curve?: number[];
    /**
     * Text following a line on a tilted map lies on the ground. For each glyph: the length on the screen of one pixel of
     * text along the line, and the direction on the screen of one pixel of text across it (scale, x, y triples).
     */
    ground?: number[];
    /**
     * Text at a point that lies on the ground of a tilted map (`text-pitch-alignment`): where one pixel along the text
     * and one pixel down the text go on the screen (two x, y pairs). It takes the place of `angle`.
     */
    frame?: number[];
    /**
     * Text of a layer with `icon-offset`: drawn without the perspective ratio, as in MapLibre GL JS, while its collision
     * box and the box that queries find keep the ratio (see `CompiledLayer.fixedSize`). Along a line (`curve`) the glyphs
     * keep their places on the line, which have the ratio, and only each glyph drops it.
     */
    fixedSize?: boolean;
    /** The `text-translate` and `text-translate-anchor` of the placement, for text that it moved (see `moveLabel`). */
    tt?: unknown[];
    /** Identity that survives between placements (and between a tile and its parent), for fading. */
    key: string;
    /** The id of the symbol layer of the label, so that its text is drawn in the place of that layer. */
    layer: string;
    tile: TileID;
    /** Where the label's map anchor was on screen when placed, so it can be moved with the map between placements. */
    ax: number; ay: number;
    /** The distance of the anchor from the camera when placed (see `moveLabel`). */
    depth: number;
    opacity: number;
}

/**
 * Whether a label whose anchor is at the distance `depth` from the camera is too far away to be drawn. On a tilted map
 * a far label is hidden, as with perspectiveRatioCutoff of MapLibre GL JS, and so is one behind the camera or beyond the
 * far plane (`far`, from `depthRange`). The ground ends at the far plane, where the horizon is drawn: at a pitch of 85
 * degrees that is at about 1.2 times the camera distance, so without the far plane labels showed in the sky (#924).
 */
export const tooFar = (tr: Transform, depth: number, far: number) => !!tr.pitch && !(0.5 + 0.5 * tr.cameraDistance / depth >= 0.6 && depth > 0 && (tr.globeness > 0 || depth <= far));
/**
 * The factor of the perspective for the size of labels at a distance `depth` from the camera, as in `placeLabels`. On the
 * globe it applies also at pitch 0, because the sphere away from the center is farther from the camera (#2201).
 */
export const perspective = (tr: Transform, depth: number) => (tr.pitch || tr.globeness) && depth > 0 ? Math.min(4, 0.5 + 0.5 * tr.cameraDistance / depth) : 1;
/**
 * The size of a symbol that lies on the ground, at the distance `depth`, in pixels of the ground for each pixel of its
 * size. As in MapLibre GL JS a far symbol is larger on the ground, by half of what the perspective takes away. On the
 * globe this is so also at pitch 0, because the sphere away from the center is farther from the camera (#2012).
 */
export const flatSize = (tr: Transform, depth: number) => (tr.pitch || tr.globeness) && depth > 0 ? Math.min(4, 0.5 + 0.5 * depth / tr.cameraDistance) : 1;
/** How much a symbol on the ground grows on the screen when its anchor moves from the distance `from` to `to`. */
const flatGrow = (tr: Transform, from: number, to: number) => flatSize(tr, to) / flatSize(tr, from) * (to > 0 ? from / to : 1);
/**
 * Where one pixel on the ground at the point (x, y) of the tile goes on the screen, in the direction `angle` (radians
 * clockwise from the x axis of the tile) and at a right angle to it: two x, y pairs.
 */
/**
 * The height of the ground at (x, y) of the tile, for the points of a frame on the ground: they take the height of
 * the frame's own point. (With the height of 3D terrain at each point, a step of a few meters across a steep slope
 * went up or down the slope, and text on the ground was mirrored, #1535.)
 */
const heightAt = (tr: Transform, it: RenderItem<unknown>, x: number, y: number) => {
    const n = 2 ** it.id.z;
    return tr.heightAt ? tr.heightAt((it.id.x + x / EXTENT) / n, (it.id.y + y / EXTENT) / n) : undefined;
};
/** How much longer a step at the row `y` of the tile is on the globe than in Mercator: see `groundFrame`. */
const globeStep = (tr: Transform, it: RenderItem<unknown>, y: number) =>
    1 + tr.globeness * (Math.cosh(Math.PI * (1 - 2 * (it.id.y + y / EXTENT) / 2 ** it.id.z)) * Math.cos(Math.min(Math.abs(tr.lat), 85.051129) * Math.PI / 180) - 1);
function groundFrame(tr: Transform, it: RenderItem<unknown>, x: number, y: number, ax: number, ay: number, angle: number): number[] {
    // On the globe a step in the tile is shorter on the sphere by the cosine of the latitude: as in MapLibre GL JS
    // (`getPitchedTextCorrection`), the step grows by the cosine at the center over that at (x, y), mixed by the globeness.
    const e = 16, d = e / it.scale * globeStep(tr, it, y), c = Math.cos(angle) * d, s = Math.sin(angle) * d, m = heightAt(tr, it, x, y);
    const P = (u: number, v: number) => tr.projectTile(it.id, x + u * c - v * s, y + u * s + v * c, m), [fx, fy] = P(1, 0), [qx, qy] = P(0, 1);
    const f = [(fx - ax) / e, (fy - ay) / e, (qx - ax) / e, (qy - ay) / e];
    if (!tr.globeness) return f;
    // On the globe each corner of a symbol goes through the sphere at its own place, as in MapLibre GL JS (#2194): the
    // frame has a second order, three pairs for x², xy and y² (in pixels of the symbol), from steps on both sides.
    // (The first order is then the mean of both sides.)
    const [bx, by] = P(-1, 0), [vx, vy] = P(0, -1), [dx, dy] = P(1, 1), e2 = e * e;
    f[0] = (fx - bx) / 2 / e; f[1] = (fy - by) / 2 / e; f[2] = (qx - vx) / 2 / e; f[3] = (qy - vy) / 2 / e;
    f.push((fx + bx - 2 * ax) / 2 / e2, (fy + by - 2 * ay) / 2 / e2, (dx - fx - qx + ax) / e2, (dy - fy - qy + ay) / e2, (qx + vx - 2 * ax) / 2 / e2, (qy + vy - 2 * ay) / 2 / e2);
    return f;
}
/**
 * The frame `f` of a symbol moved to the point (u, v) of the symbol, in its pixels from the anchor: the frame whose
 * first order is that of `f` at (u, v), and where (u, v) goes on the screen from the anchor. A frame without a second
 * order (`groundFrame` off the globe) is the same at every point.
 */
const frameAt = (f: number[], u: number, v: number): [number[], number, number] => {
    const x = u * f[0] + v * f[2], y = u * f[1] + v * f[3];
    if (f.length < 10) return [f, x, y];
    return [[f[0] + 2 * f[4] * u + f[6] * v, f[1] + 2 * f[5] * u + f[7] * v, f[2] + f[6] * u + 2 * f[8] * v, f[3] + f[7] * u + 2 * f[9] * v, ...f.slice(4)],
        x + f[4] * u * u + f[6] * u * v + f[8] * v * v, y + f[5] * u * u + f[7] * u * v + f[9] * v * v];
};
/**
 * The bound on the screen of a symbol on the ground of `w` by `h` pixels that is centered at (x, y) with the frame `f`
 * there, with the padding `pad`, as in MapLibre GL JS's `_projectCollisionBox`. With a second order (on the globe) the
 * bound has the corners and the middles of the sides where they are drawn.
 */
export function quadBox(f: number[], x: number, y: number, w: number, h: number, pad: number | readonly number[]): Box {
    const [t, r, b, l] = typeof pad === 'number' ? [pad, pad, pad, pad] : pad;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [u, v] of [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]]) {
        const [, px, py] = frameAt(f, u * w / 2, v * h / 2);
        x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
    }
    return [x + x0 - l, y + y0 - t, x + x1 + r, y + y1 + b];
}
/** Turns the pairs of a frame by `turn` radians on the screen. */
const turnFrame = (f: number[], to: number[], c: number, s: number) => { for (let i = 0; i < f.length; i += 2) { const x = f[i], y = f[i + 1]; to[i] = x * c - y * s; to[i + 1] = x * s + y * c; } };

/**
 * A `*-translate` (`t`: the value and its anchor) as an offset on the screen from the anchor (ax, ay) of the point (x, y)
 * of the tile `id`. The point is moved by tile units and projected again, as in MapLibre GL JS, so the offset shrinks
 * with the distance on a pitched map and follows the curve of the sphere on the globe (#2021).
 */
function translateAt(tr: Transform, id: TileID, x: number, y: number, ax: number, ay: number, t: unknown[]): [number, number] {
    const [mx, my] = mapTranslate(t[0], t[1], tr.bearing), k = 2 ** id.z * EXTENT / tr.worldSize;
    if (!mx && !my) return [0, 0];
    const [px, py] = tr.projectTile(id, x + mx * k, y + my * k);
    return [px - ax, py - ay];
}
/**
 * How far a translate that changed since the placement (`was`, now `t`) moves the label `p` whose anchor is at (ax, ay).
 * A transition of `text-translate` or `icon-translate` moves what is drawn in each frame, as MapLibre GL JS applies them
 * when it draws. The boxes for collisions keep the translate of the placement until the next one, as in MapLibre GL JS (#2478).
 */
function moved(tr: Transform, p: Placed, ax: number, ay: number, was: unknown[] | undefined, t: unknown[] | undefined): [number, number] {
    const a = was?.[0] as number[] | undefined, b = t?.[0] as number[] | undefined;
    if (!was || !t || was[1] === t[1] && a?.[0] === b?.[0] && a?.[1] === b?.[1]) return [0, 0];
    const [x0, y0] = translateAt(tr, p.tile, p.src.x, p.src.y, ax, ay, was), [x1, y1] = translateAt(tr, p.tile, p.src.x, p.src.y, ax, ay, t);
    return [x1 - x0, y1 - y0];
}
/**
 * Moves the drawn copy `d` of the placed label `p` with the camera between placements: its anchor is now at (ax, ay)
 * and at the distance `depth` from the camera, and the map has turned by `turn` radians since the placement.
 * On a tilted map a label that comes nearer to the camera grows and one that goes away shrinks, in each frame, as at
 * its next placement (#914): without that its size changed in a step at each placement while the map panned. Text
 * that lies on the ground takes the whole perspective of the ground, less what its size on the ground takes away.
 * `now` has the `text-translate` and the `icon-translate` of the layer in this frame, each with its anchor (see `moved`).
 * Returns whether the copy is turned.
 */
export function moveLabel(tr: Transform, p: Placed, d: Placed, ax: number, ay: number, depth: number, turn: number, turned: boolean, now: (unknown[] | undefined)[] = []): boolean {
    const grow = perspective(tr, depth) / perspective(tr, p.depth);
    const far = depth > 0 ? p.depth / depth : 1, k = p.fixedSize ? p.frame || p.ground ? far : 1
        : p.ground ? far / grow : p.frame ? flatGrow(tr, p.depth, depth) : grow;
    d.size = p.size * k;
    // (The glyphs of text along a line of a layer with `icon-offset` keep the ratio in their places on the line, which
    // move as the glyphs of a layer without it do. Each glyph keeps its start point near its place, a fraction of a
    // pixel off until the next placement.)
    const kc = p.fixedSize && p.curve ? p.ground ? far / grow : grow : k;
    const rotate = !!turn && (!p.src.upright || (!p.shaped && !!p.icon && !p.src.icon!.upright));
    const tc = rotate ? Math.cos(turn) * k : k, ts = rotate ? Math.sin(turn) * k : 0, gc = rotate ? Math.cos(turn) : 1, gs = rotate ? Math.sin(turn) : 0;
    const ox = p.x - p.ax, oy = p.y - p.ay;
    const [tx, ty] = moved(tr, p, ax, ay, p.tt, now[0]);
    d.x = ax + ox * tc - oy * ts + tx; d.y = ay + ox * ts + oy * tc + ty; d.angle = p.angle + (rotate ? turn : 0);
    const curve = p.curve, ground = p.ground, dc = d.curve, dg = d.ground;
    // (Ground text: the size above gives the length of the glyphs, and the triples of `ground` only their direction.)
    const cc = gc * kc, cs = gs * kc;
    if (curve && dc) for (let i = 0; i < curve.length; i += 3) { const cx = curve[i], cy = curve[i + 1]; dc[i] = cx * cc - cy * cs; dc[i + 1] = cx * cs + cy * cc; dc[i + 2] = curve[i + 2] + (rotate ? turn : 0); }
    if (p.frame && d.frame && (rotate || turned)) turnFrame(p.frame, d.frame, gc, gs);
    if (ground && dg && (rotate || turned)) for (let i = 0; i < ground.length; i += 3) { const cx = ground[i + 1], cy = ground[i + 2]; dg[i] = ground[i]; dg[i + 1] = cx * gc - cy * gs; dg[i + 2] = cx * gs + cy * gc; }
    if (p.icon && d.icon) {
        // (The icon's offset from the anchor grows as the icon does, which is not as its text does: see `fixedSize`.)
        const ix = p.icon.x - p.ax, iy = p.icon.y - p.ay;
        const ig = p.icon.fixedSize ? p.icon.frame ? (depth > 0 ? p.depth / depth : 1) : 1 : p.icon.frame ? flatGrow(tr, p.depth, depth) : grow;
        const [mx, my] = moved(tr, p, ax, ay, p.icon.tt, now[1]);
        d.icon.x = ax + (ix * gc - iy * gs) * ig + mx; d.icon.y = ay + (ix * gs + iy * gc) * ig + my; d.icon.angle = p.icon.angle + (rotate ? turn : 0);
        d.icon.w = p.icon.w * ig; d.icon.h = p.icon.h * ig;
        if (p.icon.frame && d.icon.frame && (rotate || turned)) turnFrame(p.icon.frame, d.icon.frame, gc, gs);
        // (A stretched icon: the odd entries of its pairs are screen pixels.)
        for (const [from, to] of [[p.icon.gx, d.icon.gx], [p.icon.gy, d.icon.gy]]) if (from && to) for (let i = 1; i < from.length; i += 2) to[i] = from[i] * ig;
    }
    return rotate;
}
/**
 * The corners of the icon of the placed label `p` on the ground of the globe, whose anchor is now at the distance
 * `depth`: x, y on the screen and the side of the horizon (`side` of globe.ts) for the top left, top right, bottom left
 * and bottom right corner. As in MapLibre GL JS each corner goes through the sphere on its own, and the horizon cuts
 * the icon where the side is negative (#2297). Between placements the icon keeps its size on the ground (`flatSize`).
 */
export function groundCorners(tr: Transform, p: Placed, depth: number): number[] {
    const i = p.icon!, m = i.merc!, n = 2 ** p.tile.z, ax = (p.tile.x + p.src.x / EXTENT) / n, ay = (p.tile.y + p.src.y / EXTENT) / n;
    const k = i.fixedSize ? 1 : flatSize(tr, depth) / flatSize(tr, p.depth), cx = ax + (m[0] - ax) * k, cy = ay + (m[1] - ay) * k, out: number[] = [];
    // (The corners take the height of the anchor, as the points of `groundFrame` do.)
    const h = tr.heightAt?.(ax, ay), hz = tr.globe!.frame(tr).horizon, side = tr.globe!.side;
    for (let c = 0; c < 4; c++) {
        const x = (c & 1 ? i.w : -i.w) / 2 * k, y = (c & 2 ? i.h : -i.h) / 2 * k, mx = cx + x * m[2] + y * m[4], my = cy + x * m[3] + y * m[5];
        const [sx, sy] = tr.projectTile(p.tile, (mx * n - p.tile.x) * EXTENT, (my * n - p.tile.y) * EXTENT, h);
        out.push(sx, sy, side(tr, mx, my, hz));
    }
    return out;
}
/**
 * Sizes one axis of an icon so that its content range [c0, c1] (image pixels) becomes `target` screen pixels long,
 * growing only the stretch zones. Returns the icon's length, where its content starts, and the cut points.
 */
function fitAxis(size: number, zones: [number, number][] | undefined, c0: number, c1: number, target: number, unit: number) {
    const z = zones?.length ? zones : [[0, size] as [number, number]];
    const stretchIn = (a: number, b: number) => z.reduce((sum, [s, e]) => sum + Math.max(0, Math.min(b, e) - Math.max(a, s)), 0);
    const sIn = stretchIn(c0, c1), k = sIn > 0 ? Math.max(0, (target / unit - (c1 - c0 - sIn)) / sIn) : 1;
    const map = (p: number) => { const st = stretchIn(0, p); return (p - st + st * k) * unit; };
    const cuts: number[] = [];
    for (const p of [...new Set([0, ...z.flat(), size])].sort((a, b) => a - b)) cuts.push(p, map(p));
    return {len: map(size), off: map(c0), cuts};
}

export type IconLookup = (name: string) => (SpriteIcon & {custom?: boolean}) | undefined;

export {CollisionGrid};


type Box = [number, number, number, number];
/** A circle of the grid: its bound and its radius (see `CollisionGrid`). */
type Circle = [number, number, number, number, number];
/**
 * `pad` is one number for every side, or [top, right, bottom, left] (`icon-padding`). As in MapLibre GL JS, the padding
 * is added before the box is turned by `angle`.
 */
export function boxAround(x: number, y: number, w: number, h: number, angle: number, pad: number | readonly number[], turn = 0): Box {
    const [t, r, b, l] = typeof pad === 'number' ? [pad, pad, pad, pad] : pad;
    const c = Math.cos(angle), s = Math.sin(angle), ox = (r - l) / 2, oy = (b - t) / 2;
    // `turn` is the part of `angle` that comes from the bearing when `text-rotation-alignment` is `map`. As in MapLibre
    // GL JS, the box at the rotation of the symbol (`angle - turn`) is taken first, and that box is turned by the bearing (#2037).
    const c1 = Math.abs(turn ? Math.cos(angle - turn) : c), s1 = Math.abs(turn ? Math.sin(angle - turn) : s), ct = turn ? Math.abs(Math.cos(turn)) : 1, st = turn ? Math.abs(Math.sin(turn)) : 0;
    const w1 = (w + l + r) * c1 + (h + t + b) * s1, h1 = (w + l + r) * s1 + (h + t + b) * c1;
    const hw = (w1 * ct + h1 * st) / 2, hh = (w1 * st + h1 * ct) / 2;
    x += ox * c - oy * s; y += ox * s + oy * c;
    return [x - hw, y - hh, x + hw, y + hh];
}

/**
 * The anchors of the point labels placed so far in a layer, by text, in a grid of cells of 16 pixels for the test of
 * 1 pixel between point labels. A test reads only the cells that its circle touches, so a text that repeats many times
 * stays cheap (#332). (Labels along lines are kept apart only in the tile, by half of `symbol-spacing`, as in MapLibre GL JS.)
 */
class SameText {
    private grid = new Map<string, Map<number, number[]>>();
    clear() { this.grid.clear(); }
    add(text: string, x: number, y: number, item: number) {
        let cells = this.grid.get(text);
        if (!cells) this.grid.set(text, cells = new Map());
        const k = Math.floor(x / 16) * 65536 + Math.floor(y / 16), c = cells.get(k);
        if (c) c.push(x, y, item); else cells.set(k, [x, y, item]);
    }
    /** Whether a label with this text is closer than `r` pixels (at most 16), leaving out those of item `skip`. */
    near(text: string, x: number, y: number, r: number, skip: number) {
        const cells = this.grid.get(text);
        if (!cells) return false;
        for (let cx = Math.floor((x - r) / 16); cx <= Math.floor((x + r) / 16); cx++)
            for (let cy = Math.floor((y - r) / 16); cy <= Math.floor((y + r) / 16); cy++) {
                const c = cells.get(cx * 65536 + cy);
                if (c) for (let i = 0; i < c.length; i += 3) if (c[i + 2] !== skip && Math.hypot(c[i] - x, c[i + 1] - y) < r) return true;
            }
        return false;
    }
}

/**
 * Chooses which labels and icons to show. Layers later in the style win, matching MapLibre's priority order.
 * Runs fully from scratch each call; it is cheap enough for the label counts of a single viewport.
 */
/** The distance on each axis for a radial offset: a corner anchor shares it between both. */
const rx_ = (anchor: string, r: number) => anchor.includes('-') ? r / Math.SQRT2 : r;

/**
 * A line cut to a square (`x0`, `y0` and the side `size`), as MapLibre GL JS does before it places labels along it: the
 * parts that are inside. The points where the line is cut are rounded to `1 / grid` of a tile unit.
 */
function clipLine(c: number[], x0 = 0, y0 = 0, size = EXTENT, grid = 1): number[][] {
    const out: number[][] = [], r = (v: number) => Math.round(v * grid) / grid;
    let cur: number[] | null = null;
    for (let i = 0; i + 3 < c.length; i += 2) {
        const ax = c[i], ay = c[i + 1], dx = c[i + 2] - ax, dy = c[i + 3] - ay;
        let t0 = 0, t1 = 1;
        for (const [p, q] of [[-dx, ax - x0], [dx, x0 + size - ax], [-dy, ay - y0], [dy, y0 + size - ay]]) {
            if (!p) { if (q < 0) t1 = -1; continue; }
            const t = q / p;
            if (p < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
        }
        if (t0 > t1) { cur = null; continue; }
        if (!cur || t0 > 0) out.push(cur = [r(ax + dx * t0), r(ay + dy * t0)]);
        cur.push(r(ax + dx * t1), r(ay + dy * t1));
        if (t1 < 1) cur = null;
    }
    return out;
}

/**
 * The squares of the tile `id` that are in view and that MapLibre GL JS lays its labels out in: a tile that is shown at a
 * deeper zoom is cut into tiles of a deeper zoom first (`zoomLevelsToOverscale`, 4 below the `maxZoom` of the map), each
 * of which places its anchors from its own edges. MapLibre GL JS builds only the tiles of that zoom that are in view, and
 * so does this. `k` squares a side; each square is `x * k + y`.
 */
function squaresInView(tr: Transform, id: TileID, k: number, cover: Map<number, TileID[]>): number[] {
    if (k === 1) return [0];
    const z = id.z + Math.log2(k), out = new Set<number>();
    let tiles = cover.get(z);
    if (!tiles) cover.set(z, tiles = tr.tileCover(z, z));
    for (const t of tiles) {
        if (t.w !== id.w) continue;
        // (A tile of the cover that is coarser than the squares, while the map zooms out, holds several of them.)
        const d = z - t.z, m = 2 ** Math.max(0, d), x = d >= 0 ? t.x * m - id.x * k : Math.floor(t.x / 2 ** -d) - id.x * k, y = d >= 0 ? t.y * m - id.y * k : Math.floor(t.y / 2 ** -d) - id.y * k;
        for (let i = Math.max(0, x); i < Math.min(k, x + m); i++) for (let j = Math.max(0, y); j < Math.min(k, y + m); j++) out.add(i * k + j);
    }
    return [...out];
}

/**
 * How many times a tile of the line label `l` is smaller on the screen than a tile of the level `level`: on the globe
 * this library loads tiles of a lower level than MapLibre GL JS (see `covering` in globe.ts), and MapLibre GL JS lays out
 * the anchors in tiles of the level of the map (#2078). 1 without a level, or for a tile of that level or deeper.
 */
const lift = (l: LabelSrc, level?: number) => level === undefined || l.tz === undefined ? 1 : 2 ** Math.max(0, level - l.tz - Math.log2(l.ov!));
/** How many squares a side `squaresInView` cuts the tile of the line label `l` into (`f`: see `lift`). */
const squares = (l: LabelSrc, maxZoom: number, f = 1) => l.tz === undefined ? 1 : Math.min(l.ov! * f, 2 ** Math.max(0, Math.floor(maxZoom) - 4 - l.tz));

/** The most labels that the anchors along the lines of one tile layer make. Tiles come from other parties, and a line of many short turns with a small `symbol-spacing` could otherwise make millions. */
export const MAX_LINE_ANCHORS = 20000;

/**
 * The anchors along one line (`symbol-placement: line`), by the method of MapLibre GL JS (`getAnchors`, `resample` and
 * `checkMaxAngle`): from an offset, every `symbol-spacing`, inside the tile, where the whole label fits on the line and
 * the line turns by no more than `maxAngle` (radians) within any stretch of `window` under it. A line that ends in the
 * square and has no such place tries once more from its middle. At most `most` distances. The square (`x0`, `y0`, the side
 * `size`) is the tile, or the part of it that MapLibre GL JS makes a tile of its own (see `squaresInView`); `ov` is the
 * over-scaling of that square.
 */
function anchorDistances(c: number[], spacing: number, length: number, glyph: number, ov: number, window: number, maxAngle: number, most: number, x0 = 0, y0 = 0, size = EXTENT): number[] {
    const n = c.length / 2, seg = [0];
    for (let i = 1; i < n; i++) seg.push(seg[i - 1] + Math.hypot(c[i * 2] - c[i * 2 - 2], c[i * 2 + 1] - c[i * 2 - 1]));
    const total = seg[n - 1], sx = c[0], sy = c[1];
    // A line that comes in over the edge of the square continues from the next one, and keeps the rhythm of the spacing.
    const continued = sx === x0 || sx === x0 + size || sy === y0 || sy === y0 + size;
    // A long label keeps at least a quarter of the spacing free between it and the next.
    if (spacing - length < spacing / 4) spacing = length + spacing / 4;
    // (The turn at each inner point of the line.)
    const turn = (i: number) => {
        const t = Math.atan2(c[i * 2 + 1] - c[i * 2 - 1], c[i * 2] - c[i * 2 - 2]) - Math.atan2(c[i * 2 + 3] - c[i * 2 + 1], c[i * 2 + 2] - c[i * 2]);
        return Math.abs((t + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
    };
    const resample = (from: number) => {
        const out: number[] = [];
        // (The distances grow, so the segment of the anchor and the first point under the label only move forward.)
        let k = 1, first = 1;
        for (let d = from; d < total && out.length < most; d += spacing) {
            if (d - length / 2 < 0 || d + length / 2 > total) continue;
            while (k < n - 1 && seg[k] < d) k++;
            const t = seg[k] > seg[k - 1] ? (d - seg[k - 1]) / (seg[k] - seg[k - 1]) : 0;
            const x = c[k * 2 - 2] + (c[k * 2] - c[k * 2 - 2]) * t, y = c[k * 2 - 1] + (c[k * 2 + 1] - c[k * 2 - 1]) * t;
            if (x < x0 || x >= x0 + size || y < y0 || y >= y0 + size) continue;
            if (window) {
                while (first < n - 1 && seg[first] - d <= -length / 2) first++;
                const corners: [number, number][] = [];
                let sum = 0, bent = false;
                for (let i = first; i < n - 1 && seg[i] - d < length / 2 && !bent; i++) {
                    const at = seg[i] - d, a = turn(i);
                    corners.push([at, a]); sum += a;
                    while (at - corners[0][0] > window) sum -= corners.shift()![1];
                    bent = sum > maxAngle;
                }
                if (bent) continue;
            }
            out.push(d);
        }
        return out;
    };
    const ds = resample(continued ? spacing / 2 * ov % spacing : (length / 2 + glyph * 2) * ov % spacing);
    return ds.length || continued ? ds : resample(total / 2);
}

/**
 * The labels at the anchors of the line labels of one tile layer, for one shaper (one map), with the `generation` of
 * the shaper that they were found at. `final` is false while a glyph file or an icon was missing.
 */
const alongLine = new WeakMap<LabelSrc[], {shaper: Shaper; generation: number; maxZoom: number; level?: number; inView: string; final: boolean; out: LabelSrc[]}>();
/**
 * The labels of a tile with each line label (`LabelSrc.line`) made into one label at each of its anchors. The anchors
 * need the width of the label, which is known only here: a label whose glyph file is on its way has none yet, and is
 * placed when the file has arrived (the engine places the labels again then). The result is kept until the shaper has
 * new glyphs or images. (The cache holds no state of a map: its key is the label array of a tile, which belongs to one
 * map, and the entry names its shaper.) `maxZoom` is the `maxZoom` of the map, which decides into which squares
 * MapLibre GL JS cuts an over-zoomed tile (see `squaresInView`). On the globe, `level` is the level of the tiles that
 * MapLibre GL JS shows at the zoom of the map: a tile of a lower level is cut into squares of that level, each with the
 * spacing of a tile of its own, so that `symbol-spacing` is as wide on the screen as in MapLibre GL JS. `row` is the y
 * of the tile, on the globe only (see the path of each anchor below).
 */
export function lineLabels(labels: LabelSrc[], shaper: Shaper, icons?: IconLookup, maxZoom = 22, view?: (k: number) => number[], level?: number, row?: number): LabelSrc[] {
    if (!labels.some(l => l.line)) return labels;
    const generation = shaper.generation ?? 0;
    let done = alongLine.get(labels);
    // (The squares in view of the first line label; the same for every label of the tile. The tile cover of the globe
    // has no tiles of the level of a lifted tile, so all of its squares are taken.)
    const first = labels.find(l => l.line)!, f0 = lift(first, level), k0 = squares(first, maxZoom, f0), shown = view && k0 > 1 && f0 === 1 ? view(k0) : null, inView = shown ? shown.join() : '';
    if (done && done.final && done.shaper === shaper && done.generation === generation && done.maxZoom === maxZoom && done.level === level && done.inView === inView) return done.out;
    const out: LabelSrc[] = [], seen = new Map<string, Map<number, number[]>>();
    let final = true, made = 0;
    for (const l of labels) {
        if (!l.line) { out.push(l); continue; }
        const shaped = l.text ? shaper.shape(l.text, l.font, 1e3, l.spacing, l.lineHeight, l.size0) : null;
        if (shaped?.wait) { final = false; continue; }
        const meta = l.icon ? icons?.(l.icon.name) : undefined;
        if (l.icon && !meta) final = false;
        // As in MapLibre GL JS, the wider of text and icon, scaled as text of `text-size` one zoom level in. (A tile of a
        // lower level on the globe has `f` times as many pixels in a tile unit: see `lift`.)
        const f = lift(l, level), spacing = l.lineSpacing! / f, scale = l.tpr! / f * l.size1 / EM, length = Math.max(shaped?.width ?? 0, meta ? meta.width / meta.pixelRatio : 0) * scale;
        // An over-zoomed tile is cut into squares as in MapLibre GL JS: `k` a side, each with the over-scaling `ov / k`.
        const ov = l.ov! * f, k = squares(l, maxZoom, f), size = EXTENT / k, c = l.line;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < c.length; i += 2) minX = Math.min(minX, c[i]), maxX = Math.max(maxX, c[i]), minY = Math.min(minY, c[i + 1]), maxY = Math.max(maxY, c[i + 1]);
        for (const sq of shown ?? Array.from({length: k * k}, (_, i) => i)) {
            const x0 = Math.floor(sq / k) * size, y0 = sq % k * size;
            if (maxX < x0 || minX > x0 + size || maxY < y0 || minY > y0 + size) continue;
            // As in MapLibre GL JS, the same text is not repeated within half of `symbol-spacing` in the square (looked up in a grid of that size).
            const repeat = Math.max(1, spacing / 2), tk = l.text && l.text + '\0' + sq, cells = tk ? seen.get(tk) ?? new Map<number, number[]>() : null;
            if (cells) seen.set(tk, cells);
            for (const part of clipLine(l.line, x0, y0, size, k)) {
                if (made >= MAX_LINE_ANCHORS) break;
                const ds = anchorDistances(part, spacing, length, EM * scale, ov / k, l.text ? 0.6 * EM * scale : 0, l.maxAngle * Math.PI / 180, MAX_LINE_ANCHORS - made, x0, y0, size);
                if (!ds.length) continue;
                // The path of each anchor has the length of its text in the tile, with 8 tile units a pixel (`window`). On
                // the globe a tile unit is shorter on the sphere by the cosine of its latitude, so text near a pole needs
                // more of the line than that (#2508). The path grows by 1 / cos of the latitude of the part nearest a pole,
                // which is enough for any center of the map.
                let win = l.window!;
                if (row !== undefined && win) {
                    let far = 0;
                    for (let i = 1; i < part.length; i += 2) far = Math.max(far, Math.abs(1 - 2 * (row + part[i] / EXTENT) / 2 ** l.tz!));
                    win *= Math.cosh(Math.PI * far);
                }
                for (const a of lineAnchors(part, 0, part.length / 2, 2, true, win, ds, k)) {
                    if (cells) {
                        const cx = Math.floor(a[0] / repeat), cy = Math.floor(a[1] / repeat);
                        let close = false;
                        for (let i = -1; i <= 1 && !close; i++) for (let j = -1; j <= 1 && !close; j++) {
                            const near = cells.get((cx + i) * 65536 + cy + j);
                            if (near) for (let m = 0; m < near.length && !close; m += 2) close = Math.hypot(near[m] - a[0], near[m + 1] - a[1]) < repeat;
                        }
                        if (close) continue;
                        const key = cx * 65536 + cy, list = cells.get(key);
                        if (list) list.push(a[0], a[1]); else cells.set(key, [a[0], a[1]]);
                    }
                    const one: LabelSrc = Object.assign(Object.create(Object.getPrototypeOf(l)), l, {x: a[0], y: a[1], angle: a[2], len: a[3], line: undefined});
                    if (a.length > 4) { one.pathIndex = a[4]; one.path = a.slice(5); }
                    out.push(one);
                    made++;
                }
            }
        }
    }
    alongLine.set(labels, {shaper, generation, maxZoom, level, inView, final, out});
    return out;
}

export function placeLabels(
    tr: Transform, items: RenderItem<{labels: Record<string, LabelSrc[]>; z?: number}>[], layers: CompiledLayer[], shaper: Shaper, grid: CollisionGrid,
    icons?: IconLookup,
    /** Called when the placement comes to a symbol layer, before its labels: for what takes space with that layer and is not placed here. */
    before?: (layer: CompiledLayer) => void,
    /** The anchor of `text-variable-anchor` that a label (by its key) had in the previous placement, if it was shown. */
    prev?: (key: string) => string | undefined,
): Placed[] {
    const out: Placed[] = [], seen = new SameText(), far = tr.depthRange()[1];
    let itemNo = 0;
    const cover = new Map<number, TileID[]>(), keys = new Map<string, number>();
    const twins = new Map<string, {layer: string; group?: string; box: Box; x: number; y: number; justify?: number}>();
    const margin = 100;
    const north = -tr.bearing * Math.PI / 180; // the angle on the screen of the direction that is up on the map
    for (let li = layers.length - 1; li >= 0; li--) {
        const L = layers[li];
        if (L.type !== 'symbol' || !L.visible || tr.zoom < L.minzoom || tr.zoom >= L.maxzoom) continue;
        // (The translates are paint properties: their values are the ones at the zoom of the map, not of the tile.)
        const tt = [L.p.translate.eval(tr.zoom), L.p.translateAnchor.eval(tr.zoom)], itt = [L.p.iconTranslate.eval(tr.zoom), L.p.iconTranslateAnchor.eval(tr.zoom)];
        before?.(L);
        // The same text is a duplicate only in its own layer (the same feature from two tiles, or a road name that
        // repeats). Two layers can show the same text at one point, as in MapLibre.
        seen.clear();
        const first = out.length;
        // The labels of a layer with `symbol-sort-key` are placed in the order of the key over all tiles, as in MapLibre:
        // a label does not win only because its tile comes first.
        let runs: {it: typeof items[0]; labels: LabelSrc[]; no: number}[] = [];
        for (const it of items) { const labels = it.tile.labels?.[L.id]; itemNo++; if (labels) runs.push({it, labels: lineLabels(labels, shaper, icons, tr.maxZoom, k => squaresInView(tr, it.id, k, cover), tr.globeness ? Math.floor(tr.zoom) : undefined, tr.globeness ? it.id.y : undefined), no: itemNo}); }
        if (runs.length > 1 && (L.p.sortKey.dd || L.p.sortKey.eval(tr.zoom) !== 0)) {
            const all: typeof runs = [];
            for (const r of runs) for (const l of r.labels) all.push({it: r.it, labels: [l], no: r.no});
            runs = all.sort((a, b) => a.labels[0].key! - b.labels[0].key!); // (the sort keeps the order of equal keys)
        }
        // `symbol-z-order`, as in MapLibre GL JS, within each tile and by the y of the anchor in the tile, turned with the
        // map: with `viewport-y`, the symbols are placed from the bottom of the screen up, so the lowest wins a collision.
        // With `viewport-y`, and with `auto` when `symbol-sort-key` is the same for all features, symbols that may overlap
        // are drawn from the top of the screen down, so a lower symbol covers a higher one (the same order as the icons
        // that the tiles have in buffers: see `indexIcons` in `gl.ts`).
        const zOrder = L.p.zOrder.eval(tr.zoom);
        const placeByY = zOrder === 'viewport-y';
        const drawByY = (placeByY || zOrder === 'auto' && !L.p.sortKey.dd)
            && runs.some(r => r.labels.some(l => l.overlap || l.ignore || l.icon?.overlap || l.icon?.ignore));
        // (For each label: the number of its tile, its turned y, and its index in the tile; equal ones: the later feature on top.)
        const order = new Map<LabelSrc, [number, number, number]>();
        if (drawByY || placeByY) {
            const sin = Math.sin(north), cos = Math.cos(north);
            for (const r of runs) r.labels.forEach((l, i) => order.set(l, [r.no, Math.round(sin * l.x + cos * l.y), i]));
        }
        const byY = (a: LabelSrc, b: LabelSrc) => { const p = order.get(a)!, q = order.get(b)!; return p[0] - q[0] || p[1] - q[1] || q[2] - p[2]; };
        if (placeByY) {
            const all: typeof runs = [];
            for (const r of runs) for (const l of r.labels) all.push({it: r.it, labels: [l], no: r.no});
            runs = all.sort((a, b) => { const p = order.get(a.labels[0])!, q = order.get(b.labels[0])!; return p[0] - q[0] || -byY(a.labels[0], b.labels[0]); });
        }
        for (const {it, labels, no: itemNo} of runs) {
            const t = Math.min(1, Math.max(0, tr.zoom - (it.tile.z ?? it.id.z)));
            for (const l of labels) {
                if (l.x < it.clip[0] || l.y < it.clip[1] || l.x >= it.clip[2] || l.y >= it.clip[3]) continue;
                const [ax, ay, depth] = tr.projectTile(it.id, l.x, l.y);
                if (ax < -margin || ay < -margin || ax > tr.width + margin || ay > tr.height + margin) continue;
                // On the globe, a label behind the horizon is not placed, also when it may overlap (as in MapLibre GL JS).
                if (tr.globeness) { const n = 2 ** it.id.z; if (tr.globe!.hidden(tr, (it.id.x + l.x / EXTENT) / n, (it.id.y + l.y / EXTENT) / n)) continue; }
                if (tr.heightAt) { const n = 2 ** it.id.z; if (tr.occluded((it.id.x + it.id.w * n + l.x / EXTENT) / n, (it.id.y + l.y / EXTENT) / n)) continue; }
                // (A size that is the same for the layer is found at the zoom of the map. A size for each feature is known at
                // two levels only, and is mixed between them.)
                // On a tilted map, labels and icons far from the camera are smaller and near ones are larger, by half of what
                // the perspective does to the map itself (as in MapLibre). On the globe this is so also at pitch 0 (#2201).
                const ratio = 0.5 + 0.5 * tr.cameraDistance / depth;
                if (tooFar(tr, depth, far)) continue;
                const persp = tr.pitch || tr.globeness ? Math.min(4, ratio) : 1;
                const line = l.angle !== null, flat = (!!tr.pitch || tr.globeness > 0) && l.flat && !line;
                // As in MapLibre GL JS, `text-rotation-alignment` decides whether every box of the symbol, the icon's too,
                // is turned by the bearing (#2037).
                const bturn = line || flat || l.upright ? 0 : north;
                // (Text that lies on the ground has its size on the ground: see `flatSize`.)
                let size = (L.p.size.dd ? l.size0 + (l.size1 - l.size0) * t : L.p.size.eval(tr.zoom)) * (flat ? flatSize(tr, depth) : persp), s = size / EM;
                const alpha = L.p.opacity.dd ? 1 : L.p.opacity.eval(tr.zoom);
                const meta = l.icon ? icons?.(l.icon.name) : undefined;
                const shaped = l.text ? shaper.shape(l.text, l.font, line ? 1e3 : l.maxWidth, l.spacing, l.lineHeight, l.size0) : null;
                if (shaped?.wait) continue; // its glyph file is on its way
                let w = shaped ? shaped.width * s : 0, h = shaped ? shaped.height * s : 0;
                const hasText = w > 0;
                if (!hasText && !meta) continue;
                // Direction of the line on screen, found by projecting a second point a little way along it.
                let lineAngle = 0;
                if (line) { const [bx, by] = tr.projectTile(it.id, l.x + Math.cos(l.angle!) * 64, l.y + Math.sin(l.angle!) * 64); lineAngle = Math.atan2(by - ay, bx - ax); }

                // Where the text could go: along the line, at one of several anchors, or at its fixed anchor.
                let twin: {layer: string; group?: string; box: Box; x: number; y: number; justify?: number} | undefined, twinKey = '';
                let flatFrames: number[][] | undefined, flatSizes: number[] = [], textAngle = 0, candidates: [number, number][] = [], frame: number[] | undefined;
                /** Text that follows its line (placed already). */
                let bent: Placed | undefined, bentBoxes: Circle[] = [];
                const anchors: string[] = [];
                if (hasText) {
                    const shift = (anchor: string, r: number): [number, number] => [
                        anchor.includes('left') ? w / 2 + r : anchor.includes('right') ? -w / 2 - r : 0,
                        anchor.includes('top') ? h / 2 + r : anchor.includes('bottom') ? -h / 2 - r : 0];
                    if (line && !l.upright && l.path && shaped!.lines.length === 1 && shaped!.lines[0].chars.length > 1) {
                        // Follow the line: each glyph sits on the path at its own distance from the anchor, turned to the path's direction.
                        // (On a tilted map the text lies on the ground, and the ground gives it the whole perspective. As in MapLibre,
                        // its size on the ground takes half of that away again, so far text stays readable.)
                        // (On the globe the text lies on the sphere also without tilt, as in MapLibre GL JS: a path that is
                        // straight in the tile is a curve there, and its points joined on the screen bend too sharply.)
                        // (In a layer with `icon-offset` each glyph drops the perspective ratio, as in MapLibre GL JS
                        // (`u_is_offset`), and keeps its place on the line, which has the ratio (#2188). On the ground the
                        // glyph has the size of the text then, and else the size of the text without the ratio.)
                        const ground = !!(tr.pitch || tr.globeness) && l.flat, fit = L.fixedSize ? ground ? persp : 1 / persp : 1;
                        const curved = followLine(tr, it, l, shaped!.lines[0], s, ax, ay, w, h, ground ? s / persp / persp : 0, fit);
                        if (!curved) continue;
                        // (`text-translate` moves the whole text and its boxes, as MapLibre GL JS moves each point of the line by it.)
                        const [mx, my] = translateAt(tr, it.id, l.x, l.y, ax, ay, tt);
                        if (mx || my) for (const b of curved.boxes) { b[0] += mx; b[1] += my; b[2] += mx; b[3] += my; }
                        if (!l.overlap && curved.boxes.some(b => grid.hits(...b))) continue;
                        // (Its boxes go into the grid after its icon is placed: as in MapLibre, an icon is not blocked by its own text.)
                        bentBoxes = l.ignore ? [] : curved.boxes;
                        const n = 2 ** it.id.z, q = 2 ** 22;
                        const key = `${L.id}|${l.text}||${Math.round((it.id.x + l.x / EXTENT) / n * q)},${Math.round((it.id.y + l.y / EXTENT) / n * q)},${it.id.w}`;
                        bent = {x: ax + mx, y: ay + my, angle: 0, size: (curved.ground ? size / persp / persp : size) * fit, shaped, src: l, curve: curved.curve, ground: curved.ground, key, layer: L.id, tile: it.id, ax, ay, depth, opacity: 1, alpha, fixedSize: L.fixedSize || undefined, tt};
                        // (No icon: the text is all. With an icon, the icon is found below, as for other text.)
                        if (!meta) { for (const b of bentBoxes) grid.insert(...b); out.push(bent); continue; }
                    } else if (line && !l.upright) {
                        if (l.len * it.scale < w * 1.15) continue; // the road is shorter than its name at this zoom
                        textAngle = Math.atan2(Math.sin(lineAngle), Math.cos(lineAngle));
                        if (l.keepUpright) { if (textAngle > Math.PI / 2) textAngle -= Math.PI; else if (textAngle <= -Math.PI / 2) textAngle += Math.PI; }
                        const oy = l.offset[1] * size;
                        candidates = [[-Math.sin(textAngle) * oy, Math.cos(textAngle) * oy]];
                    } else if (!line && (l.varOffset?.length || l.varAnchor?.length)) {
                        // Several anchors to try in order. Each has its own offset: given with the anchor, pushed out
                        // from the point by the radial offset, or `text-offset` turned to point away from the anchor.
                        const side = (a: string, r: number): [number, number] => [
                            a.includes('left') ? r : a.includes('right') ? -r : 0, a.includes('top') ? r : a.includes('bottom') ? -r : 0];
                        // MapLibre moves text at a top or bottom anchor towards the point, to allow for the space above the
                        // letters. (It moves it by 7/24 em, from a taller box than this text has: 0.15 em gives the same place.)
                        const add = (a: string, ox: number, oy: number) => {
                            const [sx, sy] = shift(a, 0), near = a.includes('top') ? -0.15 : a.includes('bottom') ? 0.15 : 0;
                            anchors.push(a); candidates.push([sx + ox * size, sy + (oy + near) * size]);
                        };
                        if (l.varOffset?.length) {
                            for (let i = 0; i + 1 < l.varOffset.length; i += 2) { const o = l.varOffset[i + 1] as [number, number]; add(l.varOffset[i] as string, o[0], o[1]); }
                        } else for (const a of l.varAnchor!) {
                            if (l.radial) { const [rx, ry] = side(a, rx_(a, Math.max(0, l.radial))); add(a, rx, ry); }
                            else add(a, side(a, Math.abs(l.offset[0]))[0], side(a, Math.abs(l.offset[1]))[1]);
                        }
                    }
                    else {
                        const [sx, sy] = line ? [0, 0] : shift(l.anchor, 0);
                        candidates = [[l.offset[0] * size + sx, l.offset[1] * size + sy]];
                    }
                    // At a point, text that is aligned with the map turns with the map (an arrow keeps its direction on the ground).
                    const turned = l.rotate + (l.upright ? 0 : north);
                    if (flat) {
                        // Text on the ground: its offsets and its glyphs go through the ground at the anchor. Text that
                        // is aligned with the viewport is turned on the ground so that it reads along the screen's x axis.
                        // On the globe each candidate has the frame at its own center (#2194): its glyphs go through the
                        // sphere from there.
                        frame = groundFrame(tr, it, l.x, l.y, ax, ay, turned - north);
                        const [a, b, c, d] = frame, at = candidates.map(([dx, dy]) => frameAt(frame!, dx, dy));
                        textAngle = Math.atan2(b, a);
                        flatFrames = at.map(g => g[0]);
                        candidates = at.map(g => [g[1], g[2]]);
                        // (The box for collisions is the bound on the screen of the text on the ground, as in MapLibre GL JS's
                        // `_projectCollisionBox`, and not the bound of a turned box, which is taller where the frame is skewed.)
                        flatSizes = [w, h];
                        w *= Math.hypot(a, b); h *= Math.hypot(c, d);
                    } else if (!line && turned) {
                        // text-rotate turns the label about its anchor point, so the offset from the anchor turns with it.
                        const c = Math.cos(turned), sn = Math.sin(turned);
                        textAngle = turned;
                        candidates = candidates.map(([dx, dy]) => [dx * c - dy * sn, dx * sn + dy * c]);
                    }
                    const [mx, my] = translateAt(tr, it.id, l.x, l.y, ax, ay, tt);
                    if (mx || my) {
                        candidates = candidates.map(([dx, dy]) => [dx + mx, dy + my]);
                    }
                    // The same name often arrives from several tiles or road segments: keep them apart.
                    // The same label in a second layer (for example, to draw it twice for more weight) goes where the first is.
                    twin = line ? undefined : twins.get(twinKey = `${l.text}|${l.font}|${size}|${Math.round(ax)},${Math.round(ay)}`);
                    if (twin && (twin.layer === L.id || twin.group !== L.group)) twin = undefined;
                    // Point labels from one tile are separate features, also when they have the same position.
                    if (!twin && !line && seen.near(l.text, ax, ay, 1, itemNo)) continue;
                }
                const n = 2 ** it.id.z, q = 2 ** 22;
                const key = `${L.id}|${l.text}|${l.icon?.name ?? ''}|${Math.round((it.id.x + l.x / EXTENT) / n * q)},${Math.round((it.id.y + l.y / EXTENT) / n * q)},${it.id.w}`;
                const ic = meta && l.icon, iflat = (!!tr.pitch || tr.globeness > 0) && !!ic && ic.flat && ic.fit === 'none';
                const isize = ic ? (L.p.iconSize.dd ? ic.size + (ic.size1 - ic.size) * t : L.p.iconSize.eval(tr.zoom)) * (L.fixedSize ? 1 : iflat ? flatSize(tr, depth) : persp) : 0;
                // Where the icon goes and its size, for text centered at (tx, ty).
                const sprite = meta, move = ic ? translateAt(tr, it.id, l.x, l.y, ax, ay, itt) : [0, 0];
                const iconAt = (fit: string, tx: number, ty: number) => {
                    const ic = l.icon!, meta = sprite!;
                    let iw = meta.width / meta.pixelRatio * isize, ih = meta.height / meta.pixelRatio * isize;
                    // The anchor names the part of the icon that sits on the point.
                    let ix = ax + ic.offset[0] * isize + (ic.anchor.includes('left') ? iw / 2 : ic.anchor.includes('right') ? -iw / 2 : 0);
                    let iy = ay + ic.offset[1] * isize + (ic.anchor.includes('top') ? ih / 2 : ic.anchor.includes('bottom') ? -ih / 2 : 0);
                    let gx: number[] | undefined, gy: number[] | undefined;
                    if (fit !== 'none') {
                        // Stretch the icon around the text, e.g. a road shield around its number. Only the image's
                        // stretch ranges grow; its content box ends up around the padded text. As in MapLibre, the
                        // icon's own anchor is not used: an axis that is not fitted keeps its size, centered on the text.
                        const [pt, pr, pb, pl] = ic.fitPad.map(v => v * isize), unit = isize / meta.pixelRatio, c = meta.content;
                        const ox = ic.offset[0] * isize, oy = ic.offset[1] * isize;
                        // The box the content must fill, relative to the label's point.
                        let left = tx - ax - w / 2 - pl, top = ty - ay - h / 2 - pt, cw = w + pl + pr, ch = h + pt + pb;
                        if (c && fit === 'both') {
                            // Sprites can ask for the content box to keep its shape, or to grow only.
                            const ratio = (c[2] - c[0]) / (c[3] - c[1]), fw = meta.textFitWidth ?? 'stretchOrShrink', fh = meta.textFitHeight ?? 'stretchOrShrink';
                            if (fh === 'proportional') {
                                if (fw === 'proportional' || (fw === 'stretchOnly' && cw / ch < ratio)) { const n = Math.ceil(ch * ratio); left *= n / cw; cw = n; }
                            } else if (fw === 'proportional' && fh === 'stretchOnly' && ratio !== 0 && cw / ch > ratio) { const n = Math.ceil(cw / ratio); top *= n / ch; ch = n; }
                        }
                        if (fit !== 'height') {
                            const f = fitAxis(meta.width, meta.stretchX, c?.[0] ?? 0, c?.[2] ?? meta.width, cw, unit);
                            iw = f.len; ix = ax + left - f.off + iw / 2 + ox; gx = f.cuts;
                        } else ix = tx + ox;
                        if (fit !== 'width') {
                            const f = fitAxis(meta.height, meta.stretchY, c?.[1] ?? 0, c?.[3] ?? meta.height, ch, unit);
                            ih = f.len; iy = ay + top - f.off + ih / 2 + oy; gy = f.cuts;
                        } else iy = ty + oy;
                    }
                    return {ix: ix + move[0], iy: iy + move[1], iw, ih, gx, gy};
                };
                let textBox: Box | null = null, tx = ax, ty = ay;
                let justify: number | undefined, anchor: string | undefined;
                if (twin) { textBox = twin.box; tx = twin.x; ty = twin.y; justify = twin.justify; }
                else {
                    // As in MapLibre GL JS: the anchor of the previous placement first, then every anchor where nothing
                    // is in the way, and only then, when the text may overlap, every anchor again with overlap. With
                    // `icon-text-fit`, the icon that follows the text must fit too.
                    const before = anchors.length ? anchors.indexOf(prev?.(key) ?? '') : -1;
                    const fitted = anchors.length && ic && ic.fit !== 'none' && !ic.overlap;
                    const tries: number[] = before < 0 ? [] : [before];
                    for (let i = 0; i < candidates.length; i++) tries.push(i);
                    if (l.overlap) for (let i = 0; i < candidates.length; i++) tries.push(i + candidates.length);
                    for (const k of tries) {
                        const i = k % candidates.length, overlap = k >= candidates.length;
                        const [dx, dy] = candidates[i], box = flatFrames ? quadBox(flatFrames[i], ax + dx, ay + dy, flatSizes[0], flatSizes[1], l.padding) : boxAround(ax + dx, ay + dy, w, h, textAngle, l.padding, bturn);
                        if (!overlap && grid.hits(...box)) continue;
                        if (fitted && !overlap) {
                            const f = iconAt(ic.fit, ax + dx, ay + dy);
                            if (grid.hits(...boxAround(f.ix, f.iy, f.iw, f.ih, ic.rotate * Math.PI / 180 + bturn, ic.padding, bturn))) continue;
                        }
                        textBox = box; tx = ax + dx; ty = ay + dy;
                        if (flatFrames) { frame = flatFrames[i]; textAngle = Math.atan2(frame[1], frame[0]); }
                        anchor = anchors[i];
                        if (anchor && l.justifyAuto) justify = justification('auto', anchors[i]);
                        break;
                    }
                }
                if (hasText && !textBox && !bent && !(meta && l.textOptional)) continue;

                let icon: PlacedIcon | undefined, iconBox: Box | null = null;
                // (An icon that is fitted to text is not drawn where there is no text, as in MapLibre.)
                if (ic && (hasText || ic.fit === 'none')) {
                    const fit = hasText && (textBox || bent) ? ic.fit : 'none';
                    const {ix, iy, iw, ih, gx, gy} = iconAt(fit, tx, ty);
                    // (An icon that is fitted to text on a line turns over with the text when `text-keep-upright` keeps the text
                    // upright. Another icon turns over by `icon-keep-upright`.)
                    const along = (fit !== 'none' ? l.keepUpright : ic.keepUpright) && Math.abs(lineAngle) > Math.PI / 2 ? lineAngle + Math.PI : lineAngle;
                    let angle = (ic.upright ? 0 : line ? along : north) + ic.rotate * Math.PI / 180;
                    // (The icon turned to `ang` on the screen, which is `ga` from the x axis of the tile on the ground: its center,
                    // its size and its angle on the screen, and on the ground its frame.)
                    const turnTo = (ang: number, ga: number) => {
                        let bx = ix, by = iy, bw = iw, bh = ih, iframe: number[] | undefined, merc: number[] | undefined;
                        if (fit === 'none') {
                            // As in MapLibre GL JS, `icon-offset` and the shift of `icon-anchor` belong to the picture: they turn
                            // with it (`icon-rotate`, the line, the map) and, on the ground, go through the ground with it.
                            // (`icon-translate` is already on the screen.)
                            const ox = ix - move[0] - ax, oy = iy - move[1] - ay;
                            let a = Math.cos(ang), b = Math.sin(ang), c = -b, d = a;
                            if (iflat) {
                                // (On the globe the frame is the one at the center of the icon: see `frameAt`. The icon is drawn
                                // between its corners, which `groundCorners` projects in each frame from `merc`.)
                                const [g, px, py] = frameAt(groundFrame(tr, it, l.x, l.y, ax, ay, ga), ox, oy);
                                if (tr.globeness) {
                                    // (A pixel of the icon is that many units of the tile along the angle `ga`, as in `groundFrame`.)
                                    const n = 2 ** it.id.z, k = globeStep(tr, it, l.y) / it.scale / EXTENT / n, cx = Math.cos(ga) * k, sx = Math.sin(ga) * k;
                                    merc = [(it.id.x + l.x / EXTENT) / n + ox * cx - oy * sx, (it.id.y + l.y / EXTENT) / n + ox * sx + oy * cx, cx, sx, -sx, cx];
                                }
                                iframe = [a, b, c, d] = g;
                                ang = Math.atan2(b, a); bw = iw * Math.hypot(a, b); bh = ih * Math.hypot(c, d);
                                bx = ix - ox + px; by = iy - oy + py;
                            } else { bx = ix + ox * (a - 1) + oy * c; by = iy + ox * b + oy * (d - 1); }
                        }
                        return {bx, by, bw, bh, ang, iframe, merc};
                    };
                    // (Along a line, the angle from the line on the screen becomes the angle from the line on the ground.)
                    const rot = ic.rotate * Math.PI / 180, drawn = turnTo(angle, angle - (line && !ic.upright ? lineAngle - l.angle! : north));
                    const {bx, by, iframe, merc} = drawn;
                    angle = drawn.ang;
                    // As in MapLibre GL JS, the collision box of an icon along a line is not turned with the line: it is the box
                    // that the icon would have at a point (#1774). An icon that `icon-text-fit` stretches around text along the line
                    // has the box of the icon around the text before the text follows the line (#2462).
                    const unturned = line, base = ic.upright ? 0 : north;
                    const held = unturned ? turnTo(base + rot, base + rot - north) : drawn, bt = unturned ? l.upright ? 0 : north : bturn;
                    let {bw, bh} = held;
                    // As in MapLibre GL JS, the collision box keeps the perspective ratio where the drawn icon has none
                    // (`L.fixedSize`, a layer with `icon-offset`): the box and its offset from the anchor grow with it. An icon
                    // that `icon-text-fit` stretches has its size from the text, which has the ratio already.
                    const r = L.fixedSize && fit === 'none' ? iflat ? flatSize(tr, depth) : persp : 1, cx = ax + move[0], cy = ay + move[1];
                    const qx = cx + (held.bx - cx) * r, qy = cy + (held.by - cy) * r;
                    bw *= r; bh *= r;
                    // As in MapLibre GL JS, `text-pitch-alignment` and `text-rotation-alignment` decide the collision box of the icon
                    // too, whatever `icon-pitch-alignment` and `icon-rotation-alignment` are (#2202). An icon at a point that is not
                    // fitted to text has the box of its picture, turned by `icon-rotate` with its offset from the anchor. (`k`: the size
                    // of the box for each pixel of `iw`, which has the size of the drawn icon.)
                    const point = !line && fit === 'none', k = L.fixedSize ? 1 : iflat ? flatSize(tr, depth) : persp;
                    const c = Math.cos(rot), sn = Math.sin(rot), dx = ix - move[0] - ax, dy = iy - move[1] - ay;
                    // (On the globe without pitch, the box lies on the ground only with text on the ground (`flat`): as in
                    // MapLibre GL JS, `text-pitch-alignment` decides it, so a box does not change at the switch to Mercator.)
                    // (On the screen the box has the perspective ratio, `e` for each pixel of `iw`, and turns by the bearing with `bt`.)
                    const e = persp / k, a = rot + bt, ca = Math.cos(a) * e, sa = Math.sin(a) * e;
                    let box = point ? boxAround(cx + dx * ca - dy * sa, cy + dx * sa + dy * ca, iw * e, ih * e, a, ic.padding, bt)
                        : iflat && (!!tr.pitch || flat) ? boxAround(qx, qy, bw, bh, held.ang, ic.padding) : iflat ? boxAround(qx, qy, iw * r, ih * r, rot + bt, ic.padding, bt) : boxAround(qx, qy, bw, bh, rot + bt, ic.padding, bt);
                    if (point ? flat : unturned && !iflat && l.flat) {
                        // The box lies on the ground also for an icon that `icon-pitch-alignment` stands up (#2461): the box at the
                        // point, turned by `icon-rotate`, has its size on the ground (`flatSize`) and goes through the ground at the
                        // anchor, so it is lower on a tilted map. It turns with the map when `text-rotation-alignment` is `map`.
                        // (The offset of the box from the anchor is turned by `icon-rotate` alone: the frame on the ground has the bearing.
                        // The padding is added on the ground before the turn, as at a point.)
                        const [pt, pr, pb, pl] = ic.padding, g = flatSize(tr, depth) / k, w0 = iw * g + pl + pr, h0 = ih * g + pt + pb;
                        const ux = held.bx - cx, uy = held.by - cy, bc = Math.cos(base), bs = Math.sin(base);
                        // (Along a line the offset of `held` is turned by `base` too, and is turned back here.)
                        const vx = point ? dx * c - dy * sn : ux * bc + uy * bs, vy = point ? dx * sn + dy * c : uy * bc - ux * bs;
                        const ox = vx * g + ((pr - pl) * c - (pb - pt) * sn) / 2, oy = vy * g + ((pr - pl) * sn + (pb - pt) * c) / 2;
                        const [f, px, py] = frameAt(groundFrame(tr, it, l.x, l.y, ax, ay, l.upright ? -north : 0), ox, oy);
                        box = quadBox(f, cx + px, cy + py, w0 * Math.abs(c) + h0 * Math.abs(sn), w0 * Math.abs(sn) + h0 * Math.abs(c), 0);
                    }
                    if (ic.overlap || !grid.hits(...box)) {
                        iconBox = box;
                        icon = {x: bx, y: by, w: iw, h: ih, angle, frame: iframe, merc, fixedSize: L.fixedSize, rect: [meta.x, meta.y, meta.width, meta.height], custom: meta.custom, name: ic.name, gx, gy, tt: itt, opacity: ic.opacity, color: meta.sdf ? ic.color : undefined, k: isize / meta.pixelRatio};
                    } else if (!(hasText && (textBox || bent) && ic.optional)) continue; // (a required icon that is not placed drops its text too, as in MapLibre)
                }
                // As in MapLibre GL JS (`u_is_offset`), the text of a layer with `icon-offset` is drawn without the perspective
                // ratio, and so is an icon that `icon-text-fit` stretches around it. Their collision boxes above keep the ratio:
                // the drawn text, its offset from the anchor and the fitted icon shrink toward the anchor by the ratio (#2057).
                let fixed = false;
                if (L.fixedSize && textBox && !twin) {
                    // (A fitted icon faces the screen, also around text on the ground, so it drops the ratio of the screen.)
                    const r = flat ? flatSize(tr, depth) : persp;
                    fixed = true;
                    if (r !== 1) { size /= r; tx = ax + (tx - ax) / r; ty = ay + (ty - ay) / r; }
                    if (persp !== 1 && icon && ic && ic.fit !== 'none') {
                        icon.x = ax + (icon.x - ax) / persp; icon.y = ay + (icon.y - ay) / persp; icon.w /= persp; icon.h /= persp;
                        for (const g of [icon.gx, icon.gy]) if (g) for (let i = 1; i < g.length; i += 2) g[i] /= persp;
                    }
                }
                if (bent) { bent.icon = icon; for (const b of bentBoxes) grid.insert(...b); if (iconBox && !l.icon!.ignore) grid.insert(...iconBox); out.push(bent); continue; }
                if (!textBox && !icon) continue;
                if (textBox && twinKey && !twin) twins.set(twinKey, {layer: L.id, group: L.group, box: textBox, x: tx, y: ty, justify});
                if (textBox && !l.ignore && !twin) grid.insert(...textBox);
                if (iconBox && !l.icon!.ignore) grid.insert(...iconBox);
                if (textBox && !line) seen.add(l.text, ax, ay, itemNo);
                // Features with the same text at the same position keep separate keys, in their order in the tile.
                const same = keys.get(key) ?? 0;
                keys.set(key, same + 1);
                out.push({x: tx, y: ty, angle: textAngle, frame, size, shaped: textBox ? shaped : null, src: l, icon, key: same ? key + '#' + same : key, layer: L.id, tile: it.id, ax, ay, depth, opacity: 1, justify, alpha, anchor, fixedSize: fixed || undefined, tt: textBox ? tt : undefined});
            }
        }
        if (drawByY && out.length - first > 1) {
            const mine = out.splice(first).sort((a, b) => byY(a.src, b.src));
            for (const p of mine) out.push(p);
        }
    }
    return out;
}

/**
 * Lays one line of text along a label's path. Returns each glyph's start point (relative to the anchor) and angle, plus
 * collision circles, or null when the text does not fit or the line bends too sharply to read. `fit` scales each glyph
 * about its place on the line, for a glyph drawn at another size than the one that places it.
 */
function followLine(
    tr: Transform, it: RenderItem<unknown>, l: LabelSrc, line: {advances: number[]}, s: number, ax: number, ay: number, w: number, h: number, flat = 0, fit = 1,
): {curve: number[]; ground?: number[]; boxes: Circle[]} | null {
    const path = l.path!, n = path.length / 2;
    // On the globe the ground has the scale of the sphere at the anchor (MapLibre GL JS's `getPitchedTextCorrection`):
    // the cosine of the latitude of the anchor over that of the center, mixed with Mercator by the globeness.
    // (`cosLat`: the cosine of the latitude of a y in the tile.)
    const cosLat = (v: number) => 1 / Math.cosh(Math.PI * (1 - 2 * (it.id.y + v / EXTENT) / 2 ** it.id.z)), round = flat ? tr.globeness : 0, anchorCos = cosLat(l.y);
    const g = round ? 1 + round * (anchorCos / Math.cos(Math.min(Math.abs(tr.lat), 85.051129) * Math.PI / 180) - 1) : 1;
    // Most text that comes here does not fit its line at this zoom, so the length is tested first, before the points
    // are projected. The length on the screen (or on the ground, for a tilted map or the globe) is the length in the
    // tile times `it.scale` (and `g`). (The exact test below decides the cases within a thousandth of a pixel.)
    let before = 0, total = 0;
    for (let i = 1; i < n; i++) { const d = Math.hypot(path[i * 2] - path[i * 2 - 2], path[i * 2 + 1] - path[i * 2 - 1]); total += d; if (i <= l.pathIndex!) before += d; }
    if (Math.min(before, total - before) * it.scale * g < w * (flat || s) / s / 2 - 1e-3) return null;
    // The points of the line: on the screen, and in the tile (for lengths on the ground).
    let xs: number[] = [], ys: number[] = [], us: number[] = [], vs: number[] = [];
    for (let i = 0; i < n; i++) { const u = path[i * 2], v = path[i * 2 + 1], [x, y] = tr.projectTile(it.id, u, v); xs.push(x); ys.push(y); us.push(u); vs.push(v); }
    let anchorIndex = l.pathIndex!;
    // Text should read left to right (`text-keep-upright`): run the path in whichever direction heads rightwards overall.
    // Without it, the text follows the direction of the line.
    if (l.keepUpright && xs[n - 1] < xs[0]) { xs = xs.reverse(); ys = ys.reverse(); us = us.reverse(); vs = vs.reverse(); anchorIndex = n - 1 - anchorIndex; }
    // Distances along the line. Flat text is measured on the ground, in pixels of the map without tilt: each glyph then
    // takes the length on the screen that its piece of ground has.
    const cum = [0], k = flat && it.scale * g, size = flat || s;
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + (k ? Math.hypot(us[i] - us[i - 1], vs[i] - vs[i - 1]) * k : Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1])));
    w *= size / s;
    const start = cum[anchorIndex] - w / 2;
    if (start < 0 || start + w > cum[n - 1]) return null; // not enough line for the text at this zoom
    // On the globe, text with a glyph behind the horizon is hidden, as in MapLibre GL JS (#1996). MapLibre tests the
    // vertices of the label line, which it divides on the globe into steps of 64 tile units, so the test of the point
    // under each glyph (in the tile, at its place along the piece) gives nearly the same result without the division.
    const z = 2 ** it.id.z, behind = (u: number, v: number) => !!tr.globeness && tr.globe!.hidden(tr, (it.id.x + u / EXTENT) / z, (it.id.y + v / EXTENT) / z);
    const spacing = l.spacing * EM * size, shift = (l.offset[1] + BASELINE) * EM * size; // drop the baseline so the text is centered on the line
    const curve: number[] = [], boxes: Circle[] = [], ground: number[] = [], mids: number[] = [];
    let seg = 1, pen = start, last = NaN, bx = 0, by = 0;
    for (const advance of line.advances) {
        const a = advance * size, mid = pen + a / 2;
        while (seg < n - 1 && cum[seg] < mid) seg++;
        const len = cum[seg] - cum[seg - 1] || 1, t = mid - cum[seg - 1];
        let dx = (xs[seg] - xs[seg - 1]) / len, dy = (ys[seg] - ys[seg - 1]) / len, cx = xs[seg - 1] + dx * t, cy = ys[seg - 1] + dy * t;
        if (tr.globeness && behind(us[seg - 1] + (us[seg] - us[seg - 1]) * t / len, vs[seg - 1] + (vs[seg] - vs[seg - 1]) * t / len)) return null;
        if (k) {
            // Text on the ground: the place of the glyph on the ground, and where one step along the line and one step
            // across it go on the screen from there. (The perspective changes along a piece of the line: one size for
            // the whole piece made the size of the letters jump at each point of the line.)
            const tu = (us[seg] - us[seg - 1]) / len, tv = (vs[seg] - vs[seg - 1]) / len, pu = us[seg - 1] + tu * t, pv = vs[seg - 1] + tv * t, e = 16;
            const m = heightAt(tr, it, pu, pv), [px, py] = tr.projectTile(it.id, pu, pv, m), [fx, fy] = tr.projectTile(it.id, pu + tu * e, pv + tv * e, m), [qx, qy] = tr.projectTile(it.id, pu - tv * e, pv + tu * e, m);
            // (On the globe a step in the tile is shorter on the sphere where the latitude is higher. Each glyph keeps the
            // size at the anchor, as in MapLibre GL JS, also when the text spans many degrees of latitude.)
            const f = round ? (1 + round * (anchorCos / cosLat(pv) - 1)) / e : 1 / e;
            cx = px; cy = py; dx = (fx - px) * f; dy = (fy - py) * f; bx = (qx - px) * f; by = (qy - py) * f;
        }
        const angle = Math.atan2(dy, dx);
        // A sharp bend inside the text makes it unreadable. The limit is `text-max-angle`: 45 degrees by default,
        // for which a turn of 0.6 radians between neighbors gives the results nearest to MapLibre's.
        if (!Number.isNaN(last)) { let d = angle - last; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) > 0.6 * (l.maxAngle ?? 45) / 45) return null; }
        last = angle;
        if (!k) { bx = -dy; by = dx; }
        curve.push(cx + (bx * shift - dx * a / 2) * fit - ax, cy + (by * shift - dy * a / 2) * fit - ay, angle);
        if (k) ground.push(Math.hypot(dx, dy), bx, by);
        mids.push(cx, cy);
        pen += a + spacing;
    }
    // As in MapLibre GL JS (`placeCollisionCircles`), the text takes space as circles of the height of the text and
    // `text-padding`, on the line from the center of the first glyph to that of the last (inset by a quarter of the
    // radius at each end), with their centers 2.5 radii apart. (The glyph centers stand for the line between them; the
    // text has two glyphs or more.)
    const r = h / 2 + l.padding, along = [0];
    for (let i = 2; i < mids.length; i += 2) along.push(along[i / 2 - 1] + Math.hypot(mids[i] - mids[i - 2], mids[i + 1] - mids[i - 1]));
    const length = along[along.length - 1], inset = Math.min(r / 4, length / 2), padded = length - inset * 2;
    const count = length <= r / 2 ? 1 : Math.ceil(padded / (r * 2.5)) + 1;
    for (let i = 0, j = 1; i < count; i++) {
        const d = inset + padded * i / Math.max(count - 1, 1);
        while (j < along.length - 1 && along[j] < d) j++;
        const f = along[j] > along[j - 1] ? (d - along[j - 1]) / (along[j] - along[j - 1]) : 0;
        const x = mids[j * 2 - 2] + (mids[j * 2] - mids[j * 2 - 2]) * f, y = mids[j * 2 - 1] + (mids[j * 2 + 1] - mids[j * 2 - 1]) * f;
        boxes.push([x - r, y - r, x + r, y + r, r]);
    }
    return {curve, ground: k ? ground : undefined, boxes};
}

export const FULL_CLIP: [number, number, number, number] = [0, 0, EXTENT, EXTENT];

/**
 * Picks what to draw for the ideal tile set: the tile itself when loaded, otherwise the matching part of a loaded
 * ancestor, otherwise any loaded children. Both the live map and server rendering use this.
 */
export function renderItems<T>(tr: Transform, ideal: TileID[], get: (key: string) => T | undefined): RenderItem<T>[] {
    const items: RenderItem<T>[] = [];
    const push = (id: TileID, clip: [number, number, number, number], tile: T) =>
        items.push({id, matrix: tr.tileMatrix(id), matrix4: tr.tileMatrix4(id), scale: tr.tileScale(id.z), clip, tile});
    for (const id of ideal) {
        const tile = get(id.key);
        if (tile) { push(id, FULL_CLIP, tile); continue; }
        let found = false;
        for (let dz = 1; dz <= id.z && !found; dz++) {
            const z = id.z - dz, x = id.x >> dz, y = id.y >> dz, parent = get(`${z}/${x}/${y}`);
            if (!parent) continue;
            const size = EXTENT / 2 ** dz, cx = (id.x - (x << dz)) * size, cy = (id.y - (y << dz)) * size;
            push({z, x, y, w: id.w, key: `${z}/${x}/${y}`}, [cx, cy, cx + size, cy + size], parent);
            found = true;
        }
        if (found) continue;
        // Zooming out: stand in with whatever deeper tiles are loaded, two levels down at most.
        const below = (z: number, x: number, y: number, depth: number) => {
            for (let i = 0; i < 4; i++) {
                const cz = z + 1, cx = x * 2 + (i & 1), cy = y * 2 + (i >> 1), key = `${cz}/${cx}/${cy}`, child = get(key);
                if (child) push({z: cz, x: cx, y: cy, w: id.w, key}, FULL_CLIP, child);
                else if (depth > 1) below(cz, cx, cy, depth - 1);
            }
        };
        below(id.z, id.x, id.y, 2);
    }
    return items;
}
