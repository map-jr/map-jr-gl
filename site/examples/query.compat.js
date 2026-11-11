import {Map, Popup} from 'map-jr-gl/maplibre-compat';

const style = 'https://tiles.openfreemap.org/styles/liberty';
const NYC = [-74.0065, 40.7085];

export default function (container, {show}) {
  const map = new Map({container, style, center: NYC, zoom: 16.2, attributionControl: {compact: true}});
  map.setCursor('crosshair');

  let popup;
  map.on('click', async e => {
    // `queryFeatures` is an addition of this library: it reads the tile data, without a style layer.
    // (`queryRenderedFeatures` of MapLibre GL JS is there also.)
    const features = await map.queryFeatures(e.lngLat, {radius: 8});

    popup?.remove();
    popup = new Popup()
      .setLngLat(e.lngLat)
      .setText(features.map(f => `${f.sourceLayer}: ${f.properties.name ?? f.properties.class ?? ''}`).join('\n') || 'Nothing here')
      .addTo(map);
    show(`${features.length} features within 8 pixels`);
  });
  return map;
}
