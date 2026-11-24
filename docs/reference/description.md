# The description

The description (`MapDescription`) is one object that states everything that a map of `@map-jr/map-jr-gl` shows: the
style, the data, the view and the controls. To change the map, pass a new description to
[`update`](map.md#update), and the map applies what is different. The map shows what the last description
states: a field that it leaves out is reset to its default.

Every optional field accepts `null`, and `null` means the same as leaving the field out, so a description that is
parsed from JSON does not need to delete keys. The one exception is [`terrain`](#terrain), where `null` turns off the
terrain of the style. The rule is for the fields of the description, not for the keys inside a field: in
[`patch`](map.md#patch), a key of `data` that is `null` removes that source.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});
```

## `MapDescription`

<!-- ref:MapDescription:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| [`style`](#style) **required** | `string \| StyleSpecification \| {light: string \| StyleSpecification; dark: string \| StyleSpecification}` | | The style: a style object, the URL of a style, or `{light, dark}` with one style for the light and one for the dark color scheme. |
| [`sources`](#sources) | `Record<string, SourceInput> \| null` | | Sources to add to the style, by id. |
| [`layers`](#layers) | `LayerInput[] \| null` | | Layers to add to the style, in order. |
| [`terrain`](#terrain) | `TerrainSpecification \| null` | | 3D terrain from a raster-dem source, for example `{source: 'dem', exaggeration: 1.5}`, in place of the `terrain` of the style. |
| [`fonts`](#fonts) | `FontFaces \| null` | | Web fonts for labels, by `text-font` name: a URL, or a list of `{url, 'unicode-range'}` as in `font-faces` of the style specification. |
| [`initialView`](#initialview) | [`InitialView`](types.md#initialview)` \| null` | | The view when the map is created: a center, zoom, bearing and pitch, or `bounds` to fit. |
| [`view`](#view-and-onviewchange) | [`ViewInput`](types.md#viewinput)` \| null` | | A view that the application controls. |
| [`onViewChange`](#view-and-onviewchange) | `((view: `[`View`](state.md#view)`) => void) \| null` | | Called with the first view once, right after `createMap` returns, and then with the new view at each change of the view. |
| [`data`](#data) | `Record<string, GeoJSON \| string> \| null` | | GeoJSON data or the URL of GeoJSON, by the id of a GeoJSON source of the style or of `sources`. |
| [`images`](#images) | `Record<string, ImageInput> \| null` | | Images for `icon-image` and the pattern properties of style layers, by name: an SVG document as a string, the URL of an image, or `{image, width, height}`. |
| [`sprite`](#sprite) | `{id: string; url: string}[] \| null` | | Sprites to add to the sprite of the style, as `[{id: 'pins', url: 'https://example.com/sprites/pins'}]`. |
| [`controls`](#controls) | `ControlSpec[] \| null` | | Controls from `@map-jr/map-jr-gl/controls`, for example `[navigation(), scale()]`. |
| [`projection`](#projection) | `ProjectionSpecification \| null` | | The projection, `{type: 'globe'}` or `{type: 'mercator'}`, in place of the `projection` of the style. |
| [`globalState`](#globalstate) | `Record<string, unknown> \| null` | | Values for the `global-state` expressions of the style, by name, for example `{season: 'winter'}`. |
| [`interactiveLayers`](#interactivelayers) | `string[] \| null` | | The ids of the style layers that respond to the pointer: their features appear in [`state.hover`](state.md#mapstate) and in `onClick`. |
| [`hoverState`](#hoverstate) | `boolean \| null` | `false` | Whether the top feature of `interactiveLayers` under the pointer has the feature state `hover: true`, for `feature-state` expressions. |
| [`onClick`](#onclick) | `((event: MapPointer) => void) \| null` | | Called for each click on the map, with the point, the position and the features of `interactiveLayers` at the point. |
| `onError` | `((error: Error) => void) \| null` | | Called with each error of the map, such as a style or a tile that does not load, and without it the map writes each error to the console. |
| `minZoom` | `number \| null` | `-2` | The smallest zoom level of the map. |
| `maxZoom` | `number \| null` | `22` | The largest zoom level of the map. |
| `maxPitch` | `number \| null` | `60` | The largest pitch of the map in degrees, at most 90 (a larger value is limited to 90). |
| [`maxBounds`](#maxbounds) | `Bounds \| null` | | A box that the view cannot leave, as `[[west, south], [east, north]]` or `[west, south, east, north]`. |
| `cursor` | `string \| null` | | The CSS cursor over the map in place of the default, which is `pointer` over a feature of `interactiveLayers`. |
| [`cooperativeGestures`](#cooperativegestures) | `boolean \| null` | `false` | Whether the wheel zooms only with Ctrl (⌘ on a Mac) and a touch pans only with two fingers, for a map in a page that scrolls. |
| [`colorScheme`](#colorscheme-and-oncolorschemechange) | `'auto' \| 'light' \| 'dark' \| null` | `'light'` | The color scheme of the controls, the popup and the attribution. |
| [`onColorSchemeChange`](#colorscheme-and-oncolorschemechange) | `((colorScheme: 'auto' \| 'light' \| 'dark') => void) \| null` | | Called with the new value when the control `colorScheme()` changes `colorScheme`. |
| [`locale`](#locale) | `Record<string, string> \| null` | | The texts of the controls, the popup, the marker and the hint of `cooperativeGestures`, by the keys of MapLibre GL JS, for example `{'NavigationControl.ZoomIn': 'Zoom avant'}`. |
| [`padding`](#padding) | `PaddingInput \| null` | `0` | Space in CSS pixels at the sides of the map that the view keeps free, for example under a side panel: one number for all sides, or `{top, right, bottom, left}` with 0 for a side that is left out. |
| [`transformRequest`](#transformrequest) | `RequestTransform \| null` | | A function that changes a request before the map sends it, as `transformRequest` of MapLibre GL JS. |
<!-- ref:MapDescription:end -->

## `MapSetup`

Write these fields in the description, with the other fields. The map reads them only when it is created, and
ignores a change in a later description. To change one, destroy the map and create a new one.

<!-- ref:MapSetup:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| [`renderer`](#renderer) | `'auto' \| 'worker' \| 'main' \| null` | `'auto'` | The thread that renders the map. |
| `fontFamily` | `string \| null` | `'"Noto Sans", "Helvetica Neue", Arial, sans-serif'` | The CSS font family for labels that have no glyph file and no web font, after the names of `text-font`. |
| `interactive` | `boolean \| null` | `true` | Whether the user can move the map with the mouse, touch and keyboard, while `onClick` and `state.hover` work either way. |
| `antialias` | `boolean \| null` | `false` | Whether the canvas uses multisample antialiasing. |
| [`attribution`](#attribution) | `false \| `[`AttributionOptions`](#attributionoptions)` \| null` | | The options of the built-in attribution (`{compact, customAttribution}`), or `false` to hide it when the page shows the credits itself. |
| [`hash`](#hash) | `boolean \| string \| null` | `false` | `true` keeps the view in the hash of the URL (`#zoom/lat/lng/bearing/pitch`), and a string keeps it in the parameter of that name. |
| `nonce` | `string \| null` | | The nonce of a [Content Security Policy](../guide/loading.md#content-security-policy) with `style-src 'nonce-…'`, for the style sheet of the map. |
<!-- ref:MapSetup:end -->

## `style`

| Form | What the map does |
|---|---|
| The URL of a style, as a string | Loads the style from that URL. |
| A style object of the MapLibre style specification | Draws it. |
| `{light, dark}`, each a URL or a style object | Draws the style that matches the resolved [`colorScheme`](#colorscheme-and-oncolorschemechange), and loads the other style when the scheme changes. |

```js
import {createMap} from '@map-jr/map-jr-gl';

createMap('map', {
  style: {
    light: 'https://styles.map-jr.org/1/openfreemap-positron.json',
    dark: 'https://styles.map-jr.org/1/openfreemap-dark.json',
  },
  colorScheme: 'auto',
});
```

The map compares styles by content, so a new object with the same content changes nothing. It applies a changed
`style` in place where it can: when only the layers of a style object changed, the map updates those layers. For any
other change, the map loads the new style. It then draws the map from the start, as when the map is created, and
keeps the view and the other fields of the description.

## `sources`

`sources` adds sources to the style, for example the source of a layer of your own. A source in `sources` overrides
the source of the style that has the same id. See [`layers`](#layers) for an example
of a source with its layer.

A source has one of the types of the MapLibre style specification, `video` and `canvas` included. See
[Show a video or a canvas](../guide/data.md#show-a-video-or-a-canvas).

To change the features of a GeoJSON source, set them in [`data`](#data). A changed source in `sources` [loads the style again](#style).

## `layers`

`layers` adds layers to the style. It does not replace the layers of the style.

Each item is a layer of the MapLibre style specification, with one more optional member: `before`. `before` is the
id of a style layer, and the map inserts the new layer below that layer. Without `before`, the map adds the new
layer above all other layers.

```js
import {createMap} from '@map-jr/map-jr-gl';

createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  sources: {
    routes: {type: 'geojson', data: {type: 'FeatureCollection', features: []}},
  },
  layers: [
    {
      id: 'routes',
      type: 'line',
      source: 'routes',
      before: 'water_name_line',
      paint: {'line-color': '#d6453d', 'line-width': 3},
    },
  ],
});
```

The map applies a change of `layers` in place. A new paint value transitions from the old value: see
[`update`](map.md#update). Only a new `type`, `source` or `source-layer` of a layer
[loads the style again](#style).

## `terrain`

`terrain` sets the 3D terrain of the map.

| Value | The map draws |
|---|---|
| `{source, exaggeration}` | 3D terrain from the `raster-dem` source with the id `source`. It overrides the `terrain` of the style. `exaggeration` is 1 by default. |
| `null` | No 3D terrain. `null` overrides the `terrain` of the style. |
| `undefined`, or no field | The terrain of the style. |

A change of `terrain` [loads the style again](#style). See [Terrain and elevation](../guide/terrain.md).

## `fonts`

`fonts` sets web fonts for the `text-font` names of the style.

```ts
type FontFaces = Record<
  string,
  string | {url: string; 'unicode-range'?: string[]}[]
>;
```

- Each key is a `text-font` name of the style, such as `Noto Sans Bold`.
- A value can be the URL of the font file for that name, as a string.
- A value can also be a list with one item for each font file. `url` is the file, and `unicode-range` is the list of the character
  ranges that the file covers.

This is the type of `font-faces` in the MapLibre style specification.

```js
import {createMap} from '@map-jr/map-jr-gl';

createMap('map', {
  style: 'https://styles.map-jr.org/1/openfreemap-liberty.json',
  fonts: {
    'Noto Sans Regular':
      'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5.0.22/files/noto-sans-latin-400-normal.woff2',
    'Noto Sans Bold': [
      {
        url: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5.0.22/files/noto-sans-latin-700-normal.woff2',
        'unicode-range': ['U+0000-00FF'],
      },
    ],
  },
});
```

- When the style has `glyphs`, the labels use the glyph files, and a web font draws only the text that the files do
  not have. A style without `glyphs` draws all text with the web fonts and the fonts of the browser.
- The map reads the weight and the style of a font from words such as `Bold`, `Semibold`, `Light` and `Italic` in
  its name. The rest of the name is the CSS family. So `Open Sans Semibold Italic` is the family `Open Sans` at
  weight 600 in italic.
- An entry in `fonts` overrides the entry with the same name in the `font-faces` of the style.
- A relative URL is resolved against the URL of the page.
- The map reports a font file that does not load to `onError`. The labels then use the next name in their
  `text-font`, and then `fontFamily`.

## `initialView`

`initialView` (`InitialView`) sets the camera once, when the map is created. After that, the user moves the map. To
move it from code, call [`map.moveTo`](map.md#moveto) or set [`view`](#view-and-onviewchange).

| Name | Type | Default | Description |
|---|---|---|---|
| `center` | `Position` | `[0, 0]` | The center as `[lng, lat]`. |
| `zoom` | `number` | `0` | The zoom. |
| `bearing` | `number` | `0` | The bearing in degrees. |
| `pitch` | `number` | `0` | The pitch in degrees. |
| `bounds` | `Bounds` | | A box that the map fits into the view: `[[west, south], [east, north]]` or `[west, south, east, north]`. It overrides `center` and `zoom`. |
| `fitPadding` | `PaddingInput` | `0` | Space around `bounds` in CSS pixels: a number, or `{top, right, bottom, left}`. |
| `fitMaxZoom` | `number` | `maxZoom` of the description | The highest zoom of the fit to `bounds`. |

```js
import {createMap} from '@map-jr/map-jr-gl';

createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {
    bounds: [
      [-74.05, 40.68],
      [-73.9, 40.82],
    ],
    fitPadding: 40,
  },
});
```

Two other fields can override `initialView` when the map is created:

- When the description also has [`view`](#view-and-onviewchange), each member of `view` overrides the same member of
  `initialView`, and the map ignores `bounds`. The development build warns once when the first description has both
  `view` and `initialView.bounds`.
- With [`hash`](#hash), a view in the URL of the page overrides `center`, `zoom`, `bearing`, `pitch` and
  `bounds`. The map then does not fit `bounds`.

## `view` and `onViewChange`

When the description has `view`, the application controls the view. The application stores each view that
`onViewChange` reports and passes it back in the next description. To move the map, it passes a different view.
`onViewChange` receives the first view once, right after `createMap` returns and before `load`, and then each change.
A view that it reported does not move the map when it comes back in `view`.

```js
import {createMap} from '@map-jr/map-jr-gl';

let view = {center: [-74.0065, 40.7085], zoom: 13.6};
const describe = () => ({
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  view,
  onViewChange: next => {
    view = next;
    map.update(describe());
  },
});
const map = createMap('map', describe());

// Move the map: change the view.
view = {...view, zoom: 15};
map.update(describe());
```

`view` (`ViewInput`) has `center`, `zoom`, `bearing` and `pitch`. Each is optional. The map applies a new `view`
with no animation. To animate the camera, call [`map.moveTo`](map.md#moveto) with `duration` in milliseconds or with
`fly: true`: `map.moveTo({...view, duration: 500})`.

`onViewChange` receives a `View`: the same four members and `bounds`. `bounds` is the smallest box
`[[west, south], [east, north]]` that contains the visible map.

A `view` with the values of a view that the map reported does not move the map. So to return to a view that the
application stored a moment ago, call `map.moveTo(stored)`.

## `data`

`data` sets the features of GeoJSON sources. Use it for data that changes while the map is shown.

Each key of `data` is the id of a GeoJSON source. Its value is the GeoJSON for that source, or the URL of a GeoJSON
file. When neither the style nor `sources` has a source with that id, the map creates one: `{type: 'geojson'}` with
no other option.

```js
import {createMap} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const layers = [
  {
    id: 'routes',
    type: 'line',
    source: 'routes',
    paint: {'line-color': '#d6453d', 'line-width': 3},
  },
];
const route = to => ({
  type: 'Feature',
  properties: {},
  geometry: {type: 'LineString', coordinates: [[-74.01, 40.7], to]},
});

const map = createMap('map', {
  style,
  layers,
  data: {routes: route([-73.97, 40.75])},
});

// Other data: a new object for the key.
map.update({style, layers, data: {routes: route([-73.95, 40.78])}});
```

- The map compares each value by identity. To change the data, pass a new object: a change inside the old object has
  no effect.
- To set options of the source (`cluster`, `promoteId`, `attribution`), declare the source in `sources` or in the
  style. A GeoJSON source in `sources` whose id is a key of `data` needs no `data` of its own: `data` sets its
  features.
- When a key is removed from `data`, the map removes the source that it created for that key. A layer that still
  uses the source draws nothing, so remove such a layer in the same description.

## `images`

`images` provides the images that the style layers draw, such as the icon of a marker. A symbol layer refers to an
image in `images` by its name, in `icon-image`. An image here overrides the image of the
sprite that has the same name.

```js
import {createMap} from '@map-jr/map-jr-gl';

const pin =
  '<svg viewBox="0 0 24 31"><path fill="#d6453d" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>';

createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.006, 40.7128], zoom: 12},
  images: {pin},
  data: {places: {type: 'Point', coordinates: [-74.006, 40.7128]}},
  layers: [
    {
      id: 'places',
      type: 'symbol',
      source: 'places',
      layout: {'icon-image': 'pin', 'icon-anchor': 'bottom'},
    },
  ],
});
```

A value (`ImageInput`) is one of these:

| Value | The image |
|---|---|
| An SVG document as a string (`'<svg …>…</svg>'`) | The SVG, drawn at the pixel density of the screen. Its size in CSS pixels is that of its `viewBox`, or else of its `width` and `height` attributes. |
| The URL of an image, as a string | The image at that URL. The server of the image must permit the request (CORS). |
| An `ImageBitmap`, a canvas, an image element or `ImageData` | The pixels of the object. |
| `{image, width, height, pixelRatio}` | One of the values above as `image`, with its size in CSS pixels. `stretchX`, `stretchY`, `content`, `textFitWidth` and `textFitHeight` work as in `addImage` of MapLibre GL JS. |

An SVG document with slots (`{{name}}`) is a template: each feature fills the slots from its properties. See
[An image that is a template](description.md#images) for the parameters and the limits.

To replace a bitmap or a canvas, pass a new object. The map reports an image that does not load to `onError`, with
the name of the image, and draws the layer without it.

## `sprite`

`sprite` adds sprites to the map. A sprite is one file with many small images.

`sprite` is a list of `{id, url}`, as the list form of `sprite` in the MapLibre style specification. An `icon-image`
refers to an image of such a sprite as `id:name`.

```js
import {createMap} from '@map-jr/map-jr-gl';

createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.006, 40.7128], zoom: 12},
  sprite: [
    {
      id: 'maki',
      url: 'https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite',
    },
  ],
  data: {places: {type: 'Point', coordinates: [-74.006, 40.7128]}},
  layers: [
    {
      id: 'places',
      type: 'symbol',
      source: 'places',
      layout: {'icon-image': 'maki:circle_11'},
    },
  ],
});
```

- `url` has no file extension. The map requests `url + '.json'` and `url + '.png'`, and the `@2x` files on a screen
  with a pixel ratio above 1. A relative URL is resolved against the URL of the page.
- A sprite here overrides the sprite of the style that has the same id. The sprite of a style whose `sprite` is one
  URL has the id `default`.
- The map reports a sprite that does not load to `onError`, and still draws the images of the other
  sprites.

## `controls`

`controls` is the list of the controls that the map shows. Create each item with a function of
`@map-jr/map-jr-gl/controls`.

```js
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, scale} from '@map-jr/map-jr-gl/controls';

createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  controls: [navigation(), scale({position: 'bottom-left'})],
});
```

See [Controls](controls.md) for the functions and their options.

## `projection`

`projection` selects whether the map is flat or a globe.

| Value | The map draws |
|---|---|
| `{type: 'mercator'}` | The flat map. |
| `{type: 'globe'}` | A globe, which turns into the flat map between zoom 11 and 12, as in MapLibre GL JS. |
| `{type: 'vertical-perspective'}` | A globe at every zoom. |
| `null`, or no field | The projection of the style. |

On a globe:

- The map draws 3D terrain and `fill-extrusion` layers on the sphere.
- `maxBounds` has no effect.
- A move to a new center with no `zoom` keeps the size of the globe on the screen, so the zoom of the view changes
  with the latitude. A `zoom` that is passed is applied unchanged.

## `globalState`

`globalState` sets values that the expressions of the style read. Use it to switch what the style shows, such as a
season or a language, with no new style.

A value in `globalState` overrides the default with the same name in the root property `state` of the style. A layer reads the value
with `['global-state', name]`.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: {
    version: 8,
    state: {season: {default: 'summer'}},
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': [
            'match',
            ['global-state', 'season'],
            'winter',
            '#eef3f7',
            '#dfe8d5',
          ],
        },
      },
    ],
  },
  globalState: {season: 'winter'},
});
```

A value is JSON: a string, a number, a boolean, an array or a plain object. The map sets the name `color-scheme`
itself (see [`colorScheme`](#colorscheme-and-oncolorschemechange)). A value for `color-scheme` in `globalState`
overrides it.

## `interactiveLayers`

`interactiveLayers` selects the style layers that respond to the pointer. The map reports a feature under the
pointer or under a click only when one of these layers draws it. The value is a list of layer ids.

The features reach your code in these ways:

- [`state.hover`](state.md#mapstate) is the list of the features under the pointer, the top feature first.
- [`onClick`](#onclick) receives the features under a click.
- [`hoverState`](#hoverstate) marks the top feature under the pointer, so that the style can highlight it.

Over a feature of these layers the cursor is `pointer`, unless the description sets `cursor`.

## `hoverState`

`hoverState` highlights the feature under the pointer with no code of your own. With `hoverState: true`, the map sets
the feature state `hover: true` on the top feature of [`interactiveLayers`](#interactivelayers) under the pointer. It removes the state when the pointer leaves the feature or the map. A layer reads the state with
`feature-state`:

```js
import {createMap} from '@map-jr/map-jr-gl';

const block = {
  type: 'Feature',
  id: 1,
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-74.009, 40.707],
        [-74.004, 40.707],
        [-74.004, 40.71],
        [-74.009, 40.71],
        [-74.009, 40.707],
      ],
    ],
  },
};

createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 15},
  data: {blocks: block},
  layers: [
    {
      id: 'blocks',
      type: 'fill',
      source: 'blocks',
      paint: {
        'fill-color': '#2f7fd1',
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.9,
          0.5,
        ],
      },
    },
  ],
  interactiveLayers: ['blocks'],
  hoverState: true,
});
```

The map can set the state only on a feature that has an id. For a GeoJSON source, set ids on the features, or set
`promoteId` or `generateId: true` on the source. A feature of a vector source needs an id in its tile, or `promoteId` on the source.

## `onClick`

The map calls `onClick` with one object (`MapPointer`) for each click on the map. It does not call `onClick` for a
click on a control or on an element that [`map.overlay`](map.md#overlay) placed on the map.

| Name | Type | Description |
|---|---|---|
| `point` | `{x: number; y: number}` | The place of the click in CSS pixels from the top left corner of the map. |
| `lngLat` | `[number, number]` | The position of the click as `[lng, lat]`. |
| `features` | `RenderedFeature[]` | The features of [`interactiveLayers`](#interactivelayers) at the click, the top one first. It is empty when the description has no `interactiveLayers`. |

## `maxBounds`

`maxBounds` keeps the whole view inside a box: `[[west, south], [east, north]]` or `[west, south, east, north]`.
When the box is smaller than the view, the map zooms in until the box fills the view. A box whose west edge is east
of its east edge, such as `[[150, -50], [-120, 10]]`, crosses the antimeridian. `maxBounds` has no effect on a globe.

## `cooperativeGestures`

Set `cooperativeGestures` for a map in a page that scrolls. With `true`, the wheel zooms the map only while Ctrl (⌘
on a Mac) is pressed, one finger scrolls the page, and two fingers move the map. When the map blocks a gesture, it
shows a hint. Set the text of the hint in [`locale`](#locale).

## `colorScheme` and `onColorSchemeChange`

`colorScheme` sets whether the map is light or dark. `'auto'` follows the browser (`prefers-color-scheme`) and
changes while the page is open. The resolved scheme is
`colorScheme` of [the state of the map](state.md#mapstate), and it has these effects:

- The controls, the popup and the attribution have the colors of the scheme, and the container has the class
  `map-jr-dark` while the scheme is dark.
- The global state property `color-scheme` of the style is `'light'` or `'dark'`, so a style can read
  `['global-state', 'color-scheme']`. A value for `color-scheme` in [`globalState`](#globalstate) overrides it.
- For a [`style`](#style) that is a pair `{light, dark}`, the map draws the style that matches the scheme.

The control `colorScheme()` of `@map-jr/map-jr-gl/controls` is a button that switches the scheme. It changes the
scheme of the map and then calls `onColorSchemeChange` with the new value.
An application that keeps the description in its state must store the value there. Otherwise its next `update`
passes the old value and changes the map back.

See [Dark mode](../guide/color-scheme.md) for a style that follows the scheme.

## `locale`

`locale` translates the texts of the controls, of the popup and of the hint of `cooperativeGestures`, and the `aria-label` of the canvas (`Map.Title`). A change of `locale` applies to the canvas label at once.

```js
import {createMap} from '@map-jr/map-jr-gl';

createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  locale: {
    'NavigationControl.ZoomIn': 'Zoom avant',
    'NavigationControl.ZoomOut': 'Zoom arrière',
  },
});
```

The keys are those of the option `locale` of MapLibre GL JS: see [The texts of the controls](controls.md#the-texts-of-the-controls) for
the list. A key that is not set keeps the English text, and the library includes no translations. `locale` does not
change the language of the labels of the map.

## `padding`

`padding` reserves space at the sides of the map, for example for a panel that covers part of it.

`padding` is one number for all sides, or `{top, right, bottom, left}`. A side that is not set is 0. The map centers
the view in the area that the padding leaves free. A change of `padding` moves the
camera immediately.

```js
import {createMap} from '@map-jr/map-jr-gl';

createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  padding: {left: 320},
});
```

The space around `bounds` for one fit is `fitPadding` of [`initialView`](#initialview) and of `moveTo`. A fit of
`moveTo` adds it to the `padding` of the description. The fit of `initialView` does not.

## `transformRequest`

`transformRequest` changes the requests of the map, for example to add an `Authorization` header.

The map calls the function with the URL of a request and the kind of resource. The function returns
`{url, headers, credentials}`, or `undefined` to leave the request unchanged. The signature is that of
`transformRequest` of MapLibre GL JS.

```js
import {createMap} from '@map-jr/map-jr-gl';

const token = sessionStorage.getItem('tiles-token');

createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  transformRequest: (url, resourceType) =>
    resourceType === 'Tile' && url.startsWith('https://tiles.example.com/')
      ? {url, headers: {Authorization: 'Bearer ' + token}}
      : undefined,
});
```

The kinds are `Style`, `Source`, `Tile`, `Glyphs`, `SpriteJSON`, `SpriteImage`, `Image` and `Font`. The map
does not treat a new function as a change, so a framework can pass a new function in each render.

## `renderer`

`renderer` selects the thread that draws the map.

| Value | The map draws |
|---|---|
| `'auto'` | In a worker when the browser can draw there, and on the main thread otherwise. |
| `'worker'` | As `'auto'`, and the map warns once when it draws on the main thread instead. |
| `'main'` | On the main thread. |

`renderer` of [the state of the map](state.md#mapstate) is the thread that draws. See [Loading](../guide/loading.md) for the worker file and how the map loads it.

## `attribution`

`attribution` sets how the map shows the credits of its data. Without this field, the map shows the attribution of
its sources in the bottom right corner.

| Value | The attribution |
|---|---|
| `{compact: true}` | A button that opens and closes the text. |
| `{compact: false}` | The text, always. |
| No `compact` | Compact when the map is at most 640 CSS pixels wide. |
| `{customAttribution}` | The attribution of the sources and then this text, or each text of a list. |
| `false` | None. |

> [!WARNING]
> Most sources require their attribution. With `attribution: false`, show it elsewhere on the page.

### `AttributionOptions`

<!-- ref:AttributionOptions:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `compact` | `boolean` | true when the map is 640 CSS pixels wide or narrower, else false | Whether the attribution is a button that opens the credits. |
| `customAttribution` | `string \| string[]` | | Credits that the attribution shows after the credits of the sources of the style. |
<!-- ref:AttributionOptions:end -->

## `hash`

`hash` keeps the view in the URL of the page, so that a link or a reload shows the same view.

With `hash: true`, the map writes the view into the fragment of the URL of the page:

| The map | The fragment |
|---|---|
| Has no rotation and no pitch | `#zoom/lat/lng` |
| Is rotated | `#zoom/lat/lng/bearing` |
| Is pitched | `#zoom/lat/lng/bearing/pitch` |

The map updates the fragment when a movement ends, and moves when the fragment changes. When the page loads with a
view in the fragment, that view overrides `center`, `zoom`, `bearing`, `pitch` and `bounds` of [`initialView`](#initialview)
and of [`view`](#view-and-onviewchange). A fragment without a view leaves them as they are. This is the same rule as in
MapLibre GL JS, in both entries.

With a name such as `'map'`, the map writes the view under that name, so that the fragment can hold other values: `hash: 'map'`
writes `#map=zoom/lat/lng`.

## See also

- [The map](map.md) for `update` and `patch`.
- [Types](types.md) for `Position`, `Bounds`, `LayerInput` and the style types.
- [Vue and Nuxt](vue.md), [React](react.md) and [Svelte](svelte.md): the components accept the fields of the
  description as props.
