import {toLngLat, type LngLatLike} from './geo.ts';
import {LngLat} from './lnglat.ts';
import type {Map, PointLike} from './map.ts';
import {cls, ui} from './controls.ts';
import {Evented} from './evented.ts';
import type {Anchor} from './markers.ts';

/**
 * DOM overlays with MapLibre's `Marker` and `Popup` API, for the cases where real HTML is wanted (rich content,
 * dragging, links). For many markers, a symbol layer with an image is far cheaper.
 */

/** Where the named part of an element is, across and down, in percent: `[50, 100]` for `bottom`. */
/** A `Point`, `{x, y}` or `[x, y]` as a tuple. */
const xy = (p: PointLike): [number, number] => Array.isArray(p) ? [p[0], p[1]] : [p.x, p.y];
const part = (a: string) => [['left', 'right'], ['top', 'bottom']].map(([low, high]) => a.includes(low) ? 0 : a.includes(high) ? 100 : 50);

/** Keeps an element positioned over a map location. */
abstract class Overlay extends Evented {
    protected map?: Map;
    protected lngLat?: [number, number];
    protected abstract el: HTMLElement;
    protected abstract anchor: Anchor;
    protected offset: [number, number] = [0, 0];
    protected update: () => void = () => {
        if (!this.map || !this.lngLat) return;
        const p = this.map.project(this.lngLat);
        // (A marker can be turned. With the alignment `map`, the angle is from north on the map, so it turns with the map.)
        const turn = this.rotation - (this.rotationAlignment === 'map' ? this.map.getBearing() : 0);
        this.el.style.transform = `translate(${this.round(p.x + this.offset[0])}px,${this.round(p.y + this.offset[1])}px) translate(-${part(this.anchor).join('%,-')}%)${turn ? ` rotate(${turn}deg)` : ''}`;
    };
    protected rotation = 0;
    protected round = Math.round;
    protected rotationAlignment = 'auto';
    setLngLat(lngLat: LngLatLike) { this.lngLat = toLngLat(lngLat); this.update(); return this; }
    /** The map position. Before `setLngLat`, it is `undefined`, although the type says `LngLat`, as in MapLibre GL JS. */
    getLngLat(): LngLat { return (this.lngLat ? new LngLat(this.lngLat[0], this.lngLat[1]) : undefined) as LngLat; }
    getElement() { return this.el; }
    addClassName(name: string) { this.el.classList.add(name); }
    removeClassName(name: string) { this.el.classList.remove(name); }
    toggleClassName(name: string) { return this.el.classList.toggle(name); }
    /** Applies the map's `locale` to the labels that the overlay made itself (the elements exist before the map does). */
    protected localize(_map: Map) {}
    protected attach(map: Map) {
        this.detach();
        this.map = map;
        Object.assign(this.el.style, {position: 'absolute', left: '0', top: '0', willChange: 'transform'});
        map.getContainer().appendChild(this.el);
        this.localize(map);
        map.on('move', this.update);
        map.on('resize', this.update);
        map.overlays.add(this.update);
        this.update();
    }
    protected detach() {
        this.map?.off('move', this.update);
        this.map?.off('resize', this.update);
        this.map?.overlays.delete(this.update);
        this.el.remove();
        this.map = undefined;
    }
}

export type PopupOffset = number | [number, number] | Partial<Record<Anchor, [number, number]>>;
export interface PopupOptions {
    closeButton?: boolean; closeOnClick?: boolean; maxWidth?: string; className?: string;
    /**
     * Which part of the popup sits at the map position. Leave it out and the popup picks for itself, as MapLibre's
     * does: above the point by default, below when there is no room above, shifted sideways near the left and right edges.
     */
    anchor?: Anchor;
    /** Distance from the map position: one number, an [x, y] pair, or a pair per anchor (so it can clear a marker on any side). */
    offset?: PopupOffset;
    /** Set false to show and hide without the short fade. */
    animate?: boolean;
    /**
     * maplibre-compat only: moves the keyboard focus to the first element in the popup that can take it (a link, a field,
     * a button, else the close button) when the popup opens and when its content changes while it is open (default `true`).
     */
    focusAfterOpen?: boolean;
    /** maplibre-compat only: closes the popup when the map moves (default `false`). */
    closeOnMove?: boolean;
    /** maplibre-compat only: puts the popup at the mouse pointer instead of a map position (default `false`). See `trackPointer()`. */
    trackPointer?: boolean;
    /** maplibre-compat only: places the popup on fractions of a pixel instead of whole pixels (default `false`). */
    subpixelPositioning?: boolean;
    /** Accepted for MapLibre GL JS, with no effect: the library has no globe or terrain that can hide the map position. */
    locationOccludedOpacity?: number | string;
}

