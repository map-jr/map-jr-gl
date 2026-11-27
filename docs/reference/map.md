# The map

The map (`MapInstance`) is the object that [`createMap`](create-map.md) of `@map-jr/map-jr-gl` returns. Its methods
apply a new [description](description.md), move the camera, query the features that the map shows, and place elements
of the page on the map. Its [state](state.md) is a store that code can read and watch.

The examples on this page are ES modules, as `<script type="module">` and a bundler run them, so they use `await` at
the top level.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});
map.moveTo({zoom: 15, duration: 500});
```

## `MapInstance`

<!-- ref:MapInstance:start -->
| Name | Type | Description |
|---|---|---|
| [`update`](#update) | `(spec: `[`MapDescription`](description.md#mapdescription)`) => void` | Applies a new description to the map. |
| [`patch`](#patch) | `(part: Partial<Omit<`[`MapDescription`](description.md#mapdescription)`, 'data' \| 'images'>> & {data?: Record<string, GeoJSON \| string \| null>; images?: Record<string, ImageInput \| null>}) => void` | Applies the fields of `part` and keeps the other fields of the current description. |
| [`description`](#description) (read only) | `Readonly<`[`MapDescription`](description.md#mapdescription)`>` | The description of the last `createMap`, `update` or `patch`. |
| [`getResolvedDescription`](#getresolveddescription) | `() => `[`MapDescription`](description.md#mapdescription) | Returns the description with `style` as a copy of the style that the map loaded and `globalState` as the global state in effect. |
| [`destroy`](#destroy) | `() => void` | Removes the map, its controls and its overlays from the page. |
| [`state`](#state) (read only) | [`Readable`](state.md#readable)`<`[`MapState`](state.md#mapstate)`>` | A store of the state of the map (`MapState`): `state.get()` returns it, and `state.subscribe(fn)` calls `fn` at each change. |
| [`queryFeatures`](#queryfeatures) | `(at?: FeaturePlace \| `[`FeatureOptions`](#featureoptions)`, options?: `[`FeatureOptions`](#featureoptions)`) => Promise<`[`RenderedFeature`](types.md#renderedfeature)`[]>` | Returns the features that the style layers render at a place, the top one first. |
| [`querySource`](#querysource) | `(sourceId: string, at?: FeaturePlace \| `[`SourceOptions`](#sourceoptions)`, options?: `[`SourceOptions`](#sourceoptions)`) => Promise<`[`QueriedFeature`](types.md#queriedfeature)`[]>` | Returns the features of the tile data of a source, with no need of a style layer. |
| [`watchFeatures`](#watchfeatures) | `(at: FeaturePlace \| undefined, options: `[`FeatureOptions`](#featureoptions)`, listener: (features: `[`RenderedFeature`](types.md#renderedfeature)`[]) => void) => () => void` | Calls `listener` with the result of `queryFeatures` now and again each time that the result changes. |
| [`watchSource`](#watchsource) | `(sourceId: string, at: FeaturePlace \| undefined, options: `[`SourceOptions`](#sourceoptions)`, listener: (features: `[`QueriedFeature`](types.md#queriedfeature)`[]) => void) => () => void` | Calls `listener` with the result of `querySource` now and again each time that the result changes. |
| [`setFeatureState`](#setfeaturestate) | `(target: {source: string; sourceLayer?: string; id: number \| string}, state: Record<string, unknown>) => void` | Merges `state` into the feature state of one feature, which `feature-state` expressions read. |
| [`removeFeatureState`](#removefeaturestate) | `(target: {source: string; sourceLayer?: string; id?: number \| string}, key?: string) => void` | Removes one key of the feature state of a feature, or its whole state when `key` is left out. |
| [`queryElevation`](#queryelevation) | `(at: Position \| {x: number; y: number}, options?: {source?: string; zoom?: number}) => Promise<number \| null>` | Returns the height of the ground at a position (`[lng, lat]`) or a point of the screen, read from the elevation tiles of a `raster-dem` source of the style. |
| [`toBlob`](#toblob) | `(type?: string, quality?: number) => Promise<Blob>` | Returns the map as an image once the map is idle, in the size of the canvas in device pixels. |
| [`clusterExpansionZoom`](#clusterexpansionzoom) | `(sourceId: string, clusterId: number) => Promise<number>` | Returns the zoom level at which a cluster of a GeoJSON source with `cluster: true` divides. |
| [`clusterChildren`](#clusterchildren) | `(sourceId: string, clusterId: number) => Promise<`[`ClusterFeature`](types.md#clusterfeature)`[]>` | Returns the clusters and points that a cluster divides into at the next zoom level. |
| [`clusterLeaves`](#clusterleaves) | `(sourceId: string, clusterId: number, options?: {limit?: number; offset?: number}) => Promise<`[`ClusterFeature`](types.md#clusterfeature)`[]>` | Returns the points of a cluster. |
| [`moveTo`](#moveto) | `(view: `[`MoveToOptions`](#movetooptions)`) => void` | Moves the camera to a view or to `bounds`, with an animation when `duration` is more than 0 or `fly` is set. |
| [`fitBounds`](#fitbounds) | `(bounds: Bounds, options?: Omit<`[`MoveToOptions`](#movetooptions)`, 'bounds' \| 'center' \| 'zoom'>) => void` | Moves the camera to fit a box, as `moveTo({bounds, ...options})`. |
| [`project`](#project) | `(lngLat: Position) => {x: number; y: number}` | Converts a position to a point of the screen. |
| [`unproject`](#unproject) | `(point: {x: number; y: number}) => [number, number]` | Converts a point of the screen, in CSS pixels from the top left corner of the map, to a position. |
| [`overlay`](#overlay) | `(element: HTMLElement, options: `[`OverlayOptions`](#overlayoptions)`) => `[`MapOverlay`](#mapoverlay) | Places an element of the page at a position of the map, as a marker, a label or a popup; the element moves with the map. |
| [`listen`](#listen) | `<K extends keyof `[`MapEvents`](events.md#mapevents)`>(type: K, fn: (event: `[`MapEvents`](events.md#mapevents)`[K]) => void) => () => void` | Calls `fn` for each event of a type of `MapEvents`. |
| [`once`](#once) | `<K extends keyof `[`MapEvents`](events.md#mapevents)`>(type: K) => Promise<`[`MapEvents`](events.md#mapevents)`[K]>` | Waits for the next event of a type of `MapEvents`. |
| [`container`](#container) (read only) | `HTMLElement` | The element that holds the map. |
<!-- ref:MapInstance:end -->

Members whose names start with `_` are private. They are not in the type `MapInstance`, and they can change in each
release.

## `update`

<!-- ref:MapInstance.update:start -->
```ts
update(spec: MapDescription): void
```

| Name | Type | Default | Description |
|---|---|---|---|
| `spec` **required** | [`MapDescription`](description.md#mapdescription) | | The new description. |

**Returns:** `void`.
<!-- ref:MapInstance.update:end -->

The map applies what differs from the last description, and resets a field that `spec` leaves out to its default.
To change some fields and keep the others, call [`patch`](#patch).

```js
import {createMap} from '@map-jr/map-jr-gl';

