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

/**
 * Class names. The library styles and finds its elements by `map-jr-*` names. Each element also gets the matching
 * `maplibregl-*` name, so stylesheets and plugins written for MapLibre GL JS continue to work.
 */
/**
 * The text of a UI string. A map of the compat entry has `_getUIString` (the `locale` option, with the keys of
 * MapLibre GL JS); a map of the core uses the English text `text`.
 */
export const ui = (map: unknown, key: string, text: string): string => (map as {_getUIString?(key: string): string | undefined})._getUIString?.(key) ?? text;
export const cls = (...names: string[]) => names.map(n => `map-jr-${n} maplibregl-${n}`).join(' ');
/** Adds or removes a class under both names (see `cls`). */
export function toggleClass(el: Element, name: string, on?: boolean): boolean {
    const now = el.classList.toggle('map-jr-' + name, on);
    el.classList.toggle('maplibregl-' + name, now);
    return now;
}
/** Gives elements that only have MapLibre's class names (a control from a plugin) this library's names too, so its styles apply. */
export function adoptClasses(root: Element) {
    for (const el of [root, ...root.querySelectorAll('[class*="maplibregl-"]')]) {
        for (const c of [...el.classList]) if (c.startsWith('maplibregl-')) el.classList.add('map-jr-' + c.slice(11));
    }
}

