// The module script of a page that has <div id="map" style="height: 500px"></div>. The answer to a click shows in a
// box on the map, and a line of text below the map counts the features.
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const map = new Map({container: 'map', style, center: NYC, zoom: 16.2, attributionControl: {compact: true}});
map.setCursor('crosshair');
const readout = document.createElement('p');
map.getContainer().after(readout);

// The answer shows in a box in a corner of the map. The box takes no pointer events, so a click on it reaches the map.
const box = document.createElement('div');
box.style.cssText = 'position:absolute;top:8px;left:8px;z-index:1;pointer-events:none;max-width:240px;padding:8px 10px;border-radius:8px;background:#fff;color:#222;font:12px/1.5 system-ui,sans-serif;box-shadow:0 1px 6px #0004';
box.hidden = true;
map.getContainer().append(box);

let clicks = 0;
map.on('click', async e => {
  const click = ++clicks;
  // `querySource` is an addition of this library. It reads the features of one source within
  // 8 pixels of the click, and it also finds features that the style does not draw. "openmaptiles" is the id of
  // the vector source in this style. (`queryRenderedFeatures` of MapLibre GL JS is there also.)
  // When the tile does not load, the query rejects, and the example shows a text instead.
  const features = await map.querySource('openmaptiles', e.lngLat, {radius: 8}).catch(() => null);
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
  readout.textContent = features ? `${features.length} features within 8 pixels` : 'The query failed';
});
readout.textContent = 'Click the map to list what is there.';