export class Popup extends Overlay {
    protected el = document.createElement('div');
    protected anchor: Anchor;
    protected box = document.createElement('div');
    /** The pointer-events of the box while it is open: `none` while a popup of maplibre-compat follows the pointer. */
    protected clicks = 'auto';
    private tip = document.createElement('div');
    private content = document.createElement('div');
    private closeOnMapClick = () => this.remove();
    private closeButton?: HTMLButtonElement;
    protected localize(map: Map) { this.closeButton?.setAttribute('aria-label', ui(map, 'Popup.Close', 'Close popup')); }
    /** The marker of this popup. The keyboard focus returns to it when the popup closes with the focus inside. */
    opener?: HTMLElement;
    constructor(readonly options: PopupOptions = {}) {
        super();
        this.anchor = options.anchor ?? 'bottom';
        this.el.className = `${cls('popup')} ${options.className ?? ''}`.trim();
        // (Markers and popups are above the map and below the controls, which have z-index 2, as in MapLibre GL JS.)
        this.el.style.cssText = 'z-index:1;pointer-events:none';
        const box = this.box;
        box.className = cls('popup-content');
        box.style.cssText = `pointer-events:auto;position:relative;background:var(--map-popup-background,var(--map-jr-popup-bg,#fff));color:var(--map-popup-color,var(--map-jr-popup-fg,#222));border-radius:var(--map-jr-popup-radius,8px);padding:10px 12px;font:13px/1.4 system-ui,sans-serif;box-shadow:var(--map-jr-popup-ring,0 0 #0000),0 2px 12px rgba(0,0,0,.22);max-width:${options.maxWidth ?? '240px'};margin:8px`;
        box.appendChild(this.content);
        this.tip.className = cls('popup-tip');
        box.appendChild(this.tip);
        if (options.closeButton !== false) {
            const b = Object.assign(document.createElement('button'), {type: 'button', textContent: '\u00d7', className: cls('popup-close-button')});
            b.setAttribute('aria-label', 'Close popup');
            b.style.cssText = 'position:absolute;top:3px;right:3px;width:22px;height:22px;border:0;border-radius:4px;background:none;font:18px/22px system-ui,sans-serif;text-align:center;cursor:pointer;color:inherit;opacity:.7;padding:0;margin:0';
            // The text keeps clear of the button.
            box.style.paddingRight = '30px';
            b.addEventListener('click', () => this.remove());
            box.appendChild(b);
            this.closeButton = b;
        }
        this.el.appendChild(box);
        this.applyAnchor(this.anchor);
        // Positioning re-checks which side has room every time the map moves.
        const position = this.update;
        this.update = () => {
            if (this.map && this.lngLat && !this.options.anchor) this.applyAnchor(this.chooseAnchor());
            position();
        };
    }

    /** The pointer goes on the side facing the map position, and the offset for that side takes effect. */
    private applyAnchor(anchor: Anchor) {
        this.anchor = anchor;
        const o = this.options.offset ?? 0;
        const [x, y] = part(anchor), side = anchor.split('-')[0];
        // (One number moves the popup away from the position: down and to the right for `top-left`.)
        this.offset = typeof o === 'number' ? [(1 - x / 50) * o, (1 - y / 50) * o] : Array.isArray(o) ? o : o[anchor] ?? [0, 0];
        // (Across the top or the bottom, the pointer is 14 pixels from the left edge, in the middle, or 14 pixels from the right edge.)
        this.tip.dataset.side = side; // (for the CSS of the main API, which shows only the part of the tip outside the box)
        this.tip.style.cssText = side === 'center' ? 'display:none' : `position:absolute;width:12px;height:12px;background:inherit;transform:rotate(45deg);${side}:-5px;` +
            (y === 50 ? 'top:calc(50% - 6px)' : `left:calc(${x}% + ${14 - x * .4}px)`);
        this.box.style.transformOrigin = `${x}% ${y}%`;
    }

