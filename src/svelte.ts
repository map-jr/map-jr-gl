/**
 * For Svelte: `import {mapJr, mapState} from 'map-jr-gl/svelte'`.
 *
 * ```svelte
 * <script>
 *   import {mapJr, mapState} from 'map-jr-gl/svelte';
 *   let map = $state(null);
 *   let description = $derived({style, initialView, markers: [pins]});
 * </script>
 * <div use:mapJr={{description, ready: host => map = host}} style="height: 400px"></div>
 * ```
 * `mapJr` is an action: Svelte calls it with the element, calls `update` when the description is another object, and
 * `destroy` when the element goes. It does not need the Svelte package, so it works with each version of Svelte.
 * `mapState(map)` gives the state of the map as a Svelte store (`const live = mapState(map)`, then `$live.view.zoom`).
 */
import {createMap, type MapHost, type MapSpec, type MapState} from './host.ts';

export interface MapAction { description: MapSpec; /** Called with the map when it has been made. */ ready?: (map: MapHost) => void }

export function mapJr(node: HTMLElement, options: MapAction) {
    const map = createMap(node, options.description);
    options.ready?.(map);
    return {
        update(next: MapAction) { map.update(next.description); },
        destroy() { map.destroy(); },
    };
}

/** The state of a map as a store of Svelte: `subscribe` calls the function at once with the state, and after each change. */
export function mapState(map: MapHost) {
    return {subscribe(fn: (state: MapState) => void) { fn(map.state.get()); return map.state.subscribe(fn); }};
}
export type {MapHost, MapSpec, MapState};
