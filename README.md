# Results in browsers

Commit 41d466463bb90e3934881128f858f30faa12b965, 2026-11-28T20:06Z. The workflow "Browsers" writes this branch.

## Behaviour tests

| System and browser | Pass | Fail |
|---|---|---|
| darwin-chromium | 1084 | 6 |
| darwin-firefox | 761 | 16 |
| darwin-webkit | 1203 | 12 |
| linux-chromium | 1009 | 0 |
| linux-firefox | 1104 | 5 |
| linux-webkit | 1061 | 18 |

## Benchmarks

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
### darwin-firefox (firefox 159.0)

darwin 25.6.0 arm64, Apple M1 (Virtual)

GPU: Apple M1, or similar · screen pixel ratio 1 · map-jr-gl 0.11.0, commit unknown · MapLibre GL JS 6.17.0 · Gecko/20100101 Firefox/159.0

- worker: loaded, renderer worker, 4 features at the centre, terrain on (centre 8 m)
- main: loaded, renderer main, 4 features at the centre, terrain on (centre 8 m)

| Scenario | Library | Measure | Median | Range | Runs |
|---|---|---|---|---|---|
| Load to idle | MapLibre GL JS | Load to idle | 4257 ms |  | 1 |
| Load to idle | MapLibre GL JS | First frame | 184 ms |  | 1 |
| Load to idle | MapLibre GL JS | load event | 1904 ms |  | 1 |
| Load to idle | This library, main thread | Load to idle | 2276 ms |  | 1 |
| Load to idle | This library, main thread | First frame | 96 ms |  | 1 |
| Load to idle | This library, main thread | load event | 2276 ms |  | 1 |
| Load to idle | This library, worker | Load to idle | 757 ms |  | 1 |
| Load to idle | This library, worker | First frame | 107 ms |  | 1 |
| Load to idle | This library, worker | load event | 757 ms |  | 1 |
| 3D terrain | MapLibre GL JS | Load to idle | 35217 ms |  | 1 |
| 3D terrain | MapLibre GL JS | Pan: frames per second | 0.2 fps |  | 1 |
| 3D terrain | MapLibre GL JS | Pan: median frame gap | 775.0 ms |  | 1 |
| 3D terrain | MapLibre GL JS | Pan: 90th percentile frame gap | 21451.0 ms |  | 1 |
| 3D terrain | MapLibre GL JS | Pan: worst frame gap | 21451 ms |  | 1 |
| 3D terrain | This library, main thread | Load to idle | 17593 ms |  | 1 |
| 3D terrain | This library, main thread | Pan: frames per second | 1.8 fps |  | 1 |
| 3D terrain | This library, main thread | Pan: median frame gap | 365.0 ms |  | 1 |
| 3D terrain | This library, main thread | Pan: 90th percentile frame gap | 1276.0 ms |  | 1 |
| 3D terrain | This library, main thread | Pan: worst frame gap | 1276 ms |  | 1 |
| 3D terrain | This library, worker | Load to idle | 19526 ms |  | 1 |
| 3D terrain | This library, worker | Pan: frames per second | 0.6 fps |  | 1 |
| 3D terrain | This library, worker | Pan: median frame gap | 1703.5 ms |  | 1 |
| 3D terrain | This library, worker | Pan: 90th percentile frame gap | 2563.0 ms |  | 1 |
| 3D terrain | This library, worker | Pan: worst frame gap | 2563 ms |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Load to idle | 1916 ms |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Turn: frames per second | 2.1 fps |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Turn: median frame gap | 441.0 ms |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Turn: 90th percentile frame gap | 927.0 ms |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Turn: worst frame gap | 927 ms |  | 1 |
| Pitch 85 with sky | This library, main thread | Load to idle | 1356 ms |  | 1 |
| Pitch 85 with sky | This library, main thread | Turn: frames per second | 2.9 fps |  | 1 |
| Pitch 85 with sky | This library, main thread | Turn: median frame gap | 393.0 ms |  | 1 |
| Pitch 85 with sky | This library, main thread | Turn: 90th percentile frame gap | 601.0 ms |  | 1 |
| Pitch 85 with sky | This library, main thread | Turn: worst frame gap | 715 ms |  | 1 |
| Pitch 85 with sky | This library, worker | Load to idle | 2464 ms |  | 1 |
| Pitch 85 with sky | This library, worker | Turn: frames per second | 3.7 fps |  | 1 |
| Pitch 85 with sky | This library, worker | Turn: median frame gap | 17.0 ms |  | 1 |
| Pitch 85 with sky | This library, worker | Turn: 90th percentile frame gap | 42.0 ms |  | 1 |
| Pitch 85 with sky | This library, worker | Turn: worst frame gap | 2814 ms |  | 1 |
| Globe | MapLibre GL JS | Load to idle | 4545 ms |  | 1 |
| Globe | MapLibre GL JS | Turn: frames per second | 1.7 fps |  | 1 |
| Globe | MapLibre GL JS | Turn: median frame gap | 506.0 ms |  | 1 |
| Globe | MapLibre GL JS | Turn: 90th percentile frame gap | 915.0 ms |  | 1 |
| Globe | MapLibre GL JS | Turn: worst frame gap | 915 ms |  | 1 |
| Globe | This library, main thread | Load to idle | 4144 ms |  | 1 |
| Globe | This library, main thread | Turn: frames per second | 3.5 fps |  | 1 |
| Globe | This library, main thread | Turn: median frame gap | 176.0 ms |  | 1 |
| Globe | This library, main thread | Turn: 90th percentile frame gap | 320.0 ms |  | 1 |
| Globe | This library, main thread | Turn: worst frame gap | 1536 ms |  | 1 |
| Globe | This library, worker | Load to idle | 1150 ms |  | 1 |
| Globe | This library, worker | Turn: frames per second | 59.7 fps |  | 1 |
| Globe | This library, worker | Turn: median frame gap | 17.0 ms |  | 1 |
| Globe | This library, worker | Turn: 90th percentile frame gap | 20.0 ms |  | 1 |
| Globe | This library, worker | Turn: worst frame gap | 68 ms |  | 1 |
| Camera | MapLibre GL JS | Static repaint: frames per second | 3.1 fps |  | 1 |
| Camera | MapLibre GL JS | Static repaint: median frame gap | 328.0 ms |  | 1 |
| Camera | MapLibre GL JS | Static repaint: 90th percentile frame gap | 415.0 ms |  | 1 |
| Camera | MapLibre GL JS | Static repaint: worst frame gap | 415 ms |  | 1 |
| Camera | MapLibre GL JS | Pan: frames per second | 2.6 fps |  | 1 |
| Camera | MapLibre GL JS | Pan: median frame gap | 401.0 ms |  | 1 |
| Camera | MapLibre GL JS | Pan: 90th percentile frame gap | 603.0 ms |  | 1 |
| Camera | MapLibre GL JS | Pan: worst frame gap | 603 ms |  | 1 |
| Camera | MapLibre GL JS | Rotation: frames per second | 2.5 fps |  | 1 |
| Camera | MapLibre GL JS | Rotation: median frame gap | 402.0 ms |  | 1 |
| Camera | MapLibre GL JS | Rotation: 90th percentile frame gap | 437.0 ms |  | 1 |
| Camera | MapLibre GL JS | Rotation: worst frame gap | 437 ms |  | 1 |
| Camera | MapLibre GL JS | Zoom: frames per second | 3.3 fps |  | 1 |
| Camera | MapLibre GL JS | Zoom: median frame gap | 359.0 ms |  | 1 |
| Camera | MapLibre GL JS | Zoom: 90th percentile frame gap | 458.0 ms |  | 1 |
| Camera | MapLibre GL JS | Zoom: worst frame gap | 458 ms |  | 1 |
| Camera | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera | MapLibre GL JS | Pixel ratio of the drawing buffer | 1.00 |  | 1 |
| Camera | This library, main thread | Static repaint: frames per second | 2.4 fps |  | 1 |
| Camera | This library, main thread | Static repaint: median frame gap | 411.0 ms |  | 1 |
| Camera | This library, main thread | Static repaint: 90th percentile frame gap | 857.0 ms |  | 1 |
| Camera | This library, main thread | Static repaint: worst frame gap | 857 ms |  | 1 |
| Camera | This library, main thread | Pan: frames per second | 2.1 fps |  | 1 |
| Camera | This library, main thread | Pan: median frame gap | 480.5 ms |  | 1 |
| Camera | This library, main thread | Pan: 90th percentile frame gap | 946.0 ms |  | 1 |
| Camera | This library, main thread | Pan: worst frame gap | 946 ms |  | 1 |
| Camera | This library, main thread | Rotation: frames per second | 1.9 fps |  | 1 |
| Camera | This library, main thread | Rotation: median frame gap | 495.0 ms |  | 1 |
| Camera | This library, main thread | Rotation: 90th percentile frame gap | 1095.0 ms |  | 1 |
| Camera | This library, main thread | Rotation: worst frame gap | 1095 ms |  | 1 |
| Camera | This library, main thread | Zoom: frames per second | 3.5 fps |  | 1 |
| Camera | This library, main thread | Zoom: median frame gap | 228.0 ms |  | 1 |
| Camera | This library, main thread | Zoom: 90th percentile frame gap | 520.0 ms |  | 1 |
| Camera | This library, main thread | Zoom: worst frame gap | 520 ms |  | 1 |
| Camera | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera | This library, main thread | Pixel ratio of the drawing buffer | 1.00 |  | 1 |
| Camera | This library, worker | Static repaint: frames per second | 59.5 fps |  | 1 |
| Camera | This library, worker | Static repaint: median frame gap | 17.0 ms |  | 1 |
| Camera | This library, worker | Static repaint: 90th percentile frame gap | 20.0 ms |  | 1 |
| Camera | This library, worker | Static repaint: worst frame gap | 41 ms |  | 1 |
| Camera | This library, worker | Pan: frames per second | 55.8 fps |  | 1 |
| Camera | This library, worker | Pan: median frame gap | 15.5 ms |  | 1 |
| Camera | This library, worker | Pan: 90th percentile frame gap | 34.0 ms |  | 1 |
| Camera | This library, worker | Pan: worst frame gap | 46 ms |  | 1 |
| Camera | This library, worker | Rotation: frames per second | 57.5 fps |  | 1 |
| Camera | This library, worker | Rotation: median frame gap | 15.0 ms |  | 1 |
| Camera | This library, worker | Rotation: 90th percentile frame gap | 31.0 ms |  | 1 |
| Camera | This library, worker | Rotation: worst frame gap | 53 ms |  | 1 |
| Camera | This library, worker | Zoom: frames per second | 60.1 fps |  | 1 |
| Camera | This library, worker | Zoom: median frame gap | 16.0 ms |  | 1 |
| Camera | This library, worker | Zoom: 90th percentile frame gap | 21.0 ms |  | 1 |
| Camera | This library, worker | Zoom: worst frame gap | 49 ms |  | 1 |
| Camera | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera | This library, worker | Pixel ratio of the drawing buffer | 1.00 |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: frames per second | 1.0 fps |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: median frame gap | 728.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 1569.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: worst frame gap | 1569 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: frames per second | 1.4 fps |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: median frame gap | 660.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: 90th percentile frame gap | 1002.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: worst frame gap | 1002 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: frames per second | 1.8 fps |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: median frame gap | 542.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: 90th percentile frame gap | 580.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: worst frame gap | 580 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: frames per second | 1.3 fps |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: median frame gap | 745.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: 90th percentile frame gap | 1045.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: worst frame gap | 1045 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pixel ratio of the drawing buffer | 2.00 |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: frames per second | 0.7 fps |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: median frame gap | 1478.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: 90th percentile frame gap | 1478.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: worst frame gap | 1478 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pan: frames per second | 0.9 fps |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pan: median frame gap | 1059.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pan: 90th percentile frame gap | 1396.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pan: worst frame gap | 1396 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: frames per second | 0.9 fps |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: median frame gap | 1144.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: 90th percentile frame gap | 1484.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: worst frame gap | 1484 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: frames per second | 1.0 fps |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: median frame gap | 1000.5 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: 90th percentile frame gap | 1060.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: worst frame gap | 1060 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pixel ratio of the drawing buffer | 2.00 |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: frames per second | 58.4 fps |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: median frame gap | 17.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: 90th percentile frame gap | 24.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: worst frame gap | 31 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pan: frames per second | 59.6 fps |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pan: median frame gap | 15.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pan: 90th percentile frame gap | 26.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pan: worst frame gap | 36 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Rotation: frames per second | 59.1 fps |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Rotation: median frame gap | 17.5 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Rotation: 90th percentile frame gap | 21.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Rotation: worst frame gap | 23 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Zoom: frames per second | 60.1 fps |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Zoom: median frame gap | 17.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Zoom: 90th percentile frame gap | 21.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Zoom: worst frame gap | 46 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pixel ratio of the drawing buffer | 2.00 |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: frames per second | 0.4 fps |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: median frame gap | 2809.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 2809.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: worst frame gap | 2809 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: frames per second | 0.8 fps |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: median frame gap | 1262.5 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: 90th percentile frame gap | 1689.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: worst frame gap | 1689 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: frames per second | 1.3 fps |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: median frame gap | 788.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: 90th percentile frame gap | 788.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: worst frame gap | 788 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: frames per second | 0.9 fps |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: median frame gap | 1171.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: 90th percentile frame gap | 1734.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: worst frame gap | 1734 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pixel ratio of the drawing buffer | 3.00 |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: frames per second | 0.0 fps |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: median frame gap | n/a ms |  | 0 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: 90th percentile frame gap | n/a ms |  | 0 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: worst frame gap | n/a ms |  | 0 |
| Camera at pixel ratio 3 | This library, main thread | Pan: frames per second | 0.0 fps |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Pan: median frame gap | n/a ms |  | 0 |
| Camera at pixel ratio 3 | This library, main thread | Pan: 90th percentile frame gap | n/a ms |  | 0 |
| Camera at pixel ratio 3 | This library, main thread | Pan: worst frame gap | n/a ms |  | 0 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: frames per second | 0.0 fps |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: median frame gap | n/a ms |  | 0 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: 90th percentile frame gap | n/a ms |  | 0 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: worst frame gap | n/a ms |  | 0 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: frames per second | 0.6 fps |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: median frame gap | 1708.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: 90th percentile frame gap | 1708.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: worst frame gap | 1708 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Pixel ratio of the drawing buffer | 3.00 |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: frames per second | 0.0 fps |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: median frame gap | n/a ms |  | 0 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: 90th percentile frame gap | n/a ms |  | 0 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: worst frame gap | n/a ms |  | 0 |
| Camera at pixel ratio 3 | This library, worker | Pan: frames per second | 64.9 fps |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Pan: median frame gap | 16.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Pan: 90th percentile frame gap | 20.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Pan: worst frame gap | 42 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Rotation: frames per second | 40.8 fps |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Rotation: median frame gap | 15.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Rotation: 90th percentile frame gap | 38.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Rotation: worst frame gap | 114 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Zoom: frames per second | 60.0 fps |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Zoom: median frame gap | 17.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Zoom: 90th percentile frame gap | 21.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Zoom: worst frame gap | 47 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Pixel ratio of the drawing buffer | 3.00 |  | 1 |
| 1,000 markers | MapLibre GL JS | Add the markers | 117 ms |  | 1 |
| 1,000 markers | MapLibre GL JS | Pan: frames per second | 4.3 fps |  | 1 |
| 1,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 493.0 ms |  | 1 |
| 1,000 markers | MapLibre GL JS | Pan: worst frame gap | 499 ms |  | 1 |
| 1,000 markers | This library, main thread | Add the markers | 3 ms |  | 1 |
| 1,000 markers | This library, main thread | Pan: frames per second | 2.4 fps |  | 1 |
| 1,000 markers | This library, main thread | Pan: 90th percentile frame gap | 1101.0 ms |  | 1 |
| 1,000 markers | This library, main thread | Pan: worst frame gap | 1101 ms |  | 1 |
| 1,000 markers | This library, worker | Add the markers | 2 ms |  | 1 |
| 1,000 markers | This library, worker | Pan: frames per second | 50.0 fps |  | 1 |
| 1,000 markers | This library, worker | Pan: 90th percentile frame gap | 20.0 ms |  | 1 |
| 1,000 markers | This library, worker | Pan: worst frame gap | 20 ms |  | 1 |
| 10,000 markers | MapLibre GL JS | Add the markers | 751 ms |  | 1 |
| 10,000 markers | MapLibre GL JS | Pan: frames per second | 4.1 fps |  | 1 |
| 10,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 518.0 ms |  | 1 |
| 10,000 markers | MapLibre GL JS | Pan: worst frame gap | 589 ms |  | 1 |
| 10,000 markers | This library, main thread | Add the markers | 2 ms |  | 1 |
| 10,000 markers | This library, main thread | Pan: frames per second | 3.4 fps |  | 1 |
| 10,000 markers | This library, main thread | Pan: 90th percentile frame gap | 474.0 ms |  | 1 |
| 10,000 markers | This library, main thread | Pan: worst frame gap | 815 ms |  | 1 |
| 10,000 markers | This library, worker | Add the markers | 5 ms |  | 1 |
| 10,000 markers | This library, worker | Pan: frames per second | 111.1 fps |  | 1 |
| 10,000 markers | This library, worker | Pan: 90th percentile frame gap | 9.0 ms |  | 1 |
| 10,000 markers | This library, worker | Pan: worst frame gap | 9 ms |  | 1 |
| GeoJSON setData | MapLibre GL JS | addSource to idle | 1331 ms |  | 1 |
| GeoJSON setData | MapLibre GL JS | Frames per second during the updates | 3.0 fps |  | 1 |
| GeoJSON setData | MapLibre GL JS | setData calls per second | 4.2 /s |  | 1 |
| GeoJSON setData | MapLibre GL JS | Worst frame gap | 511 ms |  | 1 |
| GeoJSON setData | MapLibre GL JS | Last setData to idle | 11 ms |  | 1 |
| GeoJSON setData | This library, main thread | addSource to idle | 1395 ms |  | 1 |
| GeoJSON setData | This library, main thread | Frames per second during the updates | 1.9 fps |  | 1 |
| GeoJSON setData | This library, main thread | setData calls per second | 2.5 /s |  | 1 |
| GeoJSON setData | This library, main thread | Worst frame gap | 1019 ms |  | 1 |
| GeoJSON setData | This library, main thread | Last setData to idle | 33 ms |  | 1 |
| GeoJSON setData | This library, worker | addSource to idle | 4484 ms |  | 1 |
| GeoJSON setData | This library, worker | Frames per second during the updates | 14.0 fps |  | 1 |
| GeoJSON setData | This library, worker | setData calls per second | 60.0 /s |  | 1 |
| GeoJSON setData | This library, worker | Worst frame gap | 151 ms |  | 1 |
| GeoJSON setData | This library, worker | Last setData to idle | 4376 ms |  | 1 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty, one per frame: first call to idle | 33131 ms |  | 1 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: the calls | 1.0 ms |  | 1 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: first call to idle | 705 ms |  | 1 |
| Run-time edits | MapLibre GL JS | 30 hover steps of setFeatureState, one per frame: first step to idle | 9998 ms |  | 1 |
| Run-time edits | MapLibre GL JS | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 607 ms |  | 1 |

