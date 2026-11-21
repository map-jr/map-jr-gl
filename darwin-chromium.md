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
