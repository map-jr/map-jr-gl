// The module script of a page that has <div id="map" style="height: 500px"></div>. A line of text below the map gives
// the position of the pin.
import {createMap, defaultPin} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const container = document.getElementById('map');
const readout = document.createElement('p');
container.after(readout);
const show = text => { readout.textContent = text; };
const at = ([lng, lat]) => `${lng.toFixed(5)}, ${lat.toFixed(5)}`;

const map = createMap(container, {style, initialView: {center: NYC, zoom: 14}, attribution: {compact: true}});

// The default pin of Marker, which the user can move. The tip of the pin is at the position.
map.overlay(defaultPin({color: '#d6453d'}), {
  lngLat: NYC, anchor: 'bottom', draggable: true,
  onDrag: lngLat => show(`Moving: ${at(lngLat)}`),
  onDragEnd: lngLat => show(`Dropped at ${at(lngLat)}`),
});
show(`Drag the pin. It is at ${at(NYC)}`);
