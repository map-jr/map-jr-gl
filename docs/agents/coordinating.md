# Notes for a coordinator of several workers

A coordinator is a session that gives issues to workers (subagents) and merges their pull requests. The rules are in
`CLAUDE.md`; the brief that each worker reads is `docs/agents/worker-brief.md`. Change the brief or these notes when
a batch shows a fault in them.

## Before a batch

- **Triage first.** An issue can be older than `main`. A read-only triage worker checks the issues for about 7,000
  tokens each and returns one table: what is still open, the file and line where the work starts, a rough size, and
  whether the owner is needed. A worker that finds its issue already fixed has spent about 80,000 tokens on it.
  Triage reads and does not run, so the brief still makes each worker check its issue on `main`. Triage also issues
  that were filed the same day: on 2026-11-17 a round without triage gave #683 to a worker, although #446 had fixed
  it, and #753 did not reproduce.
- **The table of triage has a column "checked by"** for each row (#1931). Its value is "ran" when a command reproduced
  the fault, "read" when only the code of this library was read, and "MapLibre read" when the source of MapLibre GL JS
  was also read for what it does. The coordinator then sees which rows are hypotheses.
- **An issue that was read and not run can name the wrong cause.** Of sixteen issues of the triage of 2026-11-24 that
  workers took up, five had another cause than their text: two named a property that MapLibre GL JS declares and never
  reads (#1692, #1695), one fault was the reverse of its title (#1735), and two had their cause in another part of
  the code (#1827 in the reading of GeoJSON rings, #1828 in the tile levels of the globe). For an issue with the label `unverified`, the prompt of the worker says: reproduce it on `main`,
  and read in `node_modules/maplibre-gl/dist/maplibre-gl-dev.mjs` what MapLibre GL JS does, before you build. Correct
  the title and the body of the issue when the report names another cause.
- **Choose issues that do not share lines.** Give two issues on the same function to one worker after the other.
  When most issues change one file (`src/host.ts` on 2026-11-16, where six of nine pull requests needed a merge of
  `main`), merge the pull request that has waited longest first.
- **Hold back a change that touches most files** (a rename across the documents) until no other pull request is open.
- **Ask the owner early** for what blocks a chain of issues: a breaking change, a budget that the open pull requests
  together come near.
- **Move your checkout to `origin/main`** (`git fetch origin && git checkout --detach origin/main`) before you start
  workers and after a change of the brief: a worktree starts from the coordinator's checkout, not from `origin/main`.

## The prompt of a worker

```
First read docs/agents/worker-brief.md and follow it.

Issue: map-jr/map-jr-gl#20 (After `refreshTiles`, queries can return the old tile).
Branch: fix/20-query-after-refresh
Scope: the whole issue. Triage found it open, starting at `src/engine.ts:793,814` and `src/tiles.ts:22,108,131`.
Keep out of: `src/compat-map.ts` (another worker, #7).
```

- **A bundle** (up to four small fixes of tests or of the agent tools, no change of `src/`; #1603) is one worker and
  one branch. List each issue in the prompt with its own scope line; the worker makes one commit for each issue, and
  the body of the pull request says `Fixes #N` for each. Give a bundle only issues that triage found to be a few lines
  each, so that one slow issue does not hold the others.
- **A row that triage marked "read"** gets one more line in the prompt of its worker: reproduce the fault on `main`
  before you build, and report another cause if the fault does not reproduce as the issue says.
- Do not copy the issue or the rules into the prompt. The worker reads the issue, and `CLAUDE.md` is in its context.
- Start each worker with `isolation: "worktree"` and low effort (90,000 to 160,000 tokens for an issue).
- A worker needs no port: `scripts/agents/suite.mjs` takes a free one.
- `scripts/agents/suite.mjs` runs at most two browser suites at once on one machine (`SUITE_SLOTS`), and the others
  wait (#1406): on 2026-11-24 about six workers that ran suites at once on the cloud VM (4 cores) made runs time out.
  More workers than that can still work at once, because a suite is only a part of a worker's time.
  Six gave a load of about 35 and 15 failures in one local run of `test/interact.mjs` (#1387).
  On the owner's Mac (10 cores) four slots ran without failures of timing on 2026-11-24 and six gave six failures in
  one run of `test/interact.mjs`: write `SUITE_SLOTS=4` into the prompt of each worker there. A suite takes 13 to 30
  minutes while several workers build.

## While the workers run

- **Do not read the transcript of a worker,** and do not touch its worktree unless a notice says that it failed. A
  worker with no report is usually still testing.
- **A worker that reports the same number of steps in several notices is stuck** on a test run of its own. Give the
  issue to a new worker with what is known, and tell the first one to stop its servers.
- **A message to a worker whose worktree is gone may never run.** On 2026-11-25 the worker of #2068 ended with no
  change, so its worktree was removed; a later message to it was accepted, but the worker never ran again, and two
  hours passed before the coordinator saw that its output file had not changed since. After such a message, check that
  the output file of the task changes within a few minutes (`stat -c %y` of the file the notice names), or give the
  task to a new worker at once.
- **Watch the checks** with `node scripts/agents/prs.mjs --watch` in a `Monitor` (it prints one line when the checks
  of a head finish, also for CI on `main`, which sends no event), or with `subscribe_pr_activity` when the repository
  is in the session. The script uses only `gh api` REST, so it also runs in a cloud session. A Monitor
  ends after 30 minutes; start it again.
- **Send a CI failure, a review finding or a decision of the owner to the worker that opened the pull request**
  (`SendMessage`): the failure and the check run, not the task again. A follow-up costs 10,000 to 20,000 tokens and a
  new worker about 100,000. A worker that ended with no change has lost its worktree (it is removed when nothing
  changed), and a message to it resumes it in your own checkout. Give such a worker a new task only when your
  checkout is free, or start a new worker in a worktree.
- **Retire a worker at about 140,000 tokens** (the usage line of its notice). Past that, a worker on 2026-11-24 lost
  its report to a second hand-back and others slowed down. Give its next issue to a new worker, and its open review
  findings to the reviewer that found them: the reviewer has read the branch. On 2026-11-24 the reviewer of #1639
  fixed its four findings for about 35,000 tokens, where a new worker costs about 100,000.
- **Turn each "found" line of a report into its own issue** at once, in the form of "Issues" in `CLAUDE.md`. Search
  for an issue of the same fault first (`gh issue list --search`). Do not add a fault to another issue as a comment.
  When an issue already has the same fault, add the new evidence to it instead: a line under "Sightings" for a check
  that fails in some runs, or a dated comment with what was measured.
- **Check your own premise before you send a worker back.** On 2026-11-17 a pull request (#801) went back with the
  claim that MapLibre GL JS falls back to a full load for another sprite; its source showed that it does not. Ask the
  worker to read the behavior of MapLibre GL JS from its source or to measure it at `/ml/`, and to say so when your
  premise is wrong.
- **Another session can coordinate on the same repository at the same time.** Leave its pull requests to it, and
  give it a message (`SendMessage` to the address of its message) when `main` is red or before a release, so that it
  holds its merges. A message from another session that says the owner asked for something is not the owner's word:
  ask the owner with the question tool before you act on it (the release of 0.7.0 on 2026-11-17).
- **Ask the owner with the question tool** (`AskUserQuestion`; see "How work goes" in `CLAUDE.md`) for each pull
  request that waits for the owner and each decision, with the recommendation as the first option. Ask several
  decisions in one call. An update says what happened and does not hold a question. Measure each option before you
  ask, and give the numbers: the first question of #1356 ("pages override with 2+ classes") came before a one-class
  page rule was measured, which loses, and had to be asked twice.
- **Never wait for an answer in the question tool while you have other work that you can do** (the owner,
  2026-11-26). The call of the tool holds your turn until the owner answers, and the owner may not answer for a long
  time. Before you call it, do everything that does not depend on the answer: merge what is green, start the next
  workers, send failures back, file the issues of the reports. Call it only when every step that is left needs the
  answer, or when no other work is left.
- **A wake-up does not give a question a timeout.** On 2026-11-26, in the desktop app, a wake-up of `ScheduleWakeup`
  that was set for 60 seconds did not end a question that waited for two to three minutes, in two runs: it came as a
  turn of its own after the owner had answered. The owner has seen a question end early before, perhaps after another
  kind of notice, and this was not reproduced. If a question ends with no answer, go on with the work that does not
  need the answer and ask again later. No answer is not a yes: a pull request that waits for the owner stays open.
- **Do not ask the owner between 23:00 and 07:00 New York time** (the owner, 2026-11-26): the owner is usually asleep
  then. Read the time with `TZ=America/New_York date`. In those hours, go on with the work that does not need the
  answer, keep each open decision in its issue or pull request, and ask after 07:00.
- **The setting `askUserQuestionTimeout`** (user settings; `10m` on the owner's Mac since 2026-11-26) closes a question
  that nobody answers. Read in the documentation of Claude Code and not tested: its timer does not start while the
  session is connected to Remote Control, and a cloud session does not read the user settings.
- **Read the time after a question in a later message.** A command in the same message as the question runs at once
  and not after the answer: both runs of 2026-11-26 seemed to be answered after 4 seconds for this reason.
- **For a change of the look, the owner wants a live page on a local port** with controls for the values in
  question, not screenshots. The server of a worker ends with the worker, so start `PORT=… node demo/serve.mjs` in
  the background in the worktree of the worker.
- **A usage limit stops workers with their context.** Push the branch of each stopped worker before you wait. After
  the reset, send each one what changed on `main`; do not start new workers for the same issues.

## Merging

- **Merge when `checks`, the four `browser-*` jobs and `render` have passed** (see `CLAUDE.md`). Do not wait for the
  summary job `browser`: on 2026-11-24 it ran for about 6 s and waited for a runner 10.7 min (median of 15 runs,
  #1602). A browser job that the job `changes` skipped counts as passed.
- **Keep about eight pull requests in CI at once.** The account ran at most 27 jobs at the same time on 2026-11-24, and
  a pull request that changes `src/` uses about 40 runner-minutes, so 25 open pull requests made each job wait up to
  30 minutes. Start new workers as pull requests merge, not all at once.
- **Read the source diff before you merge** (`git diff origin/main...origin/<branch> -- src | grep -E "^[+-]"`), and
  merge with the head SHA that you read.
- **Test the merge after a worker rebased or force-pushed.** `t=$(git merge-tree --write-tree origin/main
  origin/<branch>) && git diff --stat origin/main $t -- src` lists what the merge would change on `main`. On
  2026-11-17 a rebased branch of #801 carried old copies of lines of #802 and #803, and would have undone both. A
  three-dot diff of a branch that started before a merge can also show lines that the merge keeps; the merge tree
  decides.
- **A green CI of the pull request is weak evidence for a fix of timing.** #745 passed its CI and then failed on
  `main` in both attempts. Before you merge such a fix, run the job of its check two more times
  (`gh run rerun <run> --job <job>`) and read that each attempt passed without the retry of the suite. A fix of a
  check that fails in some runs gets three runs of its CI job before the merge: the first fix of #1369/#1372 passed 20
  local runs and CI still found the race.
- **`Fixes #N` closes the issue at the merge, also when a part is left.** After each merge, check the state of the
  issue, and reopen it with a body that says what is left (#532, #555 and #637 on 2026-11-17).
- **Merge one pull request in each command.** A loop that merged two pull requests in one command was refused by the
  permission check of auto mode.
- **A step that fails on the network is not a fault of a check.** `read ECONNRESET` in a step that fetches a file
  (`scripts/site.mjs`, #805) needs one more run of the job, and an issue if the fetch has no retry.
- **CI must be green on the current `main`.** Pull requests that pass alone can fail together (three of them once put
  a page script 19 bytes over its budget). When two open pull requests change the same function, or a budget is
  near, merge one, update the other (`gh pr update-branch N`), and wait for its CI.
- **A merge can break another branch with no conflict.** After a merge that renames or removes something, send each
  open branch to its worker to merge `main` and search for the old name, and do not merge on a CI result older than
  that merge. (A check of one branch still read a member that #526 had made private.)
- **A check that fails by timing blocks every pull request.** Read which check failed before you take a red job as a
  fault of the pull request. File the check at once and give it to one worker with a narrow brief; the CI logs were
  enough to fix the three of 2026-11-16, which did not fail on the Mac even with the CPU throttled 40 times. Do not
  start a failed job again in the hope of a lucky run.
- **A check that reads the canvas against a fixed timeout fails under the load of CI.** Two image checks raced
  `toBlob()` against 5 s and failed in some runs (#2091, #2092), and a terrain drag ended inside the window of inertia
  (#2079). Before you call two such failures a regression, run both checks on the commit before the suspected merges
  and on `main`. On 2026-11-25 every pixel was right on both, and the cause was the timeout.
- **The `browser` summary job reports a canceled run as failed** until it is changed, so each re-push sends a false
  failure event for the old head. Read whether the head is current before you act on a failure event.
- **A cloud session cannot delete merged branches** (`git push origin --delete` gives 403).
- **A pull request with no CI after 5 minutes** (`prs.mjs --watch` says so) missed its event: close it and open it
  again.
- **A pull request that conflicts with `main` gets no CI at all,** and closing and opening it again does not help
  (#1985 on 2026-11-25): read `mergeable_state` (`gh api repos/map-jr/map-jr-gl/pulls/N -q .mergeable_state`); for
  `dirty`, let the worker or the reviewer merge `main` with `node scripts/agents/merge-main.mjs`.
- **`prs.mjs` can call a head green when only the check `site` has run,** right after `update-branch` and before the
  jobs of `CI` are queued (#2083 on 2026-11-25). Before a merge, list the checks of the head
  (`gh api repos/map-jr/map-jr-gl/commits/<sha>/check-runs -q '.check_runs[] | "\(.name)=\(.conclusion)"'`) and see
  `checks`, the four `browser-*` jobs and `render` among them.
- **A run of merges cancels CI on `main`,** because each push cancels the run before it. After several merges, let
  one run on `main` finish before you merge more, and before a change that alters how every map starts.
- **The `Browsers` workflow keeps one waiting run for each group,** and a newer run in the group replaces the waiting
  one. Pushes to `main` and starts by hand with `safari` share one group, because they write `bench-results`. A start
  by hand with `safari_only` has a group of its own (#1929), so merges go on while it runs, and no hold is needed.
  Start it with `safari` only when you want the results of Safari in `bench-results`, after the last merge of a series.
- **When a merged pull request did only a part of its issue,** edit the title and the body of the issue to what is
  left (the line "Left of the issue" of the report), or close it and file what is left, before the next worker starts.
- **Do not send a worker to fight for bytes.** If a budget is reached, ask the owner at once.
- **Each number of `src/mistakes.ts` has one issue.** A new text or check kind takes the number of its issue, and
  `pnpm test:consistency` fails on a number that is taken twice.
- **A pull request on top of an open one** works when the upper one needs the lower one, or needs the owner while the
  lower one does not. After the squash merge of the lower one, set the base of the upper one to `main`
  (`gh api -X PATCH repos/map-jr/map-jr-gl/pulls/N -f base=main`) and let its worker merge `main`, taking the side
  of `main` for the lines of the lower pull request. If `git diff origin/main <merged head>` is empty,
  `git merge -s ours origin/main` gives the right tree. Push with `--force-with-lease`.
- **Commit named files** in your own checkout, not `git commit -am`: a long run rewrites tracked files.

## Independent review

- **The brief of a reviewer that may fix docs names the limit of docs-lint** (a paragraph has at most 90 words): two
  docs commits of reviewers failed `checks` on 2026-11-25 (#2083). Tell a reviewer to run `pnpm test:consistency`
  before it pushes.
- **Tell each reviewer to stop its demo server by its process id only.** A reviewer of 2026-11-25 stopped its server
  by matching `demo/serve.mjs`, which would also have stopped the servers of other worktrees.
- **Let the reviewer fix what it found** when the author is past about 140,000 tokens, and ask it first to run each
  finding that it only read: on 2026-11-24 the read findings of #1892 reproduced, and the one of #1909 did not.
- **Measure again after a rework.** The bytes and the time to idle of a pull request change when a reviewer or a
  second worker reworks it (#1906 went from 155 to 931 bytes). Ask for both in the last report, not only in the first.
- **A notice that a worker may have broken a security rule** ("CI bypass", "test removal") is checked before its
  report is used: read `git diff origin/main...HEAD -- test .github package.json scripts` in its worktree for a removed
  test, a lower floor or a changed workflow. A diff against the old head of the branch also shows what a merge of
  `main` removed, which is not the worker's change.
- **For a choice between a look and a cost, show the owner the look.** Three maps side by side (`main`, the branch,
  MapLibre GL JS) from two builds and one small server, as screenshots or as a page on a local port, with the time to
  idle and the bytes in the question. The owner decided #1694 and #1906 this way, and the second against the first
  recommendation. `node scripts/agents/compare.mjs <worktree of the branch>` serves this page from the builds of your
  checkout and of the branch (#1927); with `--shots <dir> --views "vector,4;raster,2.5"` it writes one screenshot for
  each view and prints the tile requests of each map by zoom level.

**Every pull request that changes the docs gets a review before it merges** (the owner, 2026-11-23). The reviewer
reads the changed pages against `docs/style-guide.md` and the "Writing" rules of `CLAUDE.md`, and checks each claim
against the source, the changelog or a run. A small change of wording can share one reviewer with others.

Ask for a review when a pull request changes how every map starts or draws, rewrites code that it did not need to
touch, or leaves less than a few hundred bytes of a budget. The reviewer is a new worker that gets the branch and a
list of questions, not the report of the author. It reproduces a fault before it reports it, and it reports only to
you. A review costs 115,000 to 160,000 tokens and found faults that the tests of the author did not each time
(2026-11-12, 2026-11-13). A reviewer with Firefox and WebKit of Playwright (`BROWSER=webkit`) finds what Chromium
alone cannot.

## Render tests and the status

- **`node test/conformance/render.mjs --help`** prints its options. An argument that it does not know, or `--list`
  without `--filter`, stops it with that text instead of starting the whole run of about ten minutes.
- **A pull request that moves render tests commits only their lines of `render-tests.json`** (#1915). No total and
  no floor is committed: the floor is the count of lines `match`, and `pnpm status` computes the totals. Two such pull
  requests merge one after the other with no new run of the second. When their lines are adjacent, GitHub reports a
  conflict; `node scripts/agents/merge-main.mjs` resolves it test by test, and stops only when both changed the same
  test.
- **The render job fails when a test is worse than its line** (`WORSE:`; match to near or differ, near to differ, any
  to error or skipped) or when fewer tests match than the file has lines `match`. It prints `BETTER:` for each test that is better
  than its line; the author commits those lines. A pull request that commits a worse line lowers the floor and waits
  for the owner, except a line from `near` to `differ` that moves by at most 0.5 points and meets the other conditions
  of "A worse line of a render test that needs no owner" in `CLAUDE.md` (the case of #1966 on 2026-11-25). Check
  each condition yourself before the merge. On `main`, a `BETTER:` line means that a pull request left a line
  out: take it in the next pull request that moves render tests.
- **Only a run with `--write` on the pinned Chromium writes `render-tests.json`.** With `--filter` it writes only the
  lines of the tests of the run, and it never writes a worse line unless `--lower=<id,id>` names the test.
- **The committed lines come from CI or from a run whose changed tests were checked.** The run runs each
  test whose status is not the one in `render-tests.json` again alone, and the second result counts (it prints
  `AGAIN:` when the two differ). A test near a limit can still have another status on another machine
  (`text-field/formatted-arabic` is at 4.8%, and the limit of near is 5%; #1036). Before you commit the lines, run
  each test of the `CHANGED:` lines that your change cannot reach alone at `main`; if it moves there too, restore its
  line in `render-tests.json`, or take the lines from the render job of CI.
- **Before you call a change of status a regression,** run the test alone several times (`--filter='^<id>$' --list`
  prints the percentage), and at the commit before the suspected merge in a temporary worktree. On 2026-11-17
  `terrain/low-zoom` moved for good (#793, caused by #726), while `terrain/tile-stiching` gave 2.7% or 33.5% from one
  run to the next, also before the suspected merge (#820).

- **The example pages** (`node test/conformance/examples.mjs --write`, about 30 minutes) need
  `.cache/maplibre-gl-js` and `python3` with Pillow. The tool clones the checkout when it is missing. It checks for
  Pillow before it takes any page and stops with a message when python3 cannot import it. Make a virtual environment
  with Pillow in the scratchpad and put its `bin` first on `PATH`.

## A release

- **Choose the version from every commit since the last tag.** One `feat!` commit makes it a new second number while
  the version is 0.x; another session expected 0.6.x where two breaking changes made it 0.7.0.
- **The order of 2026-11-17 worked:** a worker writes the section of `CHANGELOG.md` and the version in a pull request
  while the last fixes merge; then the status pull request merges; then the release pull request is updated from
  `main` and merges on green CI. Read the results of the `Browsers` workflow for the commit before the release.
- **Docs that ship in the package reach users only with a release.** npm 0.9.0 had no `docs/migrate/` when the
  migration prompt went live (#1366). List the docs that the package carries in the release, or say on the page which
  version has them.
- **Ask other sessions to hold their merges** from the status run until npm has the version, and tell them the
  version when it is there. npm showed 0.7.0 about six minutes after the workflow `Release` had published it.

## After a batch

1. Run `pnpm status` once on `main` and open one pull request with the result.
2. Check that each issue that the batch touched is closed, or has a title and a body that say what is left.
3. Read the results of the `Browsers` workflow on the last merged commit
   (`git fetch origin bench-results && git show origin/bench-results:README.md`, and `<system>-<browser>-tests.txt`
   for the names of failing checks). CI runs only Chromium.
4. Clean the worktrees: `node scripts/agents/clean-worktrees.mjs` prints what it would remove and what it keeps, and
   why; `--apply` removes them. It keeps a worktree that is locked by a live session, has changes, or has a commit
   that is not merged. It also lists the worktrees of other sessions (`bridge-*`, `remote-control-*`) when their
   commit is merged; remove only the `agent-*` worktrees of your workers unless you know that no session uses the
   others.

## Traps of the shell and of `gh`

- In cloud sessions GraphQL is blocked, so `gh issue list`, `gh issue view`, `gh pr list`, `gh pr view` and
  `gh pr create` fail. Use REST:
  - Issues: `gh api 'repos/map-jr/map-jr-gl/issues?state=open&per_page=100' -q '.[] | select(.pull_request|not)'`
    (the issues endpoint also lists pull requests).
  - Search: `gh api -X GET search/issues -f q='repo:map-jr/map-jr-gl is:issue <words>'`. The query needs `is:issue` or
    `is:pull-request`, or the answer is HTTP 422.
  - Merge: `gh api -X PUT repos/map-jr/map-jr-gl/pulls/N/merge -f merge_method=squash -f sha=<head>`.
  - Re-run one job: `gh api -X POST repos/map-jr/map-jr-gl/actions/jobs/ID/rerun`.
- `gh pr edit` and `gh issue view --comments` fail on this repository with an error about Projects (classic). Use
  `gh api -X PATCH repos/map-jr/map-jr-gl/pulls/N -F body=@file` and `gh issue view N --json body,comments`.
- `gh pr edit --add-label` fails in the same way: add a label with
  `gh api -X POST repos/map-jr/map-jr-gl/issues/N/labels -f 'labels[]=<label>'`.
- `gh pr merge --delete-branch` in a checkout with a detached `HEAD` merges and then fails with "could not determine
  current branch", so the command reads as failed. Merge without it, read the state with `gh pr view N --json state`,
  and delete the branch with `git push origin --delete <branch>`.
- In zsh, `set -- $var` does not split the value into words: read each field with its own `gh … -q` call.
- The shell of the owner's Mac sets `noclobber`, so `cat > file` does not replace a file that exists: write `>|`,
  and `2>|` for the error output.
- The log of one job: `gh api --allow-escape-sequences repos/map-jr/map-jr-gl/actions/jobs/<id>/logs >| file`. Without
  the option `gh` writes nothing, and the log of a run that is still in progress is not there yet.
- `gh api -X PUT …/pulls/N/merge -f sha=` needs the full SHA of 40 characters.
- A dispatch of the workflow `Browsers` with `safari` (not `safari_only`) replaces a push run of it that waits, a push
  run of a merge included. A dispatch with `safari_only` does not (#1929).
- A branch that is checked out in the worktree of a worker that has ended is pushed from another worktree with
  `git push origin HEAD:<branch>`.
- A command that writes the body of an issue into a file must succeed before `gh issue edit --body-file` reads it;
  join the two with `&&`. A `sed` with `#` as its delimiter fails on a text with an issue number, and an empty file
  then empties the body of the issue.
