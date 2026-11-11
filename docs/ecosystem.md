# Plugins and frameworks

This report is written by `node test/conformance/ecosystem.mjs --write`. The script reads popular MapLibre plugins and
framework wrappers from npm. It finds the methods of `Map`, the exports of `maplibre-gl` and the map events that each
package uses, and compares them with this library.

The script reads the code as text. It does not run the packages. So a package with "none" in each column can still
have a problem, and a method in the list is possibly used only in a part of the package that you do not use.

**8 of 26 packages** use only parts of the API that this library has.

## What is missing most often

| Missing | Kind | Packages that use it |
|---|---|---|
| `TerrainControl` | export | 5: react-map-gl, @vis.gl/react-maplibre, svelte-maplibre-gl, svelte-maplibre, @maplibre/ngx-maplibre-gl |
| `GlobeControl` | export | 4: react-map-gl, @vis.gl/react-maplibre, svelte-maplibre-gl, @maplibre/ngx-maplibre-gl |
| `LngLat` | export | 4: @watergis/maplibre-gl-terradraw, @indoorequal/vue-maplibre-gl, svelte-maplibre-gl, svelte-maplibre |
| `LogoControl` | export | 4: react-map-gl, @vis.gl/react-maplibre, @indoorequal/vue-maplibre-gl, svelte-maplibre-gl |
| `setWorkerUrl` | export | 4: react-map-gl, @vis.gl/react-maplibre, svelte-maplibre-gl, @maplibre/ngx-maplibre-gl |
| `addProtocol` | export | 3: maplibre-contour, svelte-maplibre-gl, svelte-maplibre |
| `MapSourceDataEvent` | export | 3: react-map-gl, svelte-maplibre-gl, svelte-maplibre |
| `GeoJSONSource` | export | 2: svelte-maplibre-gl, @maplibre/ngx-maplibre-gl |
| `getRTLTextPluginStatus` | export | 2: react-map-gl, @vis.gl/react-maplibre |
| `LngLatBounds` | export | 2: @maplibre/maplibre-gl-geocoder, svelte-maplibre |
| `MapLibreEvent` | export | 2: svelte-maplibre-gl, svelte-maplibre |
| `MapStyleDataEvent` | export | 2: react-map-gl, svelte-maplibre |
| `MapWheelEvent` | export | 2: react-map-gl, svelte-maplibre |
| `setMaxParallelImageRequests` | export | 2: react-map-gl, @vis.gl/react-maplibre |
| `setRTLTextPlugin` | export | 2: react-map-gl, @vis.gl/react-maplibre |
| `setWorkerCount` | export | 2: react-map-gl, @vis.gl/react-maplibre |
| `CanvasSource` | export | 1: svelte-maplibre-gl |
| `config` | export | 1: svelte-maplibre |
| `ErrorEvent` | export | 1: react-map-gl |
| `Event` | export | 1: svelte-maplibre-gl |
| `getVersion` | export | 1: svelte-maplibre-gl |
| `GPUInitializationError` | export | 1: svelte-maplibre |
| `Hash` | export | 1: svelte-maplibre-gl |
| `ImageSource` | export | 1: svelte-maplibre-gl |
| `MapBoxZoomEvent` | export | 1: react-map-gl |
| `MapMouseEvent` | export | 1: svelte-maplibre |
| `MapMovementEvent` | export | 1: svelte-maplibre |
| `RasterDEMTileSource` | export | 1: svelte-maplibre-gl |
| `RasterTileSource` | export | 1: svelte-maplibre-gl |
| `removeProtocol` | export | 1: svelte-maplibre-gl |
| `VectorTileSource` | export | 1: svelte-maplibre-gl |
| `VideoSource` | export | 1: svelte-maplibre-gl |
| `setProjection` | method of `Map` | 6: react-map-gl, vue-maplibre-gl, svelte-maplibre-gl, svelte-maplibre, @maplibre/ngx-maplibre-gl, @maptiler/sdk |
| `setRenderWorldCopies` | method of `Map` | 4: vue-maplibre-gl, @indoorequal/vue-maplibre-gl, svelte-maplibre-gl, @maplibre/ngx-maplibre-gl |
| `setTransformRequest` | method of `Map` | 4: vue-maplibre-gl, @indoorequal/vue-maplibre-gl, svelte-maplibre-gl, @maptiler/sdk |
| `getImage` | method of `Map` | 3: @watergis/maplibre-gl-export, @americana/maplibre-shield-generator, svelte-maplibre-gl |
| `setSky` | method of `Map` | 3: react-map-gl, @vis.gl/react-maplibre, svelte-maplibre-gl |
| `setTransformCameraUpdate` | method of `Map` | 3: react-map-gl, @vis.gl/react-maplibre, svelte-maplibre-gl |
| `setTransformConstrain` | method of `Map` | 3: @maplibre/maplibre-gl-leaflet, svelte-maplibre-gl, @maplibre/ngx-maplibre-gl |
| `getSky` | method of `Map` | 2: react-map-gl, @vis.gl/react-maplibre |
| `setAnisotropicFilterPitch` | method of `Map` | 2: svelte-maplibre-gl, @maplibre/ngx-maplibre-gl |
| `setZoomSnap` | method of `Map` | 2: svelte-maplibre-gl, @maplibre/ngx-maplibre-gl |
| `addSprite` | method of `Map` | 1: svelte-maplibre-gl |
| `fitScreenCoordinates` | method of `Map` | 1: @maplibre/ngx-maplibre-gl |
| `getZoomSnap` | method of `Map` | 1: svelte-maplibre-gl |
| `removeSprite` | method of `Map` | 1: svelte-maplibre-gl |
| `setCenterClampedToGround` | method of `Map` | 1: svelte-maplibre-gl |
| `setCenterElevation` | method of `Map` | 1: @maplibre/ngx-maplibre-gl |
| `setPixelRatio` | method of `Map` | 1: svelte-maplibre-gl |
| `setRoll` | method of `Map` | 1: @maptiler/sdk |
| `setVerticalFieldOfView` | method of `Map` | 1: svelte-maplibre-gl |
| `mousedown` | event | 6: @mapbox/mapbox-gl-draw, @maplibre/maplibre-gl-directions, @deck.gl/mapbox, vue-maplibre-gl, @maplibre/ngx-maplibre-gl, @maptiler/sdk |
| `render` | event | 6: @deck.gl/mapbox, react-map-gl, vue-maplibre-gl, svelte-maplibre-gl, @maplibre/ngx-maplibre-gl, @maptiler/sdk |
| `touchstart` | event | 6: @mapbox/mapbox-gl-draw, @maplibre/maplibre-gl-directions, vue-maplibre-gl, svelte-maplibre, @maplibre/ngx-maplibre-gl, @maptiler/sdk |
| `dblclick` | event | 5: @deck.gl/mapbox, vue-maplibre-gl, svelte-maplibre, @maplibre/ngx-maplibre-gl, @maptiler/sdk |
| `sourcedata` | event | 5: @maplibre/maplibre-gl-inspect, react-map-gl, @vis.gl/react-maplibre, svelte-maplibre, @maplibre/ngx-maplibre-gl |
| `touchend` | event | 5: @mapbox/mapbox-gl-draw, @maplibre/maplibre-gl-directions, vue-maplibre-gl, svelte-maplibre, @maplibre/ngx-maplibre-gl |
| `data` | event | 4: @mapbox/mapbox-gl-draw, svelte-maplibre, @maplibre/ngx-maplibre-gl, @maptiler/sdk |
| `mouseup` | event | 4: @mapbox/mapbox-gl-draw, @maplibre/maplibre-gl-directions, vue-maplibre-gl, @maplibre/ngx-maplibre-gl |
| `touchmove` | event | 4: @mapbox/mapbox-gl-draw, @maplibre/maplibre-gl-directions, vue-maplibre-gl, @maplibre/ngx-maplibre-gl |
| `contextmenu` | event | 3: @maplibre/maplibre-gl-inspect, svelte-maplibre, @maplibre/ngx-maplibre-gl |
| `wheel` | event | 3: svelte-maplibre, @maplibre/ngx-maplibre-gl, @maptiler/sdk |
| `mouseout` | event | 2: @deck.gl/mapbox, @maplibre/ngx-maplibre-gl |
| `boxzoomcancel` | event | 1: @maplibre/ngx-maplibre-gl |
| `boxzoomend` | event | 1: @maplibre/ngx-maplibre-gl |
| `boxzoomstart` | event | 1: @maplibre/ngx-maplibre-gl |
| `dataloading` | event | 1: @maplibre/ngx-maplibre-gl |
| `mouseover` | event | 1: @maplibre/ngx-maplibre-gl |
| `projectiontransition` | event | 1: @maptiler/sdk |
| `remove` | event | 1: @maplibre/ngx-maplibre-gl |
| `sourcedataloading` | event | 1: @maplibre/ngx-maplibre-gl |
| `styledataloading` | event | 1: @maplibre/ngx-maplibre-gl |
| `touchcancel` | event | 1: @maplibre/ngx-maplibre-gl |
| `webglcontextlost` | event | 1: @maplibre/ngx-maplibre-gl |
| `webglcontextrestored` | event | 1: @maplibre/ngx-maplibre-gl |

