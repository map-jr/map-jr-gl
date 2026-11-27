# Types

The TypeScript types that `@map-jr/map-jr-gl` exports for positions, views, GeoJSON, layers and the features that
the queries return. The types of the description, the map, the state and the events are on their own pages:
[`MapDescription`](description.md#mapdescription), [`MapInstance`](map.md#mapinstance),
[`MapState`](state.md#mapstate) and [`MapEvents`](events.md#mapevents).

```ts
import {createMap, type Bounds, type Position} from '@map-jr/map-jr-gl';

const battery: Position = [-74.0165, 40.7033];
const manhattan: Bounds = [
  [-74.05, 40.68],
  [-73.9, 40.82],
];
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {bounds: manhattan},
});
map.moveTo({center: battery, zoom: 16, duration: 500});
```

## `Position`

```ts
type Position = readonly number[];
```

A position that the application passes, such as `center`, `lngLat` or the argument of `project`, is `[lng, lat]` in
degrees. The type accepts an array that is declared apart from the call, with no `as const`. A position that the map
returns, such as `state.view.center` or the result of `unproject`, has the type `[number, number]`.

## `Bounds`

```ts
type Bounds =
  | readonly [Position, Position]
  | readonly [number, number, number, number];
```

A box is `[[west, south], [east, north]]` or `[west, south, east, north]`, in degrees. `maxBounds`, `fitBounds`,
`initialView.bounds` and `bounds` of `moveTo` accept it. A box that the map returns, such as `state.view.bounds`, is
`[[west, south], [east, north]]`.

## `ViewInput`

A view that the application passes, for [`view`](description.md#view-and-onviewchange) of the description and for
[`moveTo`](map.md#moveto). Each member is optional, and a member that is left out keeps its value.

<!-- ref:ViewInput:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `center` | `Position` | | The center of the view, `[lng, lat]`. |
| `zoom` | `number` | | The zoom level. |
| `bearing` | `number` | | The bearing in degrees clockwise from north. |
| `pitch` | `number` | | The pitch in degrees from straight down. |
<!-- ref:ViewInput:end -->

## `InitialView`

[`initialView`](description.md#initialview) and [`moveTo`](map.md#moveto) accept the members of `ViewInput` and these:

<!-- ref:InitialView:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `bounds` | `Bounds` | | A box to fit into the map. |
| `fitPadding` | `PaddingInput` | `0` | Space in CSS pixels around `bounds` for this fit, which `moveTo` adds to `padding` of the description and the first fit of `initialView` does not. |
| `fitMaxZoom` | `number` | | The largest zoom level of the fit of `bounds`, for a small box. |
<!-- ref:InitialView:end -->

## `GeoJSON`

`GeoJSON` is a feature collection, a feature or a geometry of RFC 7946, with positions of the type `Position`. The
types of `@types/geojson` fit it. [`data`](description.md#data) of the description accepts it.

```ts
type GeoJSON =
  | {type: 'FeatureCollection'; features: readonly GeoJSONFeature[]}
  | GeoJSONFeature
  | GeoJSONGeometry;
interface GeoJSONFeature {
  type: 'Feature';
  id?: string | number;
  geometry: GeoJSONGeometry | null;
  properties: object | null;
}
```

`GeoJSONGeometry` is a `Point`, `MultiPoint`, `LineString`, `MultiLineString`, `Polygon`, `MultiPolygon` or
`GeometryCollection`. `properties` accepts any object, so an interface of the application fits.

## `LayerInput`

A layer of [`layers`](description.md#layers) of the description: a layer of one of the types that the library draws
(`FillLayerSpecification` and the others), with one more optional member, `before`. TypeScript checks `type` and the
prefix of each name in `paint` and `layout`, so a layer with an unknown `type` or a `paint` name of another layer type
does not compile.

## `SourceInput`

A source of [`sources`](description.md#sources) of the description: a `SourceSpecification`, except that a GeoJSON
source has an optional `data`. A GeoJSON source whose id is a key of [`data`](description.md#data) needs no `data` of
its own.

## `RenderedFeature`

A feature that [`queryFeatures`](map.md#queryfeatures), `state.hover` and `onClick` return.

<!-- ref:RenderedFeature:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `type` **required** | `'Feature'` | | Always `'Feature'`. |
| `id` | `number \| string` | | The id of the feature in its source, if it has one. |
| `geometry` **required** | `Exclude<GeoJSONGeometry, {type: 'GeometryCollection'}>` | | The geometry as GeoJSON, in longitude and latitude. |
| `properties` **required** | `Record<string, unknown>` | | The properties of the feature. |
| `source` **required** | `string` | | The id of the source. |
| `sourceLayer` | `string` | | The layer of the vector tile, for a vector source. |
| `layer` **required** | [`StyleLayer`](#stylelayer) | | The style layer that draws the feature. |
| `state` **required** | `Record<string, unknown>` | | The feature state, as `setFeatureState` set it. |
<!-- ref:RenderedFeature:end -->

### `StyleLayer`

<!-- ref:StyleLayer:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `id` **required** | `string` | | The id of the layer. |
| `type` **required** | `string` | | The type of the layer, such as `'fill'` or `'symbol'`. |
| `source` | `string` | | The id of the source of the layer. |
| `source-layer` | `string` | | The layer of the vector tile that the layer draws. |
| `minzoom` | `number` | | The smallest zoom level at which the layer is drawn. |
| `maxzoom` | `number` | | The zoom level from which the layer is no longer drawn. |
| `filter` | `unknown` | | The filter of the layer. |
| `layout` | `Record<string, unknown>` | | The layout properties of the layer. |
| `paint` | `Record<string, unknown>` | | The paint properties of the layer. |
| `metadata` | `unknown` | | The `metadata` of the layer. |
<!-- ref:StyleLayer:end -->

## `QueriedFeature`

A feature that [`querySource`](map.md#querysource) returns. It has no style layer.

<!-- ref:QueriedFeature:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `source` **required** | `string` | | The id of the source. |
| `sourceLayer` **required** | `string` | | The layer of the vector tile. |
| `id` | `number \| string` | | The id of the feature in its source, if it has one. |
| `type` **required** | `'Point' \| 'LineString' \| 'Polygon'` | | The type of the geometry. |
| `layer` | `string` | | Not set by `querySource`. |
| `properties` **required** | `Record<string, unknown>` | | The properties of the feature. |
| `geometry` | `Exclude<GeoJSONGeometry, {type: 'GeometryCollection'}>` | | The geometry as GeoJSON, in longitude and latitude. |
<!-- ref:QueriedFeature:end -->

## `ClusterFeature`

A cluster or a point that [`clusterChildren`](map.md#clusterchildren) and [`clusterLeaves`](map.md#clusterleaves)
return.

<!-- ref:ClusterFeature:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `type` **required** | `'Feature'` | | Always `'Feature'`. |
| `id` | `string \| number` | | The id of a point, from the data or from `generateId` of the source. |
| `properties` **required** | `Record<string, unknown>` | | The properties of a point. |
| `geometry` **required** | `{type: 'Point'; coordinates: [number, number]}` | | The position of the point or of the cluster. |
<!-- ref:ClusterFeature:end -->

## The style types

A style that the application builds in code can use the style types of the entry, with the names of MapLibre GL JS:
`StyleSpecification`, `SourceSpecification`, `LayerSpecification`, a type for each kind of layer
(`FillLayerSpecification`, `LineLayerSpecification`, `SymbolLayerSpecification` and the others),
`ExpressionSpecification`, `FilterSpecification`, `ProjectionSpecification`, `TerrainSpecification` and
`LightSpecification`. They need neither `maplibre-gl` nor `@maplibre/maplibre-gl-style-spec`.

| Type | What TypeScript checks |
|---|---|
| `LayerSpecification` | The structure of a layer. Not its `type`, and not the names and values of `paint` and `layout`. |
| A type of one kind of layer | `type`, and the prefix of each name in `paint` and `layout`. Not the rest of the name, and not the values. |

TypeScript widens the literals of a value that is declared apart from its use. A style read from a JSON file
(`version: number`), a layer in a variable without a type (`type: string`) and a filter in a variable (`string[]`) do
not compile. Declare the type of the variable:

```ts
import {createMap, type FillLayerSpecification} from '@map-jr/map-jr-gl';

const parks: FillLayerSpecification = {
  id: 'parks-tint',
  type: 'fill',
  source: 'openmaptiles',
  'source-layer': 'park',
  paint: {'fill-color': '#4caf50'},
};
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  layers: [parks],
});
```

## Other exported types

| Type | What it is |
|---|---|
| `MapPointer` | The argument of [`onClick`](description.md#onclick). |
| [`FeaturePlace`](map.md#featureplace) | A point, a position or a box of the screen, for a query. |
| [`FeatureOptions`](map.md#featureoptions), [`SourceOptions`](map.md#sourceoptions) | The options of the queries. |
| [`MoveToOptions`](map.md#movetooptions), [`FlyOptions`](map.md#flyoptions) | The argument of `moveTo` and its flight. |
| [`OverlayOptions`](map.md#overlayoptions), [`MapOverlay`](map.md#mapoverlay), `Anchor`, `PopupOffset` | The options and the result of `overlay`. |
| [`Readable`](state.md#readable), [`Store`](exports.md#createstore) | The stores of `map.state` and of `createStore`. |
| `ControlSpec` | A control for [`controls`](description.md#controls). |
| [`StylePair`](description.md#stylepair), [`SpriteInput`](description.md#spriteinput), `ColorScheme`, `Renderer` | The pair of [`style`](description.md#style), an entry of [`sprite`](description.md#sprite), and the values of [`colorScheme`](description.md#colorscheme-and-oncolorschemechange) and [`renderer`](description.md#renderer). |
| `ImageInput`, `ImageSource`, `ImageOptions` | An image for [`images`](description.md#images). |
| `FontFaces` | The value of [`fonts`](description.md#fonts). |
| `PaddingInput` | One number, or `{top, right, bottom, left}`, for [`padding`](description.md#padding). |
| `RequestTransform` | The function of [`transformRequest`](description.md#transformrequest). |
| `ResourceType` | The kind of resource, the second parameter of [`transformRequest`](description.md#transformrequest): `'Style'`, `'Source'`, `'Tile'`, `'Glyphs'`, `'SpriteJSON'`, `'SpriteImage'`, `'Image'`, `'Font'` or `'Unknown'`. |
| `ProtocolFunction` | The function of [`addProtocol`](exports.md#addprotocol). |
| [`LoadOptions`](exports.md#loadoptions) | The options of `configure`. |
| [`PointsOptions`](exports.md#pointsoptions), `PointFeature`, `PointCollection` | The options and the result of `points`. |
| `LngLatInput`, `LngLatBoundsInput`, `LngLatBounds` | Types of the compat entry. No member of `@map-jr/map-jr-gl` uses them. |

## See also

- [The description](description.md) for the fields that use these types.
- [The map](map.md) for the methods that accept and return them.
