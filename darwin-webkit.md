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