Errors: bench: run 1 of the page did not end within 15 min; the page says: Running 32 of 39, run 1 of 1: Run-time edits: This library, main thread
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
### linux-firefox (firefox 159.0)

linux 7.0.0-1018-aws x64, Intel(R) Xeon(R) 6975P-C

GPU: llvmpipe, or similar · screen pixel ratio 1 · map-jr-gl 0.11.0, commit unknown · MapLibre GL JS 6.17.0 · Gecko/20100101 Firefox/159.0

Runs of the page: 2 in 14.6 min.

- worker: loaded, renderer worker, 4 features at the centre, terrain on (centre 8 m)
- main: loaded, renderer main, 4 features at the centre, terrain on (centre 8 m)

| Scenario | Library | Measure | Median | Range | Runs |
|---|---|---|---|---|---|
| Load to idle | MapLibre GL JS | Load to idle | 1004 ms | 761–1247 | 2 |
| Load to idle | MapLibre GL JS | First frame | 82 ms | 68–95 | 2 |
| Load to idle | MapLibre GL JS | load event | 914 ms | 682–1146 | 2 |
| Load to idle | This library, main thread | Load to idle | 620 ms | 559–681 | 2 |
| Load to idle | This library, main thread | First frame | 122 ms | 118–125 | 2 |
| Load to idle | This library, main thread | load event | 620 ms | 559–680 | 2 |
| Load to idle | This library, worker | Load to idle | 513 ms | 506–519 | 2 |
| Load to idle | This library, worker | First frame | 128 ms | 127–129 | 2 |
| Load to idle | This library, worker | load event | 513 ms | 506–519 | 2 |
| 3D terrain | MapLibre GL JS | Load to idle | 2417 ms | 2135–2698 | 2 |
| 3D terrain | MapLibre GL JS | Pan: frames per second | 12.5 fps | 12.4–12.6 | 2 |
| 3D terrain | MapLibre GL JS | Pan: median frame gap | 36.3 ms | 36.0–36.5 | 2 |
| 3D terrain | MapLibre GL JS | Pan: 90th percentile frame gap | 245.0 ms | 220.0–270.0 | 2 |
| 3D terrain | MapLibre GL JS | Pan: worst frame gap | 499 ms | 489–508 | 2 |
| 3D terrain | This library, main thread | Load to idle | 948 ms | 888–1008 | 2 |
| 3D terrain | This library, main thread | Pan: frames per second | 38.3 fps | 38.3–38.4 | 2 |
| 3D terrain | This library, main thread | Pan: median frame gap | 22.0 ms | 22.0–22.0 | 2 |
| 3D terrain | This library, main thread | Pan: 90th percentile frame gap | 41.0 ms | 41.0–41.0 | 2 |
| 3D terrain | This library, main thread | Pan: worst frame gap | 85 ms | 73–96 | 2 |
| 3D terrain | This library, worker | Load to idle | 1060 ms | 1035–1085 | 2 |
| 3D terrain | This library, worker | Pan: frames per second | 47.8 fps | 36.5–59.1 | 2 |
| 3D terrain | This library, worker | Pan: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| 3D terrain | This library, worker | Pan: 90th percentile frame gap | 22.0 ms | 22.0–22.0 | 2 |
| 3D terrain | This library, worker | Pan: worst frame gap | 564 ms | 32–1096 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Load to idle | 1035 ms | 1014–1055 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: frames per second | 15.7 fps | 15.6–15.9 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: median frame gap | 53.5 ms | 53.0–54.0 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: 90th percentile frame gap | 99.5 ms | 97.0–102.0 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: worst frame gap | 176 ms | 175–177 | 2 |
| Pitch 85 with sky | This library, main thread | Load to idle | 731 ms | 699–763 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: frames per second | 13.3 fps | 13.2–13.5 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: median frame gap | 72.5 ms | 71.0–74.0 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: 90th percentile frame gap | 128.5 ms | 126.0–131.0 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: worst frame gap | 165 ms | 164–165 | 2 |
| Pitch 85 with sky | This library, worker | Load to idle | 934 ms | 867–1000 | 2 |
| Pitch 85 with sky | This library, worker | Turn: frames per second | 25.9 fps | 25.6–26.2 | 2 |
| Pitch 85 with sky | This library, worker | Turn: median frame gap | 16.5 ms | 16.0–17.0 | 2 |
| Pitch 85 with sky | This library, worker | Turn: 90th percentile frame gap | 27.0 ms | 25.0–29.0 | 2 |
| Pitch 85 with sky | This library, worker | Turn: worst frame gap | 818 ms | 703–933 | 2 |
| Globe | MapLibre GL JS | Load to idle | 3796 ms | 3258–4333 | 2 |
| Globe | MapLibre GL JS | Turn: frames per second | 24.7 fps | 24.1–25.3 | 2 |
| Globe | MapLibre GL JS | Turn: median frame gap | 36.5 ms | 35.0–38.0 | 2 |
| Globe | MapLibre GL JS | Turn: 90th percentile frame gap | 53.5 ms | 53.0–54.0 | 2 |
| Globe | MapLibre GL JS | Turn: worst frame gap | 57 ms | 56–57 | 2 |
| Globe | This library, main thread | Load to idle | 722 ms | 628–815 | 2 |
| Globe | This library, main thread | Turn: frames per second | 59.1 fps | 59.0–59.2 | 2 |
| Globe | This library, main thread | Turn: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Globe | This library, main thread | Turn: 90th percentile frame gap | 18.0 ms | 18.0–18.0 | 2 |
| Globe | This library, main thread | Turn: worst frame gap | 21 ms | 21–21 | 2 |
| Globe | This library, worker | Load to idle | 569 ms | 509–628 | 2 |
| Globe | This library, worker | Turn: frames per second | 59.1 fps | 59.0–59.1 | 2 |
| Globe | This library, worker | Turn: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Globe | This library, worker | Turn: 90th percentile frame gap | 18.0 ms | 18.0–18.0 | 2 |
| Globe | This library, worker | Turn: worst frame gap | 21 ms | 21–21 | 2 |
| Camera | MapLibre GL JS | Static repaint: frames per second | 22.3 fps | 22.0–22.6 | 2 |
| Camera | MapLibre GL JS | Static repaint: median frame gap | 50.0 ms | 50.0–50.0 | 2 |
| Camera | MapLibre GL JS | Static repaint: 90th percentile frame gap | 52.0 ms | 52.0–52.0 | 2 |
| Camera | MapLibre GL JS | Static repaint: worst frame gap | 54 ms | 52–55 | 2 |
| Camera | MapLibre GL JS | Pan: frames per second | 19.8 fps | 19.4–20.3 | 2 |
| Camera | MapLibre GL JS | Pan: median frame gap | 50.5 ms | 50.0–51.0 | 2 |
| Camera | MapLibre GL JS | Pan: 90th percentile frame gap | 84.5 ms | 84.0–85.0 | 2 |
| Camera | MapLibre GL JS | Pan: worst frame gap | 93 ms | 91–95 | 2 |
| Camera | MapLibre GL JS | Rotation: frames per second | 18.6 fps | 18.3–18.9 | 2 |
| Camera | MapLibre GL JS | Rotation: median frame gap | 51.5 ms | 51.0–52.0 | 2 |
| Camera | MapLibre GL JS | Rotation: 90th percentile frame gap | 67.5 ms | 67.0–68.0 | 2 |
| Camera | MapLibre GL JS | Rotation: worst frame gap | 70 ms | 69–70 | 2 |
| Camera | MapLibre GL JS | Zoom: frames per second | 31.6 fps | 30.4–32.8 | 2 |
| Camera | MapLibre GL JS | Zoom: median frame gap | 34.0 ms | 33.0–35.0 | 2 |
| Camera | MapLibre GL JS | Zoom: 90th percentile frame gap | 53.0 ms | 52.0–54.0 | 2 |
| Camera | MapLibre GL JS | Zoom: worst frame gap | 92 ms | 87–96 | 2 |
| Camera | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | MapLibre GL JS | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera | This library, main thread | Static repaint: frames per second | 22.6 fps | 21.7–23.4 | 2 |
| Camera | This library, main thread | Static repaint: median frame gap | 51.0 ms | 51.0–51.0 | 2 |
| Camera | This library, main thread | Static repaint: 90th percentile frame gap | 60.0 ms | 59.0–61.0 | 2 |
| Camera | This library, main thread | Static repaint: worst frame gap | 71 ms | 64–77 | 2 |
| Camera | This library, main thread | Pan: frames per second | 18.2 fps | 18.1–18.3 | 2 |
| Camera | This library, main thread | Pan: median frame gap | 51.5 ms | 51.0–52.0 | 2 |
| Camera | This library, main thread | Pan: 90th percentile frame gap | 87.5 ms | 87.0–88.0 | 2 |
| Camera | This library, main thread | Pan: worst frame gap | 105 ms | 97–113 | 2 |
| Camera | This library, main thread | Rotation: frames per second | 16.6 fps | 16.3–17.0 | 2 |
| Camera | This library, main thread | Rotation: median frame gap | 61.0 ms | 56.0–66.0 | 2 |
| Camera | This library, main thread | Rotation: 90th percentile frame gap | 85.5 ms | 85.0–86.0 | 2 |
| Camera | This library, main thread | Rotation: worst frame gap | 97 ms | 92–102 | 2 |
| Camera | This library, main thread | Zoom: frames per second | 36.5 fps | 36.1–37.0 | 2 |
| Camera | This library, main thread | Zoom: median frame gap | 20.5 ms | 19.0–22.0 | 2 |
| Camera | This library, main thread | Zoom: 90th percentile frame gap | 48.5 ms | 48.0–49.0 | 2 |
| Camera | This library, main thread | Zoom: worst frame gap | 72 ms | 69–75 | 2 |
| Camera | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | This library, main thread | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera | This library, worker | Static repaint: frames per second | 53.5 fps | 53.1–53.9 | 2 |
| Camera | This library, worker | Static repaint: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera | This library, worker | Static repaint: 90th percentile frame gap | 30.0 ms | 29.0–31.0 | 2 |
| Camera | This library, worker | Static repaint: worst frame gap | 39 ms | 37–41 | 2 |
| Camera | This library, worker | Pan: frames per second | 52.9 fps | 52.6–53.1 | 2 |
| Camera | This library, worker | Pan: median frame gap | 19.8 ms | 19.0–20.5 | 2 |
| Camera | This library, worker | Pan: 90th percentile frame gap | 29.5 ms | 29.0–30.0 | 2 |
| Camera | This library, worker | Pan: worst frame gap | 30 ms | 29–30 | 2 |
| Camera | This library, worker | Rotation: frames per second | 40.9 fps | 37.9–43.8 | 2 |
| Camera | This library, worker | Rotation: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera | This library, worker | Rotation: 90th percentile frame gap | 24.5 ms | 24.0–25.0 | 2 |
| Camera | This library, worker | Rotation: worst frame gap | 763 ms | 643–883 | 2 |
| Camera | This library, worker | Zoom: frames per second | 58.6 fps | 58.6–58.6 | 2 |
| Camera | This library, worker | Zoom: median frame gap | 17.5 ms | 17.0–18.0 | 2 |
| Camera | This library, worker | Zoom: 90th percentile frame gap | 24.0 ms | 24.0–24.0 | 2 |
| Camera | This library, worker | Zoom: worst frame gap | 57 ms | 50–64 | 2 |
| Camera | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | This library, worker | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: frames per second | 13.7 fps | 13.6–13.8 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: median frame gap | 70.8 ms | 70.5–71.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 85.0 ms | 85.0–85.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: worst frame gap | 87 ms | 86–87 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: frames per second | 12.1 fps | 11.9–12.3 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: median frame gap | 82.3 ms | 80.5–84.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: 90th percentile frame gap | 127.5 ms | 115.0–140.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: worst frame gap | 153 ms | 146–159 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: frames per second | 12.1 fps | 12.0–12.2 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: median frame gap | 83.8 ms | 83.5–84.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: 90th percentile frame gap | 87.5 ms | 87.0–88.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: worst frame gap | 101 ms | 99–103 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: frames per second | 17.0 fps | 16.7–17.4 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: median frame gap | 54.0 ms | 52.5–55.5 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: 90th percentile frame gap | 93.5 ms | 85.0–102.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: worst frame gap | 125 ms | 112–137 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: frames per second | 14.6 fps | 14.5–14.7 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: median frame gap | 68.0 ms | 68.0–68.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: 90th percentile frame gap | 85.5 ms | 85.0–86.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: worst frame gap | 95 ms | 92–98 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: frames per second | 12.1 fps | 12.1–12.1 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: median frame gap | 85.0 ms | 85.0–85.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: 90th percentile frame gap | 116.0 ms | 113.0–119.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: worst frame gap | 169 ms | 155–182 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: frames per second | 12.3 fps | 12.2–12.3 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: median frame gap | 85.0 ms | 84.0–86.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: 90th percentile frame gap | 104.0 ms | 102.0–106.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: worst frame gap | 116 ms | 115–117 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: frames per second | 20.5 fps | 20.3–20.6 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: median frame gap | 50.0 ms | 50.0–50.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: 90th percentile frame gap | 71.0 ms | 70.0–72.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: worst frame gap | 95 ms | 86–103 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: frames per second | 50.2 fps | 48.5–51.8 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: median frame gap | 17.5 ms | 17.0–18.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: 90th percentile frame gap | 34.0 ms | 33.0–35.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: worst frame gap | 43 ms | 42–43 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: frames per second | 61.2 fps | 53.8–68.6 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: median frame gap | 16.0 ms | 14.0–18.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: 90th percentile frame gap | 26.5 ms | 25.0–28.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: worst frame gap | 27 ms | 25–28 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: frames per second | 34.8 fps | 33.4–36.2 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: median frame gap | 15.8 ms | 15.5–16.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: 90th percentile frame gap | 26.5 ms | 25.0–28.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: worst frame gap | 1019 ms | 958–1080 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: frames per second | 58.0 fps | 57.6–58.3 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: median frame gap | 16.0 ms | 16.0–16.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: 90th percentile frame gap | 23.5 ms | 23.0–24.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: worst frame gap | 83 ms | 69–96 | 2 |
| Camera at pixel ratio 2 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: frames per second | 9.3 fps | 9.0–9.6 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: median frame gap | 111.0 ms | 105.0–117.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 118.0 ms | 116.0–120.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: worst frame gap | 122 ms | 119–124 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: frames per second | 7.9 fps | 7.9–7.9 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: median frame gap | 119.5 ms | 118.0–121.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: 90th percentile frame gap | 209.0 ms | 198.0–220.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: worst frame gap | 228 ms | 215–240 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: frames per second | 8.2 fps | 8.0–8.4 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: median frame gap | 121.5 ms | 119.0–124.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: 90th percentile frame gap | 130.0 ms | 125.0–135.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: worst frame gap | 137 ms | 136–138 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: frames per second | 9.9 fps | 9.8–10.1 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: median frame gap | 95.8 ms | 87.0–104.5 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: 90th percentile frame gap | 167.5 ms | 163.0–172.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: worst frame gap | 223 ms | 221–224 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: frames per second | 9.5 fps | 9.3–9.7 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: median frame gap | 101.5 ms | 101.0–102.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: 90th percentile frame gap | 129.0 ms | 126.0–132.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: worst frame gap | 205 ms | 179–231 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: frames per second | 8.3 fps | 8.2–8.4 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: median frame gap | 120.8 ms | 118.0–123.5 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: 90th percentile frame gap | 221.5 ms | 215.0–228.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: worst frame gap | 229 ms | 228–229 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: frames per second | 8.9 fps | 8.8–8.9 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: median frame gap | 117.8 ms | 117.5–118.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: 90th percentile frame gap | 144.0 ms | 144.0–144.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: worst frame gap | 155 ms | 146–163 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: frames per second | 12.9 fps | 12.8–13.1 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: median frame gap | 70.5 ms | 69.0–72.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: 90th percentile frame gap | 107.5 ms | 105.0–110.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: worst frame gap | 132 ms | 124–139 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: frames per second | 55.6 fps | 52.2–59.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: 90th percentile frame gap | 26.5 ms | 21.0–32.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: worst frame gap | 35 ms | 31–38 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: frames per second | 54.1 fps | 52.6–55.6 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: median frame gap | 14.3 ms | 14.0–14.5 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: 90th percentile frame gap | 41.5 ms | 41.0–42.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: worst frame gap | 42 ms | 41–42 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: frames per second | 9.5 fps | 6.7–12.2 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: median frame gap | 16.3 ms | 15.5–17.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: 90th percentile frame gap | 27.5 ms | 25.0–30.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: worst frame gap | 2021 ms | 1920–2121 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: frames per second | 58.2 fps | 57.8–58.6 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: median frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: 90th percentile frame gap | 23.0 ms | 22.0–24.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: worst frame gap | 69 ms | 47–90 | 2 |
| Camera at pixel ratio 3 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| 1,000 markers | MapLibre GL JS | Add the markers | 49 ms | 48–50 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: frames per second | 27.2 fps | 27.2–27.2 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 60.5 ms | 60.0–61.0 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: worst frame gap | 92 ms | 91–92 | 2 |
| 1,000 markers | This library, main thread | Add the markers | 2 ms | 2–2 | 2 |
| 1,000 markers | This library, main thread | Pan: frames per second | 29.0 fps | 28.9–29.2 | 2 |
| 1,000 markers | This library, main thread | Pan: 90th percentile frame gap | 52.0 ms | 52.0–52.0 | 2 |
| 1,000 markers | This library, main thread | Pan: worst frame gap | 117 ms | 114–119 | 2 |
| 1,000 markers | This library, worker | Add the markers | 1 ms | 1–1 | 2 |
| 1,000 markers | This library, worker | Pan: frames per second | 45.0 fps | 43.5–46.5 | 2 |
| 1,000 markers | This library, worker | Pan: 90th percentile frame gap | 23.0 ms | 23.0–23.0 | 2 |
| 1,000 markers | This library, worker | Pan: worst frame gap | 469 ms | 339–598 | 2 |
| 10,000 markers | MapLibre GL JS | Add the markers | 482 ms | 464–499 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: frames per second | 7.4 fps | 7.4–7.4 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 158.0 ms | 156.0–160.0 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: worst frame gap | 180 ms | 169–190 | 2 |
| 10,000 markers | This library, main thread | Add the markers | 2 ms | 1–2 | 2 |
| 10,000 markers | This library, main thread | Pan: frames per second | 28.2 fps | 28.2–28.3 | 2 |
| 10,000 markers | This library, main thread | Pan: 90th percentile frame gap | 53.0 ms | 52.0–54.0 | 2 |
| 10,000 markers | This library, main thread | Pan: worst frame gap | 122 ms | 111–132 | 2 |
| 10,000 markers | This library, worker | Add the markers | 1 ms | 0–2 | 2 |
| 10,000 markers | This library, worker | Pan: frames per second | 43.2 fps | 42.5–44.0 | 2 |
| 10,000 markers | This library, worker | Pan: 90th percentile frame gap | 25.0 ms | 25.0–25.0 | 2 |
| 10,000 markers | This library, worker | Pan: worst frame gap | 616 ms | 601–631 | 2 |
| GeoJSON setData | MapLibre GL JS | addSource to idle | 275 ms | 273–276 | 2 |
| GeoJSON setData | MapLibre GL JS | Frames per second during the updates | 16.2 fps | 15.8–16.5 | 2 |
| GeoJSON setData | MapLibre GL JS | setData calls per second | 18.1 /s | 17.5–18.8 | 2 |
| GeoJSON setData | MapLibre GL JS | Worst frame gap | 99 ms | 91–107 | 2 |
| GeoJSON setData | MapLibre GL JS | Last setData to idle | 189 ms | 189–189 | 2 |
| GeoJSON setData | This library, main thread | addSource to idle | 369 ms | 351–386 | 2 |
| GeoJSON setData | This library, main thread | Frames per second during the updates | 12.5 fps | 12.4–12.7 | 2 |
| GeoJSON setData | This library, main thread | setData calls per second | 15.0 /s | 13.8–16.3 | 2 |
| GeoJSON setData | This library, main thread | Worst frame gap | 150 ms | 148–152 | 2 |
| GeoJSON setData | This library, main thread | Last setData to idle | 121 ms | 89–152 | 2 |
| GeoJSON setData | This library, worker | addSource to idle | 388 ms | 358–417 | 2 |
| GeoJSON setData | This library, worker | Frames per second during the updates | 17.4 fps | 16.3–18.5 | 2 |
| GeoJSON setData | This library, worker | setData calls per second | 59.0 /s | 58.3–59.6 | 2 |
| GeoJSON setData | This library, worker | Worst frame gap | 256 ms | 204–307 | 2 |
| GeoJSON setData | This library, worker | Last setData to idle | 575 ms | 392–758 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty, one per frame: first call to idle | 4893 ms | 4880–4905 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: the calls | 1.0 ms | 1.0–1.0 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: first call to idle | 363 ms | 355–371 | 2 |
| Run-time edits | MapLibre GL JS | 30 hover steps of setFeatureState, one per frame: first step to idle | 1354 ms | 1318–1389 | 2 |
| Run-time edits | MapLibre GL JS | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 103 ms | 103–103 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty, one per frame: first call to idle | 4959 ms | 4880–5037 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: the calls | 1.0 ms | 1.0–1.0 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: first call to idle | 348 ms | 344–351 | 2 |
| Run-time edits | This library, main thread | 30 hover steps of setFeatureState, one per frame: first step to idle | 1460 ms | 1422–1498 | 2 |
| Run-time edits | This library, main thread | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 16 ms | 15–17 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty, one per frame: first call to idle | 2015 ms | 2004–2025 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: the calls | 0.0 ms | 0.0–0.0 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: first call to idle | 332 ms | 321–343 | 2 |
| Run-time edits | This library, worker | 30 hover steps of setFeatureState, one per frame: first step to idle | 539 ms | 538–540 | 2 |
| Run-time edits | This library, worker | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 46 ms | 45–47 | 2 |
| Images | MapLibre GL JS | addImage and the icon layer: to idle | 665 ms | 629–700 | 2 |
| Images | MapLibre GL JS | 500 × updateImage, one per frame: first call to idle | 22866 ms | 22441–23290 | 2 |
| Images | MapLibre GL JS | Frames per second during the updates | 21.9 fps | 21.5–22.3 | 2 |
| Images | MapLibre GL JS | Worst frame gap during the updates | 62 ms | 55–68 | 2 |
| Images | MapLibre GL JS | 500 × updateImage in one task: the calls | 0.0 ms | 0.0–0.0 | 2 |
| Images | MapLibre GL JS | 500 × updateImage in one task: first call to idle | 42 ms | 32–51 | 2 |
| Images | This library, main thread | addImage and the icon layer: to idle | 436 ms | 311–561 | 2 |
| Images | This library, main thread | 500 × updateImage, one per frame: first call to idle | 21960 ms | 21959–21961 | 2 |
| Images | This library, main thread | Frames per second during the updates | 22.7 fps | 22.7–22.8 | 2 |
| Images | This library, main thread | Worst frame gap during the updates | 74 ms | 71–77 | 2 |
| Images | This library, main thread | 500 × updateImage in one task: the calls | 1.5 ms | 1.0–2.0 | 2 |
| Images | This library, main thread | 500 × updateImage in one task: first call to idle | 56 ms | 51–61 | 2 |
| Images | This library, worker | addImage and the icon layer: to idle | 462 ms | 448–476 | 2 |
| Images | This library, worker | 500 × updateImage, one per frame: first call to idle | 8496 ms | 8494–8498 | 2 |
| Images | This library, worker | Frames per second during the updates | 54.0 fps | 53.5–54.5 | 2 |
| Images | This library, worker | Worst frame gap during the updates | 72 ms | 62–82 | 2 |
| Images | This library, worker | 500 × updateImage in one task: the calls | 3.0 ms | 1.0–5.0 | 2 |
| Images | This library, worker | 500 × updateImage in one task: first call to idle | 29 ms | 26–31 | 2 |
| Lifecycle | MapLibre GL JS | Create to idle, median of 8 | 688 ms | 676–700 | 2 |
| Lifecycle | MapLibre GL JS | remove(), median of 8 | 1.8 ms | 1.5–2.0 | 2 |
| Lifecycle | MapLibre GL JS | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: create both to both idle | 1233 ms | 1181–1285 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: frames per second of each in a pan | 14.4 fps | 14.3–14.4 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: worst frame gap | 128 ms | 111–144 | 2 |
| Lifecycle | This library, main thread | Create to idle, median of 8 | 539 ms | 529–550 | 2 |
| Lifecycle | This library, main thread | remove(), median of 8 | 1.0 ms | 1.0–1.0 | 2 |
| Lifecycle | This library, main thread | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | This library, main thread | Two maps: create both to both idle | 737 ms | 714–759 | 2 |
| Lifecycle | This library, main thread | Two maps: frames per second of each in a pan | 14.5 fps | 14.5–14.5 | 2 |
| Lifecycle | This library, main thread | Two maps: worst frame gap | 148 ms | 138–157 | 2 |
| Lifecycle | This library, worker | Create to idle, median of 8 | 601 ms | 591–610 | 2 |
| Lifecycle | This library, worker | remove(), median of 8 | 0.5 ms | 0.0–1.0 | 2 |
| Lifecycle | This library, worker | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | This library, worker | Two maps: create both to both idle | 915 ms | 853–976 | 2 |
| Lifecycle | This library, worker | Two maps: frames per second of each in a pan | 34.0 fps | 33.5–34.4 | 2 |
| Lifecycle | This library, worker | Two maps: worst frame gap | 685 ms | 577–793 | 2 |
| Cold start | MapLibre GL JS | First tile request | 406 ms | 391–418 | 5 |
| Cold start | MapLibre GL JS | First frame | 310 ms | 300–321 | 5 |
| Cold start | MapLibre GL JS | Idle | 1116 ms | 1067–1128 | 5 |
| Cold start | MapLibre GL JS | Requests before idle (the page, and the workers of this library) | 7 | 7–7 | 5 |
| Cold start | MapLibre GL JS | Of these, answered from the HTTP cache | 6 | 6–6 | 5 |
| Cold start | This library, main thread | First tile request | 388 ms | 385–398 | 5 |
| Cold start | This library, main thread | First frame | 419 ms | 416–428 | 5 |
| Cold start | This library, main thread | Idle | 949 ms | 924–979 | 5 |
| Cold start | This library, main thread | Requests before idle (the page, and the workers of this library) | 27 | 27–27 | 5 |
| Cold start | This library, main thread | Of these, answered from the HTTP cache | 7 | 7–7 | 5 |
| Cold start | This library, worker | First tile request | 410 ms | 391–610 | 5 |
| Cold start | This library, worker | First frame | 437 ms | 422–639 | 5 |
| Cold start | This library, worker | Idle | 942 ms | 890–1101 | 5 |
| Cold start | This library, worker | Requests before idle (the page, and the workers of this library) | 15 | 15–15 | 5 |
| Cold start | This library, worker | Of these, answered from the HTTP cache | 2 | 2–2 | 5 |
### linux-webkit (webkit 27.2)

