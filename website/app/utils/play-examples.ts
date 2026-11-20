// The starting examples of /play (pages/play.vue). Each `code` is a module whose default export is a description
// (`MapDescription`) of the Main API, and each one runs as it is in the map frame. The menu shows them in groups.
export type PlayExample = {label: string; icon: string; code: string};

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const controls = `import {navigation, scale} from '@map-jr/map-jr-gl/controls';`;

// The landings of the ferries of the recipes "Highlight a feature under the pointer" and "Fit the map to data".
const landings = `const landings = [
  {id: 1, name: 'Whitehall Terminal', lngLat: [-74.0131, 40.7013]},
  {id: 2, name: 'Pier 11 / Wall St', lngLat: [-74.0067, 40.7034]},
  {id: 3, name: 'Battery Park City', lngLat: [-74.0181, 40.7147]},
  {id: 4, name: 'Dumbo', lngLat: [-73.9946, 40.7036]},
  {id: 5, name: 'Governors Island', lngLat: [-74.0189, 40.6928]},
  {id: 6, name: 'Corlears Hook', lngLat: [-73.9785, 40.7116]},
  {id: 7, name: 'Brooklyn Bridge Park Pier 6', lngLat: [-73.9997, 40.693]},
];`;

export const playGroups: {label: string; examples: PlayExample[]}[] = [
    {label: 'View', examples: [
        {label: 'New York', icon: 'i-lucide-map', code: `${controls}

// The description of the map (MapDescription). The map changes when you change it.
export default {
  style: '${style}',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
  controls: [navigation(), scale({position: 'bottom-left'})],
  attribution: {compact: true},
};
`},
        {label: 'Pitch 85', icon: 'i-lucide-mountain-snow', code: `${controls}

// Lower Manhattan at pitch 85. maxPitch is 60 when the description leaves it out.
export default {
  style: '${style}',
  initialView: {center: [-74.0119, 40.7069], zoom: 16, pitch: 85, bearing: 30},
  maxPitch: 85,
  controls: [navigation({visualizePitch: true}), scale({position: 'bottom-left'})],
  attribution: {compact: true},
};
`},
        {label: 'Fit a box', icon: 'i-lucide-scan', code: `${controls}

// A box in place of center and zoom: the map fits Iceland into the view, with 24 pixels around it. The zoom
// follows the size of the map, so the same code fits on a phone and on a wide screen.
export default {
  style: '${style}',
  initialView: {bounds: [-24.6, 63.3, -13.4, 66.6], fitPadding: 24},
  controls: [navigation(), scale({position: 'bottom-left'})],
  attribution: {compact: true},
};
`},
        {label: 'Limits of the camera', icon: 'i-lucide-lock', code: `${controls}

// The camera stays on Manhattan between zoom 11 and 16. On a page that scrolls, cooperativeGestures asks for Ctrl
// (⌘ on a Mac) and the wheel to zoom, and for two fingers to move the map.
export default {
  style: '${style}',
  initialView: {center: [-73.97, 40.78], zoom: 11.5},
  minZoom: 11,
  maxZoom: 16,
  maxBounds: [[-74.3, 40.5], [-73.65, 40.95]],
  cooperativeGestures: true,
  controls: [navigation(), scale({position: 'bottom-left'})],
  attribution: {compact: true},
};
`},
    ]},
    {label: '3D', examples: [
        {label: 'Terrain', icon: 'i-lucide-mountain', code: `${controls}

// The Matterhorn in 3D. The style has the elevation source "terrarium".
export default {
  style: 'https://styles.map-jr.org/1/elevation.json',
  terrain: {source: 'terrarium', exaggeration: 1.5},
  initialView: {center: [7.6586, 45.9763], zoom: 12.4, pitch: 60, bearing: 25},
  controls: [navigation({visualizePitch: true}), scale({position: 'bottom-left'})],
  attribution: {compact: true},
};
`},
        {label: 'Globe', icon: 'i-lucide-globe', code: `import {navigation, globe} from '@map-jr/map-jr-gl/controls';

// The world as a globe. Past zoom 12 the globe turns into the flat map. The map warns about a style with 3D buildings
// (fill-extrusion), because the globe does not draw them, so this example takes a style that has none.
export default {
  style: 'https://styles.map-jr.org/1/openfreemap-positron.json',
  projection: {type: 'globe'},
  initialView: {center: [10, 30], zoom: 1.5},
  controls: [navigation(), globe()],
  attribution: {compact: true},
};
`},
    ]},
    {label: 'Data and layers', examples: [
        {label: 'GeoJSON layers', icon: 'i-lucide-route', code: `${controls}

// A key of \`data\` makes a GeoJSON source with that id, and each entry of \`layers\` draws a source on top of the
// layers of the style: an area (fill), a route (line) and three stops (circle).
const area = {
  type: 'Feature',
  properties: {},
  geometry: {type: 'Polygon', coordinates: [[[-74.0235, 40.6905], [-74.0135, 40.6905], [-74.0135, 40.6985], [-74.0235, 40.6985], [-74.0235, 40.6905]]]},
};
const route = {
  type: 'Feature',
  properties: {},
  geometry: {type: 'LineString', coordinates: [[-74.0131, 40.7013], [-74.0067, 40.7034], [-73.9946, 40.7036]]},
};
const stops = {
  type: 'FeatureCollection',
  features: route.geometry.coordinates.map(coordinates => ({type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates}})),
};

export default {
  style: '${style}',
  initialView: {center: [-74.0075, 40.7], zoom: 13.4},
  data: {area, route, stops},
  layers: [
    {id: 'area', type: 'fill', source: 'area', paint: {'fill-color': '#2e9d5b', 'fill-opacity': 0.35}},
    {id: 'route', type: 'line', source: 'route', layout: {'line-cap': 'round', 'line-join': 'round'}, paint: {'line-color': '#d6453d', 'line-width': 4}},
    {id: 'stops', type: 'circle', source: 'stops', paint: {'circle-radius': 6, 'circle-color': '#fff', 'circle-stroke-color': '#d6453d', 'circle-stroke-width': 3}},
  ],
  controls: [navigation(), scale({position: 'bottom-left'})],
  attribution: {compact: true},
};
`},
        {label: 'Markers', icon: 'i-lucide-map-pin', code: `import {points} from '@map-jr/map-jr-gl';
${controls}

// A marker is a symbol layer with an image, so a map with thousands of markers stays fast. An image is an SVG
// template: each point fills the {{color}} slot from its properties.
const pin = '<svg viewBox="0 0 24 31"><path d="M12 30C12 30 2 19 2 11.5a10 10 0 1 1 20 0C22 19 12 30 12 30z" fill="{{color}}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="11.5" r="4" fill="#fff"/></svg>';
const places = [
  {lngLat: [-74.0445, 40.6892], color: '#2e9d5b'},
  {lngLat: [-73.9857, 40.7484], color: '#d6453d'},
  {lngLat: [-73.9688, 40.7851], color: '#2f7fd1'},
  {lngLat: [-73.9969, 40.7061], color: '#8a4fd3'},
  {lngLat: [-73.9772, 40.7527], color: '#e08a1e'},
];

export default {
  style: '${style}',
  initialView: {center: [-73.995, 40.74], zoom: 10.8},
  images: {pin},
  data: {places: points(places, {lngLat: place => place.lngLat, properties: place => ({color: place.color})})},
  layers: [
    {id: 'pins', type: 'symbol', source: 'places', layout: {'icon-image': 'pin', 'icon-anchor': 'bottom', 'icon-allow-overlap': true}},
  ],
  controls: [navigation(), scale({position: 'bottom-left'})],
  attribution: {compact: true},
};
`},
        {label: 'Clusters', icon: 'i-lucide-circle-dot', code: `${controls}

// A source with options is declared in \`sources\`. With cluster: true, points that are near each other on the screen
// become one feature that has the properties cluster_id and point_count. The data are about 6,100 earthquakes.
export default {
  style: '${style}',
  initialView: {center: [-103.6, 40.7], zoom: 3},
  sources: {
    earthquakes: {
      type: 'geojson',
      data: 'https://maplibre.org/maplibre-gl-js/docs/assets/earthquakes.geojson',
      cluster: true,
      clusterRadius: 50,
    },
  },
  layers: [
    {
      id: 'clusters',
      type: 'circle',
      source: 'earthquakes',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#2f7fd1',
        'circle-radius': ['step', ['get', 'point_count'], 14, 100, 18, 750, 24],
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 2,
      },
    },
    {
      id: 'cluster-count',
      type: 'symbol',
      source: 'earthquakes',
      filter: ['has', 'point_count'],
      layout: {'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 12},
      paint: {'text-color': '#fff'},
    },
    {
      id: 'earthquakes',
      type: 'circle',
      source: 'earthquakes',
      filter: ['!', ['has', 'point_count']],
      paint: {'circle-color': '#d6453d', 'circle-radius': 4, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1},
    },
  ],
  controls: [navigation(), scale({position: 'bottom-left'})],
  attribution: {compact: true},
};
`},
    ]},
    {label: 'Interaction', examples: [
        {label: 'Hover and click', icon: 'i-lucide-mouse-pointer-click', code: `import {points} from '@map-jr/map-jr-gl';
${controls}

// Move the pointer over a ferry landing, or tap it. interactiveLayers names the layers whose features the map reports,
// hoverState gives the feature under the pointer the feature state "hover", and onClick gets the features of a click.
${landings}
const hovered = ['boolean', ['feature-state', 'hover'], false];

// A line of text over the map. (The code runs again when you change it, so it looks for the line first.)
const readout = document.getElementById('readout') ?? document.body.appendChild(document.createElement('p'));
readout.id = 'readout';
readout.style.cssText = 'position: fixed; left: 12px; bottom: 28px; margin: 0; padding: 4px 10px; border-radius: 6px; background: #fff; color: #1f2328';
readout.textContent = 'Click a ferry landing.';

export default {
  style: '${style}',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
  data: {landings: points(landings, {lngLat: landing => landing.lngLat, id: landing => landing.id, properties: landing => ({name: landing.name})})},
  layers: [
    {
      id: 'landings',
      type: 'circle',
      source: 'landings',
      paint: {
        'circle-radius': ['case', hovered, 11, 7],
        'circle-color': ['case', hovered, '#d6453d', '#2f7fd1'],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    },
  ],
  interactiveLayers: ['landings'],
  hoverState: true,
  onClick: event => { readout.textContent = event.features[0]?.properties.name ?? 'Click a ferry landing.'; },
  controls: [navigation(), scale({position: 'bottom-left'})],
  attribution: {compact: true},
};
`},
        {label: 'Dark colours', icon: 'i-lucide-moon', code: `${controls}

// colorScheme sets the colours of the controls, and the style reads the scheme from the global state, so the map is
// dark too. Write 'auto' to follow the setting of the visitor's browser.
export default {
  style: '${style}',
  colorScheme: 'dark',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
  controls: [navigation(), scale({position: 'bottom-left'})],
  attribution: {compact: true},
};
`},
    ]},
];

export const playExamples = playGroups.flatMap(group => group.examples);
/** The code of a page that has no `code` in its address. */
export const firstPlayExample = playExamples[0]!.code;
