// The controls that an application adds itself (the control for the credits is in controls.ts, because the map adds it).
// They are a file of their own, so that a page that does not use them does not load them.
import type {Map} from './map.ts';
import {Evented} from './evented.ts';
import {cls, ui, toggleClass, type Control, type ControlPosition} from './controls.ts';

export const svg = (path: string, extra = '') => `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" ${extra}>${path}</svg>`;

/** `name` gives the button the class name that MapLibre GL JS gives it (`maplibregl-ctrl-zoom-in`), for stylesheets and tests written for that library. */
export function button(group: HTMLElement, name: string, label: string, icon: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = cls('ctrl-' + name);
    b.type = 'button';
    b.title = label;
    b.setAttribute('aria-label', label);
    b.innerHTML = icon;
    b.addEventListener('click', onClick);
    return group.appendChild(b);
}

export function group(extraClass = ''): HTMLElement {
    const el = document.createElement('div');
    el.className = `${cls('ctrl', 'ctrl-group')} ${extraClass}`.trim();
    return el;
}

/**
 * Dragging the compass rotates the map with the sideways movement and pitches it with the vertical movement, as the
 * MouseRotateWrapper of MapLibre GL JS does. A movement of 3 pixels or less is a click, which resets the bearing; a
 * longer drag does not.
 */
function dragCompass(map: Map, b: HTMLButtonElement, pitch: boolean) {
    let last: PointerEvent | null = null, dragged = false;
    b.style.touchAction = 'none';
    b.addEventListener('pointerdown', e => {
        if (e.button) return;
        last = e; dragged = false;
        try { b.setPointerCapture(e.pointerId); } catch { /* a synthetic event has no pointer to capture */ }
    });
    b.addEventListener('pointermove', e => {
        if (!last || e.pointerId !== last.pointerId) return;
        const dx = e.clientX - last.clientX, dy = e.clientY - last.clientY;
        if (!dragged && Math.hypot(dx, dy) <= 3) return;
        dragged = true;
        const r = b.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2, lx = last.clientX - r.left - r.width / 2;
        // The angle between (last x, current y) and the current point, seen from the centre of the button.
        map.jumpTo({bearing: map.getBearing() + Math.atan2(x * y - y * lx, x * lx + y * y) * 180 / Math.PI, ...pitch && {pitch: map.getPitch() - dy / 2}});
        last = e;
    });
    const end = () => { last = null; setTimeout(() => { dragged = false; }); };
    b.addEventListener('pointerup', end);
    b.addEventListener('pointercancel', end);
    b.addEventListener('click', e => { if (dragged) { dragged = false; e.stopImmediatePropagation(); } }, true);
}

/** Zoom buttons and a compass that shows the map's rotation and resets it when clicked. Dragging the compass rotates the map. */
export class NavigationControl implements Control {
    private el?: HTMLElement;
    private update = () => {};
    private pitch: boolean;
    /** With `visualizePitch: true`, the compass shows the pitch, dragging it also pitches the map, and a click resets the pitch, as in MapLibre GL JS (default false). */
    constructor(private options: {showZoom?: boolean; showCompass?: boolean; visualizePitch?: boolean} = {}) { this.pitch = !!options.visualizePitch; }

    onAdd(map: Map) {
        const el = this.el = group();
        let zoomIn: HTMLButtonElement | undefined, zoomOut: HTMLButtonElement | undefined, needle: SVGElement | null = null;
        if (this.options.showZoom !== false) {
            zoomIn = button(el, 'zoom-in', ui(map, 'NavigationControl.ZoomIn', 'Zoom in'), svg('<path d="M9 4v10M4 9h10"/>'), () => map.zoomIn());
            zoomOut = button(el, 'zoom-out', ui(map, 'NavigationControl.ZoomOut', 'Zoom out'), svg('<path d="M4 9h10"/>'), () => map.zoomOut());
        }
        let letter: SVGTextElement | null = null;
        if (this.options.showCompass !== false) {
            const glass = map.getContainer().classList.contains('map-jr-glass');
            const b = button(el, 'compass', ui(map, 'NavigationControl.ResetBearing', 'Reset bearing to north'), glass
                // The compass of the main API: a dial with 12 ticks and a mark of north on the rim, which turn with the map,
                // and the direction that the map faces in the centre (one of 8), which stays upright.
                ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><g><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-dasharray=".6 4.636" opacity=".5"/><path d="M12 .6l2.6 3.8H9.4z"/></g><text x="12" y="12.4" text-anchor="middle" dominant-baseline="middle" font-size="8.5" font-weight="600" font-family="system-ui,sans-serif"></text></svg>'
                : svg('<path d="M9 2.500 12 9H6z" fill="currentColor" stroke="none"/><path d="M9 15.500 6 9h6z" fill="currentColor" stroke="none" opacity=".35"/>'),
                () => map.easeTo({bearing: 0, ...this.pitch && {pitch: 0}}));
            needle = b.querySelector(glass ? 'g' : 'svg');
            letter = b.querySelector('text');
            if (glass) needle!.style.transformOrigin = '12px 12px';
            dragCompass(map, b, this.pitch);
        }
        this.update = () => {
            if (zoomIn) zoomIn.disabled = map.getZoom() >= map.getMaxZoom();
            if (zoomOut) zoomOut.disabled = map.getZoom() <= map.getMinZoom();
            if (needle) needle.style.transform = `rotateX(${this.pitch ? map.getPitch() : 0}deg) rotate(${-map.getBearing()}deg)`;
            if (letter) letter.textContent = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((map.getBearing() + 360) / 45) % 8];
        };
        map.on('move', this.update);
        this.update();
        return el;
    }
    onRemove(map: Map) { map.off('move', this.update); this.el?.remove(); }
}