    /** Above the point when it fits, otherwise below; hugging the left or right edge when the point is near one. */
    private chooseAnchor(): Anchor {
        const map = this.map!, p = map.project(this.lngLat!), c = map.getContainer(), w = this.box.offsetWidth + 16, h = this.box.offsetHeight + 16;
        const o = this.options.offset, lift = typeof o === 'number' ? o : o && !Array.isArray(o) ? -(o.bottom?.[1] ?? 0) : 0;
        const vertical = p.y - lift - h < 0 && p.y + h < c.clientHeight + 40 ? 'top' : 'bottom';
        const horizontal = p.x - w / 2 < 0 ? '-left' : p.x + w / 2 > c.clientWidth ? '-right' : '';
        return (vertical + horizontal) as Anchor;
    }
    getAnchor() { return this.anchor; }
    /** Moves the focus to the first element that takes it. A candidate can refuse it (a disabled button, a hidden link). */
    focusFirst() {
        for (const c of this.el.querySelectorAll<HTMLElement>('[href],button,input,select,textarea,[tabindex]')) {
            c.focus({preventScroll: true});
            if (document.activeElement === c) break;
        }
    }
    setOffset(offset?: PopupOffset) { this.options.offset = offset; this.applyAnchor(this.anchor); this.update(); return this; }
    setMaxWidth(maxWidth: string) { this.options.maxWidth = this.box.style.maxWidth = maxWidth; return this; }
    getMaxWidth() { return this.options.maxWidth; }

    setText(text: string) { this.content.textContent = text; return this; }
    /** Sets HTML content. As in MapLibre, the caller is responsible for it being safe. */
    setHTML(html: string) { this.content.innerHTML = html; return this; }
    setDOMContent(node: Node) { this.content.replaceChildren(node); return this; }
    isOpen() { return !!this.map && !this.closing; }
    /** The popup's box relative to the map position it points at, in pixels: [left, top, right, bottom]. */
    getBox(): [number, number, number, number] | null {
        if (!this.map || !this.lngLat) return null;
        const el = this.map.getContainer(), r = this.box.getBoundingClientRect(), c = el.getBoundingClientRect(), p = this.map.project(this.lngLat);
        const sx = c.width / el.offsetWidth || 1, sy = c.height / el.offsetHeight || 1;
        return [(r.left - c.left) / sx - p.x, (r.top - c.top) / sy - p.y, (r.right - c.left) / sx - p.x, (r.bottom - c.top) / sy - p.y];
    }
    addTo(map: Map) {
        // (A popup that opens again during its closing animation closes now, so that the animation cannot remove it later.)
        this.closing?.();
        this.attach(map);
        // Deferred so the click that opened the popup does not immediately close it.
        if (this.options.closeOnClick !== false) setTimeout(() => this.isOpen() && this.map === map && map.on('click', this.closeOnMapClick));
        this.transition(false);
        return this.fire('open');
    }
    /** Ends the closing animation that runs, if one runs: the popup is removed (it fired `close` when the animation started). */
    private closing?: () => void;
    remove() {
        if (!this.isOpen()) return this;
        const map = this.map!;
        map.off('click', this.closeOnMapClick);
        const animation = this.transition(true);
        const finish = () => {
            if (this.closing !== finish) return;
            this.closing = undefined;
            // (The closing animation keeps its last frame. Without this, the popup is transparent when it opens again.)
            animation?.cancel();
            this.box.style.pointerEvents = this.clicks;
            // (The focus returns to the marker, or to the map when the marker is no longer on the page.)
            if (this.el.contains(document.activeElement)) (this.opener?.isConnected ? this.opener : map.getCanvas()).focus({preventScroll: true});
            this.detach();
        };
        this.closing = finish;
        // (A popup that fades out does not catch clicks: they go to the map below it.)
        this.box.style.pointerEvents = 'none';
        // The element stays on the map (and follows it) until the fade has played. The event `close` comes at once, as in
        // MapLibre GL JS: a page that is busy can play the fade late, and the application must not wait for it.
        // A fade that never ends (a page that draws no frames, an animation that is paused) must not keep the element:
        // a timer removes it after the duration and a margin, and a hidden page removes it at once.
        if (animation && !document.hidden) { animation.finished.then(finish, finish); setTimeout(finish, 400); } else finish();
        return this.fire('close');
    }

