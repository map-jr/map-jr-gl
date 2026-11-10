import {type Mat, type Transform, type TileID, EXTENT} from './geo.ts';
import type {CompiledLayer, SpriteIcon} from './style.ts';
import type {LabelSrc} from './tile.ts';
import {EM, type Shaped, type Shaper} from './text.ts';

/** One tile (or part of one) scheduled for drawing this frame. */
export interface RenderItem<T> {
    id: TileID;
    matrix: Mat;
    /** The same mapping with perspective, for the GPU. */
    matrix4: Float32Array;
    /** Pixels per tile unit. */
    scale: number;
    /** Visible sub-rectangle in tile units; smaller than the full tile when a parent stands in for a missing child. */
    clip: [number, number, number, number];
    tile: T;
}

export interface PlacedIcon {
    /** Centre, size and rotation on screen. */
    x: number; y: number; w: number; h: number; angle: number;
    /** Source rectangle in the sprite sheet, in its pixels. */
    rect: [number, number, number, number];
    /** True for images added at runtime (drawn from the dynamic atlas) rather than the style's sprite sheet. */
    custom?: boolean;
    name: string;
}
export interface Placed {
    /** Centre of the text block in screen pixels. */
    x: number; y: number;
    angle: number; size: number; shaped: Shaped | null; src: LabelSrc; icon?: PlacedIcon;
    /** Text following a line: for each glyph, where its baseline starts relative to the label's anchor, and its rotation (x, y, angle triples). */
    curve?: number[];
    /** Identity that survives between placements (and between a tile and its parent), for fading. */
    key: string;
    tile: TileID;
    /** Where the label's map anchor was on screen when placed, so it can be moved with the map between placements. */
    ax: number; ay: number;
    opacity: number;
}
export type IconLookup = (name: string) => (SpriteIcon & {custom?: boolean}) | undefined;

export class CollisionGrid {
    private cells = new Map<number, number[]>();
    private boxes: number[] = [];
    constructor(private cell = 48) {}

    private visit(x0: number, y0: number, x1: number, y1: number, fn: (key: number) => boolean | void) {
        const c = this.cell;
        for (let cy = Math.floor(y0 / c); cy <= Math.floor(y1 / c); cy++) {
            for (let cx = Math.floor(x0 / c); cx <= Math.floor(x1 / c); cx++) if (fn((cy + 512) * 4096 + cx + 512)) return;
        }
    }
    hits(x0: number, y0: number, x1: number, y1: number): boolean {
        const b = this.boxes;
        let hit = false;
        this.visit(x0, y0, x1, y1, key => {
            for (const i of this.cells.get(key) ?? []) {
                if (x0 < b[i + 2] && x1 > b[i] && y0 < b[i + 3] && y1 > b[i + 1]) return hit = true;
            }
        });
        return hit;
    }
    insert(x0: number, y0: number, x1: number, y1: number) {
        const i = this.boxes.length;
        this.boxes.push(x0, y0, x1, y1);
        this.visit(x0, y0, x1, y1, key => {
            const list = this.cells.get(key);
            if (list) list.push(i); else this.cells.set(key, [i]);
        });
    }
}

type Box = [number, number, number, number];
function boxAround(x: number, y: number, w: number, h: number, angle: number, pad: number): Box {
    const cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle));
    const hw = (w * cos + h * sin) / 2 + pad, hh = (w * sin + h * cos) / 2 + pad;
    return [x - hw, y - hh, x + hw, y + hh];
}

/**
 * Chooses which labels and icons to show. Layers later in the style win, matching MapLibre's priority order.
 * Runs fully from scratch each call; it is cheap enough for the label counts of a single viewport.
 */
