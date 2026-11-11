/**
 * Controls for the main API: `import {navigation, scale} from 'map-jr-gl/controls'`, then
 * `createMap(el, {controls: [navigation(), scale({position: 'bottom-left'})]})`.
 * Each function returns a description of a control. The map adds the control, and removes it when a later
 * description of the map does not have it. A page that imports one control does not load the code of the others.
 */
import {FullscreenControl, GeolocateControl, NavigationControl, ScaleControl, TerrainControl} from './controls-more.ts';
import type {Control, ControlPosition} from './controls.ts';
import type {ControlSpec} from './host.ts';

const spec = <O extends object>(name: string, make: (options: O) => Control) => (options: O & {position?: ControlPosition} = {} as O) => {
    const {position, ...rest} = options;
    return {key: name + JSON.stringify(options), position, create: () => make(rest as O)} as ControlSpec;
};
/** Buttons to zoom in and out, and a compass that turns the map to the north. */
export const navigation = spec('navigation', (o: {showZoom?: boolean; showCompass?: boolean}) => new NavigationControl(o));
/** A scale bar. */
export const scale = spec('scale', (o: {maxWidth?: number; unit?: 'metric' | 'imperial'}) => new ScaleControl(o));
/** A button that shows the map on the full screen. */
export const fullscreen = spec('fullscreen', (_o: {}) => new FullscreenControl());
/** A button that moves the map to the position of the user. */
export const geolocate = spec('geolocate', (o: {zoom?: number; positionOptions?: PositionOptions}) => new GeolocateControl(o));
/** A button that turns 3D terrain on and off. `source` is the id of an elevation source of the style. */
export const terrain = spec('terrain', (o: {source: string; exaggeration?: number}) => new TerrainControl(o));
export type {ControlSpec, ControlPosition};
