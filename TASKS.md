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

## Task briefs

Full context for tasks in `ready`/`in progress` status, so the worker doesn't have to
rediscover it. Move a task's brief under Handoff history once it reaches `done`.

_None right now._

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

### R-001 — Chest tube procedure — done

- Owner/branch: `Codex`, `codex/work`
- Commit: `3c08a4d` (fast-forwarded into `main`, no conflicts — `codex/work` had zero
  divergence from `main` beyond this one commit)
- Changed: `Procedurtraning/js/procedures-data.js` (new `"chest-tube"` entry, 4 stages, 7
  landmarks, all real meshes, zero schematic points — first procedure with none), and
  `Procedurtraning/js/procedures3d.js` (new local `renderSafetyTriangle()` helper — a 3-vertex
  translucent `THREE.Mesh` added to `body3d.overlayGroup`, not pickable by design so raycasts
  pass through to the real landmarks behind it). Exactly the two files it was scoped to; no
  changes to `Kroppsatlas/js/body3d.js`/`body3d-data.js`.
- Verified (coordinator, Playwright against the `codex/work` worktree checkout): zero console
  errors through the full flow; `io-tibia` still regresses clean; region filter correctly
  falls back to `"all"` for chest-tube (the expected non-bug from the brief, not worked
  around); all 3 required systems (`skeletal`/`muscular`/`organ`) lazy-load; skin-cut clip
  engages (6 planes, `clipIntersection=true`) on stage 0; stepped through all 4 stages
  cleanly, `central-line-ijv`'s SCM tube still renders correctly after switching procedures
  (needed to wait for `vascular` to actually finish loading — a timing issue in my test
  script, not the app); safety-triangle mesh's world bounding box cross-checked numerically
  against the 3 landmark meshes' own boxes (nested correctly inside their shared
  neighborhood) and confirmed visually by temporarily isolating just those 3 meshes —
  triangle renders in the right spot, between the two muscles near the rib; all 3 landmark
  types (real "landmark", real "danger", the safety triangle itself) behave correctly; reset
  clears stage index, selection, and overlay including the triangle.
- Notes: none — no follow-up needed. Landmark points use each mesh's overall centroid rather
  than a specific anatomical border point (e.g. pec major's lateral edge specifically); that's
  a reasonable first-pass simplification, not wrong, and matches how the task brief phrased
  the ask. Worth a look if a future pass wants tighter anatomical precision, not blocking.

### R-002 — Lumbar puncture procedure — done

- Owner/branch: split — coordinator (Claude) did the infrastructure half directly on `main`
  (commit `fa74e7a`: merged the 5 lumbar discs into `connective.js`, added `spinalcord.js` to
  `Procedurtraning/index.html`, built `dural_sac` + `renderCaudaEquina()` in `procedures3d.js`);
  Codex did the data-authoring half on `codex/work` (commit `7aff857`)
- Commit: `7aff857` (fast-forwarded into `main` on top of the coordinator's own `fa74e7a`, no
  conflicts)
- Changed: `Procedurtraning/js/procedures-data.js` only, exactly the scope given — new
  `"lumbar-puncture"` entry, 3 stages, 9 landmarks (L1/L2 as context explaining the conus-
  medullaris safety margin, L3–L5 + 2 discs as landmarks, Sacrum as context, `dural_sac_schematic`
  as the schematic target), `caudaEquina: {color:"#E8C744"}` with no `points` field (correctly
  matching the brief — it derives its own anchors). Correctly omitted `reveal` on the schematic
  target stage, since `body3dSelectByName` only resolves real registry entries — good judgment
  call, not spelled out explicitly in the brief.
- Verified (coordinator, Playwright against the `codex/work` worktree checkout): zero console
  errors through the full flow; region filter correctly stayed `"axial"` (no fallback needed,
  as predicted — first procedure where every real landmark's manifest region tag actually
  matches); `spinalcord` and all 5 discs load into the registry; skin-cut clip engages
  correctly; stepped through all 3 stages; overlay ends with 7 `TubeGeometry` children (1 dural
  sac + 6 cauda equina strands) exactly as expected; visually confirmed the dural sac/cauda
  equina bundle descends correctly alongside the lumbar vertebrae; all 3 landmark types (real
  landmark, real context, schematic target) click correctly, schematic click correctly does
  NOT set `body3d.selectedName`; re-verified io-tibia, central-line-ijv, and chest-tube all
  still regress clean (hit two timing races in my own test script along the way — checking
  `loadedSystems` flags instead of waiting for actual registry population — not app bugs, same
  category as a race I'd already hit and fixed once before in this project).
- Notes: none — no follow-up needed. Hit a disk-space crisis mid-verification (down to 639MB
  free) — cleared 1.7GB by removing the `Blodgas/bloodgas_pkg 7`/`8` leftover `node_modules`
  directories that R-001's cleanup had stopped tracking but never deleted from disk. Unrelated
  to this task's correctness, just a repo-hygiene note for next time this comes up.
