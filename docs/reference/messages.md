# Messages

Each error and warning of the library starts with `[map-jr-gl]` and a code, such as `E1846`. This page gives the text
of each code. A placeholder such as `<source name>` stands for a value that the message fills in. The package has the
same texts in `dist/messages.json` (each code with its kind and its texts), so that a log can be read without network.

The development build prints the code and the text. The production build prints the code, the address
`https://map-jr.org/e/<number>` and the values of the placeholders in their order, each with its name, for example
`[map-jr-gl] E1163 https://map-jr.org/e/1163 what="tile" url="https://example.com/1/2/3.pbf" reason="HTTP 404"`. A string
prints in quotes, and a number without. The section of each code gives the names. The worker prints the same short form
in both builds. The server renderer (`@map-jr/map-jr-gl/server`) and the standalone files print the full
text.

Each section starts with tags for the kind of the message (`Error` or `Warning`), for its entry, and for `Development build only` where the message exists only in the development build. Where the two builds print different text, the section shows the text of each build under a label, `Production build` or `Development build`.

An error of the library that has a code in its message also carries the code in its field `code`, such as
`error.code === 'E63'`. The field is set when the error is thrown, when a promise rejects with it, and in the
`event.error` of an `error` event.

The field is set in both builds and in both entries (`@map-jr/map-jr-gl` and
`@map-jr/map-jr-gl/maplibre-compat`), and `name` stays `Error`. An error with no code, such as one from the browser,
has no `code`. Test the field and not the text, because the text differs between the builds.

A code stays the same in later versions. When a message is removed, its section stays here with the version after which
it was removed, and the code is not used again.

<!-- messages:start -->
## E0

`Warning` `Main API` `Development build only`

```text
<call>: the container has height 0, so the map shows nothing. Give the container a height in CSS.
```

## E1

`Warning` `Main API` `Development build only`

```text
interactiveLayers: the style has no layer "<layer id>". Write the id of a layer of the style or of "layers".
```

## E2

`Warning` `Main API` `Development build only`

```text
the layer "<layer id>" uses the source "<source id>", which the map does not have. A key of "data" makes a source only while it is in "data": keep "<source id>" in "data", or remove the layer.
```

## E3

`Warning` `Main API` `Development build only`

```text
queryFeatures(): the style has no layer "<layer id>". In "layers" of the query, write the id of a layer of the style or of "layers" of the description.
```

## E4

`Warning` `Main API` `Development build only`

```text
querySource(): the style has no source "<source id>". Write the id of a source of the style or of "sources".
```

## E5

`Warning` `Main API` `Development build only`

```text
layers: the layer "<layer id>" has before: "<before id>", but the style has no layer "<before id>", so the layer goes on top. Write the id of a layer of the style.
```

## E6

`Warning` `Main API` `Development build only`

```text
layers: the layer "<layer id>" uses the source "<source id>", which the style does not have. Add "<source id>" to "sources", or give its GeoJSON as "<source id>" in "data".
```

## E8

`Warning` `Main API` `Development build only`

```text
update(): "<option>" changed, but it is read only when the map is made. To move the map, change "view" or call moveTo().
```

```text
update(): "<option>" changed, but it is read only when the map is made. To change it, destroy the map and make a new one.
```

## E9

`Error` `Main API`

`Production build`

```text
[map-jr-gl] E9 https://map-jr.org/e/9
```

`Development build`

```text
queryFeatures(): the place is not {x, y} or [lng, lat].
```

```text
queryFeatures(): <place> is not a place. Write a point of the screen {x, y}, a position [lng, lat], or a rectangle [{x, y}, {x, y}].
```

## E10

`Error` `Main API`

The first argument of `querySource()` is the id of a source of the style, as a string. The call does not throw: the returned promise rejects with this error, so a call without `await` or `.catch()` shows it as an unhandled rejection.

`Production build`

```text
[map-jr-gl] E10 https://map-jr.org/e/10
```

`Development build`

```text
querySource(): the first argument is not the id of a source.
```

```text
querySource(): <first argument> is not the id of a source. Write querySource("id", at, options) with the id of a source of the style.
```

## E11

`Warning` `Main API` `Development build only`

```text
querySource(): "<option>" has an effect only in a query at a point or a position. This query ignores it.
```

## E12

`Warning` `Main API` `Development build only`

```text
querySource(): "<option>" is not an option of querySource, which reads the tile data of one source. To find what the style layers draw, call queryFeatures(at, {layers}).
```

```text
queryFeatures(): "<option>" is not an option of queryFeatures, which finds what the style layers draw. To read the tile data of a source, call querySource(sourceId, at, options).
```

## E13

`Warning` `Main API` `Development build only`

```text
<method>(): "radius" has an effect only in a query at a point or a position. This query ignores it.
```

## E14

`Warning` `Main API` `Development build only`

```text
images: a layer gives the parameter "<parameter>" to the image "<image id>", but that image has no slot {{<parameter>}}, so the parameter has no effect. Write {{<parameter>}} in the SVG of "<image id>" in "images", or remove the parameter.
```

## E20

`Warning` `Main API` `Development build only`

```text
The description has "glyphs". That field was removed and has no effect: the map loads the glyph files of the style. Remove "glyphs" from the description. To draw text with the fonts of the browser, remove "glyphs" from the style.
```

## E21

`Warning` `Main API` `Development build only`

```text
points(): the record <record> has no position of two finite numbers, so it is left out. Make "lngLat" return [lng, lat] for each record.
```

## E22

`Warning` `Main API` `Development build only`

```text
globalState: the value of "<key>" is not JSON (a function, a class instance, NaN or a cycle), so the style cannot read it as it is. Give a string, a number, a boolean, an array or a plain object.
```

## E23

`Warning` `Main API` `Development build only`

```text
moveTo(): "fitPadding" and "fitMaxZoom" have an effect only with "bounds", so this call ignores them. To set the padding of the map, give "padding" in the description.
```

