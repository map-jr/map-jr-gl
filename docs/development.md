# Development

## Set up

You need Node.js 22 or later and pnpm.

```bash
pnpm install
```

## Commands

| Command | What it does |
|---|---|
| `pnpm build` | Checks the types and builds the library into `dist` with Vite |
| `pnpm demo` | Builds the library and the gallery. Then starts a server at `http://localhost:8080`. |
| `pnpm site` | Builds the gallery into `site-dist`. GitHub Pages publishes this folder. |
| `pnpm test` | Runs the unit tests, the MapLibre expression tests and the API check |
| `pnpm test:browser` | Drives the map in a browser. Start `pnpm demo` first. |
| `pnpm test:loading` | Checks each method of loading the library. Start `pnpm demo` first. |
| `pnpm test:cloudflare` | Runs the server renderer in the Cloudflare runtime. Start `pnpm demo` first. |
| `pnpm test:render` | Runs the MapLibre render tests. This takes about 10 minutes. |
| `pnpm test:size` | Fails if a built file is larger than its budget in `scripts/size-check.mjs`. Run `pnpm build` first. |
| `node test/conformance/ecosystem.mjs --write` | Reads popular plugins and frameworks from npm and writes which parts of the MapLibre API they use that the library does not have (`docs/ecosystem.md`). |
| `node test/conformance/plugins.mjs --write` | Runs popular plugins with the library in a browser, each in a short scenario. |
| `node test/conformance/examples.mjs --write` | Runs each example page of the MapLibre documentation with MapLibre GL JS and with the library, and writes the pages that give an error or a different image into `docs/ecosystem.md`. It takes about 30 minutes. `--filter=<regex>` runs a part of the pages. |
| `node test/conformance/styles.mjs --write` | Draws popular public styles with MapLibre GL JS and with the library, side by side, and writes how much each pair of images differs into `docs/ecosystem.md`. Start `pnpm demo` first. |
| `pnpm status` | Writes the test results and sizes into the README |
| `pnpm screenshots` | Takes the screenshots in `docs/images` from the gallery. Start `pnpm demo` first. |
| `pnpm bench` | Compares the speed with MapLibre GL JS in a browser without a GPU |
| `BROWSER=webkit node test/bench/browsers.mjs out` | Runs the benchmark page and a short check in one browser (`chromium`, `firefox` or `webkit`). Start `pnpm demo` first. |

## The demo server

`pnpm demo` gives you these pages:

| URL | Content |
|---|---|
| `/` | A map that fills the page. Add `?renderer=main` or `?renderer=worker` to select the renderer. Add `?style=` and a URL to load a different style. |
| `/gallery/` | The gallery |
| `/bench` | A speed comparison with MapLibre GL JS that runs in your browser |
| `/ssr` | A page with a server-rendered map that the live map replaces |
| `/static` | The server-rendered map only |

## Tests against MapLibre GL JS

Three tests compare the library with MapLibre GL JS:

- **Expression tests.** `pnpm test:expressions` runs the expression tests of the MapLibre style specification.
- **API check.** `pnpm test:api` compares the methods of `Map` with the type declarations of MapLibre GL JS.
- **Render tests.** `pnpm test:render` draws each MapLibre render test and compares the result with the expected
  image. The first run downloads the MapLibre GL JS repository and two fonts into `.cache`.

Each test has a minimum result in `package.json`. The test fails if the result is below the minimum. Increase the
minimum when you add a feature.

After you change a feature, do these steps:

1. Run `pnpm build`.
2. Run `pnpm test`.
3. Run `pnpm test:render` if you changed how the map is drawn.
4. Run `pnpm status`.
5. Update [MapLibre compatibility](maplibre-compatibility.md) if a difference changed.

## The gallery and GitHub Pages

The gallery is in the `site` folder. It imports the library by its package name, as an application does.

The workflow in `.github/workflows/pages.yml` builds the gallery and publishes it after each push to `main`.
To use it, do this step one time: in the repository settings, open **Pages** and set **Source** to
**GitHub Actions**.

## Source files

| File | Content |
|---|---|
| `src/map.ts` | The `Map` class that your application uses. It sends commands to the engine. |
| `src/engine.ts` | The work for each frame: camera, tiles, labels. It does not use the DOM, so it can run in a worker. |
| `src/gl.ts` | The WebGL2 renderer |
| `src/svg.ts`, `src/server.ts` | The SVG renderer and the server functions |
| `src/geo.ts` | Camera and projection calculations |
| `src/style.ts`, `src/expr.ts` | The style and the expressions |
| `src/tile.ts`, `src/tiles.ts`, `src/mvt.ts` | Tile data: decode, build, load |
| `src/text.ts`, `src/placement.ts` | Text and label placement |
| `src/markers.ts`, `src/overlays.ts`, `src/controls.ts` | Marker layers, `Marker` and `Popup`, controls |
| `src/contour.ts`, `src/pmtiles.ts`, `src/geojson.ts` | Contour lines, PMTiles, GeoJSON |
| `src/webp.ts` | PNG and WebP decoders for the server |
| `src/loader.ts`, `src/worker.ts` | How the workers start |

The build gives short names to private class members (`scripts/private-names.mjs`), because the minifier does not
shorten property names. Declare a member `private` and use it as `this.name` to get a short name in the built files.
Run `node scripts/private-names.mjs` to see the names that the build shortens.
Some members cannot be private, because other files use them (`tr.worldSize`). The list `INTERNAL` in the script
has such names, and the build shortens them too. Add a name to the list only when the class is not part of the API,
and no browser object has a property with that name. The build fails if the name is also a key of an object
literal, a field of a type, or a string.
The same step gives short names to the uniforms, attributes and varyings in the shaders of `src/gl.ts`. Name them
`u_...`, `a_...` and `v_...`, and use those names only for that.
It also gives short names to the local names in the shaders. Do not give a uniform a name without `u_`, and do not
use the name of a local variable of a shader in JavaScript.

## Other browsers and operating systems

The workflow `Browsers` (`.github/workflows/browsers.yml`) runs on each push that changes the code. It runs the
benchmark page and the behaviour tests in Chromium, Firefox and WebKit on Linux, macOS and Windows. WebKit is the
engine of Safari.

The workflow writes the results to the branch `bench-results`. Read `README.md` on that branch:

```bash
git fetch origin bench-results && git show origin/bench-results:README.md
```

The Linux and Windows machines have no GPU, so their frame rates are low. Compare the libraries on the same machine.
The macOS machines have a GPU.
