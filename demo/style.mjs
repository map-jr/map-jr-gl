/** Compact demo style for the OpenMapTiles schema, written against the standard MapLibre style spec. */
const roadWidth = (k) => ['interpolate', ['exponential', 1.6], ['zoom'], 8, ['*', k, 0.3], 12, ['*', k, 1], 14, ['*', k, 2.2], 16, ['*', k, 7], 18, ['*', k, 22]];
const classWidth = ['match', ['get', 'class'], 'motorway', 1.5, 'trunk', 1.3, 'primary', 1.15, 'secondary', 0.9, 'tertiary', 0.75, ['service', 'track'], 0.3, 'path', 0.15, 0.55];
const isRoad = ['all', ['==', ['geometry-type'], 'LineString'], ['!', ['in', ['get', 'class'], ['literal', ['rail', 'transit', 'ferry', 'pier']]]]];

export default (tiles, attribution) => ({
    version: 8,
    sources: {
        // A tile URL template, or (without {z}) the URL of a TileJSON document that names the tiles.
        omt: tiles.includes('{z}') ? {type: 'vector', tiles: [tiles], minzoom: 0, maxzoom: 14, attribution} : {type: 'vector', url: tiles, attribution},
        // Not drawn by any layer here; present so map.queryElevation() has data to read.
        dem: {type: 'raster-dem', tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'], encoding: 'terrarium', tileSize: 512, maxzoom: 12},
    },
    layers: [
        {id: 'background', type: 'background', paint: {'background-color': '#f4f1ea'}},
        {id: 'landcover', type: 'fill', source: 'omt', 'source-layer': 'landcover', metadata: {'tessera:ssr': {minSize: 4, simplify: 1.5}},
            paint: {'fill-color': ['match', ['get', 'class'], 'wood', '#cfe3c2', 'grass', '#dcebcf', 'sand', '#f3e9c6', 'ice', '#fff', 'wetland', '#d5e6dc', '#e6eedd'], 'fill-opacity': 0.7}},
        {id: 'landuse', type: 'fill', source: 'omt', 'source-layer': 'landuse',
            paint: {'fill-color': ['match', ['get', 'class'], ['hospital', 'school', 'university', 'college'], '#efe6da', ['industrial', 'railway'], '#e9e5e1', 'cemetery', '#d9e6d0', ['commercial', 'retail'], '#f3e9e4', '#eeeae2']}},
        {id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: {'fill-color': '#cfe6c3', 'fill-opacity': 0.8}},
        {id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: {'fill-color': '#a9cfe8'}},
        {id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway', paint: {'line-color': '#a9cfe8', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 2, 18, 8]}},
        {id: 'aeroway', type: 'line', source: 'omt', 'source-layer': 'aeroway', minzoom: 11, filter: ['==', ['geometry-type'], 'LineString'],
            paint: {'line-color': '#dcd8d2', 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 11, 1, 16, ['match', ['get', 'class'], 'runway', 40, 10]]}},
        {id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 13, metadata: {'tessera:ssr': {minSize: 6, simplify: 1.5}},
            paint: {'fill-color': '#e2dbd1', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, 1]}},
        {id: 'building-outline', type: 'line', source: 'omt', 'source-layer': 'building', minzoom: 15, paint: {'line-color': '#cfc6b9', 'line-width': 0.6}},
        {id: 'road-casing', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 11,
            metadata: {'tessera:ssr': {filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]]}}, filter: ['all', isRoad, ['!=', ['get', 'class'], 'path']],
            paint: {'line-color': '#d3cabb', 'line-width': ['+', roadWidth(classWidth), ['interpolate', ['linear'], ['zoom'], 11, 0.5, 16, 2]]}},
        {id: 'path', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 14, metadata: {'tessera:ssr': {hidden: true}}, filter: ['==', ['get', 'class'], 'path'], paint: {'line-color': '#c9b9a3', 'line-width': 1}},
        {id: 'road', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['all', isRoad, ['!=', ['get', 'class'], 'path']],
            paint: {'line-color': ['match', ['get', 'class'], 'motorway', '#f6c97a', 'trunk', '#f8d894', 'primary', '#fbe6a6', '#ffffff'], 'line-width': roadWidth(classWidth)}},
        {id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 10, filter: ['all', ['in', ['get', 'class'], ['literal', ['rail', 'transit']]], ['!=', ['get', 'brunnel'], 'tunnel']],
            paint: {'line-color': '#b9b3ab', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 16, 2]}},
        {id: 'boundary', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['<=', ['get', 'admin_level'], 4],
            paint: {'line-color': '#9a8fa8', 'line-width': ['match', ['get', 'admin_level'], 2, 1.4, 0.8], 'line-opacity': 0.7}},
        {id: 'poi-dot', type: 'circle', source: 'omt', 'source-layer': 'poi', minzoom: 15, filter: ['<=', ['get', 'rank'], 12],
            paint: {'circle-radius': 3, 'circle-color': ['match', ['get', 'class'], ['restaurant', 'cafe', 'bar', 'fast_food'], '#d9822b', ['park', 'garden'], '#4f9a52', '#6b7fa8'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1}},
        {id: 'water-name', type: 'symbol', source: 'omt', 'source-layer': 'water_name', filter: ['==', ['geometry-type'], 'Point'],
            layout: {'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-size': 13, 'text-font': ['Noto Sans Italic'], 'text-max-width': 6, 'text-letter-spacing': 0.1},
            paint: {'text-color': '#4d7fa3', 'text-halo-color': 'rgba(255,255,255,0.7)', 'text-halo-width': 1}},
        {id: 'poi-label', type: 'symbol', source: 'omt', 'source-layer': 'poi', minzoom: 15, filter: ['<=', ['get', 'rank'], 12],
            layout: {'text-field': ['get', 'name'], 'text-size': 11, 'text-anchor': 'top', 'text-offset': [0, 0.5], 'text-max-width': 8},
            paint: {'text-color': '#5c5346', 'text-halo-color': '#fff', 'text-halo-width': 1.2}},
        {id: 'road-name', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 13,
            layout: {'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 18, 14]},
            paint: {'text-color': '#6b6258', 'text-halo-color': '#fff', 'text-halo-width': 1.5}},
        // Shields are not in any sprite sheet: the icon name describes one and it is drawn on demand (see demo/shields.mjs).
        {id: 'road-shield', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 9,
            filter: ['all', ['has', 'ref'], ['<=', ['get', 'ref_length'], 6], ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]]],
            layout: {'symbol-placement': 'line', 'symbol-spacing': 350, 'icon-rotation-alignment': 'viewport',
                'icon-image': ['concat', 'shield|', ['coalesce', ['get', 'network'], 'road'], '|', ['get', 'ref']]}},
        {id: 'place-small', type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom: 11, filter: ['in', ['get', 'class'], ['literal', ['suburb', 'neighbourhood', 'quarter', 'village', 'hamlet']]],
            layout: {'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-size': ['interpolate', ['linear'], ['zoom'], 11, 10, 16, 14], 'text-transform': 'uppercase', 'text-letter-spacing': 0.08, 'text-max-width': 7, 'text-font': ['Noto Sans Bold']},
            paint: {'text-color': '#7a6f8a', 'text-halo-color': 'rgba(255,255,255,0.85)', 'text-halo-width': 1.5}},
        {id: 'place-city', type: 'symbol', source: 'omt', 'source-layer': 'place', filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'state', 'country']]],
            layout: {'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': ['Noto Sans Bold'], 'text-max-width': 8,
                'text-size': ['interpolate', ['linear'], ['zoom'], 3, ['match', ['get', 'class'], 'country', 13, 'city', 11, 9], 10, ['match', ['get', 'class'], 'city', 20, 14], 15, 24]},
            paint: {'text-color': '#333', 'text-halo-color': '#fff', 'text-halo-width': 2}},
    ],
});
