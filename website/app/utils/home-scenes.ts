// The places that the map of the home page shows (components/home/HomeMap.vue). A scene is the props of `MapJr` that
// the place needs and the camera that the map moves to. The first scene is the one that the server renders as SVG.
export type Camera = {center: [number, number]; zoom: number; bearing?: number; pitch?: number};
export type Scene = {props: Record<string, unknown>; camera: Camera};

export const flatStyle = 'https://styles.map-jr.org/1/elevation-zero.json';
const terrainStyle = 'https://styles.map-jr.org/1/elevation.json';
const globeStyle = 'https://styles.map-jr.org/1/openfreemap-positron.json';

const lucerne: [number, number] = [8.33, 47.03];
const newYork: [number, number] = [-74.0065, 40.7085];

const plain = (camera: Camera, props: Record<string, unknown> = {}): Scene => ({props: {mapStyle: flatStyle, ...props}, camera});

// The scenes of the stops of the scroll that have no choice of their own.
export const stopScenes = {
    hero: plain({center: lucerne, zoom: 10.6}),
    scale: plain({center: [8.3093, 47.0502], zoom: 13.2}),
    compat: plain({center: newYork, zoom: 13.6}),
    limits: plain({center: lucerne, zoom: 8.2}),
    install: plain({center: [10, 48], zoom: 3.6}),
};

// A contour source and two layers for the Alps (the recipe "Show terrain and contours").
const contours = {
    sources: {contours: {type: 'contour', source: 'terrarium', multiplier: 1, thresholds: {9: [200, 1000], 11: [100, 500], 12: [50, 200], 14: [20, 100], 15: [10, 50]}}},
    layers: [
        {id: 'contour-lines', type: 'line', source: 'contours', 'source-layer': 'contours', before: 'water', paint: {'line-color': 'hsla(25, 30%, 35%, 0.55)', 'line-width': ['match', ['get', 'level'], 1, 1.2, 0.5]}},
        {id: 'contour-labels', type: 'symbol', source: 'contours', 'source-layer': 'contours', filter: ['>', ['get', 'level'], 0],
            layout: {'symbol-placement': 'line', 'text-size': 10, 'text-font': ['Noto Sans Bold'], 'text-field': ['concat', ['number-format', ['get', 'ele'], {}], ' m']},
            paint: {'text-color': '#6b5a48', 'text-halo-color': '#fff', 'text-halo-width': 1.5}},
    ],
};

const dot = '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';

// 50,000 points around New York in five colors. The generator is deterministic, so a visit always shows the same points.
function markerData() {
    const colors = ['#d6453d', '#2f7fd1', '#2e9d5b', '#8a4fd3', '#e08a1e'];
    let seed = 7;
    const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const features = Array.from({length: 50000}, (_, index) => {
        const radius = Math.sqrt(random()) * 0.35, angle = random() * 2 * Math.PI;
        return {type: 'Feature', properties: {color: colors[index % 5]}, geometry: {type: 'Point', coordinates: [newYork[0] + radius * Math.cos(angle) * 1.3, newYork[1] + radius * Math.sin(angle)]}};
    });
    return {type: 'FeatureCollection', features};
}
let markers: Scene | undefined;

export type Showcase = {id: string; label: string; caption: string; link: string; linkLabel: string; scene: () => Scene};

// The four places of stop 4. A scene is made when its button is pressed first.
export const showcases: Showcase[] = [
    {id: 'pitch', label: 'Manhattan at pitch 85', caption: 'Lower Manhattan at a pitch of 85 degrees. `maxPitch` is 60 when the description leaves it out, and the description of this map sets it to 85.',
        link: '/play', linkLabel: 'Try it in the playground',
        scene: () => plain({center: [-74.0119, 40.7069], zoom: 16, pitch: 85, bearing: 30}, {maxPitch: 85})},
    {id: 'alps', label: 'The Alps in 3D', caption: 'Terrain, relief shading and labeled contour lines from one elevation source.',
        link: '/recipes/terrain', linkLabel: 'Recipe: Show terrain and contours',
        scene: () => ({props: {mapStyle: terrainStyle, terrain: {source: 'terrarium', exaggeration: 1.5}, ...contours}, camera: {center: [7.6586, 45.9763], zoom: 12.4, pitch: 60, bearing: 25}})},
    {id: 'markers', label: '50,000 markers', caption: 'One symbol layer draws all of the points from a buffer on the GPU. The cost of a frame does not grow with their number.',
        link: '/guide/markers-and-popups#keep-many-markers-fast', linkLabel: 'Guide: many markers',
        scene: () => markers ??= {props: {mapStyle: flatStyle, images: {dot}, data: {places: markerData()},
            layers: [{id: 'dots', type: 'symbol', source: 'places', layout: {'icon-image': 'dot', 'icon-allow-overlap': true, 'icon-ignore-placement': true}}]}, camera: {center: newYork, zoom: 11.4}}},
    {id: 'globe', label: 'The globe', caption: 'The world as a globe. Past zoom 12 the globe turns into the flat map.',
        link: '/guide/globe', linkLabel: 'Guide: the globe',
        scene: () => ({props: {mapStyle: globeStyle, projection: {type: 'globe'}}, camera: {center: [10, 30], zoom: 1.5, pitch: 0, bearing: 0}})},
];

// The description of stop 3 as text. The map follows each change that parses (components/home/HomePlay.vue).
export const playText = `// The map behind this page follows each change.
export default {
  style: '${flatStyle}',
  initialView: {
    center: [-74.0119, 40.7069],
    zoom: 15.2,
    pitch: 50,
    bearing: 30,
  },
};
`;
/**
 * The scene of the code of stop 3. The code is the visitor's own text of the editor and runs in this page, so it
 * reads only what the map takes: a throw or a field that is not a description gives the message of the error.
 */
export function playScene(code: string): Scene {
    const body = code.replace(/^\s*import[^\n]*\n/gm, '').replace(/^[\s\S]*?\bexport\s+default\s*/, 'return ');
    const description = new Function(body)() as Record<string, any> | undefined;
    if (!description || typeof description !== 'object') throw new Error('The code must end with `export default {…}`, the description of the map.');
    const {style, initialView, ...rest} = description;
    const allowed = ['terrain', 'projection', 'maxPitch', 'minZoom', 'maxZoom', 'sources', 'layers', 'data', 'images', 'sprite', 'globalState'];
    const props: Record<string, unknown> = {mapStyle: style ?? flatStyle};
    for (const key of allowed) if (key in rest) props[key] = rest[key];
    if (!initialView || !Array.isArray(initialView.center) || typeof initialView.zoom !== 'number') throw new Error('The description needs `initialView: {center: [lng, lat], zoom}`.');
    return {props, camera: {center: initialView.center, zoom: initialView.zoom, bearing: initialView.bearing ?? 0, pitch: initialView.pitch ?? 0}};
}
