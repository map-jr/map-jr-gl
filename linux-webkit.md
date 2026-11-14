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
