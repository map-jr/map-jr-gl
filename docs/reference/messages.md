# Messages

Every message that the library prints starts with `[map-jr-gl]`. This page lists each message by the entry or area
that prints it, so that a message from the console or from an exception can be found by its text. A message says what
is wrong and what to write instead.

In the lists, a word in angle brackets, such as `<image name>` or `<url>`, stands for a value that the library fills in at
run time. The words say what the value is.

Each entry gives the type of the message, and says when only the development build prints it.

- A `Warning` is logged with `console.warn`, and the map keeps working.
- An `Error` is thrown, is the reason that a promise rejects, is passed to the `error` event of the map, or is logged
  with `console.error`.
- "Development build only" means that the message comes from the development build (the `development` export
  condition, `dist/*.dev.js`). A production build and a page that loads `dist/map-jr-gl.js` by URL do not print it.

<!-- messages:start -->
## Main API

The functions of `@map-jr/map-jr-gl` and the map that they make.

- `[map-jr-gl] createMap(): the description has no "style". Pass the URL of a style or a style object as "style".`
  Error.
- `[map-jr-gl] createMap(): the container is <container>. In a framework, make the map after the element is mounted.`
  Error.
- `[map-jr-gl] createMap(): no element with the id "<container>".`
  Error.
- `[map-jr-gl] the style: the code for the images in metadata["map-jr:images"] did not load, and the map draws the style without them. Check that the files of the library are served next to it.`
  Error.
- `[map-jr-gl] images: the image "<image name>" did not load. Give an SVG document or the URL of an image that the page can read.`
  Error.
- `[map-jr-gl] the style: the image "<image name>" did not load. Give an SVG document or the URL of an image that the page can read.`
  Error.
- `[map-jr-gl] queryFeatures(): the place is not {x, y} or [lng, lat].`
  Error.
- `[map-jr-gl] querySource(): the first argument is not the id of a source.`
  Error.
- `[map-jr-gl] <method>(): "<id>" is not a GeoJSON source of the style.`
  Error.
- `[map-jr-gl] update(): the description has no "style". update() takes the complete description, not only the changed fields. Write map.patch({<field>: …}) to change only some fields.`
  Error.
- `[map-jr-gl] patch(): the description has no "style". Do not set "style" to undefined.`
  Error.
- `[map-jr-gl] once("<type>"): the map was removed.`
  Error.
- `[map-jr-gl] data: the source "<id>" has the type "<type>", and only a GeoJSON source takes data. Use another key in "data", or another id for the source.`
  Error.
- `[map-jr-gl] <call>: the container has height 0, so the map shows nothing. Give the container a height in CSS.`
  Warning, development build only.
- `[map-jr-gl] interactiveLayers: the style has no layer "<layer id>". Write the id of a layer of the style or of "layers".`
  Warning, development build only.
- `[map-jr-gl] the layer "<layer id>" uses the source "<source id>", which the map does not have. A key of "data" makes a source only while it is in "data": keep "<source id>" in "data", or remove the layer.`
  Warning, development build only.
- `[map-jr-gl] queryFeatures(): the style has no layer "<layer id>". In "layers" of the query, write the id of a layer of the style or of "layers" of the description.`
  Warning, development build only.
- `[map-jr-gl] querySource(): the style has no source "<source id>". Write the id of a source of the style or of "sources".`
  Warning, development build only.
- `[map-jr-gl] layers: the layer "<layer id>" has before: "<before id>", but the style has no layer "<before id>", so the layer goes on top. Write the id of a layer of the style.`
  Warning, development build only.
- `[map-jr-gl] layers: the layer "<layer id>" uses the source "<source id>", which the style does not have. Add "<source id>" to "sources", or give its GeoJSON as "<source id>" in "data".`
  Warning, development build only.
- `[map-jr-gl] update(): "<option>" changed, but it is read only when the map is made. To move the map, change "view" or call moveTo().`
  Warning, development build only.
- `[map-jr-gl] update(): "<option>" changed, but it is read only when the map is made. To change it, destroy the map and make a new one.`
  Warning, development build only.
- `[map-jr-gl] queryFeatures(): <place> is not a place. Write a point of the screen {x, y}, a position [lng, lat], or a rectangle [{x, y}, {x, y}].`
  Error, development build only.
