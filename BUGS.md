# Resus bug & fix log

Stable IDs for known defects (`B-XXX`) and desired work that isn't a defect (`TODO-XXX`) --
features, cleanups, anything worth doing that nothing is currently "broken" about. Reference
these IDs from `TASKS.md` assignments, `IDEAS/` threads, and commit messages so "fixes B-001"
or "implements TODO-003" stays traceable back to a real entry here.

This is a log, not a queue. An entry existing here is not a `TASKS.md` assignment by itself --
move an entry to `in progress` only once real work has an owner/branch/file-scope in
`TASKS.md`, and record that task ID in the Related task column when it happens.

## Bugs (`B-XXX`)

Confirmed or suspected defects — something behaves incorrectly today.

| ID | Status | Title | Where | Related task |
|---|---|---|---|---|
| B-001 | suspected | Checklistor card-art paths reference lowercase `images/...`, but the committed directory is `Images/` (capital I) — works on case-insensitive APFS locally, untested against GitHub Pages' case-sensitive storage. If broken, it's broken for all 5 existing checklist procedures, not just new ones. | `Checklistor/js/card-art.js`, `Checklistor/Images/` | — |
| B-002 | suspected | Several `manifest.js` entries are duplicated (`Tibia.r`/`.l`, `Clavicle.r`/`.l`, `Patella.r`/`.l` each appear twice) — unclear if harmless (last one wins silently) or a symptom of something wrong in an early merge pass. | `Kroppsatlas/models/body/manifest.js` | — |
| B-003 | confirmed | Neuro's brain3D cutting planes have a cosmetic "cap protrusion halo" artifact at the clip boundary. Long-standing, minor. | `Neuro/js/brain3d.js` | — |

Statuses: `suspected` (not yet verified), `confirmed` (reproduced), `in progress` (has a
`TASKS.md` task), `fixed` (commit recorded below), `wontfix` (with reason).

## Todos (`TODO-XXX`)

Desired work that isn't a defect — features, cleanups, finishing something already started.

| ID | Status | Title | Where | Related task |
|---|---|---|---|---|
| TODO-001 | open | Finish Procedurträning: cricothyrotomy, 5th of 5 planned procedures. Weakest real-anatomy backing of the set (laryngeal skeleton was never segmented in BodyParts3D) — needs a real design conversation, not just a mechanical data entry. | `Procedurtraning/` | — |
| TODO-002 | open | Combine the local clip-hole incision with lattice-style vertex deformation at the cut edges, for a more organic "pulled back" look instead of a hard-edged hole. Sandbox prototype exists (outside the repo); never integrated into the real module. | `Procedurtraning/js/procedures3d.js`, `Kroppsatlas/js/body3d.js` | — |
| TODO-003 | open | Wire up EKG's already-committed but unused 3D heart model (`EKG/models/heart/*.js` — aorta/LAD/LCx/RCA/LV/RV/LA/RA/pulmonary trunk) into the EKG module. Could visualize STEMI culprit-vessel territory in 3D alongside the existing 2D matching game. | `EKG/` | — |
| TODO-004 | open | Mine the rest of `Models/Body/Body` (raw BodyParts3D source library) for other useful anatomy not yet pulled into Kropps-atlas. | `Kroppsatlas/models/body/` | — |

Statuses: `open`, `in progress` (has a `TASKS.md` task), `done` (commit recorded below),
`wontfix` (with reason).

## Resolved

Move an entry here once fixed/done. Keep its original ID, add the commit hash.

_None yet._
