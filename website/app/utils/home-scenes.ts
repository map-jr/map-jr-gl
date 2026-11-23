// What the map of the home page shows (components/home/HomeMap.vue). The panel beside the map (components/home/HomeDemo.vue)
// has six demos. Each demo has its own choices, a camera, the props of `MapJr` that the choices give, and the description
// of the main API (`@map-jr/map-jr-gl`) that makes the same map, as text. The first view of the page is the demo "styles"
// with its first choices: scripts/first-paint.mjs renders that view as the SVG of the first paint.
export type Camera = {center: [number, number]; zoom: number; bearing?: number; pitch?: number};
/** A click on the map and the view of the map, as components/home/HomeMap.vue reports them. */
export type HomeClick = {point: {x: number; y: number}; lngLat: [number, number]};
export type HomeView = {center: [number, number]; zoom: number; bearing: number; pitch: number};
export type DemoId = 'styles' | 'markers' | 'terrain' | 'camera' | 'query' | 'worker';

const base = 'https://styles.map-jr.org/1/';
export const flatStyle = base + 'elevation-zero.json';
const terrainStyle = base + 'elevation.json';

export const styleChoices = [
    {id: 'elevation-zero', label: 'Elevation · zero'},
    {id: 'elevation', label: 'Elevation'},
    {id: 'elevation-radar', label: 'Elevation · radar'},
] as const;
// The language codes are those of the names in the tiles (the global state `language` of the elevation styles).
export const languageChoices = [
    {id: '', label: 'Local'},
    {id: 'en', label: 'English'},
    {id: 'ja', label: '日本語'},
] as const;
export const countChoices = [1000, 10000, 100000] as const;
export const shapeChoices = [
    {id: 'pin', label: 'Pin', size: 0.6, anchor: 'bottom',
        svg: '<svg viewBox="0 0 24 31"><path fill="{{color}}" stroke="#fff" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>'},
    {id: 'dot', label: 'Dot', size: 1, anchor: 'center',
        svg: '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>'},
    {id: 'diamond', label: 'Diamond', size: 1, anchor: 'center',
        svg: '<svg viewBox="0 0 14 14"><path fill="{{color}}" stroke="#fff" stroke-width="1.5" d="M7 1.2 12.8 7 7 12.8 1.2 7z"/></svg>'},
] as const;
// Each palette has a color for each of the five kinds of point.
export const paletteChoices = [
    {id: 'signs', label: 'Five colors', colors: ['#d6453d', '#2f7fd1', '#2e9d5b', '#8a4fd3', '#e08a1e']},
    {id: 'survey', label: 'One hue', colors: ['#f5ab87', '#ee8a5c', '#d95f30', '#b4441c', '#752f18']},
] as const;
export const exaggerationChoices = [1, 1.5, 2] as const;

export interface DemoState {
    style: typeof styleChoices[number]['id'];
    language: string;
    globe: boolean;
    count: number;
    shape: typeof shapeChoices[number]['id'];
    palette: typeof paletteChoices[number]['id'];
    /** The size of a marker, as a factor of the size of its template. */
    markerSize: number;
    /** The markers that the visitor added with a click, as positions. */
    added: [number, number][];
    terrain: boolean;
    contours: boolean;
    exaggeration: number;
    unit: 'm' | 'ft';
    /** The position of the last click of the demo "query". */
    picked: [number, number] | null;
}
export const firstState = (): DemoState => ({style: 'elevation-zero', language: '', globe: false, count: 10000, shape: 'pin', palette: 'signs', markerSize: 1, added: [], terrain: true, contours: true, exaggeration: 1.5, unit: 'm', picked: null});

