// The module script of a page that has <div id="map" style="height: 500px"></div>. A button of the map opens a list of
// three styles. Below the map, a line of text names the chosen style, and a button hides and shows four sights.
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, styles} from '@map-jr/map-jr-gl/controls';

const base = 'https://styles.map-jr.org/1/';
const entries = [
  {label: 'Elevation', style: base + 'elevation-zero.json'},
  {label: 'Positron', style: base + 'openfreemap-positron.json'},
  {label: 'Dark', style: base + 'openfreemap-dark.json'},
];
const sights = {
  type: 'FeatureCollection',
  features: [
    ['Chapel Bridge', 8.3077, 47.0516],
    ['Lion Monument', 8.3103, 47.0584],
    ['KKL Luzern', 8.3125, 47.0502],
    ['Swiss Museum of Transport', 8.3357, 47.0527],
  ].map(([name, lng, lat]) => ({type: 'Feature', properties: {name}, geometry: {type: 'Point', coordinates: [lng, lat]}})),
};
const sightsLayer = {id: 'sights', type: 'circle', source: 'sights',
  paint: {'circle-radius': 7, 'circle-color': '#d6453d', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2}};

const container = document.getElementById('map');
const readout = document.createElement('p');
const toggle = document.createElement('button');
container.after(readout, toggle);

let entry = entries[0], shown = true;
const show = () => {
  readout.textContent = `Style: ${entry.label}`;
  toggle.textContent = shown ? 'Hide sights' : 'Show sights';
};
// The control sets the style of a choice on the map. `onStyleChange` keeps the entry, so that the next description
// passes the chosen style and not the first one.
const controls = [navigation(), styles({entries, onStyleChange: chosen => { entry = chosen; show(); }})];
const describe = () => ({
  style: entry.style,
  initialView: {center: [8.32, 47.054], zoom: 13.5},
  data: {sights},
  layers: shown ? [sightsLayer] : [],
  controls,
  attribution: {compact: true},
});
const map = createMap(container, describe());

toggle.onclick = () => {
  shown = !shown;
  show();
  map.update(describe());
};
show();