const units: Record<string, string> = {Meters: 'm', Kilometers: 'km', Feet: 'ft', Miles: 'mi', NauticalMiles: 'nm'};

export type ScaleUnit = 'metric' | 'imperial' | 'nautical';

/** A bar showing a round distance at the map's current scale, in `'metric'` (m, km), `'imperial'` (ft, mi) or `'nautical'` (nm) units. */
export class ScaleControl implements Control {
    private el?: HTMLElement;
    private update = () => {};
    private unit: ScaleUnit;
    constructor(private options: {maxWidth?: number; unit?: ScaleUnit} = {}) { this.unit = options.unit ?? 'metric'; }
    getDefaultPosition(): ControlPosition { return 'bottom-left'; }
    /** Changes the unit of the bar, as `setUnit` of MapLibre GL JS does. */
    setUnit(unit: ScaleUnit) { this.unit = unit; this.update(); }

    onAdd(map: Map) {
        const el = this.el = document.createElement('div');
        el.className = cls('ctrl', 'ctrl-scale');
        const maxWidth = this.options.maxWidth ?? 100;
        this.update = () => {
            const metresPerPixel = 40075016.686 * Math.cos(map.getCenter().lat * Math.PI / 180) / (512 * 2 ** map.getZoom());
            // Pick the unit, then the largest 1/2/3/5 x 10^n distance that fits.
            let max = metresPerPixel * maxWidth, unit = 'Meters', perUnit = 1;
            if (this.unit === 'imperial') { max *= 3.28084; unit = 'Feet'; perUnit = 1 / 3.28084; if (max > 5280) { max /= 5280; unit = 'Miles'; perUnit = 1609.344; } } else if (this.unit === 'nautical') { max /= 1852; unit = 'NauticalMiles'; perUnit = 1852; } else if (max >= 1000) { max /= 1000; unit = 'Kilometers'; perUnit = 1000; }
            const pow = 10 ** Math.floor(Math.log10(max)), lead = max / pow, nice = (lead >= 5 ? 5 : lead >= 3 ? 3 : lead >= 2 ? 2 : 1) * pow;
            const width = nice * perUnit / metresPerPixel + 'px';
            el.style.width = width;
            el.style.setProperty('--map-jr-scale', width); // (the length of the bar of the main API, which draws it after the text)
            el.textContent = `${nice >= 1 ? nice : +nice.toPrecision(1)} ${ui(map, 'ScaleControl.' + unit, units[unit])}`;
        };
        map.on('move', this.update);
        this.update();
        return el;
    }
    onRemove(map: Map) { map.off('move', this.update); this.el?.remove(); }
}

/**
 * Toggles the map's container in and out of fullscreen. Where the browser has no Fullscreen API (Safari on iPhone),
 * or with `pseudo: true`, the control gives the container the class `map-jr-pseudo-fullscreen`, which makes it fill
 * the window, as the "pseudo fullscreen" of MapLibre GL JS does.
 */
