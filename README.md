# Results in browsers

Commit 5fbfc0b7d549c8f8a22ecc7013e70cccfe6223ee, 2026-11-14T19:27Z. The workflow "Browsers" writes this branch.

## Behaviour tests

| System and browser | Pass | Fail |
|---|---|---|
| darwin-chromium | 386 | 0 |
| darwin-firefox | 369 | 16 |
| darwin-webkit | 383 | 3 |
| linux-chromium | 386 | 0 |
| linux-firefox | 384 | 1 |
| linux-webkit | 356 | 29 |
| win32-chromium | 384 | 2 |
| win32-firefox | 385 | 0 |
| win32-webkit | 254 | 6 |

## Benchmarks

### darwin-chromium (chromium 153.0.8010.12)

darwin 25.6.0 arm64, Apple M1 (Virtual)

GPU: ANGLE (Apple, ANGLE Metal Renderer: Apple Paravirtual device, Unspecified Version) · screen pixel ratio 1 · AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.8010.12 Safari/537.36

- worker: loaded, renderer worker, 8 features at the centre, terrain on (centre 10 m)
- main: loaded, renderer main, 8 features at the centre, terrain on (centre 10 m)

| Scenario | Load to idle | Frames per second | Slowest frame gap | Main-thread script per frame (median / worst) | Main thread blocked | Engine: time per frame, and its own count of frames |
|---|---|---|---|---|---|---|
| MapLibre GL JS | 1635 ms | 35.0 | 82 ms | 3.3 / 13.1 ms | 0 ms |  |
| This library, main thread | 872 ms | 34.3 | 79 ms | 1.4 / 12.9 ms | 0 ms | 2.2 ms, 41 frames per second |
| This library, worker | 905 ms | 27.9 | 90 ms | 0.0 / 0.0 ms | 0 ms | 2.4 ms, 35 frames per second |
| 1,000 markers: MapLibre Marker (DOM) (added in 65 ms) | 852 ms | 25.4 | 107 ms | 8.0 / 19.9 ms | 295 ms |  |
| 1,000 markers: marker layer, main thread (added in 4 ms) | 783 ms | 26.7 | 108 ms | 2.2 / 65.2 ms | 118 ms | 4.3 ms, 36 frames per second |
| 1,000 markers: marker layer, worker (added in 1 ms) | 889 ms | 27.5 | 89 ms | 0.0 / 0.0 ms | 0 ms | 2.7 ms, 43 frames per second |
| 10,000 markers: MapLibre Marker (DOM) (added in 618 ms) | 827 ms | 1.6 | 894 ms | 110.3 / 175.5 ms | 4430 ms |  |
| 10,000 markers: marker layer, main thread (added in 3 ms) | 854 ms | 31.4 | 118 ms | 1.9 / 33.7 ms | 0 ms | 3.2 ms, 40 frames per second |
| 10,000 markers: marker layer, worker (added in 2 ms) | 997 ms | 39.7 | 81 ms | 0.0 / 0.0 ms | 0 ms | 2.8 ms, 55 frames per second |
| 100,000 markers: marker layer, worker (added in 9 ms) | 905 ms | 36.4 | 84 ms | 0.0 / 0.0 ms | 0 ms | 2.9 ms, 51 frames per second |
| 3D terrain: MapLibre GL JS | 2213 ms | 33.6 | 140 ms | 3.8 / 80.5 ms | 82 ms |  |
| 3D terrain: this library, main thread | 1099 ms | 38.1 | 84 ms | 1.4 / 7.3 ms | 0 ms | 1.8 ms, 39 frames per second |
| 3D terrain: this library, worker | 954 ms | 34.8 | 87 ms | 0.0 / 0.0 ms | 0 ms | 2.7 ms, 42 frames per second |
| 3D terrain: MapLibre GL JS (second measurement) | 987 ms | 32.6 | 81 ms | 4.4 / 71.7 ms | 139 ms |  |
| 3D terrain: this library, main thread (second measurement) | 1174 ms | 40.2 | 78 ms | 1.5 / 16.2 ms | 0 ms | 2.1 ms, 42 frames per second |
| 3D terrain: this library, worker (second measurement) | 1020 ms | 35.4 | 90 ms | 0.0 / 0.0 ms | 0 ms | 2.2 ms, 43 frames per second |
| 3D terrain: MapLibre GL JS (third measurement) | 1451 ms | 32.5 | 82 ms | 4.2 / 30.6 ms | 0 ms |  |
| 3D terrain: this library, main thread (third measurement) | 843 ms | 34.4 | 85 ms | 1.8 / 24.2 ms | 0 ms | 2.7 ms, 43 frames per second |
| 3D terrain: this library, worker (third measurement) | 939 ms | 34.4 | 75 ms | 0.0 / 0.0 ms | 0 ms | 2.1 ms, 43 frames per second |
### darwin-firefox (firefox 155.0)

darwin 25.6.0 arm64, Apple M1 (Virtual)

GPU: Apple M1, or similar · screen pixel ratio 1 · Gecko/20100101 Firefox/155.0

- worker: loaded, renderer worker, 8 features at the centre, terrain on (centre 10 m)
- main: loaded, renderer main, 8 features at the centre, terrain on (centre 10 m)

