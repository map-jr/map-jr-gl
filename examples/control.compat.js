// The module script of a page that has <div id="map" style="height: 500px"></div>. A button of your own in the top
// left corner of the map shows the next style, and a line of text below the map names the style.
import {Map, NavigationControl} from '@map-jr/map-jr-gl/maplibre-compat';

const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
const styleUrl = name => `https://styles.map-jr.org/1/${name}.json`;
let current = 0;

// A control of MapLibre GL JS: an object with onAdd, which returns the element of the control, and onRemove.
class NextStyleControl {
  onAdd(map) {
    this.container = document.createElement('div');
    // The class maplibregl-ctrl lets the element take clicks. Its look is yours.
    this.container.className = 'maplibregl-ctrl';
    const button = this.container.appendChild(document.createElement('button'));
    button.textContent = 'Next style';
    button.style.cssText = 'padding:6px 12px;border:0;border-radius:16px;background:#fff;color:#222;font:13px system-ui,sans-serif;box-shadow:0 1px 4px #0004;cursor:pointer';
    button.addEventListener('click', () => {
      current = (current + 1) % styles.length;
      map.setStyle(styleUrl(styles[current]));
      readout.textContent = `Style: ${styles[current]}`;
    });
    return this.container;
  }
  onRemove() {
    this.container.remove();
  }
}

const map = new Map({container: 'map', style: styleUrl(styles[current]), center: [-74.0065, 40.7085], zoom: 13, attributionControl: {compact: true}});
map.addControl(new NavigationControl());
map.addControl(new NextStyleControl(), 'top-left');
const readout = document.createElement('p');
map.getContainer().after(readout);
readout.textContent = `Style: ${styles[current]}`;
