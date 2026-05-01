# Claude Code — mydeck-console

Start with [AGENTS.md](AGENTS.md). It is the primary, portable guide and
contains everything you need on project state, architecture, conventions, and
ground rules. This file adds only Claude-specific notes.

## Ground rules recap

From AGENTS.md, do not forget:

- **Git writes are the user's job.** No `git commit`, `git push`, `git add`,
  or destructive git. Read-only git is fine.
- **Builds and deploys are the user's job.** No `npm run build`, no
  `make build`, no `./deploy.sh`.
- **No secrets in tracked files.** `BRAVE_API_KEY` lives only in `.env` and
  gets injected by the `/brave/` proxy.

## Sub-agents under a Pro subscription

The user is on Claude Pro, so 5-hour and weekly limits are real. Default is
**no sub-agents**. When they genuinely help:

- **Serial, never parallel.** Do not send multiple Agent tool calls in one
  message.
- **Announce before spawning.** Tell the user what you're about to delegate
  and why, so they can veto.
- **Fit the job to the agent.**
  - `Explore` (Sonnet-backed) is great for broad repo sweeps and
    "where does X get used?" questions.
  - A scoped one-shot is fine when the task is self-contained and the
    result can be reviewed in one pass.
  - Avoid sub-agents for tight iterative work, for anything where
    Opus-level reasoning is load-bearing, or when the user is likely to
    want to redirect mid-task.

## Memory

Memory lives at `/home/coder/.claude/projects/-mnt-projects/memory/`. The user
profile, infrastructure notes, and project-level memory for mydeck-console
are already indexed there. Prefer reading existing memory over asking the user
to re-explain their setup. Update memory when something durable changes
(e.g. architecture decisions, new ground rules) — not for in-flight task state.

## Skills

If the user invokes a slash command, use the `Skill` tool with the exact name.
Don't guess skill names from training data.

## Operational preferences

- Terse over verbose. The user reads diffs, not commentary.
- State what you're about to do in one sentence, make the change, move on.
- No trailing "I've now done X, Y, Z" summaries after an edit the user can see.
- When choosing between reading more files and asking, prefer reading first —
  the context is cheap, the interruption isn't.
