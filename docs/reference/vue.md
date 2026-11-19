# Vue

The entry `@map-jr/map-jr-gl/vue` has the components and composables for Vue 3.5 or later. The component `MapJr`
creates a map of the main API, and its props are the fields of [the description](description.md) (`MapDescription`).
For the setup in Nuxt, see [Nuxt](nuxt.md).

```vue
<script setup>
import {ref} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

const view = ref({center: [-74.0065, 40.7085], zoom: 13.6});
</script>

<template>
  <div style="height: 400px">
    <MapJr map-style="https://styles.map-jr.org/1/elevation-zero.json" v-model:view="view" />
  </div>
  <p>Zoom {{ view.zoom.toFixed(1) }}</p>
</template>
```

## `MapJr`

`MapJr` is the map as a component. It fills its parent element, so the parent needs a height: a `height`, or a
flex or grid container. A parent with only `min-height` gives the map a height of 0, and the map stays empty.

### Props

Each prop sets the field of the description with the same name, except `mapStyle`, which sets `style`, and `ssr`.
See [the description](description.md) for what each field does. In a template, write a prop in kebab-case
(`initial-view`) or in camelCase. The props `renderer`, `fontFamily`, `interactive`, `antialias`, `attribution` and
`hash` are read only when the map is created. To change one of them, create the component again, for example with a
new `key`.

