import {createMap} from 'map-jr-gl';
import {style, NYC} from './shared.js';

export default function (container, {show}) {
  let popup = null;
  const map = createMap(container, {
    style,
    initialView: {center: NYC, zoom: 16.2},
    attribution: {compact: true},
    cursor: 'crosshair',   // a click asks about one position
    onClick: async e => {
      // The features of the tile data near the point. You do not need a style layer, and hidden data is included.
      const features = await map.queryFeatures(e.point, {radius: 8});

      const list = document.createElement('div');
      list.className = 'found';
      for (const f of features.slice(0, 8)) {
        const line = list.appendChild(document.createElement('div'));
        line.appendChild(document.createElement('b')).textContent = f.sourceLayer;
        line.append(' ' + (f.properties.name ?? f.properties.class ?? ''));
      }
      if (!features.length) list.textContent = 'Nothing here';

      // The result goes into a popup at the position of the click.
      popup?.remove();
      popup = map.overlay(list, {lngLat: e.lngLat, popup: true, onClose: () => popup.remove()});
      show(`${features.length} features within 8 pixels`);
    },
  });
  show('Click the map to list what is there.');
  return map;
}
