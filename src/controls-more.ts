// The controls that an application adds itself (the control for the credits is in controls.ts, because the map adds it).
// They are a file of their own, so that a page that does not use them does not load them.
import type {Map} from './map.ts';
import {cls, toggleClass, type Control, type ControlPosition} from './controls.ts';

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
    el.className = `${cls('ctrl', 'ctrl-group')} ${extraClass}`.trim();
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
        el.className = cls('ctrl', 'ctrl-scale');
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
        const b = button(el, '', svg('<path d="M3 7V3h4M11 3h4v4M15 11v4h-4M7 15H3v-4"/>'),
            () => { if (document.fullscreenElement) document.exitFullscreen(); else c.requestFullscreen?.(); });
        // The name of the button says what a press does now, and `aria-pressed` says whether the map fills the screen.
        const name = this.name = () => {
            const on = document.fullscreenElement === c;
            b.title = on ? 'Exit fullscreen' : 'Enter fullscreen';
            b.setAttribute('aria-label', b.title);
            b.setAttribute('aria-pressed', String(on));
        };
        name();
        document.addEventListener('fullscreenchange', name);
        return el;
    }
    private name = () => {};
    onRemove() { this.el?.remove(); document.removeEventListener('fullscreenchange', this.name); }
}

/** A button that turns 3D terrain on and off. The options are those of `setTerrain`, as in MapLibre. */
export class TerrainControl implements Control {
    private el?: HTMLElement;
    constructor(public options: {source: string; exaggeration?: number}) {}
    onAdd(map: Map) {
        const el = this.el = group();
        button(el, 'Toggle terrain', svg('<path d="M1.500 14.500l5-8 3 4.500 2-3 5 6.500z"/>'), () => { map.setTerrain(map.getTerrain() ? null : this.options); });
        return el;
    }
    onRemove() { this.el?.remove(); }
}

/** MapLibre shows its logo with this control. This library has no logo, so the control adds an empty element. */
export class LogoControl implements Control {
    private el?: HTMLElement;
    onAdd() { return this.el = document.createElement('div'); }
    onRemove() { this.el?.remove(); }
    getDefaultPosition(): ControlPosition { return 'bottom-left'; }
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
                map.easeTo({duration: 1200, center: [p.coords.longitude, p.coords.latitude], zoom: Math.max(map.getZoom(), this.options.zoom ?? 14)});
                map.fire('geolocate', {coords: p.coords});
            }, err => { b.disabled = false; map.fire('error', {error: new Error(err.message)}); }, this.options.positionOptions);
        });
        if (!('geolocation' in navigator)) b.disabled = true;
        return el;
    }
    onRemove() { this.el?.remove(); }
}
