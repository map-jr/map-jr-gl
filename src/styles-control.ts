// The control that picks the style (`styles()` of `@map-jr/map-jr-gl/controls`, #1504). It is a file of its own, which
// loads only when a map adds the control. Its pictures are drawn by a small second map of the main API, after the map
// of the control is first idle (the decision of #1158), so that the picker usually opens with them.
import type {Map} from './map.ts';
import type {MapDescription, MapInstance, ViewInput} from './host.ts';
import {createMap} from './host.ts';
import {ui, type Control} from './controls.ts';
import {button, group, svg} from './controls-more.ts';
import type {StylesOptions, StyleEntry} from './control-specs.ts';
import type {StyleSpecification} from './compat-types.ts';
import {applySSROverrides} from './style.ts';
import type {LayerJSON} from './resolve.ts';
import {styleFor} from './markers.ts';

const W = 120, H = 80;
const CSS = `.map-jr-styles{position:relative}
.map-jr-styles-list{position:absolute;display:flex;flex-direction:column;gap:6px;padding:6px;margin:0;overflow-y:auto;box-sizing:border-box;background:var(--map-control-background,#fff);color:inherit;--map-jr-sr:var(--map-control-radius,8px);border-radius:var(--map-jr-sr);box-shadow:0 0 0 1px rgb(0 0 0/.1),0 2px 6px rgb(0 0 0/.12),0 6px 18px rgb(0 0 0/.1);font:12px/1.3 system-ui,sans-serif;z-index:3}
.map-jr-dark .map-jr-styles-list{background:var(--map-control-background,#2b2b2b)}
.map-jr-styles-list[hidden]{display:none}
.map-jr-styles-list button{position:relative;display:block;width:${W}px;height:${H}px;padding:0;border:0;border-radius:max(0px,calc(var(--map-jr-sr) - 6px));overflow:hidden;background:none;color:#fff;font:inherit;font-weight:600;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent}
.map-jr-styles-list button[aria-pressed=true]::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 2px var(--map-control-focus,#2f7fd1)}
.map-jr-styles-list button:focus-visible{outline:2px solid var(--map-control-focus,#2f7fd1);outline-offset:1px}
@media (hover:hover){.map-jr-styles-list button:hover .map-jr-styles-pic img{filter:brightness(1.08)}}
.map-jr-styles-pic{position:absolute;inset:0;background:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 80' fill='none' stroke='%23888' stroke-opacity='.4' stroke-linecap='round'><path stroke-width='4' d='M-4 58C30 48 52 22 124 26'/><path stroke-width='2.5' d='M38-4 54 84M-4 18h56m30 0 4 66'/></svg>") center/cover,color-mix(in oklab,#888 18%,transparent)}
.map-jr-styles-pic img{position:absolute;inset:0;width:100%;height:100%;max-width:none;margin:0;padding:0;border:0;opacity:1;filter:none;transition:none;object-fit:cover}
.map-jr-styles-pic .map-jr-styles-in{animation:map-jr-styles-in .3s ease-out}
@keyframes map-jr-styles-in{from{opacity:0}}
@media (prefers-reduced-motion:reduce){.map-jr-styles-pic .map-jr-styles-in{animation:none}}
.map-jr-styles-list button>span+span{position:absolute;left:4px;bottom:4px;max-width:calc(100% - 20px);padding:2px 6px;border-radius:max(3px,calc(var(--map-jr-sr) - 10px));background:rgb(0 0 0/.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@supports (backdrop-filter:blur(1px)){.map-jr-styles-list button>span+span{background:rgb(0 0 0/.55);backdrop-filter:blur(6px)}
.map-jr-glass .map-jr-styles-list{--map-jr-sr:var(--map-jr-rr);background:var(--map-control-background,var(--map-jr-bg));box-shadow:var(--map-jr-shadow);backdrop-filter:blur(5px)}}
.map-jr-styles-pair{display:grid;grid-template-columns:auto auto;gap:4px 6px}.map-jr-styles-pair>span{grid-column:1/-1;padding:0 2px;font-weight:600}
@media (forced-colors:active){.map-jr-styles-list{border:1px solid CanvasText}}`;
/** A URL of the style made absolute against the URL of the style; the braces of a template (`{z}`, `{fontstack}`) stay. */
const abs = (u: unknown, base: string) => typeof u !== 'string' || /^[a-z][a-z\d+.-]*:/i.test(u) ? u : new URL(u, base).href.replace(/%7B/gi, '{').replace(/%7D/gi, '}');
/** How long a picture may take, its style included; after that the next picture starts. */
const WAIT = 20000;
/** Whether `s` is a style object: `version`, `sources` and `layers`. */
const isStyle = (s: any) => !!s && typeof s === 'object' && 'version' in s && !!s.sources && typeof s.sources === 'object' && Array.isArray(s.layers);
/**
 * The style of a picture (#1507): the style of the URL, loaded with `get` (the request path of the map: its protocols,
 * `transformRequest` and timeout) and with its URLs made absolute; with the overrides of `metadata["map-jr:ssr"]` unless
 * `server` is false (hidden, filter, minzoom, maxzoom, paint and layout, never simplify or minSize); and then `transform`
 * of `preview.style`. A failure is an error whose message is the reason and what to do.
 */
