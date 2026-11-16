# Notes for a coordinator of several workers

These notes are for a session that gives issues to workers (subagents) and merges their pull requests. A worker
does not read this file. The rules are in `CLAUDE.md`, and the brief that each worker reads is
`docs/agents/worker-brief.md`.

The numbers below come from the batch of 2026-11-12 (about 25 workers and 2 reviewers, one coordinator, 20 pull requests merged). Update them when a batch shows
something different.

## Before a batch

1. **Triage first.** The issues can be older than `main`. In the first batch, 2 of 7 workers found that their issue
   was already fixed, and each used about 80,000 tokens to find that out. One read-only triage worker then checked
   23 issues for about 160,000 tokens (about 7,000 for each issue) and returned, for each issue, what is still
   open, the file and line where the work starts, a rough size, and whether the owner is needed. Ask for the result
   as one table.
2. **Choose issues that do not share lines.** Two workers can edit the same file when they edit different functions.
   Name in each prompt what the other workers touch ("another worker changes `restart()` for #78; keep out of it").
   Give two issues on the same function to one worker after the other, not at the same time.
3. **Hold back changes that touch most files** (a rename of the package, a replacement of terms across the
   documents) until no other pull request is open.

## The prompt of a worker

The prompt is the path of the brief and these lines. Do not copy the text of the issue or the rules into it: the
worker reads the issue itself, and `CLAUDE.md` is already in its context.

```
First read docs/agents/worker-brief.md and follow it exactly. Your port: 8101.

Issue: map-jr/map-jr-gl#20 (After `refreshTiles`, queries can return the old tile).
Branch: fix/20-query-after-refresh
Scope: the whole issue. Triage found it open, starting at `src/engine.ts:793,814` and `src/tiles.ts:22,108,131`.
Keep out of: `src/compat-map.ts` (another worker, #7).
```

- Give each worker its own port (8101, 8102, …). Before `test/interact.mjs` and `test/host.mjs` read `PORT`, the
  workers waited for one shared port, and a fix of five lines took 20 to 35 minutes. With its own port a worker took
  4 minutes. Do not give a port again while its worker can still be running: a worker that has reported can still
  get a follow-up, and on 2026-11-13 two workers met on port 8104. Count the ports up for the whole session.
- Give each worker its own git worktree (`isolation: "worktree"`). The worktrees are in `.claude/worktrees/`; add
  that path to `.git/info/exclude` so that the main checkout stays clean.
- Use low effort for a worker on one issue. A worker used 90,000 to 160,000 tokens for an issue at low effort.
- The machine has 4 cores. More than about 6 workers that run browser tests at the same time make timing tests
  fail for load.

## While the workers run

- **Do not read the transcript of a worker.** Its report of at most 12 lines is what enters your context.
- **Do not touch the worktree of a worker** unless a notice says that the worker failed. A worker with no report is
  usually still testing. (On 2026-11-12 the coordinator committed the work of a running worker as "WIP" in the
  middle of its test run.)
- **Watch each pull request** (`subscribe_pr_activity`) when its worker reports. CI takes about 8 minutes, and its
  result wakes you, so you do not poll.
- **Send a CI failure, a review finding or a decision of the owner to the worker that opened the pull request**
  (`SendMessage`). It still has its context, so the message is the failure and the check run, not the task again.
  A follow-up cost 10,000 to 20,000 tokens; a new worker for the same pull request costs about 100,000.
