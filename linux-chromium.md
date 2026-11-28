### linux-chromium (chromium 159.0.8154.6)

linux 7.0.0-1020-azure x64, AMD EPYC 7763 64-Core Processor

GPU: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) · screen pixel ratio 1 · map-jr-gl 0.11.0, commit unknown · MapLibre GL JS 6.17.0 · AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/159.0.8154.6 Safari/537.36

Runs of the page: 1 in 14.9 min.

- worker: loaded, renderer worker, 4 features at the centre, terrain on (centre 8 m)
- main: loaded, renderer main, 4 features at the centre, terrain on (centre 8 m)

| Scenario | Library | Measure | Median | Range | Runs |
|---|---|---|---|---|---|
| Load to idle | MapLibre GL JS | Load to idle | 1291 ms |  | 1 |
| Load to idle | MapLibre GL JS | First frame | 96 ms |  | 1 |
| Load to idle | MapLibre GL JS | load event | 905 ms |  | 1 |
| Load to idle | This library, main thread | Load to idle | 724 ms |  | 1 |
| Load to idle | This library, main thread | First frame | 84 ms |  | 1 |
| Load to idle | This library, main thread | load event | 723 ms |  | 1 |
| Load to idle | This library, worker | Load to idle | 756 ms |  | 1 |
| Load to idle | This library, worker | First frame | 74 ms |  | 1 |
| Load to idle | This library, worker | load event | 756 ms |  | 1 |
| 3D terrain | MapLibre GL JS | Load to idle | 841 ms |  | 1 |
| 3D terrain | MapLibre GL JS | Pan: frames per second | 36.3 fps |  | 1 |
| 3D terrain | MapLibre GL JS | Pan: median frame gap | 15.2 ms |  | 1 |
| 3D terrain | MapLibre GL JS | Pan: 90th percentile frame gap | 23.9 ms |  | 1 |
| 3D terrain | MapLibre GL JS | Pan: worst frame gap | 259 ms |  | 1 |
| 3D terrain | This library, main thread | Load to idle | 587 ms |  | 1 |
| 3D terrain | This library, main thread | Pan: frames per second | 7.6 fps |  | 1 |
| 3D terrain | This library, main thread | Pan: median frame gap | 23.2 ms |  | 1 |
| 3D terrain | This library, main thread | Pan: 90th percentile frame gap | 482.4 ms |  | 1 |
| 3D terrain | This library, main thread | Pan: worst frame gap | 648 ms |  | 1 |
| 3D terrain | This library, worker | Load to idle | 550 ms |  | 1 |
| 3D terrain | This library, worker | Pan: frames per second | 7.6 fps |  | 1 |
| 3D terrain | This library, worker | Pan: median frame gap | 27.2 ms |  | 1 |
| 3D terrain | This library, worker | Pan: 90th percentile frame gap | 413.4 ms |  | 1 |
| 3D terrain | This library, worker | Pan: worst frame gap | 935 ms |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Load to idle | 1052 ms |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Turn: frames per second | 11.3 fps |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Turn: median frame gap | 22.5 ms |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Turn: 90th percentile frame gap | 223.4 ms |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Turn: worst frame gap | 260 ms |  | 1 |
| Pitch 85 with sky | This library, main thread | Load to idle | 1230 ms |  | 1 |
| Pitch 85 with sky | This library, main thread | Turn: frames per second | 7.5 fps |  | 1 |
| Pitch 85 with sky | This library, main thread | Turn: median frame gap | 122.8 ms |  | 1 |
| Pitch 85 with sky | This library, main thread | Turn: 90th percentile frame gap | 295.7 ms |  | 1 |
| Pitch 85 with sky | This library, main thread | Turn: worst frame gap | 338 ms |  | 1 |
| Pitch 85 with sky | This library, worker | Load to idle | 1413 ms |  | 1 |
| Pitch 85 with sky | This library, worker | Turn: frames per second | 7.4 fps |  | 1 |
| Pitch 85 with sky | This library, worker | Turn: median frame gap | 59.7 ms |  | 1 |
| Pitch 85 with sky | This library, worker | Turn: 90th percentile frame gap | 355.2 ms |  | 1 |
| Pitch 85 with sky | This library, worker | Turn: worst frame gap | 451 ms |  | 1 |
| Globe | MapLibre GL JS | Load to idle | 6370 ms |  | 1 |
| Globe | MapLibre GL JS | Turn: frames per second | 7.9 fps |  | 1 |
| Globe | MapLibre GL JS | Turn: median frame gap | 137.8 ms |  | 1 |
| Globe | MapLibre GL JS | Turn: 90th percentile frame gap | 154.0 ms |  | 1 |
| Globe | MapLibre GL JS | Turn: worst frame gap | 397 ms |  | 1 |
| Globe | This library, main thread | Load to idle | 901 ms |  | 1 |
| Globe | This library, main thread | Turn: frames per second | 25.3 fps |  | 1 |
| Globe | This library, main thread | Turn: median frame gap | 39.6 ms |  | 1 |
| Globe | This library, main thread | Turn: 90th percentile frame gap | 55.0 ms |  | 1 |
| Globe | This library, main thread | Turn: worst frame gap | 79 ms |  | 1 |
| Globe | This library, worker | Load to idle | 800 ms |  | 1 |
| Globe | This library, worker | Turn: frames per second | 28.5 fps |  | 1 |
| Globe | This library, worker | Turn: median frame gap | 19.7 ms |  | 1 |
| Globe | This library, worker | Turn: 90th percentile frame gap | 76.6 ms |  | 1 |
| Globe | This library, worker | Turn: worst frame gap | 175 ms |  | 1 |
| Camera | MapLibre GL JS | Static repaint: frames per second | 15.9 fps |  | 1 |
| Camera | MapLibre GL JS | Static repaint: median frame gap | 16.9 ms |  | 1 |
| Camera | MapLibre GL JS | Static repaint: 90th percentile frame gap | 157.1 ms |  | 1 |
| Camera | MapLibre GL JS | Static repaint: worst frame gap | 414 ms |  | 1 |
| Camera | MapLibre GL JS | Pan: frames per second | 6.5 fps |  | 1 |
| Camera | MapLibre GL JS | Pan: median frame gap | 148.9 ms |  | 1 |
| Camera | MapLibre GL JS | Pan: 90th percentile frame gap | 242.1 ms |  | 1 |
| Camera | MapLibre GL JS | Pan: worst frame gap | 306 ms |  | 1 |
| Camera | MapLibre GL JS | Rotation: frames per second | 6.8 fps |  | 1 |
| Camera | MapLibre GL JS | Rotation: median frame gap | 143.8 ms |  | 1 |
| Camera | MapLibre GL JS | Rotation: 90th percentile frame gap | 170.5 ms |  | 1 |
| Camera | MapLibre GL JS | Rotation: worst frame gap | 287 ms |  | 1 |
| Camera | MapLibre GL JS | Zoom: frames per second | 4.9 fps |  | 1 |
| Camera | MapLibre GL JS | Zoom: median frame gap | 177.9 ms |  | 1 |
| Camera | MapLibre GL JS | Zoom: 90th percentile frame gap | 429.0 ms |  | 1 |
| Camera | MapLibre GL JS | Zoom: worst frame gap | 429 ms |  | 1 |
| Camera | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera | MapLibre GL JS | Pixel ratio of the drawing buffer | 1.00 |  | 1 |
| Camera | This library, main thread | Static repaint: frames per second | 11.5 fps |  | 1 |
| Camera | This library, main thread | Static repaint: median frame gap | 17.9 ms |  | 1 |
| Camera | This library, main thread | Static repaint: 90th percentile frame gap | 202.1 ms |  | 1 |
| Camera | This library, main thread | Static repaint: worst frame gap | 390 ms |  | 1 |
| Camera | This library, main thread | Pan: frames per second | 4.7 fps |  | 1 |
| Camera | This library, main thread | Pan: median frame gap | 206.4 ms |  | 1 |
| Camera | This library, main thread | Pan: 90th percentile frame gap | 329.7 ms |  | 1 |
| Camera | This library, main thread | Pan: worst frame gap | 330 ms |  | 1 |
| Camera | This library, main thread | Rotation: frames per second | 5.3 fps |  | 1 |
| Camera | This library, main thread | Rotation: median frame gap | 186.8 ms |  | 1 |
| Camera | This library, main thread | Rotation: 90th percentile frame gap | 217.1 ms |  | 1 |
| Camera | This library, main thread | Rotation: worst frame gap | 302 ms |  | 1 |
| Camera | This library, main thread | Zoom: frames per second | 5.1 fps |  | 1 |
| Camera | This library, main thread | Zoom: median frame gap | 223.1 ms |  | 1 |
| Camera | This library, main thread | Zoom: 90th percentile frame gap | 232.0 ms |  | 1 |
| Camera | This library, main thread | Zoom: worst frame gap | 245 ms |  | 1 |
| Camera | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera | This library, main thread | Pixel ratio of the drawing buffer | 1.00 |  | 1 |
| Camera | This library, worker | Static repaint: frames per second | 17.2 fps |  | 1 |
| Camera | This library, worker | Static repaint: median frame gap | 16.9 ms |  | 1 |
| Camera | This library, worker | Static repaint: 90th percentile frame gap | 192.5 ms |  | 1 |
| Camera | This library, worker | Static repaint: worst frame gap | 377 ms |  | 1 |
| Camera | This library, worker | Pan: frames per second | 5.3 fps |  | 1 |
| Camera | This library, worker | Pan: median frame gap | 189.8 ms |  | 1 |
| Camera | This library, worker | Pan: 90th percentile frame gap | 368.4 ms |  | 1 |
| Camera | This library, worker | Pan: worst frame gap | 390 ms |  | 1 |
| Camera | This library, worker | Rotation: frames per second | 4.5 fps |  | 1 |
| Camera | This library, worker | Rotation: median frame gap | 205.4 ms |  | 1 |
| Camera | This library, worker | Rotation: 90th percentile frame gap | 383.0 ms |  | 1 |
| Camera | This library, worker | Rotation: worst frame gap | 383 ms |  | 1 |
| Camera | This library, worker | Zoom: frames per second | 5.3 fps |  | 1 |
| Camera | This library, worker | Zoom: median frame gap | 75.4 ms |  | 1 |
| Camera | This library, worker | Zoom: 90th percentile frame gap | 428.5 ms |  | 1 |
| Camera | This library, worker | Zoom: worst frame gap | 500 ms |  | 1 |
| Camera | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera | This library, worker | Pixel ratio of the drawing buffer | 1.00 |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: frames per second | 13.0 fps |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: median frame gap | 16.9 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 321.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: worst frame gap | 425 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: frames per second | 3.5 fps |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: median frame gap | 249.2 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: 90th percentile frame gap | 381.6 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: worst frame gap | 382 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: frames per second | 4.0 fps |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: median frame gap | 246.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: 90th percentile frame gap | 259.6 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: worst frame gap | 260 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: frames per second | 3.8 fps |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: median frame gap | 246.7 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: 90th percentile frame gap | 534.2 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: worst frame gap | 534 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pixel ratio of the drawing buffer | 2.00 |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: frames per second | 10.4 fps |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: median frame gap | 17.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: 90th percentile frame gap | 366.6 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: worst frame gap | 378 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pan: frames per second | 2.8 fps |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pan: median frame gap | 384.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pan: 90th percentile frame gap | 470.8 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pan: worst frame gap | 471 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: frames per second | 2.1 fps |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: median frame gap | 387.5 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: 90th percentile frame gap | 724.7 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: worst frame gap | 725 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: frames per second | 3.2 fps |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: median frame gap | 369.7 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: 90th percentile frame gap | 390.4 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: worst frame gap | 390 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pixel ratio of the drawing buffer | 2.00 |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: frames per second | 11.3 fps |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: median frame gap | 20.3 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: 90th percentile frame gap | 361.7 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: worst frame gap | 365 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pan: frames per second | 1.8 fps |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pan: median frame gap | 554.5 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pan: 90th percentile frame gap | 754.2 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pan: worst frame gap | 754 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Rotation: frames per second | 3.0 fps |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Rotation: median frame gap | 397.6 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Rotation: 90th percentile frame gap | 434.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Rotation: worst frame gap | 434 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Zoom: frames per second | 4.2 fps |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Zoom: median frame gap | 270.8 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Zoom: 90th percentile frame gap | 413.7 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Zoom: worst frame gap | 414 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pixel ratio of the drawing buffer | 2.00 |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: frames per second | 11.1 fps |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: median frame gap | 16.7 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 389.8 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: worst frame gap | 799 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: frames per second | 2.4 fps |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: median frame gap | 398.1 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: 90th percentile frame gap | 494.6 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: worst frame gap | 495 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: frames per second | 2.0 fps |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: median frame gap | 402.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: 90th percentile frame gap | 788.3 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: worst frame gap | 788 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: frames per second | 2.5 fps |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: median frame gap | 398.1 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: 90th percentile frame gap | 684.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: worst frame gap | 684 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pixel ratio of the drawing buffer | 3.00 |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: frames per second | 7.8 fps |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: median frame gap | 16.7 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: 90th percentile frame gap | 457.5 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: worst frame gap | 1253 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Pan: frames per second | 1.4 fps |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Pan: median frame gap | 730.7 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Pan: 90th percentile frame gap | 730.7 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Pan: worst frame gap | 731 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: frames per second | 1.6 fps |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: median frame gap | 629.5 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: 90th percentile frame gap | 636.2 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: worst frame gap | 636 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: frames per second | 1.5 fps |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: median frame gap | 646.1 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: 90th percentile frame gap | 646.7 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: worst frame gap | 647 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Main thread blocked (long tasks) in the pan | 101 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Pixel ratio of the drawing buffer | 3.00 |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: frames per second | 8.6 fps |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: median frame gap | 18.4 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: 90th percentile frame gap | 244.5 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: worst frame gap | 1509 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Pan: frames per second | 2.1 fps |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Pan: median frame gap | 593.9 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Pan: 90th percentile frame gap | 657.7 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Pan: worst frame gap | 658 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Rotation: frames per second | 1.1 fps |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Rotation: median frame gap | 926.9 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Rotation: 90th percentile frame gap | 1235.7 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Rotation: worst frame gap | 1236 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Zoom: frames per second | 2.1 fps |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Zoom: median frame gap | 629.6 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Zoom: 90th percentile frame gap | 650.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Zoom: worst frame gap | 650 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Pixel ratio of the drawing buffer | 3.00 |  | 1 |
| 1,000 markers | MapLibre GL JS | Add the markers | 51 ms |  | 1 |
| 1,000 markers | MapLibre GL JS | Pan: frames per second | 10.5 fps |  | 1 |
| 1,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 168.3 ms |  | 1 |
| 1,000 markers | MapLibre GL JS | Pan: worst frame gap | 351 ms |  | 1 |
| 1,000 markers | This library, main thread | Add the markers | 5 ms |  | 1 |
| 1,000 markers | This library, main thread | Pan: frames per second | 8.9 fps |  | 1 |
| 1,000 markers | This library, main thread | Pan: 90th percentile frame gap | 229.9 ms |  | 1 |
| 1,000 markers | This library, main thread | Pan: worst frame gap | 437 ms |  | 1 |
| 1,000 markers | This library, worker | Add the markers | 1 ms |  | 1 |
| 1,000 markers | This library, worker | Pan: frames per second | 7.4 fps |  | 1 |
| 1,000 markers | This library, worker | Pan: 90th percentile frame gap | 327.0 ms |  | 1 |
| 1,000 markers | This library, worker | Pan: worst frame gap | 413 ms |  | 1 |
| 10,000 markers | MapLibre GL JS | Add the markers | 753 ms |  | 1 |
| 10,000 markers | MapLibre GL JS | Pan: frames per second | 2.0 fps |  | 1 |
| 10,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 709.5 ms |  | 1 |
| 10,000 markers | MapLibre GL JS | Pan: worst frame gap | 710 ms |  | 1 |
| 10,000 markers | This library, main thread | Add the markers | 1 ms |  | 1 |
| 10,000 markers | This library, main thread | Pan: frames per second | 6.5 fps |  | 1 |
| 10,000 markers | This library, main thread | Pan: 90th percentile frame gap | 298.9 ms |  | 1 |
| 10,000 markers | This library, main thread | Pan: worst frame gap | 403 ms |  | 1 |
| 10,000 markers | This library, worker | Add the markers | 9 ms |  | 1 |
| 10,000 markers | This library, worker | Pan: frames per second | 6.6 fps |  | 1 |
| 10,000 markers | This library, worker | Pan: 90th percentile frame gap | 305.4 ms |  | 1 |
| 10,000 markers | This library, worker | Pan: worst frame gap | 470 ms |  | 1 |
| GeoJSON setData | MapLibre GL JS | addSource to idle | 286 ms |  | 1 |
| GeoJSON setData | MapLibre GL JS | Frames per second during the updates | 8.4 fps |  | 1 |
| GeoJSON setData | MapLibre GL JS | setData calls per second | 18.3 /s |  | 1 |
| GeoJSON setData | MapLibre GL JS | Worst frame gap | 367 ms |  | 1 |
| GeoJSON setData | MapLibre GL JS | Last setData to idle | 5 ms |  | 1 |
| GeoJSON setData | This library, main thread | addSource to idle | 447 ms |  | 1 |
| GeoJSON setData | This library, main thread | Frames per second during the updates | 10.2 fps |  | 1 |
| GeoJSON setData | This library, main thread | setData calls per second | 12.1 /s |  | 1 |
| GeoJSON setData | This library, main thread | Worst frame gap | 437 ms |  | 1 |
| GeoJSON setData | This library, main thread | Last setData to idle | 17 ms |  | 1 |
| GeoJSON setData | This library, worker | addSource to idle | 504 ms |  | 1 |
| GeoJSON setData | This library, worker | Frames per second during the updates | 6.1 fps |  | 1 |
| GeoJSON setData | This library, worker | setData calls per second | 18.8 /s |  | 1 |
| GeoJSON setData | This library, worker | Worst frame gap | 347 ms |  | 1 |
| GeoJSON setData | This library, worker | Last setData to idle | 544 ms |  | 1 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty, one per frame: first call to idle | 12020 ms |  | 1 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: the calls | 0.6 ms |  | 1 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: first call to idle | 447 ms |  | 1 |
| Run-time edits | MapLibre GL JS | 30 hover steps of setFeatureState, one per frame: first step to idle | 4142 ms |  | 1 |
| Run-time edits | MapLibre GL JS | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 158 ms |  | 1 |
| Run-time edits | This library, main thread | 100 × setPaintProperty, one per frame: first call to idle | 16683 ms |  | 1 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: the calls | 0.4 ms |  | 1 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: first call to idle | 399 ms |  | 1 |
| Run-time edits | This library, main thread | 30 hover steps of setFeatureState, one per frame: first step to idle | 5695 ms |  | 1 |
| Run-time edits | This library, main thread | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 36 ms |  | 1 |
| Run-time edits | This library, worker | 100 × setPaintProperty, one per frame: first call to idle | 6931 ms |  | 1 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: the calls | 0.3 ms |  | 1 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: first call to idle | 424 ms |  | 1 |
| Run-time edits | This library, worker | 30 hover steps of setFeatureState, one per frame: first step to idle | 3849 ms |  | 1 |
| Run-time edits | This library, worker | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 34 ms |  | 1 |
| Images | MapLibre GL JS | addImage and the icon layer: to idle | 692 ms |  | 1 |
| Images | MapLibre GL JS | 500 × updateImage, one per frame: first call to idle | 73858 ms |  | 1 |
| Images | MapLibre GL JS | Frames per second during the updates | 6.8 fps |  | 1 |
| Images | MapLibre GL JS | Worst frame gap during the updates | 383 ms |  | 1 |
| Images | MapLibre GL JS | 500 × updateImage in one task: the calls | 0.7 ms |  | 1 |
| Images | MapLibre GL JS | 500 × updateImage in one task: first call to idle | 142 ms |  | 1 |
| Images | This library, main thread | addImage and the icon layer: to idle | 334 ms |  | 1 |
| Images | This library, main thread | 500 × updateImage, one per frame: first call to idle | 98350 ms |  | 1 |
| Images | This library, main thread | Frames per second during the updates | 5.1 fps |  | 1 |
| Images | This library, main thread | Worst frame gap during the updates | 584 ms |  | 1 |
| Images | This library, main thread | 500 × updateImage in one task: the calls | 1.7 ms |  | 1 |
| Images | This library, main thread | 500 × updateImage in one task: first call to idle | 205 ms |  | 1 |
| Images | This library, worker | addImage and the icon layer: to idle | 428 ms |  | 1 |
| Images | This library, worker | 500 × updateImage, one per frame: first call to idle | 80698 ms |  | 1 |
| Images | This library, worker | Frames per second during the updates | 5.4 fps |  | 1 |
| Images | This library, worker | Worst frame gap during the updates | 761 ms |  | 1 |
| Images | This library, worker | 500 × updateImage in one task: the calls | 2.7 ms |  | 1 |
| Images | This library, worker | 500 × updateImage in one task: first call to idle | 478 ms |  | 1 |
| Lifecycle | MapLibre GL JS | Create to idle, median of 8 | 714 ms |  | 1 |
| Lifecycle | MapLibre GL JS | remove(), median of 8 | 605.8 ms |  | 1 |
| Lifecycle | MapLibre GL JS | Workers started by the 8 maps and not ended | 0 |  | 1 |
| Lifecycle | MapLibre GL JS | Two maps: create both to both idle | 1094 ms |  | 1 |
| Lifecycle | MapLibre GL JS | Two maps: frames per second of each in a pan | 6.3 fps |  | 1 |
| Lifecycle | MapLibre GL JS | Two maps: worst frame gap | 368 ms |  | 1 |
| Lifecycle | This library, main thread | Create to idle, median of 8 | 659 ms |  | 1 |
| Lifecycle | This library, main thread | remove(), median of 8 | 807.3 ms |  | 1 |
| Lifecycle | This library, main thread | Workers started by the 8 maps and not ended | 0 |  | 1 |
| Lifecycle | This library, main thread | Two maps: create both to both idle | 1252 ms |  | 1 |
| Lifecycle | This library, main thread | Two maps: frames per second of each in a pan | 3.6 fps |  | 1 |
| Lifecycle | This library, main thread | Two maps: worst frame gap | 488 ms |  | 1 |
| Lifecycle | This library, worker | Create to idle, median of 8 | 1694 ms |  | 1 |
| Lifecycle | This library, worker | remove(), median of 8 | 0.3 ms |  | 1 |
| Lifecycle | This library, worker | Workers started by the 8 maps and not ended | 0 |  | 1 |
| Lifecycle | This library, worker | Two maps: create both to both idle | 1892 ms |  | 1 |
| Lifecycle | This library, worker | Two maps: frames per second of each in a pan | 3.9 fps |  | 1 |
| Lifecycle | This library, worker | Two maps: worst frame gap | 669 ms |  | 1 |
| Cold start | MapLibre GL JS | First tile request | 442 ms | 419–467 | 5 |
| Cold start | MapLibre GL JS | First frame | 351 ms | 328–358 | 5 |
| Cold start | MapLibre GL JS | Idle | 1197 ms | 1184–1233 | 5 |
| Cold start | MapLibre GL JS | Requests before idle (the page, and the workers of this library) | 7 | 7–7 | 5 |
| Cold start | MapLibre GL JS | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
| Cold start | This library, main thread | First tile request | 425 ms | 415–443 | 5 |
| Cold start | This library, main thread | First frame | 436 ms | 425–453 | 5 |
| Cold start | This library, main thread | Idle | 1229 ms | 1154–1257 | 5 |
| Cold start | This library, main thread | Requests before idle (the page, and the workers of this library) | 27 | 27–27 | 5 |
| Cold start | This library, main thread | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
| Cold start | This library, worker | First tile request | 421 ms | 414–477 | 5 |
| Cold start | This library, worker | First frame | 432 ms | 425–488 | 5 |
| Cold start | This library, worker | Idle | 1240 ms | 1187–1374 | 5 |
| Cold start | This library, worker | Requests before idle (the page, and the workers of this library) | 15 | 15–15 | 5 |
| Cold start | This library, worker | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
