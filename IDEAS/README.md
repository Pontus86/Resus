# Resus ideation threads

This folder is the shared pre-implementation notepad for Claude and Codex. Use it to explore
ideas before anyone commits to building them. Implementation still requires a separate,
explicitly scoped assignment in `TASKS.md`.

## Thread index

| Topic | Document | Status | Baton |
|---|---|---|---|
| I-001 — Feature/fix backlog review | `2026-07-25-feature-and-fix-backlog.md` | `decision proposed` | Claude (paused) |

Statuses: `discussing`, `decision proposed`, `approved`, `closed`.

Keep this index small. Update it when a thread is opened, changes status, changes baton, or is
closed—not for every reply.

## Starting a thread

1. Copy `_template.md` to `YYYY-MM-DD-short-topic.md`.
2. Give the thread an `I-###` identifier.
3. Add the initial entry and set `Current baton` to the next writer.
4. Commit the idea document so its handoff commit hash is known.
5. In a second commit, add a Codex assignment to `TASKS.md` that names the exact idea document,
   the required thread-base commit, branch/worktree, permitted file scope, and any short wait
   before the first check.
6. Ensure `codex/work` contains both commits before Codex starts.

## Reply and handoff protocol

Only the current baton holder may append to a thread.

Before writing, the baton holder must:

1. Confirm the expected worktree and branch and require a clean working tree.
2. Confirm that `HEAD` contains the required thread-base commit named in `TASKS.md`.
3. Read the entire thread, including the latest entry.
4. Stay within the idea document named by `TASKS.md` unless the brief explicitly includes the
   index or another file.

The baton holder then:

1. Appends a new dated entry; never rewrites another participant's entry.
2. Records open questions, agreements, and disagreements explicitly.
3. Changes `Current baton` to the other participant.
4. Commits the reply with a message such as `Reply to I-001 procedure roadmap`.
5. Reports the new commit hash. Claude's branch watcher may use that commit as the next
   thread-base commit.

The next writer must not start until its worktree contains the new commit. A watcher noticing a
commit does not itself synchronize branches.

## End of a Codex turn

Once Codex commits and reports its reply, that Codex turn has ended. Codex is no longer waiting
or watching the thread and cannot wake itself when Claude responds. Claude's watcher can detect
the commit, synchronize the branches, prepare the next `TASKS.md` assignment, and tell the user
that another Codex turn is ready. The user must then send an entire message containing exactly
`new`; that message starts Codex again and tells it to pick up Claude's new assignment.

## Short waits

An active ideation brief may ask Codex to wait a short interval before checking the document.
The user can also send an entire message such as `wait 30 sec`. Codex keeps that current turn
open, waits for the interval, then rereads the assigned idea document before acting.

This is suitable for short, bounded waits only. It does not wake a completed turn. Longer or
durable unattended delays require a scheduled task or an external timer that starts a new Codex
run.

## Safety rules

- Never let Claude and Codex write the same thread concurrently.
- Stop on a dirty or unexpected worktree instead of overwriting uncommitted work.
- Do not merge, rebase, or resolve a stale handoff silently; the coordinator synchronizes the
  branches first.
- Keep discussion append-only so Git history and authorship remain clear.
- Close long threads with a decision summary and open a successor thread rather than allowing
  one file to grow indefinitely.
- An `approved` idea is not authorization to implement it. Move build work into a normal
  `TASKS.md` assignment with explicit ownership and file scope.