let description = {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
};
const map = createMap('map', description);

function selectCrosshair() {
  description = {...description, cursor: 'crosshair'};
  map.update(description);
}
```

The map compares each field with the field of the last description:

- A field that is the same object as before costs nothing. Keep the object when nothing in it changed.
- A field that is a new object is compared by its content, so a description that the application creates again at each
  render causes no work in the map.
- Each value of `data` is compared by identity only. To change the data of a source, pass a new object. A change of
  the old object in place has no effect.

A changed paint value of a layer that stays in the style transitions from the old value to the new one, as in MapLibre
GL JS. This holds for `update`, `patch`, and in the compat entry for `setPaintProperty` and `setStyle` with `diff`.

- The time comes from the `*-transition` property of the layer (`'fill-color-transition': {duration: 500}`), then from
  the `transition` of the style, then from the default `{duration: 300, delay: 0}`, in milliseconds. The value waits
  for `delay` and then moves over `duration` with a cubic ease in and out.
- Colors, numbers and lists of numbers of the same length (`fill-translate`) move. A value that depends on the zoom
  moves between the values at the zoom of each frame.
- These change at once: a value that depends on the feature (`get` or `feature-state`, before or after the change),
  `*-pattern`, `line-dasharray`, and a value of any other type.
- An icon halo of a symbol layer that had none (`icon-halo-width` from 0, or a first `icon-halo-color`) shows at
  once, because the tiles of the layer are built again.
- The map draws a frame for each animation frame until the last transition ends, and `idle` comes after it.
- `{duration: 0}` in `transition` or in a `*-transition` makes changes instant. In the compat entry, `setStyle` with
  `diff: false` changes every value at once, as in MapLibre GL JS.
- A new style that differs in more than its layers loads again, and its values change at once.

## `patch`

<!-- ref:MapInstance.patch:start -->
```ts
patch(
  part: Partial<Omit<MapDescription, 'data' | 'images'>> & {
    data?: Record<string, GeoJSON | string | null>;
    images?: Record<string, ImageInput | null>;
  },
): void
```

| Name | Type | Default | Description |
|---|---|---|---|
| `part` **required** | `Partial<Omit<`[`MapDescription`](description.md#mapdescription)`, 'data' \| 'images'>> & {data?: Record<string, GeoJSON \| string \| null>; images?: Record<string, ImageInput \| null>}` | | The fields to change. |

**Returns:** `void`.
<!-- ref:MapInstance.patch:end -->

`map.patch(part)` has the effect of `map.update({...map.description, ...part})`. A field of `part` that is `undefined`
is removed, as in `map.patch({cursor: undefined})`.

`data` and `images` are merged by key. `map.patch({data: {pins}})` changes only the source `pins` and keeps the other
keys of `data`, and a key that is `null` removes the data of its source, as in `map.patch({data: {pins: null}})`.
`map.patch({images: {pin}})` adds or replaces the image `pin` and keeps the other images, and
`map.patch({images: {pin: null}})` removes it. Code that passed the whole set to `patch({images})` now has to call
`update` or set the removed keys to `null`.

Every other field, `layers` included, is replaced whole, because the order of `layers` matters. `map.description` holds
the merged `data` and `images` afterwards, so `map.update(map.description)` gives the same map.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
});
map.patch({cursor: 'crosshair'});
```

