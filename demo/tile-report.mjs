// The report of the benchmark page on the tiles of this library (#360): the tile slots of the view that are not drawn,
// and the tiles that were drawn late after they came into view. It is made here, on the page, from the `tile` events
// that the engine fires after `map._tileReport(true)`, so that maps that do not ask pay almost nothing.

/** A tile drawn more than this many ms after it came into view is late. */
export const LATE = 250;
/** At most this many events are kept for each tile, and records for at most this many tiles. */
const EVENTS = 12, KEYS = 4000;
const NAMES = {req: 'requested', ans: 'answered', up: 'uploaded', miss: 'missing', fail: 'failed', drop: 'dropped'};

export class TileReport {
    constructor() {
        /** key ("source|z/x/y") -> {state, history, view, seen, drawn, requested, answered, uploaded, bare} */
        this.tiles = new Map();
        /** The tile slots of the view in the last frame. */
        this.view = [];
        this.start = undefined;
        this.since = 0;
        this.marking = false;
    }

    /** Takes one `tile` event of the map: {key, kind, t, error}. */
    event(e) {
        this.start ??= e.t;
        const ms = e.t - this.start;
        if (e.kind === 'frame') return this.frame(e.key, ms);
        const t = this.get(e.key);
        // (A tile dropped while it loads is cancelled; one dropped after that is evicted from the cache.)
        const name = e.kind === 'drop' ? (t.state === 'req' || t.state === 'ans' ? 'cancelled' : 'evicted') : e.kind === 'fail' ? `failed: ${e.error}` : NAMES[e.kind];
        t.state = e.kind === 'drop' ? undefined : e.kind;
        if (e.kind === 'req') t.answered = t.uploaded = undefined;
        if (e.kind === 'req') t.requested = ms; else if (e.kind === 'ans') t.answered = ms; else if (e.kind === 'up') t.uploaded = ms;
        t.history.push(`${name}@${Math.round(ms)}`);
        if (t.history.length > EVENTS) t.history.shift();
    }

    /** From the next frame on, tiles that come into view count for `late()` (the start of the pan). */
    mark() { this.marking = true; }

    get(key) {
        let t = this.tiles.get(key);
        if (!t) {
            if (this.tiles.size >= KEYS) this.tiles.delete(this.tiles.keys().next().value);
            this.tiles.set(key, t = {history: []});
        }
        return t;
    }

    drawn(key) { return this.tiles.get(key)?.state === 'up'; }

    /** What stands in for a slot that is not drawn, by the rule of the engine: the nearest parent, else loaded children up to two levels down. */
    cover(key) {
        const bar = key.lastIndexOf('|'), source = key.slice(0, bar), [z, x, y] = key.slice(bar + 1).split('/').map(Number);
        for (let dz = 1; dz <= z; dz++) { const k = `${z - dz}/${x >> dz}/${y >> dz}`; if (this.drawn(`${source}|${k}`)) return 'parent ' + k; }
        let n = 0;
        const below = (z, x, y, depth) => {
            for (let i = 0; i < 4; i++) {
                const cx = x * 2 + (i & 1), cy = y * 2 + (i >> 1);
                if (this.drawn(`${source}|${z + 1}/${cx}/${cy}`)) n++; else if (depth > 1) below(z + 1, cx, cy, depth - 1);
            }
        };
        below(z, x, y, 2);
        return n ? `children ${n}` : 'none';
    }

    frame(keys, ms) {
        if (this.marking) { this.since = ms; this.marking = false; }
        // A slot that leaves the view before its tile is drawn counts again from when it comes back: with 3D terrain and a
        // turning view, a slot at the edge can be out of view for a second or more, and that time is not lateness (#384).
        const now = new Set(keys);
        for (const key of this.view) { const t = this.tiles.get(key); if (!now.has(key) && t && t.drawn === undefined) t.view = t.bare = undefined; }
        this.view = keys;
        for (const key of keys) {
            const t = this.get(key);
            t.view ??= ms;
            t.seen = ms;
            if (t.drawn !== undefined) continue;
            if (this.drawn(key)) t.drawn = ms; else if (this.cover(key) === 'none') t.bare = true;
        }
    }

    /** The slots of the view in the last frame that have no tile of their own drawn. */
    undrawn() {
        return this.view.filter(k => !this.drawn(k)).map(key => ({key, state: NAMES[this.tiles.get(key)?.state] ?? 'not requested', cover: this.cover(key), history: this.tiles.get(key)?.history ?? []}));
    }

    /**
     * The tiles that came into view after the mark and were drawn more than `LATE` ms later, or were in view that long
     * and never drawn, slowest first. The steps are in ms and absent when unknown: `answer` from the request to the answer
     * of the tile worker (fetch and build), `upload` to the GPU, `draw` to the first frame that drew it in view, and
     * `ahead`, how long before coming into view it was requested (negative: after).
     */
    late() {
        const d = (a, b) => a === undefined || b === undefined ? undefined : Math.round(b - a), out = [];
        for (const [key, t] of this.tiles) {
            if (t.view === undefined || t.view < this.since) continue;
            const ms = (t.drawn ?? t.seen) - t.view;
            if (ms <= LATE) continue;
            out.push({key, ms: Math.round(ms), answer: d(t.requested, t.answered), upload: d(t.answered, t.uploaded), draw: d(t.uploaded, t.drawn), ahead: d(t.requested, t.view), bare: !!t.bare, drawn: t.drawn !== undefined});
        }
        return out.sort((a, b) => b.ms - a.ms);
    }
}