async function pictureStyle(given: unknown, server: boolean, transform: ((s: StyleSpecification) => StyleSpecification | void) | undefined, get: typeof fetch, signal: AbortSignal): Promise<unknown> {
    if (!server && !transform) return given;
    let s: any = given;
    if (typeof given === 'string') {
        const base = new URL(given, location.href).href;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const res = await Promise.race([get(base, {signal}), new Promise<never>((_, no) => { timer = setTimeout(() => no(new Error(`the style ${given} did not answer in ${WAIT / 1000} s. Check the URL`)), WAIT); signal.addEventListener('abort', () => no(new Error('removed'))); })])
            .catch(e => { throw e instanceof Error && e.message.startsWith('the style') ? e : new Error(`the request for the style ${given} failed (${String(e?.message ?? e).replace(/^\[map-jr-gl\] /, '')}). Check the URL and that the server allows it`); })
            .finally(() => clearTimeout(timer));
        if (!res.ok) throw new Error(`the style ${given} answered HTTP ${res.status}. Check the URL`);
        s = await res.json().catch(() => undefined);
        if (!isStyle(s)) throw new Error(`the answer of ${given} is not a style. Give the URL of a style JSON with "version", "sources" and "layers"`);
        s.sprite = Array.isArray(s.sprite) ? s.sprite.map((x: {url: string}) => ({...x, url: abs(x.url, base)})) : abs(s.sprite, base);
        s.glyphs = abs(s.glyphs, base);
        for (const src of Object.values<any>(s.sources)) { src.url = abs(src.url, base); if (typeof src.data === 'string') src.data = abs(src.data, base); if (Array.isArray(src.tiles)) src.tiles = src.tiles.map((t: string) => abs(t, base)); }
        for (const k of Object.keys(s)) if (s[k] === undefined) delete s[k];
    } else s = structuredClone(s);
    if (server && Array.isArray(s?.layers)) s.layers = applySSROverrides(s.layers as LayerJSON[]);
    if (!transform) return s;
    let out: unknown;
    try { out = transform(s) ?? s; } catch (e) { throw new Error(`preview.style threw "${(e as Error)?.message ?? e}". Fix the function, or return the style unchanged`); }
    if (!isStyle(out)) throw new Error(`preview.style returned ${JSON.stringify(out)?.slice(0, 40)}, which is not a style. Change the style in place and return nothing, or return a style object with "version", "sources" and "layers"`);
    return out;
}
const sheets = new WeakMap<Document, CSSStyleSheet>();

/** Adds the style sheet of the control to the root node of the map: a constructed sheet is not subject to `style-src`. */
function addSheet(el: HTMLElement, nonce?: string | null) {
    const root = el.getRootNode() as Document | ShadowRoot, doc = el.ownerDocument;
    try {
        let sheet = sheets.get(doc);
        if (!sheet) { sheet = new doc.defaultView!.CSSStyleSheet(); sheet.replaceSync(CSS); sheets.set(doc, sheet); }
        if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    } catch {
        if (doc.getElementById('map-jr-styles-css')) return;
        const s = Object.assign(doc.createElement('style'), {id: 'map-jr-styles-css', textContent: CSS});
        if (nonce) s.nonce = nonce;
        doc.head.appendChild(s);
    }
}

