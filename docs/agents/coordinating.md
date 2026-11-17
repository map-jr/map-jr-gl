# Notes for a coordinator of several workers

A coordinator is a session that gives issues to workers (subagents) and merges their pull requests. The rules are in
`CLAUDE.md`; the brief that each worker reads is `docs/agents/worker-brief.md`. Change the brief or these notes when
a batch shows a fault in them.

## Before a batch

- **Triage first.** An issue can be older than `main`. A read-only triage worker checks the issues for about 7,000
  tokens each and returns one table: what is still open, the file and line where the work starts, a rough size, and
  whether the owner is needed. A worker that finds its issue already fixed has spent about 80,000 tokens on it.
  Triage reads and does not run, so the brief still makes each worker check its issue on `main`.
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

- Do not copy the issue or the rules into the prompt. The worker reads the issue, and `CLAUDE.md` is in its context.
- Start each worker with `isolation: "worktree"` and low effort (90,000 to 160,000 tokens for an issue).
- A worker needs no port: `scripts/agents/suite.mjs` takes a free one.
- On the cloud VM (4 cores), more than about six workers that run browser suites at once make timing tests fail.

## While the workers run

- **Do not read the transcript of a worker,** and do not touch its worktree unless a notice says that it failed. A
  worker with no report is usually still testing.
- **A worker that reports the same number of steps in several notices is stuck** on a test run of its own. Give the
  issue to a new worker with what is known, and tell the first one to stop its servers.
- **Watch the checks** with `node scripts/agents/prs.mjs --watch` in a `Monitor` (it prints one line when the checks
  of a head finish, also for CI on `main`, which sends no event), or with `subscribe_pr_activity` when the repository
  is in the session. A Monitor ends after 30 minutes; start it again.
- **Send a CI failure, a review finding or a decision of the owner to the worker that opened the pull request**
  (`SendMessage`): the failure and the check run, not the task again. A follow-up costs 10,000 to 20,000 tokens and a
  new worker about 100,000.
- **Turn each "found" line of a report into its own issue** at once, in the form of "Issues" in `CLAUDE.md`. Search
  for an issue of the same fault first (`gh issue list --search`). Do not add a fault to another issue as a comment.
- **Say in each update to the owner** which pull requests wait for the owner and why, with a recommendation. Ask
  several decisions in one question.
- **For a change of the look, the owner wants a live page on a local port** with controls for the values in
  question, not screenshots. The server of a worker ends with the worker, so start `PORT=… node demo/serve.mjs` in
  the background in the worktree of the worker.
- **A usage limit stops workers with their context.** Push the branch of each stopped worker before you wait. After
  the reset, send each one what changed on `main`; do not start new workers for the same issues.

## Merging

- **Read the source diff before you merge** (`git diff origin/main...origin/<branch> -- src | grep -E "^[+-]"`), and
  merge with the head SHA that you read.
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
- **A pull request with no CI after 5 minutes** (`prs.mjs --watch` says so) missed its event: close it and open it
  again.
- **A run of merges cancels CI on `main`,** because each push cancels the run before it. After several merges, let
  one run on `main` finish before you merge more, and before a change that alters how every map starts.
- **The `Browsers` workflow keeps one waiting run,** so a start by hand or a merge while another run waits cancels
  the waiting one. Start the Safari run after the last merge of a series, once the run of that merge has started its
  jobs, and merge nothing until it has finished (about 15 minutes).
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

Ask for a review when a pull request changes how every map starts or draws, rewrites code that it did not need to
touch, or leaves less than a few hundred bytes of a budget. The reviewer is a new worker that gets the branch and a
list of questions, not the report of the author. It reproduces a fault before it reports it, and it reports only to
you. A review costs 115,000 to 160,000 tokens and found faults that the tests of the author did not each time
(2026-11-12, 2026-11-13). A reviewer with Firefox and WebKit of Playwright (`BROWSER=webkit`) finds what Chromium
alone cannot.

## After a batch

1. Run `pnpm status` once on `main` and open one pull request with the result.
2. Check that each issue that the batch touched is closed, or has a title and a body that say what is left.
3. Read the results of the `Browsers` workflow on the last merged commit
   (`git fetch origin bench-results && git show origin/bench-results:README.md`, and `<system>-<browser>-tests.txt`
   for the names of failing checks). CI runs only Chromium.
4. Clean the worktrees: `node scripts/agents/clean-worktrees.mjs` prints what it would remove and what it keeps, and
   why; `--apply` removes them. It keeps a worktree that is locked by a live session, has changes, or has a commit
   that is not merged.
