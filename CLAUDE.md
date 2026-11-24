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
- **A question for the owner goes through the question tool (`AskUserQuestion`), not into the text of an update.**
  Use it for every decision that the owner must make while other work goes on: a pull request that waits for the
  owner, a recommendation to accept, a number to choose. A question in an update is hard to find again and hard to
  answer in a short reply.
  - Each question stands on its own. It names the issue or the pull request, gives the facts and the numbers that the
    decision needs, and has the options with the recommended one first. It does not refer to an earlier message.
  - Ask as soon as the work that does not depend on the answer is started, and ask several open decisions in one
    call (it takes up to four). Carry on with the other work.
  - Write the answer into the issue (the line "Decision") before you act on it.
  - Where the tool is missing, end every update with the heading "Waiting for you" and each open question in full,
    also the ones from earlier updates.
  - A worker does not ask the owner. It writes "Needs owner" in its report, and the coordinator asks.

## Issues

- **An issue has one fault or one decision,** so that one pull request closes it. Two faults that were found
  together are two issues, unless one fix of a line or two covers both.
- **Search before you file** (`gh issue list --search`). A fault that has an issue gets no second one.
- **The title names the thing and the fault in about 80 characters.** It does not list, and it does not say who
  found it.
- **The body has these fields and nothing else:**
  - **Fault:** what happens and what should happen, in one or two sentences, with the entry. A proposal has
    **Proposal** in its place.
  - **Where:** `file:line`, or the command that shows it.
  - **Evidence:** "ran", "measured" (with the number) or "read". An issue that was only read has the label
    `unverified`.
  - **Done when:** the check that closes it.
  - **From:** the issue or pull request where it was found.
- **The body is the current state.** When the state changes, edit the body. A comment is for a decision of the
  owner or for new evidence, with the date, in one paragraph.
- **A table of measurements or a design goes into the pull request or a file of `docs/`.** The issue has the result
  in one line and the link.
- **A check that fails in some runs has one issue.** A new sighting adds one line (date, job) to the body.
- **A tracking issue is a list of links to issues.** It has no fault of its own, and it is the only kind of issue
  that a pull request names with `Part of`.

## Branches, pull requests and merging

- **Every change goes through a pull request.** Branch from `main` (`fix/…`, `feat/…`, `docs/…`), push, open a pull
  request that says what changed and why, and names the issue (`Fixes #12`).
- **The `CI` workflow must pass:** `checks`, the four `browser-*` jobs (or their skip, which the job `changes`
  decides) and `render`. The summary job `browser` only checks that these passed, and it often waits ten minutes for a
  runner, so a merge does not wait for it. Do not merge on red, and do not lower a floor or skip a test to get green:
  fix the cause, or say in the pull request why the floor moves.
- **Merge with squash** once CI is green — you may merge your own pull request, **except** when the change does one
  of these. Then leave it open and ask the owner:
  - removes or renames public API of either entry, or changes a default;
  - changes the hard line of the size or a ceiling in `scripts/size-check.mjs` (see "Size");
  - adds a dependency to the built files, or takes code or a method from a project whose license is not on the list
    in "Code and methods from other projects";
  - changes this file or the release process (the workflow `Release` included);
  - changes what the CI workflows check: removes or skips a job or a test, lowers a floor, or makes a job pass when
    a check fails. A change of how a workflow runs needs no owner: a retry, a cache, a timeout, a version of a tool
    or of an action, or the order of steps. Its pull request says why the change is needed;
  - is labeled `needs: owner`.
- **Before version 1.0, a correction does not need the owner.** A change that makes the types stricter, or that
  corrects a result, so that an entry agrees with its documentation or with MapLibre GL JS can be merged on green CI,
  even when code that compiled or ran before can break. The pull request lists what can break.
- **Releases.** After a batch with changes that users see, the coordinator may open and merge a release pull
  request (see "How a release is made" in `docs/development.md`). The version follows the table in "The version
  number" in `docs/development.md`: while the version is 0.x, a breaking change increases the second number, and
  any other change increases the third. The workflow `Release` does the rest
  when the pull request is merged. A release never goes out while `CI` is red on `main`.
- **A pull request has one concern.** A fix and its test belong together. An unrelated cleanup goes into its own
  pull request.
- After a merge, the `Browsers` workflow measures and tests in Chromium, Firefox and WebKit on three systems. Read
  its results (`git fetch origin bench-results && git show origin/bench-results:README.md`) before you ask the
  owner to test on a device.
