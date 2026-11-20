# Reference tables (fixture)

`scripts/reference.mjs` fills the blocks of this file, and `pnpm test:consistency` runs `--check` on it. The blocks
cover the types that the reference pages do not have yet, so that a member without TSDoc fails here first: the
props of the Vue component, and the options of a control. Do not edit the tables by hand: change the comment in
`src/` and run `node scripts/reference.mjs --write`.

## `VueMapJrProps`

<!-- ref:VueMapJrProps:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `mapStyle` **required** | `string \| StyleSpecification \| {light: string \| StyleSpecification; dark: string \| StyleSpecification}` | | The style: a style object, the URL of a style, or `{light, dark}`, of which the map draws the style that matches `colorScheme`. |
| `view` | [`ViewInput`](../../docs/reference/types.md#viewinput) | | The view that the application controls, for `v-model:view`. |
| `initialView` | [`InitialView`](../../docs/reference/types.md#initialview) | | The view when the map is created: a center, zoom, bearing and pitch, or `bounds` to fit. |
| `sources` | `Record<string, SourceSpecification>` | | Sources to add to the style, by id. |
| `layers` | `LayerInput[]` | | Layers to add to the style. |
| `terrain` | `TerrainSpecification \| null` | | 3D terrain from a raster-dem source. |
| `images` | `Record<string, ImageInput>` | | Images for `icon-image` of style layers, by name: an SVG document as a string, the URL of an image, or `{image, width, height}`. |
| `sprite` | `{id: string; url: string}[]` | | Sprites to add to the sprite of the style, as `[{id: 'pins', url}]`. |
| `data` | `Record<string, string \| GeoJSON>` | | GeoJSON data or the URL of GeoJSON, by the id of a GeoJSON source of the style or of `sources`. |
| `interactiveLayers` | `string[]` | | The ids of the style layers that respond to the pointer: their features are in the events `click` and `hover`. |
| `hoverState` | `boolean` | `false` | Whether the top feature of `interactive-layers` under the pointer has the feature state `hover: true`. |
| `minZoom` | `number` | `-2` | The smallest zoom level of the map. |
| `maxZoom` | `number` | `22` | The largest zoom level of the map. |
| `maxPitch` | `number` | `60` | The largest pitch of the map in degrees, at most 90. |
| `maxBounds` | `Bounds \| null` | | A box that the view cannot leave, as `[[west, south], [east, north]]` or `[west, south, east, north]`. |
| `cursor` | `string` | | The CSS cursor over the map. |
| `cooperativeGestures` | `boolean` | `false` | Whether the wheel zooms only with Ctrl (⌘ on a Mac) and a touch pans only with two fingers, for a map in a page that scrolls. |
| `colorScheme` | `'auto' \| 'dark' \| 'light'` | `'light'` | The colour scheme of the controls, the popup and the attribution, for `v-model:color-scheme`. |
| `locale` | `Record<string, string>` | | The texts of the controls by the keys of MapLibre GL JS, for example `{'NavigationControl.ZoomIn': 'Zoom avant'}`. |
| `padding` | `PaddingInput` | `0` | Space in CSS pixels at the sides of the map that the view keeps free: one number, or `{top, right, bottom, left}`. |
| `controls` | `ControlSpec[]` | | Controls from `@map-jr/map-jr-gl/controls`, for example `[navigation(), scale()]`. |
| `projection` | `ProjectionSpecification \| null` | | The projection, `{type: 'globe'}` or `{type: 'mercator'}`. |
| `globalState` | `Record<string, unknown>` | | Values for the `global-state` expressions of the style, by name, for example `{season: 'winter'}`. |
| `transformRequest` | `RequestTransform \| null` | | A function that changes a request before the map sends it, as `transformRequest` of MapLibre GL JS. |
| `renderer` | `'auto' \| 'main' \| 'worker'` | `'auto'` | The thread that renders the map. |
| `fonts` | `FontFaces` | | Web fonts for labels, by `text-font` name: a URL, or a list of `{url, 'unicode-range'}` as in `font-faces` of the style specification. |
| `fontFamily` | `string` | `'"Noto Sans", "Helvetica Neue", Arial, sans-serif'` | The CSS font family for labels whose `text-font` names no loaded font. |
| `interactive` | `boolean` | `true` | Whether the user can move the map. |
| `antialias` | `boolean` | `false` | Whether the canvas uses multisample antialiasing. |
| `nonce` | `string` | | The nonce of a Content Security Policy with `style-src 'nonce-…'`, for the style sheet of the map. |
| `attribution` | `false \| {compact?: boolean; customAttribution?: string \| string[]}` | | The options of the built-in attribution, or `false` to hide it. |
| `hash` | `string \| boolean` | `false` | Whether the view is kept in the hash of the URL; a string is the name of the parameter. |
| `ssr` | `boolean \| {width?: number; height?: number; overrides?: false \| Record<string, `[`SSROverrides`](../../docs/reference/server.md#overrides)`>; attribution?: string \| string[]; timeout?: number; requestTimeout?: number; maxBytes?: number; allowHosts?: string[]; tileZoomOffset?: number}` | `false` | Whether a server renders the first view as SVG into the page: `true`, or options. |
<!-- ref:VueMapJrProps:end -->

## `CompatMap`

<!-- ref:CompatMap:start -->
| Name | Type | Description |
|---|---|---|
| `on` | `<T extends keyof MapLayerEventType>(type: T, layerId: string \| string[], listener: (e: MapLayerEventType[T]) => void) => this` | `on(type, listener)`, or `on(type, layerId, listener)` to hear `click`, `mousemove`, `mouseenter` and `mouseleave` only where that style layer's features are, with the features on the event as `e.features`. |
| `once` | `<T extends keyof MapEventType>(type: T, listener: (e: MapEventType[T]) => void) => this` | Calls `listener` one time, for the next event of `type`, as in MapLibre GL JS. |
| `off` | `<T extends keyof MapLayerEventType>(type: T, layerId: string \| string[], listener: (e: MapLayerEventType[T]) => void) => this` | Removes a listener that `on` added, as in MapLibre GL JS. |
| `getSource` | `<T extends Source = Source>(id: string) => T \| undefined` | Returns the specification of the source with this id and the methods of its type, or `undefined` when the style has no such source. |
| `easeTo` | `(o: EaseToOptions, eventData?: EventData) => this` | Moves the camera to a view with an animation of 500 ms unless `o` sets `duration`, as in MapLibre GL JS. |
| `setStyle` | `(style: unknown, options?: StyleSwapOptions) => Promise<void>` | Replaces the style with a style URL or a style object, and returns a promise that settles when the new style has loaded. |
| `getStyle` | `() => StyleSpecification` | The style, as in MapLibre GL JS. |
| `cooperativeGestures` (read only) | `{enable(): void; disable: () => void; isEnabled: () => boolean; isActive: () => boolean}` | As in MapLibre GL JS: with it on, the wheel zooms only with Ctrl (⌘ on a Mac), and one finger scrolls the page. |
| `project` | `(lngLat: LngLatLike) => Point` | As in MapLibre, a `Point` with methods (`dist`, `sub`, …), not a plain object. |
| `version` (read only) | `string` | The version of this library, as the member `version` of a map of MapLibre GL JS. |
| `setRenderWorldCopies` | `(copies?: boolean \| null \| undefined) => Map` | Has no effect, and `false` warns once: the map always draws copies of the world side by side. |
| `setRoll` | `(roll?: number \| undefined) => Map` | Has no effect, and a value other than 0 warns once: the camera has no roll. |
| `setVerticalFieldOfView` | `(fov?: number \| undefined) => Map` | Has no effect, and a value other than 36.87 warns once: the vertical field of view stays at 36.87 degrees. |
| `getVerticalFieldOfView` | `() => number` | Returns 36.87, the vertical field of view of the camera in degrees, which is the default of MapLibre GL JS. |
| `coveringTiles` | `(o: {tileSize: number; minzoom?: number; maxzoom?: number; roundZoom?: boolean}) => {canonical: {z: number; x: number; y: number; key: string}; wrap: number; overscaledZ: number; key: string}[]` | Returns the tiles that cover the view as plain objects `{canonical: {z, x, y, key}, wrap, overscaledZ, key}`; MapLibre GL JS returns `OverscaledTileID` objects. |
| `calculateCameraOptionsFromTo` | `(from: LngLatLike, altitudeFrom: number, to: LngLatLike, altitudeTo?: number \| undefined) => {center: LngLat; elevation: number; zoom: number; pitch: number; bearing: number}` | The camera options that look from `from` at `altitudeFrom` metres to `to` at `altitudeTo` metres, as in MapLibre GL JS. |
| `calculateCameraOptionsFromCameraLngLatAltRotation` | `(cameraLngLat: LngLatLike, cameraAlt: number, bearing: number, pitch: number, roll?: number \| undefined) => {center: LngLat; elevation: number; zoom: number; bearing: number; pitch: number; roll: number \| undefined}` | The camera options that put the camera at `cameraLngLat` and `cameraAlt` metres with this rotation, as in MapLibre GL JS. |
| `calculateAnchoredCameraOptions` | `(o: {anchorLocation: LngLatLike; anchorScreenPoint: PointLike; zoom?: number}) => {center: LngLat; zoom: number}` | The centre and zoom that put `anchorLocation` at `anchorScreenPoint`, at `zoom` (default: the zoom of the map), as in MapLibre GL JS. |
| `setCenterClampedToGround` | `(clamped?: boolean \| undefined) => Map` | Has no effect, and `false` warns once: the map center is always on the ground. |
| `getCenterClampedToGround` | `() => boolean` | Returns `true`: the map center is always on the ground. |
| `setCenterElevation` | `(elevation?: number \| undefined) => Map` | Has no effect, and a value other than 0 warns once: the map center is always on the ground. |
| `setAnisotropicFilterPitch` | `(_pitch?: number \| null \| undefined) => Map` | Has no effect, and gives no warning for any value. |
| `getAnisotropicFilterPitch` | `() => number` | Returns 20, the default of MapLibre GL JS. |
| `setTransformCameraUpdate` | `(fn?: ((tr: CameraLike) => CameraChanges \| undefined) \| null \| undefined) => Map` | Has no effect on the camera that the map draws, and warns once when the function changes the camera of a movement. |
| `showTileBoundaries` | `boolean` | Has no effect, and setting it to `true` warns once: the map does not draw tile borders. |
| `showPadding` | `boolean` | Has no effect, and setting it to `true` warns once: the map does not draw the padding. |
| `showCollisionBoxes` | `boolean` | Has no effect, and setting it to `true` warns once: the map does not draw collision boxes. |
| `showOverdrawInspector` | `boolean` | Has no effect, and setting it to `true` warns once: the map has no overdraw view. |
| `setSourceTileLodParams` | `(maxZoomLevelsOnScreen: number, tileCountMaxMinRatio: number, sourceId?: string \| undefined) => Map` | Changes the level of detail of the tile cover of a pitched view for one source, or for all sources, as in MapLibre GL JS. |
| `setTransformConstrain` | `(fn?: ((lngLat: LngLat, zoom: number) => {center: LngLatLike; zoom: number}) \| null \| undefined) => Map` | As in MapLibre GL JS, `fn(lngLat, zoom)` returns `{center, zoom}` and replaces the constraint of the camera; null restores it. |
| `setZoomSnap` | `(snap: number) => Map` | As in MapLibre GL JS: with a `zoomSnap` above 0, the zoom of `jumpTo`, `easeTo`, `flyTo`, `zoomIn` and `zoomOut` goes to the nearest multiple of it, and `cameraForBounds` (and so `fitBounds`) to the multiple below. |
| `getZoomSnap` | `() => number` | Returns the step of the zoom that the option `zoomSnap` or `setZoomSnap` set, or 0 when the zoom does not snap. |
| `cameraForBounds` | `(bounds: LngLatBoundsInput, o?: {padding?: PaddingInput; maxZoom?: number} \| undefined) => {center: {lng: number; lat: number}; zoom: number; bearing: number}` | The centre and zoom that fit `bounds` ([west, south, east, north] or [[west, south], [east, north]]) in view. |
| `setEventedParent` | `(parent?: {fire(e: object): unknown; listens?(type: string): boolean} \| null \| undefined, data?: object \| (() => object) \| undefined) => Map` | As in MapLibre GL JS: each event of the map also goes to `parent.fire`, as one object with the fields of `data` (or of what the function `data` returns), while `parent.listens(type)` is true. |
| `fire` | `(type: string \| {type: string}, data?: Record<string, unknown>) => void \| PromiseLike<unknown>` | Calls the listeners of the event `type` with `data` as the event, as in MapLibre GL JS. |
| `setMissingStyleImageResolver` | `(resolver: ((id: string) => void \| Promise<void>) \| null) => Map` | Sets a function that supplies images on demand, as in MapLibre GL JS. |
| `addImage` | `(name: string, source: string \| ImageData \| {width: number; height: number; data: Uint8Array<ArrayBufferLike> \| Uint8ClampedArray<ArrayBufferLike>} \| CanvasImageSource, options?: `[`ImageOptions`](../../docs/reference/server.md#imageoptions)` \| undefined) => Promise<Map>` | Makes an image available to `icon-image` under `name`, and returns a promise of the map; MapLibre GL JS returns the map. |
| `addControl` | `(control: Control, position?: ControlPosition \| undefined) => Map` | Adds a control to a corner of the map, as in MapLibre GL JS. |
| `addLayer` | `(layer: AddLayerObject, beforeId?: string \| undefined) => Map` | Adds a style layer below the layer `beforeId`, or on top when `beforeId` is left out, as in MapLibre GL JS. |
| `removeLayer` | `(id: string) => Map` | Removes a style layer, as in MapLibre GL JS. |
| `getStyleUrl` | `() => string \| null` | The URL given as the option `style` or to the latest call of `setStyle`, as it was written; `null` when that was an object or nothing. |
| `listens` | `(type: string) => boolean` | Whether the map has a listener for the event `type`, a listener for a layer included. |
| `addSource` | `(id: string, source: object) => Map` | Adds a source to the style, as in MapLibre GL JS. |
| `removeSource` | `(id: string) => Map` | Removes a source from the style, as in MapLibre GL JS. |
| `jumpTo` | `(o: CameraInput, eventData?: EventData \| undefined) => Map` | Moves the camera to a view without an animation, as in MapLibre GL JS. |
| `fitBounds` | `(bounds: LngLatBoundsInput, o?: FitBoundsOptions \| undefined, eventData?: EventData \| undefined) => Map` | Moves the camera to fit a box with an animation of 800 ms unless `o` sets `duration`; MapLibre GL JS flies there for a time that `speed` sets. |
| `fitScreenCoordinates` | `(p0: PointLike, p1: PointLike, bearing: number, o?: FitBoundsOptions, eventData?: EventData \| undefined) => Map` | Moves the map so that the box between the screen points `p0` and `p1` (CSS pixels) fills the view at `bearing`, with an animation of 800 ms unless `o` sets `duration`. |
| `flyTo` | `(o: Omit<CameraOptions, 'padding'> & {padding?: PaddingInput} & {duration?: number; around?: [number, number]; essential?: boolean; offset?: {x: number; y: number} \| [number, number] \| undefined; easing?: ((t: number) => number)} & `[`FlyOptions`](../../docs/reference/map.md#flyoptions)`, eventData?: EventData \| undefined) => Map` | Moves the camera along a curve that zooms out and back in (van Wijk and Nuij), with the options of `flyTo` of MapLibre GL JS 6.17 (`curve` 1.42, `speed` 1.2, `screenSpeed`, `minZoom`, `maxDuration`; without `duration`, the duration follows from the distance). |
| `setPadding` | `(padding: PaddingInput, eventData?: EventData \| undefined) => Map` | Sets the padding in CSS pixels: the space at the edges that other things cover, such as a side panel. |
| `getPadding` | `() => {top: number; right: number; bottom: number; left: number}` | Returns the padding of the map in CSS pixels, as `{top, right, bottom, left}`. |
| `setCenter` | `(center: LngLatLike, eventData?: EventData \| undefined) => Map` | Moves the map center to a position without an animation, as in MapLibre GL JS. |
| `setZoom` | `(zoom: number, eventData?: EventData \| undefined) => Map` | Sets the zoom level without an animation, as in MapLibre GL JS. |
| `setBearing` | `(bearing: number, eventData?: EventData \| undefined) => Map` | Sets the bearing in degrees without an animation, as in MapLibre GL JS. |
| `setPitch` | `(pitch: number, eventData?: EventData \| undefined) => Map` | Sets the pitch in degrees without an animation, as in MapLibre GL JS. |
| `resetNorth` | `(o?: {duration?: number}, eventData?: EventData \| undefined) => Map` | Turns the map to bearing 0 with an animation of 500 ms unless `o` sets `duration`; MapLibre GL JS takes 1000 ms. |
| `resetNorthPitch` | `(o?: {duration?: number}, eventData?: EventData \| undefined) => Map` | Turns the map to bearing 0 and pitch 0 with an animation of 500 ms unless `o` sets `duration`; MapLibre GL JS takes 1000 ms. |
| `panTo` | `(center: LngLatLike, o?: {duration?: number}, eventData?: EventData \| undefined) => Map` | Moves the map center to a position with an animation of 500 ms unless `o` sets `duration`, as in MapLibre GL JS. |
| `panBy` | `(offset: [number, number], o?: {duration?: number}, eventData?: EventData \| undefined) => Map` | Moves the map by `offset` in CSS pixels with an animation of 500 ms unless `o` sets `duration`, as in MapLibre GL JS. |
| `zoomTo` | `(zoom: number, o?: {duration?: number}, eventData?: EventData \| undefined) => Map` | Changes the zoom level with an animation of 500 ms unless `o` sets `duration`, as in MapLibre GL JS. |
| `zoomIn` | `(o?: {duration?: number}, eventData?: EventData \| undefined) => Map` | Increases the zoom level by 1 with an animation of 300 ms unless `o` sets `duration`; MapLibre GL JS takes 500 ms. |
| `zoomOut` | `(o?: {duration?: number}, eventData?: EventData \| undefined) => Map` | Decreases the zoom level by 1 with an animation of 300 ms unless `o` sets `duration`; MapLibre GL JS takes 500 ms. |
| `rotateTo` | `(bearing: number, o?: {duration?: number}, eventData?: EventData \| undefined) => Map` | Changes the bearing in degrees with an animation of 500 ms unless `o` sets `duration`, as in MapLibre GL JS. |
| `snapToNorth` | `(o?: {duration?: number}, eventData?: EventData \| undefined) => Map` | Turns the map to bearing 0 when the bearing is less than 7 degrees from north, and else does nothing. |
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
| `style` (read only) | `{_loaded: boolean; tileManagers: Record<string, {_source: {id: string; type: string; vectorLayerIds?: string[]}}>; sourceCaches: Record<string, {_source: {id: string; type: string; vectorLayerIds?: string[]}}>} \| undefined` | For wrappers that read the private `style` of MapLibre GL JS: `_loaded`, and `tileManagers` (also `sourceCaches`) with the id, type and `vectorLayerIds` of each source. |
| `getLight` | `() => {anchor?: string; position?: number[]; color?: string; intensity?: number}` | Returns the light of the style with the defaults filled in for the fields that the style does not set; MapLibre GL JS returns only the fields that the style sets. |
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
| `getFontFaces` | `() => Record<string, unknown>` | Returns the `font-faces` of the style, or `{}` when the style has none, where MapLibre GL JS returns `null`. |
| `setFontFaces` | `(faces: Record<string, unknown> \| null) => Map` | Replaces the `font-faces` of the style, or removes them with `null`. |
| `setFeatureState` | `(feature: FeatureIdentifier, state: Record<string, unknown>) => Map` | Merges `state` into the feature state of one feature. |
| `getFeatureState` | `(feature: FeatureIdentifier) => Record<string, unknown>` | Returns the feature state of one feature. |
| `getImage` | `(name: string) => {pixelRatio: number; sdf: boolean; data: unknown; width?: number; height?: number; stretchX?: [number, number][]; stretchY?: [number, number][]; content?: [number, number, number, number]; textFitWidth?: 'proportional' \| 'stretchOnly' \| 'stretchOrShrink'; textFitHeight?: 'proportional' \| 'stretchOnly' \| 'stretchOrShrink'} \| undefined` | Returns `{data, pixelRatio, sdf}` and the other options of an image that `addImage` added, or `undefined`. |
| `listImages` | `() => string[]` | Returns the names of the images that the map has. |
| `loadImage` | `(url: string) => Promise<{data: ImageBitmap}>` | Fetches and decodes the image at a URL, and returns a promise of `{data}` with an `ImageBitmap`, as in MapLibre GL JS. |
| `querySourceFeatures` | `(sourceId: string, options?: QuerySourceFeatureOptions) => GeoJSONFeature[] & PromiseLike<GeoJSONFeature[]>` | Returns the features of a source in the tiles of the present view, as an array that is also a promise; MapLibre GL JS returns only the array. |
| `queryRenderedFeatures` | `(geometry?: PointLike \| [PointLike, PointLike] \| RenderedQueryOptions, options?: RenderedQueryOptions) => MapGeoJSONFeature[] & PromiseLike<MapGeoJSONFeature[]>` | Returns the features that the style layers draw at a point or in a box of the screen, the top layer first, as an array that is also a promise; MapLibre GL JS returns only the array. |
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
| `setMinZoom` | `(z?: number) => Map` | Sets the smallest zoom level that the user can reach. |
| `setMaxZoom` | `(z?: number) => Map` | Sets the largest zoom level that the user can reach. |
| `setMaxPitch` | `(p?: number \| null \| undefined) => Map` | Sets the largest pitch that the user can reach, in degrees. |
| `getMaxPitch` | `() => number` | Returns the largest pitch that the user can reach, in degrees. |
| `getMinPitch` | `() => number` | Returns the smallest pitch that the user can reach, in degrees. |
| `setMinPitch` | `(p?: number) => Map` | Sets the smallest pitch that the user can reach, in degrees. |
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
| `addFonts` | `(fonts: FontSource[]) => Map` | Only in this library: loads more web fonts for labels after the map is made. |
| `removeImage` | `(name: string) => Map` | Removes an image that `addImage` added. |
| `updateImage` | `(name: string, source: string \| ImageData \| {width: number; height: number; data: Uint8Array<ArrayBufferLike> \| Uint8ClampedArray<ArrayBufferLike>} \| CanvasImageSource) => Promise<Map>` | Replaces the pixels of an image added earlier, keeps its options (stretch, content, sdf) and returns a promise of the map; MapLibre GL JS returns the map. |
| `hasImage` | `(name: string) => boolean` | Whether the map has an image with this name. |
| `queryFeatures` | `(at?: FeaturePlace \| LngLatLike \| `[`FeatureOptions`](../../docs/reference/map.md#featureoptions)`, o?: `[`FeatureOptions`](../../docs/reference/map.md#featureoptions)`) => Promise<`[`RenderedFeature`](../../docs/reference/types.md#renderedfeature)`[]>` | Only in this library: returns a promise of the features that the style layers draw, the top one first. |
| `querySource` | `(sourceId: string, at?: FeaturePlace \| LngLatLike \| `[`SourceOptions`](../../docs/reference/map.md#sourceoptions)`, o?: `[`SourceOptions`](../../docs/reference/map.md#sourceoptions)`) => Promise<`[`QueriedFeature`](../../docs/reference/types.md#queriedfeature)`[]>` | Only in this library: returns a promise of the features of the tile data of the source `sourceId`. |
| `queryElevation` | `(at: LngLatLike \| {x: number; y: number}, options?: {source?: string; zoom?: number}) => Promise<number \| null>` | Only in this library: returns a promise of the elevation of the ground in metres at a position, from the raster-dem source of the style, or `null` where it has no data. |
| `getAttributions` | `() => string[]` | Only in this library: returns the attribution texts of the sources of the style as they are written, which can be HTML that the attribution control shows. |
<!-- ref:CompatMap:end -->