The adapters for Vue, React and Svelte pass the complete description from their props. With an adapter, change the
props instead.

## `description`

`map.description` is the description of the last `createMap`, `update` or `patch`. After `createMap` and `update` it is
the object that the application passed, so do not change that object in place.

## `getResolvedDescription`

<!-- ref:MapInstance.getResolvedDescription:start -->
```ts
getResolvedDescription(): MapDescription
```

**Returns:** [`MapDescription`](description.md#mapdescription). A new object for reading.
<!-- ref:MapInstance.getResolvedDescription:end -->

The result differs from [`description`](#description) in two fields:

- `style` is a copy of the style that the map loaded, with the `sources`, `layers` and other parts of the description
  added. For a `{light, dark}` pair it is the style of the resolved `colorScheme`. Before the first `style.load` event
  it is the `style` of the description.
- `globalState` is the global state in effect: the defaults of `state` of the style, `color-scheme`, and the values of
  `globalState` of the description.

The map fires no event when only `globalState` changes. Call the method again after `update`.

> [!WARNING]
> Do not pass the result to `update` or `patch`: its `style` replaces a URL or a `{light, dark}` pair with one fixed
> style.

## `destroy`

<!-- ref:MapInstance.destroy:start -->
```ts
destroy(): void
```

**Returns:** `void`.
<!-- ref:MapInstance.destroy:end -->

`destroy` can be called while the map loads. It removes the elements of [`overlay`](#overlay) at once, without the
closing animation of a popup, and it does not call `onClose`. After `destroy`:

- [`queryFeatures`](#queryfeatures), [`querySource`](#querysource) and [`queryElevation`](#queryelevation) reject with
  `[map-jr-gl] E10022 The query has no answer: the map was removed.` A query that was pending when `destroy` was called does
  not become an unhandled rejection.
- [`toBlob`](#toblob) rejects with `[map-jr-gl] E10044 toBlob(): the map was removed before its image was taken.`
- [`once`](#once) rejects with `[map-jr-gl] E484 once("idle"): the map was removed.`, with the type that it waits for.
- [`watchFeatures`](#watchfeatures) and [`watchSource`](#watchsource) no longer call their listeners.
- [`setFeatureState`](#setfeaturestate) and [`removeFeatureState`](#removefeaturestate) have no effect.

## `state`

`map.state` holds the state of the map: the view, whether the map has loaded, the features under the pointer. See
[The state](state.md) for its fields and for `get` and `subscribe`.

## `queryFeatures`

<!-- ref:MapInstance.queryFeatures:start -->
```ts
queryFeatures(
  at?: FeaturePlace | FeatureOptions,
  options?: FeatureOptions,
): Promise<RenderedFeature[]>
```

| Name | Type | Default | Description |
|---|---|---|---|
| `at` | `FeaturePlace \| `[`FeatureOptions`](#featureoptions) | | A point of the screen (`{x, y}`), a position (`[lng, lat]`), a box of the screen (two points), or nothing for the whole map. |
| `options` | [`FeatureOptions`](#featureoptions) | | `layers` (the ids of style layers), `filter` (a filter expression) and `radius` (in CSS pixels around a point). |

**Returns:** `Promise<`[`RenderedFeature`](types.md#renderedfeature)`[]>`. A promise of the features.
<!-- ref:MapInstance.queryFeatures:end -->

### `FeaturePlace`

`FeaturePlace` is the type of a place of a query:

```ts
type FeaturePlace =
  | {x: number; y: number}
  | readonly number[]
  | readonly {x: number; y: number}[];
```

For `queryFeatures`, `at` accepts these forms:

| `at` | Where the query looks |
|---|---|
| `{x, y}` | At a point of the screen, in CSS pixels from the top left corner of the map. |
| `[lng, lat]` | At a position. |
| `[{x, y}, {x, y}]` | In a box of the screen between two corners. |
| left out, or the options | On the whole map. `map.queryFeatures({layers: ['park']})` is the same as `map.queryFeatures(undefined, {layers: ['park']})`. |

The result has only features that a style layer draws, and it is empty where no style layer draws one. A feature
that several tiles hold appears once when it has an id or comes from a GeoJSON source, with the part of its geometry
in one of the tiles. A feature of a vector source without an id appears once for each tile that holds it.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 15},
});
await map.once('idle');
const nearby = await map.queryFeatures(
  {x: 200, y: 150},
  {layers: ['park', 'building-3d'], radius: 8},
);
const all = await map.queryFeatures({layers: ['building-3d']});
```

See [`destroy`](#destroy) and [A lost WebGL context](#a-lost-webgl-context) for the cases in which the promise
rejects.

### `FeatureOptions`

<!-- ref:FeatureOptions:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `layers` | `string[]` | | The ids of the style layers to look in. |
| `filter` | `FilterSpecification` | | A filter expression of the MapLibre style specification: the query returns only the features that pass it. |
| `radius` | `number` | `3` | At a point or a position, the distance in CSS pixels around the place within which a feature is found. |
<!-- ref:FeatureOptions:end -->

## `querySource`

<!-- ref:MapInstance.querySource:start -->
```ts
querySource(
  sourceId: string,
  at?: FeaturePlace | SourceOptions,
  options?: SourceOptions,
): Promise<QueriedFeature[]>
```

| Name | Type | Default | Description |
|---|---|---|---|
| `sourceId` **required** | `string` | | The id of a source of the style or of `sources`. |
| `at` | `FeaturePlace \| `[`SourceOptions`](#sourceoptions) | | A point of the screen or a position, or nothing for the tiles of the view. |
| `options` | [`SourceOptions`](#sourceoptions) | | `sourceLayers`, `filter`, `radius` (CSS pixels), `geometry` and `zoom`. |

**Returns:** `Promise<`[`QueriedFeature`](types.md#queriedfeature)`[]>`. A promise of the features.
<!-- ref:MapInstance.querySource:end -->

`querySource` reads the tile data of one source, so it finds features that no style layer draws. At a position, the
map loads the tile when it does not have it, so the position need not be in the view. `at` is a
[`FeaturePlace`](#featureplace) or the options, in these forms:

| `at` | Where the query looks |
|---|---|
| `{x, y}` or `[lng, lat]` | At a point of the screen or at a position. |
| `[{x, y}, {x, y}]` | In the tiles of the view, within a box of the screen. |
| left out, or the options | In the tiles of the view. The result has only the features in the view. |

To query two sources, call `querySource` once for each.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 15},
});
await map.once('idle');
const atPosition = await map.querySource('openmaptiles', [-74.0065, 40.7085], {
  sourceLayers: ['building'],
  geometry: true,
});
const inView = await map.querySource('openmaptiles', {sourceLayers: ['park']});
```

### `SourceOptions`

<!-- ref:SourceOptions:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `sourceLayers` | `string[]` | | The names of the layers of a vector tile source to look in. |
| `filter` | `FilterSpecification` | | A filter expression of the MapLibre style specification: the query returns only the features that pass it. |
| `radius` | `number` | `3` | At a point or a position, the distance in CSS pixels around the place within which a feature is found. |
| `geometry` | `boolean` | `false` | Whether each feature has `geometry`, at a point, at a position and in a query of the view. |
| `zoom` | `number` | the zoom of the map | At a point or a position, the zoom level of the tiles to read, rounded down and kept between `minzoom` and `maxzoom` of the source. |
<!-- ref:SourceOptions:end -->

## `watchFeatures`

<!-- ref:MapInstance.watchFeatures:start -->
```ts
watchFeatures(
  at: FeaturePlace | undefined,
  options: FeatureOptions,
  listener: (features: RenderedFeature[]) => void,
): () => void
```

| Name | Type | Default | Description |
|---|---|---|---|
| `at` **required** | `FeaturePlace \| undefined` | | A place as for `queryFeatures`, or `undefined` for the whole map. |
| `options` **required** | [`FeatureOptions`](#featureoptions) | | The options of `queryFeatures`. |
| `listener` **required** | `(features: `[`RenderedFeature`](types.md#renderedfeature)`[]) => void` | | Called with the features at the start and after each change of the result. |

**Returns:** `() => void`. A function that stops the calls.
<!-- ref:MapInstance.watchFeatures:end -->

The result changes when tiles load, when the style changes, and for a place of the screen when the map moves.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 15},
});
const stop = map.watchFeatures(
  {x: 200, y: 150},
  {layers: ['building-3d']},
  buildings => {
    console.log(buildings.length);
  },
);
```

A watch asks again by itself after a lost WebGL context, and it stops after [`destroy`](#destroy). When the listener
throws, the browser reports the error as an unhandled rejection, and the watch goes on.

## `watchSource`

<!-- ref:MapInstance.watchSource:start -->
```ts
watchSource(
  sourceId: string,
  at: FeaturePlace | undefined,
  options: SourceOptions,
  listener: (features: QueriedFeature[]) => void,
): () => void
```

| Name | Type | Default | Description |
|---|---|---|---|
| `sourceId` **required** | `string` | | The id of a source of the style or of `sources`. |
| `at` **required** | `FeaturePlace \| undefined` | | A place as for `querySource`, or `undefined` for the tiles of the view. |
| `options` **required** | [`SourceOptions`](#sourceoptions) | | The options of `querySource`. |
| `listener` **required** | `(features: `[`QueriedFeature`](types.md#queriedfeature)`[]) => void` | | Called with the features at the start and after each change of the result. |

**Returns:** `() => void`. A function that stops the calls.
<!-- ref:MapInstance.watchSource:end -->

`watchSource` follows the rules of [`watchFeatures`](#watchfeatures).

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 15},
});
const stop = map.watchSource(
  'openmaptiles',
  [-74.0065, 40.7085],
  {sourceLayers: ['building']},
  buildings => {
    console.log(buildings[0]?.properties);
  },
);
```

## `setFeatureState`

<!-- ref:MapInstance.setFeatureState:start -->
```ts
setFeatureState(
  target: {source: string; sourceLayer?: string; id: number | string},
  state: Record<string, unknown>,
): void
```

| Name | Type | Default | Description |
|---|---|---|---|
| `target` **required** | `{source: string; sourceLayer?: string; id: number \| string}` | | `id` is the `id` of the feature; `sourceLayer` is required for a vector source. |
| `state` **required** | `Record<string, unknown>` | | The keys and values to set. |

**Returns:** `void`.
<!-- ref:MapInstance.setFeatureState:end -->

The `id` of `target` is the `id` of a feature, as [`queryFeatures`](#queryfeatures) returns it:

- A vector source needs the numeric id of the feature in the tile, and `sourceLayer`.
- A GeoJSON source accepts the `id` of the feature or the property that `promoteId` names, a number or a string.
- An `id` of a GeoJSON feature that is a string of decimal digits and a safe integer, such as `'12'`, becomes the
  number `12`, so pass `12`. A property of `promoteId` keeps its type.

The map keeps the state until the feature state is removed or the map is destroyed, also when `update` passes a new
`style`. The state is not part of the description, so `update` does not change it. `queryFeatures` returns the
state of each feature in `state`.

```js
import {createMap} from '@map-jr/map-jr-gl';

let selected;
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
  sources: {
    stations: {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 1,
            properties: {name: 'Bowling Green'},
            geometry: {type: 'Point', coordinates: [-74.0141, 40.7047]},
          },
          {
            type: 'Feature',
            id: 2,
            properties: {name: 'Wall Street'},
            geometry: {type: 'Point', coordinates: [-74.0091, 40.7074]},
          },
        ],
      },
    },
  },
  layers: [
    {
      id: 'stations',
      type: 'circle',
      source: 'stations',
      paint: {
        'circle-radius': 8,
        'circle-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          '#e00',
          '#28f',
        ],
      },
    },
  ],
  interactiveLayers: ['stations'],
  onClick: e => {
    if (selected !== undefined)
      map.removeFeatureState({source: 'stations', id: selected}, 'selected');
    selected = e.features[0]?.id;
    if (selected !== undefined)
      map.setFeatureState({source: 'stations', id: selected}, {selected: true});
  },
});
```

## `removeFeatureState`

<!-- ref:MapInstance.removeFeatureState:start -->
```ts
removeFeatureState(
  target: {source: string; sourceLayer?: string; id?: number | string},
  key?: string,
): void
```

| Name | Type | Default | Description |
|---|---|---|---|
| `target` **required** | `{source: string; sourceLayer?: string; id?: number \| string}` | | Without `id`, the state of all features of the source is removed. |
| `key` | `string` | | The key to remove. |

**Returns:** `void`.
<!-- ref:MapInstance.removeFeatureState:end -->

`target` has the form of [`setFeatureState`](#setfeaturestate).

## `queryElevation`

<!-- ref:MapInstance.queryElevation:start -->
```ts
queryElevation(
  at: Position | {x: number; y: number},
  options?: {source?: string; zoom?: number},
): Promise<number | null>
```

| Name | Type | Default | Description |
|---|---|---|---|
| `at` **required** | `Position \| {x: number; y: number}` | | A position, `[lng, lat]`, or a point of the screen, `{x, y}` in CSS pixels. |
| `options` | `{source?: string; zoom?: number}` | | `source` is the ID of the `raster-dem` source (default the first one of the style), and `zoom` is the zoom level of its tile (default its `maxzoom`). |

**Returns:** `Promise<number \| null>`. A promise of the height in meters, or of `null` when the tile has no data. It rejects when the style has no `raster-dem` source, or none with the ID of `options.source`.
<!-- ref:MapInstance.queryElevation:end -->

The height is in meters, and the `exaggeration` of the terrain does not change it. The promise resolves to `null`
when the elevation tile has no data, and it rejects when the style has no `raster-dem` source, or none with the ID of
`source`. A `zoom` outside the `minzoom` and `maxzoom` of the source is clamped to them, and a lower `zoom` reads a
tile that covers more ground with less detail.

## `toBlob`

<!-- ref:MapInstance.toBlob:start -->
```ts
toBlob(type?: string, quality?: number): Promise<Blob>
```

| Name | Type | Default | Description |
|---|---|---|---|
| `type` | `string` | | The MIME type of the image. |
| `quality` | `number` | | From 0 to 1, for `'image/jpeg'` and `'image/webp'`. |

**Returns:** `Promise<Blob>`. A promise of the image. It rejects when the map is destroyed first.
<!-- ref:MapInstance.toBlob:end -->

`type` defaults to `'image/png'`. Without `quality`, the browser uses its default quality.

The image has the size of the canvas in device pixels: the CSS size times `devicePixelRatio`, up to 3. Markers,
popups, controls and the attribution are elements of the page, so the image does not have them. To print the map, put the
image in an `<img>`, because the canvas itself can print blank.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
});
const url = URL.createObjectURL(await map.toBlob());
document.body.append(
  Object.assign(document.createElement('img'), {src: url, alt: 'Map'}),
);
```

## `clusterExpansionZoom`

<!-- ref:MapInstance.clusterExpansionZoom:start -->
```ts
clusterExpansionZoom(
  sourceId: string,
  clusterId: number,
): Promise<number>
```

| Name | Type | Default | Description |
|---|---|---|---|
| `sourceId` **required** | `string` | | The id of a GeoJSON source with `cluster: true`. |
| `clusterId` **required** | `number` | | `properties.cluster_id` of the cluster feature. |

**Returns:** `Promise<number>`. A promise that rejects when the source has no cluster with this id.
<!-- ref:MapInstance.clusterExpansionZoom:end -->

```js
import {createMap} from '@map-jr/map-jr-gl';

const earthquakes =
  'https://maplibre.org/maplibre-gl-js/docs/assets/earthquakes.geojson';
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  sources: {
    quakes: {
      type: 'geojson',
      cluster: true,
      data: earthquakes,
    },
  },
  layers: [
    {
      id: 'quakes',
      type: 'circle',
      source: 'quakes',
      paint: {'circle-radius': 12, 'circle-color': '#28f'},
    },
  ],
  interactiveLayers: ['quakes'],
  onClick: async e => {
    const cluster = e.features[0];
    if (!cluster?.properties.cluster) return;
    const zoom = await map.clusterExpansionZoom(
      'quakes',
      cluster.properties.cluster_id,
    );
    map.moveTo({center: cluster.geometry.coordinates, zoom, duration: 500});
  },
});
```

## `clusterChildren`

<!-- ref:MapInstance.clusterChildren:start -->
```ts
clusterChildren(
  sourceId: string,
  clusterId: number,
): Promise<ClusterFeature[]>
```

| Name | Type | Default | Description |
|---|---|---|---|
| `sourceId` **required** | `string` | | The id of a GeoJSON source with `cluster: true`. |
| `clusterId` **required** | `number` | | `properties.cluster_id` of the cluster feature. |

**Returns:** `Promise<`[`ClusterFeature`](types.md#clusterfeature)`[]>`. A promise that rejects when the source has no cluster with this id.
<!-- ref:MapInstance.clusterChildren:end -->

## `clusterLeaves`

<!-- ref:MapInstance.clusterLeaves:start -->
```ts
clusterLeaves(
  sourceId: string,
  clusterId: number,
  options?: {limit?: number; offset?: number},
): Promise<ClusterFeature[]>
```

| Name | Type | Default | Description |
|---|---|---|---|
| `sourceId` **required** | `string` | | The id of a GeoJSON source with `cluster: true`. |
| `clusterId` **required** | `number` | | `properties.cluster_id` of the cluster feature. |
| `options` | `{limit?: number; offset?: number}` | | `limit` is the largest number of points (default 10), and `offset` the number to skip (default 0). |

**Returns:** `Promise<`[`ClusterFeature`](types.md#clusterfeature)`[]>`. A promise that rejects when the source has no cluster with this id.
<!-- ref:MapInstance.clusterLeaves:end -->

A `limit` of `Infinity` returns all points of the cluster.

## `moveTo`

<!-- ref:MapInstance.moveTo:start -->
```ts
moveTo(view: MoveToOptions): void
```

| Name | Type | Default | Description |
|---|---|---|---|
| `view` **required** | [`MoveToOptions`](#movetooptions) | | Where the camera goes, and how it moves. |

**Returns:** `void`.
<!-- ref:MapInstance.moveTo:end -->

`view` accepts a center, zoom, bearing and pitch ([`ViewInput`](types.md#viewinput)), or a box to fit with its
padding ([`InitialView`](types.md#initialview)). A field that `view` leaves out keeps its value. With `bounds`, the map
turns to bearing 0 unless `view` sets `bearing`. `moveTo` always moves the camera, also to a view that
[`view`](description.md#view-and-onviewchange) of the description would ignore.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});

function showParis() {
  map.moveTo({center: [2.35, 48.86], zoom: 12, fly: true});
}
function showManhattan() {
  map.moveTo({
    bounds: [
      [-74.05, 40.68],
      [-73.9, 40.82],
    ],
    fitPadding: 40,
    pitch: 30,
    duration: 800,
  });
}
```

When the system asks for reduced motion, the camera jumps to the target.

### `MoveToOptions`

`MoveToOptions` accepts `center`, `zoom`, `bearing` and `pitch` of [`ViewInput`](types.md#viewinput), `bounds`,
`fitPadding` and `fitMaxZoom` of [`InitialView`](types.md#initialview), and these members, which set how the camera moves. With `bounds`, the fit uses `bearing` (default 0), so every corner of the box is in view at that bearing:

<!-- ref:MoveToOptions:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `duration` | `number` | `0` | The duration of the animation in milliseconds. |
| `fly` | `boolean \| `[`FlyOptions`](#flyoptions) | `false` | Whether the camera zooms out and back in on the way. |
<!-- ref:MoveToOptions:end -->

### `FlyOptions`

The options of a flight, for `fly`, as in `flyTo` of MapLibre GL JS:

<!-- ref:FlyOptions:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `curve` | `number` | `1.42` | How far the camera zooms out on the way: a larger value zooms out further. |
| `speed` | `number` | `1.2` | The average speed of the flight, relative to `curve`. |
| `screenSpeed` | `number` | | The average speed of the flight in screens per second. |
| `minZoom` | `number` | | The zoom level at the top of the flight. |
| `maxDuration` | `number` | | The longest duration of the flight in milliseconds, without `duration`: a longer flight jumps to the target instead. |
<!-- ref:FlyOptions:end -->

## `fitBounds`

`options` accepts `bearing`, `pitch`, `fitPadding`, `fitMaxZoom`, `duration` and `fly` of [`MoveToOptions`](#movetooptions).

<!-- ref:MapInstance.fitBounds:start -->
```ts
fitBounds(
  bounds: Bounds,
  options?: Omit<MoveToOptions, 'bounds' | 'center' | 'zoom'>,
): void
```

| Name | Type | Default | Description |
|---|---|---|---|
| `bounds` **required** | `Bounds` | | The box to fit. |
| `options` | `Omit<`[`MoveToOptions`](#movetooptions)`, 'bounds' \| 'center' \| 'zoom'>` | | The options of `moveTo` other than `bounds`, `center` and `zoom`. |

**Returns:** `void`.
<!-- ref:MapInstance.fitBounds:end -->

## `project`

<!-- ref:MapInstance.project:start -->
```ts
project(lngLat: Position): {x: number; y: number}
```

| Name | Type | Default | Description |
|---|---|---|---|
| `lngLat` **required** | `Position` | | The position, `[lng, lat]`. |

**Returns:** `{x: number; y: number}`. The point in CSS pixels from the top left corner of the map.
<!-- ref:MapInstance.project:end -->

## `unproject`

<!-- ref:MapInstance.unproject:start -->
```ts
unproject(point: {x: number; y: number}): [number, number]
```

| Name | Type | Default | Description |
|---|---|---|---|
| `point` **required** | `{x: number; y: number}` | | The point, `{x, y}`. |

**Returns:** `[number, number]`. The position as `[lng, lat]`.
<!-- ref:MapInstance.unproject:end -->

## `overlay`

<!-- ref:MapInstance.overlay:start -->
```ts
overlay(
  element: HTMLElement,
  options: OverlayOptions,
): MapOverlay
```

| Name | Type | Default | Description |
|---|---|---|---|
| `element` **required** | `HTMLElement` | | The element to place. |
| `options` **required** | [`OverlayOptions`](#overlayoptions) | | The position of the element, and whether it is a popup or can be dragged. |

**Returns:** [`MapOverlay`](#mapoverlay). An overlay with `update`, `patch` and `remove`.
<!-- ref:MapInstance.overlay:end -->

```js
import {createMap, defaultPin} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});
let home = [-74.0065, 40.7085];
const pin = map.overlay(defaultPin({color: '#c0392b'}), {
  lngLat: home,
  anchor: 'bottom',
  draggable: true,
  onDragEnd: lngLat => {
    home = lngLat;
  },
});

const content = document.createElement('p');
content.textContent = 'Battery Park';
const popup = map.overlay(content, {
  lngLat: [-74.0165, 40.7033],
  popup: true,
  onClose: () => popup.remove(),
});
```

[`defaultPin`](exports.md#defaultpin) returns the default pin as an element. For many points, a symbol layer in
[`layers`](description.md#layers) renders much faster than overlays.

The map places the element at the fractional pixel position of `lngLat` and does not round it to whole
pixels.

The pointer events of an overlay reach the page as usual, and a press on an overlay does not pan the map. A drag of an
element with `draggable` starts once the pointer has moved 3 pixels. A click without that move calls no drag
callback, and the click at the end of a drag does not reach the element.

A popup with a close button (see `closeButton`) closes on the Escape key while the keyboard focus is inside it. A popup
stays open when the map moves.

A popup that the user opens from the keyboard takes the focus. The map counts a popup as opened from the keyboard
when it opens within one second of a key press on the map, with no press of a pointer in between. The focus goes to
the first element of the popup that accepts it, or to the close button. When the popup closes with the focus inside,
the focus returns to the element of the map that had it before.

### `OverlayOptions`

<!-- ref:OverlayOptions:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `lngLat` **required** | `Position` | | The position of the element, `[lng, lat]`. |
| `anchor` | `Anchor` | `'center'` for a marker; for a popup, chosen by the position | The part of the element that is at the position: `'center'`, `'bottom'`, `'top-left'` and the other sides and corners. |
| `offset` | `PopupOffset` | | A distance in CSS pixels from the position, to the right and down. |
| `popup` | `boolean` | `false` | Whether the element is shown in a box with a tip that points to the position (a popup). |
| `onClose` | `() => void` | | Called when the user closes the popup. |
| `closeButton` | `boolean` | true when `onClose` is set, else false | Whether the popup has a button to close it. |
| `closeOnClick` | `boolean` | `false` | Whether a click on the map closes the popup. |
| `draggable` | `boolean` | `false` | Whether the user can drag the element. |
| `onDragStart` | `(lngLat: Position) => void` | | Called with the position of the element, `[lng, lat]`, when a drag starts. |
| `onDrag` | `(lngLat: Position) => void` | | Called with the position of the element, `[lng, lat]`, at each move of a drag. |
| `onDragEnd` | `(lngLat: Position) => void` | | Called with the position where the element was dropped, `[lng, lat]`. |
<!-- ref:OverlayOptions:end -->

Without `anchor`, an element that is not a popup has `'center'` at the position. A popup chooses its anchor each time
it moves, as MapLibre GL JS does: `'top'` near the top edge of the map, `'bottom'` near the bottom edge or when it is
near no edge, and `'left'` or `'right'` near a side. The two parts join into a corner, such as `'top-left'`. An
`anchor` that you set keeps the popup on that side.

`offset` of a marker is a pair, `[x, y]`. `offset` of a popup is a pair, a point `{x, y}`, one number, or an object with a pair
for each anchor. The type `PopupOffset` is the same as `Offset` of `@map-jr/map-jr-gl/maplibre-compat`, which `Popup` takes.

One number moves the popup away from the position on the side that it has, so that `offset: 16` keeps 16 pixels from
the position on every side, also when the popup chooses its own anchor. An object such as
`{bottom: [0, -16], top: [0, 16]}` gives the pair for the anchor that the popup has, and a side that it leaves out has
`[0, 0]`. A marker with an offset that is not a
pair warns in the development build and has no offset.

`closeButton` and `closeOnClick` are options of a popup. A popup has a close button when `closeButton` is `true`, and
by default when `onClose` is set. With `closeOnClick: true`, a click on the map closes the popup and calls `onClose`.
The click that opens the popup does not close it. By default a click on the map leaves the popup open, where
`Popup` of the compat entry closes on a click.

An option that is not in this table has no effect. In the development build (the `development` export condition,
`dist/*.dev.js`), `overlay`, `update` and `patch` warn once for each such option on each map, and the warning lists the
options. The production build does not warn.

### `MapOverlay`

`overlay` returns a `MapOverlay`. Its `update` replaces all options of the overlay with its argument, so pass the
complete options each time. Its `patch` changes only the options that its argument has, and keeps the others.
An option set to `undefined` in `patch` returns to its default, or is removed when it has none, but `lngLat: undefined`
keeps the position. After `remove`, `update` and `patch` have no effect.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});
const content = document.createElement('p');
content.textContent = 'Battery Park';
const popup = map.overlay(content, {
  lngLat: [-74.0165, 40.7033],
  popup: true,
  onClose: () => popup.remove(),
});
// Moves the popup. It keeps its content, its close button and its other
// options.
popup.patch({lngLat: [-74.0134, 40.7128]});
```

<!-- ref:MapOverlay:start -->
| Name | Type | Description |
|---|---|---|
| `update` | `(options: `[`OverlayOptions`](#overlayoptions)`) => void` | Replaces all options of the overlay with `options`. |
| `patch` | `(options: Partial<Omit<`[`OverlayOptions`](#overlayoptions)`, 'lngLat'>> & {lngLat?: Position}) => void` | Changes only the options that `options` has, for example `patch({lngLat: [2.35, 48.86]})` to move a popup and keep its other options. |
| `remove` | `() => void` | Removes the element from the map. |
<!-- ref:MapOverlay:end -->

## `listen`

<!-- ref:MapInstance.listen:start -->
```ts
listen(type: K, fn: (event: MapEvents[K]) => void): () => void
```

| Name | Type | Default | Description |
|---|---|---|---|
| `type` **required** | `K` | | The name of the event. |
| `fn` **required** | `(event: `[`MapEvents`](events.md#mapevents)`[K]) => void` | | Called with the event. |

**Returns:** `() => void`. A function that stops the calls.
<!-- ref:MapInstance.listen:end -->

`K` is the name of an event, one of the keys of [`MapEvents`](events.md#mapevents). [Events](events.md) lists the
types and what each event has. In TypeScript, the parameter of `fn` has the type of the
event, and a type that is not in `MapEvents` does not compile.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
});
const stop = map.listen('moveend', () =>
  console.log(map.state.get().view.zoom),
);
```

A listener that throws does not stop the other listeners. The map reports what it threw as an `error` event, and a
throw in a listener of `error` goes to the console.

## `once`

<!-- ref:MapInstance.once:start -->
```ts
once(type: K): Promise<MapEvents[K]>
```

| Name | Type | Default | Description |
|---|---|---|---|
| `type` **required** | `K` | | The name of the event. |

**Returns:** `Promise<`[`MapEvents`](events.md#mapevents)`[K]>`. A promise of the event. It rejects when the map is destroyed first.
<!-- ref:MapInstance.once:end -->

`K` is the name of an event, as for [`listen`](#listen). `once('load')` on a map that has loaded resolves at once, with an event that has only `type` and `target`. So code
that waits for `load` need not read [`state.loaded`](state.md#mapstate) first.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
});
await map.once('idle');
```

The promise rejects with `[map-jr-gl] E484 once("idle"): the map was removed.` when the map is destroyed before the event,
or when `once` is called after `destroy`.

## `container`

`map.container` is the element that holds the map, as `createMap` received it or found it by its id.

## A lost WebGL context

When the browser takes the WebGL context away, the map starts again on a new canvas and fires
[`webglcontextlost`](events.md#a-lost-webgl-context). A query that is pending then rejects with
`[map-jr-gl] E10022 The query has no answer: the map lost its WebGL context. Ask again.` The rejection is not handled for the
application: catch it where a query can be pending. A query that is called again waits for the new context.

## See also

- [The description](description.md) for what `update` and `patch` accept.
- [The state](state.md) for `map.state`.
- [Events](events.md) for the types of `listen` and `once`.
- [Types](types.md) for `Position`, `Bounds` and the features that the queries return.
