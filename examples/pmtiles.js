// The module script of a page that has <div id="map" style="height: 500px"></div>. A legend is on the map, and a line
// of text below the map lists what a click finds.
import {createMap} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';

// Additions to the style: a PMTiles file on a usual file host. The map reads the tiles that it needs with HTTP
// range requests.
const boundaries = {
  sources: {
    admin: {type: 'vector', url: 'pmtiles://https://tiles.whatismyelevation.com/2025-state-county-zip.pmtiles'},
  },
  layers: [
    {id: 'zips', type: 'line', source: 'admin', 'source-layer': 'zip_features', minzoom: 9,
      paint: {'line-color': '#7c66dc', 'line-width': 0.6, 'line-opacity': 0.6}},
    {id: 'counties', type: 'line', source: 'admin', 'source-layer': 'county_features',
      paint: {'line-color': '#5746af', 'line-width': 2}},
  ],
};

const container = document.getElementById('map');
const readout = document.createElement('p');
container.after(readout);
const show = text => { readout.textContent = text; };

const map = createMap(container, {
  style,
  ...boundaries,
  initialView: {center: [-74.1, 40.75], zoom: 9.2},
  attribution: {compact: true},
  onClick: async e => {
    const features = await map.querySource('admin', e.point);
    show(features.map(f => f.properties.NAMELSAD ?? f.properties.NAME ?? f.properties.GEOID20).filter(Boolean).join(' · ') || 'Nothing here');
  },
});

// The legend is in a corner of the map. It takes no pointer events, so a click on it reaches the map.
const legend = document.createElement('div');
legend.style.cssText = 'position:absolute;top:8px;left:8px;z-index:1;pointer-events:none;display:flex;flex-direction:column;padding:7px 10px;border-radius:8px;background:#fffe;color:#222;font:12px/1.5 system-ui,sans-serif;box-shadow:0 1px 4px #0003';
legend.appendChild(document.createElement('b')).textContent = 'From one PMTiles file';
for (const [line, text] of [['2px solid #5746af', 'County boundaries'], ['1px solid #7c66dc', 'ZIP code areas (from zoom 9)']]) {
  const item = legend.appendChild(document.createElement('div'));
  item.appendChild(document.createElement('span')).style.cssText = `display:inline-block;width:22px;margin-right:7px;vertical-align:middle;border-top:${line}`;
  item.append(text);
}
legend.appendChild(document.createElement('small')).textContent = 'The base map below them is a usual tile source.';
container.append(legend);
show('Click to list the county, state and ZIP code');
