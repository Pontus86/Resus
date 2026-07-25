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
| R-002 | ready | Codex | `Procedurtraning/js/procedures-data.js` only — do not edit `procedures3d.js`, `body3d.js`, or `body3d-data.js` this time, all the plumbing you'd need already exists | `codex/work` | — |

Statuses: `ready`, `in progress`, `blocked`, `review`, `done`.

## Task briefs

Full context for tasks in `ready`/`in progress` status, so the worker doesn't have to
rediscover it. Move a task's brief under Handoff history once it reaches `done`.

### R-002 — Lumbar puncture procedure (Procedurträning, fourth of five)

This one's split: the coordinator (Claude) already did the infrastructure half in commit
`fa74e7a` — merged the lumbar discs, wired in spinal cord access, and built the two schematic
helpers this procedure needs. Your job is narrower than R-001: **only add the `"lumbar-puncture"`
entry to `PROCEDURE3D_ANATOMY` and `PROCEDURE3D_LIST` in `procedures-data.js`.** Do not touch
`procedures3d.js` — everything you need there already exists (see below). Read `"chest-tube"`
in `procedures-data.js` first, it's the closest precedent (real landmarks + a special top-level
shape field, same idea you'll reuse here).

**Real landmarks — already merged, verify names yourself against
`Kroppsatlas/models/body/manifest.js` before using them**:
- `Lumbar_vertebrae_(L1)` through `Lumbar_vertebrae_(L5)` — skeletal, axial, mid — landmark
  (L3–L4 or L4–L5 is the usual level, below the conus medullaris)
- `Sacrum` — skeletal, axial, mid — landmark (Tuffier's line / iliac crest level proxy — no
  separate iliac crest mesh exists, the sacrum's own position is the closest real proxy)
- `Intervertebral_disc_L3_L4`, `Intervertebral_disc_L4_L5` — connective, axial, mid — landmark
  or context, your call which 1-2 discs are worth including as landmarks vs just L3/L4/L5
  vertebrae alone being enough

**Schematic landmarks — already built for you, just reference by name, do not
reimplement**:
- `dural_sac_schematic` (no `.l`/`.r` suffix — it's midline) — renders as a simple 2-point tube
  via the existing generic mechanism, same as `sternocleidomastoid_schematic` did for
  central-line-ijv. This is the actual target — dura/subarachnoid space, no real mesh exists
  for it anywhere in the source library.
- Cauda equina is **not** a landmark-list entry — it's a special top-level field, same pattern
  as `chest-tube`'s `safetyTriangle`. Add `caudaEquina: {color:"#E8C744"}` (color optional,
  defaults to that same gold if omitted) to the procedure object. This calls
  `renderCaudaEquina()` automatically — six fanning tube strands between the same two anchors
  as the dural sac. Do not add a `points` field to it (unlike `safetyTriangle`, it takes no
  points — it derives its own anchors internally). `strandCount` is also optional (defaults
  to 6).

**Region**: use `region: "axial"` — all the real landmarks above are already correctly tagged
`"axial"` in the manifest (no mismatch to expect this time, unlike chest-tube's muscles or
central-line's carotid artery), so the region filter should stay usefully narrow, not fall
back to `"all"`.

**`checklistId`**: `"lumbar-puncture"` — already exists in `Checklistor/`.

**Stages**: your call on count/wording, following the same shape as the other three
procedures (skin → level identification → dural puncture/CSF return is a reasonable 3-stage
split, matching central-line-ijv's structure most closely). `focus` on the final stage should
probably be `"dural_sac_schematic"` so the camera lands on the actual target.

**Verification**: same Playwright pattern as before — serve the repo root, load
`Procedurtraning/index.html`, wait for `body3d.loaded===true`, select lumbar-puncture, confirm
`body3d.registry['spinalcord']` and the 5 disc names exist (they will — already merged and
already script-tagged, this isn't something you need to add), step through every stage,
confirm the dural sac tube AND the cauda equina fan (6 `TubeGeometry` children in
`body3d.overlayGroup`, not counting the dural sac's own tube) both render, zero console
errors. See `AGENTS.md`'s Verification section for the general standard.

At handoff: commit hash on `codex/work`, what you verified, anything to flag.

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