- `[map-jr-gl] querySource(): <first argument> is not the id of a source. Write querySource("id", at, options) with the id of a source of the style.`
  Error, development build only.
- `[map-jr-gl] querySource(): "<option>" has an effect only in a query at a point or a position. This query ignores it.`
  Warning, development build only.
- `[map-jr-gl] querySource(): "<option>" is not an option of querySource, which reads the tile data of one source. To find what the style layers draw, call queryFeatures(at, {layers}).`
  Warning, development build only.
- `[map-jr-gl] queryFeatures(): "<option>" is not an option of queryFeatures, which finds what the style layers draw. To read the tile data of a source, call querySource(sourceId, at, options).`
  Warning, development build only.
- `[map-jr-gl] <method>(): "radius" has an effect only in a query at a point or a position. This query ignores it.`
  Warning, development build only.
- `[map-jr-gl] images: a layer gives the parameter "<parameter>" to the image "<image id>", but that image has no slot {{<parameter>}}, so the parameter has no effect. Write {{<parameter>}} in the SVG of "<image id>" in "images", or remove the parameter.`
  Warning, development build only.
- `[map-jr-gl] The description has "glyphs". That field was removed and has no effect: the map loads the glyph files of the style. Remove "glyphs" from the description. To draw text with the fonts of the browser, remove "glyphs" from the style.`
  Warning, development build only.
- `[map-jr-gl] points(): the record <record> has no position of two finite numbers, so it is left out. Make "lngLat" return [lng, lat] for each record.`
  Warning, development build only.
- `[map-jr-gl] globalState: the value of "<key>" is not JSON (a function, a class instance, NaN or a cycle), so the style cannot read it as it is. Give a string, a number, a boolean, an array or a plain object.`
  Warning, development build only.
- `[map-jr-gl] moveTo(): "fitPadding" and "fitMaxZoom" have an effect only with "bounds", so this call ignores them. To set the padding of the map, give "padding" in the description.`
  Warning, development build only.
- `[map-jr-gl] update(): "view" is a view that the map reported earlier, so the map does not move. The map ignores such a view so that a slow application does not pull it back while the user moves it. To return to a stored view, call moveTo(view).`
  Warning, development build only.
- `[map-jr-gl] <target>: "<option>" is not an option of a fit, so it has no effect. For the fit of "bounds", write "fit<option>". "<option>" of the description applies to the map for good.`
  Warning, development build only.
- `[map-jr-gl] sources: the GeoJSON source "<source id>" has no "data", and "data" of the description has no key "<source id>", so the source has no features. Give the source its own "data", or write the features as "data: {<source id>: geojson}".`
  Warning, development build only.
- `[map-jr-gl] hoverState: a feature of the layer "<layer id>" has no id, so it gets no feature state "hover". Give the features ids, or set "promoteId" of the source to a property that has one, or "generateId: true" for the source.`
  Warning, development build only.
- `[map-jr-gl] hoverState: a feature of the layer "<layer id>" has no id, so it gets no feature state "hover". Write a numeric id for each feature into the tiles when you build them, or set "promoteId" of the source to a property that has one.`
  Warning, development build only.
- `[map-jr-gl] locale: <problem>. Pass an object of strings by the keys of MapLibre GL JS, such as {"NavigationControl.ZoomIn": "Zoom avant"}.`
  Warning, development build only.
- `[map-jr-gl] colorScheme: <scheme> is not a colour scheme, so the map uses the light colours. Write 'auto', 'light' or 'dark'.`
  Warning, development build only.
- `[map-jr-gl] style: the object is not a style, because it has no "version" and "layers", and it is not a pair {light, dark}. Give a style object, the URL of a style, or {light: style, dark: style}.`
  Warning, development build only.
- `[map-jr-gl] style: the pair has no "<missing>", so the map uses "<used>" in both colour schemes. Give both "light" and "dark".`
  Warning, development build only.
- `[map-jr-gl] the description has no field "<field>", so the map ignores it. Check the spelling against MapDescription in docs/api.md, or remove "<field>".`
  Warning, development build only.
- `[map-jr-gl] the description has no field "extend", so the map ignores it. Write "sources", "layers" and "terrain" at the root of the description.`
  Warning, development build only.
