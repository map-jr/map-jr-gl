import {toLngLat, type LngLatLike} from './geo.ts';
import {LngLat} from './lnglat.ts';
import type {Map} from './map.ts';
import {cls} from './controls.ts';

/**
 * DOM overlays with MapLibre's `Marker` and `Popup` API, for the cases where real HTML is wanted (rich content,
 * dragging, links). For many markers, a canvas marker layer (`map.addMarkerLayer`) is far cheaper.
 */
type Listener = (e: any) => void;
class Evented {
    private listeners: Record<string, Listener[]> = {};
    on(type: string, fn: Listener) { (this.listeners[type] ??= []).push(fn); return this; }
    off(type: string, fn: Listener) { this.listeners[type] = (this.listeners[type] ?? []).filter(f => f !== fn); return this; }
    once(type: string, fn: Listener) { const w: Listener = e => { this.off(type, w); fn(e); }; return this.on(type, w); }
    fire(type: string, data: Record<string, unknown> = {}) { for (const fn of [...this.listeners[type] ?? []]) fn({type, target: this, ...data}); return this; }
}

export type OverlayAnchor = 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
const ANCHOR_SHIFT: Record<OverlayAnchor, string> = {
    center: 'translate(-50%,-50%)', top: 'translate(-50%,0)', bottom: 'translate(-50%,-100%)', left: 'translate(0,-50%)', right: 'translate(-100%,-50%)',
    'top-left': 'translate(0,0)', 'top-right': 'translate(-100%,0)', 'bottom-left': 'translate(0,-100%)', 'bottom-right': 'translate(-100%,-100%)',
};

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
        this.el.style.transform = `translate(${Math.round(p.x + this.offset[0])}px,${Math.round(p.y + this.offset[1])}px) ${ANCHOR_SHIFT[this.anchor]}${turn ? ` rotate(${turn}deg)` : ''}`;
    };
    protected rotation = 0;
    protected rotationAlignment = 'auto';
    setLngLat(lngLat: LngLatLike) { this.lngLat = toLngLat(lngLat); this.update(); return this; }
    getLngLat() { return this.lngLat ? new LngLat(this.lngLat[0], this.lngLat[1]) : undefined; }
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
}

