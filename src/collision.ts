/** Screen-space boxes in a coarse grid, for asking "does this overlap anything placed so far?". */
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