const lucerne: [number, number] = [8.33, 47.03];
const newYork: [number, number] = [-74.0065, 40.7085];
// The first view of the page. scripts/first-paint.mjs has the same centre and zoom.
export const firstCamera: Camera = {center: lucerne, zoom: 10.6};
const cameras = {
    globe: {center: [10, 30], zoom: 1.5},
    markers: {center: newYork, zoom: 11.4},
    terrain: {center: [7.6586, 45.9763], zoom: 12.4, pitch: 60, bearing: 25},
    camera: {center: [-74.0119, 40.7069], zoom: 15.2, pitch: 50, bearing: 30},
    query: {center: [8.3093, 47.0502], zoom: 12.6},
    worker: {center: [-74.0119, 40.7069], zoom: 15.2, pitch: 50, bearing: 30},
} satisfies Record<string, Camera>;
// The places of the demo "camera".
export const placeChoices: {label: string; camera: Camera}[] = [
    {label: 'New York', camera: cameras.camera},
    {label: 'Tokyo', camera: {center: [139.7671, 35.6812], zoom: 14.5, pitch: 55, bearing: -20}},
    {label: 'Rio de Janeiro', camera: {center: [-43.1729, -22.9519], zoom: 13.2, pitch: 60, bearing: 150}},
    {label: 'Lucerne', camera: {center: [8.3093, 47.0502], zoom: 13.2, pitch: 0, bearing: 0}},
];

/** The camera of a demo. The same object comes back while the choices that move the camera stay as they are. */
export function demoCamera(id: DemoId, state: DemoState): Camera {
    if (id === 'styles') return state.globe ? cameras.globe : firstCamera;
    return cameras[id];
}

// Points around New York, each of one of five kinds. The generator is deterministic, so a visit always shows the same
// points, and the points of a count are made once.
const pointSets = new Map<number, unknown>();
function markerData(count: number) {
    let data = pointSets.get(count);
    if (data) return data;
    let seed = 7;
    const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const features = Array.from({length: count}, (_, index) => {
        const radius = Math.sqrt(random()) * 0.35, angle = random() * 2 * Math.PI;
        return {type: 'Feature', properties: {kind: index % 5}, geometry: {type: 'Point', coordinates: [newYork[0] + radius * Math.cos(angle) * 1.3, newYork[1] + radius * Math.sin(angle)]}};
    });
    pointSets.set(count, data = {type: 'FeatureCollection', features});
    return data;
}
const pointsOf = (positions: [number, number][]) => ({type: 'FeatureCollection', features: positions.map(coordinates => ({type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates}}))});
// The mark of the last click of the demo "query": a ring in the survey color.
const pickSvg = '<svg viewBox="0 0 22 22"><circle cx="11" cy="11" r="8" fill="none" stroke="#fff" stroke-width="5"/><circle cx="11" cy="11" r="8" fill="none" stroke="#b4441c" stroke-width="2.5"/><circle cx="11" cy="11" r="2" fill="#b4441c"/></svg>';
const colorOfKind = (colors: readonly string[]) => ['match', ['get', 'kind'], 0, colors[0], 1, colors[1], 2, colors[2], 3, colors[3], colors[4]];

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

/** The props of `MapJr` for a demo. A prop that a demo does not name is not set. */
export function demoProps(id: DemoId, state: DemoState): Record<string, unknown> {
    if (id === 'styles') {
        return {
            mapStyle: `${base}${state.style}.json`,
            ...(state.language ? {globalState: {language: state.language}} : {}),
            ...(state.globe ? {projection: {type: 'globe'}} : {}),
        };
    }
    if (id === 'markers') {
        const shape = shapeChoices.find(choice => choice.id === state.shape)!;
        const palette = paletteChoices.find(choice => choice.id === state.palette)!;
        const layout = {'icon-anchor': shape.anchor, 'icon-allow-overlap': true, 'icon-ignore-placement': true};
        return {
            mapStyle: flatStyle,
            images: {marker: shape.svg},
            data: {places: markerData(state.count), yours: pointsOf(state.added)},
            layers: [
                {id: 'places', type: 'symbol', source: 'places', layout: {...layout, 'icon-image': ['image', 'marker', {params: {color: colorOfKind(palette.colors)}}], 'icon-size': shape.size * state.markerSize}},
                // The markers of the visitor: the same template in one color, twice the size.
                {id: 'yours', type: 'symbol', source: 'yours', layout: {...layout, 'icon-image': ['image', 'marker', {params: {color: '#1d1d1f'}}], 'icon-size': shape.size * state.markerSize * 2}},
            ],
        };
    }
    if (id === 'terrain') {
        return {
            mapStyle: terrainStyle,
            globalState: {'elevation-unit': state.unit},
            ...(state.terrain ? {terrain: {source: 'terrarium', exaggeration: state.exaggeration}} : {}),
            ...(state.contours ? contours : {}),
        };
    }
    if (id === 'camera') return {mapStyle: flatStyle, maxPitch: 85};
    if (id === 'query') {
        return {
            mapStyle: terrainStyle,
            globalState: {'elevation-unit': 'm'},
            images: {pick: pickSvg},
            data: {picked: pointsOf(state.picked ? [state.picked] : [])},
            layers: [{id: 'picked', type: 'symbol', source: 'picked', layout: {'icon-image': 'pick', 'icon-allow-overlap': true, 'icon-ignore-placement': true}}],
        };
    }
    return {mapStyle: flatStyle};
}

