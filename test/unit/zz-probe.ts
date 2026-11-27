import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require = createRequire(createRequire(import.meta.url).resolve('maplibre-gl/package.json'));
const p = require.resolve('@maplibre/maplibre-gl-style-spec/package.json').replace(/package\.json$/, 'dist/index.mjs');
const {validateStyleMin} = await import(pathToFileURL(p).href) as any;
const fc = {type: 'FeatureCollection', features: []};
for (const layout of [{'icon-image': 5}, {'icon-image': ['a']}, {'icon-image': {stops: [[0, 'a']]}}, {'icon-image': true}, {'icon-image': {name: 'x'}}, {'text-field': 5}, {'text-field': ['a', 'b']}, {'text-field': {a: 1}}, {'text-field': true},{'text-field': [{'text-color':'red'}]}, {'text-variable-anchor-offset': 'x'}, {'text-variable-anchor-offset': ['top', 1]}, {'text-variable-anchor-offset': ['top', [1, 2]]}, {'text-variable-anchor-offset': ['top']}, {'text-variable-anchor-offset': 5},{'text-variable-anchor-offset': ['bogus', [1,2]]}, {'text-variable-anchor-offset': ['top', [1, 'a']]}, {'text-variable-anchor-offset': ['top', [1, 2, 3]]}, {'text-variable-anchor-offset': ['top', [1, 2], 'left']}, {'text-field': ['literal', 5]},{'icon-image': ['literal', 5]}])
  console.log(JSON.stringify(layout), '=>', JSON.stringify(validateStyleMin({version: 8, sources: {g: {type: 'geojson', data: fc}}, layers: [{id: 'a', type: 'symbol', source: 'g', layout}]}).map((e: any) => e.message)));
console.log(JSON.stringify(validateStyleMin({version: 8, sources: {c: {type: 'canvas', canvas: 'x', coordinates: []}}, layers: []}).map((e: any) => e.message)));
