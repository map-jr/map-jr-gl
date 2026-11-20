// The module script of a page that has <div id="map" style="height: 500px"></div>. A button of your own in the top
// left corner of the map shows the next style, and a line of text below the map names the style.
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, custom} from '@map-jr/map-jr-gl/controls';

const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
const styleUrl = name => `https://styles.map-jr.org/1/${name}.json`;
let current = 0;

const container = document.getElementById('map');
const readout = document.createElement('p');
container.after(readout);
readout.textContent = `Style: ${styles[current]}`;

// The element of the control. The map places it in its corner and gives it the class map-jr-ctrl, which lets it take
// clicks. Its look is yours.
const button = document.createElement('button');
button.textContent = 'Next style';
button.style.cssText = 'padding:6px 12px;border:0;border-radius:16px;background:#fff;color:#222;font:13px system-ui,sans-serif;box-shadow:0 1px 4px #0004;cursor:pointer';
button.addEventListener('click', () => {
  current = (current + 1) % styles.length;
  map.patch({style: styleUrl(styles[current])});
  readout.textContent = `Style: ${styles[current]}`;
});

const map = createMap(container, {
  style: styleUrl(styles[current]),
  initialView: {center: [-74.0065, 40.7085], zoom: 13},
  attribution: {compact: true},
  // `key` names the control: the map keeps it while the list has a control with this key.
  controls: [navigation(), custom({key: 'next-style', position: 'top-left', element: button})],
});
