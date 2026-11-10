import type {Map} from './map.ts';

/**
 * Controls use MapLibre's `IControl` contract (`onAdd` returns an element, `onRemove` cleans up) and its class names,
 * so controls written for MapLibre can be passed to `map.addControl` unchanged. Styling is injected once and themed
 * with CSS custom properties (`--map-control-*`); there is no separate stylesheet to load.
 */
export interface Control {
    onAdd(map: Map): HTMLElement;
    onRemove(map: Map): void;
    getDefaultPosition?(): ControlPosition;
}
export type ControlPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export const CONTROL_CSS = `
:where(.maplibregl-ctrl-top-left,.maplibregl-ctrl-top-right,.maplibregl-ctrl-bottom-left,.maplibregl-ctrl-bottom-right){position:absolute;z-index:2;pointer-events:none;display:flex;flex-direction:column;gap:10px;max-width:100%;box-sizing:border-box}
:where(.maplibregl-ctrl-top-left){top:0;left:0;align-items:flex-start;padding:max(10px,env(safe-area-inset-top)) 10px 10px max(10px,env(safe-area-inset-left))}
:where(.maplibregl-ctrl-top-right){top:0;right:0;align-items:flex-end;padding:max(10px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) 10px 10px}
:where(.maplibregl-ctrl-bottom-left){bottom:0;left:0;align-items:flex-start;flex-direction:column-reverse;padding:10px 10px max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left))}
:where(.maplibregl-ctrl-bottom-right){bottom:0;right:0;align-items:flex-end;flex-direction:column-reverse;padding:10px 0 env(safe-area-inset-bottom) 10px}
:where(.maplibregl-ctrl-bottom-right>.maplibregl-ctrl:not(.maplibregl-ctrl-attrib)){margin-right:max(10px,env(safe-area-inset-right))}
:where(.maplibregl-ctrl-attrib){background:var(--map-attribution-background,rgba(255,255,255,.75));color:var(--map-control-color,#333);font-size:11px;line-height:1.4;padding:2px 6px;padding-right:max(6px,env(safe-area-inset-right));border-top-left-radius:4px;overflow-wrap:anywhere}
:where(.maplibregl-ctrl-attrib a){color:inherit}
:where(.maplibregl-ctrl-attrib.maplibregl-compact){display:flex;flex-direction:row-reverse;align-items:center;padding:0;margin:0 max(10px,env(safe-area-inset-right)) 10px 0;border-radius:14px;background:var(--map-control-background,#fff);box-shadow:0 0 0 1.5px rgba(0,0,0,.12)}
:where(.maplibregl-ctrl-attrib.maplibregl-compact .maplibregl-ctrl-attrib-inner){display:none;padding:2px 4px 2px 10px}
:where(.maplibregl-ctrl-attrib.maplibregl-compact.maplibregl-compact-show .maplibregl-ctrl-attrib-inner){display:block}
:where(.maplibregl-ctrl-attrib-button){display:none;flex:none;width:28px;height:28px;border:0;border-radius:14px;background:none;color:inherit;font:italic 700 14px/28px Georgia,serif;cursor:pointer;padding:0}
:where(.maplibregl-compact .maplibregl-ctrl-attrib-button){display:block}
@media (pointer:coarse){:where(.maplibregl-compact .maplibregl-ctrl-attrib-button){width:36px;height:36px;border-radius:18px;line-height:36px}:where(.maplibregl-ctrl-attrib.maplibregl-compact){border-radius:18px}}
:where(.maplibregl-ctrl){pointer-events:auto;font:12px/1.3 system-ui,sans-serif;color:var(--map-control-color,#222)}
:where(.maplibregl-ctrl-group){background:var(--map-control-background,#fff);border-radius:var(--map-control-radius,6px);box-shadow:0 0 0 1.5px rgba(0,0,0,.12),0 1px 4px rgba(0,0,0,.15);overflow:hidden}
:where(.maplibregl-ctrl-group button){display:flex;align-items:center;justify-content:center;width:var(--map-control-size,32px);height:var(--map-control-size,32px);padding:0;border:0;background:none;color:inherit;cursor:pointer}
:where(.maplibregl-ctrl-group button+button){border-top:1px solid rgba(0,0,0,.1)}
:where(.maplibregl-ctrl-group button:hover){background:rgba(0,0,0,.06)}
:where(.maplibregl-ctrl-group button:disabled){opacity:.35;cursor:default}
:where(.maplibregl-ctrl-group button:focus-visible){outline:2px solid var(--map-control-focus,#2f7fd1);outline-offset:-2px}
:where(.maplibregl-ctrl-scale){background:rgba(255,255,255,.75);border:1.5px solid var(--map-control-color,#333);border-top:0;padding:0 5px;font-size:10px;box-sizing:border-box;white-space:nowrap}
/* Touch screens get finger-sized buttons. Kept last so it overrides the sizes above. */
@media (pointer:coarse){:where(.maplibregl-ctrl-group button){width:var(--map-control-size,44px);height:var(--map-control-size,44px)}}
`;

