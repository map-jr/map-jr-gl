# React

The entry `@map-jr/map-jr-gl/react` has a component and hooks for React 18 and 19. They are a thin layer over
[the main API](api.md): after each render, the component gives its props to the map as one description.

## The component

```jsx
import {useMemo, useState} from 'react';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/react';
import {navigation, scale} from '@map-jr/map-jr-gl/controls';

export function Places({places}) {
  const [view, setView] = useState({center: [-74.0065, 40.7085], zoom: 13.6});
  const [selected, setSelected] = useState(null);
  const pins = useMemo(() => ({
    id: 'places',
    svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="{{color}}"/></svg>',
    width: 24, height: 24,
    data: places.map(p => ({lngLat: p.lngLat, props: {color: p.color}})),
  }), [places]);

  return (
    <div style={{height: 400}}>
      <MapJr
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
        view={view} onViewChange={setView}
        markers={[pins]}
        controls={[navigation(), scale({position: 'bottom-left'})]}
        interactiveLayers={['poi_r1']}
        onClick={e => setSelected(e.features[0] ? {lngLat: e.lngLat, name: e.features[0].properties.name} : null)}
      >
        {selected && <MapOverlay lngLat={selected.lngLat} popup onClose={() => setSelected(null)}>{selected.name}</MapOverlay>}
      </MapJr>
    </div>
  );
}
```

The component fills its parent element. Give the parent a height.

### Props

The props are the fields of the description of a map (see [the main API](api.md)), with these differences:

