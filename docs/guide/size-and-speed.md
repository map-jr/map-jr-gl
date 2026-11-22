# Size and speed

This page gives the download size of each built file and the speed of Map Jr. GL next to MapLibre GL JS. The
figures on this page are the only place in the docs that states them.

## Download size

<!-- sizes:start -->
Sizes in KB, compressed with gzip, next to MapLibre GL JS 6.17.0. The page script of MapLibre GL JS includes its CSS. The page script of Map Jr. GL is the file of the entry and the files that it imports when it loads.

| File | Map Jr. GL | MapLibre GL JS | Share |
|---|---:|---:|---:|
| Page script of `@map-jr/map-jr-gl` | 46.3 | 300.1 | 15.4% |
| Page script of `@map-jr/map-jr-gl/maplibre-compat` | 53.9 | 300.1 | 18.0% |
| Worker file | 86.5 | 145.0 | 59.7% |
| Page script and worker file of `@map-jr/map-jr-gl` | 132.8 | 445.1 | 29.8% |
| Page script and worker file of `@map-jr/map-jr-gl/maplibre-compat` | 140.4 | 445.1 | 31.5% |
| Hard line for the page script and the worker file | 148.4 | 445.1 | 33.3% |
| Server renderer | 53.8 |  |  |
<!-- sizes:end -->

- A usual map downloads the page script of its entry and the worker file. The [loading guide](loading.md#the-files-that-a-map-loads)
  says which other files a map loads and when.
- The server renderer is the file of `@map-jr/map-jr-gl/server`. A page in the browser does not load it.

## Speed in browsers

<!-- speed:start -->
The workflow [Browsers](https://github.com/map-jr/map-jr-gl/tree/bench-results) runs the same page with both libraries after each change, next to MapLibre GL JS 6.17.0. These figures are from the run of 2026-11-22, for commit 58b7324. Map Jr. GL uses the worker renderer where the browser has it. The ratio is the number of Map Jr. GL divided by the number of MapLibre GL JS.

Load to idle, in milliseconds. A ratio below 1 means that Map Jr. GL is faster.

| System, browser | MapLibre GL JS | Map Jr. GL | Ratio |
|---|---:|---:|---:|
| macOS, Chromium | 821 | 405 | 0.49 |
| macOS, WebKit | 1763 | 888 | 0.50 |
| Linux, Chromium | 591 | 349 | 0.59 |
| Linux, Firefox | 1011 | 503 | 0.50 |
| Linux, WebKit | 1443 | 649 | 0.45 |
| Windows, Chromium | 828 | 635 | 0.77 |
| Windows, Firefox | 1422 | 853 | 0.60 |
| Windows, WebKit | 1313 | 720 | 0.55 |

Frames per second while the map moves. A ratio above 1 means that Map Jr. GL is faster.

| System, browser | MapLibre GL JS | Map Jr. GL | Ratio |
|---|---:|---:|---:|
| macOS, Chromium | 32 | 24 | 0.74 |
| macOS, WebKit | 54 | 51 | 0.94 |
| Linux, Chromium | 11 | 11 | 1.08 |
| Linux, Firefox | 23 | 57 | 2.52 |
| Linux, WebKit | 14 | 13 | 0.96 |
| Windows, Chromium | 30 | 19 | 0.63 |
| Windows, Firefox | 19 | 12 | 0.64 |
| Windows, WebKit | 20 | 16 | 0.82 |

Frames per second while a map with 10,000 markers moves. A ratio above 1 means that Map Jr. GL is faster.

| System, browser | MapLibre GL JS | Map Jr. GL | Ratio |
|---|---:|---:|---:|
| macOS, Chromium | 5 | 16 | 3.18 |
| macOS, WebKit | 6 | 52 | 8.66 |
| Linux, Chromium | 3 | 13 | 3.93 |
| Linux, Firefox | 7 | 44 | 5.93 |
| Linux, WebKit | 2 | 17 | 7.56 |
| Windows, Chromium | 3 | 44 | 13.21 |
| Windows, Firefox | 5 | 22 | 4.75 |
| Windows, WebKit | 4 | 24 | 5.75 |
<!-- speed:end -->

Load to idle is the time from the start of the page until the map has drawn its first view completely. The
computers of the workflow are virtual machines, and those for Linux and Windows have no GPU: they draw WebGL in
software, which explains low frame rates such as those of Linux, Chromium. Use these tables to compare the two
libraries, not as the speed of a real device.

## Measure on your device

Open [the benchmark page](https://map-jr.github.io/map-jr-gl/bench/) of the gallery site in the browser that you
want to test. The page loads the same map with MapLibre GL JS and with each renderer of Map Jr. GL, and shows the
time to idle and the frames per second of each. It also shows the GPU that the browser reports.

## See also

- [Loading](loading.md) for the files that a map loads and how to preload them.
- [Browser support](browser-support.md) for the renderer that each browser uses.