export function placeLabels(
    tr: Transform, items: RenderItem<{labels: Record<string, LabelSrc[]>}>[], layers: CompiledLayer[], shaper: Shaper, grid: CollisionGrid,
    icons?: IconLookup,
): Placed[] {
    const out: Placed[] = [], seen = new Map<string, number[]>();
    const margin = 100;
    for (let li = layers.length - 1; li >= 0; li--) {
        const L = layers[li];
        if (L.type !== 'symbol' || !L.visible || tr.zoom < L.minzoom || tr.zoom >= L.maxzoom) continue;
        for (const it of items) {
            const labels = it.tile.labels?.[L.id];
            if (!labels) continue;
            const t = Math.min(1, Math.max(0, tr.zoom - it.id.z));
            for (const l of labels) {
                if (l.x < it.clip[0] || l.y < it.clip[1] || l.x >= it.clip[2] || l.y >= it.clip[3]) continue;
                const [ax, ay] = tr.projectTile(it.id, l.x, l.y);
                if (ax < -margin || ay < -margin || ax > tr.width + margin || ay > tr.height + margin) continue;
                const size = l.size0 + (l.size1 - l.size0) * t, s = size / EM, line = l.angle !== null;
                const meta = l.icon ? icons?.(l.icon.name) : undefined;
                const shaped = l.text ? shaper.shape(l.text, l.font, line ? 1e3 : l.maxWidth, l.spacing) : null;
                const w = shaped ? shaped.width * s : 0, h = shaped ? shaped.height * s : 0;
                const hasText = w > 0;
                if (!hasText && !meta) continue;
                // Direction of the line on screen, found by projecting a second point a little way along it.
                let lineAngle = 0;
                if (line) { const [bx, by] = tr.projectTile(it.id, l.x + Math.cos(l.angle!) * 64, l.y + Math.sin(l.angle!) * 64); lineAngle = Math.atan2(by - ay, bx - ax); }

                // Where the text could go: along the line, at one of several anchors, or at its fixed anchor.
                let textAngle = 0, candidates: [number, number][] = [];
                if (hasText) {
                    const shift = (anchor: string, r: number): [number, number] => [
                        anchor.includes('left') ? w / 2 + r : anchor.includes('right') ? -w / 2 - r : 0,
                        anchor.includes('top') ? h / 2 + r : anchor.includes('bottom') ? -h / 2 - r : 0];
                    if (line && !l.upright && l.path && shaped!.lines.length === 1 && shaped!.lines[0].chars.length > 1) {
                        // Follow the line: each glyph sits on the path at its own distance from the anchor, turned to the path's direction.
                        const curved = followLine(tr, it, l, shaped!.lines[0], s, ax, ay, w, h, grid);
                        if (!curved) continue;
                        const prev = seen.get(l.text);
                        if (prev) { let dup = false; for (let i = 0; i < prev.length && !dup; i += 2) dup = Math.hypot(prev[i] - ax, prev[i + 1] - ay) < 300; if (dup) continue; }
                        if (!l.overlap && curved.boxes.some(b => grid.hits(...b))) continue;
                        if (!l.ignore) for (const b of curved.boxes) grid.insert(...b);
                        if (prev) prev.push(ax, ay); else seen.set(l.text, [ax, ay]);
                        const n = 2 ** it.id.z, q = 2 ** 22;
                        const key = `${L.id}|${l.text}||${Math.round((it.id.x + l.x / EXTENT) / n * q)},${Math.round((it.id.y + l.y / EXTENT) / n * q)},${it.id.w}`;
                        out.push({x: ax, y: ay, angle: 0, size, shaped, src: l, curve: curved.curve, key, tile: it.id, ax, ay, opacity: 1});
                        continue;
                    }
                    if (line && !l.upright) {
                        if (l.len * it.scale < w * 1.15) continue; // the road is shorter than its name at this zoom
                        textAngle = Math.atan2(Math.sin(lineAngle), Math.cos(lineAngle));
                        if (textAngle > Math.PI / 2) textAngle -= Math.PI; else if (textAngle <= -Math.PI / 2) textAngle += Math.PI;
                        const oy = l.offset[1] * size;
                        candidates = [[-Math.sin(textAngle) * oy, Math.cos(textAngle) * oy]];
                    } else if (l.varAnchor?.length && !line) candidates = l.varAnchor.map(a => shift(a, l.radial * size));
                    else {
                        const [sx, sy] = line ? [0, 0] : shift(l.anchor, 0);
                        candidates = [[l.offset[0] * size + sx, l.offset[1] * size + sy]];
                    }
                    // The same name often arrives from several tiles or road segments: keep them apart.
                    const prev = seen.get(l.text), minDist = line ? 300 : 120;
                    let dup = false;
                    if (prev) for (let i = 0; i < prev.length && !dup; i += 2) dup = Math.hypot(prev[i] - ax, prev[i + 1] - ay) < minDist;
                    if (dup) continue;
                }
                let textBox: Box | null = null, tx = ax, ty = ay;
                for (const [dx, dy] of candidates) {
                    const box = boxAround(ax + dx, ay + dy, w, h, textAngle, l.padding);
                    if (l.overlap || !grid.hits(...box)) { textBox = box; tx = ax + dx; ty = ay + dy; break; }
                }
                if (hasText && !textBox && !(meta && l.textOptional)) continue;

                let icon: PlacedIcon | undefined, iconBox: Box | null = null;
                if (meta && l.icon) {
                    const ic = l.icon, fit = hasText && textBox ? ic.fit : 'none';
                    let iw = meta.width / meta.pixelRatio * ic.size, ih = meta.height / meta.pixelRatio * ic.size;
                    let ix = ax + ic.offset[0] * ic.size, iy = ay + ic.offset[1] * ic.size;
                    if (fit !== 'none') {
                        // Stretch the icon around the text, e.g. a road shield around its number.
                        const [pt, pr, pb, pl] = ic.fitPad.map(v => v * ic.size);
                        if (fit !== 'height') { iw = w + pl + pr; ix = tx + (pr - pl) / 2; }
                        if (fit !== 'width') { ih = h + pt + pb; iy = ty + (pb - pt) / 2; }
                    }
                    const angle = (line && !ic.upright ? lineAngle : 0) + ic.rotate * Math.PI / 180;
                    const box = boxAround(ix, iy, iw, ih, angle, 1);
                    if (ic.overlap || !grid.hits(...box)) {
                        iconBox = box;
                        icon = {x: ix, y: iy, w: iw, h: ih, angle, rect: [meta.x, meta.y, meta.width, meta.height], custom: meta.custom, name: ic.name};
                    } else if (!(hasText && textBox && ic.optional)) continue;
                }
                if (!textBox && !icon) continue;
                if (!l.ignore) {
                    if (textBox) grid.insert(...textBox);
                    if (iconBox) grid.insert(...iconBox);
                }
                if (textBox) {
                    const prev = seen.get(l.text);
                    if (prev) prev.push(ax, ay); else seen.set(l.text, [ax, ay]);
                }
                const n = 2 ** it.id.z, q = 2 ** 22;
                const key = `${L.id}|${l.text}|${l.icon?.name ?? ''}|${Math.round((it.id.x + l.x / EXTENT) / n * q)},${Math.round((it.id.y + l.y / EXTENT) / n * q)},${it.id.w}`;
                out.push({x: tx, y: ty, angle: textAngle, size, shaped: textBox ? shaped : null, src: l, icon, key, tile: it.id, ax, ay, opacity: 1});
            }
        }
    }
    return out;
}

