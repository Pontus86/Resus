# Codex guide for Resus

This file is the starting point for Codex sessions in this repository. The detailed project
documentation remains in `CLAUDE.md`; read that file completely before changing code.

## Task shorthand

When the user's entire message is exactly `new` (with no other content), Claude has assigned a
new task to Codex. Follow the "Start every task" checklist below, read the current Codex
assignment and brief in `TASKS.md`, and begin that task without waiting for a second prompt. If
`TASKS.md` has no task assigned to Codex, report that instead of guessing a task.

After Codex commits and reports an ideation reply, that turn is finished: Codex is no longer
waiting, polling the thread, or able to restart itself. Claude's watcher may detect the commit
and prepare or announce the next assignment, but the user must send a new message containing
exactly `new` to start Codex's next turn.

When the user's entire message matches `wait N sec`, `wait N seconds`, `wait N min`, or
`wait N minutes` (where `N` is a positive integer) and an ideation task is active, keep the
current turn open for that short interval. When it expires, reread the idea document named in
the active `TASKS.md` brief before replying or editing. A wait instruction only delays the
current active turn; it cannot wake a finished Codex turn. For longer or durable unattended
delays, use a scheduled task or an external process that starts a new Codex run.

## Start every task

1. Read `CLAUDE.md` completely.
2. Read `TASKS.md` and confirm the assigned owner, branch, worktree, and file scope.
3. Read the relevant module's `index.html`, scripts, and styles before editing.
4. Read `about.html` before describing a module's purpose, changing that purpose, or adding an
   external data source.
5. Check the current directory, `git branch --show-current`, and `git status --short`. Preserve
   all pre-existing user changes and stop if the worktree or task ownership is wrong.
6. Before large downloads, Playwright installation, or 3D-model work, run `df -h /`.

If repository behavior conflicts with an assumption in this file, investigate the current code
and update this guide when appropriate.

## Non-negotiable architecture

- The production site is plain HTML, JavaScript, and CSS. Do not introduce a build step,
  bundler, package runtime, framework, or ES-module dependency without explicit approval.
- Every page must work when opened directly through `file://` and when hosted below the
  `/Resus/` GitHub Pages subpath.
- Use relative URLs. Never add root-absolute asset paths such as `/css/theme.css`.
- Do not use `fetch()` for local runtime assets. Embed local data in ordinary scripts and expose
  it through globals, following the existing module patterns.
- Script order is dependency order: data scripts first, feature logic next, and `main.js` last.
  Any new script must be added to the corresponding HTML entry point.
- Reuse root infrastructure where applicable: `css/theme.css`, `nav.js`, `auth.js`,
  `lib/supabase.js`, and the established Supabase/RLS flow.
- A new module must be added both to the root page's module grid and to `nav.js`'s `MODULES`
  array.
- Keep Neuro and Kropps-atlas 3D data in the established BodyParts3D coordinate space. Do not
  alter scale, offsets, mirroring, mesh grouping, or OBJ preprocessing without tracing the
  existing pipeline and verifying representative anatomy.

## Editing conventions

- Match the local style instead of reformatting unrelated code.
- Write code comments in Swedish. Explain hidden assumptions, trade-offs, or the reason for a
  workaround—not a literal restatement of the code.
- Prefer straightforward local code over speculative abstractions.
- Keep user-facing Swedish terminology consistent with nearby UI.
- Update `about.html` when a module's purpose changes materially or a new external source,
  licence, or attribution is introduced.
- Do not edit generated or embedded model files by hand when an existing source/merge pipeline
  should produce the change.

## Verification

Use the smallest verification that can catch realistic regressions, then broaden it when the
change is risky.

- For JavaScript edits, perform a syntax check where practical.
- Inspect every changed HTML script/style path and its load order.
- Test the affected page through Playwright against its local `file://` URL. Large 3D pages can
  need 30–90 seconds; wait for their explicit loaded flag instead of sleeping for a fixed time.
- Check both the changed interaction and a nearby unaffected interaction.
- For shared navigation, authentication, theme, or root infrastructure, smoke-test more than one
  module.
- For responsive UI changes, test at least one desktop and one narrow viewport.
- Do not install or download Playwright/browser binaries before checking disk space. Reuse an
  existing browser cache when available.
- At handoff, state exactly what was changed, what was tested, and any verification that could
  not be completed.

## Git and scope safety

- Follow `TASKS.md`: work only in the assigned worktree, branch, and file/module scope.
- Do not edit files assigned to another active task. If an overlap is discovered, stop and
  report it to the coordinator before continuing.
- Treat a dirty working tree as user work. Never discard, overwrite, or broadly reformat it.
- `Models/`, reference PDFs, macOS files, temporary Word files, and the nested legacy Android
  repository are intentionally ignored; consult `.gitignore` before changing ignore rules.
- Do not add ignored raw models or PDFs to Git.
- Do not amend, rebase, force-push, or rewrite history.
- Commit completed logical units with descriptive messages so other workers can inspect them.
  Do not push unless the user asks. Before a user-requested risky reconstruction, recommend
  creating a known-good commit.
- At handoff, report commit hashes, verification performed, known limitations, and likely
  conflict files. The coordinator owns status updates in the canonical `TASKS.md` on `main`.
- GitHub Pages deploys automatically from `main`; there is no separate deployment command.

## Useful entry points

- Site landing page: `index.html`
- Shared design system: `css/theme.css`
- Shared navigation: `nav.js`
- Shared authentication: `auth.js`
- Account statistics: `stats.html`, `stats.js`
- Project purpose and attribution: `about.html`
- Module and 3D-specific details: `CLAUDE.md`
- Shared pre-implementation discussions: `IDEAS/README.md`
