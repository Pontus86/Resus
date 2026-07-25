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

## D-002 — Hybridmodell för ryggmärgsskador i Neuro

- Status: accepted
- Date: 2026-07-25
- Owner: Pontus
- Context: BodyParts3D ger Neuro ett sammanhängande ryggmärgsskal, medan HRA v1.2 ger
  verklig 3D-geometri uppdelad i nivåsegment men saknar separata invändiga bansystem.
- Decision: Visa HRA:s kvinnliga C1–S4-segment i en separat 3D-scen och koppla nivåvalet till
  kodritade, anatomiskt grundade tvärsnitt för grå substans och centrala bansystem. Märk
  uttryckligen tvärsnittet som undervisningsmodell och håll det skilt från HRA-geometrin.
- Alternatives: Försöka tolka HRA-segmenten som invändiga trakter, eller behålla en enda
  schematisk cirkel utan verkliga nivåer. Det första vore anatomiskt fel och det andra tappar
  den nivåinformation som HRA faktiskt tillhandahåller.
- Consequences: HRA-scenen kan markera verkliga längdsegment. Tvärsnittsprofiler och
  lesionsmasker kan förbättras oberoende, men får inte beskrivas som HRA-segmentering.
- Related: HuBMAP CCF 3D Reference Object Library v1.2, `VH_F_Spinal_Cord.glb`.

## D-003 — En enda låst arbetsyta för den avgränsade agentloopen

- Status: accepted
- Date: 2026-07-25
- Owner: Pontus
- Context: En implementerare och en granskare ska kunna köras sekventiellt utan att användaren
  behöver hålla ett extra worktree eller editorfönster öppet.
- Decision: Den automatiska loopen återanvänder `Resus-codex` på `codex/work`. En exklusiv
  runtime-låsfil hindrar två controllerinstanser, och operatören får inte samtidigt låta en
  interaktiv Claude- eller Codex-session redigera samma arbetsyta. Claude får göra
  arbetskopieändringar; Codex körs read-only; endast controllern skriver runtime-state.
- Alternatives: Köra direkt på `main`, skapa ett nytt worktree per körning, eller låta båda
  agenterna skriva fritt. De alternativen avvisades på grund av högre release-risk, mer
  handpåläggning respektive otydligt ägarskap.
- Consequences: Arbetsytan måste vara ren före start och lämnas med en ogranskad diff efter
  körning. Controllerresultat skapar aldrig commits eller release; en människa granskar,
  committar och integrerar separat. Ett lås skyddar inte mot en människa som medvetet ignorerar
  trafikljuset, vilket dokumenteras uttryckligen.
