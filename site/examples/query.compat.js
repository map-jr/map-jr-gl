import {Map, Popup} from 'map-jr-gl/maplibre-compat';

const style = 'https://tiles.openfreemap.org/styles/liberty';
const NYC = [-74.0065, 40.7085];

export default function (container, {show}) {
  const map = new Map({container, style, center: NYC, zoom: 16.2, attributionControl: {compact: true}});
  map.setCursor('crosshair');

  let popup, clicks = 0;
  map.on('click', async e => {
    const click = ++clicks;
    // `queryFeatures` is an addition of this library: it reads the tile data, without a style layer.
    // (`queryRenderedFeatures` of MapLibre GL JS is there also.)
    const features = await map.queryFeatures(e.lngLat, {radius: 8});
    // An earlier click can get its answer after a later click. Only the last click is shown.
    if (click !== clicks) return;

    popup?.remove();
    popup = new Popup()
      .setLngLat(e.lngLat)
      .setText(features.map(f => `${f.sourceLayer}: ${f.properties.name ?? f.properties.class ?? ''}`).join('\n') || 'Nothing here')
      .addTo(map);
    show(`${features.length} features within 8 pixels`);
  });
  return map;
}
