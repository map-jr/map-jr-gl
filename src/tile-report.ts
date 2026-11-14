// The report of the tile slots of the view that are not drawn, with the history of each tile (#360). Only the
// benchmark page asks for it: the engine keeps no history until the page turns it on (the `tileReport` command).

/** One tile slot of the view that has no tile of its own drawn. */
export interface UndrawnTile {
    /** "source|z/x/y". */
    key: string;
    /** The state of the slot's own tile: `loading`, `ok` (loaded but empty of GPU data, e.g. missing on the server), `error`, or `none` (not in the cache). */
    state: string;
    /** What stands in for it: "parent z/x/y", "children N", or "none" (the slot shows no map). */
    cover: string;
    /** The events of the tile, oldest first, each "event@ms" in milliseconds since the history was turned on. */
    history: string[];
}

/** At most this many events are kept for each tile, and history for at most this many tiles. */
const EVENTS = 12, KEYS = 4000;

/** Adds an event to the history of a tile. */
export function logTile(log: Map<string, string[]>, key: string, event: string, ms: number, times?: Map<string, TileTimes>) {
    // (The steps of the timing: the last request, and the answer and upload that follow it.)
    if (times && (event === 'requested' || event === 'answered' || event === 'uploaded')) {
        let t = times.get(key);
        if (!t) times.set(key, t = {});
        if (event === 'requested') t.answered = t.uploaded = undefined;
        t[event] = ms;
    }
    let list = log.get(key);
    if (!list) {
        if (log.size >= KEYS) log.delete(log.keys().next().value!);
        log.set(key, list = []);
    }
    list.push(`${event}@${Math.round(ms)}`);
    if (list.length > EVENTS) list.shift();
}

/**
 * Lists the slots of `ideal` (per source, the tile ids of the view) whose own tile is not drawn. `drawn(key)` says
 * whether the tile of a key ("source|z/x/y") is drawable; `state(key)` gives its state or undefined. The cover follows
 * the rule of `renderItems`: the nearest parent, else loaded children up to two levels down.
 */
export function undrawnTiles(ideal: Map<string, {z: number; x: number; y: number; key: string}[]>, drawn: (key: string) => boolean, state: (key: string) => string | undefined, log: Map<string, string[]>): UndrawnTile[] {
    const out: UndrawnTile[] = [];
    for (const [source, ids] of ideal) for (const id of ids) {
        const key = source + '|' + id.key;
        if (drawn(key)) continue;
        let cover = 'none';
        for (let dz = 1; dz <= id.z; dz++) {
            const k = `${id.z - dz}/${id.x >> dz}/${id.y >> dz}`;
            if (drawn(source + '|' + k)) { cover = 'parent ' + k; break; }
        }
        if (cover === 'none') {
            let n = 0;
            const below = (z: number, x: number, y: number, depth: number) => {
                for (let i = 0; i < 4; i++) {
                    const cx = x * 2 + (i & 1), cy = y * 2 + (i >> 1);
                    if (drawn(`${source}|${z + 1}/${cx}/${cy}`)) n++; else if (depth > 1) below(z + 1, cx, cy, depth - 1);
                }
            };
            below(id.z, id.x, id.y, 2);
            if (n) cover = `children ${n}`;
        }
        out.push({key, state: state(key) ?? 'none', cover, history: log.get(key) ?? []});
    }
    return out;
}

/** The times (ms since the history was turned on) of the steps of one tile: `view` when its slot first came into view,
 * `drawn` when its own tile was first drawn there, and the last `requested`, `answered` and `uploaded`. `bare`: while it
 * waited, a frame showed no map in its slot (no parent or children covered it). */
export type TileTimes = {view?: number; /** The last frame with the slot in view. */ seen?: number; drawn?: number; requested?: number; answered?: number; uploaded?: number; bare?: boolean};

/** Notes the steps of the tiles of one frame: which slots came into view, which got their own tile drawn, and which showed no map. */
export function trackView(times: Map<string, TileTimes>, undrawn: UndrawnTile[], ideal: Map<string, {key: string}[]>, ms: number) {
    const missing = new Map(undrawn.map(t => [t.key, t]));
    for (const [source, ids] of ideal) for (const id of ids) {
        const key = source + '|' + id.key;
        let t = times.get(key);
        if (!t) times.set(key, t = {});
        t.view ??= ms;
        t.seen = ms;
        if (t.drawn !== undefined) continue;
        const u = missing.get(key);
        if (!u) t.drawn = ms; else if (u.cover === 'none') t.bare = true;
    }
}

/** A tile that took longer than `LATE` ms from coming into view to being drawn. The steps are in ms, and absent when unknown. */
export interface LateTile {
    key: string;
    /** From coming into view to drawn, or, when `drawn` is false, to the last frame that had it in view (it left the view, or the report came first). */
    ms: number;
    /** From the request to the answer of the tile worker (fetch and build), or to the decoded image for an image tile. */
    answer?: number;
    /** From the answer to the end of the upload to the GPU (the engine paces uploads). */
    upload?: number;
    /** From the upload to the first frame that drew it. */
    draw?: number;
    /** How long before coming into view the tile was requested (negative: after). */
    ahead?: number;
    /** A frame showed no map in its slot while it waited. */
    bare: boolean;
    drawn: boolean;
}
/** A tile drawn more than this many ms after it came into view is late. */
export const LATE = 250;

/** The tiles that came into view after `since` and were drawn late, or not drawn while in view for longer than `LATE`, slowest first. */
export function lateTiles(times: Map<string, TileTimes>, since: number): LateTile[] {
    const out: LateTile[] = [];
    const d = (a?: number, b?: number) => a === undefined || b === undefined ? undefined : Math.round(b - a);
    for (const [key, t] of times) {
        if (t.view === undefined || t.view < since) continue;
        const ms = (t.drawn ?? t.seen!) - t.view;
        if (ms <= LATE) continue;
        out.push({key, ms: Math.round(ms), answer: d(t.requested, t.answered), upload: d(t.answered, t.uploaded), draw: d(t.uploaded, t.drawn), ahead: d(t.requested, t.view), bare: !!t.bare, drawn: t.drawn !== undefined});
    }
    return out.sort((a, b) => b.ms - a.ms);
}
