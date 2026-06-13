---
name: linear-backlog
description: Autonomously works through the Pilotapp Linear "Todo" backlog one issue at a time — resolves each in code, typechecks, and moves it to "In Review" with a summary comment. Use when Lucas wants to clear the Linear Todo backlog, knock out assigned Linear issues unattended, or fires it remotely from his phone to run while he works on other things.
---

# Linear backlog — autonomous Todo clearer

Fire-and-forget: clears the **Pilotapp** team's **Todo** column without supervision, so it can be triggered remotely (e.g. from the phone) and run while Lucas does other work. One invocation processes the whole Todo backlog and ends with a plain-English summary. Each issue is checkpointed live in Linear (→ In Progress when picked up, → In Review + comment when done), so progress is visible remotely and survives even if the session is interrupted.

**Team:** `Pilotapp`. **Only touch issues whose status is exactly `Todo`** — never Backlog, In Progress, In Review, Done, or Canceled. (Those other columns are deliberately out of scope.)

## Preflight (once, before the loop)

- Read `HANDOFF.md`, `CLAUDE.md`, `AGENTS.md` — current project state + the conventions every fix must follow.
- Run `git status` and note the starting state. Leave the working tree as-is; **never commit or push** (see Rules).
- Confirm the Linear MCP responds (`list_issues` on `Pilotapp`). If Linear isn't connected, stop and say so — don't guess.

## The loop — repeat until no `Todo` issues remain

1. **List** Todo issues: `list_issues(team:"Pilotapp", state:"Todo", limit:250)`. If none → STOP and write the final summary.
2. **Pick one** — highest priority first, then oldest. ⚠️ Linear priority is `1=Urgent, 2=High, 3=Medium, 4=Low, 0=None` — treat **0 (None) as the LOWEST**, not highest. Order: 1 → 2 → 3 → 4 → 0; tie-break by oldest `createdAt`.
3. **Read it fully** — `get_issue` for the description, plus `list_comments` for any added context.
4. **Mark In Progress** — `save_issue(id, state:"In Progress")` the moment you start it, so anyone watching (including Lucas on his phone) sees which issue is being worked on right now.
5. **Resolve in code** — if it's non-trivial (3+ steps or an architectural call), plan first, then implement. Follow CLAUDE.md/AGENTS.md: reuse existing patterns, themed styles, no raw hex, educative comments, no duplicate code.
6. **Verify** — `npx tsc --noEmit` must pass (plus any check the issue implies). If it breaks, fix it; never advance on a red build.
7. **Hand off, don't close** — once it's resolved AND verified, move ONLY that issue to **`In Review`** (`save_issue(id, state:"In Review")`) and `save_comment` summarizing it: **files touched + a one-line rationale** so Lucas can review. **Never set `Done`** — he verifies and closes.
8. Next iteration.

## Rules (unattended-safe — this runs with nobody watching)

- **One issue per iteration.** Never batch-resolve — keeps each change reviewable and stops one bad fix from poisoning the rest.
- **Never block on a question.** Do NOT use AskUserQuestion. If an issue is ambiguous, blocked, or needs a product decision you can't safely default: leave its status on `Todo`, post a comment explaining exactly what you need, skip it, and record it in the final summary.
- **`In Review`, not `Done`.** Respects the verify-before-done gate — Lucas closes.
- **Do NOT commit or push** unless explicitly asked. Leave all edits in the working tree for review.
- Keep going across iterations until the `Todo` column is empty or only blocked/skipped issues remain.

## Final summary (when the loop ends)

Plain English, no jargon — Lucas may read this on his phone. For each issue: its title, what changed in human terms, and whether it's **In Review** or **skipped/blocked + why**. Close with a count (moved to review vs skipped) and a one-line reminder that nothing was committed.

## Optional: periodic re-check

This clears the backlog once per invocation. To re-check on a schedule, wrap it with the loop skill: `/loop 30m /linear-backlog` (interval) or `/loop /linear-backlog` (self-paced).
