# Reference tables (fixture)

`scripts/reference.mjs` fills the blocks of this file, and `pnpm test:consistency` runs `--check` on it. The blocks
cover the types that the reference pages do not have yet, so that a member without TSDoc fails here first: the
events of the map, the members of the map, one method, the props of the Vue and React components, and the options of
the Svelte action. Do not edit the tables by hand: change the comment in `src/` and run
`node scripts/reference.mjs --write`.

## `MapInstance`

<!-- ref:MapInstance:start -->
| Name | Type | Description |
|---|---|---|
| `update` | `(spec: `[`MapDescription`](../../docs/reference/description.md#mapdescription)`) => void` | Applies a new description to the map. |
| `patch` | `(part: Partial<`[`MapDescription`](../../docs/reference/description.md#mapdescription)`>) => void` | Applies the fields of `part` and keeps the other fields of the current description. |
| `description` (read only) | `Readonly<`[`MapDescription`](../../docs/reference/description.md#mapdescription)`>` | The description of the last `createMap`, `update` or `patch`. |
| `getResolvedDescription` | `() => `[`MapDescription`](../../docs/reference/description.md#mapdescription) | Returns the description with `style` as a copy of the style that the map loaded and `globalState` as the global state in effect. |
| `destroy` | `() => void` | Removes the map, its controls and its overlays from the page. |
| `state` (read only) | `Readable<`[`MapState`](#mapstate)`>` | A store of the state of the map (`MapState`): `state.get()` returns it, and `state.subscribe(fn)` calls `fn` at each change. |
| `queryFeatures` | `(at?: FeaturePlace \| FeatureOptions, options?: FeatureOptions) => Promise<RenderedFeature[]>` | Returns the features that the style layers render at a place, the top one first. |
| `querySource` | `(sourceId: string, at?: FeaturePlace \| SourceOptions, options?: SourceOptions) => Promise<QueriedFeature[]>` | Returns the features of the tile data of a source, with no need of a style layer. |
| `watchFeatures` | `(at: FeaturePlace \| undefined, options: FeatureOptions, listener: (features: RenderedFeature[]) => void) => () => void` | Calls `listener` with the result of `queryFeatures` now and again each time that the result changes. |
| `watchSource` | `(sourceId: string, at: FeaturePlace \| undefined, options: SourceOptions, listener: (features: QueriedFeature[]) => void) => () => void` | Calls `listener` with the result of `querySource` now and again each time that the result changes. |
| `setFeatureState` | `(target: {source: string; sourceLayer?: string; id: number \| string}, state: Record<string, unknown>) => void` | Merges `state` into the feature state of one feature, which `feature-state` expressions read. |
| `removeFeatureState` | `(target: {source: string; sourceLayer?: string; id?: number \| string}, key?: string) => void` | Removes one key of the feature state of a feature, or its whole state when `key` is left out. |
| `queryElevation` | `(at: Position \| {x: number; y: number}) => Promise<number \| null>` | Returns the height of the ground at a position (`[lng, lat]`) or a point of the screen, from the terrain source. |
| `toBlob` | `(type?: string, quality?: number) => Promise<Blob>` | Returns the map as an image once the map is idle, in the size of the canvas in device pixels. |
| `clusterExpansionZoom` | `(sourceId: string, clusterId: number) => Promise<number>` | Returns the zoom level at which a cluster of a GeoJSON source with `cluster: true` divides. |
| `clusterChildren` | `(sourceId: string, clusterId: number) => Promise<ClusterFeature[]>` | Returns the clusters and points that a cluster divides into at the next zoom level. |
| `clusterLeaves` | `(sourceId: string, clusterId: number, options?: {limit?: number; offset?: number}) => Promise<ClusterFeature[]>` | Returns the points of a cluster. |
| `moveTo` | `(view: `[`MoveToOptions`](#movetooptions)`) => void` | Moves the camera to a view or to `bounds`, with an animation when `duration` is more than 0 or `fly` is set. |
| `fitBounds` | `(bounds: Bounds, options?: Omit<`[`MoveToOptions`](#movetooptions)`, 'bounds' \| 'center' \| 'zoom'>) => void` | Moves the camera to fit a box, as `moveTo({bounds, ...options})` with `duration` 800 ms unless `options` sets it. |
| `project` | `(lngLat: Position) => {x: number; y: number}` | Converts a position to a point of the screen. |
| `unproject` | `(point: {x: number; y: number}) => [number, number]` | Converts a point of the screen, in CSS pixels from the top left corner of the map, to a position. |
| `overlay` | `(element: HTMLElement, options: OverlayOptions) => MapOverlay` | Places an element of the page at a position of the map, as a marker, a label or a popup; the element moves with the map. |
| `listen` | `<K extends keyof `[`MapEvents`](#mapevents)`>(type: K, fn: (event: `[`MapEvents`](#mapevents)`[K]) => void) => () => void` | Calls `fn` for each event of a type of `MapEvents`. |
| `once` | `<K extends keyof `[`MapEvents`](#mapevents)`>(type: K) => Promise<`[`MapEvents`](#mapevents)`[K]>` | Waits for the next event of a type of `MapEvents`. |
| `container` (read only) | `HTMLElement` | The element that holds the map. |
<!-- ref:MapInstance:end -->

## `MapInstance.queryFeatures`

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

## `MapState`

<!-- ref:MapState:start -->
| Name | Type | Description |
|---|---|---|
| `loaded` | `boolean` | Whether the style and the tiles of the view have loaded for the first time. |
| `idle` | `boolean` | Whether the camera is still and nothing loads. |
| `moving` | `boolean` | Whether the camera moves. |
| `view` | [`View`](#view) | The current view. |
| `hover` | `RenderedFeature[]` | The features of `interactiveLayers` under the pointer, the top one first. |
| `pointer` | [`PointerPosition`](#pointerposition)` \| null` | Where the pointer is over the map, or `null` when it is not over the map. |
| `renderer` | `'worker' \| 'main' \| undefined` | The thread that renders the map, or `undefined` until `loaded` is `true`. |
| `colorScheme` | `'light' \| 'dark'` | The colour scheme of the controls: `colorScheme` of the description, with `'auto'` resolved. |
<!-- ref:MapState:end -->

## `View`

<!-- ref:View:start -->
| Name | Type | Description |
|---|---|---|
| `center` | `[number, number]` | The center of the view, `[lng, lat]`. |
| `zoom` | `number` | The zoom level. |
| `bearing` | `number` | The bearing in degrees clockwise from north. |
| `pitch` | `number` | The pitch in degrees from straight down. |
| `bounds` | `[[number, number], [number, number]]` | The smallest box that contains the visible map, `[[west, south], [east, north]]`. |
<!-- ref:View:end -->

## `PointerPosition`

<!-- ref:PointerPosition:start -->
| Name | Type | Description |
|---|---|---|
| `point` | `{x: number; y: number}` | The point in CSS pixels from the top left corner of the map. |
| `lngLat` | `[number, number]` | The position under the pointer, `[lng, lat]`. |
<!-- ref:PointerPosition:end -->

## `MapEvents`

<!-- ref:MapEvents:start -->
| Name | Type | Description |
|---|---|---|
| `load` | [`MapEventBase`](#mapeventbase)`<'load'>` | The style and the first tiles have loaded. |
| `idle` | [`MapEventBase`](#mapeventbase)`<'idle'>` | Nothing moves and nothing loads. |
| `render` | [`MapEventBase`](#mapeventbase)`<'render'>` | The map has drawn a frame. |
| `resize` | [`MapEventBase`](#mapeventbase)`<'resize'>` | The size of the map has changed. |
| `remove` | [`MapEventBase`](#mapeventbase)`<'remove'>` | The map is removed. |
| `style.load` | [`MapEventBase`](#mapeventbase)`<'style.load'>` | A complete style has loaded. |
| `webglcontextlost` | [`MapEventBase`](#mapeventbase)`<'webglcontextlost'>` | The browser has taken the WebGL context away. |
| `webglcontextrestored` | [`MapEventBase`](#mapeventbase)`<'webglcontextrestored'>` | The map has a WebGL context again after `webglcontextlost`. |
| `movestart` | [`MapEventBase`](#mapeventbase)`<'movestart'>` | The view starts to change. |
| `move` | [`MapEventBase`](#mapeventbase)`<'move'>` | The view changes. |
| `moveend` | [`MapEventBase`](#mapeventbase)`<'moveend'>` | The view has stopped changing. |
| `zoomstart` | [`MapEventBase`](#mapeventbase)`<'zoomstart'>` | The zoom starts to change. |
| `zoom` | [`MapEventBase`](#mapeventbase)`<'zoom'>` | The zoom changes. |
| `zoomend` | [`MapEventBase`](#mapeventbase)`<'zoomend'>` | The zoom has stopped changing. |
| `rotatestart` | [`MapEventBase`](#mapeventbase)`<'rotatestart'>` | The bearing starts to change. |
| `rotate` | [`MapEventBase`](#mapeventbase)`<'rotate'>` | The bearing changes. |
| `rotateend` | [`MapEventBase`](#mapeventbase)`<'rotateend'>` | The bearing has stopped changing. |
| `pitchstart` | [`MapEventBase`](#mapeventbase)`<'pitchstart'>` | The pitch starts to change. |
| `pitch` | [`MapEventBase`](#mapeventbase)`<'pitch'>` | The pitch changes. |
| `pitchend` | [`MapEventBase`](#mapeventbase)`<'pitchend'>` | The pitch has stopped changing. |
| `dragstart` | [`MapDragEvent`](#mapdragevent) | The user starts to drag the map. |
| `drag` | [`MapDragEvent`](#mapdragevent) | The user drags the map. |
| `dragend` | [`MapDragEvent`](#mapdragevent) | The user stops dragging the map. |
| `dblclick` | [`MapPointerEvent`](#mappointerevent)`<'dblclick'>` | A double click on the map. |
| `contextmenu` | [`MapPointerEvent`](#mappointerevent)`<'contextmenu'>` | The browser asks for a context menu over the map, usually after a click with the right mouse button. |
| `mousedown` | [`MapPointerEvent`](#mappointerevent)`<'mousedown'>` | A mouse button is pressed over the map. |
| `mousemove` | [`MapPointerEvent`](#mappointerevent)`<'mousemove'>` | The mouse moves over the map. |
| `mouseup` | [`MapPointerEvent`](#mappointerevent)`<'mouseup'>` | A mouse button is released over the map. |
| `mouseover` | [`MapPointerEvent`](#mappointerevent)`<'mouseover'>` | The mouse enters the map. |
| `mouseout` | [`MapPointerEvent`](#mappointerevent)`<'mouseout'>` | The mouse leaves the map. |
| `touchstart` | [`MapTouchEvent`](#maptouchevent)`<'touchstart'>` | A finger touches the map. |
| `touchmove` | [`MapTouchEvent`](#maptouchevent)`<'touchmove'>` | A finger moves on the map. |
| `touchend` | [`MapTouchEvent`](#maptouchevent)`<'touchend'>` | A finger leaves the map. |
| `touchcancel` | [`MapTouchEvent`](#maptouchevent)`<'touchcancel'>` | The browser cancels a touch on the map. |
| `styledata` | [`MapDataEvent`](#mapdataevent)`<'styledata'>` | The style has changed. |
| `sourcedata` | [`MapDataEvent`](#mapdataevent)`<'sourcedata'>` | A source has new data. |
| `data` | [`MapDataEvent`](#mapdataevent)`<'data'>` | Each time that `styledata` or `sourcedata` fires. |
| `styledataloading` | [`MapDataEvent`](#mapdataevent)`<'styledataloading'>` | The style starts to load. |
| `sourcedataloading` | [`MapDataEvent`](#mapdataevent)`<'sourcedataloading'>` | A source starts to load. |
| `dataloading` | [`MapDataEvent`](#mapdataevent)`<'dataloading'>` | Each time that `styledataloading` or `sourcedataloading` fires. |
| `click` | [`MapPointerEvent`](#mappointerevent)`<'click'>` | A click on the map. |
| `wheel` | [`MapPointerEvent`](#mappointerevent)`<'wheel', WheelEvent>` | A turn of the mouse wheel over the map. |
| `boxzoomstart` | [`MapEventBase`](#mapeventbase)`<'boxzoomstart'> & {originalEvent: PointerEvent}` | A zoom to a box drawn with the Shift key and a drag starts. |
| `boxzoomcancel` | [`MapEventBase`](#mapeventbase)`<'boxzoomcancel'> & {originalEvent: Event}` | A zoom to a box is cancelled. |
| `boxzoomend` | [`MapEventBase`](#mapeventbase)`<'boxzoomend'> & {originalEvent: Event; boxZoomBounds: [[number, number], [number, number]]}` | A zoom to a box ends, with the bounds of the box as `boxZoomBounds`. |
| `stats` | [`MapEventBase`](#mapeventbase)`<'stats'> & {fps: number; frameMs: number; labels: number}` | About once a second while the map renders: the frames per second, the CPU time of a frame in milliseconds on the thread that renders, and the number of labels placed. |
| `styleimagemissing` | [`MapEventBase`](#mapeventbase)`<'styleimagemissing'> & {id: string}` | The style names an image (`id`) that the map does not have. |
| `terrain` | [`MapEventBase`](#mapeventbase)`<'terrain'> & {terrain: {source: string; exaggeration?: number} \| null}` | The terrain changed. |
| `projectiontransition` | [`MapEventBase`](#mapeventbase)`<'projectiontransition'> & {newProjection: string}` | The projection was applied, by a new style or a change of the projection type. |
| `geolocate` | [`MapEventBase`](#mapeventbase)`<'geolocate'> & {coords: GeolocationCoordinates}` | The geolocate control of `@map-jr/map-jr-gl/controls` received a position. |
| `error` | [`MapEventBase`](#mapeventbase)`<'error'> & {error: unknown}` | An error of the map. |
<!-- ref:MapEvents:end -->

## `MapEventBase`

<!-- ref:MapEventBase:start -->
| Name | Type | Description |
|---|---|---|
| `type` | `T` | The name of the event. |
| `target` | [`MapInstance`](#mapinstance) | The map that fired the event, as `createMap` returned it. |
<!-- ref:MapEventBase:end -->

## `MapPointerEvent`

<!-- ref:MapPointerEvent:start -->
| Name | Type | Description |
|---|---|---|
| `point` | `{x: number; y: number}` | The point in CSS pixels from the top left corner of the map. |
| `lngLat` | `[number, number]` | The position under the pointer, `[lng, lat]`. |
| `originalEvent` | `E` | The DOM event. |
| `preventDefault` | `() => void` | Stops what the map does for this event. |
| `defaultPrevented` (read only) | `boolean` | Whether a listener called `preventDefault()`. |
<!-- ref:MapPointerEvent:end -->

## `MapDragEvent`

<!-- ref:MapDragEvent:start -->
| Name | Type | Description |
|---|---|---|
| `originalEvent` | `MouseEvent \| TouchEvent` | The mouse or touch event that moved the map. |
<!-- ref:MapDragEvent:end -->

## `MapTouchEvent`

<!-- ref:MapTouchEvent:start -->
| Name | Type | Description |
|---|---|---|
| `points` | `{x: number; y: number}[]` | The point of each finger on the map, in CSS pixels from the top left corner of the map. |
| `lngLats` | `[number, number][]` | The position of each finger on the map, `[lng, lat]`. |
<!-- ref:MapTouchEvent:end -->

## `MapDataEvent`

<!-- ref:MapDataEvent:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `dataType` **required** | `'source' \| 'style'` | | Whether the event concerns the style or one source. |
| `sourceId` | `string` | | The id of the source, for `dataType: 'source'`. |
| `isSourceLoaded` | `boolean` | | Whether the tiles of the source for the view have loaded, for `dataType: 'source'`. |
| `source` | `unknown` | | The source as the style specifies it, for `dataType: 'source'`. |
<!-- ref:MapDataEvent:end -->

## `ViewInput`

<!-- ref:ViewInput:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `center` | `Position` | | The center of the view, `[lng, lat]`. |
| `zoom` | `number` | | The zoom level. |
| `bearing` | `number` | | The bearing in degrees clockwise from north. |
| `pitch` | `number` | | The pitch in degrees from straight down. |
<!-- ref:ViewInput:end -->

## `InitialView`

<!-- ref:InitialView:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `bounds` | `Bounds` | | A box to fit into the map. |
| `padding` | `PaddingInput` | `0` | Space in CSS pixels around `bounds` for this fit, added to `padding` of the description. |
| `maxZoom` | `number` | | The largest zoom level of the fit of `bounds`, for a small box. |
<!-- ref:InitialView:end -->

## `MoveToOptions`

<!-- ref:MoveToOptions:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `duration` | `number` | `0` | The duration of the animation in milliseconds. |
| `fly` | `boolean \| FlyOptions` | `false` | Whether the camera zooms out and back in on the way. |
<!-- ref:MoveToOptions:end -->

## `VueMapJrProps`

<!-- ref:VueMapJrProps:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `mapStyle` **required** | `string \| StyleSpecification \| {light: string \| StyleSpecification; dark: string \| StyleSpecification}` | | The style: a style object, the URL of a style, or `{light, dark}` with one style for each resolved `colorScheme`. |
| `view` | [`ViewInput`](#viewinput) | | The view that the application controls, for `v-model:view`. |
| `initialView` | [`InitialView`](#initialview) | | The view when the map is created: a center, zoom, bearing and pitch, or `bounds` to fit. |
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

## `ReactMapJrProps`

<!-- ref:ReactMapJrProps:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `mapStyle` **required** | [`MapDescription`](../../docs/reference/description.md#mapdescription)`['style']` | | The style: a style object, the URL of a style, or `{light, dark}`. |
| `onViewChange` | `(view: `[`View`](#view)`) => void` | | Called with the new view at each change of the view. |
| `onHover` | `(features: RenderedFeature[]) => void` | | Called with the features of `interactiveLayers` under the pointer, the top one first, when they change. |
| `onLoad` | `() => void` | | Called when the style and the first tiles have loaded. |
| `onIdle` | `() => void` | | Called each time the camera is still and nothing loads. |
| `onError` | `(error: Error) => void` | | Called with each error of the map. |
| `firstView` | `string` | | The first view rendered on a server, as HTML: the result of `renderFirstView` from `@map-jr/map-jr-gl/server`. |
| `className` | `string` | | A CSS class to add to the element, after the class `map-jr-react`. |
| `style` | `CSSProperties` | | The CSS style of the element, merged over `{position: 'relative', width: '100%', height: '100%'}`. |
| `children` | `ReactNode` | | Content over the map, and `MapOverlay` elements. |
<!-- ref:ReactMapJrProps:end -->

## `SvelteMapAction`

<!-- ref:SvelteMapAction:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `description` **required** | [`MapDescription`](../../docs/reference/description.md#mapdescription) | | The description of the map. |
| `ready` | `(map: `[`MapInstance`](#mapinstance)`) => void` | | Called with the map once it is created. |
<!-- ref:SvelteMapAction:end -->
## `MapJrElement`

<!-- ref:MapJrElement:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `mapStyle` | [`MapDescription`](../../docs/reference/description.md#mapdescription)`['style']` | | The `style` of the description: the URL of a style or a style object. |
| `map` (read only) | [`MapInstance`](#mapinstance)` \| null` | | The map (`MapInstance`), from the microtask after the element is added to the page until it is removed, or else `null`. |
| `state` (read only) | [`MapInstance`](#mapinstance)`['state'] \| null` | | The state of the map as a store (`map.state`), or `null` while there is no map. |
| `addEventListener` | `(type: string, listener: EventListenerOrEventListenerObject, options?: boolean \| AddEventListenerOptions \| undefined) => void` | | Adds a listener, as on any element. |
<!-- ref:MapJrElement:end -->
