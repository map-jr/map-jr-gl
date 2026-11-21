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