| Scenario | Load to idle | Frames per second | Slowest frame gap | Main-thread script per frame (median / worst) | Main thread blocked | Engine: time per frame, and its own count of frames |
|---|---|---|---|---|---|---|
| MapLibre GL JS | 5913 ms | 3.7 | 1174 ms | 10.0 / 23.0 ms | 0 ms |  |
| This library, main thread | 3160 ms | 2.6 | 1005 ms | 8.0 / 20.0 ms | 0 ms | 8.7 ms, 4 frames per second |
| This library, worker | 6350 ms | 2.2 | 1840 ms | 0.0 / 0.0 ms | 0 ms | 8.7 ms, 3 frames per second |
| 1,000 markers: MapLibre Marker (DOM) (added in 80 ms) | 2132 ms | 3.1 | 725 ms | 20.0 / 338.0 ms | 0 ms |  |
| 1,000 markers: marker layer, main thread (added in 2 ms) | 3040 ms | 1.8 | 1135 ms | 13.0 / 39.0 ms | 0 ms | 17.3 ms, 3 frames per second |
| 1,000 markers: marker layer, worker (added in 4 ms) | 7603 ms | 5.7 | 849 ms | 0.0 / 0.0 ms | 0 ms | 5.1 ms, 4 frames per second |
| 10,000 markers: MapLibre Marker (DOM) (added in 1010 ms) | 3369 ms | 2.6 | 682 ms | 88.0 / 181.0 ms | 0 ms |  |
| 10,000 markers: marker layer, main thread (added in 3 ms) | 3136 ms | 2.2 | 1089 ms | 7.0 / 13.0 ms | 0 ms | 6.8 ms, 3 frames per second |
| 10,000 markers: marker layer, worker (added in 6 ms) | 6187 ms | 0.0 | 0 ms | 0.0 / 0.0 ms | 0 ms |  |
| 100,000 markers: marker layer, worker (added in 15 ms) | 5061 ms | 0.0 | 0 ms | 0.0 / 0.0 ms | 0 ms |  |
| 3D terrain: MapLibre GL JS | 48251 ms | 1.2 | 1643 ms | 25.0 / 279.0 ms | 0 ms |  |
| 3D terrain: this library, main thread | 18327 ms | 3.7 | 1535 ms | 9.0 / 17.0 ms | 0 ms | 11.6 ms, 5 frames per second |
| 3D terrain: this library, worker | 17783 ms | 60.5 | 29 ms | 0.0 / 0.0 ms | 0 ms |  |
| 3D terrain: MapLibre GL JS (second measurement) | 29289 ms | 2.2 | 728 ms | 19.0 / 42.0 ms | 0 ms |  |
| 3D terrain: this library, main thread (second measurement) | 19134 ms | 4.1 | 976 ms | 6.0 / 13.0 ms | 0 ms | 7.0 ms, 5 frames per second |
| 3D terrain: this library, worker (second measurement) | 10552 ms | 60.6 | 25 ms | 0.0 / 0.0 ms | 0 ms |  |
| 3D terrain: MapLibre GL JS (third measurement) | 24996 ms | 1.5 | 1039 ms | 41.0 / 81.0 ms | 0 ms |  |
| 3D terrain: this library, main thread (third measurement) | 14975 ms | 3.6 | 1147 ms | 5.0 / 20.0 ms | 0 ms | 7.5 ms, 5 frames per second |
| 3D terrain: this library, worker (third measurement) | 6644 ms | 55.1 | 125 ms | 0.0 / 0.0 ms | 0 ms |  |
### darwin-webkit (webkit 26.6)

darwin 25.6.0 arm64, Apple M1 (Virtual)

GPU: Apple GPU · screen pixel ratio 1 · AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Safari/605.1.15

- worker: loaded, renderer worker, 8 features at the centre, terrain on (centre 10 m)
- main: loaded, renderer main, 8 features at the centre, terrain on (centre 10 m)

| Scenario | Load to idle | Frames per second | Slowest frame gap | Main-thread script per frame (median / worst) | Main thread blocked | Engine: time per frame, and its own count of frames |
|---|---|---|---|---|---|---|
| MapLibre GL JS | 2880 ms | 49.3 | 115 ms | 4.0 / 19.0 ms | 0 ms |  |
| This library, main thread | 1313 ms | 59.8 | 34 ms | 2.0 / 19.0 ms | 0 ms | 2.9 ms, 73 frames per second |
| This library, worker | 1261 ms | 51.5 | 57 ms | 0.0 / 0.0 ms | 0 ms | 3.8 ms, 60 frames per second |
| 1,000 markers: MapLibre Marker (DOM) (added in 97 ms) | 1267 ms | 23.0 | 160 ms | 12.0 / 32.0 ms | 0 ms |  |
| 1,000 markers: marker layer, main thread (added in 6 ms) | 1160 ms | 59.3 | 37 ms | 2.0 / 12.0 ms | 0 ms | 2.6 ms, 73 frames per second |
| 1,000 markers: marker layer, worker (added in 1 ms) | 1125 ms | 59.1 | 42 ms | 0.0 / 0.0 ms | 0 ms | 2.9 ms, 74 frames per second |
| 10,000 markers: MapLibre Marker (DOM) (added in 762 ms) | 1164 ms | 3.7 | 416 ms | 60.0 / 78.0 ms | 0 ms |  |
| 10,000 markers: marker layer, main thread (added in 3 ms) | 1197 ms | 58.7 | 41 ms | 2.0 / 16.0 ms | 0 ms | 2.5 ms, 73 frames per second |
| 10,000 markers: marker layer, worker (added in 1 ms) | 1120 ms | 52.6 | 154 ms | 0.0 / 0.0 ms | 0 ms | 3.1 ms, 69 frames per second |
| 100,000 markers: marker layer, worker (added in 9 ms) | 1225 ms | 51.4 | 202 ms | 0.0 / 0.0 ms | 0 ms | 3.8 ms, 58 frames per second |
| 3D terrain: MapLibre GL JS | 3086 ms | 56.0 | 77 ms | 3.0 / 12.0 ms | 0 ms |  |
| 3D terrain: this library, main thread | 1798 ms | 59.9 | 36 ms | 2.0 / 8.0 ms | 0 ms | 2.0 ms, 69 frames per second |
| 3D terrain: this library, worker | 1326 ms | 55.0 | 50 ms | 0.0 / 0.0 ms | 0 ms | 1.9 ms, 60 frames per second |
| 3D terrain: MapLibre GL JS (second measurement) | 2377 ms | 55.6 | 106 ms | 3.0 / 11.0 ms | 0 ms |  |
| 3D terrain: this library, main thread (second measurement) | 1425 ms | 59.4 | 48 ms | 2.0 / 7.0 ms | 0 ms | 1.9 ms, 66 frames per second |
| 3D terrain: this library, worker (second measurement) | 1395 ms | 58.4 | 46 ms | 0.0 / 0.0 ms | 0 ms | 1.6 ms, 64 frames per second |
| 3D terrain: MapLibre GL JS (third measurement) | 1963 ms | 42.1 | 112 ms | 3.0 / 16.0 ms | 0 ms |  |
| 3D terrain: this library, main thread (third measurement) | 1638 ms | 59.0 | 57 ms | 2.0 / 8.0 ms | 0 ms | 1.8 ms, 68 frames per second |
| 3D terrain: this library, worker (third measurement) | 1139 ms | 54.0 | 53 ms | 0.0 / 0.0 ms | 0 ms | 2.1 ms, 56 frames per second |
### linux-chromium (chromium 153.0.8010.12)

linux 7.0.0-1019-azure x64, AMD EPYC 9V74 80-Core Processor

GPU: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) · screen pixel ratio 1 · AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.8010.12 Safari/537.36

