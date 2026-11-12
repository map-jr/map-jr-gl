# Working on Map Jr. GL

Map Jr. GL is a small, fast WebGL map library that reads MapLibre styles. People choose it for its size and its
speed, and they must be able to trust what its documentation says it does and does not do. The rules below exist
to protect those qualities.

## How work goes

- **The backlog is GitHub issues** (`map-jr/map-jr-gl`). Priority labels: `P0` (broken now) → `P3`. Area labels say
  what kind of work it is. `needs: owner` means do not decide alone: ask.
- **If you find a fault or a gap while doing something else,** file an issue for it instead of fixing it in the
  same change, unless the fix is a line or two. Nothing should live only in a chat or a notes file.
- **The owner's messages can arrive late in a long turn.** Read notifications often. When a message arrives,
  answer it and do what it asks before other work.
- Every few tool calls, give the user a one-line update on where things stand.

## Branches, pull requests and merging

- **Every change goes through a pull request.** Branch from `main` (`fix/…`, `feat/…`, `docs/…`), push, open a pull
  request that says what changed and why, and names the issue (`Fixes #12`).
- **The `CI` workflow must pass** (three jobs: `checks`, `browser`, `render`). Do not merge on red, and do not
  lower a floor or skip a test to get green: fix the cause, or say in the pull request why the floor moves.
- **Merge with squash** once CI is green — you may merge your own pull request, **except** when the change does one
  of these. Then leave it open and ask the owner:
  - removes or renames public API of either entry, or changes a default;
  - raises a size budget (see below);
  - adds a dependency to the built files, or takes a method from another project;
  - changes this file, the CI workflows, or the release process;
  - is labelled `needs: owner`.
- **Before version 1.0, a correction does not need the owner.** A change that makes the types stricter, or that
  corrects a result, so that an entry agrees with its documentation or with MapLibre GL JS can be merged on green CI,
  even when code that compiled or ran before can break. The pull request lists what can break.
- **A pull request has one concern.** A fix and its test belong together. An unrelated cleanup goes into its own
  pull request.
- After a merge, the `Browsers` workflow measures and tests in Chromium, Firefox and WebKit on three systems. Read
  its results (`git fetch origin bench-results && git show origin/bench-results:README.md`) before you ask the
  owner to test on a device.
- The same workflow can run Safari itself on a macOS runner, but only when it is started by hand (the inputs
  `safari`, `safari_only` and `simulator`; see `docs/development.md`). Start it when a change touches the choice of
  the renderer, the workers or the canvas, and read its results before you ask the owner to test in Safari. On that
  runner the worker renderer does not load (the machine loses the WebGL context of a worker), and the frame rates
  mean little: a failure of the worker scenarios there is not a fault of the change.

## Working with several workers

One session can act as the coordinator and give issues to workers (subagents). This file is loaded into every
worker, so it has only the rules. The brief that every worker reads is `docs/agents/worker-brief.md`, and the notes
for the coordinator are `docs/agents/coordinating.md`. Read the notes before you start a batch.

- **A worker gets one issue, one branch and one port.** Its prompt is the path of the brief and five lines: the
  issue, the branch, the port, the scope, and the files and lines where the work starts.
- **A worker opens the pull request and stops.** The coordinator watches CI, merges, and sends a failure back to the
  same worker, which still has its context.
- **A worker reports in at most 12 lines** in the format of the brief. It files nothing and merges nothing. The
  coordinator turns the faults that a report names into issues.
- **The coordinator runs `pnpm status` once for a batch.** A worker does not run it, because every run rewrites the
  same lines of the README.

## Definition of done

A change is done when all of these that apply are true. The pull request template has the same list.

1. **Tests.** A fault fix has a test that fails without the fix. A feature has a test in the suite that fits
   (`test/unit` when no browser is needed; `test/host.mjs` for the main API; `test/interact.mjs` for the map and
   the compat entry; `test/vue.mjs`, `test/react.mjs` for adapters).
