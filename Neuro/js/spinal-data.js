/* ---------- Ryggmärgsskada: nivålista (ISNCSCI-inspirerad, förenklad) ---------- */
const SPINAL_LEVELS=[
  "C2","C3","C4","C5","C6","C7","C8",
  "T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12",
  "L1","L2","L3","L4","L5",
  "S1","S2","S3","S4_5"
];
const SPINAL_LEVEL_LABEL = l => l==="S4_5" ? "S4-S5" : l;
