# Controls

The functions of `@map-jr/map-jr-gl/controls` create the controls of a map: the zoom buttons and the compass, the
scale bar, and the buttons for the full screen, the position of the user, terrain, the globe and the colour scheme.
Each function returns an item for [`controls`](description.md#controls) of the description. See
[Controls](../guide/controls.md) for how to add, change and style them.

```js
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, scale, fullscreen} from '@map-jr/map-jr-gl/controls';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13},
  controls: [navigation(), scale({position: 'bottom-left'}), fullscreen({position: 'top-left'})],
});
```

## The list of controls

The map shows the controls of the last description, and each item of `controls` is one control.

- **Identity.** Two items are the same control when they come from the same function with the same options,
  `position` included. For [`custom`](#custom), two items are the same control when they have the same `key`.
- **A new list.** The map keeps a control that the new list has. It removes a control that the new list does not
  have. A control whose options changed is a different control: the map removes the old one and adds the new one.
- **A duplicate.** When the list has the same control twice, the map shows it once. It gives no warning.
- **Order.** When the map is created, the first control of a corner in the list is nearest to the corner. A control
  that a later description adds goes after the controls that the corner has.
- **Loading.** The map loads the code of the controls in one file when it adds the first control, so each control
  except [`custom`](#custom) appears a moment after the map adds it. When the file does not load, the console shows
  the error `[map-jr-gl] The control "<name>" could not be loaded` and the map works without the control.
- **Texts.** A change of [`locale`](description.md#locale) removes every control and adds it again with the new
  texts. See [The texts of the controls](#the-texts-of-the-controls).

The attribution is not a control of this list. See [`attribution`](description.md#attribution) to change it or to
turn it off.

## `position`

Every function accepts `position`: the corner of the map that the control is placed in.

```ts
type ControlPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
```

The default is `'top-right'` for every control, `scale()` included.

## `navigation()`

Creates buttons to zoom in and out, and a compass that turns the map to the north.

```ts
navigation(options?: NavigationOptions & {position?: ControlPosition}): ControlSpec
```

A click on the compass sets the bearing to 0. A drag sideways on the compass rotates the map. The zoom in button is
disabled at the largest zoom level of the map, and the zoom out button at the smallest.

### `NavigationOptions`

<!-- ref:NavigationOptions:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `showZoom` | `boolean` | `true` | Whether the control shows the buttons to zoom in and out. |
| `showCompass` | `boolean` | `true` | Whether the control shows the compass. |
| `visualizePitch` | `boolean` | `false` | Whether the compass also shows the pitch, a drag on it changes the pitch, and a click on it resets the pitch. |
<!-- ref:NavigationOptions:end -->

## `scale()`

Creates a scale bar that shows a round distance at the scale of the map.

```ts
scale(options?: ScaleOptions & {position?: ControlPosition}): ControlSpec
```

The bar shows metres and kilometres with `unit: 'metric'`, feet and miles with `'imperial'`, and nautical miles with
`'nautical'`.

### `ScaleOptions`

<!-- ref:ScaleOptions:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `maxWidth` | `number` | `100` | The largest width of the scale bar, in CSS pixels. |
| `unit` | `'metric' \| 'imperial' \| 'nautical'` | `'metric'` | The unit of the distances that the scale bar shows. |
<!-- ref:ScaleOptions:end -->

## `fullscreen()`

Creates a button that shows the map on the full screen, and a second click leaves it.

```ts
fullscreen(options?: {position?: ControlPosition}): ControlSpec
```

Where the browser has no Fullscreen API, as Safari on iPhone, the container of the map receives the class
`map-jr-pseudo-fullscreen` and fills the window.

## `geolocate()`

Creates a button that moves the map to the position of the user.

```ts
geolocate(options?: GeolocateOptions & {position?: ControlPosition}): ControlSpec
```

When the browser returns a position, the map moves to it and fires the event `geolocate` with `coords`. The map
zooms in to `zoom`, and a map that is zoomed in further keeps its zoom. When the
browser returns an error, for example because the user denied the request, the map fires the event `error`. Listen
to both with [`map.listen`](../api.md#events). For a position outside of [`maxBounds`](description.md#maxbounds),
the map does not move and fires no `geolocate`.

### `GeolocateOptions`

<!-- ref:GeolocateOptions:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `zoom` | `number` | `14` | The zoom level that the map moves to when it finds the position. |
| `positionOptions` | `PositionOptions` | | The options that the control passes to `navigator.geolocation`. |
| `trackUserLocation` | `boolean` | `false` | Whether the button turns tracking of the position on and off, instead of moving the map once. |
| `showUserLocation` | `boolean` | `true` | Whether the map shows a dot at the position of the user while it tracks the position. |
<!-- ref:GeolocateOptions:end -->

## `terrain()`

Creates a button that turns 3D terrain on and off.

```ts
terrain(options: TerrainOptions & {position?: ControlPosition}): ControlSpec
```

A click turns on the terrain of `source` with `exaggeration`, or turns the terrain off. It changes the map until a
description with a different [`terrain`](description.md#terrain) is passed.

```js
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, terrain} from '@map-jr/map-jr-gl/controls';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation.json',
  initialView: {center: [10.9, 47.3], zoom: 11, pitch: 60},
  controls: [navigation(), terrain({source: 'terrarium', exaggeration: 1.5})],
});
```

### `TerrainOptions`

<!-- ref:TerrainOptions:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `source` **required** | `string` | | The id of the `raster-dem` source of the style that provides the heights. |
| `exaggeration` | `number` | `1` | The factor by which the heights of the terrain are multiplied. |
<!-- ref:TerrainOptions:end -->

## `globe()`

Creates a button that switches the projection between `globe` and `mercator`.

```ts
globe(options?: {position?: ControlPosition}): ControlSpec
```

While the projection is `globe`, the button has the class `map-jr-ctrl-globe-enabled` and `aria-pressed="true"`. A
click changes the map until a description with a different [`projection`](description.md#projection) is passed.

## `colorScheme()`

Creates a button that switches the map between the light and the dark colour scheme.

```ts
colorScheme(options?: {position?: ControlPosition}): ControlSpec
```

The button shows the scheme that the map has. A click sets [`colorScheme`](description.md#colorscheme-and-oncolorschemechange)
of the description and calls `onColorSchemeChange` with the new value. When `colorScheme` is `'auto'`, a click sets
the scheme opposite to that of the system, and the next click sets `'auto'` again. See
[Light and dark maps](../guide/color-scheme.md#let-the-user-switch-the-scheme) for an example.

## `custom()`

Creates a control from an element of your page, or from a control written for MapLibre GL JS.

```ts
custom(options: {key: string; position?: ControlPosition} & ({element: HTMLElement} | {onAdd(map): HTMLElement; onRemove(map): void})): ControlSpec
```

| Name | Type | Description |
|---|---|---|
| `key` **required** | `string` | The identity of the control: the map keeps the control while the list has an item with this `key`. |
| `element` | `HTMLElement` | The element that the map places in the corner. |
| `onAdd` | `(map) => HTMLElement` | Called when the map adds the control, and returns the element to place. |
| `onRemove` | `(map) => void` | Called when the map removes the control. |

Pass `element`, or `onAdd` with `onRemove`.

- The element shows at once. It does not wait for the code of the other controls.
- The map adds the class `map-jr-ctrl` to `element`, and an element without it receives no clicks. An assignment to
  `className` removes the class: add your own classes with `classList.add`.
- The map keeps the element that it received first for a `key`. To show another element, pass it with a new `key`.
- `onAdd` receives the map on which the main API is built, and not the object that `createMap` returns. That map has
  methods such as `on`, `off`, `getContainer`, `getCanvas`, `project`, `unproject`, `getZoom`, `getCenter` and
  `getBearing`, but not every method of a map of MapLibre GL JS.

```js
import {createMap} from '@map-jr/map-jr-gl';
import {custom} from '@map-jr/map-jr-gl/controls';

const button = document.createElement('button');
button.textContent = 'Reset view';
button.addEventListener('click', () => map.moveTo({center: [-74.0065, 40.7085], zoom: 13, duration: 500}));

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13},
  controls: [custom({key: 'reset-view', position: 'top-left', element: button})],
});
```

In the development build, `custom()` without a `key`, or with neither `element` nor `onAdd`, throws an error that
shows both forms.

## The texts of the controls

[`locale`](description.md#locale) of the description sets the texts of the controls, the attribution, the popup,
the marker and the hint of `cooperativeGestures` by these keys. A key that is
not set keeps the English text.

| Key | English text |
|---|---|
| `NavigationControl.ZoomIn` | `Zoom in` |
| `NavigationControl.ZoomOut` | `Zoom out` |
| `NavigationControl.ResetBearing` | `Reset bearing to north` |
| `ScaleControl.Meters` | `m` |
| `ScaleControl.Kilometers` | `km` |
| `ScaleControl.Feet` | `ft` |
| `ScaleControl.Miles` | `mi` |
| `ScaleControl.NauticalMiles` | `nm` |
| `FullscreenControl.Enter` | `Enter fullscreen` |
| `FullscreenControl.Exit` | `Exit fullscreen` |
| `GeolocateControl.FindMyLocation` | `Find my location` |
| `GeolocateControl.LocationNotAvailable` | `Location not available` |
| `TerrainControl.Enable` | `Toggle terrain` |
| `TerrainControl.Disable` | `Toggle terrain` |
| `GlobeControl.Enable` | `Enable globe` |
| `GlobeControl.Disable` | `Disable globe` |
| `ColorSchemeControl.Light` | `Use light colours` |
| `ColorSchemeControl.Dark` | `Use dark colours` |
| `AttributionControl.ToggleAttribution` | `Toggle map data credits` (the label) and `Map data credits` (the title) |
| `Popup.Close` | `Close popup` |
| `Marker.Title` | `Map marker` |
| `CooperativeGesturesHandler.WindowsHelpText` | `Use Ctrl + scroll to zoom the map` |
| `CooperativeGesturesHandler.MacHelpText` | `Use ⌘ + scroll to zoom the map` |
| `CooperativeGesturesHandler.MobileHelpText` | `Use two fingers to move the map` |

`ColorSchemeControl.Light` and `ColorSchemeControl.Dark` are keys of this library. The other keys are those of the
option `locale` of MapLibre GL JS.

```js
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, scale} from '@map-jr/map-jr-gl/controls';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [2.3522, 48.8566], zoom: 12},
  controls: [navigation(), scale()],
  locale: {'NavigationControl.ZoomIn': 'Zoom avant', 'NavigationControl.ZoomOut': 'Zoom arrière'},
});
```

## See also

- [Controls](../guide/controls.md) for the look of the controls and a control of your own in Vue and React.
- [`controls`](description.md#controls) and [`locale`](description.md#locale) in the reference of the description.
- [MapLibre compatibility](../maplibre-compatibility.md) for the controls of the compat entry.
