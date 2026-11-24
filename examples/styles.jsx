// The map fills its parent element, so give the parent a height.
import {useMemo, useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';
import {navigation, styles} from '@map-jr/map-jr-gl/controls';

const base = 'https://styles.map-jr.org/1/';
const entries = [
  {label: 'Elevation', style: base + 'elevation-zero.json'},
  {label: 'Positron', style: base + 'openfreemap-positron.json'},
  {label: 'Dark', style: base + 'openfreemap-dark.json'},
];
const sights = {
  type: 'FeatureCollection',
  features: [
    ['Chapel Bridge', 8.3077, 47.0516],
    ['Lion Monument', 8.3103, 47.0584],
    ['KKL Luzern', 8.3125, 47.0502],
    ['Swiss Museum of Transport', 8.3357, 47.0527],
  ].map(([name, lng, lat]) => ({type: 'Feature', properties: {name}, geometry: {type: 'Point', coordinates: [lng, lat]}})),
};
const data = {sights};
const sightsLayer = {id: 'sights', type: 'circle', source: 'sights',
  paint: {'circle-radius': 7, 'circle-color': '#d6453d', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2}};
const initialView = {center: [8.32, 47.054], zoom: 13.5};

export default function StyleSwitcher() {
  // The component passes `mapStyle` again at each render. `onStyleChange` keeps the chosen entry, so that the map
  // keeps the chosen style.
  const [entry, setEntry] = useState(entries[0]);
  const [shown, setShown] = useState(true);
  const controls = useMemo(() => [navigation(), styles({entries, onStyleChange: setEntry})], []);
  const layers = useMemo(() => shown ? [sightsLayer] : [], [shown]);

  return <>
    <MapJr mapStyle={entry.style} initialView={initialView} data={data} layers={layers} controls={controls}
      attribution={{compact: true}} />
    <p>Style: {entry.label}</p>
    <button onClick={() => setShown(!shown)}>{shown ? 'Hide sights' : 'Show sights'}</button>
  </>;
}