- The same workflow can run Safari itself on a macOS runner, but only when it is started by hand (the inputs
  `safari`, `safari_only` and `simulator`; see `docs/development.md`). Start it when a change touches the choice of
  the renderer, the workers or the canvas, and read its results before you ask the owner to test in Safari. On that
  runner the worker renderer loads but takes several seconds to reach `idle` (5.8 s against 1.25 s on the main
  thread on 2026-11-14), while an iPhone shows no such gap, and the frame rates mean little: a slow or failing worker
  scenario there is not a fault of the change.

## Working with several workers

One session can act as the coordinator and give issues to workers (subagents). This file is loaded into every
worker, so it has only the rules. The brief that every worker reads is `docs/agents/worker-brief.md`, and the notes
for the coordinator are `docs/agents/coordinating.md`. Read the notes before you start a batch.

- **A worker gets one issue and one branch.** Its prompt is the path of the brief and four lines: the issue, the
  branch, the scope, and the files and lines where the work starts.
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
3. **Every adapter.** A new field of the description (`MapDescription`) is a prop of the Vue component and reaches React
   and Svelte. `pnpm test:consistency` fails if the Vue prop or the documentation is missing.
4. **Documentation.** `docs/reference/` for each function, field, event and type (`description.md`, `map.md`,
   `vue.md`, `react.md`, `svelte.md`, `element.md` and the others), `docs/guide/` or `docs/recipes/` when a task
   changes, and `docs/reference/maplibre-differences.md` when behavior differs from MapLibre (including anything
   accepted that has no effect). If the README shows it, update the README.
5. **Examples.** An example has seven forms in `examples/` (`.js`, `.compat.js`, `.vue`, `.nuxt.vue`, `.jsx`,
   `.svelte`, and `.html` for `<map-jr>`), each complete on its own, and its recipe in `docs/recipes/` shows them.
   Comments in examples must stay true: reread them when behavior changes.
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
10. **Size.** `pnpm test:size` passes, and the pull request says what the change adds. See "Size" below.
11. **Numbers.** After a change that affects results or sizes, run `pnpm status` (it rewrites the status table in
    the README) and commit the result.
12. **License.** `ACKNOWLEDGEMENTS.md` and `THIRD-PARTY-LICENSES.md` are correct when a library is added to the
    built files or a method follows another project. The license is MIT.

## Code and methods from other projects

A change may follow a method of another project, or copy its code, texts or CSS, without the owner when all of the
following are true. Otherwise leave the pull request open and ask the owner.

- **The license is permissive:** MIT, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD, Apache-2.0, or public domain (CC0,
  Unlicense). Read the license file of the project at the version that you use. Do not copy from GPL, LGPL, AGPL,
  MPL or CC BY-SA sources (CC BY-SA includes answers on Stack Overflow), or from code that has no license.
- **`ACKNOWLEDGEMENTS.md` names it.** The line names the project, its license and what follows it (the method, the
  texts, the CSS), and says whether the code in this library is new or copied.
- **Copied text keeps its notice.** When code, texts or CSS are copied or closely translated, and not only the method
  is followed, `THIRD-PARTY-LICENSES.md` has the license text of the project with its copyright line. The package
  publishes that file with the built files. This meets the condition of MIT, ISC and BSD that the notice goes with
  every copy, a minified one included. For Apache-2.0, also copy the project's `NOTICE` file if it has one, and say in
  the file that the code was changed.
- **No endorsement.** Do not use the name of the project or of its authors to promote this library (the third clause
  of BSD-3-Clause). Naming them in the acknowledgements and in `docs/reference/maplibre-differences.md` is fine.

Copyright protects the expression of code, and not an idea, an algorithm or a formula. New code that implements a
method (for example the curve of `flyTo`) needs only the line in `ACKNOWLEDGEMENTS.md`. A library that the built files
contain is a dependency, and it still needs the owner. This section is general guidance, not legal advice; ask the
owner when a case is unclear.

## Writing

Documentation, comments, issue text and messages to the user follow the same rules. The aim is that a developer in
a hurry gets the right answer on the first read.

What belongs on a page of the user docs, the page types and their templates are in `docs/style-guide.md`. Read it
before you write or change a page of the docs or a TSDoc comment on a public type.

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
  description" is `MapDescription`; say so once and keep to it. Use US spelling ("color", "behavior", "gray",
  "center", "license", "initialize"); names of code, CSS and the style specification stay as they are.
- **Say which entry** an example or a statement belongs to (`@map-jr/map-jr-gl` or `@map-jr/map-jr-gl/maplibre-compat`).
- **Be exact.** State the default, the unit, what happens on failure and what is not supported. If you did not
  verify a claim, do not write it as a fact.
- **An example must run as it is written.** It has all of its imports, it uses real URLs, and it does not leave out
  setup. `pnpm test:examples` compiles the examples of `examples/`.
- **Do not use sales language** such as "blazing", "simply" or "just". Leave out sentences that carry no
  information, and do not apologize.
