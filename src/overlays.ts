import {toLngLat, type LngLatLike} from './geo.ts';
import {LngLat} from './lnglat.ts';
import type {Map} from './map.ts';
import {cls} from './controls.ts';
import {Evented} from './evented.ts';

/**
 * DOM overlays with MapLibre's `Marker` and `Popup` API, for the cases where real HTML is wanted (rich content,
 * dragging, links). For many markers, a symbol layer with an image is far cheaper.
 */

export type OverlayAnchor = 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
/** Where the named part of an element is, across and down, in percent: `[50, 100]` for `bottom`. */
const part = (a: string) => [['left', 'right'], ['top', 'bottom']].map(([low, high]) => a.includes(low) ? 0 : a.includes(high) ? 100 : 50);

/** Keeps an element positioned over a map location. */
abstract class Overlay extends Evented {
    protected map?: Map;
    protected lngLat?: [number, number];
    protected abstract el: HTMLElement;
    protected abstract anchor: OverlayAnchor;
    protected offset: [number, number] = [0, 0];
    protected update: () => void = () => {
        if (!this.map || !this.lngLat) return;
        const p = this.map.project(this.lngLat);
        // (A marker can be turned. With the alignment `map`, the angle is from north on the map, so it turns with the map.)
        const turn = this.rotation - (this.rotationAlignment === 'map' ? this.map.getBearing() : 0);
        this.el.style.transform = `translate(${Math.round(p.x + this.offset[0])}px,${Math.round(p.y + this.offset[1])}px) translate(-${part(this.anchor).join('%,-')}%)${turn ? ` rotate(${turn}deg)` : ''}`;
    };
    protected rotation = 0;
    protected rotationAlignment = 'auto';
    setLngLat(lngLat: LngLatLike) { this.lngLat = toLngLat(lngLat); this.update(); return this; }
    /** The map position. Before `setLngLat`, it is `undefined`, although the type says `LngLat`, as in MapLibre GL JS. */
    getLngLat(): LngLat { return (this.lngLat ? new LngLat(this.lngLat[0], this.lngLat[1]) : undefined) as LngLat; }
    getElement() { return this.el; }
    addClassName(name: string) { this.el.classList.add(name); }
    removeClassName(name: string) { this.el.classList.remove(name); }
    toggleClassName(name: string) { return this.el.classList.toggle(name); }
    protected attach(map: Map) {
        this.detach();
        this.map = map;
        Object.assign(this.el.style, {position: 'absolute', left: '0', top: '0', willChange: 'transform'});
        map.getContainer().appendChild(this.el);
        map.on('move', this.update);
        map.on('resize', this.update);
        this.update();
    }
    protected detach() {
        this.map?.off('move', this.update);
        this.map?.off('resize', this.update);
        this.el.remove();
        this.map = undefined;
    }
}

export type PopupOffset = number | [number, number] | Partial<Record<OverlayAnchor, [number, number]>>;
export interface PopupOptions {
    closeButton?: boolean; closeOnClick?: boolean; maxWidth?: string; className?: string;
    /**
     * Which part of the popup sits at the map position. Leave it out and the popup picks for itself, as MapLibre's
     * does: above the point by default, below when there is no room above, shifted sideways near the left and right edges.
     */
    anchor?: OverlayAnchor;
    /** Distance from the map position: one number, an [x, y] pair, or a pair per anchor (so it can clear a marker on any side). */
    offset?: PopupOffset;
    /** Set false to show and hide without the short fade. */
    animate?: boolean;
    /**
     * Accepted for MapLibre GL JS, with no effect. The focus moves into a popup only when Enter or the space bar on its
     * marker opens it (see docs/maplibre-compatibility.md).
     */
    focusAfterOpen?: boolean;
    /** Accepted for MapLibre GL JS, with no effect: the library has no globe or terrain that can hide the map position. */
    locationOccludedOpacity?: number | string;
}

export class Popup extends Overlay {
    protected el = document.createElement('div');
    protected anchor: OverlayAnchor;
    private box = document.createElement('div');
    private tip = document.createElement('div');
    private content = document.createElement('div');
    private closeOnMapClick = () => this.remove();
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
        box.style.cssText = `pointer-events:auto;position:relative;background:var(--map-popup-background,#fff);color:var(--map-popup-color,#222);border-radius:8px;padding:10px 12px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 2px 12px rgba(0,0,0,.22);max-width:${options.maxWidth ?? '240px'};margin:8px`;
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
    private applyAnchor(anchor: OverlayAnchor) {
        this.anchor = anchor;
        const o = this.options.offset ?? 0;
        const [x, y] = part(anchor), side = anchor.split('-')[0];
        // (One number moves the popup away from the position: down and to the right for `top-left`.)
        this.offset = typeof o === 'number' ? [(1 - x / 50) * o, (1 - y / 50) * o] : Array.isArray(o) ? o : o[anchor] ?? [0, 0];
        // (Across the top or the bottom, the pointer is 14 pixels from the left edge, in the middle, or 14 pixels from the right edge.)
        this.tip.style.cssText = side === 'center' ? 'display:none' : `position:absolute;width:12px;height:12px;background:inherit;transform:rotate(45deg);${side}:-5px;` +
            (y === 50 ? 'top:calc(50% - 6px)' : `left:calc(${x}% + ${14 - x * .4}px)`);
        this.box.style.transformOrigin = `${x}% ${y}%`;
    }

