# Plugins and frameworks

This report is written by `node test/conformance/ecosystem.mjs --write`. The script reads popular MapLibre plugins and
framework wrappers from npm. It finds the methods of `Map`, the exports of `maplibre-gl` and the map events that each
package uses, and compares them with this library.

The script reads the code as text. It does not run the packages. So a package with "none" in each column can still
have a problem, and a method in the list is possibly used only in a part of the package that you do not use.

**15 of 26 packages** use only parts of the API that this library has.

## What is missing most often

| Missing | Kind | Packages that use it |
|---|---|---|
| `GlobeControl` | export | 4: react-map-gl, @vis.gl/react-maplibre, svelte-maplibre-gl, @maplibre/ngx-maplibre-gl |
| `MapSourceDataEvent` | export | 3: react-map-gl, svelte-maplibre-gl, svelte-maplibre |
| `GeoJSONSource` | export | 2: svelte-maplibre-gl, @maplibre/ngx-maplibre-gl |
| `MapLibreEvent` | export | 2: svelte-maplibre-gl, svelte-maplibre |
| `MapStyleDataEvent` | export | 2: react-map-gl, svelte-maplibre |
| `MapWheelEvent` | export | 2: react-map-gl, svelte-maplibre |
| `CanvasSource` | export | 1: svelte-maplibre-gl |
| `config` | export | 1: svelte-maplibre |
| `ErrorEvent` | export | 1: react-map-gl |
| `Event` | export | 1: svelte-maplibre-gl |
| `GPUInitializationError` | export | 1: svelte-maplibre |
| `Hash` | export | 1: svelte-maplibre-gl |
| `ImageSource` | export | 1: svelte-maplibre-gl |
| `MapBoxZoomEvent` | export | 1: react-map-gl |
| `MapMouseEvent` | export | 1: svelte-maplibre |
| `MapMovementEvent` | export | 1: svelte-maplibre |
| `RasterDEMTileSource` | export | 1: svelte-maplibre-gl |
| `RasterTileSource` | export | 1: svelte-maplibre-gl |
| `VectorTileSource` | export | 1: svelte-maplibre-gl |
| `VideoSource` | export | 1: svelte-maplibre-gl |
| `setProjection` | method of `Map` | 6: react-map-gl, vue-maplibre-gl, svelte-maplibre-gl, svelte-maplibre, @maplibre/ngx-maplibre-gl, @maptiler/sdk |
| `setRenderWorldCopies` | method of `Map` | 4: vue-maplibre-gl, @indoorequal/vue-maplibre-gl, svelte-maplibre-gl, @maplibre/ngx-maplibre-gl |
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
| `boxzoomcancel` | event | 1: @maplibre/ngx-maplibre-gl |
| `boxzoomend` | event | 1: @maplibre/ngx-maplibre-gl |
| `boxzoomstart` | event | 1: @maplibre/ngx-maplibre-gl |
| `dataloading` | event | 1: @maplibre/ngx-maplibre-gl |
| `projectiontransition` | event | 1: @maptiler/sdk |
| `sourcedataloading` | event | 1: @maplibre/ngx-maplibre-gl |
| `styledataloading` | event | 1: @maplibre/ngx-maplibre-gl |

## Each package

### Drawing and editing

| Package | Version | API in use | Missing methods | Missing exports | Missing events |
|---|---|---|---|---|---|
| @mapbox/mapbox-gl-draw | 1.5.2 | 13 methods, 0 exports, 8 events | none | none | none |
| terra-draw-maplibre-gl-adapter | 1.5.0 | 13 methods, 0 exports, 0 events | none | none | none |
| @watergis/maplibre-gl-terradraw | 1.17.0 | 25 methods, 1 exports, 2 events | none | none | none |
| maplibre-gl-measures | 0.0.21 | 17 methods, 0 exports, 0 events | none | none | none |

### Search and directions

| Package | Version | API in use | Missing methods | Missing exports | Missing events |
|---|---|---|---|---|---|
| @maplibre/maplibre-gl-geocoder | 1.9.4 | 9 methods, 3 exports, 3 events | none | none | none |
| @maplibre/maplibre-gl-directions | 0.10.1 | 12 methods, 0 exports, 9 events | none | none | none |

### Controls and tools

