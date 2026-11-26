# Messages

Each error and warning of the library starts with `[map-jr-gl]` and a code, such as `E1846`. This page gives the text
of each code. A placeholder such as `<source name>` stands for a value that the message fills in. The package has the
same texts in `dist/messages.json` (each code with its kind and its texts), so that a log can be read without network.

A code stays the same in later versions. When a message is removed, its section stays here with the version after which
it was removed, and the code is not used again.

<!-- messages:start -->
## E0

A warning of the main API (development build only).

```text
<call>: the container has height 0, so the map shows nothing. Give the container a height in CSS.
```

## E1

A warning of the main API (development build only).

```text
interactiveLayers: the style has no layer "<layer id>". Write the id of a layer of the style or of "layers".
```

## E2

A warning of the main API (development build only).

```text
the layer "<layer id>" uses the source "<source id>", which the map does not have. A key of "data" makes a source only while it is in "data": keep "<source id>" in "data", or remove the layer.
```

## E3

A warning of the main API (development build only).

```text
queryFeatures(): the style has no layer "<layer id>". In "layers" of the query, write the id of a layer of the style or of "layers" of the description.
```

## E4

A warning of the main API (development build only).

```text
querySource(): the style has no source "<source id>". Write the id of a source of the style or of "sources".
```

## E5

A warning of the main API (development build only).

```text
layers: the layer "<layer id>" has before: "<before id>", but the style has no layer "<before id>", so the layer goes on top. Write the id of a layer of the style.
```

## E6

A warning of the main API (development build only).

```text
layers: the layer "<layer id>" uses the source "<source id>", which the style does not have. Add "<source id>" to "sources", or give its GeoJSON as "<source id>" in "data".
```

## E8

A warning of the main API (development build only).

```text
update(): "<option>" changed, but it is read only when the map is made. To move the map, change "view" or call moveTo().
```

```text
update(): "<option>" changed, but it is read only when the map is made. To change it, destroy the map and make a new one.
```

## E9

An error of the main API.

```text
queryFeatures(): the place is not {x, y} or [lng, lat].
```

```text
queryFeatures(): <place> is not a place. Write a point of the screen {x, y}, a position [lng, lat], or a rectangle [{x, y}, {x, y}].
```

## E10

An error of the main API.

```text
querySource(): the first argument is not the id of a source.
```

```text
querySource(): <first argument> is not the id of a source. Write querySource("id", at, options) with the id of a source of the style.
```

## E11

A warning of the main API (development build only).

```text
querySource(): "<option>" has an effect only in a query at a point or a position. This query ignores it.
```

## E12

A warning of the main API (development build only).

```text
querySource(): "<option>" is not an option of querySource, which reads the tile data of one source. To find what the style layers draw, call queryFeatures(at, {layers}).
```

```text
queryFeatures(): "<option>" is not an option of queryFeatures, which finds what the style layers draw. To read the tile data of a source, call querySource(sourceId, at, options).
```

## E13

A warning of the main API (development build only).

```text
<method>(): "radius" has an effect only in a query at a point or a position. This query ignores it.
```

## E14

A warning of the main API (development build only).

```text
images: a layer gives the parameter "<parameter>" to the image "<image id>", but that image has no slot {{<parameter>}}, so the parameter has no effect. Write {{<parameter>}} in the SVG of "<image id>" in "images", or remove the parameter.
```

## E20

A warning of the main API (development build only).

```text
The description has "glyphs". That field was removed and has no effect: the map loads the glyph files of the style. Remove "glyphs" from the description. To draw text with the fonts of the browser, remove "glyphs" from the style.
```

## E21

A warning of the main API (development build only).

```text
points(): the record <record> has no position of two finite numbers, so it is left out. Make "lngLat" return [lng, lat] for each record.
```

## E22

A warning of the main API (development build only).

```text
globalState: the value of "<key>" is not JSON (a function, a class instance, NaN or a cycle), so the style cannot read it as it is. Give a string, a number, a boolean, an array or a plain object.
```

## E23

A warning of the main API (development build only).

```text
moveTo(): "fitPadding" and "fitMaxZoom" have an effect only with "bounds", so this call ignores them. To set the padding of the map, give "padding" in the description.
```

## E24

An error of both entries.