/**
 * Lays one line of text along a label's path. Returns each glyph's start point (relative to the anchor) and angle, plus
 * collision boxes, or null when the text does not fit or the line bends too sharply to read.
 */
function followLine(
    tr: Transform, it: RenderItem<unknown>, l: LabelSrc, line: {advances: number[]}, s: number, ax: number, ay: number, w: number, h: number, _grid: CollisionGrid,
): {curve: number[]; boxes: Box[]} | null {
    const path = l.path!, n = path.length / 2;
    let xs: number[] = [], ys: number[] = [];
    for (let i = 0; i < n; i++) { const [x, y] = tr.projectTile(it.id, path[i * 2], path[i * 2 + 1]); xs.push(x); ys.push(y); }
    let anchorIndex = l.pathIndex!;
    // Text should read left to right: run the path in whichever direction heads rightwards overall.
    if (xs[n - 1] < xs[0]) { xs = xs.reverse(); ys = ys.reverse(); anchorIndex = n - 1 - anchorIndex; }
    const cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
    const start = cum[anchorIndex] - w / 2;
    if (start < 0 || start + w > cum[n - 1]) return null; // not enough line for the text at this zoom
    const spacing = l.spacing * EM * s, shift = (l.offset[1] + 0.34) * EM * s; // drop the baseline so the text is centred on the line
    const curve: number[] = [], boxes: Box[] = [];
    let seg = 1, pen = start, last = NaN;
    for (const advance of line.advances) {
        const a = advance * s, mid = pen + a / 2;
        while (seg < n - 1 && cum[seg] < mid) seg++;
        const len = cum[seg] - cum[seg - 1] || 1, dx = (xs[seg] - xs[seg - 1]) / len, dy = (ys[seg] - ys[seg - 1]) / len, angle = Math.atan2(dy, dx);
        // A sharp bend inside the text makes it unreadable; MapLibre's limit is 45 degrees between neighbours.
        if (!Number.isNaN(last)) { let d = angle - last; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) > 0.6) return null; }
        last = angle;
        const t = mid - cum[seg - 1], cx = xs[seg - 1] + dx * t, cy = ys[seg - 1] + dy * t;
        curve.push(cx - dx * a / 2 - dy * shift - ax, cy - dy * a / 2 + dx * shift - ay, angle);
        const r = h / 2 + l.padding;
        boxes.push([cx - r, cy - r, cx + r, cy + r]);
        pen += a + spacing;
    }
    return {curve, boxes};
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
