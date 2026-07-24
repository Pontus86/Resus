/* ---------- Ryggmärgens tvärsnitt: klassiska inkompletta skadesyndrom ---------- */
/* affected = vilka regioner (se region-id:n i cord-syndrome-diagram.js) som skuggas
   röda = skadad vävnad vid respektive syndrom. Skuggningen visar VAR skadan sitter,
   inte var symtomen känns (texten förklarar den kliniska bilden). */
const CORD_SYNDROMES = [
  {
    id:"complete", name:"Komplett tvärsnittsskada",
    affected:["dorsalL","dorsalR","corticospinalL","corticospinalR","spinothalamicL","spinothalamicR","centralCore"],
    desc:"Fullständigt bortfall av motorik samt alla sensoriska modaliteter (smärta/temperatur och proprioception/vibration) bilateralt nedanför nivån. Ingen sakral sparing."
  },
  {
    id:"central", name:"Central cord syndrome",
    affected:["centralCore"],
    desc:"Klassiskt efter hyperextensionstrauma hos äldre med cervikal spondylos. De mest centralt belägna fibrerna i kortikospinal- och spinothalamusbanorna drabbas först — dessa representerar armarna (benfibrerna ligger mer perifert/lateralt) — vilket ger uttalad svaghet i armarna/händerna med relativt bevarad benkraft (\"man-in-a-barrel\"). Sensoriskt ofta variabelt bortfall."
  },
  {
    id:"brownsequard", name:"Brown-Séquard (hemisektion, vä sida i denna bild)",
    affected:["dorsalL","corticospinalL","spinothalamicL"],
    desc:"Halvsidig skada (här vänster). Ger ipsilateral (vänster) förlust av motorik samt proprioception/vibrationssinne nedanför nivån, men kontralateral (höger) förlust av smärta/temperatur — eftersom spinothalamusbanan redan korsat om ett par nivåer under inträdet i ryggmärgen."
  },
  {
    id:"anterior", name:"Anterior cord syndrome",
    affected:["corticospinalL","corticospinalR","spinothalamicL","spinothalamicR"],
    desc:"Klassiskt vid a. spinalis anterior-infarkt (t.ex. efter aortakirurgi/aortadissektion). Bilateral förlust av motorik samt smärta/temperatur nedanför nivån, men bakstammarna (proprioception/vibrationssinne) är sparade eftersom de försörjs av a. spinalis posterior."
  },
  {
    id:"posterior", name:"Posterior cord syndrome",
    affected:["dorsalL","dorsalR"],
    desc:"Ovanligt — isolerad förlust av proprioception/vibrationssinne (baksträngarna), med bevarad motorik och smärta/temperatur. Klassiskt vid a. spinalis posterior-infarkt. Vid B12-brist (subakut kombinerad degeneration) drabbas ofta även kortikospinalbanorna, till skillnad från den rena vaskulära bilden."
  }
];