## Each package

### Drawing and editing

| Package | Version | API in use | Missing methods | Missing exports | Missing events |
|---|---|---|---|---|---|
| @mapbox/mapbox-gl-draw | 1.5.2 | 13 methods, 0 exports, 8 events | none | none | `data`, `mousedown`, `mouseup`, `touchend`, `touchmove`, `touchstart` |
| terra-draw-maplibre-gl-adapter | 1.5.0 | 13 methods, 0 exports, 0 events | none | none | none |
| @watergis/maplibre-gl-terradraw | 1.17.0 | 25 methods, 1 exports, 2 events | none | `LngLat` | none |
| maplibre-gl-measures | 0.0.21 | 17 methods, 0 exports, 0 events | none | none | none |

### Search and directions

| Package | Version | API in use | Missing methods | Missing exports | Missing events |
|---|---|---|---|---|---|
| @maplibre/maplibre-gl-geocoder | 1.9.4 | 9 methods, 3 exports, 3 events | none | `LngLatBounds` | none |
| @maplibre/maplibre-gl-directions | 0.10.1 | 12 methods, 0 exports, 9 events | none | none | `mousedown`, `mouseup`, `touchend`, `touchmove`, `touchstart` |

### Controls and tools

| Package | Version | API in use | Missing methods | Missing exports | Missing events |
|---|---|---|---|---|---|
| @maplibre/maplibre-gl-compare | 0.5.0 | 10 methods, 0 exports, 2 events | none | none | none |
| @maplibre/maplibre-gl-inspect | 1.9.0 | 7 methods, 1 exports, 6 events | none | none | `contextmenu`, `sourcedata` |
| @watergis/maplibre-gl-export | 6.0.0 | 29 methods, 2 exports, 2 events | `getImage` | none | none |
| maplibre-gl-opacity | 1.8.0 | 2 methods, 0 exports, 0 events | none | none | none |
| @mapbox/mapbox-gl-sync-move | 0.4.0 | 7 methods, 0 exports, 1 events | none | none | none |
| maplibre-gl-basemaps | 0.1.3 | 5 methods, 0 exports, 1 events | none | none | none |
| @maplibre/maplibre-gl-style-flipper | not found on npm | | | | |

