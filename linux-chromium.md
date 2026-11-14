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