| Prop | Meaning |
|---|---|
| `mapStyle` | The style: an object or a URL. Required. (`style` is the CSS style of the element.) |
| `view`, `onViewChange` | A view that your component owns: write each change back. Without `view`, the map starts at `initialView` and the user moves it. |
| `onClick`, `onHover`, `onLoad`, `onIdle`, `onError` | Events of the map. `onError` gets each error (an `Error`). Without it, the map writes each error to the console. |
| `onMoveend`, `onZoomend`, `onStyleimagemissing`, `onSourcedata` and the others | A prop for each other event of the map: `on`, and the name of the event with a capital first letter (`onStyleload` for `style.load`). The value is the event of `listen` of the main API. See [Events](api.md#events) for the list. For an image that the style asks for and the map does not have, add an image with the name `event.id` to the prop `images` in `onStyleimagemissing`: see [An image that the style asks for](api.md#an-image-that-the-style-asks-for). |
| `firstView` | The first view from a server. See below. |
| `initialView` | The view at the start, as in the main API: a view, or `{bounds, padding}` to start with a box in view. To render the same box on the server, give `bounds` and `padding` to `renderFirstView`. |
| `className`, `style` | For the element of the component. |
| `children` | Content over the map, and `MapOverlay` elements. |

A ref on the component gets the map (the `MapHost` of [the main API](api.md), for `queryFeatures`, `moveTo`,
`fitBounds`). The component creates the map in an effect, so the ref is `null` during the first render and in the
effects of the parent that run at mount. Read the ref in an event handler or after `onLoad`, or put the code in a
child component that calls `useMap()`.

`ref.current.map` (and `useMap().map`) is the core map of the library, not the `Map` of
`@map-jr/map-jr-gl/maplibre-compat`: it has no `setBearing`, `setZoom` or `flyTo`. See `map` in
[the main API](api.md). In place of `flyTo`, call `moveTo({...view, duration})`: it eases the camera to the view.

### What you can make again in each render

The map compares each prop with the last one. A prop that has a new object with the same content does no work:
you can write `controls={[navigation()]}`, `interactiveLayers={['places']}` and a style object in the JSX.

Two things are compared by identity only, because they can be large: the `data` of a marker layer, and each value of
the `data` prop (GeoJSON for sources of the style). Keep them (`useMemo`, state) until they change, as in the example.

## Hooks

Use these in a component inside `MapJr`.

```jsx
import {useMap, useMapState} from '@map-jr/map-jr-gl/react';

function Zoom() {
  const zoom = useMapState(state => state.view.zoom);   // renders again only when the zoom changes
  const map = useMap();                                 // the map, when it has started
  return <button onClick={() => map?.moveTo({zoom: 12, duration: 500})}>Zoom {zoom?.toFixed(1)}</button>;
}
```

`useMapState` takes a function that returns a part of the state. Return a part as it is (`state.hover`,
`state.view.zoom`), not a new object.

To read the state once, in an event handler, without a new render on each change, call `state.get()` of the map:

```jsx
import {useMap} from '@map-jr/map-jr-gl/react';

function ZoomIn() {
  const map = useMap();
  return <button onClick={() => map?.moveTo({zoom: map.state.get().view.zoom + 1, duration: 300})}>+</button>;
}
```

## Elements of the page on the map

`MapOverlay` puts its children at a position of the map. The props are `lngLat`, `anchor`, `offset`, `popup` and
`onClose`, as for `overlay` in [the main API](api.md). The children are React content. For many markers, use the
`markers` prop.

`MapImage` gives an image to the style layers of the map. Its content is an `<svg>` element, or a function that gets
the parameters of the image and returns one. A layer uses the image by its name in `icon-image`.

```jsx
import {MapJr, MapImage} from '@map-jr/map-jr-gl/react';

const places = {type: 'FeatureCollection', features: [
  {type: 'Feature', properties: {color: '#d6453d'}, geometry: {type: 'Point', coordinates: [-74.006, 40.7128]}},
  {type: 'Feature', properties: {color: '#2f7fd1'}, geometry: {type: 'Point', coordinates: [-73.9857, 40.7484]}},
]};
const extend = {
  sources: {places: {type: 'geojson', data: places}},
  layers: [{id: 'places', type: 'symbol', source: 'places', layout: {'icon-image': 'pin', 'icon-anchor': 'bottom', 'icon-allow-overlap': true}}],
};

export default function Places() {
  return (
    <div style={{height: 400}}>
      <MapJr mapStyle="https://tiles.openfreemap.org/styles/liberty" initialView={{center: [-73.996, 40.73], zoom: 11.5}} extend={extend}>
        <MapImage name="pin" params={['color']}>
          {({color}) => <svg viewBox="0 0 24 31"><path fill={color} stroke="#fff" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>}
        </MapImage>
      </MapJr>
    </div>
  );
}
```

The props are `name` (required), `params`, `src` (the URL of an image, in place of the content), `width`, `height`
and `pixelRatio`. A parameter is not a value of React. Each feature of the layer gives it a value: the property of
the feature that has the name of the parameter, or the value of an expression in the layer. See
[An image that is a template](api.md#an-image-that-is-a-template). React renders the SVG one time, and the map
draws it one time for each different set of values. With TypeScript, a parameter that is not in `params` is a type
error. The SVG is not in the page, and components inside it can change it. An image of a `MapImage` is used before
an image of the prop `images` with the same name.

The prop `images` gives images to the style layers by name. See
[Images for style layers](api.md#images-for-style-layers). A value that is a string is compared by its content, so it
needs no `useMemo`.

## Server rendering

A server can render the first view as SVG, so that the page shows a map before a script has run. Make the HTML on
the server with `renderFirstView`, and give it to the component:

```jsx
// On the server (for example a server component of Next.js):
import {renderFirstView} from '@map-jr/map-jr-gl/server';

const firstView = await renderFirstView({
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [-74.0065, 40.7085], zoom: 13.6,
  width: 800, height: 500,
  overrides: {building: {hidden: true}},      // changes to style layers, for the server only
});

// In the component:
<MapJr mapStyle={style} initialView={view} firstView={firstView} />
```

- The HTML has the SVG and the credits of the sources.
- In the browser, React takes over the page and does not look at this HTML. The map removes it when it has drawn
  its first frame.
- The prop is read on the server. In the browser you can leave it out, so the HTML does not go to the browser a
  second time.
- Without `firstView`, the server renders an empty element, and the map starts in the browser with its controls.

See [Server rendering](server-rendering.md) for the options.
