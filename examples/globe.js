// The module script of a page that has <div id="map" style="height: 500px"></div>. A line of text below the map names
// the projection.
import {createMap} from '@map-jr/map-jr-gl';
import {globe, navigation} from '@map-jr/map-jr-gl/controls';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';

const container = document.getElementById('map');
const readout = document.createElement('p');
container.after(readout);

const map = createMap(container, {
  style,
  // The globe turns into Mercator between zoom 11 and 12, as in MapLibre GL JS.
  projection: {type: 'globe'},
  initialView: {center: [10, 30], zoom: 1.5},
  controls: [navigation(), globe()],
  attribution: {compact: true},
});

// The button of the globe control switches between the globe and Mercator.
map.listen('projectiontransition', e => { readout.textContent = `Projection: ${e.newProjection}`; });
readout.textContent = 'Projection: globe';
