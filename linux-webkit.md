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
