### linux-chromium (chromium 159.0.8154.6)

linux 7.0.0-1016-aws x64, Intel(R) Xeon(R) 6975P-C

GPU: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) · screen pixel ratio 1 · map-jr-gl 0.9.0, commit unknown · MapLibre GL JS 6.17.0 · AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/159.0.8154.6 Safari/537.36

Runs of the page: 1 in 12 min.

- worker: loaded, renderer worker, 8 features at the centre, terrain on (centre 10 m)
- main: loaded, renderer main, 8 features at the centre, terrain on (centre 10 m)

| Scenario | Library | Measure | Median | Range | Runs |
|---|---|---|---|---|---|
| Load to idle | MapLibre GL JS | Load to idle | 740 ms |  | 1 |
| Load to idle | MapLibre GL JS | First frame | 73 ms |  | 1 |
| Load to idle | MapLibre GL JS | load event | 731 ms |  | 1 |
| Load to idle | This library, main thread | Load to idle | 475 ms |  | 1 |
| Load to idle | This library, main thread | First frame | 54 ms |  | 1 |
| Load to idle | This library, main thread | load event | 475 ms |  | 1 |
| Load to idle | This library, worker | Load to idle | 424 ms |  | 1 |
| Load to idle | This library, worker | First frame | 55 ms |  | 1 |
| Load to idle | This library, worker | load event | 424 ms |  | 1 |
| 3D terrain | MapLibre GL JS | Load to idle | 616 ms |  | 1 |
| 3D terrain | MapLibre GL JS | Pan: frames per second | 5.9 fps |  | 1 |
| 3D terrain | MapLibre GL JS | Pan: median frame gap | 17.5 ms |  | 1 |
| 3D terrain | MapLibre GL JS | Pan: 90th percentile frame gap | 805.7 ms |  | 1 |
| 3D terrain | MapLibre GL JS | Pan: worst frame gap | 1540 ms |  | 1 |
| 3D terrain | This library, main thread | Load to idle | 317 ms |  | 1 |
| 3D terrain | This library, main thread | Pan: frames per second | 13.7 fps |  | 1 |
| 3D terrain | This library, main thread | Pan: median frame gap | 67.2 ms |  | 1 |
| 3D terrain | This library, main thread | Pan: 90th percentile frame gap | 150.2 ms |  | 1 |
| 3D terrain | This library, main thread | Pan: worst frame gap | 293 ms |  | 1 |
| 3D terrain | This library, worker | Load to idle | 350 ms |  | 1 |
| 3D terrain | This library, worker | Pan: frames per second | 17.6 fps |  | 1 |
| 3D terrain | This library, worker | Pan: median frame gap | 20.4 ms |  | 1 |
| 3D terrain | This library, worker | Pan: 90th percentile frame gap | 143.1 ms |  | 1 |
| 3D terrain | This library, worker | Pan: worst frame gap | 438 ms |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Load to idle | 773 ms |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Turn: frames per second | 14.5 fps |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Turn: median frame gap | 28.5 ms |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Turn: 90th percentile frame gap | 152.6 ms |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Turn: worst frame gap | 202 ms |  | 1 |
| Pitch 85 with sky | This library, main thread | Load to idle | 1270 ms |  | 1 |
| Pitch 85 with sky | This library, main thread | Turn: frames per second | 4.1 fps |  | 1 |
| Pitch 85 with sky | This library, main thread | Turn: median frame gap | 286.1 ms |  | 1 |
| Pitch 85 with sky | This library, main thread | Turn: 90th percentile frame gap | 441.3 ms |  | 1 |
| Pitch 85 with sky | This library, main thread | Turn: worst frame gap | 567 ms |  | 1 |
| Pitch 85 with sky | This library, worker | Load to idle | 1264 ms |  | 1 |
| Pitch 85 with sky | This library, worker | Turn: frames per second | 3.9 fps |  | 1 |
| Pitch 85 with sky | This library, worker | Turn: median frame gap | 287.7 ms |  | 1 |
| Pitch 85 with sky | This library, worker | Turn: 90th percentile frame gap | 379.3 ms |  | 1 |
| Pitch 85 with sky | This library, worker | Turn: worst frame gap | 450 ms |  | 1 |
| Globe | MapLibre GL JS | Load to idle | 753 ms |  | 1 |
| Globe | MapLibre GL JS | Turn: frames per second | 12.0 fps |  | 1 |
| Globe | MapLibre GL JS | Turn: median frame gap | 102.3 ms |  | 1 |
| Globe | MapLibre GL JS | Turn: 90th percentile frame gap | 112.8 ms |  | 1 |
| Globe | MapLibre GL JS | Turn: worst frame gap | 317 ms |  | 1 |
| Globe | This library, main thread | Load to idle | 389 ms |  | 1 |
| Globe | This library, main thread | Turn: frames per second | 45.6 fps |  | 1 |
| Globe | This library, main thread | Turn: median frame gap | 23.6 ms |  | 1 |
| Globe | This library, main thread | Turn: 90th percentile frame gap | 28.8 ms |  | 1 |
| Globe | This library, main thread | Turn: worst frame gap | 42 ms |  | 1 |
| Globe | This library, worker | Load to idle | 367 ms |  | 1 |
| Globe | This library, worker | Turn: frames per second | 51.2 fps |  | 1 |
| Globe | This library, worker | Turn: median frame gap | 16.7 ms |  | 1 |
| Globe | This library, worker | Turn: 90th percentile frame gap | 35.5 ms |  | 1 |
| Globe | This library, worker | Turn: worst frame gap | 97 ms |  | 1 |
| Camera | MapLibre GL JS | Static repaint: frames per second | 18.7 fps |  | 1 |
| Camera | MapLibre GL JS | Static repaint: median frame gap | 17.4 ms |  | 1 |
| Camera | MapLibre GL JS | Static repaint: 90th percentile frame gap | 118.9 ms |  | 1 |
| Camera | MapLibre GL JS | Static repaint: worst frame gap | 321 ms |  | 1 |
| Camera | MapLibre GL JS | Pan: frames per second | 8.7 fps |  | 1 |
| Camera | MapLibre GL JS | Pan: median frame gap | 114.4 ms |  | 1 |
| Camera | MapLibre GL JS | Pan: 90th percentile frame gap | 169.9 ms |  | 1 |
| Camera | MapLibre GL JS | Pan: worst frame gap | 178 ms |  | 1 |
| Camera | MapLibre GL JS | Rotation: frames per second | 8.0 fps |  | 1 |
| Camera | MapLibre GL JS | Rotation: median frame gap | 117.0 ms |  | 1 |
| Camera | MapLibre GL JS | Rotation: 90th percentile frame gap | 202.2 ms |  | 1 |
| Camera | MapLibre GL JS | Rotation: worst frame gap | 218 ms |  | 1 |
| Camera | MapLibre GL JS | Zoom: frames per second | 7.1 fps |  | 1 |
| Camera | MapLibre GL JS | Zoom: median frame gap | 141.1 ms |  | 1 |
| Camera | MapLibre GL JS | Zoom: 90th percentile frame gap | 229.6 ms |  | 1 |
| Camera | MapLibre GL JS | Zoom: worst frame gap | 244 ms |  | 1 |
| Camera | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera | MapLibre GL JS | Pixel ratio of the drawing buffer | 1.00 |  | 1 |
| Camera | This library, main thread | Static repaint: frames per second | 15.6 fps |  | 1 |
| Camera | This library, main thread | Static repaint: median frame gap | 17.1 ms |  | 1 |
| Camera | This library, main thread | Static repaint: 90th percentile frame gap | 136.8 ms |  | 1 |
| Camera | This library, main thread | Static repaint: worst frame gap | 256 ms |  | 1 |
| Camera | This library, main thread | Pan: frames per second | 7.2 fps |  | 1 |
| Camera | This library, main thread | Pan: median frame gap | 133.5 ms |  | 1 |
| Camera | This library, main thread | Pan: 90th percentile frame gap | 200.9 ms |  | 1 |
| Camera | This library, main thread | Pan: worst frame gap | 232 ms |  | 1 |
| Camera | This library, main thread | Rotation: frames per second | 6.4 fps |  | 1 |
| Camera | This library, main thread | Rotation: median frame gap | 143.4 ms |  | 1 |
| Camera | This library, main thread | Rotation: 90th percentile frame gap | 281.9 ms |  | 1 |
| Camera | This library, main thread | Rotation: worst frame gap | 367 ms |  | 1 |
| Camera | This library, main thread | Zoom: frames per second | 5.9 fps |  | 1 |
| Camera | This library, main thread | Zoom: median frame gap | 179.8 ms |  | 1 |
| Camera | This library, main thread | Zoom: 90th percentile frame gap | 202.1 ms |  | 1 |
| Camera | This library, main thread | Zoom: worst frame gap | 210 ms |  | 1 |
| Camera | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera | This library, main thread | Pixel ratio of the drawing buffer | 1.00 |  | 1 |
| Camera | This library, worker | Static repaint: frames per second | 18.9 fps |  | 1 |
| Camera | This library, worker | Static repaint: median frame gap | 17.2 ms |  | 1 |
| Camera | This library, worker | Static repaint: 90th percentile frame gap | 135.5 ms |  | 1 |
| Camera | This library, worker | Static repaint: worst frame gap | 277 ms |  | 1 |
| Camera | This library, worker | Pan: frames per second | 10.5 fps |  | 1 |
| Camera | This library, worker | Pan: median frame gap | 116.7 ms |  | 1 |
| Camera | This library, worker | Pan: 90th percentile frame gap | 262.5 ms |  | 1 |
| Camera | This library, worker | Pan: worst frame gap | 283 ms |  | 1 |
| Camera | This library, worker | Rotation: frames per second | 5.5 fps |  | 1 |
| Camera | This library, worker | Rotation: median frame gap | 174.3 ms |  | 1 |
| Camera | This library, worker | Rotation: 90th percentile frame gap | 382.3 ms |  | 1 |
| Camera | This library, worker | Rotation: worst frame gap | 530 ms |  | 1 |
| Camera | This library, worker | Zoom: frames per second | 4.7 fps |  | 1 |
| Camera | This library, worker | Zoom: median frame gap | 266.0 ms |  | 1 |
| Camera | This library, worker | Zoom: 90th percentile frame gap | 334.6 ms |  | 1 |
| Camera | This library, worker | Zoom: worst frame gap | 341 ms |  | 1 |
| Camera | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera | This library, worker | Pixel ratio of the drawing buffer | 1.00 |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: frames per second | 14.9 fps |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: median frame gap | 17.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 192.6 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: worst frame gap | 377 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: frames per second | 4.8 fps |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: median frame gap | 191.6 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: 90th percentile frame gap | 287.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: worst frame gap | 287 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: frames per second | 5.7 fps |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: median frame gap | 188.9 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: 90th percentile frame gap | 196.2 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: worst frame gap | 205 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: frames per second | 4.5 fps |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: median frame gap | 201.3 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: 90th percentile frame gap | 336.3 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: worst frame gap | 336 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pixel ratio of the drawing buffer | 2.00 |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: frames per second | 12.2 fps |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: median frame gap | 16.8 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: 90th percentile frame gap | 239.5 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: worst frame gap | 435 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pan: frames per second | 4.3 fps |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pan: median frame gap | 246.2 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pan: 90th percentile frame gap | 377.7 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pan: worst frame gap | 378 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: frames per second | 4.2 fps |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: median frame gap | 240.2 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: 90th percentile frame gap | 269.5 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: worst frame gap | 270 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: frames per second | 4.4 fps |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: median frame gap | 243.1 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: 90th percentile frame gap | 286.6 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: worst frame gap | 287 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pixel ratio of the drawing buffer | 2.00 |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: frames per second | 14.4 fps |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: median frame gap | 16.9 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: 90th percentile frame gap | 233.5 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: worst frame gap | 454 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pan: frames per second | 5.6 fps |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pan: median frame gap | 222.3 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pan: 90th percentile frame gap | 378.4 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pan: worst frame gap | 477 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Rotation: frames per second | 6.4 fps |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Rotation: median frame gap | 53.5 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Rotation: 90th percentile frame gap | 467.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Rotation: worst frame gap | 478 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Zoom: frames per second | 4.0 fps |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Zoom: median frame gap | 255.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Zoom: 90th percentile frame gap | 941.4 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Zoom: worst frame gap | 941 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pixel ratio of the drawing buffer | 2.00 |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: frames per second | 13.0 fps |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: median frame gap | 16.8 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 307.5 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: worst frame gap | 620 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: frames per second | 3.4 fps |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: median frame gap | 314.9 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: 90th percentile frame gap | 413.6 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: worst frame gap | 414 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: frames per second | 3.8 fps |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: median frame gap | 312.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: 90th percentile frame gap | 407.2 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: worst frame gap | 407 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: frames per second | 3.4 fps |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: median frame gap | 306.6 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: 90th percentile frame gap | 482.2 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: worst frame gap | 482 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pixel ratio of the drawing buffer | 3.00 |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: frames per second | 8.9 fps |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: median frame gap | 16.8 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: 90th percentile frame gap | 388.7 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: worst frame gap | 762 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Pan: frames per second | 1.8 fps |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Pan: median frame gap | 386.4 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Pan: 90th percentile frame gap | 913.8 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Pan: worst frame gap | 914 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: frames per second | 2.6 fps |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: median frame gap | 379.2 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: 90th percentile frame gap | 423.6 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: worst frame gap | 424 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: frames per second | 2.6 fps |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: median frame gap | 369.6 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: 90th percentile frame gap | 747.9 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: worst frame gap | 748 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Pixel ratio of the drawing buffer | 3.00 |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: frames per second | 12.4 fps |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: median frame gap | 16.8 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: 90th percentile frame gap | 378.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: worst frame gap | 649 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Pan: frames per second | 2.5 fps |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Pan: median frame gap | 399.2 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Pan: 90th percentile frame gap | 759.7 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Pan: worst frame gap | 760 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Rotation: frames per second | 1.7 fps |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Rotation: median frame gap | 577.1 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Rotation: 90th percentile frame gap | 784.4 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Rotation: worst frame gap | 784 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Zoom: frames per second | 3.7 fps |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Zoom: median frame gap | 380.8 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Zoom: 90th percentile frame gap | 381.3 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Zoom: worst frame gap | 381 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Pixel ratio of the drawing buffer | 3.00 |  | 1 |
| 1,000 markers | MapLibre GL JS | Add the markers | 33 ms |  | 1 |
| 1,000 markers | MapLibre GL JS | Pan: frames per second | 12.6 fps |  | 1 |
| 1,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 208.9 ms |  | 1 |
| 1,000 markers | MapLibre GL JS | Pan: worst frame gap | 234 ms |  | 1 |
| 1,000 markers | This library, main thread | Add the markers | 3 ms |  | 1 |
| 1,000 markers | This library, main thread | Pan: frames per second | 12.5 fps |  | 1 |
| 1,000 markers | This library, main thread | Pan: 90th percentile frame gap | 149.8 ms |  | 1 |
| 1,000 markers | This library, main thread | Pan: worst frame gap | 438 ms |  | 1 |
| 1,000 markers | This library, worker | Add the markers | 0 ms |  | 1 |
| 1,000 markers | This library, worker | Pan: frames per second | 12.9 fps |  | 1 |
| 1,000 markers | This library, worker | Pan: 90th percentile frame gap | 150.4 ms |  | 1 |
| 1,000 markers | This library, worker | Pan: worst frame gap | 288 ms |  | 1 |
| 10,000 markers | MapLibre GL JS | Add the markers | 398 ms |  | 1 |
| 10,000 markers | MapLibre GL JS | Pan: frames per second | 3.2 fps |  | 1 |
| 10,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 445.1 ms |  | 1 |
| 10,000 markers | MapLibre GL JS | Pan: worst frame gap | 493 ms |  | 1 |
| 10,000 markers | This library, main thread | Add the markers | 1 ms |  | 1 |
| 10,000 markers | This library, main thread | Pan: frames per second | 10.3 fps |  | 1 |
| 10,000 markers | This library, main thread | Pan: 90th percentile frame gap | 163.3 ms |  | 1 |
| 10,000 markers | This library, main thread | Pan: worst frame gap | 289 ms |  | 1 |
| 10,000 markers | This library, worker | Add the markers | 1 ms |  | 1 |
| 10,000 markers | This library, worker | Pan: frames per second | 12.0 fps |  | 1 |
| 10,000 markers | This library, worker | Pan: 90th percentile frame gap | 214.0 ms |  | 1 |
| 10,000 markers | This library, worker | Pan: worst frame gap | 303 ms |  | 1 |
| GeoJSON setData | MapLibre GL JS | addSource to idle | 359 ms |  | 1 |
| GeoJSON setData | MapLibre GL JS | Frames per second during the updates | 10.0 fps |  | 1 |
| GeoJSON setData | MapLibre GL JS | setData calls per second | 18.8 /s |  | 1 |
| GeoJSON setData | MapLibre GL JS | Worst frame gap | 346 ms |  | 1 |
| GeoJSON setData | MapLibre GL JS | Last setData to idle | 4 ms |  | 1 |
| GeoJSON setData | This library, main thread | addSource to idle | 106 ms |  | 1 |
| GeoJSON setData | This library, main thread | Frames per second during the updates | 12.8 fps |  | 1 |
| GeoJSON setData | This library, main thread | setData calls per second | 14.6 /s |  | 1 |
| GeoJSON setData | This library, main thread | Worst frame gap | 247 ms |  | 1 |
| GeoJSON setData | This library, main thread | Last setData to idle | 8 ms |  | 1 |
| GeoJSON setData | This library, worker | addSource to idle | 226 ms |  | 1 |
| GeoJSON setData | This library, worker | Frames per second during the updates | 9.0 fps |  | 1 |
| GeoJSON setData | This library, worker | setData calls per second | 17.1 /s |  | 1 |
| GeoJSON setData | This library, worker | Worst frame gap | 336 ms |  | 1 |
| GeoJSON setData | This library, worker | Last setData to idle | 404 ms |  | 1 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty, one per frame: first call to idle | 8701 ms |  | 1 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: the calls | 1.4 ms |  | 1 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: first call to idle | 456 ms |  | 1 |
| Run-time edits | MapLibre GL JS | 30 hover steps of setFeatureState, one per frame: first step to idle | 3406 ms |  | 1 |
| Run-time edits | MapLibre GL JS | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 117 ms |  | 1 |
| Run-time edits | This library, main thread | 100 × setPaintProperty, one per frame: first call to idle | 11414 ms |  | 1 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: the calls | 0.1 ms |  | 1 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: first call to idle | 408 ms |  | 1 |
| Run-time edits | This library, main thread | 30 hover steps of setFeatureState, one per frame: first step to idle | 3945 ms |  | 1 |
| Run-time edits | This library, main thread | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 19 ms |  | 1 |
| Run-time edits | This library, worker | 100 × setPaintProperty, one per frame: first call to idle | 6512 ms |  | 1 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: the calls | 0.2 ms |  | 1 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: first call to idle | 315 ms |  | 1 |
| Run-time edits | This library, worker | 30 hover steps of setFeatureState, one per frame: first step to idle | 3309 ms |  | 1 |
| Run-time edits | This library, worker | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 35 ms |  | 1 |
| Images | MapLibre GL JS | addImage and the icon layer: to idle | 727 ms |  | 1 |
| Images | MapLibre GL JS | 500 × updateImage, one per frame: first call to idle | 56996 ms |  | 1 |
| Images | MapLibre GL JS | Frames per second during the updates | 8.8 fps |  | 1 |
| Images | MapLibre GL JS | Worst frame gap during the updates | 236 ms |  | 1 |
| Images | MapLibre GL JS | 500 × updateImage in one task: the calls | 2.8 ms |  | 1 |
| Images | MapLibre GL JS | 500 × updateImage in one task: first call to idle | 112 ms |  | 1 |
| Images | This library, main thread | addImage and the icon layer: to idle | 260 ms |  | 1 |
| Images | This library, main thread | 500 × updateImage, one per frame: first call to idle | 65753 ms |  | 1 |
| Images | This library, main thread | Frames per second during the updates | 7.6 fps |  | 1 |
| Images | This library, main thread | Worst frame gap during the updates | 279 ms |  | 1 |
| Images | This library, main thread | 500 × updateImage in one task: the calls | 0.3 ms |  | 1 |
| Images | This library, main thread | 500 × updateImage in one task: first call to idle | 141 ms |  | 1 |
| Images | This library, worker | addImage and the icon layer: to idle | 296 ms |  | 1 |
| Images | This library, worker | 500 × updateImage, one per frame: first call to idle | 56149 ms |  | 1 |
| Images | This library, worker | Frames per second during the updates | 7.8 fps |  | 1 |
| Images | This library, worker | Worst frame gap during the updates | 667 ms |  | 1 |
| Images | This library, worker | 500 × updateImage in one task: the calls | 0.7 ms |  | 1 |
| Images | This library, worker | 500 × updateImage in one task: first call to idle | 116 ms |  | 1 |
| Lifecycle | MapLibre GL JS | Create to idle, median of 8 | 478 ms |  | 1 |
| Lifecycle | MapLibre GL JS | remove(), median of 8 | 438.9 ms |  | 1 |
| Lifecycle | MapLibre GL JS | Workers started by the 8 maps and not ended | 0 |  | 1 |
| Lifecycle | MapLibre GL JS | Two maps: create both to both idle | 781 ms |  | 1 |
| Lifecycle | MapLibre GL JS | Two maps: frames per second of each in a pan | 8.1 fps |  | 1 |
| Lifecycle | MapLibre GL JS | Two maps: worst frame gap | 300 ms |  | 1 |
| Lifecycle | This library, main thread | Create to idle, median of 8 | 379 ms |  | 1 |
| Lifecycle | This library, main thread | remove(), median of 8 | 492.9 ms |  | 1 |
| Lifecycle | This library, main thread | Workers started by the 8 maps and not ended | 0 |  | 1 |
| Lifecycle | This library, main thread | Two maps: create both to both idle | 697 ms |  | 1 |
| Lifecycle | This library, main thread | Two maps: frames per second of each in a pan | 5.3 fps |  | 1 |
| Lifecycle | This library, main thread | Two maps: worst frame gap | 330 ms |  | 1 |
| Lifecycle | This library, worker | Create to idle, median of 8 | 1015 ms |  | 1 |
| Lifecycle | This library, worker | remove(), median of 8 | 0.2 ms |  | 1 |
| Lifecycle | This library, worker | Workers started by the 8 maps and not ended | 0 |  | 1 |
| Lifecycle | This library, worker | Two maps: create both to both idle | 714 ms |  | 1 |
| Lifecycle | This library, worker | Two maps: frames per second of each in a pan | 6.5 fps |  | 1 |
| Lifecycle | This library, worker | Two maps: worst frame gap | 524 ms |  | 1 |
| Cold start | MapLibre GL JS | First tile request | 521 ms | 500–683 | 5 |
| Cold start | MapLibre GL JS | First frame | 424 ms | 399–584 | 5 |
| Cold start | MapLibre GL JS | Idle | 1086 ms | 1068–1264 | 5 |
| Cold start | MapLibre GL JS | Requests before idle (the page, and the workers of this library) | 7 | 7–7 | 5 |
| Cold start | MapLibre GL JS | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
| Cold start | This library, main thread | First tile request | 479 ms | 470–547 | 5 |
| Cold start | This library, main thread | First frame | 486 ms | 478–554 | 5 |
| Cold start | This library, main thread | Idle | 993 ms | 944–1079 | 5 |
| Cold start | This library, main thread | Requests before idle (the page, and the workers of this library) | 16 | 16–16 | 5 |
| Cold start | This library, main thread | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
| Cold start | This library, worker | First tile request | 516 ms | 493–522 | 5 |
| Cold start | This library, worker | First frame | 524 ms | 501–529 | 5 |
| Cold start | This library, worker | Idle | 1004 ms | 974–1023 | 5 |
| Cold start | This library, worker | Requests before idle (the page, and the workers of this library) | 12 | 12–12 | 5 |
| Cold start | This library, worker | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
