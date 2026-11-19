/**
 * For Svelte: `import {mapJr, mapState} from '@map-jr/map-jr-gl/svelte'`.
 *
 * ```svelte
 * <script>
 *   import {mapJr, mapState} from '@map-jr/map-jr-gl/svelte';
 *   let map = $state(null);
 *   let description = $derived({style, initialView, data: {places}, layers: [placesLayer]});
 * </script>
 * <div use:mapJr={{description, ready: instance => map = instance}} style="height: 400px"></div>
 * ```
 * `mapJr` is an action: Svelte calls it with the element, calls `update` when the description is another object, and
 * `destroy` when the element goes. It does not need the Svelte package, so it works with each version of Svelte.
 * `mapState(map)` gives the state of the map as a Svelte store (`const live = mapState(map)`, then `$live.view.zoom`).
 */
import {makeMap, type MapInstance, type MapDescription, type MapState} from './host.ts';

/** The options of the action `mapJr`. */
export interface MapAction {
    /** The description of the map. A new object applies it with `update`. */
    description: MapDescription;
    /** Called with the map once it is created. */
    ready?: (map: MapInstance) => void;
}

/**
 * A Svelte action that creates a map in the element, applies each new `description`, and destroys the map with the element.
 * @returns The object with `update` and `destroy` that Svelte calls.
 */
export function mapJr(node: HTMLElement, options: MapAction) {
    const map = makeMap(node, options.description, 'use:mapJr');
    options.ready?.(map);
    return {
        update(next: MapAction) { map.update(next.description); },
        destroy() { map.destroy(); },
    };
}

/**
 * Returns the state of a map as a Svelte store: `subscribe` calls the function at once with the state, and after each change.
 * @returns A readable store of `MapState`.
 */
export function mapState(map: MapInstance) {
    return {subscribe(fn: (state: MapState) => void) { fn(map.state.get()); return map.state.subscribe(fn); }};
}
export type {MapInstance, MapDescription, MapState};
