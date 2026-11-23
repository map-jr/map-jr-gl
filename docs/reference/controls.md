# Controls

The functions of `@map-jr/map-jr-gl/controls` create the controls of a map: the zoom buttons and the compass, the
scale bar, the buttons for the full screen, the position of the user, terrain, the globe and the colour scheme, and
the list of styles. Each function returns a `ControlSpec`: an item for [`controls`](description.md#controls) of the
description. Create a `ControlSpec` only with these functions, and use [`custom`](#custom) for a control of your own.
See [Controls](../guide/controls.md) for how to add, change and style them.

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

## `styles()`

Creates a button that opens a list of styles. Each entry shows a picture of its style with its label on top, and a
choice sets the style of the map. Until a picture is drawn, and when the style of an entry fails to load, the entry
shows a generic placeholder image. A new picture fades in over the old one, except with `prefers-reduced-motion`.

```ts
styles(options: {
  entries: StyleEntry[];
  preview?: StylesPreview;
  onStyleChange?: (entry: StyleEntry) => void;
  position?: ControlPosition;
}): ControlSpec
```

```js
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, styles} from '@map-jr/map-jr-gl/controls';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [8.33, 47.03], zoom: 11},
  controls: [
    navigation(),
    styles({
      entries: [
        {label: 'Elevation', style: 'https://styles.map-jr.org/1/elevation-zero.json'},
        {label: 'Positron', style: 'https://styles.map-jr.org/1/openfreemap-positron.json'},
        {label: 'Dark', style: 'https://styles.map-jr.org/1/openfreemap-dark.json'},
      ],
      onStyleChange: entry => console.log('The map shows', entry.label),
    }),
  ],
});
```

### `StylesOptions`

| Name | Type | Description |
|---|---|---|
| `entries` **required** | `StyleEntry[]` | The entries of the list, in their order. |
| `preview` | `StylesPreview` | How the pictures are drawn. |
| `onStyleChange` | `(entry: StyleEntry) => void` | Called with the entry after a choice has set `style`. |

### `StylesPreview`

| Name | Type | Description |
|---|---|---|
| `center`, `zoom` | `Position`, `number` | The center and the zoom of the pictures, both together. Without them, the pictures show the center, the zoom, the bearing and the pitch of the map. |
| `style` | `(style: StyleSpecification, entry: StyleEntry) => StyleSpecification \| void` | Changes the style of a picture only. It gets a copy of the style of the entry with absolute URLs, and changes it in place or returns another style. The map keeps the style of the entry. |
| `ssr` | `boolean` | Applies the overrides of `metadata["map-jr:ssr"]` of each layer to the pictures, before `style`: `hidden`, `filter`, `minzoom`, `maxzoom`, `paint` and `layout`. Default `true`. |

For `style`, and for `ssr` unless it is `false`, the control fetches a style that is a URL once more with `fetch`, without the
`transformRequest` of the map. The map has usually loaded it before, so the browser cache answers. A style of a
`{light, dark}` entry is the form of the picture.

In the official styles, the overrides hide most labels, the buildings and most roads at zoom 14, and the dark style
draws as an almost even dark area. With `ssr: false`, the pictures show the full style.

With the overrides, six pictures of the official styles take less time to draw: 3.8 s instead of 4.0 s at zoom 11,
and 4.3 s instead of 5.5 s at zoom 14, on a machine without a GPU.

This example hides the labels and the icons of the pictures:

```js
import {createMap} from '@map-jr/map-jr-gl';
import {styles} from '@map-jr/map-jr-gl/controls';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/openfreemap-positron.json',
  controls: [
    styles({
      entries: [
        {label: 'Positron', style: 'https://styles.map-jr.org/1/openfreemap-positron.json'},
        {label: 'Dark', style: 'https://styles.map-jr.org/1/openfreemap-dark.json'},
      ],
      preview: {style: style => { style.layers = style.layers.filter(layer => layer.type !== 'symbol'); }},
    }),
  ],
});
```

### `StyleEntry`

| Name | Type | Description |
|---|---|---|
| `label` **required** | `string` | The text of the entry. |
| `style` **required** | the type of [`style`](description.md#style) | The style that the entry sets: a URL, a style object or `{light, dark}`. |
| `terrain` | the type of [`terrain`](description.md#terrain) | The terrain that the entry sets. `null` turns off the terrain of the style. Without it, a choice leaves `terrain` as it is, unless the entry before set it. |
| `globalState` | `Record<string, unknown>` | Values of global state that the entry sets, by name, for example `{relief: false}`. |
| `colorSchemes` | `boolean` | `true` when the style reads the global state `color-scheme`, as the official styles of `https://styles.map-jr.org/1/` do. The entry then has a light and a dark form. Default `false`. |

With `terrain` and `globalState`, one style gives several entries. These entries use one style of elevation:

```js
import {createMap} from '@map-jr/map-jr-gl';
import {styles} from '@map-jr/map-jr-gl/controls';

const elevation = 'https://styles.map-jr.org/1/elevation.json';
const map = createMap('map', {
  style: elevation,
  initialView: {center: [8.33, 47.03], zoom: 11},
  controls: [
    styles({
      entries: [
        {label: 'Elevation', style: elevation},
        {label: 'Elevation flat', style: elevation, terrain: null},
        {label: 'Radar', style: 'https://styles.map-jr.org/1/elevation-radar.json', globalState: {relief: false}},
      ],
    }),
  ],
});
```

A choice sets `style`, `terrain` and `globalState` of the description together with one [`patch`](map.md#patch), so
the camera and the other fields of the description stay. The control then calls `onStyleChange` once with the entry.

- **What the entry before set.** A choice gives the `terrain` and the names of `globalState` that the entry chosen
  before set the values that the application had before that choice. A name that the application did not set is
  removed, so the map uses the default of the style. Other names of `globalState` stay.
- **The current entry.** The entry that the description shows is marked with `aria-pressed="true"`: its `style` is
  the same value as `style` of the description, or equal to it as JSON, and so are its `terrain` and each value of
  its `globalState`. When several entries match, the entry that sets the most fields is current, and of two that set
  as many, the entry of the last choice. A choice of the current entry closes the list and calls nothing.
- **A change by the application.** When the application later sets `terrain` or `globalState` with `update` or
  `patch`, its values apply, and the marked entry follows the description. Once the description no longer shows
  the entry of the last choice, a new choice keeps the values of the application.

An application that passes `style` itself, as a component of Vue, React or Svelte does, keeps the new value in
`onStyleChange`, and also `terrain` and `globalState` when an entry sets them. Otherwise its next description sets
the old style again. The map keeps the control while its options are equal as JSON (see
[The list of controls](#the-list-of-controls)), so a new `onStyleChange` function in a later description does not
replace the first one.

The pictures are 120 × 80 CSS pixels. Small maps, hidden from the page, draw them one after the other with
[`toBlob`](map.md#toblob), one map for each picture, and are then removed. They start when the map is first idle, so
that they do not delay the map, or at the first click on the button if that comes earlier. The list opens with the
labels at once and shows each picture when it is ready.

The picture of an entry shows its `terrain`, and its `globalState` over the `globalState` of the application.

- **A style that fails.** An error before the style of an entry has loaded, such as a failed request or an answer that
  is not a style, ends its picture at once. A picture that takes more than 20 seconds also ends. The entry then has no
  picture and stays usable.
- **A new view.** Without `preview`, opening the list on a view that has changed since the pictures were drawn draws
  them again. The old pictures stay until the new ones replace them. When the list closes, this drawing stops after
  the current picture and starts again at the next open.
- **Removal.** Removing the control, or the map, removes the hidden map at once.

The list opens toward the middle of the map. The arrow keys move between the entries. Escape, a choice, a click
outside the control or focus that leaves the control closes the list, and Escape and a choice return the focus to the
button. The control uses the variables `--map-control-background`, `--map-control-radius` and `--map-control-focus`
of [Change the look of the controls](../guide/controls.md#change-the-look-of-the-controls). The control works only
in `controls` of a map of `createMap`; the compat entry does not have it.

### An entry with a light and a dark form

An entry has two forms when its `style` is `{light, dark}`, or when it has `colorSchemes: true`. The list then shows
the label of the entry above two pictures, one drawn with `colorScheme: 'light'` and one with `colorScheme: 'dark'`.

A choice of a picture sets `style`, `terrain`, `globalState` and `colorScheme` of the description with one `patch`,
calls `onStyleChange` when the entry changed, and calls `onColorSchemeChange` of the description when the scheme changed. A choice of the other
form of the current entry changes only the scheme, and keeps the terrain and the global state of the entry. The picture of the current style and the current scheme is marked
with `aria-pressed="true"`.

The scheme of a choice follows the rule of [`colorScheme()`](#colorscheme):

- When the description has `colorScheme: 'auto'`, or has had it while the control was on the map, a choice of the
  form whose scheme is the scheme of the system keeps or sets `'auto'`. A choice of the other form sets `'light'` or
  `'dark'`. For example, with `'auto'` and the system in dark, the dark form keeps `'auto'`, the light form sets
  `'light'`, and the dark form then sets `'auto'` again.
- When the description has never had `'auto'`, a choice sets `'light'` or `'dark'`, never `'auto'`.

`onColorSchemeChange` is called only when `colorScheme` changes.

When every entry of the list has two forms, the control does the work of [`colorScheme()`](#colorscheme), and a map
needs only one of the two. With both on the map, each shows the scheme that the other one sets.

```js
import {createMap} from '@map-jr/map-jr-gl';
import {styles} from '@map-jr/map-jr-gl/controls';

const base = 'https://styles.map-jr.org/1/';
const map = createMap('map', {
  style: base + 'elevation.json',
  initialView: {center: [8.33, 47.03], zoom: 11},
  controls: [
    styles({
      entries: [
        {label: 'Elevation', style: base + 'elevation.json', colorSchemes: true},
        {label: 'Elevation zero', style: base + 'elevation-zero.json', colorSchemes: true},
        {label: 'Positron and Dark', style: {light: base + 'openfreemap-positron.json', dark: base + 'openfreemap-dark.json'}},
      ],
    }),
  ],
});
```

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

The button of this example calls [`map.moveTo`](../guide/view-and-camera.md) on a click, after `createMap` has returned.

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
| `StylesControl.Open` | `Choose a style` |
| `StylesControl.Light` | `Light` (the light form of an entry; its label is the label of the entry, a comma and this text) |
| `StylesControl.Dark` | `Dark` |
| `AttributionControl.ToggleAttribution` | `Toggle map data credits` (the label) and `Map data credits` (the title) |
| `Popup.Close` | `Close popup` |
| `Marker.Title` | `Map marker` |
| `Map.Title` | `Map` |
| `CooperativeGesturesHandler.WindowsHelpText` | `Use Ctrl + scroll to zoom the map` |
| `CooperativeGesturesHandler.MacHelpText` | `Use ⌘ + scroll to zoom the map` |
| `CooperativeGesturesHandler.MobileHelpText` | `Use two fingers to move the map` |

`ColorSchemeControl.Light`, `ColorSchemeControl.Dark` and the keys of `StylesControl` are keys of this library. The other keys are those of the
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
- [Differences from MapLibre GL JS](maplibre-differences.md) for the controls of the compat entry.
