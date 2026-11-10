/** Demo marker layer: one SVG template, restyled per marker through {{slots}}. */
export const pin = `<svg viewBox="0 0 36 46">
  <defs><filter id="s" x="-30%" y="-20%" width="160%" height="160%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-opacity=".35"/></filter></defs>
  <path filter="url(#s)" d="M18 43C18 43 4 27.5 4 17a14 14 0 1 1 28 0c0 10.500-14 26-14 26z" fill="{{color}}" stroke="{{stroke}}" stroke-width="{{strokeWidth}}"/>
  <circle cx="18" cy="17" r="9.500" fill="#fff"/>
  <text x="18" y="21.200" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" fill="{{color}}">{{label}}</text>
</svg>`;

const base = {stroke: '#fff', strokeWidth: 1.5};
export const markers = {
    id: 'places', svg: pin, width: 36, height: 46, anchor: 'bottom', collide: true,
    data: [
        {lngLat: [-74.0134, 40.7033], props: {...base, color: '#d6453d', label: '12'}},
        {lngLat: [-74.0090, 40.7061], props: {...base, color: '#2f7fd1', label: 'A'}},
        {lngLat: [-74.0060, 40.7127], props: {...base, color: '#2e9d5b', label: '3'}},
        {lngLat: [-73.9969, 40.7061], props: {...base, color: '#8a4fd3', label: 'B'}},
        {lngLat: [-74.0113, 40.7112], props: {...base, color: '#d6453d', label: '7'}},
        {lngLat: [-74.0020, 40.7085], props: {...base, color: '#e08a1e', label: '★'}},
    ],
};
export const view = {center: [-74.0065, 40.7085], zoom: 14.3, bearing: 0};

/** A marker whose SVG contains a photograph: a raster image clipped to a circle inside vector artwork. */
export const photoPin = `<svg viewBox="0 0 48 56">
  <defs><clipPath id="c"><circle cx="24" cy="24" r="19"/></clipPath></defs>
  <path d="M24 55 12 40h24z" fill="{{color}}"/>
  <circle cx="24" cy="24" r="22.500" fill="{{color}}"/>
  <image href="{{photo}}" x="5" y="5" width="38" height="38" preserveAspectRatio="xMidYMid slice" clip-path="url(#c)"/>
  <circle cx="24" cy="24" r="19" fill="none" stroke="#fff" stroke-width="1.500"/>
</svg>`;
export const photos = {
    id: 'photos', svg: photoPin, width: 48, height: 56, anchor: 'bottom',
    data: [
        {lngLat: [-74.0445, 40.6892], props: {color: '#2e9d5b', photo: 'https://tiles.openfreemap.org/natural_earth/ne2sr/5/9/12.png', name: 'Relief imagery, tile 5/9/12'}},
        {lngLat: [-73.9969, 40.7061], props: {color: '#2f7fd1', photo: 'https://tiles.openfreemap.org/natural_earth/ne2sr/4/4/6.png', name: 'Relief imagery, tile 4/4/6'}},
        {lngLat: [-74.0159, 40.7115], props: {color: '#d6453d', photo: 'https://tiles.openfreemap.org/natural_earth/ne2sr/6/18/24.png', name: 'Relief imagery, tile 6/18/24'}},
    ],
};

/** Many markers for stress testing: `count` pins scattered around a centre, deterministic for a given count. */
export function manyMarkers(count, [lng, lat] = view.center, spread = 0.6) {
    let seed = 12345;
    const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const colors = ['#d6453d', '#2f7fd1', '#2e9d5b', '#8a4fd3', '#e08a1e'], data = [];
    for (let i = 0; i < count; i++) {
        // Square-root radius spreads points evenly over the disc instead of bunching at the centre.
        const r = Math.sqrt(rand()) * spread, a = rand() * 2 * Math.PI;
        data.push({lngLat: [lng + r * Math.cos(a) * 1.3, lat + r * Math.sin(a)], props: {...base, color: colors[i % 5], label: String(i % 100)}});
    }
    return {id: 'many', svg: pin, width: 24, height: 31, anchor: 'bottom', data};
}
