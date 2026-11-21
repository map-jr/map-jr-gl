### darwin-webkit (webkit 27.2)

darwin 25.6.0 arm64, Apple M1 (Virtual)

GPU: Apple GPU · screen pixel ratio 1 · map-jr-gl 0.9.0, commit unknown · MapLibre GL JS 6.17.0 · AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Safari/605.1.15

Runs of the page: 2 in 11.9 min.

- worker: loaded, renderer worker, 8 features at the centre, terrain on (centre 10 m)
- main: loaded, renderer main, 8 features at the centre, terrain on (centre 10 m)

| Scenario | Library | Measure | Median | Range | Runs |
|---|---|---|---|---|---|
| Load to idle | MapLibre GL JS | Load to idle | 1673 ms | 1164–2181 | 2 |
| Load to idle | MapLibre GL JS | First frame | 223 ms | 141–304 | 2 |
| Load to idle | MapLibre GL JS | load event | 1613 ms | 1129–2096 | 2 |
| Load to idle | This library, main thread | Load to idle | 662 ms | 626–698 | 2 |
| Load to idle | This library, main thread | First frame | 107 ms | 106–107 | 2 |
| Load to idle | This library, main thread | load event | 662 ms | 626–698 | 2 |
| Load to idle | This library, worker | Load to idle | 731 ms | 574–888 | 2 |
| Load to idle | This library, worker | First frame | 122 ms | 81–163 | 2 |
| Load to idle | This library, worker | load event | 731 ms | 573–888 | 2 |
| 3D terrain | MapLibre GL JS | Load to idle | 2362 ms | 1308–3415 | 2 |
| 3D terrain | MapLibre GL JS | Pan: frames per second | 54.6 fps | 54.1–55.2 | 2 |
| 3D terrain | MapLibre GL JS | Pan: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| 3D terrain | MapLibre GL JS | Pan: 90th percentile frame gap | 22.0 ms | 21.0–23.0 | 2 |
| 3D terrain | MapLibre GL JS | Pan: worst frame gap | 85 ms | 65–104 | 2 |
| 3D terrain | This library, main thread | Load to idle | 844 ms | 767–921 | 2 |
| 3D terrain | This library, main thread | Pan: frames per second | 58.5 fps | 58.2–58.9 | 2 |
| 3D terrain | This library, main thread | Pan: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| 3D terrain | This library, main thread | Pan: 90th percentile frame gap | 20.0 ms | 20.0–20.0 | 2 |
| 3D terrain | This library, main thread | Pan: worst frame gap | 68 ms | 60–75 | 2 |
| 3D terrain | This library, worker | Load to idle | 1340 ms | 867–1813 | 2 |
| 3D terrain | This library, worker | Pan: frames per second | 53.0 fps | 51.3–54.6 | 2 |
| 3D terrain | This library, worker | Pan: median frame gap | 18.0 ms | 17.0–19.0 | 2 |
| 3D terrain | This library, worker | Pan: 90th percentile frame gap | 22.5 ms | 21.0–24.0 | 2 |
| 3D terrain | This library, worker | Pan: worst frame gap | 44 ms | 30–57 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Load to idle | 1223 ms | 1187–1258 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: frames per second | 46.5 fps | 44.8–48.2 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: 90th percentile frame gap | 33.5 ms | 33.0–34.0 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: worst frame gap | 177 ms | 106–247 | 2 |
| Pitch 85 with sky | This library, main thread | Load to idle | 1917 ms | 1628–2205 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: frames per second | 50.8 fps | 48.5–53.0 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: median frame gap | 17.5 ms | 17.0–18.0 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: 90th percentile frame gap | 30.5 ms | 28.0–33.0 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: worst frame gap | 79 ms | 78–80 | 2 |
| Pitch 85 with sky | This library, worker | Load to idle | 1402 ms | 1226–1578 | 2 |
| Pitch 85 with sky | This library, worker | Turn: frames per second | 48.5 fps | 42.9–54.1 | 2 |
| Pitch 85 with sky | This library, worker | Turn: median frame gap | 17.5 ms | 17.0–18.0 | 2 |
| Pitch 85 with sky | This library, worker | Turn: 90th percentile frame gap | 33.5 ms | 27.0–40.0 | 2 |
| Pitch 85 with sky | This library, worker | Turn: worst frame gap | 75 ms | 55–95 | 2 |
| Globe | MapLibre GL JS | Load to idle | 2206 ms | 1453–2959 | 2 |
| Globe | MapLibre GL JS | Turn: frames per second | 57.0 fps | 54.3–59.7 | 2 |
| Globe | MapLibre GL JS | Turn: median frame gap | 16.5 ms | 16.0–17.0 | 2 |
| Globe | MapLibre GL JS | Turn: 90th percentile frame gap | 23.5 ms | 20.0–27.0 | 2 |
| Globe | MapLibre GL JS | Turn: worst frame gap | 67 ms | 46–87 | 2 |
| Globe | This library, main thread | Load to idle | 872 ms | 544–1199 | 2 |
| Globe | This library, main thread | Turn: frames per second | 54.2 fps | 48.8–59.7 | 2 |
| Globe | This library, main thread | Turn: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Globe | This library, main thread | Turn: 90th percentile frame gap | 27.5 ms | 20.0–35.0 | 2 |
| Globe | This library, main thread | Turn: worst frame gap | 74 ms | 42–105 | 2 |
| Globe | This library, worker | Load to idle | 534 ms | 417–650 | 2 |
| Globe | This library, worker | Turn: frames per second | 52.2 fps | 49.9–54.4 | 2 |
| Globe | This library, worker | Turn: median frame gap | 19.0 ms | 18.0–20.0 | 2 |
| Globe | This library, worker | Turn: 90th percentile frame gap | 23.5 ms | 22.0–25.0 | 2 |
| Globe | This library, worker | Turn: worst frame gap | 39 ms | 39–39 | 2 |
| Camera | MapLibre GL JS | Static repaint: frames per second | 59.0 fps | 58.1–59.9 | 2 |
| Camera | MapLibre GL JS | Static repaint: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera | MapLibre GL JS | Static repaint: 90th percentile frame gap | 19.0 ms | 19.0–19.0 | 2 |
| Camera | MapLibre GL JS | Static repaint: worst frame gap | 51 ms | 24–77 | 2 |
| Camera | MapLibre GL JS | Pan: frames per second | 57.8 fps | 57.1–58.5 | 2 |
| Camera | MapLibre GL JS | Pan: median frame gap | 16.8 ms | 16.5–17.0 | 2 |
| Camera | MapLibre GL JS | Pan: 90th percentile frame gap | 20.5 ms | 20.0–21.0 | 2 |
| Camera | MapLibre GL JS | Pan: worst frame gap | 47 ms | 40–54 | 2 |
| Camera | MapLibre GL JS | Rotation: frames per second | 60.0 fps | 60.0–60.1 | 2 |
| Camera | MapLibre GL JS | Rotation: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera | MapLibre GL JS | Rotation: 90th percentile frame gap | 20.0 ms | 20.0–20.0 | 2 |
| Camera | MapLibre GL JS | Rotation: worst frame gap | 22 ms | 22–22 | 2 |
| Camera | MapLibre GL JS | Zoom: frames per second | 45.6 fps | 38.7–52.5 | 2 |
| Camera | MapLibre GL JS | Zoom: median frame gap | 16.5 ms | 16.0–17.0 | 2 |
| Camera | MapLibre GL JS | Zoom: 90th percentile frame gap | 36.0 ms | 22.0–50.0 | 2 |
| Camera | MapLibre GL JS | Zoom: worst frame gap | 208 ms | 112–304 | 2 |
| Camera | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | MapLibre GL JS | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera | This library, main thread | Static repaint: frames per second | 60.0 fps | 59.9–60.1 | 2 |
| Camera | This library, main thread | Static repaint: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera | This library, main thread | Static repaint: 90th percentile frame gap | 19.5 ms | 19.0–20.0 | 2 |
| Camera | This library, main thread | Static repaint: worst frame gap | 23 ms | 21–25 | 2 |
| Camera | This library, main thread | Pan: frames per second | 59.8 fps | 59.8–59.8 | 2 |
| Camera | This library, main thread | Pan: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera | This library, main thread | Pan: 90th percentile frame gap | 20.0 ms | 20.0–20.0 | 2 |
| Camera | This library, main thread | Pan: worst frame gap | 38 ms | 33–42 | 2 |
| Camera | This library, main thread | Rotation: frames per second | 60.0 fps | 60.0–60.0 | 2 |
| Camera | This library, main thread | Rotation: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera | This library, main thread | Rotation: 90th percentile frame gap | 20.0 ms | 20.0–20.0 | 2 |
| Camera | This library, main thread | Rotation: worst frame gap | 33 ms | 32–34 | 2 |
| Camera | This library, main thread | Zoom: frames per second | 60.0 fps | 60.0–60.0 | 2 |
| Camera | This library, main thread | Zoom: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera | This library, main thread | Zoom: 90th percentile frame gap | 19.5 ms | 19.0–20.0 | 2 |
| Camera | This library, main thread | Zoom: worst frame gap | 36 ms | 34–38 | 2 |
| Camera | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | This library, main thread | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera | This library, worker | Static repaint: frames per second | 49.6 fps | 48.3–50.9 | 2 |
| Camera | This library, worker | Static repaint: median frame gap | 17.3 ms | 17.0–17.5 | 2 |
| Camera | This library, worker | Static repaint: 90th percentile frame gap | 33.5 ms | 33.0–34.0 | 2 |
| Camera | This library, worker | Static repaint: worst frame gap | 38 ms | 37–38 | 2 |
| Camera | This library, worker | Pan: frames per second | 51.4 fps | 50.8–52.1 | 2 |
| Camera | This library, worker | Pan: median frame gap | 19.0 ms | 18.0–20.0 | 2 |
| Camera | This library, worker | Pan: 90th percentile frame gap | 24.5 ms | 24.0–25.0 | 2 |
| Camera | This library, worker | Pan: worst frame gap | 46 ms | 31–60 | 2 |
| Camera | This library, worker | Rotation: frames per second | 50.9 fps | 50.4–51.3 | 2 |
| Camera | This library, worker | Rotation: median frame gap | 20.0 ms | 20.0–20.0 | 2 |
| Camera | This library, worker | Rotation: 90th percentile frame gap | 24.0 ms | 24.0–24.0 | 2 |
| Camera | This library, worker | Rotation: worst frame gap | 31 ms | 30–31 | 2 |
| Camera | This library, worker | Zoom: frames per second | 55.7 fps | 55.3–56.1 | 2 |
| Camera | This library, worker | Zoom: median frame gap | 17.5 ms | 17.0–18.0 | 2 |
| Camera | This library, worker | Zoom: 90th percentile frame gap | 22.5 ms | 22.0–23.0 | 2 |
| Camera | This library, worker | Zoom: worst frame gap | 28 ms | 26–30 | 2 |
| Camera | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | This library, worker | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: frames per second | 56.8 fps | 53.6–60.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: median frame gap | 16.5 ms | 16.0–17.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 20.0 ms | 20.0–20.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: worst frame gap | 155 ms | 43–267 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: frames per second | 53.4 fps | 49.6–57.2 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: 90th percentile frame gap | 22.5 ms | 21.0–24.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: worst frame gap | 139 ms | 85–193 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: frames per second | 60.0 fps | 60.0–60.1 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: 90th percentile frame gap | 19.5 ms | 19.0–20.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: worst frame gap | 25 ms | 23–26 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: frames per second | 54.4 fps | 54.2–54.6 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: 90th percentile frame gap | 22.5 ms | 21.0–24.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: worst frame gap | 79 ms | 67–91 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: frames per second | 59.9 fps | 59.9–60.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: 90th percentile frame gap | 19.0 ms | 18.0–20.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: worst frame gap | 23 ms | 22–23 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: frames per second | 59.4 fps | 59.3–59.5 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: median frame gap | 16.5 ms | 16.0–17.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: 90th percentile frame gap | 21.0 ms | 21.0–21.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: worst frame gap | 39 ms | 37–40 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: frames per second | 59.8 fps | 59.6–60.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: median frame gap | 16.5 ms | 16.0–17.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: 90th percentile frame gap | 20.0 ms | 20.0–20.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: worst frame gap | 32 ms | 29–34 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: frames per second | 59.8 fps | 59.6–60.1 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: 90th percentile frame gap | 19.5 ms | 19.0–20.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: worst frame gap | 34 ms | 27–41 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: frames per second | 48.9 fps | 48.2–49.5 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: 90th percentile frame gap | 34.5 ms | 34.0–35.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: worst frame gap | 51 ms | 39–62 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: frames per second | 52.9 fps | 52.0–53.7 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: median frame gap | 18.5 ms | 18.5–18.5 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: 90th percentile frame gap | 22.5 ms | 22.0–23.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: worst frame gap | 47 ms | 33–61 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: frames per second | 55.0 fps | 54.1–55.9 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: median frame gap | 18.0 ms | 17.0–19.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: 90th percentile frame gap | 22.5 ms | 22.0–23.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: worst frame gap | 36 ms | 31–41 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: frames per second | 53.7 fps | 53.1–54.3 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: median frame gap | 18.5 ms | 18.0–19.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: 90th percentile frame gap | 22.5 ms | 22.0–23.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: worst frame gap | 36 ms | 30–42 | 2 |
| Camera at pixel ratio 2 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: frames per second | 59.2 fps | 58.8–59.7 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 19.5 ms | 19.0–20.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: worst frame gap | 33 ms | 30–35 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: frames per second | 54.8 fps | 53.4–56.2 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: 90th percentile frame gap | 20.5 ms | 20.0–21.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: worst frame gap | 58 ms | 46–69 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: frames per second | 60.2 fps | 60.1–60.4 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: 90th percentile frame gap | 20.0 ms | 20.0–20.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: worst frame gap | 29 ms | 26–32 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: frames per second | 53.8 fps | 53.4–54.1 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: 90th percentile frame gap | 21.5 ms | 21.0–22.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: worst frame gap | 90 ms | 76–104 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: frames per second | 60.0 fps | 60.0–60.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: 90th percentile frame gap | 18.5 ms | 18.0–19.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: worst frame gap | 24 ms | 22–25 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: frames per second | 58.5 fps | 57.0–60.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: median frame gap | 16.5 ms | 16.0–17.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: 90th percentile frame gap | 21.5 ms | 19.0–24.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: worst frame gap | 46 ms | 34–57 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: frames per second | 59.8 fps | 59.6–60.1 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: 90th percentile frame gap | 20.0 ms | 20.0–20.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: worst frame gap | 32 ms | 28–35 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: frames per second | 59.5 fps | 59.1–60.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: 90th percentile frame gap | 20.0 ms | 20.0–20.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: worst frame gap | 38 ms | 28–47 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: frames per second | 49.3 fps | 47.3–51.2 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: median frame gap | 18.5 ms | 17.0–20.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: 90th percentile frame gap | 31.5 ms | 30.0–33.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: worst frame gap | 57 ms | 36–78 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: frames per second | 39.2 fps | 33.9–44.4 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: median frame gap | 22.5 ms | 20.0–25.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: 90th percentile frame gap | 44.5 ms | 35.0–54.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: worst frame gap | 63 ms | 60–65 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: frames per second | 42.5 fps | 36.4–48.5 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: median frame gap | 21.5 ms | 19.0–24.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: 90th percentile frame gap | 36.5 ms | 29.0–44.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: worst frame gap | 62 ms | 62–62 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: frames per second | 51.2 fps | 49.1–53.3 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: median frame gap | 19.0 ms | 19.0–19.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: 90th percentile frame gap | 25.5 ms | 22.0–29.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: worst frame gap | 50 ms | 27–72 | 2 |
| Camera at pixel ratio 3 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| 1,000 markers | MapLibre GL JS | Add the markers | 86 ms | 72–100 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: frames per second | 38.5 fps | 38.2–38.8 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 35.5 ms | 32.0–39.0 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: worst frame gap | 214 ms | 158–269 | 2 |
| 1,000 markers | This library, main thread | Add the markers | 5 ms | 2–7 | 2 |
| 1,000 markers | This library, main thread | Pan: frames per second | 59.8 fps | 59.8–59.9 | 2 |
| 1,000 markers | This library, main thread | Pan: 90th percentile frame gap | 20.5 ms | 20.0–21.0 | 2 |
| 1,000 markers | This library, main thread | Pan: worst frame gap | 37 ms | 33–41 | 2 |
| 1,000 markers | This library, worker | Add the markers | 1 ms | 0–1 | 2 |
| 1,000 markers | This library, worker | Pan: frames per second | 52.7 fps | 52.0–53.5 | 2 |
| 1,000 markers | This library, worker | Pan: 90th percentile frame gap | 23.0 ms | 22.0–24.0 | 2 |
| 1,000 markers | This library, worker | Pan: worst frame gap | 56 ms | 33–79 | 2 |
| 10,000 markers | MapLibre GL JS | Add the markers | 690 ms | 550–829 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: frames per second | 3.3 fps | 2.2–4.3 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 531.0 ms | 281.0–781.0 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: worst frame gap | 590 ms | 399–781 | 2 |
| 10,000 markers | This library, main thread | Add the markers | 2 ms | 1–2 | 2 |
| 10,000 markers | This library, main thread | Pan: frames per second | 59.7 fps | 59.6–59.7 | 2 |
| 10,000 markers | This library, main thread | Pan: 90th percentile frame gap | 20.5 ms | 20.0–21.0 | 2 |
| 10,000 markers | This library, main thread | Pan: worst frame gap | 40 ms | 36–43 | 2 |
| 10,000 markers | This library, worker | Add the markers | 1 ms | 1–1 | 2 |
| 10,000 markers | This library, worker | Pan: frames per second | 53.4 fps | 52.4–54.3 | 2 |
| 10,000 markers | This library, worker | Pan: 90th percentile frame gap | 23.5 ms | 23.0–24.0 | 2 |
| 10,000 markers | This library, worker | Pan: worst frame gap | 32 ms | 28–35 | 2 |
| GeoJSON setData | MapLibre GL JS | addSource to idle | 318 ms | 278–358 | 2 |
| GeoJSON setData | MapLibre GL JS | Frames per second during the updates | 31.2 fps | 26.8–35.6 | 2 |
| GeoJSON setData | MapLibre GL JS | setData calls per second | 46.9 /s | 45.4–48.3 | 2 |
| GeoJSON setData | MapLibre GL JS | Worst frame gap | 103 ms | 93–113 | 2 |
| GeoJSON setData | MapLibre GL JS | Last setData to idle | 97 ms | 79–115 | 2 |
| GeoJSON setData | This library, main thread | addSource to idle | 124 ms | 106–141 | 2 |
| GeoJSON setData | This library, main thread | Frames per second during the updates | 39.2 fps | 37.9–40.6 | 2 |
| GeoJSON setData | This library, main thread | setData calls per second | 44.4 /s | 40.4–48.3 | 2 |
| GeoJSON setData | This library, main thread | Worst frame gap | 78 ms | 75–81 | 2 |
| GeoJSON setData | This library, main thread | Last setData to idle | 63 ms | 57–68 | 2 |
| GeoJSON setData | This library, worker | addSource to idle | 334 ms | 279–389 | 2 |
| GeoJSON setData | This library, worker | Frames per second during the updates | 40.1 fps | 35.5–44.7 | 2 |
| GeoJSON setData | This library, worker | setData calls per second | 47.7 /s | 45.0–50.4 | 2 |
| GeoJSON setData | This library, worker | Worst frame gap | 57 ms | 42–71 | 2 |
| GeoJSON setData | This library, worker | Last setData to idle | 95 ms | 77–113 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty, one per frame: first call to idle | 1989 ms | 1952–2025 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: the calls | 1.0 ms | 1.0–1.0 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: first call to idle | 336 ms | 336–336 | 2 |
| Run-time edits | MapLibre GL JS | 30 hover steps of setFeatureState, one per frame: first step to idle | 500 ms | 498–502 | 2 |
| Run-time edits | MapLibre GL JS | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 35 ms | 35–35 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty, one per frame: first call to idle | 1998 ms | 1968–2027 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: the calls | 0.5 ms | 0.0–1.0 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: first call to idle | 318 ms | 317–318 | 2 |
| Run-time edits | This library, main thread | 30 hover steps of setFeatureState, one per frame: first step to idle | 515 ms | 511–519 | 2 |
| Run-time edits | This library, main thread | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 19 ms | 16–21 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty, one per frame: first call to idle | 1979 ms | 1962–1995 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: the calls | 0.0 ms | 0.0–0.0 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: first call to idle | 340 ms | 336–344 | 2 |
| Run-time edits | This library, worker | 30 hover steps of setFeatureState, one per frame: first step to idle | 532 ms | 530–533 | 2 |
| Run-time edits | This library, worker | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 33 ms | 32–33 | 2 |
| Images | MapLibre GL JS | addImage and the icon layer: to idle | 668 ms | 651–685 | 2 |
| Images | MapLibre GL JS | 500 × updateImage, one per frame: first call to idle | 8401 ms | 8348–8454 | 2 |
| Images | MapLibre GL JS | Frames per second during the updates | 59.5 fps | 59.2–59.9 | 2 |
| Images | MapLibre GL JS | Worst frame gap during the updates | 70 ms | 46–93 | 2 |
| Images | MapLibre GL JS | 500 × updateImage in one task: the calls | 0.5 ms | 0.0–1.0 | 2 |
| Images | MapLibre GL JS | 500 × updateImage in one task: first call to idle | 15 ms | 14–16 | 2 |
| Images | This library, main thread | addImage and the icon layer: to idle | 266 ms | 249–282 | 2 |
| Images | This library, main thread | 500 × updateImage, one per frame: first call to idle | 8459 ms | 8437–8480 | 2 |
| Images | This library, main thread | Frames per second during the updates | 59.1 fps | 59.0–59.3 | 2 |
| Images | This library, main thread | Worst frame gap during the updates | 67 ms | 64–70 | 2 |
| Images | This library, main thread | 500 × updateImage in one task: the calls | 0.0 ms | 0.0–0.0 | 2 |
| Images | This library, main thread | 500 × updateImage in one task: first call to idle | 15 ms | 14–16 | 2 |
| Images | This library, worker | addImage and the icon layer: to idle | 293 ms | 292–293 | 2 |
| Images | This library, worker | 500 × updateImage, one per frame: first call to idle | 8374 ms | 8349–8399 | 2 |
| Images | This library, worker | Frames per second during the updates | 52.3 fps | 51.4–53.3 | 2 |
| Images | This library, worker | Worst frame gap during the updates | 42 ms | 40–43 | 2 |
| Images | This library, worker | 500 × updateImage in one task: the calls | 1.0 ms | 0.0–2.0 | 2 |
| Images | This library, worker | 500 × updateImage in one task: first call to idle | 34 ms | 33–34 | 2 |
| Lifecycle | MapLibre GL JS | Create to idle, median of 8 | 831 ms | 827–835 | 2 |
| Lifecycle | MapLibre GL JS | remove(), median of 8 | 6.0 ms | 5.0–7.0 | 2 |
| Lifecycle | MapLibre GL JS | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: create both to both idle | 1434 ms | 1282–1586 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: frames per second of each in a pan | 57.0 fps | 55.8–58.2 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: worst frame gap | 69 ms | 50–87 | 2 |
| Lifecycle | This library, main thread | Create to idle, median of 8 | 542 ms | 520–563 | 2 |
| Lifecycle | This library, main thread | remove(), median of 8 | 14.3 ms | 14.0–14.5 | 2 |
| Lifecycle | This library, main thread | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | This library, main thread | Two maps: create both to both idle | 905 ms | 834–975 | 2 |
| Lifecycle | This library, main thread | Two maps: frames per second of each in a pan | 59.2 fps | 58.7–59.6 | 2 |
| Lifecycle | This library, main thread | Two maps: worst frame gap | 41 ms | 35–47 | 2 |
| Lifecycle | This library, worker | Create to idle, median of 8 | 595 ms | 583–608 | 2 |
| Lifecycle | This library, worker | remove(), median of 8 | 1.0 ms | 1.0–1.0 | 2 |
| Lifecycle | This library, worker | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | This library, worker | Two maps: create both to both idle | 930 ms | 899–961 | 2 |
| Lifecycle | This library, worker | Two maps: frames per second of each in a pan | 54.0 fps | 53.2–54.8 | 2 |
| Lifecycle | This library, worker | Two maps: worst frame gap | 61 ms | 51–71 | 2 |
| Cold start | MapLibre GL JS | First tile request | 518 ms | 506–556 | 5 |
| Cold start | MapLibre GL JS | First frame | 374 ms | 358–403 | 5 |
| Cold start | MapLibre GL JS | Idle | 1455 ms | 1395–1468 | 5 |
| Cold start | MapLibre GL JS | Requests before idle (the page, and the workers of this library) | 8 | 8–8 | 5 |
| Cold start | MapLibre GL JS | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
| Cold start | This library, main thread | First tile request | 488 ms | 468–506 | 5 |
| Cold start | This library, main thread | First frame | 510 ms | 486–528 | 5 |
| Cold start | This library, main thread | Idle | 1114 ms | 1046–1140 | 5 |
| Cold start | This library, main thread | Requests before idle (the page, and the workers of this library) | 16 | 16–16 | 5 |
| Cold start | This library, main thread | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
| Cold start | This library, worker | First tile request | 492 ms | 461–509 | 5 |
| Cold start | This library, worker | First frame | 518 ms | 489–541 | 5 |
| Cold start | This library, worker | Idle | 1136 ms | 1121–1197 | 5 |
| Cold start | This library, worker | Requests before idle (the page, and the workers of this library) | 12 | 12–12 | 5 |
| Cold start | This library, worker | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