## E24

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E24 https://map-jr.org/e/24 url=…
```

`Development build`

```text
the request to <to> was aborted.
```

## E25

`Error` `Server renderer`

```text
server render: "<option name>" is <option value>. Pass a number that is 0 (no limit) or more.
```

## E30

`Warning` `Main API` `Development build only`

```text
hoverState: a feature of the layer "<layer id>" has no id, so it gets no feature state "hover". Give the features ids, or set "promoteId" of the source to a property that has one, or "generateId: true" for the source.
```

```text
hoverState: a feature of the layer "<layer id>" has no id, so it gets no feature state "hover". Write a numeric id for each feature into the tiles when you build them, or set "promoteId" of the source to a property that has one.
```

## E40

`Warning` `Main API` `Development build only`

```text
colorScheme: <scheme> is not a color scheme, so the map uses the light colors. Write 'auto', 'light' or 'dark'.
```

## E42

`Warning` `Compat entry`

`Production build`

```text
[map-jr-gl] E42 https://map-jr.org/e/42
```

`Development build`

```text
Map: the option locale is not an object. Pass an object such as {"NavigationControl.ZoomIn": "Zoom avant"}.
```

## E44

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E44 https://map-jr.org/e/44 mime=… err=…
```

`Development build`

```text
toBlob(): the browser could not encode the image as <mime>. <err>
```

## E45

`Warning` `Main API` `Development build only`

```text
style: the object is not a style, because it has no "version" and "layers", and it is not a pair {light, dark}. Give a style object, the URL of a style, or {light: style, dark: style}.
```

## E46

`Warning` `Main API` `Development build only`

```text
style: the pair has no "<missing>", so the map uses "<used>" in both color schemes. Give both "light" and "dark".
```

## E52

`Warning` `Compat entry`

`Production build`

```text
[map-jr-gl] E52 https://map-jr.org/e/52
```

`Development build`

```text
Map: the option glyphs was removed and has no effect; the map loads the glyph files of the style. Remove the option. To draw text with the fonts of the browser, remove "glyphs" from the style.
```

## E55

`Warning` `Main API` `Development build only`

```text
sprite: <sprite> is not a list of sprites. Write a list of {id, url}, for example [{id: 'pins', url: 'https://example.com/sprites/pins'}], and name an image of it in "icon-image" as "pins:name".
```

## E57

`Error` `Main API`

`Production build`

```text
[map-jr-gl] E57 https://map-jr.org/e/57 method=…
```

`Development build`

```text
<method>(): the description has no "style". <fix>
```

```text
createMap(): the description has no "style". Pass the URL of a style or a style object as "style".
```

```text
update(): the description has no "style". update() takes the complete description, not only the changed fields. Write map.patch({<field>: …}) to change only some fields.
```

```text
patch(): the description has no "style". Do not set "style" to undefined.
```

## E63

`Error` `Both entries`

The map reads the style from the URL that the option `style` (or `setStyle()`) gives, and the server answered with a status that is not 2xx. The error has the fields `status` and `url`. A request that gets no answer at all (for example a timeout, which is E415) has another code.

`Production build`

```text
[map-jr-gl] E63 https://map-jr.org/e/63 style=… status=…
```

`Development build`

```text
Style <style>: HTTP <status>
```

## E65

`Error` `Main API`

`Production build`

```text
[map-jr-gl] E65 https://map-jr.org/e/65 container=…
```

`Development build`

```text
createMap(): the container is <container>. In a framework, make the map after the element is mounted.
```

## E70

`Error` `Compat entry`

`Production build`

```text
[map-jr-gl] E70 https://map-jr.org/e/70 id=…
```

`Development build`

```text
addLayer: the style has a layer with the id "<id>" already. Remove that layer first, or use another id.
```

## E90

`Error` `Compat entry`

`Production build`

```text
[map-jr-gl] E90 https://map-jr.org/e/90 key=…
```

`Development build`

```text
<key> has no effect.
```

## E97

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E97 https://map-jr.org/e/97
```

`Development build`

```text
The container already has a map. Remove that map first: remove(), or destroy() in the main API.
```

## E110

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E110 https://map-jr.org/e/110
```

`Development build`

```text
The WebGL context was lost again. Call remove() and create the map again later.
```

## E121

`Error` `Compat entry`

`Production build`

```text
[map-jr-gl] E121 https://map-jr.org/e/121 image=…
```

`Development build`

```text
the style: the image "<image name>" did not load. Give an SVG document or the URL of an image that the page can read.
```

## E129

`Warning` `React component`

`Production build`

```text
[map-jr-gl] E129 https://map-jr.org/e/129 image=…
```

`Development build`

```text
MapImage "<image name>" is not inside MapJr, so no map gets the image. Put it into the children of MapJr.
```

## E160

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E160 https://map-jr.org/e/160 control=…
```

`Development build`

```text
The control "<control name>" could not be loaded. Check that the files of the library are served.
```

## E205

`Warning` `Compat entry`

`Production build`

```text
[map-jr-gl] E205 https://map-jr.org/e/205
```

`Development build`

```text
map.painter does not exist in @map-jr/map-jr-gl/maplibre-compat. To check for WebGL, use supported(); a failed start fires "error" with a GPUInitializationError.
```

## E206

`Warning` `Compat entry` `Development build only`

```text
<member> is private state of MapLibre GL JS and does not exist in @map-jr/map-jr-gl/maplibre-compat. <advice>
```

## E208

`Warning` `Compat entry`

`Production build`

```text
[map-jr-gl] E208 https://map-jr.org/e/208 method=…
```

`Development build`

```text
<method>(): the feature has no "id". Give the source features an id, or set "promoteId" on the source.
```

## E210

`Warning` `Compat entry`

`Production build`

```text
[map-jr-gl] E210 https://map-jr.org/e/210
```

`Development build`

```text
setTransformCameraUpdate: the function changed the camera of a movement. This library draws that camera only when the movement ends (react-map-gl: onMove did not set viewState to e.viewState). To keep the map in a region, use the option maxBounds.
```

## E214

`Warning` `Main API` `Development build only`

```text
<call>: a marker takes "offset" as a pair, [x, y], so a number or an object with a pair for each anchor has no effect. Write a pair, or add "popup: true".
```

## E216

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E216 https://map-jr.org/e/216
```

`Development build`

```text
custom(): write custom({key: "my-control", element}) or custom({key: "my-control", onAdd(map) { return element; }, onRemove() {}}).
```

## E217

`Error` `Main API`

`Production build`

```text
[map-jr-gl] <method>(): E217 https://map-jr.org/e/217 id=…
```

`Development build`

```text
<method>(): "<id>" is not a GeoJSON source of the style.
```

## E238

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E238 https://map-jr.org/e/238 projection=…
```

`Development build`

```text
The style has the projection <t>, which is not supported, so the map uses "mercator".
```

## E241

`Warning` `Compat entry`

`Production build`

```text
[map-jr-gl] E241 https://map-jr.org/e/241
```

`Development build`

```text
setWorkerUrl(): this is the worker file of MapLibre GL JS, which this library cannot use. Remove the call; the library finds map-jr-gl-worker.js itself.
```

## E242

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E242 https://map-jr.org/e/242 message=…
```

