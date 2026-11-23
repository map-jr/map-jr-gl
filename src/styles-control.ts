// The control that picks the style (`styles()` of `@map-jr/map-jr-gl/controls`, #1504). It is a file of its own, which
// loads only when a map adds the control. Its pictures are drawn by a small second map of the main API, after the map
// of the control is first idle (the decision of #1158), so that the picker usually opens with them.
import type {Map} from './map.ts';
import type {MapDescription, MapInstance, ViewInput} from './host.ts';
import {createMap} from './host.ts';
import {ui, type Control} from './controls.ts';
import {button, group, svg} from './controls-more.ts';
import type {StylesOptions, StyleEntry} from './control-specs.ts';

const W = 120, H = 80;
const CSS = `.map-jr-styles{position:relative}
.map-jr-styles-list{position:absolute;display:flex;flex-direction:column;gap:6px;padding:6px;margin:0;overflow-y:auto;box-sizing:border-box;background:var(--map-control-background,#fff);color:inherit;border-radius:var(--map-control-radius,8px);box-shadow:0 0 0 1px rgb(0 0 0/.1),0 2px 6px rgb(0 0 0/.12),0 6px 18px rgb(0 0 0/.1);font:12px/1.3 system-ui,sans-serif;z-index:3}
.map-jr-dark .map-jr-styles-list{background:var(--map-control-background,#2b2b2b)}
.map-jr-styles-list[hidden]{display:none}
.map-jr-styles-list button{display:flex;flex-direction:column;gap:4px;align-items:stretch;width:${W + 8}px;padding:4px;border:0;border-radius:calc(var(--map-control-radius,8px)*.75);background:none;color:inherit;font:inherit;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent}
.map-jr-styles-list button[aria-pressed=true]{box-shadow:inset 0 0 0 2px var(--map-control-focus,#2f7fd1)}
.map-jr-styles-list button:focus-visible{outline:2px solid var(--map-control-focus,#2f7fd1);outline-offset:1px}
@media (hover:hover){.map-jr-styles-list button:hover{background:color-mix(in oklab,currentColor 8%,transparent)}}
.map-jr-styles-pic{display:block;width:${W}px;height:${H}px;border-radius:calc(var(--map-control-radius,8px)*.5);background:color-mix(in oklab,currentColor 10%,transparent);object-fit:cover}
@media (forced-colors:active){.map-jr-styles-list{border:1px solid CanvasText}}`;
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
const overrides = (e: StyleEntry) => +(e.terrain !== undefined) + Object.keys(e.globalState ?? {}).length;

/**
 * A button that opens a list of styles with a picture of each. A choice applies the style, the terrain and the global
 * state of the entry with one `patch`, so the camera stays, and calls `onStyleChange` with the entry. The pictures are made once the map is first idle, or at the first
 * click if that comes earlier; without `preview`, they show the view of the map and are made again when the list opens
 * on a view that has changed. A picture that fails leaves its label.
 */