/**
 * The description of `@map-jr/map-jr-gl` that makes the map of a demo, as lines of code. `scheme` is the color scheme
 * that the map draws. Long values are shortened to a comment, so the text is a sketch and not a program.
 */
export function demoCode(id: DemoId, state: DemoState, scheme: 'light' | 'dark'): string[] {
    const camera = demoCamera(id, state);
    const view = [`center: [${camera.center.join(', ')}]`, `zoom: ${camera.zoom}`, camera.pitch ? `pitch: ${camera.pitch}` : '', camera.bearing ? `bearing: ${camera.bearing}` : ''].filter(Boolean).join(', ');
    const lines = ["createMap('map', {"];
    const add = (line: string) => lines.push('  ' + line);
    if (id === 'styles') {
        add(`style: '${base}${state.style}.json',`);
        add(`initialView: {${view}},`);
        add(`colorScheme: '${scheme}',`);
        if (state.language) add(`globalState: {language: '${state.language}'},`);
        if (state.globe) add("projection: {type: 'globe'},");
    } else if (id === 'markers') {
        const shape = shapeChoices.find(choice => choice.id === state.shape)!;
        const palette = paletteChoices.find(choice => choice.id === state.palette)!;
        add(`style: '${flatStyle}',`);
        add(`initialView: {${view}},`);
        add(`images: {marker: '<svg…><${shape.id === 'dot' ? 'circle' : 'path'} fill="{{color}}" …/></svg>'},`);
        add(`data: {places${state.added.length ? ', yours' : ''}},  // ${state.count.toLocaleString('en')} points${state.added.length ? ` and ${state.added.length} of yours` : ''}`);
        add('layers: [{');
        add("  id: 'places', type: 'symbol', source: 'places',");
        add('  layout: {');
        add("    'icon-image': ['image', 'marker', {params: {color:");
        add(`      ['match', ['get', 'kind'], 0, '${palette.colors[0]}', 1, '${palette.colors[1]}', …]}}],`);
        if (state.markerSize !== 1) add(`    'icon-size': ${+(shape.size * state.markerSize).toFixed(2)},`);
        add("    'icon-allow-overlap': true,");
        add('  },');
        add('}],');
    } else if (id === 'terrain') {
        add(`style: '${terrainStyle}',`);
        add(`initialView: {${view}},`);
        add(`globalState: {'elevation-unit': '${state.unit}'},`);
        if (state.terrain) add(`terrain: {source: 'terrarium', exaggeration: ${state.exaggeration}},`);
        if (state.contours) {
            add("sources: {contours: {type: 'contour', source: 'terrarium', …}},");
            add("layers: [{id: 'contour-lines', type: 'line', source: 'contours', …}],");
        }
    } else if (id === 'camera') {
        lines[0] = "const map = createMap('map', {";
        add(`style: '${flatStyle}',`);
        add(`initialView: {${view}},`);
        add('maxPitch: 85,');
        lines.push('});', '', '// A slider sets one value of the view, and a place is a flight.', 'map.moveTo({pitch: 70});', 'map.moveTo({center: [139.7671, 35.6812], zoom: 14.5, fly: true});', '', '// The state of the map is a store.', 'map.state.subscribe(state => state.view, view => show(view));');
        return lines;
    } else if (id === 'query') {
        lines[0] = "const map = createMap('map', {";
        add(`style: '${terrainStyle}',`);
        add(`initialView: {${view}},`);
        add('onClick: async ({point, lngLat}) => {');
        add('  const features = await map.queryFeatures(point);');
        add('  const height = await map.queryElevation(lngLat);');
        add('  show(features, height);');
        add('},');
    } else {
        add(`style: '${flatStyle}',`);
        add(`initialView: {${view}},`);
        add("renderer: 'auto',  // the default: a worker when the browser can draw there");
    }
    lines.push('});');
    return lines;
}
