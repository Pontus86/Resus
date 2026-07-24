/* ---------- Ryggmärgsskada: förenklad ISNCSCI-liknande nivå/AIS-beräkning ---------- */
/* OBS: detta är en pedagogiskt förenklad approximation av ISNCSCI-algoritmen (bygger
   på fyra "mest kaudala normala nivå"-fält + sakral sparing), inte en fullständig
   28-dermatom/10-myotom-undersökning. Tydlig disclaimer visas i UI. */

function spinalIdx(level){ return SPINAL_LEVELS.indexOf(level); }

function spinalCompute(input){
  // input: {sensR, sensL, motR, motL, sacralSparing, motorBelow, halfBelowGr3}
  // sensR/sensL/motR/motL: mest kaudala nivå med normal funktion, eller "normal" (helt intakt)
  const levels = [input.sensR, input.sensL, input.motR, input.motL].filter(l => l !== "normal");
  let nliIdx;
  if(levels.length === 0){
    nliIdx = SPINAL_LEVELS.length; // helt normalt, ingen nivå
  } else {
    nliIdx = Math.min(...levels.map(spinalIdx));
  }
  const nli = nliIdx >= SPINAL_LEVELS.length ? null : SPINAL_LEVELS[nliIdx];

  let ais, aisText;
  if(nli === null){
    ais = "E"; aisText = "Normal sensorik och motorik (E) — ingen kvarstående neurologisk nivå.";
  } else if(!input.sacralSparing){
    ais = "A"; aisText = "Komplett skada (A) — ingen sakral sparing (varken känsel S4-S5 eller viljemässig analkontraktion).";
  } else if(input.motorBelow === "no"){
    ais = "B"; aisText = "Sensoriskt inkomplett (B) — sakral sparing finns, men ingen motorisk funktion mer än 3 nivåer under motornivån bilateralt.";
  } else if(input.halfBelowGr3 === "no"){
    ais = "C"; aisText = "Motoriskt inkomplett (C) — motorisk funktion bevarad under nivån, men färre än hälften av nyckelmusklerna under NLI har kraft grad ≥3.";
  } else {
    ais = "D"; aisText = "Motoriskt inkomplett (D) — minst hälften av nyckelmusklerna under NLI har kraft grad ≥3.";
  }

  return {
    nli, ais, aisText,
    nliText: nli ? `Neurologisk skadenivå (NLI): ${SPINAL_LEVEL_LABEL(nli)}` : "Neurologisk skadenivå (NLI): ingen — normalfynd"
  };
}
