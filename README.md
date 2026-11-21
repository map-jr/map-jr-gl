# Results in browsers

Commit a223ec5adb70a686177d7a8d13eeebc727d71546, 2026-11-21T20:38Z. The workflow "Browsers" writes this branch.

## Behaviour tests

| System and browser | Pass | Fail |
|---|---|---|
| darwin-chromium | 757 | 3 |
| darwin-firefox | 612 | 14 |
| darwin-webkit | 752 | 1 |
| linux-chromium | 755 | 5 |
| linux-firefox | 749 | 3 |
| linux-webkit | 727 | 8 |
| win32-chromium | 755 | 3 |
| win32-firefox | 742 | 8 |
| win32-webkit | 711 | 6 |

## Benchmarks

### darwin-chromium (chromium 159.0.8154.6)

darwin 25.6.0 arm64, Apple M1 (Virtual)

GPU: ANGLE (Apple, ANGLE Metal Renderer: Apple Paravirtual device, Unspecified Version) · screen pixel ratio 1 · map-jr-gl 0.9.0, commit unknown · MapLibre GL JS 6.17.0 · AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/159.0.8154.6 Safari/537.36

Runs of the page: 2 in 13.8 min.

- worker: loaded, renderer worker, 8 features at the centre, terrain on (centre 10 m)
- main: loaded, renderer main, 8 features at the centre, terrain on (centre 10 m)

| Scenario | Library | Measure | Median | Range | Runs |
|---|---|---|---|---|---|
| Load to idle | MapLibre GL JS | Load to idle | 1177 ms | 539–1815 | 2 |
| Load to idle | MapLibre GL JS | First frame | 109 ms | 47–171 | 2 |
| Load to idle | MapLibre GL JS | load event | 1162 ms | 523–1802 | 2 |
| Load to idle | This library, main thread | Load to idle | 504 ms | 466–541 | 2 |
| Load to idle | This library, main thread | First frame | 92 ms | 76–109 | 2 |
| Load to idle | This library, main thread | load event | 504 ms | 466–541 | 2 |
| Load to idle | This library, worker | Load to idle | 437 ms | 351–522 | 2 |
| Load to idle | This library, worker | First frame | 64 ms | 57–72 | 2 |
| Load to idle | This library, worker | load event | 437 ms | 351–522 | 2 |
| 3D terrain | MapLibre GL JS | Load to idle | 1498 ms | 834–2162 | 2 |
| 3D terrain | MapLibre GL JS | Pan: frames per second | 27.1 fps | 21.3–32.8 | 2 |
| 3D terrain | MapLibre GL JS | Pan: median frame gap | 26.5 ms | 21.5–31.4 | 2 |
| 3D terrain | MapLibre GL JS | Pan: 90th percentile frame gap | 86.8 ms | 65.2–108.3 | 2 |
| 3D terrain | MapLibre GL JS | Pan: worst frame gap | 122 ms | 103–141 | 2 |
| 3D terrain | This library, main thread | Load to idle | 508 ms | 429–588 | 2 |
| 3D terrain | This library, main thread | Pan: frames per second | 28.9 fps | 20.2–37.7 | 2 |
| 3D terrain | This library, main thread | Pan: median frame gap | 28.7 ms | 19.3–38.1 | 2 |
| 3D terrain | This library, main thread | Pan: 90th percentile frame gap | 82.4 ms | 53.1–111.6 | 2 |
| 3D terrain | This library, main thread | Pan: worst frame gap | 120 ms | 89–150 | 2 |
| 3D terrain | This library, worker | Load to idle | 801 ms | 765–838 | 2 |
| 3D terrain | This library, worker | Pan: frames per second | 27.0 fps | 19.9–34.1 | 2 |
| 3D terrain | This library, worker | Pan: median frame gap | 25.5 ms | 22.6–28.3 | 2 |
| 3D terrain | This library, worker | Pan: 90th percentile frame gap | 96.3 ms | 67.1–125.5 | 2 |
| 3D terrain | This library, worker | Pan: worst frame gap | 136 ms | 124–149 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Load to idle | 1147 ms | 1036–1258 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: frames per second | 26.8 fps | 26.0–27.5 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: median frame gap | 22.6 ms | 20.7–24.6 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: 90th percentile frame gap | 81.9 ms | 60.4–103.4 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: worst frame gap | 456 ms | 156–757 | 2 |
| Pitch 85 with sky | This library, main thread | Load to idle | 2256 ms | 1557–2956 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: frames per second | 29.0 fps | 26.9–31.0 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: median frame gap | 21.9 ms | 20.5–23.2 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: 90th percentile frame gap | 82.2 ms | 70.8–93.5 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: worst frame gap | 157 ms | 150–164 | 2 |
| Pitch 85 with sky | This library, worker | Load to idle | 1886 ms | 1557–2214 | 2 |
| Pitch 85 with sky | This library, worker | Turn: frames per second | 23.9 fps | 21.0–26.8 | 2 |
| Pitch 85 with sky | This library, worker | Turn: median frame gap | 31.4 ms | 27.8–34.9 | 2 |
| Pitch 85 with sky | This library, worker | Turn: 90th percentile frame gap | 113.0 ms | 103.6–122.5 | 2 |
| Pitch 85 with sky | This library, worker | Turn: worst frame gap | 180 ms | 166–195 | 2 |
| Globe | MapLibre GL JS | Load to idle | 1964 ms | 1383–2546 | 2 |
| Globe | MapLibre GL JS | Turn: frames per second | 25.9 fps | 23.3–28.4 | 2 |
| Globe | MapLibre GL JS | Turn: median frame gap | 23.0 ms | 22.9–23.2 | 2 |
| Globe | MapLibre GL JS | Turn: 90th percentile frame gap | 97.9 ms | 87.4–108.3 | 2 |
| Globe | MapLibre GL JS | Turn: worst frame gap | 146 ms | 142–149 | 2 |
| Globe | This library, main thread | Load to idle | 666 ms | 500–833 | 2 |
| Globe | This library, main thread | Turn: frames per second | 18.1 fps | 18.0–18.2 | 2 |
| Globe | This library, main thread | Turn: median frame gap | 49.8 ms | 46.6–53.0 | 2 |
| Globe | This library, main thread | Turn: 90th percentile frame gap | 111.1 ms | 109.7–112.4 | 2 |
| Globe | This library, main thread | Turn: worst frame gap | 146 ms | 141–151 | 2 |
| Globe | This library, worker | Load to idle | 555 ms | 515–595 | 2 |
| Globe | This library, worker | Turn: frames per second | 17.8 fps | 17.6–18.1 | 2 |
| Globe | This library, worker | Turn: median frame gap | 53.0 ms | 47.3–58.6 | 2 |
| Globe | This library, worker | Turn: 90th percentile frame gap | 116.7 ms | 106.2–127.3 | 2 |
| Globe | This library, worker | Turn: worst frame gap | 152 ms | 149–155 | 2 |
| Camera | MapLibre GL JS | Static repaint: frames per second | 22.2 fps | 17.1–27.3 | 2 |
| Camera | MapLibre GL JS | Static repaint: median frame gap | 36.8 ms | 18.5–55.2 | 2 |
| Camera | MapLibre GL JS | Static repaint: 90th percentile frame gap | 110.8 ms | 107.4–114.1 | 2 |
| Camera | MapLibre GL JS | Static repaint: worst frame gap | 141 ms | 140–142 | 2 |
| Camera | MapLibre GL JS | Pan: frames per second | 20.4 fps | 17.7–23.2 | 2 |
| Camera | MapLibre GL JS | Pan: median frame gap | 37.1 ms | 26.5–47.7 | 2 |
| Camera | MapLibre GL JS | Pan: 90th percentile frame gap | 111.1 ms | 107.0–115.3 | 2 |
| Camera | MapLibre GL JS | Pan: worst frame gap | 147 ms | 140–154 | 2 |
| Camera | MapLibre GL JS | Rotation: frames per second | 19.2 fps | 17.6–20.8 | 2 |
| Camera | MapLibre GL JS | Rotation: median frame gap | 46.3 ms | 39.3–53.3 | 2 |
| Camera | MapLibre GL JS | Rotation: 90th percentile frame gap | 103.4 ms | 102.9–103.9 | 2 |
| Camera | MapLibre GL JS | Rotation: worst frame gap | 141 ms | 141–141 | 2 |
| Camera | MapLibre GL JS | Zoom: frames per second | 19.1 fps | 18.5–19.7 | 2 |
| Camera | MapLibre GL JS | Zoom: median frame gap | 35.6 ms | 31.9–39.3 | 2 |
| Camera | MapLibre GL JS | Zoom: 90th percentile frame gap | 124.2 ms | 120.0–128.3 | 2 |
| Camera | MapLibre GL JS | Zoom: worst frame gap | 147 ms | 141–154 | 2 |
| Camera | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | MapLibre GL JS | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera | This library, main thread | Static repaint: frames per second | 17.2 fps | 16.2–18.2 | 2 |
| Camera | This library, main thread | Static repaint: median frame gap | 52.7 ms | 50.4–55.0 | 2 |
| Camera | This library, main thread | Static repaint: 90th percentile frame gap | 113.5 ms | 109.4–117.6 | 2 |
| Camera | This library, main thread | Static repaint: worst frame gap | 155 ms | 152–159 | 2 |
| Camera | This library, main thread | Pan: frames per second | 23.8 fps | 22.8–24.8 | 2 |
| Camera | This library, main thread | Pan: median frame gap | 27.6 ms | 27.4–27.8 | 2 |
| Camera | This library, main thread | Pan: 90th percentile frame gap | 101.5 ms | 101.0–102.0 | 2 |
| Camera | This library, main thread | Pan: worst frame gap | 145 ms | 145–146 | 2 |
| Camera | This library, main thread | Rotation: frames per second | 21.8 fps | 16.9–26.7 | 2 |
| Camera | This library, main thread | Rotation: median frame gap | 35.8 ms | 22.1–49.5 | 2 |
| Camera | This library, main thread | Rotation: 90th percentile frame gap | 105.0 ms | 92.9–117.2 | 2 |
| Camera | This library, main thread | Rotation: worst frame gap | 132 ms | 128–137 | 2 |
| Camera | This library, main thread | Zoom: frames per second | 24.7 fps | 18.5–30.9 | 2 |
| Camera | This library, main thread | Zoom: median frame gap | 30.5 ms | 23.2–37.9 | 2 |
| Camera | This library, main thread | Zoom: 90th percentile frame gap | 91.1 ms | 68.5–113.8 | 2 |
| Camera | This library, main thread | Zoom: worst frame gap | 149 ms | 141–158 | 2 |
| Camera | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | This library, main thread | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera | This library, worker | Static repaint: frames per second | 24.0 fps | 17.5–30.5 | 2 |
| Camera | This library, worker | Static repaint: median frame gap | 38.1 ms | 23.5–52.7 | 2 |
| Camera | This library, worker | Static repaint: 90th percentile frame gap | 93.4 ms | 63.6–123.1 | 2 |
| Camera | This library, worker | Static repaint: worst frame gap | 136 ms | 122–151 | 2 |
| Camera | This library, worker | Pan: frames per second | 24.9 fps | 19.1–30.6 | 2 |
| Camera | This library, worker | Pan: median frame gap | 29.0 ms | 22.7–35.3 | 2 |
| Camera | This library, worker | Pan: 90th percentile frame gap | 90.8 ms | 64.2–117.4 | 2 |
| Camera | This library, worker | Pan: worst frame gap | 149 ms | 148–151 | 2 |
| Camera | This library, worker | Rotation: frames per second | 22.2 fps | 17.9–26.4 | 2 |
| Camera | This library, worker | Rotation: median frame gap | 36.6 ms | 18.2–55.1 | 2 |
| Camera | This library, worker | Rotation: 90th percentile frame gap | 109.8 ms | 99.5–120.0 | 2 |
| Camera | This library, worker | Rotation: worst frame gap | 164 ms | 142–187 | 2 |
| Camera | This library, worker | Zoom: frames per second | 22.6 fps | 20.1–25.0 | 2 |
| Camera | This library, worker | Zoom: median frame gap | 31.0 ms | 27.6–34.3 | 2 |
| Camera | This library, worker | Zoom: 90th percentile frame gap | 116.3 ms | 102.4–130.2 | 2 |
| Camera | This library, worker | Zoom: worst frame gap | 146 ms | 130–161 | 2 |
| Camera | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | This library, worker | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: frames per second | 20.5 fps | 18.3–22.6 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: median frame gap | 37.2 ms | 29.7–44.7 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 113.8 ms | 107.1–120.5 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: worst frame gap | 148 ms | 140–157 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: frames per second | 19.0 fps | 17.2–20.8 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: median frame gap | 46.5 ms | 37.5–55.4 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: 90th percentile frame gap | 118.7 ms | 115.6–121.8 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: worst frame gap | 147 ms | 138–155 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: frames per second | 20.4 fps | 19.2–21.5 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: median frame gap | 39.1 ms | 37.2–40.9 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: 90th percentile frame gap | 104.4 ms | 99.8–109.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: worst frame gap | 133 ms | 133–134 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: frames per second | 18.8 fps | 17.4–20.1 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: median frame gap | 48.2 ms | 36.7–59.7 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: 90th percentile frame gap | 111.5 ms | 109.7–113.3 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: worst frame gap | 122 ms | 122–123 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: frames per second | 18.6 fps | 18.1–19.1 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: median frame gap | 44.1 ms | 41.5–46.7 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: 90th percentile frame gap | 116.1 ms | 103.7–128.4 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: worst frame gap | 132 ms | 124–140 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: frames per second | 23.6 fps | 16.4–30.8 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: median frame gap | 39.5 ms | 18.7–60.2 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: 90th percentile frame gap | 103.4 ms | 88.8–118.1 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: worst frame gap | 136 ms | 115–156 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: frames per second | 18.0 fps | 16.5–19.4 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: median frame gap | 35.5 ms | 30.5–40.4 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: 90th percentile frame gap | 120.1 ms | 111.7–128.6 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: worst frame gap | 142 ms | 135–148 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: frames per second | 22.1 fps | 21.6–22.7 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: median frame gap | 29.8 ms | 25.2–34.3 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: 90th percentile frame gap | 107.4 ms | 106.8–107.9 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: worst frame gap | 133 ms | 126–139 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: frames per second | 17.2 fps | 17.1–17.4 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: median frame gap | 51.6 ms | 49.2–53.9 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: 90th percentile frame gap | 122.3 ms | 108.7–135.9 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: worst frame gap | 148 ms | 146–150 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: frames per second | 18.7 fps | 18.0–19.3 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: median frame gap | 44.0 ms | 39.5–48.5 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: 90th percentile frame gap | 109.7 ms | 109.7–109.8 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: worst frame gap | 150 ms | 144–157 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: frames per second | 18.4 fps | 17.1–19.7 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: median frame gap | 50.1 ms | 48.9–51.3 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: 90th percentile frame gap | 111.1 ms | 106.8–115.3 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: worst frame gap | 130 ms | 124–136 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: frames per second | 21.1 fps | 19.5–22.8 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: median frame gap | 30.8 ms | 26.0–35.5 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: 90th percentile frame gap | 105.7 ms | 103.4–108.1 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: worst frame gap | 149 ms | 141–157 | 2 |
| Camera at pixel ratio 2 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: frames per second | 18.5 fps | 18.0–19.1 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: median frame gap | 39.4 ms | 35.4–43.3 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 114.5 ms | 107.8–121.1 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: worst frame gap | 137 ms | 128–146 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: frames per second | 20.1 fps | 19.5–20.6 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: median frame gap | 33.7 ms | 28.0–39.3 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: 90th percentile frame gap | 114.2 ms | 110.5–117.9 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: worst frame gap | 136 ms | 123–149 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: frames per second | 18.1 fps | 17.8–18.3 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: median frame gap | 53.0 ms | 49.7–56.2 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: 90th percentile frame gap | 109.8 ms | 104.4–115.1 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: worst frame gap | 140 ms | 136–144 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: frames per second | 20.5 fps | 20.4–20.6 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: median frame gap | 31.3 ms | 26.6–36.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: 90th percentile frame gap | 116.4 ms | 105.3–127.6 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: worst frame gap | 139 ms | 137–142 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: frames per second | 20.1 fps | 16.8–23.4 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: median frame gap | 35.8 ms | 21.5–50.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: 90th percentile frame gap | 113.4 ms | 97.2–129.6 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: worst frame gap | 192 ms | 147–237 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: frames per second | 19.9 fps | 17.9–21.9 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: median frame gap | 43.1 ms | 31.5–54.8 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: 90th percentile frame gap | 105.8 ms | 103.3–108.3 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: worst frame gap | 150 ms | 145–156 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: frames per second | 18.5 fps | 18.3–18.8 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: median frame gap | 44.8 ms | 41.9–47.7 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: 90th percentile frame gap | 109.7 ms | 102.9–116.5 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: worst frame gap | 144 ms | 133–155 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: frames per second | 18.4 fps | 17.3–19.4 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: median frame gap | 42.2 ms | 30.8–53.6 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: 90th percentile frame gap | 118.0 ms | 115.8–120.2 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: worst frame gap | 142 ms | 138–146 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: frames per second | 23.9 fps | 17.2–30.5 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: median frame gap | 37.0 ms | 18.0–56.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: 90th percentile frame gap | 103.3 ms | 88.6–118.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: worst frame gap | 135 ms | 135–136 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: frames per second | 24.7 fps | 18.5–30.9 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: median frame gap | 38.7 ms | 20.9–56.5 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: 90th percentile frame gap | 95.4 ms | 86.2–104.6 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: worst frame gap | 114 ms | 113–114 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: frames per second | 18.0 fps | 17.2–18.8 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: median frame gap | 54.9 ms | 51.3–58.5 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: 90th percentile frame gap | 115.4 ms | 108.0–122.8 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: worst frame gap | 138 ms | 133–143 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: frames per second | 19.7 fps | 19.3–20.1 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: median frame gap | 42.4 ms | 39.7–45.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: 90th percentile frame gap | 117.4 ms | 112.2–122.5 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: worst frame gap | 139 ms | 138–140 | 2 |
| Camera at pixel ratio 3 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| 1,000 markers | MapLibre GL JS | Add the markers | 53 ms | 43–63 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: frames per second | 19.2 fps | 16.3–22.2 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 115.4 ms | 102.7–128.0 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: worst frame gap | 154 ms | 149–158 | 2 |
| 1,000 markers | This library, main thread | Add the markers | 2 ms | 2–2 | 2 |
| 1,000 markers | This library, main thread | Pan: frames per second | 20.4 fps | 20.3–20.5 | 2 |
| 1,000 markers | This library, main thread | Pan: 90th percentile frame gap | 108.6 ms | 108.6–108.7 | 2 |
| 1,000 markers | This library, main thread | Pan: worst frame gap | 164 ms | 159–170 | 2 |
| 1,000 markers | This library, worker | Add the markers | 1 ms | 1–1 | 2 |
| 1,000 markers | This library, worker | Pan: frames per second | 18.1 fps | 17.6–18.6 | 2 |
| 1,000 markers | This library, worker | Pan: 90th percentile frame gap | 118.4 ms | 116.3–120.6 | 2 |
| 1,000 markers | This library, worker | Pan: worst frame gap | 160 ms | 154–165 | 2 |
| 10,000 markers | MapLibre GL JS | Add the markers | 422 ms | 380–464 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: frames per second | 3.0 fps | 2.9–3.2 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 503.0 ms | 496.7–509.3 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: worst frame gap | 607 ms | 547–668 | 2 |
| 10,000 markers | This library, main thread | Add the markers | 1 ms | 1–1 | 2 |
| 10,000 markers | This library, main thread | Pan: frames per second | 20.7 fps | 20.0–21.3 | 2 |
| 10,000 markers | This library, main thread | Pan: 90th percentile frame gap | 113.0 ms | 105.1–120.9 | 2 |
| 10,000 markers | This library, main thread | Pan: worst frame gap | 159 ms | 159–160 | 2 |
| 10,000 markers | This library, worker | Add the markers | 1 ms | 1–1 | 2 |
| 10,000 markers | This library, worker | Pan: frames per second | 19.8 fps | 18.3–21.3 | 2 |
| 10,000 markers | This library, worker | Pan: 90th percentile frame gap | 109.0 ms | 108.2–109.9 | 2 |
| 10,000 markers | This library, worker | Pan: worst frame gap | 155 ms | 149–161 | 2 |
| GeoJSON setData | MapLibre GL JS | addSource to idle | 394 ms | 340–448 | 2 |
| GeoJSON setData | MapLibre GL JS | Frames per second during the updates | 16.9 fps | 15.9–17.9 | 2 |
| GeoJSON setData | MapLibre GL JS | setData calls per second | 24.6 /s | 21.3–27.9 | 2 |
| GeoJSON setData | MapLibre GL JS | Worst frame gap | 146 ms | 129–163 | 2 |
| GeoJSON setData | MapLibre GL JS | Last setData to idle | 97 ms | 35–159 | 2 |
| GeoJSON setData | This library, main thread | addSource to idle | 140 ms | 136–144 | 2 |
| GeoJSON setData | This library, main thread | Frames per second during the updates | 21.5 fps | 20.2–22.9 | 2 |
| GeoJSON setData | This library, main thread | setData calls per second | 23.8 /s | 22.9–24.6 | 2 |
| GeoJSON setData | This library, main thread | Worst frame gap | 146 ms | 131–160 | 2 |
| GeoJSON setData | This library, main thread | Last setData to idle | 20 ms | 15–26 | 2 |
| GeoJSON setData | This library, worker | addSource to idle | 186 ms | 182–191 | 2 |
| GeoJSON setData | This library, worker | Frames per second during the updates | 21.6 fps | 19.4–23.7 | 2 |
| GeoJSON setData | This library, worker | setData calls per second | 24.8 /s | 21.7–27.9 | 2 |
| GeoJSON setData | This library, worker | Worst frame gap | 154 ms | 137–171 | 2 |
| GeoJSON setData | This library, worker | Last setData to idle | 206 ms | 179–233 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty, one per frame: first call to idle | 5522 ms | 4994–6050 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: the calls | 1.0 ms | 0.8–1.2 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: first call to idle | 409 ms | 409–410 | 2 |
| Run-time edits | MapLibre GL JS | 30 hover steps of setFeatureState, one per frame: first step to idle | 1487 ms | 1416–1558 | 2 |
| Run-time edits | MapLibre GL JS | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 117 ms | 109–126 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty, one per frame: first call to idle | 5302 ms | 5198–5406 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: the calls | 0.5 ms | 0.5–0.6 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: first call to idle | 335 ms | 306–365 | 2 |
| Run-time edits | This library, main thread | 30 hover steps of setFeatureState, one per frame: first step to idle | 1593 ms | 1355–1831 | 2 |
| Run-time edits | This library, main thread | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 21 ms | 18–24 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty, one per frame: first call to idle | 4495 ms | 4023–4966 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: the calls | 0.5 ms | 0.1–0.8 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: first call to idle | 367 ms | 328–405 | 2 |
| Run-time edits | This library, worker | 30 hover steps of setFeatureState, one per frame: first step to idle | 1703 ms | 1577–1830 | 2 |
| Run-time edits | This library, worker | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 75 ms | 40–109 | 2 |
| Images | MapLibre GL JS | addImage and the icon layer: to idle | 745 ms | 741–750 | 2 |
| Images | MapLibre GL JS | 500 × updateImage, one per frame: first call to idle | 27495 ms | 26646–28343 | 2 |
| Images | MapLibre GL JS | Frames per second during the updates | 18.2 fps | 17.7–18.8 | 2 |
| Images | MapLibre GL JS | Worst frame gap during the updates | 158 ms | 150–165 | 2 |
| Images | MapLibre GL JS | 500 × updateImage in one task: the calls | 0.8 ms | 0.4–1.2 | 2 |
| Images | MapLibre GL JS | 500 × updateImage in one task: first call to idle | 20 ms | 18–22 | 2 |
| Images | This library, main thread | addImage and the icon layer: to idle | 331 ms | 281–380 | 2 |
| Images | This library, main thread | 500 × updateImage, one per frame: first call to idle | 27626 ms | 27486–27766 | 2 |
| Images | This library, main thread | Frames per second during the updates | 18.1 fps | 18.0–18.2 | 2 |
| Images | This library, main thread | Worst frame gap during the updates | 154 ms | 154–154 | 2 |
| Images | This library, main thread | 500 × updateImage in one task: the calls | 0.6 ms | 0.6–0.6 | 2 |
| Images | This library, main thread | 500 × updateImage in one task: first call to idle | 90 ms | 67–113 | 2 |
| Images | This library, worker | addImage and the icon layer: to idle | 320 ms | 319–322 | 2 |
| Images | This library, worker | 500 × updateImage, one per frame: first call to idle | 24089 ms | 21832–26346 | 2 |
| Images | This library, worker | Frames per second during the updates | 20.9 fps | 18.8–22.9 | 2 |
| Images | This library, worker | Worst frame gap during the updates | 189 ms | 164–213 | 2 |
| Images | This library, worker | 500 × updateImage in one task: the calls | 0.7 ms | 0.6–0.9 | 2 |
| Images | This library, worker | 500 × updateImage in one task: first call to idle | 216 ms | 148–284 | 2 |
| Lifecycle | MapLibre GL JS | Create to idle, median of 8 | 566 ms | 556–576 | 2 |
| Lifecycle | MapLibre GL JS | remove(), median of 8 | 22.0 ms | 11.5–32.5 | 2 |
| Lifecycle | MapLibre GL JS | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: create both to both idle | 982 ms | 892–1071 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: frames per second of each in a pan | 18.6 fps | 18.0–19.3 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: worst frame gap | 140 ms | 133–146 | 2 |
| Lifecycle | This library, main thread | Create to idle, median of 8 | 377 ms | 364–389 | 2 |
| Lifecycle | This library, main thread | remove(), median of 8 | 6.9 ms | 5.1–8.8 | 2 |
| Lifecycle | This library, main thread | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | This library, main thread | Two maps: create both to both idle | 494 ms | 490–499 | 2 |
| Lifecycle | This library, main thread | Two maps: frames per second of each in a pan | 17.9 fps | 17.2–18.5 | 2 |
| Lifecycle | This library, main thread | Two maps: worst frame gap | 171 ms | 167–174 | 2 |
| Lifecycle | This library, worker | Create to idle, median of 8 | 449 ms | 436–462 | 2 |
| Lifecycle | This library, worker | remove(), median of 8 | 0.2 ms | 0.2–0.2 | 2 |
| Lifecycle | This library, worker | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | This library, worker | Two maps: create both to both idle | 582 ms | 571–593 | 2 |
| Lifecycle | This library, worker | Two maps: frames per second of each in a pan | 19.5 fps | 19.4–19.5 | 2 |
| Lifecycle | This library, worker | Two maps: worst frame gap | 182 ms | 176–188 | 2 |
| Cold start | MapLibre GL JS | First tile request | 529 ms | 482–775 | 5 |
| Cold start | MapLibre GL JS | First frame | 399 ms | 369–648 | 5 |
| Cold start | MapLibre GL JS | Idle | 1126 ms | 1041–1334 | 5 |
| Cold start | MapLibre GL JS | Requests before idle (the page, and the workers of this library) | 7 | 7–7 | 5 |
| Cold start | MapLibre GL JS | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
| Cold start | This library, main thread | First tile request | 523 ms | 450–533 | 5 |
| Cold start | This library, main thread | First frame | 540 ms | 460–551 | 5 |
| Cold start | This library, main thread | Idle | 978 ms | 831–1029 | 5 |
| Cold start | This library, main thread | Requests before idle (the page, and the workers of this library) | 16 | 16–16 | 5 |
| Cold start | This library, main thread | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
| Cold start | This library, worker | First tile request | 507 ms | 459–520 | 5 |
| Cold start | This library, worker | First frame | 525 ms | 470–537 | 5 |
| Cold start | This library, worker | Idle | 1017 ms | 935–1267 | 5 |
| Cold start | This library, worker | Requests before idle (the page, and the workers of this library) | 12 | 12–12 | 5 |
| Cold start | This library, worker | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
### darwin-firefox (firefox 159.0)

