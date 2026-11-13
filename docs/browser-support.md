# Browser support

This document says what a browser must have to show a map, what each renderer needs, and in which browsers the
library was run. It applies to both entries (`@map-jr/map-jr-gl` and `@map-jr/map-jr-gl/maplibre-compat`), which use the same
renderer.

Each line of the tables says where it was seen. "Code" means that the statement comes from reading the source file
that is named. The library has no list of browser versions that it supports, because no run has tested old
versions.

## What is required

| Requirement | What happens without it | Where it comes from |
|---|---|---|
| WebGL2 | `supported()` of both entries returns `false`. A map that is made anyway fires one `error` ("The map cannot be shown: WebGL2 is not available") and shows the text "This browser cannot show the map." in the container (`.map-jr-unavailable`). | Code: `src/loader.ts`, `src/map.ts`; test in `test/host.mjs` with a page whose `getContext` returns null |
| ES modules | The package has no CommonJS build and no build for a classic script. | Code: `package.json` (`"type": "module"`) |
| ES2022 syntax | The built files do not parse. A bundler can change the syntax for older browsers. | Code: `build.mjs` (`target: 'es2022'`) |

## What each renderer needs

The option `renderer` selects the thread that draws. The default is `'auto'`, which takes the worker renderer when
the browser has what it needs. [Loading](loading.md) says where each entry takes the option. After the start, the map says which renderer it took: `map.state.get().renderer`
in `@map-jr/map-jr-gl`, and `map.renderer` in `@map-jr/map-jr-gl/maplibre-compat`.

| Feature | What it needs | What happens without it | Where it comes from |
|---|---|---|---|
| Worker renderer | `transferControlToOffscreen` on a canvas, a WebGL2 context in a worker, and tile workers that started | The map draws on the main thread and writes a warning to the console. `renderer: 'worker'` falls back in the same way. The map also goes to the main thread later, when the worker loses its WebGL context before its first frame, loses it twice within 10 seconds, or does not draw in the 5 seconds after its start or a restart. | Code: `src/map.ts`, `src/worker.ts` |
| Main-thread renderer | A WebGL2 context on the page | See "What is required". | Code: `src/gl.ts` |
| Tile workers | Workers that the page is allowed to start | The tiles are built on the main thread, and the map writes a warning. | Code: `src/map.ts` |
| Elevation tiles (3D terrain, hillshade, contour lines, elevation queries) | `OffscreenCanvas` with a 2D context and `createImageBitmap` in a worker | The elevation tiles are not decoded. Safari before 16.4 does not have `OffscreenCanvas` in workers. | Code: `src/contour.ts`; the Safari version is from issue 17 and no run tested it |

## What was seen where

### The workflow `Browsers`, in the browsers of Playwright

The workflow runs after each merge on hosted GitHub runners. These lines are from the branch `bench-results` for
commit `af06465` (2026-11-12). "Renderer" is the renderer that the map took when the page asked for the worker
renderer. The behaviour tests are `test/interact.mjs`, `test/host.mjs`, `test/vue.mjs` and `test/react.mjs`.

| System | Browser | GPU of the machine | Renderer | Behaviour tests |
|---|---|---|---|---|
| macOS (Apple M1, virtual) | Chromium 153 | Apple paravirtual device | Worker | 204 pass, 0 fail |
| Linux | Chromium 153 | None (SwiftShader) | Worker | 204 pass, 0 fail |
| Linux | Firefox 155 | None (llvmpipe) | Worker | 199 pass, 4 fail |
| Linux | WebKit 26.6 | Not known (the browser reports "Apple GPU") | Main thread | 196 pass, 7 fail |
| Windows | Chromium 153 | None (Microsoft Basic Render Driver) | Worker | 204 pass, 0 fail |
| Windows | Firefox 155 | None (Microsoft Basic Render Driver) | Worker | 202 pass, 1 fail |
| Windows | WebKit 26.6 | Not known (the browser reports "Apple GPU") | Main thread | 159 pass, 2 fail |

Notes on these lines:

- WebKit here is the build that Playwright ships. It is not Safari, and it does not behave as Safari in each case.
- On Linux, WebKit has no WebGL2 context in a worker. The map writes "Worker rendering unavailable, using the main
  thread: WebGL2 is not available" and draws on the main thread.
- On Windows, WebKit has no `OffscreenCanvas`. The two test runs stop with "Can't find variable: OffscreenCanvas",
  which is why the number of passes is lower. The benchmark page reports a terrain height of 0 m at the centre
  there and 10 m in the other browsers. This is the same condition as Safari before 16.4. Nobody has looked for the
  place in the tests that stops the run.
- The results of this commit have no line for Firefox or WebKit on macOS. A comment of 2026-11-12 on issue 17
  records that the worker renderer loads in WebKit 26.6 on the hosted macOS runner.
- The branch lists each failed test by name. Read it with
  `git fetch origin bench-results && git show origin/bench-results:README.md`.

### Safari

These lines are from the comment of 2026-11-12 on
[issue 17](https://github.com/map-jr/map-jr-gl/issues/17). The job `safari` of the workflow made the first and the
third line. It runs only when somebody starts the workflow by hand
(see [Development](development.md#other-browsers-and-operating-systems)).

| Browser | Where | Seen |
|---|---|---|
| Safari 27.2, macOS 26.7.2 | Hosted GitHub runner with a virtual GPU, through `safaridriver` | A worker has `OffscreenCanvas` with a WebGL2 context and a 2D context. The map loads with the main-thread renderer. With the worker renderer, a worker draws one frame and then answers nothing, and its WebGL context is lost about 2.4 seconds later. A second worker does the same with no event (the debug record of run 43328734147). The map then goes to the main thread and loads: run 43334734769 (commit `ceb1b8c`, 2026-11-13) reports "worker: loaded, renderer main", and 21.9 seconds from load to idle on the benchmark page. Why the worker stops is not known ([issue 78](https://github.com/map-jr/map-jr-gl/issues/78)). |
| Safari 27.2 | The owner's Mac with a GPU, by hand | The worker renderer works. No numbers were recorded. |
| Safari 26.5, iOS 26.5 | iOS Simulator (iPhone 17 Pro) on the hosted runner | The map loads with the worker renderer and with the main-thread renderer. The benchmark did not finish, so there are no numbers. |

A simulator has the GPU and the memory of its host. It does not show the speed or the limits of a phone.

The hosted macOS runner asks for less motion (`prefers-reduced-motion: reduce`). A camera animation that is not
`essential` does not run there.

## What no automatic run covers

- Safari before 16.4, and any other browser without `OffscreenCanvas` in workers, apart from the WebKit build on
  Windows that stops the test run.
- A real iPhone or iPad. The only run of Safari for iOS is in a simulator.
- Android, in any browser.
- Safari on a Mac with a GPU. The only record is the owner's check by hand.
- A real GPU on Linux or Windows. The hosted machines for these systems draw in software.
- The released builds of Chrome, Edge and Firefox. The workflow runs the builds of Chromium and Firefox that
  Playwright ships.
- A browser without WebGL2.

To check a browser that is not in these tables, open
[the benchmark page](https://map-jr.github.io/map-jr-gl/bench/) of the gallery site in it. The page shows the GPU
that the browser reports and measures each renderer.