- worker: loaded, renderer worker, 8 features at the centre, terrain on (centre 10 m)
- main: loaded, renderer main, 8 features at the centre, terrain on (centre 10 m)

| Scenario | Load to idle | Frames per second | Slowest frame gap | Main-thread script per frame (median / worst) | Main thread blocked | Engine: time per frame, and its own count of frames |
|---|---|---|---|---|---|---|
| MapLibre GL JS | 664 ms | 13.1 | 311 ms | 5.9 / 26.4 ms | 0 ms |  |
| This library, main thread | 794 ms | 8.1 | 302 ms | 5.7 / 20.1 ms | 0 ms | 6.3 ms, 25 frames per second |
| This library, worker | 887 ms | 8.6 | 411 ms | 0.0 / 0.0 ms | 0 ms | 6.0 ms, 26 frames per second |
| 1,000 markers: MapLibre Marker (DOM) (added in 60 ms) | 4924 ms | 11.0 | 371 ms | 15.3 / 30.4 ms | 976 ms |  |
| 1,000 markers: marker layer, main thread (added in 4 ms) | 795 ms | 9.3 | 287 ms | 4.9 / 19.7 ms | 0 ms | 5.3 ms, 27 frames per second |
| 1,000 markers: marker layer, worker (added in 1 ms) | 877 ms | 11.7 | 284 ms | 0.0 / 0.0 ms | 0 ms | 6.0 ms, 28 frames per second |
| 10,000 markers: MapLibre Marker (DOM) (added in 531 ms) | 5131 ms | 2.4 | 545 ms | 54.8 / 84.4 ms | 4504 ms |  |
| 10,000 markers: marker layer, main thread (added in 2 ms) | 836 ms | 8.7 | 307 ms | 4.2 / 27.2 ms | 0 ms | 5.1 ms, 25 frames per second |
| 10,000 markers: marker layer, worker (added in 4 ms) | 1120 ms | 8.0 | 392 ms | 0.0 / 0.0 ms | 0 ms | 8.6 ms, 25 frames per second |
| 100,000 markers: marker layer, worker (added in 62 ms) | 5219 ms | 9.3 | 564 ms | 0.0 / 0.0 ms | 0 ms | 11.4 ms, 11 frames per second |
| 3D terrain: MapLibre GL JS | 6172 ms | 64.0 | 21 ms | 5.2 / 10.4 ms | 0 ms |  |
| 3D terrain: this library, main thread | 891 ms | 12.2 | 210 ms | 3.1 / 15.9 ms | 0 ms | 5.2 ms, 25 frames per second |
| 3D terrain: this library, worker | 850 ms | 14.1 | 288 ms | 0.0 / 0.0 ms | 0 ms | 10.5 ms, 28 frames per second |
| 3D terrain: MapLibre GL JS (second measurement) | 857 ms | 11.6 | 628 ms | 6.0 / 379.4 ms | 380 ms |  |
| 3D terrain: this library, main thread (second measurement) | 819 ms | 12.7 | 257 ms | 3.8 / 18.7 ms | 0 ms | 5.1 ms, 26 frames per second |
| 3D terrain: this library, worker (second measurement) | 823 ms | 15.1 | 202 ms | 0.0 / 0.0 ms | 0 ms | 8.6 ms, 28 frames per second |
| 3D terrain: MapLibre GL JS (third measurement) | 717 ms | 11.5 | 367 ms | 6.5 / 22.0 ms | 0 ms |  |
| 3D terrain: this library, main thread (third measurement) | 821 ms | 13.2 | 208 ms | 3.8 / 25.1 ms | 0 ms | 5.4 ms, 28 frames per second |
| 3D terrain: this library, worker (third measurement) | 574 ms | 17.7 | 355 ms | 0.0 / 0.0 ms | 0 ms | 8.5 ms, 28 frames per second |
### linux-firefox (firefox 155.0)

linux 7.0.0-1019-azure x64, AMD EPYC 9V45 96-Core Processor

GPU: llvmpipe, or similar · screen pixel ratio 1 · Gecko/20100101 Firefox/155.0

- worker: loaded, renderer worker, 8 features at the centre, terrain on (centre 10 m)
- main: loaded, renderer main, 8 features at the centre, terrain on (centre 10 m)

| Scenario | Load to idle | Frames per second | Slowest frame gap | Main-thread script per frame (median / worst) | Main thread blocked | Engine: time per frame, and its own count of frames |
|---|---|---|---|---|---|---|
| MapLibre GL JS | 1244 ms | 26.2 | 102 ms | 5.0 / 16.0 ms | 0 ms |  |
| This library, main thread | 750 ms | 22.6 | 111 ms | 2.0 / 19.0 ms | 0 ms | 3.2 ms, 28 frames per second |
| This library, worker | 842 ms | 40.2 | 815 ms | 0.0 / 0.0 ms | 0 ms | 3.3 ms, 51 frames per second |
| 1,000 markers: MapLibre Marker (DOM) (added in 47 ms) | 3250 ms | 24.8 | 92 ms | 11.0 / 30.0 ms | 0 ms |  |
| 1,000 markers: marker layer, main thread (added in 2 ms) | 680 ms | 22.1 | 123 ms | 2.0 / 22.0 ms | 0 ms | 3.6 ms, 29 frames per second |
| 1,000 markers: marker layer, worker (added in 1 ms) | 897 ms | 44.0 | 505 ms | 0.0 / 0.0 ms | 0 ms | 3.8 ms, 56 frames per second |
| 10,000 markers: MapLibre Marker (DOM) (added in 417 ms) | 4157 ms | 6.2 | 196 ms | 62.0 / 129.0 ms | 0 ms |  |
| 10,000 markers: marker layer, main thread (added in 2 ms) | 883 ms | 21.6 | 126 ms | 3.0 / 16.0 ms | 0 ms | 3.7 ms, 30 frames per second |
| 10,000 markers: marker layer, worker (added in 0 ms) | 983 ms | 42.3 | 385 ms | 0.0 / 0.0 ms | 0 ms | 4.9 ms, 41 frames per second |
| 100,000 markers: marker layer, worker (added in 4 ms) | 4566 ms | 39.1 | 414 ms | 0.0 / 0.0 ms | 0 ms | 3.9 ms, 49 frames per second |
| 3D terrain: MapLibre GL JS | 6192 ms | 11.8 | 349 ms | 5.0 / 17.0 ms | 0 ms |  |
| 3D terrain: this library, main thread | 1172 ms | 43.6 | 80 ms | 2.0 / 8.0 ms | 0 ms | 1.8 ms, 46 frames per second |
| 3D terrain: this library, worker | 1184 ms | 50.5 | 568 ms | 0.0 / 0.0 ms | 0 ms | 2.5 ms, 54 frames per second |
| 3D terrain: MapLibre GL JS (second measurement) | 1851 ms | 12.1 | 435 ms | 6.0 / 23.0 ms | 0 ms |  |
| 3D terrain: this library, main thread (second measurement) | 1079 ms | 44.1 | 65 ms | 2.0 / 8.0 ms | 0 ms | 2.2 ms, 53 frames per second |
| 3D terrain: this library, worker (second measurement) | 1219 ms | 51.5 | 462 ms | 0.0 / 0.0 ms | 0 ms | 2.4 ms, 55 frames per second |
| 3D terrain: MapLibre GL JS (third measurement) | 2283 ms | 11.1 | 512 ms | 6.0 / 28.0 ms | 0 ms |  |
| 3D terrain: this library, main thread (third measurement) | 985 ms | 41.9 | 69 ms | 2.0 / 8.0 ms | 0 ms | 2.3 ms, 50 frames per second |
| 3D terrain: this library, worker (third measurement) | 1106 ms | 50.5 | 539 ms | 0.0 / 0.0 ms | 0 ms | 2.6 ms, 52 frames per second |
### linux-webkit (webkit 26.6)

