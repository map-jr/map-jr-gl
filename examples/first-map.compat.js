// The module script of a page that has <div id="map" style="height: 400px"></div>.
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 13.6,
});

map.on('zoomend', () => console.log(map.getZoom()));