linux 7.0.0-1020-azure x64, AMD EPYC 9V74 80-Core Processor

GPU: Apple GPU · screen pixel ratio 1 · map-jr-gl 0.11.0, commit unknown · MapLibre GL JS 6.17.0 · AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Safari/605.1.15

Runs of the page: 2 in 14.8 min.

- worker: loaded, renderer main, 4 features at the centre, terrain on (centre 8 m)
- main: loaded, renderer main, 4 features at the centre, terrain on (centre 8 m)

| Scenario | Library | Measure | Median | Range | Runs |
|---|---|---|---|---|---|
| Load to idle | MapLibre GL JS | Load to idle | 1370 ms | 882–1857 | 2 |
| Load to idle | MapLibre GL JS | First frame | 157 ms | 93–220 | 2 |
| Load to idle | MapLibre GL JS | load event | 1308 ms | 817–1798 | 2 |
| Load to idle | This library, main thread | Load to idle | 809 ms | 746–872 | 2 |
| Load to idle | This library, main thread | First frame | 86 ms | 83–89 | 2 |
| Load to idle | This library, main thread | load event | 809 ms | 746–871 | 2 |
| Load to idle | This library, worker | Load to idle | 742 ms | 689–795 | 2 |
| Load to idle | This library, worker | First frame | 59 ms | 59–59 | 2 |
| Load to idle | This library, worker | load event | 742 ms | 689–795 | 2 |
| 3D terrain | MapLibre GL JS | Load to idle | 3925 ms | 3388–4461 | 2 |
| 3D terrain | MapLibre GL JS | Pan: frames per second | 4.5 fps | 3.7–5.3 | 2 |
| 3D terrain | MapLibre GL JS | Pan: median frame gap | 193.3 ms | 159.0–227.5 | 2 |
| 3D terrain | MapLibre GL JS | Pan: 90th percentile frame gap | 509.0 ms | 344.0–674.0 | 2 |
| 3D terrain | MapLibre GL JS | Pan: worst frame gap | 688 ms | 607–768 | 2 |
| 3D terrain | This library, main thread | Load to idle | 1234 ms | 981–1487 | 2 |
| 3D terrain | This library, main thread | Pan: frames per second | 31.8 fps | 31.7–32.0 | 2 |
| 3D terrain | This library, main thread | Pan: median frame gap | 27.5 ms | 27.0–28.0 | 2 |
| 3D terrain | This library, main thread | Pan: 90th percentile frame gap | 47.5 ms | 46.0–49.0 | 2 |
| 3D terrain | This library, main thread | Pan: worst frame gap | 87 ms | 66–108 | 2 |
| 3D terrain | This library, worker | Load to idle | 1082 ms | 1068–1096 | 2 |
| 3D terrain | This library, worker | Pan: frames per second | 32.2 fps | 32.1–32.3 | 2 |
| 3D terrain | This library, worker | Pan: median frame gap | 27.0 ms | 27.0–27.0 | 2 |
| 3D terrain | This library, worker | Pan: 90th percentile frame gap | 45.5 ms | 45.0–46.0 | 2 |
| 3D terrain | This library, worker | Pan: worst frame gap | 69 ms | 65–72 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Load to idle | 1230 ms | 1181–1279 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: frames per second | 10.6 fps | 10.1–11.2 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: median frame gap | 84.0 ms | 80.5–87.5 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: 90th percentile frame gap | 135.0 ms | 124.0–146.0 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: worst frame gap | 156 ms | 139–173 | 2 |
| Pitch 85 with sky | This library, main thread | Load to idle | 1002 ms | 977–1027 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: frames per second | 11.0 fps | 10.9–11.0 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: median frame gap | 87.5 ms | 86.0–89.0 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: 90th percentile frame gap | 111.5 ms | 109.0–114.0 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: worst frame gap | 130 ms | 128–132 | 2 |
| Pitch 85 with sky | This library, worker | Load to idle | 1060 ms | 1018–1102 | 2 |
| Pitch 85 with sky | This library, worker | Turn: frames per second | 11.1 fps | 11.1–11.1 | 2 |
| Pitch 85 with sky | This library, worker | Turn: median frame gap | 87.3 ms | 87.0–87.5 | 2 |
| Pitch 85 with sky | This library, worker | Turn: 90th percentile frame gap | 106.5 ms | 104.0–109.0 | 2 |
| Pitch 85 with sky | This library, worker | Turn: worst frame gap | 146 ms | 145–147 | 2 |
| Globe | MapLibre GL JS | Load to idle | 2302 ms | 1883–2720 | 2 |
| Globe | MapLibre GL JS | Turn: frames per second | 17.3 fps | 17.1–17.6 | 2 |
| Globe | MapLibre GL JS | Turn: median frame gap | 57.0 ms | 56.5–57.5 | 2 |
| Globe | MapLibre GL JS | Turn: 90th percentile frame gap | 64.5 ms | 63.0–66.0 | 2 |
| Globe | MapLibre GL JS | Turn: worst frame gap | 76 ms | 69–83 | 2 |
| Globe | This library, main thread | Load to idle | 930 ms | 834–1025 | 2 |
| Globe | This library, main thread | Turn: frames per second | 59.6 fps | 59.5–59.8 | 2 |
| Globe | This library, main thread | Turn: median frame gap | 16.0 ms | 16.0–16.0 | 2 |
| Globe | This library, main thread | Turn: 90th percentile frame gap | 19.0 ms | 19.0–19.0 | 2 |
| Globe | This library, main thread | Turn: worst frame gap | 93 ms | 67–119 | 2 |
| Globe | This library, worker | Load to idle | 846 ms | 835–856 | 2 |
| Globe | This library, worker | Turn: frames per second | 61.4 fps | 61.1–61.7 | 2 |
| Globe | This library, worker | Turn: median frame gap | 16.0 ms | 16.0–16.0 | 2 |
| Globe | This library, worker | Turn: 90th percentile frame gap | 18.5 ms | 18.0–19.0 | 2 |
| Globe | This library, worker | Turn: worst frame gap | 45 ms | 44–45 | 2 |
| Camera | MapLibre GL JS | Static repaint: frames per second | 15.5 fps | 15.4–15.6 | 2 |
| Camera | MapLibre GL JS | Static repaint: median frame gap | 63.0 ms | 63.0–63.0 | 2 |
| Camera | MapLibre GL JS | Static repaint: 90th percentile frame gap | 68.0 ms | 66.0–70.0 | 2 |
| Camera | MapLibre GL JS | Static repaint: worst frame gap | 88 ms | 86–90 | 2 |
| Camera | MapLibre GL JS | Pan: frames per second | 14.2 fps | 14.2–14.3 | 2 |
| Camera | MapLibre GL JS | Pan: median frame gap | 65.0 ms | 64.0–66.0 | 2 |
| Camera | MapLibre GL JS | Pan: 90th percentile frame gap | 86.0 ms | 86.0–86.0 | 2 |
| Camera | MapLibre GL JS | Pan: worst frame gap | 123 ms | 118–128 | 2 |
| Camera | MapLibre GL JS | Rotation: frames per second | 13.5 fps | 13.4–13.5 | 2 |
| Camera | MapLibre GL JS | Rotation: median frame gap | 73.8 ms | 72.5–75.0 | 2 |
| Camera | MapLibre GL JS | Rotation: 90th percentile frame gap | 78.5 ms | 78.0–79.0 | 2 |
| Camera | MapLibre GL JS | Rotation: worst frame gap | 93 ms | 84–101 | 2 |
| Camera | MapLibre GL JS | Zoom: frames per second | 21.2 fps | 20.8–21.7 | 2 |
| Camera | MapLibre GL JS | Zoom: median frame gap | 36.8 ms | 35.5–38.0 | 2 |
| Camera | MapLibre GL JS | Zoom: 90th percentile frame gap | 75.0 ms | 74.0–76.0 | 2 |
| Camera | MapLibre GL JS | Zoom: worst frame gap | 95 ms | 90–100 | 2 |
| Camera | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | MapLibre GL JS | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera | This library, main thread | Static repaint: frames per second | 18.3 fps | 17.8–18.8 | 2 |
| Camera | This library, main thread | Static repaint: median frame gap | 52.5 ms | 52.0–53.0 | 2 |
| Camera | This library, main thread | Static repaint: 90th percentile frame gap | 60.0 ms | 57.0–63.0 | 2 |
| Camera | This library, main thread | Static repaint: worst frame gap | 70 ms | 60–80 | 2 |
| Camera | This library, main thread | Pan: frames per second | 14.2 fps | 14.1–14.4 | 2 |
| Camera | This library, main thread | Pan: median frame gap | 65.5 ms | 65.0–66.0 | 2 |
| Camera | This library, main thread | Pan: 90th percentile frame gap | 92.0 ms | 92.0–92.0 | 2 |
| Camera | This library, main thread | Pan: worst frame gap | 106 ms | 103–108 | 2 |
| Camera | This library, main thread | Rotation: frames per second | 13.0 fps | 12.6–13.5 | 2 |
| Camera | This library, main thread | Rotation: median frame gap | 74.3 ms | 73.0–75.5 | 2 |
| Camera | This library, main thread | Rotation: 90th percentile frame gap | 88.5 ms | 78.0–99.0 | 2 |
| Camera | This library, main thread | Rotation: worst frame gap | 122 ms | 101–142 | 2 |
| Camera | This library, main thread | Zoom: frames per second | 28.9 fps | 28.2–29.6 | 2 |
| Camera | This library, main thread | Zoom: median frame gap | 27.5 ms | 27.0–28.0 | 2 |
| Camera | This library, main thread | Zoom: 90th percentile frame gap | 56.5 ms | 56.0–57.0 | 2 |
| Camera | This library, main thread | Zoom: worst frame gap | 105 ms | 80–130 | 2 |
| Camera | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | This library, main thread | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera | This library, worker | Static repaint: frames per second | 18.0 fps | 17.9–18.1 | 2 |
| Camera | This library, worker | Static repaint: median frame gap | 54.0 ms | 53.0–55.0 | 2 |
| Camera | This library, worker | Static repaint: 90th percentile frame gap | 61.0 ms | 60.0–62.0 | 2 |
| Camera | This library, worker | Static repaint: worst frame gap | 69 ms | 65–73 | 2 |
| Camera | This library, worker | Pan: frames per second | 14.4 fps | 13.9–14.9 | 2 |
| Camera | This library, worker | Pan: median frame gap | 66.5 ms | 64.0–69.0 | 2 |
| Camera | This library, worker | Pan: 90th percentile frame gap | 89.5 ms | 89.0–90.0 | 2 |
| Camera | This library, worker | Pan: worst frame gap | 103 ms | 102–104 | 2 |
| Camera | This library, worker | Rotation: frames per second | 13.3 fps | 13.2–13.4 | 2 |
| Camera | This library, worker | Rotation: median frame gap | 73.8 ms | 73.5–74.0 | 2 |
| Camera | This library, worker | Rotation: 90th percentile frame gap | 81.5 ms | 80.0–83.0 | 2 |
| Camera | This library, worker | Rotation: worst frame gap | 85 ms | 84–85 | 2 |
| Camera | This library, worker | Zoom: frames per second | 29.5 fps | 29.3–29.7 | 2 |
| Camera | This library, worker | Zoom: median frame gap | 27.8 ms | 27.5–28.0 | 2 |
| Camera | This library, worker | Zoom: 90th percentile frame gap | 58.5 ms | 56.0–61.0 | 2 |
| Camera | This library, worker | Zoom: worst frame gap | 86 ms | 73–99 | 2 |
| Camera | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | This library, worker | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: frames per second | 9.6 fps | 9.6–9.7 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: median frame gap | 101.5 ms | 101.0–102.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 113.5 ms | 113.0–114.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: worst frame gap | 131 ms | 121–140 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: frames per second | 8.7 fps | 8.7–8.7 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: median frame gap | 108.8 ms | 108.0–109.5 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: 90th percentile frame gap | 151.5 ms | 151.0–152.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: worst frame gap | 166 ms | 153–179 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: frames per second | 8.8 fps | 8.8–8.9 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: median frame gap | 111.0 ms | 110.0–112.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: 90th percentile frame gap | 142.0 ms | 142.0–142.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: worst frame gap | 147 ms | 143–151 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: frames per second | 11.6 fps | 11.0–12.3 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: median frame gap | 74.5 ms | 60.0–89.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: 90th percentile frame gap | 130.5 ms | 128.0–133.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: worst frame gap | 168 ms | 161–174 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: frames per second | 12.8 fps | 12.7–12.9 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: median frame gap | 75.0 ms | 75.0–75.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: 90th percentile frame gap | 88.0 ms | 88.0–88.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: worst frame gap | 106 ms | 91–121 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: frames per second | 10.5 fps | 10.5–10.5 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: median frame gap | 92.5 ms | 91.0–94.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: 90th percentile frame gap | 128.5 ms | 126.0–131.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: worst frame gap | 143 ms | 130–155 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: frames per second | 10.5 fps | 10.5–10.6 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: median frame gap | 94.0 ms | 93.0–95.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: 90th percentile frame gap | 103.0 ms | 101.0–105.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: worst frame gap | 106 ms | 105–106 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: frames per second | 19.7 fps | 19.6–19.7 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: median frame gap | 42.5 ms | 42.0–43.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: 90th percentile frame gap | 76.0 ms | 73.0–79.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: worst frame gap | 102 ms | 101–102 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: frames per second | 13.3 fps | 13.3–13.3 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: median frame gap | 73.5 ms | 73.0–74.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: 90th percentile frame gap | 84.5 ms | 84.0–85.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: worst frame gap | 93 ms | 86–100 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: frames per second | 10.8 fps | 10.7–10.8 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: median frame gap | 88.0 ms | 87.0–89.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: 90th percentile frame gap | 120.0 ms | 117.0–123.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: worst frame gap | 144 ms | 141–146 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: frames per second | 10.9 fps | 10.8–10.9 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: median frame gap | 91.0 ms | 91.0–91.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: 90th percentile frame gap | 97.5 ms | 97.0–98.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: worst frame gap | 107 ms | 100–113 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: frames per second | 20.0 fps | 19.9–20.1 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: median frame gap | 41.0 ms | 41.0–41.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: 90th percentile frame gap | 78.0 ms | 77.0–79.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: worst frame gap | 104 ms | 101–107 | 2 |
| Camera at pixel ratio 2 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: frames per second | 6.9 fps | 6.8–6.9 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: median frame gap | 143.5 ms | 143.0–144.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 157.0 ms | 156.0–158.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: worst frame gap | 175 ms | 159–191 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: frames per second | 5.9 fps | 5.7–6.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: median frame gap | 161.0 ms | 158.0–164.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: 90th percentile frame gap | 226.5 ms | 226.0–227.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: worst frame gap | 244 ms | 231–257 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: frames per second | 6.1 fps | 6.0–6.2 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: median frame gap | 160.3 ms | 157.5–163.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: 90th percentile frame gap | 187.5 ms | 180.0–195.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: worst frame gap | 209 ms | 202–216 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: frames per second | 7.9 fps | 7.7–8.1 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: median frame gap | 125.5 ms | 109.0–142.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: 90th percentile frame gap | 191.0 ms | 186.0–196.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: worst frame gap | 221 ms | 221–221 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: frames per second | 9.0 fps | 8.9–9.2 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: median frame gap | 108.8 ms | 107.5–110.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: 90th percentile frame gap | 121.0 ms | 121.0–121.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: worst frame gap | 135 ms | 132–138 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: frames per second | 7.7 fps | 7.5–7.8 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: median frame gap | 119.5 ms | 119.0–120.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: 90th percentile frame gap | 204.0 ms | 194.0–214.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: worst frame gap | 211 ms | 200–221 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: frames per second | 8.0 fps | 7.7–8.2 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: median frame gap | 123.3 ms | 119.0–127.5 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: 90th percentile frame gap | 144.0 ms | 137.0–151.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: worst frame gap | 146 ms | 139–153 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: frames per second | 13.5 fps | 13.4–13.7 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: median frame gap | 63.5 ms | 62.0–65.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: 90th percentile frame gap | 114.0 ms | 113.0–115.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: worst frame gap | 164 ms | 144–183 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: frames per second | 9.0 fps | 8.8–9.2 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: median frame gap | 110.5 ms | 108.0–113.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: 90th percentile frame gap | 123.0 ms | 112.0–134.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: worst frame gap | 130 ms | 119–141 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: frames per second | 7.8 fps | 7.8–7.8 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: median frame gap | 116.5 ms | 116.5–116.5 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: 90th percentile frame gap | 182.5 ms | 178.0–187.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: worst frame gap | 205 ms | 179–231 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: frames per second | 8.0 fps | 7.7–8.3 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: median frame gap | 121.0 ms | 119.0–123.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: 90th percentile frame gap | 141.0 ms | 130.0–152.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: worst frame gap | 147 ms | 138–155 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: frames per second | 13.6 fps | 13.5–13.6 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: median frame gap | 61.3 ms | 61.0–61.5 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: 90th percentile frame gap | 112.5 ms | 112.0–113.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: worst frame gap | 157 ms | 145–168 | 2 |
| Camera at pixel ratio 3 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| 1,000 markers | MapLibre GL JS | Add the markers | 78 ms | 75–81 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: frames per second | 12.7 fps | 12.5–13.0 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 119.5 ms | 119.0–120.0 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: worst frame gap | 149 ms | 142–155 | 2 |
| 1,000 markers | This library, main thread | Add the markers | 3 ms | 3–3 | 2 |
| 1,000 markers | This library, main thread | Pan: frames per second | 23.6 fps | 23.6–23.7 | 2 |
| 1,000 markers | This library, main thread | Pan: 90th percentile frame gap | 66.0 ms | 65.0–67.0 | 2 |
| 1,000 markers | This library, main thread | Pan: worst frame gap | 99 ms | 93–105 | 2 |
| 1,000 markers | This library, worker | Add the markers | 1 ms | 0–1 | 2 |
| 1,000 markers | This library, worker | Pan: frames per second | 24.1 fps | 24.1–24.2 | 2 |
| 1,000 markers | This library, worker | Pan: 90th percentile frame gap | 64.0 ms | 64.0–64.0 | 2 |
| 1,000 markers | This library, worker | Pan: worst frame gap | 98 ms | 91–105 | 2 |
| 10,000 markers | MapLibre GL JS | Add the markers | 661 ms | 641–681 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: frames per second | 2.4 fps | 2.2–2.6 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 530.5 ms | 514.0–547.0 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: worst frame gap | 531 ms | 514–547 | 2 |
| 10,000 markers | This library, main thread | Add the markers | 3 ms | 3–3 | 2 |
| 10,000 markers | This library, main thread | Pan: frames per second | 23.0 fps | 22.8–23.2 | 2 |
| 10,000 markers | This library, main thread | Pan: 90th percentile frame gap | 70.0 ms | 69.0–71.0 | 2 |
| 10,000 markers | This library, main thread | Pan: worst frame gap | 106 ms | 95–116 | 2 |
| 10,000 markers | This library, worker | Add the markers | 1 ms | 1–1 | 2 |
| 10,000 markers | This library, worker | Pan: frames per second | 23.0 fps | 22.5–23.4 | 2 |
| 10,000 markers | This library, worker | Pan: 90th percentile frame gap | 68.0 ms | 66.0–70.0 | 2 |
| 10,000 markers | This library, worker | Pan: worst frame gap | 100 ms | 91–109 | 2 |
| GeoJSON setData | MapLibre GL JS | addSource to idle | 429 ms | 409–449 | 2 |
| GeoJSON setData | MapLibre GL JS | Frames per second during the updates | 9.7 fps | 9.6–9.8 | 2 |
| GeoJSON setData | MapLibre GL JS | setData calls per second | 10.8 /s | 10.8–10.8 | 2 |
| GeoJSON setData | MapLibre GL JS | Worst frame gap | 158 ms | 153–162 | 2 |
| GeoJSON setData | MapLibre GL JS | Last setData to idle | 240 ms | 203–277 | 2 |
| GeoJSON setData | This library, main thread | addSource to idle | 423 ms | 310–535 | 2 |
| GeoJSON setData | This library, main thread | Frames per second during the updates | 11.9 fps | 11.6–12.3 | 2 |
| GeoJSON setData | This library, main thread | setData calls per second | 12.5 /s | 12.5–12.5 | 2 |
| GeoJSON setData | This library, main thread | Worst frame gap | 171 ms | 112–229 | 2 |
| GeoJSON setData | This library, main thread | Last setData to idle | 228 ms | 206–249 | 2 |
| GeoJSON setData | This library, worker | addSource to idle | 388 ms | 340–435 | 2 |
| GeoJSON setData | This library, worker | Frames per second during the updates | 11.9 fps | 11.8–11.9 | 2 |
| GeoJSON setData | This library, worker | setData calls per second | 12.9 /s | 12.1–13.8 | 2 |
| GeoJSON setData | This library, worker | Worst frame gap | 144 ms | 115–173 | 2 |
| GeoJSON setData | This library, worker | Last setData to idle | 365 ms | 338–392 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty, one per frame: first call to idle | 6910 ms | 6876–6943 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: the calls | 0.5 ms | 0.0–1.0 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: first call to idle | 387 ms | 385–388 | 2 |
| Run-time edits | MapLibre GL JS | 30 hover steps of setFeatureState, one per frame: first step to idle | 1955 ms | 1954–1955 | 2 |
| Run-time edits | MapLibre GL JS | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 133 ms | 132–133 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty, one per frame: first call to idle | 6777 ms | 6683–6871 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: the calls | 0.5 ms | 0.0–1.0 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: first call to idle | 364 ms | 346–382 | 2 |
| Run-time edits | This library, main thread | 30 hover steps of setFeatureState, one per frame: first step to idle | 1917 ms | 1855–1978 | 2 |
| Run-time edits | This library, main thread | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 75 ms | 60–90 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty, one per frame: first call to idle | 6680 ms | 6631–6729 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: the calls | 1.0 ms | 1.0–1.0 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: first call to idle | 392 ms | 388–395 | 2 |
| Run-time edits | This library, worker | 30 hover steps of setFeatureState, one per frame: first step to idle | 1868 ms | 1837–1898 | 2 |
| Run-time edits | This library, worker | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 67 ms | 65–68 | 2 |
| Images | MapLibre GL JS | addImage and the icon layer: to idle | 780 ms | 735–825 | 2 |
| Images | MapLibre GL JS | 500 × updateImage, one per frame: first call to idle | 32653 ms | 32525–32781 | 2 |
| Images | MapLibre GL JS | Frames per second during the updates | 15.3 fps | 15.3–15.4 | 2 |
| Images | MapLibre GL JS | Worst frame gap during the updates | 115 ms | 110–120 | 2 |
| Images | MapLibre GL JS | 500 × updateImage in one task: the calls | 1.5 ms | 0.0–3.0 | 2 |
| Images | MapLibre GL JS | 500 × updateImage in one task: first call to idle | 66 ms | 64–67 | 2 |
| Images | This library, main thread | addImage and the icon layer: to idle | 491 ms | 472–510 | 2 |
| Images | This library, main thread | 500 × updateImage, one per frame: first call to idle | 28917 ms | 28893–28940 | 2 |
| Images | This library, main thread | Frames per second during the updates | 17.3 fps | 17.3–17.3 | 2 |
| Images | This library, main thread | Worst frame gap during the updates | 83 ms | 77–89 | 2 |
| Images | This library, main thread | 500 × updateImage in one task: the calls | 1.0 ms | 1.0–1.0 | 2 |
| Images | This library, main thread | 500 × updateImage in one task: first call to idle | 59 ms | 57–60 | 2 |
| Images | This library, worker | addImage and the icon layer: to idle | 513 ms | 491–535 | 2 |
| Images | This library, worker | 500 × updateImage, one per frame: first call to idle | 28926 ms | 28921–28930 | 2 |
| Images | This library, worker | Frames per second during the updates | 17.3 fps | 17.3–17.3 | 2 |
| Images | This library, worker | Worst frame gap during the updates | 94 ms | 92–95 | 2 |
| Images | This library, worker | 500 × updateImage in one task: the calls | 0.5 ms | 0.0–1.0 | 2 |
| Images | This library, worker | 500 × updateImage in one task: first call to idle | 55 ms | 53–56 | 2 |
| Lifecycle | MapLibre GL JS | Create to idle, median of 8 | 794 ms | 787–802 | 2 |
| Lifecycle | MapLibre GL JS | remove(), median of 8 | 4.8 ms | 4.5–5.0 | 2 |
| Lifecycle | MapLibre GL JS | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: create both to both idle | 1314 ms | 1286–1342 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: frames per second of each in a pan | 9.7 fps | 9.6–9.7 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: worst frame gap | 138 ms | 137–139 | 2 |
| Lifecycle | This library, main thread | Create to idle, median of 8 | 682 ms | 667–696 | 2 |
| Lifecycle | This library, main thread | remove(), median of 8 | 1.0 ms | 1.0–1.0 | 2 |
| Lifecycle | This library, main thread | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | This library, main thread | Two maps: create both to both idle | 1009 ms | 974–1044 | 2 |
| Lifecycle | This library, main thread | Two maps: frames per second of each in a pan | 11.1 fps | 11.1–11.2 | 2 |
| Lifecycle | This library, main thread | Two maps: worst frame gap | 139 ms | 137–141 | 2 |
| Lifecycle | This library, worker | Create to idle, median of 8 | 696 ms | 694–697 | 2 |
| Lifecycle | This library, worker | remove(), median of 8 | 1.0 ms | 1.0–1.0 | 2 |
| Lifecycle | This library, worker | Workers started by the 8 maps and not ended | -8 | -8–-8 | 2 |
| Lifecycle | This library, worker | Two maps: create both to both idle | 1155 ms | 1139–1171 | 2 |
| Lifecycle | This library, worker | Two maps: frames per second of each in a pan | 11.3 fps | 11.1–11.4 | 2 |
| Lifecycle | This library, worker | Two maps: worst frame gap | 143 ms | 142–144 | 2 |
| Cold start | MapLibre GL JS | First tile request | 474 ms | 420–496 | 5 |
| Cold start | MapLibre GL JS | First frame | 368 ms | 341–387 | 5 |
| Cold start | MapLibre GL JS | Idle | 1310 ms | 1302–1366 | 5 |
| Cold start | MapLibre GL JS | Requests before idle (the page, and the workers of this library) | 9 | 9–9 | 5 |
| Cold start | MapLibre GL JS | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
| Cold start | This library, main thread | First tile request | 448 ms | 443–459 | 5 |
| Cold start | This library, main thread | First frame | 480 ms | 474–490 | 5 |
| Cold start | This library, main thread | Idle | 1267 ms | 1248–1396 | 5 |
| Cold start | This library, main thread | Requests before idle (the page, and the workers of this library) | 28 | 28–28 | 5 |
| Cold start | This library, main thread | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
| Cold start | This library, worker | First tile request | 641 ms | 634–651 | 5 |
| Cold start | This library, worker | First frame | 677 ms | 669–687 | 5 |
| Cold start | This library, worker | Idle | 1496 ms | 1468–1532 | 5 |
| Cold start | This library, worker | Requests before idle (the page, and the workers of this library) | 28 | 28–28 | 5 |
| Cold start | This library, worker | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
## Failed behaviour tests

