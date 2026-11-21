// The controls of the first view from the server (`renderFirstView`, `renderElement`, the `ssr` of the Vue component): static
// markup that has the classes and the structure that the controls of controls.ts and controls-more.ts create in the browser
// (in a map of the main API, which sets `map-jr-glass`), and the style sheet of the controls. This file belongs to the
// server entry only, so the page script does not carry it. test/unit/server-controls.test.ts and test/element.mjs check that
// the markup and the look stay the same as those of the controls.
import {CONTROL_CSS, cls, type ControlPosition} from './controls.ts';
import type {ControlSpec} from './host.ts';
import {cleanCredits} from './svg.ts';

/** What the markup of the first view needs to know about the map. `lat`, `zoom` and `bearing` are those of the view that the SVG shows. */
export interface FirstViewControls {
    controls: readonly ControlSpec[];
    lat: number; zoom: number; bearing: number; width: number;
    colorScheme: 'auto' | 'light' | 'dark';
    locale?: Record<string, string> | null;
    nonce?: string | null;
    minZoom?: number | null; maxZoom?: number | null;
    projection?: {type?: unknown} | null;
    terrain?: boolean;
    /** The credits as HTML, from the sources or from the options. `false` leaves out the attribution. */
    credits: string[] | false;
    attribution?: {compact?: boolean; customAttribution?: string | string[]} | null;
}

const esc = (t: unknown) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const name = (n: number | string) => String(n).replace(/\W/g, '_');
const icon = (path: string, extra = '') => `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" ${extra}>${path}</svg>`;
const ICONS: Record<string, string> = {
    'zoom-in': icon('<path d="M9 4v10M4 9h10"/>'),
    'zoom-out': icon('<path d="M4 9h10"/>'),
    fullscreen: icon('<path d="M3 7V3h4M11 3h4v4M15 11v4h-4M7 15H3v-4"/>'),
    terrain: icon('<path d="M1.500 14.500l5-8 3 4.500 2-3 5 6.500z"/>'),
    globe: icon('<circle cx="9" cy="9" r="6.500"/><ellipse cx="9" cy="9" rx="2.750" ry="6.500"/><path d="M2.500 9h13"/>'),
    geolocate: icon('<circle cx="9" cy="9" r="4"/><path d="M9 1.500v3M9 13.500v3M1.500 9h3M13.500 9h3"/>'),
};
const SUN = icon('<circle cx="9" cy="9" r="3.200"/><path d="M9 1.800v1.200M9 15v1.200M1.800 9H3M15 9h1.200M3.900 3.900l.850.850M13.250 13.250l.850.850M3.900 14.100l.850-.850M13.250 4.750l.850-.850"/>');
const MOON = icon('<path d="M15 10.800A6.300 6.300 0 1 1 7.200 3a5 5 0 0 0 7.800 7.800z"/>');
const CORNERS: ControlPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const UNITS: Record<string, string> = {Meters: 'm', Kilometers: 'km', Feet: 'ft', Miles: 'mi', NauticalMiles: 'nm'};

/** The compass of the main API (`NavigationControl`: a dial with ticks), with the letter of the direction that the view faces. */
function compass(bearing: number): string {
    let ticks = '', light = '';
    for (let a = 30; a < 360; a += 30) {
        const s = Math.sin(a * Math.PI / 180), c = -Math.cos(a * Math.PI / 180), major = !(a % 90), r = major ? 6.6 : 8, at = (k: number) => `${+(12 + s * k).toFixed(2)} ${+(12 + c * k).toFixed(2)}`;
        if (major) ticks += `M${at(r)}L${at(10.4)}`; else light += `M${at(r)}L${at(10.4)}`;
    }
    return `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><g class="map-jr-ssr-g${bearing ? ' map-jr-ssr-r' + name(bearing) : ''}"><path d="${light}" stroke-width="1.1" opacity=".45"/><path d="${ticks}" stroke-width="1.2"/><path d="M12 .9l1.9 4.3h-3.8z" stroke="none"/></g><text x="12" y="12" text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="600" font-family="system-ui,sans-serif" stroke="none">${'NESW'[Math.round((bearing + 360) / 90) % 4]}</text></svg>`;
}

