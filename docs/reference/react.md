# React components and hooks

The entry `@map-jr/map-jr-gl/react` renders a map of `@map-jr/map-jr-gl` as a React component, for React 18 and 19.
The component `MapJr` passes its props to the map as one [description](description.md) after each render, and the
map applies what is different.

```jsx
import {useState} from 'react';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/react';
import {navigation} from '@map-jr/map-jr-gl/controls';

export function OfficeMap() {
  const [selected, setSelected] = useState(null);
  return (
    <div style={{height: 400}}>
      <MapJr
        mapStyle="https://styles.map-jr.org/1/elevation-zero.json"
        initialView={{center: [-74.0065, 40.7085], zoom: 15}}
        controls={[navigation()]}
        interactiveLayers={['poi_z14', 'poi_z15', 'poi_z16']}
        onClick={event =>
          setSelected(
            event.features[0]
              ? {lngLat: event.lngLat, name: event.features[0].properties.name}
              : null,
          )
        }
      >
        {selected && (
          <MapOverlay
            lngLat={selected.lngLat}
            popup
            onClose={() => setSelected(null)}
          >
            {selected.name}
          </MapOverlay>
        )}
      </MapJr>
    </div>
  );
}
```

## `MapJr`

The map as a component. It fills its parent element, so give the parent a height.