const sameStyle = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);
/** Whether the description shows the entry: its style, and the terrain and the global state that it sets (#1505). */
const shows = (e: StyleEntry, d: MapDescription) => sameStyle(e.style, d.style) && (e.terrain === undefined || sameStyle(e.terrain, d.terrain))
    && Object.keys(e.globalState ?? {}).every(k => sameStyle(e.globalState![k], d.globalState?.[k]));
/** The number of fields that the entry sets besides `style`: of two entries that the description shows, the one that sets more is current. */
const overrides = (e?: StyleEntry) => e ? +(e.terrain !== undefined) + Object.keys(e.globalState ?? {}).length : -1;
/** An entry has a light and a dark form when its style is `{light, dark}` or when `colorSchemes` is set (#1506). */
const twoForms = (e: StyleEntry) => !!e.colorSchemes || typeof e.style === 'object' && 'light' in e.style && 'dark' in e.style;
type Scheme = 'light' | 'dark';

/**
 * A button that opens a list of styles with a picture of each. A choice applies the style, the terrain and the global
 * state of the entry with one `patch`, so the camera stays, and calls `onStyleChange` with the entry. The pictures are made once the map is first idle, or at the first
 * click if that comes earlier; without `preview`, they show the view of the map and are made again when the list opens
 * on a view that has changed. The label lies on the picture; an entry without a picture, or whose picture failed, shows
 * a placeholder.
 */
export class StylesControl implements Control {
    private el?: HTMLElement;
    private trigger?: HTMLButtonElement;
    private list?: HTMLElement;
    private items: HTMLButtonElement[] = [];
    /** The entry and the scheme of each button: an entry with two forms has a button for each scheme. */
    private slots: {entry: StyleEntry; scheme?: Scheme}[] = [];
    private urls: string[] = [];
    private drawing?: Promise<void>;
    private drawn = '';
    /** The index of the entry of the last choice. */
    private chosen?: StyleEntry;
    /** The values that the application had for the terrain and the names of global state that the entry of the last choice set. */
    private saved: {terrain?: MapDescription['terrain']; state: Record<string, unknown>} = {state: {}};
    private removed = false;
    /** The description has had `'auto'`: a form of the scheme of the system sets `'auto'` again, as in `colorScheme()`. */
    private followed = false;
    /** The hidden map of the picture that is being drawn, and the function that ends the wait for it. */
    private small?: MapInstance;
    private wake = () => {};
    private stops: (() => void)[] = [];
    /** The entries whose picture failed with a warning: each warns once. */
    private warned = new Set<StyleEntry>();
    /** Aborts the request of the style of the picture that is being drawn. */
    private abort?: AbortController;
    /** Warns once for the entry that its picture was not drawn, with the reason and what to do. */
    private fail(entry: StyleEntry, reason: string) {
        if (this.warned.has(entry)) return;
        this.warned.add(entry);
        console.warn(`[map-jr-gl] E1560 styles(): no picture for "${entry.label}": ${reason}.`);
    }
    constructor(private options: StylesOptions, private instance?: () => MapInstance) {}

