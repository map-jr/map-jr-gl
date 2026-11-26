# Brief for a worker on one issue

You are one of several workers, each in its own git worktree. `CLAUDE.md` has the rules (definition of done,
writing); this brief has the steps.

## Steps

1. Read the issue: `gh api repos/map-jr/map-jr-gl/issues/N` (and `…/N/comments`), or `mcp__github__issue_read`
   where `gh` is missing. Start at the files and lines that your prompt names; do not survey the repository. Check
   that the fault is still on `origin/main`. If it is fixed, change nothing and report the commit.
   For an issue with the label `unverified`, reproduce the fault before you build, and read what MapLibre GL JS does
   in `node_modules/maplibre-gl/dist/maplibre-gl-dev.mjs`: an issue can name a property that MapLibre GL JS declares
   and never reads (#1692, #1695), or the reverse of the fault (#1735). Report another cause; do not build to the text.
2. `git fetch origin main && git checkout -b <branch> origin/main && pnpm install --frozen-lockfile &&
   pnpm install --frozen-lockfile --dir website`. The packages of `website/` take about 5 s, and without them
   `pnpm test` fails in `comment-reflow.test.ts` and `pnpm test:consistency` checks less than CI does (#1296).
3. Make the smallest change that resolves the issue, with a test that fails without it. Do the parts that your
   prompt names, and leave out a part that is large or needs the owner.
4. Run the new test against the code without the fix, and give both results in the report:
   `node scripts/agents/without-fix.mjs -- <command>`. It runs the command in a temporary copy where `src/`,
   `build.mjs` and `scripts/private-names.mjs` are as on `main` (`--paths` changes the list), builds the copy first
   (`--no-build` skips that), links the folders of `.cache/`, and removes the copy afterwards. The arguments reach
   the command without a shell, so `-- sh -c '…'` keeps its quoting. Do not use `git stash`.
5. Run `pnpm build && pnpm test`. When the change can affect a browser test, run the suite that covers it:
   `node scripts/agents/suite.mjs test/host.mjs` (or `test/interact.mjs`, `test/vue.mjs`, `test/react.mjs`,
   `test/loading.mjs`). It builds what is stale, starts its own demo server on a free port, prints the counts and
   the `FAIL` lines, and stops the server. When Playwright is missing, it prints the command that installs it.
   At most two suites run at once on one machine, over all worktrees. A suite that must wait prints
   `suite.mjs: waiting for a free slot` and starts when a slot is free.
   A demo server that you start yourself (`PORT=… node demo/serve.mjs`) gets a port of its own, and you stop it by
   its process id. Do not use `pkill -f demo/serve.mjs` or a similar pattern: it also stops the servers of the suites
   of other workers on the machine.
   A change of placement, of the engine or of `src/gl.ts` runs both `test/host.mjs` and `test/interact.mjs`, because
   CI runs both (#1074).
   Before a push, also run `pnpm test:consistency`. It runs `scripts/messages.mjs --check`, which checks each message
   text of `src/`.
6. When the change can change what a map draws (a style property, placement, a shader, the building of tiles), run
   the render tests of the groups that it touches with and without the change
   (`node test/conformance/render.mjs --filter='<regex>'`), and give the counts of match, near and differ. The run
   prints `WORSE:` for a test that is worse than its line in `test/conformance/render-tests.json` and `BETTER:` for a
   test that is better, and it fails when a test is worse. To record the tests that your change moves, run the same
   command with `--write`: it rewrites the lines of the tests of that run in `render-tests.json` and leaves the other
   lines as they are. Commit that file; a full run is not needed, and no total or floor is committed (the floor is the
   count of lines `match`; #1915). A line gives the status that the render job of CI gives, and a run on another
   machine can differ for a test near a limit: check such a test alone (`--filter='^<id>$' --list` prints its
   percentage), and take its line from the `BETTER:` or `WORSE:` lines of CI when the two differ. `--write` does not
   write a line that is worse (match to near or differ, near to differ, any to error or skipped) unless
   `--lower=<id,id>` names the test. A pull request that commits a worse line lowers the floor: give the reason in it,
   leave it open, and write "Needs owner" in your report. The one exception is a line from `near` to `differ` that
   meets every condition of "A worse line of a render test that needs no owner" in `docs/development.md`: list it with its
   percentages on `main` and on the branch (three runs each) and the issue of the fault under it, and write
   "Needs owner: no (worse line within 0.5 points)".
   Run render tests and pixel checks on the Chromium build that CI uses, which is the build that the installed
   Playwright pins. The cloud VM has an older build in `/opt/pw-browsers`, which `test/launch.mjs` takes when the
   pinned build is missing, and that build counts some tests differently (`text-local-glyphs/cjk` is a match there
   and near in CI; #1483). Install the pinned build once with
   `PLAYWRIGHT_BROWSERS_PATH=/home/user/map-jr-gl/.cache-pw pnpm exec playwright install chromium` (about a minute),
   and set the same `PLAYWRIGHT_BROWSERS_PATH` for every run. A full run writes the two result files only on the
   pinned build. Do not run the other conformance tools (example pages, plugins, styles) unless your prompt
   asks.
7. Commit, `git push -u origin <branch>`, and open a pull request against `main`
   that follows `.github/pull_request_template.md`, says `Fixes #N`, and ends with the attribution line that your
   session instructions give. In a cloud session use `gh api repos/map-jr/map-jr-gl/pulls -f title=… -f head=<branch>
   -f base=main -F body=@file`, because `gh pr create` needs GraphQL, which is blocked there. Elsewhere
   `gh pr create --repo map-jr/map-jr-gl --base main` works. Write `Part of #N` only when
   your prompt says that the issue is a tracking issue. Then stop.
   The coordinator may send you a CI failure to fix on the same branch.

## Rules

- Put a new check of `test/interact.mjs` or `test/host.mjs` next to the checks of the same feature, not at the end of
  a section: checks that several pull requests add at the same line conflict with each other.
- Do not write "close", "closes", "fix" or "fixes" before an issue number in the body of a pull request unless that
  pull request closes it: GitHub reads "does not close #N" as a closing keyword (#1602 was closed this way).
- A fault that your own change causes is not a "Found" line: fix it in your pull request, with a check (#1071).
- Measure the size before the change on `origin/main` (`pnpm test:size` in the copy of `without-fix.mjs`, or in a
  worktree of `origin/main`); do not write "not measured".
- A file with the decision `wontfix` in `test/conformance/render-expectations/` needs the owner: write it under
  "Needs owner".
- A new text or check kind of `src/mistakes.ts` takes the number of its issue (the comment above `texts[30]` says
  how). Do not take the next free number: another branch takes it too.
- A test that fails locally but passes in the `checks` and `browser` jobs of `main` is load on this machine. Say so
  in the report, and do not change the test for it. A test that fails in CI too is a fault.
- Bring your branch up to date with `node scripts/agents/merge-main.mjs`, not with a bare `git merge origin/main` or a
  rebase that squashes it into one commit. The script merges `origin/main`, writes again each generated block or
  file that is in conflict (the reference tables, the recipes, the lines of `render-tests.json`), commits the merge, and stops
  with a list of the files when a conflict is outside generated text (#1863). It runs the copy of itself that `main`
  has (#1928). A branch from before that change runs the copy of `main` by hand with
  `git fetch origin main && git show origin/main:scripts/agents/merge-main.mjs | MERGE_MAIN_RUN=1 node --input-type=module -`.
  After a merge, a rebase or a
  force-push, check that `git diff origin/main...HEAD -- src` has only your lines.
- Two switches help to reproduce faults in Chromium: `CPU_THROTTLE=<rate>` (in `test/host.mjs` and
  `test/interact.mjs`) slows the page as a loaded CI runner does, and `NO_WORKER_WEBGL=1` (in `test/launch.mjs`)
  takes WebGL away from workers, as in WebKit on Linux and Windows.
- `node test/conformance/render.mjs --help` prints its options. An argument that it does not know, or `--list`
  without `--filter`, stops it with that text.
- `gh pr edit` fails on this repository; change the body of your pull request with
  `gh api -X PATCH repos/map-jr/map-jr-gl/pulls/N -F body=@file`. In cloud sessions GraphQL is blocked, so
  `gh issue view`, `gh pr view` and `gh pr list` fail too: use `gh api` REST for everything.
- A check that navigates uses its own page, so that it does not break the checks after it. A check waits for the
  value that it measures, not for a proxy of it (a label, "non-empty", an earlier state; #1366 took three rounds this
  way). `pnpm test:consistency` warns when a new check compares a measured time with a fixed upper bound
  (`scripts/timing-lint.mjs`, #1930), because a loaded CI runner takes longer than this machine. For a fix of a check that fails in some runs, ask in the pull request for three runs of its CI job.
- An error in a run of the script that you changed is not "the network" until it reproduces on `main`.
- A "Found" line marked "read" is a hypothesis: check its premise with one command before you write it.
- A worker has no Agent tool. A task that needs an independent agent run (the migration prompt of #1122, a review)
  is started by the coordinator: prepare the inputs (a baseline project, a checker script) and hand them back.
- Make an extra worktree with `git worktree add` under `.claude/worktrees/`, so that
  `scripts/agents/clean-worktrees.mjs` finds it.
- To compare the look of your branch with `main` and MapLibre GL JS, run `node scripts/agents/compare.mjs <your worktree>`
  in a built checkout of `main`; `--shots <dir>` writes the screenshots of three maps side by side.
- For a change of the look, the pull request has screenshots of what users see first (JavaScript off, or before the
  map loads) at 390, 1024 and 1440 px, and a geometric check of one known feature before and after.
- Start the name of each file that you write to the shared scratchpad with your branch name.
- Do not leave a process running when you stop. `suite.mjs` stops its server; stop any server that you start
  yourself in the same command.

## On the owner's Mac (`uname` prints Darwin)

- The shell sets `BROWSER=open` (`test/launch.mjs` and `suite.mjs` use `chromium` then), aliases
  `cp` to `cp -i` (write `command cp`), and sets `noclobber` (write `>|` to replace a file, and `2>|` for the error
  output).
- Run each suite with `SUITE_SLOTS=4`. A suite takes 13 to 30 minutes while other workers build, so start it in the
  background and go on with what does not need its result.
- Headless Chromium draws WebGL in software. Playwright's WebKit draws on the GPU.
- An iOS Simulator can open a page of your server: `xcrun simctl openurl booted http://localhost:<port>/…`.

## Report (your final message; at most 12 lines, no preamble)

- PR: <url>
- Changed: <one or two sentences>
- Ran: <commands and results with numbers, including the run without the fix>
- Size: <bytes gzip of each built file that changed, before and after, from `pnpm test:size`>
- Not checked: <what>
- Needs owner: <no | yes, because …>
- Left of the issue: <the text that the body of the issue should have after the merge, or "nothing">
- Found: <faults seen elsewhere, one line each: a title of about 80 characters | `file:line` | "ran" or "read">
