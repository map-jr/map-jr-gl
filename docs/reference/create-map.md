# Create a map

`createMap` of `@map-jr/map-jr-gl` creates a map in an element of the page from a
[description](description.md), the one object that states everything that the map shows. It returns the
[map](map.md), whose methods change the map, move the camera and query features.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});
```

## `createMap`

<!-- ref:MainExports.createMap:start -->
```ts
createMap(container: HTMLElement | string, spec: MapDescription): MapInstance
```

| Name | Type | Default | Description |
|---|---|---|---|
| `container` **required** | `HTMLElement \| string` | | The element, or the `id` of an element. |
| `spec` **required** | [`MapDescription`](description.md#mapdescription) | | The description of the map. |

**Returns:** [`MapInstance`](map.md#mapinstance). The map.
<!-- ref:MainExports.createMap:end -->

The map fills the container, and draws nothing while the container has a height of 0. To remove the map, call
[`map.destroy()`](map.md#destroy).

`createMap` throws an `Error` in these cases:

| Case | Message |
|---|---|
| The description has no `style`. | `[map-jr-gl] createMap(): the description has no "style". Pass the URL of a style or a style object as "style".` |
| `container` is `null` or `undefined`. | `[map-jr-gl] createMap(): the container is null. In a framework, make the map after the element is mounted.`, with `undefined` in place of `null` for `undefined`. |
| `container` is a string, and no element has that id. | `[map-jr-gl] createMap(): no element with the id "map".`, with the string that was passed. |

The map writes a warning to the console when the container already has a map. The two maps then leave two canvases
in the container. Call `destroy()` on the first map before you create the second.

## A browser without WebGL2

The map requires WebGL2. In a browser without it, the map does not load, and it reports one error to
[`onError`](events.md#mapevents) with this message:

```text
[map-jr-gl] The map cannot be shown: WebGL2 is not available. Call supported() before you make a map, and show other content when it returns false.
```

The map also adds an element with the class `map-jr-unavailable` and the text "This browser cannot show the map." to
the container. The element fills the container. To change its text, set its `textContent` in `onError`. To change its
look, write a CSS rule for `.map-jr-unavailable`: the rules of the library have no specificity, so a rule of the page
overrides them. `destroy()` removes the element.

To show other content before a map is created, call [`supported()`](exports.md#supported) first:

```js
import {createMap, supported} from '@map-jr/map-jr-gl';

const container = document.getElementById('map');
if (supported()) {
  createMap(container, {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
  });
} else {
  container.textContent = 'This browser cannot show the map. Our address is 1 Example Street.';
}
```

## The development build

The development build of `@map-jr/map-jr-gl` checks the description and the queries for common mistakes, and writes a
warning with `console.warn` once for each map and each mistake. The production build has none of these checks.

| How the page loads `@map-jr/map-jr-gl` | Checks |
|---|---|
| A bundler that sets the `development` export condition, such as the development server of Vite | Yes |
| A bundler that builds for production | No |
| Node.js with `--conditions=development` | Yes |
| The file `dist/map-jr-gl.js` by URL, with no bundler | No. Load `dist/map-jr-gl.dev.js` instead while you develop. |
| The standalone file, `@map-jr/map-jr-gl/standalone`, which contains the worker | Yes, also in production |

The development build warns in many cases. These are some of them:

- The container is in the page, is not hidden, and has a height of 0 one second after the map is created.
- An id in `interactiveLayers`, an id in `layers` of `queryFeatures`, or the source of `querySource` is not in the
  style.
- A layer names a source that the map does not have, for example after its key left `data`.
- A layer of `layers` names a `before` layer or a source that the style does not have.
- A layer passes an image a parameter that the image does not have.
- An option of `queryFeatures` or `querySource` has no effect in that query.
- A later description changes a field of [`MapSetup`](description.md#mapsetup) or `initialView`, which the map reads
  only when it is created.

The map compares the ids each time that it is idle. A layer or a source that the application adds itself after
`load` therefore causes no warning.

## See also

- [The description](description.md) for every field of the second argument.
- [The map](map.md) for the methods of the map that `createMap` returns.
- [Loading](../loading.md) for the worker file and how the map loads it.
