# The state

The state (`MapState`) holds what a map of `@map-jr/map-jr-gl` reports: the view, whether the map has loaded and is
idle, and the features under the pointer. [`map.state`](map.md#state) is a store of the state: `get()` returns it, and
`subscribe` calls a function at each change.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
  interactiveLayers: ['building-3d'],
});
console.log(map.state.get().view.zoom);
const stop = map.state.subscribe(state => state.hover, buildings => console.log(buildings[0]?.properties));
```

## `Readable`

`map.state` has the type `Readable<MapState>`. In the table, `T` is `MapState`.

<!-- ref:Readable:start -->
| Name | Type | Description |
|---|---|---|
| `get` | `() => T` | Returns the current value. |
| `subscribe` | `(fn: (value: T) => void) => () => void` | Calls `fn` after each change. |
<!-- ref:Readable:end -->

`subscribe` accepts a selector as its first argument: `subscribe(select, fn)` calls `fn` only when the part that
`select` returns changes, compared with `Object.is`. `fn` receives the part and the state. Both forms return a function
that stops the calls.

A state object never changes. Each change creates a new object, and a part that did not change is the same object as
before. React reads such a store with `useSyncExternalStore`, Vue with a `shallowRef`, and Svelte as a store.

## `MapState`

<!-- ref:MapState:start -->
| Name | Type | Description |
|---|---|---|
| `loaded` | `boolean` | Whether the style and the tiles of the view have loaded for the first time. |
| `idle` | `boolean` | Whether the camera is still and nothing loads. |
| `moving` | `boolean` | Whether the camera moves. |
| `view` | [`View`](#view) | The current view. |
| `hover` | [`RenderedFeature`](types.md#renderedfeature)`[]` | The features of `interactiveLayers` under the pointer, the top one first. |
| `pointer` | [`PointerPosition`](#pointerposition)` \| null` | Where the pointer is over the map, or `null` when it is not over the map. |
| `renderer` | `'worker' \| 'main' \| undefined` | The thread that renders the map, or `undefined` until `loaded` is `true`. |
| `colorScheme` | `'light' \| 'dark'` | The colour scheme of the controls: `colorScheme` of the description, with `'auto'` resolved. |
<!-- ref:MapState:end -->

- `loaded` becomes `true` before `idle` does, in the same task. A listener of `load` and a subscriber of `loaded` see
  `idle: false`, so code there that waits for the first `idle` receives it.
- `view` changes when the map moves and when the size of the map changes.
- `hover` and `pointer` can be one frame late.
- `pointer` is `null` before the first move of the mouse and after the mouse leaves the map. It changes at each move
  of the mouse, also without `interactiveLayers`, and a touch does not set it. A subscriber without a selector is
  therefore called at each move: subscribe to `state => state.pointer` where only the pointer matters.
- `colorScheme` resolves `'auto'` with the media query `prefers-color-scheme`.

The state has no field for errors. To receive each error of the map, set [`onError`](description.md#mapdescription) in
the description or call [`map.listen('error', fn)`](events.md#mapevents).

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

`bounds` contains the whole visible map also when the map has a bearing or a pitch, as `getBounds()` of MapLibre GL JS
returns it.

## `PointerPosition`

<!-- ref:PointerPosition:start -->
| Name | Type | Description |
|---|---|---|
| `point` | `{x: number; y: number}` | The point in CSS pixels from the top left corner of the map. |
| `lngLat` | `[number, number]` | The position under the pointer, `[lng, lat]`. |
<!-- ref:PointerPosition:end -->

## See also

- [`createStore`](exports.md#createstore) for a store of the same kind for the application.
- [The map](map.md) for the methods of the map.
- [Events](events.md) for the events that `listen` receives.
