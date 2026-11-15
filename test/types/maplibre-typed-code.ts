// Values typed with the types of maplibre-gl, passed to `@map-jr/map-jr-gl/maplibre-compat` (issue #208). A project
// that keeps `maplibre-gl` for its type imports, as react-map-gl projects do, needs these to compile. They are not run.
import type * as M from 'maplibre-gl';
import {Map, type StyleSpecification, type LightSpecification, type LayerSpecification, type SourceSpecification, type TerrainSpecification, type ProjectionSpecification, type FillLayerSpecification, type SymbolLayerSpecification, type FilterSpecification, type ExpressionSpecification, type AddLayerObject} from '@map-jr/map-jr-gl/maplibre-compat';
declare const ms: M.StyleSpecification; const a: StyleSpecification = ms;
declare const ml: M.LightSpecification; const b: LightSpecification = ml;
declare const mly: M.LayerSpecification; const c: LayerSpecification = mly;
declare const msrc: M.SourceSpecification; const d: SourceSpecification = msrc;
declare const mt: M.TerrainSpecification; const e: TerrainSpecification = mt;
declare const mp: M.ProjectionSpecification; const f: ProjectionSpecification = mp;
declare const mf: M.FillLayerSpecification; const g: FillLayerSpecification = mf;
declare const msy: M.SymbolLayerSpecification; const h: SymbolLayerSpecification = msy;
declare const mfi: M.FilterSpecification; const i: FilterSpecification = mfi;
declare const mex: M.ExpressionSpecification; const j: ExpressionSpecification = mex;
declare const mal: M.AddLayerObject; const k: AddLayerObject = mal;
declare const map: Map; map.setStyle(ms); map.addLayer(mal); map.addSource('x', msrc); map.setFilter('x', mfi);
console.log(a,b,c,d,e,f,g,h,i,j,k);
