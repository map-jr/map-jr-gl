# Development

## Set up

You need Node.js 22 or later and pnpm.

```bash
pnpm install
```

## Commands

| Command | What it does |
|---|---|
| `pnpm build` | Checks the types and builds the library into `dist` with Vite. `node build.mjs` is the same without the type check. Both write the type declarations into `dist/types` and a source map beside each built file. |
| `pnpm demo` | Builds the library and the gallery. Then starts a server at `http://localhost:8080`. |
| `pnpm site` | Builds the gallery into `site-dist`. GitHub Pages publishes this folder. |
| `pnpm test` | Runs the unit tests, the MapLibre expression tests and the API check |
| `pnpm test:browser` | Drives the map in a browser. Start `pnpm demo` first. Both commands read the port from the environment variable `PORT` (default 8080), so two checkouts can run their tests at the same time. |
| `pnpm test:loading` | Checks each method of loading the library. Start `pnpm demo` first. |
| `pnpm test:cloudflare` | Runs the server renderer in the Cloudflare runtime. Start `pnpm demo` first. |
| `pnpm test:render` | Runs the MapLibre render tests. This takes about 10 minutes. |
| `pnpm test:size` | Fails if a built file is larger than its budget in `scripts/size-check.mjs`. Run `pnpm build` first. |
| `pnpm test:package` | Packs the tarball with `pnpm pack` into `.cache/package` and runs `publint` on it. Fails if a file that `package.json` names is not in the tarball, if a source map points at the wrong lines of `src/`, if an image is in the tarball, or if `README.md` shows an image by a relative path (npm shows the README without the images of the repository, so the README uses `https://raw.githubusercontent.com/map-jr/map-jr-gl/main/docs/images/...`). Run `pnpm build` first. |
| `node test/conformance/ecosystem.mjs --write` | Reads popular plugins and frameworks from npm and writes which parts of the MapLibre API they use that the library does not have (`docs/ecosystem.md`). |
| `node test/conformance/plugins.mjs --write` | Runs popular plugins with the library in a browser, each in a short scenario. |
| `node test/conformance/examples.mjs --write` | Runs each example page of the MapLibre documentation with MapLibre GL JS and with the library, and writes the pages that give an error or a different image into `docs/ecosystem.md`. It takes about 30 minutes. `--filter=<regex>` runs a part of the pages. |
| `node test/conformance/styles.mjs --write` | Draws popular public styles with MapLibre GL JS and with the library, side by side, and writes how much each pair of images differs into `docs/ecosystem.md`. Start `pnpm demo` first. |
| `pnpm status` | Writes the test results and sizes into the README |
| `pnpm screenshots` | Takes the screenshots in `docs/images` from the gallery. Start `pnpm demo` first. |
| `pnpm bench` | Compares the speed with MapLibre GL JS in a browser without a GPU |
| `BROWSER=webkit node test/bench/browsers.mjs out` | Runs the benchmark page and a short check in one browser (`chromium`, `firefox` or `webkit`). Start `pnpm demo` first. |
| `WD_URL=http://localhost:4444 node test/bench/webdriver.mjs out` | The same through a WebDriver server, for a browser that Playwright cannot drive: Safari (`safaridriver -p 4444` on macOS), or a phone on a device farm. `WD_CAPS` has the capabilities as JSON. Start `pnpm demo` first, or give the page of the gallery site with `BENCH_URL`. |

### The development build

`build.mjs` builds the page entries twice. The production build is `dist/<entry>.js`. The development build is
`dist/<entry>.dev.js`, and `exports` of `package.json` names it under the `development` condition. The two builds
differ in the constant `__DEV__` only (`define` in `build.mjs`): with `__DEV__` true, `src/host.ts` loads the checks
for common mistakes (`src/mistakes.ts`). A chunk that is the same in both builds is one file in `dist/`. The size
budgets measure the production build. `test/host.mjs` imports `dist/map-jr-gl.dev.js` for its checks of mistakes and
`dist/map-jr-gl.js` for the check that the production build does not request the file of the checks. The standalone
file of the main API is built with `__DEV__` true, and the checks are inside it.