- `[map-jr-gl] the layer "<layer id>" has in "<property>" a zoom-based "step" or "interpolate" that is inside another expression, or a second one. The map draws it, but MapLibre GL JS rejects the style. Write one ["step", ["zoom"], ...] or ["interpolate", ..., ["zoom"], ...] at the top of the expression (or as the result of a top-level "let", or as one argument of a top-level "coalesce"), and put the other parts in its outputs.`
  Warning, development build only.
- `[map-jr-gl] sprite: <sprite> is not a list of sprites. Write a list of {id, url}, for example [{id: 'pins', url: 'https://example.com/sprites/pins'}], and name an image of it in "icon-image" as "pins:name".`
  Warning, development build only.

## `<map-jr>`

The element `<map-jr>`.

- `[map-jr-gl] <map-jr>: the attribute <attribute> cannot be read, so the element ignores it. Write a number, for example zoom="11".`
  Warning, development build only.
- `[map-jr-gl] <map-jr>: the attribute <attribute> cannot be read, so the element ignores it. Write the longitude and the latitude with a comma between them, for example center="13.4,52.52".`
  Warning, development build only.
- `[map-jr-gl] <map-jr>: the attribute <attribute> cannot be read, so the element ignores it. Write "globe" or "mercator".`
  Warning, development build only.
- `[map-jr-gl] <map-jr>: the attribute <attribute>="false" switches the option off all the same, because an attribute that is there takes effect, whatever its value. To keep the option on, remove <attribute>.`
  Warning, development build only.
- `[map-jr-gl] <map-jr>: the attribute <attribute>="false" switches the option on all the same, because an attribute that is there takes effect, whatever its value. To switch it off, remove <attribute>.`
  Warning, development build only.
- `[map-jr-gl] <map-jr>: the element has no style, so it shows no map. Write the URL of a style in the attribute "map-style", or set the property "mapStyle".`
  Warning, development build only.
- `[map-jr-gl] <map-jr>: the attribute "map-style" was removed and the element has no "mapStyle", so the map keeps the style that it has. To change the style, give another URL in "map-style" or set "mapStyle".`
  Warning, development build only.

## Vue and React

The components of `@map-jr/map-jr-gl/vue`, `@map-jr/map-jr-gl/react` and the Nuxt module.

- `[map-jr-gl] <MapJr>: the template ref has no method "<method>" until the map has loaded. Call it from @load or later, or use useMapInstance() in a component inside MapJr.`
  Error, development build only.
- `[map-jr-gl] MapImage "<image name>" is not inside MapJr, so no map gets the image. Put it into the children of MapJr.`
  Warning.
- `[map-jr-gl] MapImage "<image name>" has no image: its content has no <svg> element. Give an <svg> element as the content, or the URL of an image as "src".`
  Warning.
- `[map-jr-gl] MapImage "<image name>" is not inside MapJr, so no map gets the image. Put it into the content of MapJr.`
  Warning, development build only.
- `[map-jr-gl] MapImage "<image name>" has no image: its content has no <svg> element. Write an <svg> in its slot, or give the URL of an image as "src".`
  Warning, development build only.
- `[map-jr-gl] <MapJr>: the server render failed, and the page has no first view. The map draws in the browser. The cause: <cause>`
  Error.

## Map, styles and loading

The map, the style, its sources and images, and the files of the library. Both entries print these.

- `[map-jr-gl] The source "<source name>": "redFactor", "greenFactor", "blueFactor" and "baseShift" of the encoding "custom" must be finite numbers. The source is read with the encoding "mapbox". Write a number for each one, or leave it out for its default (1, 1, 1 and 0).`
  Warning.
- `[map-jr-gl] fonts: the font "<font name>" did not load from <src> (<message>). The labels use the next font of their "text-font".`
  Error.
- `[map-jr-gl] The texture of the images is full, so this image and the images after it are not drawn. Use fewer or smaller images. (An SVG template is drawn one time for each different set of values.)`
  Error.
- `[map-jr-gl] toBlob(): the browser could not encode the image as <mime>. <err>`
  Error.
- `[map-jr-gl] The styles on this page caused 100 different warnings about expressions and filters. Later ones are not shown.`
  Warning.