    /** Fades in while easing a few pixels toward its resting place; the shape itself never changes. */
    private transition(reverse: boolean): Animation | null {
        if (this.options.animate === false || !this.box.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
        const [x, y] = part(this.anchor), dy = y * .12 - 6, dx = dy ? 0 : x * .12 - 6;
        // (One keyframe: the box comes from it when the popup opens, and goes to it when the popup closes.)
        return this.box.animate({transform: `translate(${dx}px, ${dy}px)`, opacity: 0, offset: +reverse}, {duration: reverse ? 110 : 180, easing: 'ease-out', fill: reverse ? 'forwards' : 'none'});
    }
}

export interface MarkerOptions { element?: HTMLElement; color?: string; anchor?: Anchor; offset?: PointLike; draggable?: boolean; scale?: number; className?: string; rotation?: number; rotationAlignment?: string; pitchAlignment?: string;
    /** The opacity of the marker (default `'1'`), and its opacity while the far side of the globe hides its position (default `'0.2'`), as in MapLibre GL JS. */
    opacity?: string | number;
    opacityWhenCovered?: string | number;
}

/**
 * The default pin of `Marker`: a `div` with an SVG drop, 27 by 41 pixels at `scale` 1, filled with `color` (default
 * `'#3fb1ce'`). Each call makes a new element. Its anchor is `'bottom'`.
 */
export function defaultPin(options: {color?: string; scale?: number} = {}): HTMLElement {
    const s = +(options.scale ?? 1) || 1, el = document.createElement('div');
    el.innerHTML = `<svg width="${27 * s}" height="${41 * s}" viewBox="0 0 27 41">` +
        `<path d="M13.5 0C6 0 0 6 0 13.5 0 23 13.5 41 13.5 41S27 23 27 13.5C27 6 21 0 13.5 0z"/><circle cx="13.5" cy="13.5" r="5.5" fill="#fff"/></svg>`;
    // (The colour can come from data: it is set as an attribute, never as HTML.)
    el.querySelector('path')!.setAttribute('fill', options.color ?? '#3fb1ce');
    // (A style property, not a `style` attribute in the HTML, which a strict `style-src` blocks.)
    el.querySelector('svg')!.style.cssText = 'display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))';
    return el;
}

export class Marker extends Overlay {
    protected el: HTMLElement;
    protected anchor: Anchor;
    private popup?: Popup | null;
    private draggable = false;
    private pitchAlignment: string;
    private ownPin = false;
    protected localize(map: Map) { if (this.ownPin) this.el.setAttribute('aria-label', ui(map, 'Marker.Title', 'Map marker')); }
    constructor(options: MarkerOptions = {}) {
        super();
        this.rotation = options.rotation ?? 0;
        this.rotationAlignment = options.rotationAlignment ?? 'auto';
        this.pitchAlignment = options.pitchAlignment ?? 'auto';
        this.anchor = options.anchor ?? (options.element ? 'center' : 'bottom');
        this.offset = xy(options.offset ?? [0, 0]);
        if (options.element) this.el = options.element;
        else {
            this.el = defaultPin(options);
            // (As in MapLibre GL JS. An element of your own keeps the attributes that you gave it.)
            this.el.setAttribute('aria-label', 'Map marker');
            this.ownPin = true;
        }
        this.el.classList.add('map-jr-marker', 'maplibregl-marker', ...(options.className?.split(' ').filter(Boolean) ?? []));
        this.el.style.zIndex = '1';
        this.setOpacity(options.opacity, options.opacityWhenCovered);
        // On the globe, a marker whose position is on the far side takes `opacityWhenCovered` and the class
        // `map-jr-marker-covered` (`maplibregl-marker-covered`), as in MapLibre GL JS. A Mercator map leaves the
        // opacity alone. (3D terrain does not cover a marker in this library.)
        const place = this.update;
        this.update = () => {
            place();
            const map = this.map;
            if (!map || !this.lngLat) return;
            const covered = map.isLocationOccluded(this.lngLat);
            if (!covered && !this.isCovered) { if (this.opacityGiven) this.el.style.opacity = this.opacityShown; return; }
            this.isCovered = covered;
            this.el.style.opacity = covered ? this.opacityCovered : this.opacityShown;
            this.el.classList.toggle('map-jr-marker-covered', covered);
            this.el.classList.toggle('maplibregl-marker-covered', covered);
        };
        // As in MapLibre GL JS, a click on a marker is also a `click` of the map, so that a popup with `closeOnClick` closes
        // (#198). The map listens on its canvas only, so the marker fires the event. The click that ends a drag does not
        // get here (see `startDrag`).
        this.el.addEventListener('click', e => {
            const map = this.map;
            if (!map) return;
            const c = map.getContainer(), r = c.getBoundingClientRect(), sx = r.width / c.offsetWidth || 1, sy = r.height / c.offsetHeight || 1;
            const point = {x: (e.clientX - r.left) / sx - c.clientLeft, y: (e.clientY - r.top) / sy - c.clientTop};
            let prevented = false;
            // The popup opens or closes after the listeners of the map have run, which the compat entry can do later. A popup
            // that was open at the click is closed at the end, also when its own `closeOnClick` closed it first.
            const open = this.popup?.isOpen(), toggle = () => { if (this.popup && this.map === map && this.popup.isOpen() === open) this.togglePopup(); };
            const sent = map.fire('click', {point, lngLat: map.unproject(point), originalEvent: e, preventDefault() { prevented = true; }, get defaultPrevented() { return prevented; }});
            if (sent) sent.then(toggle, toggle); else toggle();
        });
        // With the keyboard: Enter or the space bar opens and closes the popup of the marker. The focus moves to the first
        // element of the open popup that takes it (the close button, when the content has none).
        this.el.addEventListener('keydown', e => {
            // (A key that bubbles from a child of the element, such as a button in it, belongs to that child.)
            if (!this.popup || e.target !== this.el || (e.key !== 'Enter' && e.key !== ' ')) return;
            const opens = !this.popup.isOpen();
            e.preventDefault(); e.stopPropagation(); this.togglePopup();
            // (The close button is the last candidate.)
            if (opens) this.popup.focusFirst();
        });
        this.el.addEventListener('pointerdown', e => this.startDrag(e));
        this.setDraggable(!!options.draggable);
    }
    addTo(map: Map) { this.attach(map); return this; }
    remove() { this.popup?.remove(); this.detach(); return this; }
    // (A marker with a popup is a button for the keyboard and for assistive technology. An element that has a role or a
    // tab position of its own keeps it.)
    setPopup(popup?: Popup | null) {
        this.popup?.remove(); this.popup = popup;
        if (popup) {
            popup.opener = this.el;
            if (!this.el.hasAttribute('tabindex')) this.el.tabIndex = 0;
            if (!this.el.hasAttribute('role')) this.el.setAttribute('role', 'button');
        }
        return this;
    }
    getPopup() { return this.popup; }
    togglePopup() {
        if (!this.popup || !this.map || !this.lngLat) return this;
        if (this.popup.isOpen()) this.popup.remove(); else this.popup.setLngLat(this.lngLat).addTo(this.map);
        return this;
    }
    setDraggable(on: boolean) { this.draggable = on; this.el.style.cursor = on ? 'grab' : ''; this.el.style.touchAction = on ? 'none' : ''; return this; }
    isDraggable() { return this.draggable; }
    getOffset() { return {x: this.offset[0], y: this.offset[1]}; }
    setOffset(offset: PointLike) { this.offset = xy(offset); this.update(); return this; }
    getRotation() { return this.rotation; }
    setRotation(degrees = 0) { this.rotation = degrees; this.update(); return this; }
    private opacityShown = '1';
    private opacityCovered = '0.2';
    private opacityGiven = false;
    private isCovered = false;
    /** Sets the opacity of the marker and its opacity on the far side of the globe; with no arguments, the defaults `'1'` and `'0.2'`, as in MapLibre GL JS. */
    setOpacity(opacity?: string | number, opacityWhenCovered?: string | number) {
        if (opacity === undefined && opacityWhenCovered === undefined) { this.opacityShown = '1'; this.opacityCovered = '0.2'; }
        if (opacity !== undefined) { this.opacityShown = String(opacity); this.opacityGiven = true; }
        if (opacityWhenCovered !== undefined) this.opacityCovered = String(opacityWhenCovered);
        this.update();
        return this;
    }
    getRotationAlignment() { return this.rotationAlignment; }
    setRotationAlignment(alignment = 'auto') { this.rotationAlignment = alignment; this.update(); return this; }
    /** (The value is kept. A marker is always upright on the screen.) */
    getPitchAlignment() { return this.pitchAlignment; }
    setPitchAlignment(alignment = 'auto') { this.pitchAlignment = alignment; return this; }
    setLngLat(lngLat: LngLatLike) { super.setLngLat(lngLat); if (this.popup?.isOpen()) this.popup.setLngLat(lngLat); return this; }