```text
the request to <to> was aborted.
```

## E25

An error of the server renderer.

```text
server render: "<option name>" is <option value>. Pass a number that is 0 (no limit) or more.
```

## E30

A warning of the main API (development build only).

```text
hoverState: a feature of the layer "<layer id>" has no id, so it gets no feature state "hover". Give the features ids, or set "promoteId" of the source to a property that has one, or "generateId: true" for the source.
```

```text
hoverState: a feature of the layer "<layer id>" has no id, so it gets no feature state "hover". Write a numeric id for each feature into the tiles when you build them, or set "promoteId" of the source to a property that has one.
```

## E40

A warning of the main API (development build only).

```text
colorScheme: <scheme> is not a color scheme, so the map uses the light colors. Write 'auto', 'light' or 'dark'.
```

## E42

A warning of the compat entry.

```text
Map: the option locale is not an object. Pass an object such as {"NavigationControl.ZoomIn": "Zoom avant"}.
```

## E44

An error of both entries.

```text
toBlob(): the browser could not encode the image as <mime>. <err>
```

## E45

A warning of the main API (development build only).

```text
style: the object is not a style, because it has no "version" and "layers", and it is not a pair {light, dark}. Give a style object, the URL of a style, or {light: style, dark: style}.
```

## E46

A warning of the main API (development build only).

```text
style: the pair has no "<missing>", so the map uses "<used>" in both color schemes. Give both "light" and "dark".
```

## E52

A warning of the compat entry.

```text
Map: the option glyphs was removed and has no effect; the map loads the glyph files of the style. Remove the option. To draw text with the fonts of the browser, remove "glyphs" from the style.
```

## E55

A warning of the main API (development build only).

```text
sprite: <sprite> is not a list of sprites. Write a list of {id, url}, for example [{id: 'pins', url: 'https://example.com/sprites/pins'}], and name an image of it in "icon-image" as "pins:name".
```

## E57

An error of the main API.

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

An error of both entries.

```text
Style <style>: HTTP <status>
```

## E65

An error of the main API.

```text
createMap(): the container is <container>. In a framework, make the map after the element is mounted.
```

## E70

An error of the compat entry.

```text
addLayer: the style has a layer with the id "<id>" already. Remove that layer first, or use another id.
```

## E90

An error of the compat entry.

```text
<key> has no effect.
```

## E97

A warning of both entries.

```text
The container already has a map. Remove that map first: remove(), or destroy() in the main API.
```

## E110

An error of both entries.

```text
The WebGL context was lost again. Call remove() and create the map again later.
```

## E121

An error of the compat entry.

```text
the style: the image "<image name>" did not load. Give an SVG document or the URL of an image that the page can read.
```

## E129

A warning of the React component.

```text
MapImage "<image name>" is not inside MapJr, so no map gets the image. Put it into the children of MapJr.
```

## E160

An error of both entries.

```text
The control "<control name>" could not be loaded. Check that the files of the library are served.
```

## E205

A warning of the compat entry.

```text
map.painter does not exist in @map-jr/map-jr-gl/maplibre-compat. To check for WebGL, use supported(); a failed start fires "error" with a GPUInitializationError.
```

## E206

A warning of the main API (development build only).

```text
<member> is private state of MapLibre GL JS and does not exist in @map-jr/map-jr-gl/maplibre-compat. <advice>
```

## E208

A warning of the compat entry.

```text
<method>(): the feature has no "id". Give the source features an id, or set "promoteId" on the source.
```

## E210

A warning of the compat entry.

```text
setTransformCameraUpdate: the function changed the camera of a movement. This library draws that camera only when the movement ends (react-map-gl: onMove did not set viewState to e.viewState). To keep the map in a region, use the option maxBounds.
```

## E216

An error of both entries.

```text
custom(): write custom({key: "my-control", element}) or custom({key: "my-control", onAdd(map) { return element; }, onRemove() {}}).
```

## E217

An error of the main API.

```text
<method>(): "<id>" is not a GeoJSON source of the style.
```

## E238

A warning of both entries.

```text
The style has the projection <t>, which is not supported, so the map uses "mercator".
```

## E241

A warning of the compat entry.

