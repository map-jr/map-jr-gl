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
:where(.map-jr-ctrl-top-left,.map-jr-ctrl-top-right,.map-jr-ctrl-bottom-left,.map-jr-ctrl-bottom-right){position:absolute;z-index:2;pointer-events:none;display:flex;flex-direction:column;gap:10px;max-width:100%;box-sizing:border-box}
:where(.map-jr-ctrl-top-left){top:0;left:0;align-items:flex-start;padding:10px 10px 10px max(10px,env(safe-area-inset-left))}
:where(.map-jr-ctrl-top-right){top:0;right:0;align-items:flex-end;padding:10px max(10px,env(safe-area-inset-right)) 10px 10px}
:where(.map-jr-ctrl-bottom-left){bottom:0;left:0;align-items:flex-start;flex-direction:column-reverse;padding:10px 10px 10px max(10px,env(safe-area-inset-left))}
:where(.map-jr-ctrl-bottom-right){bottom:0;right:0;align-items:flex-end;flex-direction:column-reverse;padding:10px 0 0 10px}
:where(.map-jr-fills) :where(.map-jr-ctrl-top-left,.map-jr-ctrl-top-right){padding-top:max(10px,env(safe-area-inset-top))}
:where(.map-jr-fills) :where(.map-jr-ctrl-bottom-left){padding-bottom:max(10px,env(safe-area-inset-bottom))}
:where(.map-jr-fills) :where(.map-jr-ctrl-bottom-right){padding-bottom:env(safe-area-inset-bottom)}
:where(.map-jr-ctrl-bottom-right>.map-jr-ctrl:not(.map-jr-ctrl-attrib)){margin-right:max(10px,env(safe-area-inset-right))}
:where(.map-jr-ctrl-attrib){background:var(--map-attribution-background,rgba(255,255,255,.75));color:var(--map-control-color,#333);font-size:11px;line-height:1.4;padding:2px 6px;padding-right:max(6px,env(safe-area-inset-right));border-top-left-radius:4px;overflow-wrap:anywhere}
:where(.map-jr-ctrl-attrib a){color:inherit}
:where(.map-jr-ctrl-attrib.map-jr-compact){display:flex;flex-direction:row-reverse;align-items:center;padding:0;margin:0 max(10px,env(safe-area-inset-right)) 10px 0;border-radius:14px;background:var(--map-control-background,#fff);box-shadow:0 0 0 1.5px rgba(0,0,0,.12)}
:where(.map-jr-ctrl-attrib.map-jr-compact .map-jr-ctrl-attrib-inner){display:none;padding:2px 4px 2px 10px}
:where(.map-jr-ctrl-attrib.map-jr-compact.map-jr-compact-show .map-jr-ctrl-attrib-inner){display:block}
:where(.map-jr-ctrl-attrib-button){display:none;flex:none;width:28px;height:28px;border:0;border-radius:14px;background:none;color:inherit;font:italic 700 14px/28px Georgia,serif;cursor:pointer;padding:0}
:where(.map-jr-compact .map-jr-ctrl-attrib-button){display:block}
@media (pointer:coarse){:where(.map-jr-compact .map-jr-ctrl-attrib-button){width:36px;height:36px;border-radius:18px;line-height:36px}:where(.map-jr-ctrl-attrib.map-jr-compact){border-radius:18px}}
:where(.map-jr-ctrl){pointer-events:auto;font:12px/1.3 system-ui,sans-serif;color:var(--map-control-color,#222)}
:where(.map-jr-ctrl-group){background:var(--map-control-background,#fff);border-radius:var(--map-control-radius,6px);box-shadow:0 0 0 1.5px rgba(0,0,0,.12),0 1px 4px rgba(0,0,0,.15);overflow:hidden}
:where(.map-jr-ctrl-group button){display:flex;align-items:center;justify-content:center;width:var(--map-control-size,32px);height:var(--map-control-size,32px);padding:0;border:0;background:none;color:inherit;cursor:pointer}
:where(.map-jr-ctrl-group button+button){border-top:1px solid rgba(0,0,0,.1)}
:where(.map-jr-ctrl-group button:hover){background:rgba(0,0,0,.06)}
:where(.map-jr-ctrl-group button:disabled){opacity:.35;cursor:default}
:where(.map-jr-ctrl-group button:focus-visible){outline:2px solid var(--map-control-focus,#2f7fd1);outline-offset:-2px}
:where(.map-jr-ctrl-scale){background:rgba(255,255,255,.75);border:1.5px solid var(--map-control-color,#333);border-top:0;padding:0 5px;font-size:10px;box-sizing:border-box;white-space:nowrap}
/* Touch screens get finger-sized buttons. Kept last so it overrides the sizes above. */
@media (pointer:coarse){:where(.map-jr-ctrl-group button){width:var(--map-control-size,44px);height:var(--map-control-size,44px)}}
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
        const toggle = Object.assign(document.createElement('button'), {type: 'button', className: cls('ctrl-attrib-button'), textContent: 'i', title: 'Map data credits'});
        toggle.setAttribute('aria-label', 'Toggle map data credits');
        toggle.addEventListener('click', () => { toggle.setAttribute('aria-expanded', String(toggleClass(el, 'compact-show'))); this.update(); });
        el.append(toggle, inner);
        let interacted = false;
        const collapse = () => { interacted = true; toggleClass(el, 'compact-show', false); toggle.setAttribute('aria-expanded', 'false'); };
        this.update = () => {
            const html = [...new Set([...map.getAttributions(), ...[this.options.customAttribution ?? []].flat()])].join(' | ');
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
            el.style.maxWidth = corner ? c.clientWidth - (other?.offsetWidth ?? 0) - 30 + 'px' : '';
        };
        map.on('styledata', this.update);
        map.on('resize', this.update);
        map.on('idle', this.update); // (controls that were added since)
        // The open credits of a small map close when the user touches the map: a press, a tap or the start of a drag.
        const presses = ['dragstart', 'mousedown', 'touchstart'];
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