darwin 25.6.0 arm64, Apple M1 (Virtual)

GPU: Apple M1, or similar · screen pixel ratio 1 · map-jr-gl 0.9.0, commit unknown · MapLibre GL JS 6.17.0 · Gecko/20100101 Firefox/159.0

- worker: loaded, renderer worker, 8 features at the centre, terrain on (centre 10 m)
- main: loaded, renderer main, 8 features at the centre, terrain on (centre 10 m)

| Scenario | Library | Measure | Median | Range | Runs |
|---|---|---|---|---|---|
| Load to idle | MapLibre GL JS | Load to idle | 4713 ms |  | 1 |
| Load to idle | MapLibre GL JS | First frame | 242 ms |  | 1 |
| Load to idle | MapLibre GL JS | load event | 1577 ms |  | 1 |
| Load to idle | This library, main thread | Load to idle | 4118 ms |  | 1 |
| Load to idle | This library, main thread | First frame | 385 ms |  | 1 |
| Load to idle | This library, main thread | load event | 4109 ms |  | 1 |
| Load to idle | This library, worker | Load to idle | 4127 ms |  | 1 |
| Load to idle | This library, worker | First frame | 277 ms |  | 1 |
| Load to idle | This library, worker | load event | 4127 ms |  | 1 |
| 3D terrain | MapLibre GL JS | Load to idle | 42945 ms |  | 1 |
| 3D terrain | MapLibre GL JS | Pan: frames per second | 0.2 fps |  | 1 |
| 3D terrain | MapLibre GL JS | Pan: median frame gap | 1110.0 ms |  | 1 |
| 3D terrain | MapLibre GL JS | Pan: 90th percentile frame gap | 18649.0 ms |  | 1 |
| 3D terrain | MapLibre GL JS | Pan: worst frame gap | 18649 ms |  | 1 |
| 3D terrain | This library, main thread | Load to idle | 21515 ms |  | 1 |
| 3D terrain | This library, main thread | Pan: frames per second | 0.5 fps |  | 1 |
| 3D terrain | This library, main thread | Pan: median frame gap | 1136.0 ms |  | 1 |
| 3D terrain | This library, main thread | Pan: 90th percentile frame gap | 4224.0 ms |  | 1 |
| 3D terrain | This library, main thread | Pan: worst frame gap | 4224 ms |  | 1 |
| 3D terrain | This library, worker | Load to idle | 13459 ms |  | 1 |
| 3D terrain | This library, worker | Pan: frames per second | 1.3 fps |  | 1 |
| 3D terrain | This library, worker | Pan: median frame gap | 530.0 ms |  | 1 |
| 3D terrain | This library, worker | Pan: 90th percentile frame gap | 1831.0 ms |  | 1 |
| 3D terrain | This library, worker | Pan: worst frame gap | 1831 ms |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Load to idle | 4772 ms |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Turn: frames per second | 2.0 fps |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Turn: median frame gap | 484.0 ms |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Turn: 90th percentile frame gap | 984.0 ms |  | 1 |
| Pitch 85 with sky | MapLibre GL JS | Turn: worst frame gap | 984 ms |  | 1 |
| Pitch 85 with sky | This library, main thread | Load to idle | 5000 ms |  | 1 |
| Pitch 85 with sky | This library, main thread | Turn: frames per second | 0.4 fps |  | 1 |
| Pitch 85 with sky | This library, main thread | Turn: median frame gap | 2474.0 ms |  | 1 |
| Pitch 85 with sky | This library, main thread | Turn: 90th percentile frame gap | 2474.0 ms |  | 1 |
| Pitch 85 with sky | This library, main thread | Turn: worst frame gap | 2474 ms |  | 1 |
| Pitch 85 with sky | This library, worker | Load to idle | 18740 ms |  | 1 |
| Pitch 85 with sky | This library, worker | Turn: frames per second | 0.0 fps |  | 1 |
| Pitch 85 with sky | This library, worker | Turn: median frame gap | n/a ms |  | 0 |
| Pitch 85 with sky | This library, worker | Turn: 90th percentile frame gap | n/a ms |  | 0 |
| Pitch 85 with sky | This library, worker | Turn: worst frame gap | n/a ms |  | 0 |
| Globe | MapLibre GL JS | Load to idle | 9053 ms |  | 1 |
| Globe | MapLibre GL JS | Turn: frames per second | 1.8 fps |  | 1 |
| Globe | MapLibre GL JS | Turn: median frame gap | 520.0 ms |  | 1 |
| Globe | MapLibre GL JS | Turn: 90th percentile frame gap | 911.0 ms |  | 1 |
| Globe | MapLibre GL JS | Turn: worst frame gap | 911 ms |  | 1 |
| Globe | This library, main thread | Load to idle | 3079 ms |  | 1 |
| Globe | This library, main thread | Turn: frames per second | 2.2 fps |  | 1 |
| Globe | This library, main thread | Turn: median frame gap | 493.0 ms |  | 1 |
| Globe | This library, main thread | Turn: 90th percentile frame gap | 678.0 ms |  | 1 |
| Globe | This library, main thread | Turn: worst frame gap | 678 ms |  | 1 |
| Globe | This library, worker | Load to idle | 749 ms |  | 1 |
| Globe | This library, worker | Turn: frames per second | 59.5 fps |  | 1 |
| Globe | This library, worker | Turn: median frame gap | 17.0 ms |  | 1 |
| Globe | This library, worker | Turn: 90th percentile frame gap | 20.0 ms |  | 1 |
| Globe | This library, worker | Turn: worst frame gap | 53 ms |  | 1 |
| Camera | MapLibre GL JS | Static repaint: frames per second | 2.3 fps |  | 1 |
| Camera | MapLibre GL JS | Static repaint: median frame gap | 462.0 ms |  | 1 |
| Camera | MapLibre GL JS | Static repaint: 90th percentile frame gap | 526.0 ms |  | 1 |
| Camera | MapLibre GL JS | Static repaint: worst frame gap | 526 ms |  | 1 |
| Camera | MapLibre GL JS | Pan: frames per second | 2.5 fps |  | 1 |
| Camera | MapLibre GL JS | Pan: median frame gap | 430.5 ms |  | 1 |
| Camera | MapLibre GL JS | Pan: 90th percentile frame gap | 734.0 ms |  | 1 |
| Camera | MapLibre GL JS | Pan: worst frame gap | 734 ms |  | 1 |
| Camera | MapLibre GL JS | Rotation: frames per second | 1.8 fps |  | 1 |
| Camera | MapLibre GL JS | Rotation: median frame gap | 581.0 ms |  | 1 |
| Camera | MapLibre GL JS | Rotation: 90th percentile frame gap | 588.0 ms |  | 1 |
| Camera | MapLibre GL JS | Rotation: worst frame gap | 588 ms |  | 1 |
| Camera | MapLibre GL JS | Zoom: frames per second | 3.5 fps |  | 1 |
| Camera | MapLibre GL JS | Zoom: median frame gap | 374.0 ms |  | 1 |
| Camera | MapLibre GL JS | Zoom: 90th percentile frame gap | 442.0 ms |  | 1 |
| Camera | MapLibre GL JS | Zoom: worst frame gap | 442 ms |  | 1 |
| Camera | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera | MapLibre GL JS | Pixel ratio of the drawing buffer | 1.00 |  | 1 |
| Camera | This library, main thread | Static repaint: frames per second | 2.4 fps |  | 1 |
| Camera | This library, main thread | Static repaint: median frame gap | 417.0 ms |  | 1 |
| Camera | This library, main thread | Static repaint: 90th percentile frame gap | 861.0 ms |  | 1 |
| Camera | This library, main thread | Static repaint: worst frame gap | 861 ms |  | 1 |
| Camera | This library, main thread | Pan: frames per second | 1.3 fps |  | 1 |
| Camera | This library, main thread | Pan: median frame gap | 745.5 ms |  | 1 |
| Camera | This library, main thread | Pan: 90th percentile frame gap | 961.0 ms |  | 1 |
| Camera | This library, main thread | Pan: worst frame gap | 961 ms |  | 1 |
| Camera | This library, main thread | Rotation: frames per second | 1.4 fps |  | 1 |
| Camera | This library, main thread | Rotation: median frame gap | 805.0 ms |  | 1 |
| Camera | This library, main thread | Rotation: 90th percentile frame gap | 1361.0 ms |  | 1 |
| Camera | This library, main thread | Rotation: worst frame gap | 1361 ms |  | 1 |
| Camera | This library, main thread | Zoom: frames per second | 2.4 fps |  | 1 |
| Camera | This library, main thread | Zoom: median frame gap | 427.0 ms |  | 1 |
| Camera | This library, main thread | Zoom: 90th percentile frame gap | 805.0 ms |  | 1 |
| Camera | This library, main thread | Zoom: worst frame gap | 805 ms |  | 1 |
| Camera | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera | This library, main thread | Pixel ratio of the drawing buffer | 1.00 |  | 1 |
| Camera | This library, worker | Static repaint: frames per second | 5.7 fps |  | 1 |
| Camera | This library, worker | Static repaint: median frame gap | 18.0 ms |  | 1 |
| Camera | This library, worker | Static repaint: 90th percentile frame gap | 498.0 ms |  | 1 |
| Camera | This library, worker | Static repaint: worst frame gap | 498 ms |  | 1 |
| Camera | This library, worker | Pan: frames per second | 50.0 fps |  | 1 |
| Camera | This library, worker | Pan: median frame gap | 15.5 ms |  | 1 |
| Camera | This library, worker | Pan: 90th percentile frame gap | 29.0 ms |  | 1 |
| Camera | This library, worker | Pan: worst frame gap | 93 ms |  | 1 |
| Camera | This library, worker | Rotation: frames per second | 67.2 fps |  | 1 |
| Camera | This library, worker | Rotation: median frame gap | 14.5 ms |  | 1 |
| Camera | This library, worker | Rotation: 90th percentile frame gap | 22.0 ms |  | 1 |
| Camera | This library, worker | Rotation: worst frame gap | 22 ms |  | 1 |
| Camera | This library, worker | Zoom: frames per second | 60.0 fps |  | 1 |
| Camera | This library, worker | Zoom: median frame gap | 17.0 ms |  | 1 |
| Camera | This library, worker | Zoom: 90th percentile frame gap | 20.0 ms |  | 1 |
| Camera | This library, worker | Zoom: worst frame gap | 30 ms |  | 1 |
| Camera | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera | This library, worker | Pixel ratio of the drawing buffer | 1.00 |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: frames per second | 0.4 fps |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: median frame gap | 2533.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 2533.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: worst frame gap | 2533 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: frames per second | 0.9 fps |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: median frame gap | 1078.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: 90th percentile frame gap | 1146.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: worst frame gap | 1146 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: frames per second | 1.6 fps |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: median frame gap | 664.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: 90th percentile frame gap | 704.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: worst frame gap | 704 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: frames per second | 1.6 fps |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: median frame gap | 528.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: 90th percentile frame gap | 1079.0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: worst frame gap | 1079 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pixel ratio of the drawing buffer | 2.00 |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: frames per second | 0.8 fps |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: median frame gap | 1304.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: 90th percentile frame gap | 1304.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: worst frame gap | 1304 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pan: frames per second | 1.4 fps |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pan: median frame gap | 865.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pan: 90th percentile frame gap | 1262.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pan: worst frame gap | 1262 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: frames per second | 0.6 fps |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: median frame gap | 1808.5 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: 90th percentile frame gap | 2750.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: worst frame gap | 2750 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: frames per second | 0.9 fps |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: median frame gap | 1104.5 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: 90th percentile frame gap | 1107.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: worst frame gap | 1107 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, main thread | Pixel ratio of the drawing buffer | 2.00 |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: frames per second | 0.0 fps |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: median frame gap | n/a ms |  | 0 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: 90th percentile frame gap | n/a ms |  | 0 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: worst frame gap | n/a ms |  | 0 |
| Camera at pixel ratio 2 | This library, worker | Pan: frames per second | 67.6 fps |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pan: median frame gap | 17.5 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pan: 90th percentile frame gap | 22.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pan: worst frame gap | 22 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Rotation: frames per second | 59.3 fps |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Rotation: median frame gap | 17.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Rotation: 90th percentile frame gap | 20.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Rotation: worst frame gap | 20 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Zoom: frames per second | 60.1 fps |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Zoom: median frame gap | 16.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Zoom: 90th percentile frame gap | 20.0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Zoom: worst frame gap | 26 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 2 | This library, worker | Pixel ratio of the drawing buffer | 2.00 |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: frames per second | 0.3 fps |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: median frame gap | 3079.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 3079.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: worst frame gap | 3079 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: frames per second | 0.9 fps |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: median frame gap | 1111.5 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: 90th percentile frame gap | 1304.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: worst frame gap | 1304 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: frames per second | 1.1 fps |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: median frame gap | 885.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: 90th percentile frame gap | 885.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: worst frame gap | 885 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: frames per second | 0.6 fps |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: median frame gap | 1641.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: 90th percentile frame gap | 2597.0 ms |  | 1 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: worst frame gap | 2597 ms |  | 1 |
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
| Camera at pixel ratio 3 | This library, main thread | Zoom: frames per second | 0.8 fps |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: median frame gap | 1231.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: 90th percentile frame gap | 1231.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: worst frame gap | 1231 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, main thread | Pixel ratio of the drawing buffer | 3.00 |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: frames per second | 0.0 fps |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: median frame gap | n/a ms |  | 0 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: 90th percentile frame gap | n/a ms |  | 0 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: worst frame gap | n/a ms |  | 0 |
| Camera at pixel ratio 3 | This library, worker | Pan: frames per second | 0.0 fps |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Pan: median frame gap | n/a ms |  | 0 |
| Camera at pixel ratio 3 | This library, worker | Pan: 90th percentile frame gap | n/a ms |  | 0 |
| Camera at pixel ratio 3 | This library, worker | Pan: worst frame gap | n/a ms |  | 0 |
| Camera at pixel ratio 3 | This library, worker | Rotation: frames per second | 64.0 fps |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Rotation: median frame gap | 17.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Rotation: 90th percentile frame gap | 20.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Rotation: worst frame gap | 29 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Zoom: frames per second | 60.1 fps |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Zoom: median frame gap | 16.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Zoom: 90th percentile frame gap | 23.0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Zoom: worst frame gap | 34 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms |  | 1 |
| Camera at pixel ratio 3 | This library, worker | Pixel ratio of the drawing buffer | 3.00 |  | 1 |
| 1,000 markers | MapLibre GL JS | Add the markers | 71 ms |  | 1 |
| 1,000 markers | MapLibre GL JS | Pan: frames per second | 4.3 fps |  | 1 |
| 1,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 518.0 ms |  | 1 |
| 1,000 markers | MapLibre GL JS | Pan: worst frame gap | 527 ms |  | 1 |
| 1,000 markers | This library, main thread | Add the markers | 7 ms |  | 1 |
| 1,000 markers | This library, main thread | Pan: frames per second | 2.8 fps |  | 1 |
| 1,000 markers | This library, main thread | Pan: 90th percentile frame gap | 740.0 ms |  | 1 |
| 1,000 markers | This library, main thread | Pan: worst frame gap | 740 ms |  | 1 |
| 1,000 markers | This library, worker | Add the markers | 2 ms |  | 1 |
| 1,000 markers | This library, worker | Pan: frames per second | 20.2 fps |  | 1 |
| 1,000 markers | This library, worker | Pan: 90th percentile frame gap | 124.0 ms |  | 1 |
| 1,000 markers | This library, worker | Pan: worst frame gap | 154 ms |  | 1 |
| 10,000 markers | MapLibre GL JS | Add the markers | 464 ms |  | 1 |
| 10,000 markers | MapLibre GL JS | Pan: frames per second | 4.4 fps |  | 1 |
| 10,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 419.0 ms |  | 1 |
| 10,000 markers | MapLibre GL JS | Pan: worst frame gap | 442 ms |  | 1 |
| 10,000 markers | This library, main thread | Add the markers | 1 ms |  | 1 |
| 10,000 markers | This library, main thread | Pan: frames per second | 2.6 fps |  | 1 |
| 10,000 markers | This library, main thread | Pan: 90th percentile frame gap | 805.0 ms |  | 1 |
| 10,000 markers | This library, main thread | Pan: worst frame gap | 805 ms |  | 1 |
| 10,000 markers | This library, worker | Add the markers | 2 ms |  | 1 |
| 10,000 markers | This library, worker | Pan: frames per second | 8.6 fps |  | 1 |
| 10,000 markers | This library, worker | Pan: 90th percentile frame gap | 106.0 ms |  | 1 |
| 10,000 markers | This library, worker | Pan: worst frame gap | 1161 ms |  | 1 |
| GeoJSON setData | MapLibre GL JS | addSource to idle | 2046 ms |  | 1 |
| GeoJSON setData | MapLibre GL JS | Frames per second during the updates | 1.7 fps |  | 1 |
| GeoJSON setData | MapLibre GL JS | setData calls per second | 4.6 /s |  | 1 |
| GeoJSON setData | MapLibre GL JS | Worst frame gap | 789 ms |  | 1 |
| GeoJSON setData | MapLibre GL JS | Last setData to idle | 17 ms |  | 1 |
| GeoJSON setData | This library, main thread | addSource to idle | 2091 ms |  | 1 |
| GeoJSON setData | This library, main thread | Frames per second during the updates | 1.3 fps |  | 1 |
| GeoJSON setData | This library, main thread | setData calls per second | 2.1 /s |  | 1 |
| GeoJSON setData | This library, main thread | Worst frame gap | 1380 ms |  | 1 |
| GeoJSON setData | This library, main thread | Last setData to idle | 1189 ms |  | 1 |
| GeoJSON setData | This library, worker | addSource to idle | 4282 ms |  | 1 |
| GeoJSON setData | This library, worker | Frames per second during the updates | 30.5 fps |  | 1 |
| GeoJSON setData | This library, worker | setData calls per second | 60.4 /s |  | 1 |
| GeoJSON setData | This library, worker | Worst frame gap | 75 ms |  | 1 |
| GeoJSON setData | This library, worker | Last setData to idle | 966 ms |  | 1 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty, one per frame: first call to idle | 28250 ms |  | 1 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: the calls | 0.0 ms |  | 1 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: first call to idle | 783 ms |  | 1 |
| Run-time edits | MapLibre GL JS | 30 hover steps of setFeatureState, one per frame: first step to idle | 8207 ms |  | 1 |
| Run-time edits | MapLibre GL JS | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 572 ms |  | 1 |

