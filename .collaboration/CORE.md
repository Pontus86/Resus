# Shared collaboration rules

These rules come from Project Collaboration Kit. Project-specific rules live in
`.collaboration/PROJECT.md` and take precedence when they are more restrictive.

## Start every task

1. Read `.collaboration/PROJECT.md`, `TASKS.md`, and relevant local documentation completely.
2. Confirm task owner, branch or worktree, permitted file scope, and expected base commit.
3. Print the current directory, branch, and short Git status before editing.
4. Treat all pre-existing changes as user work. Never discard or overwrite them.
5. Stop if ownership, branch, worktree, base commit, or scope is wrong.

## Work states

```text
Idea → decision → task → implementation → verification → review → integration → release
```

- Discussion in `IDEAS/` does not authorize implementation.
- A sandbox experiment may fail and does not become production code automatically.
- Every implementation requires one owner, an explicit scope, and acceptance criteria.
- Only the current baton holder may append to an active idea thread.

## Scope and Git safety

- Work only in the files and branch assigned in `TASKS.md`.
- Do not edit files assigned to another active task.
- Do not amend, rebase, force-push, or rewrite shared history.
- Commit completed logical units with descriptive messages.
- Never push unless the user, coordinator, or project rules explicitly request it.
- Report commit hashes, verification, limitations, and likely conflict files at handoff.

## Verification

- Use the smallest check that can catch realistic regressions, then broaden for risky changes.
- Test the changed behavior and at least one nearby unaffected behavior.
- Record exactly what was tested and what could not be tested.
- Do not declare success solely because code was written or a command exited successfully.

## Decisions

- Record durable technical or product decisions in `DECISIONS.md`.
- Include context, decision, alternatives, consequences, owner, and date.
- Supersede old decisions; do not silently rewrite their history.

