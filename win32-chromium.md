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
