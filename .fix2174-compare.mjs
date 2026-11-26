import {launch} from './test/launch.mjs';
const port = process.env.PORT;
const browser = await launch(), page = await browser.newPage({viewport: {width: 600, height: 600}});
await page.goto(`http://localhost:${port}/ml/maplibre-gl.css`);
const cases = [];
for (const lat of [0, 45, 70]) { cases.push({lat, center: [0, lat], pt: [0, lat]}); cases.push({lat, center: [0, 0], pt: [40, lat]}); }
const res = await page.evaluate(async ({cases}) => {
  const mlMod = await import('/ml/maplibre-gl.mjs'); window.maplibregl = mlMod.default ?? mlMod;
  const ours = await import('/dist/map-jr-gl-maplibre-compat.js');
  const out = [];
  const img = {width: 40, height: 40, data: new Uint8Array(40 * 40 * 4).map((_, i) => i % 4 === 0 || i % 4 === 3 ? 255 : 0)};
  for (const c of cases) for (const [name, lib] of [['ml', window.maplibregl], ['jr', ours]]) {
    const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:0;top:0;width:600px;height:600px'}));
    const m = new lib.Map({container: el, center: c.center, zoom: 2, attributionControl: false, fadeDuration: 0, preserveDrawingBuffer: true, canvasContextAttributes: {preserveDrawingBuffer: true}, style: {version: 8, projection: {type: 'globe'}, sources: {p: {type: 'geojson', data: {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: c.pt}}}},
      layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}, {id: 'i', type: 'symbol', source: 'p', layout: {'icon-image': 'sq', 'icon-pitch-alignment': 'map', 'icon-rotation-alignment': 'map'}}]}});
    m.addImage('sq', img);
    await new Promise(r => { m.once('idle', r); setTimeout(r, 10000); });
    await new Promise(r => setTimeout(r, 300));
    const cv = m.getCanvas(), k = cv.width / 600, c2 = new OffscreenCanvas(cv.width, cv.height).getContext('2d'); c2.drawImage(cv, 0, 0);
    const d = c2.getImageData(0, 0, cv.width, cv.height).data; const b = [1e9, 1e9, -1e9, -1e9];
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) { const i = (y * cv.width + x) * 4; if (d[i] > 180 && d[i + 1] < 90 && d[i + 2] < 90) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); } }
    const p = m.project(c.pt);
    const rows = [];
    for (const fy of [0.1, 0.5, 0.9]) { const y = Math.round(b[1] + (b[3] - b[1]) * fy); let x0 = -1, x1 = -1; for (let x = 0; x < cv.width; x++) { const i = (y * cv.width + x) * 4; if (d[i] > 180 && d[i + 1] < 90 && d[i + 2] < 90) { if (x0 < 0) x0 = x; x1 = x; } } rows.push([Math.round(x0 / k - p.x), Math.round(x1 / k - p.x)]); }
    // Query hits along the row and column through the point: the extent where the icon is found.
    const xs = [], ys = [];
    for (let x = -40; x <= 40; x++) if ((await m.queryRenderedFeatures([p.x + x, p.y], {layers: ['i']})).length) xs.push(x);
    for (let y = -40; y <= 40; y++) if ((await m.queryRenderedFeatures([p.x, p.y + y], {layers: ['i']})).length) ys.push(y);
    out.push({lat: c.lat, off: c.pt[0] !== 0, lib: name, w: Math.round((b[2] - b[0] + 1) / k), h: Math.round((b[3] - b[1] + 1) / k), qw: xs.length, qh: ys.length, top: Math.round(b[1] / k - p.y), rows: JSON.stringify(rows)});
    m.remove(); el.remove();
  }
  return out;
}, {cases});
for (const r of res) console.log(JSON.stringify(r));
await browser.close();
