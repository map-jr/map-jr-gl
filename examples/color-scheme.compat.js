// The module script of a page that has <div id="map" style="height: 500px"></div>. The compat entry has no colorScheme
// and no control for it, so a button below the map sets the global state property `color-scheme`, which the style reads.
import {Map, NavigationControl} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 13,
  attributionControl: {compact: true},
});
map.addControl(new NavigationControl());

const dark = window.matchMedia('(prefers-color-scheme: dark)');
let scheme = dark.matches ? 'dark' : 'light';
const button = document.createElement('button');
map.getContainer().after(button);
const apply = () => {
  map.setGlobalStateProperty('color-scheme', scheme);
  button.textContent = scheme === 'dark' ? 'Light map' : 'Dark map';
};
button.addEventListener('click', () => {
  scheme = scheme === 'dark' ? 'light' : 'dark';
  apply();
});
map.on('load', apply);
