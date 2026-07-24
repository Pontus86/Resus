/* ---------- Procedurmall: lumbalpunktion (LP) ---------- */
const LUMBAR_PUNCTURE_PROCEDURE = {
  id: "lumbar-puncture",
  name: "Lumbalpunktion (LP)",
  shortDesc: "Dosberäkning för lokalbedövning, checklista och journalanteckning för lumbalpunktion.",
  tags: ["Neuro/rygg"],

  drugs: [
    {id:"lidocaine_1pct", name:"Lidokain 1%, lokal infiltration", route:"Lokal", doseLow:2, doseHigh:3, doseUnit:"mg", conc:10,
      note:"Infiltrera hud och underliggande vävnad i medellinjen."}
  ],

  checklist: [
    {phase:"Före", items:[
      "Indikation bekräftad, kontraindikationer uteslutna (fokalneurologi/misstänkt förhöjt ICP utan DT, koagulopati, lokal infektion)",
      "Patientläge (sidoliggande i fosterställning eller sittande framåtlutad)",
      "Nivå identifierad (L3–L4 eller L4–L5, i höjd med crista iliaca)",
      "Sterilt fält förberett",
      "Lokalbedövning förberedd och dosberäknad",
      "Provrör märkta och redo (cell, protein/glukos, odling, ev. extra)"
    ]},
    {phase:"Under", items:[
      "Lokalbedövning given",
      "Nålen införd i medellinjen med lätt kranial vinkling",
      "Öppningstryck uppmätt (vid liggande läge)",
      "Likvor uppsamlad i respektive rör",
      "Nålen avlägsnad och förband anlagt"
    ]},
    {phase:"Efter", items:[
      "Patienten observerad avseende post-LP-huvudvärk",
      "Prover skickade till lab",
      "Öppningstryck och likvorutseende dokumenterat"
    ]}
  ],

  buildNote(ctx){
    return buildStandardNote("Lumbalpunktion", "Lokalbedövning", this.checklist, ctx);
  }
};
