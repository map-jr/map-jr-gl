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
  4 minutes.
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

## Independent review

Ask for a review when a pull request changes how every map starts or draws, rewrites code that it did not need to
touch, or has less than a few hundred bytes of room. The reviewer is a new worker that gets the branch and a list
of questions, not the report of the author. It must reproduce a fault before it reports it, and it reports only to
the coordinator. The two reviews of 2026-11-12 cost about 120,000 and 160,000 tokens and found six faults that the
authors' own tests did not (a false warning, an unhandled rejection, a popup that scrolls the map, a popup that
is invisible when it opens a second time). A reviewer that has Firefox and WebKit of Playwright finds what the
author's Chromium run cannot.

## When the usage limit stops the workers

A worker that stops at a usage limit keeps its context. After the limit resets, send each one a message that says
it was stopped by the limit, what changed on `main` since, and its port. Do not start new workers for the same
issues. Before you wait, push the branch of each stopped worker, so that the work survives the end of the session.

## After a batch

1. Run `pnpm status` once on `main` and open one pull request with the result.
2. Update the roadmap issue (#55): tick what closed, and correct the text of issues that were partly done.
3. Change the brief or these notes when a worker report shows a fault in them (in the first batch: an attribution
   line that the session rules replace, and a file `.demo.pid` that the test command left behind).
