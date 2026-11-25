# Size and speed

This page gives the download size of each built file and the speed of Map Jr. GL next to MapLibre GL JS. The
figures on this page are the only place in the docs that states them.

## Download size

<!-- sizes:start -->
Sizes in KB, compressed with gzip, next to MapLibre GL JS 6.17.0. The page script of MapLibre GL JS includes its CSS. The page script of Map Jr. GL is the file of the entry and the files that it imports when it loads.

| File | Map Jr. GL | MapLibre GL JS | Share |
|---|---:|---:|---:|
| Page script of `@map-jr/map-jr-gl` | 49.2 | 300.1 | 16.4% |
| Page script of `@map-jr/map-jr-gl/maplibre-compat` | 58.5 | 300.1 | 19.5% |
| Worker file | 82.7 | 145.0 | 57.0% |
| Page script and worker file of `@map-jr/map-jr-gl` | 131.9 | 445.1 | 29.6% |
| Page script and worker file of `@map-jr/map-jr-gl/maplibre-compat` | 141.2 | 445.1 | 31.7% |
| Hard line for the page script and the worker file | 148.4 | 445.1 | 33.3% |
| Server renderer | 56.8 |  |  |
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
The workflow [Browsers](https://github.com/map-jr/map-jr-gl/tree/bench-results) runs the same page with both libraries after each change, next to MapLibre GL JS 6.17.0. These figures are from the run of 2026-11-25, for commit ce87e02. Map Jr. GL uses the worker renderer where the browser has it. The ratio is the number of Map Jr. GL divided by the number of MapLibre GL JS.

Load to idle, in milliseconds. A ratio below 1 means that Map Jr. GL is faster.

| System, browser | MapLibre GL JS | Map Jr. GL | Ratio |
|---|---:|---:|---:|
| macOS, Chromium | 812 | 295 | 0.36 |
| macOS, WebKit | 1795 | 806 | 0.45 |
| Linux, Chromium | 824 | 563 | 0.68 |
| Linux, Firefox | 1400 | 508 | 0.36 |
| Linux, WebKit | 2603 | 838 | 0.32 |
| Windows, Chromium | 1291 | 950 | 0.74 |
| Windows, Firefox | 1507 | 916 | 0.61 |
| Windows, WebKit | 1067 | 600 | 0.56 |

Frames per second while the map moves. A ratio above 1 means that Map Jr. GL is faster.

| System, browser | MapLibre GL JS | Map Jr. GL | Ratio |
|---|---:|---:|---:|
| macOS, Chromium | 21 | 28 | 1.36 |
| macOS, WebKit | 56 | 53 | 0.95 |
| Linux, Chromium | 6 | 5 | 0.86 |
| Linux, Firefox | 19 | 51 | 2.71 |
| Linux, WebKit | 11 | 10 | 0.90 |
| Windows, Chromium | 17 | 11 | 0.64 |
| Windows, Firefox | 19 | 11 | 0.59 |
| Windows, WebKit | 20 | 14 | 0.72 |

Frames per second while a map with 10,000 markers moves. A ratio above 1 means that Map Jr. GL is faster.

| System, browser | MapLibre GL JS | Map Jr. GL | Ratio |
|---|---:|---:|---:|
| macOS, Chromium | 6 | 16 | 2.98 |
| macOS, WebKit | 2 | 42 | 23.07 |
| Linux, Chromium | 2 | 8 | 3.63 |
| Linux, Firefox | 8 | 44 | 5.75 |
| Linux, WebKit | 2 | 14 | 6.86 |
| Windows, Chromium | 2 | 38 | 17.82 |
| Windows, Firefox | 4 | 22 | 5.12 |
| Windows, WebKit | 4 | 23 | 5.66 |
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
