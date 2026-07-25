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
| R-003 | in progress | Claude | `Kroppsatlas/js/body3d.js`, `Procedurtraning/js/procedures3d.js` — fixing B-004/B-005 | `main` | — |
| R-004 | ready | Codex | Investigation/report only for B-006/B-007 — do not edit `Neuro/js/brain3d.js`, `Kroppsatlas/js/body3d.js`, or any other code file. Append findings to the relevant `BUGS.md` rows only. | `codex/work` | — |

Statuses: `ready`, `in progress`, `blocked`, `review`, `done`.

`I-001` (ideation thread) is paused, not an active task right now — see its own header in
`IDEAS/2026-07-25-feature-and-fix-backlog.md` for status. Removed from this table since nothing
is currently assigned there; it'll come back if/when the cricothyrotomy thread opens or the
thread otherwise resumes.

**Why R-003 and R-004 can run concurrently despite both touching body3d.js-adjacent code**:
R-004 is investigation-and-report only, no code changes — see assignment rule 3, this is the
"pause one task" alternative (scoping one task to read-only) rather than literally serializing
them. If R-004's findings later turn into an actual fix, that becomes its own task, assigned
only after R-003 is integrated, so there's no real overlap.

## Task briefs

Full context for tasks in `ready`/`in progress` status, so the worker doesn't have to
rediscover it. Move a task's brief under Handoff history once it reaches `done`.

### R-003 — Fix B-004 and B-005 (coordinator's own task, not Codex)

Logged here for traceability even though I'm doing this myself in the main checkout, not
handing it off — both bugs are fully diagnosed already (see `BUGS.md`), no need to re-derive
root cause.

**B-005 fix** (`Kroppsatlas/js/body3d.js`): `resetProcedure3DStage()`/`loadProcedure3D()`
(in `Procedurtraning/js/procedures3d.js`) never restore clip state on previously-cut meshes.
Add a `body3d.cutMeshes` Set tracked by `body3dStageLayer()` (add on activate, remove on
deactivate), plus a new `body3dResetAllCuts()` that restores every tracked mesh to
`body3d.clipPlanes`/`clipIntersection:false` and clears the set. Also add a generation
counter to `_body3dAnimateIncision()` so a superseded/stale animation's `requestAnimationFrame`
loop stops mutating material state once cancelled — bump the counter in
`body3dResetAllCuts()` too, not just on starting a new animation. Call `body3dResetAllCuts()`
from both `resetProcedure3DStage()` and the top of `loadProcedure3D()`.

**B-004 fix**: the real bug is `loadProcedure3D()` treating `body3d.loadedSystems[system]`
(set true when a fetch *starts*, in `_body3dLoadSystem`) as if it meant "fully parsed and in
the registry." Add a proper per-system ready/callback mechanism to `body3d.js` —
`_body3dOnSystemReady(system, cb)` (calls immediately if already ready, otherwise queues) plus
marking `body3d.systemReady[system]=true` and flushing queued callbacks at the actual
completion point in `_body3dLoadSystemParsed` (both the brain-category branch and the regular
branch). Rewrite `loadProcedure3D`'s pending-counter to use this instead of the
`loadedSystems` flag and the single global `window.onBody3DSystemLoaded` (which stays
untouched for Kropps-atlas's own "laddar…" checkbox indicator — this is an additive, separate
mechanism, not a replacement for that existing usage).

Verify via Playwright: re-run the same rapid-switching and reset-mid-animation scenarios that
originally reproduced these (see `BUGS.md` B-004/B-005 entries for exact repro steps), confirm
they no longer occur, confirm zero regressions across all 4 existing procedures, zero console
errors. Move both entries to `BUGS.md`'s Resolved section with this task's commit hash when
done, per the handoff template below.

### R-004 — Investigate B-006 (Neuro nerve visibility) and B-007 (Kropps-atlas viewport clipping)

Two user-reported issues, explicitly wanted with fresh eyes rather than the coordinator's own
assumptions (the coordinator did the original Neuro peripheral-nerve merge work earlier this
session, and built Kropps-atlas's camera-framing code — worth an independent look rather than
compounding on the same blind spots). See `BUGS.md` for the current (thin) description of each
— this task is to turn "suspected" into either "confirmed" with a real root cause, or rule it
out, the same way the coordinator did for B-004/B-005.

**Investigation only — do not edit any code file this round.** Report findings as an update to
the relevant `BUGS.md` row(s) (or propose the update via your handoff, coordinator will apply
it) — what you found, how you confirmed it, and a proposed fix approach if you have one, but
don't implement it yet. This keeps your investigation safe to run alongside `R-003` (which is
actively editing `Kroppsatlas/js/body3d.js` right now) without any file-scope conflict.

**B-006**: lower-leg peripheral nerves not visible in the Neuro 3D model; arm nerve geometry
looks incorrect. Start from `Neuro/js/brain3d.js` and whatever peripheral-nerve model file(s)
it loads (check the actual `<script>` tags in `Neuro/index.html` for the real filename/path,
don't assume). Per `CLAUDE.md`: peripheral nerves are known to be merged as ONE fused mesh
(not individually addressable), and source data is often one-sided (`.r`-suffixed or
unsuffixed-but-actually-one-side-only) — check whether "not visible" means genuinely missing
from the merged geometry, or a visibility/filter/region-tag issue hiding data that's actually
there, before assuming which.

**B-007**: Kropps-atlas's 3D viewport clips off the top of the head and the front of the body
— they render outside the visible viewport/camera frustum. Start from
`Kroppsatlas/js/body3d.js`'s camera/framing code (`_body3dDefaultFraming`, `_body3dFrameBox`,
`applyBody3DCamera`) and `Kroppsatlas/css/styles.css`'s canvas sizing rules. Note there's a
related-but-confirmed-different precedent worth reading first, not assuming is the same root
cause: `Procedurtraning/css/styles.css` needed its own `#proc3dCanvas{width:100%;height:100%}`
rule because Kropps-atlas's canvas-sizing CSS was originally scoped to the `#body3dCanvas` ID
specifically — check whether Kropps-atlas's *own* canvas has since regressed some other way,
don't assume the fix is "add the same CSS rule again," it's already scoped to the right ID
there.

At handoff: report your findings as proposed `BUGS.md` text (coordinator will review and
apply), not as a code diff.

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

Add completed handoffs below; retain concise entries so decisions remain discoverable. If the
task fixed or implemented a `B-XXX`/`TODO-XXX` entry from `BUGS.md`, move that entry to
`BUGS.md`'s Resolved section (date + this commit hash) as part of closing out the handoff —
don't leave it dangling as still `open`/`suspected` there.

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
