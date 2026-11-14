/**
 * The places in the texture of images that are added at runtime (#27). Images go in rows. The place of an image that
 * the map no longer has goes to a free list, and later images of any size that fits take it. Free places that touch
 * along a whole edge become one, so cycles of images of different sizes do not cut the texture into small pieces.
 * Free places that share only part of an edge do not join, so after many replacements the texture can be mostly free
 * and still have no place for an image: the map then places its images again in a new `AtlasSpace` (`repack`).
 * Each place keeps one empty pixel to its right and below it, so that a filtered image does not read its neighbour.
 */
export class AtlasSpace {
    private pen = [1, 1, 0];
    /** Free places as [x, y, width, height], with the empty pixel included. */
    free: number[][] = [];
    constructor(private size: number) {}

    /** The corner of a place for an image of `w` by `h` pixels, or null when the texture has no place for it. */
    take(w: number, h: number): [number, number] | null {
        const W = w + 1, H = h + 1, pen = this.pen;
        let best = -1;
        this.free.forEach((r, i) => { if (r[2] >= W && r[3] >= H && (best < 0 || r[2] * r[3] < this.free[best][2] * this.free[best][3])) best = i; });
        if (best >= 0) {
            const [x, y, rw, rh] = this.free.splice(best, 1)[0];
            if (rw > W) this.free.push([x + W, y, rw - W, H]);
            if (rh > H) this.free.push([x, y + H, rw, rh - H]);
            return [x, y];
        }
        if (pen[0] + W > this.size) { pen[0] = 1; pen[1] += pen[2] + 1; pen[2] = 0; }
        if (pen[1] + H > this.size) return null;
        const at: [number, number] = [pen[0], pen[1]];
        pen[0] += W;
        pen[2] = Math.max(pen[2], h);
        return at;
    }

    /** Gives back the place of an image of `w` by `h` pixels at `x`, `y`. */
    give(x: number, y: number, w: number, h: number) {
        let r = [x, y, w + 1, h + 1];
        for (let i = 0; i < this.free.length; i++) {
            const o = this.free[i];
            const row = o[1] === r[1] && o[3] === r[3] && (o[0] + o[2] === r[0] || r[0] + r[2] === o[0]);
            const col = o[0] === r[0] && o[2] === r[2] && (o[1] + o[3] === r[1] || r[1] + r[3] === o[1]);
            if (row || col) {
                this.free.splice(i, 1);
                r = row ? [Math.min(o[0], r[0]), r[1], o[2] + r[2], r[3]] : [r[0], Math.min(o[1], r[1]), r[2], o[3] + r[3]];
                i = -1;
            }
        }
        this.free.push(r);
    }

    /**
     * Places images of the given sizes in this empty space, the tallest first. Returns the corner of each, in the
     * order given, or null when they do not all fit.
     */
    repack(sizes: [number, number][]): [number, number][] | null {
        const at: [number, number][] = [];
        for (const i of sizes.map((_, i) => i).sort((a, b) => sizes[b][1] - sizes[a][1])) {
            const p = this.take(sizes[i][0], sizes[i][1]);
            if (!p) return null;
            at[i] = p;
        }
        return at;
    }
}