- **Turn the "found" lines of a report into issues** (or into a comment on the issue they belong to) at once, so
  that nothing lives only in a report. One issue can collect small faults as a list of boxes (#92).
- **Say in each update to the owner** which pull requests wait for the owner and why, with a recommendation. Ask
  several decisions in one question when they are ready at the same time.

## Merging

- **Read the source diff before you merge** (`git diff origin/main...origin/<branch> -- src | grep -E "^[+-]"`),
  not the tests and not the whole pull request. Merge with the head SHA that you read.
- **CI must be green on the current `main`, not on the `main` of an hour ago.** On 2026-11-12 three pull requests
  that each passed alone put a page script 19 bytes over its budget, and `main` was red for 20 minutes. When two
  open pull requests change the same function, or a budget is nearly reached, merge one, update the other
  (`update_pull_request_branch`, which needs no worker), and wait for its CI. Pull requests that touch different
  code can merge one after the other without the wait.
- **Do not send a worker to fight for bytes.** On 2026-11-12 the budgets had less than 0.3 KB of room, and four
  pull requests each went back to their worker once or twice only for size, about an hour and 100,000 tokens in
  all. The owner then gave each budget about 2 KB of room. If a budget is reached again, ask the owner at once.
- **A worker that rewrites code it did not need to touch has made a larger change.** Ask for a review (below).
- **A change that needs the owner but depends on an open pull request** can be a pull request against that branch
  (#106 on #90). The owner then sees only the new part.
- **A run of merges cancels CI on `main`.** Each push to `main` cancels the run of the push before it. On 2026-11-13
  twelve merges in a row left `main` with no finished run for an hour. After a run of merges, let one CI run on
  `main` finish before you merge more, and before a change that alters how every map starts.
- **A stack of pull requests after a squash merge.** When the first pull request of a stack is squashed into `main`,
  the next branch conflicts with `main` on the lines that both have, and `update_pull_request_branch` refuses. Retarget
  the next pull request to `main`, and merge `main` into its branch by hand:
  - If `git diff origin/main <merged head>` is empty, `main` adds nothing that the branch lacks. Then
    `git merge -s ours origin/main` gives the right tree, and the diff of the branch does not change.
  - Otherwise merge normally. In a conflict on a file that the other new commits of `main` do not touch, take the
    side of the branch (`git checkout --ours`). Then check that `git diff <old head> HEAD` is exactly the diff of
    those other commits.
  - Push with `--force-with-lease=<branch>:<old head>`. The session that wrote the stack can push to the same
    branches at the same time (it did on 2026-11-13).
  - Two pull requests of a stack that only pass together (#130 was 15 bytes over a budget until #131 took code out)
    can be one squash commit: merge the upper one, and close the lower one with a link. Ask the owner first.

## Independent review

Ask for a review when a pull request changes how every map starts or draws, rewrites code that it did not need to
touch, or has less than a few hundred bytes of room. The reviewer is a new worker that gets the branch and a list
of questions, not the report of the author. It must reproduce a fault before it reports it, and it reports only to
the coordinator. The two reviews of 2026-11-12 cost about 120,000 and 160,000 tokens and found six faults that the
authors' own tests did not (a false warning, an unhandled rejection, a popup that scrolls the map, a popup that
is invisible when it opens a second time). A reviewer that has Firefox and WebKit of Playwright finds what the
author's Chromium run cannot. The review of #146 on 2026-11-13 cost about 115,000 tokens and found a false fall back
that left two engines and input bound twice. Tell a reviewer to start its demo server and stop it in the same
command, as the brief does: the permission check can refuse a later `kill`, and the server then keeps its port.

## When the usage limit stops the workers

A worker that stops at a usage limit keeps its context. After the limit resets, send each one a message that says
it was stopped by the limit, what changed on `main` since, and its port. Do not start new workers for the same
issues. Before you wait, push the branch of each stopped worker, so that the work survives the end of the session.

## Notes from the batch of 2026-11-14 (afternoon)

About 30 workers and 3 reviewers, one coordinator, 21 pull requests merged.

- **A push to `main` cancels a Safari run that was started by hand.** The `Browsers` workflow cancels its running
  run when a merge starts a new one, and on 2026-11-14 that cancelled the Safari run once. Start the Safari run
  (`safari_only`) after the last merge of a run of merges, and merge nothing until it has finished (about 15 minutes).
- **`main` gets no event when its CI finishes.** To wait for it, schedule a check (`send_later`) for about 25 minutes
  after the last merge, and let the check merge the next pull requests.
- **A pull request that waits for another can carry it.** When #349 needed the fix of #355, its worker opened #356
  for the fix and merged that branch into #349; the coordinator merged #356 first, and the squash merge of #349 then
  added only its own lines.
- **Check what a worker calls the cause before you file it.** The worker of #360 measured first, found that the cause
  was older than the change that the owner suspected, and fixed it with a test that failed without the fix. Ask for
  the measurement before the fix when the owner reports a symptom on a device.
- **The compat page script grows with every MapLibre feature.** The owner raised its budget to 42 KB on 2026-11-14.
  Ask the owner early when the open pull requests together come near a budget.
- **Workers shared the scratchpad.** The brief now asks for file names that start with the branch name.

## Notes from the batch of 2026-11-15 (on the owner's Mac)

One coordinator on the owner's Mac (Apple M4, an iOS Simulator, an Android phone over USB), about 15 workers and 1
reviewer, 17 pull requests merged and the release 0.5.0.

- **A worker's worktree starts from the coordinator's checkout,** not from `origin/main`. Workers that started before
  the coordinator moved its checkout read the old brief. Run `git fetch origin && git checkout --detach origin/main`
  in your own checkout before you start workers, and again after a change of the brief.
- **The Mac differs from the cloud VM** in ways that the brief now lists (`BROWSER=open`, `cp -i`, Playwright not in
  the lockfile). The shell also has `noclobber`: `>` onto an existing file fails, and in a background command the old
  file is then read as if it were new. Write `>|`, or use new file names.
- **A device measurement needs the device to itself.** Give the phone to one worker at a time, and name it in the
  prompt. The setup (`adb reverse`, `adb forward … chrome_devtools_remote`, `connectOverCDP`) is in the prompts of
  #371 and #38 of this batch.
- **GitHub can skip the `pull_request` event.** #452 had no run of `CI` at all. Closing and opening the pull request
  again started it.
- **`gh pr checks --watch` right after a push** can return at once with "no checks". Wait about a minute before it.
- **Two pull requests that edit the same export lines** (`src/maplibre-compat.ts`: #452, #454, #456) conflict one
  after the other. Merge them one at a time, and send each conflict to the worker that has the context.
- **`git commit -am` in the coordinator's checkout** picks up files that a long run rewrote
  (`test/conformance/render-result.json` went into a test-only pull request once). Commit named files.
- **A triage worker reads; it does not run.** Two of its "open" items were already done on `main` (the compass drag,
  #358). Ask each worker to check the item on `main` first, as the brief says.

## Notes from the batch of 2026-11-16 (the plan of #480, on the owner's Mac)

One coordinator, about 30 workers and no reviewer, 28 pull requests merged for the 26 issues of the plan: 24 for the
issues (two pull requests covered two issues each, and one issue took two), one raised budget and three corrections
of tests.

- **Most pull requests changed `src/host.ts`, and each merge sent the others back.** Of the nine pull requests of
  the first batch, six needed a merge of `main` by their worker, and some needed two. A merge by the worker cost
  10,000 to 20,000 tokens and one more CI run. What helped: merge the pull request that has waited longest first, tell
  the workers that are in the middle of a merge what else reached `main`, and say in each prompt which numbers of
  `src/mistakes.ts` (texts and check kinds) a worker may take, because two workers took the same number three times.
- **A merge can break another branch with no conflict.** After #526 made the member `map` private, a check that
  another branch had added still read the old member; it merged cleanly and would have failed only at run time. After
  a merge that renames or removes something, send each open branch to its worker to merge `main` and search for the
  old name, and do not merge on a CI result that is older than that merge.
- **A check that fails by timing blocks every pull request.** Three checks did on this day (#517, #532): each read a
  value after a fixed wait or from the frames that happened to be drawn. Read which check failed before you take a red
  job as a fault of the pull request, file the check at once, and give it to one worker with a narrow brief. Two
  workers could not reproduce the failures on the Mac with the CPU throttled up to 40 times; the reading of the CI
  logs was enough to fix them. Do not start a failed job again in the hope of a lucky run.
- **A worker that reports the same number of steps in several notices is stuck** on a test run of its own. Give the
  issue to a new worker with what is known, and tell the first one to stop its servers.
- **`subscribe_pr_activity` needs the repository in the session.** Without it, a `Monitor` that lists the open pull
  requests and prints each new head when its checks have finished does the same work. It ends after 30 minutes and
  must be started again.
- **A pull request on top of an open one** (#535 and #536 on #529) worked: after the squash merge of the lower one,
  set the base to `main` (`gh api -X PATCH …/pulls/N -f base=main`) and let the worker merge `main`, taking the side
  of `main` for the lines of the lower pull request.
- **Ask the owner early for what blocks a chain.** The owner allowed the coordinator to merge the approved breaking
  pull requests and to raise the budget of the page script; before that, three issues waited behind one open pull
  request.
- **For a change of the look, the owner wants a live page on a local port,** with controls for the values in
  question, and not screenshots. `SendUserFile` does not work in a session that is not on a project thread. The
  server of a worker ends with the worker, so the coordinator starts it in the worktree of the worker
  (`PORT=… node demo/serve.mjs`, in the background).
- **Starting the `Browsers` workflow by hand seconds after a merge** cancelled the run of that merge. Wait until the
  run of the push has started its jobs, or start it again afterwards.

## After a batch

1. Run `pnpm status` once on `main` and open one pull request with the result.
2. Update the roadmap issue (#55): tick what closed, and correct the text of issues that were partly done.
3. Change the brief or these notes when a worker report shows a fault in them (in the first batch: an attribution
   line that the session rules replace, and a file `.demo.pid` that the test command left behind; in the batch of
   2026-11-13: workers that did not run the new test without the fix).
4. Read the results of the `Browsers` workflow on the last merged commit
   (`git fetch origin bench-results && git show origin/bench-results:README.md`, and `<system>-<browser>-tests.txt`
   for the names of the failing checks). CI runs only Chromium. On 2026-11-13 the checks of the new images and icons
   failed in WebKit (#150).
