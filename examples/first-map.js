// The module script of a page that has <div id="map" style="height: 400px"></div>.
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});

// The state of the map is a store. The function runs after each change of the zoom, and not at the start.
map.state.subscribe(state => state.view.zoom, zoom => console.log(zoom));
