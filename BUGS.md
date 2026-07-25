# Resus bug & fix log

Stable IDs for known defects (`B-XXX`) and desired work that isn't a defect (`TODO-XXX`) --
features, cleanups, anything worth doing that nothing is currently "broken" about. Reference
these IDs from `TASKS.md` assignments, `IDEAS/` threads, and commit messages so "fixes B-001"
or "implements TODO-003" stays traceable back to a real entry here.

This is a log, not a queue. An entry existing here is not a `TASKS.md` assignment by itself --
move an entry to `in progress` only once real work has an owner/branch/file-scope in
`TASKS.md`, and record that task ID in the Related task column when it happens.

**Found** = the date and short commit hash where this entry was first logged here (not
necessarily when the underlying issue was introduced — that's often unknowable precisely, this
is just when it entered the log). **Fixed** = the date and short commit hash that resolved it,
filled in only once the entry moves to Resolved below.

## Bugs (`B-XXX`)

Confirmed or suspected defects — something behaves incorrectly today.

| ID | Status | Title | Where | Found | Related task |
|---|---|---|---|---|---|
| B-001 | confirmed | Checklistor card-art paths reference lowercase `images/...`, but the committed directory is `Images/` (capital I) — confirmed via I-001 (Codex checked the tree directly). Works on case-insensitive APFS locally, live status against GitHub Pages' case-sensitive storage still unverified. If broken, it's broken for all 5 existing checklist procedures, not just new ones. | `Checklistor/js/card-art.js`, `Checklistor/Images/` | 2026-07-25 @ `0585416` | — |
| B-002 | suspected | `manifest.js` has 148 duplicated names (152 extra rows), far more than the 3 examples first noticed — confirmed larger via I-001. Most are byte-for-byte duplicate metadata, but 5 names (`Atlas_(C1)`, `Axis_(C2)`, a generic DIP-joint-capsule name, bilateral `Dorsal_digital_veins`) have **conflicting** system/region metadata — likely two distinct causes (accidental duplicate emission vs. genuine name collisions between source regions). A blind dedupe could discard real geometry; needs the merge pipeline/registry behavior inspected first, not a manual edit. | `Kroppsatlas/models/body/manifest.js` | 2026-07-25 @ `0585416` | — |
| B-003 | confirmed | Neuro's brain3D cutting planes have a cosmetic "cap protrusion halo" artifact at the clip boundary. Long-standing, minor. | `Neuro/js/brain3d.js` | 2026-07-25 @ `0585416` | — |
| B-006 | suspected | Reported by the user: in the Neuro 3D model, lower-leg peripheral nerves are not visible, and arm nerve geometry looks incorrect. Not yet investigated by the coordinator — explicitly requested to go to Codex for a fresh-eyes look rather than compounding on the coordinator's own prior assumptions about this data (the coordinator did the original peripheral-nerve merge work earlier this session). | `Neuro/js/brain3d.js`, `Neuro/models/brain/peripheral_nerves.js` (or equivalent) | 2026-07-25 @ `a516dfa` | — |
| B-007 | suspected | Reported by the user: Kropps-atlas's 3D viewport cuts off the top of the head and the front of the body — they appear to render outside the visible viewport/camera frustum. Not yet investigated. Possibly a camera-framing or canvas-sizing issue (see the earlier-fixed `#proc3dCanvas` sizing bug in Procedurträning for a related-but-distinct precedent — worth checking whether Kropps-atlas's own canvas/framing has a similar or different root cause, not assuming it's the same bug). | `Kroppsatlas/js/body3d.js`, `Kroppsatlas/css/styles.css` | 2026-07-25 @ `a516dfa` | — |

Statuses: `suspected` (not yet verified), `confirmed` (reproduced), `in progress` (has a
`TASKS.md` task), `fixed` (moved to Resolved below), `wontfix` (with reason).

## Todos (`TODO-XXX`)

Desired work that isn't a defect — features, cleanups, finishing something already started.

