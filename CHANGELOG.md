# Changelog

Each version has one entry. While the version is 0.x, a version that breaks code that worked increases the second
number, and its entry starts with a section "Breaking changes". See
[How a release is made](docs/development.md#how-a-release-is-made).

`#12` is a link to pull request 12. A change without a number comes from before 2026-11-11, when the repository had
no pull requests.

## Unreleased

### Breaking changes

- `@map-jr/map-jr-gl`: `terrain: null` in the description draws a flat map, also when the style has a `terrain`, as
  `setTerrain(null)` does in MapLibre GL JS. No field, or `undefined`, keeps the terrain of the style. Code that passed
  `null` to keep the terrain of the style leaves the field out instead ([#1105]).

[#1105]: https://github.com/map-jr/map-jr-gl/pull/1105

## 0.9.0 (2026-11-19)

This entry covers the changes after 0.8.0 (the tag `v0.8.0`).

### Breaking changes

- Both entries: a layer filter that reads `["zoom"]` sees the over-zoomed zoom of a tile, as in MapLibre GL JS. Past
  the `maxzoom` of a source, a filter such as `[">=", ["zoom"], 15]` now passes, and `["<", ["zoom"], 15]` now hides
  its features from zoom 15. `queryRenderedFeatures` and `queryFeatures` return what the map draws there. In
  `@map-jr/map-jr-gl/server`, a render with a `tileZoomOffset` above 0 evaluates filters at the zoom of the render, so
  write a `map-jr:ssr` filter for that zoom and not for the zoom of the tiles ([#993]).
- Both entries: a value of `text-anchor`, `icon-anchor`, `text-justify` or `text-transform` that is not one of the
  values of the specification gives the default, as in MapLibre GL JS. Write a value from the specification
  ([#1026]).
- Both entries: `text-keep-upright: false` is read, so labels along lines that run to the west are drawn upside down,
  as in MapLibre GL JS. Leave the property out to keep them upright ([#1070]).
- Both entries: with `symbol-z-order` `auto` and `text-allow-overlap` or `icon-allow-overlap`, the symbols of a layer
  are drawn in the order of their position on the screen. Set `symbol-z-order` to `source` to keep the order of the
  data ([#1074]).
- Both entries: a changed paint value moves from the old value to the new one over 300 ms, as in MapLibre GL JS, and
  `idle` waits for the end. Set `transition` of the style (or the `*-transition` of the property) to
  `{"duration": 0, "delay": 0}` to change the value at once ([#970]).
- `@map-jr/map-jr-gl/maplibre-compat`: `updateImage` takes two arguments, as in MapLibre GL JS. Leave out the third
  argument (`options`); the image keeps the options of `addImage` ([#956]). Pixels that the page changes after
  `updateImage` and before the end of the task are sent as they are at the end of the task ([#980]).
- `@map-jr/map-jr-gl/maplibre-compat`: a GeoJSON source without the option `buffer` clips its features 128 px past the
  tile edge, as in MapLibre GL JS, where it clipped them 16 px past the edge. `@map-jr/map-jr-gl` keeps 16 px. Pass
  `buffer` to the source to choose the distance ([#1097]).

### New

- Both entries: paint transitions, as in MapLibre GL JS ([#970]). Symbol layers, fill-extrusion layers and
  `fill-outline-color` change at once.
- Both entries: `text-pitch-alignment` and `icon-pitch-alignment` are read, so symbols can lie on the ground of a
  tilted map ([#1062], [#1077]). `text-keep-upright` and `icon-keep-upright` are read ([#1070]).
- Both entries: `fill-extrusion-pattern` draws its image on the walls and roofs of extrusions ([#1065]), and a GeoJSON
  source reads its `buffer` ([#1084]).
- Both entries: `raster-resampling`, `resampling` and `raster-layer-blend` are read. A `raster-fade-duration` other
  than 0 has no effect and warns once ([#1071]).
- Both entries: joins of lines follow `line-miter-limit` and `line-round-limit` ([#1068]), `icon-padding` takes one to
  four values ([#1088]), and `icon-halo-blur` is read ([#1041]).
- Both entries: a layer whose `visibility` is an expression of the global state is hidden with its tiles ([#1031]),
  and the attribution follows it ([#1090]).
- `@map-jr/map-jr-gl/maplibre-compat`: the map has `coveringTiles` ([#1042]), `calculateCameraOptionsFromTo` and two
  other camera methods ([#1030]). `setTransformConstrain` and the option `transformConstrain` limit the camera with
  `renderer: 'main'` ([#1049]). `setZoomSnap` and `setEventedParent` work ([#1037]), and `setSourceTileLodParams`
  changes the level of detail of a pitched view ([#1058]).
- `@map-jr/map-jr-gl/server`: `tileZoomOffset` builds the render from tiles of another zoom ([#989]). Path data that
  two line layers share is written once, with `<use>` ([#990]).
- Both entries: the development build warns about a nested or repeated zoom curve ([#1086]).

### Fixed

- Both entries: a map in a `display: none` container fires `load` and `idle`, as in MapLibre GL JS ([#1055]).
- Both entries: the fill-extrusion layers of a frame share one depth buffer ([#1038]), and SDF icons are not snapped
  to pixels, so their halo sits where MapLibre GL JS draws it ([#1041]).
- Both entries: a zoom or feature expression in `text-font`, `text-variable-anchor`, `*-allow-overlap` and the other
  properties of kind `raw` is evaluated, where it was taken as a literal value ([#1034]).
- Both entries: `text-variable-anchor` tries the anchors in the order of MapLibre GL JS ([#1046]). Text along a line
  is not drawn when its required icon is not placed ([#1082]), and an icon along a line is not dropped because of its
  own bent text ([#1078]).
- Both entries: a new order of the layers keeps the tiles ([#975]). `updateImage` copies pixels of the same size into
  the texture in place ([#956]) and sends the pixels once per task ([#980]).
- Both entries: with the worker renderer, `idle` waits until the canvas has the size of the last resize ([#958]). In
  WebKit, `toBlob` and reads of the canvas at `idle` give the drawn map ([#969], [#1014]).
- Both entries: a rotate drag whose moves come less than 16 ms apart has inertia ([#946]).
- `@map-jr/map-jr-gl/maplibre-compat`: `removeSource` drops the `setSourceTileLodParams` values of the source
  ([#1075]).
- `@map-jr/map-jr-gl/server`: `renderToSVG` lays symbols with a ground frame on the ground of a pitched map
  ([#1073]), draws images inside `format` text ([#1081]), and writes no paths for a layer that draws nothing at the
  zoom ([#988]).

[#946]: https://github.com/map-jr/map-jr-gl/pull/946
[#956]: https://github.com/map-jr/map-jr-gl/pull/956
[#958]: https://github.com/map-jr/map-jr-gl/pull/958
[#969]: https://github.com/map-jr/map-jr-gl/pull/969
[#970]: https://github.com/map-jr/map-jr-gl/pull/970
[#975]: https://github.com/map-jr/map-jr-gl/pull/975
[#980]: https://github.com/map-jr/map-jr-gl/pull/980
[#988]: https://github.com/map-jr/map-jr-gl/pull/988
[#989]: https://github.com/map-jr/map-jr-gl/pull/989
[#990]: https://github.com/map-jr/map-jr-gl/pull/990
[#993]: https://github.com/map-jr/map-jr-gl/pull/993
[#1014]: https://github.com/map-jr/map-jr-gl/pull/1014
[#1026]: https://github.com/map-jr/map-jr-gl/pull/1026
[#1030]: https://github.com/map-jr/map-jr-gl/pull/1030
[#1031]: https://github.com/map-jr/map-jr-gl/pull/1031
[#1034]: https://github.com/map-jr/map-jr-gl/pull/1034
[#1037]: https://github.com/map-jr/map-jr-gl/pull/1037
[#1038]: https://github.com/map-jr/map-jr-gl/pull/1038
[#1041]: https://github.com/map-jr/map-jr-gl/pull/1041
[#1042]: https://github.com/map-jr/map-jr-gl/pull/1042
[#1046]: https://github.com/map-jr/map-jr-gl/pull/1046
[#1049]: https://github.com/map-jr/map-jr-gl/pull/1049
[#1055]: https://github.com/map-jr/map-jr-gl/pull/1055
[#1058]: https://github.com/map-jr/map-jr-gl/pull/1058
[#1062]: https://github.com/map-jr/map-jr-gl/pull/1062
[#1065]: https://github.com/map-jr/map-jr-gl/pull/1065
[#1068]: https://github.com/map-jr/map-jr-gl/pull/1068
[#1070]: https://github.com/map-jr/map-jr-gl/pull/1070
[#1071]: https://github.com/map-jr/map-jr-gl/pull/1071
[#1073]: https://github.com/map-jr/map-jr-gl/pull/1073
[#1074]: https://github.com/map-jr/map-jr-gl/pull/1074
[#1075]: https://github.com/map-jr/map-jr-gl/pull/1075
[#1077]: https://github.com/map-jr/map-jr-gl/pull/1077
[#1078]: https://github.com/map-jr/map-jr-gl/pull/1078
[#1081]: https://github.com/map-jr/map-jr-gl/pull/1081
[#1082]: https://github.com/map-jr/map-jr-gl/pull/1082
[#1084]: https://github.com/map-jr/map-jr-gl/pull/1084
[#1086]: https://github.com/map-jr/map-jr-gl/pull/1086
[#1088]: https://github.com/map-jr/map-jr-gl/pull/1088
[#1090]: https://github.com/map-jr/map-jr-gl/pull/1090
[#1097]: https://github.com/map-jr/map-jr-gl/pull/1097

## 0.8.0 (2026-11-18)

This entry covers the changes after 0.7.0 (the tag `v0.7.0`).

### Breaking changes

- Both entries: text that the map draws with the fonts of the browser uses the CSS family list of `text-font`. This
  is all text of a style without `glyphs`. In a style with `glyphs`, it is the text that the glyph files cannot draw:
  a font stack or a range that the server does not have, a character missing from the files, and text that the
  browser must shape. A second or later name of `text-font` that exists on the system now draws in that font, where
  the map used `fontFamily`, and a name that is a generic family (`sans-serif`, `serif`, `monospace`) draws in that
  generic font. Leave such names out of `text-font` to keep the old fonts ([#934]).
- Both entries: two GeoJSON features with the same id are two query results, where the query returned only the first.
  Code that expected one result for each id must handle each feature ([#829]).
- `@map-jr/map-jr-gl/maplibre-compat`: `getSky()` returns the `sky` of the style, where it returned `undefined` for
  every style ([#901]). After `setSky(null)` it returns `null`, as in MapLibre GL JS. Code that tested
  `getSky() === undefined` must test for `null` ([#918]).
- Both entries: with the main renderer, `idle` after a resize comes one animation frame later ([#935]). In
  `@map-jr/map-jr-gl`, `state.hover` can come one frame later ([#909]).

### New

- Both entries: the sky of the style above the horizon and fog on 3D terrain, in Mercator ([#901]), and the
  atmosphere on the globe ([#911]).
- Both entries: the pitch goes up to 90 with `maxPitch` or `setMaxPitch`. The default stays 60, and a value above 90
  warns once and gives 90 ([#893]).
- `@map-jr/map-jr-gl/element`: the web component `<map-jr>`, with `renderElement` in `@map-jr/map-jr-gl/server`
  ([#845]). See [docs/element.md](docs/element.md).
- `@map-jr/map-jr-gl`: `getResolvedDescription()` returns the description with the style that the map loaded and the
  global state in effect ([#873]).
- `@map-jr/map-jr-gl`: `update()` applies a new order of layers, a new layer, and a change of `paint`, `layout`,
  `filter`, `minzoom` or `maxzoom` in place, without loading the style again ([#870], [#874], [#895], [#904]). The
  core map has `setLayerZoomRange` ([#904]).

### Fixed

- Both entries: a layer between two symbol layers draws over the labels before it, as in MapLibre GL JS ([#900]).
- Both entries: labels on a tilted map follow the perspective of their anchor in each frame between placements
  ([#921]), and a label whose anchor is behind the camera or too far is not drawn ([#925]).
- Both entries: all waiting tiles are uploaded in one frame before the first `idle` and at rest ([#894]), and 3D
  terrain is idle only when its elevation tiles have loaded ([#837]).
- Both entries: a failed source is requested once and fires `error` once, as in MapLibre GL JS ([#854]).
- Both entries: after a fallback to the main thread or a restart, the map uses the tile workers again ([#836]), the
  GeoJSON of `setData` reaches the engine ([#861]), and the images of the style stay images of the style and are drawn
  ([#867], [#883]).
- Both entries: the worker renderer draws while GeoJSON data changes in each frame ([#877]). The engine encodes a
  GeoJSON update once for all tile workers ([#891]), and `setData` keeps its own copy of a source object ([#869]).
- Both entries: in WebKit, the map answers a click in time, because a query wakes the tile workers ([#863]).
- Both entries: a map in a shadow root reads the focus and the fullscreen element from its root ([#865]).
- Both entries: a popup offset that is a `Point` or `{x, y}` moves the popup ([#906]). Escape returns the focus to the
  map from a button in a popup ([#846]), and a popup of `overlay()` opened from the keyboard takes the focus ([#868]).
- Both entries: `remove()` does not call `loseContext()` on a lost context ([#823]), a query that `remove()` rejects
  is not an unhandled rejection ([#835]), and `supported()` releases its WebGL2 probe context ([#833]).
- Both entries: a map that connects to the tile workers again closes its old tile ports ([#849]).
- Both entries: a frame moves the labels in place instead of making new objects for each label ([#892]).
- Both entries: a `text-font` name with "|", also in a `format` section, keeps its family, and the section keeps its
  color ([#941]).
- `@map-jr/map-jr-gl/maplibre-compat`: a click on a `Marker` fires `click` on the marker ([#907]), and a rotate drag
  has inertia ([#903]), as in MapLibre GL JS.

[#823]: https://github.com/map-jr/map-jr-gl/pull/823
[#829]: https://github.com/map-jr/map-jr-gl/pull/829
[#833]: https://github.com/map-jr/map-jr-gl/pull/833
[#835]: https://github.com/map-jr/map-jr-gl/pull/835
[#836]: https://github.com/map-jr/map-jr-gl/pull/836
[#837]: https://github.com/map-jr/map-jr-gl/pull/837
[#845]: https://github.com/map-jr/map-jr-gl/pull/845
[#846]: https://github.com/map-jr/map-jr-gl/pull/846
[#849]: https://github.com/map-jr/map-jr-gl/pull/849
[#854]: https://github.com/map-jr/map-jr-gl/pull/854
[#861]: https://github.com/map-jr/map-jr-gl/pull/861
[#863]: https://github.com/map-jr/map-jr-gl/pull/863
[#865]: https://github.com/map-jr/map-jr-gl/pull/865
[#867]: https://github.com/map-jr/map-jr-gl/pull/867
[#868]: https://github.com/map-jr/map-jr-gl/pull/868
[#869]: https://github.com/map-jr/map-jr-gl/pull/869
[#870]: https://github.com/map-jr/map-jr-gl/pull/870
[#873]: https://github.com/map-jr/map-jr-gl/pull/873
[#874]: https://github.com/map-jr/map-jr-gl/pull/874
[#877]: https://github.com/map-jr/map-jr-gl/pull/877
[#883]: https://github.com/map-jr/map-jr-gl/pull/883
[#891]: https://github.com/map-jr/map-jr-gl/pull/891
[#892]: https://github.com/map-jr/map-jr-gl/pull/892
[#893]: https://github.com/map-jr/map-jr-gl/pull/893
[#894]: https://github.com/map-jr/map-jr-gl/pull/894
[#895]: https://github.com/map-jr/map-jr-gl/pull/895
[#900]: https://github.com/map-jr/map-jr-gl/pull/900
[#901]: https://github.com/map-jr/map-jr-gl/pull/901
[#903]: https://github.com/map-jr/map-jr-gl/pull/903
[#904]: https://github.com/map-jr/map-jr-gl/pull/904
[#906]: https://github.com/map-jr/map-jr-gl/pull/906
[#907]: https://github.com/map-jr/map-jr-gl/pull/907
[#909]: https://github.com/map-jr/map-jr-gl/pull/909
[#911]: https://github.com/map-jr/map-jr-gl/pull/911
[#918]: https://github.com/map-jr/map-jr-gl/pull/918
[#921]: https://github.com/map-jr/map-jr-gl/pull/921
[#925]: https://github.com/map-jr/map-jr-gl/pull/925
[#934]: https://github.com/map-jr/map-jr-gl/pull/934
[#935]: https://github.com/map-jr/map-jr-gl/pull/935
[#941]: https://github.com/map-jr/map-jr-gl/pull/941

## 0.7.0 (2026-11-17)

This entry covers the changes after 0.6.0 (the tag `v0.6.0`).

### Breaking changes

- `@map-jr/map-jr-gl`: the state has no field `error`. `map.state.get().error` is `undefined`, and TypeScript rejects
  it. Write `onError` in the description or `map.listen('error', fn)` to get each error. In the adapters, use the
  `onError` prop of React and Svelte, and `@error` in Vue ([#734]).
- `@map-jr/map-jr-gl/server`: `renderToSVG` and `renderToImage` have one option `overrides` in place of
  `ssrOverrides`. Write `overrides: false` in place of `ssrOverrides: false`. In JavaScript the old option has no
  effect and gives no warning. `overrides: false` now also ignores `simplify` and `minSize` of
  `metadata["map-jr:ssr"]`, so its SVG can be larger. The `ssr` prop of the Vue component takes `overrides: false`
  too ([#731]).
- Both entries: a GeoJSON feature with a string `id` and no `promoteId` keeps that id in queries and for feature
  state, where it had `id: undefined`. A string of decimal digits that is a safe integer becomes the number (`'12'` is
  `12`), so `setFeatureState` for such a feature takes the number ([#633]).
- Both entries: a `background-pattern` that names no image, `""` included, draws nothing, as in MapLibre GL JS. Before,
  it drew `background-color`. Leave `background-pattern` unset to draw the colour ([#741]).
- `@map-jr/map-jr-gl/maplibre-compat`: `setStyle` with a style equal to the current one (apart from the camera) fires
  no `style.load` and no `styledata`, as in MapLibre GL JS 6.17. A style that differs fires `style.load` once. Code
  that waited for the event after setting an equal style must not wait for it ([#801]).
- Both entries: Escape closes a popup that has a close button while the focus is inside it, and the popup stops the
  `keydown` event. A listener for Escape on an ancestor of such a popup no longer gets the event. Give the popup
  `closeButton: false` (in `@map-jr/map-jr-gl`, leave out `onClose`) to keep the old behaviour ([#728]).
- `@map-jr/map-jr-gl/vue`: when the server render of the `ssr` prop fails, the component sends the page without the
  first view, and the map draws in the browser. The render no longer rejects, so an `errorHandler` or
  `onErrorCaptured` of the application does not get the error. Listen to the `error` event of the component
  ([#725]).
- Both entries: the map draws an image of `metadata["map-jr:images"]` only when a layer asks for it. `hasImage` of the
  core map is `false` for an image that no layer of the view names, an image URL is requested only then, and
  `styleimagemissing` is reported again after a new style for a name that is still missing ([#638]).

### New

- `@map-jr/map-jr-gl`: the description has `locale`, an object with the keys of MapLibre GL JS for the texts of the
  controls, the attribution, the popup and the hint of `cooperativeGestures`. The Vue component has the prop
  `locale` ([#746]). An open popup takes the texts of a new locale ([#815]).
- `@map-jr/map-jr-gl`: the development build warns once for each field that the description does not have, such as
  a misspelled `intialView` ([#742]).
- `@map-jr/map-jr-gl/maplibre-compat`: the map draws the images in `metadata["map-jr:images"]` of the style, as the
  main entry does ([#764]).
- `@map-jr/map-jr-gl/maplibre-compat`: `data` and `sourcedata` events carry `e.tile` for each tile that loads
  ([#771]), and `map.style` has `tileManagers` (and `sourceCaches`) with the `vectorLayerIds` of each source ([#803]).
  Maputnik reads both.
- Both entries: a style takes 500 images in `metadata["map-jr:images"]`, up from 200 ([#627]).

### Fixed

- Both entries: a map is idle sooner. The first `idle` does not wait 200 ms after the first camera ([#726]), a map
  with 3D terrain is idle when its tiles are drawn ([#736]), and a map with 3D terrain puts the centre on the ground
  before its first `idle` ([#802]). A style with many images is idle as soon as one with a sprite ([#638]).
- Both entries: with the worker renderer, `idle` comes after the page shows the frame ([#745], [#756]).
- Both entries: a map that falls back from the worker renderer to the main thread warns only with
  `renderer: 'worker'`. With `'auto'` the development build writes the text with `console.info` ([#798]).
- Both entries: a map that fell back to the main thread fires `error` for a failed source once, finishes an `easeTo`
  that had started, and sets `touch-action` on the new canvas ([#806]).
- Both entries: after a lost WebGL context, the map finishes an `easeTo` that was running, for the time that is left
  ([#818]).
- Both entries: in Firefox, a worker no longer fails with "Failed to load worker script at blob:" when the URL was
  revoked before it loaded ([#797]).
- Both entries: a vector feature with no id comes once in query results, not once for each tile ([#755]).
- Both entries: an empty `sprite` is no sprite, so the map does not request the page's URL ([#761]).
- Both entries: the textures of colour ramps are deleted when their layers go ([#749]).
- Both entries: the warnings of expressions keep at most 100 messages ([#737]).
- Both entries: touch screens get buttons of 44px again ([#727]), and a page rule for links does not colour the
  attribution links ([#763]).
- `@map-jr/map-jr-gl/maplibre-compat`: the buttons of `NavigationControl` have a `maplibregl-ctrl-icon` span, so a
  page can restyle the icons ([#769]).
- `@map-jr/map-jr-gl/maplibre-compat`: `showTileBoundaries`, `showPadding`, `showCollisionBoxes` and
  `showOverdrawInspector` warn once when set to `true`, because they have no effect ([#754]).
- `@map-jr/map-jr-gl/maplibre-compat`: `querySourceFeatures` without `await` returns the last answer for the same
  source and options, where it was empty for a vector source ([#816]).
- The package: the subpath entries have types under `"moduleResolution": "node"` ([#740]).

[#627]: https://github.com/map-jr/map-jr-gl/pull/627
[#633]: https://github.com/map-jr/map-jr-gl/pull/633
[#638]: https://github.com/map-jr/map-jr-gl/pull/638
[#725]: https://github.com/map-jr/map-jr-gl/pull/725
[#726]: https://github.com/map-jr/map-jr-gl/pull/726
[#727]: https://github.com/map-jr/map-jr-gl/pull/727
[#728]: https://github.com/map-jr/map-jr-gl/pull/728
[#731]: https://github.com/map-jr/map-jr-gl/pull/731
[#734]: https://github.com/map-jr/map-jr-gl/pull/734
[#736]: https://github.com/map-jr/map-jr-gl/pull/736
[#737]: https://github.com/map-jr/map-jr-gl/pull/737
[#740]: https://github.com/map-jr/map-jr-gl/pull/740
[#741]: https://github.com/map-jr/map-jr-gl/pull/741
[#742]: https://github.com/map-jr/map-jr-gl/pull/742
[#745]: https://github.com/map-jr/map-jr-gl/pull/745
[#746]: https://github.com/map-jr/map-jr-gl/pull/746
[#749]: https://github.com/map-jr/map-jr-gl/pull/749
[#754]: https://github.com/map-jr/map-jr-gl/pull/754
[#755]: https://github.com/map-jr/map-jr-gl/pull/755
[#756]: https://github.com/map-jr/map-jr-gl/pull/756
[#761]: https://github.com/map-jr/map-jr-gl/pull/761
[#763]: https://github.com/map-jr/map-jr-gl/pull/763
[#764]: https://github.com/map-jr/map-jr-gl/pull/764
[#769]: https://github.com/map-jr/map-jr-gl/pull/769
[#771]: https://github.com/map-jr/map-jr-gl/pull/771
[#797]: https://github.com/map-jr/map-jr-gl/pull/797
[#798]: https://github.com/map-jr/map-jr-gl/pull/798
[#801]: https://github.com/map-jr/map-jr-gl/pull/801
[#802]: https://github.com/map-jr/map-jr-gl/pull/802
[#803]: https://github.com/map-jr/map-jr-gl/pull/803
[#806]: https://github.com/map-jr/map-jr-gl/pull/806
[#815]: https://github.com/map-jr/map-jr-gl/pull/815
[#816]: https://github.com/map-jr/map-jr-gl/pull/816
[#818]: https://github.com/map-jr/map-jr-gl/pull/818

## 0.6.0 (2026-11-17)

This entry covers the changes after 0.5.0 (the tag `v0.5.0`).

### Breaking changes

The first group changes the main API (`@map-jr/map-jr-gl`) and its adapters. A name or a field that is removed or
renamed has no alias.

- `@map-jr/map-jr-gl`: the type `MapSpec` is now `MapDescription`, and the type `MapHost` is now `MapInstance`, also in
  `@map-jr/map-jr-gl/react` and `@map-jr/map-jr-gl/svelte`. In `@map-jr/map-jr-gl/vue` and the Nuxt module,
  `useMapHost()` is now `useMapInstance()`, `useMapJr()` returns `{map, state}` in place of `{host, state}`, and the
  template ref and the default slot of `MapJr` have `map` in place of `host`. Write the new names ([#542]).
- `@map-jr/map-jr-gl`: the description has no field `extend`. Write its three parts as the root fields `sources`,
  `layers` and `terrain`. This also applies to the Vue prop `extend`, to `extend` in React and to the option `extend` of
  `renderToSVG`. A description with `extend` gets no warning, and its sources and layers are not added. The type
  `StyleExtension` is no longer exported. `terrain: null` now keeps the terrain of the style, where it removed it
  before: a map that must be flat needs a style without terrain. The warnings for a layer with an unknown `before` or
  source start with `layers:` in place of `extend:` ([#520]).
- `@map-jr/map-jr-gl`: the field `markers` of the description is removed, with the Vue prop `markers`, `markers` in
  React and Svelte, and the option `markers` of `renderToSVG` and `renderToImage`. It has no effect now, and TypeScript
  reports it. Write `data: {[id]: points(records, {lngLat})}` and a symbol layer in `layers` with
  `layout: {'icon-image': image}`. The table "Coming from the field `markers`" in
  [docs/markers.md](docs/markers.md) has the other options. The index of a marker is no longer the id of its feature:
  use `id` of `points()`. In Vue, a change inside the data of a source (a `push` into an array) is not seen: give a new
  object. The types `MarkerLayerOptions` and `MarkerInput` are no longer exported from `@map-jr/map-jr-gl`,
  `@map-jr/map-jr-gl/maplibre-compat` or `@map-jr/map-jr-gl/server` ([#527]).
- `@map-jr/map-jr-gl`: the field `fonts` of the description has the shape of `font-faces` of the style specification.
  Write `fonts: {'<text-font name>': '<url>'}` in place of `fonts: [{family, src, weight, style, unicodeRange}]`. A
  value can also be a list of `{url, 'unicode-range'}`. TypeScript reports the old shape, and at run time the fonts of
  a list do not load. The Vue prop `fonts` takes the same object. `fonts` in `update` now loads the fonts, where it was
  ignored with a warning. The type `FontSource` is no longer exported from `@map-jr/map-jr-gl`, and the type
  `FontFaces` is. `@map-jr/map-jr-gl/maplibre-compat` keeps its option `fonts` and its `FontSource` ([#531]).
- Both entries: `queryFeatures(at, {sources})` and `watchFeatures(at, {sources}, listener)` no longer read the tile
  data of sources. They now find what the style layers draw and ignore `sources`, and the development build warns
  once. Write `querySource(sourceId, at, options)` or `watchSource(sourceId, at, options, listener)`, which take one
  source id. In `@map-jr/map-jr-gl/vue`, write `useMapSource(sourceId, at, options)` in place of
  `useMapFeatures(at, {sources})`. The type `FeatureOptions` has only `layers`, `filter` and `radius`, and
  `queryFeatures` always returns `RenderedFeature[]`. `queryRenderedFeatures` and `querySourceFeatures` of
  `@map-jr/map-jr-gl/maplibre-compat` do not change ([#523]).
- `@map-jr/map-jr-gl`: an event of `listen` and `once`, and of the events of the Vue and React components, gives
  positions as arrays. `lngLat` is `[lng, lat]`, `lngLats` of a touch event is a list of `[lng, lat]`, and
  `boxZoomBounds` is `[[west, south], [east, north]]`. Write `event.lngLat[0]` in place of `event.lngLat.lng`. `target`
  is the `MapInstance` and no longer the core map, so read `event.target.state` in place of a call such as
  `event.target.getZoom()` ([#521]).
- `@map-jr/map-jr-gl`: the member `map` of the object that `createMap` returns is removed, which includes
  `ref.host.map` in Vue and `ref.current.map` in React. Members that start with `_` are private. `custom({onAdd})` is
  the one place where an application gets the core map ([#526]).
- `@map-jr/map-jr-gl`: `clusterLeaves(sourceId, clusterId, {limit, offset})` replaces the positional `limit` and
  `offset`. The defaults stay 10 and 0. A number as the third argument rejects with a message that names the new
  form ([#526]).
- `@map-jr/map-jr-gl`: `moveTo({padding})` no longer sets the padding of the map. Give `padding` in the description
  instead. In `moveTo`, `padding` is now the space for one fit of `bounds`. Without `bounds`, the call ignores
  `padding`, and the development build warns once ([#522]).
- `@map-jr/map-jr-gl`: the description uses the style types of the entry, so TypeScript reports code that compiled
  before. Nothing changes at run time. A style from a JSON import or of the type `object` needs `as
  StyleSpecification`. A layer in a variable needs a layer type (for example `FillLayerSpecification`), and its
  `source` is a string id. A filter in a variable needs the type `FilterSpecification`. A value of `data` is GeoJSON
  or a string. `maxBounds`, `initialView.bounds` and `fitBounds` take the type `Bounds`, which is `[[w, s], [e, n]]` or
  `[w, s, e, n]`, and no longer `LngLat` or `LngLatBounds` objects or `{lng, lat}` corners ([#537]).
- `@map-jr/map-jr-gl`: the controls, the attribution, the scale and the popup have a new look. A group of buttons is a
  pill and a single button is a circle, the backgrounds are translucent with a blur, the compass is a round button of
  its own below the zoom buttons, and the scale sits on the bottom edge beside the attribution on a wide map. The look
  needs Safari 18, Chrome 120 or Firefox 121, and an older browser shows the look of before. The CSS variables
  `--map-control-opacity` and `--map-control-radius` set the opacity and the radius, and the other `--map-control-*`,
  `--map-attribution-background` and `--map-popup-*` variables and the rules of a page still win.
  `@map-jr/map-jr-gl/maplibre-compat` keeps the look of MapLibre GL JS ([#553]).
- `@map-jr/map-jr-gl`: the map sets the global state property `color-scheme` of the style to `'light'` or `'dark'`. A
  style that has a state property `color-scheme` of its own gets the value of the map. Give the value in `globalState`
  of the description to keep your own ([#535]).
- `@map-jr/map-jr-gl`: the state has the new member `pointer`, which changes at each move of the mouse over the map.
  A subscriber without a selector is now called at each such move, and a Vue slot that reads `state` renders at each
  move. Subscribe with a selector ([#516]).

The second group corrects results, most of them so that they agree with MapLibre GL JS.

- Both entries: a rotate drag (the right mouse button, or Ctrl with the left one) turns the map as MapLibre GL JS
  6.17 does. More than 100 pixels above or below the centre of the map, the map turns by the angle that the sideways
  movement of the pointer makes around the centre. Nearer to the centre, it turns by 0.8° for each pixel. Before, the
  map turned by −0.4° for each pixel to the right at every height, so below the centre of the map it now turns the
  other way, and within 100 pixels of the centre it turns twice as fast ([#597]).
- Both entries: a drag on the compass of the navigation control turns the map by −0.4° for each pixel to the right.
  Before, it turned the map by the angle of the pointer around the centre of the button, so the first move turned the
  map by about 85°. The compass and a rotate drag on the map now differ ([#551], [#552]).
- Both entries: a circle layer reads `circle-pitch-scale` and `circle-pitch-alignment`, with the defaults `map` and
  `viewport` of MapLibre GL JS. On a map with pitch, a style that sets neither property now draws the circles away
  from the centre smaller or larger than before. Set `circle-pitch-scale: viewport` to keep the old picture. A map
  without pitch draws the same picture ([#580]).
- Both entries: circle and symbol layers read `circle-translate-anchor`, `icon-translate-anchor` and
  `text-translate-anchor`, whose default is `map`. On a map with a bearing, a translate without an anchor now moves in
  the direction of the map. Set the anchor `viewport` to keep the old result ([#614]).
- Both entries: `text-translate` and `icon-translate` take a legacy zoom function or an expression. Before, such a
  value did not move the label or the icon at any zoom, and now it does. A constant value gives the same result
  ([#625]).
- Both entries: a `{name}` token in `text-field` and `icon-image` is replaced only when the value is a constant or a
  legacy zoom function. A text that an expression or a property function gives keeps its braces, which includes
  `["literal", "{name}"]` and a `step` expression on the zoom. Before, the property took the place of the token in
  every value. MapLibre GL JS does the same as the library does now ([#621]).
- Both entries: three expressions give other results. `typeof` of an array gives `"array<number, 3>"` or a similar
  text in place of `"array"`, and `typeof` of a colour gives `"color"`. `["array", x]` no longer passes an object, and
  it reads a type and a length as the style specification says. `to-rgba` of an array that is not a colour returns the
  numbers as they are, where it multiplied them by 255 ([#582]).
- Both entries: a legacy identity function with a `default` gives the `default` when the value of the feature does not
  have the type of the property. Before, it gave the value of the feature, for example the number `0` for a text
  property ([#592]).
- Both entries: a negative `fill-extrusion-height` or `fill-extrusion-base` is drawn as 0. A style that drew below the
  ground with a negative value now draws from 0 ([#626]).
- Both entries: a `raster-dem` source with `encoding: 'custom'` uses its `redFactor`, `greenFactor`, `blueFactor` and
  `baseShift`. Before, it was read with the encoding `mapbox` ([#629]).
- Both entries: a query returns a GeoJSON feature without an `id` one time when several tiles hold it. This applies
  to `queryFeatures` and `querySource`, and to `queryRenderedFeatures` and `querySourceFeatures` of
  `@map-jr/map-jr-gl/maplibre-compat`. Code that counted the copies gets fewer features. MapLibre GL JS gives a polygon
  once for each tile, and a feature of a vector tile source without an id still comes once for each tile ([#613]).
- Both entries: a protocol of `addProtocol` gets the request of a tile of a `raster` or `raster-dem` source with the
  type `image` and the header `accept: image/webp,*/*`. A protocol that tested `type === 'arrayBuffer'` for these
  tiles must accept `image` ([#622]).
- Both entries: a URL of a custom protocol reaches the protocol as the style writes it, so `cog://https://…` keeps
  the colon of the inner URL. The library no longer makes the host of such a URL lower case and no longer normalises
  its path (`..`, spaces): the protocol function gets what the style has ([#602]).
- Both entries: an image that is a URL (in `images` of the description, in `metadata["map-jr:images"]` of a style, or
  given to `addImage` of `@map-jr/map-jr-gl/maplibre-compat`) is requested through `transformRequest` and the
  protocols, with the kind `Image`. A `transformRequest` function that changes the URL for that kind now changes these
  requests. In the server renderer, an image of `images` now takes the place of an image of the sprite with the same
  name, as in the browser ([#538]).
- Both entries: the map adds its style sheet to the root node of the container. In a browser with
  `adoptedStyleSheets`, the element `<style id="map-jr-control-css">` is no longer in `document.head`, and code that
  looked for that element finds nothing ([#465]).
- `@map-jr/map-jr-gl/maplibre-compat`: `isSourceLoaded(id)` fires `error` and returns `undefined` for an id that the
  style does not have, as in MapLibre GL JS. Before, it threw, so code that wrapped the call in `try` to find a
  missing source must test for `undefined` or listen for `error` ([#617]).
- `@map-jr/map-jr-gl/maplibre-compat`: `getProjection()` returns the projection of the style as it was given, and
  `undefined` for a style without `projection`. Before, it returned `{type: 'mercator'}` in every case. `GlobeControl`
  now adds a button, where it added an empty element ([#471]).
- `@map-jr/map-jr-gl/maplibre-compat`: the type `AddLayerObject` is a union with `CustomLayerInterface`, so TypeScript
  code that reads `.source` from a variable of that type needs a narrowing. A custom layer on a map that was not made
  with `renderer: 'main'` fires `error` (and throws with `strict: true`), where it wrote a warning ([#468]).
- Both entries: when the map is removed, its markers and popups leave the page at once, and a popup ends its closing
  animation. Before, an open popup and a marker stayed in the container. After `Map.remove()` of
  `@map-jr/map-jr-gl/maplibre-compat`, a `close` listener of an open popup now runs, as in MapLibre GL JS, and the
  elements of markers and popups are no longer in the container. `destroy()` of `@map-jr/map-jr-gl` removes the
  elements of `overlay()` in the same way and does not call `onClose` ([#635]).

### New

- Both entries: the globe. A map with the projection `globe` draws on a sphere and turns into Mercator between zoom 11
  and 12, as in MapLibre GL JS, and `vertical-perspective` keeps the sphere at every zoom. Both renderers draw it.
  - `@map-jr/map-jr-gl` has the field `projection` of the description, the control `globe()` in
    `@map-jr/map-jr-gl/controls` and the event `projectiontransition`. `@map-jr/map-jr-gl/maplibre-compat` has
    `setProjection`, `getProjection`, `GlobeControl` and the root property `projection` of a style.
  - Not drawn on the globe yet: 3D terrain, `fill-extrusion` layers, custom layers and the atmosphere of `sky`. Each
    writes one warning, and they show past zoom 12.
  - `maxBounds` has no effect on the globe, as in MapLibre GL JS. `queryRenderedFeatures` is less exact near the
    horizon. The server renderer draws Mercator. The constructor option `projection` of the compat `Map` has no
    effect, as MapLibre GL JS 6.17 does not have it.
  - A drag turns the globe as MapLibre GL JS 6.17 does, and a camera call without a `zoom` keeps the size of the
    globe and changes the zoom. A switch from Mercator to the globe waits until the tiles of the view are built for
    the globe, for 1 s at most.
  - The code of the globe loads with the first style that has a globe. The other differences from MapLibre GL JS are
    in [docs/maplibre-compatibility.md](docs/maplibre-compatibility.md) ([#471], [#473], [#474], [#478], [#493]).
- Both entries: the layer type `color-relief` colours the ground by its elevation, with the new expression
  `["elevation"]`. The colour between two stops is a linear mix. The server renderer does not draw the layer
  ([#589]).
- Both entries: a `hillshade` layer draws every value of `hillshade-method` (`standard`, `basic`, `combined`, `igor`,
  `multidirectional`) and uses `hillshade-illumination-altitude`. Before, it drew `standard` for every method. A layer
  draws at most 8 lights ([#604]).
- `@map-jr/map-jr-gl`: dark mode. The field `colorScheme` of the description is `'light'` (the default), `'dark'` or
  `'auto'`, which follows `prefers-color-scheme`. The controls and the popup have dark colours, and
  `state.colorScheme` has the resolved value. `style` takes a pair `{light, dark}` of style objects or URLs, and one
  style can serve both schemes with `["global-state", "color-scheme"]`. The control `colorScheme()` in
  `@map-jr/map-jr-gl/controls` is a button that changes the scheme and calls the new field `onColorSchemeChange`
  (`v-model:color-scheme` in Vue) ([#529], [#536], [#535], [#553]).
- `@map-jr/map-jr-gl`: new fields of the description. Each is a prop of the Vue component, and React and Svelte pass
  the description through.
  - `globalState` sets the values of the `global-state` expressions of the style ([#515]).
  - `hoverState` (default `false`) gives the top feature of `interactiveLayers` under the pointer the feature state
    `hover: true` ([#530]).
  - `sprite: [{id, url}]` adds sprites to the sprite of the style. An `icon-image` names such an image as `id:name`
    ([#540]).
  - A key of `data` that is not the id of a source makes a GeoJSON source with that id ([#511]).
  - `nonce` sets the nonce of the `<style>` element of the map, for a page with a Content Security Policy. The compat
    `Map` has the same option ([#465]).
- `@map-jr/map-jr-gl`: new members of the object that `createMap` returns.
  - `patch(part)` changes only some fields of the description, and `description` is the description from the last
    `createMap`, `update` or `patch` ([#514]).
  - `once(type)` returns a promise of the next event of that type. `once('load')` on a loaded map resolves at once
    ([#510]).
  - `setFeatureState(target, state)` and `removeFeatureState(target, key?)` take `{source, sourceLayer?, id}`
    ([#512]).
  - `querySource` and `watchSource` read the tile data of one source, with `useMapSource` in
    `@map-jr/map-jr-gl/vue` ([#523]).
  - `moveTo` accepts `bounds` with `padding` and `maxZoom`, and `fitBounds` also takes `bearing`, `pitch` and `fly`
    ([#522]).
  - `state.pointer` has the point and the position of the pointer while the mouse is over the map ([#516]).
- `@map-jr/map-jr-gl`: `points(records, {lngLat, id?, properties?})` makes a GeoJSON `FeatureCollection` with a point
  for each record ([#509]).
- `@map-jr/map-jr-gl`: a style can carry its own images in `metadata["map-jr:images"]`, at most 200 of them. The
  server renderer draws them too, and the compat entry does not read the key ([#538]).
- `@map-jr/map-jr-gl`: the entry exports the types `FlyOptions`, `LngLatInput`, `LngLatBoundsInput`, `LngLatBounds`,
  `Bounds`, `GeoJSON`, `GeoJSONGeometry`, `GeoJSONFeature`, `LayerInput`, `MoveToOptions`, `SourceOptions`,
  `PointerPosition` and `FontFaces` ([#508], [#537], [#522], [#523], [#516], [#531]).
- Both entries: the map adds its style sheet to the shadow root when its container is inside one ([#465]).
- Both entries: a protocol of `addProtocol` can answer the request of a raster tile with an `ImageBitmap`, an
  `HTMLImageElement` or the bytes of an image file ([#622]).
- `@map-jr/map-jr-gl/maplibre-compat`: custom layers work on a map that was made with `renderer: 'main'`, and
  `MercatorCoordinate` is exported. The values of `args` are close to those of MapLibre GL JS and not equal;
  [docs/maplibre-compatibility.md](docs/maplibre-compatibility.md) lists the differences ([#468]).
- `@map-jr/map-jr-gl/maplibre-compat`: the entry exports 38 more type names of MapLibre GL JS 6.17, among them the
  options of the controls and the types of events, gestures and sources. The section "Types" of
  [docs/maplibre-compatibility.md](docs/maplibre-compatibility.md) names the 71 that are still missing ([#578]).
- `@map-jr/map-jr-gl/maplibre-compat`: the `Map` has `listens(type)`, `getStyleUrl()`,
  `fitScreenCoordinates(p0, p1, bearing, options)` and `isRolling()`, which returns `false` ([#598]).
- `@map-jr/map-jr-gl/maplibre-compat`: the object of `getSource(id)` has more members. A GeoJSON source has
  `setClusterOptions`, `getClusterOptions` and `getBounds`. A `vector`, `raster` or `raster-dem` source has `reload()`
  (which MapLibre GL JS does not have) and the `minzoom`, `maxzoom` and `tiles` of its TileJSON. Both have `loaded()`
  and `serialize()` ([#605]).
- `@map-jr/map-jr-gl/maplibre-compat`: `addLayer` takes a layer whose `source` is a source object, and adds that
  source under the id of the layer ([#585]).
- `@map-jr/map-jr-gl/maplibre-compat`: `isActive()` of `dragPan`, `dragRotate`, `touchZoomRotate`, `touchPitch` and
  `boxZoom` is `true` during the gesture. For `scrollZoom`, `doubleClickZoom`, `keyboard` and `cooperativeGestures` it
  still returns `false` ([#617]).

### Fixed

- Both entries: `["coalesce", ["image", "a"], ["image", "b"]]` draws the first image that the map has. Before, it
  gave the first name, so an icon with a fallback was not drawn. A section of `format` with a list in `text-font`
  keeps the whole list for the glyph files ([#619]).
- Both entries: `number-format` uses `unit`, and it gives the plain number with one warning when `Intl.NumberFormat`
  rejects its options, where a tile failed to build before. `feature-state` takes an expression as the name,
  `is-supported-script` gives `true`, and `to-string` of a `format` expression gives the text of the sections
  ([#582], [#587]).
- Both entries: after a new style, a zoom out no longer draws tiles in the colours of the style before ([#554]).
- Both entries: with the worker renderer, an HTML marker or popup follows a one-finger drag in the same frame as the
  map. During `easeTo`, `flyTo`, a fling or a pinch it can still trail by about one frame ([#467]).
- Both entries: with the worker renderer, a fast drag on the compass no longer loses a part of the turn, and the map
  does not step back for a frame ([#552]).
- Both entries: `addImage` with an image that draws itself with WebGL (`renderWithWebGL`) rejects with a message that
  says what to pass instead ([#464]).
- Both entries: a sprite sheet that does not load is an error of the map, and the other sheets are drawn. A new style
  without a sprite no longer draws the icons of the sprite before. The server renderer loads every sheet of a sprite
  list ([#540]).
- Both entries: with the worker renderer, a web font that loads after the first labels is used ([#531]).
- `@map-jr/map-jr-gl/maplibre-compat`: `setGlobalStateProperty` before the first style has loaded keeps its value
  ([#515]).
- `@map-jr/map-jr-gl/maplibre-compat`: `querySourceFeatures` asks a custom protocol for the URL of a GeoJSON source as
  it is written ([#622]).
- Both entries: a style whose `layers` is missing or is not an array fires one `error` event
  with a message that names the fault, and the map takes the next style. Before, the map threw ([#630]).

[#464]: https://github.com/map-jr/map-jr-gl/pull/464
[#465]: https://github.com/map-jr/map-jr-gl/pull/465
[#467]: https://github.com/map-jr/map-jr-gl/pull/467
[#468]: https://github.com/map-jr/map-jr-gl/pull/468
[#471]: https://github.com/map-jr/map-jr-gl/pull/471
[#473]: https://github.com/map-jr/map-jr-gl/pull/473
[#474]: https://github.com/map-jr/map-jr-gl/pull/474
[#478]: https://github.com/map-jr/map-jr-gl/pull/478
[#493]: https://github.com/map-jr/map-jr-gl/pull/493
[#508]: https://github.com/map-jr/map-jr-gl/pull/508
[#509]: https://github.com/map-jr/map-jr-gl/pull/509
[#510]: https://github.com/map-jr/map-jr-gl/pull/510
[#511]: https://github.com/map-jr/map-jr-gl/pull/511
[#512]: https://github.com/map-jr/map-jr-gl/pull/512
[#514]: https://github.com/map-jr/map-jr-gl/pull/514
[#515]: https://github.com/map-jr/map-jr-gl/pull/515
[#516]: https://github.com/map-jr/map-jr-gl/pull/516
[#520]: https://github.com/map-jr/map-jr-gl/pull/520
[#521]: https://github.com/map-jr/map-jr-gl/pull/521
[#522]: https://github.com/map-jr/map-jr-gl/pull/522
[#523]: https://github.com/map-jr/map-jr-gl/pull/523
[#526]: https://github.com/map-jr/map-jr-gl/pull/526
[#527]: https://github.com/map-jr/map-jr-gl/pull/527
[#529]: https://github.com/map-jr/map-jr-gl/pull/529
[#530]: https://github.com/map-jr/map-jr-gl/pull/530
[#531]: https://github.com/map-jr/map-jr-gl/pull/531
[#535]: https://github.com/map-jr/map-jr-gl/pull/535
[#536]: https://github.com/map-jr/map-jr-gl/pull/536
[#537]: https://github.com/map-jr/map-jr-gl/pull/537
[#538]: https://github.com/map-jr/map-jr-gl/pull/538
[#540]: https://github.com/map-jr/map-jr-gl/pull/540
[#542]: https://github.com/map-jr/map-jr-gl/pull/542
[#551]: https://github.com/map-jr/map-jr-gl/pull/551
[#552]: https://github.com/map-jr/map-jr-gl/pull/552
[#553]: https://github.com/map-jr/map-jr-gl/pull/553
[#554]: https://github.com/map-jr/map-jr-gl/pull/554
[#578]: https://github.com/map-jr/map-jr-gl/pull/578
[#580]: https://github.com/map-jr/map-jr-gl/pull/580
[#582]: https://github.com/map-jr/map-jr-gl/pull/582
[#585]: https://github.com/map-jr/map-jr-gl/pull/585
[#587]: https://github.com/map-jr/map-jr-gl/pull/587
[#589]: https://github.com/map-jr/map-jr-gl/pull/589
[#592]: https://github.com/map-jr/map-jr-gl/pull/592
[#597]: https://github.com/map-jr/map-jr-gl/pull/597
[#598]: https://github.com/map-jr/map-jr-gl/pull/598
[#602]: https://github.com/map-jr/map-jr-gl/pull/602
[#604]: https://github.com/map-jr/map-jr-gl/pull/604
[#605]: https://github.com/map-jr/map-jr-gl/pull/605
[#613]: https://github.com/map-jr/map-jr-gl/pull/613
[#614]: https://github.com/map-jr/map-jr-gl/pull/614
[#617]: https://github.com/map-jr/map-jr-gl/pull/617
[#619]: https://github.com/map-jr/map-jr-gl/pull/619
[#621]: https://github.com/map-jr/map-jr-gl/pull/621
[#622]: https://github.com/map-jr/map-jr-gl/pull/622
[#625]: https://github.com/map-jr/map-jr-gl/pull/625
[#626]: https://github.com/map-jr/map-jr-gl/pull/626
[#629]: https://github.com/map-jr/map-jr-gl/pull/629
[#630]: https://github.com/map-jr/map-jr-gl/pull/630
[#635]: https://github.com/map-jr/map-jr-gl/pull/635

## 0.5.0 (2026-11-15)

This entry covers the changes after 0.4.0 (the tag `v0.4.0`).

### Breaking changes

- Both entries: the compass of `NavigationControl` changes and shows the pitch only with `visualizePitch: true`, as in
  MapLibre GL JS. By default, dragging the compass only rotates the map, and a click resets only the bearing. Before,
  the compass always changed and reset the pitch, and `visualizePitch` warned that it had no effect. Pass
  `visualizePitch: true` (in the main API, `navigation({visualizePitch: true})`) to keep the old behaviour ([#452],
  [#456]).
- `@map-jr/map-jr-gl/maplibre-compat`: a `Popup` moves the keyboard focus into itself when it opens, also when a click
  on its marker opens it, because `focusAfterOpen` is true by default as in MapLibre GL JS. Pass
  `focusAfterOpen: false` to keep the focus where it was ([#454]).
- Both entries: a fill, line, circle or other layer that comes after the last symbol layer with labels now draws above
  those labels, as in MapLibre GL JS. Before, every such layer drew below all labels. Move the layer before the symbol
  layer in the style to keep the old look ([#453]).
- Both entries: Shift with the left or right arrow key rotates the map by 15°, and Shift with the up or down arrow key
  changes the pitch by 10°, as in MapLibre GL JS. Before, Shift with an arrow key panned the map ([#443]).

### New

- Both entries: `addImage(name, image, {sdf: true})` adds an image as a signed distance field, which `icon-color` and
  `icon-halo-*` recolour ([#444]).
- Both entries: tile URLs replace `{prefix}` and `{ratio}` as MapLibre GL JS does. `{ratio}` is `@2x` on a screen
  with a pixel ratio above 1, for every kind of source ([#449]).
- `@map-jr/map-jr-gl/maplibre-compat`: `Popup` has the options `closeOnMove`, `trackPointer` (with `trackPointer()`)
  and `subpixelPositioning` (with `setSubpixelPositioning()`). Before, they were accepted and did nothing ([#454]).
- `@map-jr/map-jr-gl/maplibre-compat`: the development build warns once when code reads a member of MapLibre GL JS
  that a class of this library does not have, and names what to use instead. The production build is unchanged
  ([#451]).
- `@map-jr/map-jr-gl/maplibre-compat`: the canvas container has the classes `maplibregl-touch-drag-pan` and
  `maplibregl-touch-zoom-rotate` while those handlers are enabled ([#448]).
- Both entries: the controls have styles for `forced-colors` and `prefers-contrast: more` ([#443]).
- The `/bench` page prints, for the last tile before idle, its network answer, the built tile and its upload ([#440]).

### Fixed

- `@map-jr/map-jr-gl/maplibre-compat`: `setTransformCameraUpdate` no longer warns on every map. It warns once, and only
  when its function changes the camera of a movement, which this library draws only when the movement ends. A
  controlled react-map-gl 8 map is now tested ([#447]).
- `@map-jr/map-jr-gl/maplibre-compat`: the close button of `Popup` and the label of the default `Marker` use the
  map's `locale`, and `FullscreenControl` turns off `cooperativeGestures` while the map fills the screen ([#446]).
- Both entries: before the first `idle`, labels show and hide without a fade, as in MapLibre GL JS, so a map reaches
  `idle` sooner ([#441]).

## 0.4.0 (2026-11-15)

This entry covers the changes after 0.3.0 (the tag `v0.3.0`).

### Breaking changes

- `@map-jr/map-jr-gl/vue` and the Nuxt module: the composable `useMap` is renamed to `useMapJr`, and no alias is
  left. `import {useMap} from '@map-jr/map-jr-gl/vue'` and the auto-imported `useMap()` of Nuxt fail. Write
  `useMapJr` instead. The React hook `useMap` of `@map-jr/map-jr-gl/react` keeps its name ([#405]).
- `@map-jr/map-jr-gl` and `@map-jr/map-jr-gl/maplibre-compat`: the option `glyphs: false` is removed. TypeScript code
  that passes `glyphs` to `createMap`, to `update` or to `new Map()` no longer compiles, and at run time a map with
  `glyphs: false` requests the glyph files of the style. Glyph files now load also when `fonts` is set, so labels use
  the glyph files where the files have the characters. To draw all text with `fonts`, remove `glyphs` from the style
  ([#402]).
- `@map-jr/map-jr-gl/maplibre-compat`: a `ScaleControl` added without a position is at the bottom left, as in MapLibre
  GL JS. Before, it was at the top right. Pass `'top-right'` to `addControl` to keep the old place ([#283]).

### New

- `@map-jr/map-jr-gl`: `transformRequest` in the description (`MapSpec`) changes the URL or the headers of each
  request ([#420]).
- `@map-jr/map-jr-gl`: overlays can be dragged, the Vue component `MapOverlay` supports this, and `defaultPin()` gives
  the default marker element ([#409]).
- Both entries: `toBlob()` exports the map as an image with both renderers ([#374]).
- Both entries: `flyTo` flies along the curve of van Wijk and Nuij, with the options `curve`, `speed` and
  `maxDuration`. In the compat entry, `flyTo` without `duration` takes the time that MapLibre GL JS takes instead of
  1200 ms ([#363]).
- `@map-jr/map-jr-gl/maplibre-compat`: `easeTo` and `flyTo` use `offset` and `easing`. A call with `offset` now ends
  with the center at the offset ([#335]).
- Both entries: `cooperativeGestures` is available in the description, in the Vue component and in the compat `Map`
  ([#362], [#373]).
- `@map-jr/map-jr-gl/maplibre-compat`: `GeolocateControl` with `trackUserLocation` tracks the user location as in
  MapLibre GL JS. Before, the option was accepted and did nothing ([#426]).
- `@map-jr/map-jr-gl/maplibre-compat`: `FullscreenControl` has the pseudo fullscreen, and the map has the option
  `locale` ([#376]).
- Both entries: the compass can be dragged to rotate and pitch the map ([#358]).
- `@map-jr/map-jr-gl/maplibre-compat`: `GPUInitializationError` is exported, and a failed start reports it
  ([#347]).
- `@map-jr/map-jr-gl`: `fitBounds`, `moveTo` and the description take padding per side ([#323]).
- `@map-jr/map-jr-gl`: the state has the bounds of the view in `state.view.bounds`, and `initialView` accepts bounds
  ([#307]).
- `@map-jr/map-jr-gl`: the control `custom()`, the cluster methods on `MapHost` and the style specification types are
  available from the main entry ([#320], [#315], [#318]).
- `@map-jr/map-jr-gl/maplibre-compat`: `on`, `once` and `off` accept an array of layer ids. A listener that is not a
  function now throws ([#278]).
- The map is ready sooner. The first tiles, the sprite and the first glyph file of each font are requested before
  the shaders compile, the worker file is fetched once for all workers, and each chunk loads the chunks that it needs
  in one round. A map at rest places labels at once and shows the labels of new tiles without a fade
  ([#416], [#382], [#375], [#344], [#354], [#340], [#349], [#433]).
- Labels are placed with less work, and a style edit resends no GeoJSON and recompiles only what changed
  ([#348], [#339], [#336], [#331], [#329], [#322], [#327], [#304], [#298]).

### Fixed

Some of these corrections change a result so that it agrees with the documentation or with MapLibre GL JS. Code
that relied on the old result can see a difference, and the item says which.

- `@map-jr/map-jr-gl`: `update()` and `addImage()` set `state.idle` to `false` while the engine has work. Code that
  read `state.idle === true` right after `update()` now sees `false` until the map is drawn ([#414]).
- Tile, style, TileJSON and GeoJSON requests time out after 30 s, and the timer is cleared when a request settles
  ([#413], [#422]).
- A tile whose request failed is requested again after 0.5, 1 and 2 s, and it shows its overview tile at once
  ([#378], [#419]). After the first idle, a pan requests a new overview tile at once ([#366]).
- A tile that leaves the view while it waits for its upload is kept, and a tile dropped while it waits frees its GPU
  tile ([#399], [#401]).
- Elevation tiles are read exactly when the browser adds noise to a canvas, as Safari does in private browsing
  ([#430]). After a pause, a second frame follows the first, because WebKit does not show the first ([#432]).
- A popup that closes no longer catches clicks during its fade, and its element is removed when the closing animation
  never ends ([#437], [#434]).
- `maxBounds` keeps the edges of the view inside the bounds, and bounds across the antimeridian wrap, as in MapLibre
  GL JS. A map with `maxBounds` can stop its center earlier and raise its zoom ([#308], [#333]).
- `@map-jr/map-jr-gl/maplibre-compat`: `LngLatBounds` keeps its corners as given. Bounds given north-east first are no
  longer sorted ([#337]).
- `@map-jr/map-jr-gl/maplibre-compat`: `project()` and the `point` of events are a `Point`. `Marker` takes its
  `offset` as a `PointLike`, and `getOffset()` returns a `Point` ([#350], [#357], [#317]).
- `@map-jr/map-jr-gl/maplibre-compat`: `getImage(name).data` gives RGBA pixels instead of the object that was passed
  to `addImage` ([#317]).
- `@map-jr/map-jr-gl/maplibre-compat`: a click on a marker is a click of the map, and a click on a draggable marker
  fires no drag events ([#345], [#288]).
- A map with `interactive: false` fires mouse events, as in MapLibre GL JS ([#292]).
- `@map-jr/map-jr-gl/maplibre-compat`: controls inherit the font of the map, so text in the container without its own
  font shows `12px/1.3 system-ui`. An interactive map shows the grab cursor ([#352]).
- `@map-jr/map-jr-gl/maplibre-compat`: `querySourceFeatures` reads all features of the tiles under the view, not
  only those in the view ([#281]).
- `getClusterLeaves` follows the `limit` and `offset` rules of supercluster, so `limit: 0` gives every leaf ([#284]).
- GeoJSON sources support `generateId` and `promoteId` in the object form. With `generateId: true`, features get
  index ids, as in MapLibre GL JS ([#291], [#342]).
- `@map-jr/map-jr-gl/maplibre-compat`: vector, raster and raster-dem sources have `setTiles` and `setUrl`. The source
  object is now a copy of the specification ([#296]).
- The attribution credits only sources of visible layers, hides blank credits and folds only on a drag. Its button is
  placed inside the compact control ([#302], [#313]).
- `@map-jr/map-jr-gl/maplibre-compat`: `once('idle')` in a `load` listener waits for the sources that the listener
  added ([#282]).
- `@map-jr/map-jr-gl/maplibre-compat`: the class `maplibregl-map` and the position and overflow of the container are
  set before the map measures it, also for a container attached later ([#286], [#346]).
- `@map-jr/map-jr-gl/maplibre-compat`: `ScaleControl.setUnit()` works, also with the unit `nautical` ([#343]).
- `@map-jr/map-jr-gl/maplibre-compat`: the members and exports that Vue wrappers and apps read are added. `Marker` and
  `FullscreenControl` are subclasses of the classes of the main entry ([#300]).
- `@map-jr/map-jr-gl/maplibre-compat`: the `eventData` of camera methods is on the events of the move ([#297]).
- `@map-jr/map-jr-gl/maplibre-compat`: `addControl` with a value that is not a control fires `error` instead of
  throwing a `TypeError` ([#287]).
- Sizes that depend on zoom and feature are found at the zoom of an overzoomed tile ([#285]).
- A Marker in a container scaled by CSS follows the pointer when it is dragged ([#310]).
- A new engine gets the request rules when it starts, also after the fall back to the main thread ([#356]).
- Options and methods that have no effect warn once. Among them are `fadeDuration`, `pitchWithRotate`,
  `focusAfterOpen`, the `fitBounds` options `speed`, `curve` and `linear`, `addProtocol('pmtiles')`, reading
  `map.painter` and a projection other than mercator. With `strict: true`, two map options throw
  ([#293], [#372], [#316], [#359], [#303]).
- Warnings name the Vite dependency cache and `toBlob()`, and the warning for a container of height 0 names the
  component or action ([#424], [#306]).
- Types: the per-layer style types check the prefix of `paint` and `layout` names. The compat types of `fitBounds`,
  `CameraOptions`, `getStyle`, feature state and `querySourceFeatures` follow MapLibre GL JS, and the compat style
  types accept values typed with `maplibre-gl`. Code with a wrong prefix, or with a `[top, right, bottom, left]`
  tuple as `CameraOptions.padding`, no longer compiles ([#321], [#311], [#418]).
- `@map-jr/map-jr-gl/vue`: the template ref of `MapJr` is typed, and `load` gives the map. A client build does not
  emit the server renderer as a chunk ([#301], [#312]).
- The build option `--sizes` imports the controls from the right file ([#398]).

[#278]: https://github.com/map-jr/map-jr-gl/pull/278
[#281]: https://github.com/map-jr/map-jr-gl/pull/281
[#282]: https://github.com/map-jr/map-jr-gl/pull/282
[#283]: https://github.com/map-jr/map-jr-gl/pull/283
[#284]: https://github.com/map-jr/map-jr-gl/pull/284
[#285]: https://github.com/map-jr/map-jr-gl/pull/285
[#286]: https://github.com/map-jr/map-jr-gl/pull/286
[#287]: https://github.com/map-jr/map-jr-gl/pull/287
[#288]: https://github.com/map-jr/map-jr-gl/pull/288
[#291]: https://github.com/map-jr/map-jr-gl/pull/291
[#292]: https://github.com/map-jr/map-jr-gl/pull/292
[#293]: https://github.com/map-jr/map-jr-gl/pull/293
[#296]: https://github.com/map-jr/map-jr-gl/pull/296
[#297]: https://github.com/map-jr/map-jr-gl/pull/297
[#298]: https://github.com/map-jr/map-jr-gl/pull/298
[#300]: https://github.com/map-jr/map-jr-gl/pull/300
[#301]: https://github.com/map-jr/map-jr-gl/pull/301
[#302]: https://github.com/map-jr/map-jr-gl/pull/302
[#303]: https://github.com/map-jr/map-jr-gl/pull/303
[#304]: https://github.com/map-jr/map-jr-gl/pull/304
[#306]: https://github.com/map-jr/map-jr-gl/pull/306
[#307]: https://github.com/map-jr/map-jr-gl/pull/307
[#308]: https://github.com/map-jr/map-jr-gl/pull/308
[#310]: https://github.com/map-jr/map-jr-gl/pull/310
[#311]: https://github.com/map-jr/map-jr-gl/pull/311
[#312]: https://github.com/map-jr/map-jr-gl/pull/312
[#313]: https://github.com/map-jr/map-jr-gl/pull/313
[#315]: https://github.com/map-jr/map-jr-gl/pull/315
[#316]: https://github.com/map-jr/map-jr-gl/pull/316
[#317]: https://github.com/map-jr/map-jr-gl/pull/317
[#318]: https://github.com/map-jr/map-jr-gl/pull/318
[#320]: https://github.com/map-jr/map-jr-gl/pull/320
[#321]: https://github.com/map-jr/map-jr-gl/pull/321
[#322]: https://github.com/map-jr/map-jr-gl/pull/322
[#323]: https://github.com/map-jr/map-jr-gl/pull/323
[#327]: https://github.com/map-jr/map-jr-gl/pull/327
[#329]: https://github.com/map-jr/map-jr-gl/pull/329
[#331]: https://github.com/map-jr/map-jr-gl/pull/331
[#333]: https://github.com/map-jr/map-jr-gl/pull/333
[#335]: https://github.com/map-jr/map-jr-gl/pull/335
[#336]: https://github.com/map-jr/map-jr-gl/pull/336
[#337]: https://github.com/map-jr/map-jr-gl/pull/337
[#339]: https://github.com/map-jr/map-jr-gl/pull/339
[#340]: https://github.com/map-jr/map-jr-gl/pull/340
[#342]: https://github.com/map-jr/map-jr-gl/pull/342
[#343]: https://github.com/map-jr/map-jr-gl/pull/343
[#344]: https://github.com/map-jr/map-jr-gl/pull/344
[#345]: https://github.com/map-jr/map-jr-gl/pull/345
[#346]: https://github.com/map-jr/map-jr-gl/pull/346
[#347]: https://github.com/map-jr/map-jr-gl/pull/347
[#348]: https://github.com/map-jr/map-jr-gl/pull/348
[#349]: https://github.com/map-jr/map-jr-gl/pull/349
[#350]: https://github.com/map-jr/map-jr-gl/pull/350
[#352]: https://github.com/map-jr/map-jr-gl/pull/352
[#354]: https://github.com/map-jr/map-jr-gl/pull/354
[#356]: https://github.com/map-jr/map-jr-gl/pull/356
[#357]: https://github.com/map-jr/map-jr-gl/pull/357
[#358]: https://github.com/map-jr/map-jr-gl/pull/358
[#359]: https://github.com/map-jr/map-jr-gl/pull/359
[#362]: https://github.com/map-jr/map-jr-gl/pull/362
[#363]: https://github.com/map-jr/map-jr-gl/pull/363
[#366]: https://github.com/map-jr/map-jr-gl/pull/366
[#372]: https://github.com/map-jr/map-jr-gl/pull/372
[#373]: https://github.com/map-jr/map-jr-gl/pull/373
[#374]: https://github.com/map-jr/map-jr-gl/pull/374
[#375]: https://github.com/map-jr/map-jr-gl/pull/375
[#376]: https://github.com/map-jr/map-jr-gl/pull/376
[#378]: https://github.com/map-jr/map-jr-gl/pull/378
[#382]: https://github.com/map-jr/map-jr-gl/pull/382
[#398]: https://github.com/map-jr/map-jr-gl/pull/398
[#399]: https://github.com/map-jr/map-jr-gl/pull/399
[#401]: https://github.com/map-jr/map-jr-gl/pull/401
[#402]: https://github.com/map-jr/map-jr-gl/pull/402
[#405]: https://github.com/map-jr/map-jr-gl/pull/405
[#409]: https://github.com/map-jr/map-jr-gl/pull/409
[#413]: https://github.com/map-jr/map-jr-gl/pull/413
[#414]: https://github.com/map-jr/map-jr-gl/pull/414
[#416]: https://github.com/map-jr/map-jr-gl/pull/416
[#418]: https://github.com/map-jr/map-jr-gl/pull/418
[#419]: https://github.com/map-jr/map-jr-gl/pull/419
[#420]: https://github.com/map-jr/map-jr-gl/pull/420
[#422]: https://github.com/map-jr/map-jr-gl/pull/422
[#424]: https://github.com/map-jr/map-jr-gl/pull/424
[#426]: https://github.com/map-jr/map-jr-gl/pull/426
[#430]: https://github.com/map-jr/map-jr-gl/pull/430
[#432]: https://github.com/map-jr/map-jr-gl/pull/432
[#433]: https://github.com/map-jr/map-jr-gl/pull/433
[#434]: https://github.com/map-jr/map-jr-gl/pull/434
[#437]: https://github.com/map-jr/map-jr-gl/pull/437

## 0.3.0 (2026-11-14)

This entry covers the changes after 0.2.0 (the tag `v0.2.0`).

### Breaking changes

- `@map-jr/map-jr-gl` and `@map-jr/map-jr-gl/maplibre-compat`: an SVG image without a `viewBox` takes its size from
  its `width` and `height` attributes, in CSS pixels. Before, it was always 24×24, so a smaller drawing sat in the
  top-left corner and a larger one was cropped. An SVG with neither a `viewBox` nor `width` and `height` is still
  24×24. The size is read from the root `<svg>` element only. If an image now has another size than you want, give
  it a `viewBox`, or give `width` and `height` in the options of the image ([#176]).
- `@map-jr/map-jr-gl/vue`: `useMap` loads the map with `import()` when the component is mounted, so its `host` is
  still `null` inside the caller's own `onMounted`. Use the event `load` of `MapJr`, or watch `host` ([#179]).
- Both entries: a popup fires `close` when it starts to close, not after its fade of 110 ms. `isOpen()` is `false`
  during the fade. Code that waited for `close` to know that the element is gone must wait for the fade too ([#181]).

### New

- `@map-jr/map-jr-gl/vue`: the static code of `vue.js` is 2.8 KB gzip instead of 32.1 KB. `MapOverlay`, `MapImage`
  and `useMapHost` no longer load the map with the page, so `LazyMapJr` delays the map code as `docs/vue.md` says
  ([#179]).
- Several `setData` calls on one GeoJSON source in the same task send only the last data to the tile workers. Every
  promise still resolves. 50 calls in a loop send 2 messages instead of 100 ([#180]).

### Fixed

- `@map-jr/map-jr-gl/maplibre-compat`: `click`, `dblclick` and `contextmenu` reached the listener only after a query of
  all layers (469 to 857 ms in slow cases). The query now starts at `pointerdown` or `touchstart`, and the event comes
  when the answer is there, at most 300 ms after the pointer is up. `queryRenderedFeatures` in a click listener still
  has the features, also for a touch tap ([#174]).
- A click on the close button of a Vue `MapOverlay` popup sometimes did not close it ([#181]).
- The check of the size budgets measured the wrong engine file in some builds ([#183]).
- The README said that the package is not on npm ([#185]).

[#174]: https://github.com/map-jr/map-jr-gl/pull/174
[#176]: https://github.com/map-jr/map-jr-gl/pull/176
[#179]: https://github.com/map-jr/map-jr-gl/pull/179
[#180]: https://github.com/map-jr/map-jr-gl/pull/180
[#181]: https://github.com/map-jr/map-jr-gl/pull/181
[#183]: https://github.com/map-jr/map-jr-gl/pull/183
[#185]: https://github.com/map-jr/map-jr-gl/pull/185

## 0.2.0 (2026-11-14)

This is the first entry and the first version on npm. It covers the repository from its first commit (2026-11-10) to
the commit 6777dfa, which has the tag `v0.2.0`.

The name of the package is `@map-jr/map-jr-gl`
([issue 17](https://github.com/map-jr/map-jr-gl/issues/17)). Install it with `npm install @map-jr/map-jr-gl`.

### What the library does

- It draws a MapLibre style with WebGL2: fill, line, symbol, circle, heatmap, raster, hillshade, 3D building and
  background layers, from vector, raster, elevation, GeoJSON, image and PMTiles sources.
- It has two entries. `@map-jr/map-jr-gl` is the main API: `createMap` makes a map from one description (`MapSpec`),
  `update` changes it, and queries return promises. `@map-jr/map-jr-gl/maplibre-compat` has the `Map` class of
  MapLibre GL JS. [MapLibre compatibility](docs/maplibre-compatibility.md) lists the differences.
- The map draws in a worker when the browser can do that, and on the main thread when it cannot.
  [Browser support](docs/browser-support.md) says what each renderer needs.
- The field `images` of the description gives images (SVG, a URL or pixels) to the style layers by name (#120).
- A symbol layer draws icons that are always shown (no text, `icon-allow-overlap`) from buffers on the GPU. The cost
  of a frame does not grow with their number, unless labels must keep away from them (#122).
- A query for drawn features finds a feature of a symbol layer where its icon is drawn. Before, it was found within
  10 pixels of its point (#124). In one layer, the feature that is drawn on top comes first.
- The Vue and React components pass each event of the map on (`@moveend`, `onMoveend`, `@styleimagemissing` and the
  others).
- The adapters for Vue and React have the component `MapImage`: an image for the style layers, with the SVG
  written in the template and its parameters as the props of the slot (#128).
- An SVG image with slots (`{{name}}`) is a template. Each feature gives the slots their values, from its
  properties or from `params` of the `image` expression (#125).
- A marker layer draws markers on the canvas. It is shorthand for a GeoJSON source and a symbol layer with an
  image, so a click finds its markers and the layer has a place in the layer order (#125). `Marker` and `Popup` are
  also available as elements of the page.
- 3D terrain, hillshade, contour lines and elevation queries use one elevation source.
- The entry `@map-jr/map-jr-gl/server` renders the first view as SVG or as an image on Node.js 22 and on Cloudflare Workers.
- The adapters are `@map-jr/map-jr-gl/vue`, `@map-jr/map-jr-gl/nuxt`, `@map-jr/map-jr-gl/react` and `@map-jr/map-jr-gl/svelte`.
- The package has type declarations for each entry and a source map beside each built file ([#85], [#87], [#98]).
- The package has a development build of each entry beside the production build. In the development build, the main
  API writes one warning for each common mistake in a description or in a query, for example a container with the
  height 0 or an id in `interactiveLayers` that the style does not have. `package.json` names the development
  build under the `development` export condition, so a bundler that sets this condition uses it in development.
  The production build does not contain the checks ([#90], [#106]).
- `supported()` of both entries says whether the browser can show a map ([#116]).
- The page file and the worker file each contain the version of the package. The page writes one warning when the
  two versions differ, which can happen behind a CDN or a cache ([#116]).
- The [status table](README.md#status) of the README has the test results and the sizes of the built files.

### Behaviour that changed during 0.2.0

These changes matter if you used a build of the repository from before 2026-11-12.

- Text uses the glyph files of the style, as MapLibre GL JS does. `glyphs: false` uses the fonts of the browser
  instead.
- The main API has one `queryFeatures` for all queries, and `watchFeatures` keeps an answer up to date.
- `queryFeatures` has the same meaning in both entries ([#117]). With `sources`, it reads the tile data of those
  sources. Without `sources`, it returns the features that the style layers draw, and it does not read other data.
  Before, `map.queryFeatures` of `@map-jr/map-jr-gl/maplibre-compat` always read the tile data: add `sources` to
  such a call.
- `radius` of `queryFeatures` is the distance around the place in pixels of the screen, in both kinds of query.
  Without `sources`, the default is 0. With `sources`, the default is 3 ([#117]).
- The methods `queryLayers` and `querySources` of the map are gone. Use `queryFeatures` without `sources` in
  place of `queryLayers`, and `queryFeatures` with `sources` in place of `querySources` ([#117]).
- In TypeScript, a call of `queryFeatures` that writes `sources` gives `QueriedFeature[]`, and a call without
  `sources` gives `RenderedFeature[]` ([#117]).
- In the main API, `queryFeatures` with a place of the form `{lng, lat}` and without `sources` is rejected with a
  message that names the accepted forms ([#90]).
- `createMap()` and `update()` throw when the description has no `style` ([#57]).
- A style or a source that fails fires `error`, and the map continues with the other sources ([#63]). The main API
  reports each error to `onError`, or to the console when the description has no `onError` ([#65]).
- `idle` fires after changed data is drawn. Directly after `setData`, the source is not loaded ([#62]).
- When two styles are requested in quick succession, the map uses the later one, also when the earlier one answers
  later ([#61]). The same is true for two `setData` calls with URLs ([#81]).
- A query is rejected when the map is removed or loses its WebGL context. When a listener throws, the map fires
  `error`, and the listeners after it get the event ([#109]).
- A map with the worker renderer goes to the main thread and writes one warning when the worker loses its WebGL
  context before its first frame, loses it twice within 10 seconds, or does not draw in the 5 seconds after its first
  start ([issue 119](https://github.com/map-jr/map-jr-gl/issues/119)) or after the map has started it again. Before, the map started a worker again without end and did not load. When the main thread
  fails in the same way after a restart, the map fires `error`
  ([issue 78](https://github.com/map-jr/map-jr-gl/issues/78), [#110]).
- A map that cannot start, for example without WebGL2, fires one `error` that says what to do, and it shows a
  message in the container (an element with the class `map-jr-unavailable`). Before, the container stayed empty
  ([#116]).
- `getVersion()` of `@map-jr/map-jr-gl/maplibre-compat` returns the version of the package ([#116]).
- The `queryFeatures` example of the gallery gives an answer for each click, and its forms for the main API pass
  `sources` ([#115]).
- A camera animation that is not `essential` does not run when the system asks for less motion
  (`prefers-reduced-motion: reduce`). The container of the map has a role and shows the keyboard focus ([#71]).
- In `@map-jr/map-jr-gl/maplibre-compat`, an option that has no effect writes one warning, and a style call that the library
  refuses fires `error` ([#70]). `setMaxBounds` moves the centre into the bounds at once ([#93]).
- The server renderer has time limits, a size limit and a list of allowed hosts for its requests ([#96]).
- Two ways for HTML from data to reach the page are closed: the colour of a marker, and the attribution of the
  first view from a server.

### What is known not to work

- **Without WebGL2** no map can be shown. `supported()` of both entries says so before a map is made. A map that is
  made anyway fires one `error` and shows a message in the container.
- **Not available:** globe and other projections, sky, fog, custom layers, color relief, video and canvas sources,
  MapLibre Tiles (MLT), and the properties in
  [What is not available](docs/maplibre-compatibility.md#what-is-not-available).
- **`queryRenderedFeatures` and `querySourceFeatures`** give the complete result as a promise, because the tile
  data is in a worker. Code from MapLibre GL JS needs `await`.
- **Plugins** that read `map.style` or `map.painter` do not work.
- **The server renderer** does not draw heatmap and hillshade layers.
- **Terrain, hillshade and contour lines** need `OffscreenCanvas` in a worker. No automatic run covers a browser
  without it, a real iPhone or Android. See [Browser support](docs/browser-support.md).
- **Safari 27.2 on a hosted macOS runner** cannot use the worker renderer: a worker draws one frame and then
  stops, and its WebGL context is lost. Since [#110] the map goes to the main thread there and loads (seen in one
  run of the Safari job). The cause is not known. A worker that stops with no lost context at the first start is
  not detected. The same Safari draws in a worker on a Mac with a GPU.
- The package contains ES modules only. `require('@map-jr/map-jr-gl')` does not work.
- The [open issues](https://github.com/map-jr/map-jr-gl/issues) list the other known faults by priority.

[#57]: https://github.com/map-jr/map-jr-gl/pull/57
[#61]: https://github.com/map-jr/map-jr-gl/pull/61
[#62]: https://github.com/map-jr/map-jr-gl/pull/62
[#63]: https://github.com/map-jr/map-jr-gl/pull/63
[#65]: https://github.com/map-jr/map-jr-gl/pull/65
[#70]: https://github.com/map-jr/map-jr-gl/pull/70
[#71]: https://github.com/map-jr/map-jr-gl/pull/71
[#81]: https://github.com/map-jr/map-jr-gl/pull/81
[#85]: https://github.com/map-jr/map-jr-gl/pull/85
[#87]: https://github.com/map-jr/map-jr-gl/pull/87
[#90]: https://github.com/map-jr/map-jr-gl/pull/90
[#93]: https://github.com/map-jr/map-jr-gl/pull/93
[#96]: https://github.com/map-jr/map-jr-gl/pull/96
[#98]: https://github.com/map-jr/map-jr-gl/pull/98
[#106]: https://github.com/map-jr/map-jr-gl/pull/106
[#109]: https://github.com/map-jr/map-jr-gl/pull/109
[#110]: https://github.com/map-jr/map-jr-gl/pull/110
[#115]: https://github.com/map-jr/map-jr-gl/pull/115
[#116]: https://github.com/map-jr/map-jr-gl/pull/116
[#117]: https://github.com/map-jr/map-jr-gl/pull/117
[#440]: https://github.com/map-jr/map-jr-gl/pull/440
[#441]: https://github.com/map-jr/map-jr-gl/pull/441
[#443]: https://github.com/map-jr/map-jr-gl/pull/443
[#444]: https://github.com/map-jr/map-jr-gl/pull/444
[#446]: https://github.com/map-jr/map-jr-gl/pull/446
[#447]: https://github.com/map-jr/map-jr-gl/pull/447
[#448]: https://github.com/map-jr/map-jr-gl/pull/448
[#449]: https://github.com/map-jr/map-jr-gl/pull/449
[#451]: https://github.com/map-jr/map-jr-gl/pull/451
[#452]: https://github.com/map-jr/map-jr-gl/pull/452
[#453]: https://github.com/map-jr/map-jr-gl/pull/453
[#454]: https://github.com/map-jr/map-jr-gl/pull/454
[#456]: https://github.com/map-jr/map-jr-gl/pull/456