const svg = (path: string, extra = '') => `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" ${extra}>${path}</svg>`;

function button(group: HTMLElement, label: string, icon: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.title = label;
    b.setAttribute('aria-label', label);
    b.innerHTML = icon;
    b.addEventListener('click', onClick);
    return group.appendChild(b);
}

function group(extraClass = ''): HTMLElement {
    const el = document.createElement('div');
    el.className = `maplibregl-ctrl maplibregl-ctrl-group ${extraClass}`.trim();
    return el;
}

/** Zoom buttons and a compass that shows the map's rotation and tilt, and resets both when clicked. */
export class NavigationControl implements Control {
    private el?: HTMLElement;
    private update = () => {};
    constructor(private options: {showZoom?: boolean; showCompass?: boolean} = {}) {}

    onAdd(map: Map) {
        const el = this.el = group();
        let zoomIn: HTMLButtonElement | undefined, zoomOut: HTMLButtonElement | undefined, needle: SVGElement | null = null;
        if (this.options.showZoom !== false) {
            zoomIn = button(el, 'Zoom in', svg('<path d="M9 4v10M4 9h10"/>'), () => map.zoomIn());
            zoomOut = button(el, 'Zoom out', svg('<path d="M4 9h10"/>'), () => map.zoomOut());
        }
        if (this.options.showCompass !== false) {
            const b = button(el, 'Reset bearing to north', svg('<path d="M9 2.500 12 9H6z" fill="currentColor" stroke="none"/><path d="M9 15.500 6 9h6z" fill="currentColor" stroke="none" opacity=".35"/>'),
                () => map.easeTo({bearing: 0, pitch: 0}));
            needle = b.querySelector('svg');
        }
        this.update = () => {
            if (zoomIn) zoomIn.disabled = map.getZoom() >= map.getMaxZoom();
            if (zoomOut) zoomOut.disabled = map.getZoom() <= map.getMinZoom();
            if (needle) needle.style.transform = `rotateX(${map.getPitch()}deg) rotate(${-map.getBearing()}deg)`;
        };
        map.on('move', this.update);
        this.update();
        return el;
    }
    onRemove(map: Map) { map.off('move', this.update); this.el?.remove(); }
}

/** A bar showing a round distance at the map's current scale. */
export class ScaleControl implements Control {
    private el?: HTMLElement;
    private update = () => {};
    constructor(private options: {maxWidth?: number; unit?: 'metric' | 'imperial'} = {}) {}

    onAdd(map: Map) {
        const el = this.el = document.createElement('div');
        el.className = 'maplibregl-ctrl maplibregl-ctrl-scale';
        const maxWidth = this.options.maxWidth ?? 100, imperial = this.options.unit === 'imperial';
        this.update = () => {
            const metresPerPixel = 40075016.686 * Math.cos(map.getCenter().lat * Math.PI / 180) / (512 * 2 ** map.getZoom());
            // Pick the unit, then the largest 1/2/3/5 x 10^n distance that fits.
            let max = metresPerPixel * maxWidth, unit = 'm', perUnit = 1;
            if (imperial) { max *= 3.28084; unit = 'ft'; perUnit = 1 / 3.28084; if (max > 5280) { max /= 5280; unit = 'mi'; perUnit = 1609.344; } } else if (max >= 1000) { max /= 1000; unit = 'km'; perUnit = 1000; }
            const pow = 10 ** Math.floor(Math.log10(max)), lead = max / pow, nice = (lead >= 5 ? 5 : lead >= 3 ? 3 : lead >= 2 ? 2 : 1) * pow;
            el.style.width = nice * perUnit / metresPerPixel + 'px';
            el.textContent = `${nice >= 1 ? nice : +nice.toPrecision(1)} ${unit}`;
        };
        map.on('move', this.update);
        this.update();
        return el;
    }
    onRemove(map: Map) { map.off('move', this.update); this.el?.remove(); }
}

