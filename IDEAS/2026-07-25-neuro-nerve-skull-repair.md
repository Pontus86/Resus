# I-002 — Neuro nerve and skull repair request

- Status: `decision proposed`
- Current baton: `Claude`
- Related task: `none`

## Question

Please turn the repair described below into one or more explicitly scoped Codex assignments in
`TASKS.md`. Pontus has asked Codex to fix the overlapping peripheral-nerve geometry and determine
why the Kropps-atlas skeleton lacks the top of the skull, then restore the complete skull if the
required source objects exist.

## Codex — 2026-07-25 10:15 Europe/Stockholm

### Requested assignment 1 — peripheral nerves

- Regenerate `Neuro/models/brain/peripheral_nerves.js` from a reviewed, deduplicated source
  manifest; do not manually edit the embedded OBJ string.
- Choose one source representation per named arm structure. The current fused asset mixes
  repeated legacy BodyParts3D arm/brachial entries with a later Open3DModel upper-limb/hand
  import and mirrored copies.
- Preserve the confirmed lower-limb data, bilateral coverage, BodyParts3D coordinate transform,
  `file://` compatibility, and existing script-global contract.
- Include the relevant source/merge script and generated model in scope. If that pipeline exists
  only in ignored scratch/source directories, name its exact path in the brief and explicitly
  authorize creating a tracked reproducible merge script in an appropriate repository folder.
- Treat distal nerve legibility as a separate rendering concern: include
  `Neuro/js/brain3d.js` only if the assignment also asks for an opaque/high-contrast material or
  limb-focused framing. Do not distort anatomical thickness merely to make nerves visible.

### Requested assignment 2 — incomplete skull

- Inventory the skeletal source objects, generated `Kroppsatlas/models/body/skeletal.js`, and
  `manifest.js` to determine whether frontal/parietal/occipital calvarial objects are absent,
  lost through object-name collisions/registry overwrites, mis-tagged, hidden by filters, or
  present but clipped.
- Compare source-object and generated-object bounding boxes against the separately rendered
  brain. The visible brain at the vertex is not evidence that the skull object exists: CNS and
  skeleton are separate datasets/render paths.
- If the source objects exist, fix the merge/manifest pipeline and regenerate the skeletal
  output. If they do not exist in the current source library, stop and report the exact missing
  anatomy and available licensed source alternatives before adding a new external source.
- Include every affected consumer in verification: Kropps-atlas and Procedurträning share the
  same body model; Neuro uses separate brain/peripheral model files.

### Verification requested

- Check disk space before any model regeneration.
- Syntax-check changed JavaScript and inspect every affected script path/load order.
- Test through the local page with explicit loaded flags, not fixed sleeps.
- Capture comparable full-body screenshots before/after:
  Kropps-atlas front and oblique views, plus Neuro Helkropp with peripheral nerves enabled and
  clipping planes disabled.
- Numerically verify world-space bounding boxes/alignment against representative skeleton
  landmarks and confirm the complete calvarium encloses rather than intersects the brain.
- Check a nearby unaffected interaction in each changed module.
- Commit logical units descriptively and report generated-file sizes and any source/licence
  caveats.

### Suggested task split

Use two tasks if the skull and nerve pipelines touch different generated assets/scripts. This
keeps the large-model changes reviewable and avoids conflating a source-deduplication repair
with a potentially missing-source investigation.

### Open questions for Claude

- Where are the authoritative merge scripts and raw source directories for the current
  peripheral nerve and skeletal outputs?
- Should nerve legibility be included in the first implementation assignment, or assigned as a
  follow-up after geometry deduplication is visually reviewed?
- Does Claude want to reserve `BUGS.md` updates for coordinator closeout, or include the relevant
  rows in Codex's assignment scope?
