// The control for the colour scheme (`colorScheme()` of `@map-jr/map-jr-gl/controls`). It is a file of its own, which
// loads only when a map adds the control: the compat entry, which loads controls-more.ts up front, does not get it.
import type {Map} from './map.ts';
import type {MapInstance} from './host.ts';
import {ui, type Control} from './controls.ts';
import {button, group, svg} from './controls-more.ts';

/**
 * A button that switches the colour scheme of a map of the main API between light and dark (#541). It
 * shows the scheme that the map has: a sun for light and a moon for dark. A click changes `colorScheme` of the
 * description with `patch` and calls `onColorSchemeChange` of the description, so that an application with a
 * framework can keep the value. When the description follows the system (`'auto'`), a click sets the opposite of
 * the system, and a later click that lands on the scheme of the system sets `'auto'` again. Otherwise a click
 * flips between `'light'` and `'dark'`.
 */
export class ColorSchemeControl implements Control {
    private el?: HTMLElement;
    private stop?: () => void;
    /** The description has had `'auto'`: a click that lands on the scheme of the system goes back to `'auto'`. */
    private followed = false;
    constructor(private instance?: () => MapInstance) {}
    onAdd(map: Map) {
        const el = this.el = group(), instance = this.instance?.();
        const b = button(el, 'color-scheme', '', '', () => {
            if (!instance) return;
            if (instance.description.colorScheme === 'auto') this.followed = true;
            const toDark = instance.state.get().colorScheme !== 'dark', system = !!globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches;
            const to = this.followed && toDark === system ? 'auto' : toDark ? 'dark' : 'light';
            instance.patch({colorScheme: to});
            instance.description.onColorSchemeChange?.(to);
        });
        const show = (scheme: 'light' | 'dark') => {
            const label = scheme === 'dark' ? ui(map, 'ColorSchemeControl.Light', 'Use light colours') : ui(map, 'ColorSchemeControl.Dark', 'Use dark colours');
            b.title = label;
            b.setAttribute('aria-label', label);
            b.firstElementChild!.innerHTML = scheme === 'dark'
                ? svg('<path d="M15 10.800A6.300 6.300 0 1 1 7.200 3a5 5 0 0 0 7.800 7.800z"/>')
                : svg('<circle cx="9" cy="9" r="3.200"/><path d="M9 1.800v1.200M9 15v1.200M1.800 9H3M15 9h1.200M3.900 3.900l.850.850M13.250 13.250l.850.850M3.900 14.100l.850-.850M13.250 4.750l.850-.850"/>');
        };
        if (instance) { show(instance.state.get().colorScheme); this.stop = instance.state.subscribe(s => s.colorScheme, show); }
        else console.warn('[map-jr-gl] colorScheme(): the control works only in the controls of a map of the main API (createMap).');
        return el;
    }
    onRemove() { this.stop?.(); this.el?.remove(); }
}