### darwin-chromium

```
FAIL  [main] queryRenderedFeatures finds text on a line along all of its glyphs and not on the rest of the line, and does not find a label that is not shown (#1735) {"found":36,"runs":[20,4,4,4,4],"points":45,"hidden":""}
FAIL  [main] on the globe a large icon on the ground far from the center has the width and the height of MapLibre GL JS within 1.5 pixels, with both renderers (#2297) {"ml main -60,20":[38,56],"ml main -75,30":[44,82],"mjr main -60,20":[41,60],"mjr main -75,30":[44,82],"mjr worker -60,20":[41,60],"mjr worker -75,30":[44,82]}
FAIL  [main] maplibre-compat: fitBounds flies with a duration from speed, and eases with linear, as in MapLibre GL JS (#1235) {"ml":{"fly":{"ms":955.7999999998137,"low":2.8745855663093063,"end":[40,0,5.720378747282916]},"linear":{"ms":512.5,"low":5.720378747282916,"end":[0,0,5.720378747282916]}},"compat":{"fly":{"ms":874.0999999998603,"low":2.7921782695457096,"end":[40.00000000000014,0,5.720378747282909]},"linear":{"ms":585.3000000000466,"low":5.720378747282909,"end":[0,0,5.720378747282909]}}}
FAIL  [main] maplibre-compat: the inertia of a fast and of a slow pan goes as far as in MapLibre GL JS (#479, #2151) {"ml16":3,"ml80":0,"compat16":3,"compat80":6}
FAIL  [worker] compat: a drag that starts during an easeTo does not jump back (#38) {"renderer":"worker","steps":[0,20,10,10,10]}
FAIL  [worker] maplibre-compat: the inertia of a fast and of a slow pan goes as far as in MapLibre GL JS (#479, #2151) {"ml16":5,"ml80":0,"compat16":4,"compat80":5}
```

