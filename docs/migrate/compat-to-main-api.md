# From the compat entry to the main API

This page moves a map from the compat entry (`@map-jr/map-jr-gl/maplibre-compat`, the API of MapLibre GL JS) to the
main API (`@map-jr/map-jr-gl`). In the main API, one object, the description
([`MapDescription`](../reference/description.md)), states the style, the sources, the layers, the view and the
controls. In place of a sequence of calls such as `addSource` and `addLayer`, you pass the changed fields to
[`patch`](../reference/map.md#patch), and the map applies what is different. `patch` keeps the fields that it does not
receive, and [`update`](../reference/map.md#update) replaces the whole description.

Both entries render with the same
engine and read the same styles, so the map looks the same.

## Steps

1. Replace `new Map(options)` with `createMap(container, description)`. `center`, `zoom`, `bearing` and `pitch` move
   into [`initialView`](../reference/description.md#initialview), and a position is an array `[lng, lat]`.

   Before:

   ```js
   import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

   const map = new Map({container: 'map', style: 'https://styles.map-jr.org/1/elevation-zero.json', center: [-74.0065, 40.7085], zoom: 13});
   ```

   After:

   ```js
   import {createMap} from '@map-jr/map-jr-gl';

   const map = createMap('map', {
     style: 'https://styles.map-jr.org/1/elevation-zero.json',
     initialView: {center: [-74.0065, 40.7085], zoom: 13},
   });
   ```

2. Move the sources and layers that the code adds in the `load` event into
   [`sources`](../reference/description.md#sources) and [`layers`](../reference/description.md#layers) of the
   description. The map adds them as soon as the style has loaded, so the code needs no `load` listener. `before`
   in a layer replaces the second argument of `addLayer`.

   Before:

   ```js
   import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

   const map = new Map({container: 'map', style: 'https://styles.map-jr.org/1/elevation-zero.json', center: [-74.0065, 40.7085], zoom: 13});
   map.on('load', () => {
     map.addSource('stations', {type: 'geojson', data: {type: 'Point', coordinates: [-74.0065, 40.7085]}});
     map.addLayer({id: 'stations', type: 'circle', source: 'stations', paint: {'circle-radius': 8, 'circle-color': '#d6453d'}});
   });
   ```

   After:

   ```js
   import {createMap} from '@map-jr/map-jr-gl';

   const map = createMap('map', {
     style: 'https://styles.map-jr.org/1/elevation-zero.json',
     initialView: {center: [-74.0065, 40.7085], zoom: 13},
     sources: {stations: {type: 'geojson', data: {type: 'Point', coordinates: [-74.0065, 40.7085]}}},
     layers: [{id: 'stations', type: 'circle', source: 'stations', paint: {'circle-radius': 8, 'circle-color': '#d6453d'}}],
   });
   ```

3. Replace each call that changes the style, such as `setPaintProperty`, `setFilter` or `getSource(id).setData`,
   with a call of [`patch`](../reference/map.md#patch). `patch` applies the fields that it receives and keeps the
   other fields of the description. A field is replaced as a whole, so pass the complete list of `layers`. Set the
   features of a GeoJSON source with [`data`](../reference/description.md#data): a key of `data` that no source has
   creates a GeoJSON source with that id.

   Before:

   ```js
   import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

   const map = new Map({container: 'map', style: 'https://styles.map-jr.org/1/elevation-zero.json', center: [-74.0065, 40.7085], zoom: 13});
   map.on('load', () => {
     map.addSource('stations', {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
     map.addLayer({id: 'stations', type: 'circle', source: 'stations', paint: {'circle-radius': 8, 'circle-color': '#d6453d'}});
   });

   function showStation(lngLat) {
     map.getSource('stations').setData({type: 'Point', coordinates: lngLat});
     map.setPaintProperty('stations', 'circle-color', '#2b6cb0');
   }
   ```

   After:

   ```js
   import {createMap} from '@map-jr/map-jr-gl';

   const station = color => ({id: 'stations', type: 'circle', source: 'stations', paint: {'circle-radius': 8, 'circle-color': color}});
   const map = createMap('map', {
     style: 'https://styles.map-jr.org/1/elevation-zero.json',
     initialView: {center: [-74.0065, 40.7085], zoom: 13},
     data: {stations: {type: 'FeatureCollection', features: []}},
     layers: [station('#d6453d')],
   });

   function showStation(lngLat) {
     map.patch({data: {stations: {type: 'Point', coordinates: lngLat}}, layers: [station('#2b6cb0')]});
   }
   ```

4. Replace `Marker` and `Popup` with [`overlay`](../reference/map.md#overlay), and the control classes
   with the functions of [`@map-jr/map-jr-gl/controls`](../reference/controls.md) in
   [`controls`](../reference/description.md#controls). See [Markers and popups](../guide/markers-and-popups.md) for
   both entries side by side.

5. Replace `map.on(type, listener)` with `map.listen(type, listener)`, which returns a function that removes the
   listener. For a click on the features of a layer, list the layer in
   [`interactiveLayers`](../reference/description.md#interactivelayers) and set
   [`onClick`](../reference/description.md#onclick): the event has the features as `features`.

   Before:

   ```js
   import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

   const map = new Map({container: 'map', style: 'https://styles.map-jr.org/1/elevation-zero.json', center: [-74.0065, 40.7085], zoom: 15});
   map.on('click', 'building', event => console.log(event.features[0].properties));
   map.on('moveend', () => console.log(map.getZoom()));
   ```

   After:

   ```js
   import {createMap} from '@map-jr/map-jr-gl';

   const map = createMap('map', {
     style: 'https://styles.map-jr.org/1/elevation-zero.json',
     initialView: {center: [-74.0065, 40.7085], zoom: 15},
     interactiveLayers: ['building'],
     onClick: event => console.log(event.features[0]?.properties),
   });
   map.listen('moveend', () => console.log(map.state.get().view.zoom));
   ```

6. Remove the code that waits for `load` before it reads the map. Read the view and the other state from
   [`map.state`](../reference/state.md), a store whose `get()` returns the state and whose `subscribe(fn)` calls `fn`
   at each change.

## Names that change

| Compat entry | Main API | Notes |
|---|---|---|
| `new Map({container, style, center, zoom, bearing, pitch})` | `createMap(container, {style, initialView: {center, zoom, bearing, pitch}})` | `initialView` also accepts `bounds`. |
| `map.remove()` | `map.destroy()` | |
| `map.setStyle(style)` | `map.patch({style})` | The sources and layers of the description stay on the new style. |
| `map.addSource(id, source)`, `map.removeSource(id)` | `sources` of the description | |
| `map.addLayer(layer, beforeId)`, `map.removeLayer(id)` | `layers` of the description, with `before: beforeId` | A layer of the style itself is not removed; hide it with a style object of your own. |
| `setPaintProperty`, `setLayoutProperty`, `setFilter`, `setLayerZoomRange` on a layer of `layers` | The changed layer in `layers` | The map applies the change in place. |
| The same methods on a layer of the style | `map.patch({style})` with a style object in which the layer is changed | Load the style JSON with `fetch` once. When only layers changed, the map updates those layers in place. |
| `map.getSource(id).setData(data)` | `map.patch({data: {[id]: data}})` | Pass a new object: the map compares the value by identity. |
| `setGlobalStateProperty(name, value)` | `globalState` of the description | |
| `setTerrain`, `setProjection`, `setPadding`, `setMaxBounds`, `setMinZoom`, `setMaxZoom`, `setMaxPitch` | `terrain`, `projection`, `padding`, `maxBounds`, `minZoom`, `maxZoom`, `maxPitch` of the description | |
| `addImage(name, image)` | `images` of the description | |
| `jumpTo(view)` | `map.moveTo(view)` | See [The camera](../reference/map.md#moveto). |
| `easeTo(view)` | `map.moveTo({...view, duration: 500})` | The default `duration` of `moveTo` is 0. For `padding` of `easeTo`, set `padding` of the description. |
| `flyTo(view)` | `map.moveTo({...view, fly: true})` | |
| `fitBounds(bounds, options)` | `map.fitBounds(bounds, options)` | `bounds` is `[[west, south], [east, north]]` or `[west, south, east, north]`. |
| `getCenter()`, `getZoom()`, `getBearing()`, `getPitch()`, `getBounds()` | `map.state.get().view` | `center` is `[lng, lat]`, and `bounds` is `[[west, south], [east, north]]`. |
| A view that follows the application | `view` and `onViewChange` of the description | See [`view` and `onViewChange`](../reference/description.md#view-and-onviewchange). |
| `map.on(type, fn)`, `map.off(type, fn)` | `const stop = map.listen(type, fn)`, `stop()` | `lngLat` of an event is `[lng, lat]`. |
| `map.once(type, fn)` | `await map.once(type)` | It returns a promise of the event. |
| `map.on('click', layerId, fn)` | `interactiveLayers` and `onClick` | |
| `map.on('mouseenter', layerId, fn)` and a pointer cursor | `interactiveLayers` | The cursor is `pointer` over these layers, and `map.state.get().hover` has their features. |
| `map.getCanvas().style.cursor = value` | `cursor` of the description | |
| `queryRenderedFeatures(geometry, options)` | `map.queryFeatures(at, options)` | `at` is a point `{x, y}`, a position `[lng, lat]` or a box of two points. |
| `querySourceFeatures(id, options)` | `map.querySource(id, at, options)` | `querySource` returns only the features in the view. |
| `setFeatureState`, `removeFeatureState` | `map.setFeatureState`, `map.removeFeatureState` | The same arguments. |
| `new Marker()`, `new Popup()` | `map.overlay(element, {lngLat, popup})` | |
| `map.addControl(new NavigationControl())` | `controls: [navigation()]` | The functions are in `@map-jr/map-jr-gl/controls`. |
| `locale`, `cooperativeGestures`, `transformRequest`, `hash`, `interactive`, `renderer`, `attributionControl` | `locale`, `cooperativeGestures`, `transformRequest`, `hash`, `interactive`, `renderer`, `attribution` | `hash`, `interactive`, `renderer` and `attribution` are read only when the map is created. |

## What the main API does not have

The main API has no method for a camera that moves step by step (`panBy`, `zoomIn`, `rotateTo`), no custom layers
(`type: 'custom'`), and no method that changes one property of a layer of the style. To change such a layer,
pass the style as an object with the changed layer to `style`. Keep the compat entry for a page that needs a
plugin for MapLibre GL JS: see [Wrappers and plugins](wrappers.md).

## See also

- [The description](../reference/description.md) for every field of `MapDescription`.
- [The map](../reference/map.md) for `update`, `patch`, the queries and the other members of `MapInstance`.
- [The compat entry](../reference/maplibre-compat.md) for every member of the compat `Map`.
