# The compat entry

The entry `@map-jr/map-jr-gl/maplibre-compat` has the API of MapLibre GL JS 6.17, so that code and plugins for MapLibre
GL JS run with a change of the import. This page lists what the entry exports and every member of its `Map`. See
[From MapLibre GL JS](../migrate/from-maplibre.md) for the steps to move an application to it.

```js
import {
  Map,
  Marker,
  NavigationControl,
} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 13,
});
map.addControl(new NavigationControl());
new Marker().setLngLat([-74.0065, 40.7085]).addTo(map);
```

## Where the entry differs from MapLibre GL JS

These differences change the code of most applications:

- [`queryRenderedFeatures`](#queryrenderedfeatures) and `querySourceFeatures` return an array that is also a
  promise. Only the promise has the complete result.
- [`setStyle`](#setstyle), [`addImage`](#addimage) and `updateImage` return a promise where MapLibre GL JS returns
  the map.
- `maxPitch` and `setMaxPitch` accept at most 90 degrees, where MapLibre GL JS accepts up to 180. A higher value is
  limited to 90. The default is 60 in both.
- The camera has no roll, and its field of view is fixed. `setRoll` and `setVerticalFieldOfView` have no effect.
- The map has no private members of MapLibre GL JS, such as `map.transform` and `map.painter`.
- The library does not validate the style, and the option `validate` has no effect. It does not draw a layer type
  that it does not support, and an expression that it does not support returns `null`: see
  [The style is not validated](../migrate/from-maplibre.md#the-style-is-not-validated).
- When the browser cannot start WebGL2, the constructor does not throw a `GPUInitializationError`. The map fires
  `error` with that error and shows a message in the container. Call `supported()` before you create the map.

[MapLibre compatibility](../maplibre-compatibility.md) is the complete list of the differences, of what is not
available, and of the types that differ.

## Options of `new Map`

`new Map(options)` accepts the options of MapLibre GL JS. These options exist only in this library:

| Name | Type | Default | Description |
|---|---|---|---|
| `renderer` | `'auto' \| 'worker' \| 'main'` | `'auto'` | The thread that renders the map: see [`renderer`](description.md#renderer) of the main API for each value. |
| [`strict`](#strict) | `boolean` | `false` | Whether an option or a call that the map cannot carry out throws an error. |
| `fonts` | `FontSource[]` | | Web fonts for labels, for example `[{family: 'Open Sans', src: '/fonts/open-sans.woff2', weight: '300 800'}]`. |
| `fontFamily` | `string` | `'"Noto Sans", "Helvetica Neue", Arial, sans-serif'` | The CSS font family for labels that have no glyph file and no web font. |
| `nonce` | `string` | | The nonce of a [Content Security Policy](../loading.md#content-security-policy) with `style-src 'nonce-…'`. |

These options of MapLibre GL JS have no effect: `renderWorldCopies: false`, `canvasContextAttributes` other than
`antialias`, `logoPosition`, `validate` with any value, `fadeDuration` other than 300, `pitchWithRotate: false`, and
`projection` other than `'mercator'`.

A custom layer (`type: 'custom'`) needs `renderer: 'main'`. With `'auto'` or `'worker'`, `addLayer` adds nothing.

### `strict`

With `strict: true`, the map throws an error in these cases, and otherwise the call or the option does nothing:

- an option of the list above, with the value that the list names;
- a method or a member of [`Map`](#map) that has no effect, with a value other than the default of MapLibre GL JS,
  such as `setRoll(10)` or `showTileBoundaries = true`;
- `setTransformConstrain` with a function, when the map does not draw on the main thread;
- a change of the style that the map refuses and reports with an `error` event, such as `addLayer` with a custom
  layer and without `renderer: 'main'`. Without `strict`, the map fires `error`.

A call that has no effect for any value, such as `setAnisotropicFilterPitch` or `setRTLTextPlugin`, does not throw.

## `Map`

The methods and members of MapLibre GL JS keep their names and arguments. A row that starts with "Only in this
library" names a member that MapLibre GL JS does not have.

<!-- ref:CompatMap:start -->
| Name | Type | Description |
|---|---|---|
| `on` | `<T extends keyof MapLayerEventType>(type: T, layerId: string \| string[], listener: (e: MapLayerEventType[T]) => void) => this` | Adds a listener for an event; `on(type, layerId, listener)` hears `click`, `mousemove`, `mouseenter` and `mouseleave` over the features of a style layer. |
| `once` | `<T extends keyof MapEventType>(type: T, listener: (e: MapEventType[T]) => void) => this` | Calls `listener` one time, for the next event of `type`, as in MapLibre GL JS. |
| `off` | `<T extends keyof MapLayerEventType>(type: T, layerId: string \| string[], listener: (e: MapLayerEventType[T]) => void) => this` | Removes a listener that `on` added, as in MapLibre GL JS. |
| `getSource` | `<T extends Source = Source>(id: string) => T \| undefined` | Returns the specification of the source with this id and the methods of its type, or `undefined` when the style has no such source. |
| `easeTo` | `(o: EaseToOptions, eventData?: EventData) => this` | Moves the camera to a view with an animation of 500 ms unless `o` sets `duration`, as in MapLibre GL JS. |
| [`setStyle`](#setstyle) | `(style: unknown, options?: StyleSwapOptions) => Promise<void>` | Replaces the style with a style URL or a style object, and returns a promise that settles when the new style has loaded. |
| `getStyle` | `() => StyleSpecification` | The style, as in MapLibre GL JS. |
| `cooperativeGestures` (read only) | `{enable(): void; disable: () => void; isEnabled: () => boolean; isActive: () => boolean}` | As in MapLibre GL JS: with it on, the wheel zooms only with Ctrl (⌘ on a Mac), and one finger scrolls the page. |
| `project` | `(lngLat: LngLatLike) => Point` | As in MapLibre, a `Point` with methods (`dist`, `sub`, …), not a plain object. |
| `version` (read only) | `string` | The version of this library, as the member `version` of a map of MapLibre GL JS. |
| `setRenderWorldCopies` | `(copies?: boolean \| null \| undefined) => Map` | Has no effect: the map always draws copies of the world side by side. |
| `setRoll` | `(roll?: number \| undefined) => Map` | Has no effect: the camera has no roll. |
| `setVerticalFieldOfView` | `(fov?: number \| undefined) => Map` | Has no effect: the vertical field of view stays at 36.87 degrees. |
| `getVerticalFieldOfView` | `() => number` | Returns 36.87, the vertical field of view of the camera in degrees, which is the default of MapLibre GL JS. |
| `coveringTiles` | `(o: {tileSize: number; minzoom?: number; maxzoom?: number; roundZoom?: boolean}) => {canonical: {z: number; x: number; y: number; key: string}; wrap: number; overscaledZ: number; key: string}[]` | Returns the tiles that cover the view as plain objects `{canonical: {z, x, y, key}, wrap, overscaledZ, key}`; MapLibre GL JS returns `OverscaledTileID` objects. |
| `calculateCameraOptionsFromTo` | `(from: LngLatLike, altitudeFrom: number, to: LngLatLike, altitudeTo?: number \| undefined) => {center: LngLat; elevation: number; zoom: number; pitch: number; bearing: number}` | The camera options that look from `from` at `altitudeFrom` metres to `to` at `altitudeTo` metres, as in MapLibre GL JS. |
| `calculateCameraOptionsFromCameraLngLatAltRotation` | `(cameraLngLat: LngLatLike, cameraAlt: number, bearing: number, pitch: number, roll?: number \| undefined) => object` | The camera options that put the camera at `cameraLngLat` and `cameraAlt` metres with this rotation, as in MapLibre GL JS. |
| `calculateAnchoredCameraOptions` | `(o: {anchorLocation: LngLatLike; anchorScreenPoint: PointLike; zoom?: number}) => {center: LngLat; zoom: number}` | The centre and zoom that put `anchorLocation` at `anchorScreenPoint`, at `zoom` (default: the zoom of the map), as in MapLibre GL JS. |
| `setCenterClampedToGround` | `(clamped?: boolean \| undefined) => Map` | Has no effect: the map center is always on the ground. |
| `getCenterClampedToGround` | `() => boolean` | Returns `true`: the map center is always on the ground. |
| `setCenterElevation` | `(elevation?: number \| undefined) => Map` | Has no effect: the map center is always on the ground. |
| `setAnisotropicFilterPitch` | `(_pitch?: number \| null \| undefined) => Map` | Has no effect. |
| `getAnisotropicFilterPitch` | `() => number` | Returns 20, the default of MapLibre GL JS. |
| `setTransformCameraUpdate` | `(fn?: ((tr: CameraLike) => CameraChanges \| undefined) \| null \| undefined) => Map` | Has no effect: the map does not draw the camera that the function returns. |
| `showTileBoundaries` | `boolean` | Has no effect: the map does not draw tile borders. |
| `showPadding` | `boolean` | Has no effect: the map does not draw the padding. |
| `showCollisionBoxes` | `boolean` | Has no effect: the map does not draw collision boxes. |
| `showOverdrawInspector` | `boolean` | Has no effect: the map has no overdraw view. |
| `setSourceTileLodParams` | `(maxZoomLevelsOnScreen: number, tileCountMaxMinRatio: number, sourceId?: string \| undefined) => Map` | Changes the level of detail of the tile cover of a pitched view for one source, or for all sources, as in MapLibre GL JS. |
| `setTransformConstrain` | `(fn?: ((lngLat: LngLat, zoom: number) => {center: LngLatLike; zoom: number}) \| null \| undefined) => Map` | As in MapLibre GL JS, `fn(lngLat, zoom)` returns `{center, zoom}` and replaces the constraint of the camera; null restores it. |
| `setZoomSnap` | `(snap: number) => Map` | Sets the step of the zoom, as in MapLibre GL JS: above 0, a camera method ends at the nearest multiple of it. |
| `getZoomSnap` | `() => number` | Returns the step of the zoom that the option `zoomSnap` or `setZoomSnap` set, or 0 when the zoom does not snap. |
| `cameraForBounds` | `(bounds: LngLatBoundsInput, o?: {padding?: PaddingInput; maxZoom?: number} \| undefined) => {center: {lng: number; lat: number}; zoom: number; bearing: number}` | The centre and zoom that fit `bounds` ([west, south, east, north] or [[west, south], [east, north]]) in view. |
| `setEventedParent` | `(parent?: {fire(e: object): unknown; listens?(type: string): boolean} \| null \| undefined, data?: object \| (() => object) \| undefined) => Map` | As in MapLibre GL JS: each event of the map also goes to `parent.fire`, as one object with the fields of `data` (or of what the function `data` returns), while `parent.listens(type)` is true. |
| `fire` | `(type: string \| {type: string}, data?: Record<string, unknown>) => void \| PromiseLike<unknown>` | Calls the listeners of the event `type` with `data` as the event, as in MapLibre GL JS. |
| `setMissingStyleImageResolver` | `(resolver: ((id: string) => void \| Promise<void>) \| null) => Map` | Sets a function that supplies images on demand, as in MapLibre GL JS. |
| [`addImage`](#addimage) | `(name: string, source: string \| ImageData \| object \| CanvasImageSource, options?: ImageOptions \| undefined) => Promise<Map>` | Makes an image available to `icon-image` under `name`, and returns a promise of the map; MapLibre GL JS returns the map. The `object` has the members `width`, `height` and `data`. |
| `addControl` | `(control: Control, position?: ControlPosition \| undefined) => Map` | Adds a control to a corner of the map, as in MapLibre GL JS. |
| `addLayer` | `(layer: AddLayerObject, beforeId?: string \| undefined) => Map` | Adds a style layer below the layer `beforeId`, or on top when `beforeId` is left out, as in MapLibre GL JS. |
| `removeLayer` | `(id: string) => Map` | Removes a style layer, as in MapLibre GL JS. |
| `getStyleUrl` | `() => string \| null` | The URL given as the option `style` or to the latest call of `setStyle`, as it was written; `null` when that was an object or nothing. |
| `listens` | `(type: string) => boolean` | Whether the map has a listener for the event `type`, a listener for a layer included. |
| `addSource` | `(id: string, source: object) => Map` | Adds a source to the style, as in MapLibre GL JS. |
| `removeSource` | `(id: string) => Map` | Removes a source from the style, as in MapLibre GL JS. |
| `jumpTo` | `(o: CameraInput, eventData?: EventData \| undefined) => Map` | Moves the camera to a view without an animation, as in MapLibre GL JS. |
| `fitBounds` | `(bounds: LngLatBoundsInput, o?: FitBoundsOptions, eventData?: EventData \| undefined) => Map` | Moves the camera to fit a box, as in MapLibre GL JS: it flies there as `flyTo` does, or eases there as `easeTo` does when `o` sets `linear`. |
| `fitScreenCoordinates` | `(p0: PointLike, p1: PointLike, bearing: number, o?: FitBoundsOptions, eventData?: EventData \| undefined) => Map` | Moves the map so that the box between the screen points `p0` and `p1` (CSS pixels) fills the view at `bearing`. |
| `flyTo` | `(o: Omit<CameraOptions, 'padding'> & {padding?: PaddingInput} & object & `[`FlyOptions`](map.md#flyoptions)`, eventData?: EventData \| undefined) => Map` | Moves the camera along a curve that zooms out and back in, with the options of `flyTo` of MapLibre GL JS 6.17. The `object` has the members `duration`, `around`, `essential`, `offset` and `easing`. |
| `setPadding` | `(padding: PaddingInput, eventData?: EventData \| undefined) => Map` | Sets the padding in CSS pixels: the space at the edges that other things cover, such as a side panel. |
| `getPadding` | `() => {top: number; right: number; bottom: number; left: number}` | Returns the padding of the map in CSS pixels, as `{top, right, bottom, left}`. |
| `setCenter` | `(center: LngLatLike, eventData?: EventData \| undefined) => Map` | Moves the map center to a position without an animation, as in MapLibre GL JS. |
| `setZoom` | `(zoom: number, eventData?: EventData \| undefined) => Map` | Sets the zoom level without an animation, as in MapLibre GL JS. |
| `setBearing` | `(bearing: number, eventData?: EventData \| undefined) => Map` | Sets the bearing in degrees without an animation, as in MapLibre GL JS. |
| `setPitch` | `(pitch: number, eventData?: EventData \| undefined) => Map` | Sets the pitch in degrees without an animation, as in MapLibre GL JS. |
| `resetNorth` | `(o?: {duration?: number}, eventData?: EventData \| undefined) => Map` | Turns the map to bearing 0 with an animation of 1000 ms unless `o` sets `duration`, as in MapLibre GL JS. |
| `resetNorthPitch` | `(o?: {duration?: number}, eventData?: EventData \| undefined) => Map` | Turns the map to bearing 0 and pitch 0 with an animation of 1000 ms unless `o` sets `duration`, as in MapLibre GL JS. |
| `panTo` | `(center: LngLatLike, o?: {duration?: number}, eventData?: EventData \| undefined) => Map` | Moves the map center to a position with an animation of 500 ms unless `o` sets `duration`, as in MapLibre GL JS. |
| `panBy` | `(offset: [number, number], o?: {duration?: number}, eventData?: EventData \| undefined) => Map` | Moves the map by `offset` in CSS pixels with an animation of 500 ms unless `o` sets `duration`, as in MapLibre GL JS. |
| `zoomTo` | `(zoom: number, o?: {duration?: number}, eventData?: EventData \| undefined) => Map` | Changes the zoom level with an animation of 500 ms unless `o` sets `duration`, as in MapLibre GL JS. |
| `zoomIn` | `(o?: {duration?: number}, eventData?: EventData \| undefined) => Map` | Increases the zoom level by 1 with an animation of 500 ms unless `o` sets `duration`, as in MapLibre GL JS. |
| `zoomOut` | `(o?: {duration?: number}, eventData?: EventData \| undefined) => Map` | Decreases the zoom level by 1 with an animation of 500 ms unless `o` sets `duration`, as in MapLibre GL JS. |
| `rotateTo` | `(bearing: number, o?: {duration?: number}, eventData?: EventData \| undefined) => Map` | Changes the bearing in degrees with an animation of 500 ms unless `o` sets `duration`, as in MapLibre GL JS. |
| `snapToNorth` | `(o?: {duration?: number}, eventData?: EventData \| undefined) => Map` | Turns the map to bearing 0 when the bearing is less than 7 degrees from north, where the option `bearingSnap` of MapLibre GL JS has no effect. |
| `getRenderWorldCopies` | `() => boolean` | Returns `true`: the map always draws copies of the world. |
| `getRoll` | `() => number` | Returns 0: the camera has no roll. |
| `getCenterElevation` | `() => number` | Returns the elevation of the ground at the map center in metres, multiplied by the exaggeration of the terrain, or 0 without 3D terrain. |
| `getCameraTargetElevation` | `() => number` | Returns the elevation of the ground at the map center in metres, as `getCenterElevation` does. |
| `isZooming` | `() => boolean` | Whether the zoom level changes now, by the user or by a camera method. |
| `isRotating` | `() => boolean` | Whether the bearing changes now, by the user or by a camera method. |
| `isRolling` | `() => boolean` | Returns `false`: the camera has no roll. |
| `isPitching` | `() => boolean` | Whether the pitch changes now, by the user or by a camera method. |
| `getCanvasContainer` | `() => HTMLElement` | Returns the container of the map. |
| `remove` | `() => void` | Removes the map and its controls from the page, as in MapLibre GL JS. |
| `redraw` | `() => Map` | Draws the map again in the next frame. |
| `style` (read only) | `object` | For wrappers that read the private `style` of MapLibre GL JS: `_loaded`, `updateImage`, and `tileManagers` (also `sourceCaches`) with the id, type and `vectorLayerIds` of each source. |
| `transform` (read only) | `object` | For wrappers that read the private `transform` of MapLibre GL JS: `center`, `zoom`, `bearing`, `pitch`, `roll`, `elevation` and `isPaddingEqual`, as a copy of the camera. |
| `getTransformForUpdate` | `() => object` | The camera that wrappers compare their state with (`transform`); MapLibre GL JS 6 has this name, and 5 has `_getTransformForUpdate`. |
| `getLight` | `() => {anchor?: string; position?: number[]; color?: string; intensity?: number}` | Returns the fields of the light that the style sets, or `{}` when the style has no light. |
| `getLayersOrder` | `() => string[]` | Returns the ids of the style layers, from the bottom layer up. |
| `getPaintProperty` | `(layerId: string, name: string) => unknown` | Returns the value of a paint property as the style sets it, or `undefined` when the style does not set it. |
| `getLayoutProperty` | `(layerId: string, name: string) => unknown` | Returns the value of a layout property as the style sets it, or `undefined` when the style does not set it. |
| `getFilter` | `(layerId: string) => unknown` | Returns the filter of a style layer, or `undefined` when it has none. |
| `moveLayer` | `(id: string, beforeId?: string \| undefined) => Map` | Moves a style layer below the layer `beforeId`, or to the top when `beforeId` is left out. |
| `getSprite` | `() => {id: string; url: string}[]` | Returns the sprites of the style as `{id, url}` objects. |
| `setSprite` | `(url: string \| {id: string; url: string}[] \| null) => Map` | Replaces the sprites of the style, or removes them with `null`. |
| `addSprite` | `(id: string, url: string) => Map` | Adds a sprite sheet with an id and a URL to the style, as in MapLibre GL JS. |
| `removeSprite` | `(id: string) => Map` | Removes the sprite sheet with this id from the style. |
| `getGlyphs` | `() => string \| null` | Returns the URL of the glyph files of the style, or `null` when the style has none. |
| `setGlyphs` | `(url: string \| null) => Map` | Sets the URL of the glyph files of the style. |
| `getFontFaces` | `() => Record<string, unknown> \| null` | Returns the `font-faces` of the style, or `null` when the style has none. |
| `setFontFaces` | `(faces: Record<string, unknown> \| null) => Map` | Replaces the `font-faces` of the style, or removes them with `null`. |
| `setFeatureState` | `(feature: FeatureIdentifier, state: Record<string, unknown>) => Map` | Merges `state` into the feature state of one feature. |
| `getFeatureState` | `(feature: FeatureIdentifier) => Record<string, unknown>` | Returns the feature state of one feature. |
| `getImage` | `(name: string) => object \| undefined` | Returns `{data, pixelRatio, sdf}` and the other options of an image that `addImage` added, or `undefined`. |
| `listImages` | `() => string[]` | Returns the names of the images that the map has. |
| `loadImage` | `(url: string) => Promise<{data: ImageBitmap}>` | Fetches and decodes the image at a URL, and returns a promise of `{data}` with an `ImageBitmap`, as in MapLibre GL JS. |
| `querySourceFeatures` | `(sourceId: string, options?: QuerySourceFeatureOptions) => GeoJSONFeature[] & PromiseLike<GeoJSONFeature[]>` | Returns the features of a source in the tiles of the present view, as an array that is also a promise; MapLibre GL JS returns only the array. |
| [`queryRenderedFeatures`](#queryrenderedfeatures) | `(geometry?: PointLike \| [PointLike, PointLike] \| RenderedQueryOptions, options?: RenderedQueryOptions) => MapGeoJSONFeature[] & PromiseLike<MapGeoJSONFeature[]>` | Returns the features that the style layers draw at a point or in a box of the screen, the top layer first, as an array that is also a promise; MapLibre GL JS returns only the array. |
| `refreshTiles` | `(sourceId: string) => Map` | Loads the tiles of a source again, for example after the data behind its URL changed. |
| `dragPan` (read only) | `InteractionHandler` | A drag with the mouse or one finger moves the map. |
| `scrollZoom` (read only) | `InteractionHandler` | The scroll wheel and the trackpad zoom the map. |
| `doubleClickZoom` (read only) | `InteractionHandler` | A double click or a double tap zooms in by one level. |
| `dragRotate` (read only) | `InteractionHandler` | A drag with the right mouse button, or with Ctrl and the left one, turns and tilts the map. |
| `touchZoomRotate` (read only) | `TouchZoomRotateHandler` | A pinch with two fingers zooms and turns the map; `disableRotation()` keeps the zoom only. |
| `touchPitch` (read only) | `InteractionHandler` | A drag up or down with two fingers tilts the map. |
| `keyboard` (read only) | `InteractionHandler` | The arrow keys, `+` and `-` move, turn and zoom the map while it has the focus. |
| `boxZoom` (read only) | `InteractionHandler` | Shift and drag draws a box, and the map zooms to it. |
| `renderer` | `'worker' \| 'main'` | Only in this library: the thread that draws the map, `'worker'` or `'main'`. |
| `setPixelRatio` | `(ratio?: number \| null \| undefined) => Map` | Sets the number of canvas pixels for each CSS pixel. |
| `setTransformRequest` | `(fn: RequestTransform \| null) => Map` | Sets or removes the function that changes each request (for example, to add a header). |
| `setCursor` | `(cursor: string) => Map` | Only in this library: sets the CSS cursor over the map, such as `'pointer'` over something that the user can click. |
| `getCenter` | `() => LngLat` | Returns the map center. |
| `getZoom` | `() => number` | Returns the zoom level. |
| `getBearing` | `() => number` | Returns the bearing in degrees clockwise from north. |
| `getPitch` | `() => number` | Returns the pitch in degrees from straight down. |
| `getMinZoom` | `() => number` | Returns the smallest zoom level that the user can reach. |
| `getMaxZoom` | `() => number` | Returns the largest zoom level that the user can reach. |
| `getContainer` | `() => HTMLElement` | Returns the element that holds the map. |
| `getCanvas` | `() => HTMLCanvasElement` | Returns the canvas that the map draws on. |
| `toBlob` | `(type?, quality?: number) => Promise<Blob>` | Only in this library: returns a promise of the map as an image. |
| `loaded` | `() => boolean` | As in MapLibre: `false` from a call of `setStyle`, a style edit, a source change or a camera move until the next complete frame (the frame that fires `idle`). |
| `isMoving` | `() => boolean` | Whether the camera moves now, by the user or by a camera method. |
| `unproject` | `(point: {x: number; y: number} \| [number, number]) => LngLat` | Converts a point of the screen, in CSS pixels from the top left corner of the map, to a position. |
| `isLocationOccluded` | `(lngLat: LngLatLike) => boolean` | Only in this library: whether the far side of the globe hides a position from the camera. |
| `getBounds` | `() => LngLatBounds` | Returns the smallest box that contains the visible map. |
| `stop` | `() => Map` | Stops the animation of the camera, where it is. |
| `setMinZoom` | `(z?: number \| null \| undefined) => Map` | Sets the smallest zoom level that the user can reach. |
| `setMaxZoom` | `(z?: number \| null \| undefined) => Map` | Sets the largest zoom level that the user can reach. |
| `setMaxPitch` | `(p?: number \| null \| undefined) => Map` | Sets the largest pitch that the user can reach, in degrees. |
| `getMaxPitch` | `() => number` | Returns the largest pitch that the user can reach, in degrees. |
| `getMinPitch` | `() => number` | Returns the smallest pitch that the user can reach, in degrees. |
| `setMinPitch` | `(p?: number \| null \| undefined) => Map` | Sets the smallest pitch that the user can reach, in degrees, from 0 to the largest pitch. |
| `setMaxBounds` | `(bounds?: LngLatBoundsInput \| null \| undefined) => Map` | Keeps the map center inside a box (`[[west, south], [east, north]]`), or lifts the restriction with `null`. |
| `getMaxBounds` | `() => {getWest: () => number; getSouth: () => number; getEast: () => number; getNorth: () => number; toArray: () => number[][]} \| null` | Returns the box that the map center stays in, or `null` when there is none. |
| `getPixelRatio` | `() => number` | Returns the ratio of device pixels to CSS pixels that the canvas uses. |
| `queryTerrainElevation` | `(lngLat: LngLatLike) => number \| null` | Returns the elevation of the ground at a position in metres, multiplied by the exaggeration as in MapLibre GL JS, or `null` without 3D terrain. |
| `isSourceLoaded` | `(id: string) => boolean` | Whether the data of one source is loaded for the current view. |
| `isStyleLoaded` | `() => boolean` | Whether the style has loaded. |
| `areTilesLoaded` | `() => boolean` | Whether the tiles of the current view have loaded. |
| `triggerRepaint` | `() => void` | Draws the map again in the next frame. |
| `resize` | `() => Map` | Reads the size of the container again and resizes the map to it. |
| `setProjection` | `(projection?: ProjectionSpecification \| null \| undefined) => Map` | Sets the projection of the style, as MapLibre GL JS does: `{type: 'globe'}`, `{type: 'mercator'}`, or `null` for the default (Mercator). |
| `getProjection` | `() => ProjectionSpecification \| undefined` | The projection of the style as it was given (`undefined` when the style has none), as in MapLibre GL JS. |
| `removeFeatureState` | `(target: {source: string; sourceLayer?: string; id?: string \| number}, key?: string \| undefined) => Map` | Removes one key of a feature's state, a feature's whole state (no `key`), or all state of a source (no `id`). |
| `getGlobalState` | `() => Record<string, unknown>` | The values `global-state` expressions read: the style's `state` defaults with anything set since. |
| `setGlobalStateProperty` | `(name: string, value: unknown) => Map` | Sets one global state value (`null` or `undefined` returns it to the style's default); layers that read it update. |
| `setTerrain` | `(terrain: {source: string; exaggeration?: number} \| null) => Map` | Turns 3D terrain on (`{source, exaggeration}`, naming a raster-dem source) or off (`null`). |
| `getTerrain` | `() => {source: string; exaggeration?: number} \| null` | Returns the `terrain` of the style, or `null` when the map has no 3D terrain. |
| `setLight` | `(light: {anchor?: 'map' \| 'viewport'; position?: [number, number, number]; color?: string; intensity?: number}) => Map` | Sets the light on buildings: its anchor, position (distance, azimuth, polar angle), color and intensity. |
| `setSky` | `(sky?: Record<string, unknown> \| null \| undefined) => Map` | Sets the sky above the horizon and the fog on 3D terrain (the `sky` of the style); `null` removes them. |
| `getSky` | `() => Record<string, unknown> \| null \| undefined` | The `sky` of the style: `undefined` when the style has none, and `null` after `setSky(null)` removed it. |
| `getLayer` | `(id: string) => any` | Returns the style layer with this id as an object of the style specification (`id`, `type`, `paint`, `layout` and the others), or `undefined`. |
| `setLayerZoomRange` | `(id: string, minzoom?: number \| null \| undefined, maxzoom?: number \| null \| undefined) => Map` | Changes the zooms at which a layer is drawn, without a new style. |
| `setPaintProperty` | `(layerId: string, name: string, value: unknown) => Map` | Sets the value of a paint property of a style layer. |
| `setLayoutProperty` | `(layerId: string, name: string, value: unknown) => Map` | Sets the value of a layout property of a style layer. |
| `setFilter` | `(layerId: string, filter: unknown) => Map` | Sets the filter of a style layer. |
| `removeControl` | `(control: Control) => Map` | Removes a control that `addControl` added. |
| `hasControl` | `(control: Control) => boolean` | Whether the map has this control. |
| `addFonts` | `(fonts: FontSource[]) => Map` | Only in this library: loads more web fonts for labels after the map is created. |
| `removeImage` | `(name: string) => Map` | Removes an image that `addImage` added. |
| `updateImage` | `(name: string, source: string \| ImageData \| {width: number; height: number; data: Uint8Array<ArrayBufferLike> \| Uint8ClampedArray<ArrayBufferLike>} \| CanvasImageSource) => Promise<Map>` | Replaces the pixels of an image added earlier, keeps its options (stretch, content, sdf) and returns a promise of the map; MapLibre GL JS returns the map. |
| `hasImage` | `(name: string) => boolean` | Whether the map has an image with this name. |
| `queryFeatures` | `(at?: FeaturePlace \| LngLatLike \| `[`FeatureOptions`](map.md#featureoptions)`, o?: `[`FeatureOptions`](map.md#featureoptions)`) => Promise<`[`RenderedFeature`](types.md#renderedfeature)`[]>` | Only in this library: returns a promise of the features that the style layers draw, the top one first. |
| `querySource` | `(sourceId: string, at?: FeaturePlace \| LngLatLike \| `[`SourceOptions`](map.md#sourceoptions)`, o?: `[`SourceOptions`](map.md#sourceoptions)`) => Promise<`[`QueriedFeature`](types.md#queriedfeature)`[]>` | Only in this library: returns a promise of the features of the tile data of the source `sourceId`. |
| `queryElevation` | `(at: LngLatLike \| {x: number; y: number}, options?: {source?: string; zoom?: number}) => Promise<number \| null>` | Only in this library: returns a promise of the elevation of the ground in metres at a position, from the raster-dem source of the style, or `null` where it has no data. |
| `getAttributions` | `() => string[]` | Only in this library: returns the attribution texts of the sources of the style as they are written, which can be HTML that the attribution control shows. |
<!-- ref:CompatMap:end -->

## `queryRenderedFeatures`

`queryRenderedFeatures` and `querySourceFeatures` take the arguments of MapLibre GL JS and return an array that is
also a promise. Await it: the promise resolves to the complete result. The array without `await` can lack the
features of tile sources. `await` also works with MapLibre GL JS, so the same code runs with both libraries.

```js
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 15,
});
map.on('click', async event => {
  const buildings = await map.queryRenderedFeatures(event.point, {
    layers: ['building'],
  });
  console.log(buildings.length);
});
```

When `remove()` is called before the answer, the promise rejects with the error
`[map-jr-gl] The query has no answer: the map was removed.`

## `setStyle`

`setStyle(style, options)` replaces the style and returns a promise that resolves when the new style has loaded.

```ts
setStyle(
  style: string | StyleSpecification,
  options?: {
    diff?: boolean;
    transformStyle?: (
      previous: StyleSpecification,
      next: StyleSpecification,
    ) => StyleSpecification
  },
): Promise<void>
```

The sources and layers that `addSource` and `addLayer` added are removed with the old style, as in MapLibre GL JS,
except the custom layers with `diff: true`. To keep them, return a style with them from `transformStyle`, which
receives the old and the new style.

With `diff: true`, the default, the map changes as little as it can:

- A style that is equal to the current one, apart from the camera, changes nothing and fires no event.
- A source that is equal to a source of the old style keeps its data, and the map does not request it again.
- Paint values that changed transition to the new values.
- A custom layer stays in the new style.

With `diff: false`, the new values apply at once, and the custom layers leave the map.

```js
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
});

async function showDark() {
  await map.setStyle('https://styles.map-jr.org/1/openfreemap-dark.json');
  console.log(map.getStyle().layers.length);
}
```

## `addImage`

`addImage(name, image, options)` accepts the image and the options of MapLibre GL JS (`pixelRatio`, `sdf`,
`stretchX`, `stretchY`, `content`, `textFitWidth` and `textFitHeight`), and also an SVG document as a string or the
URL of an image. It returns a promise of the map that resolves when the image is ready. An SVG image has the size of
its `viewBox` in CSS pixels and is sharp at every pixel ratio.

```js
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 13,
});
const pin =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#d6453d"/></svg>';

map.on('load', async () => {
  await map.addImage('station', pin);
  map.addSource('stations', {
    type: 'geojson',
    data: {type: 'Point', coordinates: [-74.0065, 40.7085]},
  });
  map.addLayer({
    id: 'stations',
    type: 'symbol',
    source: 'stations',
    layout: {'icon-image': 'station'},
  });
});
```

An image that draws itself with WebGL (`renderWithWebGL`) is not supported, and the promise rejects.

## Video and canvas sources

`getSource(id)` of a source of the type `video` or `canvas` has these methods, as in MapLibre GL JS. They exist once the
code of these sources has loaded, which the map requests when a style with such a source has loaded. Until then,
`getSource(id)` returns the specification without them.

| Method | Source | Description |
|---|---|---|
| `getVideo()` | `video` | Returns the `<video>` element. |
| `getCanvas()` | `canvas` | Returns the `<canvas>` element. |
| `play()`, `pause()` | both | Start and stop the video, or the copy of the canvas in each frame. |
| `seek(seconds)` | `video` | Sets the time of the video. |
| `setCoordinates(coordinates)` | both | Moves the four corners. |

## Other exports

| Export | Description |
|---|---|
| `Marker`, `Popup` | The marker and the popup of MapLibre GL JS. See [Markers and popups](../guide/markers-and-popups.md). |
| `NavigationControl`, `ScaleControl`, `GeolocateControl`, `FullscreenControl`, `TerrainControl`, `GlobeControl` | The controls of MapLibre GL JS, with the look of MapLibre GL JS. |
| `AttributionControl`, `LogoControl` | The attribution and the logo control of MapLibre GL JS. |
| `LngLat`, `LngLatBounds`, `MercatorCoordinate` | The classes of MapLibre GL JS for positions. |
| `Point` | A point with `convert`, `clone`, `add`, `sub`, `mult`, `div`, `round`, `mag`, `dist` and `equals`, and none of the other methods. |
| `addProtocol`, `removeProtocol` | Add and remove a function of the page that loads the URLs that start with a name. |
| `supported()` | Only in this library: returns `false` in a browser without WebGL2. |
| `configure(options)` | Only in this library: sets how the library loads its workers. See [Loading](../loading.md). |
| `setWorkerUrl`, `getWorkerUrl` | Set and read the URL of the worker file of this library. A URL of the worker file of MapLibre GL JS is ignored. |
| `setWorkerCount`, `getWorkerCount` | Set and read the number of tile workers. |
| `setMaxParallelImageRequests`, `setRTLTextPlugin` | Accepted with no effect, with the getters `getMaxParallelImageRequests` and `getRTLTextPluginStatus`. |
| `getVersion()` | Returns the version of this library. |
| `Hash` | Keeps the camera in the fragment of the URL, like the `hash` option. See [Hash](#hash-and-config). |
| `config` | The settings object of MapLibre GL JS, with three fields. See [Hash](#hash-and-config). |
| `Evented`, `EXTENT` | The class with `on`, `off`, `once` and `fire` that `Marker`, `Popup` and `FullscreenControl` use for their own events, and the tile size 8192. |
| `createTileMesh(options, forceIndicesSize?)` | Returns the vertices and indices of a mesh that covers a tile, as in MapLibre GL JS 6.17. It throws when `forceIndicesSize` is `'16bit'` and the mesh needs 32-bit indices. |
| `GPUInitializationError` | The error of the `error` event when the map cannot start. The constructor does not throw it. |
| `MapLibreMap` | Another name of `Map`. |
| `InteractionHandler` | Only in this library: the class of `map.dragPan` and the other handlers. |
| The default export | An object with the same names, for code that writes `import maplibregl from 'maplibre-gl'`. |

The entry also exports the types of MapLibre GL JS under their names, such as `MapOptions`, `StyleSpecification`
and `MapMouseEvent`. An event type or a source type, such as `MapMouseEvent` or `GeoJSONSource`, is a type only, so
`new` and `instanceof` do not work with it. `Event`, `CanvasSource` and `VideoSource` are types for the same reason.

`map.style.projection.subdivisionGranularity` has the granularities of MapLibre GL JS 6.17 for the projection of the
style (`fill`, `line`, `tile`, `stencil` with `getGranularityForZoomLevel(zoom)`, and `circle`), for custom layers that
build their meshes with `createTileMesh`.

## Hash and config

`new Hash(name?).addTo(map)` keeps the camera in the fragment of the URL (`#zoom/lat/lng/bearing/pitch`, or
`#name=zoom/lat/lng` with a name), as the `hash` option does. `remove()` stops it. Wrappers use it. The code that reads
and writes the fragment loads on demand, so the fragment moves the map a moment after `addTo`. `getHashString` does not
exist.

`config` has three fields. `REGISTERED_PROTOCOLS` is a copy of the protocols that `addProtocol` added, so write with
`addProtocol`. `MAX_PARALLEL_IMAGE_REQUESTS` has no effect, like `setMaxParallelImageRequests`. `WORKER_URL` sets the
worker URL like `setWorkerUrl`. The other fields of MapLibre GL JS are not there.

## Exports of `maplibre-gl` that the entry lacks

An import of a name in this list fails when the application is built, and `maplibregl.Name` is `undefined` at run
time. The last table of [Types](../maplibre-compatibility.md#types) says why each group of names is missing.

<!-- exports:start -->
**A type here, not a value** (20): `CanvasSource`, `ErrorEvent`, `Event`, `GeoJSONSource`, `ImageSource`, `MapBoxZoomEvent`, `MapContextEvent`, `MapLibreEvent`, `MapMouseEvent`, `MapMovementEvent`, `MapProjectionEvent`, `MapSourceDataEvent`, `MapStyleDataEvent`, `MapStyleImageMissingEvent`, `MapTouchEvent`, `MapWheelEvent`, `RasterDEMTileSource`, `RasterTileSource`, `VectorTileSource`, `VideoSource`.

**Not exported** (34): `AJAXError`, `BoxZoomHandler`, `CooperativeGesturesHandler`, `DoubleClickZoomHandler`, `DragPanHandler`, `DragRotateHandler`, `EdgeInsets`, `FullscreenEvent`, `GeolocateErrorEvent`, `GeolocateEvent`, `GeolocatePositionEvent`, `KeyboardHandler`, `MapStyleLoadEvent`, `MapTerrainEvent`, `MarkerClickEvent`, `MarkerDragEvent`, `PopupEvent`, `ScrollZoomHandler`, `Style`, `TwoFingersTouchPitchHandler`, `TwoFingersTouchRotateHandler`, `TwoFingersTouchZoomHandler`, `TwoFingersTouchZoomRotateHandler`, `addProjection`, `addSourceType`, `clearPrewarmedResources`, `getGlobalDispatcher`, `importScriptInWorkers`, `isTimeFrozen`, `now`, `prewarm`, `removeProjection`, `restoreNow`, `setNow`.

<!-- exports:end -->

## See also

- [From MapLibre GL JS](../migrate/from-maplibre.md) for the steps to move an application to this entry.
- [From the compat entry to the main API](../migrate/compat-to-main-api.md) for the calls of the main API that
  replace the methods of `Map`.
- [Wrappers and plugins](../migrate/wrappers.md) for react-map-gl and the other wrappers.
