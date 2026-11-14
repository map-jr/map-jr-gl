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