| Package | Version | API in use | Missing methods | Missing exports | Missing events |
|---|---|---|---|---|---|
| @maplibre/maplibre-gl-compare | 0.5.0 | 10 methods, 0 exports, 2 events | none | none | none |
| @maplibre/maplibre-gl-inspect | 1.9.0 | 7 methods, 1 exports, 6 events | none | none | none |
| @watergis/maplibre-gl-export | 6.0.0 | 29 methods, 2 exports, 2 events | `getImage` | none | none |
| maplibre-gl-opacity | 1.8.0 | 2 methods, 0 exports, 0 events | none | none | none |
| @mapbox/mapbox-gl-sync-move | 0.4.0 | 7 methods, 0 exports, 1 events | none | none | none |
| maplibre-gl-basemaps | 0.1.3 | 5 methods, 0 exports, 1 events | none | none | none |
| @maplibre/maplibre-gl-style-flipper | not found on npm | | | | |

### Data and layers

| Package | Version | API in use | Missing methods | Missing exports | Missing events |
|---|---|---|---|---|---|
| pmtiles | 4.5.0 | 1 methods, 0 exports, 0 events | none | none | none |
| maplibre-contour | 0.1.1 | 0 methods, 1 exports, 0 events | none | none | none |
| @deck.gl/mapbox | 9.4.1 | 18 methods, 0 exports, 12 events | none | none | none |
| @maplibre/maplibre-gl-leaflet | 0.1.4 | 13 methods, 0 exports, 2 events | `setTransformConstrain` | none | none |
| maplibre-gl-vector-text-protocol | 0.0.5 | 1 methods, 0 exports, 0 events | none | none | none |
| @americana/maplibre-shield-generator | 0.2.1 | 7 methods, 0 exports, 1 events | `getImage` | none | none |

### Frameworks

| Package | Version | API in use | Missing methods | Missing exports | Missing events |
|---|---|---|---|---|---|
| react-map-gl | 8.1.3 | 53 methods, 20 exports, 8 events | `getSky`, `setProjection`, `setSky`, `setTransformCameraUpdate` | `ErrorEvent`, `GlobeControl`, `MapBoxZoomEvent`, `MapSourceDataEvent`, `MapStyleDataEvent`, `MapWheelEvent` | none |
| @vis.gl/react-maplibre | 8.1.3 | 47 methods, 15 exports, 6 events | `getSky`, `setSky`, `setTransformCameraUpdate` | `GlobeControl` | none |
| vue-maplibre-gl | 5.6.1 | 40 methods, 6 exports, 17 events | `setProjection`, `setRenderWorldCopies` | none | none |
| @indoorequal/vue-maplibre-gl | 9.0.1 | 39 methods, 9 exports, 5 events | `setRenderWorldCopies` | none | none |
| svelte-maplibre-gl | 2.2.1 | 55 methods, 26 exports, 5 events | `addSprite`, `getImage`, `getZoomSnap`, `removeSprite`, `setAnisotropicFilterPitch`, `setCenterClampedToGround`, `setPixelRatio`, `setProjection`, `setRenderWorldCopies`, `setSky`, `setTransformCameraUpdate`, `setTransformConstrain`, `setVerticalFieldOfView`, `setZoomSnap` | `CanvasSource`, `Event`, `GeoJSONSource`, `GlobeControl`, `Hash`, `ImageSource`, `MapLibreEvent`, `MapSourceDataEvent`, `RasterDEMTileSource`, `RasterTileSource`, `VectorTileSource`, `VideoSource` | none |
| svelte-maplibre | 2.0.1 | 37 methods, 19 exports, 26 events | `setProjection` | `GPUInitializationError`, `MapLibreEvent`, `MapMouseEvent`, `MapMovementEvent`, `MapSourceDataEvent`, `MapStyleDataEvent`, `MapWheelEvent`, `config` | none |
| @maplibre/ngx-maplibre-gl | 22.3.1 | 51 methods, 11 exports, 46 events | `fitScreenCoordinates`, `setAnisotropicFilterPitch`, `setCenterElevation`, `setProjection`, `setRenderWorldCopies`, `setTransformConstrain`, `setZoomSnap` | `GeoJSONSource`, `GlobeControl` | `boxzoomcancel`, `boxzoomend`, `boxzoomstart`, `dataloading`, `sourcedataloading`, `styledataloading` |
| @maptiler/sdk | 4.2.1 | 66 methods, 1 exports, 18 events | `setProjection`, `setRoll` | none | `projectiontransition` |