### darwin-firefox

```
FAIL  [main] the globe: easeTo to the north without a zoom keeps the size of the globe, the zoom changes, and flyTo has the curve of MapLibre GL JS {"s0":4.022650811796211,"min":4.022650811795074,"max":4.022650811795074,"frames":3,"zoom":-0.0478467995414924,"lat":70,"flyMin":1.167091884119756}
FAIL  [main] the globe: a line north of 85.05° N or south of 85.05° S has the width of MapLibre GL JS within 2%, and Mercator clips it at the edge of the world (#2307) {"ours globe 88":784,"ml globe 88":745,"ours globe -88":811,"ml globe -88":737,"ours globe 84":768,"ml globe 84":756,"ours mercator 88":300,"ml mercator 88":300}
FAIL  [main] a lost WebGL context during an easeTo and a restart slower than the ease, with the page blocked before the loss is seen: the camera ends at the target (#1757) {"events":["moveend","webglcontextlost","webglcontextrestored","moveend"],"lng":20,"lat":9.999999999999998,"zoom":4}
FAIL  [main] queryRenderedFeatures finds text on a line along all of its glyphs and not on the rest of the line, and does not find a label that is not shown (#1735) {"found":36,"runs":[20,4,4,4,4],"points":45,"hidden":""}
FAIL  [main] compat: on a pitched map the soft edge of a line is as wide on the screen whichever way the line runs, as in MapLibre GL JS (#2064) {"line":{"across":0,"toward":0,"y":-1},"gap":{"across":0,"toward":0,"y":-1}}
FAIL  [main] compat: on a pitched map a line across a tile edge has each pixel drawn once, with no hole and no pixel drawn twice (#2443) [{"pitch":60,"bearing":-40,"inside":67224,"holes":0,"twice":0},{"pitch":60,"bearing":200,"inside":60913,"holes":12,"twice":0},{"pitch":60,"bearing":250,"inside":78714,"holes":0,"twice":0},{"pitch":50,"bearing":300,"inside":74809,"holes":0,"twice":0}]
FAIL  [main] maplibre-compat: a custom layer between two style layers draws in its place, with the matrix of MapLibre GL JS (flat, and with bearing and pitch) {"flat":{"inside":"red","covered":"blue","outside":"white","edgeIn":"red","edgeOut":"white","fillOnly":"blue"},"tilted":{"inside":["red","red","red","red"],"outside":["white","white","white","white"],"covered":"red"},"matrix":2.842170943040401e-14,"close":0.000008173728397421397}
FAIL  [main] maplibre-compat and createMap: renderWorldCopies: false keeps the view and markers in one world as MapLibre does (setRenderWorldCopies moves the view only at the next camera change), and draws and covers no other copy (#1710) {"ml":[[74.5312,0,0],[-153.6328,10,2],[166.8164,-20,3],[30,0,3],["project",3982.2222],[-166.8164,0],false,true,["kept",190],["moved",127.2656]],"compat":[[74.5312,0,0],[-153.6328,10,2],[166.8164,-20,3],[30,0,3],["project",3982.2222],[-166.8164,0],false,true,["kept",190],["moved",127.2656]],"drawn":[[false,"0,1"],[false,"0"]],"main":[[74.5312,0],0,190]}
FAIL  [main] compat: a rotate drag released while it moves turns on with inertia (#679) {"atRelease":80,"end":82.13856092670972}
FAIL  [main] no page errors [JavaScript Error: "downloadable font: rejected by sanitizer (font-family: "F1675" style:normal weight:400 width:100 src index:0) source: (invalid URI)"] | [JavaScript Error: "downloadable font: font load failed (font-family: "F1675" style:normal weight:400 width:100 src index:0) source: (invalid URI)"]
FAIL  [worker] the globe: a line north of 85.05° N or south of 85.05° S has the width of MapLibre GL JS within 2%, and Mercator clips it at the edge of the world (#2307) {"ours globe 88":784,"ml globe 88":792,"ours globe -88":811,"ml globe -88":717,"ours globe 84":768,"ml globe 84":756,"ours mercator 88":300,"ml mercator 88":300}
FAIL  [worker] easeTo reaches target [39.94719660632222,14.999075940610638]
FAIL  [worker] feature state is set, merged and removed, and the map is idle after a state that no layer reads {"both":{"hover":true,"picked":1},"one":{"picked":1},"none":{},"unread":0,"read":0,"readMs":5002,"idle":false,"sent":[],"warned":["[map-jr-gl] E294 https://map-jr.org/e/294 source=\"omt\" id=\"abc\""]}
FAIL  [worker] 3D terrain: a drag moves the map over ground whose elevation has not arrived [0,0,0]
FAIL  [worker] the textures of colour ramps are deleted when their layers are removed or the style changes (#591) {"renderer":"main","start":0,"removed":0,"restyled":0,"empty":0}
FAIL  [worker] 3D terrain that is switched on: the map is idle when the elevation data has come, not 200 ms after the camera got its height (#436) [326,282,498]
```

