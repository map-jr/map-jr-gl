// The module script of a page that has <div id="map" style="height: 500px"></div>. A line of text below the map says
// which thread draws it.
import {Map, NavigationControl, ScaleControl, FullscreenControl} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const map = new Map({container: 'map', style, center: NYC, zoom: 13.6, attributionControl: {compact: true}});
const readout = document.createElement('p');
map.getContainer().after(readout);

map.addControl(new NavigationControl());
map.addControl(new ScaleControl(), 'bottom-left');
map.addControl(new FullscreenControl(), 'top-left');

map.once('load', () => { readout.textContent = `${map.renderer} rendering`; });
readout.textContent = 'Starting';