linux 7.0.0-1019-azure x64, AMD EPYC 7763 64-Core Processor

GPU: Apple GPU · screen pixel ratio 1 · AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Safari/605.1.15

- worker: loaded, renderer main, 8 features at the centre, terrain on (centre 10 m)
- main: loaded, renderer main, 8 features at the centre, terrain on (centre 10 m)

| Scenario | Load to idle | Frames per second | Slowest frame gap | Main-thread script per frame (median / worst) | Main thread blocked | Engine: time per frame, and its own count of frames |
|---|---|---|---|---|---|---|
| MapLibre GL JS | 2708 ms | 12.2 | 163 ms | 52.0 / 105.0 ms | 0 ms |  |
| This library, main thread | 1401 ms | 12.8 | 142 ms | 53.0 / 104.0 ms | 0 ms | 53.6 ms, 21 frames per second |
| This library, worker | 981 ms | 13.0 | 151 ms | 47.0 / 99.0 ms | 0 ms | 58.8 ms, 17 frames per second |
| 1,000 markers: MapLibre Marker (DOM) (added in 110 ms) | 1271 ms | 9.4 | 153 ms | 58.0 / 102.0 ms | 0 ms |  |
| 1,000 markers: marker layer, main thread (added in 4 ms) | 1209 ms | 13.1 | 145 ms | 51.0 / 127.0 ms | 0 ms | 52.8 ms, 23 frames per second |
| 1,000 markers: marker layer, worker (added in 1 ms) | 923 ms | 12.9 | 177 ms | 46.0 / 103.0 ms | 0 ms | 53.1 ms, 18 frames per second |
| 10,000 markers: MapLibre Marker (DOM) (added in 959 ms) | 1201 ms | 2.1 | 702 ms | 123.0 / 198.0 ms | 0 ms |  |
| 10,000 markers: marker layer, main thread (added in 3 ms) | 1213 ms | 12.2 | 140 ms | 56.0 / 108.0 ms | 0 ms | 51.7 ms, 21 frames per second |
| 10,000 markers: marker layer, worker (added in 3 ms) | 1043 ms | 12.2 | 209 ms | 49.0 / 112.0 ms | 0 ms | 61.6 ms, 17 frames per second |
| 100,000 markers: marker layer, worker (added in 3 ms) | 813 ms | 9.3 | 338 ms | 51.0 / 319.0 ms | 0 ms | 92.9 ms, 9 frames per second |
| 3D terrain: MapLibre GL JS | 7349 ms | 3.5 | 793 ms | 182.0 / 749.0 ms | 0 ms |  |
| 3D terrain: this library, main thread | 1878 ms | 23.8 | 127 ms | 22.0 / 109.0 ms | 0 ms | 26.9 ms, 28 frames per second |
| 3D terrain: this library, worker | 1481 ms | 23.8 | 106 ms | 26.0 / 59.0 ms | 0 ms | 26.0 ms, 27 frames per second |
| 3D terrain: MapLibre GL JS (second measurement) | 5180 ms | 3.6 | 772 ms | 174.0 / 957.0 ms | 0 ms |  |
| 3D terrain: this library, main thread (second measurement) | 1637 ms | 25.3 | 103 ms | 26.0 / 66.0 ms | 0 ms | 26.1 ms, 30 frames per second |
| 3D terrain: this library, worker (second measurement) | 1302 ms | 25.6 | 99 ms | 24.0 / 59.0 ms | 0 ms | 24.8 ms, 27 frames per second |
| 3D terrain: MapLibre GL JS (third measurement) | 4284 ms | 3.1 | 741 ms | 189.0 / 956.0 ms | 0 ms |  |
| 3D terrain: this library, main thread (third measurement) | 1456 ms | 28.1 | 66 ms | 26.0 / 49.0 ms | 0 ms | 24.9 ms, 31 frames per second |
| 3D terrain: this library, worker (third measurement) | 1369 ms | 25.4 | 111 ms | 26.0 / 103.0 ms | 0 ms | 27.7 ms, 28 frames per second |
### win32-chromium (chromium 153.0.8010.12)

win32 10.0.26100 x64, AMD EPYC 7763 64-Core Processor                

GPU: ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11) · screen pixel ratio 1 · AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.8010.12 Safari/537.36

- worker: loaded, renderer worker, 8 features at the centre, terrain on (centre 10 m)
- main: loaded, renderer main, 8 features at the centre, terrain on (centre 10 m)

