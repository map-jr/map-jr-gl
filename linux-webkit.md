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
