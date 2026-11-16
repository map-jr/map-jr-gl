# Brief for a worker on one issue

You are one of several workers, each in its own git worktree. `CLAUDE.md` has the rules (definition of done,
writing); this brief has the steps.

## Steps

1. Read the issue: `gh api repos/map-jr/map-jr-gl/issues/N` (and `…/N/comments`), or `mcp__github__issue_read`
   where `gh` is missing. Start at the files and lines that your prompt names; do not survey the repository. Check
   that the fault is still on `origin/main`. If it is fixed, change nothing and report the commit.
2. `git fetch origin main && git checkout -b <branch> origin/main && pnpm install --frozen-lockfile`.
3. Make the smallest change that resolves the issue, with a test that fails without it. Do the parts that your
   prompt names, and leave out a part that is large or needs the owner.
4. Run the new test against the code without the fix, and give both results in the report:
   `node scripts/agents/without-fix.mjs -- <command>`. It runs the command in a temporary copy where `src/` is as on
   `main` and removes the copy afterwards. Do not use `git stash`.
5. Run `pnpm build && pnpm test`. When the change can affect a browser test, run the suite that covers it:
   `node scripts/agents/suite.mjs test/host.mjs` (or `test/interact.mjs`, `test/vue.mjs`, `test/react.mjs`,
   `test/loading.mjs`). It builds what is stale, starts its own demo server on a free port, prints the counts and
   the `FAIL` lines, and stops the server. When Playwright is missing, it prints the command that installs it. Do
   not run `pnpm test:render` or the conformance tools; CI runs them.
6. Commit, `git push -u origin <branch>`, and open a pull request against `main`
   (`gh pr create --repo map-jr/map-jr-gl --base main`) that follows `.github/pull_request_template.md`, says
   `Fixes #N` (or `Part of #N`), and ends with the attribution line that your session instructions give. Then stop.
   The coordinator may send you a CI failure to fix on the same branch.

## Rules

- A new text or check kind of `src/mistakes.ts` takes the number of its issue (the comment above `texts[30]` says
  how). Do not take the next free number: another branch takes it too.
- A test that fails locally but passes in the `checks` and `browser` jobs of `main` is load on this machine. Say so
  in the report, and do not change the test for it. A test that fails in CI too is a fault.
- Start the name of each file that you write to the shared scratchpad with your branch name.
- Do not leave a process running when you stop. `suite.mjs` stops its server; stop any server that you start
  yourself in the same command.

## On the owner's Mac (`uname` prints Darwin)

- The shell sets `BROWSER=open` (`suite.mjs` uses `chromium` then; other commands need `BROWSER=chromium`), aliases
  `cp` to `cp -i` (write `command cp`), and sets `noclobber` (write `>|` to replace a file).
- Headless Chromium draws WebGL in software. Playwright's WebKit draws on the GPU.
- An iOS Simulator can open a page of your server: `xcrun simctl openurl booted http://localhost:<port>/…`.

## Report (your final message; at most 12 lines, no preamble)

- PR: <url>
- Changed: <one or two sentences>
- Ran: <commands and results with numbers, including the run without the fix>
- Size: <bytes gzip of each built file that changed, before and after, from `pnpm test:size`>
- Not checked: <what>
- Needs owner: <no | yes, because …>
- Left out / found: <parts of the issue not done; faults seen elsewhere, one line each>