`Development build`

```text
The map could not copy data to its workers (<message>). Pass plain objects (toRaw() in Vue).
```

## E255

`Error` `Compat entry`

`Production build`

```text
[map-jr-gl] E255 https://map-jr.org/e/255 id=…
```

`Development build`

```text
getSource("<id>").setUrl(url): "url" must be a string.
```

## E259

`Error` `Compat entry`

`Production build`

```text
[map-jr-gl] E259 https://map-jr.org/e/259
```

`Development build`

```text
addControl(): the argument is not a control. Pass an object with onAdd and onRemove methods.
```

## E269

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E269 https://map-jr.org/e/269 pos=…
```

`Development build`

```text
addControl(): "<pos>" is not a position. Write "top-left", "top-right", "bottom-left" or "bottom-right".
```

## E277

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E277 https://map-jr.org/e/277 url=… megabytes=…
```

`Development build`

```text
PMTiles <url>: the server ignores Range requests, so each tile would download the whole file (<file size> MB). Serve the file from a server that supports Range requests.
```

## E278

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E278 https://map-jr.org/e/278 type=…
```

`Development build`

```text
on("<type>"): the listener after the layer id is not a function.
```

## E294

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E294 https://map-jr.org/e/294 source=… id=…
```

`Development build`

```text
setFeatureState(): the source "<source>" is not GeoJSON, and the id "<id>" is a string. Feature state on a vector source needs the numeric id of the feature in the tile, or "promoteId" on the source.
```

## E316

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E316 https://map-jr.org/e/316
```

`Development build`

```text
addProtocol("pmtiles"): the library reads pmtiles:// URLs itself and does not use this protocol. Remove the addProtocol call.
```

## E387

`Warning` `Compat entry`

`Production build`

```text
[map-jr-gl] E387 https://map-jr.org/e/387
```

`Development build`

```text
new Map(): canvasContextAttributes.preserveDrawingBuffer has no effect. Read the canvas with map.toBlob(), and remove the option.
```

## E415

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E415 https://map-jr.org/e/415 input=… ms=…
```

`Development build`

```text
the request to <input> did not finish within <ms> ms.
```

## E463

`Warning` `Compat entry`

`Production build`

```text
[map-jr-gl] E463 https://map-jr.org/e/463
```

`Development build`

```text
new Map(): the option projection has no effect, as in MapLibre GL JS 6.17. Put "projection": {"type": "globe"} into the style, or call map.setProjection({type: "globe"}) after the style has loaded.
```

## E464

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E464 https://map-jr.org/e/464 image=…
```

`Development build`

```text
addImage("<image name>"): images that draw themselves with WebGL (renderWithWebGL) are not supported. Pass pixels, a canvas, an image or SVG text.
```

## E469

`Error` `Compat entry`

`Production build`

```text
[map-jr-gl] E469 https://map-jr.org/e/469 id=…
```

`Development build`

```text
addLayer: the layer "<id>" has a source object, and the style has a source with the id "<id>" already. Remove that source first, or pass source: "<id>".
```

## E484

`Error` `Main API`

`Production build`

```text
[map-jr-gl] E484 https://map-jr.org/e/484 type=…
```

`Development build`

```text
once("<type>"): the map was removed.
```

## E487

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E487 https://map-jr.org/e/487 id=… type=…
```

`Development build`

```text
data: the source "<id>" has the type "<type>", and only a GeoJSON source takes data. Use another key in "data", or another id for the source.
```

## E494

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E494 https://map-jr.org/e/494 font=… url=… reason=…
```

`Development build`

```text
fonts: the font "<font>" did not load from <src> (<m>). The labels use the next font of their "text-font".
```

## E495

`Error` `Main API`

`Production build`

```text
[map-jr-gl] E495 https://map-jr.org/e/495
```

`Development build`

```text
the style: the code for the images in metadata["map-jr:images"] did not load, and the map draws the style without them. Check that the files of the library are served next to it.
```

## E503

`Error` `Main API`

`Production build`

```text
[map-jr-gl] <method>(): E503 https://map-jr.org/e/503 options=…
```

`Development build`

```text
<method>(): the third argument is <options>. Pass {limit, offset}, for example clusterLeaves(sourceId, clusterId, {limit: 50, offset: 100}).
```

## E524

`Warning` `Main API` `Development build only`

```text
the description has no field "<field>", so the map ignores it. Check the spelling against MapDescription in docs/reference/description.md, or remove "<field>".
```

## E539

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E539 https://map-jr.org/e/539
```

`Development build`

```text
The style has no list "layers". Give a style object with "version", "sources" and "layers", or its URL.
```

## E541

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E541 https://map-jr.org/e/541
```

`Development build`

```text
colorScheme(): the control works only in the controls of a map of the main API (createMap).
```

## E566

`Error` `Compat entry`

`Production build`

```text
[map-jr-gl] E566 https://map-jr.org/e/566 id=…
```

`Development build`

```text
getSource("<id>").setClusterOptions(options): "options" must be an object with cluster, clusterMaxZoom or clusterRadius.
```

## E569

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E569 https://map-jr.org/e/569 method=…
```

`Development build`

```text
hillshade-method: <hillshade method> is not a method, and the layer uses "standard". Write "standard", "basic", "combined", "igor" or "multidirectional".
```

## E583

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E583 https://map-jr.org/e/583 options=… message=…
```

`Development build`

```text
number-format: Intl.NumberFormat does not accept the options <options> (<message>). The expression gives the number as plain text. Pass a BCP 47 locale, an ISO 4217 currency and a unit that Intl.NumberFormat supports.
```

## E590

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E590 https://map-jr.org/e/590 source=…
```

`Development build`

```text
The source "<source name>": "redFactor", "greenFactor", "blueFactor" and "baseShift" of the encoding "custom" must be finite numbers. The source is read with the encoding "mapbox". Write a number for each one, or leave it out for its default (1, 1, 1 and 0).
```

## E645

`Warning` `Main API` `Development build only`

```text
<layer>: "color-relief-color" is not an "interpolate" expression, so the layer draws nothing, as in MapLibre GL JS. Write ["interpolate", ["linear"], ["elevation"], elevation, color, ...].
```

