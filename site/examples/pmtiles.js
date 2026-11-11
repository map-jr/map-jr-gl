import {createMap} from 'map-jr-gl';

const style = 'https://tiles.openfreemap.org/styles/liberty';

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

export default function (container, {show, legend}) {
  const map = createMap(container, {
    style,
    extend: boundaries,
    initialView: {center: [-74.1, 40.75], zoom: 9.2},
    attribution: {compact: true},
    onClick: async e => {
      const features = await map.queryFeatures(e.point, {sources: ['admin']});
      show(features.map(f => f.properties.NAMELSAD ?? f.properties.NAME ?? f.properties.GEOID20).filter(Boolean).join(' · ') || 'Nothing here');
    },
  });
  legend('From one PMTiles file', [['2px solid #5746af', 'County boundaries'], ['1px solid #7c66dc', 'ZIP code areas (from zoom 9)']], 'The base map below them is a usual tile source.');
  show('Click to list the county, state and ZIP code');
  return map;
}
