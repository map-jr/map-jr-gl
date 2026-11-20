import {useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';

// A small style of roads and water. Its layer "shields" asks for an image named from the network and the number of the
// first route of each road, such as "shield|US:I|95", and no sprite has such images.
const style = {
  version: 8,
  sources: {openmaptiles: {type: 'vector', url: 'https://tiles.openfreemap.org/planet'}},
  layers: [
    {id: 'land', type: 'background', paint: {'background-color': '#f2efe9'}},
    {id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: {'fill-color': '#aad3df'}},
    {id: 'roads', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false],
      paint: {'line-color': '#e3a04f', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 4]}},
    {id: 'shields', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', filter: ['has', 'route_1_ref'],
      layout: {
        'icon-image': ['concat', 'shield|', ['coalesce', ['get', 'route_1_network'], ''], '|', ['get', 'route_1_ref']],
        'symbol-placement': 'line', 'symbol-spacing': 300, 'icon-rotation-alignment': 'viewport',
      }},
  ],
};

// The SVG of the shield for an image name such as "shield|US:I|95": blue for an Interstate, white for a US highway and
// yellow for other routes. The width grows with the number. The number comes from the tiles, so the characters that
// XML reserves are escaped.
function shield(name) {
  const [, network, ref] = name.split('|');
  const text = ref.replace(/[&<>]/g, c => `&#${c.charCodeAt(0)};`);
  const width = 10 + 7 * ref.length;
  const [fill, color] = network === 'US:I' ? ['#2a57a5', '#fff'] : network === 'US:US' ? ['#fff', '#222'] : ['#fdf6d8', '#5b4f1f'];
  return `<svg viewBox="0 0 ${width} 20"><rect x="1" y="1" width="${width - 2}" height="18" rx="4" fill="${fill}" stroke="#222" stroke-width="1.2"/>` +
    `<text x="${width / 2}" y="14.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="${color}">${text}</text></svg>`;
}

export default function Shields() {
  // The images that the page made, by name.
  const [images, setImages] = useState({});
  // The map reports each image name that a layer asks for and that it does not have, and draws the image when the
  // page adds it to `images`.
  function addShield(e) {
    if (e.id.startsWith('shield|')) setImages(made => ({...made, [e.id]: shield(e.id)}));
  }

  return <>
    <MapJr mapStyle={style} initialView={{center: [-74.0, 40.75], zoom: 10.5}} images={images} attribution={{compact: true}} onStyleimagemissing={addShield} />
    <p>{Object.keys(images).length} shields made so far</p>
  </>;
}