```text
<layer>: "color-relief-color" is missing, so the layer draws nothing, as in MapLibre GL JS. Write ["interpolate", ["linear"], ["elevation"], elevation, color, ...].
```

## E648

`Warning` `Main API` `Development build only`

```text
<where>: "<property>" has no effect, because this library does not read it, while MapLibre GL JS does. Remove the property, or see docs/reference/maplibre-differences.md.
```

## E654

`Error` `Server renderer`

```text
The style has no list "layers". Give a style object with "version", "sources" and "layers", or its URL.
```

## E685

`Warning` `Main API` `Development build only`

```text
locale: <problem>. Pass an object of strings by the keys of MapLibre GL JS, such as {"NavigationControl.ZoomIn": "Zoom avant"}.
```

## E706

`Error` `Vue component`

`Production build`

```text
[map-jr-gl] E706 https://map-jr.org/e/706 message=…
```

`Development build`

```text
<MapJr>: the server render failed, and the page has no first view. The map draws in the browser. The cause: <cause>
```

## E764

`Error` `Compat entry`

`Production build`

```text
[map-jr-gl] E764 https://map-jr.org/e/764
```

`Development build`

```text
the style: the code for metadata["map-jr:images"] did not load, so the map has no images of the style. Serve the files of the library together.
```

## E798

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E798 https://map-jr.org/e/798 why=…
```

`Development build`

```text
Worker rendering unavailable, using the main thread: <why>
```

## E826

`Warning` `Main API` `Development build only`

```text
<map-jr>: the attribute <attribute> cannot be read, so the element ignores it. Write a number, for example zoom="11".
```

```text
<map-jr>: the attribute <attribute> cannot be read, so the element ignores it. Write the longitude and the latitude with a comma between them, for example center="13.4,52.52".
```

```text
<map-jr>: the attribute <attribute> cannot be read, so the element ignores it. Write "globe" or "mercator".
```

## E893

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E893 https://map-jr.org/e/893 pitch=… maxPitch=…
```

`Development build`

```text
maxPitch <p>: the pitch stops at <MAX_PITCH>. Pass <MAX_PITCH> or less.
```

## E897

`Warning` `Compat entry`

`Production build`

```text
[map-jr-gl] E897 https://map-jr.org/e/897
```

`Development build`

```text
setCenterElevation(): the map center is clamped to the ground, which replaces the height in the next frame, as in MapLibre GL JS. Call setCenterClampedToGround(false) first.
```

## E985

`Error` `Server renderer`

```text
tileZoomOffset: <dz> is not a whole number. Write for example tileZoomOffset: 2 (tiles 2 zooms lower) or -1 (tiles 1 zoom higher), or leave it out for 0.
```

## E1020

`Warning` `Compat entry`

`Production build`

```text
[map-jr-gl] E1020 https://map-jr.org/e/1020
```

`Development build`

```text
setTransformConstrain has no effect: the function needs the map to draw on the main thread. Pass renderer: 'main' to new Map().
```

## E1021

`Error` `Compat entry`

`Production build`

```text
[map-jr-gl] E1021 https://map-jr.org/e/1021 sourceId=…
```

`Development build`

```text
setSourceTileLodParams: there is no source "<sourceId>". Add the source first, or leave out the ID for all sources.
```

## E1057

`Error` `Main API` `Development build only`

```text
<where>: <reason> The map draws it, but MapLibre GL JS rejects the style. Write ["zoom"] only as the input of one ["step", ["zoom"], ...] or ["interpolate", ..., ["zoom"], ...] at the top of the expression (or as the result of a top-level "let", or as one argument of a top-level "coalesce"), and put the other parts in its outputs.
```

## E1139

`Warning` `Main API` `Development build only`

```text
<where>: a layer of this type has no such property in the style specification, so the map ignores it. Write "<near>".
```

```text
<where>: a layer of this type has no such property in the style specification, so the map ignores it. Check the name in the style specification, or remove it.
```

## E1144

`Warning` `Main API` `Development build only`

```text
update(): this is the description object that the map already has, so a field that you changed in it has no effect. Write a new object for each change, for example map.update({...description, data: {...description.data, points}}), or call map.patch({...}).
```

## E1147

`Warning` `Main API` `Development build only`

```text
<target>: "<option>" is not an option of a fit, so it has no effect. For the fit of "bounds", write "fit<option>". "<option>" of the description applies to the map for good.
```

## E1148

`Warning` `Main API` `Development build only`

```text
<call>: the description has both "view" and "initialView.bounds". "view" wins, so the map does not fit "initialView.bounds". Remove "view" to fit the bounds, or remove "bounds" from "initialView".
```

## E1151

`Warning` `Main API` `Development build only`

```text
<MapJr>: the template ref has no method "<method>" until the map has loaded. Call it from @load or later, or use useMapInstance() in a component inside MapJr.
```

## E1163

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E1163 https://map-jr.org/e/1163 what=… url=… reason=…
```

`Development build`

```text
the request for the <resource> <url>... failed: <reason>
```

```text
the request for the <resource> <url> failed: <reason>
```

## E1189

`Warning` `Main API` `Development build only`

```text
sources: the GeoJSON source "<source id>" has no "data", and "data" of the description has no key "<source id>", so the source has no features. Give the source its own "data", or write the features as "data: {<source id>: geojson}".
```

## E1190

`Warning` `Main API` `Development build only`

```text
update(): "view" is a view that the map reported earlier, so the map does not move. The map ignores such a view so that a slow application does not pull it back while the user moves it. To return to a stored view, call moveTo(view).
```

## E1195

`Warning` `Main API` `Development build only`

```text
controls: two custom() controls have the key "<control>", so the map adds only the first. Give each custom() control its own "key".
```

```text
controls: <control>() is in the list twice with the same options, so the map adds it once. Remove the second <control>().
```

## E1214

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E1214 https://map-jr.org/e/1214 source=…
```

`Development build`

```text
queryElevation(): the style has no "raster-dem" source "<source>". Name a source of type "raster-dem".
```

## E1241

`Warning` `Module for Nuxt`

`Production build`

```text
[map-jr-gl] E1241 https://map-jr.org/e/1241 keys=…
```

`Development build`

```text
nuxt.config: the module @map-jr/map-jr-gl/nuxt has no options, so it ignores <keys>. Remove the key "mapJr" and the options of the module in "modules", and set the props of <MapJr> instead.
```