// The style sheet of the controls without comments and empty lines. For `colorScheme: 'auto'`, each rule of the class
// `map-jr-dark` gets a copy for the class `map-jr-auto` inside `@media (prefers-color-scheme:dark)`, because a style sheet
// cannot set a class from the media query as the map in the browser does.
let sheet: string | undefined, autoSheet: string | undefined;
function sheets(auto: boolean): string {
    sheet ??= CONTROL_CSS.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.trim()).filter(Boolean).join('\n');
    return auto ? autoSheet ??= sheet.split('\n').map(line => /^(@media \(hover:hover\)\{)?:where\(\.map-jr-dark\)/.test(line) ? `${line}\n@media (prefers-color-scheme:dark){${line.replaceAll('.map-jr-dark', '.map-jr-auto')}}`
        : line.replace(/&\.map-jr-dark\{[^}]*\}/, m => `${m}@media (prefers-color-scheme:dark){${m.replace('.map-jr-dark', '.map-jr-auto')}}`)).join('\n') : sheet;
}

/** The style sheet and the layer of controls for the first view: both carry `data-map-jr-ssr`, so the map removes them when it takes over. */
export function controlsMarkup(o: FirstViewControls): string {
    const ui = (key: string, text: string) => esc(typeof o.locale?.[key] === 'string' ? o.locale[key] : text);
    const group = (inner: string) => `<div class="${cls('ctrl', 'ctrl-group')}">${inner}</div>`;
    const button = (kind: string, label: string, body: string, attrs = '', klass = cls('ctrl-' + kind)) => `<button class="${klass}" type="button" title="${label}" aria-label="${label}"${attrs}><span class="${cls('ctrl-icon')}">${body}</span></button>`;
    const rules: string[] = [], rule = (r: string) => { if (!rules.includes(r)) rules.push(r); };
    const corners: Record<string, string[]> = {};
    const maxZoom = o.maxZoom ?? 22, minZoom = o.minZoom ?? -2;
    const view = Number.isFinite(o.bearing) ? o.bearing : 0;
    if (view) rule(`.map-jr-ssr-r${name(view)}{transform:rotate(${-view}deg)}`);
    for (const spec of o.controls) {
        // (The key of a control is its function name and its options as JSON: see control-specs.ts. A control from `custom()` has no static markup.)
        const m = /^([a-zA-Z]+)(.*)$/s.exec(spec.key);
        if (!m || spec.key.startsWith('custom:')) continue;
        let options: Record<string, any> = {};
        try { options = JSON.parse(m[2] || '{}') ?? {}; } catch { /* a key that is not ours has no options */ }
        let html = '';
        if (m[1] === 'navigation') {
            if (options.showZoom !== false) html += group(
                button('zoom-in', ui('NavigationControl.ZoomIn', 'Zoom in'), ICONS['zoom-in'], o.zoom >= maxZoom ? ' disabled' : '') +
                button('zoom-out', ui('NavigationControl.ZoomOut', 'Zoom out'), ICONS['zoom-out'], o.zoom <= minZoom ? ' disabled' : ''));
            if (options.showCompass !== false) html += group(button('compass', ui('NavigationControl.ResetBearing', 'Reset bearing to north'), compass(view)));
            html = `<div class="${cls('ctrl')} map-jr-ssr-nav">${html}</div>`;
        } else if (m[1] === 'scale') {
            // The bar, as ScaleControl computes it: the largest 1, 2, 3 or 5 times a power of ten that fits in `maxWidth`.
            const mpp = 40075016.686 * Math.cos(o.lat * Math.PI / 180) / (512 * 2 ** o.zoom), system = options.unit ?? 'metric';
            let max = mpp * (options.maxWidth ?? 100), unit = 'Meters', per = 1;
            if (system === 'imperial') { max *= 3.28084; unit = 'Feet'; per = 1 / 3.28084; if (max > 5280) { max /= 5280; unit = 'Miles'; per = 1609.344; } } else if (system === 'nautical') { max /= 1852; unit = 'NauticalMiles'; per = 1852; } else if (max >= 1000) { max /= 1000; unit = 'Kilometers'; per = 1000; }
            const pow = 10 ** Math.floor(Math.log10(max)), lead = max / pow, nice = (lead >= 5 ? 5 : lead >= 3 ? 3 : lead >= 2 ? 2 : 1) * pow, width = nice * per / mpp + 'px';
            if (Number.isFinite(nice * per / mpp)) {
                rule(`.map-jr-ssr-s${name(width)}{width:${width};--map-jr-scale:${width}}`);
                html = `<div class="${cls('ctrl', 'ctrl-scale')} map-jr-ssr-s${name(width)}">${nice >= 1 ? nice : +nice.toPrecision(1)} ${ui('ScaleControl.' + unit, UNITS[unit])}</div>`;
            }
        } else if (m[1] === 'fullscreen') {
            html = group(button('fullscreen', ui('FullscreenControl.Enter', 'Enter fullscreen'), ICONS.fullscreen, ' aria-pressed="false"'));
        } else if (m[1] === 'terrain') {
            html = group(button('terrain', ui(o.terrain ? 'TerrainControl.Disable' : 'TerrainControl.Enable', 'Toggle terrain'), ICONS.terrain));
        } else if (m[1] === 'globe') {
            const on = o.projection?.type === 'globe';
            html = group(button('globe', ui(on ? 'GlobeControl.Disable' : 'GlobeControl.Enable', on ? 'Disable globe' : 'Enable globe'), ICONS.globe, ` aria-pressed="${on}"`, cls(on ? 'ctrl-globe-enabled' : 'ctrl-globe')));
        } else if (m[1] === 'geolocate') {
            html = group(button('geolocate', ui('GeolocateControl.FindMyLocation', 'Find my location'), ICONS.geolocate, options.trackUserLocation ? ' aria-pressed="false"' : ''));
        } else if (m[1] === 'colorScheme') {
            // `'auto'` has both icons: the style sheet shows the one that the scheme of the browser selects.
            const dark = o.colorScheme === 'dark', both = o.colorScheme === 'auto';
            html = group(button('color-scheme', ui(dark ? 'ColorSchemeControl.Light' : 'ColorSchemeControl.Dark', dark ? 'Use light colours' : 'Use dark colours'),
                both ? SUN.replace('<svg ', '<svg class="map-jr-ssr-sun" ') + MOON.replace('<svg ', '<svg class="map-jr-ssr-moon" ') : dark ? MOON : SUN));
        }
        if (!html) continue;
        const position = spec.position ?? (m[1] === 'scale' ? 'bottom-left' : 'top-right');
        if (CORNERS.includes(position)) (corners[position] ??= []).push(html);
    }
    // The credits are the lowest control of the bottom right corner (the map prepends them there). On a map of 640 pixels or less they are
    // folded to a button that starts open, as AttributionControl makes them; the width is the one that the options give.
    const credits = o.credits ? [...new Set([...o.credits, ...[o.attribution?.customAttribution ?? []].flat().map(a => a.trim()).filter(Boolean)])].map(cleanCredits).filter(Boolean).join(' | ') : '';
    if (credits) {
        const compact = o.attribution?.compact ?? o.width <= 640;
        rule(`.map-jr-ssr-m{max-width:${Math.max(0, o.width - 30)}px}`);
        (corners['bottom-right'] ??= []).unshift(`<div class="${cls('ctrl', 'ctrl-attrib')}${compact ? ' ' + cls('compact', 'compact-show') : ''} map-jr-ssr-m"><button class="${cls('ctrl-attrib-button')}" type="button" title="${ui('AttributionControl.ToggleAttribution', 'Map data credits')}" aria-label="${ui('AttributionControl.ToggleAttribution', 'Toggle map data credits')}"${compact ? ' aria-expanded="true"' : ''}>i</button><div class="${cls('ctrl-attrib-inner')}">${credits.replace(/<a href="([^"]*)">/g, '<a href="$1" target="_blank" rel="noopener noreferrer">')}</div></div>`);
    }
    const own = ['.map-jr-ssr-layer{position:absolute;inset:0;pointer-events:none}', '.map-jr-ssr-nav{display:flex;flex-direction:column;gap:10px;align-items:center}', '.map-jr-ssr-g{transform-origin:12px 12px}',
        // The controls of the map are in the same places, under the first view, from the start of the map: they stay out of sight until the map removes the first view.
        '[data-map-jr-ssr]~:is(.map-jr-ctrl-top-left,.map-jr-ctrl-top-right,.map-jr-ctrl-bottom-left,.map-jr-ctrl-bottom-right){visibility:hidden}',
        ...o.colorScheme === 'auto' ? ['@media (prefers-color-scheme:dark){.map-jr-ssr-sun{display:none}}', '@media (prefers-color-scheme:light){.map-jr-ssr-moon{display:none}}'] : [], ...rules];
    const scheme = o.colorScheme === 'dark' ? ' map-jr-dark' : o.colorScheme === 'auto' ? ' map-jr-auto' : '';
    const layer = CORNERS.filter(c => corners[c]).map(c => `<div class="${cls('ctrl-' + c)}">${corners[c].join('')}</div>`).join('');
    return `<style data-map-jr-ssr=""${o.nonce ? ` nonce="${esc(o.nonce)}"` : ''}>${sheets(o.colorScheme === 'auto')}\n${own.join('\n')}</style><div data-map-jr-ssr="" class="map-jr-map map-jr-glass${scheme} map-jr-ssr-layer">${layer}</div>`;
}
