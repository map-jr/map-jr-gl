import {createMap} from 'map-jr-gl';
import {MATTERHORN} from './shared.js';
import {withElevation} from './terrain-style.js';   // the base style with relief shading, contour lines and terrain

export default function (container, {show, button}) {
  let unit = 'ft', terrain = true;
  const describe = () => ({
    style: withElevation(unit, terrain),
    initialView: {center: MATTERHORN, zoom: 12.4, pitch: 60, bearing: 25},
    attribution: {compact: true},
    onClick: async e => {
      const metres = await map.queryElevation(e.lngLat);
      show(metres === null ? 'No elevation data here' : `${metres.toFixed(0)} m (${(metres * 3.28084).toFixed(0)} ft) above sea level`);
    },
  });
  const map = createMap(container, describe());

  button('Contours in metres', b => {
    unit = unit === 'ft' ? 'm' : 'ft';
    b.textContent = unit === 'ft' ? 'Contours in metres' : 'Contours in feet';
    map.update(describe());
  });
  button('Flat map', b => {
    terrain = !terrain;
    b.textContent = terrain ? 'Flat map' : '3D terrain';
    map.update(describe());
  });
  show('Click the map to read the elevation');
  return map;
}
