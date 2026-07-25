# Resus collaboration rules

## Purpose and users

Resus is a Swedish emergency-medicine training platform maintained by Pontus Olsson. Product
purpose, module rationale, external sources, licences, and attribution live in `about.html`.
Read it before changing a module's purpose or introducing an external data source.

## Architecture

- Production is plain HTML, JavaScript, and CSS with no build step or runtime package manager.
- Every page must work through `file://` and below the `/Resus/` GitHub Pages subpath.
- Use relative URLs and ordinary dependency-ordered scripts; do not fetch local runtime assets.
- Reuse the shared theme, navigation, authentication, and established Supabase/RLS flow.
- Preserve the BodyParts3D coordinate pipeline for Neuro and Kropps-atlas.
- Do not hand-edit generated or embedded models when a reproducible source pipeline applies.

`CLAUDE.md` contains the detailed architecture and must be read completely before code changes.

## Project records

- `TASKS.md`: active ownership, worktree, branch, scope, acceptance, and handoffs.
- `BUGS.md`: stable bug and improvement IDs; it is not an assignment queue.
- `IDEAS/`: append-only pre-implementation discussions with one baton holder.
- `DECISIONS.md`: durable decisions and their consequences.
- `Sandbox/`: disposable or exploratory prototypes; success does not authorize production use.

## Workspaces

- Coordinator: `/Users/Pontus/Documents/Projekt/Resus`, branch `main`.
- Codex worker: `/Users/Pontus/Documents/Projekt/Resus-codex`, branch `codex/work`.

Never run two workers in the same directory. The canonical task board and production
integration belong to the coordinator unless the user explicitly authorizes a takeover.

## Verification and release

- Follow the detailed Verification section in `AGENTS.md`.
- Test changed behavior and a nearby unaffected interaction.
- Large 3D pages require an explicit loaded flag rather than fixed sleeps.
- GitHub Pages deploys automatically from `main`; there is no separate deployment command.
- Before downloads, browser installation, or large 3D work, check `df -h /`.

## Language and provenance

- User-facing terminology and code comments are Swedish.
- New external 3D sources require licence and attribution updates in `about.html`.
- Raw models, reference PDFs, generated caches, and temporary artifacts must not be committed.

