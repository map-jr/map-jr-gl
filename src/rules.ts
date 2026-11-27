// What the page and the engine must agree on: which changes of a style need new tiles.
const DATA_OPS = /"(get|has|id|properties|geometry-type|feature-state|global-state|property|line-progress|accumulated)"/;
/**
 * What of a style layer the tiles of its source are built from. A change to another part (a paint value that is the
 * same for the whole layer) needs no new tiles: it is applied when the map is drawn.
 */
export function layerRules(l: any, keep: boolean = l.keep): unknown[] {
    // (A symbol layer and a fill-extrusion layer draw these values at the zoom of the map, so that they transition (#972).
    // Whether an icon has a halo decides how the tile holds the icon.)
    const paint = Object.entries(l.paint ?? {}).flatMap(([k, v]) =>
        k === 'fill-antialias' || k.endsWith('-pattern') || DATA_OPS.test(JSON.stringify(v)) ? [[k, v]]
            : /^icon-halo-(width|color)$/.test(k) ? [[k, !!v]] : []);
    // A layer that the page hides and shows is built also while it is hidden: to hide or show it needs no new tiles.
    return [l.id, l.type, l['source-layer'], l.filter, l.minzoom, l.maxzoom, keep ? {...l.layout, visibility: 0} : l.layout, paint, l.metadata, keep];
}
