// The module script of a page that has <div id="map" style="height: 500px"></div>. A line of text below the map lists
// what a click finds.
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const boundaryFile = 'https://tiles.whatismyelevation.com/2025-state-county-zip.pmtiles';

const map = new Map({container: 'map', style, center: [-74.1, 40.75], zoom: 9.2, attributionControl: {compact: true}});
const readout = document.createElement('p');
map.getContainer().after(readout);

map.on('load', () => {
  // A PMTiles file on a usual file host. You do not need the pmtiles library or `addProtocol`.
  map.addSource('admin', {type: 'vector', url: 'pmtiles://' + boundaryFile});
  map.addLayer({id: 'zips', type: 'line', source: 'admin', 'source-layer': 'zip_features', minzoom: 9,
    paint: {'line-color': '#7c66dc', 'line-width': 0.6, 'line-opacity': 0.6}});
  map.addLayer({id: 'counties', type: 'line', source: 'admin', 'source-layer': 'county_features',
    paint: {'line-color': '#5746af', 'line-width': 2}});
});

map.on('click', async e => {
  const features = await map.querySource('admin', e.lngLat);
  readout.textContent = features.map(f => f.properties.NAMELSAD ?? f.properties.NAME ?? f.properties.GEOID20).filter(Boolean).join(' · ') || 'Nothing here';
});
readout.textContent = 'Click to list the county, state and ZIP code';
