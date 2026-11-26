# Error codes in production (design for #2148)

This is the design of #2148, which the owner decided on 2026-11-26 (see "Decision"). It is not a page of the user docs.
A message that stays in production prints a short code, such as `[map-jr-gl] E123 https://map-jr.org/e/123`, and the
development build keeps the full text. All numbers are bytes gzip (Node `zlib`, level 9), measured on 2026-11-26 on
`7463900`. The `gzip -9` command gives other numbers for the same files.

## Decision

The owner decided on 2026-11-26 to build the plan of this page, with these choices:

- The configuration warnings of the shared map chunk print a code in production (about 60 bytes).
- The "has no effect" warnings and the checks of `src/mistakes.ts` stay in the development build only.
- `server.js` keeps the full texts.
- The order is #2145 first, then the shared warnings of #2133, and then the steps of the plan below, one pull request
  each.

## How it was measured

1. `pnpm build` on `7463900`.
2. A copy of `scripts/messages.mjs` wrote the 206 messages that it reads in `src/` (file, kind and text) to a JSON
   file. `src/` was not changed.
3. A script read each built file that is not a development file (`*.dev.js` and the chunks that only they import are
   left out). For each message, it searched the fixed pieces of the text (the parts between the placeholders, of 8
   characters or more) in the file. It replaced the longest piece with a code of four characters (`E123`) and removed
   the other pieces, in memory, and compared the gzip size of the file before and after.

The estimate counts only the text. It does not count the helper that adds the link (one function, estimated at
40 to 60 bytes per file that has messages, not measured), and it misses a message whose pieces are all shorter than
8 characters. The scripts are not committed; they can be added to `scripts/messages.mjs` in step 1 of the plan.

## Result

