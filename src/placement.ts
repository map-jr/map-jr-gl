import {type Mat, type Transform, type TileID, EXTENT, apply} from './geo.ts';
import type {CompiledLayer} from './style.ts';
import type {LabelSrc} from './tile.ts';
import {EM, type Shaped, type Shaper} from './text.ts';

/** One tile (or part of one) scheduled for drawing this frame. */
export interface RenderItem<T> {
    id: TileID;
    matrix: Mat;
    /** Pixels per tile unit. */
    scale: number;
    /** Visible sub-rectangle in tile units; smaller than the full tile when a parent stands in for a missing child. */
    clip: [number, number, number, number];
    tile: T;
}

export interface Placed {
    /** Centre of the text block in screen pixels. */
    x: number; y: number;
    angle: number; size: number; shaped: Shaped; src: LabelSrc;
}

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

/**
 * Chooses which labels to show. Layers later in the style win, matching MapLibre's priority order.
 * Runs fully from scratch each call; it is cheap enough for the label counts of a single viewport.
 */
export function placeLabels(
    tr: Transform, items: RenderItem<{labels: Record<string, LabelSrc[]>}>[], layers: CompiledLayer[], shaper: Shaper, grid: CollisionGrid,
): Placed[] {
    const out: Placed[] = [], seen = new Map<string, number[]>();
    const mapAngle = -tr.bearing * Math.PI / 180, margin = 100;
    for (let li = layers.length - 1; li >= 0; li--) {
        const L = layers[li];
        if (L.type !== 'symbol' || !L.visible || tr.zoom < L.minzoom || tr.zoom >= L.maxzoom) continue;
        for (const it of items) {
            const labels = it.tile.labels[L.id];
            if (!labels) continue;
            const t = Math.min(1, Math.max(0, tr.zoom - it.id.z));
            for (const l of labels) {
                if (l.x < it.clip[0] || l.y < it.clip[1] || l.x >= it.clip[2] || l.y >= it.clip[3]) continue;
                let [x, y] = apply(it.matrix, l.x, l.y);
                if (x < -margin || y < -margin || x > tr.width + margin || y > tr.height + margin) continue;
                const size = l.size0 + (l.size1 - l.size0) * t, s = size / EM;
                const shaped = shaper.shape(l.text, l.font, l.angle === null ? l.maxWidth : 1e3, l.spacing);
                const w = shaped.width * s, h = shaped.height * s;
                if (!w) continue;
                let angle = 0;
                if (l.angle !== null) {
                    if (l.len * it.scale < w * 1.15) continue; // the road is shorter than its name at this zoom
                    angle = l.angle + mapAngle;
                    angle = Math.atan2(Math.sin(angle), Math.cos(angle));
                    if (angle > Math.PI / 2) angle -= Math.PI; else if (angle <= -Math.PI / 2) angle += Math.PI;
                } else {
                    x += l.offset[0] * size + (l.anchor.includes('left') ? w / 2 : l.anchor.includes('right') ? -w / 2 : 0);
                    y += l.offset[1] * size + (l.anchor.includes('top') ? h / 2 : l.anchor.includes('bottom') ? -h / 2 : 0);
                }
                const cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle));
                const hw = (w * cos + h * sin) / 2 + l.padding, hh = (w * sin + h * cos) / 2 + l.padding;
                // The same name often arrives from several tiles or road segments: keep them apart.
                const prev = seen.get(l.text), minDist = l.angle !== null ? 300 : 120;
                let dup = false;
                if (prev) for (let i = 0; i < prev.length && !dup; i += 2) dup = Math.hypot(prev[i] - x, prev[i + 1] - y) < minDist;
                if (dup) continue;
                if (!l.overlap && grid.hits(x - hw, y - hh, x + hw, y + hh)) continue;
                grid.insert(x - hw, y - hh, x + hw, y + hh);
                if (prev) prev.push(x, y); else seen.set(l.text, [x, y]);
                out.push({x, y, angle, size, shaped, src: l});
            }
        }
    }
    return out;
}

export const FULL_CLIP: [number, number, number, number] = [0, 0, EXTENT, EXTENT];

/**
 * Picks what to draw for the ideal tile set: the tile itself when loaded, otherwise the matching part of a loaded
 * ancestor, otherwise any loaded children. Both the live map and server rendering use this.
 */
export function renderItems<T>(tr: Transform, ideal: TileID[], get: (key: string) => T | undefined): RenderItem<T>[] {
    const items: RenderItem<T>[] = [];
    const push = (id: TileID, clip: [number, number, number, number], tile: T) =>
        items.push({id, matrix: tr.tileMatrix(id), scale: tr.tileScale(id.z), clip, tile});
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
        for (let i = 0; i < 4; i++) {
            const z = id.z + 1, x = id.x * 2 + (i & 1), y = id.y * 2 + (i >> 1), child = get(`${z}/${x}/${y}`);
            if (child) push({z, x, y, w: id.w, key: `${z}/${x}/${y}`}, FULL_CLIP, child);
        }
    }
    return items;
}
