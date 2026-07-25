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
| R-001 | ready | Codex | `Procedurtraning/js/procedures-data.js`, `Procedurtraning/js/procedures3d.js` only — do not edit `Kroppsatlas/js/body3d.js` or `body3d-data.js` | `codex/work` | — |

Statuses: `ready`, `in progress`, `blocked`, `review`, `done`.

## Task briefs

Full context for tasks in `ready`/`in progress` status, so the worker doesn't have to
rediscover it. Move a task's brief under Handoff history once it reaches `done`.

### R-001 — Chest tube procedure (Procedurträning, third of five)

Add a `"chest-tube"` entry to `Procedurtraning/`, the 3D procedure-landmark trainer. Two
procedures already exist there as direct structural precedent — read both before starting:
`"io-tibia"` (simplest: one real bone + one schematic point) and `"central-line-ijv"`
(closest to this task: real landmarks + a multi-stage sequence + a `checklistId` link). Both
live in `Procedurtraning/js/procedures-data.js`; the point-resolution/stage-rendering logic is
in `Procedurtraning/js/procedures3d.js`.

**Landmarks — all real meshes, already merged, no new merge or schematic point needed** (first
of the five procedures with zero schematic geometry — verify these exact manifest names
yourself via `Kroppsatlas/models/body/manifest.js` before using them, don't take this list on
faith):
- `Rib_(5th).r` — skeletal — landmark (incision level, safe triangle's inferior border)
- `Latissimus_dorsi.r` — muscular — landmark (posterior border of the triangle of safety)
- `Pectoralis_major.r` — muscular — landmark (anterior border)
- `Superior_lobe_of_right_lung`, `Middle_lobe_of_right_lung`, `Inferior_lobe_of_right_lung` —
  organ — danger (don't puncture on insertion)
- `Diaphragm` — organ — danger (risk of sub-diaphragmatic placement if inserted too low)

**New rendering need**: the "triangle of safety" is normally shown as a translucent
triangle/polygon between the three landmark points above (lat dorsi / pec major / 5th rib),
not a point or a tube — neither exists yet in `procedures3d.js`. Build a small
local helper (e.g. `renderSafetyTriangle(pointNames, color)`) using a 3-vertex
`THREE.BufferGeometry` + `THREE.Mesh`, added directly to `body3d.overlayGroup` (already a
plain global from `Kroppsatlas/js/body3d.js` — every script shares one global scope, no
imports, see `AGENTS.md`). Keep this local to `procedures3d.js`; do not add it to the shared
`body3d.js` engine file — that's outside this task's scope (flag it in your handoff instead if
you think it belongs there long-term).

**Known non-bug to expect**: `Latissimus_dorsi`/`Pectoralis_major` are manifest-tagged
`region:"upper_limb"` (this dataset files shoulder-girdle muscles there, not under `"axial"`)
— unlike an earlier, genuinely mistagged case (`Common_carotid_artery`, already fixed), this
one is a defensible existing convention, not a bug to "fix" by retagging. The existing
`_procedure3dRegionFilterFor()` safety net in `procedures3d.js` will detect the mismatch
against this procedure's own `region:"axial"` and automatically fall back to region filter
`"all"` — that's expected, working as designed, not something to chase or work around.

**`checklistId`**: `"chest-tube"` — already exists in `Checklistor/`, link it the same way
`central-line-ijv` links to `"central-line"`.

**Verification**: same Playwright pattern as the other two procedures — serve the repo root
locally (`file://` blocks Playwright MCP), load `Procedurtraning/index.html`, wait for
`body3d.loaded===true` (no fixed sleep), select chest-tube, step through every stage, confirm
the triangle overlay renders and the danger/landmark markers are clickable via the existing
`window.onBody3DPick` flow, zero console errors. Screenshot the result. See `AGENTS.md`'s
Verification section for the general standard.

At handoff: record the commit hash on `codex/work`, what you verified, and anything you'd flag
for the coordinator (e.g. if the triangle-overlay helper feels like it belongs in `body3d.js`
after all).

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