| Built file (production) | Messages | Gzip now | Gzip with codes | Saved | Of the saved bytes, warnings that #2133 (2) and #2145 move to the development build |
|---|---|---|---|---|---|
| `map-jr-gl-map-*.js` (the map chunk that both entries share) | 46 | 42,746 | 41,240 | 1,506 | 507 (10 warnings) |
| `map-jr-gl-maplibre-compat.js` | 29 | 14,771 | 13,890 | 881 | 548 (16 warnings, #2145 is open) |
| `map-jr-gl-host-*.js` | 15 | 8,054 | 7,788 | 266 | 4 |
| `map-jr-gl-controls-more-*.js` | 3 | 4,357 | 4,300 | 57 | 7 |
| `map-jr-gl-worker.js` | 26 | 83,953 | 83,180 | 773 | 0 |
| `server.js` | 39 | 59,364 | 58,117 | 1,247 | 127 |
| Chunks and worker parts on demand (engine, placement, dem, video, styles control, style, expr, pmtiles, tile fetch, and others) | 37 | | | 1,567 | 0 |
| `vue.js`, `controls.js`, `nuxt.js` | 3 | | | 176 | 74 |
| `map-jr-gl-standalone.js` | 140 | 376,427 | 369,829 | 6,598 | 584 |
| `map-jr-gl-maplibre-compat-standalone.js` | 91 | 361,862 | 356,513 | 5,349 | 909 |

For the download that `scripts/size-check.mjs` checks (the page script up front and the worker):

| Entry | Download now | Saved with codes | Saved after #2133 (2) and #2145 have merged |
|---|---|---|---|
| `@map-jr/map-jr-gl` | 135,630 | 2,545 (host 266, map chunk 1,506, worker 773) | about 2,030 |
| `@map-jr/map-jr-gl/maplibre-compat` | 146,239 | 3,217 (compat 881, map chunk 1,506, controls 57, worker 773) | about 2,150 |

The warnings that #2133 (2) and #2145 move leave production anyway, so the saving that codes add on top of those
changes is about 2.0 KB for the main entry and 2.2 KB for the compat entry. Of that, 773 bytes are in the worker.
The class of each warning here follows the words of its text; the pull request of #2133 (2) gives the final list.

## How a user looks up a code

- **The message.** In production, a message prints `[map-jr-gl] E123 https://map-jr.org/e/123` and the values of its
  placeholders, for example `[map-jr-gl] E123 https://map-jr.org/e/123 source="roads"`. The values stay, because the
  user needs to know which source or layer is meant, and they cost no text in the built file. An `Error` thrown in
  production has the same text as its `message`, so code that catches it can still read the code.
- **The page.** `scripts/messages.mjs --write` generates `docs/reference/messages.md` from `src/`: one row per code
  with the full text, the kind (error or warning) and the entry. The docs site serves each code at `/e/<number>`,
  which redirects to the row. The page is a reference page in the sense of `docs/style-guide.md`.
- **The development build** prints the full text and the code, so that a developer can search for either.

## What users lose

- **A log read without network,** for example on a device or in a log file of a server. The code is not readable
  there. The package can ship `dist/messages.json` (code to text; not loaded by any page) so that a user or a tool can
  look up the code offline.
- **The server renderer** (`server.js`) runs where logs are read later and often without a browser. It saves
  1,247 bytes, and no limit is near (59.4 KB of 64.0 KB). The proposal keeps full texts in `server.js`.
- **The worker** has no development build. With codes, its messages show only codes in development too, unless the
  development build gets a worker of its own (one more built file and one more step of the build). The worker saves
  773 bytes. The proposal gives the worker codes and lets the page add the text: the page of the development build
  relays the warnings of the worker already (`pageWarn` in `src/map.ts`), and it can look up the code there.
- **The standalone bundles** are not loaded by a usual page, and their size has no limit near. They can keep full
  texts.
- **Search engines and issue reports.** A user who pastes the text of a message into a search finds the reference
  page only by its code. The page has the full texts, so a search for the code finds it.

## How `pnpm test:consistency` keeps codes unique and stable

- The code of a message is written in `src/` next to its text, for example `warnOnce('E123', '…')`, so that the
  build can drop the text in production and the script reads both.
- `scripts/messages.mjs --check` fails when two messages have the same code, when a message has no code, or when a
  code of `docs/reference/messages.md` is missing from `src/`. A code that is removed stays in the page as "removed in
  <version>", so that a link in an old log still works, and the script fails when a removed code is used again.
- A new code takes the number of its issue, as the texts of `src/mistakes.ts` do, so that two branches do not take
  the same number.
- `scripts/messages.mjs --check` fails when `docs/reference/messages.md` differs from what `--write` makes.

## Messages that are in the development build only today

The owner asked whether these should print a code in production too. A code costs a few bytes where the text costs
many, but the check that finds the mistake must also be in production, and for most of these the check is the
larger part.

| Kind | Messages | Where | Would a production user gain from a code? | Cost of codes in production |
|---|---|---|---|---|
| Checks of common mistakes of the main API | 58 | `src/mistakes.ts` (a chunk of the development build) | Little. These are mistakes that a developer makes while writing the code, and the development build shows them. | The checks would load in production: the chunk is 15,249 bytes with codes instead of text (16,951 with text). |
| "Has no effect" warnings of the compat entry (#2145) | 16 | `src/compat-map.ts`, `src/maplibre-compat.ts` | Little. The option has no effect in production either, and nothing goes wrong at run time. | 34 bytes for the codes in `map-jr-gl-maplibre-compat.js`, plus the conditions that #2145 removes (not measured). |
| No-effect and configuration warnings of the map chunk (#2133 (2)) | 10 | `src/map.ts`, `src/loader.ts`, `src/resolve.ts`, `src/controls-more.ts` | Some. A configuration that differs between development and production (`pixelRatio`, `maxPitch`, `workerUrl`, a style with an unsupported projection or layer type) shows only in production. | 23 bytes for the codes in the map chunk and 4 in `controls-more`, plus the conditions (not measured). |

The cost of the codes is the difference between the file with codes for these messages and the file without the
messages, in memory as above. Recommendation: keep the checks of `src/mistakes.ts` and the no-effect warnings of the
compat entry in the development build only. Give codes in production to the configuration warnings of the map
chunk whose cause can be in production only (a style or a URL that the server gives), at about 30 bytes. The owner
accepted this recommendation (see "Decision").

## Ideas from nostics.dev

nostics.dev documents `nostics`, an MIT library for catalogs of diagnostic codes. This page follows some of its ideas;
it copies no text or code from it.

- An `Error` thrown in production carries the code in its `name` as well as in its `message`, so that code which
  catches it can test the code without parsing text (step 2).
- The page of a code is in the HTML of the response, with the code in its title, and a code that does not exist
  answers 404, so that a tool that follows the link from a log can tell the two apart (step 3, changed).
- The page of a code puts what to do first and the cause after it (step 3, changed).
- A link that a release has printed keeps working after the code is removed (already in the rules above).

## Plan

The plan starts after #2145 and the pull request of #2133 that moves the shared warnings have merged. Each step is one
pull request.

1. Extend `scripts/messages.mjs`: `--write` generates `docs/reference/messages.md` and `dist/messages.json`, and
   `--check` checks the codes. Add a code to every message of `src/` (no change of behavior). The configuration
   warnings of the map chunk that #2133 keeps in production get a code too.
2. Add the production form: the build replaces the text with the code in production files except `server.js` and the
   standalone bundles (a define or a small
   plugin of `build.mjs` keyed on the helper calls), and the helper adds the link. The pull request gives
   `pnpm test:size` before and after.
3. Serve `/e/<number>` on the docs site as a page of its own in the HTML of the response, with the code in the
   title, what to do first, and then the cause. A code that does not exist answers 404.
4. The worker: the page of the development build looks up the code of a worker message and prints its text.
5. Update `docs/reference/maplibre-differences.md` (MapLibre GL JS prints full texts) and the guide on errors.

Steps 2 and 4 change what users see in production, so each needs the owner.
