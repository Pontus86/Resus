# Sandbox

Experiments live here before they are accepted as production work.

Each experiment should state:

- the question being tested
- what fidelity is intentionally omitted
- how to run it
- what would count as success or failure
- whether any part is safe to reuse

A successful experiment must still produce a recorded decision and scoped task before its code
is moved into production.

## Experiments

- `chest-tube-sandbox.html` — interactive thorax-drain procedure prototype.
- `agent-edit-lab/index.html` — constrained in-browser feedback agent. It edits a temporary
  Resus-like preview and exports a review package; it cannot change production files.