- `[map-jr-gl] number-format: Intl.NumberFormat does not accept the options <options> (<message>). The expression gives the number as plain text. Pass a BCP 47 locale, an ISO 4217 currency and a unit that Intl.NumberFormat supports.`
  Warning.
- `[map-jr-gl] Unsupported expression "<op>"`
  Warning.
- `[map-jr-gl] Unsupported filter "<op>"`
  Warning.
- `[map-jr-gl] The map cannot start: WebGL2 is not available (<status>).`
  Error.
- `[map-jr-gl] The map cannot start: WebGL2 is not available.`
  Error.
- `` [map-jr-gl] The worker file is version <worker version> and the page file is version <__VERSION__>. Serve map-jr-gl-worker.js from the same version of the package as the page file, or pass `workerUrl` with the URL of that file. ``
  Warning.
- `[map-jr-gl] The container already has a map. Remove that map first: remove(), or destroy() in the main API.`
  Warning.
- `[map-jr-gl] The image "<image>" has more than <MAX_VARIANTS> different sets of values for its slots, and the others are not drawn. Give its slots values from a small set.`
  Error.
- `[map-jr-gl] The image "<image>" cannot be drawn with the values of its slots (<message>). Check that the SVG is well-formed, also with a value in each slot.`
  Error.
- `` [map-jr-gl] Workers are unavailable (<message>); running on the main thread. If the worker file is not next to the library, pass `workerUrl` or `createWorker`, or use the standalone build. ``
  Warning.
- `[map-jr-gl] Vite's dependency cache does not contain the worker file. Add optimizeDeps: {exclude: ['@map-jr/map-jr-gl', 'maplibre-gl']} to vite.config and restart the dev server.`
  Warning, development build only.
- `[map-jr-gl] Skipping unsupported layer types: <layer types>`
  Warning.
- `[map-jr-gl] The WebGL context was lost again. Call remove() and create the map again later.`
  Error.
- `[map-jr-gl] Worker rendering unavailable, using the main thread: <why>`
  Warning.
- `[map-jr-gl] The map cannot be shown: <message>. Call supported() before you make a map, and show other content when it returns false.`
  Error.
- `[map-jr-gl] The map cannot be shown: <message>.`
  Error.
- `[map-jr-gl] The map could not copy data to its workers (<message>). Pass plain objects (toRaw() in Vue).`
  Error.
- `[map-jr-gl] on("<type>"): the listener after the layer id is not a function.`
  Error.
- `[map-jr-gl] on("<type>"): the second argument is neither a layer id, an array of layer ids nor a listener.`
  Error.
- `[map-jr-gl] the request to <to> was aborted.`
  Error.
- `[map-jr-gl] toBlob(): the map was removed before its image was taken.`
  Error.
- `[map-jr-gl] toBlob(): the browser could not encode the image as <type>.`
  Error.
- `[map-jr-gl] maxPitch <p>: the pitch stops at <MAX_PITCH>, because the library has no elevation of the camera yet. Pass <MAX_PITCH> or less.`
  Warning.
- `[map-jr-gl] setMinPitch(<p>): the pitch must be between 0 and the largest pitch, <maxPitch>. Pass a value in that range, or raise the largest pitch with setMaxPitch first.`
  Error.
- `[map-jr-gl] The style has the projection <t>, which is not supported, so the map uses "mercator".`
  Warning.
- `[map-jr-gl] 3D terrain is not drawn on the globe: they show from zoom <z>, where the map is flat, or use the projection "mercator".`
  Warning.
- `[map-jr-gl] 3D terrain is not drawn on the globe: use the projection "globe", which is flat from zoom 12, or "mercator".`
  Warning.
- `[map-jr-gl] setFeatureState(): the source "<source>" is not GeoJSON, and the id "<id>" is a string. Feature state on a vector source needs the numeric id of the feature in the tile, or "promoteId" on the source.`
  Warning.
- `[map-jr-gl] Style <style>: HTTP <status>`
  Error.
- `[map-jr-gl] The style has no list "layers". Give a style object with "version", "sources" and "layers", or its URL.`
  Error.
