// The module script of a page that has <div id="map" style="height: 500px"></div>. A line of text below the map names
// the projection.
import {Map, NavigationControl, GlobeControl} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';

const map = new Map({container: 'map', style, center: [10, 30], zoom: 1.5, attributionControl: {compact: true}});
const readout = document.createElement('p');
map.getContainer().after(readout);

map.addControl(new NavigationControl());
map.addControl(new GlobeControl());

// As in MapLibre GL JS, the projection is set when the style has loaded. The globe turns into Mercator between zoom 11 and 12.
map.on('style.load', () => map.setProjection({type: 'globe'}));
map.on('projectiontransition', e => { readout.textContent = `Projection: ${e.newProjection}`; });
readout.textContent = 'Starting';
