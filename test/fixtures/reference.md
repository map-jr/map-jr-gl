# Reference tables (fixture)

`scripts/reference.mjs` fills the blocks of this file, and `pnpm test:consistency` runs `--check` on it. The blocks
cover the types that the reference pages do not have yet, so that a member without TSDoc fails here first: the
events of the map, the members of the map, one method, the props of the Vue and React components, and the options of
the Svelte action. Do not edit the tables by hand: change the comment in `src/` and run
`node scripts/reference.mjs --write`.

<!-- ref:MapInstance:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `update` | `(spec: MapDescription) => void` | | Applies a new description to the map. |
| `patch` | `(part: Partial<MapDescription>) => void` | | Applies the fields of `part` and keeps the other fields of the current description. |
| `description` (read only) | `Readonly<MapDescription>` | | The description of the last `createMap`, `update` or `patch`. |
| `getResolvedDescription` | `() => MapDescription` | | Returns the description with `style` as a copy of the style that the map loaded and `globalState` as the global state in effect. |
| `destroy` | `() => void` | | Removes the map, its controls and its overlays from the page. |
| `state` (read only) | `Readable<MapState>` | | A store of the state of the map (`MapState`): `state.get()` returns it, and `state.subscribe(fn)` calls `fn` at each change. |
| `queryFeatures` | `(at?: FeaturePlace \| FeatureOptions, options?: FeatureOptions) => Promise<RenderedFeature[]>` | | Returns the features that the style layers render at a place, the top one first. |
| `querySource` | `(sourceId: string, at?: FeaturePlace \| SourceOptions, options?: SourceOptions) => Promise<QueriedFeature[]>` | | Returns the features of the tile data of a source, with no need of a style layer. |
| `watchFeatures` | `(at: FeaturePlace \| undefined, options: FeatureOptions, listener: (features: RenderedFeature[]) => void) => () => void` | | Calls `listener` with the result of `queryFeatures` now and again each time that the result changes. |
| `watchSource` | `(sourceId: string, at: FeaturePlace \| undefined, options: SourceOptions, listener: (features: QueriedFeature[]) => void) => () => void` | | Calls `listener` with the result of `querySource` now and again each time that the result changes. |
| `setFeatureState` | `(target: {source: string; sourceLayer?: string; id: number \| string}, state: Record<string, unknown>) => void` | | Merges `state` into the feature state of one feature, which `feature-state` expressions read. |
| `removeFeatureState` | `(target: {source: string; sourceLayer?: string; id?: number \| string}, key?: string) => void` | | Removes one key of the feature state of a feature, or its whole state when `key` is left out. |
| `queryElevation` | `(at: Position \| {x: number; y: number}) => Promise<number \| null>` | | Returns the height of the ground at a position (`[lng, lat]`) or a point of the screen, from the terrain source. |
| `toBlob` | `(type?: string, quality?: number) => Promise<Blob>` | | Returns the map as an image once the map is idle, in the size of the canvas in device pixels. |
| `clusterExpansionZoom` | `(sourceId: string, clusterId: number) => Promise<number>` | | Returns the zoom level at which a cluster of a GeoJSON source with `cluster: true` divides. |
| `clusterChildren` | `(sourceId: string, clusterId: number) => Promise<ClusterFeature[]>` | | Returns the clusters and points that a cluster divides into at the next zoom level. |
| `clusterLeaves` | `(sourceId: string, clusterId: number, options?: {limit?: number; offset?: number}) => Promise<ClusterFeature[]>` | | Returns the points of a cluster. |
| `moveTo` | `(view: MoveToOptions) => void` | | Moves the camera to a view or to `bounds`, with an animation when `duration` is more than 0 or `fly` is set. |
| `fitBounds` | `(bounds: Bounds, options?: Omit<MoveToOptions, 'bounds' \| 'center' \| 'zoom'>) => void` | | Moves the camera to fit a box, as `moveTo({bounds, ...options})` with `duration` 800 ms unless `options` sets it. |
| `project` | `(lngLat: Position) => {x: number; y: number}` | | Converts a position to a point of the screen. |
| `unproject` | `(point: {x: number; y: number}) => [number, number]` | | Converts a point of the screen, in CSS pixels from the top left corner of the map, to a position. |
| `overlay` | `(element: HTMLElement, options: OverlayOptions) => MapOverlay` | | Places an element of the page at a position of the map, as a marker, a label or a popup; the element moves with the map. |
| `listen` | `<K extends keyof MapEvents>(type: K, fn: (event: MapEvents[K]) => void) => () => void` | | Calls `fn` for each event of a type of `MapEvents`. |
| `once` | `<K extends keyof MapEvents>(type: K) => Promise<MapEvents[K]>` | | Waits for the next event of a type of `MapEvents`. |
| `container` (read only) | `HTMLElement` | | The element that holds the map. |
<!-- ref:MapInstance:end -->

<!-- ref:MapInstance.queryFeatures:start -->
```ts
queryFeatures(at?: FeaturePlace | FeatureOptions, options?: FeatureOptions): Promise<RenderedFeature[]>
```

