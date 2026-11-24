# Events

A map of `@map-jr/map-jr-gl` fires events when it loads, moves, renders and receives input. To receive them, call
[`map.listen(type, fn)`](map.md#listen) or [`map.once(type)`](map.md#once). For the common needs, read
[the state](state.md) or set `onClick`, `onViewChange` and `onError` in the [description](description.md#mapdescription).
`onError` is `(error: Error) => void`, and it receives the errors of the `error` event.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
});
const stop = map.listen('click', event => console.log(event.lngLat));
```

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
| `boxzoomcancel` | [`MapEventBase`](#mapeventbase)`<'boxzoomcancel'> & {originalEvent: Event}` | A zoom to a box is canceled. |
| `boxzoomend` | [`MapEventBase`](#mapeventbase)`<'boxzoomend'> & {originalEvent: Event; boxZoomBounds: [[number, number], [number, number]]}` | A zoom to a box ends, with the bounds of the box as `boxZoomBounds`. |
| `stats` | [`MapEventBase`](#mapeventbase)`<'stats'> & {fps: number; frameMs: number; labels: number}` | About once a second while the map renders: the frames per second, the CPU time of a frame in milliseconds on the thread that renders, and the number of labels placed. |
| `styleimagemissing` | [`MapEventBase`](#mapeventbase)`<'styleimagemissing'> & {id: string}` | The style names an image (`id`) that the map does not have. |
| `terrain` | [`MapEventBase`](#mapeventbase)`<'terrain'> & {terrain: {source: string; exaggeration?: number} \| null}` | The terrain changed. |
| `projectiontransition` | [`MapEventBase`](#mapeventbase)`<'projectiontransition'> & {newProjection: string}` | The projection was applied, by a new style or a change of the projection type. |
| `geolocate` | [`MapEventBase`](#mapeventbase)`<'geolocate'> & {coords: GeolocationCoordinates}` | The geolocate control of `@map-jr/map-jr-gl/controls` received a position. |
| `error` | [`MapEventBase`](#mapeventbase)`<'error'> & {error: unknown}` | An error of the map. |
<!-- ref:MapEvents:end -->

A position in an event is `[lng, lat]`, and a box is `[[west, south], [east, north]]`.

- `load` fires once, before the first `idle`.
- `style.load` fires each time that a new style has loaded.
- `remove` fires during [`destroy()`](map.md#destroy), before the pending queries reject.
- `idle` waits for the tiles of the view. A tile whose request fails with a network error or an HTTP status 5xx is
  requested again after 0.5 s, 1 s and 2 s. After the fourth failure, the map is idle without the tile. A status 4xx
  other than 404, a rejection by a custom protocol and an error of `transformRequest` are final: the tile is not
  requested again. A 404 is a tile that the server does not have, and it is not an error. Each failure fires `error`.
- `data` fires with each `styledata` and `sourcedata`, and `dataloading` with each `styledataloading` and
  `sourcedataloading`. `styledata` has `dataType: 'style'`.
- `projectiontransition` fires for each new style, and when `projection` of the description or the control `globe`
  changes the type. `newProjection` is `'mercator'`, `'globe'` or `'vertical-perspective'`. An expression results in
  `'globe'`, and a type that the library does not know results in `'mercator'`.
- `stats` fires at most once a second while the map renders. `labels` counts the labels and icons that the last frame
  placed. Icons that the map draws from buffers are not counted: see [Markers and popups](../guide/markers-and-popups.md#keep-many-markers-fast).
- `error` has the value that failed, which can be other than an `Error`. `onError` of the description receives the
  same errors as `Error` objects. Without `onError`, the map writes each error to the console.

## A lost WebGL context

When the browser takes the WebGL context away, the map fires `webglcontextlost`, starts again on a new canvas with
the same view and data, and fires `webglcontextrestored`. This list is the state set by the description or by calls
that the new canvas keeps:

- the style with the changes of calls: sources, layers, paint and layout properties, filters, terrain, sky, light,
  projection and the global state;
- the data of the GeoJSON sources, the images and the feature state;
- the camera padding, the limits of the camera (`minZoom`, `maxZoom`, `minPitch`, `maxPitch` and `maxBounds`) and
  `transformRequest`;
- the fonts: in `@map-jr/map-jr-gl` the `fonts` of the description, and in `@map-jr/map-jr-gl/maplibre-compat` the
  option `fonts` and the fonts of `addFonts`, which only that entry has;
- in `@map-jr/map-jr-gl/maplibre-compat`, the function of the option `transformConstrain` or of
  `setTransformConstrain`, the values of `setSourceTileLodParams` and the custom layers, whose `onAdd` runs again
  with the new context.

A map with the worker renderer starts again on the main thread in these cases, and with `renderer: 'worker'` it writes
a warning:

- the worker loses the context before its first frame;
- the worker loses the context twice within 10 seconds;
- the worker renders no frame in the 5 seconds after its start or a restart. It fires `webglcontextlost` first.

When the main thread then loses the context before its first frame, or renders no frame in the 15 seconds after the
restart, the map fires `error` and does not start again. The time in which the page is hidden or the map has no size
does not count.

## `MapEventBase`

Every event has these members:

<!-- ref:MapEventBase:start -->
| Name | Type | Description |
|---|---|---|
| `type` | `string` | The name of the event. |
| `target` | [`MapInstance`](map.md#mapinstance) | The map that fired the event, as `createMap` returned it. |
<!-- ref:MapEventBase:end -->

## `MapPointerEvent`

The events of the mouse (`click`, `dblclick`, `contextmenu`, `mousedown`, `mousemove`, `mouseup`, `mouseover`,
`mouseout` and `wheel`) have these members:

<!-- ref:MapPointerEvent:start -->
| Name | Type | Description |
|---|---|---|
| `point` | `{x: number; y: number}` | The point in CSS pixels from the top left corner of the map. |
| `lngLat` | `[number, number]` | The position under the pointer, `[lng, lat]`. |
| `originalEvent` | `MouseEvent` | The DOM event. |
| `preventDefault` | `() => void` | Stops what the map does for this event. |
| `defaultPrevented` (read only) | `boolean` | Whether a listener called `preventDefault()`. |
<!-- ref:MapPointerEvent:end -->

A listener that calls `preventDefault()` stops what the map does for the event, such as a drag or a zoom.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
});
map.listen('dblclick', event => event.preventDefault());
```