### darwin-webkit

```
FAIL  [main] the globe: a drag turns the globe as in MapLibre GL JS, and at zoom 12.5 the globe is Mercator {"held":[185.6818133045434,159.18680999190445,30.23978395993447,25.967823358193982,1.3464573528329429],"dragged":{"centre":[46.11750907397568,-5.893282304999172],"zoom":1.6998736872185105},"zoomed":0}
FAIL  [main] maplibre-compat: a reload of an expired tile that answers 304 fires no sourcedata with a tile, as MapLibre GL JS (#2136) {"ours":"","ml":"0/0/0"}
FAIL  [main] a lost WebGL context during an easeTo and a restart slower than the ease, with the page blocked before the loss is seen: the camera ends at the target (#1757) {"events":["moveend","webglcontextlost","webglcontextrestored","moveend"],"lng":20,"lat":9.999999999999996,"zoom":4}
FAIL  [main] queryRenderedFeatures finds text on a line along all of its glyphs and not on the rest of the line, and does not find a label that is not shown (#1735) {"found":36,"runs":[20,4,4,4,4],"points":45,"hidden":""}
FAIL  [main] on the globe a large icon on the ground far from the center has the width and the height of MapLibre GL JS within 1.5 pixels, with both renderers (#2297) {"ml main -60,20":[38,56],"ml main -75,30":[44,82],"mjr main -60,20":[41,60],"mjr main -75,30":[44,82],"mjr worker -60,20":[41,60],"mjr worker -75,30":[44,82]}
FAIL  [main] the sources of the first style: transformRequest gets the TileJSON and the GeoJSON as Source, and addProtocol supplies the GeoJSON {"asked":[["Source","/test-first-tiles.json"],["Source","first://point"]],"errors":[],"from":"first://point?seen=1","tileJson":false}
FAIL  [main] maplibre-compat: fitBounds flies with a duration from speed, and eases with linear, as in MapLibre GL JS (#1235) {"ml":{"fly":{"ms":879,"low":2.7839887019730827,"end":[40,0,5.720378747282916]},"linear":{"ms":517,"low":5.720378747282916,"end":[0,0,5.720378747282916]}},"compat":{"fly":{"ms":874,"low":2.884562430409054,"end":[40.00000000000014,0,5.720378747282909]},"linear":{"ms":517,"low":5.720378747282909,"end":[0,0,5.720378747282909]}}}
FAIL  [main] maplibre-compat: the inertia of a fast and of a slow pan goes as far as in MapLibre GL JS (#479, #2151) {"ml16":86,"ml80":15,"compat16":116,"compat80":55}
FAIL  [worker] the globe: a drag turns the globe as in MapLibre GL JS, and at zoom 12.5 the globe is Mercator {"held":[185.87419025836763,159.1637317444064,30.17989100967725,25.960422036708596,1.3465481040390448],"dragged":{"centre":[57.71065549889709,-17.112630285139286],"zoom":1.6421910022642205},"zoomed":0}
FAIL  [worker] maplibre-compat: a reload of an expired tile that answers 304 fires no sourcedata with a tile, as MapLibre GL JS (#2136) {"ours":"","ml":"0/0/0"}
FAIL  [worker] the first drawImage of the canvas of a new map gives the map, at state.idle and 300 ms later (#965) ["0,0,0,0","0,0,0,0","255,0,255,255","255,0,255,255"]
FAIL  [main] interactive: {scrollZoom: false} stops the wheel and keeps the drag, {dragPan: false} stops the drag and keeps the wheel, and {} turns every gesture on (#2412) {"noWheel":{"moved":true,"zoomed":false,"grab":true},"noDrag":{"moved":true,"zoomed":true},"allOn":{"moved":true,"zoomed":true}}
```

