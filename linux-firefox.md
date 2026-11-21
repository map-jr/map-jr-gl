### linux-firefox (firefox 159.0)

linux 7.0.0-1020-azure x64, INTEL(R) XEON(R) PLATINUM 8573C

GPU: llvmpipe, or similar · screen pixel ratio 1 · map-jr-gl 0.9.0, commit unknown · MapLibre GL JS 6.17.0 · Gecko/20100101 Firefox/159.0

Runs of the page: 1 in 9 min.

- worker: loaded, renderer worker, 8 features at the centre, terrain on (centre 10 m)
- main: loaded, renderer main, 8 features at the centre, terrain on (centre 10 m)

| Scenario | Library | Measure | Median | Range | Runs |
|---|---|---|---|---|---|
| Load to idle | MapLibre GL JS | Load to idle | 1674 ms |  | 1 |
| Load to idle | MapLibre GL JS | First frame | 146 ms |  | 1 |
| Load to idle | MapLibre GL JS | load event | 1552 ms |  | 1 |
| Load to idle | This library, main thread | Load to idle | 772 ms |  | 1 |
| Load to idle | This library, main thread | First frame | 132 ms |  | 1 |
| Load to idle | This library, main thread | load event | 772 ms |  | 1 |
| Load to idle | This library, worker | Load to idle | 860 ms |  | 1 |
| Load to idle | This library, worker | First frame | 139 ms |  | 1 |
| Load to idle | This library, worker | load event | 859 ms |  | 1 |
| 3D terrain | MapLibre GL JS | Load to idle | 3365 ms |  | 1 |
| 3D terrain | MapLibre GL JS | Pan: frames per second | 8.8 fps |  | 1 |
| 3D terrain | MapLibre GL JS | Pan: median frame gap | 51.0 ms |  | 1 |
| 3D terrain | MapLibre GL JS | Pan: 90th percentile frame gap | 333.0 ms |  | 1 |
| 3D terrain | MapLibre GL JS | Pan: worst frame gap | 636 ms |  | 1 |
| 3D terrain | This library, main thread | Load to idle | 1108 ms |  | 1 |
| 3D terrain | This library, main thread | Pan: frames per second | 36.9 fps |  | 1 |
| 3D terrain | This library, main thread | Pan: median frame gap | 28.5 ms |  | 1 |
| 3D terrain | This library, main thread | Pan: 90th percentile frame gap | 42.0 ms |  | 1 |
| 3D terrain | This library, main thread | Pan: worst frame gap | 64 ms |  | 1 |
| 3D terrain | This library, worker | Load to idle | 949 ms |  | 1 |
| 3D terrain | This library, worker | Pan: frames per second | 38.7 fps |  | 1 |
| 3D terrain | This library, worker | Pan: median frame gap | 17.0 ms |  | 1 |
| 3D terrain | This library, worker | Pan: 90th percentile frame gap | 22.0 ms |  | 1 |
| 3D terrain | This library, worker | Pan: worst frame gap | 1089 ms |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Load to idle | 1357 ms |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Turn: frames per second | 11.6 fps |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Turn: median frame gap | 77.5 ms |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Turn: 90th percentile frame gap | 146.0 ms |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Turn: worst frame gap | 212 ms |  | 1 |
| Pitch 85 with sky | This library, main thread | Load to idle | 1750 ms |  | 1 |
| Pitch 85 with sky | This library, main thread | Turn: frames per second | 3.4 fps |  | 1 |
| Pitch 85 with sky | This library, main thread | Turn: median frame gap | 280.0 ms |  | 1 |
| Pitch 85 with sky | This library, main thread | Turn: 90th percentile frame gap | 442.0 ms |  | 1 |
| Pitch 85 with sky | This library, main thread | Turn: worst frame gap | 483 ms |  | 1 |
| Pitch 85 with sky | This library, worker | Load to idle | 2615 ms |  | 1 |
| Pitch 85 with sky | This library, worker | Turn: frames per second | 5.0 fps |  | 1 |
| Pitch 85 with sky | This library, worker | Turn: median frame gap | 17.0 ms |  | 1 |
| Pitch 85 with sky | This library, worker | Turn: 90th percentile frame gap | 552.0 ms |  | 1 |
| Pitch 85 with sky | This library, worker | Turn: worst frame gap | 1618 ms |  | 1 |
| Globe | MapLibre GL JS | Load to idle | 1482 ms |  | 1 |
| Globe | MapLibre GL JS | Turn: frames per second | 20.0 fps |  | 1 |
| Globe | MapLibre GL JS | Turn: median frame gap | 51.0 ms |  | 1 |
| Globe | MapLibre GL JS | Turn: 90th percentile frame gap | 60.0 ms |  | 1 |
| Globe | MapLibre GL JS | Turn: worst frame gap | 76 ms |  | 1 |
| Globe | This library, main thread | Load to idle | 597 ms |  | 1 |
| Globe | This library, main thread | Turn: frames per second | 59.0 fps |  | 1 |
| Globe | This library, main thread | Turn: median frame gap | 17.0 ms |  | 1 |
| Globe | This library, main thread | Turn: 90th percentile frame gap | 19.0 ms |  | 1 |
| Globe | This library, main thread | Turn: worst frame gap | 27 ms |  | 1 |
| Globe | This library, worker | Load to idle | 426 ms |  | 1 |
| Globe | This library, worker | Turn: frames per second | 59.0 fps |  | 1 |
| Globe | This library, worker | Turn: median frame gap | 17.0 ms |  | 1 |
| Globe | This library, worker | Turn: 90th percentile frame gap | 18.0 ms |  | 1 |
| Globe | This library, worker | Turn: worst frame gap | 24 ms |  | 1 |
| Camera | MapLibre GL JS | Static repaint: frames per second | 17.4 fps |  | 1 |
| Camera | MapLibre GL JS | Static repaint: median frame gap | 52.0 ms |  | 1 |
| Camera | MapLibre GL JS | Static repaint: 90th percentile frame gap | 68.0 ms |  | 1 |
| Camera | MapLibre GL JS | Static repaint: worst frame gap | 69 ms |  | 1 |
| Camera | MapLibre GL JS | Pan: frames per second | 15.0 fps |  | 1 |
| Camera | MapLibre GL JS | Pan: median frame gap | 68.0 ms |  | 1 |
| Camera | MapLibre GL JS | Pan: 90th percentile frame gap | 103.0 ms |  | 1 |
| Camera | MapLibre GL JS | Pan: worst frame gap | 120 ms |  | 1 |
| Camera | MapLibre GL JS | Rotation: frames per second | 14.4 fps |  | 1 |
| Camera | MapLibre GL JS | Rotation: median frame gap | 68.0 ms |  | 1 |
| Camera | MapLibre GL JS | Rotation: 90th percentile frame gap | 82.0 ms |  | 1 |
| Camera | MapLibre GL JS | Rotation: worst frame gap | 86 ms |  | 1 |
| Camera | MapLibre GL JS | Zoom: frames per second | 23.3 fps |  | 1 |
| Camera | MapLibre GL JS | Zoom: median frame gap | 42.0 ms |  | 1 |
| Camera | MapLibre GL JS | Zoom: 90th percentile frame gap | 68.0 ms |  | 1 |
| Camera | MapLibre GL JS | Zoom: worst frame gap | 100 ms |  | 1 |
| Camera | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera | MapLibre GL JS | Pixel ratio of the drawing buffer | 1.00 |  | 1 |
| Camera | This library, main thread | Static repaint: frames per second | 16.2 fps |  | 1 |
| Camera | This library, main thread | Static repaint: median frame gap | 67.0 ms |  | 1 |
| Camera | This library, main thread | Static repaint: 90th percentile frame gap | 69.0 ms |  | 1 |
| Camera | This library, main thread | Static repaint: worst frame gap | 72 ms |  | 1 |
| Camera | This library, main thread | Pan: frames per second | 12.4 fps |  | 1 |
| Camera | This library, main thread | Pan: median frame gap | 82.0 ms |  | 1 |
| Camera | This library, main thread | Pan: 90th percentile frame gap | 117.0 ms |  | 1 |
| Camera | This library, main thread | Pan: worst frame gap | 157 ms |  | 1 |
| Camera | This library, main thread | Rotation: frames per second | 10.9 fps |  | 1 |
| Camera | This library, main thread | Rotation: median frame gap | 90.0 ms |  | 1 |
| Camera | This library, main thread | Rotation: 90th percentile frame gap | 103.0 ms |  | 1 |
| Camera | This library, main thread | Rotation: worst frame gap | 113 ms |  | 1 |
| Camera | This library, main thread | Zoom: frames per second | 23.3 fps |  | 1 |
| Camera | This library, main thread | Zoom: median frame gap | 35.5 ms |  | 1 |
| Camera | This library, main thread | Zoom: 90th percentile frame gap | 72.0 ms |  | 1 |
| Camera | This library, main thread | Zoom: worst frame gap | 107 ms |  | 1 |
| Camera | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera | This library, main thread | Pixel ratio of the drawing buffer | 1.00 |  | 1 |
| Camera | This library, worker | Static repaint: frames per second | 59.0 fps |  | 1 |
| Camera | This library, worker | Static repaint: median frame gap | 17.0 ms |  | 1 |
| Camera | This library, worker | Static repaint: 90th percentile frame gap | 23.0 ms |  | 1 |
| Camera | This library, worker | Static repaint: worst frame gap | 28 ms |  | 1 |
| Camera | This library, worker | Pan: frames per second | 52.3 fps |  | 1 |
| Camera | This library, worker | Pan: median frame gap | 16.0 ms |  | 1 |
| Camera | This library, worker | Pan: 90th percentile frame gap | 45.0 ms |  | 1 |
| Camera | This library, worker | Pan: worst frame gap | 45 ms |  | 1 |
| Camera | This library, worker | Rotation: frames per second | 42.3 fps |  | 1 |
| Camera | This library, worker | Rotation: median frame gap | 17.0 ms |  | 1 |
| Camera | This library, worker | Rotation: 90th percentile frame gap | 24.0 ms |  | 1 |
| Camera | This library, worker | Rotation: worst frame gap | 708 ms |  | 1 |
| Camera | This library, worker | Zoom: frames per second | 59.0 fps |  | 1 |
| Camera | This library, worker | Zoom: median frame gap | 17.0 ms |  | 1 |
| Camera | This library, worker | Zoom: 90th percentile frame gap | 24.0 ms |  | 1 |
| Camera | This library, worker | Zoom: worst frame gap | 39 ms |  | 1 |
| Camera | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera | This library, worker | Pixel ratio of the drawing buffer | 1.00 |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: frames per second | 11.1 fps |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: median frame gap | 89.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 102.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: worst frame gap | 106 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: frames per second | 9.0 fps |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: median frame gap | 102.5 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: 90th percentile frame gap | 178.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: worst frame gap | 195 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: frames per second | 9.7 fps |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: median frame gap | 102.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: 90th percentile frame gap | 114.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: worst frame gap | 121 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: frames per second | 13.6 fps |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: median frame gap | 69.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: 90th percentile frame gap | 107.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: worst frame gap | 130 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pixel ratio of the drawing buffer | 2.00 |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: frames per second | 10.4 fps |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: median frame gap | 100.5 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: 90th percentile frame gap | 103.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: worst frame gap | 188 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pan: frames per second | 8.3 fps |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pan: median frame gap | 119.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pan: 90th percentile frame gap | 216.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pan: worst frame gap | 224 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: frames per second | 8.2 fps |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: median frame gap | 123.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: 90th percentile frame gap | 143.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: worst frame gap | 144 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: frames per second | 13.9 fps |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: median frame gap | 68.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: 90th percentile frame gap | 101.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: worst frame gap | 139 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pixel ratio of the drawing buffer | 2.00 |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: frames per second | 53.4 fps |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: median frame gap | 17.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: 90th percentile frame gap | 31.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: worst frame gap | 43 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pan: frames per second | 50.3 fps |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pan: median frame gap | 19.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pan: 90th percentile frame gap | 43.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pan: worst frame gap | 43 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Rotation: frames per second | 57.6 fps |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Rotation: median frame gap | 17.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Rotation: 90th percentile frame gap | 24.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Rotation: worst frame gap | 42 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Zoom: frames per second | 58.1 fps |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Zoom: median frame gap | 17.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Zoom: 90th percentile frame gap | 24.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Zoom: worst frame gap | 63 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pixel ratio of the drawing buffer | 2.00 |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: frames per second | 7.4 fps |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: median frame gap | 139.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 152.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: worst frame gap | 167 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: frames per second | 6.2 fps |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: median frame gap | 151.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: 90th percentile frame gap | 234.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: worst frame gap | 287 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: frames per second | 6.4 fps |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: median frame gap | 154.5 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: 90th percentile frame gap | 164.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: worst frame gap | 174 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: frames per second | 7.7 fps |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: median frame gap | 133.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: 90th percentile frame gap | 193.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: worst frame gap | 294 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pixel ratio of the drawing buffer | 3.00 |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: frames per second | 6.9 fps |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: median frame gap | 149.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: 90th percentile frame gap | 155.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: worst frame gap | 277 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Pan: frames per second | 5.4 fps |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Pan: median frame gap | 174.5 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Pan: 90th percentile frame gap | 372.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Pan: worst frame gap | 383 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: frames per second | 5.6 fps |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: median frame gap | 176.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: 90th percentile frame gap | 213.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: worst frame gap | 345 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: frames per second | 8.8 fps |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: median frame gap | 104.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: 90th percentile frame gap | 169.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: worst frame gap | 183 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Pixel ratio of the drawing buffer | 3.00 |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: frames per second | 52.8 fps |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: median frame gap | 17.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: 90th percentile frame gap | 34.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: worst frame gap | 39 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Pan: frames per second | 62.1 fps |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Pan: median frame gap | 17.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Pan: 90th percentile frame gap | 24.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Pan: worst frame gap | 24 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Rotation: frames per second | 54.7 fps |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Rotation: median frame gap | 16.5 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Rotation: 90th percentile frame gap | 27.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Rotation: worst frame gap | 35 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Zoom: frames per second | 57.8 fps |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Zoom: median frame gap | 17.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Zoom: 90th percentile frame gap | 22.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Zoom: worst frame gap | 100 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Pixel ratio of the drawing buffer | 3.00 |  | 1 |
| 1,000 markers | MapLibre GL JS | Add the markers | 61 ms |  | 1 |
| 1,000 markers | MapLibre GL JS | Pan: frames per second | 20.3 fps |  | 1 |
| 1,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 77.0 ms |  | 1 |
| 1,000 markers | MapLibre GL JS | Pan: worst frame gap | 118 ms |  | 1 |
| 1,000 markers | This library, main thread | Add the markers | 3 ms |  | 1 |
| 1,000 markers | This library, main thread | Pan: frames per second | 17.2 fps |  | 1 |
| 1,000 markers | This library, main thread | Pan: 90th percentile frame gap | 86.0 ms |  | 1 |
| 1,000 markers | This library, main thread | Pan: worst frame gap | 150 ms |  | 1 |
| 1,000 markers | This library, worker | Add the markers | 2 ms |  | 1 |
| 1,000 markers | This library, worker | Pan: frames per second | 42.4 fps |  | 1 |
| 1,000 markers | This library, worker | Pan: 90th percentile frame gap | 24.0 ms |  | 1 |
| 1,000 markers | This library, worker | Pan: worst frame gap | 476 ms |  | 1 |
| 10,000 markers | MapLibre GL JS | Add the markers | 583 ms |  | 1 |
| 10,000 markers | MapLibre GL JS | Pan: frames per second | 6.3 fps |  | 1 |
| 10,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 179.0 ms |  | 1 |
| 10,000 markers | MapLibre GL JS | Pan: worst frame gap | 185 ms |  | 1 |
| 10,000 markers | This library, main thread | Add the markers | 3 ms |  | 1 |
| 10,000 markers | This library, main thread | Pan: frames per second | 16.5 fps |  | 1 |
| 10,000 markers | This library, main thread | Pan: 90th percentile frame gap | 84.0 ms |  | 1 |
| 10,000 markers | This library, main thread | Pan: worst frame gap | 157 ms |  | 1 |
| 10,000 markers | This library, worker | Add the markers | 13 ms |  | 1 |
| 10,000 markers | This library, worker | Pan: frames per second | 44.7 fps |  | 1 |
| 10,000 markers | This library, worker | Pan: 90th percentile frame gap | 24.0 ms |  | 1 |
| 10,000 markers | This library, worker | Pan: worst frame gap | 315 ms |  | 1 |
| GeoJSON setData | MapLibre GL JS | addSource to idle | 336 ms |  | 1 |
| GeoJSON setData | MapLibre GL JS | Frames per second during the updates | 12.6 fps |  | 1 |
| GeoJSON setData | MapLibre GL JS | setData calls per second | 15.0 /s |  | 1 |
| GeoJSON setData | MapLibre GL JS | Worst frame gap | 127 ms |  | 1 |
| GeoJSON setData | MapLibre GL JS | Last setData to idle | 308 ms |  | 1 |
| GeoJSON setData | This library, main thread | addSource to idle | 357 ms |  | 1 |
| GeoJSON setData | This library, main thread | Frames per second during the updates | 10.0 fps |  | 1 |
| GeoJSON setData | This library, main thread | setData calls per second | 11.7 /s |  | 1 |
| GeoJSON setData | This library, main thread | Worst frame gap | 183 ms |  | 1 |
| GeoJSON setData | This library, main thread | Last setData to idle | 183 ms |  | 1 |
| GeoJSON setData | This library, worker | addSource to idle | 595 ms |  | 1 |
| GeoJSON setData | This library, worker | Frames per second during the updates | 12.5 fps |  | 1 |
| GeoJSON setData | This library, worker | setData calls per second | 58.3 /s |  | 1 |
| GeoJSON setData | This library, worker | Worst frame gap | 503 ms |  | 1 |
| GeoJSON setData | This library, worker | Last setData to idle | 727 ms |  | 1 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty, one per frame: first call to idle | 6121 ms |  | 1 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: the calls | 0.0 ms |  | 1 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: first call to idle | 405 ms |  | 1 |
| Run-time edits | MapLibre GL JS | 30 hover steps of setFeatureState, one per frame: first step to idle | 1685 ms |  | 1 |
| Run-time edits | MapLibre GL JS | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 118 ms |  | 1 |
| Run-time edits | This library, main thread | 100 × setPaintProperty, one per frame: first call to idle | 6867 ms |  | 1 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: the calls | 1.0 ms |  | 1 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: first call to idle | 543 ms |  | 1 |
| Run-time edits | This library, main thread | 30 hover steps of setFeatureState, one per frame: first step to idle | 2105 ms |  | 1 |
| Run-time edits | This library, main thread | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 23 ms |  | 1 |
| Run-time edits | This library, worker | 100 × setPaintProperty, one per frame: first call to idle | 1999 ms |  | 1 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: the calls | 1.0 ms |  | 1 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: first call to idle | 324 ms |  | 1 |
| Run-time edits | This library, worker | 30 hover steps of setFeatureState, one per frame: first step to idle | 548 ms |  | 1 |
| Run-time edits | This library, worker | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 107 ms |  | 1 |
| Images | MapLibre GL JS | addImage and the icon layer: to idle | 768 ms |  | 1 |
| Images | MapLibre GL JS | 500 × updateImage, one per frame: first call to idle | 29255 ms |  | 1 |
| Images | MapLibre GL JS | Frames per second during the updates | 17.1 fps |  | 1 |
| Images | MapLibre GL JS | Worst frame gap during the updates | 71 ms |  | 1 |
| Images | MapLibre GL JS | 500 × updateImage in one task: the calls | 1.0 ms |  | 1 |
| Images | MapLibre GL JS | 500 × updateImage in one task: first call to idle | 67 ms |  | 1 |
| Images | This library, main thread | addImage and the icon layer: to idle | 340 ms |  | 1 |
| Images | This library, main thread | 500 × updateImage, one per frame: first call to idle | 30424 ms |  | 1 |
| Images | This library, main thread | Frames per second during the updates | 16.4 fps |  | 1 |
| Images | This library, main thread | Worst frame gap during the updates | 86 ms |  | 1 |
| Images | This library, main thread | 500 × updateImage in one task: the calls | 2.0 ms |  | 1 |
| Images | This library, main thread | 500 × updateImage in one task: first call to idle | 66 ms |  | 1 |
| Images | This library, worker | addImage and the icon layer: to idle | 545 ms |  | 1 |
| Images | This library, worker | 500 × updateImage, one per frame: first call to idle | 8491 ms |  | 1 |
| Images | This library, worker | Frames per second during the updates | 58.8 fps |  | 1 |
| Images | This library, worker | Worst frame gap during the updates | 72 ms |  | 1 |
| Images | This library, worker | 500 × updateImage in one task: the calls | 2.0 ms |  | 1 |
| Images | This library, worker | 500 × updateImage in one task: first call to idle | 41 ms |  | 1 |
| Lifecycle | MapLibre GL JS | Create to idle, median of 8 | 914 ms |  | 1 |
| Lifecycle | MapLibre GL JS | remove(), median of 8 | 2.0 ms |  | 1 |
| Lifecycle | MapLibre GL JS | Workers started by the 8 maps and not ended | 0 |  | 1 |
| Lifecycle | MapLibre GL JS | Two maps: create both to both idle | 1496 ms |  | 1 |
| Lifecycle | MapLibre GL JS | Two maps: frames per second of each in a pan | 11.4 fps |  | 1 |
| Lifecycle | MapLibre GL JS | Two maps: worst frame gap | 151 ms |  | 1 |
| Lifecycle | This library, main thread | Create to idle, median of 8 | 634 ms |  | 1 |
| Lifecycle | This library, main thread | remove(), median of 8 | 1.0 ms |  | 1 |
| Lifecycle | This library, main thread | Workers started by the 8 maps and not ended | 0 |  | 1 |
| Lifecycle | This library, main thread | Two maps: create both to both idle | 1028 ms |  | 1 |
| Lifecycle | This library, main thread | Two maps: frames per second of each in a pan | 8.9 fps |  | 1 |
| Lifecycle | This library, main thread | Two maps: worst frame gap | 253 ms |  | 1 |
| Lifecycle | This library, worker | Create to idle, median of 8 | 706 ms |  | 1 |
| Lifecycle | This library, worker | remove(), median of 8 | 0.5 ms |  | 1 |
| Lifecycle | This library, worker | Workers started by the 8 maps and not ended | 0 |  | 1 |
| Lifecycle | This library, worker | Two maps: create both to both idle | 1284 ms |  | 1 |
| Lifecycle | This library, worker | Two maps: frames per second of each in a pan | 22.8 fps |  | 1 |
| Lifecycle | This library, worker | Two maps: worst frame gap | 624 ms |  | 1 |
| Cold start | MapLibre GL JS | First tile request | 460 ms | 453–462 | 5 |
| Cold start | MapLibre GL JS | First frame | 362 ms | 352–368 | 5 |
| Cold start | MapLibre GL JS | Idle | 1345 ms | 1315–1355 | 5 |
| Cold start | MapLibre GL JS | Requests before idle (the page, and the workers of this library) | 7 | 7–7 | 5 |
| Cold start | MapLibre GL JS | Of these, answered from the HTTP cache | 6 | 6–6 | 5 |
| Cold start | This library, main thread | First tile request | 446 ms | 431–454 | 5 |
| Cold start | This library, main thread | First frame | 486 ms | 478–493 | 5 |
| Cold start | This library, main thread | Idle | 1142 ms | 1063–1192 | 5 |
| Cold start | This library, main thread | Requests before idle (the page, and the workers of this library) | 16 | 16–16 | 5 |
| Cold start | This library, main thread | Of these, answered from the HTTP cache | 7 | 7–7 | 5 |
| Cold start | This library, worker | First tile request | 446 ms | 429–456 | 5 |
| Cold start | This library, worker | First frame | 486 ms | 470–498 | 5 |
| Cold start | This library, worker | Idle | 1040 ms | 1026–1173 | 5 |
| Cold start | This library, worker | Requests before idle (the page, and the workers of this library) | 12 | 12–12 | 5 |
| Cold start | This library, worker | Of these, answered from the HTTP cache | 2 | 2–2 | 5 |
