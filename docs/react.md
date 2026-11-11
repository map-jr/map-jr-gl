# React

The entry `map-jr-gl/react` has a component and hooks for React 18 and 19. They are a thin layer over
[the main API](api.md): after each render, the component gives its props to the map as one description.

## The component

```jsx
import {useMemo, useState} from 'react';
import {MapJr, MapOverlay} from 'map-jr-gl/react';
import {navigation, scale} from 'map-jr-gl/controls';

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
| `onClick`, `onHover`, `onLoad`, `onIdle`, `onError` | Events of the map. |
| `firstView` | The first view from a server. See below. |
| `className`, `style` | For the element of the component. |
| `children` | Content over the map, and `MapOverlay` elements. |

A ref on the component gets the map (for `queryFeatures`, `moveTo`, `fitBounds`).

### What you can make again in each render

The map compares each prop with the last one. A prop that has a new object with the same content does no work:
you can write `controls={[navigation()]}`, `interactiveLayers={['places']}` and a style object in the JSX.

One prop is compared by identity only, because it can be large: the `data` of a marker layer. Keep the array
(`useMemo`, state) until the markers change, as in the example.

## Hooks

Use these in a component inside `MapJr`.

```jsx
import {useMap, useMapState} from 'map-jr-gl/react';

function Zoom() {
  const zoom = useMapState(state => state.view.zoom);   // renders again only when the zoom changes
  const map = useMap();                                 // the map, when it has started
  return <button onClick={() => map?.moveTo({zoom: 12, duration: 500})}>Zoom {zoom?.toFixed(1)}</button>;
}
```

`useMapState` takes a function that returns a part of the state. Return a part as it is (`state.hover`,
`state.view.zoom`), not a new object.

## Elements of the page on the map

`MapOverlay` puts its children at a position of the map. The props are `lngLat`, `anchor`, `offset`, `popup` and
`onClose`, as for `overlay` in [the main API](api.md). The children are React content. For many markers, use the
`markers` prop.

## Server rendering

A server can render the first view as SVG, so that the page shows a map before a script has run. Make the HTML on
the server with `renderFirstView`, and give it to the component:

```jsx
// On the server (for example a server component of Next.js):
import {renderFirstView} from 'map-jr-gl/server';

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