Errors: bench: run 1 of the page did not end within 15 min; the page says: Running 32 of 39, run 1 of 1: Run-time edits: This library, main thread
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
### linux-webkit (webkit 27.2)

linux 7.0.0-1016-aws x64, Intel(R) Xeon(R) 6975P-C

GPU: Apple GPU · screen pixel ratio 1 · map-jr-gl 0.9.0, commit unknown · MapLibre GL JS 6.17.0 · AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Safari/605.1.15

Runs of the page: 2 in 14.1 min.

- worker: loaded, renderer main, 8 features at the centre, terrain on (centre 10 m)
- main: loaded, renderer main, 8 features at the centre, terrain on (centre 10 m)

| Scenario | Library | Measure | Median | Range | Runs |
|---|---|---|---|---|---|
| Load to idle | MapLibre GL JS | Load to idle | 1195 ms | 805–1585 | 2 |
| Load to idle | MapLibre GL JS | First frame | 141 ms | 82–200 | 2 |
| Load to idle | MapLibre GL JS | load event | 1138 ms | 745–1531 | 2 |
| Load to idle | This library, main thread | Load to idle | 642 ms | 580–703 | 2 |
| Load to idle | This library, main thread | First frame | 85 ms | 84–86 | 2 |
| Load to idle | This library, main thread | load event | 641 ms | 579–703 | 2 |
| Load to idle | This library, worker | Load to idle | 567 ms | 554–580 | 2 |
| Load to idle | This library, worker | First frame | 56 ms | 56–56 | 2 |
| Load to idle | This library, worker | load event | 567 ms | 554–580 | 2 |
| 3D terrain | MapLibre GL JS | Load to idle | 3238 ms | 3013–3462 | 2 |
| 3D terrain | MapLibre GL JS | Pan: frames per second | 6.6 fps | 5.5–7.6 | 2 |
| 3D terrain | MapLibre GL JS | Pan: median frame gap | 87.5 ms | 60.0–115.0 | 2 |
| 3D terrain | MapLibre GL JS | Pan: 90th percentile frame gap | 441.0 ms | 372.0–510.0 | 2 |
| 3D terrain | MapLibre GL JS | Pan: worst frame gap | 547 ms | 539–554 | 2 |
| 3D terrain | This library, main thread | Load to idle | 923 ms | 827–1018 | 2 |
| 3D terrain | This library, main thread | Pan: frames per second | 44.7 fps | 43.7–45.6 | 2 |
| 3D terrain | This library, main thread | Pan: median frame gap | 19.0 ms | 18.0–20.0 | 2 |
| 3D terrain | This library, main thread | Pan: 90th percentile frame gap | 33.0 ms | 32.0–34.0 | 2 |
| 3D terrain | This library, main thread | Pan: worst frame gap | 85 ms | 68–101 | 2 |
| 3D terrain | This library, worker | Load to idle | 792 ms | 761–823 | 2 |
| 3D terrain | This library, worker | Pan: frames per second | 44.5 fps | 42.4–46.7 | 2 |
| 3D terrain | This library, worker | Pan: median frame gap | 19.0 ms | 18.0–20.0 | 2 |
| 3D terrain | This library, worker | Pan: 90th percentile frame gap | 33.0 ms | 31.0–35.0 | 2 |
| 3D terrain | This library, worker | Pan: worst frame gap | 72 ms | 70–74 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Load to idle | 1031 ms | 1002–1059 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: frames per second | 11.7 fps | 11.5–11.9 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: median frame gap | 71.5 ms | 70.0–73.0 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: 90th percentile frame gap | 132.0 ms | 118.0–146.0 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: worst frame gap | 147 ms | 127–166 | 2 |
| Pitch 85 with sky | This library, main thread | Load to idle | 1445 ms | 1421–1469 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: frames per second | 4.9 fps | 4.9–4.9 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: median frame gap | 200.5 ms | 197.0–204.0 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: 90th percentile frame gap | 231.5 ms | 224.0–239.0 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: worst frame gap | 295 ms | 279–310 | 2 |
| Pitch 85 with sky | This library, worker | Load to idle | 1478 ms | 1464–1492 | 2 |
| Pitch 85 with sky | This library, worker | Turn: frames per second | 4.9 fps | 4.8–5.1 | 2 |
| Pitch 85 with sky | This library, worker | Turn: median frame gap | 193.5 ms | 192.0–195.0 | 2 |
| Pitch 85 with sky | This library, worker | Turn: 90th percentile frame gap | 262.5 ms | 253.0–272.0 | 2 |
| Pitch 85 with sky | This library, worker | Turn: worst frame gap | 273 ms | 267–278 | 2 |
| Globe | MapLibre GL JS | Load to idle | 2075 ms | 1754–2395 | 2 |
| Globe | MapLibre GL JS | Turn: frames per second | 20.9 fps | 20.2–21.6 | 2 |
| Globe | MapLibre GL JS | Turn: median frame gap | 46.5 ms | 45.0–48.0 | 2 |
| Globe | MapLibre GL JS | Turn: 90th percentile frame gap | 53.5 ms | 52.0–55.0 | 2 |
| Globe | MapLibre GL JS | Turn: worst frame gap | 64 ms | 64–64 | 2 |
| Globe | This library, main thread | Load to idle | 496 ms | 488–503 | 2 |
| Globe | This library, main thread | Turn: frames per second | 61.8 fps | 61.4–62.1 | 2 |
| Globe | This library, main thread | Turn: median frame gap | 16.0 ms | 16.0–16.0 | 2 |
| Globe | This library, main thread | Turn: 90th percentile frame gap | 17.5 ms | 17.0–18.0 | 2 |
| Globe | This library, main thread | Turn: worst frame gap | 40 ms | 29–50 | 2 |
| Globe | This library, worker | Load to idle | 441 ms | 419–462 | 2 |
| Globe | This library, worker | Turn: frames per second | 62.2 fps | 62.2–62.2 | 2 |
| Globe | This library, worker | Turn: median frame gap | 16.0 ms | 16.0–16.0 | 2 |
| Globe | This library, worker | Turn: 90th percentile frame gap | 17.0 ms | 17.0–17.0 | 2 |
| Globe | This library, worker | Turn: worst frame gap | 26 ms | 24–27 | 2 |
| Camera | MapLibre GL JS | Static repaint: frames per second | 18.3 fps | 18.2–18.3 | 2 |
| Camera | MapLibre GL JS | Static repaint: median frame gap | 54.0 ms | 54.0–54.0 | 2 |
| Camera | MapLibre GL JS | Static repaint: 90th percentile frame gap | 57.5 ms | 57.0–58.0 | 2 |
| Camera | MapLibre GL JS | Static repaint: worst frame gap | 66 ms | 66–66 | 2 |
| Camera | MapLibre GL JS | Pan: frames per second | 16.2 fps | 16.2–16.3 | 2 |
| Camera | MapLibre GL JS | Pan: median frame gap | 57.3 ms | 57.0–57.5 | 2 |
| Camera | MapLibre GL JS | Pan: 90th percentile frame gap | 81.5 ms | 81.0–82.0 | 2 |
| Camera | MapLibre GL JS | Pan: worst frame gap | 112 ms | 108–115 | 2 |
| Camera | MapLibre GL JS | Rotation: frames per second | 15.5 fps | 15.5–15.6 | 2 |
| Camera | MapLibre GL JS | Rotation: median frame gap | 63.0 ms | 63.0–63.0 | 2 |
| Camera | MapLibre GL JS | Rotation: 90th percentile frame gap | 70.5 ms | 70.0–71.0 | 2 |
| Camera | MapLibre GL JS | Rotation: worst frame gap | 81 ms | 73–88 | 2 |
| Camera | MapLibre GL JS | Zoom: frames per second | 25.3 fps | 24.9–25.6 | 2 |
| Camera | MapLibre GL JS | Zoom: median frame gap | 30.8 ms | 29.5–32.0 | 2 |
| Camera | MapLibre GL JS | Zoom: 90th percentile frame gap | 65.5 ms | 64.0–67.0 | 2 |
| Camera | MapLibre GL JS | Zoom: worst frame gap | 94 ms | 76–111 | 2 |
| Camera | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | MapLibre GL JS | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera | This library, main thread | Static repaint: frames per second | 19.1 fps | 18.8–19.4 | 2 |
| Camera | This library, main thread | Static repaint: median frame gap | 51.5 ms | 51.0–52.0 | 2 |
| Camera | This library, main thread | Static repaint: 90th percentile frame gap | 56.5 ms | 56.0–57.0 | 2 |
| Camera | This library, main thread | Static repaint: worst frame gap | 63 ms | 61–65 | 2 |
| Camera | This library, main thread | Pan: frames per second | 14.6 fps | 14.2–15.1 | 2 |
| Camera | This library, main thread | Pan: median frame gap | 68.3 ms | 66.5–70.0 | 2 |
| Camera | This library, main thread | Pan: 90th percentile frame gap | 82.5 ms | 81.0–84.0 | 2 |
| Camera | This library, main thread | Pan: worst frame gap | 96 ms | 91–101 | 2 |
| Camera | This library, main thread | Rotation: frames per second | 12.4 fps | 11.8–13.1 | 2 |
| Camera | This library, main thread | Rotation: median frame gap | 79.8 ms | 76.0–83.5 | 2 |
| Camera | This library, main thread | Rotation: 90th percentile frame gap | 90.5 ms | 84.0–97.0 | 2 |
| Camera | This library, main thread | Rotation: worst frame gap | 97 ms | 92–102 | 2 |
| Camera | This library, main thread | Zoom: frames per second | 28.5 fps | 27.9–29.1 | 2 |
| Camera | This library, main thread | Zoom: median frame gap | 27.8 ms | 27.5–28.0 | 2 |
| Camera | This library, main thread | Zoom: 90th percentile frame gap | 59.5 ms | 57.0–62.0 | 2 |
| Camera | This library, main thread | Zoom: worst frame gap | 79 ms | 78–79 | 2 |
| Camera | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | This library, main thread | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera | This library, worker | Static repaint: frames per second | 18.7 fps | 17.8–19.7 | 2 |
| Camera | This library, worker | Static repaint: median frame gap | 52.5 ms | 50.0–55.0 | 2 |
| Camera | This library, worker | Static repaint: 90th percentile frame gap | 58.5 ms | 56.0–61.0 | 2 |
| Camera | This library, worker | Static repaint: worst frame gap | 70 ms | 62–77 | 2 |
| Camera | This library, worker | Pan: frames per second | 14.2 fps | 13.9–14.5 | 2 |
| Camera | This library, worker | Pan: median frame gap | 71.0 ms | 68.0–74.0 | 2 |
| Camera | This library, worker | Pan: 90th percentile frame gap | 84.0 ms | 84.0–84.0 | 2 |
| Camera | This library, worker | Pan: worst frame gap | 92 ms | 90–94 | 2 |
| Camera | This library, worker | Rotation: frames per second | 12.1 fps | 11.6–12.5 | 2 |
| Camera | This library, worker | Rotation: median frame gap | 82.3 ms | 78.5–86.0 | 2 |
| Camera | This library, worker | Rotation: 90th percentile frame gap | 95.5 ms | 94.0–97.0 | 2 |
| Camera | This library, worker | Rotation: worst frame gap | 98 ms | 97–99 | 2 |
| Camera | This library, worker | Zoom: frames per second | 29.2 fps | 28.3–30.1 | 2 |
| Camera | This library, worker | Zoom: median frame gap | 27.5 ms | 26.0–29.0 | 2 |
| Camera | This library, worker | Zoom: 90th percentile frame gap | 54.5 ms | 53.0–56.0 | 2 |
| Camera | This library, worker | Zoom: worst frame gap | 83 ms | 80–86 | 2 |
| Camera | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | This library, worker | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: frames per second | 11.2 fps | 11.1–11.4 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: median frame gap | 88.0 ms | 87.0–89.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 97.5 ms | 96.0–99.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: worst frame gap | 101 ms | 100–101 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: frames per second | 9.6 fps | 9.4–9.9 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: median frame gap | 98.8 ms | 95.0–102.5 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: 90th percentile frame gap | 137.5 ms | 135.0–140.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: worst frame gap | 150 ms | 144–155 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: frames per second | 10.1 fps | 10.1–10.2 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: median frame gap | 98.0 ms | 98.0–98.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: 90th percentile frame gap | 108.5 ms | 107.0–110.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: worst frame gap | 114 ms | 114–114 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: frames per second | 14.3 fps | 14.3–14.3 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: median frame gap | 54.0 ms | 54.0–54.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: 90th percentile frame gap | 105.5 ms | 104.0–107.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: worst frame gap | 144 ms | 127–161 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: frames per second | 13.2 fps | 12.9–13.5 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: median frame gap | 73.0 ms | 73.0–73.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: 90th percentile frame gap | 82.5 ms | 77.0–88.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: worst frame gap | 114 ms | 94–134 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: frames per second | 9.8 fps | 9.6–10.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: median frame gap | 92.3 ms | 89.0–95.5 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: 90th percentile frame gap | 135.5 ms | 135.0–136.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: worst frame gap | 171 ms | 158–184 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: frames per second | 10.1 fps | 9.8–10.3 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: median frame gap | 98.3 ms | 95.5–101.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: 90th percentile frame gap | 106.5 ms | 105.0–108.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: worst frame gap | 117 ms | 111–122 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: frames per second | 19.0 fps | 18.8–19.2 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: median frame gap | 43.5 ms | 43.0–44.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: 90th percentile frame gap | 77.0 ms | 76.0–78.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: worst frame gap | 111 ms | 111–111 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: frames per second | 13.7 fps | 13.6–13.8 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: median frame gap | 72.5 ms | 72.0–73.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: 90th percentile frame gap | 80.0 ms | 74.0–86.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: worst frame gap | 83 ms | 75–90 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: frames per second | 10.7 fps | 10.7–10.8 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: median frame gap | 87.5 ms | 87.0–88.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: 90th percentile frame gap | 121.0 ms | 119.0–123.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: worst frame gap | 145 ms | 131–159 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: frames per second | 10.5 fps | 10.4–10.5 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: median frame gap | 95.3 ms | 94.0–96.5 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: 90th percentile frame gap | 104.5 ms | 102.0–107.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: worst frame gap | 112 ms | 108–115 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: frames per second | 19.2 fps | 19.2–19.3 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: median frame gap | 43.8 ms | 43.0–44.5 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: 90th percentile frame gap | 77.5 ms | 75.0–80.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: worst frame gap | 110 ms | 106–113 | 2 |
| Camera at pixel ratio 2 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: frames per second | 8.0 fps | 7.9–8.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: median frame gap | 124.5 ms | 124.0–125.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 142.5 ms | 142.0–143.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: worst frame gap | 153 ms | 146–160 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: frames per second | 6.9 fps | 6.8–7.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: median frame gap | 130.0 ms | 127.0–133.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: 90th percentile frame gap | 207.0 ms | 199.0–215.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: worst frame gap | 230 ms | 230–230 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: frames per second | 7.1 fps | 7.0–7.2 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: median frame gap | 138.0 ms | 138.0–138.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: 90th percentile frame gap | 152.0 ms | 144.0–160.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: worst frame gap | 171 ms | 145–196 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: frames per second | 9.3 fps | 9.2–9.4 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: median frame gap | 84.5 ms | 84.0–85.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: 90th percentile frame gap | 184.5 ms | 180.0–189.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: worst frame gap | 192 ms | 185–199 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: frames per second | 9.3 fps | 9.2–9.3 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: median frame gap | 107.3 ms | 106.5–108.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: 90th percentile frame gap | 112.0 ms | 111.0–113.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: worst frame gap | 136 ms | 133–138 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: frames per second | 7.5 fps | 7.5–7.5 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: median frame gap | 124.5 ms | 124.0–125.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: 90th percentile frame gap | 202.0 ms | 196.0–208.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: worst frame gap | 210 ms | 208–211 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: frames per second | 7.4 fps | 7.3–7.5 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: median frame gap | 134.0 ms | 133.0–135.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: 90th percentile frame gap | 148.5 ms | 141.0–156.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: worst frame gap | 158 ms | 147–168 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: frames per second | 13.1 fps | 13.0–13.2 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: median frame gap | 64.5 ms | 64.0–65.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: 90th percentile frame gap | 116.5 ms | 114.0–119.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: worst frame gap | 158 ms | 157–158 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: frames per second | 9.3 fps | 9.1–9.4 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: median frame gap | 107.0 ms | 106.0–108.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: 90th percentile frame gap | 136.0 ms | 133.0–139.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: worst frame gap | 141 ms | 139–142 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: frames per second | 7.4 fps | 7.3–7.4 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: median frame gap | 128.0 ms | 126.0–130.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: 90th percentile frame gap | 199.0 ms | 187.0–211.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: worst frame gap | 208 ms | 197–218 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: frames per second | 7.1 fps | 7.0–7.3 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: median frame gap | 138.3 ms | 136.0–140.5 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: 90th percentile frame gap | 160.0 ms | 156.0–164.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: worst frame gap | 171 ms | 166–176 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: frames per second | 12.8 fps | 12.8–12.9 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: median frame gap | 66.5 ms | 66.0–67.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: 90th percentile frame gap | 119.5 ms | 118.0–121.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: worst frame gap | 160 ms | 160–160 | 2 |
| Camera at pixel ratio 3 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| 1,000 markers | MapLibre GL JS | Add the markers | 60 ms | 59–60 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: frames per second | 17.2 fps | 16.6–17.8 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 85.5 ms | 82.0–89.0 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: worst frame gap | 123 ms | 119–127 | 2 |
| 1,000 markers | This library, main thread | Add the markers | 3 ms | 2–3 | 2 |
| 1,000 markers | This library, main thread | Pan: frames per second | 20.6 fps | 20.1–21.1 | 2 |
| 1,000 markers | This library, main thread | Pan: 90th percentile frame gap | 64.5 ms | 60.0–69.0 | 2 |
| 1,000 markers | This library, main thread | Pan: worst frame gap | 93 ms | 86–99 | 2 |
| 1,000 markers | This library, worker | Add the markers | 1 ms | 0–1 | 2 |
| 1,000 markers | This library, worker | Pan: frames per second | 21.9 fps | 21.3–22.4 | 2 |
| 1,000 markers | This library, worker | Pan: 90th percentile frame gap | 60.0 ms | 59.0–61.0 | 2 |
| 1,000 markers | This library, worker | Pan: worst frame gap | 79 ms | 79–79 | 2 |
| 10,000 markers | MapLibre GL JS | Add the markers | 528 ms | 528–528 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: frames per second | 3.4 fps | 3.4–3.4 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 379.5 ms | 374.0–385.0 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: worst frame gap | 389 ms | 377–401 | 2 |
| 10,000 markers | This library, main thread | Add the markers | 2 ms | 2–2 | 2 |
| 10,000 markers | This library, main thread | Pan: frames per second | 20.7 fps | 20.4–21.1 | 2 |
| 10,000 markers | This library, main thread | Pan: 90th percentile frame gap | 68.0 ms | 64.0–72.0 | 2 |
| 10,000 markers | This library, main thread | Pan: worst frame gap | 88 ms | 86–90 | 2 |
| 10,000 markers | This library, worker | Add the markers | 1 ms | 1–1 | 2 |
| 10,000 markers | This library, worker | Pan: frames per second | 21.1 fps | 20.7–21.4 | 2 |
| 10,000 markers | This library, worker | Pan: 90th percentile frame gap | 62.5 ms | 61.0–64.0 | 2 |
| 10,000 markers | This library, worker | Pan: worst frame gap | 84 ms | 80–87 | 2 |
| GeoJSON setData | MapLibre GL JS | addSource to idle | 368 ms | 317–418 | 2 |
| GeoJSON setData | MapLibre GL JS | Frames per second during the updates | 11.2 fps | 11.1–11.4 | 2 |
| GeoJSON setData | MapLibre GL JS | setData calls per second | 12.1 /s | 12.1–12.1 | 2 |
| GeoJSON setData | MapLibre GL JS | Worst frame gap | 118 ms | 104–131 | 2 |
| GeoJSON setData | MapLibre GL JS | Last setData to idle | 178 ms | 175–180 | 2 |
| GeoJSON setData | This library, main thread | addSource to idle | 244 ms | 239–248 | 2 |
| GeoJSON setData | This library, main thread | Frames per second during the updates | 13.8 fps | 13.6–14.0 | 2 |
| GeoJSON setData | This library, main thread | setData calls per second | 14.4 /s | 14.2–14.6 | 2 |
| GeoJSON setData | This library, main thread | Worst frame gap | 98 ms | 96–99 | 2 |
| GeoJSON setData | This library, main thread | Last setData to idle | 260 ms | 256–263 | 2 |
| GeoJSON setData | This library, worker | addSource to idle | 319 ms | 247–390 | 2 |
| GeoJSON setData | This library, worker | Frames per second during the updates | 14.1 fps | 13.8–14.4 | 2 |
| GeoJSON setData | This library, worker | setData calls per second | 15.2 /s | 15.0–15.4 | 2 |
| GeoJSON setData | This library, worker | Worst frame gap | 121 ms | 101–141 | 2 |
| GeoJSON setData | This library, worker | Last setData to idle | 221 ms | 220–222 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty, one per frame: first call to idle | 5843 ms | 5794–5892 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: the calls | 0.5 ms | 0.0–1.0 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: first call to idle | 393 ms | 376–409 | 2 |
| Run-time edits | MapLibre GL JS | 30 hover steps of setFeatureState, one per frame: first step to idle | 1643 ms | 1628–1658 | 2 |
| Run-time edits | MapLibre GL JS | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 115 ms | 112–118 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty, one per frame: first call to idle | 6226 ms | 6030–6422 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: the calls | 0.0 ms | 0.0–0.0 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: first call to idle | 378 ms | 355–400 | 2 |
| Run-time edits | This library, main thread | 30 hover steps of setFeatureState, one per frame: first step to idle | 1874 ms | 1809–1939 | 2 |
| Run-time edits | This library, main thread | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 61 ms | 58–64 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty, one per frame: first call to idle | 6215 ms | 6077–6352 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: the calls | 0.0 ms | 0.0–0.0 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: first call to idle | 368 ms | 363–372 | 2 |
| Run-time edits | This library, worker | 30 hover steps of setFeatureState, one per frame: first step to idle | 1932 ms | 1899–1965 | 2 |
| Run-time edits | This library, worker | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 60 ms | 58–61 | 2 |
| Images | MapLibre GL JS | addImage and the icon layer: to idle | 752 ms | 730–773 | 2 |
| Images | MapLibre GL JS | 500 × updateImage, one per frame: first call to idle | 27358 ms | 27056–27660 | 2 |
| Images | MapLibre GL JS | Frames per second during the updates | 18.3 fps | 18.1–18.5 | 2 |
| Images | MapLibre GL JS | Worst frame gap during the updates | 92 ms | 79–105 | 2 |
| Images | MapLibre GL JS | 500 × updateImage in one task: the calls | 0.5 ms | 0.0–1.0 | 2 |
| Images | MapLibre GL JS | 500 × updateImage in one task: first call to idle | 50 ms | 45–54 | 2 |
| Images | This library, main thread | addImage and the icon layer: to idle | 390 ms | 359–421 | 2 |
| Images | This library, main thread | 500 × updateImage, one per frame: first call to idle | 25473 ms | 25425–25521 | 2 |
| Images | This library, main thread | Frames per second during the updates | 19.6 fps | 19.6–19.7 | 2 |
| Images | This library, main thread | Worst frame gap during the updates | 71 ms | 70–72 | 2 |
| Images | This library, main thread | 500 × updateImage in one task: the calls | 0.0 ms | 0.0–0.0 | 2 |
| Images | This library, main thread | 500 × updateImage in one task: first call to idle | 57 ms | 49–64 | 2 |
| Images | This library, worker | addImage and the icon layer: to idle | 371 ms | 347–394 | 2 |
| Images | This library, worker | 500 × updateImage, one per frame: first call to idle | 28716 ms | 28540–28891 | 2 |
| Images | This library, worker | Frames per second during the updates | 17.4 fps | 17.3–17.5 | 2 |
| Images | This library, worker | Worst frame gap during the updates | 88 ms | 86–89 | 2 |
| Images | This library, worker | 500 × updateImage in one task: the calls | 0.0 ms | 0.0–0.0 | 2 |
| Images | This library, worker | 500 × updateImage in one task: first call to idle | 55 ms | 54–56 | 2 |
| Lifecycle | MapLibre GL JS | Create to idle, median of 8 | 712 ms | 703–722 | 2 |
| Lifecycle | MapLibre GL JS | remove(), median of 8 | 6.3 ms | 5.5–7.0 | 2 |
| Lifecycle | MapLibre GL JS | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: create both to both idle | 1045 ms | 1017–1072 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: frames per second of each in a pan | 11.4 fps | 11.0–11.8 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: worst frame gap | 121 ms | 115–126 | 2 |
| Lifecycle | This library, main thread | Create to idle, median of 8 | 539 ms | 535–544 | 2 |
| Lifecycle | This library, main thread | remove(), median of 8 | 1.0 ms | 1.0–1.0 | 2 |
| Lifecycle | This library, main thread | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | This library, main thread | Two maps: create both to both idle | 847 ms | 831–863 | 2 |
| Lifecycle | This library, main thread | Two maps: frames per second of each in a pan | 11.4 fps | 11.2–11.6 | 2 |
| Lifecycle | This library, main thread | Two maps: worst frame gap | 135 ms | 133–136 | 2 |
| Lifecycle | This library, worker | Create to idle, median of 8 | 538 ms | 532–543 | 2 |
| Lifecycle | This library, worker | remove(), median of 8 | 1.0 ms | 1.0–1.0 | 2 |
| Lifecycle | This library, worker | Workers started by the 8 maps and not ended | -8 | -8–-8 | 2 |
| Lifecycle | This library, worker | Two maps: create both to both idle | 874 ms | 866–881 | 2 |
| Lifecycle | This library, worker | Two maps: frames per second of each in a pan | 11.1 fps | 10.9–11.4 | 2 |
| Lifecycle | This library, worker | Two maps: worst frame gap | 140 ms | 136–143 | 2 |
| Cold start | MapLibre GL JS | First tile request | 541 ms | 532–557 | 5 |
| Cold start | MapLibre GL JS | First frame | 448 ms | 429–474 | 5 |
| Cold start | MapLibre GL JS | Idle | 1317 ms | 1294–1332 | 5 |
| Cold start | MapLibre GL JS | Requests before idle (the page, and the workers of this library) | 8 | 8–8 | 5 |
| Cold start | MapLibre GL JS | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
| Cold start | This library, main thread | First tile request | 523 ms | 513–552 | 5 |
| Cold start | This library, main thread | First frame | 552 ms | 542–581 | 5 |
| Cold start | This library, main thread | Idle | 1167 ms | 1136–1213 | 5 |
| Cold start | This library, main thread | Requests before idle (the page, and the workers of this library) | 16 | 16–16 | 5 |
| Cold start | This library, main thread | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
| Cold start | This library, worker | First tile request | n/a ms |  | 0 |
| Cold start | This library, worker | First frame | 752 ms | 737–763 | 5 |
| Cold start | This library, worker | Idle | 1355 ms | 1303–1403 | 5 |
| Cold start | This library, worker | Requests before idle (the page, and the workers of this library) | 16 | 16–16 | 5 |
| Cold start | This library, worker | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
### win32-chromium (chromium 159.0.8154.6)