export class StylesControl implements Control {
    private el?: HTMLElement;
    private trigger?: HTMLButtonElement;
    private list?: HTMLElement;
    private items: HTMLButtonElement[] = [];
    private urls: string[] = [];
    private drawing?: Promise<void>;
    private drawn = '';
    /** The index of the entry of the last choice. */
    private chosen = -1;
    private removed = false;
    /** The hidden map of the picture that is being drawn, and the function that ends the wait for it. */
    private small?: MapInstance;
    private wake = () => {};
    private stops: (() => void)[] = [];
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
        if (!instance) { console.warn('[map-jr-gl] styles(): the control works only in the controls of a map of the main API (createMap).'); return el; }
        if (!entries.length) console.warn('[map-jr-gl] styles(): "entries" is empty. Write styles({entries: [{label: "Streets", style: "https://…/style.json"}, …]}).');
        this.items = entries.map((entry, i) => {
            const b = list.appendChild(document.createElement('button'));
            b.type = 'button';
            const pic = b.appendChild(document.createElement('span'));
            pic.className = 'map-jr-styles-pic';
            b.appendChild(document.createElement('span')).textContent = entry.label;
            b.addEventListener('click', () => this.choose(instance, i));
            b.addEventListener('keydown', e => {
                const to = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : -2;
                if (to > -2) { e.preventDefault(); this.items[(to + entries.length) % entries.length]?.focus(); }
            });
            return b;
        });
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
        this.stops.push(idle);
        if (instance.state.get().idle) { idle(); setTimeout(() => this.draw(instance)); }
        return el;
    }

    private toggle() { if (this.list!.hidden) this.open(); else this.close(true); }

    private open() {
        const list = this.list!, el = this.el!, instance = this.instance?.();
        if (!instance) return;
        const current = this.current(instance.description);
        this.items.forEach((b, i) => b.setAttribute('aria-pressed', String(i === current)));
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

    /** The index of the entry that the description shows: the entry of the last choice, or else the one that sets the most fields; -1 for none. */
    private current(d: MapDescription) {
        const entries = this.options.entries;
        if (entries[this.chosen] && shows(entries[this.chosen], d)) return this.chosen;
        let best = -1;
        entries.forEach((e, i) => { if (shows(e, d) && (best < 0 || overrides(e) > overrides(entries[best]))) best = i; });
        return best;
    }

    /**
     * Sets the style, the terrain and the global state of the entry in one `patch`, so the camera stays. The terrain
     * and the names of global state that the entry before set are removed; the other names of `globalState` stay.
     */
    private choose(instance: MapInstance, i: number) {
        this.close(true);
        const d = instance.description, at = this.current(d), entries = this.options.entries, entry = entries[i], before = entries[at];
        if (at === i) return;
        const part: Parameters<MapInstance['patch']>[0] = {style: entry.style};
        if (entry.terrain !== undefined) part.terrain = entry.terrain;
        else if (before?.terrain !== undefined) part.terrain = undefined;
        if (entry.globalState || before?.globalState) {
            const state: Record<string, unknown> = {...d.globalState};
            for (const k in before?.globalState) delete state[k];
            Object.assign(state, entry.globalState);
            part.globalState = Object.keys(state).length ? state : undefined;
        }
        this.chosen = i;
        instance.patch(part);
        this.options.onStyleChange?.(entry);
    }

    /** The view of the pictures: `preview`, or the view of the map. */
    private view(instance: MapInstance): ViewInput {
        const p = this.options.preview, v = instance.state.get().view;
        return p ? {center: p.center, zoom: p.zoom} : {center: v.center, zoom: v.zoom, bearing: v.bearing, pitch: v.pitch};
    }

    /** Draws the pictures one after the other with one hidden map, unless they show the view already. */
    private draw(instance: MapInstance): Promise<void> {
        const view = this.view(instance), at = JSON.stringify(view);
        if (this.drawing || at === this.drawn || this.removed) return this.drawing ?? Promise.resolve();
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
        const entries = this.options.entries;
        let failed = false;
        // An error before the style has loaded (a failed request, an answer that is not a style) ends the picture at
        // once; an error of a tile after that does not.
        const onError = () => { if (!(this.small as unknown as {_map?: Map} | undefined)?._map?.isStyleLoaded()) { failed = true; this.wake(); } };
        const base: MapDescription = {style: entries[0].style, initialView: view, interactive: false, attribution: false, colorScheme: instance.state.get().colorScheme, onError};
        try {
            for (let i = 0; i < entries.length && !this.removed; i++) {
                if (again && this.list!.hidden) { this.drawn = ''; break; } // drawn again at the next open
                failed = false;
                // (The picture shows the terrain and the global state that the entry sets.)
                const {style, terrain, globalState} = entries[i], spec: MapDescription = {...base, style};
                if (terrain !== undefined) spec.terrain = terrain;
                if (globalState) spec.globalState = globalState;
                // (A new map for each picture: after `update`, an `idle` of the old style can come before the error of
                // a new style that does not load, and the picture would show the old style.)
                this.small?.destroy();
                const m = this.small = createMap(box, spec);
                await new Promise<void>(resolve => {
                    const timer = setTimeout(this.wake = () => { clearTimeout(timer); stop(); resolve(); }, 20000);
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
        const old = this.items[i]?.firstElementChild;
        if (!old) return;
        const img = document.createElement('img');
        img.className = 'map-jr-styles-pic';
        img.alt = '';
        img.width = W;
        img.height = H;
        if (this.urls[i]) URL.revokeObjectURL(this.urls[i]);
        img.src = this.urls[i] = URL.createObjectURL(blob);
        old.replaceWith(img);
    }

    onRemove() {
        this.removed = true;
        this.wake();
        this.small?.destroy();
        for (const stop of this.stops) stop();
        for (const url of this.urls) if (url) URL.revokeObjectURL(url);
        this.el?.remove();
    }
}
