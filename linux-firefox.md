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
