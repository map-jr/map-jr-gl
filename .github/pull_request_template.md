## What and why

<!-- What changed, why, and the issue it closes (Fixes #…). -->

## How it was checked

<!-- What you ran, with numbers where they matter. Say what was NOT checked (for example: "not checked on a GPU"). -->

## Done when (tick what applies, delete what does not)

- [ ] A test fails without this change and passes with it
- [ ] Both entries considered (`map-jr-gl`, `map-jr-gl/maplibre-compat`)
- [ ] Every adapter has it (Vue prop, React, Svelte) — `pnpm test:consistency` passes
- [ ] Documentation updated (`docs/api.md`, adapter docs, `docs/maplibre-compatibility.md`, README)
- [ ] Gallery examples and their comments are still true (four forms each)
- [ ] Mistakes fail loudly: a clear message, nothing ignored in silence
- [ ] No map-specific state at module level; untrusted input is bounded and never reaches `innerHTML`
- [ ] `pnpm test:size` passes with no budget raised
- [ ] `pnpm status` run and committed if results or sizes changed
- [ ] `ACKNOWLEDGEMENTS.md` / `THIRD-PARTY-LICENSES.md` still correct

## Needs the owner?

<!-- Yes if this breaks or renames public API, changes a default, raises a size budget, adds a dependency to the
built files, takes a method from another project, or changes CLAUDE.md, CI or the release process. Otherwise it can
be merged (squash) when CI is green. -->
