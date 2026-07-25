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

   "io-tibia", "central-line-ijv", "chest-tube" och "lumbar-puncture" är byggda hittills
   (fyra första vertikala skivorna, se planfilen mighty-meandering-adleman.md) -- resten
   (central-line-subclavian/-femoral, cricothyrotomy, io-humerus) läggs till i egna omgångar,
   en i taget. PROCEDURE3D_LIST styr ordning/synlighet i UI:t, main.js hoppar bara över nycklar
   som saknas i PROCEDURE3D_ANATOMY. */

const PROCEDURE3D_LIST = ["io-tibia", "central-line-ijv", "chest-tube", "lumbar-puncture"];

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
  },

  "chest-tube": {
    name: "Thoraxdrän",
    checklistId: "chest-tube",
    region: "axial", side: "r",
    safetyTriangle: {
      points:["Latissimus_dorsi.r", "Pectoralis_major.r", "Rib_(5th).r"],
      color:"#4A90A4"
    },
    stages: [
      {id:"skin", label:"Hud",
       desc:"Identifiera säkerhetstriangeln: mellan m. latissimus dorsis främre kant, m. pectoralis majors laterala kant och femte revbenet. Incisionen läggs vanligen i fjärde eller femte interkostalrummet.",
       cut:["Skin"], focus:"Rib_(5th).r"},
      {id:"landmarks", label:"Säkerhetstriangel",
       desc:"Palpera revbenet och gå över dess övre kant för att undvika kärl-nervsträngen som löper längs revbenets underkant.",
       reveal:["Rib_(5th).r"], focus:"Rib_(5th).r"},
      {id:"pleura", label:"Pleura",
       desc:"Trubbdissekera genom interkostalmuskulaturen, penetrera pleura med peang och gör en fingersvepning för att bekräfta intrapleural placering.",
       focus:"Middle_lobe_of_right_lung"},
      {id:"drain", label:"Drän",
       desc:"För dränet intrapleuralt. Undvik att rikta det in i lungparenkymet och håll insticksstället över femte revbenet för att minska risken för diafragma- eller subdiafragmatisk skada.",
       focus:"Middle_lobe_of_right_lung"}
    ],
    landmarks: [
      {name:"Rib_(5th).r", kind:"real", role:"landmark",
       desc:"Femte revbenet — säkerhetstriangelns nedre gräns. Gå över revbenets övre kant för att undvika den interkostala kärl-nervsträngen."},
      {name:"Latissimus_dorsi.r", kind:"real", role:"landmark",
       desc:"M. latissimus dorsis främre kant bildar säkerhetstriangelns bakre gräns."},
      {name:"Pectoralis_major.r", kind:"real", role:"landmark",
       desc:"M. pectoralis majors laterala kant bildar säkerhetstriangelns främre gräns."},
      {name:"Superior_lobe_of_right_lung", kind:"real", role:"danger",
       desc:"Farostruktur — undvik att föra peang eller drän in i lungparenkymet."},
      {name:"Middle_lobe_of_right_lung", kind:"real", role:"danger",
       desc:"Farostruktur — ligger nära det vanliga insticksområdet på höger sida."},
      {name:"Inferior_lobe_of_right_lung", kind:"real", role:"danger",
       desc:"Farostruktur — undvik en för djup eller felriktad införing i lungparenkymet."},
      {name:"Diaphragm", kind:"real", role:"danger",
       desc:"Farostruktur — ett för lågt insticksställe riskerar diafragma- och subdiafragmatisk skada."}
    ]
  },

  "lumbar-puncture": {
    name: "Lumbalpunktion",
    checklistId: "lumbar-puncture",
    region: "axial", side: "both",
    caudaEquina: {color:"#E8C744"},
    stages: [
      {id:"skin", label:"Hud",
       desc:"Positionera patienten med flekterad ländrygg och identifiera medellinjen. Palpera crista iliaca-nivån som orientering mot L4 och välj interstitiet L3–L4 eller L4–L5.",
       cut:["Skin"], focus:"Lumbar_vertebrae_(L4)"},
      {id:"level", label:"Insticksnivå",
       desc:"För nålen i medellinjen mellan spinalutskotten vid L3–L4 eller L4–L5, under conus medullaris. Rikta lätt kranialt mot naveln.",
       focus:"Intervertebral_disc_L3_L4"},
      {id:"target", label:"Duralsäck",
       desc:"Efter passage genom ligamentum flavum och dura nås subarachnoidalrummet. Avlägsna mandrängen och bekräfta fritt återflöde av cerebrospinalvätska.",
       focus:"dural_sac_schematic"}
    ],
    landmarks: [
      {name:"Lumbar_vertebrae_(L1)", kind:"real", role:"context",
       desc:"L1-kotan — kranial orienteringspunkt; conus medullaris slutar vanligen kring L1–L2 hos vuxna."},
      {name:"Lumbar_vertebrae_(L2)", kind:"real", role:"context",
       desc:"L2-kotan — lumbalpunktionen görs kaudalt om denna nivå för att minska risken för ryggmärgsskada."},
      {name:"Lumbar_vertebrae_(L3)", kind:"real", role:"landmark",
       desc:"L3-kotan — övre benlandmärke för det vanliga insticksinterstitiet L3–L4."},
      {name:"Lumbar_vertebrae_(L4)", kind:"real", role:"landmark",
       desc:"L4-kotan — Tuffiers linje mellan crista iliaca passerar ungefär denna nivå."},
      {name:"Lumbar_vertebrae_(L5)", kind:"real", role:"landmark",
       desc:"L5-kotan — nedre benlandmärke för det alternativa insticksinterstitiet L4–L5."},
      {name:"Sacrum", kind:"real", role:"context",
       desc:"Sacrum — närmaste verkliga mesh-proxy för bäckenets nivå och duralsäckens kaudala riktning."},
      {name:"Intervertebral_disc_L3_L4", kind:"real", role:"landmark",
       desc:"Disk L3–L4 — markerar nivån för ett vanligt insticksinterstitium mellan motsvarande spinalutskott."},
      {name:"Intervertebral_disc_L4_L5", kind:"real", role:"landmark",
       desc:"Disk L4–L5 — markerar nivån för ett alternativt insticksinterstitium."},
      {name:"dural_sac_schematic", kind:"schematic", role:"target",
       desc:"Duralsäck och subarachnoidalrum (schematiskt rör) — målområdet för nålspetsen och provtagning av cerebrospinalvätska."}
    ]
  }
};