## E1245

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E1245 https://map-jr.org/e/1245 pitch=… maxPitch=…
```

`Development build`

```text
setMinPitch(<p>): the pitch must be between 0 and the largest pitch, <maxPitch>. Pass a value in that range, or raise the largest pitch with setMaxPitch first.
```

## E1258

`Warning` `Main API` `Development build only`

```text
<map-jr>: the attribute <attribute>="false" switches the option off all the same, because an attribute that is there takes effect, whatever its value. To keep the option on, remove <attribute>.
```

```text
<map-jr>: the attribute <attribute>="false" switches the option on all the same, because an attribute that is there takes effect, whatever its value. To switch it off, remove <attribute>.
```

## E1300

`Warning` `Server renderer`

```text
the server render draws no image "<imageName>", because <cause>. The map loads it in the browser.
```

## E1438

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E1438 https://map-jr.org/e/1438 source=…
```

`Development build`

```text
The source "<source name>" has encoding "mlt". MapLibre Tiles are not supported; use tiles with encoding "mvt".
```

## E1448

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E1448 https://map-jr.org/e/1448 id=…
```

`Development build`

```text
The video source "<id>" could not load any of its "urls". Check the URLs, and that a server of another origin sends CORS headers.
```

## E1452

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E1452 https://map-jr.org/e/1452 id=… width=… height=…
```

`Development build`

```text
The canvas source "<id>": the canvas is <width> × <height> pixels. Give it a width and a height above 0.
```

## E1465

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E1465 https://map-jr.org/e/1465
```

`Development build`

```text
createTileMesh(): the granularity is too large for 16-bit indices. Pass a smaller granularity, or "32bit".
```

## E1519

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E1519 https://map-jr.org/e/1519
```

`Development build`

```text
styles(): the control works only in the controls of a map of the main API (createMap).
```

## E1560

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E1560 https://map-jr.org/e/1560 label=… reason=…
```

`Development build`

```text
styles(): no picture for "<label>": <reason>.
```

## E1582

`Warning` `Server renderer`

```text
renderToImage(): "inlineImages" has no effect, because the image always embeds raster tiles and icons. Remove "inlineImages".
```

## E1593

`Warning` `Compat entry`

`Production build`

```text
[map-jr-gl] E1593 https://map-jr.org/e/1593 type=…
```

`Development build`

```text
Skipping unsupported layer types: <type>
```

## E1612

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E1612 https://map-jr.org/e/1612 sourceId=…
```

`Development build`

```text
The contour source "<sourceId>" has no "thresholds", so it draws no lines. Give it intervals for each zoom level, for example "thresholds": {"11": [200, 1000], "14": [50, 200]}.
```

## E1613

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E1613 https://map-jr.org/e/1613 sourceId=…
```

`Development build`

```text
The source "<sourceId>" is not an object. Give it an object with "type", or remove it from "sources".
```

## E1618

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E1618 https://map-jr.org/e/1618 list=…
```

`Development build`

```text
Skipping unsupported layer types: <list>
```

## E1621

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E1621 https://map-jr.org/e/1621 ratio=…
```

`Development build`

```text
The option pixelRatio is <ratio>. Give a number above 0, or leave it out to follow devicePixelRatio.
```

## E1630

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E1630 https://map-jr.org/e/1630 tileWorkers=… count=…
```

`Development build`

```text
configure(): tileWorkers: <n> has no effect while a map uses the <count> tile workers that exist. Call configure() before the first map is created, or destroy every map first.
```

## E1634

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E1634 https://map-jr.org/e/1634
```

`Development build`

```text
The workers sent 200 different warnings. Later ones are not shown.
```

## E1640

`Error` `Server renderer`

```text
server render: the options have no "center" and no "zoom", and no "bounds". Pass "center" and "zoom", for example center: [-74.0065, 40.7085], zoom: 14, or pass "bounds".
```

## E1647

`Warning` `Main API` `Development build only`

```text
<call>: "<option>" is not an option of an overlay, so it has no effect. Write "<option>". The options are <overlay options>.
```

```text
<call>: "<option>" is not an option of an overlay, so it has no effect. The options are <overlay options>.
```

## E1670

`Error` `Server renderer`

```text
server render: "<option name>" is <size>. Pass the <option name> in CSS pixels as a number greater than 0, for example <option name>: 800.
```

```text
server render: "<option name>" is <size>. Pass the <option name> in CSS pixels as a number greater than 0, for example <option name>: 500.
```

```text
server render: "<option name>" is <size>. Pass the <option name> in CSS pixels as a number greater than 0, for example <option name>: 800.
```

```text
server render: "<option name>" is <size>. Pass the <option name> in CSS pixels as a number greater than 0, for example <option name>: 500.
```

## E1683

`Warning` `Main API` `Development build only`

```text
<where>: this is a <group> property. The map reads it here all the same, but MapLibre GL JS rejects the style. Move it to "<group>".
```

## E1692

`Warning` `Main API` `Development build only`

```text
<layer>: "symbol-avoid-edges" has no effect, as in MapLibre GL JS, which does not read it. Remove the property.
```

## E1695

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E1695 https://map-jr.org/e/1695 source=…
```

`Development build`

```text
The source "<source name>": "emptyResponse": "missing" has no effect, and an empty tile draws nothing, as in MapLibre GL JS. Remove "emptyResponse".
```

## E1709

`Warning` `Compat entry`

`Production build`

```text
[map-jr-gl] E1709 https://map-jr.org/e/1709 fov=…
```

`Development build`

```text
setVerticalFieldOfView(<fov>): the field of view is not a number. Pass degrees from 0.1 to 150.
```

## E1712

`Warning` `Main API` `Development build only`

```text
style: the root property "centerAltitude" has no effect, as in MapLibre GL JS, which does not read it. Remove the property.
```

## E1748

`Error` `Compat entry` `Development build only`

```text
<where>: <why>. The map draws what it can, but MapLibre GL JS rejects the style. Correct it as the style specification requires.
```

