/* ---------- NIHSS: itemdefinitioner ---------- */
/* Standardskalans 11 poster (13 delposter). Varje post har ett värde 0..max och en
   Svensk kort etikett för varje poäng. Lägg till/ändra text här, inget annat behöver röras. */
const MOTOR_ARM_OPTS=[
  {v:0,t:"Ingen drift, håller 10 sek"},
  {v:1,t:"Drift innan 10 sek, når ej underlag"},
  {v:2,t:"Visst försök mot tyngdkraft, faller till underlag"},
  {v:3,t:"Ingen rörelse mot tyngdkraft"},
  {v:4,t:"Ingen rörelse alls"}
];
const MOTOR_LEG_OPTS=[
  {v:0,t:"Ingen drift, håller 5 sek"},
  {v:1,t:"Drift innan 5 sek, når ej underlag"},
  {v:2,t:"Visst försök mot tyngdkraft, faller till underlag"},
  {v:3,t:"Ingen rörelse mot tyngdkraft"},
  {v:4,t:"Ingen rörelse alls"}
];

const NIHSS_ITEMS=[
  {id:"loc",label:"1a. Medvetandegrad",max:3,options:[
    {v:0,t:"Vaken, adekvat"},
    {v:1,t:"Somnolent, väckbar med lätt stimulering"},
    {v:2,t:"Medvetandesänkt, kräver upprepad/kraftig stimulering"},
    {v:3,t:"Komatös, endast reflexmässiga eller inga svar"}
  ]},
  {id:"locq",label:"1b. LOC-frågor (månad, ålder)",max:2,options:[
    {v:0,t:"Båda rätt"},{v:1,t:"Ett rätt"},{v:2,t:"Inget rätt"}
  ]},
  {id:"locc",label:"1c. LOC-kommandon (öppna/stäng ögon, knyt/öppna hand)",max:2,options:[
    {v:0,t:"Utför båda korrekt"},{v:1,t:"Utför ett korrekt"},{v:2,t:"Utför inget korrekt"}
  ]},
  {id:"gaze",label:"2. Blickriktning",max:2,options:[
    {v:0,t:"Normal"},{v:1,t:"Partiell blickpares"},{v:2,t:"Total blickdeviation (ej övervinnbar)"}
  ]},
  {id:"visual",label:"3. Synfält",max:3,options:[
    {v:0,t:"Inget synfältsbortfall"},{v:1,t:"Partiell hemianopsi"},
    {v:2,t:"Total hemianopsi"},{v:3,t:"Bilateral hemianopsi/kortikal blindhet"}
  ]},
  {id:"face",label:"4. Facialispares",max:3,options:[
    {v:0,t:"Normal"},{v:1,t:"Lätt pares (asymmetriskt leende)"},
    {v:2,t:"Partiell pares (nästan total nedre ansiktspares)"},{v:3,t:"Total pares, övre+nedre ansikte"}
  ]},
  {id:"motorArmL",label:"5a. Motorik arm, vänster",max:4,options:MOTOR_ARM_OPTS},
  {id:"motorArmR",label:"5b. Motorik arm, höger",max:4,options:MOTOR_ARM_OPTS},
  {id:"motorLegL",label:"6a. Motorik ben, vänster",max:4,options:MOTOR_LEG_OPTS},
  {id:"motorLegR",label:"6b. Motorik ben, höger",max:4,options:MOTOR_LEG_OPTS},
  {id:"ataxia",label:"7. Extremitetsataxi",max:2,options:[
    {v:0,t:"Ingen ataxi"},{v:1,t:"Ataxi i en extremitet"},{v:2,t:"Ataxi i två eller fler extremiteter"}
  ]},
  {id:"sensory",label:"8. Sensibilitet",max:2,options:[
    {v:0,t:"Normal"},{v:1,t:"Lätt-måttlig nedsättning"},{v:2,t:"Svår-total nedsättning"}
  ]},
  {id:"language",label:"9. Bästa språkfunktion (afasi)",max:3,options:[
    {v:0,t:"Ingen afasi"},{v:1,t:"Lätt-måttlig afasi"},
    {v:2,t:"Svår afasi (fragmenterad kommunikation)"},{v:3,t:"Mutistisk/global afasi"}
  ]},
  {id:"dysarthria",label:"10. Dysartri",max:2,options:[
    {v:0,t:"Normalt tal"},{v:1,t:"Lätt-måttlig dysartri, går att förstå"},{v:2,t:"Svår dysartri/anartri"}
  ]},
  {id:"neglect",label:"11. Extinktion/neglekt",max:2,options:[
    {v:0,t:"Ingen neglekt"},{v:1,t:"Neglekt för en sensorisk modalitet"},
    {v:2,t:"Svår neglekt, flera modaliteter"}
  ]}
];
