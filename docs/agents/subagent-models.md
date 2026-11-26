# Models for subagents

This page gives the measurements behind the choice of a model for each subagent, which `docs/agents/coordinating.md`
states as a table ("The prompt of a worker"). The owner chose that table on 2026-11-26 from the measurements below. The
goal is to run more coordinators within the same usage limit.

## Prices

Per million tokens, input and output (the `claude-api` reference of 2026-11-03):

| Model | Input | Output | Cache read |
|---|---|---|---|
| Opus 5.5 | $4 | $20 | $0.20 |
| Sonnet 5.5 | $2 | $10 | $0.10 |
| Haiku 5.5 | $0.10 | $0.50 | not listed |

How the usage limit of a subscription weighs these is not documented. The prices give the ratios: a Sonnet subagent
costs about half of an Opus one for the same tokens, and a Haiku subagent a small fraction.

## The fixed context of a subagent

A subagent that replies "OK" with no tool ends at the same context size on every model. The number in a task notice is
the size of the context at the end of the run, not the sum of what was processed.

| Subagent type | Context at the end of a run that does nothing |
|---|---|
| general-purpose or claude (all tools) | 68,900 to 69,100 tokens |
| Explore or Plan (no tools that edit files) | 47,400 tokens |
| worker (`.claude/agents/worker.md`: Bash, Read, Edit, Write, Grep, Glob), Sonnet, reply OK | 16,378 tokens (measured 2026-11-26) |

Reading `docs/agents/worker-brief.md` adds about 6,400 tokens; `CLAUDE.md` is about 6,000. The rest of the fixed part
is the system prompt of Claude Code and the definitions of its tools. Later steps and later subagents of the same model
and type read that prefix from the prompt cache, so its cost after the first write is small. A subagent costs mostly
what it reads new and what it writes. A subagent asks for the five-minute cache (all 5,164 requests of the subagents of
2026-11-26 did), while the coordinator asks for one hour, so a subagent that waits longer than five minutes writes its
context again on its next step.

## Reviews of known faults

Each review below ran on an old head of a pull request where an Opus review had found a fault, with the prompt of that
Opus review and no hint of the fault.

| Head | Model | Tokens | The known fault | Beyond the Opus review |
|---|---|---|---|---|
| #2178 at `d277e1d6` | Opus | 92,500 | found (ran) | - |
| | Sonnet | 109,600 | found (ran) | a radius of 100,000 threw (ran); wider checks |
| #2213 at `bcdf4d6a` | Opus | 80,900 | found (read) | - |
| | Sonnet | 80,200 | found, but called "minor" | - |
| | Haiku | 103,500 | found, "fix first" | the docs' "as in MapLibre" was wrong (MapLibre calls the function on every update) |
| #2126 at `91b00b9b` | Opus | 94,200 | found both (one ran, one read) | - |
| | Sonnet | 129,700 | found one of two (ran) | two new faults, which a Haiku check confirmed on `main` (#2233, #2235) |

## Other runs

The tokens are the size of the context at the end of each run, as in the task notices; `docs/agents/coordinating.md` retires a worker at about 140,000.

| Task | Model | Tokens | Result |
|---|---|---|---|
| Triage of #1820, #1851, #1907, #2211, #2212, #2128 | Opus | 97,000 | ran code for #1820 and #2211 and corrected both premises |
| The same triage | Sonnet | 87,000 | read only; agreed on 4 of 6 rows, kept the 2 wrong premises |
| Triage of #2190, #2210, #1787, #2208, told to run a command for each | Sonnet | 84,700 | ran for 2 of 4; one run corrected #2210 |
| Check on `main`: does a radius of 100,000 still throw | Haiku | 91,400 | correct (no); found #2230 |
| Check on `main` of two findings of a review | Haiku | 102,000 | confirmed both against MapLibre, corrected one detail, found a fourth difference (#2233 to #2236) |
| Worker #2230 (#2239) | Sonnet | 120,000 | reproduced, 3-line fix with a check, first CI green, merged with no follow-up |
| Worker #2233 (#2240) | Sonnet | 118,300 | reproduced, fix and check, review found no fault in it |
| Fixes of review findings and of 11 failed checks of #2229 | Sonnet | 145,000 to 161,000 | each cause found, no check loosened |
| Workers on one issue each | Opus | 87,000 to 178,000 | the baseline of the day |

## What the runs show

- Sonnet and Haiku find the faults that a review or a check looks for, and run code to show them. Their verdicts can be
  too mild, so the coordinator reads each finding.
- Opus earns its cost in triage: it tests a premise with a command where Sonnet reads, and an issue that was only read
  names the wrong cause in about a third of the cases (`docs/agents/coordinating.md`, "Before a batch").
- Sonnet workers did as well as Opus workers on issues with a known cause. Two runs are few; record the first-CI result
  and the review findings of the next Sonnet workers, and change the table when they disagree.
- The model changes the number of tokens little, so the saving comes from the lower price per token.
