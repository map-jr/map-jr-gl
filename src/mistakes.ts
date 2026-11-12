/**
 * The messages for mistakes in a description (`MapSpec`) or in a query of the main API. `src/host.ts` finds a mistake
 * and loads this file on demand, so a page with no mistake does not download the texts.
 */
const texts: ((a: string, b: string) => string)[] = [
    /* 0 */ () => 'createMap(): the container has height 0, so the map shows nothing. Give the container a height in CSS.',
    /* 1 */ a => `interactiveLayers: the style has no layer "${a}". Write the id of a layer of the style or of "extend".`,
    /* 2 */ a => `data: the style has no GeoJSON source "${a}". Add "${a}": {type: 'geojson', data: {type: 'FeatureCollection', features: []}} to the sources of the style or of "extend".`,
    /* 3 */ a => `queryFeatures(): the style has no layer "${a}". In "layers", write the id of a layer of the style or of "extend".`,
    /* 4 */ a => `queryFeatures(): the style has no source "${a}". In "sources", write the id of a source of the style or of "extend".`,
    /* 5 */ (a, b) => `extend: the layer "${a}" has before: "${b}", but the style has no layer "${b}", so the layer goes on top. Write the id of a layer of the style.`,
    /* 6 */ (a, b) => `extend: the layer "${a}" uses the source "${b}", which the style does not have. Add "${b}" to "sources" of "extend".`,
    /* 7 */ a => `markers: two marker layers have the id "${a}". Give each marker layer its own id.`,
    /* 8 */ a => `update(): "${a}" changed, but it is read only when the map is made. ${a === 'initialView' ? 'To move the map, change "view" or call moveTo().' : 'To change it, destroy the map and make a new one.'}`,
    /* 9 */ a => `queryFeatures(): ${a} is not a place. Write a point of the screen {x, y}, a position [lng, lat], or a rectangle [{x, y}, {x, y}].`,
    /* 10 */ a => `queryFeatures(): "${a}" has an effect only in a query with "sources". This query ignores it.`,
    /* 11 */ a => `queryFeatures(): "${a}" has an effect only in a query with "sources" at a point or a position. This query ignores it.`,
    /* 12 */ () => 'queryFeatures(): "layers" has no effect in a query with "sources". Remove "layers", or remove "sources" to ask for what the style layers draw.',
];

/** The message with the number `code` for the names `a` and `b`. */
export const mistake = (code: number, a = '', b = '') => '[map-jr-gl] ' + texts[code](a, b);