```text
setWorkerUrl(): this is the worker file of MapLibre GL JS, which this library cannot use. Remove the call; the library finds map-jr-gl-worker.js itself.
```

## E242

An error of both entries.

```text
The map could not copy data to its workers (<message>). Pass plain objects (toRaw() in Vue).
```

## E255

An error of the compat entry.

```text
getSource("<id>").setUrl(url): "url" must be a string.
```

```text
getSource("<id>").setTiles(tiles): "tiles" must be an array of URL strings.
```

## E259

An error of the compat entry.

```text
addControl(): the argument is not a control. Pass an object with onAdd and onRemove methods.
```

## E269

An error of both entries.

```text
addControl(): "<pos>" is not a position. Write "top-left", "top-right", "bottom-left" or "bottom-right".
```

## E277

An error of both entries.

```text
PMTiles <url>: the server ignores Range requests, so each tile would download the whole file (<file size> MB). Serve the file from a server that supports Range requests.
```

## E278

An error of both entries.

```text
on("<type>"): the listener after the layer id is not a function.
```

```text
on("<type>"): the second argument is neither a layer id, an array of layer ids nor a listener.
```

## E294

A warning of both entries.

```text
setFeatureState(): the source "<source>" is not GeoJSON, and the id "<id>" is a string. Feature state on a vector source needs the numeric id of the feature in the tile, or "promoteId" on the source.
```

## E316

A warning of both entries.

```text
addProtocol("pmtiles"): the library reads pmtiles:// URLs itself and does not use this protocol. Remove the addProtocol call.
```

## E387

A warning of the compat entry.

```text
new Map(): canvasContextAttributes.preserveDrawingBuffer has no effect. Read the canvas with map.toBlob(), and remove the option.
```

## E415

An error of both entries.

```text
the request to <input> did not finish within <ms> ms.
```

## E463

A warning of the compat entry.

```text
new Map(): the option projection has no effect, as in MapLibre GL JS 6.17. Put "projection": {"type": "globe"} into the style, or call map.setProjection({type: "globe"}) after the style has loaded.
```

## E464

An error of both entries.

```text
addImage("<image name>"): images that draw themselves with WebGL (renderWithWebGL) are not supported. Pass pixels, a canvas, an image or SVG text.
```

## E469

An error of the compat entry.

```text
addLayer: the layer "<id>" has a source object, and the style has a source with the id "<id>" already. Remove that source first, or pass source: "<id>".
```

## E484

An error of the main API.

```text
once("<type>"): the map was removed.
```

## E487

An error of both entries.

```text
data: the source "<id>" has the type "<type>", and only a GeoJSON source takes data. Use another key in "data", or another id for the source.
```

## E494

An error of both entries.

```text
fonts: the font "<font name>" did not load from <src> (<m>). The labels use the next font of their "text-font".
```

## E495

An error of the main API.

```text
the style: the code for the images in metadata["map-jr:images"] did not load, and the map draws the style without them. Check that the files of the library are served next to it.
```

## E503

An error of the main API.

```text
<method>(): the third argument is <options>. Pass {limit, offset}, for example clusterLeaves(sourceId, clusterId, {limit: 50, offset: 100}).
```

## E524

A warning of the main API (development build only).

```text
the description has no field "<field>", so the map ignores it. Check the spelling against MapDescription in docs/reference/description.md, or remove "<field>".
```

## E539

An error of both entries.

```text
The style has no list "layers". Give a style object with "version", "sources" and "layers", or its URL.
```

## E541

A warning of both entries.

```text
colorScheme(): the control works only in the controls of a map of the main API (createMap).
```

## E566

An error of the compat entry.

```text
getSource("<id>").setClusterOptions(options): "options" must be an object with cluster, clusterMaxZoom or clusterRadius.
```

## E569

A warning of both entries.

```text
hillshade-method: <hillshade method> is not a method, and the layer uses "standard". Write "standard", "basic", "combined", "igor" or "multidirectional".
```

## E583

A warning of both entries.

```text
number-format: Intl.NumberFormat does not accept the options <options> (<message>). The expression gives the number as plain text. Pass a BCP 47 locale, an ISO 4217 currency and a unit that Intl.NumberFormat supports.
```

## E590

A warning of both entries.

