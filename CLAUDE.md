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
- Documents are written in ASD-STE100 (Simplified Technical English): short sentences, active voice, one
  instruction for each sentence, the same word for the same thing.
- Class names: the library uses `map-jr-*` internally. Elements also carry `maplibregl-*` names for compatibility
  only; do not style or query by those.

- The owner's messages can arrive late in a long turn. Read notifications often, and when a message arrives, answer
  it and do what it asks before other work.
- The licence is MIT. Keep `ACKNOWLEDGEMENTS.md` and `THIRD-PARTY-LICENSES.md` correct when a library is added to
  the built files or a method is taken from another project.

## Commands

See `docs/development.md`. In short: `pnpm build`, `pnpm test`, and with `pnpm demo` running: `pnpm test:browser`,
`pnpm test:loading`, `pnpm test:cloudflare`. `pnpm test:render` takes about ten minutes. After changes that affect
results or sizes, run `pnpm status` (it rewrites the status table in the README).

## Checking work

- The development machine has no GPU: WebGL runs in software, so frame rates measured here are only relative.
  Real numbers come from the owner running `/bench` (an Apple M4 and an iPhone so far).
- Safari on iOS behaves differently from Chromium in places (canvas scaling, OffscreenCanvas in workers). Changes
  to image or canvas handling need a check on a device by the owner.