2. **Both entries.** A feature goes to the main API first (`src/host.ts`). Decide on purpose whether the compat
   entry gets it too. Things that exist only to be MapLibre-compatible go in `src/compat-map.ts`, not in the core.
3. **Every adapter.** A new field of the description (`MapSpec`) is a prop of the Vue component and reaches React
   and Svelte. `pnpm test:consistency` fails if the Vue prop or the documentation is missing.
4. **Documentation.** `docs/api.md` for the main API; `docs/vue.md` / `docs/react.md` / `docs/svelte.md` for
   adapters; `docs/maplibre-compatibility.md` when behaviour differs from MapLibre (including anything accepted
   that has no effect). If the README shows it, update the README.
5. **Examples.** A gallery row has four forms in `site/examples/` (`.js`, `.vue`, `.jsx`, `.compat.js`), each
   complete on its own. Comments in examples must stay true: reread them when behaviour changes.
6. **Mistakes get a message.** A mistake by the user gets a message that says what is wrong and what to write
   instead. An option or method that is accepted but has no effect warns once. The library does not ignore input
   in silence.
   The checks for common mistakes of the main API (`src/mistakes.ts`) are in the development build only (the
   `development` export condition, `dist/*.dev.js`): a production build and a page that loads `dist/map-jr-gl.js`
   by URL do not have them. A new check of that kind goes into that file, not into the page script.
7. **State is per map.** No map-specific state at module level, in the page, the engine or the tile workers: two
   maps on one page must not see each other.
8. **Untrusted input.** Styles, TileJSON, tiles, glyph files and GeoJSON come from other parties. Bound sizes,
   handle failure of any one request without stopping the map, and never put their text into `innerHTML`.
9. **Asynchronous steps.** After every `await` in the map, check that the map still exists and that a newer
   request has not replaced this one.
10. **Size.** `pnpm test:size` passes. See below before you touch a budget.
11. **Numbers.** After a change that affects results or sizes, run `pnpm status` (it rewrites the status table in
    the README) and commit the result.
12. **Licence.** `ACKNOWLEDGEMENTS.md` and `THIRD-PARTY-LICENSES.md` are correct when a library is added to the
    built files or a method follows another project. The licence is MIT.

## Writing

Documentation, comments, issue text and messages to the user follow the same rules. The aim is that a developer in
a hurry gets the right answer on the first read.

- **Write complete sentences.** Each sentence has a subject and a verb, and it says one thing. Do not write clipped
  fragments, and do not string short phrases together with commas where sentences belong. For example, write
  "An example has all of its imports and uses a real URL", not a list of three noun phrases.
- **Do not write in slogans.** Avoid the patterns that make text sound generated: groups of three, "no X, no Y"
  constructions, a short punchy sentence after a colon, and a closing line that restates the point. Say the thing
  once, in ordinary words.
- **Start with what the reader needs.** Say what the thing does first, then how to use it, and then the exceptions.
- **Use the active voice and the present tense.** When several items are parallel, use a list or a table instead
  of a long paragraph.
- **Use one name for each thing, and use the standard name.** Write "attribution", "hillshade", "pitch", "hash",
  "popup", "image", "render", "URL", "GPU" and "required", because these are the words that developers search for.
  Do not replace a standard term with a plainer synonym, and do not use two words for one concept. "The
  description" is `MapSpec`; say so once and keep to it.
- **Say which entry** an example or a statement belongs to (`map-jr-gl` or `map-jr-gl/maplibre-compat`).
- **Be exact.** State the default, the unit, what happens on failure and what is not supported. If you did not
  verify a claim, do not write it as a fact.
- **An example must run as it is written.** It has all of its imports, it uses real URLs, and it does not leave out
  setup. `pnpm test:examples` compiles the examples of the gallery.
- **Do not use sales language** such as "blazing", "simply" or "just". Leave out sentences that carry no
  information, and do not apologise.