/** Toggles the map's container in and out of fullscreen. */
export class FullscreenControl implements Control {
    private el?: HTMLElement;
    onAdd(map: Map) {
        const el = this.el = group(), c = map.getContainer();
        button(el, 'Toggle fullscreen', svg('<path d="M3 7V3h4M11 3h4v4M15 11v4h-4M7 15H3v-4"/>'),
            () => { if (document.fullscreenElement) document.exitFullscreen(); else c.requestFullscreen?.(); });
        return el;
    }
    onRemove() { this.el?.remove(); }
}

/** Moves the map to the user's position (after the browser's permission prompt) and fires `geolocate` or `error`. */
export class GeolocateControl implements Control {
    private el?: HTMLElement;
    constructor(private options: {zoom?: number; positionOptions?: PositionOptions} = {}) {}
    onAdd(map: Map) {
        const el = this.el = group();
        const b = button(el, 'Find my location', svg('<circle cx="9" cy="9" r="4"/><path d="M9 1.500v3M9 13.500v3M1.500 9h3M13.500 9h3"/>'), () => {
            b.disabled = true;
            navigator.geolocation.getCurrentPosition(p => {
                b.disabled = false;
                map.flyTo({center: [p.coords.longitude, p.coords.latitude], zoom: Math.max(map.getZoom(), this.options.zoom ?? 14)});
                map.fire('geolocate', {coords: p.coords});
            }, err => { b.disabled = false; map.fire('error', {error: new Error(err.message)}); }, this.options.positionOptions);
        });
        if (!('geolocation' in navigator)) b.disabled = true;
        return el;
    }
    onRemove() { this.el?.remove(); }
}

/** Copies provider attribution HTML into an element, keeping only its text and http(s) links. */
export function sanitizeAttribution(html: string, into: HTMLElement) {
    const copy = (from: Node, to: Node) => {
        for (const node of from.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) to.appendChild(document.createTextNode(node.textContent ?? ''));
            else if (node instanceof Element) {
                const href = node.tagName === 'A' ? node.getAttribute('href') : null;
                if (href && /^https?:\/\//i.test(href)) copy(node, to.appendChild(Object.assign(document.createElement('a'), {href, target: '_blank', rel: 'noopener noreferrer'})));
                else copy(node, to);
            }
        }
    };
    copy(new DOMParser().parseFromString(html, 'text/html').body, into);
}

/**
 * Credits for the map's data. On narrow maps (phones) it collapses to a small "i" button that expands on tap, so the
 * credits stay available without covering the map; `compact` forces either form.
 */
export class AttributionControl implements Control {
    private el?: HTMLElement;
    private update = () => {};
    constructor(private options: {compact?: boolean; customAttribution?: string | string[]} = {}) {}
    getDefaultPosition(): ControlPosition { return 'bottom-right'; }

    onAdd(map: Map) {
        const el = this.el = document.createElement('div'), inner = document.createElement('div');
        el.className = 'maplibregl-ctrl maplibregl-ctrl-attrib';
        inner.className = 'maplibregl-ctrl-attrib-inner';
        const toggle = Object.assign(document.createElement('button'), {type: 'button', className: 'maplibregl-ctrl-attrib-button', textContent: 'i', title: 'Map data credits'});
        toggle.setAttribute('aria-label', 'Toggle map data credits');
        toggle.addEventListener('click', () => toggle.setAttribute('aria-expanded', String(el.classList.toggle('maplibregl-compact-show'))));
        el.append(toggle, inner);
        const collapse = () => { el.classList.remove('maplibregl-compact-show'); toggle.setAttribute('aria-expanded', 'false'); };
        this.update = () => {
            const html = [...new Set([...map.getAttributions(), ...[this.options.customAttribution ?? []].flat()])].join(' | ');
            inner.replaceChildren();
            sanitizeAttribution(html, inner);
            el.style.display = html ? '' : 'none';
            el.classList.toggle('maplibregl-compact', this.options.compact ?? map.getContainer().clientWidth <= 640);
        };
        map.on('styledata', this.update);
        map.on('resize', this.update);
        map.on('dragstart', collapse);
        this.cleanup = () => { map.off('styledata', this.update); map.off('resize', this.update); map.off('dragstart', collapse); };
        this.update();
        return el;
    }
    private cleanup = () => {};
    onRemove() { this.cleanup(); this.el?.remove(); }
}