## `MapTouchEvent`

The events of a touch have the members of `MapPointerEvent`, with a `PointerEvent` as `originalEvent`, and these:

<!-- ref:MapTouchEvent:start -->
| Name | Type | Description |
|---|---|---|
| `points` | `{x: number; y: number}[]` | The point of each finger on the map, in CSS pixels from the top left corner of the map. |
| `lngLats` | `[number, number][]` | The position of each finger on the map, `[lng, lat]`. |
<!-- ref:MapTouchEvent:end -->

## `MapDragEvent`

`dragstart`, `drag` and `dragend` have this member:

<!-- ref:MapDragEvent:start -->
| Name | Type | Description |
|---|---|---|
| `originalEvent` | `MouseEvent \| TouchEvent` | The mouse or touch event that moved the map. |
<!-- ref:MapDragEvent:end -->

## `MapDataEvent`

The events of the data (`styledata`, `sourcedata`, `data` and the events that end in `loading`) have these members:

<!-- ref:MapDataEvent:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `dataType` **required** | `'source' \| 'style'` | | Whether the event concerns the style or one source. |
| `sourceId` | `string` | | The id of the source, for `dataType: 'source'`. |
| `isSourceLoaded` | `boolean` | | Whether the tiles of the source for the view have loaded, for `dataType: 'source'`. |
| `source` | `unknown` | | The source as the style specifies it, for `dataType: 'source'`. |
<!-- ref:MapDataEvent:end -->

## See also

- [`listen`](map.md#listen) and [`once`](map.md#once) for how to receive events.
- [The state](state.md) for the values that a subscriber can watch in place of events.
