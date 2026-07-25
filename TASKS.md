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
| R-006 | ready | Codex | `Kroppsatlas/models/body/manifest.js` only | `codex/work` | — |

Statuses: `ready`, `in progress`, `blocked`, `review`, `done`.

`I-001` (ideation thread) is paused, not an active task right now — see its own header in
`IDEAS/2026-07-25-feature-and-fix-backlog.md` for status.

## Task briefs

Full context for tasks in `ready`/`in progress` status, so the worker doesn't have to
rediscover it. Move a task's brief under Handoff history once it reaches `done`.

### R-006 — Fix B-009 (skull region mistag)

- Fixes `BUGS.md`'s `B-009`. Relates to `IDEAS/2026-07-25-neuro-nerve-skull-repair.md` (I-002)
  — this is likely (not certain) the real explanation behind the "skull looks incomplete"
  report that prompted that thread, at least for the Kropps-atlas side of it. It does not
  address I-002's nerve-dedup question at all — that's still open and unassigned.
- Root cause (already diagnosed, verified by the coordinator, do not re-derive): 30 entries in
  `Kroppsatlas/models/body/manifest.js` — `Frontal_bone`, `Occipital_bone`, `Parietal_bone.l`,
  `Parietal_bone.r`, `Sphenoid_bone`, `Temporal_bones`, `Zygomatic_bones`, `Vomer`,
  `Palatine_bone`, `Nasal_bone`, `Maxilla_bone.l`, `Maxilla_bone.r`, `Mandible_bone`,
  `Ethmoid_Bone`, `Lacrimal_bones`, `Inferior_nasal_concha_bones`, and 14 dental entries
  (`Upper_`/`Lower_` `_incisors`/`_canines`/`_premolars`/`_molar_teeth` variants) — are tagged
  `region:"head"`. The valid region vocabulary used by the filter UI/logic elsewhere in the
  file is `"all"`, `"head_neck"`, `"axial"`, `"upper_limb"`, `"lower_limb"` — `"head"` is not
  one of them, so `_body3dPassesFilter`'s region check never matches it under any selectable
  chip except `"all"` (which bypasses the check entirely). These bones have real, correctly
  proportioned embedded geometry in `skeletal.js` — this is a metadata tagging bug, not a
  missing-geometry or merge-pipeline bug.
- Task: change `region:"head"` to `region:"head_neck"` for exactly those 30 entries in
  `manifest.js`. Then re-scan the whole file for any other `region` value outside the 5 valid
  ones (the coordinator only checked for `"head"` specifically — confirm nothing else is
  hiding the same way) and fix any found, noting them in the handoff even if none turn up.
- Verify: reload Kropps-atlas, select the "Huvud & hals" region filter, confirm all 30 bones
  (not just the 4 spot-checked ones) render and are clickable/searchable; confirm the default
  "all" filter view is visually unchanged; zero new console errors; region filter still falls
  back correctly for anything that depends on these names (check Procedurträning's existing
  procedures don't reference any of the 30 by name — a quick grep is enough, expected to be
  a no-op since none currently do).
- On completion: move B-009 to `BUGS.md`'s Resolved table (Found `1812e39`, Fixed = this
  commit) and update this board.

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

### R-009 — Audit BodyParts3D coverage — done

- Owner/branch: `Codex`, `codex/work`
- Commit: `26b75d4`
- Changed: Added a reproducible inventory audit that resolves retained FMA and FJ/MM/CX
  source IDs against the official `20181210i412` exports and permits exact-name matching only
  in explicit BodyParts3D assets. The CSV now records Resus presence, module, source version,
  match basis, availability, and download need. The HTML catalogue has an availability filter
  and coverage summary.
- Verified: Two full audit/build runs produced identical SHA-256 hashes. CSV parsing confirms
  8,129 rows, 21 columns, unique FMA/BP IDs, 283 present and 7,846 download candidates;
  JavaScript syntax checks pass; generated browser data has matching counts and classifies
  the 14 brachial-plexus search hits as 6 present/8 missing; `git diff --check` passes.