### linux-chromium

```
(none)
```

### linux-firefox

```
FAIL  [main] layer mouseleave fires when the pointer leaves the canvas enter,leave:0 / enter,leave:0,enter,leave:0,enter
FAIL  [main] a lost WebGL context during an easeTo and a restart slower than the ease, with the page blocked before the loss is seen: the camera ends at the target (#1757) {"events":["moveend","webglcontextlost","webglcontextrestored","moveend"],"lng":20,"lat":9.999999999999998,"zoom":4}
FAIL  [main] queryRenderedFeatures finds text on a line along all of its glyphs and not on the rest of the line, and does not find a label that is not shown (#1735) {"found":36,"runs":[20,4,4,4,4],"points":45,"hidden":""}
FAIL  [main] on the globe a large icon on the ground far from the center has the width and the height of MapLibre GL JS within 1.5 pixels, with both renderers (#2297) {"ml main -60,20":[38,56],"ml main -75,30":[44,82],"mjr main -60,20":[40,59],"mjr main -75,30":[44,82],"mjr worker -60,20":[40,59],"mjr worker -75,30":[44,82]}
FAIL  [main] no page errors [JavaScript Error: "downloadable font: rejected by sanitizer (font-family: "F1675" style:normal weight:400 width:100 src index:0) source: (invalid URI)"] | [JavaScript Error: "downloadable font: font load failed (font-family: "F1675" style:normal weight:400 width:100 src index:0) source: (invalid URI)"]
```