<!-- ref:VueMapJrProps:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| [`mapStyle`](#mapstyle) **required** | `string \| StyleSpecification \| {light: string \| StyleSpecification; dark: string \| StyleSpecification}` | | The style: a style object, the URL of a style, or `{light, dark}` with one style for each resolved `colorScheme`. |
| [`view`](#view) | `ViewInput` | | The view that the application controls, for `v-model:view`. |
| `initialView` | `InitialView` | | The view when the map is created: a center, zoom, bearing and pitch, or `bounds` to fit. |
| `sources` | `Record<string, SourceSpecification>` | | Sources to add to the style, by id. |
| `layers` | `LayerInput[]` | | Layers to add to the style. |
| `terrain` | `TerrainSpecification \| null` | | 3D terrain from a raster-dem source. |
| `images` | `Record<string, ImageInput>` | | Images for `icon-image` of style layers, by name: an SVG document as a string, the URL of an image, or `{image, width, height}`. |
| `sprite` | `{id: string; url: string}[]` | | Sprites to add to the sprite of the style, as `[{id: 'pins', url}]`. |
| [`data`](#data) | `Record<string, string \| GeoJSON>` | | GeoJSON data or the URL of GeoJSON, by the id of a GeoJSON source of the style or of `sources`. |
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
| [`ssr`](#ssr) | `boolean \| {width?: number; height?: number; overrides?: false \| Record<string, `[`SSROverrides`](server.md#overrides)`>; attribution?: string \| string[]; timeout?: number; requestTimeout?: number; maxBytes?: number; allowHosts?: string[]; tileZoomOffset?: number}` | `false` | Whether a server renders the first view as SVG into the page: `true`, or options. |
<!-- ref:VueMapJrProps:end -->

### `mapStyle`

`mapStyle` sets the field [`style`](description.md#style) of the description. A Vue element reserves the name
`style` for its CSS. The component sees a change inside a reactive style object, such as
`style.layers[4].paint['fill-color'] = '#d6453d'`.

### `view`

`view` and the event `update:view` together form `v-model:view`. The component emits `update:view` with the new
view at each change of the view, while the user moves the map and when your code changes `view`. It does not emit
`update:view` for the first view. To read the first view, read `map.state.get().view` in the handler of `@load`.

The component sees a new object and a change of one field (`view.zoom = 15`). The map applies a new `view` with no
animation. A `view` that equals one of the views that the map reported does not move the map: see
[`view` and `onViewChange`](description.md#view-and-onviewchange). To return to a stored view, or to animate the
camera, call `moveTo` of the map, which the [template ref](#the-template-ref) holds.

```vue
<script setup>
import {ref, useTemplateRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

const view = ref({center: [-74.0065, 40.7085], zoom: 13.6, bearing: 0, pitch: 0});
const mapRef = useTemplateRef('mapRef');
let stored = view.value;

function returnToStored() {
  mapRef.value.map.moveTo({...stored, duration: 500});
}
</script>

<template>
  <div style="height: 400px">
    <MapJr ref="mapRef" map-style="https://styles.map-jr.org/1/elevation-zero.json" v-model:view="view" />
  </div>
  <button @click="stored = view">Remember this view</button>
  <button @click="returnToStored">Back to the stored view</button>
</template>
```

### `data`

`data` sets the field [`data`](description.md#data) of the description. The map compares the data of each source by
identity, so the component does not see a change inside the GeoJSON of a key (`places.features.push(feature)`). To
change the data of a source, pass a new object.

```vue
<script setup>
import {shallowRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

const places = shallowRef({type: 'FeatureCollection', features: []});
const placesLayer = {id: 'places', type: 'circle', source: 'places', paint: {'circle-radius': 6, 'circle-color': '#d6453d'}};

function addPlace(event) {
  const place = {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: event.lngLat}};
  places.value = {...places.value, features: [...places.value.features, place]};
}
</script>

<template>
  <div style="height: 400px">
    <MapJr map-style="https://styles.map-jr.org/1/elevation-zero.json" :initial-view="{center: [-74.0065, 40.7085], zoom: 13.6}"
      :data="{places}" :layers="[placesLayer]" @click="addPlace" />
  </div>
</template>
```

A reactive object (from `ref()` or `reactive()`) in `data` works, and the map sends a JSON copy of it to its
workers. For large GeoJSON, that copy costs time: use `shallowRef` or `toRaw()`. Data that JSON cannot copy, such as
an object that contains itself, is an `error` event.

### `ssr`

With `ssr`, the server renders the first view of the map as SVG into the page, and the map replaces the SVG when it
has drawn its first frame. See [The `ssr` prop of `<MapJr>`](server.md#the-ssr-prop-of-mapjr) for the options and
the props that the server render uses. Without `ssr`, the server renders an empty element, and the map starts in it
in the browser.

### Events

| Event | Value | When |
|---|---|---|
| `update:view` | `View` | At each change of the view. See [`view`](#view). |
| `update:colorScheme` | `'auto' \| 'light' \| 'dark'` | When a control sets the colour scheme. With `v-model:color-scheme`, the prop follows. |
| `click` | `MapPointer`: `{point, lngLat, features}` | At each click on the map. `features` are those of `interactiveLayers` at the point. |
| `hover` | `RenderedFeature[]` | When the features of `interactiveLayers` under the pointer change. |
| `load` | `MapInstance` | Once, when the style and the first tiles have loaded. The map is not yet idle then. |
| `idle` | none | Each time the map has drawn everything and nothing moves. |
| `error` | `Error` | At each error of the map. Without a listener for `error`, the map writes each error to the console. |

The component also emits each other event of [`listen`](../api.md#events) of the main API, with the same value:
`@moveend`, `@zoomend`, `@styleimagemissing`, `@sourcedata` and the others. The event `style.load` is `@styleload`,
because a dot in an event name is a modifier in a template. The component listens to such an event only when the
component has a listener for it when it is created. For the events of the map named `click`, `load`, `idle` and
`error`, call `map.listen`.

### The slot

The default slot renders over the map, and it receives `map` (`MapInstance | null`) and `state`
([`MapState`](../api.md#the-state) or `null`). A slot that reads `state` renders again at each change of the state,
and `state.pointer` changes at each move of the mouse. To follow one part of the state only, call
`map.state.subscribe` with a selector.

```vue
<script setup>
import {MapJr} from '@map-jr/map-jr-gl/vue';
</script>

<template>
  <div style="height: 400px">
    <MapJr map-style="https://styles.map-jr.org/1/elevation-zero.json" v-slot="{state}">
      <p v-if="state && !state.loaded">Loading the map</p>
    </MapJr>
  </div>
</template>
```

### The template ref

A template ref on `MapJr` holds these members. The map is `mapRef.value.map`. In TypeScript, type the ref as
`useTemplateRef<InstanceType<typeof MapJr>>('mapRef')`.

<!-- ref:VueMapJrExposed:start -->
| Name | Type | Description |
|---|---|---|
| `map` (read only) | `MapInstance \| null` | The map, or `null` until the component is mounted. |
| `state` (read only) | `MapState \| null` | The state of the map, or `null` until the component is mounted. |
<!-- ref:VueMapJrExposed:end -->

## `MapOverlay`

`MapOverlay` places its content, an element of the page, at a position of the map: a marker with your own content,
or a popup. It works only inside `MapJr`. The content is Vue content with components, events and reactive values.
For many markers, draw a symbol layer with the points in [`data`](#data): see
[Markers and popups](../guide/markers-and-popups.md).

```vue
<script setup>
import {ref} from 'vue';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/vue';

const home = ref([-74.0065, 40.7085]);
const popupOpen = ref(true);
</script>

<template>
  <div style="height: 400px">
    <MapJr map-style="https://styles.map-jr.org/1/elevation-zero.json" :initial-view="{center: home, zoom: 14}">
      <MapOverlay :lng-lat="home" anchor="bottom" draggable @dragend="home = $event">
        <svg width="24" height="31" viewBox="0 0 24 31"><path fill="#d6453d" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>
      </MapOverlay>
      <MapOverlay v-if="popupOpen" :lng-lat="home" :offset="[0, -31]" anchor="bottom" popup @close="popupOpen = false">Home</MapOverlay>
    </MapJr>
  </div>
</template>
```

<!-- ref:VueMapOverlayProps:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `lngLat` **required** | `[number, number]` | | The position of the content, `[lng, lat]`. |
| `anchor` | `Anchor` | `'center'` | The part of the content that is at the position: `'center'`, `'bottom'`, `'top-left'` and the other sides and corners. |
| `offset` | `[number, number]` | | A distance in CSS pixels from the position, to the right and down. |
| `popup` | `boolean` | `false` | Whether the content is shown in a box with a tip that points to the position (a popup). |
| `onClose` | `() => void` | | Called when the user closes the popup, as the listener `@close`. |
| `draggable` | `boolean` | `false` | Whether the user can drag the content. |
<!-- ref:VueMapOverlayProps:end -->

| Event | Value | When |
|---|---|---|
| `close` | none | When the user closes the popup. A listener for `close` adds the button that closes the popup. |
| `dragstart` | `[lng, lat]` | When a drag starts, after the pointer has moved 3 pixels. A shorter move stays a click. |
| `drag` | `[lng, lat]` | At each move of a drag. |
| `dragend` | `[lng, lat]` | When the user drops the content. |

After a drag, the content stays where the user dropped it until `lngLat` changes. To keep the position, set
`lngLat` in `@dragend`, as the example does.

## `MapImage`

`MapImage` adds an image for the style layers of the map, from an SVG in its slot or from the URL in `src`. It works
only inside `MapJr`. A layer uses the image by its name in `icon-image`.

```vue
<script setup>
import {MapJr, MapImage} from '@map-jr/map-jr-gl/vue';

const stations = {type: 'FeatureCollection', features: [
  {type: 'Feature', properties: {color: '#d6453d'}, geometry: {type: 'Point', coordinates: [-74.006, 40.7128]}},
  {type: 'Feature', properties: {color: '#2f7fd1'}, geometry: {type: 'Point', coordinates: [-73.9857, 40.7484]}},
]};
const sources = {stations: {type: 'geojson', data: stations}};
const layers = [{id: 'stations', type: 'symbol', source: 'stations', layout: {'icon-image': 'pin', 'icon-anchor': 'bottom', 'icon-allow-overlap': true}}];
</script>

<template>
  <div style="height: 400px">
    <MapJr map-style="https://styles.map-jr.org/1/elevation-zero.json" :initial-view="{center: [-73.996, 40.73], zoom: 11.5}" :sources="sources" :layers="layers">
      <MapImage name="pin" :params="['color']" v-slot="{color}">
        <svg viewBox="0 0 24 31"><path :fill="color" stroke="#fff" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>
      </MapImage>
    </MapJr>
  </div>
</template>
```

<!-- ref:VueMapImageProps:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `name` **required** | `string` | | The name of the image, for `icon-image` of a style layer. |
| `params` | `readonly P[]` | | The names of the parameters of the image. |
| `src` | `string` | | The URL of an image, in place of an SVG in the slot. |
| `width` | `number` | | The width in CSS pixels. |
| `height` | `number` | | The height in CSS pixels. |
| `pixelRatio` | `number` | `1` | The number of image pixels for one CSS pixel, for example 2 for an image "@2x". |
<!-- ref:VueMapImageProps:end -->

`P` is the type of the names in `params`.

- The slot receives a prop for each name of `params`. Bind it to an attribute (`:fill="color"`) or write it as text
  (`<text>{{ label }}</text>`). With TypeScript, a prop of the slot that is not in `params` is a type error.
- Each feature of the layer sets the parameters: from the property of the feature with that name, or from `params`
  of an `image` expression of the layer. See [Images and fonts](../guide/images-and-fonts.md).
- Vue renders the SVG once. The map draws it once for each different set of values.
- When the content of the slot changes, the map receives the new image.
- The SVG is not in the page, so a `<style>` or an `id` inside it has no effect on the page.
- An image of `MapImage` overrides the image of the prop `images` with the same name. Of two `MapImage` with one
  name, the map uses either image while one of them is mounted.
- The server render of [`ssr`](#ssr) does not draw the image.

## `useMapJr`

`useMapJr` creates a map in an element of your own, from a description that can be a ref, a computed value or a
function.

```ts
useMapJr(container: MaybeRefOrGetter<HTMLElement | null | undefined>, spec: MaybeRefOrGetter<MapDescription>): {map: ShallowRef<MapInstance | null>; state: ShallowRef<MapState | null>}
```

| Parameter | Description |
|---|---|
| `container` | The element of the map, usually a template ref. |
| `spec` | The [description](description.md). |

**Returns** `map`, a ref that holds the map, and `state`, a ref that holds the [state](../api.md#the-state). Both
are `null` until the map is created, which happens after `onMounted`, once the code of the map has loaded. The
map is destroyed when the component that called `useMapJr` unmounts.

```vue
<script setup>
import {computed, ref, useTemplateRef} from 'vue';
import {useMapJr} from '@map-jr/map-jr-gl/vue';

const measuring = ref(false);
const {map, state} = useMapJr(useTemplateRef('el'), computed(() => ({
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
  cursor: measuring.value ? 'crosshair' : undefined,
})));
</script>

<template>
  <div ref="el" style="height: 400px" />
  <p>Zoom {{ state?.view.zoom.toFixed(1) }}</p>
  <button @click="measuring = !measuring">Measure</button>
  <button @click="map?.moveTo({zoom: 15, duration: 500})">Zoom to 15</button>
</template>
```

`useMapJr` calls [`update`](../api.md#change-the-map) of the map each time that `spec` returns a new object. A
computed value or a function returns one when a ref that it reads changes. A change inside a ref is not seen:
after `const description = ref({style, cursor: ''})`, the assignment `description.value.cursor = 'crosshair'`
changes nothing. Write `description.value = {...description.value, cursor: 'crosshair'}`.

## `useMapInstance`

```ts
useMapInstance(): ShallowRef<MapInstance | null>
```

**Returns** a ref that holds the map of the `MapJr` that the calling component is in. It is `null` until the map is
created, and also in a component outside `MapJr`.

## `useMapFeatures`

```ts
useMapFeatures(at: MaybeRefOrGetter<FeaturePlace | undefined>, options?: MaybeRefOrGetter<FeatureOptions>): ShallowRef<RenderedFeature[]>
```

**Returns** a ref with the features that the style layers draw at `at`, kept up to date as
[`watchFeatures`](../api.md#queries) of the map keeps them. Call it in a component inside `MapJr`. The place and the
options can be refs or functions.

```vue
<script setup>
import {useMapFeatures} from '@map-jr/map-jr-gl/vue';

const props = defineProps({lng: Number, lat: Number});
const buildings = useMapFeatures(() => [props.lng, props.lat], {layers: ['building']});
</script>

<template>
  <p>{{ buildings.length ? 'On a building' : 'Not on a building' }}</p>
</template>
```

## `useMapSource`

```ts
useMapSource(sourceId: MaybeRefOrGetter<string>, at?: MaybeRefOrGetter<FeaturePlace | undefined>, options?: MaybeRefOrGetter<SourceOptions>): ShallowRef<QueriedFeature[]>
```

**Returns** a ref with the features of the tile data of the source `sourceId` at `at`, kept up to date as
[`watchSource`](../api.md#queries) of the map keeps them. Call it in a component inside `MapJr`. The id, the place
and the options can be refs or functions.

## How `MapJr` sees changes

You can change the props as in other Vue code. The component sees these changes:

| Change | Example |
|---|---|
| A new value for a prop | `view.value = {center, zoom}` |
| A field of the view | `view.value.zoom = 15` |
| A layer added or removed | `layers.value.push(layer)`, `layers.value.splice(0, 1)` |
| A new object for a key of `data` | `places.value = {...places.value, features}` |
| A part of a reactive style object | `style.layers[4].paint['fill-color'] = '#d6453d'` |
| An array or object that the template creates again at each render | `:controls="[navigation()]"`, `:interactive-layers="['places']"` |

A new array or object with the same content as the last one changes nothing. A style object that the template
creates at each render is compared by its content, which costs time for a large style: pass the URL of the style, or
an object that is created once.

## See also

- [The description](description.md) for what each prop does.
- [Nuxt](nuxt.md) for the module and `LazyMapJr`.
- [The server renderer](server.md) for the first view from the server.
- [Getting started](../guide/getting-started.md) for the installation.
