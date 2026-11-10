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