```text
The source "<source name>": "redFactor", "greenFactor", "blueFactor" and "baseShift" of the encoding "custom" must be finite numbers. The source is read with the encoding "mapbox". Write a number for each one, or leave it out for its default (1, 1, 1 and 0).
```

## E645

A warning of the main API (development build only).

```text
<layer>: "color-relief-color" is not an "interpolate" expression, so the layer draws nothing, as in MapLibre GL JS. Write ["interpolate", ["linear"], ["elevation"], elevation, color, ...].
```

```text
<layer>: "color-relief-color" is missing, so the layer draws nothing, as in MapLibre GL JS. Write ["interpolate", ["linear"], ["elevation"], elevation, color, ...].
```

## E648

A warning of the main API (development build only).

```text
<where>: "<property>" has no effect, because this library does not read it, while MapLibre GL JS does. Remove the property, or see docs/reference/maplibre-differences.md.
```

## E685

A warning of the main API (development build only).

```text
locale: <problem>. Pass an object of strings by the keys of MapLibre GL JS, such as {"NavigationControl.ZoomIn": "Zoom avant"}.
```

## E706

An error of the Vue component.

```text
<MapJr>: the server render failed, and the page has no first view. The map draws in the browser. The cause: <cause>
```

## E764

An error of the compat entry.

```text
the style: the code for metadata["map-jr:images"] did not load, so the map has no images of the style. Serve the files of the library together.
```

## E798

A warning of both entries.

```text
Worker rendering unavailable, using the main thread: <why>
```

## E826

A warning of the main API (development build only).

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

A warning of both entries.

```text
maxPitch <p>: the pitch stops at <MAX_PITCH>. Pass <MAX_PITCH> or less.
```

## E897

A warning of the compat entry.

```text
setCenterElevation(): the map center is clamped to the ground, which replaces the height in the next frame, as in MapLibre GL JS. Call setCenterClampedToGround(false) first.
```

## E985

An error of the server renderer.

```text
tileZoomOffset: <dz> is not a whole number. Write for example tileZoomOffset: 2 (tiles 2 zooms lower) or -1 (tiles 1 zoom higher), or leave it out for 0.
```

## E1020

A warning of the compat entry.

```text
setTransformConstrain has no effect: the function needs the map to draw on the main thread. Pass renderer: 'main' to new Map().
```

## E1021

An error of the compat entry.

```text
setSourceTileLodParams: there is no source "<sourceId>". Add the source first, or leave out the ID for all sources.
```

## E1057

An error of the main API (development build only).

```text
<where>: <reason> The map draws it, but MapLibre GL JS rejects the style. Write ["zoom"] only as the input of one ["step", ["zoom"], ...] or ["interpolate", ..., ["zoom"], ...] at the top of the expression (or as the result of a top-level "let", or as one argument of a top-level "coalesce"), and put the other parts in its outputs.
```

## E1139

A warning of the main API (development build only).

```text
<where>: a layer of this type has no such property in the style specification, so the map ignores it. Write "<near>".
```

```text
<where>: a layer of this type has no such property in the style specification, so the map ignores it. Check the name in the style specification, or remove it.
```

## E1147

A warning of the main API (development build only).

```text
<target>: "<option>" is not an option of a fit, so it has no effect. For the fit of "bounds", write "fit<option>". "<option>" of the description applies to the map for good.
```

## E1148

A warning of the main API (development build only).

```text
<call>: the description has both "view" and "initialView.bounds". "view" wins, so the map does not fit "initialView.bounds". Remove "view" to fit the bounds, or remove "bounds" from "initialView".
```

## E1151

A warning of the main API (development build only).

```text
<MapJr>: the template ref has no method "<method>" until the map has loaded. Call it from @load or later, or use useMapInstance() in a component inside MapJr.
```

## E1163

An error of both entries.

```text
the request for the <resource> <url>... failed: <reason>
```

```text
the request for the <resource> <url> failed: <reason>
```

## E1189

A warning of the main API (development build only).

```text
sources: the GeoJSON source "<source id>" has no "data", and "data" of the description has no key "<source id>", so the source has no features. Give the source its own "data", or write the features as "data: {<source id>: geojson}".
```

## E1190

A warning of the main API (development build only).