- `[map-jr-gl] addControl(): "<pos>" is not a position. Write "top-left", "top-right", "bottom-left" or "bottom-right".`
  Error.
- `[map-jr-gl] addImage("<image name>"): images that draw themselves with WebGL (renderWithWebGL) are not supported. Pass pixels, a canvas, an image or SVG text.`
  Error.
- `[map-jr-gl] The query has no answer: the map <why>.`
  Error.
- `[map-jr-gl] PMTiles <url>: the server ignores Range requests, so each tile would download the whole file (<file size> MB). Serve the file from a server that supports Range requests.`
  Error.
- `[map-jr-gl] addProtocol("pmtiles"): the library reads pmtiles:// URLs itself and does not use this protocol. Remove the addProtocol call.`
  Warning.
- `[map-jr-gl] the request for the <resource> <url>... failed: <reason>`
  Error.
- `[map-jr-gl] the request for the <resource> <url> failed: <reason>`
  Error.
- `[map-jr-gl] the request to <input> did not finish within <ms> ms.`
  Error.
- `[map-jr-gl] The source "<source name>" has no "tiles" and no "url". Give it one of them.`
  Error.
- `[map-jr-gl] The source "<source name>" has encoding "mlt". MapLibre Tiles are not supported; use tiles with encoding "mvt".`
  Error.
- `[map-jr-gl] the style: metadata["map-jr:images"] is not an object of images by name, and the map uses none of them. Write {"name": "<svg ...>"}.`
  Error.
- `[map-jr-gl] the style: the image "<image name>" of metadata["map-jr:images"] is left out, because the style has more than <MAX_STYLE_IMAGES> images. Give an SVG document without references to other files, or the URL of an image.`
  Error.
- `[map-jr-gl] hillshade-method: <hillshade method> is not a method, and the layer uses "standard". Write "standard", "basic", "combined", "igor" or "multidirectional".`
  Warning.
- `[map-jr-gl] hillshade: a layer has <n> lights, and the layer draws the first <LIGHTS>. Give lists of at most <LIGHTS> values.`
  Warning.
- `[map-jr-gl] raster-fade-duration: the property has no effect, and a raster tile shows at once when it has loaded. Remove it, or write 0.`
  Warning.
- `[map-jr-gl] The video source "<id>" could not load any of its "urls". Check the URLs, and that a server of another origin sends CORS headers.`
  Error.

## Controls

The controls of the map.

- `[map-jr-gl] colorScheme(): the control works only in the controls of a map of the main API (createMap).`
  Warning.
- `[map-jr-gl] The control "<control name>" could not be loaded. Check that the files of the library are served.`
  Error.
- `[map-jr-gl] custom(): write custom({key: "my-control", element}) or custom({key: "my-control", onAdd(map) { return element; }, onRemove() {}}).`
  Error, development build only.
- `[map-jr-gl] GeolocateControl: the code of trackUserLocation could not be loaded. Check that the files of the library are served.`
  Error.
- `[map-jr-gl] <control>: the option <option> has no effect.<instead>`
  Warning.

## MapLibre compatibility

The entry `@map-jr/map-jr-gl/maplibre-compat`.

- `[map-jr-gl] <member> has no effect: this library does not have that feature.`
  Warning.
- `` [map-jr-gl] <method>: the result was used without `await` and was not complete (<had> of <has> features). Tile data is in a worker. Change const features = map.<method>(...); to const features = await map.<method>(...); (this also works in MapLibre GL JS). See "Feature queries" in docs/maplibre-compatibility.md. ``
  Warning.
- `[map-jr-gl] setTransformCameraUpdate: the function changed the camera of a movement. This library draws that camera only when the movement ends (react-map-gl: onMove did not set viewState to e.viewState). To keep the map in a region, use the option maxBounds.`
  Warning.
- `[map-jr-gl] setSourceTileLodParams: there is no source "<sourceId>". Add the source first, or leave out the ID for all sources.`
  Error.
- `[map-jr-gl] setTransformConstrain has no effect: the function needs the map to draw on the main thread. Pass renderer: 'main' to new Map().`
  Warning.
- `[map-jr-gl] Map: the option glyphs was removed and has no effect; the map loads the glyph files of the style. Remove the option. To draw text with the fonts of the browser, remove "glyphs" from the style.`
  Warning.
