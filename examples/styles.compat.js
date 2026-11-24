// The module script of a page that has <div id="map" style="height: 500px"></div>. The compat entry has no control for
// styles, so a control of your own in the top left corner has a list of three styles and calls setStyle. Below the
// map, a line of text names the chosen style, and a button hides and shows four sights.
import {Map, NavigationControl} from '@map-jr/map-jr-gl/maplibre-compat';

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
let shown = true;

// A control of MapLibre GL JS: an object with onAdd, which returns the element of the control, and onRemove.
class StylesControl {
  onAdd(map) {
    this.container = document.createElement('div');
    // The class maplibregl-ctrl lets the element take clicks. Its look is yours.
    this.container.className = 'maplibregl-ctrl';
    const select = this.container.appendChild(document.createElement('select'));
    select.setAttribute('aria-label', 'Style');
    for (const entry of entries) select.append(Object.assign(document.createElement('option'), {textContent: entry.label, value: entry.style}));
    select.addEventListener('change', () => {
      map.setStyle(select.value);
      readout.textContent = `Style: ${select.selectedOptions[0].text}`;
    });
    return this.container;
  }
  onRemove() {
    this.container.remove();
  }
}

const map = new Map({container: 'map', style: entries[0].style, center: [8.32, 47.054], zoom: 13.5, attributionControl: {compact: true}});
map.addControl(new NavigationControl());
map.addControl(new StylesControl(), 'top-left');

// setStyle replaces the whole style, with the sources and layers that addSource and addLayer added. They are added
// again each time a style has loaded.
map.on('style.load', () => {
  map.addSource('sights', {type: 'geojson', data: sights});
  map.addLayer({id: 'sights', type: 'circle', source: 'sights', layout: {visibility: shown ? 'visible' : 'none'},
    paint: {'circle-radius': 7, 'circle-color': '#d6453d', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2}});
});

const readout = document.createElement('p');
const toggle = document.createElement('button');
map.getContainer().after(readout, toggle);
readout.textContent = `Style: ${entries[0].label}`;
toggle.textContent = 'Hide sights';
toggle.onclick = () => {
  shown = !shown;
  toggle.textContent = shown ? 'Hide sights' : 'Show sights';
  map.setLayoutProperty('sights', 'visibility', shown ? 'visible' : 'none');
};
