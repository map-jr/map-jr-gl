// The types that public signatures use are exported from the main API (`@map-jr/map-jr-gl`).
// `node test/examples.mjs` checks that it compiles against the built types (dist/types). It is not run.
import {createMap, type Anchor, type FlyOptions, type LngLatBounds, type LngLatBoundsInput, type OverlayOptions} from '@map-jr/map-jr-gl';

const bounds: LngLatBoundsInput = [-74.3, 40.5, -73.7, 40.9];
const anchor: Anchor = 'bottom-left';
const overlay: OverlayOptions = {lngLat: [-74, 40.7], anchor};
const fly: FlyOptions = {speed: 1.2, maxDuration: 3000};
const showBounds = (b: LngLatBounds) => b.getNorth();
createMap(document.body, {style: {version: 8, sources: {}, layers: []}, maxBounds: bounds});
export {overlay, fly, showBounds};