| Name | Type | Default | Description |
|---|---|---|---|
| `at` | `FeaturePlace \| FeatureOptions` | | A point of the screen (`{x, y}`), a position (`[lng, lat]`), a box of the screen (two points), or nothing for the whole map. |
| `options` | `FeatureOptions` | | `layers` (the ids of style layers), `filter` (a filter expression) and `radius` (in CSS pixels around a point). |

**Returns:** `Promise<RenderedFeature[]>`. A promise of the features.
<!-- ref:MapInstance.queryFeatures:end -->

<!-- ref:MapState:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `loaded` | `boolean` | | Whether the style and the tiles of the view have loaded for the first time. |
| `idle` | `boolean` | | Whether the camera is still and nothing loads. |
| `moving` | `boolean` | | Whether the camera moves. |
| `view` | `View` | | The current view. |
| `hover` | `RenderedFeature[]` | | The features of `interactiveLayers` under the pointer, the top one first. |
| `pointer` | `PointerPosition \| null` | | Where the pointer is over the map, or `null` when it is not over the map. |
| `renderer` | `'worker' \| 'main' \| undefined` | | The thread that renders the map, or `undefined` until `loaded` is `true`. |
| `colorScheme` | `'light' \| 'dark'` | | The colour scheme of the controls: `colorScheme` of the description, with `'auto'` resolved. |
<!-- ref:MapState:end -->

<!-- ref:MapEvents:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `load` | `MapEventBase<'load'>` | | The style and the first tiles have loaded. |
| `idle` | `MapEventBase<'idle'>` | | Nothing moves and nothing loads. |
| `render` | `MapEventBase<'render'>` | | The map has drawn a frame. |
| `resize` | `MapEventBase<'resize'>` | | The size of the map has changed. |
| `remove` | `MapEventBase<'remove'>` | | The map is removed. |
| `style.load` | `MapEventBase<'style.load'>` | | A complete style has loaded. |
| `webglcontextlost` | `MapEventBase<'webglcontextlost'>` | | The browser has taken the WebGL context away. |
| `webglcontextrestored` | `MapEventBase<'webglcontextrestored'>` | | The map has a WebGL context again after `webglcontextlost`. |
| `movestart` | `MapEventBase<'movestart'>` | | The view starts to change. |
| `move` | `MapEventBase<'move'>` | | The view changes. |
| `moveend` | `MapEventBase<'moveend'>` | | The view has stopped changing. |
| `zoomstart` | `MapEventBase<'zoomstart'>` | | The zoom starts to change. |
| `zoom` | `MapEventBase<'zoom'>` | | The zoom changes. |
| `zoomend` | `MapEventBase<'zoomend'>` | | The zoom has stopped changing. |
| `rotatestart` | `MapEventBase<'rotatestart'>` | | The bearing starts to change. |
| `rotate` | `MapEventBase<'rotate'>` | | The bearing changes. |
| `rotateend` | `MapEventBase<'rotateend'>` | | The bearing has stopped changing. |
| `pitchstart` | `MapEventBase<'pitchstart'>` | | The pitch starts to change. |
| `pitch` | `MapEventBase<'pitch'>` | | The pitch changes. |
| `pitchend` | `MapEventBase<'pitchend'>` | | The pitch has stopped changing. |
| `dragstart` | `MapDragEvent` | | The user starts to drag the map. |
| `drag` | `MapDragEvent` | | The user drags the map. |
| `dragend` | `MapDragEvent` | | The user stops dragging the map. |
| `dblclick` | `MapPointerEvent<'dblclick'>` | | A double click on the map. |
| `contextmenu` | `MapPointerEvent<'contextmenu'>` | | The browser asks for a context menu over the map, usually after a click with the right mouse button. |
| `mousedown` | `MapPointerEvent<'mousedown'>` | | A mouse button is pressed over the map. |
| `mousemove` | `MapPointerEvent<'mousemove'>` | | The mouse moves over the map. |
| `mouseup` | `MapPointerEvent<'mouseup'>` | | A mouse button is released over the map. |
| `mouseover` | `MapPointerEvent<'mouseover'>` | | The mouse enters the map. |
| `mouseout` | `MapPointerEvent<'mouseout'>` | | The mouse leaves the map. |
| `touchstart` | `MapTouchEvent<'touchstart'>` | | A finger touches the map. |
| `touchmove` | `MapTouchEvent<'touchmove'>` | | A finger moves on the map. |
| `touchend` | `MapTouchEvent<'touchend'>` | | A finger leaves the map. |
| `touchcancel` | `MapTouchEvent<'touchcancel'>` | | The browser cancels a touch on the map. |
| `styledata` | `MapDataEvent<'styledata'>` | | The style has changed. |
| `sourcedata` | `MapDataEvent<'sourcedata'>` | | A source has new data. |
| `data` | `MapDataEvent<'data'>` | | Each time that `styledata` or `sourcedata` fires. |
| `styledataloading` | `MapDataEvent<'styledataloading'>` | | The style starts to load. |
| `sourcedataloading` | `MapDataEvent<'sourcedataloading'>` | | A source starts to load. |
| `dataloading` | `MapDataEvent<'dataloading'>` | | Each time that `styledataloading` or `sourcedataloading` fires. |
| `click` | `MapPointerEvent<'click'>` | | A click on the map. |
| `wheel` | `MapPointerEvent<'wheel', WheelEvent>` | | A turn of the mouse wheel over the map. |
| `boxzoomstart` | `MapEventBase<'boxzoomstart'> & {originalEvent: PointerEvent}` | | A zoom to a box drawn with the Shift key and a drag starts. |
| `boxzoomcancel` | `MapEventBase<'boxzoomcancel'> & {originalEvent: Event}` | | A zoom to a box is cancelled. |
| `boxzoomend` | `MapEventBase<'boxzoomend'> & {originalEvent: Event; boxZoomBounds: [[number, number], [number, number]]}` | | A zoom to a box ends, with the bounds of the box as `boxZoomBounds`. |
| `stats` | `MapEventBase<'stats'> & {fps: number; frameMs: number; labels: number}` | | About once a second while the map renders: the frames per second, the CPU time of a frame in milliseconds on the thread that renders, and the number of labels placed. |
| `styleimagemissing` | `MapEventBase<'styleimagemissing'> & {id: string}` | | The style names an image (`id`) that the map does not have. |
| `terrain` | `MapEventBase<'terrain'> & {terrain: {source: string; exaggeration?: number} \| null}` | | The terrain changed. |
| `projectiontransition` | `MapEventBase<'projectiontransition'> & {newProjection: string}` | | The projection was applied, by a new style or a change of the projection type. |
| `geolocate` | `MapEventBase<'geolocate'> & {coords: GeolocationCoordinates}` | | The geolocate control of `@map-jr/map-jr-gl/controls` received a position. |
| `error` | `MapEventBase<'error'> & {error: unknown}` | | An error of the map. |
<!-- ref:MapEvents:end -->

