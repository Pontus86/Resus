/* ---------- Procedurmall: thoraxdrän ---------- */
const CHEST_TUBE_PROCEDURE = {
  id: "chest-tube",
  name: "Thoraxdrän",
  shortDesc: "Dosberäkning för lokalbedövning, checklista och journalanteckning för pleuradränage.",
  tags: ["Thorax"],

  drugs: [
    {id:"lidocaine_1pct", name:"Lidokain 1%, lokal infiltration", route:"Lokal", doseLow:3, doseHigh:4.5, doseUnit:"mg", conc:10,
      note:"Infiltrera hud, subkutis, interkostalmuskulatur och parietal pleura. Max totaldos enligt lokal rutin/vikt."}
  ],

  checklist: [
    {phase:"Före", items:[
      "Indikation bekräftad (pneumothorax/hemothorax/pleuraeffusion) och sida markerad",
      "Ultraljud utfört för att bekräfta luft/vätska och kartlägga anatomi",
      "Patientläge (halvsittande, arm bakom huvudet) och insticksställe identifierat (vanligen 4–5:e ICR, främre till mellersta axillarlinjen)",
      "Sterilt fält och skyddsutrustning på plats",
      "Lokalbedövning förberedd och dosberäknad",
      "Dränstorlek vald",
      "Sug/vattenlås förberett och funktionstestat"
    ]},
    {phase:"Under", items:[
      "Incision ovanför revbenets överkant (undviker den neurovaskulära bunten)",
      "Trubbig dissektion genom interkostalmuskulaturen",
      "Fingerexploration av pleurahålan innan dränet förs in",
      "Dränet konnekterat till sug/vattenlås",
      "Dränet fixerat med sutur och förband"
    ]},
    {phase:"Efter", items:[
      "Lungröntgen för lägeskontroll",
      "Andningsljud och saturation kontrollerade",
      "Smärtlindring ordinerad",
      "Drännivå samt luft-/vätskeläckage dokumenterat"
    ]}
  ],

  buildNote(ctx){
    return buildStandardNote("Thoraxdrän", "Lokalbedövning", this.checklist, ctx);
  }
};
