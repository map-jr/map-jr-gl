import {style} from './shared.js';

const thresholds = {
  ft: {9: [500, 1000], 11: [200, 1000], 12: [100, 500], 14: [50, 200], 15: [20, 100]},
  m: {9: [200, 1000], 11: [100, 500], 12: [50, 200], 14: [20, 100], 15: [10, 50]},
};

// The style of the base map, with relief shading, contour lines and 3D terrain from its elevation source ('dem').
export function withElevation(unit, terrain) {
  const water = style.layers.findIndex(layer => layer.id === 'water');
  return {
    ...style,
    terrain: terrain ? {source: 'dem', exaggeration: 1.5} : undefined,
    sources: {
      ...style.sources,
      // Contour lines are made from the elevation tiles, in the tile workers.
      contours: {type: 'contour', source: 'dem', multiplier: unit === 'ft' ? 3.28084 : 1, thresholds: thresholds[unit]},
    },
    layers: [
      ...style.layers.slice(0, water),
      {id: 'relief', type: 'hillshade', source: 'dem', paint: {'hillshade-shadow-color': '#5a4a3a', 'hillshade-exaggeration': 0.4}},
      {id: 'contour-lines', type: 'line', source: 'contours', 'source-layer': 'contours',
        paint: {'line-color': 'hsla(25, 30%, 35%, 0.55)', 'line-width': ['match', ['get', 'level'], 1, 1.2, 0.5]}},
      ...style.layers.slice(water),
      {id: 'contour-labels', type: 'symbol', source: 'contours', 'source-layer': 'contours', filter: ['>', ['get', 'level'], 0],
        layout: {'symbol-placement': 'line', 'text-size': 10, 'text-font': ['Noto Sans Bold'],
          'text-field': ['concat', ['number-format', ['get', 'ele'], {}], unit === 'ft' ? "'" : ' m']},
        paint: {'text-color': '#6b5a48', 'text-halo-color': '#fff', 'text-halo-width': 1.5}},
    ],
  };
}
