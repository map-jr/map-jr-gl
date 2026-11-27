# Exports

The functions that `@map-jr/map-jr-gl` exports. [`createMap`](create-map.md#createmap) creates a map; the other
functions check the browser, set how the library loads, and prepare data. The types of the entry are on
[Types](types.md).

```js
import {createMap, points} from '@map-jr/map-jr-gl';

const stations = [{name: 'Bowling Green', lng: -74.0141, lat: 40.7047}];
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
  sources: {
    stations: {
      type: 'geojson',
      data: points(stations, {lngLat: s => [s.lng, s.lat]}),
    },
  },
  layers: [
    {
      id: 'stations',
      type: 'circle',
      source: 'stations',
      paint: {'circle-radius': 6},
    },
  ],
});
```

## `MainExports`

<!-- ref:MainExports:start -->
| Name | Type | Description |
|---|---|---|
| `createMap` | `(container: HTMLElement \| string, spec: `[`MapDescription`](description.md#mapdescription)`) => `[`MapInstance`](map.md#mapinstance) | Creates a map in an element of the page from a description. |
| [`points`](#points) | `<R>(records: readonly R[], options: `[`PointsOptions`](#pointsoptions)`<R>) => PointCollection` | A `FeatureCollection` with a point for each record. |
| [`defaultPin`](#defaultpin) | `(options?: {color?: string; scale?: number}) => HTMLElement` | A pin for `overlay`, the default pin of `Marker` in the compat entry: a `div` with an SVG drop, 27 by 41 pixels at `scale` 1, filled with `color` (default `'#3fb1ce'`). |
| [`createStore`](#createstore) | `<T extends object>(value: T) => `[`Store`](#createstore)`<T>` | Creates a store of the kind that `state` of a map is, with `get`, `subscribe` and `set`. |
| [`addProtocol`](#addprotocol) | `(name: string, fn: ProtocolFunction) => void` | Loads each URL that starts with `name://` through `fn`, for every map of the page. |
| [`removeProtocol`](#removeprotocol) | `(name: string) => void` | Removes a protocol that `addProtocol` added. |
| [`supported`](#supported) | `() => boolean` | Whether this browser can show a map: it needs WebGL2. |
| [`configure`](#configure) | `(options: `[`LoadOptions`](#loadoptions)`) => void` | Sets how the library loads its workers, for the maps that are created after the call. |
<!-- ref:MainExports:end -->

## `points`

<!-- ref:MainExports.points:start -->
```ts
points(
  records: readonly R[],
  options: PointsOptions<R>,
): PointCollection
```

| Name | Type | Default | Description |
|---|---|---|---|
| `records` **required** | `readonly R[]` | | The records of the application, such as rows of a table. |
| `options` **required** | [`PointsOptions`](#pointsoptions)`<R>` | | How each record becomes a feature. |

**Returns:** `PointCollection`. A `FeatureCollection` of points.
<!-- ref:MainExports.points:end -->

A record whose position is not two finite numbers is left out. `points` needs no map, so a server can call it.

### `PointsOptions`

`R` is the type of a record.

<!-- ref:PointsOptions:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `lngLat` **required** | `(record: R, index: number) => readonly number[] \| null \| undefined` | | The position of a record: `[lng, lat]`. |
| `id` | `(record: R, index: number) => string \| number \| undefined` | | The id of the feature of a record. |
| `properties` | `(record: R, index: number) => Record<string, unknown>` | | The properties of the feature of a record. |
<!-- ref:PointsOptions:end -->

## `defaultPin`

<!-- ref:MainExports.defaultPin:start -->
```ts
defaultPin(options?: {
  color?: string;
  scale?: number;
}): HTMLElement
```

| Name | Type | Default | Description |
|---|---|---|---|
| `options` | `{color?: string; scale?: number}` | | `color` is a CSS color, and `scale` multiplies the size (default 1). |

**Returns:** `HTMLElement`. A new element.
<!-- ref:MainExports.defaultPin:end -->

The tip of the pin is at the bottom, so place it with `anchor: 'bottom'` of [`overlay`](map.md#overlay). It needs
`document`, so call it in the browser and not during a render on a server.

## `createStore`

<!-- ref:MainExports.createStore:start -->
```ts
createStore(value: T): Store<T>
```

| Name | Type | Default | Description |
|---|---|---|---|
| `value` **required** | `T` | | The first value. |

**Returns:** [`Store`](#createstore)`<T>`. The store.
<!-- ref:MainExports.createStore:end -->

The store has `get` and `subscribe` of [`Readable`](state.md#readable), and this method:

<!-- ref:Store:start -->
| Name | Type | Description |
|---|---|---|
| `set` | `(part: Partial<T>) => void` | Merges `part` into the value as a new object, and calls the subscribers when a field changed (compared with `Object.is`). |
<!-- ref:Store:end -->

```js
import {createStore} from '@map-jr/map-jr-gl';

const selection = createStore({station: null});
selection.subscribe(value => console.log(value.station));
selection.set({station: 'Bowling Green'});
```

## `addProtocol`

<!-- ref:MainExports.addProtocol:start -->
```ts
addProtocol(name: string, fn: ProtocolFunction): void
```

| Name | Type | Default | Description |
|---|---|---|---|
| `name` **required** | `string` | | The scheme of the URLs, without `://`. |
| `fn` **required** | `ProtocolFunction` | | The function that returns the data of a request. |

**Returns:** `void`.
<!-- ref:MainExports.addProtocol:end -->

`fn` has the arguments of `addProtocol` of MapLibre GL JS:

```ts
type ProtocolFunction = (
  request: {url: string; type?: string; headers?: Record<string, string>},
  abort: AbortController,
) => Promise<{data: unknown}>;
```

- `request.url` is the URL as the style or the TileJSON has it, after [`transformRequest`](description.md#transformrequest), also when it has another URL inside, such as
  `cog://https://example.com/a.tif`.
- `abort` is aborted when the map is removed, and when a newer `setData` of a GeoJSON source replaces the request. A
  tile request that is no longer needed is not aborted. After an abort, the map ignores the result of `fn`.
- `data` is an `ArrayBuffer`, a typed array, a string, or an object, which the map converts to JSON.

| Request | `type` | `data` |
|---|---|---|
| A tile of a `raster` or `raster-dem` source, an image (`loadImage`, `addImage` with a URL, an `image` source), the image of a sprite | `'image'`, with `headers.accept` `image/webp,*/*` | The bytes of an image file, an `ImageBitmap` or an `HTMLImageElement`. The map copies the image. |
| A tile of a `vector` source, a range of glyphs (`glyphs`), a font file (`font-faces`) | `'arrayBuffer'` | The bytes of the file. |
| A style, a TileJSON, GeoJSON, the JSON of a sprite | `'json'` | An object, a string or bytes. |

The protocols are the same for every map of the page, and a map that exists already uses a protocol added later. The
map reads `pmtiles://` URLs itself, and `addProtocol('pmtiles', fn)` has no effect.

```js
import {addProtocol, createMap} from '@map-jr/map-jr-gl';

addProtocol('styles', async ({url}, abort) => {
  const response = await fetch(
    url.replace('styles://', 'https://styles.map-jr.org/'),
    {signal: abort.signal},
  );
  return {data: await response.arrayBuffer()};
});
const map = createMap('map', {style: 'styles://1/elevation-zero.json'});
```

## `removeProtocol`

<!-- ref:MainExports.removeProtocol:start -->
```ts
removeProtocol(name: string): void
```

| Name | Type | Default | Description |
|---|---|---|---|
| `name` **required** | `string` | | The scheme of the URLs, without `://`. |

**Returns:** `void`.
<!-- ref:MainExports.removeProtocol:end -->

## `supported`

<!-- ref:MainExports.supported:start -->
```ts
supported(): boolean
```

**Returns:** `boolean`.
<!-- ref:MainExports.supported:end -->

The first call creates a WebGL2 context on a canvas outside the page, and later calls return the same result.
`supported` does not test whether a worker can render: where a worker cannot, the map renders on the main thread. See
[A browser without WebGL2](create-map.md#a-browser-without-webgl2) for what a map does without WebGL2.

## `configure`

<!-- ref:MainExports.configure:start -->
```ts
configure(options: LoadOptions): void
```

| Name | Type | Default | Description |
|---|---|---|---|
| `options` **required** | [`LoadOptions`](#loadoptions) | | The options to set. |

**Returns:** `void`.
<!-- ref:MainExports.configure:end -->

`renderer` of a description overrides `renderer` of `configure`.

> [!NOTE]
> A change of `tileWorkers` has no effect while a map of the page uses workers of the same `workerUrl` or
> `createWorker`. The development build of `configure` then warns once.

To change it, destroy every map of the page, call
`configure`, and create the maps again. See [Loading](../guide/loading.md) for the worker file.

```js
import {configure, createMap} from '@map-jr/map-jr-gl';

configure({tileWorkers: 2});
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
});
```

### `LoadOptions`

<!-- ref:LoadOptions:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `workerUrl` | `string \| URL` | the file next to the module of the library | The URL of the worker file, `map-jr-gl-worker.js`. |
| `createWorker` | `() => Worker` | | A function that creates the worker, for a bundler that imports workers its own way (`new Worker(new URL(...))`, `?worker` of Vite). |
| `tileWorkers` | `number` | the number of CPU cores less 2, from 1 to 4 | The number of workers that parse tiles, shared by all maps of the page. |
| `renderer` | `Renderer` | `'auto'` | The thread that renders a map whose description has no `renderer`. |
<!-- ref:LoadOptions:end -->

## See also

- [Create a map](create-map.md) for `createMap`.
- [Types](types.md) for the types that the entry exports.
