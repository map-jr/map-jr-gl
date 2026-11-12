import {createMap} from '@map-jr/map-jr-gl';

const style = 'https://tiles.openfreemap.org/styles/liberty';
const NYC = [-74.0065, 40.7085];

export default function (container, {show}) {
  // The answer shows in a box in a corner of the map. The box takes no pointer events, so a click on it reaches the map.
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;top:8px;left:8px;z-index:1;pointer-events:none;max-width:240px;padding:8px 10px;border-radius:8px;background:#fff;color:#222;font:12px/1.5 system-ui,sans-serif;box-shadow:0 1px 6px #0004';
  box.hidden = true;

  let clicks = 0;
  const map = createMap(container, {
    style,
    initialView: {center: NYC, zoom: 16.2},
    attribution: {compact: true},
    cursor: 'crosshair',   // a click asks about one position
    onClick: async e => {
      const click = ++clicks;
      // With `sources`, the query reads the tile data of these sources within 8 pixels of the click. It also finds
      // features that the style does not draw. "openmaptiles" is the id of the vector source in this style.
      // A query fails when its tile cannot be loaded: the answer is then `null` here.
      const features = await map.queryFeatures(e.lngLat, {sources: ['openmaptiles'], radius: 8}).catch(() => null);
      // An earlier click can get its answer after a later click. Only the last click is shown.
      if (click !== clicks) return;

      box.replaceChildren();
      for (const f of features?.slice(0, 8) ?? []) {
        const line = box.appendChild(document.createElement('div'));
        line.appendChild(document.createElement('b')).textContent = f.sourceLayer;
        line.append(' ' + (f.properties.name ?? f.properties.class ?? ''));
      }
      if (!features?.length) box.textContent = features ? 'Nothing here' : 'The tile data did not load';
      box.hidden = false;
      show(features ? `${features.length} features within 8 pixels` : 'The query failed');
    },
  });
  container.append(box);
  show('Click the map to list what is there.');
  return map;
}