```text
update(): "view" is a view that the map reported earlier, so the map does not move. The map ignores such a view so that a slow application does not pull it back while the user moves it. To return to a stored view, call moveTo(view).
```

## E1195

A warning of the main API (development build only).

```text
controls: two custom() controls have the key "<control>", so the map adds only the first. Give each custom() control its own "key".
```

```text
controls: <control>() is in the list twice with the same options, so the map adds it once. Remove the second <control>().
```

## E1214

An error of both entries.

```text
queryElevation(): the style has no "raster-dem" source "<source>". Name a source of type "raster-dem".
```

## E1241

A warning of the module for Nuxt.

```text
nuxt.config: the module @map-jr/map-jr-gl/nuxt has no options, so it ignores <keys>. Remove the key "mapJr" and the options of the module in "modules", and set the props of <MapJr> instead.
```

## E1245

An error of both entries.

```text
setMinPitch(<p>): the pitch must be between 0 and the largest pitch, <maxPitch>. Pass a value in that range, or raise the largest pitch with setMaxPitch first.
```

## E1258

A warning of the main API (development build only).

```text
<map-jr>: the attribute <attribute>="false" switches the option off all the same, because an attribute that is there takes effect, whatever its value. To keep the option on, remove <attribute>.
```

```text
<map-jr>: the attribute <attribute>="false" switches the option on all the same, because an attribute that is there takes effect, whatever its value. To switch it off, remove <attribute>.
```

## E1300

A warning of the server renderer.

```text
the server render draws no image "<imageName>", because <cause>. The map loads it in the browser.
```

## E1438

An error of both entries.

```text
The source "<source name>" has encoding "mlt". MapLibre Tiles are not supported; use tiles with encoding "mvt".
```

## E1448

An error of both entries.

```text
The video source "<id>" could not load any of its "urls". Check the URLs, and that a server of another origin sends CORS headers.
```

## E1452

An error of both entries.

```text
The canvas source "<id>": the canvas is <width> × <height> pixels. Give it a width and a height above 0.
```

## E1465

An error of both entries.

```text
createTileMesh(): the granularity is too large for 16-bit indices. Pass a smaller granularity, or "32bit".
```

## E1519

A warning of both entries.

```text
styles(): the control works only in the controls of a map of the main API (createMap).
```

## E1560

A warning of both entries.

```text
styles(): no picture for "<label>": <reason>.
```

## E1582

A warning of the server renderer.

```text
renderToImage(): "inlineImages" has no effect, because the image always embeds raster tiles and icons. Remove "inlineImages".
```

## E1593

A warning of the compat entry.

```text
Skipping unsupported layer types: <type>
```

## E1612

A warning of both entries.

```text
The contour source "<sourceId>" has no "thresholds", so it draws no lines. Give it intervals for each zoom level, for example "thresholds": {"11": [200, 1000], "14": [50, 200]}.
```

## E1613

An error of both entries.

```text
The source "<sourceId>" is not an object. Give it an object with "type", or remove it from "sources".
```

## E1618

A warning of both entries.

```text
Skipping unsupported layer types: <list>
```

## E1621

A warning of both entries.

```text
The option pixelRatio is <ratio>. Give a number above 0, or leave it out to follow devicePixelRatio.
```

## E1630

A warning of both entries.

```text
configure(): tileWorkers: <n> has no effect while a map uses the <count> tile workers that exist. Call configure() before the first map is created, or destroy every map first.
```

## E1634

A warning of both entries.

```text
The workers sent 200 different warnings. Later ones are not shown.
```

## E1640

An error of the server renderer.

```text
server render: the options have no "center" and no "zoom", and no "bounds". Pass "center" and "zoom", for example center: [-74.0065, 40.7085], zoom: 14, or pass "bounds".
```

```text
server render: the options have "zoom" but no "center", and no "bounds". Pass "center" and "zoom", for example center: [-74.0065, 40.7085], zoom: 14, or pass "bounds".
```

```text
server render: the options have "center" but no "zoom", and no "bounds". Pass "center" and "zoom", for example center: [-74.0065, 40.7085], zoom: 14, or pass "bounds".
```

## E1647

A warning of the main API (development build only).

```text
<call>: "<option>" is not an option of an overlay, so it has no effect. Write "<option>". The options are <overlay options>.
```

