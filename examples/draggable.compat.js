// The module script of a page that has <div id="map" style="height: 500px"></div>. A line of text below the map gives
// the position of the pin.
import {Map, Marker} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const at = ({lng, lat}) => `${lng.toFixed(5)}, ${lat.toFixed(5)}`;

const map = new Map({container: 'map', style, center: NYC, zoom: 14, attributionControl: {compact: true}});
const readout = document.createElement('p');
map.getContainer().after(readout);
const show = text => { readout.textContent = text; };

const marker = new Marker({color: '#d6453d', draggable: true}).setLngLat(NYC).addTo(map);
marker.on('drag', () => show(`Moving: ${at(marker.getLngLat())}`));
marker.on('dragend', () => show(`Dropped at ${at(marker.getLngLat())}`));
show(`Drag the pin. It is at ${at(marker.getLngLat())}`);
