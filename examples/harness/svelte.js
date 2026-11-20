// What a Svelte form gets as `@map-jr/map-jr-gl/svelte` when the harness (mount.js) or a test (test/loading.mjs) runs
// it: the action of the entry, which also puts each map that it makes into `made`. A Svelte form keeps its map in its
// own state, so this is how the harness gets the map to return. Only imports from a .svelte file are sent here, so the
// import below is the entry itself.
import {mapJr as action, mapState} from '@map-jr/map-jr-gl/svelte';

/** The maps that the action has made, in order. */
export const made = [];

export function mapJr(node, options) {
    return action(node, {...options, ready: map => { made.push(map); options.ready?.(map); }});
}
export {mapState};
