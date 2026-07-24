/* ---------- Procedurmall: central venkateter (CVK) ---------- */
const CENTRAL_LINE_PROCEDURE = {
  id: "central-line",
  name: "Central venkateter (CVK)",
  shortDesc: "Dosberäkning för lokalbedövning, checklista och journalanteckning för CVK-inläggning.",
  tags: ["Kärlaccess"],

  drugs: [
    {id:"lidocaine_1pct", name:"Lidokain 1%, lokal infiltration", route:"Lokal", doseLow:3, doseHigh:4.5, doseUnit:"mg", conc:10,
      note:"Infiltrera insticksstället innan punktion."}
  ],

  checklist: [
    {phase:"Före", items:[
      "Indikation bekräftad, kontraindikationer (koagulopati, lokal infektion) uteslutna",
      "Insticksställe valt (v. jugularis interna / v. subclavia / v. femoralis)",
      "Ultraljud förberett för kärlidentifiering",
      "Fullt sterilt barriärskydd (mössa, munskydd, steril rock, handskar, stor duk)",
      "Patientläge optimerat (t.ex. Trendelenburg vid jugularis-/subclavia-access)",
      "Läkemedel (lokalbedövning) förberedda och dosberäknade"
    ]},
    {phase:"Under", items:[
      "Kärlet identifierat med ultraljud före punktion",
      "Fri aspiration av venöst blod bekräftad innan dilatation",
      "Seldingerteknik (ledare, dilatator, kateter) genomförd steglöst",
      "Samtliga lumen aspirerade och spolade",
      "Katetern fixerad"
    ]},
    {phase:"Efter", items:[
      "Röntgen för lägeskontroll (kateterspets, uteslut pneumothorax)",
      "Förband anlagt",
      "Insticksdjup och antal lumen dokumenterat"
    ]}
  ],

  buildNote(ctx){
    return buildStandardNote("Central venkateter (CVK)", "Lokalbedövning", this.checklist, ctx);
  }
};
