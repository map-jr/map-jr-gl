# Contributing

Map Jr. GL is version 0.x and maintained by one person with an AI assistant. Issues and pull requests are welcome;
answers can take time.

## Report a fault or propose a change

Open an issue with the template that fits. For a fault, the most useful thing is the smallest style and code that
shows it, and a comparison with MapLibre GL JS if the result differs. For a security problem, do not open a public
issue: use GitHub's "Report a vulnerability" on the repository.

## Make a change

1. Branch from `main`.
2. Build and test: see [Development](docs/development.md) for the commands. `pnpm build && pnpm test` runs without a
   browser; the browser suites need `pnpm demo` running.
3. Open a pull request. The template lists what "done" means: a test, both entries, every adapter, documentation,
   examples, clear failure messages, and the size budgets.
4. The `CI` workflow must pass. A maintainer merges with squash.

The same rules apply to the AI assistant; they are written out in [CLAUDE.md](CLAUDE.md), including how to write
documentation and messages.

## Priorities

Open issues carry a priority label (`P0` to `P3`) and an area label. `needs: owner` marks a decision that waits for
the owner. Size and speed are the reasons this library exists: a change that grows a built file past its budget
needs a strong reason.

## Licence

MIT. By contributing you agree that your contribution has this licence. If your change follows a method from
another project, name it in `ACKNOWLEDGEMENTS.md`.