| Scenario | Load to idle | Frames per second | Slowest frame gap | Main-thread script per frame (median / worst) | Main thread blocked | Engine: time per frame, and its own count of frames |
|---|---|---|---|---|---|---|
| MapLibre GL JS | 1239 ms | 41.2 | 94 ms | 13.5 / 83.7 ms | 940 ms |  |
| This library, main thread | 1720 ms | 24.1 | 104 ms | 30.3 / 104.0 ms | 1736 ms | 31.8 ms, 37 frames per second |
| This library, worker | 1546 ms | 27.2 | 200 ms | 0.0 / 0.0 ms | 0 ms | 27.2 ms, 37 frames per second |
| 1,000 markers: MapLibre Marker (DOM) (added in 74 ms) | 846 ms | 13.1 | 146 ms | 34.5 / 76.3 ms | 4005 ms |  |
| 1,000 markers: marker layer, main thread (added in 138 ms) | 1688 ms | 22.7 | 168 ms | 26.0 / 161.2 ms | 1196 ms | 29.1 ms, 35 frames per second |
| 1,000 markers: marker layer, worker (added in 1 ms) | 1812 ms | 42.5 | 219 ms | 0.0 / 0.0 ms | 0 ms | 26.9 ms, 38 frames per second |
| 10,000 markers: MapLibre Marker (DOM) (added in 621 ms) | 1302 ms | 1.9 | 920 ms | 71.9 / 130.2 ms | 4352 ms |  |
| 10,000 markers: marker layer, main thread (added in 2 ms) | 2154 ms | 27.7 | 212 ms | 19.4 / 197.1 ms | 754 ms | 25.1 ms, 47 frames per second |
| 10,000 markers: marker layer, worker (added in 18 ms) | 1805 ms | 37.3 | 641 ms | 0.0 / 0.0 ms | 169 ms | 25.9 ms, 39 frames per second |
| 100,000 markers: marker layer, worker (added in 340 ms) | 1928 ms | 31.7 | 153 ms | 0.0 / 0.0 ms | 0 ms | 32.1 ms, 36 frames per second |
| 3D terrain: MapLibre GL JS | 5700 ms | 5.4 | 772 ms | 62.7 / 419.5 ms | 3107 ms |  |
| 3D terrain: this library, main thread | 1634 ms | 34.0 | 54 ms | 13.7 / 47.8 ms | 56 ms | 15.2 ms, 39 frames per second |
| 3D terrain: this library, worker | 1721 ms | 34.6 | 60 ms | 0.0 / 0.0 ms | 0 ms | 14.5 ms, 47 frames per second |
| 3D terrain: MapLibre GL JS (second measurement) | 7633 ms | 4.7 | 959 ms | 84.7 / 409.1 ms | 3208 ms |  |
| 3D terrain: this library, main thread (second measurement) | 3186 ms | 36.4 | 72 ms | 19.0 / 71.0 ms | 226 ms | 18.5 ms, 62 frames per second |
| 3D terrain: this library, worker (second measurement) | 1174 ms | 34.5 | 101 ms | 0.0 / 0.0 ms | 0 ms | 15.3 ms, 37 frames per second |
| 3D terrain: MapLibre GL JS (third measurement) | 8017 ms | 6.3 | 886 ms | 62.7 / 387.9 ms | 2565 ms |  |
| 3D terrain: this library, main thread (third measurement) | 3218 ms | 36.6 | 54 ms | 18.9 / 53.4 ms | 358 ms | 19.3 ms, 56 frames per second |
| 3D terrain: this library, worker (third measurement) | 2559 ms | 35.5 | 71 ms | 0.0 / 0.0 ms | 0 ms | 14.3 ms, 50 frames per second |
### win32-firefox (firefox 155.0)

win32 10.0.26100 x64, AMD EPYC 9V74 80-Core Processor                

GPU: ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0), or similar · screen pixel ratio 1 · Gecko/20100101 Firefox/155.0

- worker: loaded, renderer worker, 8 features at the centre, terrain on (centre 10 m)
- main: loaded, renderer main, 8 features at the centre, terrain on (centre 10 m)

| Scenario | Load to idle | Frames per second | Slowest frame gap | Main-thread script per frame (median / worst) | Main thread blocked | Engine: time per frame, and its own count of frames |
|---|---|---|---|---|---|---|
| MapLibre GL JS | 1109 ms | 37.4 | 95 ms | 4.0 / 61.0 ms | 0 ms |  |
| This library, main thread | 1430 ms | 20.1 | 114 ms | 12.0 / 77.0 ms | 0 ms | 15.8 ms, 32 frames per second |
| This library, worker | 1514 ms | 24.5 | 382 ms | 0.0 / 0.0 ms | 0 ms | 27.0 ms, 36 frames per second |
| 1,000 markers: MapLibre Marker (DOM) (added in 62 ms) | 1172 ms | 19.7 | 94 ms | 16.0 / 65.0 ms | 0 ms |  |
| 1,000 markers: marker layer, main thread (added in 35 ms) | 1406 ms | 20.2 | 117 ms | 13.0 / 68.0 ms | 0 ms | 15.8 ms, 33 frames per second |
| 1,000 markers: marker layer, worker (added in 9 ms) | 1625 ms | 25.0 | 153 ms | 0.0 / 0.0 ms | 0 ms | 23.9 ms, 42 frames per second |
| 10,000 markers: MapLibre Marker (DOM) (added in 622 ms) | 1917 ms | 4.7 | 266 ms | 87.0 / 143.0 ms | 0 ms |  |
| 10,000 markers: marker layer, main thread (added in 16 ms) | 1395 ms | 20.7 | 120 ms | 16.0 / 81.0 ms | 0 ms | 20.7 ms, 25 frames per second |
| 10,000 markers: marker layer, worker (added in 30 ms) | 1450 ms | 26.4 | 134 ms | 0.0 / 0.0 ms | 0 ms | 23.2 ms, 42 frames per second |
| 100,000 markers: marker layer, worker (added in 23 ms) | 1935 ms | 34.2 | 313 ms | 0.0 / 0.0 ms | 0 ms | 21.1 ms, 44 frames per second |
| 3D terrain: MapLibre GL JS | 6307 ms | 4.1 | 674 ms | 34.0 / 282.0 ms | 0 ms |  |
| 3D terrain: this library, main thread | 1304 ms | 37.5 | 63 ms | 2.0 / 35.0 ms | 0 ms | 3.8 ms, 40 frames per second |
| 3D terrain: this library, worker | 1868 ms | 41.8 | 176 ms | 0.0 / 0.0 ms | 0 ms | 9.3 ms, 50 frames per second |
| 3D terrain: MapLibre GL JS (second measurement) | 6924 ms | 4.8 | 708 ms | 27.0 / 265.0 ms | 0 ms |  |
| 3D terrain: this library, main thread (second measurement) | 1172 ms | 37.1 | 52 ms | 2.0 / 49.0 ms | 0 ms | 4.5 ms, 45 frames per second |
| 3D terrain: this library, worker (second measurement) | 1414 ms | 41.3 | 218 ms | 0.0 / 0.0 ms | 0 ms | 9.2 ms, 45 frames per second |
| 3D terrain: MapLibre GL JS (third measurement) | 6851 ms | 5.3 | 838 ms | 25.0 / 133.0 ms | 0 ms |  |
| 3D terrain: this library, main thread (third measurement) | 1325 ms | 38.1 | 71 ms | 2.0 / 38.0 ms | 0 ms | 3.3 ms, 40 frames per second |
| 3D terrain: this library, worker (third measurement) | 1603 ms | 40.2 | 180 ms | 0.0 / 0.0 ms | 0 ms | 9.3 ms, 46 frames per second |
### win32-webkit (webkit 26.6)