win32 10.0.26100 x64, AMD EPYC 9V45 96-Core Processor                

GPU: ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11) · screen pixel ratio 1 · map-jr-gl 0.9.0, commit unknown · MapLibre GL JS 6.17.0 · AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/159.0.8154.6 Safari/537.36

Runs of the page: 2 in 13.5 min.

- worker: loaded, renderer worker, 8 features at the centre, terrain on (centre 10 m)
- main: loaded, renderer main, 8 features at the centre, terrain on (centre 10 m)

| Scenario | Library | Measure | Median | Range | Runs |
|---|---|---|---|---|---|
| Load to idle | MapLibre GL JS | Load to idle | 759 ms | 740–779 | 2 |
| Load to idle | MapLibre GL JS | First frame | 98 ms | 65–130 | 2 |
| Load to idle | MapLibre GL JS | load event | 728 ms | 724–733 | 2 |
| Load to idle | This library, main thread | Load to idle | 529 ms | 478–579 | 2 |
| Load to idle | This library, main thread | First frame | 51 ms | 44–58 | 2 |
| Load to idle | This library, main thread | load event | 528 ms | 478–579 | 2 |
| Load to idle | This library, worker | Load to idle | 540 ms | 407–673 | 2 |
| Load to idle | This library, worker | First frame | 48 ms | 43–54 | 2 |
| Load to idle | This library, worker | load event | 540 ms | 407–673 | 2 |
| 3D terrain | MapLibre GL JS | Load to idle | 5349 ms | 4268–6430 | 2 |
| 3D terrain | MapLibre GL JS | Pan: frames per second | 10.5 fps | 9.6–11.4 | 2 |
| 3D terrain | MapLibre GL JS | Pan: median frame gap | 62.5 ms | 61.2–63.9 | 2 |
| 3D terrain | MapLibre GL JS | Pan: 90th percentile frame gap | 197.9 ms | 173.9–221.9 | 2 |
| 3D terrain | MapLibre GL JS | Pan: worst frame gap | 497 ms | 453–541 | 2 |
| 3D terrain | This library, main thread | Load to idle | 3663 ms | 621–6706 | 2 |
| 3D terrain | This library, main thread | Pan: frames per second | 35.8 fps | 35.0–36.5 | 2 |
| 3D terrain | This library, main thread | Pan: median frame gap | 27.1 ms | 26.9–27.3 | 2 |
| 3D terrain | This library, main thread | Pan: 90th percentile frame gap | 42.8 ms | 38.8–46.8 | 2 |
| 3D terrain | This library, main thread | Pan: worst frame gap | 71 ms | 69–72 | 2 |
| 3D terrain | This library, worker | Load to idle | 6782 ms | 976–12588 | 2 |
| 3D terrain | This library, worker | Pan: frames per second | 35.8 fps | 35.0–36.5 | 2 |
| 3D terrain | This library, worker | Pan: median frame gap | 26.0 ms | 25.7–26.4 | 2 |
| 3D terrain | This library, worker | Pan: 90th percentile frame gap | 44.8 ms | 43.6–45.9 | 2 |
| 3D terrain | This library, worker | Pan: worst frame gap | 186 ms | 176–196 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Load to idle | 972 ms | 722–1223 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: frames per second | 30.8 fps | 30.6–31.0 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: median frame gap | 30.1 ms | 29.7–30.6 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: 90th percentile frame gap | 48.9 ms | 44.4–53.4 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: worst frame gap | 189 ms | 77–302 | 2 |
| Pitch 85 with sky | This library, main thread | Load to idle | 3372 ms | 2781–3962 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: frames per second | 8.3 fps | 8.2–8.4 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: median frame gap | 111.2 ms | 106.6–115.8 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: 90th percentile frame gap | 175.9 ms | 162.3–189.4 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: worst frame gap | 298 ms | 271–326 | 2 |
| Pitch 85 with sky | This library, worker | Load to idle | 3903 ms | 2699–5106 | 2 |
| Pitch 85 with sky | This library, worker | Turn: frames per second | 8.1 fps | 7.6–8.5 | 2 |
| Pitch 85 with sky | This library, worker | Turn: median frame gap | 106.7 ms | 97.0–116.4 | 2 |
| Pitch 85 with sky | This library, worker | Turn: 90th percentile frame gap | 229.5 ms | 204.0–254.9 | 2 |
| Pitch 85 with sky | This library, worker | Turn: worst frame gap | 300 ms | 267–333 | 2 |
| Globe | MapLibre GL JS | Load to idle | 1826 ms | 1667–1985 | 2 |
| Globe | MapLibre GL JS | Turn: frames per second | 29.7 fps | 29.4–30.0 | 2 |
| Globe | MapLibre GL JS | Turn: median frame gap | 33.2 ms | 33.2–33.3 | 2 |
| Globe | MapLibre GL JS | Turn: 90th percentile frame gap | 47.2 ms | 42.6–51.8 | 2 |
| Globe | MapLibre GL JS | Turn: worst frame gap | 59 ms | 57–61 | 2 |
| Globe | This library, main thread | Load to idle | 445 ms | 410–480 | 2 |
| Globe | This library, main thread | Turn: frames per second | 60.2 fps | 60.1–60.2 | 2 |
| Globe | This library, main thread | Turn: median frame gap | 16.6 ms | 16.6–16.6 | 2 |
| Globe | This library, main thread | Turn: 90th percentile frame gap | 17.6 ms | 17.5–17.6 | 2 |
| Globe | This library, main thread | Turn: worst frame gap | 22 ms | 21–23 | 2 |
| Globe | This library, worker | Load to idle | 360 ms | 353–367 | 2 |
| Globe | This library, worker | Turn: frames per second | 60.0 fps | 60.0–60.1 | 2 |
| Globe | This library, worker | Turn: median frame gap | 16.6 ms | 16.5–16.7 | 2 |
| Globe | This library, worker | Turn: 90th percentile frame gap | 17.6 ms | 17.5–17.6 | 2 |
| Globe | This library, worker | Turn: worst frame gap | 23 ms | 21–25 | 2 |
| Camera | MapLibre GL JS | Static repaint: frames per second | 25.6 fps | 25.2–26.1 | 2 |
| Camera | MapLibre GL JS | Static repaint: median frame gap | 37.6 ms | 36.8–38.3 | 2 |
| Camera | MapLibre GL JS | Static repaint: 90th percentile frame gap | 53.9 ms | 51.4–56.4 | 2 |
| Camera | MapLibre GL JS | Static repaint: worst frame gap | 90 ms | 90–90 | 2 |
| Camera | MapLibre GL JS | Pan: frames per second | 31.1 fps | 30.2–32.0 | 2 |
| Camera | MapLibre GL JS | Pan: median frame gap | 29.0 ms | 28.3–29.6 | 2 |
| Camera | MapLibre GL JS | Pan: 90th percentile frame gap | 49.5 ms | 46.8–52.2 | 2 |
| Camera | MapLibre GL JS | Pan: worst frame gap | 65 ms | 58–71 | 2 |
| Camera | MapLibre GL JS | Rotation: frames per second | 23.8 fps | 22.9–24.7 | 2 |
| Camera | MapLibre GL JS | Rotation: median frame gap | 41.6 ms | 41.3–42.0 | 2 |
| Camera | MapLibre GL JS | Rotation: 90th percentile frame gap | 60.5 ms | 60.5–60.5 | 2 |
| Camera | MapLibre GL JS | Rotation: worst frame gap | 71 ms | 69–74 | 2 |
| Camera | MapLibre GL JS | Zoom: frames per second | 46.9 fps | 46.5–47.4 | 2 |
| Camera | MapLibre GL JS | Zoom: median frame gap | 17.9 ms | 17.7–18.1 | 2 |
| Camera | MapLibre GL JS | Zoom: 90th percentile frame gap | 29.2 ms | 28.9–29.5 | 2 |
| Camera | MapLibre GL JS | Zoom: worst frame gap | 78 ms | 70–86 | 2 |
| Camera | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 392 ms | 379–404 | 2 |
| Camera | MapLibre GL JS | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera | This library, main thread | Static repaint: frames per second | 27.7 fps | 26.0–29.4 | 2 |
| Camera | This library, main thread | Static repaint: median frame gap | 33.5 ms | 33.3–33.7 | 2 |
| Camera | This library, main thread | Static repaint: 90th percentile frame gap | 53.0 ms | 45.5–60.4 | 2 |
| Camera | This library, main thread | Static repaint: worst frame gap | 90 ms | 72–108 | 2 |
| Camera | This library, main thread | Pan: frames per second | 21.4 fps | 21.2–21.7 | 2 |
| Camera | This library, main thread | Pan: median frame gap | 30.9 ms | 29.5–32.2 | 2 |
| Camera | This library, main thread | Pan: 90th percentile frame gap | 90.5 ms | 88.0–92.9 | 2 |
| Camera | This library, main thread | Pan: worst frame gap | 238 ms | 168–309 | 2 |
| Camera | This library, main thread | Rotation: frames per second | 18.4 fps | 18.4–18.5 | 2 |
| Camera | This library, main thread | Rotation: median frame gap | 37.2 ms | 34.5–39.8 | 2 |
| Camera | This library, main thread | Rotation: 90th percentile frame gap | 99.8 ms | 89.0–110.7 | 2 |
| Camera | This library, main thread | Rotation: worst frame gap | 205 ms | 203–208 | 2 |
| Camera | This library, main thread | Zoom: frames per second | 37.8 fps | 37.6–37.9 | 2 |
| Camera | This library, main thread | Zoom: median frame gap | 19.2 ms | 18.0–20.3 | 2 |
| Camera | This library, main thread | Zoom: 90th percentile frame gap | 40.9 ms | 37.6–44.3 | 2 |
| Camera | This library, main thread | Zoom: worst frame gap | 234 ms | 233–235 | 2 |
| Camera | This library, main thread | Main thread blocked (long tasks) in the pan | 1259 ms | 1256–1261 | 2 |
| Camera | This library, main thread | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera | This library, worker | Static repaint: frames per second | 27.9 fps | 27.3–28.5 | 2 |
| Camera | This library, worker | Static repaint: median frame gap | 35.3 ms | 35.3–35.3 | 2 |
| Camera | This library, worker | Static repaint: 90th percentile frame gap | 48.8 ms | 46.6–50.9 | 2 |
| Camera | This library, worker | Static repaint: worst frame gap | 76 ms | 70–82 | 2 |
| Camera | This library, worker | Pan: frames per second | 20.1 fps | 18.5–21.7 | 2 |
| Camera | This library, worker | Pan: median frame gap | 32.8 ms | 32.2–33.4 | 2 |
| Camera | This library, worker | Pan: 90th percentile frame gap | 118.6 ms | 92.3–144.9 | 2 |
| Camera | This library, worker | Pan: worst frame gap | 242 ms | 239–245 | 2 |
| Camera | This library, worker | Rotation: frames per second | 19.0 fps | 18.9–19.0 | 2 |
| Camera | This library, worker | Rotation: median frame gap | 34.9 ms | 34.3–35.4 | 2 |
| Camera | This library, worker | Rotation: 90th percentile frame gap | 127.4 ms | 117.3–137.5 | 2 |
| Camera | This library, worker | Rotation: worst frame gap | 200 ms | 169–230 | 2 |
| Camera | This library, worker | Zoom: frames per second | 39.4 fps | 39.2–39.6 | 2 |
| Camera | This library, worker | Zoom: median frame gap | 17.9 ms | 16.9–18.8 | 2 |
| Camera | This library, worker | Zoom: 90th percentile frame gap | 45.9 ms | 39.9–52.0 | 2 |
| Camera | This library, worker | Zoom: worst frame gap | 391 ms | 221–561 | 2 |
| Camera | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | This library, worker | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: frames per second | 16.7 fps | 16.6–16.8 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: median frame gap | 57.6 ms | 56.9–58.4 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 95.8 ms | 93.2–98.3 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: worst frame gap | 110 ms | 103–118 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: frames per second | 20.5 fps | 20.3–20.7 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: median frame gap | 43.3 ms | 43.2–43.3 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: 90th percentile frame gap | 86.3 ms | 85.1–87.5 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: worst frame gap | 106 ms | 103–110 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: frames per second | 15.0 fps | 14.1–15.8 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: median frame gap | 64.4 ms | 61.2–67.6 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: 90th percentile frame gap | 94.3 ms | 88.7–99.9 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: worst frame gap | 185 ms | 165–205 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: frames per second | 27.8 fps | 27.7–27.9 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: median frame gap | 31.6 ms | 31.5–31.6 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: 90th percentile frame gap | 58.4 ms | 57.6–59.2 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: worst frame gap | 90 ms | 81–99 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 1377 ms | 1326–1428 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: frames per second | 20.4 fps | 20.3–20.4 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: median frame gap | 49.2 ms | 47.3–51.2 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: 90th percentile frame gap | 68.0 ms | 65.3–70.7 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: worst frame gap | 97 ms | 77–117 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: frames per second | 14.5 fps | 13.9–15.1 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: median frame gap | 37.6 ms | 35.4–39.8 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: 90th percentile frame gap | 154.2 ms | 144.8–163.6 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: worst frame gap | 391 ms | 277–505 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: frames per second | 13.6 fps | 13.4–13.8 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: median frame gap | 49.0 ms | 47.3–50.8 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: 90th percentile frame gap | 154.4 ms | 145.7–163.2 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: worst frame gap | 371 ms | 334–407 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: frames per second | 23.6 fps | 22.3–24.9 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: median frame gap | 31.6 ms | 28.7–34.6 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: 90th percentile frame gap | 79.2 ms | 78.6–79.8 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: worst frame gap | 248 ms | 97–399 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Main thread blocked (long tasks) in the pan | 1166 ms | 1063–1268 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: frames per second | 19.1 fps | 18.4–19.9 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: median frame gap | 48.7 ms | 47.8–49.6 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: 90th percentile frame gap | 71.8 ms | 70.5–73.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: worst frame gap | 164 ms | 84–243 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: frames per second | 16.6 fps | 13.0–20.2 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: median frame gap | 39.9 ms | 35.6–44.2 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: 90th percentile frame gap | 127.3 ms | 94.3–160.2 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: worst frame gap | 300 ms | 213–388 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: frames per second | 14.4 fps | 14.1–14.6 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: median frame gap | 45.6 ms | 39.9–51.3 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: 90th percentile frame gap | 165.0 ms | 152.9–177.2 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: worst frame gap | 266 ms | 172–360 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: frames per second | 22.7 fps | 21.3–24.2 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: median frame gap | 28.3 ms | 26.6–30.1 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: 90th percentile frame gap | 85.7 ms | 76.7–94.7 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: worst frame gap | 306 ms | 283–329 | 2 |
| Camera at pixel ratio 2 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: frames per second | 15.2 fps | 15.2–15.3 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: median frame gap | 65.6 ms | 64.4–66.8 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 94.4 ms | 94.1–94.8 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: worst frame gap | 134 ms | 134–135 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: frames per second | 9.4 fps | 9.0–9.8 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: median frame gap | 84.8 ms | 76.2–93.3 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: 90th percentile frame gap | 193.1 ms | 122.7–263.4 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: worst frame gap | 608 ms | 413–803 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: frames per second | 10.3 fps | 9.8–10.8 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: median frame gap | 84.0 ms | 79.2–88.8 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: 90th percentile frame gap | 140.6 ms | 130.4–150.9 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: worst frame gap | 374 ms | 297–451 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: frames per second | 15.8 fps | 15.1–16.5 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: median frame gap | 49.0 ms | 48.5–49.5 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: 90th percentile frame gap | 97.5 ms | 82.6–112.4 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: worst frame gap | 414 ms | 345–484 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 868 ms | 663–1073 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: frames per second | 15.0 fps | 15.0–15.1 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: median frame gap | 70.6 ms | 56.4–84.8 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: 90th percentile frame gap | 101.2 ms | 99.0–103.3 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: worst frame gap | 177 ms | 142–211 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: frames per second | 8.2 fps | 8.0–8.4 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: median frame gap | 65.3 ms | 53.4–77.2 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: 90th percentile frame gap | 478.1 ms | 456.0–500.3 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: worst frame gap | 572 ms | 510–634 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: frames per second | 10.1 fps | 9.6–10.7 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: median frame gap | 61.4 ms | 51.8–70.9 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: 90th percentile frame gap | 256.4 ms | 200.9–311.9 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: worst frame gap | 362 ms | 251–473 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: frames per second | 14.8 fps | 13.9–15.6 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: median frame gap | 36.3 ms | 32.2–40.3 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: 90th percentile frame gap | 125.3 ms | 122.0–128.5 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: worst frame gap | 505 ms | 363–647 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Main thread blocked (long tasks) in the pan | 652 ms | 463–841 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: frames per second | 14.2 fps | 14.0–14.3 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: median frame gap | 78.2 ms | 70.6–85.8 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: 90th percentile frame gap | 103.0 ms | 100.2–105.9 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: worst frame gap | 151 ms | 126–175 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: frames per second | 8.6 fps | 8.3–8.8 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: median frame gap | 39.1 ms | 26.8–51.4 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: 90th percentile frame gap | 346.4 ms | 219.0–473.8 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: worst frame gap | 706 ms | 669–744 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: frames per second | 9.7 fps | 9.0–10.4 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: median frame gap | 56.6 ms | 26.8–86.3 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: 90th percentile frame gap | 249.8 ms | 189.7–309.8 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: worst frame gap | 536 ms | 262–810 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: frames per second | 16.8 fps | 15.5–18.1 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: median frame gap | 36.2 ms | 31.3–41.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: 90th percentile frame gap | 121.6 ms | 75.8–167.3 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: worst frame gap | 387 ms | 381–393 | 2 |
| Camera at pixel ratio 3 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| 1,000 markers | MapLibre GL JS | Add the markers | 41 ms | 39–43 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: frames per second | 21.0 fps | 20.8–21.2 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 67.5 ms | 62.6–72.3 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: worst frame gap | 87 ms | 85–90 | 2 |
| 1,000 markers | This library, main thread | Add the markers | 8 ms | 2–14 | 2 |
| 1,000 markers | This library, main thread | Pan: frames per second | 30.6 fps | 30.6–30.6 | 2 |
| 1,000 markers | This library, main thread | Pan: 90th percentile frame gap | 53.3 ms | 51.6–55.0 | 2 |
| 1,000 markers | This library, main thread | Pan: worst frame gap | 113 ms | 100–126 | 2 |
| 1,000 markers | This library, worker | Add the markers | 7 ms | 1–14 | 2 |
| 1,000 markers | This library, worker | Pan: frames per second | 35.7 fps | 30.0–41.5 | 2 |
| 1,000 markers | This library, worker | Pan: 90th percentile frame gap | 47.3 ms | 41.0–53.5 | 2 |
| 1,000 markers | This library, worker | Pan: worst frame gap | 184 ms | 95–273 | 2 |
| 10,000 markers | MapLibre GL JS | Add the markers | 262 ms | 241–283 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: frames per second | 3.4 fps | 3.3–3.5 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 382.6 ms | 381.0–384.3 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: worst frame gap | 391 ms | 382–401 | 2 |
| 10,000 markers | This library, main thread | Add the markers | 4 ms | 1–6 | 2 |
| 10,000 markers | This library, main thread | Pan: frames per second | 34.2 fps | 33.4–35.0 | 2 |
| 10,000 markers | This library, main thread | Pan: 90th percentile frame gap | 47.3 ms | 45.4–49.1 | 2 |
| 10,000 markers | This library, main thread | Pan: worst frame gap | 138 ms | 137–140 | 2 |
| 10,000 markers | This library, worker | Add the markers | 9 ms | 8–10 | 2 |
| 10,000 markers | This library, worker | Pan: frames per second | 43.9 fps | 41.8–45.9 | 2 |
| 10,000 markers | This library, worker | Pan: 90th percentile frame gap | 38.0 ms | 35.5–40.6 | 2 |
| 10,000 markers | This library, worker | Pan: worst frame gap | 89 ms | 84–94 | 2 |
| GeoJSON setData | MapLibre GL JS | addSource to idle | 555 ms | 535–575 | 2 |
| GeoJSON setData | MapLibre GL JS | Frames per second during the updates | 17.9 fps | 17.7–18.1 | 2 |
| GeoJSON setData | MapLibre GL JS | setData calls per second | 56.7 /s | 56.7–56.7 | 2 |
| GeoJSON setData | MapLibre GL JS | Worst frame gap | 93 ms | 89–97 | 2 |
| GeoJSON setData | MapLibre GL JS | Last setData to idle | 640 ms | 618–662 | 2 |
| GeoJSON setData | This library, main thread | addSource to idle | 408 ms | 404–412 | 2 |
| GeoJSON setData | This library, main thread | Frames per second during the updates | 19.8 fps | 19.3–20.4 | 2 |
| GeoJSON setData | This library, main thread | setData calls per second | 44.0 /s | 42.5–45.4 | 2 |
| GeoJSON setData | This library, main thread | Worst frame gap | 89 ms | 88–91 | 2 |
| GeoJSON setData | This library, main thread | Last setData to idle | 621 ms | 464–777 | 2 |
| GeoJSON setData | This library, worker | addSource to idle | 746 ms | 678–815 | 2 |
| GeoJSON setData | This library, worker | Frames per second during the updates | 19.3 fps | 19.1–19.6 | 2 |
| GeoJSON setData | This library, worker | setData calls per second | 57.7 /s | 56.3–59.2 | 2 |
| GeoJSON setData | This library, worker | Worst frame gap | 145 ms | 106–183 | 2 |
| GeoJSON setData | This library, worker | Last setData to idle | 394 ms | 360–429 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty, one per frame: first call to idle | 4260 ms | 4257–4263 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: the calls | 4.5 ms | 1.6–7.5 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: first call to idle | 369 ms | 357–382 | 2 |
| Run-time edits | MapLibre GL JS | 30 hover steps of setFeatureState, one per frame: first step to idle | 1206 ms | 1179–1233 | 2 |
| Run-time edits | MapLibre GL JS | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 68 ms | 54–82 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty, one per frame: first call to idle | 4784 ms | 4651–4917 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: the calls | 8.0 ms | 6.6–9.4 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: first call to idle | 375 ms | 357–394 | 2 |
| Run-time edits | This library, main thread | 30 hover steps of setFeatureState, one per frame: first step to idle | 1377 ms | 1372–1382 | 2 |
| Run-time edits | This library, main thread | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 12 ms | 10–14 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty, one per frame: first call to idle | 2090 ms | 2043–2137 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: the calls | 4.4 ms | 3.6–5.2 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: first call to idle | 404 ms | 404–404 | 2 |
| Run-time edits | This library, worker | 30 hover steps of setFeatureState, one per frame: first step to idle | 890 ms | 831–950 | 2 |
| Run-time edits | This library, worker | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 33 ms | 26–40 | 2 |
| Images | MapLibre GL JS | addImage and the icon layer: to idle | 758 ms | 725–792 | 2 |
| Images | MapLibre GL JS | 500 × updateImage, one per frame: first call to idle | 19328 ms | 18573–20083 | 2 |
| Images | MapLibre GL JS | Frames per second during the updates | 25.9 fps | 24.9–27.0 | 2 |
| Images | MapLibre GL JS | Worst frame gap during the updates | 105 ms | 105–106 | 2 |
| Images | MapLibre GL JS | 500 × updateImage in one task: the calls | 3.1 ms | 3.0–3.2 | 2 |
| Images | MapLibre GL JS | 500 × updateImage in one task: first call to idle | 40 ms | 39–42 | 2 |
| Images | This library, main thread | addImage and the icon layer: to idle | 410 ms | 258–563 | 2 |
| Images | This library, main thread | 500 × updateImage, one per frame: first call to idle | 19634 ms | 18919–20350 | 2 |
| Images | This library, main thread | Frames per second during the updates | 25.5 fps | 24.6–26.4 | 2 |
| Images | This library, main thread | Worst frame gap during the updates | 121 ms | 114–128 | 2 |
| Images | This library, main thread | 500 × updateImage in one task: the calls | 1.3 ms | 0.1–2.4 | 2 |
| Images | This library, main thread | 500 × updateImage in one task: first call to idle | 41 ms | 40–42 | 2 |
| Images | This library, worker | addImage and the icon layer: to idle | 529 ms | 354–704 | 2 |
| Images | This library, worker | 500 × updateImage, one per frame: first call to idle | 10731 ms | 9949–11514 | 2 |
| Images | This library, worker | Frames per second during the updates | 25.0 fps | 24.7–25.3 | 2 |
| Images | This library, worker | Worst frame gap during the updates | 175 ms | 118–232 | 2 |
| Images | This library, worker | 500 × updateImage in one task: the calls | 90.1 ms | 1.2–179.0 | 2 |
| Images | This library, worker | 500 × updateImage in one task: first call to idle | 182 ms | 82–283 | 2 |
| Lifecycle | MapLibre GL JS | Create to idle, median of 8 | 600 ms | 562–639 | 2 |
| Lifecycle | MapLibre GL JS | remove(), median of 8 | 48.7 ms | 47.0–50.5 | 2 |
| Lifecycle | MapLibre GL JS | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: create both to both idle | 902 ms | 819–985 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: frames per second of each in a pan | 23.8 fps | 23.2–24.4 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: worst frame gap | 91 ms | 85–97 | 2 |
| Lifecycle | This library, main thread | Create to idle, median of 8 | 485 ms | 485–485 | 2 |
| Lifecycle | This library, main thread | remove(), median of 8 | 31.4 ms | 30.8–32.0 | 2 |
| Lifecycle | This library, main thread | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | This library, main thread | Two maps: create both to both idle | 839 ms | 753–925 | 2 |
| Lifecycle | This library, main thread | Two maps: frames per second of each in a pan | 16.2 fps | 15.7–16.8 | 2 |
| Lifecycle | This library, main thread | Two maps: worst frame gap | 134 ms | 111–157 | 2 |
| Lifecycle | This library, worker | Create to idle, median of 8 | 565 ms | 561–569 | 2 |
| Lifecycle | This library, worker | remove(), median of 8 | 2.0 ms | 1.4–2.7 | 2 |
| Lifecycle | This library, worker | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | This library, worker | Two maps: create both to both idle | 1109 ms | 973–1245 | 2 |
| Lifecycle | This library, worker | Two maps: frames per second of each in a pan | 18.0 fps | 17.2–18.8 | 2 |
| Lifecycle | This library, worker | Two maps: worst frame gap | 1164 ms | 475–1854 | 2 |
| Cold start | MapLibre GL JS | First tile request | 445 ms | 423–534 | 5 |
| Cold start | MapLibre GL JS | First frame | 325 ms | 307–416 | 5 |
| Cold start | MapLibre GL JS | Idle | 1085 ms | 996–1204 | 5 |
| Cold start | MapLibre GL JS | Requests before idle (the page, and the workers of this library) | 7 | 7–7 | 5 |
| Cold start | MapLibre GL JS | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
| Cold start | This library, main thread | First tile request | 424 ms | 413–446 | 5 |
| Cold start | This library, main thread | First frame | 433 ms | 420–454 | 5 |
| Cold start | This library, main thread | Idle | 1011 ms | 984–1029 | 5 |
| Cold start | This library, main thread | Requests before idle (the page, and the workers of this library) | 16 | 16–16 | 5 |
| Cold start | This library, main thread | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
| Cold start | This library, worker | First tile request | 430 ms | 424–435 | 5 |
| Cold start | This library, worker | First frame | 438 ms | 432–444 | 5 |
| Cold start | This library, worker | Idle | 1024 ms | 974–1070 | 5 |
| Cold start | This library, worker | Requests before idle (the page, and the workers of this library) | 12 | 12–12 | 5 |
| Cold start | This library, worker | Of these, answered from the HTTP cache | 0 | 0–0 | 5 |
### win32-firefox (firefox 159.0)