export class Popup extends Overlay {
    protected el = document.createElement('div');
    protected anchor: OverlayAnchor;
    private box = document.createElement('div');
    private tip = document.createElement('div');
    private content = document.createElement('div');
    private closeOnMapClick = () => this.remove();
    constructor(readonly options: PopupOptions = {}) {
        super();
        this.anchor = options.anchor ?? 'bottom';
        this.el.className = `${cls('popup')} ${options.className ?? ''}`.trim();
        this.el.style.cssText = 'z-index:3;pointer-events:none';
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
        this.offset = typeof o === 'number' ? [anchor.includes('left') ? o : anchor.includes('right') ? -o : 0, anchor.includes('top') ? o : anchor.includes('bottom') ? -o : 0]
            : Array.isArray(o) ? o : o[anchor] ?? [0, 0];
        const side = anchor.includes('bottom') ? 'bottom' : anchor.includes('top') ? 'top' : anchor === 'left' ? 'left' : anchor === 'right' ? 'right' : '';
        const across = side === 'top' || side === 'bottom';
        this.tip.style.cssText = !side ? 'display:none' : `position:absolute;width:12px;height:12px;background:inherit;transform:rotate(45deg);${side}:-5px;` +
            (across ? `left:${anchor.includes('left') ? '14px' : anchor.includes('right') ? 'calc(100% - 26px)' : 'calc(50% - 6px)'}` : 'top:calc(50% - 6px)');
        this.box.style.transformOrigin = `${anchor.includes('left') ? '0%' : anchor.includes('right') ? '100%' : '50%'} ${anchor.includes('top') ? '0%' : anchor.includes('bottom') ? '100%' : '50%'}`;
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
    isOpen() { return !!this.map; }
    /** The popup's box relative to the map position it points at, in pixels: [left, top, right, bottom]. */
    getBox(): [number, number, number, number] | null {
        if (!this.map || !this.lngLat) return null;
        const r = this.box.getBoundingClientRect(), c = this.map.getContainer().getBoundingClientRect(), p = this.map.project(this.lngLat);
        return [r.left - c.left - p.x, r.top - c.top - p.y, r.right - c.left - p.x, r.bottom - c.top - p.y];
    }
    addTo(map: Map) {
        this.attach(map);
        // Deferred so the click that opened the popup does not immediately close it.
        if (this.options.closeOnClick !== false) setTimeout(() => this.map?.on('click', this.closeOnMapClick));
        this.transition(false);
        return this.fire('open');
    }
    remove() {
        if (!this.map) return this;
        this.map.off('click', this.closeOnMapClick);
        const finish = () => { this.detach(); this.fire('close'); };
        const closing = this.transition(true);
        // Stay attached (and tracking the map) until the fade has played.
        if (closing) closing.finished.then(finish, finish); else finish();
        return this;
    }

    /** Fades in while easing a few pixels toward its resting place; the shape itself never changes. */
    private transition(reverse: boolean): Animation | null {
        if (this.options.animate === false || !this.box.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
        const dy = this.anchor.includes('top') ? -6 : this.anchor.includes('bottom') ? 6 : 0, dx = this.anchor === 'left' ? -6 : this.anchor === 'right' ? 6 : 0;
        const away = {transform: `translate(${dx}px, ${dy}px)`, opacity: 0}, rest = {transform: 'none', opacity: 1};
        return this.box.animate(reverse ? [rest, away] : [away, rest], {duration: reverse ? 110 : 180, easing: 'ease-out', fill: reverse ? 'forwards' : 'none'});
    }
}

export interface MarkerOptions { element?: HTMLElement; color?: string; anchor?: OverlayAnchor; offset?: [number, number]; draggable?: boolean; scale?: number; className?: string; rotation?: number; rotationAlignment?: string; pitchAlignment?: string }

export class Marker extends Overlay {
    protected el: HTMLElement;
    protected anchor: OverlayAnchor;
    private popup?: Popup;
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
                `<path d="M13.500 0C6 0 0 6 0 13.500 0 23 13.500 41 13.500 41S27 23 27 13.500C27 6 21 0 13.500 0z"/><circle cx="13.500" cy="13.500" r="5.500" fill="#fff"/></svg>`;
            // (The colour can come from data: it is set as an attribute, never as HTML.)
            this.el.querySelector('path')!.setAttribute('fill', options.color ?? '#3fb1ce');
            // (As in MapLibre GL JS. An element of your own keeps the attributes that you gave it.)
            this.el.setAttribute('aria-label', 'Map marker');
        }
        this.el.classList.add('map-jr-marker', 'maplibregl-marker', ...(options.className?.split(' ').filter(Boolean) ?? []));
        this.el.style.zIndex = '3';
        this.el.addEventListener('click', e => { if (this.popup) { e.stopPropagation(); this.togglePopup(); } });
        // With the keyboard: Enter or the space bar opens and closes the popup of the marker.
        this.el.addEventListener('keydown', e => { if (this.popup && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); this.togglePopup(); } });
        this.el.addEventListener('pointerdown', e => this.startDrag(e));
        this.setDraggable(!!options.draggable);
    }
    addTo(map: Map) { this.attach(map); return this; }
    remove() { this.popup?.remove(); this.detach(); return this; }
    // (A marker with a popup is a button for the keyboard and for assistive technology. An element that has a role or a
    // tab position of its own keeps it.)
    setPopup(popup?: Popup) {
        this.popup?.remove(); this.popup = popup;
        if (popup && !this.el.hasAttribute('tabindex')) this.el.tabIndex = 0;
        if (popup && !this.el.hasAttribute('role')) this.el.setAttribute('role', 'button');
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
        const map = this.map, start = map.project(this.lngLat!), dx = e.clientX - start.x, dy = e.clientY - start.y;
        this.el.setPointerCapture(e.pointerId);
        this.fire('dragstart');
        const move = (ev: PointerEvent) => { this.setLngLat(map.unproject({x: ev.clientX - dx, y: ev.clientY - dy})); this.fire('drag'); };
        const end = () => {
            this.el.removeEventListener('pointermove', move);
            this.el.removeEventListener('pointerup', end);
            this.el.removeEventListener('pointercancel', end);
            this.fire('dragend');
        };
        this.el.addEventListener('pointermove', move);
        this.el.addEventListener('pointerup', end);
        this.el.addEventListener('pointercancel', end);
    }
}