### linux-webkit

```
FAIL  [main] the globe: a drag turns the globe as in MapLibre GL JS, and at zoom 12.5 the globe is Mercator {"held":[187.179978759893,158.0948462694654,29.774687588293887,25.67517797740638,1.3500229653429723],"dragged":{"centre":[52.79307464631315,-12.077396988678608],"zoom":1.6752272219372404},"zoomed":0}
FAIL  [main] maplibre-compat: a reload of an expired tile that answers 304 fires no sourcedata with a tile, as MapLibre GL JS (#2136) {"ours":"","ml":"0/0/0"}
FAIL  [main] a lost WebGL context during an easeTo and a restart slower than the ease, with the page blocked before the loss is seen: the camera ends at the target (#1757) {"events":["moveend","webglcontextlost","webglcontextrestored","moveend"],"lng":20,"lat":9.999999999999996,"zoom":4}
FAIL  [main] queryRenderedFeatures finds text on a line along all of its glyphs and not on the rest of the line, and does not find a label that is not shown (#1735) {"found":36,"runs":[20,4,4,4,4],"points":45,"hidden":""}
FAIL  [main] on the globe a large icon on the ground far from the center has the width and the height of MapLibre GL JS within 1.5 pixels, with both renderers (#2297) {"ml main -60,20":[38,56],"ml main -75,30":[44,82],"mjr main -60,20":[40,59],"mjr main -75,30":[44,82],"mjr worker -60,20":[40,59],"mjr worker -75,30":[44,82]}
FAIL  [main] the sources of the first style: transformRequest gets the TileJSON and the GeoJSON as Source, and addProtocol supplies the GeoJSON {"asked":[["Source","/test-first-tiles.json"],["Source","first://point"]],"errors":[],"from":"first://point?seen=1","tileJson":false}
FAIL  [main] maplibre-compat: a context lost before the first frame after the move to the main thread for a custom layer restarts the map once more, and it draws (#1993) {"errors":[],"events":"","renderer":"main","renders":1}
FAIL  [main] maplibre-compat: the inertia of a fast and of a slow pan goes as far as in MapLibre GL JS (#479, #2151) {"ml16":211,"ml80":15,"compat16":241,"compat80":55}
FAIL  [worker] the globe: a drag turns the globe as in MapLibre GL JS, and at zoom 12.5 the globe is Mercator {"held":[185.87419025839176,159.16373174443166,30.179891009669632,25.960422036715176,1.3465481040389646],"dragged":{"centre":[86.86758685576902,-42.513024978541125],"zoom":1.267497471230226},"zoomed":0}
FAIL  [worker] maplibre-compat: a reload of an expired tile that answers 304 fires no sourcedata with a tile, as MapLibre GL JS (#2136) {"ours":"","ml":"0/0/0"}
FAIL  [worker] the sources of the first style: transformRequest gets the TileJSON and the GeoJSON as Source, and addProtocol supplies the GeoJSON {"asked":[["Source","/test-first-tiles.json"],["Source","first://point"]],"errors":[],"from":"first://point?seen=1","tileJson":false}
FAIL  [worker] maplibre-compat: setTransformCameraUpdate warns once when its function changes the camera, and not when it returns an earlier camera {"lagging":{"calls":2,"warnings":1},"warnings":1}
FAIL  [worker] maplibre-compat: the inertia of a fast and of a slow pan goes as far as in MapLibre GL JS (#479, #2151) {"ml16":211,"ml80":15,"compat16":241,"compat80":55}
FAIL  no check finished within 120 s after "[worker] the control terrain() sets terrain of the description without a new style, calls onTerrainChange, and an update with the description keeps the terrain (#1106)"; the pages are closed and the suite moves on
FAIL  [worker] the test run was completed page.evaluate: Target page, context or browser has been closed
FAIL  [worker] a fast drag from the compass never turns back: not in getBearing(), in the needle or in the drawn map (#548) {"mouse 100":[0,0,0],"mouse 25":[1,1,0],"mouse 5":[0,0,0]}
FAIL  [main] a fast drag from the compass never turns back: not in getBearing(), in the needle or in the drawn map (#548) {"mouse 100":[0,0,0],"mouse 25":[1,1,0],"mouse 5":[0,0,0]}
FAIL  browser: useMapFeatures gives what the style layers draw, and useMapSource the data of the source that a ref names {"first":{"drawn":1,"layer":"pts","raw":0},"other":{"drawn":1,"layer":"pts","raw":0}}
```