win32 10.0.26100 x64, AMD EPYC 9V74 80-Core Processor                

GPU: ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0), or similar · screen pixel ratio 1 · map-jr-gl 0.9.0, commit unknown · MapLibre GL JS 6.17.0 · Gecko/20100101 Firefox/159.0

Runs of the page: 2 in 15 min.

- worker: loaded, renderer worker, 8 features at the centre, terrain on (centre 10 m)
- main: loaded, renderer main, 8 features at the centre, terrain on (centre 10 m)

| Scenario | Library | Measure | Median | Range | Runs |
|---|---|---|---|---|---|
| Load to idle | MapLibre GL JS | Load to idle | 1337 ms | 1311–1363 | 2 |
| Load to idle | MapLibre GL JS | First frame | 94 ms | 90–97 | 2 |
| Load to idle | MapLibre GL JS | load event | 1289 ms | 1267–1310 | 2 |
| Load to idle | This library, main thread | Load to idle | 893 ms | 889–896 | 2 |
| Load to idle | This library, main thread | First frame | 351 ms | 339–362 | 2 |
| Load to idle | This library, main thread | load event | 882 ms | 878–886 | 2 |
| Load to idle | This library, worker | Load to idle | 683 ms | 655–710 | 2 |
| Load to idle | This library, worker | First frame | 445 ms | 436–454 | 2 |
| Load to idle | This library, worker | load event | 683 ms | 655–710 | 2 |
| 3D terrain | MapLibre GL JS | Load to idle | 5997 ms | 5858–6136 | 2 |
| 3D terrain | MapLibre GL JS | Pan: frames per second | 5.2 fps | 4.8–5.6 | 2 |
| 3D terrain | MapLibre GL JS | Pan: median frame gap | 123.5 ms | 97.0–150.0 | 2 |
| 3D terrain | MapLibre GL JS | Pan: 90th percentile frame gap | 506.5 ms | 441.0–572.0 | 2 |
| 3D terrain | MapLibre GL JS | Pan: worst frame gap | 653 ms | 618–688 | 2 |
| 3D terrain | This library, main thread | Load to idle | 1218 ms | 1191–1244 | 2 |
| 3D terrain | This library, main thread | Pan: frames per second | 28.2 fps | 28.0–28.4 | 2 |
| 3D terrain | This library, main thread | Pan: median frame gap | 33.3 ms | 33.0–33.5 | 2 |
| 3D terrain | This library, main thread | Pan: 90th percentile frame gap | 47.0 ms | 47.0–47.0 | 2 |
| 3D terrain | This library, main thread | Pan: worst frame gap | 72 ms | 68–75 | 2 |
| 3D terrain | This library, worker | Load to idle | 1371 ms | 1305–1437 | 2 |
| 3D terrain | This library, worker | Pan: frames per second | 31.3 fps | 30.9–31.7 | 2 |
| 3D terrain | This library, worker | Pan: median frame gap | 29.0 ms | 28.0–30.0 | 2 |
| 3D terrain | This library, worker | Pan: 90th percentile frame gap | 61.0 ms | 57.0–65.0 | 2 |
| 3D terrain | This library, worker | Pan: worst frame gap | 204 ms | 143–265 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Load to idle | 1478 ms | 1471–1485 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: frames per second | 22.0 fps | 21.0–23.0 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: median frame gap | 45.0 ms | 43.0–47.0 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: 90th percentile frame gap | 66.5 ms | 62.0–71.0 | 2 |
| Pitch 85 with sky | MapLibre GL JS | Turn: worst frame gap | 87 ms | 86–88 | 2 |
| Pitch 85 with sky | This library, main thread | Load to idle | 2373 ms | 2276–2469 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: frames per second | 5.4 fps | 5.2–5.6 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: median frame gap | 179.5 ms | 174.0–185.0 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: 90th percentile frame gap | 279.5 ms | 242.0–317.0 | 2 |
| Pitch 85 with sky | This library, main thread | Turn: worst frame gap | 348 ms | 317–379 | 2 |
| Pitch 85 with sky | This library, worker | Load to idle | 3298 ms | 3014–3582 | 2 |
| Pitch 85 with sky | This library, worker | Turn: frames per second | 6.9 fps | 6.7–7.2 | 2 |
| Pitch 85 with sky | This library, worker | Turn: median frame gap | 70.5 ms | 52.5–88.5 | 2 |
| Pitch 85 with sky | This library, worker | Turn: 90th percentile frame gap | 367.5 ms | 267.0–468.0 | 2 |
| Pitch 85 with sky | This library, worker | Turn: worst frame gap | 782 ms | 740–823 | 2 |
| Globe | MapLibre GL JS | Load to idle | 1547 ms | 1459–1634 | 2 |
| Globe | MapLibre GL JS | Turn: frames per second | 22.7 fps | 22.3–23.1 | 2 |
| Globe | MapLibre GL JS | Turn: median frame gap | 44.0 ms | 43.0–45.0 | 2 |
| Globe | MapLibre GL JS | Turn: 90th percentile frame gap | 47.5 ms | 46.0–49.0 | 2 |
| Globe | MapLibre GL JS | Turn: worst frame gap | 73 ms | 55–91 | 2 |
| Globe | This library, main thread | Load to idle | 784 ms | 732–835 | 2 |
| Globe | This library, main thread | Turn: frames per second | 54.7 fps | 52.8–56.5 | 2 |
| Globe | This library, main thread | Turn: median frame gap | 16.5 ms | 16.0–17.0 | 2 |
| Globe | This library, main thread | Turn: 90th percentile frame gap | 24.5 ms | 23.0–26.0 | 2 |
| Globe | This library, main thread | Turn: worst frame gap | 36 ms | 35–36 | 2 |
| Globe | This library, worker | Load to idle | 682 ms | 651–712 | 2 |
| Globe | This library, worker | Turn: frames per second | 54.8 fps | 54.0–55.7 | 2 |
| Globe | This library, worker | Turn: median frame gap | 16.5 ms | 16.0–17.0 | 2 |
| Globe | This library, worker | Turn: 90th percentile frame gap | 26.0 ms | 23.0–29.0 | 2 |
| Globe | This library, worker | Turn: worst frame gap | 59 ms | 42–75 | 2 |
| Camera | MapLibre GL JS | Static repaint: frames per second | 19.2 fps | 19.1–19.3 | 2 |
| Camera | MapLibre GL JS | Static repaint: median frame gap | 53.5 ms | 53.0–54.0 | 2 |
| Camera | MapLibre GL JS | Static repaint: 90th percentile frame gap | 59.5 ms | 55.0–64.0 | 2 |
| Camera | MapLibre GL JS | Static repaint: worst frame gap | 70 ms | 68–72 | 2 |
| Camera | MapLibre GL JS | Pan: frames per second | 22.5 fps | 21.9–23.1 | 2 |
| Camera | MapLibre GL JS | Pan: median frame gap | 39.8 ms | 38.5–41.0 | 2 |
| Camera | MapLibre GL JS | Pan: 90th percentile frame gap | 58.5 ms | 58.0–59.0 | 2 |
| Camera | MapLibre GL JS | Pan: worst frame gap | 79 ms | 76–81 | 2 |
| Camera | MapLibre GL JS | Rotation: frames per second | 17.8 fps | 17.6–18.0 | 2 |
| Camera | MapLibre GL JS | Rotation: median frame gap | 56.5 ms | 56.0–57.0 | 2 |
| Camera | MapLibre GL JS | Rotation: 90th percentile frame gap | 70.5 ms | 66.0–75.0 | 2 |
| Camera | MapLibre GL JS | Rotation: worst frame gap | 82 ms | 80–84 | 2 |
| Camera | MapLibre GL JS | Zoom: frames per second | 34.8 fps | 34.0–35.6 | 2 |
| Camera | MapLibre GL JS | Zoom: median frame gap | 24.0 ms | 24.0–24.0 | 2 |
| Camera | MapLibre GL JS | Zoom: 90th percentile frame gap | 42.5 ms | 41.0–44.0 | 2 |
| Camera | MapLibre GL JS | Zoom: worst frame gap | 75 ms | 71–79 | 2 |
| Camera | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | MapLibre GL JS | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera | This library, main thread | Static repaint: frames per second | 18.8 fps | 18.4–19.2 | 2 |
| Camera | This library, main thread | Static repaint: median frame gap | 54.0 ms | 53.0–55.0 | 2 |
| Camera | This library, main thread | Static repaint: 90th percentile frame gap | 72.5 ms | 72.0–73.0 | 2 |
| Camera | This library, main thread | Static repaint: worst frame gap | 92 ms | 79–105 | 2 |
| Camera | This library, main thread | Pan: frames per second | 15.1 fps | 14.7–15.5 | 2 |
| Camera | This library, main thread | Pan: median frame gap | 64.3 ms | 62.5–66.0 | 2 |
| Camera | This library, main thread | Pan: 90th percentile frame gap | 106.5 ms | 97.0–116.0 | 2 |
| Camera | This library, main thread | Pan: worst frame gap | 148 ms | 138–157 | 2 |
| Camera | This library, main thread | Rotation: frames per second | 13.2 fps | 13.2–13.3 | 2 |
| Camera | This library, main thread | Rotation: median frame gap | 72.8 ms | 67.0–78.5 | 2 |
| Camera | This library, main thread | Rotation: 90th percentile frame gap | 113.5 ms | 113.0–114.0 | 2 |
| Camera | This library, main thread | Rotation: worst frame gap | 132 ms | 124–139 | 2 |
| Camera | This library, main thread | Zoom: frames per second | 30.2 fps | 29.7–30.7 | 2 |
| Camera | This library, main thread | Zoom: median frame gap | 27.8 ms | 26.5–29.0 | 2 |
| Camera | This library, main thread | Zoom: 90th percentile frame gap | 50.5 ms | 47.0–54.0 | 2 |
| Camera | This library, main thread | Zoom: worst frame gap | 122 ms | 106–138 | 2 |
| Camera | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | This library, main thread | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera | This library, worker | Static repaint: frames per second | 24.8 fps | 21.1–28.4 | 2 |
| Camera | This library, worker | Static repaint: median frame gap | 31.5 ms | 27.0–36.0 | 2 |
| Camera | This library, worker | Static repaint: 90th percentile frame gap | 49.0 ms | 49.0–49.0 | 2 |
| Camera | This library, worker | Static repaint: worst frame gap | 566 ms | 147–984 | 2 |
| Camera | This library, worker | Pan: frames per second | 15.8 fps | 15.8–15.8 | 2 |
| Camera | This library, worker | Pan: median frame gap | 57.8 ms | 55.0–60.5 | 2 |
| Camera | This library, worker | Pan: 90th percentile frame gap | 112.5 ms | 98.0–127.0 | 2 |
| Camera | This library, worker | Pan: worst frame gap | 206 ms | 191–220 | 2 |
| Camera | This library, worker | Rotation: frames per second | 14.4 fps | 14.2–14.6 | 2 |
| Camera | This library, worker | Rotation: median frame gap | 44.5 ms | 41.0–48.0 | 2 |
| Camera | This library, worker | Rotation: 90th percentile frame gap | 130.0 ms | 118.0–142.0 | 2 |
| Camera | This library, worker | Rotation: worst frame gap | 291 ms | 244–337 | 2 |
| Camera | This library, worker | Zoom: frames per second | 27.4 fps | 24.7–30.1 | 2 |
| Camera | This library, worker | Zoom: median frame gap | 23.3 ms | 20.0–26.5 | 2 |
| Camera | This library, worker | Zoom: 90th percentile frame gap | 48.5 ms | 42.0–55.0 | 2 |
| Camera | This library, worker | Zoom: worst frame gap | 457 ms | 426–488 | 2 |
| Camera | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera | This library, worker | Pixel ratio of the drawing buffer | 1.00 | 1.00–1.00 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: frames per second | 12.8 fps | 12.6–12.9 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: median frame gap | 79.5 ms | 79.0–80.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 95.5 ms | 91.0–100.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Static repaint: worst frame gap | 112 ms | 108–116 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: frames per second | 15.0 fps | 14.9–15.2 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: median frame gap | 61.3 ms | 61.0–61.5 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: 90th percentile frame gap | 85.5 ms | 85.0–86.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pan: worst frame gap | 129 ms | 118–140 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: frames per second | 12.0 fps | 12.0–12.1 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: median frame gap | 85.3 ms | 84.0–86.5 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: 90th percentile frame gap | 110.5 ms | 108.0–113.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Rotation: worst frame gap | 121 ms | 119–123 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: frames per second | 20.5 fps | 20.4–20.5 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: median frame gap | 43.0 ms | 43.0–43.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: 90th percentile frame gap | 70.0 ms | 66.0–74.0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Zoom: worst frame gap | 104 ms | 98–109 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | MapLibre GL JS | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: frames per second | 12.5 fps | 12.5–12.5 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: median frame gap | 84.3 ms | 84.0–84.5 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: 90th percentile frame gap | 110.5 ms | 110.0–111.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Static repaint: worst frame gap | 122 ms | 119–125 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: frames per second | 10.6 fps | 10.3–11.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: median frame gap | 94.5 ms | 90.0–99.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: 90th percentile frame gap | 136.5 ms | 129.0–144.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pan: worst frame gap | 181 ms | 152–210 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: frames per second | 9.4 fps | 9.3–9.6 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: median frame gap | 115.8 ms | 111.5–120.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: 90th percentile frame gap | 152.5 ms | 145.0–160.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Rotation: worst frame gap | 168 ms | 162–173 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: frames per second | 18.6 fps | 18.5–18.7 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: median frame gap | 43.3 ms | 42.0–44.5 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: 90th percentile frame gap | 97.0 ms | 93.0–101.0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Zoom: worst frame gap | 176 ms | 166–185 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | This library, main thread | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: frames per second | 18.7 fps | 16.0–21.3 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: median frame gap | 29.5 ms | 26.0–33.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: 90th percentile frame gap | 68.5 ms | 62.0–75.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Static repaint: worst frame gap | 976 ms | 974–978 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: frames per second | 11.2 fps | 9.9–12.4 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: median frame gap | 79.3 ms | 68.5–90.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: 90th percentile frame gap | 143.0 ms | 133.0–153.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pan: worst frame gap | 372 ms | 327–417 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: frames per second | 10.0 fps | 9.3–10.7 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: median frame gap | 44.5 ms | 43.0–46.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: 90th percentile frame gap | 144.0 ms | 142.0–146.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Rotation: worst frame gap | 939 ms | 869–1009 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: frames per second | 23.9 fps | 15.4–32.3 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: median frame gap | 30.5 ms | 23.0–38.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: 90th percentile frame gap | 102.0 ms | 67.0–137.0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Zoom: worst frame gap | 364 ms | 245–483 | 2 |
| Camera at pixel ratio 2 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 2 | This library, worker | Pixel ratio of the drawing buffer | 2.00 | 2.00–2.00 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: frames per second | 8.6 fps | 8.6–8.7 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: median frame gap | 117.5 ms | 117.0–118.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: 90th percentile frame gap | 156.5 ms | 153.0–160.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Static repaint: worst frame gap | 178 ms | 170–185 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: frames per second | 9.7 fps | 9.5–9.9 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: median frame gap | 94.5 ms | 93.0–96.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: 90th percentile frame gap | 155.0 ms | 146.0–164.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pan: worst frame gap | 196 ms | 178–213 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: frames per second | 8.1 fps | 8.0–8.3 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: median frame gap | 124.0 ms | 123.0–125.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: 90th percentile frame gap | 181.5 ms | 165.0–198.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Rotation: worst frame gap | 193 ms | 183–202 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: frames per second | 13.0 fps | 12.8–13.2 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: median frame gap | 72.5 ms | 71.0–74.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: 90th percentile frame gap | 113.0 ms | 107.0–119.0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Zoom: worst frame gap | 140 ms | 131–148 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | MapLibre GL JS | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: frames per second | 8.5 fps | 8.4–8.6 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: median frame gap | 130.5 ms | 124.0–137.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: 90th percentile frame gap | 165.5 ms | 159.0–172.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Static repaint: worst frame gap | 190 ms | 189–190 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: frames per second | 7.6 fps | 7.4–7.7 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: median frame gap | 136.0 ms | 135.0–137.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: 90th percentile frame gap | 232.5 ms | 204.0–261.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pan: worst frame gap | 258 ms | 252–264 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: frames per second | 6.9 fps | 6.7–7.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: median frame gap | 155.3 ms | 151.5–159.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: 90th percentile frame gap | 256.5 ms | 252.0–261.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Rotation: worst frame gap | 273 ms | 264–282 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: frames per second | 11.7 fps | 11.2–12.2 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: median frame gap | 74.0 ms | 70.0–78.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: 90th percentile frame gap | 137.0 ms | 126.0–148.0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Zoom: worst frame gap | 245 ms | 235–254 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | This library, main thread | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: frames per second | 16.9 fps | 15.9–17.9 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: median frame gap | 25.5 ms | 24.0–27.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: 90th percentile frame gap | 75.5 ms | 70.0–81.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Static repaint: worst frame gap | 926 ms | 861–991 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: frames per second | 7.3 fps | 6.6–7.9 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: median frame gap | 129.8 ms | 117.5–142.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: 90th percentile frame gap | 314.5 ms | 279.0–350.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pan: worst frame gap | 338 ms | 297–379 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: frames per second | 5.7 fps | 5.3–6.1 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: median frame gap | 61.8 ms | 39.5–84.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: 90th percentile frame gap | 466.0 ms | 335.0–597.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Rotation: worst frame gap | 1041 ms | 898–1183 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: frames per second | 30.6 fps | 29.0–32.2 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: median frame gap | 22.3 ms | 21.0–23.5 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: 90th percentile frame gap | 74.5 ms | 64.0–85.0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Zoom: worst frame gap | 184 ms | 165–202 | 2 |
| Camera at pixel ratio 3 | This library, worker | Main thread blocked (long tasks) in the pan | 0 ms | 0–0 | 2 |
| Camera at pixel ratio 3 | This library, worker | Pixel ratio of the drawing buffer | 3.00 | 3.00–3.00 | 2 |
| 1,000 markers | MapLibre GL JS | Add the markers | 71 ms | 67–74 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: frames per second | 22.0 fps | 21.8–22.2 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 62.0 ms | 61.0–63.0 | 2 |
| 1,000 markers | MapLibre GL JS | Pan: worst frame gap | 78 ms | 73–82 | 2 |
| 1,000 markers | This library, main thread | Add the markers | 19 ms | 17–21 | 2 |
| 1,000 markers | This library, main thread | Pan: frames per second | 22.4 fps | 22.1–22.7 | 2 |
| 1,000 markers | This library, main thread | Pan: 90th percentile frame gap | 69.0 ms | 63.0–75.0 | 2 |
| 1,000 markers | This library, main thread | Pan: worst frame gap | 106 ms | 105–106 | 2 |
| 1,000 markers | This library, worker | Add the markers | 7 ms | 6–7 | 2 |
| 1,000 markers | This library, worker | Pan: frames per second | 24.8 fps | 24.6–24.9 | 2 |
| 1,000 markers | This library, worker | Pan: 90th percentile frame gap | 78.0 ms | 74.0–82.0 | 2 |
| 1,000 markers | This library, worker | Pan: worst frame gap | 169 ms | 141–197 | 2 |
| 10,000 markers | MapLibre GL JS | Add the markers | 626 ms | 609–642 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: frames per second | 5.1 fps | 5.0–5.1 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: 90th percentile frame gap | 231.5 ms | 225.0–238.0 | 2 |
| 10,000 markers | MapLibre GL JS | Pan: worst frame gap | 250 ms | 234–265 | 2 |
| 10,000 markers | This library, main thread | Add the markers | 10 ms | 2–17 | 2 |
| 10,000 markers | This library, main thread | Pan: frames per second | 21.6 fps | 21.0–22.1 | 2 |
| 10,000 markers | This library, main thread | Pan: 90th percentile frame gap | 70.5 ms | 68.0–73.0 | 2 |
| 10,000 markers | This library, main thread | Pan: worst frame gap | 116 ms | 104–127 | 2 |
| 10,000 markers | This library, worker | Add the markers | 19 ms | 3–35 | 2 |
| 10,000 markers | This library, worker | Pan: frames per second | 26.4 fps | 25.8–27.0 | 2 |
| 10,000 markers | This library, worker | Pan: 90th percentile frame gap | 69.5 ms | 66.0–73.0 | 2 |
| 10,000 markers | This library, worker | Pan: worst frame gap | 121 ms | 106–136 | 2 |
| GeoJSON setData | MapLibre GL JS | addSource to idle | 488 ms | 485–490 | 2 |
| GeoJSON setData | MapLibre GL JS | Frames per second during the updates | 14.2 fps | 14.2–14.3 | 2 |
| GeoJSON setData | MapLibre GL JS | setData calls per second | 45.8 /s | 45.8–45.8 | 2 |
| GeoJSON setData | MapLibre GL JS | Worst frame gap | 113 ms | 110–115 | 2 |
| GeoJSON setData | MapLibre GL JS | Last setData to idle | 685 ms | 558–812 | 2 |
| GeoJSON setData | This library, main thread | addSource to idle | 332 ms | 309–354 | 2 |
| GeoJSON setData | This library, main thread | Frames per second during the updates | 14.6 fps | 14.5–14.7 | 2 |
| GeoJSON setData | This library, main thread | setData calls per second | 24.2 /s | 22.9–25.4 | 2 |
| GeoJSON setData | This library, main thread | Worst frame gap | 121 ms | 115–127 | 2 |
| GeoJSON setData | This library, main thread | Last setData to idle | 493 ms | 439–547 | 2 |
| GeoJSON setData | This library, worker | addSource to idle | 428 ms | 407–449 | 2 |
| GeoJSON setData | This library, worker | Frames per second during the updates | 13.8 fps | 13.7–14.0 | 2 |
| GeoJSON setData | This library, worker | setData calls per second | 32.3 /s | 31.7–32.9 | 2 |
| GeoJSON setData | This library, worker | Worst frame gap | 140 ms | 125–154 | 2 |
| GeoJSON setData | This library, worker | Last setData to idle | 447 ms | 330–563 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty, one per frame: first call to idle | 5467 ms | 5447–5487 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: the calls | 1.0 ms | 1.0–1.0 | 2 |
| Run-time edits | MapLibre GL JS | 100 × setPaintProperty in one task: first call to idle | 359 ms | 355–363 | 2 |
| Run-time edits | MapLibre GL JS | 30 hover steps of setFeatureState, one per frame: first step to idle | 1557 ms | 1549–1565 | 2 |
| Run-time edits | MapLibre GL JS | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 107 ms | 107–107 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty, one per frame: first call to idle | 6215 ms | 6201–6229 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: the calls | 3.0 ms | 1.0–5.0 | 2 |
| Run-time edits | This library, main thread | 100 × setPaintProperty in one task: first call to idle | 358 ms | 347–369 | 2 |
| Run-time edits | This library, main thread | 30 hover steps of setFeatureState, one per frame: first step to idle | 1919 ms | 1908–1929 | 2 |
| Run-time edits | This library, main thread | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 30 ms | 29–30 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty, one per frame: first call to idle | 2633 ms | 2537–2728 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: the calls | 8.0 ms | 3.0–13.0 | 2 |
| Run-time edits | This library, worker | 100 × setPaintProperty in one task: first call to idle | 385 ms | 361–409 | 2 |
| Run-time edits | This library, worker | 30 hover steps of setFeatureState, one per frame: first step to idle | 1169 ms | 1078–1260 | 2 |
| Run-time edits | This library, worker | Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle | 60 ms | 53–66 | 2 |
| Images | MapLibre GL JS | addImage and the icon layer: to idle | 784 ms | 745–822 | 2 |
| Images | MapLibre GL JS | 500 × updateImage, one per frame: first call to idle | 25315 ms | 24981–25649 | 2 |
| Images | MapLibre GL JS | Frames per second during the updates | 19.8 fps | 19.5–20.0 | 2 |
| Images | MapLibre GL JS | Worst frame gap during the updates | 90 ms | 83–97 | 2 |
| Images | MapLibre GL JS | 500 × updateImage in one task: the calls | 2.0 ms | 1.0–3.0 | 2 |
| Images | MapLibre GL JS | 500 × updateImage in one task: first call to idle | 47 ms | 38–56 | 2 |
| Images | This library, main thread | addImage and the icon layer: to idle | 357 ms | 336–377 | 2 |
| Images | This library, main thread | 500 × updateImage, one per frame: first call to idle | 26151 ms | 26114–26188 | 2 |
| Images | This library, main thread | Frames per second during the updates | 19.1 fps | 19.1–19.2 | 2 |
| Images | This library, main thread | Worst frame gap during the updates | 74 ms | 72–75 | 2 |
| Images | This library, main thread | 500 × updateImage in one task: the calls | 13.0 ms | 10.0–16.0 | 2 |
| Images | This library, main thread | 500 × updateImage in one task: first call to idle | 33 ms | 31–35 | 2 |
| Images | This library, worker | addImage and the icon layer: to idle | 386 ms | 348–423 | 2 |
| Images | This library, worker | 500 × updateImage, one per frame: first call to idle | 12110 ms | 12075–12144 | 2 |
| Images | This library, worker | Frames per second during the updates | 35.1 fps | 34.3–35.9 | 2 |
| Images | This library, worker | Worst frame gap during the updates | 1000 ms | 981–1018 | 2 |
| Images | This library, worker | 500 × updateImage in one task: the calls | 17.5 ms | 10.0–25.0 | 2 |
| Images | This library, worker | 500 × updateImage in one task: first call to idle | 65 ms | 53–77 | 2 |
| Lifecycle | MapLibre GL JS | Create to idle, median of 8 | 1080 ms | 1075–1085 | 2 |
| Lifecycle | MapLibre GL JS | remove(), median of 8 | 4.5 ms | 4.0–5.0 | 2 |
| Lifecycle | MapLibre GL JS | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: create both to both idle | 1862 ms | 1856–1867 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: frames per second of each in a pan | 18.2 fps | 18.1–18.2 | 2 |
| Lifecycle | MapLibre GL JS | Two maps: worst frame gap | 121 ms | 114–127 | 2 |
| Lifecycle | This library, main thread | Create to idle, median of 8 | 863 ms | 858–869 | 2 |
| Lifecycle | This library, main thread | remove(), median of 8 | 13.0 ms | 12.5–13.5 | 2 |
| Lifecycle | This library, main thread | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | This library, main thread | Two maps: create both to both idle | 1599 ms | 1577–1621 | 2 |
| Lifecycle | This library, main thread | Two maps: frames per second of each in a pan | 11.5 fps | 11.5–11.5 | 2 |
| Lifecycle | This library, main thread | Two maps: worst frame gap | 158 ms | 154–162 | 2 |
| Lifecycle | This library, worker | Create to idle, median of 8 | 735 ms | 720–751 | 2 |
| Lifecycle | This library, worker | remove(), median of 8 | 3.0 ms | 1.0–5.0 | 2 |
| Lifecycle | This library, worker | Workers started by the 8 maps and not ended | 0 | 0–0 | 2 |
| Lifecycle | This library, worker | Two maps: create both to both idle | 1332 ms | 1324–1340 | 2 |
| Lifecycle | This library, worker | Two maps: frames per second of each in a pan | 14.0 fps | 12.6–15.4 | 2 |
| Lifecycle | This library, worker | Two maps: worst frame gap | 549 ms | 250–847 | 2 |
| Cold start | MapLibre GL JS | First tile request | 483 ms | 476–501 | 5 |
| Cold start | MapLibre GL JS | First frame | 391 ms | 390–401 | 5 |
| Cold start | MapLibre GL JS | Idle | 1618 ms | 1580–1684 | 5 |
| Cold start | MapLibre GL JS | Requests before idle (the page, and the workers of this library) | 7 | 7–7 | 5 |
| Cold start | MapLibre GL JS | Of these, answered from the HTTP cache | 6 | 6–6 | 5 |
| Cold start | This library, main thread | First tile request | 464 ms | 459–475 | 4 |
| Cold start | This library, main thread | First frame | 767 ms | 759–781 | 4 |
| Cold start | This library, main thread | Idle | 1282 ms | 1272–1302 | 4 |
| Cold start | This library, main thread | Requests before idle (the page, and the workers of this library) | 16 | 16–16 | 4 |
| Cold start | This library, main thread | Of these, answered from the HTTP cache | 7 | 7–7 | 4 |
| Cold start | This library, worker | First tile request | 466 ms | 459–471 | 4 |
| Cold start | This library, worker | First frame | 812 ms | 801–822 | 4 |
| Cold start | This library, worker | Idle | 1233 ms | 1214–1277 | 4 |
| Cold start | This library, worker | Requests before idle (the page, and the workers of this library) | 12 | 12–12 | 4 |
| Cold start | This library, worker | Of these, answered from the HTTP cache | 2 | 2–2 | 4 |