```text
<call>: "<option>" is not an option of an overlay, so it has no effect. The options are <overlay options>.
```

## E1670

An error of the server renderer.

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

## E1692

A warning of the main API (development build only).

```text
<layer>: "symbol-avoid-edges" has no effect, as in MapLibre GL JS, which does not read it. Remove the property.
```

## E1695

A warning of both entries.

```text
The source "<source name>": "emptyResponse": "missing" has no effect, and an empty tile draws nothing, as in MapLibre GL JS. Remove "emptyResponse".
```

## E1709

A warning of the compat entry.

```text
setVerticalFieldOfView(<fov>): the field of view is not a number. Pass degrees from 0.1 to 150.
```

## E1712

A warning of the main API (development build only).

```text
style: the root property "centerAltitude" has no effect, as in MapLibre GL JS, which does not read it. Remove the property.
```

## E1748

An error of the main API (development build only).

```text
<where>: <why>. The map draws what it can, but MapLibre GL JS rejects the style. Correct it as the style specification requires.
```

## E1846

A warning of both entries.

```text
workerUrl: the parts of the worker (map-jr-gl-worker-*.js) have no URL, because neither workerUrl nor the module of the library is a URL of a folder. A map with a GeoJSON, contour or PMTiles source, with 3D terrain, with a globe or with a heatmap, hillshade or color-relief layer cannot draw it. Set workerUrl to an http(s) URL of map-jr-gl-worker.js, with the parts in the same folder.
```

## E1855

A warning of the compat entry.

```text
<member> has no effect: the drag handlers here have no options. <todo>.
```

## E2004

An error of the compat entry.

```text
removeSource: the layer "<id>" uses the source "<id>". Remove the layer first.
```

## E2011

An error of the compat entry.

```text
setAnisotropicFilterPitch(<pitch>): the pitch is not from 0 to 180. Pass degrees from 0 to 180, or null for the default (20).
```

## E2033

An error of both entries.

```text
The layer "<id>": "ref" names "<ref>", which is no layer without "ref". Name such a layer, or give "type" and "source".
```

## E2040

A warning of both entries.

```text
layer "<id>": in the order of "<type>-sort-key", the features of a tile form more than <MAX_RUNS> runs with the same "<type>-pattern", so the key orders the features only within each image. Give the features of one image keys next to each other, or make a layer for each image.
```

## E2047

A warning of both entries.

```text
The contour source "<source>" has the interval <interval> in "thresholds", so it draws no lines at the zooms of that interval. Give intervals greater than 0.
```

## E2106

A warning of both entries.

```text
The source "<source>":
```

## E2145

A warning of the compat entry.

```text
<member> has no effect: this library does not have that feature.
```

## E2148

A warning of both entries.

```text
Unsupported expression "<op>"
```

## E10017

A warning of both entries.

```text
The worker file is version <worker version> and the page file is version <__VERSION__>. Serve map-jr-gl-worker.js from the same version of the package as the page file, or pass `workerUrl` with the URL of that file.
```

## E10022

An error of both entries.

```text
The query has no answer: the map <why>.
```

## E10025

An error of the server renderer.

```text
server render: "allowHosts" is <allowHosts>. Pass a list of host names without a scheme, a port or a path, for example ["tiles.example.com"].
```

## E10042

An error of both entries.

```text
GeolocateControl: the code of trackUserLocation could not be loaded. Check that the files of the library are served.
```

## E10044

An error of both entries.

```text
toBlob(): the map was removed before its image was taken.
```

## E10045

An error of the compat entry.

```text
addLayer: the custom layer "<id>" has no method render. Add render(gl, args).
```

## E10063

An error of both entries.

```text
The source "<source name>" has no "tiles" and no "url". Give it one of them.
```

## E10065

An error of the main API.

```text
createMap(): no element with the id "<container>".
```

## E10070

An error of the compat entry.

```text
addLayer: the layer "<id>" names the source "<source>", which the style does not have. Add the source first.
```

## E10090

A warning of both entries.

```text
<control>: the option <option> has no effect.<instead>
```

## E10121

An error of both entries.

```text
The texture of the images is full, so this image and the images after it are not drawn. Use fewer or smaller images. (An SVG template is drawn one time for each different set of values.)
```