export class FullscreenControl implements Control {
    private el?: HTMLElement;
    private pseudo: boolean;
    private full = false;
    private restoreGestures = false;
    constructor(options: {container?: HTMLElement; pseudo?: boolean} = {}) {
        if (options.container) noEffect('FullscreenControl', 'container', ' The map\'s container goes fullscreen.');
        this.pseudo = !!options.pseudo;
    }
    /** Called when the container enters or leaves fullscreen (the compat entry fires its events here). */
    protected changed(_on: boolean) {}
    onAdd(map: Map) {
        const el = this.el = group(), c = map.getContainer();
        const native = () => !this.pseudo && !!c.requestFullscreen && !!document.exitFullscreen;
        const set = (on: boolean) => {
            if (on === this.full) return;
            this.full = on;
            name();
            // As in MapLibre GL JS, `cooperativeGestures` (compat entry) is off while the map fills the screen.
            const cg = (map as {cooperativeGestures?: {isEnabled(): boolean; enable(): void; disable(): void}}).cooperativeGestures;
            if (cg) {
                if (on) { this.restoreGestures = cg.isEnabled(); cg.disable(); } else if (this.restoreGestures) { this.restoreGestures = false; cg.enable(); }
            }
            this.changed(on);
        };
        const b = button(el, 'fullscreen', '', svg('<path d="M3 7V3h4M11 3h4v4M15 11v4h-4M7 15H3v-4"/>'), () => {
            if (native() && !c.classList.contains('map-jr-pseudo-fullscreen')) {
                Promise.resolve(this.full ? document.exitFullscreen() : c.requestFullscreen()).catch(() => {});
            } else {
                set(toggleClass(c, 'pseudo-fullscreen'));
                map.resize();
            }
        });
        // The name of the button says what a press does now, and `aria-pressed` says whether the map fills the screen.
        const name = () => {
            b.title = this.full ? ui(map, 'FullscreenControl.Exit', 'Exit fullscreen') : ui(map, 'FullscreenControl.Enter', 'Enter fullscreen');
            b.setAttribute('aria-label', b.title);
            b.setAttribute('aria-pressed', String(this.full));
        };
        name();
        this.change = () => set(document.fullscreenElement === c);
        document.addEventListener('fullscreenchange', this.change);
        this.cleanup = () => { if (c.classList.contains('map-jr-pseudo-fullscreen')) { toggleClass(c, 'pseudo-fullscreen', false); map.resize(); } set(false); };
        return el;
    }
    private change = () => {};
    private cleanup = () => {};
    onRemove() { this.el?.remove(); document.removeEventListener('fullscreenchange', this.change); this.cleanup(); }
}

/** A button that turns 3D terrain on and off. The options are those of `setTerrain`, as in MapLibre. */
export class TerrainControl implements Control {
    private el?: HTMLElement;
    constructor(public options: {source: string; exaggeration?: number}) {}
    onAdd(map: Map) {
        const el = this.el = group();
        const b = button(el, 'terrain', '', svg('<path d="M1.500 14.500l5-8 3 4.500 2-3 5 6.500z"/>'), () => { map.setTerrain(map.getTerrain() ? null : this.options); name(); });
        const name = () => { b.title = ui(map, map.getTerrain() ? 'TerrainControl.Disable' : 'TerrainControl.Enable', 'Toggle terrain'); b.setAttribute('aria-label', b.title); };
        name();
        return el;
    }
    onRemove() { this.el?.remove(); }
}

/**
 * A button that switches the projection between the globe and Mercator, as `GlobeControl` of MapLibre GL JS does
 * (`setProjection({type: 'globe'})` and back). The button has the class `ctrl-globe-enabled` while the projection is
 * `globe`.
 */
export class GlobeControl implements Control {
    private el?: HTMLElement;
    private map?: Map;
    private b?: HTMLButtonElement;
    onAdd(map: Map) {
        const el = this.el = group();
        this.map = map;
        this.b = button(el, 'globe', '', svg('<circle cx="9" cy="9" r="6.500"/><ellipse cx="9" cy="9" rx="2.750" ry="6.500"/><path d="M2.500 9h13"/>'),
            () => { map.setProjection({type: map.getProjection()?.type === 'globe' ? 'mercator' : 'globe'}); this.show(); });
        this.show();
        map.on('styledata', this.show);
        map.on('projectiontransition', this.show);
        return el;
    }
    onRemove() {
        this.map?.off('styledata', this.show);
        this.map?.off('projectiontransition', this.show);
        this.el?.remove();
        this.map = undefined;
    }
    getDefaultPosition(): ControlPosition { return 'top-right'; }
    private show = () => {
        const b = this.b, map = this.map;
        if (!b || !map) return;
        const on = map.getProjection()?.type === 'globe';
        // (MapLibre gives the button one of the two classes. The names of this library come with them: see `toggleClass`.)
        toggleClass(b, 'ctrl-globe', !on);
        toggleClass(b, 'ctrl-globe-enabled', on);
        b.title = ui(map, on ? 'GlobeControl.Disable' : 'GlobeControl.Enable', on ? 'Disable globe' : 'Enable globe');
        b.setAttribute('aria-label', b.title);
        b.setAttribute('aria-pressed', String(on));
    };
}

/** MapLibre shows its logo with this control. This library has no logo, so the control adds an empty element. */
export class LogoControl implements Control {
    private el?: HTMLElement;
    onAdd() { return this.el = document.createElement('div'); }
    onRemove() { this.el?.remove(); }
    getDefaultPosition(): ControlPosition { return 'bottom-left'; }
}