- **An error or warning message** starts with `[map-jr-gl]`, names the thing by the name that the user wrote, and
  says what to do. For example:
  `[map-jr-gl] update(): the description has no "style". Pass the complete description.`

## The two entries

- `@map-jr/map-jr-gl` (`src/index.ts`, `src/host.ts`): the main API. A map from one description (`createMap`, `update`), a
  state store, queries as promises. New features go here first. The adapters for frameworks are entries of the same
  package (`@map-jr/map-jr-gl/vue` is `src/vue.ts`, `@map-jr/map-jr-gl/react` is `src/react.ts`, the module for Nuxt is
  `src/nuxt.ts`; the owner uses Vue with Nuxt, so Vue comes first).
- `@map-jr/map-jr-gl/maplibre-compat` (`src/maplibre-compat.ts`, `src/compat-map.ts`): a replacement for MapLibre GL JS.
  Things that exist only for that goal go here and not into the core (`src/map.ts`): other names for methods,
  methods with no effect, members that wrappers read, results that are an array and a promise. The conformance
  tools (render tests, example pages, plugins) test this entry.
- The package is version 0.x and the library is before its public release. A change of the API does not need to
  protect existing users: remove or rename the old form in the same change, with no deprecation warning and no period
  in which both forms work. A breaking change still needs the owner (see above), and the pull request lists what
  breaks.
- Class names: the library uses `map-jr-*` internally. Elements also carry `maplibregl-*` names for compatibility
  only; do not style or query by those.

## Size

Size is a main advantage of the library, and the owner watches the worker file in particular. Since 2026-11-14 a
fast time to idle (the map drawn and ready) comes before the size of the files that load up front. Think about both
in every change, and do not spend an hour to save 50 bytes.

- **Say what a change adds.** `pnpm test:size` prints the bytes (gzip) of each built file. A pull request that
  changes `src/` gives the numbers before and after in "How it was checked". A change that adds more than about
  0.3 KB to a page script, or 1 KB to the worker file, says why the bytes are worth it.
- **Do not make a usual map wait for a request.** Code that a usual map needs at the start stays in the files that
  load up front, even when moving it to a file loaded on demand would save bytes: each such file is one more request
  before the map is ready. A change that makes the map idle sooner can add bytes, and its pull request gives the time
  to idle before and after.
- **Load on demand what only some maps need.** Code that only some maps need is a file that is loaded on demand
  (`import()`), as `src/hash.ts` and `src/pmtiles-info.ts` are. Code that only a developer needs (checks for
  mistakes, long messages) goes into the development build (`src/mistakes.ts`). The build shortens the names of
  private class members and of the names in the shaders (see `docs/development.md`): declare members `private`, and
  name uniforms `u_...`.
- **The hard line is a third of MapLibre GL JS.** The page script that loads up front and the worker file together
  stay under a third of what MapLibre GL JS downloads (its page script, its worker and its CSS), for each entry.
  `scripts/size-check.mjs` computes the limit from the installed MapLibre GL JS, so the limit does not rise, and the
  owner does not raise it. The other built files have wide ceilings that only catch an accident. The line is not a
  target: keep each change as small as it can be, and do not rewrite working code to save a few bytes.
- **When the download comes within 5 KB of the line,** tell the owner, and start the pass for savings before more
  features merge.
- **Savings are found in one pass before a release,** not in each pull request: one worker reads the built files for
  what is large or repeated, and its pull request has only that concern. Write a saving that you notice during
  other work into the issue for that pass.

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
- **To show the owner a branch on a phone,** serve the demo and open a quick tunnel to it. The tunnel gives a public
  URL with no account, and anyone with the URL reaches the server, so stop both when the owner is done.
  - `pnpm build`, then `PORT=8000 node demo/serve.mjs` in the background, in the worktree of the branch.
  - `cloudflared tunnel --url http://localhost:8000` in the background. It prints `https://<words>.trycloudflare.com`
    within a few seconds (`cloudflared` is installed with Homebrew on the owner's Mac).
  - The new hostname can take a minute to resolve on the Mac, while the phone resolves it at once. To check it from
    the Mac, resolve it through `1.1.1.1`: `curl --resolve <host>:443:$(dig +short <host> @1.1.1.1 | head -1) https://<host>/`.
  - The demo's `/style.json` names the host that the page came through, so tiles load through the tunnel (#910).
    Pages of the demo: `/?sky&pitch=85`, `/bench`; the playground of the docs site (`https://map-jr.org/play`) needs no tunnel.
- For a larger change, ask for an independent review before merging: a reviewer that has not seen your reasoning,
  told to reproduce what it suspects. The reviews of 2026-11-12 found 25 reproducible faults this way.