    /** Above the point when it fits, otherwise below; hugging the left or right edge when the point is near one. */
    private chooseAnchor(): OverlayAnchor {
        const map = this.map!, p = map.project(this.lngLat!), c = map.getContainer(), w = this.box.offsetWidth + 16, h = this.box.offsetHeight + 16;
        const o = this.options.offset, lift = typeof o === 'number' ? o : o && !Array.isArray(o) ? -(o.bottom?.[1] ?? 0) : 0;
        const vertical = p.y - lift - h < 0 && p.y + h < c.clientHeight + 40 ? 'top' : 'bottom';
        const horizontal = p.x - w / 2 < 0 ? '-left' : p.x + w / 2 > c.clientWidth ? '-right' : '';
        return (vertical + horizontal) as OverlayAnchor;
    }
    getAnchor() { return this.anchor; }
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
            // (The focus returns to the marker, or to the map when the marker is no longer on the page.)
            if (this.el.contains(document.activeElement)) (this.opener?.isConnected ? this.opener : map.getCanvas()).focus({preventScroll: true});
            this.detach();
        };
        this.closing = finish;
        // The element stays on the map (and follows it) until the fade has played. The event `close` comes at once, as in
        // MapLibre GL JS: a page that is busy can play the fade late, and the application must not wait for it.
        if (animation) animation.finished.then(finish, finish); else finish();
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

export interface MarkerOptions { element?: HTMLElement; color?: string; anchor?: OverlayAnchor; offset?: [number, number]; draggable?: boolean; scale?: number; className?: string; rotation?: number; rotationAlignment?: string; pitchAlignment?: string;
    /** Accepted for MapLibre GL JS, with no effect: the library has no globe or terrain that can hide a marker. */
    opacityWhenCovered?: string;
}

export class Marker extends Overlay {
    protected el: HTMLElement;
    protected anchor: OverlayAnchor;
    private popup?: Popup | null;
    private draggable = false;
    private pitchAlignment: string;
    constructor(options: MarkerOptions = {}) {
        super();
        this.rotation = options.rotation ?? 0;
        this.rotationAlignment = options.rotationAlignment ?? 'auto';
        this.pitchAlignment = options.pitchAlignment ?? 'auto';
        this.anchor = options.anchor ?? (options.element ? 'center' : 'bottom');
        this.offset = options.offset ?? [0, 0];
        if (options.element) this.el = options.element;
        else {
            const s = +(options.scale ?? 1) || 1;
            this.el = document.createElement('div');
            this.el.innerHTML = `<svg width="${27 * s}" height="${41 * s}" viewBox="0 0 27 41" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))">` +
                `<path d="M13.5 0C6 0 0 6 0 13.5 0 23 13.5 41 13.5 41S27 23 27 13.5C27 6 21 0 13.5 0z"/><circle cx="13.5" cy="13.5" r="5.5" fill="#fff"/></svg>`;
            // (The colour can come from data: it is set as an attribute, never as HTML.)
            this.el.querySelector('path')!.setAttribute('fill', options.color ?? '#3fb1ce');
            // (As in MapLibre GL JS. An element of your own keeps the attributes that you gave it.)
            this.el.setAttribute('aria-label', 'Map marker');
        }
        this.el.classList.add('map-jr-marker', 'maplibregl-marker', ...(options.className?.split(' ').filter(Boolean) ?? []));
        this.el.style.zIndex = '1';
        this.el.addEventListener('click', e => { if (this.popup) { e.stopPropagation(); this.togglePopup(); } });
        // With the keyboard: Enter or the space bar opens and closes the popup of the marker. The focus moves to the first
        // element of the open popup that takes it (the close button, when the content has none).
        this.el.addEventListener('keydown', e => {
            // (A key that bubbles from a child of the element, such as a button in it, belongs to that child.)
            if (!this.popup || e.target !== this.el || (e.key !== 'Enter' && e.key !== ' ')) return;
            const opens = !this.popup.isOpen();
            e.preventDefault(); e.stopPropagation(); this.togglePopup();
            // (A candidate can refuse the focus: a disabled button, a hidden link. The close button is the last candidate.)
            if (opens) for (const c of this.popup.getElement().querySelectorAll<HTMLElement>('[href],button,input,select,textarea,[tabindex]')) {
                c.focus({preventScroll: true});
                if (document.activeElement === c) break;
            }
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
    setOffset(offset: [number, number] | {x: number; y: number}) { this.offset = Array.isArray(offset) ? offset : [offset.x, offset.y]; this.update(); return this; }
    getRotation() { return this.rotation; }
    setRotation(degrees = 0) { this.rotation = degrees; this.update(); return this; }
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
        this.el.setPointerCapture(e.pointerId);
        // As in MapLibre GL JS, the drag starts once the pointer has moved 3 px (its default `clickTolerance`): a click
        // fires no drag events, and the click that follows a drag does not reach the marker.
        let dragging = false;
        const move = (ev: PointerEvent) => {
            const p = at(ev);
            if (!dragging && Math.hypot(p.x - p0.x, p.y - p0.y) < 3) return;
            if (!dragging) { dragging = true; this.fire('dragstart'); }
            this.setLngLat(map.unproject({x: p.x - dx, y: p.y - dy})); this.fire('drag');
        };
        // (The three listeners end with the drag: `signal` removes them.)
        const stop = new AbortController(), signal = {signal: stop.signal}, end = () => {
            stop.abort();
            if (!dragging) return;
            const eat = (ev: Event) => ev.stopImmediatePropagation();
            this.el.addEventListener('click', eat, {capture: true, once: true});
            setTimeout(() => this.el.removeEventListener('click', eat, {capture: true}));
            this.fire('dragend');
        };
        this.el.addEventListener('pointermove', move, signal);
        this.el.addEventListener('pointerup', end, signal);
        this.el.addEventListener('pointercancel', end, signal);
    }
}
