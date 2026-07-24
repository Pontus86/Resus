/* ---------- Procedurmall: intubation (RSI) ---------- */
const INTUBATION_PROCEDURE = {
  id: "intubation",
  name: "Intubation (RSI)",
  shortDesc: "Dosberäkning för induktion/muskelrelaxantia, checklista och journalanteckning för snabb sekvensinduktion.",
  tags: ["Luftväg"],

  drugs: [
    {id:"propofol_rsi", name:"Propofol, induktion", route:"IV", doseLow:1.5, doseHigh:2.5, doseUnit:"mg", conc:10,
      note:"Vanligast vid hemodynamiskt stabil patient."},
    {id:"ketamine_rsi", name:"Ketamin, induktion", route:"IV", doseLow:1, doseHigh:2, doseUnit:"mg", conc:10,
      note:"Föredras vid hemodynamisk instabilitet/chock."},
    {id:"etomidate_rsi", name:"Etomidat, induktion", route:"IV", doseLow:0.2, doseHigh:0.3, doseUnit:"mg", conc:2,
      note:"Hemodynamiskt neutralt, men binjurebarkssuppression vid upprepad dosering."},
    {id:"succinylcholine", name:"Succinylkolin, muskelrelaxation", route:"IV", doseLow:1, doseHigh:1.5, doseUnit:"mg", conc:50,
      note:"Snabbt insättande och kort verkningstid. Undvik vid hyperkalemi/neuromuskulär sjukdom/brännskada."},
    {id:"rocuronium", name:"Rokuronium, muskelrelaxation", route:"IV", doseLow:1, doseHigh:1.2, doseUnit:"mg", conc:10,
      note:"RSI-dos, längre verkningstid än succinylkolin. Kan reverseras med sugammadex."}
  ],

  checklist: [
    {phase:"Före", items:[
      "Preoxygenering minst 3 minuter / 8 djupa andetag",
      "Bedömning av svår luftväg gjord (Mallampati, tyreomentalt avstånd, munöppning)",
      "Utrustning förberedd (tub, laryngoskop, backup video/bougie, sug, kapnograf)",
      "Läkemedel dragna upp och dosberäknade",
      "Plan för misslyckad intubation klar (kirurgisk luftväg-set tillgängligt)",
      "Team-roller fördelade"
    ]},
    {phase:"Under", items:[
      "Induktionsläkemedel givet",
      "Muskelrelaxant givet",
      "Krikoidtryck tillämpat (om aktuellt)",
      "Laryngoskopi utförd, tub genom stämbanden under direkt/videosikt",
      "Kuff blåst",
      "Läge bekräftat med kapnografi (EtCO2) och bilateral auskultation"
    ]},
    {phase:"Efter", items:[
      "Tub fixerad och djup dokumenterat (cm vid framtänder)",
      "Lungröntgen för lägeskontroll",
      "Fortsatt sedering/analgesi ordinerad",
      "Initiala ventilatorinställningar dokumenterade"
    ]}
  ],

  buildNote(ctx){
    return buildStandardNote("Intubation (RSI)", "Givna läkemedel", this.checklist, ctx);
  }
};
