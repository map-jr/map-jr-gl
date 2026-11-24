# Size and speed

This page gives the download size of each built file and the speed of Map Jr. GL next to MapLibre GL JS. The
figures on this page are the only place in the docs that states them.

## Download size

<!-- sizes:start -->
Sizes in KB, compressed with gzip, next to MapLibre GL JS 6.17.0. The page script of MapLibre GL JS includes its CSS. The page script of Map Jr. GL is the file of the entry and the files that it imports when it loads.

| File | Map Jr. GL | MapLibre GL JS | Share |
|---|---:|---:|---:|
| Page script of `@map-jr/map-jr-gl` | 47.4 | 300.1 | 15.8% |
| Page script of `@map-jr/map-jr-gl/maplibre-compat` | 55.0 | 300.1 | 18.3% |
| Worker file | 87.3 | 145.0 | 60.2% |
| Page script and worker file of `@map-jr/map-jr-gl` | 134.7 | 445.1 | 30.3% |
| Page script and worker file of `@map-jr/map-jr-gl/maplibre-compat` | 142.3 | 445.1 | 32.0% |
| Hard line for the page script and the worker file | 148.4 | 445.1 | 33.3% |
| Server renderer | 55.2 |  |  |
<!-- sizes:end -->

- A usual map downloads the page script of its entry and the worker file. The [loading guide](loading.md#the-files-that-a-map-loads)
  says which other files a map loads and when.
- The server renderer is the file of `@map-jr/map-jr-gl/server`. A page in the browser does not load it.

The file `vue.js` of `@map-jr/map-jr-gl/vue` and what it imports up front are about 3.7 KB. The code of the map loads
when `MapJr` is mounted.

A server render of a city as SVG can be some hundred KB. Three overrides of the server render (no buildings, no
building outlines, no small roads) make a page of 245 KB into one of 115 KB. The export of the browser example in
[Server rendering](server-rendering.md#export-an-svg-in-the-browser) gives an SVG of 428 KB in 0.8 s in Chromium and
0.4 s in WebKit; Firefox and Safari on a device are not tested.

## Speed in browsers

<!-- speed:start -->
The workflow [Browsers](https://github.com/map-jr/map-jr-gl/tree/bench-results) runs the same page with both libraries after each change, next to MapLibre GL JS 6.17.0. These figures are from the run of 2026-11-24, for commit 3ae5a73. Map Jr. GL uses the worker renderer where the browser has it. The ratio is the number of Map Jr. GL divided by the number of MapLibre GL JS.

Load to idle, in milliseconds. A ratio below 1 means that Map Jr. GL is faster.

| System, browser | MapLibre GL JS | Map Jr. GL | Ratio |
|---|---:|---:|---:|
| macOS, Chromium | 1260 | 579 | 0.46 |
| macOS, WebKit | 2239 | 693 | 0.31 |
| Linux, Chromium | 571 | 350 | 0.61 |
| Linux, Firefox | 1910 | 633 | 0.33 |
| Linux, WebKit | 1188 | 552 | 0.46 |
| Windows, Chromium | 1325 | 841 | 0.63 |
| Windows, Firefox | 1392 | 860 | 0.62 |
| Windows, WebKit | 1295 | 692 | 0.53 |

Frames per second while the map moves. A ratio above 1 means that Map Jr. GL is faster.

| System, browser | MapLibre GL JS | Map Jr. GL | Ratio |
|---|---:|---:|---:|
| macOS, Chromium | 29 | 24 | 0.81 |
| macOS, WebKit | 56 | 54 | 0.96 |
| Linux, Chromium | 11 | 10 | 0.85 |
| Linux, Firefox | 15 | 55 | 3.70 |
| Linux, WebKit | 16 | 14 | 0.87 |
| Windows, Chromium | 20 | 13 | 0.65 |
| Windows, Firefox | 19 | 12 | 0.63 |
| Windows, WebKit | 14 | 12 | 0.85 |

Frames per second while a map with 10,000 markers moves. A ratio above 1 means that Map Jr. GL is faster.

| System, browser | MapLibre GL JS | Map Jr. GL | Ratio |
|---|---:|---:|---:|
| macOS, Chromium | 2 | 24 | 10.81 |
| macOS, WebKit | 4 | 54 | 14.41 |
| Linux, Chromium | 3 | 14 | 4.52 |
| Linux, Firefox | 5 | 40 | 7.90 |
| Linux, WebKit | 3 | 20 | 6.63 |
| Windows, Chromium | 2 | 39 | 25.10 |
| Windows, Firefox | 5 | 24 | 5.28 |
| Windows, WebKit | 3 | 19 | 5.88 |
<!-- speed:end -->

Load to idle is the time from the start of the page until the map has drawn its first view completely. The
computers of the workflow are virtual machines, and those for Linux and Windows have no GPU: they draw WebGL in
software, which explains low frame rates such as those of Linux, Chromium. Use these tables to compare the two
libraries, not as the speed of a real device.

## Measure on your device

Open [the benchmark page](https://map-jr.org/bench/) in the browser that you
want to test. The page loads the same map with MapLibre GL JS and with each renderer of Map Jr. GL, and shows the
time to idle and the frames per second of each. It also shows the GPU that the browser reports.

## See also

- [Loading](loading.md) for the files that a map loads and how to preload them.
- [Browser support](browser-support.md) for the renderer that each browser uses.