win32 10.0.26100 x64, INTEL(R) XEON(R) PLATINUM 8573C

GPU: Apple GPU · screen pixel ratio 1 · AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Safari/605.1.15

- worker: loaded, renderer main, 8 features at the centre, terrain on (centre 0 m)
- main: loaded, renderer main, 8 features at the centre, terrain on (centre 0 m)

| Scenario | Load to idle | Frames per second | Slowest frame gap | Main-thread script per frame (median / worst) | Main thread blocked | Engine: time per frame, and its own count of frames |
|---|---|---|---|---|---|---|
| MapLibre GL JS | 1733 ms | 13.9 | 194 ms | 6.0 / 21.0 ms | 0 ms |  |
| This library, main thread | 1614 ms | 13.2 | 175 ms | 4.0 / 14.0 ms | 0 ms | 6.0 ms, 20 frames per second |
| This library, worker | 1457 ms | 13.2 | 150 ms | 3.0 / 13.0 ms | 0 ms | 4.1 ms, 21 frames per second |
| 1,000 markers: MapLibre Marker (DOM) (added in 115 ms) | 1567 ms | 10.7 | 174 ms | 14.0 / 26.0 ms | 0 ms |  |
| 1,000 markers: marker layer, main thread (added in 5 ms) | 1525 ms | 13.6 | 141 ms | 3.0 / 12.0 ms | 0 ms | 4.9 ms, 21 frames per second |
| 1,000 markers: marker layer, worker (added in 1 ms) | 1471 ms | 13.5 | 142 ms | 3.0 / 11.0 ms | 0 ms | 4.3 ms, 21 frames per second |
| 10,000 markers: MapLibre Marker (DOM) (added in 742 ms) | 1563 ms | 2.8 | 485 ms | 68.0 / 133.0 ms | 0 ms |  |
| 10,000 markers: marker layer, main thread (added in 15 ms) | 1585 ms | 12.7 | 175 ms | 3.0 / 11.0 ms | 0 ms | 4.6 ms, 20 frames per second |
| 10,000 markers: marker layer, worker (added in 6 ms) | 1443 ms | 12.9 | 151 ms | 3.0 / 38.0 ms | 0 ms | 5.2 ms, 20 frames per second |
| 100,000 markers: marker layer, worker (added in 6 ms) | 1429 ms | 10.0 | 211 ms | 3.0 / 32.0 ms | 0 ms | 6.3 ms, 17 frames per second |
| 3D terrain: MapLibre GL JS | 6105 ms | 2.0 | 1347 ms | 12.0 / 17.0 ms | 0 ms |  |
| 3D terrain: this library, main thread | 3336 ms | 45.3 | 44 ms | 3.0 / 9.0 ms | 0 ms | 2.5 ms, 61 frames per second |
| 3D terrain: this library, worker | 3307 ms | 46.8 | 47 ms | 2.0 / 6.0 ms | 0 ms | 2.6 ms, 47 frames per second |
| 3D terrain: MapLibre GL JS (second measurement) | 6503 ms | 2.0 | 1310 ms | 15.0 / 51.0 ms | 0 ms |  |
| 3D terrain: this library, main thread (second measurement) | 3354 ms | 53.2 | 48 ms | 2.0 / 9.0 ms | 0 ms | 2.7 ms, 54 frames per second |
| 3D terrain: this library, worker (second measurement) | 3297 ms | 53.2 | 79 ms | 2.0 / 13.0 ms | 0 ms | 2.1 ms, 68 frames per second |

Errors: bench: page.waitForFunction: Timeout 300000ms exceeded.
## Failed behaviour tests

### darwin-chromium

```
(none)
```

### darwin-firefox

```
FAIL  [worker] jumpTo fires zoom, rotate and pitch 
FAIL  [worker] marker hover sets pointer cursor 
FAIL  [worker] once with no listener returns a promise for the event {"isPromise":true,"chained":true}
FAIL  [worker] touch: a deliberate twist rotates, two fingers moving up tilts [{"zoom":15.000000000000004,"bearing":0,"pitch":0},{"zoom":15.000000000000004,"bearing":0,"pitch":0}]
FAIL  [worker] touch: double-tap zooms in, two-finger tap zooms out, tap-and-drag zooms [14,13,13.999999999999996]
FAIL  [worker] feature state is set, merged and removed, and the map is idle after a state that no layer reads {"both":{"hover":true,"picked":1},"one":{"picked":1},"none":{},"unread":0,"read":0,"idle":false,"sent":[],"warned":["[map-jr-gl] setFeatureState(): the source \"omt\" is not GeoJSON, and the id \"abc\" is a string. Feature state on a vector source needs the numeric id of the feature in the tile."]}
FAIL  [worker] dblclick: preventDefault() in a listener stops the zoom, and without it the map zooms in {"zPrevented":14,"zDouble":14}
FAIL  [worker] touch double-tap: preventDefault() in a dblclick listener stops the zoom and sets defaultPrevented {"tPrevented":{"z":14,"seen":true},"tDouble":{"z":14,"seen":false}}
FAIL  [worker] a touch tap with no hover: a click listener reads the features of tiles at once {"ms":556,"found":0}
FAIL  [worker] padding per side: fitBounds and moveTo take {top, right, bottom, left}, and padding of the description moves the centre {"fit":[637,293],"moved":[593,293],"spec":[293,293],"cleared":[443,293]}
FAIL  [worker] an SVG image without a viewBox has the size of its width and height: 40×40 is not cropped, and 9×9 after it is centred on its anchor {"big":"423,462,273,312","small":"438,446,288,296"}
FAIL  [main] padding per side: fitBounds and moveTo take {top, right, bottom, left}, and padding of the description moves the centre {"fit":[637,293],"moved":[593,293],"spec":[293,293],"cleared":[443,293]}
FAIL  [main] an SVG image without a viewBox has the size of its width and height: 40×40 is not cropped, and 9×9 after it is centred on its anchor {"big":"423,462,273,312","small":"438,446,288,296"}
FAIL  no WebGL2 (main API, worker): supported() is false, the map reports one error and shows a message in the container, and removing the map removes the message {"able":true,"supported":false,"errors":["[map-jr-gl] The map cannot be shown: WebGL2 is not available. Call supported() before you make a map, and show other content when it returns false."],"error":"[map-jr-gl] The map cannot be shown: WebGL2 is not available. Call supported() before you make a map, and show other content when it returns false.","loaded":false,"text":"This browser cannot show the map.","count":1,"children":0,"cover
FAIL  no WebGL2 (main API, main): supported() is false, the map reports one error and shows a message in the container, and removing the map removes the message {"able":true,"supported":false,"errors":["[map-jr-gl] The map cannot be shown: WebGL2 is not available. Call supported() before you make a map, and show other content when it returns false."],"error":"[map-jr-gl] The map cannot be shown: WebGL2 is not available. Call supported() before you make a map, and show other content when it returns false.","loaded":false,"text":"This browser cannot show the map.","count":1,"children":0,"covers"
FAIL  no WebGL2 (maplibre-compat, worker): supported() is false, the map reports one error and shows a message in the container, and removing the map removes the message {"able":true,"supported":false,"errors":["[map-jr-gl] The map cannot be shown: WebGL2 is not available. Call supported() before you make a map, and show other content when it returns false."],"error":"[map-jr-gl] The map cannot be shown: WebGL2 is not available. Call supported() before you make a map, and show other content when it returns false.","loaded":false,"text":"This browser cannot show the map.","count":1,"children":0
```