## E10129

A warning of the React component.

```text
MapImage "<image name>" has no image: its content has no <svg> element. Give an <svg> element as the content, or the URL of an image as "src".
```

## E10205

An error of both entries.

```text
The map cannot start: WebGL2 is not available (<status>).
```

```text
The map cannot start: WebGL2 is not available.
```

## E10206

A warning of the main API (development build only).

```text
<member> is not available in @map-jr/map-jr-gl/maplibre-compat. Remove the use, or see docs/reference/maplibre-differences.md for what replaces it.
```

## E10387

A warning of both entries.

```text
Vite's dependency cache does not contain the worker file. Add optimizeDeps: {exclude: ['@map-jr/map-jr-gl', 'maplibre-gl']} to vite.config and restart the dev server.
```

## E10495

An error of both entries.

```text
the style: metadata["map-jr:images"] is not an object of images by name, and the map uses none of them. Write {"name": "<svg ...>"}.
```

## E10524

A warning of the main API (development build only).

```text
the description has no field "extend", so the map ignores it. Write "sources", "layers" and "terrain" at the root of the description.
```

## E10569

A warning of both entries.

```text
hillshade: a layer has <n> lights, and the layer draws the first <LIGHTS>. Give lists of at most <LIGHTS> values.
```

## E10645

A warning of the main API (development build only).

```text
<layer>: "color-relief-color" has <stops> stops. The map uses the first 2048 and drops the others. Write at most 2048 stops.
```

## E10826

A warning of the main API (development build only).

```text
<map-jr>: the element has no style, so it shows no map. Write the URL of a style in the attribute "map-style", or set the property "mapStyle".
```

## E10897

A warning of the compat entry.

```text
jumpTo(): the map center is clamped to the ground, which replaces "elevation" in the next frame, as in MapLibre GL JS. Call setCenterClampedToGround(false) first.
```

## E11139

An error of the main API (development build only).

```text
<where>: unknown property "<property>". The map draws the layer without it, but MapLibre GL JS rejects the style. Write "<near>".
```

```text
<where>: unknown property "<property>". The map draws the layer without it, but MapLibre GL JS rejects the style. Check the name in the style specification, or remove it.
```

## E11214

An error of both entries.

```text
queryElevation(): the style has no "raster-dem" source. Add a source of type "raster-dem" to the style.
```

## E11452

An error of both entries.

```text
The canvas source "<id>": the page has no <canvas> with the id "<key>". Give the id of a <canvas> of the page, or the element.
```

```text
The canvas source "<id>": "canvas" is not a <canvas> element. Give the id of a <canvas> of the page, or the element.
```

## E11510

A warning of the compat entry.

```text
<type>: the option <n> has no effect. Remove it; see "What is different" in docs/reference/maplibre-differences.md.
```

## E11519

A warning of both entries.

```text
styles(): "entries" is empty. Write styles({entries: [{label: "Streets", style: "https://…/style.json"}, …]}).
```

## E11560

A warning of both entries.

```text
styles(): preview has "zoom" without "center", so the pictures show the view of the map. Give both "center" and "zoom", or neither.
```

```text
styles(): preview has "zoom" without "zoom", so the pictures show the view of the map. Give both "center" and "zoom", or neither.
```

```text
styles(): preview has "center" without "center", so the pictures show the view of the map. Give both "center" and "zoom", or neither.
```

```text
styles(): preview has "center" without "zoom", so the pictures show the view of the map. Give both "center" and "zoom", or neither.
```

## E11613

An error of both entries.

```text
The layer at index <index> of "layers" is not an object. Give it an object with "id" and "type", or remove it.
```

## E11846

An error of both entries.

```text
The page could not load the part of the library for <partName> (<message>). Serve the chunks of the library from the same folder and version as its entry.
```

## E12047

A warning of both entries.

```text
The contour source "<source>" has a tile whose lines cross the cells of its grid more than <MAX_CROSSINGS> times, so that tile has no lines. Check the "encoding" of the raster-dem source ("mapbox" or "terrarium") and the intervals of "thresholds".
```

## E12148

A warning of both entries.

```text
Unsupported filter "<op>"
```

## E20017

An error of both entries.

```text
The map cannot be shown: <message>. Call supported() before you make a map, and show other content when it returns false.
```