/**
 * Moves the map to the user's position (after the browser's permission prompt). It fires `geolocate`, `error` or
 * `outofmaxbounds` on itself, as MapLibre GL JS does, and `geolocate` and `error` also on the map.
 *
 * With `trackUserLocation`, the button turns tracking on and off, as in MapLibre GL JS 6.17. The control follows the
 * position (`watchPosition`) and keeps the map on it until the map moves for another reason, which fires
 * `trackuserlocationend` and `userlocationlostfocus`. A click then returns to the position and fires
 * `trackuserlocationstart` and `userlocationfocus`. `showUserLocation` (default true) shows a dot at the position while
 * tracking is on. The accuracy circle (`showAccuracyCircle`) is not drawn. The code of tracking (geolocate-track.ts)
 * loads on demand at the first click, so the first step of tracking happens once that file has loaded.
 */
export class GeolocateControl extends Evented implements Control {
    private el?: HTMLElement;
    private map?: Map;
    private b?: HTMLButtonElement;
    private t?: Promise<{click(): void; remove(): void}>;
    constructor(private options: {zoom?: number; positionOptions?: PositionOptions; trackUserLocation?: boolean; showUserLocation?: boolean; showAccuracyCircle?: boolean} = {}) {
        super();
        if (options.showAccuracyCircle) noEffect('GeolocateControl', 'showAccuracyCircle', ' The control shows a dot at the position without the circle.');
    }
    onAdd(map: Map) {
        this.map = map;
        const el = this.el = group();
        const b = this.b = button(el, 'geolocate', ui(map, 'GeolocateControl.FindMyLocation', 'Find my location'), svg('<circle cx="9" cy="9" r="4"/><path d="M9 1.500v3M9 13.500v3M1.500 9h3M13.500 9h3"/>'), () => this.trigger());
        if (!('geolocation' in navigator)) { b.disabled = true; b.title = ui(map, 'GeolocateControl.LocationNotAvailable', 'Location not available'); b.setAttribute('aria-label', b.title); }
        if (this.options.trackUserLocation) b.setAttribute('aria-pressed', 'false');
        return el;
    }
    /**
     * Without `trackUserLocation`, asks for the position once. With it, turns tracking on or off as a click does.
     * Returns `false` when the control is not on a map or the browser has no geolocation.
     */
    trigger() {
        const map = this.map, b = this.b, o = this.options;
        if (!map || !b || !('geolocation' in navigator)) return false;
        if (o.trackUserLocation) {
            const host = {
                fire: (type: string) => this.fire(type),
                found: (p: GeolocationPosition) => this.found(map, p, false),
                failed: (e: {code: number; message: string}) => this.failed(map, e),
                follow: (p: GeolocationPosition) => this.follow(map, p),
            };
            (this.t ??= import('./geolocate-track.ts').then(m => m.tracker(host, map, b, o.positionOptions, o.showUserLocation !== false)))
                .then(t => { if (this.map === map) t.click(); }, e => console.error('[map-jr-gl] GeolocateControl: the code of trackUserLocation could not be loaded. Check that the files of the library are served.', e));
            return true;
        }
        b.disabled = true;
        navigator.geolocation.getCurrentPosition(p => { b.disabled = false; this.found(map, p, true); }, e => { b.disabled = false; this.failed(map, e); }, o.positionOptions);
        return true;
    }
    private found(map: Map, p: GeolocationPosition, move: boolean) {
        if (this.map !== map) return false;
        const {longitude: x, latitude: y} = p.coords, m = map.getMaxBounds();
        if (m && (x < m.getWest() || x > m.getEast() || y < m.getSouth() || y > m.getNorth())) { this.fire('outofmaxbounds', {coords: p.coords, timestamp: p.timestamp}); return false; }
        if (move) this.follow(map, p);
        this.fire('geolocate', {coords: p.coords, timestamp: p.timestamp});
        map.fire('geolocate', {coords: p.coords});
        return true;
    }
    private failed(map: Map, err: {code: number; message: string}) {
        if (this.map !== map) return;
        this.fire('error', {code: err.code, message: err.message});
        map.fire('error', {error: new Error(err.message)});
    }
    private follow(map: Map, p: GeolocationPosition) {
        map.easeTo({duration: 1200, center: [p.coords.longitude, p.coords.latitude], zoom: Math.max(map.getZoom(), this.options.zoom ?? 14)});
    }
    onRemove() {
        this.t?.then(t => t.remove(), () => {});
        this.t = undefined;
        this.el?.remove(); this.map = undefined;
    }
}
// (Warnings are once per page, as the other warnings for options with no effect.)
const warned: Record<string, 1> = {};
/** One warning for an option of a control that is accepted and has no effect. */
function noEffect(control: string, option: string, instead = '') {
    if (warned[option]) return;
    warned[option] = 1;
    console.warn(`[map-jr-gl] ${control}: the option ${option} has no effect.${instead}`);
}
