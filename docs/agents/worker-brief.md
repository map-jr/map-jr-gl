# Brief for a worker on one issue

You are one of several workers running in parallel, each in its own git worktree. A coordinator merges the pull
requests. `CLAUDE.md` in the repository has the project rules (definition of done, writing rules); it applies to you.

## Steps

1. Read the issue with `mcp__github__issue_read` (load it with ToolSearch `select:mcp__github__issue_read,mcp__github__create_pull_request`). The issue usually names files and lines; start there and do not survey the repository. Then check that the fault is still on `main` (`git log --oneline -40 origin/main`, and read the named lines). If it is already fixed, change nothing, open no pull request, and report the commit and what remains.
2. `git fetch origin main && git checkout -b <branch> origin/main && pnpm install --frozen-lockfile`.
3. Make the smallest change that resolves the issue, with a test that fails without it. Keep to one concern. If the issue lists several parts, do the parts that your brief names; if a part turns out to be large or to need the owner (see the merge rule in `CLAUDE.md`), leave it out and say so.
4. Check: `pnpm build && pnpm test`. If the change can affect a browser test, run the one suite that covers it (`node test/host.mjs` or `node test/interact.mjs .cache/shots`) against your own demo server on the port that your brief gives you, because other workers run at the same time:
   `node scripts/site.mjs && (PORT=<port> node demo/serve.mjs >/dev/null 2>&1 & p=$!; sleep 3; PORT=<port> <test command> 2>&1 | grep -E "FAIL|Error" ; kill $p)` and count the `PASS` lines separately if you report a number.
   The machine has 4 cores and software WebGL, so a timing failure that goes away on a second run is load: say so in the report and do not change the test for it. Do not run `pnpm test:render` or the conformance tools unless the brief says so; CI runs the render tests.
5. Do not run `pnpm status` and do not touch the status table of the README: the coordinator does that once per batch, to avoid conflicts.
6. Commit, `git push -u origin <branch>`, and open a pull request against `main` with `mcp__github__create_pull_request` (owner `map-jr`, repo `map-jr-gl`). Follow `.github/pull_request_template.md`, write `Fixes #N` (or `Part of #N` when parts remain), and end the body with:
   `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
   Use the attribution lines that your own session instructions give for commits and pull requests.
7. Do not merge, and do not wait for CI. Stop after the pull request is open. The coordinator may message you later with a CI failure to fix on the same branch.

A fault you find outside your issue: do not fix it; name it in your report (one line each).

## Report (your final message; at most 13 lines, no preamble)

- PR: <url>
- Changed: <one or two sentences>
- Ran: <commands and results, with numbers>
- Size: <bytes gzip of each built file that changed, before and after, from `pnpm test:size`>
- Not checked: <what>
- Needs owner: <no | yes, because …>
- Left out / found: <parts of the issue not done; faults seen elsewhere>