<!-- ref:VueMapJrProps:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `mapStyle` **required** | `string \| StyleSpecification \| {light: string \| StyleSpecification; dark: string \| StyleSpecification}` | | The style: a style object, the URL of a style, or `{light, dark}` with one style for each resolved `colorScheme`. |
| `view` | `ViewInput` | | The view that the application controls, for `v-model:view`. |
| `initialView` | `InitialView` | | The view when the map is created: a center, zoom, bearing and pitch, or `bounds` to fit. |
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
| `attribution` | `false \| {compact?: boolean \| undefined; customAttribution?: string \| string[] \| undefined}` | | The options of the built-in attribution, or `false` to hide it. |
| `hash` | `string \| boolean` | `false` | Whether the view is kept in the hash of the URL; a string is the name of the parameter. |
| `ssr` | `boolean \| {width?: number; height?: number; overrides?: false \| Record<string, SSROverrides>; attribution?: string \| string[]; timeout?: number; requestTimeout?: number; maxBytes?: number; allowHosts?: string[]; tileZoomOffset?: number}` | `false` | Whether a server renders the first view as SVG into the page: `true`, or options. |
<!-- ref:VueMapJrProps:end -->

<!-- ref:ReactMapJrProps:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `mapStyle` **required** | `MapDescription['style']` | | The style: a style object, the URL of a style, or `{light, dark}`. |
| `onViewChange` | `(view: View) => void` | | Called with the new view at each change of the view. |
| `onHover` | `(features: RenderedFeature[]) => void` | | Called with the features of `interactiveLayers` under the pointer, the top one first, when they change. |
| `onLoad` | `() => void` | | Called when the style and the first tiles have loaded. |
| `onIdle` | `() => void` | | Called each time the camera is still and nothing loads. |
| `onError` | `(error: Error) => void` | | Called with each error of the map. |
| `firstView` | `string` | | The first view rendered on a server, as HTML: the result of `renderFirstView` from `@map-jr/map-jr-gl/server`. |
| `className` | `string` | | A CSS class to add to the element, after the class `map-jr-react`. |
| `style` | `CSSProperties` | | The CSS style of the element, merged over `{position: 'relative', width: '100%', height: '100%'}`. |
| `children` | `ReactNode` | | Content over the map, and `MapOverlay` elements. |
<!-- ref:ReactMapJrProps:end -->

<!-- ref:SvelteMapAction:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `description` **required** | `MapDescription` | | The description of the map. |
| `ready` | `(map: MapInstance) => void` | | Called with the map once it is created. |
<!-- ref:SvelteMapAction:end -->

<!-- ref:NavigationOptions:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `showZoom` | `boolean` | `true` | Whether the control shows the buttons to zoom in and out. |
| `showCompass` | `boolean` | `true` | Whether the control shows the compass. |
| `visualizePitch` | `boolean` | `false` | Whether the compass also shows the pitch, a drag on it changes the pitch, and a click on it resets the pitch. |
<!-- ref:NavigationOptions:end -->
