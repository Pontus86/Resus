# Resus decision log

Record durable technical, product, and collaboration decisions here. Append new entries and
mark old decisions as superseded rather than rewriting their history.

## D-001 — Adopt Project Collaboration Kit

- Status: accepted
- Date: 2026-07-25
- Owner: Pontus
- Context: Resus developed useful conventions for human/Claude/Codex coordination, but those
  methods were mixed with Resus-specific instructions and could not be reused safely.
- Decision: Use the private `Pontus86/project-collaboration-kit` repository as the versioned
  source for shared collaboration methods. Resus keeps project-owned tasks, bugs, ideas,
  decisions, sandbox experiments, and project rules in this repository. Only
  `.collaboration/CORE.md` and `.collaboration-kit-version` are managed by the kit.
- Alternatives: Keep all methods only in `AGENTS.md`, or include the external repository as a
  Git submodule. Both were rejected: the first prevents reuse and the second adds avoidable
  friction to documents that must remain locally editable.
- Consequences: Kit updates may replace the managed core but must never overwrite Resus-owned
  documents. A kit release is not automatically adopted; its diff and migration notes must be
  reviewed and committed in Resus.
- Related: Project Collaboration Kit `v0.2.0`; adoption commit to be recorded at handoff.