| ID | Status | Title | Where | Found | Related task |
|---|---|---|---|---|---|
| TODO-001 | open | Finish Procedurträning: cricothyrotomy, 5th of 5 planned procedures. Weakest real-anatomy backing of the set (laryngeal skeleton was never segmented in BodyParts3D) — needs a real design conversation, not just a mechanical data entry. Per I-001, Codex agrees this should get its own dedicated ideation thread. B-004/B-005 (the load/reset lifecycle concerns that were blocking this) are now fixed, not just reproduced — no longer a blocker. | `Procedurtraning/` | 2026-07-25 @ `0585416` | — |
| TODO-002 | open | Combine the local clip-hole incision with lattice-style vertex deformation at the cut edges, for a more organic "pulled back" look instead of a hard-edged hole. Sandbox prototype exists (outside the repo); never integrated into the real module. Per I-001, deprioritized below lifecycle correctness (B-004/B-005) — polish shouldn't precede fixing the incision animation's own suspected bugs. | `Procedurtraning/js/procedures3d.js`, `Kroppsatlas/js/body3d.js` | 2026-07-25 @ `0585416` | — |
| ~~TODO-003~~ | superseded | ~~Wire up EKG's unused 3D heart model~~ — **premise was wrong.** Per I-001, Codex checked `EKG/index.html`/`anatomy.js`/`main.js` directly: the 3D heart visualization is already fully implemented and wired into Simulator mode (canvas, isolate controls, territory-to-vessel-color mapping, `Simulator.setOnFrame` subscription) — commit `7791cc2` only restored already-referenced model data the gitignore bug had excluded, same pattern as everywhere else that bug hit. It's deliberately hidden from Game mode so it doesn't leak the culprit vessel during a guessing round. Replaced by TODO-006. | `EKG/` | 2026-07-25 @ `0585416` | — |
| TODO-004 | open | Mine the rest of `Models/Body/Body` (raw BodyParts3D source library) for other useful anatomy not yet pulled into Kropps-atlas. Per I-001, deprioritized — too open-ended without a concrete training need driving it. | `Kroppsatlas/models/body/` | 2026-07-25 @ `0585416` | — |
| TODO-005 | open | Found via I-001: `checklistId` on a Procedurträning procedure currently only acts as a boolean (shows a generic link to `Checklistor/index.html`) — the actual ID is never used to open the matching checklist directly. Deep-linking to the specific procedure would make the field earn its purpose across all 4 procedures that already set it. | `Procedurtraning/js/main.js`, `Checklistor/index.html` | 2026-07-25 @ `d72a273` | — |
| TODO-006 | open | Verify EKG's existing 3D heart visualization actually works correctly across `file://`, GitHub Pages, desktop, and narrow/mobile viewports — proposed by Codex in I-001 to replace TODO-003 now that "wire it up" turned out to already be done. Mark resolved if it passes; log new `B-XXX` entries for anything that doesn't. Separately, decide (open question, needs the user) whether it should ever surface in Game mode — e.g. as a post-answer reveal rather than a pre-answer hint, to avoid leaking the correct vessel during a guessing round. | `EKG/` | 2026-07-25 @ `d72a273` | — |

Statuses: `open`, `in progress` (has a `TASKS.md` task), `done` (moved to Resolved below),
`wontfix` (with reason), `superseded` (replaced by a corrected entry, kept for history).

## Resolved

| ID | Title | Found | Fixed | Notes |
|---|---|---|---|---|
| B-004 | `loadProcedure3D()` treated `loadedSystems[system]` (set true when a fetch *starts*) as a completion signal, and funneled waiters through a single overwritable global callback | 2026-07-25 @ `d72a273` | 2026-07-25 @ `c093039` | Added `_body3dOnSystemReady()`/`_body3dMarkSystemReady()` — a real per-system ready flag + independent callback queue. Also closed the practical UI gap it caused: `Procedurtraning`'s "Nästa steg" now disables and shows "Laddar…" until systems are genuinely ready, not just started. |
| B-005 | Reset and procedure-switching never restored clip state on previously-cut meshes | 2026-07-25 @ `d72a273` | 2026-07-25 @ `c093039` | Simpler than hypothesized — not a race, a missing cleanup step. Added `body3d.cutMeshes` tracking + `body3dResetAllCuts()`, plus a generation counter on `_body3dAnimateIncision` so a superseded animation stops mutating material state. |