Errors: bench: the cold start stopped after 13 loads, at the deadline of 15 min
### win32-webkit (webkit 27.2)

win32 10.0.26100 x64, AMD EPYC 9V74 80-Core Processor                

GPU: Apple GPU · screen pixel ratio 1 · map-jr-gl 0.9.0, commit unknown · MapLibre GL JS 6.17.0 · AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Safari/605.1.15

- worker: loaded, renderer main, 8 features at the centre, terrain on (centre 0 m)
- main: loaded, renderer main, 8 features at the centre, terrain on (centre 0 m)

| Scenario | Library | Measure | Median | Range | Runs |
|---|---|---|---|---|---|
| Load to idle | MapLibre GL JS | Load to idle | 1292 ms |  | 1 |
| Load to idle | MapLibre GL JS | First frame | 167 ms |  | 1 |
| Load to idle | MapLibre GL JS | load event | 1223 ms |  | 1 |
| Load to idle | This library, main thread | Load to idle | 831 ms |  | 1 |
| Load to idle | This library, main thread | First frame | 133 ms |  | 1 |
| Load to idle | This library, main thread | load event | 831 ms |  | 1 |
| Load to idle | This library, worker | Load to idle | 720 ms |  | 1 |
| Load to idle | This library, worker | First frame | 86 ms |  | 1 |
| Load to idle | This library, worker | load event | 720 ms |  | 1 |