    onAdd(map: Map) {
        const el = this.el = document.createElement('div'), instance = this.instance?.();
        el.className = 'map-jr-ctrl maplibregl-ctrl map-jr-styles';
        const g = el.appendChild(group());
        const label = ui(map, 'StylesControl.Open', 'Choose a style');
        const t = this.trigger = button(g, 'styles', label, svg('<path d="M9 2 2 5.800 9 9.600l7-3.800zM2 9.200 9 13l7-3.800M2 12.600 9 16.400l7-3.800"/>'), () => this.toggle());
        t.setAttribute('aria-expanded', 'false');
        const list = this.list = el.appendChild(document.createElement('div'));
        list.className = 'map-jr-styles-list';
        list.hidden = true;
        list.setAttribute('role', 'group');
        list.setAttribute('aria-label', label);
        t.setAttribute('aria-controls', list.id = 'map-jr-styles-' + Math.random().toString(36).slice(2));
        const entries = this.options.entries ?? [];
        if (!instance) { console.warn('[map-jr-gl] E1519 styles(): the control works only in the controls of a map of the main API (createMap).'); return el; }
        const p = this.options.preview;
        if (p && (p.center === undefined) !== (p.zoom === undefined)) console.warn(`[map-jr-gl] E11560 styles(): preview has "${p.center === undefined ? 'zoom' : 'center'}" without "${p.center === undefined ? 'center' : 'zoom'}", so the pictures show the view of the map. Give both "center" and "zoom", or neither.`);
        if (!entries.length) console.warn('[map-jr-gl] E11519 styles(): "entries" is empty. Write styles({entries: [{label: "Streets", style: "https://…/style.json"}, …]}).');
        const add = (parent: HTMLElement, entry: StyleEntry, text: string, scheme?: Scheme) => {
            const b = parent.appendChild(document.createElement('button')), i = this.items.length;
            b.type = 'button';
            const pic = b.appendChild(document.createElement('span'));
            pic.className = 'map-jr-styles-pic';
            b.appendChild(document.createElement('span')).textContent = text;
            if (scheme) b.setAttribute('aria-label', `${entry.label}, ${text}`);
            b.addEventListener('click', () => this.choose(instance, entry, scheme));
            b.addEventListener('keydown', e => {
                const to = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? i - 1 : -2;
                if (to > -2) { e.preventDefault(); this.items[(to + this.items.length) % this.items.length]?.focus(); }
            });
            this.items.push(b);
            this.slots.push({entry, scheme});
        };
        for (const entry of entries) {
            if (!twoForms(entry)) { add(list, entry, entry.label); continue; }
            const pair = list.appendChild(document.createElement('div'));
            pair.className = 'map-jr-styles-pair';
            pair.setAttribute('role', 'group');
            pair.setAttribute('aria-label', entry.label);
            pair.appendChild(document.createElement('span')).textContent = entry.label;
            add(pair, entry, ui(map, 'StylesControl.Light', 'Light'), 'light');
            add(pair, entry, ui(map, 'StylesControl.Dark', 'Dark'), 'dark');
        }
        addSheet(el, instance.description.nonce);
        const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !list.hidden) { e.stopPropagation(); this.close(true); } };
        const outside = (e: PointerEvent) => { if (!list.hidden && !el.contains(e.target as Node)) this.close(false); };
        el.addEventListener('keydown', key);
        // Focus that leaves the control (Tab, or a click elsewhere) closes the list.
        el.addEventListener('focusout', e => { if (!list.hidden && !el.contains(e.relatedTarget as Node | null)) this.close(false); });
        document.addEventListener('pointerdown', outside, true);
        this.stops.push(() => document.removeEventListener('pointerdown', outside, true));
        // The pictures come after the first idle of the map, so that they do not delay it.
        const idle = instance.state.subscribe(s => s.idle, on => { if (on) { idle(); setTimeout(() => this.draw(instance)); } });
        this.stops.push(idle, instance.state.subscribe(s => s.colorScheme, () => { if (!list.hidden) this.pressed(instance); }));
        if (instance.state.get().idle) { idle(); setTimeout(() => this.draw(instance)); }
        return el;
    }

    /** Marks the button of the current style and the current scheme. */
    private pressed(instance: MapInstance) {
        const current = this.current(instance.description), scheme = instance.state.get().colorScheme;
        this.items.forEach((b, i) => { const s = this.slots[i]; b.setAttribute('aria-pressed', String(s.entry === current && (!s.scheme || s.scheme === scheme))); });
    }

    private toggle() { if (this.list!.hidden) this.open(); else this.close(true); }

    private open() {
        const list = this.list!, el = this.el!, instance = this.instance?.();
        if (!instance) return;
        this.pressed(instance);
        // The list opens toward the middle of the map, and fits in its height.
        const box = el.getBoundingClientRect(), map = (el.closest('.map-jr-map') ?? el.parentElement!).getBoundingClientRect();
        const left = box.left + box.width / 2 < map.left + map.width / 2, top = box.top + box.height / 2 < map.top + map.height / 2;
        list.style.cssText = `${left ? 'left' : 'right'}:calc(100% + 8px);${top ? 'top' : 'bottom'}:0;max-height:${Math.max(H + 40, top ? map.bottom - box.top - 10 : box.bottom - map.top - 10)}px`;
        list.hidden = false;
        this.trigger!.setAttribute('aria-expanded', 'true');
        (this.items.find(b => b.getAttribute('aria-pressed') === 'true') ?? this.items[0])?.focus();
        this.draw(instance);
    }

    private close(focus: boolean) {
        this.list!.hidden = true;
        this.trigger!.setAttribute('aria-expanded', 'false');
        if (focus) this.trigger!.focus();
    }

    /** The entry that the description shows and that sets the most fields; a tie goes to the last choice. */
    private current(d: MapDescription) {
        let best: StyleEntry | undefined, most = -1;
        for (const e of this.options.entries) { const n = overrides(e) + (e === this.chosen ? .5 : 0); if (shows(e, d) && n > most) { best = e; most = n; } }
        return best;
    }

    /**
     * The terrain and the global state of the application: the description without what the entry of the last choice
     * set, with the values that the application had before. When the description no longer shows that entry, the
     * application has set these fields since, and they are its own.
     */
    private own(d: MapDescription) {
        const e = this.chosen, state: Record<string, unknown> = {...d.globalState};
        let terrain = d.terrain;
        if (e && shows(e, d)) {
            for (const k in e.globalState) if (k in this.saved.state) state[k] = this.saved.state[k]; else delete state[k];
            if (e.terrain !== undefined) terrain = this.saved.terrain;
        }
        return {terrain, state};
    }

    /**
     * Sets the style, the terrain and the global state of the entry in one `patch`, so the camera stays. What the entry
     * before set goes back to the value of the application; the other names of `globalState` stay. `scheme`: the form
     * of an entry with two forms, which sets `colorScheme` too.
     */
    private choose(instance: MapInstance, entry: StyleEntry, scheme?: Scheme) {
        this.close(true);
        // As colorScheme() does: once the description has had 'auto', the scheme of the system gives 'auto'.
        const desc = instance.description, d = desc.colorScheme, system: Scheme = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        if (d === 'auto') this.followed = true;
        const want = scheme && (this.followed && scheme === system ? 'auto' : scheme), to = want !== d ? want : undefined;
        const same = this.current(desc) === entry;
        if (same && !to) return;
        const part: Parameters<MapInstance['patch']>[0] = to ? {colorScheme: to} : {};
        if (!same) {
            const {terrain, state} = this.own(desc), saved: Record<string, unknown> = {};
            for (const k in entry.globalState) if (k in state) saved[k] = state[k];
            this.saved = {terrain, state: saved};
            Object.assign(state, entry.globalState);
            this.chosen = entry;
            Object.assign(part, {style: entry.style, terrain: entry.terrain !== undefined ? entry.terrain : terrain, globalState: Object.keys(state).length ? state : undefined});
        }
        instance.patch(part);
        if (!same) this.options.onStyleChange?.(entry);
        if (to) desc.onColorSchemeChange?.(to);
    }

    /** The view of the pictures: `preview`, or the view of the map. */
    private view(instance: MapInstance): ViewInput {
        const p = this.options.preview, v = instance.state.get().view;
        return p?.center && p.zoom !== undefined ? {center: p.center, zoom: p.zoom} : {center: v.center, zoom: v.zoom, bearing: v.bearing, pitch: v.pitch};
    }

    /** Draws the pictures one after the other with one hidden map, unless they show the view already. */
    private draw(instance: MapInstance): Promise<void> {
        const view = this.view(instance), at = JSON.stringify(view);
        if (this.drawing || at === this.drawn || this.removed || !this.slots.length) return this.drawing ?? Promise.resolve();
        this.drawn = at;
        return this.drawing = this.paint(instance, view, !!this.urls.length).finally(() => {
            this.drawing = undefined;
            if (!this.list?.hidden) this.draw(instance); // the view changed while the list was open
        });
    }

    /** `again`: the pictures exist and only the view changed; the drawing then stops when the list closes. */
    private async paint(instance: MapInstance, view: ViewInput, again: boolean) {
        const box = document.body.appendChild(document.createElement('div'));
        box.style.cssText = `position:fixed;left:-${W * 4}px;top:0;width:${W}px;height:${H}px;pointer-events:none`;
        box.setAttribute('aria-hidden', 'true');
        const slots = this.slots, own = this.own(instance.description);
        let failed = false;
        // An error before the style has loaded (a failed request, an answer that is not a style) ends the picture at
        // once; an error of a tile after that does not.
        // (The control takes the errors of the hidden map, so it warns itself.)
        let slot = slots[0];
        const onError = (e: Error) => { if (!(this.small as unknown as {_map?: Map} | undefined)?._map?.isStyleLoaded()) { failed = true; this.fail(slot.entry, `${e?.message?.replace(/^\[map-jr-gl\] /, '').replace(/\.$/, '') ?? 'the style did not load'}`); this.wake(); } };
        const get = (instance as unknown as {_map: Map})._map._fetch('Style');
        const base: MapDescription = {style: slots[0].entry.style, initialView: view, interactive: false, attribution: false, colorScheme: instance.state.get().colorScheme, transformRequest: instance.description.transformRequest, onError};
        try {
            for (let i = 0; i < slots.length && !this.removed; i++) {
                if (again && this.list!.hidden) { this.drawn = ''; break; } // drawn again at the next open
                failed = false;
                slot = slots[i];
                // (The picture shows the terrain and the global state that the entry sets, over the global state of the application.)
                const {style, terrain, globalState} = slots[i].entry, state = {...own.state, ...globalState}, scheme = slots[i].scheme ?? base.colorScheme;
                const p = this.options.preview, transform = p?.style;
                let given: unknown;
                try {
                    given = await pictureStyle(styleFor(style, scheme === 'dark' || scheme === 'auto' && !!globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches),
                        p?.ssr ?? true, transform && (s => transform(s, slots[i].entry)), get, (this.abort = new AbortController()).signal);
                } catch (e) { if (!this.removed) this.fail(slots[i].entry, (e as Error).message); continue; }
                if (this.removed) break;
                const spec: MapDescription = {...base, style: given as MapDescription['style'], colorScheme: scheme};
                if (terrain !== undefined) spec.terrain = terrain;
                if (Object.keys(state).length) spec.globalState = state;
                // (A new map for each picture: after `update`, an `idle` of the old style can come before the error of
                // a new style that does not load, and the picture would show the old style.)
                this.small?.destroy();
                const m = this.small = createMap(box, spec);
                await new Promise<void>(resolve => {
                    const timer = setTimeout(this.wake = () => { clearTimeout(timer); stop(); resolve(); }, WAIT);
                    const stop = m.state.subscribe(s => s.idle, on => { if (on) this.wake(); });
                });
                if (this.removed) break;
                const blob = failed || !m.state.get().idle ? null : await m.toBlob('image/webp', .8).catch(() => null);
                if (this.removed) break;
                if (blob) this.show(i, blob);
            }
        } finally {
            this.small?.destroy();
            this.small = undefined;
            this.wake = () => {};
            box.remove();
        }
    }

    private show(i: number, blob: Blob) {
        // The new picture fades in over the old one (CSS), which goes once the fade is over.
        const frame = this.items[i]?.firstElementChild;
        if (!frame) return;
        const img = document.createElement('img'), old = [...frame.children];
        img.alt = '';
        // (The class of the fade goes after it ran, so that the next opening of the list does not run it again.)
        img.className = 'map-jr-styles-in';
        for (const e of ['animationend', 'animationcancel']) img.addEventListener(e, () => img.removeAttribute('class'));
        img.width = W;
        img.height = H;
        const was = this.urls[i];
        img.src = this.urls[i] = URL.createObjectURL(blob);
        frame.appendChild(img);
        setTimeout(() => { for (const o of old) o.remove(); if (was) URL.revokeObjectURL(was); }, 400);
    }

    onRemove() {
        this.removed = true;
        this.abort?.abort();
        this.wake();
        this.small?.destroy();
        for (const stop of this.stops) stop();
        for (const url of this.urls) if (url) URL.revokeObjectURL(url);
        this.el?.remove();
    }
}