- Notes: This is deliberately conservative and can undercount old merged models whose source
  IDs were discarded. Current evidence identifies 272 primitive and 11 compound concepts;
  the missing set contains 4,326 primitive elements and 3,520 compound concepts. Direct
  `file://` visual QA remains unavailable because the browser blocks local-file navigation.

### R-008 — BodyParts3D 20181210i412 reference catalogue — done

- Owner/branch: `Codex`, `codex/work`
- Commit: `cc746d4`
- Changed: Preserved the official 8,129-object IS-A catalogue as CSV under
  `reference/bodyparts3d/`, added a compact browser-data script and searchable standalone
  HTML view, documented provenance/licence and the 8,129-vs-13,312 distinction, added a
  reproducible JSON-to-catalogue converter, and linked the catalogue from `about.html`.
- Verified: Source and generated outputs contain exactly 8,129 records, 8,129 unique FMA IDs,
  and 8,129 unique BP IDs; Python's CSV parser reads all 15 columns and every row; both
  generated and handwritten JavaScript pass `node --check`; relative files and links exist;
  the search dataset returns 14 `brachial plexus` matches and the type split is 4,598
  elements/3,531 compounds; `git diff --check` passes.
- Notes: Direct `file://` browser verification and responsive visual QA could not be completed
  because the available browser blocked local-file navigation by policy. The page avoids
  `fetch()` and uses relative stylesheet/script links specifically for file and Pages
  compatibility.

### R-007 — Canonical bilateral arm nerves — done

- Owner/branch: `Codex`, `codex/work`
- Commit: `fa2f6aa`
- Changed: `tools/repair_3d_models.js` now selects 48 deduplicated right arm/hand sources,
  requires all 16 brachial-plexus and shoulder/chest branches, and generates the 48 left
  counterparts by x-axis reflection with reversed face winding. Regenerated
  `Neuro/models/brain/peripheral_nerves.js` while preserving all 411 non-arm source blocks.
- Verified: Both JavaScript files pass `node --check`; regeneration is idempotent; the fused
  OBJ has 507 source blocks, 862,439 vertices, 1,133,666 valid faces, 48 right/48 left arm
  sources, and 16/16 bilateral plexus pairs. In Neuro's whole-body Nervbanor view, both arms
  and both plexuses rendered symmetrically with no console errors; the spinal-cord and
  coronal-cut controls still worked.
- Notes: The right side is authoritative and the left is generated. The median- and
  ulnar-nerve hand continuations use explicit `_hand_segment` names to avoid colliding with
  their proximal trunks. No known limitation.

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

### R-003 — Fix B-004 and B-005 — done

- Owner/branch: `Claude`, `main` (solo, no handoff needed)
- Commit: `c093039`
- Changed: `Kroppsatlas/js/body3d.js` (`body3d.cutMeshes` tracking, `body3dResetAllCuts()`, a
  generation counter on `_body3dAnimateIncision` so a superseded animation stops mutating
  material state, `_body3dOnSystemReady()`/`_body3dMarkSystemReady()` replacing the
  single-global-callback pattern), `Procedurtraning/js/procedures3d.js` (`loadProcedure3D`
  rewritten to use the new per-system ready mechanism, calls `body3dResetAllCuts()`),
  `Procedurtraning/js/main.js` (closed the practical UI gap B-004 caused: "Nästa steg" now
  disables + shows "Laddar…" until a newly-selected procedure's systems are genuinely ready,
  not just started).
- Verified: re-ran both original repro scenarios (reset mid-animation, rapid cross-procedure
  switching with the old single-callback overwrite) — neither reproduces anymore. Full
  regression across all 4 existing procedures, zero console errors. B-004/B-005 moved to
  `BUGS.md`'s Resolved section with this commit hash.
