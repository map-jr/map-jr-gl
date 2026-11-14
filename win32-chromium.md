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
