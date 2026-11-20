/**
 * The custom element `<map-jr>`: `import '@map-jr/map-jr-gl/element'` defines it, and the entry exports its class
 * `MapJrElement` to define it under another name.
 *
 * ```html
 * <script type="module" src="https://unpkg.com/@map-jr/map-jr-gl/dist/element.js"></script>
 * <map-jr map-style="https://styles.map-jr.org/1/elevation-zero.json" center="13.4,52.52" zoom="11" style="height:400px"></map-jr>
 * ```
 * The attributes and the properties of the element form one description. The element is the container of the map,
 * and the map applies changes before the next frame. The events are `CustomEvent`s named `map-` and the name of the
 * event of the Vue component, for example `map-click`.
 */
import {makeMap, type MapDescription, type MapInstance} from './host.ts';
import {logError} from './map.ts';
import {ATTRIBUTES, VIEW_FIELDS, attributeOf, readAttribute, type AttributeKind} from './element-attributes.ts';
declare const __DEV__: boolean;

/**
 * The fields of the description that are properties of the element, by the name of the property: `style` is
 * `mapStyle`. `nonce` is the property of every HTML element, and the callbacks are events (`onClick` is `map-click`).
 */
const PROPERTIES = ['mapStyle', 'sources', 'layers', 'terrain', 'fonts', 'initialView', 'view', 'data', 'images', 'sprite', 'controls', 'projection', 'globalState', 'interactiveLayers', 'hoverState',
    'minZoom', 'maxZoom', 'maxPitch', 'maxBounds', 'cursor', 'cooperativeGestures', 'colorScheme', 'locale', 'padding', 'transformRequest', 'renderer', 'fontFamily', 'interactive', 'antialias', 'attribution', 'hash'] as const;
type Field = Exclude<keyof MapDescription, 'style' | 'nonce' | 'onViewChange' | 'onClick' | 'onError' | 'onColorSchemeChange'> | 'mapStyle';
// (The type check fails here when the description gets a field that the list does not have.)
true satisfies (Field extends typeof PROPERTIES[number] ? true : false);
// (A homomorphic mapped type keeps the TSDoc of each field of the description.)
type Properties = {-readonly [K in keyof Pick<MapDescription, Exclude<Field, 'mapStyle'>>]?: MapDescription[K]} & StyleProperty;
interface StyleProperty {
    /**
     * The `style` of the description: the URL of a style, a style object, or `{light, dark}`. The attribute `map-style` takes a URL.
     * A new value after the map exists changes the style of the map, as `update` does.
     */
    mapStyle?: MapDescription['style'];
}

/** The events with a value of their own. Each other `map-` event is the event of `listen` with that name. */
const OWN = ['ready', 'load', 'idle', 'click', 'hover', 'error', 'viewchange', 'colorschemechange'];

// (On a server there is no `HTMLElement`: the entry can be imported there, and it defines nothing.)
const Base = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement;

export class MapJrElement extends Base {
    static observedAttributes = Object.keys(ATTRIBUTES).map(attributeOf);
    private props: Properties = {};
    private made: MapInstance | null = null;
    private stops: (() => void)[] = [];
    private heard = new Set<string>();
    private moved = new Set<string>();
    private queued = false;
    private firstProp: unknown;
    private first: MapDescription['initialView'];
    private warned = new Set<string>();

    static {
        for (const k of PROPERTIES) Object.defineProperty(this.prototype, k, {
            get(this: MapJrElement) { return this.props[k]; },
            set(this: MapJrElement, v) { this.props[k] = v; this.changed(); },
        });
    }

    constructor() {
        super();
        // A property that the page set before the element was defined is an own property of the element, which hides
        // the property of the class: it is taken over.
        for (const k of PROPERTIES) if (Object.hasOwn(this, k)) { const v = this[k]; delete this[k]; this[k] = v as never; }
    }

    /** The map (`MapInstance`), from the microtask after the element is added to the page until it is removed, or else `null`. */
    get map(): MapInstance | null { return this.made; }
    /** The state of the map as a store (`map.state`), or `null` while there is no map. */
    get state(): MapInstance['state'] | null { return this.made?.state ?? null; }

    connectedCallback() { this.changed(); }
    // (Removed and put back in one task, as a move with `insertBefore` does, the element keeps its map: the map goes
    // only when the element is still out of the page in the microtask after.)
    disconnectedCallback() { this.changed(); }
    // (A move with `moveBefore` keeps the map, and calls neither of the two above.)
    connectedMoveCallback() {}
    attributeChangedCallback(name: string, before: string | null, after: string | null) {
        if (before === after) return;
        if (this.made && VIEW_FIELDS.includes(name)) this.moved.add(name);
        this.changed();
    }