- Notes: lost significant time to a Playwright/browser HTTP-caching artifact mid-verification —
  the `<script src="js/main.js">` tag kept serving a stale cached copy across many same-URL
  navigations in one long browser session, while direct `fetch()` calls correctly got the
  fresh file, which is what made it confusing (looked like the code wasn't taking effect).
  Fixed by switching to a fresh local-server port. Not a real bug, just a testing-environment
  gotcha worth remembering: if a code change mysteriously "isn't taking effect" despite the
  served file being correct, suspect script-level browser caching, not the code, before
  spending much time debugging the code itself.

### R-004 — Investigate B-006/B-007 — done

- Owner/branch: `Codex`, `codex/work`
- Commit: `1969666` (fast-forwarded into `main`, no conflicts)
- Changed: `BUGS.md` only, exactly the scope given — no code files touched.
- Findings:
  - **B-006 confirmed**, root cause is NOT missing geometry. The lower-leg nerves are all
    present (94 source blocks, 278,880 vertices, bilateral sciatic/tibial/fibular/sural/
    plantar) — they're just visually sub-pixel/faint at default whole-body framing (0.45
    opacity against a similar-toned background). The arm nerves have a genuinely different,
    more serious cause: the fused mesh contains **overlapping duplicate representations**
    from two source generations (47 legacy BodyParts3D matches + 108 later Open3DModel
    blocks + their mirrors) — differently-calibrated surfaces coexisting in the same merged
    mesh. Proposed fix (not yet built): regenerate from a deduplicated per-region source
    manifest (one source family per structure, validated against the skeleton), then address
    legibility separately (opaque/high-contrast material + a limb-region framing option, not
    thicker geometry). This is a real merge-pipeline task, not a quick fix — needs its own
    scoped `TASKS.md` assignment when picked up.
  - **B-007 marked `wontfix`** — not reproducible against the current code. Verified the
    canvas is correctly sized (458×611px, matches the CSS rule), and projected all 583,430
    skeletal vertices through the actual camera transform: every one lands inside the -1..1
    NDC range in both the default view and the "Framifrån" preset — nothing is geometrically
    clipped. Proposed alternative explanation: ordinary page scrolling, since the 611px-tall
    canvas can exceed the visible browser viewport at some window sizes, which looks like
    clipping but isn't a rendering bug. No further action without a screenshot + exact
    viewport/systems/camera-preset/interaction sequence that reproduces a real cutoff.
- Notes: none beyond the above — both are logged accurately in `BUGS.md` for whenever they're
  picked up (or, for B-007, reopened with better repro info).

### R-005 — Peripheral nerves and calvarium repair — done

- Owner/branch: `Codex`, `codex/work` (user-authorized takeover while Claude was unavailable)
- Commit: `bbb213f`
- Changed: Added `tools/repair_3d_models.js` as the reproducible source-to-embedded-asset repair
  step. It removes 26 overlapping legacy BodyParts3D arm-nerve surface blocks while retaining
  the calibrated Open3D upper-limb/hand representation and all 94 lower-limb sources. Neuro's
  nerve material is now opaque and dark ochre for whole-body legibility. The four cropped
  skull-roof objects in `skeletal.js` were regenerated from their complete BodyParts3D source
  objects, restoring the calvarium without changing object names, coordinates, or the manifest.
- Verified: `node --check` passed for the repair tool, both generated model scripts, and
  `Neuro/js/brain3d.js`; `git diff --check` passed; a second repair run produced identical
  hashes. Browser-tested Neuro's full-body peripheral nerves, Kropps-atlas default and front
  views, and Procedurträning's shared skeletal load against localhost with no console errors.
  Also confirmed the nearby Neuro spinal-cord and coronal-cut controls still work and that
  Procedurträning's start control enables after loading.
- Notes: The calvarium objects were not absent from the source library; the embedded product
  asset had used cropped coloured-skull-base variants whose superior extent stopped below the
  cortex. Regeneration requires the ignored raw model library at `Models/` in the coordinator's
  checkout, supplied via `--source-root`; no new external source or licence was introduced.
