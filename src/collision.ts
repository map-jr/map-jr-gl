/**
 * Screen-space boxes and circles in a coarse grid, for asking "does this overlap anything placed so far?". The circles
 * are those of text along a line, as in MapLibre GL JS's `GridIndex`.
 */
export class CollisionGrid {
    private cells = new Map<number, number[]>();
    /** Five numbers for each entry: its bound, and the radius of a circle (0 for a box). */
    private boxes: number[] = [];
    constructor(private cell = 48) {}

    private visit(x0: number, y0: number, x1: number, y1: number, fn: (key: number) => boolean | void) {
        const c = this.cell;
        for (let cy = Math.floor(y0 / c); cy <= Math.floor(y1 / c); cy++) {
            for (let cx = Math.floor(x0 / c); cx <= Math.floor(x1 / c); cx++) if (fn((cy + 512) * 4096 + cx + 512)) return;
        }
    }
    /** Whether the box, or the circle at (`cx`, `cy`) with the radius `r` in that box, overlaps an entry. */
    hits(x0: number, y0: number, x1: number, y1: number, r = 0): boolean {
        const b = this.boxes;
        let hit = false;
        this.visit(x0, y0, x1, y1, key => {
            for (const i of this.cells.get(key) ?? []) {
                if (!(x0 < b[i + 2] && x1 > b[i] && y0 < b[i + 3] && y1 > b[i + 1])) continue;
                const s = b[i + 4];
                if (r || s) {
                    // Two circles touch when their centers are closer than the sum of the radii. A circle and a box touch
                    // when the point of the box nearest to the center is within the radius (as in MapLibre GL JS).
                    const dx = Math.abs(x0 + x1 - b[i] - b[i + 2]) / 2, dy = Math.abs(y0 + y1 - b[i + 1] - b[i + 3]) / 2;
                    if (r && s ? dx * dx + dy * dy >= (r + s) * (r + s) : (r ? sq(dx - (b[i + 2] - b[i]) / 2) + sq(dy - (b[i + 3] - b[i + 1]) / 2) > r * r : sq(dx - (x1 - x0) / 2) + sq(dy - (y1 - y0) / 2) > s * s)) continue;
                }
                return hit = true;
            }
        });
        return hit;
    }
    /** Adds a box, or with `r` the circle of that radius in the box. */
    insert(x0: number, y0: number, x1: number, y1: number, r = 0) {
        const i = this.boxes.length;
        this.boxes.push(x0, y0, x1, y1, r);
        this.visit(x0, y0, x1, y1, key => {
            const list = this.cells.get(key);
            if (list) list.push(i); else this.cells.set(key, [i]);
        });
    }
}

/** The square of the part of a distance that is positive. */
const sq = (d: number) => d > 0 ? d * d : 0;