### Data and layers

| Package | Version | API in use | Missing methods | Missing exports | Missing events |
|---|---|---|---|---|---|
| pmtiles | 4.5.0 | 1 methods, 0 exports, 0 events | none | none | none |
| maplibre-contour | 0.1.1 | 0 methods, 1 exports, 0 events | none | `addProtocol` | none |
| @deck.gl/mapbox | 9.4.1 | 18 methods, 0 exports, 12 events | none | none | `dblclick`, `mousedown`, `mouseout`, `render` |
| @maplibre/maplibre-gl-leaflet | 0.1.4 | 13 methods, 0 exports, 2 events | `setTransformConstrain` | none | none |
| maplibre-gl-vector-text-protocol | 0.0.5 | 1 methods, 0 exports, 0 events | none | none | none |
| @americana/maplibre-shield-generator | 0.2.1 | 7 methods, 0 exports, 1 events | `getImage` | none | none |

### Frameworks

| Package | Version | API in use | Missing methods | Missing exports | Missing events |
|---|---|---|---|---|---|
| react-map-gl | 8.1.3 | 53 methods, 20 exports, 8 events | `getSky`, `setProjection`, `setSky`, `setTransformCameraUpdate` | `ErrorEvent`, `GlobeControl`, `LogoControl`, `MapBoxZoomEvent`, `MapSourceDataEvent`, `MapStyleDataEvent`, `MapWheelEvent`, `TerrainControl`, `getRTLTextPluginStatus`, `setMaxParallelImageRequests`, `setRTLTextPlugin`, `setWorkerCount`, `setWorkerUrl` | `render`, `sourcedata` |
| @vis.gl/react-maplibre | 8.1.3 | 47 methods, 15 exports, 6 events | `getSky`, `setSky`, `setTransformCameraUpdate` | `GlobeControl`, `LogoControl`, `TerrainControl`, `getRTLTextPluginStatus`, `setMaxParallelImageRequests`, `setRTLTextPlugin`, `setWorkerCount`, `setWorkerUrl` | `sourcedata` |
| vue-maplibre-gl | 5.6.1 | 40 methods, 6 exports, 17 events | `setProjection`, `setRenderWorldCopies`, `setTransformRequest` | none | `dblclick`, `mousedown`, `mouseup`, `render`, `touchend`, `touchmove`, `touchstart` |
| @indoorequal/vue-maplibre-gl | 9.0.1 | 39 methods, 9 exports, 5 events | `setRenderWorldCopies`, `setTransformRequest` | `LngLat`, `LogoControl` | none |
| svelte-maplibre-gl | 2.2.1 | 55 methods, 26 exports, 5 events | `addSprite`, `getImage`, `getZoomSnap`, `removeSprite`, `setAnisotropicFilterPitch`, `setCenterClampedToGround`, `setPixelRatio`, `setProjection`, `setRenderWorldCopies`, `setSky`, `setTransformCameraUpdate`, `setTransformConstrain`, `setTransformRequest`, `setVerticalFieldOfView`, `setZoomSnap` | `CanvasSource`, `Event`, `GeoJSONSource`, `GlobeControl`, `Hash`, `ImageSource`, `LngLat`, `LogoControl`, `MapLibreEvent`, `MapSourceDataEvent`, `RasterDEMTileSource`, `RasterTileSource`, `TerrainControl`, `VectorTileSource`, `VideoSource`, `addProtocol`, `getVersion`, `removeProtocol`, `setWorkerUrl` | `render` |
| svelte-maplibre | 2.0.1 | 37 methods, 19 exports, 26 events | `setProjection` | `GPUInitializationError`, `LngLat`, `LngLatBounds`, `MapLibreEvent`, `MapMouseEvent`, `MapMovementEvent`, `MapSourceDataEvent`, `MapStyleDataEvent`, `MapWheelEvent`, `TerrainControl`, `addProtocol`, `config` | `contextmenu`, `data`, `dblclick`, `sourcedata`, `touchend`, `touchstart`, `wheel` |
| @maplibre/ngx-maplibre-gl | 22.3.1 | 51 methods, 11 exports, 46 events | `fitScreenCoordinates`, `setAnisotropicFilterPitch`, `setCenterElevation`, `setProjection`, `setRenderWorldCopies`, `setTransformConstrain`, `setZoomSnap` | `GeoJSONSource`, `GlobeControl`, `TerrainControl`, `setWorkerUrl` | `boxzoomcancel`, `boxzoomend`, `boxzoomstart`, `contextmenu`, `data`, `dataloading`, `dblclick`, `mousedown`, `mouseout`, `mouseover`, `mouseup`, `remove`, `render`, `sourcedata`, `sourcedataloading`, `styledataloading`, `touchcancel`, `touchend`, `touchmove`, `touchstart`, `webglcontextlost`, `webglcontextrestored`, `wheel` |
| @maptiler/sdk | 4.2.1 | 66 methods, 1 exports, 18 events | `setProjection`, `setRoll`, `setTransformRequest` | none | `data`, `dblclick`, `mousedown`, `projectiontransition`, `render`, `touchstart`, `wheel` |