### darwin-webkit

```
FAIL  [main] queryRenderedFeatures read at once has the features of tiles: in a click listener, and on idle {"idle":[0,6,6],"click":0}
FAIL  [main] no page errors There are too many active WebGL contexts on this page, the oldest context will be lost. | WebGL: INVALID_OPERATION: loseContext: context already lost | There are too many active WebGL contexts on this page, the oldest context will be lost.
FAIL  [main] icons from the buffers of the tiles are drawn as icons that are placed with the labels: on a flat map and on a turned and tilted map, with a size, a turn and an opacity for each feature [{"different":1835,"red":31130},{"different":2649,"red":27363}]
```

### linux-chromium

```
(none)
```

### linux-firefox

```
FAIL  [worker] touch: double-tap zooms in, two-finger tap zooms out, tap-and-drag zooms [15,15,15.977605247702835]
```

### linux-webkit

```
FAIL  setWorkerUrl with the worker file of MapLibre GL JS is ignored with one warning, and the map keeps its own worker {"renderer":"main","url":"","warns":["[map-jr-gl] setWorkerUrl(): this is the worker file of MapLibre GL JS, which this library cannot use. Remove the call; the library finds map-jr-gl-worker.js itself."]}
FAIL  [main] two maps with the same source name keep their own feature state and global state {"a":"255,0,0","b":"0,0,255","stateA":"{}"}
FAIL  [main] no page errors There are too many active WebGL contexts on this page, the oldest context will be lost. | WebGL: INVALID_OPERATION: loseContext: context already lost | There are too many active WebGL contexts on this page, the oldest context will be lost.
FAIL  [worker] GeoJSON source: 50 calls of setData in a loop send only the last data {"one":0,"fifty":0,"drawn":["n49"]}
FAIL  [worker] touch double-tap: preventDefault() in a dblclick listener stops the zoom and sets defaultPrevented {"tPrevented":{"z":14,"seen":null},"tDouble":{"z":14,"seen":true}}
FAIL  setWorkerUrl with the worker file of MapLibre GL JS is ignored with one warning, and the map keeps its own worker {"renderer":"main","url":"","warns":["[map-jr-gl] setWorkerUrl(): this is the worker file of MapLibre GL JS, which this library cannot use. Remove the call; the library finds map-jr-gl-worker.js itself."]}
FAIL  [worker] two maps with the same source name keep their own feature state and global state {"a":"255,0,0","b":"0,0,255","stateA":"{}"}
FAIL  [worker] a source that fails: one error with the URL, the other layers are drawn and load fires {"seen":["error: Failed to load source http://localhost:8080/no-such-tilejson.json: 404","style.load","error: Failed to load source http://localhost:8080/no-such-tilejson.json: 404","load"],"loaded":true,"drawn":4}
FAIL  [worker] a map that keeps moving from the start still requests its overview tiles requests=2, idle events=1
FAIL  [worker] a worker without WebGL2 and an engine chunk that takes 6 seconds: one engine on the main thread, one warning, and no webglcontextlost {"renderer":"main","seen":["load","idle"],"warnings":2,"canvases":1}
FAIL  [worker] a worker that loses its WebGL context at once: the map goes to the main thread after one or two losses, warns once, and load and idle fire {"renderer":"main","lost":0,"seen":["load","idle"],"warnings":0,"waited":0,"toMain":213,"loaded":true,"layer":878}
FAIL  [worker] one loss, one restore, then a worker that cannot draw: the map goes to the main thread after 5 seconds, warns once, and load and idle fire {"renderer":"main","lost":0,"seen":["load","idle"],"warnings":0,"waited":0,"toMain":197,"loaded":true,"layer":878}
FAIL  [worker] one loss, one restore, then a worker that stops after its first frame: the map goes to the main thread after 5 seconds, warns once, and load and idle fire {"renderer":"main","lost":0,"seen":["load","idle"],"warnings":0,"waited":0,"toMain":179,"loaded":true,"layer":878}
FAIL  [worker] the same while the page is hidden for 8 seconds: the map stays with the worker for that time, and goes to the main thread 5 seconds later {"renderer":"main","lost":0,"seen":["load","idle"],"warnings":0,"waited":0,"toMain":187,"loaded":true,"layer":878}
FAIL  [worker] a worker that stops after its first frame at its first start, with no lost context: the map goes to the main thread after 5 seconds, warns once, and load and idle fire {"renderer":"main","lost":0,"seen":["load","idle"],"warnings":0,"waited":0,"toMain":171,"loaded":true,"layer":878}
FAIL  [worker] no page errors There are too many active WebGL contexts on this page, the oldest context will be lost. | WebGL: INVALID_OPERATION: loseContext: context already lost
FAIL  [worker] common mistakes: each gives one warning, a wrong place of a query is refused with a message, and a correct description gives no warning {"correct":["[map-jr-gl] Worker rendering unavailable, using the main thread: WebGL2 is not available","[map-jr-gl] Worker rendering unavailable, using the main thread: WebGL2 is not available","[map-jr-gl] Worker rendering unavailable, using the main thread: WebGL2 is not available","[map-jr-gl] Worker rendering unavailable, using the main thread: WebGL2 is not available"],"said":["[map-jr-gl] markers: two marker layers have the id \"a\". Give 
FAIL  [worker] images follow the description: added, the same content is not added again, replaced, the last of two changes stays, removed, and an image that does not load is an error {"first":"#f0f","again":0,"replaced":"#0ff","last":"#00f","stays":true,"gone":{"errors":["[map-jr-gl] images: the image \"lost\" did not load. Give an SVG document or the URL of an image that the page can read."],"has":false},"late":false,"after":["#00f","#00f"]}
FAIL  [worker] generateId on a GeoJSON source gives each feature its index as its id, and feature state finds it {"generatedOff":"#000 #0f0 #000 #0f0","generatedOn":"#000 #0f0 #000 #0f0"}
FAIL  [worker] a new image that finds no free place in the texture of the images makes the map place its images again, and they are drawn {"repack":[],"afterRepack":"#888 #888 #888 #888"}
FAIL  [worker] an image that is an SVG template: slots get the properties of each feature or the params of the image expression (also with feature-state), another template draws the variants again, a value is not markup, and too many variants give one error {"fromProperties":"#f0f #f0f #0ff #0ff","fromParams":"#eed #eed #eed #ffe","otherTemplate":"#eed #eed #eed #ffe","stateOff":"#000 #0f0 #000 #0f0","stateOn":"#000 #0f0 #eed #ffe","unsafe":"#000 #000 #000 #000","many":["[map-jr-gl] The image \"tiny\" has more than 1000 different sets of values for its slots, and the others are not drawn. Give
FAIL  [main] images follow the description: added, the same content is not added again, replaced, the last of two changes stays, removed, and an image that does not load is an error {"first":"#f0f","again":0,"replaced":"#0ff","last":"#00f","stays":true,"gone":{"errors":["[map-jr-gl] images: the image \"lost\" did not load. Give an SVG document or the URL of an image that the page can read."],"has":false},"late":false,"after":["#00f","#00f"]}
FAIL  [main] a new image that finds no free place in the texture of the images makes the map place its images again, and they are drawn {"repack":[],"afterRepack":"#888 #888 #888 #888"}
FAIL  [main] an image that is an SVG template: slots get the properties of each feature or the params of the image expression (also with feature-state), another template draws the variants again, a value is not markup, and too many variants give one error {"fromProperties":"#eed #eed #eed #ffe","fromParams":"#ff0 #ff0 #00f #00f","otherTemplate":"#000 #ff0 #000 #00f","stateOff":"#eed #eed #eed #ffe","stateOn":"#000 #0f0 #eed #ffe","unsafe":"#000 #000 #000 #000","many":["[map-jr-gl] The image \"tiny\" has more than 1000 different sets of values for its slots, and the others are not drawn. Give i
FAIL  the development build, and the file of the checks does not load: the map draws with no warning, a wrong place of a query is refused with a short message, no rejection is unhandled, and the file of the checks was requested {"said":["[map-jr-gl] Worker rendering unavailable, using the main thread: WebGL2 is not available"],"unhandled":[],"place":"[map-jr-gl] queryFeatures(): the place is not {x, y} or [lng, lat].","drawn":8617,"asked":7}
FAIL  the production build: the map draws with no warning, a wrong place of a query is refused with a short message, no rejection is unhandled, and the file of the checks is not requested {"said":["[map-jr-gl] Worker rendering unavailable, using the main thread: WebGL2 is not available"],"unhandled":[],"place":"[map-jr-gl] queryFeatures(): the place is not {x, y} or [lng, lat].","drawn":8617,"asked":0}
FAIL  a worker file of another version: two maps give one warning with both versions, and they load {"said":["[map-jr-gl] The worker file is version 0.0.1 and the page file is version 0.3.0. Serve map-jr-gl-worker.js from the same version of the package as the page file, or pass `workerUrl` with the URL of that file.","[map-jr-gl] Worker rendering unavailable, using the main thread: WebGL2 is not available","[map-jr-gl] Worker rendering unavailable, using the main thread: WebGL2 is not available"],"loaded":[true,true],"changed":1}
FAIL  the worker file of the same version: no warning {"said":["[map-jr-gl] Worker rendering unavailable, using the main thread: WebGL2 is not available","[map-jr-gl] Worker rendering unavailable, using the main thread: WebGL2 is not available"],"loaded":[true,true],"changed":0}
FAIL  browser: reactive GeoJSON and a reactive style (Vue proxies) are drawn in both entries and with both renderers, without errors, and data that cannot be copied is an error event (#242) {"compat worker":{"found":1,"style":true,"errs":[],"cycle":false},"main API worker":{"found":1,"errs":[]},"compat main":{"found":1,"style":true,"errs":[],"cycle":true},"main API main":{"found":1,"errs":[]}}
```