    private startDrag(e: PointerEvent) {
        if (!this.draggable || !this.map) return;
        e.stopPropagation();
        e.preventDefault();
        // Pointer positions in CSS pixels of the map, also when the container is scaled by a CSS transform (#234).
        const map = this.map, el = map.getContainer(), r = el.getBoundingClientRect(), sx = r.width / el.offsetWidth || 1, sy = r.height / el.offsetHeight || 1;
        const at = (ev: PointerEvent) => ({x: (ev.clientX - r.left) / sx, y: (ev.clientY - r.top) / sy});
        const start = map.project(this.lngLat!), p0 = at(e), dx = p0.x - start.x, dy = p0.y - start.y;
        // As in MapLibre GL JS, the drag starts once the pointer has moved 3 px (its default `clickTolerance`): a click
        // fires no drag events, and the click that follows a drag does not reach the marker.
        let dragging = false;
        const move = (ev: PointerEvent) => {
            const p = at(ev);
            if (!dragging && Math.hypot(p.x - p0.x, p.y - p0.y) < 3) return;
            // (The pointer is captured only when the drag starts: a capture at `pointerdown` would make the marker element
            // the target of the click, and a click listener on an element inside it would not run.)
            if (!dragging) { dragging = true; this.el.setPointerCapture(ev.pointerId); this.fire('dragstart'); }
            this.setLngLat(map.unproject({x: p.x - dx, y: p.y - dy})); this.fire('drag');
        };
        // (The three listeners end with the drag: `signal` removes them. They are on the window, so that a move off the
        // element before the capture still counts.)
        const stop = new AbortController(), signal = {signal: stop.signal, capture: true}, end = () => {
            stop.abort();
            if (!dragging) return;
            const eat = (ev: Event) => ev.stopImmediatePropagation();
            this.el.addEventListener('click', eat, {capture: true, once: true});
            setTimeout(() => this.el.removeEventListener('click', eat, {capture: true}));
            this.fire('dragend');
        };
        const own = (f: (ev: PointerEvent) => void) => (ev: PointerEvent) => { if (ev.pointerId === e.pointerId) f(ev); };
        addEventListener('pointermove', own(move), signal);
        addEventListener('pointerup', own(end), signal);
        addEventListener('pointercancel', own(end), signal);
    }
}
