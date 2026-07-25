# Codex guide for Resus

This file is the starting point for Codex sessions in this repository. The detailed project
documentation remains in `CLAUDE.md`; read that file completely before changing code.

## Start every task

1. Read `CLAUDE.md` completely.
2. Read the relevant module's `index.html`, scripts, and styles before editing.
3. Read `about.html` before describing a module's purpose, changing that purpose, or adding an
   external data source.
4. Check `git status --short` and preserve all pre-existing user changes.
5. Before large downloads, Playwright installation, or 3D-model work, run `df -h /`.

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

- Treat a dirty working tree as user work. Never discard, overwrite, or broadly reformat it.
- `Models/`, reference PDFs, macOS files, temporary Word files, and the nested legacy Android
  repository are intentionally ignored; consult `.gitignore` before changing ignore rules.
- Do not add ignored raw models or PDFs to Git.
- Do not amend, rebase, force-push, or rewrite history.
- Do not commit or push unless the user asks. Before a user-requested risky reconstruction,
  recommend creating a known-good commit.
- GitHub Pages deploys automatically from `main`; there is no separate deployment command.

## Useful entry points

- Site landing page: `index.html`
- Shared design system: `css/theme.css`
- Shared navigation: `nav.js`
- Shared authentication: `auth.js`
- Account statistics: `stats.html`, `stats.js`
- Project purpose and attribution: `about.html`
- Module and 3D-specific details: `CLAUDE.md`
