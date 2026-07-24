/* ---------- Procedurträning: data ----------
   Deklarativ tabell i samma anda som Neuro/js/reflex3d-data.js (TRACT3D_ANATOMY/
   REFLEX3D_ANATOMY) -- namn slås upp via _procedure3dPointFor (procedures3d.js), aldrig
   hårdkodade world-koordinater här. "stages" styr den lokala snitt-avslöjningen (se
   _body3dAnimateIncision i Kroppsatlas/js/body3d.js): varje steg framåt döljer (cut) eller
   visar (reveal) namngivna strukturer, ackumulerat (tidigare stegs snitt läks inte ihop när
   man går vidare, se renderProcedure3DStage). "landmarks" är vad info-panelen och klick-
   punkterna i 3D-vyn visar oavsett var i stegsekvensen man befinner sig -- "role" styr färgen
   (se PROCEDURE3D_ROLE_COLOR), "kind" om punkten är en riktig registry-struktur eller ett
   schematiskt märke (se BODY3D_SCHEMATIC_POINTS i procedures3d.js).

   "io-tibia" och "central-line-ijv" är byggda hittills (två första vertikala skivorna, se
   planfilen mighty-meandering-adleman.md) -- resten (central-line-subclavian/-femoral,
   chest-tube, lumbar-puncture, cricothyrotomy, io-humerus) läggs till i egna omgångar, en i
   taget. PROCEDURE3D_LIST styr ordning/synlighet i UI:t, main.js hoppar bara över nycklar som
   saknas i PROCEDURE3D_ANATOMY. */

const PROCEDURE3D_LIST = ["io-tibia", "central-line-ijv"];

// Matchar delvis de globala CSS-variablerna i css/theme.css (--red/--warn) men dessa är
// THREE.js-materialfärger (3D-scenen), inte DOM-CSS -- kan inte bara referera var(...) här.
// "target" fick ursprungligen samma röd (#D8473D) som body3d.js:s egen markerings-highlight
// -- när målstrukturen (t.ex. Tibia.r) samtidigt är vald smälte det schematiska märket in i
// den röda highlighten, svårt att särskilja (bekräftat i Playwright-verifieringen). Guld i
// stället, tydligt skilt från både highlight-rött och danger-orange.
const PROCEDURE3D_ROLE_COLOR = {
  target: "#FFC107",
  danger: "#FB8C00",
  landmark: "#4A90A4",
  context: "#8FA0A8"
};

const PROCEDURE3D_ANATOMY = {
  "io-tibia": {
    name: "Intraosseös access — tibia",
    checklistId: null,   // Checklistor har ingen IO-checklista ännu, se planfilens §5
    region: "lower_limb", side: "r",
    stages: [
      {id:"skin", label:"Hud",
       desc:"Identifiera insticksstället innan snittet: ca 2 cm distalt och medialt om tuberositas tibiae, på den plana anteromediala benytan.",
       cut:["Skin"]},
      {id:"target", label:"Tuberositas tibiae",
       desc:"För nålen vinkelrätt (90°) mot benytan tills ett tydligt motståndstapp känns när corticalis passeras.",
       reveal:["Tibia.r"], focus:"tibial_tuberosity_schematic.r"}
    ],
    landmarks: [
      {name:"tibial_tuberosity_schematic.r", kind:"schematic", role:"target",
       desc:"Insticksställe: ca 2 cm distalt och medialt om tuberositas tibiae. Ingen egen landmärkes-mesh finns i biblioteket (bara del av hela tibia-benets geometri) -- punkten är en fraktion inom benets EGEN box, inte en fri koordinat."},
      {name:"Tibia.r", kind:"real", role:"context",
       desc:"Riktig benanatomi (skelettsystemet) — ger den faktiska ytan att navigera efter."}
    ]
  },

  "central-line-ijv": {
    name: "CVK — v. jugularis interna",
    checklistId: "central-line",   // renderar en "Öva checklistan →"-länk, ingen kodkoppling
    region: "head_neck", side: "r",
    stages: [
      {id:"skin", label:"Hud",
       desc:"Identifiera triangeln mellan sternocleidomastoideus sternala och klavikulära huvud, med spetsen mot klavikeln — snittet läggs vid triangelns spets.",
       cut:["Skin"], focus:"sternocleidomastoid_schematic.r"},
      {id:"scm", label:"M. sternocleidomastoideus",
       desc:"Nålen förs djupare mellan/lateralt om sternocleidomastoideus två huvuden, riktad mot ipsilaterala bröstvårtan i 30–45° vinkel mot huden.",
       focus:"sternocleidomastoid_schematic.r"},
      {id:"target", label:"V. jugularis interna",
       desc:"Venen ligger ytligt och lateralt om a. carotis communis. Aspirera under framförandet — fritt återflöde av mörkt, icke-pulserande blod bekräftar rätt läge.",
       reveal:["Internal_jugular_vein.r"], focus:"Internal_jugular_vein.r"}
    ],
    landmarks: [
      {name:"Internal_jugular_vein.r", kind:"real", role:"target",
       desc:"Målkärl. Ligger ytligt och lateralt om a. carotis communis, mellan sternocleidomastoideus två huvuden."},
      {name:"Common_carotid_artery.r", kind:"real", role:"danger",
       desc:"Farostruktur — ligger medialt om venen. Ultraljudsvägledning rekommenderas för att undvika artärpunktion."},
      {name:"sternocleidomastoid_schematic.r", kind:"schematic", role:"landmark",
       desc:"M. sternocleidomastoideus (schematiskt band mellan dess klavikulära fäste och halsvenens övre del) — ingen egen muskelgeometri i biblioteket. Triangeln mellan dess två huvuden och klavikeln är det klassiska ytliga landmärket."}
    ]
  }
};
