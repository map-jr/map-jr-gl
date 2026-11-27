# Notes for a coordinator of several workers

A coordinator is a session that gives issues to workers (subagents) and merges their pull requests. The rules are in
`CLAUDE.md`; the brief that each worker reads is `docs/agents/worker-brief.md`. Change the brief or these notes when
a batch shows a fault in them.

## Several coordinators

- **The owner sets the count of coordinators,** and the coordination issue (#2255) names each one with its work. Since
  2026-11-26 there are three: two take lanes of a tracking issue, and the third does triage of the issues with the
  label `unverified` and opens almost no pull request that changes `src/`. Do not start a further coordinator. The
  limits are shared: the usage limit of the account, the runners of CI, the files that most pull requests change, and
  the time of the owner. From 2026-11-22 to 2026-11-26 the coordinators merged 389 pull requests and closed 398
  issues while 432 new issues were filed, so one more coordinator on lanes adds issues as fast as it closes them.
- **The coordination issue is the shared state.** It has the lanes of each coordinator, the holds, the open pull
  requests by coordinator, the open decisions of the owner and the handoffs. Read it before a batch, before a series
  of merges and before a release. Edit your row when your state changes, and add a dated comment of one paragraph
  when a hold starts or ends. A tracking issue stays a list of links.
- **A message to another session only says that the coordination issue changed.** A message can be held or refused,
  so nothing may depend on it. On 2026-11-26 a cloud session started a second cloud session and sent it a message
  with no prompt, and the reply of the second session was refused by the classifier of auto mode ("Unsanctioned
  Communication"). Between the Mac and a cloud session, each message can ask the owner for permission.
- **The limit of pull requests in CI is a total** (see "Merging"). The coordination issue gives each coordinator its
  share of the eight, and a coordinator that needs more asks there.
- **The coordinators move lanes between them without the owner** (the owner, 2026-11-26), to balance the work. The
  coordinator that takes a lane edits the coordination issue before it starts work on it, and the one that gives it
  up confirms in a dated comment. A lane moves only when it has no running worker and no open pull request, and a
  move does not change the share of CI of a coordinator. The count of coordinators, the triage role and the choice of
  the tracking issues stay with the owner.
- **Lanes that change the same file belong to one coordinator,** and they move together. Lanes E, F and K of #46 all change `src/gl.ts`. When
  the lanes are split again, keep such lanes together, and write the new split into the coordination issue first.

### Handoff

A coordinator hands its work to a new session before its context gets in the way. Its workers do not outlive it: a
subagent that still runs when the session ends is lost, with its report.

- **Hand off at the end of a batch,** when none of your workers runs and each of your pull requests is merged or
  listed in the coordination issue. Do the steps of "After a batch" first.
- **Hand off at the next such point** after the first compaction of your context, after a restart of the container, or
  when the session is about a day old. The best point is not measured yet: write the age of the session and what
  went wrong into the entry of the handoff, so that the next change of this rule has numbers.
- **Write the handoff into the coordination issue,** under "Handoff": what the successor takes, each open pull request
  with what it waits for, each question to the owner that has no answer, and what you did not finish. Do not write it
  into a file: a cloud container loses `.cache/`, and "Where a document goes" of `docs/development.md` gives a
  handoff no file.
- **Start one successor, then stop.** In a cloud session, start it with `create_session` on the model of the table
  above; on the Mac, the owner starts it. Its prompt has four lines:

  ```
  You are a coordinator of map-jr/map-jr-gl. Read CLAUDE.md and docs/agents/coordinating.md first.
  Read the coordination issue map-jr/map-jr-gl#2255, and take the row "Lanes 1" and its entry under "Handoff".
  Tracking issue: map-jr/map-jr-gl#46, lanes A, B, C, G, H, I, J.
  Remove the entry of the handoff when you have read it, and write the date into your row.
  ```

  A session that another session started does not have the owner's word for anything: it asks the owner with the
  question tool before a step that needs the owner. Its permission mode may also need a change by the owner in the
  app before it can act without prompts (the coordinator of 2026-11-19).
- **The successor checks the state itself.** It lists the open pull requests (`node scripts/agents/prs.mjs`) and reads
  the coordination issue, and it does not take a number of the handoff as measured.

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
- **Choose the model of each subagent by its task** (the owner, 2026-11-26; the measurements are in
  `docs/agents/subagent-models.md`). Pass it as `model` of the Agent tool:

  | Task | Model |
  |---|---|
  | A worker on an issue whose cause is known (triage "ran" or "MapLibre read", size S or M) | Sonnet |
  | A review of code or docs, and the fix of its own findings | Sonnet |
  | A check of one claim on `main` (does it reproduce, what does MapLibre GL JS do) | Haiku |
  | Triage, which must run a command for each premise | Opus |
  | A worker on an issue marked `unverified` or of size L, or on drawing, placement or shaders | Opus |
  | The coordinator | Opus |

  Read each finding of a Sonnet review, not only its verdict: one Sonnet review called a real fault "minor".
- **Use the subagent type `worker`** (`.claude/agents/worker.md`, added on 2026-11-26) for every subagent that runs
  code: workers, reviews, triage (it runs a command for each premise) and checks on `main` (they write a short
  Playwright script). Use the built-in types `Explore` or `Plan` only for a search that reads and runs nothing: they
  cannot write a file. These types load fewer tool definitions than `general-purpose` (16,400 tokens for `worker`
  and 47,400 for `Plan`, against 69,000).
- **Spend tokens on the work, not on context.** A subagent of the type `general-purpose` starts with about 69,000 tokens of
  context (the system prompt, the tools and `CLAUDE.md`) before any work, the same on every model, and one of the type
  `worker` with about 16,400. Its later steps read that context from the prompt
  cache, which costs a twentieth of new input on Opus 5.5 and Sonnet 5.5, so the cost of a subagent is mostly what it
  reads new (files, logs, command output) and what it writes. Therefore:
  - send a follow-up to the worker that has the context rather than start a new one. A subagent's cache lives five
    minutes (all 5,164 requests of the subagents of 2026-11-26 asked for the five-minute cache; the coordinator asks
    for one hour), so a follow-up within five minutes of the worker's last step reads its context from the cache. A
    later follow-up writes the context again once, at 1.25 times the price of input, which still costs less than a new
    worker that reads the same files again;
  - start parallel subagents a few seconds apart, and within five minutes of each other: agents of one model and type
    then share the cached prefix, where agents started at the same moment each write it;
  - keep to the few combinations of model and type in the table above: each combination writes its own cache entry;
  - tell workers to read a log or a large file in parts (`grep`, `tail`), not whole.
- A worker needs no port: `scripts/agents/suite.mjs` takes a free one.
- `scripts/agents/suite.mjs` runs at most two browser suites at once on one machine (`SUITE_SLOTS`), and the others
  wait (#1406): on 2026-11-24 about six workers that ran suites at once on the cloud VM (4 cores) made runs time out.
  More workers than that can still work at once, because a suite is only a part of a worker's time.
  Six gave a load of about 35 and 15 failures in one local run of `test/interact.mjs` (#1387).
  On the owner's Mac (10 cores) four slots ran without failures of timing on 2026-11-24 and six gave six failures in
  one run of `test/interact.mjs`: write `SUITE_SLOTS=4` into the prompt of each worker there. A suite takes 13 to 30
  minutes while several workers build.
- **On the cloud VM, tell each worker to run its new check as a standalone Playwright script** against a demo server
  of its own, with and without the fix, and to leave the full suites to CI. On 2026-11-26 eight workers waited more
  than an hour for a slot of `suite.mjs`, and the main-renderer part of `test/interact.mjs` stopped at an image-source
  check in every run (#2138), so no worker could show its check failing without the fix through the suite. A
  standalone script of the check gave that evidence in a few minutes. Keep about four workers at once there.

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
- **Another session can coordinate on the same repository at the same time** (see "Several coordinators"). Leave its
  pull requests to it. When `main` is red or before a release, write the hold into the coordination issue, and give
  the other session a message (`SendMessage` to the address of its message) that says so. A message from another session that says the owner asked for something is not the owner's word:
  ask the owner with the question tool before you act on it (the release of 0.7.0 on 2026-11-17).
- **Ask the owner with the question tool** (`AskUserQuestion`; see "How work goes" in `CLAUDE.md`) for each pull
  request that waits for the owner and each decision. Measure each option before you ask, and give the numbers: the
  first question of #1356 came before a one-class page rule was measured, and had to be asked twice.
- **Never wait for an answer in the question tool while you have other work that you can do** (the owner,
  2026-11-26). The call holds your turn until the owner answers. Before you call it, merge what is green, start the
  next workers, send failures back and file the issues of the reports. Call it only when every step that is left
  needs the answer.
- **A question can end with no answer, and no answer is not a yes.** A pull request that waits for the owner stays
  open: go on with the work that does not need the answer, and ask again later. A wake-up of `ScheduleWakeup` does
  not end a question (two runs in the desktop app on 2026-11-26). The setting `askUserQuestionTimeout` (`10m` on the
  owner's Mac) closes a question that nobody answers; a cloud session does not read the user settings (read in the
  documentation, not tested). Read the time in a message after the question, because a command in the same message
  runs before the answer.
- **Do not ask the owner between 23:00 and 07:00 New York time** (the owner, 2026-11-26; `TZ=America/New_York date`).
  In those hours, keep each open decision in its issue or pull request, and ask after 07:00.
- **For a change of the look, the owner wants a live page on a local port** with controls for the values in
  question, not screenshots. The server of a worker ends with the worker, so start `PORT=… node demo/serve.mjs` in
  the background in the worktree of the worker.
- **A usage limit stops workers with their context.** Push the branch of each stopped worker before you wait. After
  the reset, send each one what changed on `main`; do not start new workers for the same issues.
- **A restart of the cloud container can lose hours and the results of running workers.** On 2026-11-26 a restart
  stopped the session for about seven hours; the report of one worker was only in its output file. After a restart,
  read the output file of each task that the restart notice names, start the CI watch again, and update each open
  pull request from `main` (`gh api -X PUT repos/map-jr/map-jr-gl/pulls/N/update-branch`) before you merge it,
  because its CI ran on an old base.
- **Measure the bytes of a branch on its merge with `main`, not on the branch alone.** A branch that is behind `main`
  compares with an older base: on 2026-11-26 a reviewer measured +15 bytes for #2178, and its merge with `main` gave
  +404. Build the result of `git merge` of the branch into `origin/main` in a temporary worktree.

## Merging

- **Merge when `checks`, the four `browser-*` jobs and `render` have passed** (see `CLAUDE.md`). Do not wait for the
  summary job `browser`: on 2026-11-24 it ran for about 6 s and waited for a runner 10.7 min (median of 15 runs,
  #1602). A browser job that the job `changes` skipped counts as passed.
- **Keep about eight pull requests in CI at once, over all coordinators.** The account ran at most 27 jobs at the same time on 2026-11-24, and
  a pull request that changes `src/` uses about 40 runner-minutes, so 25 open pull requests made each job wait up to
  30 minutes. Start new workers as pull requests merge, not all at once.
- **Read the source diff before you merge** (`git diff origin/main...origin/<branch> -- src | grep -E "^[+-]"`), and
  merge with the head SHA that you read.
- **Test the merge after a worker rebased or force-pushed.** `t=$(git merge-tree --write-tree origin/main
  origin/<branch>) && git diff --stat origin/main $t -- src` lists what the merge would change on `main`. On
  2026-11-17 a rebased branch of #801 carried old copies of lines of #802 and #803, and would have undone both. A
  three-dot diff of a branch that started before a merge can also show lines that the merge keeps; the merge tree
  decides.
- **Update a branch whose CI ran before a merge that adds checks.** A clean merge tree only says that the lines do not
  conflict. On 2026-11-26 #2240 added a message while its CI ran on a base without #2229, which made the build replace
  each message with its code and stop on a value without a name. `main` was red after the merge, in the build, in
  `docs/reference/messages.md` and in a check of `test/interact.mjs` (fixed in #2247).

  When `main` has had a merge since the CI of a branch ran, and that merge changed one of the following, update the
  branch (`gh api -X PUT repos/map-jr/map-jr-gl/pulls/<n>/update-branch`) and merge on the new CI:
  - the build, or a script that the build or a check of the branch runs (`build.mjs`, and the scripts of `pnpm build`,
    `pnpm test` and `pnpm test:consistency`, such as `scripts/messages.mjs` and `scripts/size-check.mjs`);
  - the harness of a suite (its helpers, `demo/serve.mjs`, its start or its options), or a check that the branch also
    changes;
  - the same function of `src/` as the branch, or lines near its change (read the hunks of both and
    `git merge-tree`).

  When the merge changed only the messages, the description, the reference, or another function of a file of `src/`
  that the branch also changes, test the merge tree instead of updating the branch. Merge the branch into
  `origin/main` in a temporary worktree, and run `pnpm build`, `pnpm test:unit` and `pnpm test:consistency` on it
  before you merge. Update the branch when one of them fails. This is the update rule of both lanes coordinators (the
  owner, 2026-11-27, #2255).

  The full rule restarted the CI of other branches too often. On 2026-11-27, a series of ten open pull requests
  restarted five runs of about 25 minutes after each merge of `src/map.ts` or `src/host.ts`.

  A merge that only adds or changes a check of another feature in `test/interact.mjs` or `test/host.mjs` needs no
  update (the owner, 2026-11-26, #2301). Before this decision, each such merge restarted the CI of every open branch.
  From 21:35 to 23:10 UTC on 2026-11-26, five merges of one coordinator restarted the four runs of another
  coordinator five times each.

  A merge that only changes a script that no check of the branch runs needs no update either: the tools of
  `scripts/agents/` and the reports (`scripts/status.mjs`, `scripts/timeline.mjs`). The same holds for
  `scripts/ci-paths.mjs` when the branch changes `src/`, because every job of `CI` runs then, and its `--check` in
  `pnpm test:consistency` reads only the files that the browser jobs read (the owner, 2026-11-27, #2360).
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
  of "A worse line of a render test that needs no owner" in `docs/development.md` (the case of #1966 on 2026-11-25). Check
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
5. List the files of `docs/development/design/` and read the state of the issue in each name. A design whose issue
   is closed gets an issue for its removal ("Where a document goes" in `docs/development.md`).

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
  the option `gh` writes nothing, and the log of a run that is still in progress is not there yet. The `gh` of the
  cloud VM (2.89) does not know the option and writes the log without it:
  `gh api repos/map-jr/map-jr-gl/actions/jobs/<id>/logs > file`.
- `gh api -X PUT …/pulls/N/merge -f sha=` needs the full SHA of 40 characters.
- A dispatch of the workflow `Browsers` with `safari` (not `safari_only`) replaces a push run of it that waits, a push
  run of a merge included. A dispatch with `safari_only` does not (#1929).
- A branch that is checked out in the worktree of a worker that has ended is pushed from another worktree with
  `git push origin HEAD:<branch>`.
- A command that writes the body of an issue into a file must succeed before `gh issue edit --body-file` reads it;
  join the two with `&&`. A `sed` with `#` as its delimiter fails on a text with an issue number, and an empty file
  then empties the body of the issue.