Errors: bench: run 1 of the page did not end within 15 min; the page says: Running 4 of 39, run 1 of 1: 3D terrain: MapLibre GL JS
## Failed behaviour tests

### darwin-chromium

```
FAIL  [main] maplibre-compat: fitBounds flies with a duration from speed, and eases with linear, as in MapLibre GL JS (#1235) {"ml":{"fly":{"ms":921,"low":3.0284012202897443,"end":[40,0,5.720378747282916]},"linear":{"ms":603.6999999999534,"low":5.720378747282916,"end":[0,0,5.720378747282916]}},"compat":{"fly":{"ms":903.1999999999534,"low":2.7789274129144235,"end":[40.00000000000014,0,5.720378747282909]},"linear":{"ms":533.4000000001397,"low":5.720378747282909,"end":[0,0,5.720378747282909]}}}
FAIL  [main] compat: a rotate drag released while it moves turns on with inertia (#679) {"atRelease":80,"end":81.44884665768689}
FAIL  [worker] 3D terrain that is switched on: the map is idle when the elevation data has come, not 200 ms after the camera got its height (#436) [328,279,322]
```

### darwin-firefox

```
FAIL  [worker] jumpTo fires zoom, rotate and pitch 
FAIL  [worker] marker hover sets pointer cursor 
FAIL  [worker] easeTo reaches target [39.97991160455899,14.999648453079782]
FAIL  [worker] once with no listener returns a promise for the event {"isPromise":true,"chained":true}
FAIL  no check finished within 120 s after "[worker] once with no listener returns a promise for the event"; the pages are closed and the suite moves on
FAIL  [worker] the test run was completed page.evaluate: Target page, context or browser has been closed
FAIL  only 273 results, where this run has at least 340: a check stopped the part of the suite after it (see the FAIL above)
FAIL  [worker] fitBounds jumps without a duration and animates with duration 800 (#1154) {"jumped":13.964836751746367,"during":3,"moving":false,"end":3,"first":5256}
FAIL  [worker] 3D terrain that is switched on: the map is idle when the elevation data has come, not 200 ms after the camera got its height (#436) [915,430,531]
FAIL  [worker] 10,000 points set in each frame for 1 s: the map draws new data during that second (#856) {"frames":12,"updates":60,"gap":716,"newest":13,"used":"worker"}
FAIL  [worker] an SVG image without a viewBox has the size of its width and height: 40×40 is not cropped, and 9×9 after it is centred on its anchor {"big":"423,462,280,319","small":"438,446,296,304"}
FAIL  [main] an SVG image without a viewBox has the size of its width and height: 40×40 is not cropped, and 9×9 after it is centred on its anchor {"big":"423,462,280,319","small":"438,446,296,304"}
FAIL  [main] the control colorScheme() flips light and dark, and from 'auto' sets the opposite of the system and then 'auto' again, with onColorSchemeChange and a label that names the action {"none":"-/light/Use dark colours > dark/dark/Use light colours > light/light/Use dark colours calls dark,light","autoDark":"auto/dark/Use light colours > light/light/Use dark colours > auto/dark/Use light colours calls light,auto","autoLight":"auto/dark/Use light colours > auto/light/Use dark colours > dark/dark/Use light colours calls auto,dark","fixedDark":"dark/dark/Use light colours > light/light/Use 
FAIL  [main] a map in a shadow root: the fullscreen control shows its state (#828) {"on":"true","off":"true"}
```