The development build also keeps a record of what a map does about a lost WebGL context. Set `window.__mapJrDebug = []`
before the map is made. The map then adds one entry for each step, as `[milliseconds, what, data]`: the start of an
engine in a worker, an error of that worker, each event of the engine, each restart, each second in which the map
watches a new engine (with the last answer of the engine), and the decision after a lost context. The record has at
most 400 entries. `test/bench/webdriver.mjs` prints it for a renderer that did not load.

## The demo server

`pnpm demo` gives you these pages:

| URL | Content |
|---|---|
| `/` | A map that fills the page. Add `?renderer=main` or `?renderer=worker` to select the renderer. Add `?style=` and a URL to load a different style. |
| `/gallery/` | The gallery |
| `/bench` | A speed comparison with MapLibre GL JS that runs in your browser. The gallery site has the same page at [`bench/`](https://map-jr.github.io/map-jr-gl/bench/), so a phone can open it with no server. `?auto` starts it. |
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
| `src/index.ts`, `src/host.ts`, `src/store.ts` | The main entry: `createMap`, a map from one description, and its state store |
| `src/vue.ts` | The adapter for Vue (`map-jr-gl/vue`) |
| `src/maplibre-compat.ts`, `src/compat-map.ts`, `src/compat-types.ts` | The entry `map-jr-gl/maplibre-compat`: the map with the rest of the API of MapLibre GL JS, the functions of the module, the types |
| `src/map.ts` | The core map class, which the two entries use. It sends commands to the engine. |
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

Each built file has a source map beside it (`dist/<file>.js.map`), and its last line names the map. A browser fetches
a source map only when its developer tools are open, and `pnpm test:size` does not count the maps. The map contains
the text of the files of `src/`. A plugin of the build that changes code must return a source map of its change
(`withMap` in `build.mjs`): `pnpm test:package` fails when a map points at the wrong lines.

The first line of each built file that `package.json` names is a comment with the name, the version and the licence
of the package. The chunks that these files share do not have the comment, because each line counts against the size
budgets.

The build also replaces the helper that Vite puts around each `import()` (the plugin `noPreload` in `build.mjs`).
The helper loads CSS files and other chunks before the imported file. The library has no CSS files, so the built
files call `import()` directly.
The same step gives short names to the uniforms, attributes and varyings in the shaders of `src/gl.ts`. Name them
`u_...`, `a_...` and `v_...`, and use those names only for that.
It also gives short names to the local names in the shaders. Do not give a uniform a name without `u_`, and do not
use the name of a local variable of a shader in JavaScript.

## Other browsers and operating systems

The workflow `Browsers` (`.github/workflows/browsers.yml`) runs on each push that changes the code. It runs the
benchmark page and the behaviour tests in Chromium, Firefox and WebKit on Linux, macOS and Windows. WebKit is the
engine of Safari.

The same workflow has a job `safari`, which runs only when you start the workflow by hand. It runs the benchmark
page in Safari itself on macOS through `safaridriver` (`test/bench/webdriver.mjs`). Playwright's WebKit is another
build of the engine, and it does not behave as Safari in each case. The results say whether a worker has
`OffscreenCanvas` and its WebGL2 and 2D contexts, and which renderer the map took. Run it when a change touches the
choice of the renderer, the workers or the canvas, and after a new version of Safari.

| Input of a start by hand | Effect |
|---|---|
| `safari` | The usual jobs and the job `safari`; the results of Safari go to `bench-results` with the others. |
| `safari_only` | Only the job `safari`, and the branch is not written. For trying a change of the job. |
| `simulator` | The job `safari` also tries Safari of the iOS Simulator. On the hosted runner the session started in one run of two, and no run finished the benchmark (2026-11-12). |

Two things are known about these machines (2026-11-12). In Safari 27.2 on the macOS runner, the WebGL context of a
worker is lost directly after it is made, so the map with the worker renderer does not load there and those
scenarios of the benchmark fail; the same Safari draws in a worker on a Mac with a GPU. The system of the runner
asks for less motion (`prefers-reduced-motion`), so a camera animation that is not `essential` does not run.
The machines have a virtual GPU, and a simulator has the memory and the GPU of its host: these runs do not replace
a measurement on a phone.

The workflow writes the results to the branch `bench-results`. Read `README.md` on that branch:

```bash
git fetch origin bench-results && git show origin/bench-results:README.md
```

The Linux and Windows machines have no GPU, so their frame rates are low. Compare the libraries on the same machine.
The macOS machines have a GPU.

## CI and merging

Every change goes through a pull request. The workflow `CI` (`.github/workflows/ci.yml`) must pass before a merge:

| Job | What it runs |
|---|---|
| `checks` | `pnpm build` (type check, build, type declarations), `pnpm test:package` (the tarball: `publint`, each file that `package.json` names, the source maps), and `pnpm test` (unit tests, expression and API floors, size budgets, examples, consistency of code and documentation) |
| `browser` | In Chromium: `test/interact.mjs`, `test/host.mjs`, `test/vue.mjs`, `test/react.mjs`, `test/loading.mjs`. A suite that fails is run one more time, because the tiles come from the live network. |
| `render` | `pnpm test:render`: MapLibre's render tests against the floor in `package.json` |

`pnpm test:consistency` (`scripts/check-consistency.mjs`) fails when a field of the description has no Vue prop or
no documentation, when a member of the map is not in `docs/api.md`, when a gallery example lacks one of its four
forms, when no document names an entry of the package, or when a link between documents is broken.

The MapLibre tests are pinned to one commit (in `test/conformance/render.mjs` and `expressions.mjs`), so the counts
change only when this library changes. To take newer tests, change the commit, delete the folder in `.cache`, and
set the floors again.

See [CLAUDE.md](../CLAUDE.md) for who may merge what, and for the definition of done.

## Facts about browsers that the code depends on

- **WebGL2 is required.** `supported()` of both entries tests for it. Without it the map fires one `error` and puts
  a message into the container (`.map-jr-unavailable`; see `cannotShow` in `src/map.ts`).
- **The page file and the worker file must be of one version.** The build puts the version of `package.json` into
  both (`__VERSION__`). The worker sends its version with its first message, and the page warns once when the two
  differ (`workerReady` in `src/loader.ts`).
- **Worker rendering** needs `transferControlToOffscreen` and WebGL2 in a worker. Where one is missing, the map
  renders on the main thread. WebKit on Linux and Windows (the builds that Playwright uses) is such a case; Safari
  on macOS and iOS can render in a worker.
- **The worker is the default renderer in every browser, Safari included.** Measured on an iPhone and on an Apple
  M4 on 2026-11-12, the worker and the main thread draw the same frames (60 and 120 per second), and the worker
  keeps the page thread free. On virtual macOS machines WebKit drew 6 to 14% fewer frames in a worker with 3D
  terrain.
- **Elevation tiles** are decoded in tile workers with `OffscreenCanvas`. Safari before 16.4 (March 2023) does not
  have it in workers, so terrain, hillshade and contours do not work there.
- **Web fonts in a worker:** WebKit does not load a font from a URL inside a worker. The engine fetches the font
  file and gives the browser its bytes.
- **Firefox** without a window draws about 3 frames per second on the page thread, so the workflow runs it with a
  window. A blocked page also stops the frames of a map that renders in a worker in Firefox (not in Chromium).
- **`idle` comes 200 ms after a movement ends:** one more frame is drawn for the map at rest (sharp raster tiles),
  and `idle` fires after it.
- **Labels of layers for much higher zooms** are not built into a tile of the deepest level of its source; the tile
  is built again when the map reaches another whole zoom. After a fast zoom from 14 to 17, the labels of small
  places come about half a second after the zoom stops.
- **The default export** of `map-jr-gl/maplibre-compat` exists for plugins that contain
  `import maplibregl from 'maplibre-gl'` (4 of the 15 tested). The documentation uses named imports.