## E1846

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E1846 https://map-jr.org/e/1846
```

`Development build`

```text
workerUrl: the parts of the worker (map-jr-gl-worker-*.js) have no URL, because neither workerUrl nor the module of the library is a URL of a folder. A map with a GeoJSON, contour or PMTiles source, with 3D terrain, with a globe or with a heatmap, hillshade or color-relief layer cannot draw it, and no map can answer a query of features. Set workerUrl to an http(s) URL of map-jr-gl-worker.js, with the parts in the same folder.
```

## E1855

`Warning` `Compat entry`

`Production build`

```text
[map-jr-gl] E1855 https://map-jr.org/e/1855 option=… todo=…
```

`Development build`

```text
<member> has no effect: the drag handlers here have no options. <todo>.
```

## E2004

`Error` `Compat entry`

`Production build`

```text
[map-jr-gl] E2004 https://map-jr.org/e/2004 layer=… source=…
```

`Development build`

```text
removeSource: the layer "<id>" uses the source "<id>". Remove the layer first.
```

## E2011

`Error` `Compat entry`

`Production build`

```text
[map-jr-gl] E2011 https://map-jr.org/e/2011 pitch=…
```

`Development build`

```text
setAnisotropicFilterPitch(<pitch>): the pitch is not from 0 to 180. Pass degrees from 0 to 180, or null for the default (20).
```

## E2033

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E2033 https://map-jr.org/e/2033 id=… ref=…
```

`Development build`

```text
The layer "<id>": "ref" names "<ref>", which is no layer without "ref". Name such a layer, or give "type" and "source".
```

## E2040

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E2040 https://map-jr.org/e/2040 id=… type=… maxRuns=…
```

`Development build`

```text
layer "<id>": in the order of "<type>-sort-key", the features of a tile form more than <MAX_RUNS> runs with the same "<type>-pattern", so the key orders the features only within each image. Give the features of one image keys next to each other, or make a layer for each image.
```

## E2047

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E2047 https://map-jr.org/e/2047 source=… interval=…
```

`Development build`

```text
The contour source "<source>" has the interval <interval> in "thresholds", so it draws no lines at the zooms of that interval. Give intervals greater than 0.
```

## E2106

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E2106 https://map-jr.org/e/2106 source=…
```

`Development build`

```text
The source "<source>":
```

## E2145

`Warning` `Compat entry`

`Production build`

```text
[map-jr-gl] E2145 https://map-jr.org/e/2145 member=…
```

`Development build`

```text
<member> has no effect: this library does not have that feature.
```

## E2148

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E2148 https://map-jr.org/e/2148 op=…
```

`Development build`

```text
Unsupported expression "<op>"
```

## E2233

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E2233 https://map-jr.org/e/2233 method=… image=… length=… width=… height=… expected=…
```

`Development build`

```text
<method>("<image name>"): the data has <length> values, but an image of <width>×<height> needs <expected> (width × height × 4, RGBA). Pass an array of that length.
```

## E2242

`Error` `Compat entry`

`Production build`

```text
[map-jr-gl] E2242 https://map-jr.org/e/2242 method=… image=… width=… height=… newWidth=… newHeight=…
```

`Development build`

```text
<method>("<image name>"): the image is <width>×<height>, but the new one is <newWidth>×<newHeight>. Pass an image of the same size, or call removeImage() and then addImage().
```

## E2265

`Warning` `Main API` `Development build only`

```text
<call>: <faces> is not an object of font faces, so the map loads no font from it. Write an object by "text-font" name, such as {"Open Sans": "https://example.com/open-sans.woff2"}, or {"Open Sans": [{"url": "https://example.com/open-sans-latin.woff2", "unicode-range": ["U+0000-00FF"]}]}.
```

## E2272

`Warning` `Compat entry` `Development build only`

```text
new Map(): "<member>" is not an option of the map, so it has no effect. Did you mean "<near>"? Check the spelling against the options of MapLibre GL JS, or remove "<member>".
```

## E2358

`Error` `Server renderer`

```text
firstViewOptions(): the description is missing or is not an object. Pass the description of the map, an object with a "style", for example firstViewOptions({style, initialView: {center: [0, 0], zoom: 2}}).
```

## E2404

`Warning` `Server renderer`

```text
renderElement(): attributes.<attribute> is dropped, because the element already has the attribute "<lower>" from the description or from an earlier entry. Remove it from attributes or change the description.
```

## E2412

`Warning` `Main API` `Development build only`

```text
interactive: the value of "<gesture>" is not true or false, so the gesture stays on. Write true or false.
```

```text
interactive: "<gesture>" is not a gesture, so it has no effect. Write one of dragPan, scrollZoom, dragRotate, doubleClickZoom, touchZoomRotate, touchPitch, keyboard or boxZoom.
```

## E2434

`Warning` `Server renderer`

```text
server render: the layer "<layerId>" is not drawn, because the server render does not draw <kind>. The map draws it in the browser. To leave it out of the server render without this warning, set overrides: {"<layerId>": {hidden: true}}.
```

## E10017

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E10017 https://map-jr.org/e/10017 workerVersion=… pageVersion=…
```

`Development build`

```text
The worker file is version <worker version> and the page file is version <__VERSION__>. Serve map-jr-gl-worker.js from the same version of the package as the page file, or pass `workerUrl` with the URL of that file.
```

## E10022

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E10022 https://map-jr.org/e/10022 why=…
```

`Development build`

```text
The query has no answer: the map <why>.
```

## E10025

`Error` `Server renderer`

```text
server render: "allowHosts" is <allowHosts>. Pass a list of host names without a scheme, a port or a path, for example ["tiles.example.com"].
```

## E10042

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E10042 https://map-jr.org/e/10042
```

`Development build`

```text
GeolocateControl: the code of trackUserLocation could not be loaded. Check that the files of the library are served.
```

## E10044

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E10044 https://map-jr.org/e/10044
```

`Development build`

```text
toBlob(): the map was removed before its image was taken.
```

## E10045

`Error` `Compat entry`

`Production build`

```text
[map-jr-gl] E10045 https://map-jr.org/e/10045 id=…
```

`Development build`

```text
addLayer: the custom layer "<id>" has no method render. Add render(gl, args).
```

## E10063

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E10063 https://map-jr.org/e/10063 source=…
```

`Development build`

```text
The source "<source name>" has no "tiles" and no "url". Give it one of them.
```

## E10065

`Error` `Main API`

`Production build`

```text
[map-jr-gl] E10065 https://map-jr.org/e/10065 container=…
```

`Development build`

```text
createMap(): no element with the id "<container>".
```

## E10070

`Error` `Compat entry`

`Production build`

```text
[map-jr-gl] E10070 https://map-jr.org/e/10070 id=… source=…
```

`Development build`

```text
addLayer: the layer "<id>" names the source "<source>", which the style does not have. Add the source first.
```

## E10090

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E10090 https://map-jr.org/e/10090 control=… option=… instead=…
```

`Development build`

```text
<control>: the option <option> has no effect.<instead>
```

## E10121

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E10121 https://map-jr.org/e/10121
```

