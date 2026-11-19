// The module script of a page that has <div id="map" style="height: 500px"></div>. A line of text below the map says
// which thread draws it.
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, scale, fullscreen} from '@map-jr/map-jr-gl/controls';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const container = document.getElementById('map');
const readout = document.createElement('p');
container.after(readout);
const show = text => { readout.textContent = text; };

const map = createMap(container, {
  style,
  initialView: {center: NYC, zoom: 13.6},
  controls: [navigation(), scale({position: 'bottom-left'}), fullscreen({position: 'top-left'})],
  attribution: {compact: true},
});

// The thread that draws is known when the map has started.
map.state.subscribe(state => state.renderer, renderer => show(`${renderer} rendering`));
map.listen('stats', e => show(`${map.state.get().renderer} rendering, ${e.fps.toFixed(0)} frames per second`));
show('Starting');
