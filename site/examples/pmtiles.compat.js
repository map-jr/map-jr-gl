import {Map} from 'map-jr-gl/maplibre-compat';

const style = 'https://tiles.openfreemap.org/styles/liberty';

export default function (container, {show}) {
  const map = new Map({container, style, center: [-74.1, 40.75], zoom: 9.2, attributionControl: {compact: true}});

  map.on('load', () => {
    // A PMTiles file on a usual file host. You do not need the pmtiles library or `addProtocol`.
    map.addSource('admin', {type: 'vector', url: 'pmtiles://https://tiles.whatismyelevation.com/2025-state-county-zip.pmtiles'});
    map.addLayer({id: 'zips', type: 'line', source: 'admin', 'source-layer': 'zip_features', minzoom: 9,
      paint: {'line-color': '#7c66dc', 'line-width': 0.6, 'line-opacity': 0.6}});
    map.addLayer({id: 'counties', type: 'line', source: 'admin', 'source-layer': 'county_features',
      paint: {'line-color': '#5746af', 'line-width': 2}});
  });

  map.on('click', async e => {
    const features = await map.queryFeatures(e.lngLat, {sources: ['admin']});
    show(features.map(f => f.properties.NAMELSAD ?? f.properties.NAME ?? f.properties.GEOID20).filter(Boolean).join(' · ') || 'Nothing here');
  });
  return map;
}