`Development build`

```text
The texture of the images is full, so this image and the images after it are not drawn. Use fewer or smaller images. (An SVG template is drawn one time for each different set of values.)
```

## E10129

`Warning` `React component`

`Production build`

```text
[map-jr-gl] E10129 https://map-jr.org/e/10129 image=…
```

`Development build`

```text
MapImage "<image name>" has no image: its content has no <svg> element. Give an <svg> element as the content, or the URL of an image as "src".
```

## E10205

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E10205 https://map-jr.org/e/10205 status=…
```

`Development build`

```text
The map cannot start: WebGL2 is not available (<status>).
```

```text
The map cannot start: WebGL2 is not available.
```

## E10206

`Warning` `Compat entry` `Development build only`

```text
<member> is not available in @map-jr/map-jr-gl/maplibre-compat. Remove the use, or see docs/reference/maplibre-differences.md for what replaces it.
```

## E10255

`Error` `Compat entry`

`Production build`

```text
[map-jr-gl] E10255 https://map-jr.org/e/10255 id=…
```

`Development build`

```text
getSource("<id>").setTiles(tiles): "tiles" must be an array of URL strings.
```

## E10278

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E10278 https://map-jr.org/e/10278 type=…
```

`Development build`

```text
on("<type>"): the second argument is neither a layer id, an array of layer ids nor a listener.
```

## E10387

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E10387 https://map-jr.org/e/10387
```

`Development build`

```text
Vite's dependency cache does not contain the worker file. Add optimizeDeps: {exclude: ['@map-jr/map-jr-gl', 'maplibre-gl']} to vite.config and restart the dev server.
```

## E10494

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E10494 https://map-jr.org/e/10494 font=…
```

`Development build`

```text
The labels use the next font of their "text-font" instead of "<font>".
```

## E10495

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E10495 https://map-jr.org/e/10495 styleImages=…
```

`Development build`

```text
the style: metadata["map-jr:images"] is not an object of images by name, and the map uses none of them. Write {"name": "<svg ...>"}.
```

## E10524

`Warning` `Main API` `Development build only`

```text
the description has no field "extend", so the map ignores it. Write "sources", "layers" and "terrain" at the root of the description.
```

## E10569

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E10569 https://map-jr.org/e/10569 lights=… maxLights=…
```

`Development build`

```text
hillshade: a layer has <n> lights, and the layer draws the first <LIGHTS>. Give lists of at most <LIGHTS> values.
```

## E10645

`Warning` `Main API` `Development build only`

```text
<layer>: "color-relief-color" has <stops> stops. The map uses the first 2048 and drops the others. Write at most 2048 stops.
```

## E10654

`Warning` `Server renderer`

```text
server render: the source "<source>": "redFactor", "greenFactor", "blueFactor" and "baseShift" of the encoding "custom" must be finite numbers. The source is read with the encoding "mapbox". Write a number for each one, or leave it out for its default (1, 1, 1 and 0).
```

## E10826

`Warning` `Main API` `Development build only`

```text
<map-jr>: the element has no style, so it shows no map. Write the URL of a style in the attribute "map-style", or set the property "mapStyle".
```

## E10897

`Warning` `Compat entry`

`Production build`

```text
[map-jr-gl] E10897 https://map-jr.org/e/10897
```

`Development build`

```text
jumpTo(): the map center is clamped to the ground, which replaces "elevation" in the next frame, as in MapLibre GL JS. Call setCenterClampedToGround(false) first.
```

## E11139

`Error` `Compat entry` `Development build only`

```text
<where>: unknown property "<property>". The map draws the layer without it, but MapLibre GL JS rejects the style. Write "<near>".
```

```text
<where>: unknown property "<property>". The map draws the layer without it, but MapLibre GL JS rejects the style. Check the name in the style specification, or remove it.
```

## E11214

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E11214 https://map-jr.org/e/11214
```

`Development build`

```text
queryElevation(): the style has no "raster-dem" source. Add a source of type "raster-dem" to the style.
```

## E11452

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E11452 https://map-jr.org/e/11452 id=… key=…
```

`Development build`

```text
The canvas source "<id>": the page has no <canvas> with the id "<key>". Give the id of a <canvas> of the page, or the element.
```

## E11510

`Warning` `Compat entry`

`Production build`

```text
[map-jr-gl] E11510 https://map-jr.org/e/11510 type=… option=…
```

`Development build`

```text
<type>: the option <n> has no effect. Remove it; see "What is different" in docs/reference/maplibre-differences.md.
```

## E11519

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E11519 https://map-jr.org/e/11519
```

`Development build`

```text
styles(): "entries" is empty. Write styles({entries: [{label: "Streets", style: "https://…/style.json"}, …]}).
```

## E11560

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E11560 https://map-jr.org/e/11560
```

`Development build`

```text
styles(): preview has "zoom" without "center", so the pictures show the view of the map. Give both "center" and "zoom", or neither.
```

## E11613

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E11613 https://map-jr.org/e/11613 index=…
```

`Development build`

```text
The layer at index <index> of "layers" is not an object. Give it an object with "id" and "type", or remove it.
```

## E11640

`Error` `Server renderer`

```text
server render: the options have "zoom" but no "center", and no "bounds". Pass "center" and "zoom", for example center: [-74.0065, 40.7085], zoom: 14, or pass "bounds".
```

## E11683

`Error` `Compat entry` `Development build only`

```text
<where>: unknown property "<property>". The map reads it here all the same, but it is a <group> property, and MapLibre GL JS rejects the style. Move it to "<group>".
```

## E11846

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E11846 https://map-jr.org/e/11846 partName=… message=…
```

`Development build`

```text
The page could not load the part of the library for <partName> (<message>). Serve the chunks of the library from the same folder and version as its entry.
```

## E12047

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E12047 https://map-jr.org/e/12047 source=… maxCrossings=…
```

`Development build`

```text
The contour source "<source>" has a tile whose lines cross the cells of its grid more than <MAX_CROSSINGS> times, so that tile has no lines. Check the "encoding" of the raster-dem source ("mapbox" or "terrarium") and the intervals of "thresholds".
```

## E12148

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E12148 https://map-jr.org/e/12148 op=…
```

`Development build`

```text
Unsupported filter "<op>"
```

