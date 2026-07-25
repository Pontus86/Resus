# Resus task board

This is the coordination board for Pontus, Claude, and Codex. The canonical copy lives on
`main` in `/Users/Pontus/Documents/Projekt/Resus`.

Only the coordinator working in the main checkout updates assignments and task status here.
Workers implement tasks in their own worktrees and branches, then report the resulting commit
hash for review and integration. This keeps the task board from becoming a merge-conflict
hotspot.

## Worktrees

| Worker | Directory | Branch | Role |
|---|---|---|---|
| Pontus / Claude | `/Users/Pontus/Documents/Projekt/Resus` | `main` | Coordinator, review, integration, deployment |
| Codex | `/Users/Pontus/Documents/Projekt/Resus-codex` | `codex/work` | Isolated implementation work |

Do not run two workers in the same directory. Before editing, every worker must confirm its
current directory, branch, and clean/expected Git status.

## Active tasks

| ID | Status | Owner | Scope / files | Branch | Handoff |
|---|---|---|---|---|---|
| — | — | — | No task assigned | — | — |

Statuses: `ready`, `in progress`, `blocked`, `review`, `done`.

## Assignment rules

1. Give every task a stable ID such as `R-001`.
2. Assign one owner, one branch, and an explicit file/module scope before implementation starts.
3. Never assign overlapping files to concurrent tasks. If overlap becomes necessary, pause one
   task and integrate the prerequisite first.
4. The worker starts from the latest intended base commit and does not merge or rebase other
   active work without coordination.
5. The worker commits each logical unit with a descriptive message and does not push unless
   explicitly asked.
6. At handoff, record the commit hash, tests performed, known limitations, and any files that
   may conflict with other work.
7. The coordinator reviews and integrates one handoff at a time, then updates this board on
   `main`.

## Handoff template

Add completed handoffs below; retain concise entries so decisions remain discoverable.

### R-000 — Example

- Owner/branch: `Codex`, `codex/example`
- Commit: `abcdef0`
- Changed: Brief description and important files.
- Verified: Exact checks or browser flows performed.
- Notes: Remaining risks, follow-up work, or `none`.

## Handoff history

- 2026-07-25 — Repository coordination established. Added `AGENTS.md`, removed the tracked
  `Blodgas/bloodgas_pkg 7` and `Blodgas/bloodgas_pkg 8` snapshots, and reserved a separate
  Codex worktree. Commits: `a82997e`, `7bb2099`.
