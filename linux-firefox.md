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
