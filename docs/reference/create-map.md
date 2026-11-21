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
createMap(
  container: HTMLElement | string,
  spec: MapDescription,
): MapInstance
```

| Name | Type | Default | Description |
|---|---|---|---|
| `container` **required** | `HTMLElement \| string` | | The element, or the `id` of an element. |
| `spec` **required** | [`MapDescription`](description.md#mapdescription) | | The description of the map. |

**Returns:** [`MapInstance`](map.md#mapinstance). The map.
<!-- ref:MainExports.createMap:end -->

The map fills the container, and draws nothing while the container has a height of 0. To remove the map, call
[`map.destroy()`](map.md#destroy).

When the container already has a map, the two maps leave two canvases in the container. Call `destroy()` on the first
map before you create the second.

## A browser without WebGL2

The map requires WebGL2. In a browser without it, the map does not load, and it reports one error to
[`onError`](events.md#mapevents) with this message:

```text
[map-jr-gl] The map cannot be shown: WebGL2 is not available. Call supported()
before you make a map, and show other content when it returns false.
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
  container.textContent =
    'This browser cannot show the map. Our address is 1 Example Street.';
}
```

## See also

- [The description](description.md) for every field of the second argument.
- [The map](map.md) for the methods of the map that `createMap` returns.
- [Loading](../loading.md) for the worker file and how the map loads it.
