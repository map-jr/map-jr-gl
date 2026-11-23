// The module script of a page that has <div id="map" style="height: 500px"></div>. A line of text below the map names
// the scheme that the button of the map set.
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, colorScheme} from '@map-jr/map-jr-gl/controls';

const container = document.getElementById('map');
const readout = document.createElement('p');
container.after(readout);
readout.textContent = 'Scheme: auto';

createMap(container, {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13},
  controls: [navigation(), colorScheme()],
  attribution: {compact: true},
  colorScheme: 'auto',
  // The button has changed the scheme of the map. A later `update` must pass this value, or the map changes back.
  onColorSchemeChange: scheme => { readout.textContent = `Scheme: ${scheme}`; },
});