### darwin-webkit

```
FAIL  [main] no page errors Failed to load resource: the server responded with a status of 404 (Not Found) (http://localhost:8080/none/0/0/0.png)
```

### linux-chromium

```
FAIL  [worker] update() with padding from 0 to unset does not cancel a running fitBounds (#1351) {"end":3}
FAIL  [worker] points() in data and a symbol layer in layers: the points are features with their ids, new data is no new style, and data that comes with a change of the layer is not lost {"one":1,"id":1,"top":"pins","moved":1,"back":1,"index":2,"color":"#00d","sameStyle":true,"late":"3 #0a0","none":true,"stuck":[]}
FAIL  [worker] icons from the buffers of the tiles are drawn as icons that are placed with the labels: on a flat map, on a turned and tilted map and after a turn in one step, with a size, a turn and an opacity for each feature [{"different":1602,"red":591},{"different":1440,"red":586},{"different":1440,"red":586}]
FAIL  [worker] queryFeatures and querySource: a point, a position, a rectangle or the whole map, options in the place of at; watchFeatures and watchSource follow the map {"drawnInLayer":159,"drawnInLayerToo":159,"inLayer":true,"sourceFirst":6,"sourceMoved":1,"sourceAfter":1,"drawnAtPoint":4,"drawnAtPosition":4,"drawnAll":262,"dataAtPosition":6,"dataInBox":58,"dataAll":255,"layer":"object","first":1,"moved":1,"after":1}
FAIL  [worker] a watchFeatures listener that throws is called again, and a listener that throws leaves the next listener its event and is reported as an error {"calls":1,"second":1,"error":"thrown by a listener"}
```

### linux-firefox

```
FAIL  [worker] map events and handlers: preventDefault and dragPan.disable stop a drag, a wheel event can be prevented, render and sourcedata fire {"c0":[-74.0065,40.7085,14],"cBlocked":[-74.0065,40.7085,14],"cOff":[-74.0065,40.7085,14],"cMoved":[-74.01069931963453,40.708499999999994,14],"zBlocked":14,"zMoved":14.503167203764326,"zBox0":15.503167203764326,"zBox":15.503167203764326,"types":["mousemove","mousedown","mouseup","wheel","mouseout","dblclick","contextmenu","mouseover"],"renders":134,"sourcedata":13,"lngLat":true,"bounds":true,"handler":true}
FAIL  [worker] touch double-tap: preventDefault() in a dblclick listener stops the zoom and sets defaultPrevented {"tPrevented":{"z":14,"seen":true},"tDouble":{"z":14,"seen":false}}
FAIL  [worker] a touch tap with no hover: a click listener reads the features of tiles at once {"ms":383,"found":0}
```

### linux-webkit

```
FAIL  [main] a drag released out of sight does not stick 
FAIL  [main] no page errors Failed to load resource: the server responded with a status of 404 (Not Found) (http://localhost:8080/none/0/0/0.png)
FAIL  [worker] initialView.bounds is fitted into the part that the padding of the description leaves free (#1162) {"first":7.457637380991767,"later":8.171333195835127}
FAIL  [worker] null in every optional field draws the same map as a description without those keys, and warns nothing {"same":true,"a":{"style":"{\"version\":8,\"sources\":{\"omt\":{\"type\":\"vector\",\"tiles\":[\"http://localhost:8080/tiles/{z}/{x}/{y}.pbf\"],\"minzoom\":0,\"maxzoom\":14,\"attribution\":\"<a href=\\\"https://openfreemap.org\\\" target=\\\"_blank\\\">OpenFreeMap</a> <a href=\\\"https://www.openmaptiles.org/\\\" target=\\\"_blank\\\">&copy; OpenMapTiles</a> Data from <a href=\\\"https://www.openstreetmap.org/copyright\\\" target=\\\"_blank\\\">OpenStreetMap</a>\"},\"dem\":{\"t
FAIL  [worker] a fast drag from the compass never turns back: not in getBearing(), in the needle or in the drawn map (#548) {"mouse 100":[0,0,0],"mouse 25":[1,1,0],"mouse 5":[0,0,0]}
FAIL  [main] a fast drag from the compass never turns back: not in getBearing(), in the needle or in the drawn map (#548) {"mouse 100":[0,0,0],"mouse 25":[1,1,0],"mouse 5":[0,0,0]}
FAIL  examples, hover example (svelte): the landing under the pointer has the state hover and its name in the line of text, and neither after the pointer leaves it {"text":"Move the pointer over a ferry landing.","stateOver":null,"stateAfter":null}
FAIL  browser: useMapFeatures gives what the style layers draw, and useMapSource the data of the source that a ref names {"first":{"drawn":1,"layer":"pts","raw":0},"other":{"drawn":1,"layer":"pts","raw":0}}
```

### win32-chromium

```
FAIL  examples, hover, back and fit examples (svelte): the test run was completed page.waitForFunction: Timeout 30000ms exceeded.
FAIL  examples, harness page and gallery (#1114): the test run was completed page.waitForFunction: Timeout 60000ms exceeded.
FAIL  examples, harness page: the svelte form of each example runs in the stage and reaches idle (#1115) basic:no reactive:no markers:no draggable:no images:no terrain:no globe:no query:no hover:no fit:no back:no pmtiles:no 
```

### win32-firefox

```
FAIL  [main] compat: a rotate drag released while it moves turns on with inertia (#679) {"atRelease":80,"end":81.02029971304069}
FAIL  [worker] a touch tap with no hover: a click listener reads the features of tiles at once {"ms":396,"found":0}
FAIL  [worker] compat: an HTML marker follows a drag in the second frame after each pointer move, without waiting for the camera of the engine (#38) {"renderer":"main","moved":[10,20,30,40,50,60,70,80],"end":90,"project":0}
FAIL  [worker] the first idle of a map does not wait a fifth of a second for a camera that has just stopped (#436) [311,316,314]
FAIL  [main] the first idle of a map does not wait a fifth of a second for a camera that has just stopped (#436) [278,273,276]
FAIL  examples, hover, back and fit examples (svelte): the test run was completed page.waitForFunction: Timeout 30000ms exceeded.
FAIL  examples, harness page and gallery (#1114): the test run was completed page.waitForFunction: Timeout 60000ms exceeded.
FAIL  examples, harness page: the svelte form of each example runs in the stage and reaches idle (#1115) basic:no reactive:no markers:no draggable:no images:no terrain:no globe:no query:no hover:no fit:no back:no pmtiles:no 
```

### win32-webkit

```
FAIL  [main] no page errors Failed to load resource: the server responded with a status of 404 (Not Found) (http://localhost:8080/none/0/0/0.png)
FAIL  [worker] compat: the images in metadata["map-jr:images"] of the style are drawn (a template with params, an image on demand), an image of the style wins over the sprite image of the same name (#1199), an image of addImage wins, a resolver of the page gets only other names, and setStyle without the key removes them (#759) {"renderer":"main","pin":"255,0,0","box":"255,0,255","other":"0,255,0","had":[true,true,false],"after":[false,true,true],"resolved":["pin","other"],"took":{"pin":196,"other":16,"addImage":140,"setStyle":102}}
FAIL  [worker] no page errors Can't find variable: OffscreenCanvas | Can't find variable: OffscreenCanvas | Can't find variable: OffscreenCanvas
FAIL  examples, hover, back and fit examples (svelte): the test run was completed page.waitForFunction: Timeout 30000ms exceeded.
FAIL  examples, harness page and gallery (#1114): the test run was completed page.waitForFunction: Timeout 60000ms exceeded.
FAIL  examples, harness page: the svelte form of each example runs in the stage and reaches idle (#1115) basic:no reactive:no markers:no draggable:no images:no terrain:no globe:no query:no hover:no fit:no back:no pmtiles:no 
```

