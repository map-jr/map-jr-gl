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
