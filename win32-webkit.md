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
