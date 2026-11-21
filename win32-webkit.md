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
