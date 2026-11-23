## What and why

<!-- What changed, why, and the issue it closes (Fixes #…). -->

## How it was checked

<!-- What you ran, with numbers where they matter. Say what was NOT checked (for example: "not checked on a GPU"). -->

## Done when (tick what applies, delete what does not)

- [ ] A test fails without this change and passes with it
- [ ] Both entries considered (`@map-jr/map-jr-gl`, `@map-jr/map-jr-gl/maplibre-compat`)
- [ ] Every adapter has it (Vue prop, React, Svelte) — `pnpm test:consistency` passes
- [ ] Documentation updated (`docs/reference/`, `docs/guide/`, `docs/recipes/`, `docs/reference/maplibre-differences.md`, README)
- [ ] Examples and their comments are still true (seven forms each, and the recipes that show them)
- [ ] A mistake by the user gets a clear message, and no input is ignored in silence
- [ ] No map-specific state at module level; untrusted input is bounded and never reaches `innerHTML`
- [ ] `pnpm test:size` passes, and the bytes before and after are in "How it was checked"
- [ ] `pnpm status` run and committed if results or sizes changed
- [ ] `ACKNOWLEDGEMENTS.md` / `THIRD-PARTY-LICENSES.md` still correct

## Needs the owner?

<!-- Yes if this breaks or renames public API, changes a default, changes the hard line of the size or a ceiling, adds a dependency to the
built files, takes code or a method from a project that is not under a licence listed in CLAUDE.md ("Code and
methods from other projects"), or changes CLAUDE.md, CI or the release process. Otherwise it can
be merged (squash) when CI is green. -->
