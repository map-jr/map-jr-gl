// The types of one layer type check the prefix of each name in `paint` and `layout` (#319).
// `node test/examples.mjs` checks that it compiles against the built types (dist/types). It is not run.
import type {
    BackgroundLayerSpecification, FillLayerSpecification, FillExtrusionLayerSpecification, LineLayerSpecification, CircleLayerSpecification,
    HeatmapLayerSpecification, RasterLayerSpecification, HillshadeLayerSpecification, SymbolLayerSpecification, LayerSpecification,
} from '@map-jr/map-jr-gl/maplibre-compat';

const background: BackgroundLayerSpecification = {id: 'bg', type: 'background', paint: {'background-color': '#fff'}, layout: {visibility: 'visible'}};
const fill: FillLayerSpecification = {id: 'f', type: 'fill', source: 's', paint: {'fill-color': '#f00', 'fill-opacity': 0.5}, layout: {'fill-sort-key': 1}};
const extrusion: FillExtrusionLayerSpecification = {id: 'e', type: 'fill-extrusion', source: 's', paint: {'fill-extrusion-height': 10}};
const line: LineLayerSpecification = {id: 'l', type: 'line', source: 's', paint: {'line-width': 2}, layout: {'line-cap': 'round', visibility: 'none'}};
const circle: CircleLayerSpecification = {id: 'c', type: 'circle', source: 's', paint: {'circle-radius': 4}};
const heatmap: HeatmapLayerSpecification = {id: 'h', type: 'heatmap', source: 's', paint: {'heatmap-weight': 1}};
const raster: RasterLayerSpecification = {id: 'r', type: 'raster', source: 's', paint: {'raster-opacity': 1}};
const hillshade: HillshadeLayerSpecification = {id: 'hs', type: 'hillshade', source: 's', paint: {'hillshade-exaggeration': 0.5}};
const symbol: SymbolLayerSpecification = {id: 'sy', type: 'symbol', source: 's', paint: {'text-color': '#000', 'icon-opacity': 1}, layout: {'text-field': ['get', 'name'], 'icon-image': 'pin', 'symbol-placement': 'point'}};
const all: LayerSpecification[] = [background, fill, extrusion, line, circle, heatmap, raster, hillshade, symbol];

// One wrong name per layer type.
// @ts-expect-error a background layer has no `fill-color`
const badBackground: BackgroundLayerSpecification = {id: 'bg', type: 'background', paint: {'fill-color': '#fff'}};
// @ts-expect-error a fill layer has no `line-width`
const badFill: FillLayerSpecification = {id: 'f', type: 'fill', source: 's', paint: {'line-width': 2}};
// @ts-expect-error a fill-extrusion layer has no `fill-color`
const badExtrusion: FillExtrusionLayerSpecification = {id: 'e', type: 'fill-extrusion', source: 's', paint: {'fill-color': '#f00'}};
// @ts-expect-error a line layer has no `fill-sort-key` in `layout`
const badLine: LineLayerSpecification = {id: 'l', type: 'line', source: 's', layout: {'fill-sort-key': 1}};
// @ts-expect-error a circle layer has no `circle_radius` (misspelt)
const badCircle: CircleLayerSpecification = {id: 'c', type: 'circle', source: 's', paint: {circle_radius: 4}};
// @ts-expect-error a heatmap layer has no `circle-radius`
const badHeatmap: HeatmapLayerSpecification = {id: 'h', type: 'heatmap', source: 's', paint: {'circle-radius': 4}};
// @ts-expect-error a raster layer has no `opacity`
const badRaster: RasterLayerSpecification = {id: 'r', type: 'raster', source: 's', paint: {opacity: 1}};
// @ts-expect-error a hillshade layer has no `raster-opacity`
const badHillshade: HillshadeLayerSpecification = {id: 'hs', type: 'hillshade', source: 's', paint: {'raster-opacity': 1}};
// @ts-expect-error a symbol layer has no `line-color`
const badSymbol: SymbolLayerSpecification = {id: 'sy', type: 'symbol', source: 's', paint: {'line-color': '#000'}};
export {all, badBackground, badFill, badExtrusion, badLine, badCircle, badHeatmap, badRaster, badHillshade, badSymbol};
