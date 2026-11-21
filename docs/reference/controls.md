# Controls

The functions of `@map-jr/map-jr-gl/controls` create the controls of a map: the zoom buttons and the compass, the
scale bar, and the buttons for the full screen, the position of the user, terrain, the globe and the colour scheme.
Each function returns a `ControlSpec`: an item for [`controls`](description.md#controls) of the description. Create
a `ControlSpec` only with these functions, and use [`custom`](#custom) for a control of your own. See
[Controls](../guide/controls.md) for how to add, change and style them.

```js
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, scale, fullscreen} from '@map-jr/map-jr-gl/controls';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13},
  controls: [
    navigation(),
    scale({position: 'bottom-left'}),
    fullscreen({position: 'top-left'}),
  ],
});
```

## The list of controls

The map shows the controls of the last description, and each item of `controls` is one control.

- **Identity.** Two items are the same control when they come from the same function with options that are equal
  as JSON, with the properties in the same order. `position` is one of the options, and
  `scale({unit: 'imperial', maxWidth: 80})` and `scale({maxWidth: 80, unit: 'imperial'})` are two different controls.
- **A new list.** The map keeps a control that the new list has, also when the function is called again for each
  description. It removes a control that the new list does not have. A control whose options changed is a
  different control: the map removes the old one and adds the new one last in its corner.
- **`custom`.** Two items of [`custom`](#custom) are the same control when they have the same `key`. A new
  `position` with the same `key` has no effect. To move the control, pass a new `key`.
- **A duplicate.** When the list has the same control twice, the map shows it once.
- **Order.** When the map is created, the first control of a corner in the list is nearest to the corner. A control
  that a later description adds goes after the controls that the corner has.
- **Loading.** Each control except [`custom`](#custom) appears a moment after the map adds it, because the map
  loads the code of the controls then. When that code does not load, the console shows the error
  `[map-jr-gl] The control "<name>" could not be loaded`, and the map works without the control. Serve every file of
  `dist/` of the package from the folder of the file that the page imports.
- **Texts.** A change of [`locale`](description.md#locale) removes every control and adds it again with the new
  texts. See [The texts of the controls](#the-texts-of-the-controls).

The attribution is not a control of this list. See [`attribution`](description.md#attribution) to change it or to
turn it off.

## `position`

Every function accepts `position` with its other options: the corner of the map that the control is placed in.

```ts
type ControlPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';
```

The default is `'top-right'`, except for `scale()`, whose default is `'bottom-left'`.

## `navigation()`

Creates buttons to zoom in and out, and a compass that turns the map to the north.

```ts
navigation(options?: NavigationOptions): ControlSpec
```

A click on the compass sets the bearing to 0, and with `visualizePitch: true` also the pitch. A drag sideways on the
compass changes the bearing. With `visualizePitch: true`, the compass tilts with the pitch, and a drag up or down on
it changes the pitch. The zoom in button is
disabled at the largest zoom level of the map, and the zoom out button at the smallest.

### `NavigationOptions`

<!-- ref:NavigationOptions:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `showZoom` | `boolean` | `true` | Whether the control shows the buttons to zoom in and out. |
| `showCompass` | `boolean` | `true` | Whether the control shows the compass. |
| `visualizePitch` | `boolean` | `false` | Whether the compass shows and changes the pitch as well as the bearing. |
<!-- ref:NavigationOptions:end -->

## `scale()`

Creates a scale bar. The bar shows a distance of 1, 2, 3 or 5 times a power of ten, and its length on the screen
is that distance at the scale of the map.

```ts
scale(options?: ScaleOptions): ControlSpec
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
fullscreen(options?: {
  position?: ControlPosition;
}): ControlSpec
```

Where the browser has no Fullscreen API, as Safari on iPhone, the container of the map receives the class
`map-jr-pseudo-fullscreen` and fills the window. A second click removes the class.

## `geolocate()`

Creates a button that moves the map to the position of the user.

```ts
geolocate(options?: GeolocateOptions): ControlSpec
```

When the browser returns a position, the map moves to it and zooms in to `zoom`. A map that is zoomed in further
keeps its zoom. The map fires these events of [`MapEvents`](events.md#mapevents), which `map.listen` receives:

| Event | Fields |
|---|---|
| `geolocate` | `coords`: the `GeolocationCoordinates` of the browser. |
| `error` | `error`: an `Error` with the message of the browser, for example when the user denies the request. |

For a position outside of [`maxBounds`](description.md#maxbounds), the map does not move and fires no event.

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
terrain(options?: TerrainOptions): ControlSpec
```

A click turns on the terrain of `source` with `exaggeration`, or turns the terrain off. The description keeps its
[`terrain`](description.md#terrain), and no callback reports the click. A later description whose `terrain` differs
from that of the description before it overrides the click.

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

While the projection is `globe`, the button has the class `map-jr-ctrl-globe-enabled` and `aria-pressed="true"`. The
description keeps its [`projection`](description.md#projection), and no callback reports the click. A later
description whose `projection` differs from that of the description before it overrides the click.

## `colorScheme()`

Creates a button that switches the map between the light and the dark colour scheme.

```ts
colorScheme(options?: {
  position?: ControlPosition;
}): ControlSpec
```

The button shows a sun while the map is light and a moon while it is dark, also with `'auto'`. A click sets [`colorScheme`](description.md#colorscheme-and-oncolorschemechange)
of the description and calls `onColorSchemeChange` with the new value. When `colorScheme` is `'auto'`, a click sets
the scheme opposite to that of the system, and the next click sets `'auto'` again. With
`'light'`, `'dark'` or no value, a click switches between `'light'` and `'dark'`. See
[Light and dark maps](../guide/color-scheme.md#let-the-user-switch-the-scheme) for an example.

## `custom()`

Creates a control from an element of your page, or from a control written for MapLibre GL JS.

```ts
custom(options: {
  key: string;
  position?: ControlPosition;
  element: HTMLElement;
}): ControlSpec
custom(options: {
  key: string;
  position?: ControlPosition;
  onAdd(map: Map): HTMLElement;
  onRemove(map: Map): void;
}): ControlSpec
```

| Name | Type | Description |
|---|---|---|
| `key` **required** | `string` | The identity of the control: the map keeps the control while the list has an item with this `key`. |
| `element` | `HTMLElement` | The element that the map places in the corner. |
| `onAdd` | `(map) => HTMLElement` | Called when the map adds the control, and returns the element to place. |
| `onRemove` | `(map) => void` | Called when the map removes the control. |

Pass `element`, or `onAdd` with `onRemove`. When both are passed, the map uses `element`.

- The element shows at once. It does not wait for the code of the other controls.
- The map adds the class `map-jr-ctrl` to `element`, and an element without it receives no clicks. An assignment to
  `className` removes the class: add your own classes with `classList.add`.
- The map keeps the element that it received first for a `key`. To show another element, pass it with a new `key`.
- `onAdd` receives the map on which the main API is built (`Map`), and not the object that `createMap` returns. Its
  methods `on`, `off`, `getContainer`, `getCanvas`, `project`, `unproject`, `getZoom`, `getCenter` and `getBearing`
  work as in MapLibre GL JS. Another method can be missing or differ from MapLibre GL JS. To move the map from such a
  control, call the methods of the map that `createMap` returns, as the example below does.

The button of this example calls [`map.moveTo`](../api.md#the-camera) on a click, after `createMap` has returned.

```js
import {createMap} from '@map-jr/map-jr-gl';
import {custom} from '@map-jr/map-jr-gl/controls';

const button = document.createElement('button');
button.textContent = 'Reset view';
button.addEventListener('click', () =>
  map.moveTo({center: [-74.0065, 40.7085], zoom: 13, duration: 500}),
);

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13},
  controls: [
    custom({key: 'reset-view', position: 'top-left', element: button}),
  ],
});
```

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
  locale: {
    'NavigationControl.ZoomIn': 'Zoom avant',
    'NavigationControl.ZoomOut': 'Zoom arrière',
  },
});
```

## See also

- [Controls](../guide/controls.md) for the look of the controls and a control of your own in Vue and React.
- [`controls`](description.md#controls) and [`locale`](description.md#locale) in the reference of the description.
- [MapLibre compatibility](../maplibre-compatibility.md) for the controls of the compat entry.