Every field of the [description](description.md#mapdescription) is a prop with the same name and the same value,
except `style`, which is the prop `mapStyle`. The prop `style` is the CSS style of the element. The table lists the
props that the description does not have, and `onViewChange`, a field of the description that the table also
lists.

<!-- ref:ReactMapJrProps:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `mapStyle` **required** | [`MapDescription`](description.md#mapdescription)`['style']` | | The style: a style object, the URL of a style, or `{light, dark}`. |
| `onViewChange` | `(view: `[`View`](state.md#view)`) => void` | | Called with the first view once, before `load`, and then with the new view at each change of the view. |
| `onHover` | `(features: `[`RenderedFeature`](types.md#renderedfeature)`[]) => void` | | Called with the features of `interactiveLayers` under the pointer, the top one first, when they change. |
| `onLoad` | `() => void` | | Called when the style and the first tiles have loaded. |
| `onIdle` | `() => void` | | Called each time the camera is still and nothing loads. |
| `onError` | `(error: Error, info: MapErrorInfo) => void` | | Called with each error of the map. |
| [`firstView`](#firstview) | `string` | | The first view rendered on a server, as HTML: the result of `renderFirstView` from `@map-jr/map-jr-gl/server`. |
| `className` | `string` | | A CSS class to add to the element, after the class `map-jr-react`. |
| `style` | `CSSProperties` | | The CSS style of the element, merged over `{position: 'relative', width: '100%', height: '100%'}`. |
| `children` | `ReactNode` | | Content over the map, and `MapOverlay` elements. |
<!-- ref:ReactMapJrProps:end -->

### Props that are created in each render

The map compares each prop with the value of the last render. A new object or list with the same content does no
work, so `controls={[navigation()]}`, `interactiveLayers={['poi_z14']}` and a style object can be written in the JSX.
A function prop, such as `onClick` or `transformRequest`, can also be a new arrow function in each render: the map
calls the function of the last render.

The map compares each value of [`data`](description.md#data) by identity. A new object loads the data again, also when
its content is the same. Keep the object in state or in `useMemo` until the data changes.

```jsx
import {useMemo} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';

export function Stations({stations}) {
  // A new FeatureCollection only when the list of stations changes.
  const data = useMemo(
    () => ({
      stations: {
        type: 'FeatureCollection',
        features: stations.map(s => ({
          type: 'Feature',
          properties: {name: s.name},
          geometry: {type: 'Point', coordinates: s.lngLat},
        })),
      },
    }),
    [stations],
  );
  return (
    <div style={{height: 400}}>
      <MapJr
        mapStyle="https://styles.map-jr.org/1/elevation-zero.json"
        initialView={{center: [-74.0065, 40.7085], zoom: 12}}
        data={data}
        layers={[
          {
            id: 'stations',
            type: 'circle',
            source: 'stations',
            paint: {'circle-radius': 6, 'circle-color': '#d6453d'},
          },
        ]}
      />
    </div>
  );
}
```

### The `terrain()` control

A click on the control [`terrain()`](controls.md#terrain) sets the terrain of the map and calls its option
`onTerrainChange` with the new value. The component passes the prop `terrain` to the map again in its next render,
and the prop then overrides the click. Keep the value of `onTerrainChange` in state and pass it as `terrain`:

```jsx
import {useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';
import {navigation, terrain} from '@map-jr/map-jr-gl/controls';

export function Relief() {
  // null: flat until the user clicks the button.
  const [relief, setRelief] = useState(null);
  return (
    <div style={{height: 500}}>
      <MapJr
        mapStyle="https://styles.map-jr.org/1/elevation.json"
        initialView={{center: [7.6586, 45.9763], zoom: 12.4, pitch: 60}}
        terrain={relief}
        controls={[
          navigation(),
          terrain({
            source: 'terrarium',
            exaggeration: 1.5,
            onTerrainChange: setRelief,
          }),
        ]}
      />
    </div>
  );
}
```

### Events of the map

Each event of the map has a prop: `on` and the name of the event with a capital first letter, such as `onMoveend`,
`onZoomend`, `onSourcedata` and `onStyleimagemissing`. The prop for `style.load` is `onStyleload`. The handler
receives the event object of [`listen`](map.md#listen) of the map. See [Events](events.md#mapevents) for the list of
events.

`onLoad`, `onIdle`, `onError` and `onHover` are props of the table above, and `onClick` and `onViewChange` are
fields of the description. These six props receive the value that their entry states, not an event object of
`listen`.

Without `onError`, the map writes each error to the console. With `onError`, the map calls it and writes nothing.
`onError` receives the `Error` and a [`MapErrorInfo`](events.md#maperrorinfo) object, whose `sourceId` names the
source when the error belongs to a source: `onError={(error, {sourceId}) => …}`.

### The ref

A ref on `MapJr` receives the map, a [`MapInstance`](map.md#mapinstance) of the main API, for methods such as `queryFeatures`
and `moveTo`. It is not the `Map` of `@map-jr/map-jr-gl/maplibre-compat`: to animate the camera, call
`moveTo({...view, duration: 500})` in place of `flyTo`.

The component creates the map in an effect and sets the ref in the render after that. The ref is therefore `null`
during the first render, and also in the effects of the parent that run when it mounts. Read it in an event handler
or in `onLoad`, or call [`useMap`](#usemap) in a child component.

```jsx
import {useRef} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';

export function ZoomToCity() {
  const map = useRef(null);
  return (
    <div style={{height: 400}}>
      <button
        onClick={() =>
          map.current?.moveTo({
            center: [-74.0065, 40.7085],
            zoom: 11,
            duration: 800,
          })
        }
      >
        New York
      </button>
      <MapJr
        ref={map}
        mapStyle="https://styles.map-jr.org/1/elevation-zero.json"
        initialView={{center: [0, 20], zoom: 1}}
      />
    </div>
  );
}
```

### `firstView`

`firstView` shows a first view that a server rendered, before the map in the browser has drawn. Its value is the
HTML that [`renderFirstView`](server.md#renderfirstview) of `@map-jr/map-jr-gl/server` returns. On the server,
`MapJr` renders its element with this HTML inside. In the browser, the component reads the prop on its first render
only, and React reports no hydration mismatch for the HTML. The map removes the HTML when it has loaded the tiles of
its first view.

The built files of the entry start with `'use client'`, so a server component of Next.js (App Router) imports
`MapJr` from the entry and passes `firstView` to it. Next.js sends the props of a client component to the browser,
so the page contains the HTML of `firstView` twice.

```jsx
import {renderFirstView} from '@map-jr/map-jr-gl/server';
import {MapJr} from '@map-jr/map-jr-gl/react';

export default async function Page() {
  // The same style and view as the map in the browser, at the size that the map
  // has on most screens.
  const firstView = await renderFirstView({
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    center: [-74.0065, 40.7085],
    zoom: 13.6,
    width: 800,
    height: 500,
  });
  return (
    <div style={{height: 500}}>
      <MapJr
        mapStyle="https://styles.map-jr.org/1/elevation-zero.json"
        initialView={{center: [-74.0065, 40.7085], zoom: 13.6}}
        firstView={firstView}
      />
    </div>
  );
}
```

See [Show the first view before the script runs](../guide/server-rendering.md#show-the-first-view-before-the-script-runs) for the size of the render and how the page shows it.

## `MapOverlay`

`MapOverlay` places its React children at a position of the map, as a marker or a popup. Use it inside `MapJr`. Its
props are the options of [`overlay`](map.md#overlay) of the map ([`OverlayOptions`](map.md#overlayoptions)), and `children`. The map
applies the props of each render.

With `onClose`, the popup has a button that closes it, and a popup cannot be dragged. After a drag, the element
stays where the user dropped it until `lngLat` changes. To keep the position, set it in
`onDragEnd`.

```jsx
import {useState} from 'react';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/react';

export function HomePicker() {
  const [home, setHome] = useState([-74.0065, 40.7085]);
  return (
    <div style={{height: 400}}>
      <MapJr
        mapStyle="https://styles.map-jr.org/1/elevation-zero.json"
        initialView={{center: home, zoom: 14}}
      >
        <MapOverlay lngLat={home} anchor="bottom" draggable onDragEnd={setHome}>
          <div
            style={{
              background: '#d6453d',
              color: '#fff',
              padding: '4px 8px',
              borderRadius: 4,
            }}
          >
            Home
          </div>
        </MapOverlay>
      </MapJr>
    </div>
  );
}
```

For many points, a symbol layer in [`layers`](description.md#layers) renders much faster than one `MapOverlay` for
each point.

## `MapImage`

`MapImage` adds an image for the style layers of the map, for `icon-image` and the pattern properties. Use it inside
`MapJr`. The image is an `<svg>` element in the children, or the URL of an image in `src`.

<!-- ref:ReactMapImageProps:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `name` **required** | `string` | | The name of the image, for `icon-image` of a style layer. |
| `params` | `readonly string[]` | | The names of the parameters of the image. |
| `src` | `string` | | The URL of an image, in place of an SVG in `children`. |
| `width` | `number` | | The width in CSS pixels. |
| `height` | `number` | | The height in CSS pixels. |
| `pixelRatio` | `number` | `1` | The number of image pixels for one CSS pixel, for example 2 for an image "@2x". |
| `children` | `ReactNode \| ((params: Record<P, string>) => ReactNode)` | | An `<svg>` element, or a function that receives the parameters and returns one. |
<!-- ref:ReactMapImageProps:end -->

In the table, `P` is `string`: the names that `params` lists.

Without `width` and `height`, an SVG has the size of its `viewBox`, or else of its `width` and `height` attributes.
An image from `src` has its own size.

The children can be a function that receives the parameters of `params` and returns an `<svg>` element. Each
parameter is a slot of an [image template](description.md#images), not a value of React. The map fills it for each
feature of the layer: from the property of the feature with the name of the parameter, or from `params` of the
`image` expression of the layer. With TypeScript, a parameter that is not in `params` is a type error.

```jsx
import {MapJr, MapImage} from '@map-jr/map-jr-gl/react';

const places = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {color: '#d6453d'},
      geometry: {type: 'Point', coordinates: [-74.006, 40.7128]},
    },
    {
      type: 'Feature',
      properties: {color: '#2f7fd1'},
      geometry: {type: 'Point', coordinates: [-73.9857, 40.7484]},
    },
  ],
};

export function Places() {
  return (
    <div style={{height: 400}}>
      <MapJr
        mapStyle="https://styles.map-jr.org/1/elevation-zero.json"
        initialView={{center: [-73.996, 40.73], zoom: 11.5}}
        sources={{places: {type: 'geojson', data: places}}}
        layers={[
          {
            id: 'places',
            type: 'symbol',
            source: 'places',
            layout: {
              'icon-image': 'pin',
              'icon-anchor': 'bottom',
              'icon-allow-overlap': true,
            },
          },
        ]}
      >
        <MapImage name="pin" params={['color']}>
          {({color}) => (
            <svg viewBox="0 0 24 31">
              <path
                fill={color}
                stroke="#fff"
                d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"
              />
            </svg>
          )}
        </MapImage>
      </MapJr>
    </div>
  );
}
```

React renders the SVG once, outside the page, and the map draws it once for each different set of values. A
component inside the SVG can change it, and the map then uses the new SVG. An image of `MapImage` overrides an image
of the prop `images` with the same name.

## `useMap`

```ts
useMap(): MapInstance | null
```

**Returns** the map of the `MapJr` that the component is in, or `null` until the map is created. Call it in a
component inside `MapJr`.

## `useMapState`

```ts
useMapState<T>(
  select: (state: MapState) => T,
  map?: MapInstance | null,
): T | undefined
```

Returns a part of the [state of the map](state.md#mapstate), and renders the component again when that part
changes.

| Parameter | Type | Description |
|---|---|---|
| `select` | `(state: MapState) => T` | A function that returns a part of the state, such as `state.view.zoom`. |
| `map` | `MapInstance \| null` | The map to read. Without it, the map of the `MapJr` that the component is in. |

**Returns** the value of `select`, or `undefined` until the map is created.

The component renders again when the result of `select` changes. `select` can return a part of the state as it is
(`state.hover`, `state.view`), a number or a string, or a new plain object or array that combines several parts, such
as `state => ({zoom: state.view.zoom, pitch: state.view.pitch})`.

The hook compares a new result with the last one one
level deep: when both are plain objects or arrays with the same keys and identical members (`Object.is`), it returns
the last result and the component does not render. A deeper object that `select` makes again at each call, such as
`{view: {zoom}}`, is not equal to the last one, so the component renders at each change of the state.

```jsx
import {MapJr, useMap, useMapState} from '@map-jr/map-jr-gl/react';

function ZoomButton() {
  const map = useMap();
  const zoom = useMapState(state => state.view.zoom);
  return (
    <button
      style={{position: 'absolute', top: 8, left: 8}}
      onClick={() => map?.moveTo({zoom: zoom + 1, duration: 300})}
    >
      Zoom {zoom?.toFixed(1)}
    </button>
  );
}

export function ZoomMap() {
  return (
    <div style={{height: 400}}>
      <MapJr
        mapStyle="https://styles.map-jr.org/1/elevation-zero.json"
        initialView={{center: [-74.0065, 40.7085], zoom: 12}}
      >
        <ZoomButton />
      </MapJr>
    </div>
  );
}
```

To read the state once, in an event handler, without a render at each change, call `map.state.get()`.

## See also

- [The description](description.md) for every field that is also a prop of `MapJr`.
- [Server rendering](../guide/server-rendering.md) for `firstView` and the options of the server render.