    /**
     * Adds a listener, as on any element. The events of the map are `map-ready`, `map-load`, `map-idle`, `map-click`,
     * `map-hover`, `map-error`, `map-viewchange`, `map-colorschemechange`, and `map-` with the name of any other event of `listen` (`map-styleload` for `style.load`).
     */
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
        super.addEventListener(type, listener, options);
        const name = type.startsWith('map-') && type.slice(4);
        if (!name || this.heard.has(name)) return;
        this.heard.add(name);
        if (this.made) this.listen(name);
    }

    /** One `update` for the changes of this task, one microtask later. */
    private changed() {
        if (this.queued) return;
        this.queued = true;
        queueMicrotask(() => { this.queued = false; this.flush(); });
    }

    private flush() {
        if (!this.isConnected) { this.end(); return; }
        const spec = this.description();
        const map = this.made;
        if (!spec.style) {
            // (A page script can set `mapStyle` a moment later. A map that exists keeps the style that it has.)
            if (__DEV__) map ? this.warn(20826) : setTimeout(() => { if (this.isConnected && !this.made && !this.description().style) this.warn(10826); }, 1000);
            return;
        }
        if (!map) return this.start(spec);
        // (`initialView` is read when the map is made: the view attributes that change move the map instead.)
        if (this.props.initialView === this.firstProp) spec.initialView = this.first;
        map.update(spec);
        if (this.moved.size) {
            const view = this.viewOfAttributes();
            map.moveTo(Object.fromEntries([...this.moved].filter(k => k in view).map(k => [k, view[k as 'zoom']])));
            this.moved.clear();
        }
    }

    private start(spec: MapDescription) {
        const map = this.made = makeMap(this, spec, '<map-jr>');
        this.first = spec.initialView;
        this.firstProp = this.props.initialView;
        this.moved.clear();
        this.stops = [
            map.state.subscribe(s => s.loaded, v => { if (v) this.emit('load', map); }),
            map.state.subscribe(s => s.idle, v => { if (v) this.emit('idle'); }),
            map.state.subscribe(s => s.hover, v => this.emit('hover', v)),
        ];
        for (const name of this.heard) this.listen(name);
        this.emit('ready', map);
    }

    private end() {
        // (The map is destroyed first, so that a listener of `map-remove` gets the event.)
        this.made?.destroy();
        for (const stop of this.stops) stop();
        this.stops = [];
        this.made = null;
    }

    /** Passes the event of the map with that name on, as `map-` and the name (`styleload` for `style.load`). */
    private listen(name: string) {
        if (OWN.includes(name)) return;
        this.stops.push(this.made!.listen((name === 'styleload' ? 'style.load' : name) as 'move', e => this.emit(name, e)));
    }

    /** Dispatches `map-` and the name. Returns `false` when a listener called `preventDefault()` (only `map-error` can be cancelled). */
    private emit(name: string, detail?: unknown) { return this.dispatchEvent(new CustomEvent('map-' + name, {detail, bubbles: true, cancelable: name === 'error'})); }

    /** The fields of the view attributes that can be read. */
    private viewOfAttributes(): Record<string, unknown> {
        const out: Record<string, unknown> = {};
        for (const k of VIEW_FIELDS) { const v = this.attribute(k); if (v !== undefined) out[k] = v; }
        return out;
    }

    /** The value of the attribute of a field, or `undefined` when the element has none or it cannot be read. */
    private attribute(field: string) {
        const name = attributeOf(field), text = this.getAttribute(name);
        if (text === null) return;
        const kind: AttributeKind = ATTRIBUTES[field as keyof typeof ATTRIBUTES], v = readAttribute(kind, text);
        if (__DEV__ && v === undefined) this.warn(826, `${name}="${text}"`, kind);
        return v;
    }

    /** The description from the attributes and the properties. A property wins over its attribute. */
    private description(): MapDescription {
        const out: Record<string, unknown> = {}, view = this.viewOfAttributes();
        for (const k in ATTRIBUTES) if (!VIEW_FIELDS.includes(k)) { const v = this.attribute(k); if (v !== undefined) out[k] = v; }
        for (const k of PROPERTIES) { const v = this.props[k]; if (v !== undefined) out[k === 'mapStyle' ? 'style' : k] = v; }
        if (Object.keys(view).length || out.initialView) out.initialView = {...view, ...out.initialView as object};
        if (this.nonce) out.nonce = this.nonce;
        return {...out, onViewChange: v => { this.emit('viewchange', v); }, onColorSchemeChange: v => { this.emit('colorschemechange', v); }, onClick: e => { this.emit('click', e); },
            // (An error goes to the console unless a listener of `map-error` calls `preventDefault()`, as for the event
            // `error` of `window`. The listeners cannot be counted: `{once: true}` and `removeEventListener` are not seen.)
            onError: e => { if (this.emit('error', e)) logError(e); }} as MapDescription;
    }

    /** (Development build) a warning of src/mistakes.ts, once for each element and text. */
    private warn(code: number, a = '', b = '') {
        // (Under `__DEV__`, so that the production build has no import of the checks.)
        if (!__DEV__ || this.warned.has(code + a)) return;
        this.warned.add(code + a);
        import('./mistakes.ts').then(m => console.warn(m.mistake(code, a, b)), () => {});
    }
}
export interface MapJrElement extends Properties {}

if (globalThis.customElements && !customElements.get('map-jr')) {
    customElements.define('map-jr', MapJrElement);
    // A custom element is inline, so a height in CSS has no effect on it. This rule has no specificity: a rule of the
    // page wins. (A constructed style sheet is not subject to `style-src`.)
    try { const sheet = new CSSStyleSheet(); sheet.replaceSync(':where(map-jr){display:block}'); document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]; } catch { /* the page gives the element display: block */ }
}

declare global { interface HTMLElementTagNameMap { 'map-jr': MapJrElement } }
export type {MapDescription, MapInstance};
