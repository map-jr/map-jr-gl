# Working on Map Jr. GL

## How the owner wants work to go

- **Do not stop after an update.** Give progress updates as short notes and continue with the next item. Stop only
  when a decision is needed that cannot be made from the code, or when asked to stop. (Stated repeatedly by the
  owner, most recently: "I keep telling you not to stop working, keep going after you update me".)
- The standing task, when nothing more specific is asked: improve compatibility with MapLibre GL JS and performance.
  Use the failing groups of `pnpm test:render`, the missing entries in `docs/maplibre-compatibility.md`, and
  profiles of real styles to choose what to do next.
- Commit and push to `main` after each finished piece, with the test suites passing. Do not open pull requests
  unless asked.
- Documents use plain, direct English in the manner of ASD-STE100: short sentences, active voice, one instruction
  for each sentence, the same word for the same thing. But always use the usual technical word. Do not replace a
  common term with a roundabout one: write "image", "render", "screenshot", "returns a promise", "URL", "GPU",
  "required", "you do not need", not "picture", "gives a promise", "address", "graphics processor", "necessary".
  (The owner found the stricter style confusing.)
- Class names: the library uses `map-jr-*` internally. Elements also carry `maplibregl-*` names for compatibility
  only; do not style or query by those.

- The owner's messages can arrive late in a long turn. Read notifications often, and when a message arrives, answer
  it and do what it asks before other work.
- The licence is MIT. Keep `ACKNOWLEDGEMENTS.md` and `THIRD-PARTY-LICENSES.md` correct when a library is added to
  the built files or a method is taken from another project.

- Size is a main advantage of the library, and the owner is concerned that the worker file grows with each
  feature. `pnpm test:size` has a budget for each built file. Do not raise a budget without a reason that the owner
  would accept; first look for a way to make the code smaller.
  The build shortens the names of private class members and of the names in the shaders (see
  `docs/development.md`): declare members `private`, and name uniforms `u_...`. Code that only some maps need can
  be a file that is loaded on demand (`import()`), as `src/hash.ts` and `src/pmtiles-info.ts` are.

## Commands

See `docs/development.md`. In short: `pnpm build`, `pnpm test`, and with `pnpm demo` running: `pnpm test:browser`,
`pnpm test:loading`, `pnpm test:cloudflare`. `pnpm test:render` takes about ten minutes. After changes that affect
results or sizes, run `pnpm status` (it rewrites the status table in the README).

## Checking work

- The workflow `Browsers` measures and tests each push in Chromium, Firefox and WebKit on Linux, macOS and Windows.
  Read its results with `git fetch origin bench-results && git show origin/bench-results:README.md`. Use this
  before you ask the owner to test on a device.

- To find faults in common use, run real pages and plugins, not only the test suites. Each of these compares the
  library with MapLibre GL JS and writes its results into `docs/ecosystem.md`:
  `node test/conformance/examples.mjs --write` (the example pages of the MapLibre documentation; about 30 minutes;
  `--filter=<regex>` for a part), `node test/conformance/plugins.mjs --write` (plugins and framework wrappers, each
  in a scenario), `node test/conformance/styles.mjs --write` (public styles). They found faults that the suites did
  not show, for example lost tiles with `addProtocol` and more than one tile worker.
- Do not run `node build.mjs` while a long run (render tests, example pages) reads `dist/`.
- The tests use one tile worker in some places. A fault can need the usual number of workers to show.
- The development machine has no GPU: WebGL runs in software, so frame rates measured here are only relative.
  Real numbers come from the owner running `/bench` (an Apple M4 and an iPhone so far).
- Safari on iOS behaves differently from Chromium in places (canvas scaling, OffscreenCanvas in workers). Changes
  to image or canvas handling need a check on a device by the owner.
