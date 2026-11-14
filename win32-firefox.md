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