- **An error or warning message** starts with `[map-jr-gl]`, names the thing by the name that the user wrote, and
  says what to do. For example:
  `[map-jr-gl] update(): the description has no "style". Pass the complete description.`

## The two entries

- `map-jr-gl` (`src/index.ts`, `src/host.ts`): the main API. A map from one description (`createMap`, `update`), a
  state store, queries as promises. New features go here first. The adapters for frameworks are entries of the same
  package (`map-jr-gl/vue` is `src/vue.ts`, `map-jr-gl/react` is `src/react.ts`, the module for Nuxt is
  `src/nuxt.ts`; the owner uses Vue with Nuxt, so Vue comes first).
- `map-jr-gl/maplibre-compat` (`src/maplibre-compat.ts`, `src/compat-map.ts`): a replacement for MapLibre GL JS.
  Things that exist only for that goal go here and not into the core (`src/map.ts`): other names for methods,
  methods with no effect, members that wrappers read, results that are an array and a promise. The conformance
  tools (render tests, example pages, plugins) test this entry.
- The package is version 0.x: the API can change, but a breaking change needs the owner (see above).
- Class names: the library uses `map-jr-*` internally. Elements also carry `maplibregl-*` names for compatibility
  only; do not style or query by those.

## Size

Size is a main advantage of the library, and the owner watches the worker file in particular. `pnpm test:size` has
a budget for each built file.

- Before you raise a budget, look for a way to make the code smaller. Raising one needs the owner.
- The build shortens the names of private class members and of the names in the shaders (see
  `docs/development.md`): declare members `private`, and name uniforms `u_...`.
- Code that only some maps need can be a file that is loaded on demand (`import()`), as `src/hash.ts` and
  `src/pmtiles-info.ts` are.

## Commands

See `docs/development.md`. In short:

| Command | What it does | Needs |
|---|---|---|
| `pnpm build` | Type check, build, type declarations | |
| `pnpm test` | Unit tests, expression and API floors, size budgets, examples, consistency | a build |
| `pnpm test:browser` | The map and the compat entry (`test/interact.mjs`), the main API (`test/host.mjs`) | `pnpm demo` running |
| `pnpm test:vue`, `pnpm test:react` | The adapters | a build |
| `pnpm test:loading`, `pnpm test:cloudflare` | Ways to load the library; the server renderer on Workers | `pnpm demo` running |
| `pnpm test:render` | MapLibre's render tests against a floor (about ten minutes) | a build |
| `pnpm status` | Rewrites the status table in the README | results of the above |

CI runs all of these except `test:cloudflare`. Run locally what your change can affect before you push.

## Checking work

- **Claim only what you verified.** Say "measured" or "ran" only for what you ran, and give the number. Say "not
  checked on a GPU" when that is the case.
- To find faults in common use, run real pages and plugins, not only the test suites. Each of these compares the
  library with MapLibre GL JS and writes its results into `docs/ecosystem.md`:
  `node test/conformance/examples.mjs --write` (the example pages of the MapLibre documentation; about 30 minutes;
  `--filter=<regex>` for a part), `node test/conformance/plugins.mjs --write` (plugins and framework wrappers),
  `node test/conformance/styles.mjs --write` (public styles).
- Do not run `node build.mjs` while a long run (render tests, example pages) reads `dist/`. Use a git worktree for
  parallel work.
- The tests use one tile worker in some places. A fault can need the usual number of workers to show. Also test
  with two maps on one page when you touch shared code.
- The development machine has no GPU: WebGL runs in software, so frame rates measured here are only relative.
  Real numbers come from the owner running `/bench` (an Apple M4 and an iPhone so far).
- Safari on iOS behaves differently from Chromium in places (canvas scaling, OffscreenCanvas in workers). Changes
  to image or canvas handling need a check on a device by the owner.
- For a larger change, ask for an independent review before merging: a reviewer that has not seen your reasoning,
  told to reproduce what it suspects. The reviews of 2026-11-12 found 25 reproducible faults this way.