```text
The map cannot be shown: <message>.
```

## E20025

An error of the server renderer.

```text
server render: the host of <url> is not in "allowHosts". Add "<host>" to "allowHosts" if the render can request it.
```

## E20044

An error of both entries.

```text
toBlob(): the browser could not encode the image as <type>.
```

## E20070

An error of the compat entry.

```text
addSource: the style has a source with the id "<id>" already. Remove that source first, or use another id.
```

## E20121

An error of the main API.

```text
images: the image "<image name>" did not load. Give an SVG document or the URL of an image that the page can read.
```

```text
the style: the image "<image name>" did not load. Give an SVG document or the URL of an image that the page can read.
```

## E20129

A warning of the Vue component.

```text
MapImage "<image name>" is not inside MapJr, so no map gets the image. Put it into the content of MapJr.
```

## E20495

An error of both entries.

```text
the style: the image "<image name>" of metadata["map-jr:images"] is left out, because the style has more than <MAX_STYLE_IMAGES> images. Give an SVG document without references to other files, or the URL of an image.
```

## E20648

A warning of the main API (development build only).

```text
<source>: "volatile" has no effect, as in MapLibre GL JS, which does not read it. Remove the property.
```

## E20826

A warning of the main API (development build only).

```text
<map-jr>: the attribute "map-style" was removed and the element has no "mapStyle", so the map keeps the style that it has. To change the style, give another URL in "map-style" or set "mapStyle".
```

## E20897

A warning of both entries.

```text
setCenterElevation(<meters>): the height is not a number. Pass a number of meters, or null to put the center on the ground.
```

## E21846

An error of both entries.

```text
The worker could not load map-jr-gl-worker-<partName>.js, the part of the worker for <partName>: it has no URL. Set workerUrl to an http(s) URL of map-jr-gl-worker.js.
```

## E22148

A warning of both entries.

```text
Workers are unavailable (<message>); running on the main thread. If the worker file is not next to the library, pass `workerUrl` or `createWorker`, or use the standalone build.
```

## E30025

An error of the server renderer.

```text
server render: the requests took longer than the "timeout" of <total> ms; the request to <first> was not complete. Pass a larger "timeout", or 0 for no limit.
```

## E30121

An error of both entries.

```text
The image "<image>" has more than <MAX_VARIANTS> different sets of values for its slots, and the others are not drawn. Give its slots values from a small set.
```

## E30129

A warning of the Vue component.

```text
MapImage "<image name>" has no image: its content has no <svg> element. Write an <svg> in its slot, or give the URL of an image as "src".
```

## E30826

An error of the server renderer.

```text
renderElement(): "<attribute name>" is not the name of an attribute that the element can have: an event handler attribute runs script. Give names such as "id", "class" or "style".
```

```text
renderElement(): "<attribute name>" is not the name of an attribute. Give names such as "id", "class" or "style".
```

## E31846

An error of both entries.

```text
The worker could not load <url>, the part of the worker for <partName>. Serve map-jr-gl-worker-<partName>.js from the same folder and version as map-jr-gl-worker.js.
```

## E32148

A warning of the compat entry.

```text
<method>: the result was used without `await` and was not complete (<had> of <has> features). Tile data is in a worker. Change const features = map.<method>(...); to const features = await map.<method>(...); (this also works in MapLibre GL JS). See "Feature queries" in docs/reference/maplibre-differences.md.
```

## E40025

An error of the server renderer.

```text
server render: the request to <first> took longer than the "requestTimeout" of <each> ms. Pass a larger "requestTimeout", or 0 for no limit.
```

## E40121

An error of both entries.

```text
The image "<image>" cannot be drawn with the values of its slots (<message>). Check that the SVG is well-formed, also with a value in each slot.
```

## E40826

An error of the server renderer.

```text
renderElement(): the server render failed, and the element has no first view. The map draws in the browser. The cause: <cause>
```

## E50025

An error of the server renderer.

```text
server render: the request to <first> was redirected more than 5 times.
```

## E60025

An error of the server renderer.

```text
server render: the response of <first> is larger than "maxBytes" (<max> bytes). Pass a larger "maxBytes", or leave the source out of the style.
```
<!-- messages:end -->
