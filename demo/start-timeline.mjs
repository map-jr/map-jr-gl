// The start timeline of the benchmark page (#371): for the first scenario of each library, the ms after the map was
// made at which each step of the start happened. The network steps come from the resource timings of the browser
// (`performance.getEntriesByType('resource')`), which are the same for both libraries. The other steps come from the
// map's own events (`render` for the first frame, `load`, `idle`). Tiles are fetched in workers, whose requests the
// resource timings of the page do not list, so the tile steps come from the libraries' tile events when the page has
// them: `dataloading` and `data` with a tile in MapLibre GL JS, and the `req` and `ans` events of `_tileReport` in this
// library (#381), each timed when the page receives it. With the worker renderer, the sprite and the glyphs are also
// fetched in a worker, so those steps are absent. This library has no event for "workers ready", so the line gives the
// time at which the worker file was answered instead. To show where the time between the first tile answer and idle
// goes, the line also gives three steps of the last tile built before idle (its network answer, from the resource timings
// that the bench page collects from its workers; its built tile, which is when the tile event fires; and its upload), the number of tiles answered before idle, the
// answer of the last glyph file before idle and the last frame before idle. Nothing here is in the built files.

const TILE = /\.(pbf|mvt)(\?|$)|\/tiles?\/\d+\/\d+\/\d+/, GLYPH = /\/fonts?\/|glyphs/, SPRITE = /sprite.*\.(png|json)(\?|$)/, WORKER = /worker[^/]*\.m?js/;

/**
 * The steps of one start, in ms after `t0` (a time of `performance.now()`), from resource timing entries
 * ({name, startTime, responseEnd}) and the times of the map's events ({frame, load, idle, tileReq, tileAns, tileLast, tileNet, tileUp, tiles, lastFrame}). A step that did not happen
 * is undefined. `style` is the URL of the style: the benchmark page fetches it before it makes the map, so that step
 * is negative.
 */
export function startSteps(entries, t0, events, style) {
    const first = (test, key) => {
        const v = entries.filter(e => test(e.name) && e.responseEnd >= t0 - 1).map(e => e[key]);
        return v.length ? Math.min(...v) - t0 : undefined;
    };
    // (The last answer before idle; without an idle event, the last answer.)
    const before = test => entries.filter(e => test(e.name) && e.responseEnd >= t0 - 1 && (events.idle === undefined || e.responseEnd <= events.idle));
    const last = test => { const v = before(test).map(e => e.responseEnd); return v.length ? Math.max(...v) - t0 : undefined; };
    const tile = n => TILE.test(n) && !GLYPH.test(n);
    const styleEntry = entries.filter(e => e.name === style).at(-1);
    const ev = k => events[k] === undefined ? undefined : events[k] - t0;
    return {
        style: styleEntry ? styleEntry.responseEnd - t0 : undefined,
        tileReq: ev('tileReq') ?? first(tile, 'startTime'), tileAns: ev('tileAns') ?? first(tile, 'responseEnd'),
        tileLast: ev('tileLast') ?? last(tile), tileNet: ev('tileNet'), tileUp: ev('tileUp'), tiles: events.tiles ?? (before(tile).length || undefined),
        sprite: first(n => SPRITE.test(n), 'responseEnd'), glyphs: first(n => GLYPH.test(n), 'responseEnd'), glyphLast: last(n => GLYPH.test(n)),
        worker: first(n => WORKER.test(n), 'responseEnd'),
        frame: ev('frame'), lastFrame: ev('lastFrame'), load: ev('load'), idle: ev('idle'),
    };
}

const median = a => { const s = a.filter(v => v !== undefined && !Number.isNaN(v)).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : undefined; };
const f = v => v === undefined ? '–' : Math.round(v).toString();

/** One line for a library from the steps of one or more starts (the median of each step), e.g. "MapLibre GL JS: style -40, …". */
export function timelineLine(name, runs) {
    const m = k => median(runs.map(r => r[k]));
    return `${name}${runs.length > 1 ? ` (median of ${runs.length})` : ''}: style ${f(m('style'))}, first tile req ${f(m('tileReq'))} / ans ${f(m('tileAns'))}, last tile net ${f(m('tileNet'))} / built ${f(m('tileLast'))} / up ${f(m('tileUp'))} (${f(m('tiles'))} tiles), sprite ${f(m('sprite'))}, glyphs ${f(m('glyphs'))} / last ${f(m('glyphLast'))}, worker file ${f(m('worker'))}, first frame ${f(m('frame'))} / last ${f(m('lastFrame'))}, load ${f(m('load'))}, idle ${f(m('idle'))}`;
}