### win32-chromium

```
FAIL  [main] a touch tap with no hover: a click listener reads the features of tiles at once {"ms":458,"found":0}
FAIL  [worker] icons from the buffers of the tiles are drawn as icons that are placed with the labels: on a flat map and on a turned and tilted map, with a size, a turn and an opacity for each feature [{"different":493,"red":30632},{"different":614,"red":26893}]
```

### win32-firefox

```
(none)
```

### win32-webkit

```
FAIL  setWorkerUrl with the worker file of MapLibre GL JS is ignored with one warning, and the map keeps its own worker {"renderer":"main","url":"","warns":["[map-jr-gl] setWorkerUrl(): this is the worker file of MapLibre GL JS, which this library cannot use. Remove the call; the library finds map-jr-gl-worker.js itself."]}
FAIL  [main] the test run was completed page.evaluate: ReferenceError: Can't find variable: OffscreenCanvas
FAIL  setWorkerUrl with the worker file of MapLibre GL JS is ignored with one warning, and the map keeps its own worker {"renderer":"main","url":"","warns":["[map-jr-gl] setWorkerUrl(): this is the worker file of MapLibre GL JS, which this library cannot use. Remove the call; the library finds map-jr-gl-worker.js itself."]}
FAIL  [worker] the test run was completed page.evaluate: ReferenceError: Can't find variable: OffscreenCanvas
FAIL  [worker] the test run was completed page.evaluate: ReferenceError: Can't find variable: OffscreenCanvas
FAIL  [main] the test run was completed page.evaluate: ReferenceError: Can't find variable: OffscreenCanvas
```

