# Size and speed

This page gives the download size of each built file and the speed of Map Jr. GL next to MapLibre GL JS. The
figures on this page are the only place in the docs that states them.

## Download size

<!-- sizes:start -->
Sizes in KB, compressed with gzip, next to MapLibre GL JS 6.17.0. The page script of MapLibre GL JS includes its CSS. The page script of Map Jr. GL is the file of the entry and the files that it imports when it loads.

| File | Map Jr. GL | MapLibre GL JS | Share |
|---|---:|---:|---:|
| Page script of `@map-jr/map-jr-gl` | 45.2 | 300.1 | 15.1% |
| Page script of `@map-jr/map-jr-gl/maplibre-compat` | 52.1 | 300.1 | 17.4% |
| Worker file | 84.3 | 145.0 | 58.2% |
| Page script and worker file of `@map-jr/map-jr-gl` | 129.5 | 445.1 | 29.1% |
| Page script and worker file of `@map-jr/map-jr-gl/maplibre-compat` | 136.4 | 445.1 | 30.7% |
| Hard line for the page script and the worker file | 148.4 | 445.1 | 33.3% |
| Server renderer | 47.7 |  |  |
<!-- sizes:end -->

- A usual map downloads the page script of its entry and the worker file. The [loading guide](loading.md#the-files-that-a-map-loads)
  says which other files a map loads and when.
- The hard line is a third of what MapLibre GL JS downloads. The page script and the worker file of each entry stay
  below it.
- The server renderer is the file of `@map-jr/map-jr-gl/server`. A page in the browser does not load it.

## Speed in browsers

<!-- speed:start -->
The workflow [Browsers](https://github.com/map-jr/map-jr-gl/tree/bench-results) runs the same page with both libraries after each change, next to MapLibre GL JS 6.17.0. Map Jr. GL uses the worker renderer where the browser has it. The ratio is the number of Map Jr. GL divided by the number of MapLibre GL JS.

Load to idle, in milliseconds. A ratio below 1 means that Map Jr. GL is faster.

| System, browser | MapLibre GL JS | Map Jr. GL | Ratio |
|---|---:|---:|---:|
| macOS, Chromium | 961 | 417 | 0.43 |
| Linux, Chromium | 879 | 663 | 0.75 |
| Linux, Firefox | 1526 | 540 | 0.35 |
| Linux, WebKit | 1438 | 643 | 0.45 |
| Windows, Chromium | 780 | 521 | 0.67 |
| Windows, Firefox | 1613 | 765 | 0.47 |
| Windows, WebKit | 1312 | 727 | 0.55 |

Frames per second while the map moves. A ratio above 1 means that Map Jr. GL is faster.

| System, browser | MapLibre GL JS | Map Jr. GL | Ratio |
|---|---:|---:|---:|
| macOS, Chromium | 26 | 33 | 1.26 |
| Linux, Chromium | 6 | 5 | 0.84 |
| Linux, Firefox | 16 | 57 | 3.53 |
| Linux, WebKit | 14 | 13 | 0.94 |
| Windows, Chromium | 33 | 23 | 0.69 |
| Windows, Firefox | 17 | 9 | 0.55 |
| Windows, WebKit | 14 | 12 | 0.86 |

Frames per second while a map with 10,000 markers moves. A ratio above 1 means that Map Jr. GL is faster.

| System, browser | MapLibre GL JS | Map Jr. GL | Ratio |
|---|---:|---:|---:|
| macOS, Chromium | 5 | 25 | 4.73 |
| Linux, Chromium | 2 | 8 | 4.01 |
| Linux, Firefox | 7 | 43 | 6.10 |
| Linux, WebKit | 2 | 18 | 7.91 |
| Windows, Chromium | 3 | 45 | 12.97 |
| Windows, Firefox | 5 | 26 | 4.97 |
| Windows, WebKit | 3 | 20 | 6.10 |
<!-- speed:end -->

The computers of the workflow are virtual machines, and those for Linux and Windows have no GPU. Use these tables
to compare the two libraries, not as the speed of a real device.

## Measure on your device

Open [the benchmark page](https://map-jr.github.io/map-jr-gl/bench/) of the gallery site in the browser that you
want to test. The page loads the same map with MapLibre GL JS and with each renderer of Map Jr. GL, and shows the
time to idle and the frames per second of each. It also shows the GPU that the browser reports.

## See also

- [Loading](loading.md) for the files that a map loads and how to preload them.
- [Browser support](browser-support.md) for the renderer that each browser uses.
