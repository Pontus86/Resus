/* ---------- Procedurmall: proceduranalgesi/sedering ---------- */
/* Varje procedurmall är ett fristående objekt (läkemedel, checklista, journaltext-byggare).
   För att lägga till en ny procedur: skapa en ny fil i js/procedures/ med samma form och
   lägg till den i js/procedure-registry.js — inget annat behöver ändras. */
const SEDATION_PROCEDURE = {
  id: "sedation",
  name: "Proceduranalgesi/sedering",
  shortDesc: "Dosberäkning, checklista och journalanteckning för sedering i samband med procedur utanför operationsavdelning.",
  tags: ["Sedering"],

  // Dosintervall är generella utgångspunkter, inte en ersättning för lokala PM — kontrollera alltid mot lokal rutin/koncentration.
  drugs: [
    {id:"ketamine_iv", name:"Ketamin, intravenöst", route:"IV", doseLow:0.5, doseHigh:1.0, doseUnit:"mg", conc:10,
      note:"Ges långsamt över 1–2 min, kan upprepas med halva startdosen vid behov."},
    {id:"ketamine_im", name:"Ketamin, intramuskulärt", route:"IM", doseLow:3, doseHigh:4, doseUnit:"mg", conc:50,
      note:"Används när iv-infart saknas eller är svår att sätta, längre anslagstid."},
    {id:"esketamine_iv", name:"Esketamin (S-ketamin), intravenöst", route:"IV", doseLow:0.25, doseHigh:0.5, doseUnit:"mg", conc:5,
      note:"Ungefär halva dosen jämfört med racemiskt ketamin."},
    {id:"propofol_iv", name:"Propofol, intravenöst", route:"IV", doseLow:0.5, doseHigh:1.0, doseUnit:"mg", conc:10,
      note:"Titreras i små bolusar, ökad risk för andningsdepression och hypotoni."},
    {id:"midazolam_iv", name:"Midazolam, intravenöst", route:"IV", doseLow:0.02, doseHigh:0.05, doseUnit:"mg", conc:1,
      note:"Ofta i kombination med opioid. Extra försiktighet hos äldre/sköra."},
    {id:"fentanyl_iv", name:"Fentanyl, intravenöst", route:"IV", doseLow:0.5, doseHigh:1.0, doseUnit:"mikrog", conc:50,
      note:"Kombineras ofta med midazolam eller propofol."}
  ],

  checklist: [
    {phase:"Före", items:[
      "Fasteanamnes bedömd (tid sedan senaste måltid/dryck)",
      "Informerat samtycke inhämtat, patienten informerad om proceduren",
      "Allergier och tidigare sederingskomplikationer kontrollerade",
      "Fri venväg säkrad",
      "Basal monitorering kopplad (EKG, SpO2, blodtryck, ev. EtCO2)",
      "Läkemedel förberedda och dosberäknade",
      "Reverserande läkemedel/akututrustning tillgänglig (flumazenil, naloxon, luftväg, sug)",
      "Sederingsansvarig läkare namngiven, separat från proceduransvarig"
    ]},
    {phase:"Under", items:[
      "Kontinuerlig övervakning av andning, saturation och medvetandegrad",
      "Sedering titrerad stegvis till målnivå",
      "Tidpunkt och dos för given sedering dokumenterad"
    ]},
    {phase:"Efter", items:[
      "Patienten observerad till fullt vaken/utgångsnivå",
      "Utskrivningskriterier uppfyllda innan hemgång",
      "Uppföljning/hemgångsinformation given till patient eller anhörig"
    ]}
  ],

  buildNote(ctx){
    return buildStandardNote("Proceduranalgesi/sedering", "Given sedering", this.checklist, ctx);
  }
};