- `[map-jr-gl] Map: the option locale is not an object. Pass an object such as {"NavigationControl.ZoomIn": "Zoom avant"}.`
  Warning.
- `[map-jr-gl] new Map(): the option projection has no effect, as in MapLibre GL JS 6.17. Put "projection": {"type": "globe"} into the style, or call map.setProjection({type: "globe"}) after the style has loaded.`
  Warning.
- `[map-jr-gl] new Map(): canvasContextAttributes.preserveDrawingBuffer has no effect. Read the canvas with map.toBlob(), and remove the option.`
  Warning.
- `[map-jr-gl] the style: the code for metadata["map-jr:images"] did not load, so the map has no images of the style. Serve the files of the library together.`
  Error.
- `[map-jr-gl] getSource("<id>").setClusterOptions(options): "options" must be an object with cluster, clusterMaxZoom or clusterRadius.`
  Error.
- `[map-jr-gl] getSource("<id>").setUrl(url): "url" must be a string.`
  Error.
- `[map-jr-gl] getSource("<id>").setTiles(tiles): "tiles" must be an array of URL strings.`
  Error.
- `[map-jr-gl] <method>(): the feature has no "id". Give the source features an id, or set "promoteId" on the source.`
  Warning.
- `[map-jr-gl] map.painter does not exist in @map-jr/map-jr-gl/maplibre-compat. To check for WebGL, use supported(); a failed start fires "error" with a GPUInitializationError.`
  Warning, development build only.
- `[map-jr-gl] the style: the image "<image name>" did not load. Give an SVG document or the URL of an image that the page can read.`
  Error.
- `[map-jr-gl] <type>: the option <n> has no effect. Remove it; see "What is different" in docs/maplibre-compatibility.md.`
  Warning.
- `[map-jr-gl] setWorkerUrl(): this is the worker file of MapLibre GL JS, which this library cannot use. Remove the call; the library finds map-jr-gl-worker.js itself.`
  Warning.
- `[map-jr-gl] <member> is private state of MapLibre GL JS and does not exist in @map-jr/map-jr-gl/maplibre-compat. <advice>`
  Warning.
- `[map-jr-gl] <member> is not available in @map-jr/map-jr-gl/maplibre-compat. Remove the use, or see docs/maplibre-compatibility.md for what replaces it.`
  Warning.

## Server rendering

The functions of `@map-jr/map-jr-gl/server`.

- `[map-jr-gl] server render: "<option name>" is <option value>. Pass a number that is 0 (no limit) or more.`
  Error.
- `[map-jr-gl] server render: "allowHosts" is <allowHosts>. Pass a list of host names without a scheme, a port or a path, for example ["tiles.example.com"].`
  Error.
- `[map-jr-gl] server render: the host of <url> is not in "allowHosts". Add "<host>" to "allowHosts" if the render can request it.`
  Error.
- `[map-jr-gl] server render: the requests took longer than the "timeout" of <total> ms; the request to <first> was not complete. Pass a larger "timeout", or 0 for no limit.`
  Error.
- `[map-jr-gl] server render: the request to <first> took longer than the "requestTimeout" of <each> ms. Pass a larger "requestTimeout", or 0 for no limit.`
  Error.
- `[map-jr-gl] server render: the request to <first> was redirected more than 5 times.`
  Error.
- `[map-jr-gl] server render: the response of <first> is larger than "maxBytes" (<max> bytes). Pass a larger "maxBytes", or leave the source out of the style.`
  Error.
- `[map-jr-gl] tileZoomOffset: <dz> is not a whole number. Write for example tileZoomOffset: 2 (tiles 2 zooms lower) or -1 (tiles 1 zoom higher), or leave it out for 0.`
  Error.
- `[map-jr-gl] renderElement(): "<attribute name>" is not the name of an attribute that the element can have: an event handler attribute runs script. Give names such as "id", "class" or "style".`
  Error.
- `[map-jr-gl] renderElement(): "<attribute name>" is not the name of an attribute. Give names such as "id", "class" or "style".`
  Error.
- `[map-jr-gl] renderElement(): the server render failed, and the element has no first view. The map draws in the browser. The cause: <cause>`
  Error.
<!-- messages:end -->
