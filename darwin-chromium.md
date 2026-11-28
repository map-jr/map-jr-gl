### darwin-chromium (chromium 159.0.8154.6)

darwin 25.6.0 arm64, Apple M1 (Virtual)

GPU: ANGLE (Apple, ANGLE Metal Renderer: Apple Paravirtual device, Unspecified Version) · screen pixel ratio 1 · map-jr-gl 0.11.0, commit unknown · MapLibre GL JS 6.17.0 · AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/159.0.8154.6 Safari/537.36

Runs of the page: 2 in 13.9 min.

- worker: loaded, renderer worker, 4 features at the centre, terrain on (centre 8 m)
- main: loaded, renderer main, 4 features at the centre, terrain on (centre 8 m)

| Scenario | Library | Measure | Median | Range | Runs |
|---|---|---|---|---|---|
| Load to idle | MapLibre GL JS | Load to idle | 1184 ms | 773–1595 | 2 |
| Load to idle | MapLibre GL JS | First frame | 132 ms | 83–181 | 2 |
| Load to idle | MapLibre GL JS | load event | 1170 ms | 755–1584 | 2 |
| Load to idle | This library, main thread | Load to idle | 656 ms | 628–685 | 2 |
| Load to idle | This library, main thread | First frame | 123 ms | 91–155 | 2 |
| Load to idle | This library, main thread | load event | 655 ms | 626–685 | 2 |
| Load to idle | This library, worker | Load to idle | 658 ms | 598–719 | 2 |
| Load to idle | This library, worker | First frame | 75 ms | 66–83 | 2 |
| Load to idle | This library, worker | load event | 658 ms | 598–719 | 2 |
| 3D terrain | MapLibre GL JS | Load to idle | 1951 ms | 1107–2794 | 2 |
| 3D terrain | MapLibre GL JS | Pan: frames per second | 27.9 fps | 22.0–33.8 | 2 |
| 3D terrain | MapLibre GL JS | Pan: median frame gap | 27.9 ms | 26.0–29.8 | 2 |
| 3D terrain | MapLibre GL JS | Pan: 90th percentile frame gap | 81.3 ms | 56.8–105.8 | 2 |
| 3D terrain | MapLibre GL JS | Pan: worst frame gap | 107 ms | 83–131 | 2 |
| 3D terrain | This library, main thread | Load to idle | 675 ms | 620–730 | 2 |
| 3D terrain | This library, main thread | Pan: frames per second | 26.0 fps | 19.6–32.5 | 2 |
| 3D terrain | This library, main thread | Pan: median frame gap | 35.6 ms | 26.1–45.0 | 2 |
| 3D terrain | This library, main thread | Pan: 90th percentile frame gap | 84.2 ms | 59.6–108.8 | 2 |
| 3D terrain | This library, main thread | Pan: worst frame gap | 119 ms | 85–154 | 2 |
| 3D terrain | This library, worker | Load to idle | 907 ms | 737–1078 | 2 |
| 3D terrain | This library, worker | Pan: frames per second | 31.1 fps | 22.6–39.5 | 2 |
| 3D terrain | This library, worker | Pan: median frame gap | 24.9 ms | 24.5–25.4 | 2 |
| 3D terrain | This library, worker | Pan: 90th percentile frame gap | 81.4 ms | 48.9–114.0 | 2 |
| 3D terrain | This library, worker | Pan: worst frame gap | 125 ms | 84–167 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Load to idle | 762 ms | 689–835 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: frames per second | 31.9 fps | 22.6–41.2 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: median frame gap | 24.1 ms | 21.2–26.9 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: 90th percentile frame gap | 73.0 ms | 48.2–97.8 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: worst frame gap | 113 ms | 82–145 | 2 |
| Pitch 85 with sky | This library, main thread | Load to idle | 696 ms | 537–855 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: frames per second | 28.6 fps | 19.0–38.3 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: median frame gap | 36.3 ms | 24.4–48.2 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: 90th percentile frame gap | 75.6 ms | 47.3–103.8 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: worst frame gap | 120 ms | 85–155 | 2 |
| Pitch 85 with sky | This library, worker | Load to idle | 812 ms | 758–866 | 2 |
| Pitch 85 with sky | This library, worker | Turn: frames per second | 27.4 fps | 21.1–33.7 | 2 |
| Pitch 85 with sky | This library, worker | Turn: median frame gap | 25.0 ms | 23.6–26.4 | 2 |
| Pitch 85 with sky | This library, worker | Turn: 90th percentile frame gap | 92.8 ms | 62.3–123.3 | 2 |
| Pitch 85 with sky | This library, worker | Turn: worst frame gap | 119 ms | 98–141 | 2 |
| Globe | MapLibre GL JS | Load to idle | 1765 ms | 1315–2215 | 2 |
| Globe | MapLibre GL JS | Turn: frames per second | 22.4 fps | 18.5–26.3 | 2 |
| Globe | MapLibre GL JS | Turn: median frame gap | 38.4 ms | 29.5–47.3 | 2 |
| Globe | MapLibre GL JS | Turn: 90th percentile frame gap | 82.3 ms | 59.1–105.4 | 2 |
| Globe | MapLibre GL JS | Turn: worst frame gap | 327 ms | 143–510 | 2 |
| Globe | This library, main thread | Load to idle | 917 ms | 892–941 | 2 |
| Globe | This library, main thread | Turn: frames per second | 33.7 fps | 26.8–40.6 | 2 |
| Globe | This library, main thread | Turn: median frame gap | 23.1 ms | 20.7–25.6 | 2 |
| Globe | This library, main thread | Turn: 90th percentile frame gap | 73.2 ms | 43.3–103.1 | 2 |
| Globe | This library, main thread | Turn: worst frame gap | 112 ms | 80–144 | 2 |
| Globe | This library, worker | Load to idle | 744 ms | 705–783 | 2 |
| Globe | This library, worker | Turn: frames per second | 27.4 fps | 16.8–38.0 | 2 |
| Globe | This library, worker | Turn: median frame gap | 41.3 ms | 25.1–57.4 | 2 |
| Globe | This library, worker | Turn: 90th percentile frame gap | 84.3 ms | 49.7–118.8 | 2 |
| Globe | This library, worker | Turn: worst frame gap | 113 ms | 69–157 | 2 |
| Camera | MapLibre GL JS | Static repaint: frames per second | 28.1 fps | 21.3–35.0 | 2 |
| Camera | MapLibre GL JS | Static repaint: median frame gap | 26.4 ms | 25.9–27.0 | 2 |
| Camera | MapLibre GL JS | Static repaint: 90th percentile frame gap | 79.4 ms | 54.9–103.9 | 2 |
| Camera | MapLibre GL JS | Static repaint: worst frame gap | 121 ms | 88–155 | 2 |
| Camera | MapLibre GL JS | Pan: frames per second | 28.0 fps | 17.5–38.5 | 2 |
| Camera | MapLibre GL JS | Pan: median frame gap | 35.7 ms | 23.2–48.2 | 2 |
| Camera | MapLibre GL JS | Pan: 90th percentile frame gap | 84.3 ms | 51.5–117.0 | 2 |
| Camera | MapLibre GL JS | Pan: worst frame gap | 115 ms | 84–147 | 2 |
| Camera | MapLibre GL JS | Rotation: frames per second | 29.4 fps | 19.2–39.6 | 2 |
| Camera | MapLibre GL JS | Rotation: median frame gap | 34.9 ms | 23.8–46.0 | 2 |
| Camera | MapLibre GL JS | Rotation: 90th percentile frame gap | 81.9 ms | 52.2–111.7 | 2 |
| Camera | MapLibre GL JS | Rotation: worst frame gap | 118 ms | 82–154 | 2 |
| Camera | MapLibre GL JS | Zoom: frames per second | 27.7 fps | 20.0–35.4 | 2 |
| Camera | MapLibre GL JS | Zoom: median frame gap | 27.1 ms | 25.0–29.2 | 2 |
| Camera | MapLibre GL JS | Zoom: 90th percentile frame gap | 86.6 ms | 60.4–112.9 | 2 |
| Camera | MapLibre GL JS | Zoom: worst frame gap | 136 ms | 122–149 | 2 |
| Camera | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | MapLibre GL JS | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera | This library, main thread | Static repaint: frames per second | 23.4 fps | 20.6–26.1 | 2 |
| Camera | This library, main thread | Static repaint: median frame gap | 39.1 ms | 33.4–44.8 | 2 |
| Camera | This library, main thread | Static repaint: 90th percentile frame gap | 94.9 ms | 73.8–116.0 | 2 |
| Camera | This library, main thread | Static repaint: worst frame gap | 147 ms | 142–151 | 2 |
| Camera | This library, main thread | Pan: frames per second | 27.7 fps | 19.2–36.2 | 2 |
| Camera | This library, main thread | Pan: median frame gap | 33.3 ms | 26.6–40.1 | 2 |
| Camera | This library, main thread | Pan: 90th percentile frame gap | 86.8 ms | 55.9–117.7 | 2 |
| Camera | This library, main thread | Pan: worst frame gap | 124 ms | 77–171 | 2 |
| Camera | This library, main thread | Rotation: frames per second | 29.4 fps | 18.0–40.8 | 2 |
| Camera | This library, main thread | Rotation: median frame gap | 34.1 ms | 22.4–45.8 | 2 |
| Camera | This library, main thread | Rotation: 90th percentile frame gap | 77.3 ms | 49.5–105.0 | 2 |
| Camera | This library, main thread | Rotation: worst frame gap | 107 ms | 63–151 | 2 |
| Camera | This library, main thread | Zoom: frames per second | 35.9 fps | 28.9–42.8 | 2 |
| Camera | This library, main thread | Zoom: median frame gap | 21.4 ms | 21.3–21.5 | 2 |
| Camera | This library, main thread | Zoom: 90th percentile frame gap | 59.5 ms | 34.6–84.4 | 2 |
| Camera | This library, main thread | Zoom: worst frame gap | 95 ms | 73–116 | 2 |
| Camera | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | This library, main thread | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera | This library, worker | Static repaint: frames per second | 34.8 fps | 34.1–35.4 | 2 |
| Camera | This library, worker | Static repaint: median frame gap | 24.8 ms | 21.4–28.1 | 2 |
| Camera | This library, worker | Static repaint: 90th percentile frame gap | 56.8 ms | 42.3–71.3 | 2 |
| Camera | This library, worker | Static repaint: worst frame gap | 94 ms | 77–112 | 2 |
| Camera | This library, worker | Pan: frames per second | 31.5 fps | 26.7–36.3 | 2 |
| Camera | This library, worker | Pan: median frame gap | 24.4 ms | 23.9–24.9 | 2 |
| Camera | This library, worker | Pan: 90th percentile frame gap | 75.7 ms | 56.6–94.8 | 2 |
| Camera | This library, worker | Pan: worst frame gap | 116 ms | 78–155 | 2 |
| Camera | This library, worker | Rotation: frames per second | 26.7 fps | 20.1–33.3 | 2 |
| Camera | This library, worker | Rotation: median frame gap | 30.0 ms | 28.4–31.7 | 2 |
| Camera | This library, worker | Rotation: 90th percentile frame gap | 86.9 ms | 61.2–112.6 | 2 |
| Camera | This library, worker | Rotation: worst frame gap | 113 ms | 86–141 | 2 |
| Camera | This library, worker | Zoom: frames per second | 30.0 fps | 19.3–40.7 | 2 |
| Camera | This library, worker | Zoom: median frame gap | 23.3 ms | 23.1–23.6 | 2 |
| Camera | This library, worker | Zoom: 90th percentile frame gap | 89.8 ms | 43.9–135.6 | 2 |
| Camera | This library, worker | Zoom: worst frame gap | 112 ms | 76–148 | 2 |
| Camera | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | This library, worker | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: frames per second | 19.1 fps | 19.1–19.1 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: median frame gap | 40.0 ms | 40.0–40.1 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 107.1 ms | 106.1–108.1 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: worst frame gap | 136 ms | 118–155 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: frames per second | 18.9 fps | 17.0–20.7 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: median frame gap | 43.6 ms | 30.5–56.8 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: 90th percentile frame gap | 113.7 ms | 103.1–124.3 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: worst frame gap | 178 ms | 155–201 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: frames per second | 25.6 fps | 24.6–26.5 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: median frame gap | 20.5 ms | 17.7–23.3 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: 90th percentile frame gap | 98.9 ms | 96.4–101.3 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: worst frame gap | 129 ms | 113–146 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: frames per second | 23.7 fps | 19.5–28.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: median frame gap | 27.3 ms | 19.1–35.4 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: 90th percentile frame gap | 99.3 ms | 98.7–100.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: worst frame gap | 147 ms | 141–152 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: frames per second | 21.6 fps | 19.3–23.9 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: median frame gap | 38.1 ms | 34.3–42.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: 90th percentile frame gap | 96.3 ms | 92.7–99.9 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: worst frame gap | 143 ms | 138–149 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: frames per second | 21.6 fps | 17.8–25.5 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: median frame gap | 39.0 ms | 26.5–51.5 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: 90th percentile frame gap | 109.3 ms | 99.7–118.9 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: worst frame gap | 143 ms | 135–150 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: frames per second | 18.5 fps | 18.4–18.7 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: median frame gap | 41.5 ms | 39.6–43.4 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: 90th percentile frame gap | 112.5 ms | 107.5–117.5 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: worst frame gap | 164 ms | 162–167 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: frames per second | 19.2 fps | 18.0–20.4 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: median frame gap | 37.9 ms | 36.4–39.5 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: 90th percentile frame gap | 110.3 ms | 103.5–117.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: worst frame gap | 154 ms | 154–155 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: frames per second | 22.3 fps | 19.8–24.7 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: median frame gap | 31.4 ms | 28.7–34.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: 90th percentile frame gap | 112.6 ms | 103.4–121.8 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: worst frame gap | 136 ms | 136–136 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: frames per second | 17.4 fps | 16.0–18.8 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: median frame gap | 38.2 ms | 36.4–40.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: 90th percentile frame gap | 143.3 ms | 131.8–154.7 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: worst frame gap | 170 ms | 153–187 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: frames per second | 17.3 fps | 16.9–17.7 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: median frame gap | 56.3 ms | 55.0–57.5 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: 90th percentile frame gap | 116.1 ms | 112.5–119.7 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: worst frame gap | 151 ms | 149–153 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: frames per second | 18.8 fps | 18.5–19.2 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: median frame gap | 44.3 ms | 43.8–44.8 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: 90th percentile frame gap | 124.0 ms | 120.9–127.1 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: worst frame gap | 152 ms | 150–153 | 2 |
| Camera at pixel ratio 2 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: frames per second | 18.7 fps | 17.9–19.4 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: median frame gap | 38.5 ms | 34.9–42.1 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 122.0 ms | 113.1–131.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: worst frame gap | 155 ms | 153–157 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: frames per second | 21.6 fps | 17.6–25.7 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: median frame gap | 34.4 ms | 26.1–42.7 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: 90th percentile frame gap | 102.3 ms | 86.0–118.6 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: worst frame gap | 144 ms | 130–159 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: frames per second | 21.1 fps | 19.2–23.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: median frame gap | 35.3 ms | 25.7–44.9 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: 90th percentile frame gap | 108.7 ms | 102.3–115.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: worst frame gap | 143 ms | 139–147 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: frames per second | 20.9 fps | 19.2–22.7 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: median frame gap | 42.7 ms | 41.0–44.4 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: 90th percentile frame gap | 97.0 ms | 95.5–98.4 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: worst frame gap | 114 ms | 114–115 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: frames per second | 21.3 fps | 21.0–21.7 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: median frame gap | 41.7 ms | 38.8–44.6 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: 90th percentile frame gap | 92.4 ms | 88.2–96.5 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: worst frame gap | 130 ms | 117–142 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: frames per second | 25.2 fps | 23.9–26.5 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: median frame gap | 29.2 ms | 23.0–35.3 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: 90th percentile frame gap | 84.9 ms | 84.3–85.5 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: worst frame gap | 117 ms | 115–119 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: frames per second | 21.1 fps | 18.7–23.5 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: median frame gap | 44.4 ms | 30.9–57.9 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: 90th percentile frame gap | 98.8 ms | 87.9–109.8 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: worst frame gap | 122 ms | 108–136 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: frames per second | 22.1 fps | 19.1–25.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: median frame gap | 33.6 ms | 21.6–45.5 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: 90th percentile frame gap | 105.4 ms | 96.8–114.1 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: worst frame gap | 146 ms | 141–151 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: frames per second | 21.4 fps | 18.5–24.3 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: median frame gap | 36.1 ms | 26.0–46.1 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: 90th percentile frame gap | 110.8 ms | 105.2–116.4 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: worst frame gap | 152 ms | 146–158 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: frames per second | 16.8 fps | 16.0–17.6 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: median frame gap | 51.1 ms | 44.5–57.7 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: 90th percentile frame gap | 140.2 ms | 138.3–142.1 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: worst frame gap | 157 ms | 147–168 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: frames per second | 16.5 fps | 15.6–17.3 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: median frame gap | 51.7 ms | 41.0–62.4 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: 90th percentile frame gap | 129.9 ms | 127.9–131.9 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: worst frame gap | 161 ms | 160–162 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: frames per second | 18.0 fps | 16.6–19.4 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: median frame gap | 41.4 ms | 28.2–54.5 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: 90th percentile frame gap | 133.1 ms | 130.0–136.2 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: worst frame gap | 158 ms | 152–164 | 2 |
| Camera at pixel ratio 3 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| 1,000 markers | MapLibre GL JS | Add the markers | 56 ms | 49–62 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: frames per second | 18.0 fps | 17.5–18.5 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 115.7 ms | 115.6–115.8 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: worst frame gap | 160 ms | 151–169 | 2 |
| 1,000 markers | This library, main thread | Add the markers | 5 ms | 2–7 | 2 |
| 1,000 markers | This library, main thread | Pan: frames per second | 18.9 fps | 17.5–20.3 | 2 |
| 1,000 markers | This library, main thread | Pan: 90th percentile frame gap | 120.4 ms | 112.6–128.2 | 2 |
| 1,000 markers | This library, main thread | Pan: worst frame gap | 151 ms | 141–160 | 2 |
| 1,000 markers | This library, worker | Add the markers | 1 ms | 0–1 | 2 |
| 1,000 markers | This library, worker | Pan: frames per second | 18.7 fps | 16.2–21.2 | 2 |
| 1,000 markers | This library, worker | Pan: 90th percentile frame gap | 116.1 ms | 102.2–129.9 | 2 |
| 1,000 markers | This library, worker | Pan: worst frame gap | 165 ms | 153–178 | 2 |
| 10,000 markers | MapLibre GL JS | Add the markers | 457 ms | 330–584 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: frames per second | 1.7 fps | 1.3–2.0 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 839.8 ms | 724.7–954.9 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: worst frame gap | 840 ms | 725–955 | 2 |
| 10,000 markers | This library, main thread | Add the markers | 1 ms | 1–1 | 2 |
| 10,000 markers | This library, main thread | Pan: frames per second | 26.4 fps | 25.4–27.4 | 2 |
| 10,000 markers | This library, main thread | Pan: 90th percentile frame gap | 94.9 ms | 90.7–99.2 | 2 |
| 10,000 markers | This library, main thread | Pan: worst frame gap | 145 ms | 143–147 | 2 |
| 10,000 markers | This library, worker | Add the markers | 1 ms | 1–2 | 2 |
| 10,000 markers | This library, worker | Pan: frames per second | 18.6 fps | 16.9–20.4 | 2 |
| 10,000 markers | This library, worker | Pan: 90th percentile frame gap | 126.9 ms | 117.0–136.8 | 2 |
| 10,000 markers | This library, worker | Pan: worst frame gap | 162 ms | 152–172 | 2 |
| GeoJSON setData | MapLibre GL JS | addSource to idle | 563 ms | 440–687 | 2 |
| GeoJSON setData | MapLibre GL JS | Frames per second during the updates | 17.3 fps | 15.1–19.6 | 2 |
| GeoJSON setData | MapLibre GL JS | setData calls per second | 24.2 /s | 22.1–26.3 | 2 |
| GeoJSON setData | MapLibre GL JS | Worst frame gap | 139 ms | 136–142 | 2 |
| GeoJSON setData | MapLibre GL JS | Last setData to idle | 112 ms | 111–114 | 2 |
| GeoJSON setData | This library, main thread | addSource to idle | 226 ms | 122–331 | 2 |
| GeoJSON setData | This library, main thread | Frames per second during the updates | 20.5 fps | 20.2–20.8 | 2 |
| GeoJSON setData | This library, main thread | setData calls per second | 22.5 /s | 21.7–23.3 | 2 |
| GeoJSON setData | This library, main thread | Worst frame gap | 145 ms | 142–148 | 2 |
| GeoJSON setData | This library, main thread | Last setData to idle | 49 ms | 4–95 | 2 |
| GeoJSON setData | This library, worker | addSource to idle | 372 ms | 369–375 | 2 |
| GeoJSON setData | This library, worker | Frames per second during the updates | 22.7 fps | 20.6–24.7 | 2 |
| GeoJSON setData | This library, worker | setData calls per second | 29.4 /s | 25.8–32.9 | 2 |
| GeoJSON setData | This library, worker | Worst frame gap | 148 ms | 147–148 | 2 |
| GeoJSON setData | This library, worker | Last setData to idle | 61 ms | 38–85 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty, one per frame: first call to idle | 5852 ms | 5712–5992 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: the calls | 1.0 ms | 1.0–1.0 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: first call to idle | 445 ms | 422–468 | 2 |
| Run-time edits | MapLibre GL JS | 30 hover steps of setFeatureState, one per frame: first step to idle | 1825 ms | 1534–2116 | 2 |
| Run-time edits | MapLibre GL JS | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 63 ms | 31–94 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty, one per frame: first call to idle | 5215 ms | 5161–5268 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: the calls | 0.7 ms | 0.5–0.9 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: first call to idle | 308 ms | 307–309 | 2 |
| Run-time edits | This library, main thread | 30 hover steps of setFeatureState, one per frame: first step to idle | 1785 ms | 1678–1892 | 2 |
| Run-time edits | This library, main thread | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 27 ms | 19–35 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty, one per frame: first call to idle | 4490 ms | 4136–4844 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: the calls | 0.4 ms | 0.4–0.4 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: first call to idle | 413 ms | 328–497 | 2 |
| Run-time edits | This library, worker | 30 hover steps of setFeatureState, one per frame: first step to idle | 1884 ms | 1867–1900 | 2 |
| Run-time edits | This library, worker | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 90 ms | 70–111 | 2 |
| Images | MapLibre GL JS | addImage and the icon layer: to idle | 752 ms | 739–766 | 2 |
| Images | MapLibre GL JS | 500 × updateImage, one per frame: first call to idle | 23883 ms | 22624–25143 | 2 |
| Images | MapLibre GL JS | Frames per second during the updates | 21.0 fps | 19.9–22.1 | 2 |
| Images | MapLibre GL JS | Worst frame gap during the updates | 154 ms | 147–161 | 2 |
| Images | MapLibre GL JS | 500 × updateImage in one task: the calls | 0.5 ms | 0.4–0.6 | 2 |
| Images | MapLibre GL JS | 500 × updateImage in one task: first call to idle | 66 ms | 37–96 | 2 |
| Images | This library, main thread | addImage and the icon layer: to idle | 362 ms | 313–411 | 2 |
| Images | This library, main thread | 500 × updateImage, one per frame: first call to idle | 26630 ms | 26089–27171 | 2 |
| Images | This library, main thread | Frames per second during the updates | 18.8 fps | 18.4–19.2 | 2 |
| Images | This library, main thread | Worst frame gap during the updates | 157 ms | 156–158 | 2 |
| Images | This library, main thread | 500 × updateImage in one task: the calls | 2.5 ms | 1.9–3.2 | 2 |
| Images | This library, main thread | 500 × updateImage in one task: first call to idle | 25 ms | 6–45 | 2 |
| Images | This library, worker | addImage and the icon layer: to idle | 412 ms | 389–434 | 2 |
| Images | This library, worker | 500 × updateImage, one per frame: first call to idle | 25568 ms | 25098–26038 | 2 |
| Images | This library, worker | Frames per second during the updates | 19.5 fps | 19.1–19.9 | 2 |
| Images | This library, worker | Worst frame gap during the updates | 262 ms | 231–292 | 2 |
| Images | This library, worker | 500 × updateImage in one task: the calls | 1.6 ms | 0.9–2.3 | 2 |
| Images | This library, worker | 500 × updateImage in one task: first call to idle | 209 ms | 198–219 | 2 |
| Lifecycle | MapLibre GL JS | Create to idle, median of 8 | 620 ms | 566–675 | 2 |
| Lifecycle | MapLibre GL JS | remove(), median of 8 | 40.6 ms | 38.2–43.1 | 2 |
| Lifecycle | MapLibre GL JS | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: create both to both idle | 1054 ms | 912–1196 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: frames per second of each in a pan | 20.6 fps | 19.1–22.1 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: worst frame gap | 156 ms | 155–157 | 2 |
| Lifecycle | This library, main thread | Create to idle, median of 8 | 524 ms | 459–590 | 2 |
| Lifecycle | This library, main thread | remove(), median of 8 | 8.8 ms | 8.2–9.5 | 2 |
| Lifecycle | This library, main thread | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | This library, main thread | Two maps: create both to both idle | 976 ms | 926–1026 | 2 |
| Lifecycle | This library, main thread | Two maps: frames per second of each in a pan | 19.1 fps | 19.1–19.1 | 2 |
| Lifecycle | This library, main thread | Two maps: worst frame gap | 163 ms | 158–168 | 2 |
| Lifecycle | This library, worker | Create to idle, median of 8 | 625 ms | 621–630 | 2 |
| Lifecycle | This library, worker | remove(), median of 8 | 0.3 ms | 0.3–0.3 | 2 |
| Lifecycle | This library, worker | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | This library, worker | Two maps: create both to both idle | 927 ms | 872–983 | 2 |
| Lifecycle | This library, worker | Two maps: frames per second of each in a pan | 20.5 fps | 18.2–22.9 | 2 |
| Lifecycle | This library, worker | Two maps: worst frame gap | 166 ms | 155–177 | 2 |
| Cold start | MapLibre GL JS | First tile request | 440 ms | 415–483 | 5 |
| Cold start | MapLibre GL JS | First frame | 335 ms | 305–366 | 5 |
| Cold start | MapLibre GL JS | Idle | 1254 ms | 1182–1273 | 5 |
| Cold start | MapLibre GL JS | Requests before idle (the page, and the workers of this library) | 7 | 7–7 | 5 |
| Cold start | MapLibre GL JS | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
| Cold start | This library, main thread | First tile request | 409 ms | 388–419 | 5 |
| Cold start | This library, main thread | First frame | 427 ms | 404–431 | 5 |
| Cold start | This library, main thread | Idle | 1028 ms | 994–1080 | 5 |
| Cold start | This library, main thread | Requests before idle (the page, and the workers of this library) | 26 | 26–26 | 5 |
| Cold start | This library, main thread | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
| Cold start | This library, worker | First tile request | 408 ms | 385–411 | 5 |
| Cold start | This library, worker | First frame | 422 ms | 399–427 | 5 |
| Cold start | This library, worker | Idle | 1070 ms | 982–1308 | 5 |
| Cold start | This library, worker | Requests before idle (the page, and the workers of this library) | 14 | 14–14 | 5 |
| Cold start | This library, worker | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
