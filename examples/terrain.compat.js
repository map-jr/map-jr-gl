// The module script of a page that has <div id="map" style="height: 500px"></div>. Below the map, it adds a line of
// text with the elevation at a click and two buttons.
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation.json';
const MATTERHORN = [7.6586, 45.9763];
const thresholds = {
  ft: {9: [500, 1000], 11: [200, 1000], 12: [100, 500], 14: [50, 200], 15: [20, 100]},
  m: {9: [200, 1000], 11: [100, 500], 12: [50, 200], 14: [20, 100], 15: [10, 50]},
};

const map = new Map({container: 'map', style, center: MATTERHORN, zoom: 12.4, pitch: 60, bearing: 25, attributionControl: {compact: true}});
const readout = document.createElement('p');
const units = Object.assign(document.createElement('button'), {textContent: 'Contours in meters'});
const flat = Object.assign(document.createElement('button'), {textContent: 'Flat map'});
map.getContainer().after(readout, units, flat);

let unit = 'ft', terrain = true;
// Adds the contour lines and their labels in the current unit. A contour source is an addition of this library: it
// makes lines from the elevation tiles. For each zoom level, `thresholds` sets the interval between lines and between
// major lines, in feet or meters.
function addContours() {
  map.addSource('contours', {type: 'contour', source: 'terrarium', multiplier: unit === 'ft' ? 3.28084 : 1, thresholds: thresholds[unit]});
  map.addLayer({id: 'contour-lines', type: 'line', source: 'contours', 'source-layer': 'contours',
    paint: {'line-color': 'hsla(25, 30%, 35%, 0.55)', 'line-width': ['match', ['get', 'level'], 1, 1.2, 0.5]}}, 'water');
  map.addLayer({id: 'contour-labels', type: 'symbol', source: 'contours', 'source-layer': 'contours', filter: ['>', ['get', 'level'], 0],
    layout: {'symbol-placement': 'line', 'text-size': 10, 'text-font': ['Noto Sans Bold'],
      'text-field': ['concat', ['number-format', ['get', 'ele'], {}], unit === 'ft' ? "'" : ' m']},
    paint: {'text-color': '#6b5a48', 'text-halo-color': '#fff', 'text-halo-width': 1.5}});
}

map.on('load', () => {
  // The style has the elevation source "terrarium", relief shading and a terrain with exaggeration 0.5.
  map.setTerrain({source: 'terrarium', exaggeration: 1.5});
  addContours();
});

map.on('click', async e => {
  const meters = await map.queryElevation(e.lngLat);
  const feet = meters * 3.28084;
  readout.textContent = meters === null ? 'No elevation data here' : `${meters.toFixed(0)} m (${feet.toFixed(0)} ft) above sea level`;
});

units.onclick = () => {
  unit = unit === 'ft' ? 'm' : 'ft';
  units.textContent = unit === 'ft' ? 'Contours in meters' : 'Contours in feet';
  // The style shows the heights of peaks in the unit of its state "elevation-unit".
  map.setGlobalStateProperty('elevation-unit', unit);
  // The options of a source do not change after it is added, so the source and its layers are added again.
  map.removeLayer('contour-labels');
  map.removeLayer('contour-lines');
  map.removeSource('contours');
  addContours();
};
flat.onclick = () => {
  terrain = !terrain;
  flat.textContent = terrain ? 'Flat map' : '3D terrain';
  map.setTerrain(terrain ? {source: 'terrarium', exaggeration: 1.5} : null);
};
readout.textContent = 'Click the map to read the elevation';
