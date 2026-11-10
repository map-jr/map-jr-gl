import {toLngLat, type LngLatLike} from './geo.ts';
import type {Map} from './map.ts';

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
    protected update = () => {
        if (!this.map || !this.lngLat) return;
        const p = this.map.project(this.lngLat);
        this.el.style.transform = `translate(${Math.round(p.x + this.offset[0])}px,${Math.round(p.y + this.offset[1])}px) ${ANCHOR_SHIFT[this.anchor]}`;
    };
    setLngLat(lngLat: LngLatLike) { this.lngLat = toLngLat(lngLat); this.update(); return this; }
    getLngLat() { return this.lngLat ? {lng: this.lngLat[0], lat: this.lngLat[1]} : undefined; }
    getElement() { return this.el; }
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

export interface PopupOptions { closeButton?: boolean; closeOnClick?: boolean; anchor?: OverlayAnchor; offset?: number | [number, number]; maxWidth?: string; className?: string }

export class Popup extends Overlay {
    protected el = document.createElement('div');
    protected anchor: OverlayAnchor;
    private content = document.createElement('div');
    private closeOnMapClick = () => this.remove();
    constructor(private options: PopupOptions = {}) {
        super();
        this.anchor = options.anchor ?? 'bottom';
        const o = options.offset ?? 0;
        // A single number lifts the popup away from its anchor point (e.g. to clear a marker).
        this.offset = typeof o === 'number' ? [0, this.anchor.includes('top') ? o : this.anchor.includes('bottom') ? -o : 0] : o;
        this.el.className = `maplibregl-popup ${options.className ?? ''}`.trim();
        this.el.style.cssText = 'z-index:3;pointer-events:none';
        const box = document.createElement('div');
        box.className = 'maplibregl-popup-content';
        box.style.cssText = `pointer-events:auto;position:relative;background:var(--map-popup-background,#fff);color:var(--map-popup-color,#222);border-radius:6px;padding:10px 12px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.25);max-width:${options.maxWidth ?? '240px'};margin:8px`;
        box.appendChild(this.content);
        if (options.closeButton !== false) {
            const b = Object.assign(document.createElement('button'), {type: 'button', textContent: '\u00d7', className: 'maplibregl-popup-close-button'});
            b.setAttribute('aria-label', 'Close popup');
            b.style.cssText = 'position:absolute;top:0;right:2px;border:0;background:none;font-size:18px;line-height:22px;cursor:pointer;color:inherit;padding:0 4px';
            b.addEventListener('click', () => this.remove());
            box.appendChild(b);
        }
        this.el.appendChild(box);
    }
    setText(text: string) { this.content.textContent = text; return this; }
    /** Sets HTML content. As in MapLibre, the caller is responsible for it being safe. */
    setHTML(html: string) { this.content.innerHTML = html; return this; }
    setDOMContent(node: Node) { this.content.replaceChildren(node); return this; }
    isOpen() { return !!this.map; }
    addTo(map: Map) {
        this.attach(map);
        // Deferred so the click that opened the popup does not immediately close it.
        if (this.options.closeOnClick !== false) setTimeout(() => this.map?.on('click', this.closeOnMapClick));
        return this.fire('open');
    }
    remove() {
        if (!this.map) return this;
        this.map.off('click', this.closeOnMapClick);
        this.detach();
        return this.fire('close');
    }
}

export interface MarkerOptions { element?: HTMLElement; color?: string; anchor?: OverlayAnchor; offset?: [number, number]; draggable?: boolean; scale?: number }

export class Marker extends Overlay {
    protected el: HTMLElement;
    protected anchor: OverlayAnchor;
    private popup?: Popup;
    private draggable = false;
    constructor(options: MarkerOptions = {}) {
        super();
        this.anchor = options.anchor ?? (options.element ? 'center' : 'bottom');
        this.offset = options.offset ?? [0, 0];
        if (options.element) this.el = options.element;
        else {
            const s = options.scale ?? 1;
            this.el = document.createElement('div');
            this.el.innerHTML = `<svg width="${27 * s}" height="${41 * s}" viewBox="0 0 27 41" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))">` +
                `<path d="M13.500 0C6 0 0 6 0 13.500 0 23 13.500 41 13.500 41S27 23 27 13.500C27 6 21 0 13.500 0z" fill="${options.color ?? '#3fb1ce'}"/><circle cx="13.500" cy="13.500" r="5.500" fill="#fff"/></svg>`;
        }
        this.el.classList.add('maplibregl-marker');
        this.el.style.zIndex = '3';
        this.el.addEventListener('click', e => { if (this.popup) { e.stopPropagation(); this.togglePopup(); } });
        this.el.addEventListener('pointerdown', e => this.startDrag(e));
        this.setDraggable(!!options.draggable);
    }
    addTo(map: Map) { this.attach(map); return this; }
    remove() { this.popup?.remove(); this.detach(); return this; }
    setPopup(popup?: Popup) { this.popup?.remove(); this.popup = popup; return this; }
    getPopup() { return this.popup; }
    togglePopup() {
        if (!this.popup || !this.map || !this.lngLat) return this;
        if (this.popup.isOpen()) this.popup.remove(); else this.popup.setLngLat(this.lngLat).addTo(this.map);
        return this;
    }
    setDraggable(on: boolean) { this.draggable = on; this.el.style.cursor = on ? 'grab' : ''; this.el.style.touchAction = on ? 'none' : ''; return this; }
    isDraggable() { return this.draggable; }
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
