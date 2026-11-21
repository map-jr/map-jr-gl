# Reference tables (fixture)

`scripts/reference.mjs` fills the blocks of this file, and `pnpm test:consistency` runs `--check` on it. The blocks
cover the types that the reference pages do not have yet, so that a member without TSDoc fails here first: the
props of the Vue and React components, the options of the Svelte action, and the options of a control. Do not edit the tables by hand: change the comment in `src/` and run
`node scripts/reference.mjs --write`.

## `VueMapJrProps`

<!-- ref:VueMapJrProps:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `mapStyle` **required** | `string \| StyleSpecification \| {light: string \| StyleSpecification; dark: string \| StyleSpecification}` | | The style: a style object, the URL of a style, or `{light, dark}`, of which the map draws the style that matches `colorScheme`. |
| `view` | [`ViewInput`](../../docs/reference/types.md#viewinput) | | The view that the application controls, for `v-model:view`. |
| `initialView` | [`InitialView`](../../docs/reference/types.md#initialview) | | The view when the map is created: a center, zoom, bearing and pitch, or `bounds` to fit. |
| `sources` | `Record<string, SourceInput> \| null` | | Sources to add to the style, by id. |
| `layers` | `LayerInput[] \| null` | | Layers to add to the style. |
| `terrain` | `TerrainSpecification \| null` | | 3D terrain from a raster-dem source. |
| `images` | `Record<string, ImageInput> \| null` | | Images for `icon-image` of style layers, by name: an SVG document as a string, the URL of an image, or `{image, width, height}`. |
| `sprite` | `{id: string; url: string}[] \| null` | | Sprites to add to the sprite of the style, as `[{id: 'pins', url}]`. |
| `data` | `Record<string, string \| GeoJSON> \| null` | | GeoJSON data or the URL of GeoJSON, by the id of a GeoJSON source of the style or of `sources`. |
| `interactiveLayers` | `string[]` | | The ids of the style layers that respond to the pointer: their features are in the events `click` and `hover`. |
| `hoverState` | `boolean` | `false` | Whether the top feature of `interactive-layers` under the pointer has the feature state `hover: true`. |
| `minZoom` | `number` | `-2` | The smallest zoom level of the map. |
| `maxZoom` | `number` | `22` | The largest zoom level of the map. |
| `maxPitch` | `number` | `60` | The largest pitch of the map in degrees, at most 90. |
| `maxBounds` | `Bounds \| null` | | A box that the view cannot leave, as `[[west, south], [east, north]]` or `[west, south, east, north]`. |
| `cursor` | `string` | | The CSS cursor over the map. |
| `cooperativeGestures` | `boolean` | `false` | Whether the wheel zooms only with Ctrl (⌘ on a Mac) and a touch pans only with two fingers, for a map in a page that scrolls. |
| `colorScheme` | `'auto' \| 'dark' \| 'light' \| null` | `'light'` | The colour scheme of the controls, the popup and the attribution, for `v-model:color-scheme`. |
| `locale` | `Record<string, string> \| null` | | The texts of the controls by the keys of MapLibre GL JS, for example `{'NavigationControl.ZoomIn': 'Zoom avant'}`. |
| `padding` | `PaddingInput \| null` | `0` | Space in CSS pixels at the sides of the map that the view keeps free: one number, or `{top, right, bottom, left}`. |
| `controls` | `ControlSpec[]` | | Controls from `@map-jr/map-jr-gl/controls`, for example `[navigation(), scale()]`. |
| `projection` | `ProjectionSpecification \| null` | | The projection, `{type: 'globe'}` or `{type: 'mercator'}`. |
| `globalState` | `Record<string, unknown> \| null` | | Values for the `global-state` expressions of the style, by name, for example `{season: 'winter'}`. |
| `transformRequest` | `RequestTransform \| null` | | A function that changes a request before the map sends it, as `transformRequest` of MapLibre GL JS. |
| `renderer` | `'auto' \| 'main' \| 'worker'` | `'auto'` | The thread that renders the map. |
| `fonts` | `FontFaces \| null` | | Web fonts for labels, by `text-font` name: a URL, or a list of `{url, 'unicode-range'}` as in `font-faces` of the style specification. |
| `fontFamily` | `string` | `'"Noto Sans", "Helvetica Neue", Arial, sans-serif'` | The CSS font family for labels whose `text-font` names no loaded font. |
| `interactive` | `boolean` | `true` | Whether the user can move the map. |
| `antialias` | `boolean` | `false` | Whether the canvas uses multisample antialiasing. |
| `nonce` | `string` | | The nonce of a Content Security Policy with `style-src 'nonce-…'`, for the style sheet of the map. |
| `attribution` | `false \| {compact?: boolean; customAttribution?: string \| string[]}` | | The options of the built-in attribution, or `false` to hide it. |
| `hash` | `string \| boolean` | `false` | Whether the view is kept in the hash of the URL; a string is the name of the parameter. |
| `ssr` | `boolean \| `[`MapJrSSROptions`](../../docs/reference/server.md#the-ssr-prop-of-mapjr) | `false` | Whether a server renders the first view as SVG into the page: `true`, or options. |
<!-- ref:VueMapJrProps:end -->

## `ReactMapJrProps`

<!-- ref:ReactMapJrProps:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `mapStyle` **required** | [`MapDescription`](../../docs/reference/description.md#mapdescription)`['style']` | | The style: a style object, the URL of a style, or `{light, dark}`. |
| `onViewChange` | `(view: `[`View`](../../docs/reference/state.md#view)`) => void` | | Called with the first view once, before `load`, and then with the new view at each change of the view. |
| `onHover` | `(features: `[`RenderedFeature`](../../docs/reference/types.md#renderedfeature)`[]) => void` | | Called with the features of `interactiveLayers` under the pointer, the top one first, when they change. |
| `onLoad` | `() => void` | | Called when the style and the first tiles have loaded. |
| `onIdle` | `() => void` | | Called each time the camera is still and nothing loads. |
| `onError` | `(error: Error) => void` | | Called with each error of the map. |
| `firstView` | `string` | | The first view rendered on a server, as HTML: the result of `renderFirstView` from `@map-jr/map-jr-gl/server`. |
| `className` | `string` | | A CSS class to add to the element, after the class `map-jr-react`. |
| `style` | `CSSProperties` | | The CSS style of the element, merged over `{position: 'relative', width: '100%', height: '100%'}`. |
| `children` | `ReactNode` | | Content over the map, and `MapOverlay` elements. |
<!-- ref:ReactMapJrProps:end -->

## `SvelteMapAction`

<!-- ref:SvelteMapAction:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `description` **required** | [`MapDescription`](../../docs/reference/description.md#mapdescription) | | The description of the map. |
| `ready` | `(map: `[`MapInstance`](../../docs/reference/map.md#mapinstance)`) => void` | | Called with the map once it is created. |
<!-- ref:SvelteMapAction:end -->
## `MapJrElement`

<!-- ref:MapJrElement:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `mapStyle` | [`MapDescription`](../../docs/reference/description.md#mapdescription)`['style']` | | The `style` of the description: the URL of a style, a style object, or `{light, dark}`. |
| `map` (read only) | [`MapInstance`](../../docs/reference/map.md#mapinstance)` \| null` | | The map (`MapInstance`), from the microtask after the element is in the page with a style until it is removed, or else `null`. |
| `state` (read only) | [`MapInstance`](../../docs/reference/map.md#mapinstance)`['state'] \| null` | | The state of the map as a store (`map.state`), or `null` while there is no map. |
<!-- ref:MapJrElement:end -->