export const CONTROL_CSS = `
:where(.map-jr-map){position:relative;overflow:hidden;font:12px/1.3 system-ui,sans-serif}
:where(.map-jr-interactive){cursor:grab}:where(.map-jr-interactive:active){cursor:grabbing}
:where(.map-jr-ctrl-top-left,.map-jr-ctrl-top-right,.map-jr-ctrl-bottom-left,.map-jr-ctrl-bottom-right){position:absolute;z-index:2;pointer-events:none;display:flex;flex-direction:column;gap:10px;max-width:100%;box-sizing:border-box}
:where(.map-jr-ctrl-top-left){top:0;left:0;align-items:flex-start;padding:10px 10px 10px max(10px,env(safe-area-inset-left))}
:where(.map-jr-ctrl-top-right){top:0;right:0;align-items:flex-end;padding:10px max(10px,env(safe-area-inset-right)) 10px 10px}
:where(.map-jr-ctrl-bottom-left){bottom:0;left:0;align-items:flex-start;flex-direction:column-reverse;padding:10px 10px 10px max(10px,env(safe-area-inset-left))}
:where(.map-jr-ctrl-bottom-right){bottom:0;right:0;align-items:flex-end;flex-direction:column-reverse;padding:10px 0 0 10px}
:where(.map-jr-fills) :where(.map-jr-ctrl-top-left,.map-jr-ctrl-top-right){padding-top:max(10px,env(safe-area-inset-top))}
:where(.map-jr-fills) :where(.map-jr-ctrl-bottom-left){padding-bottom:max(10px,env(safe-area-inset-bottom))}
:where(.map-jr-fills) :where(.map-jr-ctrl-bottom-right){padding-bottom:env(safe-area-inset-bottom)}
:where(.map-jr-ctrl-bottom-right>.map-jr-ctrl:not(.map-jr-ctrl-attrib)){margin-right:max(10px,env(safe-area-inset-right))}
:where(.map-jr-unavailable){position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:1em;text-align:center;font:14px/1.4 system-ui,sans-serif;color:#555;background:#f2f2f2}
.map-jr-pseudo-fullscreen{position:fixed!important;width:100%!important;height:100%!important;top:0!important;left:0!important;z-index:99999}
:where(.map-jr-ctrl-attrib){background:var(--map-attribution-background,rgba(255,255,255,.75));color:var(--map-control-color,#333);font-size:11px;line-height:1.4;padding:2px 6px;padding-right:max(6px,env(safe-area-inset-right));border-top-left-radius:4px;overflow-wrap:anywhere}
:where(.map-jr-ctrl-attrib a){color:inherit}
:where(.map-jr-ctrl-attrib.map-jr-compact){display:flex;align-items:center;min-height:28px;padding:0 28px 0 0;margin:0 max(10px,env(safe-area-inset-right)) 10px 0;border-radius:14px;background:var(--map-control-background,#fff);box-shadow:0 0 0 1.5px rgba(0,0,0,.12)}
:where(.map-jr-ctrl-attrib.map-jr-compact .map-jr-ctrl-attrib-inner){display:none;padding:2px 4px 2px 10px}
:where(.map-jr-ctrl-attrib.map-jr-compact.map-jr-compact-show .map-jr-ctrl-attrib-inner){display:block}
:where(.map-jr-ctrl-attrib-button){display:none;flex:none;width:28px;height:28px;border:0;border-radius:14px;background:none;color:inherit;font:italic 700 14px/28px Georgia,serif;cursor:pointer;padding:0}
:where(.map-jr-compact .map-jr-ctrl-attrib-button){display:block}
.map-jr-ctrl-attrib.map-jr-compact{position:relative}.map-jr-compact>.map-jr-ctrl-attrib-button{position:absolute;top:0;right:0;margin:0}
@media (pointer:coarse){:where(.map-jr-compact .map-jr-ctrl-attrib-button){width:36px;height:36px;border-radius:18px;line-height:36px}:where(.map-jr-ctrl-attrib.map-jr-compact){border-radius:18px;min-height:36px;padding-right:36px}}
:where(.map-jr-ctrl){pointer-events:auto;color:var(--map-control-color,#222)}
:where(.map-jr-ctrl-group){background:var(--map-control-background,#fff);border-radius:var(--map-control-radius,6px);box-shadow:0 0 0 1.5px rgba(0,0,0,.12),0 1px 4px rgba(0,0,0,.15);overflow:hidden}
:where(.map-jr-ctrl-group button){-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center;width:var(--map-control-size,32px);height:var(--map-control-size,32px);padding:0;border:0;background:none;color:inherit;cursor:pointer}
:where(.map-jr-ctrl-group button+button){border-top:1px solid rgba(0,0,0,.1)}
@media (hover:hover){:where(.map-jr-ctrl-group button:hover){background:rgba(0,0,0,.06)}}
:where(.map-jr-ctrl-group button:disabled){opacity:.35;cursor:default}
:where(.map-jr-ctrl-group button:focus-visible){outline:2px solid var(--map-control-focus,#2f7fd1);outline-offset:-2px}
:where(.map-jr-user-location-dot){position:absolute;left:0;top:0;width:15px;height:15px;border-radius:50%;background:#1da1f2;box-shadow:0 0 0 2px #fff,0 0 3px 2px rgba(0,0,0,.35);pointer-events:none;z-index:1}
:where(.map-jr-user-location-dot-stale){background:#aaa}
:where(.map-jr-ctrl-geolocate-active,.map-jr-ctrl-geolocate-background,.map-jr-ctrl-globe-enabled){color:#33b5e5}:where(.map-jr-ctrl-geolocate-active-error,.map-jr-ctrl-geolocate-background-error){color:#e54e33}
:where(.map-jr-ctrl-scale){background:rgba(255,255,255,.75);border:1.5px solid var(--map-control-color,#333);border-top:0;padding:0 5px;font-size:10px;box-sizing:border-box;white-space:nowrap}
/* colorScheme 'dark' (the class map-jr-dark on the container). The variables of the application still win. */
:where(.map-jr-dark){--map-jr-popup-bg:#2b2b2b;--map-jr-popup-fg:#e6e6e6;--map-jr-popup-ring:0 0 0 1px rgba(255,255,255,.2)}
:where(.map-jr-dark) :where(.map-jr-ctrl-compass path+path){opacity:.6}
:where(.map-jr-dark) :where(.map-jr-ctrl){color:var(--map-control-color,#e6e6e6)}
:where(.map-jr-dark) :where(.map-jr-ctrl-group,.map-jr-ctrl-attrib.map-jr-compact){background:var(--map-control-background,#2b2b2b);box-shadow:0 0 0 1.5px rgba(255,255,255,.15)}
:where(.map-jr-dark) :where(.map-jr-ctrl-group button+button){border-color:rgba(255,255,255,.15)}
@media (hover:hover){:where(.map-jr-dark) :where(.map-jr-ctrl-group button:hover){background:rgba(255,255,255,.1)}}
:where(.map-jr-dark) :where(.map-jr-ctrl-attrib){background:var(--map-attribution-background,rgba(30,30,30,.75));color:var(--map-control-color,#ccc)}
:where(.map-jr-dark) :where(.map-jr-ctrl-scale){background:rgba(30,30,30,.75);border-color:var(--map-control-color,#ccc)}
:where(.map-jr-dark) :where(.map-jr-unavailable){color:#aaa;background:#1e1e1e}
/* The look of the main API (the internal class map-jr-glass, which createMap sets): round, translucent and blurred.
   A browser without backdrop-filter or CSS nesting keeps the look above. */
@supports (backdrop-filter:blur(1px)){:where(.map-jr-glass){
--map-jr-o:.55;--map-jr-rgb:255 255 255;--map-jr-prgb:255 255 255;--map-jr-r:calc(var(--map-control-size,32px)/2);--map-jr-fg:rgb(0 0 0/.62);--map-jr-shadow:0 0 0 1px rgb(0 0 0/.1),0 2px 6px rgb(0 0 0/.12),0 6px 18px rgb(0 0 0/.1);--map-jr-drop:drop-shadow(0 0 .5px rgb(0 0 0/.35));
--map-jr-a:var(--map-control-opacity,var(--map-jr-o));--map-jr-rr:var(--map-control-radius,var(--map-jr-r));--map-jr-bg:rgb(var(--map-jr-rgb)/var(--map-jr-a));
--map-jr-popup-bg:rgb(var(--map-jr-prgb)/calc(var(--map-jr-a) + .1));--map-jr-popup-ring:0 0 #0000;--map-jr-popup-radius:calc(var(--map-jr-rr)*.75);
@media (pointer:coarse){--map-jr-r:calc(var(--map-control-size,44px)/2)}
&.map-jr-dark{--map-jr-o:.45;--map-jr-rgb:30 30 34;--map-jr-prgb:43 43 43;--map-jr-fg:rgb(255 255 255/.66);--map-jr-shadow:0 0 0 1px rgb(255 255 255/.14),0 2px 6px rgb(0 0 0/.3),0 6px 18px rgb(0 0 0/.25);--map-jr-drop:drop-shadow(0 0 .5px rgb(255 255 255/.6))}
& :where(.map-jr-ctrl-group,.map-jr-ctrl-attrib,.map-jr-ctrl-scale,.map-jr-popup-content){backdrop-filter:blur(5px)}
& :where(.map-jr-ctrl-group,.map-jr-compact){background:var(--map-control-background,var(--map-jr-bg));box-shadow:var(--map-jr-shadow);border-radius:var(--map-jr-rr)}
& :where(.map-jr-ctrl-group button:first-child){border-radius:var(--map-jr-rr) var(--map-jr-rr) 0 0}
& :where(.map-jr-ctrl-group button:last-child){border-bottom-left-radius:var(--map-jr-rr);border-bottom-right-radius:var(--map-jr-rr)}
& :where(.map-jr-ctrl-attrib:not(.map-jr-compact),.map-jr-ctrl-scale){background:var(--map-attribution-background,var(--map-jr-bg));color:var(--map-control-color,var(--map-jr-fg))}
& :where(.map-jr-ctrl-attrib:not(.map-jr-compact)){border-top-left-radius:calc(var(--map-jr-rr)/2)}
& :where(.map-jr-ctrl-attrib a){text-decoration-color:color-mix(in oklab,currentColor 35%,transparent);&:hover{text-decoration-color:currentColor}}
& :where(.map-jr-compact .map-jr-ctrl-attrib-button){display:grid;place-content:center;top:50%!important;translate:0 -50%;font:0/0 a;&::before{content:"";width:13px;height:13px;background:currentColor;mask:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M10.588 6.413Q10 5.825 10 5t.588-1.412T12 3t1.413.588T14 5t-.587 1.413T12 7t-1.412-.587m.35 14.15q-.438-.438-.438-1.063v-9q0-.625.438-1.062T12 9t1.063.438t.437 1.062v9q0 .625-.437 1.063T12 21t-1.062-.437'/></svg>")}}
& :where(.map-jr-ctrl-attrib.map-jr-compact){max-width:none!important}
& :where(.map-jr-ctrl-scale){display:flex;align-items:center;gap:6px;width:auto!important;border:0;border-radius:calc(var(--map-jr-rr)/2) calc(var(--map-jr-rr)/2) 0 0;margin-bottom:-10px;padding:2px 6px;font-size:11px;line-height:1.4;&::after{content:"";width:var(--map-jr-scale);height:5px;margin-top:3px;border:1.5px solid;border-top:0;box-sizing:border-box}}
&:has(.map-jr-compact) :where(.map-jr-ctrl-scale){margin-bottom:0;border-radius:calc(var(--map-jr-rr)/2)}
& :where(.map-jr-popup-content){box-shadow:none!important;border:0 solid #0000;&[data-side=top]{border-top-width:8px;margin-top:0!important}&[data-side=bottom]{border-bottom-width:8px;margin-bottom:0!important}&[data-side=left]{border-left-width:8px;margin-left:0!important}&[data-side=right]{border-right-width:8px;margin-right:0!important}}
& :where(.map-jr-popup-tip){display:none}
& :where(.map-jr-popup-shadow){position:absolute;pointer-events:none;filter:var(--map-jr-drop) drop-shadow(0 1px 2px rgb(0 0 0/.12)) drop-shadow(0 4px 10px rgb(0 0 0/.16));>*{position:absolute;inset:0;background:#000}}
& :where(.map-jr-popup-content:has(>.map-jr-popup-close-button)){padding-right:38px!important}
& :where(.map-jr-popup-close-button){top:8px!important;right:8px!important;border-radius:50%!important;font-size:0!important;opacity:1!important;-webkit-tap-highlight-color:transparent;background:color-mix(in oklab,currentColor 8%,transparent)!important;
  @media (hover:hover){&:hover{background:color-mix(in oklab,currentColor 16%,transparent)!important}}
  &::before,&::after{content:"";position:absolute;left:6px;top:10.25px;width:10px;height:1.5px;border-radius:1px;background:currentColor;opacity:.8;rotate:45deg}&::after{rotate:-45deg}}
}}
/* Touch screens get finger-sized buttons. Kept last so it overrides the sizes above. */
@media (pointer:coarse){:where(.map-jr-ctrl-group button){width:var(--map-control-size,44px);height:var(--map-control-size,44px)}}
@media (forced-colors:active){:where(.map-jr-ctrl-group,.map-jr-ctrl-attrib,.map-jr-ctrl-scale,.map-jr-popup-content){border:1px solid CanvasText}:where(.map-jr-ctrl button:focus-visible){outline:2px solid Highlight}}
@media (prefers-contrast:more){:where(.map-jr-ctrl-attrib){background:var(--map-attribution-background,#fff);color:var(--map-control-color,#000)}:where(.map-jr-ctrl-group,.map-jr-ctrl-attrib.map-jr-compact){box-shadow:0 0 0 2px #000}}
`;


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
        el.className = cls('ctrl', 'ctrl-attrib');
        inner.className = cls('ctrl-attrib-inner');
        const toggle = Object.assign(document.createElement('button'), {type: 'button', className: cls('ctrl-attrib-button'), textContent: 'i', title: ui(map, 'AttributionControl.ToggleAttribution', 'Map data credits')});
        toggle.setAttribute('aria-label', ui(map, 'AttributionControl.ToggleAttribution', 'Toggle map data credits'));
        toggle.addEventListener('click', () => { toggle.setAttribute('aria-expanded', String(toggleClass(el, 'compact-show'))); this.update(); });
        el.append(toggle, inner);
        let interacted = false;
        const collapse = () => { interacted = true; toggleClass(el, 'compact-show', false); toggle.setAttribute('aria-expanded', 'false'); };
        this.update = () => {
            const html = [...new Set([...map.getAttributions(), ...[this.options.customAttribution ?? []].flat().map(a => a.trim()).filter(Boolean)])].join(' | ');
            inner.replaceChildren();
            sanitizeAttribution(html, inner);
            el.style.display = html ? '' : 'none';
            const compact = this.options.compact ?? map.getContainer().clientWidth <= 640;
            // On small maps the credits start open, as MapLibre shows them, and fold away at the first drag.
            if (compact && !el.classList.contains('map-jr-compact') && !interacted) { toggleClass(el, 'compact-show', true); toggle.setAttribute('aria-expanded', 'true'); }
            toggleClass(el, 'compact', compact);
            // The credits end where the controls of the other corner of the same edge begin: they do not go under them.
            const corner = el.parentElement, c = map.getContainer();
            const other = corner && c.querySelector<HTMLElement>('.' + corner.className.split(' ')[0].replace(/left|right/, side => side === 'left' ? 'right' : 'left'));
            el.style.maxWidth = corner ? c.clientWidth - (other?.firstChild ? other.offsetWidth : 0) - 30 + 'px' : '';
        };
        map.on('styledata', this.update);
        map.on('resize', this.update);
        map.on('idle', this.update); // (controls that were added since)
        // The open credits of a small map close when the user drags the map, as in MapLibre GL JS (a click does not close them).
        const presses = ['drag'];
        for (const type of presses) map.on(type, collapse);
        this.cleanup = () => { map.off('styledata', this.update); map.off('resize', this.update); map.off('idle', this.update); for (const type of presses) map.off(type, collapse); };
        this.update();
        // (The control is in the page after this function returns: its width is set then.)
        queueMicrotask(this.update);
        return el;
    }
    private cleanup = () => {};
    onRemove() { this.cleanup(); this.el?.remove(); }
}
