### darwin-webkit (webkit 27.2)

darwin 25.6.0 arm64, Apple M1 (Virtual)

GPU: Apple GPU · screen pixel ratio 1 · map-jr-gl 0.11.0, commit unknown · MapLibre GL JS 6.17.0 · AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Safari/605.1.15

Runs of the page: 2 in 11.9 min.

- worker: loaded, renderer worker, 4 features at the centre, terrain on (centre 8 m)
- main: loaded, renderer main, 4 features at the centre, terrain on (centre 8 m)

| Scenario | Library | Measure | Median | Range | Runs |
|---|---|---|---|---|---|
| Load to idle | MapLibre GL JS | Load to idle | 1658 ms | 1096–2220 | 2 |
| Load to idle | MapLibre GL JS | First frame | 193 ms | 120–265 | 2 |
| Load to idle | MapLibre GL JS | load event | 1601 ms | 1056–2146 | 2 |
| Load to idle | This library, main thread | Load to idle | 839 ms | 777–901 | 2 |
| Load to idle | This library, main thread | First frame | 150 ms | 140–159 | 2 |
| Load to idle | This library, main thread | load event | 839 ms | 777–900 | 2 |
| Load to idle | This library, worker | Load to idle | 970 ms | 968–971 | 2 |
| Load to idle | This library, worker | First frame | 141 ms | 119–162 | 2 |
| Load to idle | This library, worker | load event | 969 ms | 967–971 | 2 |
| 3D terrain | MapLibre GL JS | Load to idle | 2757 ms | 1676–3838 | 2 |
| 3D terrain | MapLibre GL JS | Pan: frames per second | 46.9 fps | 41.5–52.2 | 2 |
| 3D terrain | MapLibre GL JS | Pan: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| 3D terrain | MapLibre GL JS | Pan: 90th percentile frame gap | 28.5 ms | 23.0–34.0 | 2 |
| 3D terrain | MapLibre GL JS | Pan: worst frame gap | 159 ms | 75–243 | 2 |
| 3D terrain | This library, main thread | Load to idle | 1179 ms | 1039–1319 | 2 |
| 3D terrain | This library, main thread | Pan: frames per second | 56.5 fps | 55.1–57.9 | 2 |
| 3D terrain | This library, main thread | Pan: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| 3D terrain | This library, main thread | Pan: 90th percentile frame gap | 22.5 ms | 22.0–23.0 | 2 |
| 3D terrain | This library, main thread | Pan: worst frame gap | 78 ms | 50–106 | 2 |
| 3D terrain | This library, worker | Load to idle | 2034 ms | 1845–2222 | 2 |
| 3D terrain | This library, worker | Pan: frames per second | 54.7 fps | 52.1–57.2 | 2 |
| 3D terrain | This library, worker | Pan: median frame gap | 18.0 ms | 17.0–19.0 | 2 |
| 3D terrain | This library, worker | Pan: 90th percentile frame gap | 22.5 ms | 21.0–24.0 | 2 |
| 3D terrain | This library, worker | Pan: worst frame gap | 78 ms | 77–79 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Load to idle | 1442 ms | 1390–1494 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: frames per second | 43.8 fps | 41.5–46.2 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: median frame gap | 17.5 ms | 17.0–18.0 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: 90th percentile frame gap | 34.5 ms | 34.0–35.0 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: worst frame gap | 191 ms | 127–254 | 2 |
| Pitch 85 with sky | This library, main thread | Load to idle | 1600 ms | 1577–1622 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: frames per second | 55.5 fps | 53.9–57.2 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: 90th percentile frame gap | 24.0 ms | 23.0–25.0 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: worst frame gap | 71 ms | 55–86 | 2 |
| Pitch 85 with sky | This library, worker | Load to idle | 1234 ms | 1183–1284 | 2 |
| Pitch 85 with sky | This library, worker | Turn: frames per second | 55.0 fps | 53.4–56.6 | 2 |
| Pitch 85 with sky | This library, worker | Turn: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Pitch 85 with sky | This library, worker | Turn: 90th percentile frame gap | 25.0 ms | 24.0–26.0 | 2 |
| Pitch 85 with sky | This library, worker | Turn: worst frame gap | 69 ms | 55–82 | 2 |
| Globe | MapLibre GL JS | Load to idle | 2022 ms | 1515–2528 | 2 |
| Globe | MapLibre GL JS | Turn: frames per second | 59.9 fps | 59.8–59.9 | 2 |
| Globe | MapLibre GL JS | Turn: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Globe | MapLibre GL JS | Turn: 90th percentile frame gap | 19.5 ms | 19.0–20.0 | 2 |
| Globe | MapLibre GL JS | Turn: worst frame gap | 32 ms | 25–38 | 2 |
| Globe | This library, main thread | Load to idle | 993 ms | 801–1184 | 2 |
| Globe | This library, main thread | Turn: frames per second | 59.4 fps | 58.7–60.1 | 2 |
| Globe | This library, main thread | Turn: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Globe | This library, main thread | Turn: 90th percentile frame gap | 20.0 ms | 19.0–21.0 | 2 |
| Globe | This library, main thread | Turn: worst frame gap | 37 ms | 28–46 | 2 |
| Globe | This library, worker | Load to idle | 876 ms | 828–923 | 2 |
| Globe | This library, worker | Turn: frames per second | 54.3 fps | 50.9–57.6 | 2 |
| Globe | This library, worker | Turn: median frame gap | 18.0 ms | 17.0–19.0 | 2 |
| Globe | This library, worker | Turn: 90th percentile frame gap | 22.5 ms | 21.0–24.0 | 2 |
| Globe | This library, worker | Turn: worst frame gap | 58 ms | 37–79 | 2 |
| Camera | MapLibre GL JS | Static repaint: frames per second | 56.2 fps | 54.5–57.9 | 2 |
| Camera | MapLibre GL JS | Static repaint: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera | MapLibre GL JS | Static repaint: 90th percentile frame gap | 20.0 ms | 20.0–20.0 | 2 |
| Camera | MapLibre GL JS | Static repaint: worst frame gap | 159 ms | 85–232 | 2 |
| Camera | MapLibre GL JS | Pan: frames per second | 55.2 fps | 54.7–55.8 | 2 |
| Camera | MapLibre GL JS | Pan: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera | MapLibre GL JS | Pan: 90th percentile frame gap | 21.5 ms | 20.0–23.0 | 2 |
| Camera | MapLibre GL JS | Pan: worst frame gap | 91 ms | 84–97 | 2 |
| Camera | MapLibre GL JS | Rotation: frames per second | 59.9 fps | 59.7–60.0 | 2 |
| Camera | MapLibre GL JS | Rotation: median frame gap | 16.5 ms | 16.0–17.0 | 2 |
| Camera | MapLibre GL JS | Rotation: 90th percentile frame gap | 20.0 ms | 19.0–21.0 | 2 |
| Camera | MapLibre GL JS | Rotation: worst frame gap | 34 ms | 27–41 | 2 |
| Camera | MapLibre GL JS | Zoom: frames per second | 50.0 fps | 49.5–50.5 | 2 |
| Camera | MapLibre GL JS | Zoom: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera | MapLibre GL JS | Zoom: 90th percentile frame gap | 24.5 ms | 23.0–26.0 | 2 |
| Camera | MapLibre GL JS | Zoom: worst frame gap | 149 ms | 122–176 | 2 |
| Camera | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | MapLibre GL JS | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera | This library, main thread | Static repaint: frames per second | 60.1 fps | 60.1–60.1 | 2 |
| Camera | This library, main thread | Static repaint: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera | This library, main thread | Static repaint: 90th percentile frame gap | 19.5 ms | 19.0–20.0 | 2 |
| Camera | This library, main thread | Static repaint: worst frame gap | 25 ms | 24–26 | 2 |
| Camera | This library, main thread | Pan: frames per second | 59.3 fps | 59.3–59.3 | 2 |
| Camera | This library, main thread | Pan: median frame gap | 16.5 ms | 16.0–17.0 | 2 |
| Camera | This library, main thread | Pan: 90th percentile frame gap | 21.0 ms | 21.0–21.0 | 2 |
| Camera | This library, main thread | Pan: worst frame gap | 50 ms | 37–63 | 2 |
| Camera | This library, main thread | Rotation: frames per second | 59.8 fps | 59.6–60.1 | 2 |
| Camera | This library, main thread | Rotation: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera | This library, main thread | Rotation: 90th percentile frame gap | 20.5 ms | 20.0–21.0 | 2 |
| Camera | This library, main thread | Rotation: worst frame gap | 32 ms | 31–33 | 2 |
| Camera | This library, main thread | Zoom: frames per second | 59.6 fps | 59.6–59.6 | 2 |
| Camera | This library, main thread | Zoom: median frame gap | 16.5 ms | 16.0–17.0 | 2 |
| Camera | This library, main thread | Zoom: 90th percentile frame gap | 20.0 ms | 19.0–21.0 | 2 |
| Camera | This library, main thread | Zoom: worst frame gap | 37 ms | 32–42 | 2 |
| Camera | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | This library, main thread | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera | This library, worker | Static repaint: frames per second | 51.7 fps | 51.2–52.3 | 2 |
| Camera | This library, worker | Static repaint: median frame gap | 17.5 ms | 17.0–18.0 | 2 |
| Camera | This library, worker | Static repaint: 90th percentile frame gap | 33.5 ms | 33.0–34.0 | 2 |
| Camera | This library, worker | Static repaint: worst frame gap | 39 ms | 39–39 | 2 |
| Camera | This library, worker | Pan: frames per second | 53.2 fps | 52.9–53.4 | 2 |
| Camera | This library, worker | Pan: median frame gap | 18.0 ms | 18.0–18.0 | 2 |
| Camera | This library, worker | Pan: 90th percentile frame gap | 23.5 ms | 23.0–24.0 | 2 |
| Camera | This library, worker | Pan: worst frame gap | 47 ms | 40–54 | 2 |
| Camera | This library, worker | Rotation: frames per second | 51.9 fps | 50.1–53.6 | 2 |
| Camera | This library, worker | Rotation: median frame gap | 19.0 ms | 18.0–20.0 | 2 |
| Camera | This library, worker | Rotation: 90th percentile frame gap | 24.0 ms | 23.0–25.0 | 2 |
| Camera | This library, worker | Rotation: worst frame gap | 41 ms | 32–50 | 2 |
| Camera | This library, worker | Zoom: frames per second | 52.6 fps | 47.8–57.5 | 2 |
| Camera | This library, worker | Zoom: median frame gap | 18.0 ms | 17.0–19.0 | 2 |
| Camera | This library, worker | Zoom: 90th percentile frame gap | 22.0 ms | 21.0–23.0 | 2 |
| Camera | This library, worker | Zoom: worst frame gap | 134 ms | 57–211 | 2 |
| Camera | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | This library, worker | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: frames per second | 60.0 fps | 60.0–60.1 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: median frame gap | 16.5 ms | 16.0–17.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 19.5 ms | 19.0–20.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: worst frame gap | 22 ms | 22–22 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: frames per second | 54.2 fps | 52.1–56.2 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: 90th percentile frame gap | 20.5 ms | 20.0–21.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: worst frame gap | 95 ms | 43–147 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: frames per second | 60.1 fps | 60.1–60.1 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: median frame gap | 16.5 ms | 16.0–17.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: 90th percentile frame gap | 19.5 ms | 19.0–20.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: worst frame gap | 25 ms | 23–27 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: frames per second | 52.5 fps | 51.6–53.3 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: 90th percentile frame gap | 21.5 ms | 20.0–23.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: worst frame gap | 94 ms | 82–105 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: frames per second | 58.8 fps | 57.7–59.8 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: 90th percentile frame gap | 19.5 ms | 19.0–20.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: worst frame gap | 59 ms | 25–92 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: frames per second | 59.3 fps | 59.3–59.3 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: 90th percentile frame gap | 21.0 ms | 21.0–21.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: worst frame gap | 38 ms | 35–41 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: frames per second | 59.9 fps | 59.8–60.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: 90th percentile frame gap | 20.0 ms | 20.0–20.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: worst frame gap | 34 ms | 27–41 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: frames per second | 59.4 fps | 58.7–60.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: 90th percentile frame gap | 19.5 ms | 19.0–20.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: worst frame gap | 44 ms | 28–59 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: frames per second | 50.7 fps | 50.6–50.8 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: 90th percentile frame gap | 34.0 ms | 34.0–34.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: worst frame gap | 41 ms | 39–43 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: frames per second | 50.1 fps | 48.4–51.8 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: median frame gap | 19.0 ms | 19.0–19.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: 90th percentile frame gap | 25.5 ms | 25.0–26.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: worst frame gap | 62 ms | 53–71 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: frames per second | 54.7 fps | 52.8–56.5 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: median frame gap | 18.0 ms | 17.0–19.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: 90th percentile frame gap | 22.5 ms | 22.0–23.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: worst frame gap | 36 ms | 33–39 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: frames per second | 56.5 fps | 54.1–59.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: median frame gap | 17.5 ms | 17.0–18.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: 90th percentile frame gap | 22.0 ms | 21.0–23.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: worst frame gap | 37 ms | 30–43 | 2 |
| Camera at pixel ratio 2 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: frames per second | 59.3 fps | 58.8–59.9 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: median frame gap | 16.0 ms | 16.0–16.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 20.0 ms | 20.0–20.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: worst frame gap | 48 ms | 39–56 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: frames per second | 47.2 fps | 43.0–51.4 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: median frame gap | 16.8 ms | 16.5–17.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: 90th percentile frame gap | 26.0 ms | 24.0–28.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: worst frame gap | 139 ms | 98–179 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: frames per second | 59.6 fps | 58.6–60.5 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: 90th percentile frame gap | 21.5 ms | 21.0–22.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: worst frame gap | 52 ms | 37–67 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: frames per second | 50.1 fps | 47.6–52.5 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: 90th percentile frame gap | 23.5 ms | 22.0–25.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: worst frame gap | 170 ms | 160–180 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: frames per second | 59.4 fps | 58.8–60.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: 90th percentile frame gap | 19.5 ms | 19.0–20.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: worst frame gap | 45 ms | 33–56 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: frames per second | 58.1 fps | 56.5–59.7 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: 90th percentile frame gap | 23.5 ms | 21.0–26.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: worst frame gap | 48 ms | 29–66 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: frames per second | 60.0 fps | 60.0–60.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: 90th percentile frame gap | 20.5 ms | 20.0–21.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: worst frame gap | 28 ms | 27–28 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: frames per second | 60.0 fps | 59.9–60.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: 90th percentile frame gap | 20.0 ms | 20.0–20.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: worst frame gap | 28 ms | 28–28 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: frames per second | 48.7 fps | 47.6–49.8 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: median frame gap | 18.0 ms | 17.0–19.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: 90th percentile frame gap | 33.5 ms | 33.0–34.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: worst frame gap | 46 ms | 39–53 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: frames per second | 48.9 fps | 48.4–49.4 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: median frame gap | 18.0 ms | 18.0–18.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: 90th percentile frame gap | 29.5 ms | 28.0–31.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: worst frame gap | 96 ms | 86–105 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: frames per second | 47.8 fps | 41.9–53.7 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: median frame gap | 19.5 ms | 18.0–21.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: 90th percentile frame gap | 32.0 ms | 25.0–39.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: worst frame gap | 50 ms | 35–65 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: frames per second | 48.8 fps | 41.5–56.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: median frame gap | 18.5 ms | 17.0–20.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: 90th percentile frame gap | 30.0 ms | 21.0–39.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: worst frame gap | 77 ms | 42–112 | 2 |
| Camera at pixel ratio 3 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| 1,000 markers | MapLibre GL JS | Add the markers | 127 ms | 80–173 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: frames per second | 32.8 fps | 31.7–33.9 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 42.0 ms | 40.0–44.0 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: worst frame gap | 192 ms | 177–207 | 2 |
| 1,000 markers | This library, main thread | Add the markers | 3 ms | 3–3 | 2 |
| 1,000 markers | This library, main thread | Pan: frames per second | 54.6 fps | 50.4–58.8 | 2 |
| 1,000 markers | This library, main thread | Pan: 90th percentile frame gap | 20.5 ms | 20.0–21.0 | 2 |
| 1,000 markers | This library, main thread | Pan: worst frame gap | 277 ms | 91–462 | 2 |
| 1,000 markers | This library, worker | Add the markers | 1 ms | 0–2 | 2 |
| 1,000 markers | This library, worker | Pan: frames per second | 54.1 fps | 53.2–54.9 | 2 |
| 1,000 markers | This library, worker | Pan: 90th percentile frame gap | 23.5 ms | 23.0–24.0 | 2 |
| 1,000 markers | This library, worker | Pan: worst frame gap | 47 ms | 43–50 | 2 |
| 10,000 markers | MapLibre GL JS | Add the markers | 719 ms | 708–730 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: frames per second | 3.0 fps | 2.5–3.6 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 580.5 ms | 354.0–807.0 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: worst frame gap | 676 ms | 545–807 | 2 |
| 10,000 markers | This library, main thread | Add the markers | 1 ms | 1–1 | 2 |
| 10,000 markers | This library, main thread | Pan: frames per second | 58.7 fps | 58.6–58.8 | 2 |
| 10,000 markers | This library, main thread | Pan: 90th percentile frame gap | 21.0 ms | 21.0–21.0 | 2 |
| 10,000 markers | This library, main thread | Pan: worst frame gap | 80 ms | 56–104 | 2 |
| 10,000 markers | This library, worker | Add the markers | 2 ms | 2–2 | 2 |
| 10,000 markers | This library, worker | Pan: frames per second | 54.8 fps | 54.2–55.3 | 2 |
| 10,000 markers | This library, worker | Pan: 90th percentile frame gap | 24.0 ms | 24.0–24.0 | 2 |
| 10,000 markers | This library, worker | Pan: worst frame gap | 47 ms | 36–58 | 2 |
| GeoJSON setData | MapLibre GL JS | addSource to idle | 292 ms | 253–330 | 2 |
| GeoJSON setData | MapLibre GL JS | Frames per second during the updates | 32.2 fps | 31.9–32.4 | 2 |
| GeoJSON setData | MapLibre GL JS | setData calls per second | 45.4 /s | 41.3–49.6 | 2 |
| GeoJSON setData | MapLibre GL JS | Worst frame gap | 114 ms | 102–125 | 2 |
| GeoJSON setData | MapLibre GL JS | Last setData to idle | 107 ms | 71–142 | 2 |
| GeoJSON setData | This library, main thread | addSource to idle | 252 ms | 208–295 | 2 |
| GeoJSON setData | This library, main thread | Frames per second during the updates | 31.5 fps | 29.6–33.3 | 2 |
| GeoJSON setData | This library, main thread | setData calls per second | 34.8 /s | 32.9–36.7 | 2 |
| GeoJSON setData | This library, main thread | Worst frame gap | 115 ms | 104–126 | 2 |
| GeoJSON setData | This library, main thread | Last setData to idle | 149 ms | 79–219 | 2 |
| GeoJSON setData | This library, worker | addSource to idle | 381 ms | 353–409 | 2 |
| GeoJSON setData | This library, worker | Frames per second during the updates | 32.0 fps | 31.7–32.4 | 2 |
| GeoJSON setData | This library, worker | setData calls per second | 42.9 /s | 40.4–45.4 | 2 |
| GeoJSON setData | This library, worker | Worst frame gap | 101 ms | 89–113 | 2 |
| GeoJSON setData | This library, worker | Last setData to idle | 67 ms | 50–83 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty, one per frame: first call to idle | 2031 ms | 1982–2079 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: the calls | 1.0 ms | 1.0–1.0 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: first call to idle | 323 ms | 309–336 | 2 |
| Run-time edits | MapLibre GL JS | 30 hover steps of setFeatureState, one per frame: first step to idle | 549 ms | 515–582 | 2 |
| Run-time edits | MapLibre GL JS | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 33 ms | 33–33 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty, one per frame: first call to idle | 2061 ms | 2053–2069 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: the calls | 0.0 ms | 0.0–0.0 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: first call to idle | 316 ms | 316–316 | 2 |
| Run-time edits | This library, main thread | 30 hover steps of setFeatureState, one per frame: first step to idle | 511 ms | 508–514 | 2 |
| Run-time edits | This library, main thread | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 13 ms | 10–15 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty, one per frame: first call to idle | 1995 ms | 1974–2016 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: the calls | 0.5 ms | 0.0–1.0 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: first call to idle | 341 ms | 340–342 | 2 |
| Run-time edits | This library, worker | 30 hover steps of setFeatureState, one per frame: first step to idle | 542 ms | 535–549 | 2 |
| Run-time edits | This library, worker | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 46 ms | 44–47 | 2 |
| Images | MapLibre GL JS | addImage and the icon layer: to idle | 653 ms | 652–653 | 2 |
| Images | MapLibre GL JS | 500 × updateImage, one per frame: first call to idle | 8421 ms | 8413–8429 | 2 |
| Images | MapLibre GL JS | Frames per second during the updates | 59.4 fps | 59.3–59.4 | 2 |
| Images | MapLibre GL JS | Worst frame gap during the updates | 76 ms | 75–76 | 2 |
| Images | MapLibre GL JS | 500 × updateImage in one task: the calls | 0.5 ms | 0.0–1.0 | 2 |
| Images | MapLibre GL JS | 500 × updateImage in one task: first call to idle | 19 ms | 18–19 | 2 |
| Images | This library, main thread | addImage and the icon layer: to idle | 310 ms | 284–335 | 2 |
| Images | This library, main thread | 500 × updateImage, one per frame: first call to idle | 8394 ms | 8387–8401 | 2 |
| Images | This library, main thread | Frames per second during the updates | 59.7 fps | 59.5–59.8 | 2 |
| Images | This library, main thread | Worst frame gap during the updates | 65 ms | 54–76 | 2 |
| Images | This library, main thread | 500 × updateImage in one task: the calls | 1.0 ms | 1.0–1.0 | 2 |
| Images | This library, main thread | 500 × updateImage in one task: first call to idle | 16 ms | 16–16 | 2 |
| Images | This library, worker | addImage and the icon layer: to idle | 363 ms | 343–382 | 2 |
| Images | This library, worker | 500 × updateImage, one per frame: first call to idle | 8341 ms | 8334–8347 | 2 |
| Images | This library, worker | Frames per second during the updates | 51.9 fps | 51.9–51.9 | 2 |
| Images | This library, worker | Worst frame gap during the updates | 40 ms | 39–40 | 2 |
| Images | This library, worker | 500 × updateImage in one task: the calls | 1.0 ms | 1.0–1.0 | 2 |
| Images | This library, worker | 500 × updateImage in one task: first call to idle | 33 ms | 32–34 | 2 |
| Lifecycle | MapLibre GL JS | Create to idle, median of 8 | 931 ms | 904–959 | 2 |
| Lifecycle | MapLibre GL JS | remove(), median of 8 | 7.8 ms | 7.5–8.0 | 2 |
| Lifecycle | MapLibre GL JS | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: create both to both idle | 1841 ms | 1709–1973 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: frames per second of each in a pan | 54.5 fps | 53.7–55.3 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: worst frame gap | 118 ms | 111–124 | 2 |
| Lifecycle | This library, main thread | Create to idle, median of 8 | 680 ms | 654–707 | 2 |
| Lifecycle | This library, main thread | remove(), median of 8 | 17.8 ms | 16.5–19.0 | 2 |
| Lifecycle | This library, main thread | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | This library, main thread | Two maps: create both to both idle | 1181 ms | 1149–1213 | 2 |
| Lifecycle | This library, main thread | Two maps: frames per second of each in a pan | 57.9 fps | 57.2–58.6 | 2 |
| Lifecycle | This library, main thread | Two maps: worst frame gap | 74 ms | 56–91 | 2 |
| Lifecycle | This library, worker | Create to idle, median of 8 | 877 ms | 790–965 | 2 |
| Lifecycle | This library, worker | remove(), median of 8 | 1.3 ms | 1.0–1.5 | 2 |
| Lifecycle | This library, worker | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | This library, worker | Two maps: create both to both idle | 1286 ms | 1176–1395 | 2 |
| Lifecycle | This library, worker | Two maps: frames per second of each in a pan | 48.1 fps | 46.8–49.4 | 2 |
| Lifecycle | This library, worker | Two maps: worst frame gap | 105 ms | 102–108 | 2 |
| Cold start | MapLibre GL JS | First tile request | 520 ms | 412–547 | 3 |
| Cold start | MapLibre GL JS | First frame | 361 ms | 319–398 | 3 |
| Cold start | MapLibre GL JS | Idle | 1529 ms | 1383–1577 | 3 |
| Cold start | MapLibre GL JS | Requests before idle (the page, and the workers of this library) | 9 | 9–9 | 3 |
| Cold start | MapLibre GL JS | Of these, answered from the HTTP cache | 0 | 0–0 | 3 |
| Cold start | This library, main thread | First tile request | 435 ms | 434–436 | 2 |
| Cold start | This library, main thread | First frame | 462 ms | 461–462 | 2 |
| Cold start | This library, main thread | Idle | 1322 ms | 1259–1384 | 2 |
| Cold start | This library, main thread | Requests before idle (the page, and the workers of this library) | 28 | 28–28 | 2 |
| Cold start | This library, main thread | Of these, answered from the HTTP cache | 0 | 0–0 | 2 |
| Cold start | This library, worker | First tile request | 430 ms | 427–433 | 2 |
| Cold start | This library, worker | First frame | 464 ms | 461–467 | 2 |
| Cold start | This library, worker | Idle | 1244 ms | 1235–1253 | 2 |
| Cold start | This library, worker | Requests before idle (the page, and the workers of this library) | 16 | 16–16 | 2 |
| Cold start | This library, worker | Of these, answered from the HTTP cache | 0 | 0–0 | 2 |

Errors: bench: a cold start of main did not end: page.waitForFunction: Target page, context or browser has been closed