## E20017

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E20017 https://map-jr.org/e/20017 message=…
```

`Development build`

```text
The map cannot be shown: <message>.
```

## E20025

`Error` `Server renderer`

```text
server render: the host of <url> is not in "allowHosts". Add "<host>" to "allowHosts" if the render can request it.
```

## E20044

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E20044 https://map-jr.org/e/20044 type=…
```

`Development build`

```text
toBlob(): the browser could not encode the image as <type>.
```

## E20070

`Error` `Compat entry`

`Production build`

```text
[map-jr-gl] E20070 https://map-jr.org/e/20070 id=…
```

`Development build`

```text
addSource: the style has a source with the id "<id>" already. Remove that source first, or use another id.
```

## E20121

`Error` `Main API`

`Production build`

```text
[map-jr-gl] E20121 https://map-jr.org/e/20121 image=…
```

`Development build`

```text
images: the image "<image name>" did not load. Give an SVG document or the URL of an image that the page can read.
```

## E20129

`Warning` `Vue component`

`Production build`

```text
[map-jr-gl] E20129 https://map-jr.org/e/20129 image=…
```

`Development build`

```text
MapImage "<image name>" is not inside MapJr, so no map gets the image. Put it into the content of MapJr.
```

## E20495

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E20495 https://map-jr.org/e/20495 image=… styleImages=… why=…
```

`Development build`

```text
the style: the image "<image name>" of metadata["map-jr:images"] is left out, because the style has more than <MAX_STYLE_IMAGES> images. Give an SVG document without references to other files, or the URL of an image.
```

## E20648

`Warning` `Main API` `Development build only`

```text
<source>: "volatile" has no effect, as in MapLibre GL JS, which does not read it. Remove the property.
```

## E20826

`Warning` `Main API` `Development build only`

```text
<map-jr>: the attribute "map-style" was removed and the element has no "mapStyle", so the map keeps the style that it has. To change the style, give another URL in "map-style" or set "mapStyle".
```

## E20897

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E20897 https://map-jr.org/e/20897 meters=…
```

`Development build`

```text
setCenterElevation(<meters>): the height is not a number. Pass a number of meters, or null to put the center on the ground.
```

## E21452

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E21452 https://map-jr.org/e/21452 id=…
```

`Development build`

```text
The canvas source "<id>": "canvas" is not a <canvas> element. Give the id of a <canvas> of the page, or the element.
```

## E21560

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E21560 https://map-jr.org/e/21560
```

`Development build`

```text
styles(): preview has "center" without "zoom", so the pictures show the view of the map. Give both "center" and "zoom", or neither.
```

## E21640

`Error` `Server renderer`

```text
server render: the options have "center" but no "zoom", and no "bounds". Pass "center" and "zoom", for example center: [-74.0065, 40.7085], zoom: 14, or pass "bounds".
```

## E21846

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E21846 https://map-jr.org/e/21846 partName=…
```

`Development build`

```text
The worker could not load map-jr-gl-worker-<partName>.js, the part of the worker for <partName>: it has no URL. Set workerUrl to an http(s) URL of map-jr-gl-worker.js.
```

## E22148

`Warning` `Both entries`

`Production build`

```text
[map-jr-gl] E22148 https://map-jr.org/e/22148 message=…
```

`Development build`

```text
Workers are unavailable (<message>); running on the main thread. If the worker file is not next to the library, pass `workerUrl` or `createWorker`, or use the standalone build.
```

## E30017

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E30017 https://map-jr.org/e/30017 message=…
```

`Development build`

```text
The map cannot be shown: <message>. Call supported() before you make a map, and show other content when it returns false.
```

## E30025

`Error` `Server renderer`

```text
server render: the requests took longer than the "timeout" of <total> ms; the request to <first> was not complete. Pass a larger "timeout", or 0 for no limit.
```

## E30121

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E30121 https://map-jr.org/e/30121 image=… maxVariants=…
```

`Development build`

```text
The image "<image>" has more than <MAX_VARIANTS> different sets of values for its slots, and the others are not drawn. Give its slots values from a small set.
```

## E30129

`Warning` `Vue component`

`Production build`

```text
[map-jr-gl] E30129 https://map-jr.org/e/30129 image=…
```

`Development build`

```text
MapImage "<image name>" has no image: its content has no <svg> element. Write an <svg> in its slot, or give the URL of an image as "src".
```

## E30826

`Error` `Server renderer`

```text
renderElement(): "<attribute name>" is not the name of an attribute. Give names such as "id", "class" or "style".
```

## E31846

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E31846 https://map-jr.org/e/31846 url=… partName=…
```

`Development build`

```text
The worker could not load <url>, the part of the worker for <partName>. Serve map-jr-gl-worker-<partName>.js from the same folder and version as map-jr-gl-worker.js.
```

## E32148

`Warning` `Compat entry`

`Production build`

```text
[map-jr-gl] E32148 https://map-jr.org/e/32148 method=… had=… has=…
```

`Development build`

```text
<method>: the result was used without `await` and was not complete (<had> of <has> features). Tile data is in a worker. Change const features = map.<method>(...); to const features = await map.<method>(...); (this also works in MapLibre GL JS). See "Feature queries" in docs/reference/maplibre-differences.md.
```

## E40025

`Error` `Server renderer`

```text
server render: the request to <first> took longer than the "requestTimeout" of <each> ms. Pass a larger "requestTimeout", or 0 for no limit.
```

## E40121

`Error` `Both entries`

`Production build`

```text
[map-jr-gl] E40121 https://map-jr.org/e/40121 image=… message=…
```

`Development build`

```text
The image "<image>" cannot be drawn with the values of its slots (<message>). Check that the SVG is well-formed, also with a value in each slot.
```

## E40826

`Error` `Server renderer`

```text
renderElement(): the server render failed, and the element has no first view. The map draws in the browser. The cause: <cause>
```

## E50025

`Error` `Server renderer`

```text
server render: the request to <first> was redirected more than 5 times.
```

## E50121

`Error` `Main API`

`Production build`

```text
[map-jr-gl] E50121 https://map-jr.org/e/50121 image=…
```

`Development build`

```text
the style: the image "<image name>" did not load. Give an SVG document or the URL of an image that the page can read.
```

## E50826

`Error` `Server renderer`

```text
renderElement(): "<attribute name>" is not the name of an attribute that the element can have: an event handler attribute runs script. Give names such as "id", "class" or "style".
```

## E60025

`Error` `Server renderer`

```text
server render: the response of <first> is larger than "maxBytes" (<max> bytes). Pass a larger "maxBytes", or leave the source out of the style.
```
<!-- messages:end -->
