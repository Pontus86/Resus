/* ---------- 3D-hjärna + ryggmärg: djupa strukturer (BodyParts3D/FMA) ----------
   Samma pipeline som EKG-modulens 3D-hjärta (se EKG/js/anatomy.js): riktig anatomisk
   geometri, sammanslagen per struktur (Neuro/models/brain/ — se merge-scripten som
   genererade dem), inbäddad som JS-strängar (file:// blockerar fetch() av lokala filer,
   samma anledning som resten av sajtens fetch-undvikande mönster) och tolkad synkront med
   OBJLoader.parse().

   TRE KÄLLBIBLIOTEK, alla samma underliggande BodyParts3D-koordinatsystem (verifierat mot
   varandra via Bounds(mm)-kommentaren i varje OBJ-header, som alltid stämmer inom någon mm):
     - Models/BodyParts_3d (den ursprungliga 129-fil hjärt-leveransen) -- de djupa kärnorna
       (thalamus/basala ganglier/capsula/hjärnstam/lillhjärna/corpus callosum/ventriklar).
     - Models/Brain (en finare "MM"-atlas) -- cortexskalet (73 sammanslagna gyrus-ytor).
     - Models/body/Body (hela BodyParts3D, 2623 filer) -- ryggmärgen ("Neural tissue of
       spinal cord", den enda ryggmärgs-YTA som finns i något av biblioteken).

   VIKTIG BEGRÄNSNING: inget av biblioteken har spinalnervrötter, meninger, eller en
   segmenterad ryggmärg (bara EN sammanhängande yta för hela märgen) -- se filkommentarer i
   Neuro/js/tracts.js för hur det påverkar 3D-banorna. */
let brain3d = null; // {renderer, scene, camera, group, parts:{}, clip:{...}, ...}

const BRAIN3D_CATEGORIES = [
  "thalamus_l","thalamus_r",
  "basalganglia_l","basalganglia_r",
  "capsule_l","capsule_r",
  "midbrain_l","midbrain_r","pons_l","pons_r","medulla_l","medulla_r",
  "cerebellum_l","cerebellum_r","cerebellum_vermis","corpus_callosum","white_matter","ventricles","spinalcord","vertebrae","peripheral_nerves",
  "cortex",   // sist av de "riktiga" delarna -- ska ritas ovanpå/genomskinligt, se materialkommentaren
  // Funktionella cortex-delregioner (se merge-scriptet i konversationen + BRAIN3D_CORTEX_REGIONS) --
  // SAMMA gyrus-ytor som redan ingår i "cortex" ovan, avsiktligt överlappande geometri. Dolda
  // (wrapper.visible=false) tills en knapp väljer EN av dem -- se setBrain3DCortexRegion.
  "ctx_motor","ctx_sensory","ctx_broca","ctx_wernicke","ctx_visual",
  "ctx_prefrontal","ctx_parietal","ctx_cingulate","ctx_insula","ctx_orbitofrontal"
];
const BRAIN3D_CORTEX_REGIONS = ["ctx_motor","ctx_sensory","ctx_broca","ctx_wernicke","ctx_visual",
  "ctx_prefrontal","ctx_parietal","ctx_cingulate","ctx_insula","ctx_orbitofrontal"];
const BRAIN3D_CORTEX_REGION_LABELS = {
  ctx_motor:"Motorisk cortex", ctx_sensory:"Sensorisk cortex", ctx_broca:"Brocas area (V)",
  ctx_wernicke:"Wernickes area (V)", ctx_visual:"Synbark", ctx_prefrontal:"Prefrontal cortex",
  ctx_parietal:"Parietal association", ctx_cingulate:"Cingulate cortex", ctx_insula:"Insula",
  ctx_orbitofrontal:"Orbitofrontal cortex"
};
// Center/skala beräknad en gång ur hjärn-delarnas bounds.json (se merge_brain_obj.py) --
// MEDVETET inte omräknad för att inkludera hela ryggmärgens fulla längd (~450 mm, mot
// hjärndelarnas ~120 mm) -- hade det centrerats om hade hjärnan blivit en liten prick högst
// upp i en mycket större scen, vilket är fel default för NIHSS/Nervbanor som mest handlar om
// de djupa hjärnstrukturerna. Ryggmärgen hänger i stället ner UNDER denna centrering; zooma
// ut (scroll eller "Helkropp"-knappen) för att se hela den.
const BRAIN3D_CENTER = new THREE.Vector3(-0.66, -71.61515, 1523.88);
const BRAIN3D_SCALE = 0.034; // ~119 mm största utsträckning (hjärndelarna) -> ~4 enheter, matchar EKG:s hjärtscen
// Samma råa koordinatsystem som hjärtdatasetet (samma källa, BodyParts3D) -- samma
// bas-rotation som en första gissning, sedan kontrollerad/korrigerad genom att rendera en
// "svängbord"-serie och jämföra mot känd anatomi (lillhjärnans läge bakom hjärnstammen,
// corpus callosum välvt över toppen) -- se filkommentaren i EKG/js/anatomy.js för samma
// process på hjärtat. EFTER denna transform: världens +X ≈ patientens vänster, +Y ≈ upp,
// +Z ≈ framåt (bekräftat genom svängbordet: rotY=0 visade framifrån, rotY=90° visade
// från sidan, topp-/bottenvyer stämde med corpus callosum överst / lillhjärna+märg underst)
// -- det är därför klippsnitten nedan kan använda raka världs-axlar rakt av.
const BRAIN3D_ROTATION = new THREE.Euler(-Math.PI/2, 0, Math.PI);
const BRAIN3D_YAW_FIX = Math.PI;

// Mer mättade, "anatomibok"-lika kulörer (Netter/Sobotta-stil) i stället för de tidigare
// blekare pastellerna -- särskilt tydligt nu med toon-shadingen (se toonGradientMap), som annars
// gjorde de blekaste färgerna nästan grå i skuggpartierna.
const NEURO_ATLAS_COLORS = {
  thalamus:"#B79FDB", basalganglia:"#D4B483", capsule:"#F2ECDD",
  brainstem:"#E8A69A", cerebellum:"#9FC1D9", corpus_callosum:"#F0DFA8",
  white_matter:"#F5F1E6",
  ventricles:"#7FB8E0", cortex:"#EDE0C9", spinalcord:"#E0B37D", vertebrae:"#C9C4B8",
  // Mörkare ockra än övriga vävnader: de tunna distala grenarna blir annars subpixel-bleka
  // mot diagrammets ljusa bakgrund i Helkropp, även när materialet är helt ogenomskinligt.
  peripheral_nerves:"#B86A00",
  active:"#D8473D", gray:"#C9C5C2"
};
function _brain3dGroupOf(cat){
  if(cat.startsWith("ctx_"))return cat;   // varje delregion är sin egen "grupp" -- se BRAIN3D_CORTEX_REGIONS
  if(cat.startsWith("thalamus"))return "thalamus";
  if(cat.startsWith("basalganglia"))return "basalganglia";
  if(cat.startsWith("capsule"))return "capsule";
  if(cat.startsWith("midbrain")||cat.startsWith("pons")||cat.startsWith("medulla"))return "brainstem";
  if(cat.startsWith("cerebellum"))return "cerebellum";
  if(cat==="corpus_callosum")return "corpus_callosum";
  if(cat==="white_matter")return "white_matter";
  if(cat==="ventricles")return "ventricles";
  if(cat==="cortex")return "cortex";
  if(cat==="spinalcord")return "spinalcord";
  if(cat==="vertebrae")return "vertebrae";
  if(cat==="peripheral_nerves")return "peripheral_nerves";
  return "gray";
}
// "Distinkt"-läge (se setBrain3DColorMode) -- identiskt med _brain3dGroupOf FÖRUTOM att
// hjärnstammens tre delar (midbrain/pons/medulla, annars slagna ihop till EN gemensam
// "brainstem"-färg) här räknas som tre EGNA grupper med var sin färg. Cortex förblir EN enda
// grupp här också (inte uppdelad i sina funktionella delregioner, se BRAIN3D_CORTEX_REGIONS --
// de har ändå alltid samma "active"-röd, oavsett färgläge, se ctx_-undantaget överst).
function _brain3dGroupOfDistinct(cat){
  if(cat.startsWith("midbrain"))return "midbrain";
  if(cat.startsWith("pons"))return "pons";
  if(cat.startsWith("medulla"))return "medulla";
  return _brain3dGroupOf(cat);
}
// Samma uppsättning nycklar som NEURO_ATLAS_COLORS, men med midbrain/pons/medulla utbrutna till
// egna, tydligt urskiljbara kulörer i stället för att dela en enda "brainstem"-färg.
const NEURO_ATLAS_COLORS_DISTINCT = Object.assign({}, NEURO_ATLAS_COLORS, {
  midbrain:"#E0B478", pons:"#E8A69A", medulla:"#C97B6D"
});
// Tredje färgläget -- fyra användarangivna RGB-grupper (se konversationen), inte kopplat till
// de andra två lägenas gruppindelning. Vertebrae/gray har ingen egen angiven färg här, faller
// tillbaka på NEURO_ATLAS_COLORS egna värden (samma som "grouped"-läget) via Object.assign.
function _brain3dGroupOfCustom(cat){
  if(cat.startsWith("thalamus")||cat.startsWith("basalganglia"))return "thalamusBasal";
  if(cat.startsWith("capsule")||cat==="spinalcord"||cat.startsWith("midbrain")||cat.startsWith("pons")||cat.startsWith("medulla")||cat==="corpus_callosum")return "paleFill";
  if(cat==="cortex"||cat.startsWith("cerebellum"))return "cortexCerebellum";
  if(cat==="ventricles")return "ventriclesCustom";
  // Samma "paleFill"-grupp som corpus callosum/capsula/hjärnstam -- vit substans är
  // konceptuellt samma sorts vävnad, ska inte ha en egen, avvikande kulör i det här läget.
  if(cat==="white_matter")return "paleFill";
  return _brain3dGroupOf(cat);
}
const NEURO_ATLAS_COLORS_CUSTOM = Object.assign({}, NEURO_ATLAS_COLORS, {
  //thalamusBasal:"#E4BEA6",
  thalamusBasal:"rgb(237,205,184)",   // samma som ovan men
  paleFill:"rgb(250, 232, 219)",   // samma som ovan men
  //cortexCerebellum:"#CF917C",
  cortexCerebellum:"rgb(233,185,165)",   // samma som ovan men
  ventriclesCustom:"#8F6449"
});
// region (samma strängar som REGION_MARKERS i brain-diagram.js) -> vilka BRAIN3D_CATEGORIES
// som ska lysa upp. mca/aca/pca finns INTE här (ingen regional cortex-geometri, bara ett
// sammanhängande skal, se filkommentaren om vad som saknas i biblioteken).
const BRAIN3D_REGION_PARTS = {
  capsule: ["capsule_l","capsule_r"],
  thalamus: ["thalamus_l","thalamus_r"],
  brainstem: ["midbrain_l","midbrain_r","pons_l","pons_r","medulla_l","medulla_r"],
  cerebellum: ["cerebellum_l","cerebellum_r","cerebellum_vermis"]
};

// Delarna är YTOR (ihåliga skal från BodyParts3D), inte fyllda volymer -- ett klippsnitt
// genom en ihålig yta visar bara den TUNNA insidan av skalet, vilket lätt läser som "ingen
// volym, försvinner". Standardlösningen (samma teknik som Three.js egna klipp-exempel) är
// STENCILBUFFERT-kapning: två extra "osynliga" pass (back/front-sidornas vinding räknas upp/
// ner i stencilbufferten) markerar exakt var snittplanet skär genom den FAKTISKA geometrin,
// och ett tredje pass fyller EXAKT den ytan med en solid färg. Bara för de solida delarna
// (inte cortex/ventriklar, som redan medvetet är genomskinliga/"spöklika" -- en solid kapning
// där hade sett fel ut mot deras egen stil).
// Cortex hoppas över (aldrig kapad) -- den är bara en tunn, mycket genomskinlig (opacity 0.16)
// "spökyta" som redan ser bra ut klippt utan lock (låg opacitet döljer bruset från oskuren
// blandning av överlappande halvgenomskinliga ytstycken, se kommentaren i _buildStencilCaps).
// Ventriklarna DÄREMOT kapas numera (se ventricles i capproxy/) -- vid högre opacitet (0.55)
// var samma brus mycket synligt och lästes lätt som "hål" i vävnaden bakom, eftersom 4:e
// ventrikeln ligger mitt inuti hjärnstammen. Locket där är halvgenomskinligt (matchar
// ventriklarnas egen stil) i stället för en solid färg, se capMat-logiken nedan.
// Vertebrae hoppas över (aldrig kapade) -- de är bara grå, halvgenomskinlig kontext runt
// ryggmärgskanalen (se filkommentaren i applyParts), inte något man förväntas "snitta genom"
// för att se ischemi/skada i, till skillnad från själva hjärn-/hjärnstamsstrukturerna. Cortex
// TESTAS nu med kapning (var tidigare hoppad över) -- se capMat-logiken i _buildStencilCaps.
const BRAIN3D_CAP_SKIP = {vertebrae:1, peripheral_nerves:1, ctx_motor:1, ctx_sensory:1, ctx_broca:1, ctx_wernicke:1,
  ctx_visual:1, ctx_prefrontal:1, ctx_parietal:1, ctx_cingulate:1, ctx_insula:1, ctx_orbitofrontal:1};
// Enda stället att ändra hur ljusa/mörka snittytorna (locken) är -- 1.0 = exakt samma
// kulör som organets egen yta, lägre värden = mörkare ("nyss snittad yta"-effekten, samma
// knep atlasillustrationer använder). Används överallt cap-färg räknas ut (se de fem
// multiplyScalar(BRAIN3D_CAP_BRIGHTNESS)-anropen i filen).
const BRAIN3D_CAP_BRIGHTNESS = 1.0;
const BRAIN3D_CAP_EPS = 0.012;   // se _updateStencilCapPositions -- undviker z-fighting mot originalytans avskurna kant (en större eps testades men löste inte capsula/thalamus-buggen, se konversationen)
// Grannstrukturer (t.ex. capsula interna, som bokstavligen omsluter thalamus) överlappar ofta
// i genomskärning -- DERAS lock hamnar då på EXAKT samma djup (samma c.value+EPS, lika för
// alla kategorier på samma axel), vilket ger z-fighting MELLAN TVÅ OLIKA strukturers lock (inte
// bara mot egna ytan) -- syntes som ett taggigt "hål" i thalamus-locket när capsula överlappade,
// hittat genom att gömma capsula och se hålet försvinna helt. Ett litet extra, per-kategori-
// unikt djupsteg (baserat på ordningen i BRAIN3D_CATEGORIES) räcker för att alla lock ska
// hamna på lite olika djup och aldrig konkurrera om samma pixlar.
const BRAIN3D_CAP_EPS_STEP = 0.0015;
// Standard-"tjocklek" på locken (nu BoxGeometry, se _buildStencilCaps) -- mycket tunn så det
// ser likadant ut som den gamla oändligt tunna planytan från de flesta vinklar. Justerbar per
// (struktur,axel) från F9-panelen, se setBrain3DCapAxisDebug.
const BRAIN3D_CAP_THICKNESS_DEFAULT = 0.002;
// Loggar varje FAKTISK ritning (inte bara position/synlighets-uppdatering) av en lock-mesh eller
// dess stencil-skriv-pass, via Object3D.onBeforeRender -- three.js kallar den EXAKT innan draw
// call för det objektet skickas till GPU:n, en gång per bildruta objektet faktiskt renderas
// (dvs. visible, rätt lager för kameran, inte frustum-cullad). Av som default (annars spammar
// konsolen varje bildruta så fort ett snitt är aktivt) -- slå på med setBrain3DLogCapDraws(true)
// eller kryssrutan högst upp i F9-panelen.
let BRAIN3D_LOG_CAP_DRAWS = false;
function setBrain3DLogCapDraws(on){ BRAIN3D_LOG_CAP_DRAWS = !!on; }
// Monoton räknare, inte bara en tidsstämpel -- gör den INBÖRDES ordningen mellan stencil-write-
// och cap-loggraderna entydig även när flera hamnar i samma console.log-"tick" (t.ex. samma
// requestAnimationFrame), utan att behöva lita på att loggraderna råkar skrivas ut i rätt ordning.
let BRAIN3D_LOG_SEQ = 0;
// TESTKNAPP: byt till true för att vända vilken sida (BackSide/FrontSide) som räknas som
// "in i modellen" kontra "ut ur modellen" i stencil-räkningen (se back/front några rader ner).
// Det här är den praktiska motsvarigheten till att "vända normalerna" utan att röra
// geometrin -- swappar bara vilken sida som får IncrementWrapStencilOp vs DecrementWrapStencilOp.
// Redan testat en gång (ingen skillnad då, se konversationen) men lämnad som en enkel
// boolean här så det går att testa om/när man vill, utan att leta upp koden på nytt.
const BRAIN3D_CAP_FLIP_WINDING = true;
function _axisOtherPlanes(clip, axisKey){
  return Object.keys(clip).filter(k=>k!==axisKey).map(k=>clip[k].plane);
}
function _buildStencilCaps(part, cat, clip, group){
  if(BRAIN3D_CAP_SKIP[cat])return;
  // Föredra den vattentäta cap-proxyn (se kommentaren där den byggs, i applyParts) -- den
  // riktiga ytan används bara som reserv om proxyn av någon anledning saknas/inte gick att tolka.
  const meshes = part.proxyMesh ? [part.proxyMesh] : [];
  // c!==part.outlineMesh -- annars plockade traverseringen (för de få strukturer som saknar
  // cap-proxy, t.ex. thalamus_l/r, se ovan) OCKSÅ upp konturmeshen (se processNextCategory,
  // "Atlas-stil"), som har en egen (avsiktligt 1.02x förstorad) skala. Skalan appliceras på de
  // RÅA, o-förskjutna geometrikoordinaterna (fortfarande i originaldatasetets ental-tusen-skala
  // innan wrapper-skalan/-CENTER-förskjutningen), så en till synes obetydlig 2%-förstoring gav
  // en FLERA TIONDELS enheter fel position i världsrymden -- syntes som en andra, felplacerad
  // "kopia" av strukturens lock (upptäckt: användaren såg två lila områden för samma thalamus).
  if(!meshes.length) part.object.traverse(c=>{ if(c.isMesh && c!==part.outlineMesh) meshes.push(c); });
  if(!meshes.length)return;
  const capColor = part.baseColor.clone().multiplyScalar(BRAIN3D_CAP_BRIGHTNESS);   // en nyans mörkare -- läses som "nyss snittad yta", samma knep atlasillustrationer använder
  const caps = {};
  console.log("brain3d: stencil caps för", cat, "(",meshes.length,"mesh(es))");
  // renderOrder är GLOBALT för hela scenen, inte skopat per struktur -- att bara ge alla
  // stencil-skrivningar renderOrder=1 och alla lock renderOrder=2 (tidigare kod) betydde att
  // ALLA strukturers skriv-pass kördes före NÅGOT struktur fick testa/nolla stencilbufferten.
  // Där två strukturer överlappar i genomskärning (t.ex. thalamus, helt omsluten av capsula
  // interna) hann då grannens skriv-pass lägga till EXTRA increment/decrement på samma pixlar
  // innan den egna strukturens lock testade bufferten -- fel paritet, taggigt "hål" i locket
  // (hittat genom att gömma capsula och se thalamus-hålet försvinna helt). Fixen: varje
  // (struktur, axel)-par får ett eget, unikt renderOrder-intervall, så hela skriv->testa->nolla-
  // cykeln för EN kombination alltid är helt klar innan NÅGON annan kombination börjar skriva.
  const catIndex = BRAIN3D_CATEGORIES.indexOf(cat);
  Object.keys(clip).forEach((axisKey,axisIdx)=>{
    const renderOrderBase = 100 + (catIndex*3+axisIdx)*3;
    const otherPlanes = _axisOtherPlanes(clip, axisKey);
    const g = new THREE.Group();
    g.visible = false;
    const backMats = [], frontMats = [];
    meshes.forEach(mesh=>{
      // depthTest:false här är kritiskt (saknades tidigare, trots att det är satt så i Three.js
      // egna referens-exempel för just den här tekniken, webgl_clipping_stencil) -- annars
      // beror rätt/fel korsningsräkning på VAD SOM RÅKAR LIGGA I DJUPBUFFERTEN SEDAN TIDIGARE
      // (t.ex. en grannstrukturs redan ritade, ogenomskinliga yta som händelsevis skymmer en del
      // av DEN HÄR ytans bak-/framsidor från just DEN HÄR kameravinkeln) -- osynligt/oskrivet
      // djup, färg är redan avstängt (depthWrite/colorWrite:false), så det finns inget skäl att
      // alls testa mot djupbufferten: räkningen ska spegla den FAKTISKA geometrin, oavsett vad
      // som redan ritats. Detta var den riktiga förklaringen till att lock bara syntes korrekt
      // från vissa vinklar/scen-sammansättningar (upptäckt av att capsula, som redan ritats
      // OGENOMSKINLIG och som delvis skymmer thalamus i djupled, gjorde thalamus-lockets
      // räkning fel just där de två strukturerna överlappar på skärmen).
      const mkStencil = (side, op)=> new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({
        depthWrite:false, depthTest:false, colorWrite:false, stencilWrite:true, side,
        clippingPlanes: [clip[axisKey].plane], stencilFunc:THREE.AlwaysStencilFunc,
        stencilFail:op, stencilZFail:op, stencilZPass:op
      }));
      const back = mkStencil(THREE.BackSide, BRAIN3D_CAP_FLIP_WINDING ? THREE.DecrementWrapStencilOp : THREE.IncrementWrapStencilOp);
      const front = mkStencil(THREE.FrontSide, BRAIN3D_CAP_FLIP_WINDING ? THREE.IncrementWrapStencilOp : THREE.DecrementWrapStencilOp);
      // layer 1 (utöver standard-layer 0) -- gör att den separata "bara-lock"-vyn (se
      // ensureBrain3DCapsView) kan rendera SAMMA scen med en kamera som BARA ser lager 1,
      // och därmed BARA locken (inte bakgrundsfyllnaden, inte själva organen). Måste gälla
      // både stencil-skrivningarna och locket självt -- annars finns inget som skriver
      // stencilbufferten för den kamerans eget render()-anrop (egen renderer, egen buffert).
      [back,front].forEach(m=>{
        m.matrixAutoUpdate=false; m.matrix.copy(mesh.matrixWorld); m.renderOrder=renderOrderBase; m.layers.enable(1); g.add(m);
        const side = m===back?"back":"front";
        m.onBeforeRender = (r)=>{ if(BRAIN3D_LOG_CAP_DRAWS) console.log(`#${++BRAIN3D_LOG_SEQ} stencil write: ${cat} / ${axisKey} / ${side} / renderOrder=${m.renderOrder} (canvas=${r.domElement.id||"?"})`); };
      });
      backMats.push(back.material); frontMats.push(front.material);
    });
    const isVentricles = cat==="ventricles";
    // Locket klipps av ALLA aktiva snittplan (inte bara sin egen axel) -- annars, med två snitt
    // aktiva samtidigt, sträckte sig t.ex. sagittal-lockets platta ut över HELA sin 9x9-yta även
    // där den koronara axeln redan skurit bort den halvan, i stället för att bara synas i
    // SKÄRNINGEN mellan de två snitten. Stencil-skrivningarna (mkStencil ovan) ska DÄREMOT
    // fortsätta klippas av bara sin EGEN axel (otestat/förändrat) -- annars slutar själva
    // räkne-tekniken fungera när bara ETT snitt är aktivt (den "öppning" i den slutna ytan som
    // ger ett korrekt nollskilt resultat kommer just från att klippas av den egna axeln; att i
    // stället klippa av ENDAST de andra axlarna (redan testat, se konversationen) gjorde att
    // ett vattentätt lock aldrig fick något resultat alls så fort bara en axel var aktiv).
    // Platt enfärgad yta per struktur (var kortvarigt en procedurell "vävnads"-shader, se
    // brain3d-cap-shader.js -- reverterad: gjorde att alla lock såg likadana ut, en enda
    // brun-rosa "köttyta" som tog bort den tydliga per-struktur-färgkodningen som matchade
    // Neuro/images/brain_front.png/brain_side.png bättre).
    const capMat = new THREE.MeshBasicMaterial({
      color:capColor, side:THREE.DoubleSide, clippingPlanes: [clip[axisKey].plane, ...otherPlanes],
      // VIKTIGT: transparent ALLTID false, även för ventriklarna (som ändå ska se halvgenom-
      // skinliga ut, opacity 0.55/0.78) -- three.js lägger transparent:true-objekt i en HELT
      // SEPARAT kö som ritas EFTER hela den opaka kön, oavsett renderOrder (samma bugg-klass
      // som beskrivs för icke-ventrikel-lock i setBrain3DStructureHighlight). Ventriklarnas
      // lock var det ENDA transparent:true-locket, vilket sköt upp DESS EGEN stencil-nollställning
      // till efter ALLA andra strukturers skriv/testa/nollställ-cykler -- så en SENARE kategori
      // i BRAIN3D_CATEGORIES (t.ex. ryggmärg, kotpelare, cortex) kunde läsa av ventriklarnas
      // KVARLIGGANDE, ännu ej nollställda stencil-bitar som sina EGNA och blöda in i fel område
      // (upptäckt: att välja "Ryggmärg" tände röda fläckar uppe vid talamus -- ventriklarnas
      // gamla plats -- medan att välja "Ventriklar" visade ingenting alls, eftersom SJÄLVA
      // ventrikellockets test också kom sist och aldrig såg sin egen, redan bortnollställda bit).
      // Lösningen: opacity/blending ger fortfarande genomskinlighet (three.js styr faktisk
      // blend-status via `blending`, inte `transparent` -- den senare styr bara KÖ-placeringen),
      // så vi behåller utseendet men stannar i den strikt sekvensordnade opaka kön.
      transparent:false, blending:THREE.NormalBlending,
      opacity:isVentricles?0.55:1, depthWrite:!isVentricles,
      stencilWrite:true, stencilRef:0, stencilFunc:THREE.NotEqualStencilFunc,
      stencilFail:THREE.ZeroStencilOp, stencilZFail:THREE.ZeroStencilOp, stencilZPass:THREE.ZeroStencilOp
    });
    // BoxGeometry i stället för PlaneGeometry -- ett tunt (BRAIN3D_CAP_THICKNESS_DEFAULT) "skivat"
    // block, inte en oändligt tunn yta. Ser likadant ut som en plan yta rakt framifrån, men går
    // att göra tjockare från F9-panelen (se setBrain3DCapAxisDebug) för att lättare kunna se/
    // hitta locket från en snäv/nästan kant-på vinkel när man felsöker. Box-djupet (Z FÖRE
    // rotationen nedan) hamnar automatiskt längs snittets normal-riktning för alla tre axlarna,
    // eftersom rotationerna nedan redan är satta för att vrida planets normal dit.
    const cap = new THREE.Mesh(new THREE.BoxGeometry(9,9,BRAIN3D_CAP_THICKNESS_DEFAULT), capMat);
    cap.renderOrder=renderOrderBase+1;
    cap.layers.enable(1);
    cap.onBeforeRender = (r)=>{ if(BRAIN3D_LOG_CAP_DRAWS) console.log(`#${++BRAIN3D_LOG_SEQ} cap draw: ${cat} / ${axisKey} / renderOrder=${cap.renderOrder} (canvas=${r.domElement.id||"?"})`); };
    if(axisKey==="sagittal") cap.rotation.y=Math.PI/2;
    else if(axisKey==="axial") cap.rotation.x=-Math.PI/2;
    g.add(cap);
    group.add(g);
    caps[axisKey]={group:g, cap, backMats, frontMats};
  });
  part.caps = caps;
  // Debug-läge (F9-panelen, se setBrain3DCapDebug/brain-diagram.js) -- per-struktur override
  // ovanpå de globala/automatiska värdena, så man kan experimentera på EN struktur i taget utan
  // att påverka de andra: on = tvinga locket dolt även om snittet är aktivt, eps = extra
  // handpålagd positionsjustering utöver den automatiska (BRAIN3D_CAP_EPS+stagger), flip =
  // byt vilken sida (back/front) som räknas upp/ner i just DEN HÄR strukturens lock (samma
  // effekt som BRAIN3D_CAP_FLIP_WINDING men skopat till en struktur), bypass = hoppa över
  // stencil-testet helt (AlwaysStencilFunc) för att se om locket ÖVERHUVUDTAGET kan rita sig
  // (skiljer "stencil-skrivningen ger fel/inget" från "positionen/geometrin är fel").
  // axes: per-(struktur,axel) override av lockets ABSOLUTA x/y/z (null = använd den automatiska
  // beräkningen, se _updateStencilCapPositions) plus tjocklek (null = BRAIN3D_CAP_THICKNESS_DEFAULT).
  // Låter en jämföra exakt var LOCKET ligger mot var den RIKTIGA organgeometrin ligger
  // (_brain3dWorldBox(cat), visas i F9-panelen) och flytta det dit för hand.
  const axes = {};
  Object.keys(clip).forEach(axisKey=>{ axes[axisKey] = {overrideX:null, overrideY:null, overrideZ:null, thickness:null}; });
  part.capDebug = {on:true, eps:0, flip:false, bypass:false, axes};
}
// ---- Enkel "bakgrundsfyllnad"-kapning (ETT plan per snittaxel, hela modellen) ----
// I stället för att räkna ut EXAKT vilken struktur som är "innanför" (stencil-tekniken ovan,
// avstängd -- se filkommentaren där _buildStencilCaps anropades) fylls hela snittytan med EN
// enda blek rosa-vit platta ("vit substans"-färg, som i anatomiböcker), stor nog att täcka
// HELA modellen. Vanligt djuptest (inget stencil-trick) så riktig geometri som faktiskt ligger
// framför fortfarande syns/ockluderar den -- den fyller bara i där ett ihåligt skal annars
// hade visat tomrum. Mindre exakt (visar inte VILKEN vävnad som är snittad var), men robust:
// ingen risk för artefakter mellan överlappande grannstrukturer.
// Gulvit "myelin"-färg (som vit substans i anatomiböcker, t.ex. Netter) i stället för den
// tidigare blekrosa tonen -- och hög opacitet (var 0.3) så den läses som en SOLID fyllning i
// hålen/luckorna, inte bara en svag tint ovanpå vad som råkar synas bakom.
const BRAIN3D_BULK_CAP_COLOR = 0xF2E6BE;
// Bakgrundsplattan var tidigare bara klippt av de AKTIVA snittplanen -- en ren rektangel, oavsett
// var den faktiska anatomin faktiskt slutar (syntes som att fyllningen "svävade" utanför hjärnans
// egna konturer). Löser det med SAMMA stencil-räkningsteknik som de färgade per-strukturlocken
// (se _buildStencilCaps), men EN DELAD räkning för ALLA strukturer tillsammans i stället för en
// separat räkning per struktur: varje strukturs geometri skriver till stencilbufferten (samma
// back/front-räkning), UTAN att nollställas mellan strukturerna, så summan blir skild från noll
// var som helst innanför NÅGON av dem (unionen). Bakgrundsplattan testar sedan mot den summan
// i stället för att bara vara en oklippt rektangel.
// VIKTIGT: varje AXEL behöver sitt EGET, unika renderOrder-intervall (skriv -> testa -> nollställ),
// annars blandas alla tre axlarnas skrivningar ihop i EN gemensam stencil-summa innan någon av
// dem hunnit testa/nollställa (samma sorts bugg som löstes för de individuella per-strukturlocken,
// se kommentaren vid renderOrderBase i _buildStencilCaps -- missades här första gången, hittades
// genom att jämföra pixelträffar per struktur före/efter och se en orimlig ökning). Dessutom: en
// extra, OVILLKORLIG säkerhets-nollställning direkt efter bakgrundsplattans eget test -- annars
// läcker skrivningarna in i de individuella lockens 100+-intervall om bakgrundsplattan av någon
// anledning inte själv renderas (t.ex. dold via F9-panelen eller vid isolerad felsökning).
const BRAIN3D_BULK_OUTLINE_ORDER = {sagittal:40, coronal:43, axial:46};   // skriv = bas, test = bas+1, säkerhets-reset = bas+2
function _addToBulkOutlineStencil(part, cat, clip, group){
  if(BRAIN3D_CAP_SKIP[cat])return;
  const meshes = part.proxyMesh ? [part.proxyMesh] : [];
  // c!==part.outlineMesh -- annars plockade traverseringen (för de få strukturer som saknar
  // cap-proxy, t.ex. thalamus_l/r, se ovan) OCKSÅ upp konturmeshen (se processNextCategory,
  // "Atlas-stil"), som har en egen (avsiktligt 1.02x förstorad) skala. Skalan appliceras på de
  // RÅA, o-förskjutna geometrikoordinaterna (fortfarande i originaldatasetets ental-tusen-skala
  // innan wrapper-skalan/-CENTER-förskjutningen), så en till synes obetydlig 2%-förstoring gav
  // en FLERA TIONDELS enheter fel position i världsrymden -- syntes som en andra, felplacerad
  // "kopia" av strukturens lock (upptäckt: användaren såg två lila områden för samma thalamus).
  if(!meshes.length) part.object.traverse(c=>{ if(c.isMesh && c!==part.outlineMesh) meshes.push(c); });
  if(!meshes.length)return;
  Object.keys(clip).forEach(axisKey=>{
    const renderOrder = BRAIN3D_BULK_OUTLINE_ORDER[axisKey];
    meshes.forEach(mesh=>{
      const mkStencil = (side, op)=> new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({
        depthWrite:false, depthTest:false, colorWrite:false, stencilWrite:true, side,
        clippingPlanes:[clip[axisKey].plane], stencilFunc:THREE.AlwaysStencilFunc,
        stencilFail:op, stencilZFail:op, stencilZPass:op
      }));
      const back = mkStencil(THREE.BackSide, BRAIN3D_CAP_FLIP_WINDING ? THREE.DecrementWrapStencilOp : THREE.IncrementWrapStencilOp);
      const front = mkStencil(THREE.FrontSide, BRAIN3D_CAP_FLIP_WINDING ? THREE.IncrementWrapStencilOp : THREE.DecrementWrapStencilOp);
      [back,front].forEach(m=>{ m.matrixAutoUpdate=false; m.matrix.copy(mesh.matrixWorld); m.renderOrder=renderOrder; group.add(m); });
    });
  });
}
// Ovillkorlig nollställning, alltid aktiv (oberoende av om bakgrundsplattan själv renderas) --
// se filkommentaren ovan.
function _buildBulkOutlineSafetyReset(clip, group){
  Object.keys(clip).forEach(axisKey=>{
    const mat = new THREE.MeshBasicMaterial({
      colorWrite:false, depthWrite:false, depthTest:false,
      stencilWrite:true, stencilFunc:THREE.AlwaysStencilFunc,
      stencilFail:THREE.ZeroStencilOp, stencilZFail:THREE.ZeroStencilOp, stencilZPass:THREE.ZeroStencilOp
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(9,9), mat);
    mesh.renderOrder = BRAIN3D_BULK_OUTLINE_ORDER[axisKey] + 2;
    if(axisKey==="sagittal") mesh.rotation.y = Math.PI/2;
    else if(axisKey==="axial") mesh.rotation.x = -Math.PI/2;
    group.add(mesh);
  });
}
function _buildBulkCaps(clip, group){
  const caps = {};
  const allPlanes = Object.values(clip).map(c=>c.plane);
  Object.keys(clip).forEach(axisKey=>{
    // Klipps av ALLA aktiva snittplan (samma resonemang som för capMat i _buildStencilCaps) --
    // annars fyllde bakgrundsplattan sin FULLA 9x9-yta även när en ANNAN axel redan skurit bort
    // en del av den. Testar OCKSÅ mot den delade utsides-stencilen ovan (NotEqual/ref 0, nollställd
    // efteråt) -- annars fyllde den fortfarande hela den (kvadratiska) klippta ytan i stället för
    // att respektera anatomins faktiska, oregelbundna ytterkontur.
    const mat = new THREE.MeshBasicMaterial({
      color:BRAIN3D_BULK_CAP_COLOR, side:THREE.DoubleSide, transparent:true, opacity:0.92, clippingPlanes:allPlanes,
      stencilWrite:true, stencilRef:0, stencilFunc:THREE.NotEqualStencilFunc,
      stencilFail:THREE.ZeroStencilOp, stencilZFail:THREE.ZeroStencilOp, stencilZPass:THREE.ZeroStencilOp
    });
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(9,9), mat);
    cap.visible = false;
    cap.renderOrder = BRAIN3D_BULK_OUTLINE_ORDER[axisKey] + 1;
    if(axisKey==="sagittal") cap.rotation.y = Math.PI/2;
    else if(axisKey==="axial") cap.rotation.x = -Math.PI/2;
    group.add(cap);
    caps[axisKey] = cap;
  });
  _buildBulkOutlineSafetyReset(clip, group);
  return caps;
}
function _updateBulkCapPositions(clip, bulkCaps){
  if(!bulkCaps)return;
  Object.keys(clip).forEach(axisKey=>{
    const c = clip[axisKey];
    const cap = bulkCaps[axisKey];
    if(!cap)return;
    cap.visible = c.enabled;
    if(!c.enabled)return;
    const sign = c.flip?1:-1, eps = 0.02*sign;
    if(axisKey==="sagittal") cap.position.set(c.value+eps,0,0);
    else if(axisKey==="coronal") cap.position.set(0,0,c.value+eps);
    else cap.position.set(0,c.value+eps,0);
  });
}
function _updateStencilCapPositions(clip, allParts){
  Object.keys(clip).forEach(axisKey=>{
    const c = clip[axisKey];
    Object.keys(allParts).forEach(cat=>{
      const part = allParts[cat];
      const entry = part.caps && part.caps[axisKey];
      if(!entry)return;
      const dbg = part.capDebug || {on:true, eps:0};
      entry.group.visible = c.enabled && dbg.on && !brain3d.capsHidden;
      // Litet epsilon-lyft in i den kvarvarande (behållna) volymen -- utan det ligger locket
      // EXAKT i samma djup som originalytans avskurna kant (som per definition också ligger
      // exakt vid snittplanet), vilket ger z-fighting (flimrigt/prickigt mönster där lock och
      // originalyta tävlar om samma pixlar, kan se ut som "hål"). Se BRAIN3D_CAP_EPS. Plus ett
      // per-kategori-unikt extra steg (se BRAIN3D_CAP_EPS_STEP) så INTE HELLER två OLIKA
      // strukturers lock (t.ex. thalamus och den omslutande capsula interna) hamnar på exakt
      // samma djup som varandra där de överlappar i genomskärning.
      // Epsilon-riktningen måste peka in i den NUVARANDE behållna halvan -- vid en vänd
      // (flip) axel är det motsatt håll mot det ovända fallet, se setBrain3DClipFlip.
      // dbg.eps: extra handpålagd offset från F9-panelen, ovanpå den automatiska.
      const eps = (c.flip?1:-1) * (BRAIN3D_CAP_EPS + BRAIN3D_CATEGORIES.indexOf(cat)*BRAIN3D_CAP_EPS_STEP) + dbg.eps;
      const autoX = axisKey==="sagittal" ? c.value+eps : 0;
      const autoY = axisKey==="axial"    ? c.value+eps : 0;
      const autoZ = axisKey==="coronal"  ? c.value+eps : 0;
      // Per-axel override (F9-panelen, setBrain3DCapAxisDebug) -- ABSOLUT x/y/z, ersätter den
      // automatiska beräkningen ovan komponent för komponent (null = fortsätt auto-följa snittet).
      const ov = (dbg.axes && dbg.axes[axisKey]) || {};
      const posX = ov.overrideX!=null ? ov.overrideX : autoX;
      const posY = ov.overrideY!=null ? ov.overrideY : autoY;
      const posZ = ov.overrideZ!=null ? ov.overrideZ : autoZ;
      entry.cap.position.set(posX, posY, posZ);
    });
  });
}
// Tillfälligt döljer ALLA snittytor (lock) oavsett vilka snitt som är aktiva -- t.ex. för att
// se de klippta strukturernas råa, ofyllda insida. Ren visningsväxel (samma grupp/objekt som
// vanligt, bara group.visible som slås av), rör inte klippningen/stencil-räkningen själv --
// se checkboxen "Snittytor (lock)" i brain-diagram.js.
function setBrain3DCapsHidden(hidden){
  if(!brain3d)return;
  brain3d.capsHidden = !!hidden;
  if(brain3d.loaded) _updateStencilCapPositions(brain3d.clip, brain3d.parts);
}
// ---- F9-felsökningspanel (se brain-diagram.js) -- per-struktur override av lockens on/off,
// position, vridriktning och stencil-test, för att experimentera sig fram till roten av
// cap-buggarna utan att behöva be mig gissa/analysera i onödan (se konversationen: "leave that"/
// "i want to see the image myself"). Ren debug-krok, påverkar bara ETT lock i taget.
function getBrain3DCapDebugCategories(){
  return BRAIN3D_CATEGORIES.filter(cat=>!BRAIN3D_CAP_SKIP[cat]);
}
function getBrain3DCapDebugState(cat){
  const part = brain3d && brain3d.parts[cat];
  return part ? Object.assign({}, part.capDebug) : null;
}
function setBrain3DCapDebug(cat, patch){
  if(!brain3d)return;
  const part = brain3d.parts[cat];
  if(!part || !part.caps)return;
  part.capDebug = Object.assign(part.capDebug || {on:true, eps:0, flip:false, bypass:false}, patch);
  const dbg = part.capDebug;
  Object.keys(part.caps).forEach(axisKey=>{
    const entry = part.caps[axisKey];
    entry.backMats.forEach(m=>{
      const op = dbg.flip ? THREE.IncrementWrapStencilOp : THREE.DecrementWrapStencilOp;
      m.stencilFail = m.stencilZFail = m.stencilZPass = op;
    });
    entry.frontMats.forEach(m=>{
      const op = dbg.flip ? THREE.DecrementWrapStencilOp : THREE.IncrementWrapStencilOp;
      m.stencilFail = m.stencilZFail = m.stencilZPass = op;
    });
    entry.cap.material.stencilFunc = dbg.bypass ? THREE.AlwaysStencilFunc : THREE.NotEqualStencilFunc;
  });
  _updateStencilCapPositions(brain3d.clip, brain3d.parts);
}
function resetBrain3DCapDebug(cat){
  setBrain3DCapDebug(cat, {on:true, eps:0, flip:false, bypass:false});
  const part = brain3d && brain3d.parts[cat];
  if(part && part.caps) Object.keys(part.caps).forEach(axisKey=>resetBrain3DCapAxisDebug(cat, axisKey));
}
// Per-(struktur,axel) override av lockets ABSOLUTA x/y/z + tjocklek -- se axes-fältet i
// part.capDebug (satt i _buildStencilCaps) och kommentaren i _updateStencilCapPositions.
function getBrain3DCapAxisState(cat, axisKey){
  const part = brain3d && brain3d.parts[cat];
  const axes = part && part.capDebug && part.capDebug.axes;
  return (axes && axes[axisKey]) ? Object.assign({}, axes[axisKey]) : {overrideX:null, overrideY:null, overrideZ:null, thickness:null};
}
// Nuvarande, FAKTISKA värld-position för ett specifikt lock -- för att jämföra mot
// _brain3dWorldBox(cat) (organets egen bounding box) i F9-panelen.
function getBrain3DCapCurrentPosition(cat, axisKey){
  const part = brain3d && brain3d.parts[cat];
  const entry = part && part.caps && part.caps[axisKey];
  if(!entry)return null;
  const wp = new THREE.Vector3();
  entry.cap.getWorldPosition(wp);
  return wp.toArray();
}
function setBrain3DCapAxisDebug(cat, axisKey, patch){
  if(!brain3d)return;
  const part = brain3d.parts[cat];
  if(!part || !part.caps || !part.caps[axisKey])return;
  if(!part.capDebug) part.capDebug = {on:true, eps:0, flip:false, bypass:false, axes:{}};
  if(!part.capDebug.axes) part.capDebug.axes = {};
  const cur = part.capDebug.axes[axisKey] || {overrideX:null, overrideY:null, overrideZ:null, thickness:null};
  Object.assign(cur, patch);
  part.capDebug.axes[axisKey] = cur;
  if("thickness" in patch){
    const t = cur.thickness==null ? BRAIN3D_CAP_THICKNESS_DEFAULT : cur.thickness;
    const entry = part.caps[axisKey];
    entry.cap.geometry.dispose();
    entry.cap.geometry = new THREE.BoxGeometry(9,9,Math.max(0.0005,t));
  }
  _updateStencilCapPositions(brain3d.clip, brain3d.parts);
}
function resetBrain3DCapAxisDebug(cat, axisKey){
  setBrain3DCapAxisDebug(cat, axisKey, {overrideX:null, overrideY:null, overrideZ:null, thickness:null});
}

function ensureBrain3D(cv, onReady){
  if(brain3d || !cv || !window.THREE) return;
  const renderer = new THREE.WebGLRenderer({canvas:cv, antialias:true, alpha:true, stencil:true});
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 160);
  camera.position.set(0,0,8.6);
  camera.lookAt(0,0,0);
  // TEST: ett plan som alltid sitter en bit FRAMFÖR kameran (barn till camera, som i sin tur
  // måste vara med i scenen för att child-objekt ska ritas alls -- se scene.add(camera) nedan),
  // täcker hela vyn oavsett rotation/pan/zoom eftersom det flyttar sig med kameran varje bildruta.
  // Bara ett experiment -- ändra/ta bort BRAIN3D_FRONT_PLANE-blocket om det inte ger något.
  scene.add(camera);
  const frontPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(20,20),
    new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.1, depthTest:false, depthWrite:false})
  );
  frontPlane.renderOrder = 9999;
  frontPlane.position.set(0,0,-1);
  camera.add(frontPlane);

  // Ljussättning matchad mot minikartan (se samma recept vid miniKey/miniFill nedan) -- lägre
  // ambient + starkare riktat ljus ger mer skuggkontrast (syns t.ex. som sulci/veck i cortex)
  // i stället för den tidigare nästan platta, högambienta belysningen. Key något dämpad jämfört
  // med minikartan (0.75 i stället för 0.9) -- i kombination med toon-gradienten (se nedan) blev
  // annars övergången mellan ljus/skugga för hård/blänkande ("flare"), tvärtemot den flata,
  // tecknade looken som efterfrågades.
  const ambient = new THREE.AmbientLight(0xffffff,0.6); scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff,0.75); key.position.set(-3,5,3); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff,0.35); fill.position.set(2,1,3); scene.add(fill);

  // Tecknad ("cartoon"/cel-shading) look i stället för den mjuka Lambert-gradienten -- färgen
  // delas upp i ett litet antal DISKRETA ljusnivåer (NearestFilter, inga mellanlägen) via en
  // gradient-karta till MeshToonMaterial. Ingen specularhöjdpunkt alls (till skillnad från t.ex.
  // Phong), vilket är den andra halvan av "mindre ljus-flare". Delad mellan alla strukturer.
  const toonLevels = new Uint8Array([70, 130, 190, 255]);
  const toonFormat = renderer.capabilities.isWebGL2 ? THREE.RedFormat : THREE.LuminanceFormat;
  const toonGradientMap = new THREE.DataTexture(toonLevels, toonLevels.length, 1, toonFormat);
  toonGradientMap.magFilter = THREE.NearestFilter;
  toonGradientMap.minFilter = THREE.NearestFilter;
  toonGradientMap.needsUpdate = true;

  const group = new THREE.Group();
  scene.add(group);
  const tractGroup = new THREE.Group();
  scene.add(tractGroup);

  // Klippsnitt (kors-sektioner): tre plan i VÄRLDSAXLAR (se kommentaren om +X/+Y/+Z ovan) --
  // sagittal (vänster/höger, normal längs X), koronar (fram/bak, normal längs Z), axial
  // (upp/ner, normal längs Y). Av/på genom att flytta planet utanför modellens bounding box
  // (±30) i stället för att bygga om materialens clippingPlanes-array varje gång.
  const clip = {
    sagittal: {plane:new THREE.Plane(new THREE.Vector3(1,0,0), 30), enabled:false, value:0, flip:false},
    coronal:  {plane:new THREE.Plane(new THREE.Vector3(0,0,1), 30), enabled:false, value:0, flip:false},
    axial:    {plane:new THREE.Plane(new THREE.Vector3(0,1,0), 30), enabled:false, value:0, flip:false}
  };
  const allClipPlanes = [clip.sagittal.plane, clip.coronal.plane, clip.axial.plane];

  const parts = {};
  const bulkCaps = _buildBulkCaps(clip, group);
  // pan: siktpunkten kameran roterar/zoomar KRING -- (0,0,0) som default, flyttad av
  // Helkropp-förvalet (se _brain3dWholeLookAtY) eller manuellt av användaren (Skift+dra,
  // se pointermove nedan) för att kunna centrera bilden precis som man själv vill.
  brain3d = {renderer,scene,camera,group,tractGroup,parts,clip,allClipPlanes,bulkCaps,frontPlane,
    ambient,key,fill,style:"toon",colorMode:"grouped",postFXEnabled:true,capsHidden:false,
    active:false,rotY:0.35,rotX:-0.08,dist:8.6,pan:new THREE.Vector3(0,0,0),loaded:false,highlight:null,tractKeys:null};
  applyBrain3DCamera();

  // 18 kategorier, upp till ~13MB OBJ-text var (cortex) -- att tolka ALLA synkront i en enda
  // .map()/.forEach()-svep (gamla koden) fick sidan att frysa i upp till någon sekund. Löser
  // det genom att bara tolka EN kategori i taget och lämna tillbaka kontrollen till webbläsaren
  // (setTimeout(...,0)) mellan varje, så sidan förblir klickbar/scrollbar under tiden. Panelen
  // visar en "Laddar 3D-modell…"-platshållare (se brain-diagram.js + CSS) tills brain3d.loaded
  // blir true, då onReady (skickas in av anroparen) döljer den.
  const loader = new THREE.OBJLoader();
  let catIdx = 0;
  function processNextCategory(){
    if(catIdx >= BRAIN3D_CATEGORIES.length){
      brain3d.loaded = true;
      if(brain3d.highlight!==undefined) updateBrain3D(brain3d.highlight);
      if(brain3d.tractKeys) renderBrain3DTracts(brain3d.tractKeys);
      if(brain3d.reflexKey) renderBrain3DReflexArc(brain3d.reflexKey);
      if(onReady) onReady();
      return;
    }
    const cat = BRAIN3D_CATEGORIES[catIdx++];
    const text = window.BRAIN3D_OBJ && window.BRAIN3D_OBJ[cat];
    if(!text){ console.error("brain3d: saknar inbäddad OBJ-data för", cat); setTimeout(processNextCategory,0); return; }
    let obj;
    try{ obj = loader.parse(text); }
    catch(e){ console.error("brain3d: kunde inte tolka OBJ för", cat, e); setTimeout(processNextCategory,0); return; }

    const grp = _brain3dGroupOf(cat);
    const isCtxRegion = cat.startsWith("ctx_");
    // Delregionerna är bara till för att visas EN I TAGET, alltid som en solid röd markering
    // (se setBrain3DCortexRegion) -- ingen egen kulör att hålla reda på, samma "active"-röd
    // som strukturknapparna redan använder för valt organ.
    const baseColor = isCtxRegion ? new THREE.Color(NEURO_ATLAS_COLORS.active) : new THREE.Color(NEURO_ATLAS_COLORS[grp]||NEURO_ATLAS_COLORS.gray);
    const isCortex = cat==="cortex";
    const isVertebrae = cat==="vertebrae";
    const transparent = cat==="ventricles" || isCortex || isVertebrae;
    // Cortexskalet (och ventriklarna) ska gå att se IGENOM till det som ligger bakom --
    // låg opacitet + depthWrite:false så de inte ockluderar det som ligger bakom dem i
    // djupled (annars hade det bara sett ut som en halvgenomskinlig FRAMSIDA, med allt bakom
    // helt dolt av depth-testet). Detta är EXTRA viktigt (inte bara kosmetiskt) för klippta
    // transparenta ytor: med depthWrite:true skriver den FÖRSTA ritade triangeln på en pixel
    // till depth-bufferten, och alla efterföljande trianglar (även från SAMMA skal, t.ex.
    // ventrikelns bortre vägg) faller på depth-testet i stället för att blandas -- eftersom
    // ritordningen inte är sorterad ger det ett slumpmässigt, prickigt/"håligt" mönster
    // (upptäckt när ventriklarnas klippta yta såg ut som hål i hjärnstammen bakom den).
    // renderOrder högst för cortex så det alltid ritas sist (rätt genomskinlighets-sortering
    // mot de andra, redan delvis transparenta ventriklarna). Start-opaciteten här är bara en
    // rimlig DEFAULT tills initBrainDiagrams() synkar den mot kryssrutornas faktiska läge när
    // laddningen är klar (se _brain3dSetGhostOpaque/setBrain3DCortexVisible/setBrain3DCordVisible).
    const mat = new THREE.MeshToonMaterial({
      color:baseColor, transparent, gradientMap:toonGradientMap,
      opacity: isCortex?0.16:(isVertebrae?0.35:(transparent?0.55:1)),
      depthWrite: !transparent,
      clippingPlanes: allClipPlanes,
      side: THREE.DoubleSide   // annars blir insidan av ett snittat skal osynlig (bara ytterytan hade normaler åt rätt håll)
    });
    let mesh=null;
    obj.traverse(child=>{
      if(child.isMesh){ child.material = mat; child.renderOrder = isCortex?10:(isVertebrae?9:0); mesh = mesh ? mesh : child; }
    });
    // Kontur/"atlas"-stil (se setBrain3DStyle, knappen i UI:t) -- en något FÖRSTORAD kopia av
    // samma yta, BackSide (bara insidan av den förstorade kopian syns, eftersom kameran alltid
    // är utanför) + en mörk, platt, helt olyst färg. Den riktiga ytan (mat ovan, mindre) ritas
    // OVANPÅ/inuti den här och döljer det mesta av den -- bara en tunn rand av den förstorade
    // baksidan syns kvar runt silhuetten, som konturstrecken i anatomiboksbilderna (se
    // Neuro/images/brain_front.png/brain_side.png). Dold som standard (visible=false), bara
    // synlig i "atlas"-läget.
    let outlineMesh = null;
    if(mesh){
      const outlineMat = new THREE.MeshBasicMaterial({
        color: 0x2E2A22, side: THREE.BackSide, clippingPlanes: allClipPlanes,
        transparent, depthWrite: !transparent,   // samma anledning som huvudmaterialet ovan -- annars självockluderar en transparent kontur (cortex/ventriklar/kotpelare)
        opacity: isCortex?0.5:(isVertebrae?0.6:(transparent?0.7:1))
      });
      outlineMesh = new THREE.Mesh(mesh.geometry, outlineMat);
      // Skalan måste appliceras KRING geometrins EGET centrum, inte kring obj:s lokala origo --
      // mesh.geometry:s råa vertex-koordinater ligger fortfarande i originaldatasetets
      // tusental-skala (innan obj.position/-CENTER-förskjutningen), så en skala satt direkt
      // (scale.setScalar utan kompenserande position) skalar de RÅA STORA talen -- en till synes
      // obetydlig 2% blev en förskjutning på över EN HEL enhet i världsrymden (större än hela
      // thalamus självt), upptäckt genom att jämföra outlineMesh:s och den riktiga ytans
      // world-space bounding box. Formeln för att skala en punkt P kring centrum C med faktor s
      // (i SAMMA lokala rymd som .position/.scale verkar i): P' = C + s*(P-C) = s*P + C*(1-s) --
      // uppnås genom scale=s och position=C*(1-s).
      mesh.geometry.computeBoundingBox();
      const geomCenter = mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
      const outlineScale = 1.02;
      outlineMesh.scale.setScalar(outlineScale);
      outlineMesh.position.copy(geomCenter).multiplyScalar(1-outlineScale);
      outlineMesh.visible = false;
      outlineMesh.renderOrder = (isCortex?10:(isVertebrae?9:0)) - 1;
      obj.add(outlineMesh);
    }
    const wrapper = new THREE.Group();
    wrapper.add(obj);
    obj.position.set(-BRAIN3D_CENTER.x,-BRAIN3D_CENTER.y,-BRAIN3D_CENTER.z);
    wrapper.scale.setScalar(BRAIN3D_SCALE);
    const baseQuat = new THREE.Quaternion().setFromEuler(BRAIN3D_ROTATION);
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), BRAIN3D_YAW_FIX);
    wrapper.quaternion.copy(yawQuat).multiply(baseQuat);
    if(isCtxRegion) wrapper.visible = false;   // dold tills setBrain3DCortexRegion väljer just denna
    group.add(wrapper);

    // Snitt-"lock" (stencil-caps, se _buildStencilCaps) behöver en TÄT (vattentät) yta för
    // att räkna framsidor/baksidor rätt -- den riktiga, detaljerade ytan (obj ovan) är sammanslagen
    // från riktiga anatomiska segmenteringsfiler som INTE alltid är helt slutna (kontrollerat:
    // upp till ~16% av kanterna i vissa strukturer, t.ex. mesencephalon, är öppna där strukturen
    // gränsar mot grannvävnad i originalatlasen) -- stenciltekniken ger då hål i locket exakt där
    // ytan är öppen. Lösning: en separat, grovt förenklad men GARANTERAT vattentät kopia (voxelfylld
    // + marching cubes, se Neuro/models/brain/capproxy/ och scratchpad-scriptet som byggde dem) --
    // osynlig (visible=false, ritas aldrig), finns bara för att ge stencil-räkningen rätt svar.
    let proxyMesh = null;
    const proxyText = window.BRAIN3D_CAP_PROXY && window.BRAIN3D_CAP_PROXY[cat];
    if(proxyText){
      try{
        const proxyObj = loader.parse(proxyText);
        proxyObj.traverse(c=>{ if(c.isMesh && !proxyMesh) proxyMesh = c; });
        // BUGFIX: proxyn (trimesh voxelfyllning + marching cubes, se Neuro/models/brain/capproxy/)
        // har SIN EGEN lokala voxelgrid-koordinatrymd -- varken samma ursprung eller samma enheter
        // (mm) som den riktiga ytans råa datasetkoordinater -- så att bara kopiera obj.position
        // (den GLOBALA -BRAIN3D_CENTER-förskjutningen, avsedd för RÅA dataset-mm-koordinater)
        // slängde iväg proxyn tiotals enheter fel (bekräftat: capsule_l:s stencil-lock hamnade på
        // world-Y -51.8 i stället för sina egna ~1.24, långt utanför kamerafrustumet -- därför
        // frustumCulled=true skippade den TYST, onBeforeRender kallades aldrig, stencilbufferten
        // skrevs aldrig, och lockets stencil-test (!=0) misslyckades alltid). Fixen: räkna ut
        // proxyns egen råa bounding box och den riktiga ytans egen råa bounding box (båda i sin
        // egen, oförskjutna lokala rymd) och passa ihop dem (per-axel skala + centrera på samma
        // punkt), applicera SEDAN samma -CENTER-förskjutning som obj redan har -- i stället för
        // att anta att proxyns koordinater redan är i samma rymd som huvudgeometrin.
        if(proxyMesh && mesh){
          proxyMesh.geometry.computeBoundingBox();
          mesh.geometry.computeBoundingBox();
          const pBox = proxyMesh.geometry.boundingBox, mBox = mesh.geometry.boundingBox;
          const pSize = new THREE.Vector3(), mSize = new THREE.Vector3();
          pBox.getSize(pSize); mBox.getSize(mSize);
          const pCenter = new THREE.Vector3(), mCenter = new THREE.Vector3();
          pBox.getCenter(pCenter); mBox.getCenter(mCenter);
          const scale = new THREE.Vector3(mSize.x/pSize.x, mSize.y/pSize.y, mSize.z/pSize.z);
          proxyObj.scale.copy(scale);
          proxyObj.position.set(
            mCenter.x - scale.x*pCenter.x + obj.position.x,
            mCenter.y - scale.y*pCenter.y + obj.position.y,
            mCenter.z - scale.z*pCenter.z + obj.position.z
          );
        } else {
          proxyObj.position.copy(obj.position);   // reserv om något av geometrin oväntat saknas
        }
        proxyObj.visible = false;
        wrapper.add(proxyObj);
      }catch(e){ console.error("brain3d: kunde inte tolka cap-proxy för", cat, e); }
    }

    wrapper.updateMatrixWorld(true);
    parts[cat] = {object:obj, material:mat, baseColor, wrapper, proxyMesh, outlineMesh};
    // Per-struktur stencil-kapning ÅTERAKTIVERAD, nu SOM ETT LAGER OVANPÅ bakgrundsfyllnaden
    // (_buildBulkCaps, lägre renderOrder=50 än stencil-lockens 100+ -- se renderOrderBase) i
    // stället för att ersätta den helt. Ger varje struktur sin EGEN färg där snittet går genom
    // den, medan bakgrundsfyllnaden lyser igenom som en neutral "vit substans"-färg i alla
    // hål/luckor -- INKLUSIVE där stencil-tekniken har den kända, olösta artefakten (thalamus/
    // capsula interna, verklig ~6-9% käll-geometrisk överlappning, se konversationen): i stället
    // för att visa TOMRUM/bakgrund där, visar den nu bara bakgrundsfyllnadens neutrala färg --
    // mycket mindre påfallande än det gamla "hålet".
    _buildStencilCaps(parts[cat], cat, clip, group);
    _addToBulkOutlineStencil(parts[cat], cat, clip, group);

    setTimeout(processNextCategory, 0);
  }
  processNextCategory();

  let dragging=false, lastX=0, lastY=0;
  cv.addEventListener("pointerdown", e=>{ dragging=true; lastX=e.clientX; lastY=e.clientY; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointerup", ()=>{ dragging=false; });
  cv.addEventListener("pointerleave", ()=>{ dragging=false; });
  // Skift+dra panorerar (flyttar brain3d.pan, siktpunkten) i stället för att rotera --
  // användaren kan då själv centrera modellen precis som de vill, som ett komplement till
  // förvalens automatiska centrering (t.ex. Helkropp, se _brain3dWholeLookAtY). Riktningarna
  // hämtas ur kamerans EGNA höger/upp-vektorer (matrixWorld-kolonn 0/1) så att panoreringen
  // känns rätt oavsett aktuell rotation, och skalas mot avståndet så den känns proportionerlig
  // oavsett hur inzoomat man är.
  cv.addEventListener("pointermove", e=>{
    if(!dragging)return;
    const dx = e.clientX-lastX, dy = e.clientY-lastY;
    if(e.shiftKey){
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
      const scale = brain3d.dist*0.0016;
      brain3d.pan.addScaledVector(right, -dx*scale).addScaledVector(up, dy*scale);
    } else {
      brain3d.rotY += dx*0.008;
      brain3d.rotX = Math.max(-1.3,Math.min(1.3, brain3d.rotX + dy*0.008));
    }
    lastX=e.clientX; lastY=e.clientY;
    setBrain3DPreset(null);
    applyBrain3DCamera();
  });
  cv.addEventListener("wheel", e=>{
    e.preventDefault();
    brain3d.dist = Math.max(2, Math.min(32, brain3d.dist + e.deltaY*0.01));
    applyBrain3DCamera();
  }, {passive:false});

  function resize(){
    const w = cv.clientWidth||360, h = cv.clientHeight||360;
    renderer.setSize(w,h,false);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(cv);
  resize();

  // Postprocessing (SSAO + konturlinje, se brain3d-post.js) med säker reträtt -- om NÅGOT går
  // fel i det (ny, mer riskfylld kod: offscreen-mål, djup/stencil-kombinerad textur, egen
  // shader) ska appen aldrig bara visa en trasig/svart bild -- faller tyst tillbaka på vanlig
  // rendering och loggar felet en gång, i stället för att krascha renderingsloopen.
  function loop(){
    requestAnimationFrame(loop);
    if(!brain3d.active)return;
    if(brain3d.postFXEnabled){
      try{ renderBrain3DPostFX(renderer, scene, camera); return; }
      catch(e){
        console.error("brain3d: postFX-fel, faller tillbaka på vanlig rendering utan SSAO/kontur", e);
        brain3d.postFXEnabled = false;
      }
    }
    renderer.render(scene,camera);
  }
  loop();
}
function applyBrain3DCamera(){
  if(!brain3d)return;
  const {camera,rotY,rotX,dist,pan} = brain3d;
  camera.position.set(
    pan.x + dist*Math.sin(rotY)*Math.cos(rotX),
    pan.y + dist*Math.sin(rotX),
    pan.z + dist*Math.cos(rotY)*Math.cos(rotX)
  );
  camera.lookAt(pan.x,pan.y,pan.z);
}
function setBrain3DActive(v){ if(brain3d) brain3d.active = v; }
// Två visningslägen (knapp i UI:t, se brain-diagram.js):
// "toon"  -- standardläget hittills: MeshToonMaterial med några gråtonsband + normal
//            ljussättning (se ambient/key/fill), lite skuggkontrast.
// "atlas" -- försöker efterlikna Neuro/images/brain_front.png/brain_side.png: mörka konturstreck
//            runt varje struktur (outlineMesh, se processNextCategory) + mycket plattare
//            ljussättning (hög ambient, svagt riktat ljus) så ytorna läses som nästan enfärgade
//            fält snarare än skuggade 3D-former, som i en anatomibok-illustration.
function setBrain3DStyle(style){
  if(!brain3d)return;
  brain3d.style = style;
  const isAtlas = style === "atlas";
  brain3d.ambient.intensity = isAtlas ? 1.05 : 0.6;
  brain3d.key.intensity = isAtlas ? 0.2 : 0.75;
  brain3d.fill.intensity = isAtlas ? 0.12 : 0.35;
  // outlineMesh är barn till wrapper (via obj) -- döljs redan automatiskt när wrapper.visible
  // är false (t.ex. en cortex-delregion som inte är vald just nu), behöver inte spåras här.
  Object.values(brain3d.parts).forEach(part=>{
    if(part.outlineMesh) part.outlineMesh.visible = isAtlas;
  });
}
// Två färglägen (knapp i UI:t, se brain-diagram.js), oberoende av toon/atlas-stilen ovan:
// "grouped"  -- standardläget hittills: hjärnstammens tre delar (midbrain/pons/medulla) delar
//               EN gemensam färg (_brain3dGroupOf/NEURO_ATLAS_COLORS).
// "distinct" -- varje anatomisk del (utom vänster/höger-par, som fortfarande delar färg med sin
//               motsvarighet på andra sidan) får sin EGEN, tydligt urskiljbara färg --
//               midbrain/pons/medulla blir tre olika kulörer i stället för en gemensam
//               "brainstem"-färg (_brain3dGroupOfDistinct/NEURO_ATLAS_COLORS_DISTINCT). Cortex
//               räknas som EN grupp i BÅDA lägena (aldrig uppdelad i sina funktionella
//               delregioner här, se BRAIN3D_CORTEX_REGIONS).
function setBrain3DColorMode(mode){
  if(!brain3d)return;
  brain3d.colorMode = mode;
  const groupFn = mode==="distinct" ? _brain3dGroupOfDistinct : mode==="custom" ? _brain3dGroupOfCustom : _brain3dGroupOf;
  const colors = mode==="distinct" ? NEURO_ATLAS_COLORS_DISTINCT : mode==="custom" ? NEURO_ATLAS_COLORS_CUSTOM : NEURO_ATLAS_COLORS;
  Object.keys(brain3d.parts).forEach(cat=>{
    if(cat.startsWith("ctx_"))return;   // delregionerna har alltid samma "active"-röd, se setBrain3DCortexRegion
    const part = brain3d.parts[cat];
    const grp = groupFn(cat);
    part.baseColor.set(colors[grp] || colors.gray);
    // Lockens färg (se _buildStencilCaps, capColor = baseColor*0.88) beräknades bara EN gång vid
    // byggtillfället -- måste uppdateras här också, annars hamnar snittytorna kvar i det GAMLA
    // färgläget även efter att organens egen yta bytt färg.
    if(part.caps){
      const capColor = part.baseColor.clone().multiplyScalar(BRAIN3D_CAP_BRIGHTNESS);
      Object.values(part.caps).forEach(entry=>{ entry.cap.material.color.copy(capColor); });
    }
  });
  // Återapplicerar nuvarande urval (helorgan-highlight ELLER "visa alla") med de NYA
  // baseColor-värdena i stället för att duplicera den logiken här.
  setBrain3DStructureHighlight(brain3d.structureHighlight);
  if(brain3d.loaded) _updateStencilCapPositions(brain3d.clip, brain3d.parts);
}

/* ---------- Minikarta (orienteringsvy, nedre högra hörnet) ----------
   Egen liten scen/kamera/renderer, INTE bara en andra vy av huvudscenen -- den behöver rotera
   OBEROENDE av huvudkameran (samma rotY/rotX, men eget fast avstånd som passar den lilla rutan)
   och visa var snittplanen ligger oavsett hur inzoomad/panorerad huvudvyn är just nu. Återanvänder
   cortex-GEOMETRIN (samma BufferGeometry-objekt, ingen ny tolkning) som en enkel, halvgenomskinlig
   siluett -- ren kontext, inte tänkt att se detaljerad ut. */
let brain3dMini = null;
function ensureBrain3DMinimap(cv){
  if(brain3dMini || !cv || !window.THREE) return;
  const renderer = new THREE.WebGLRenderer({canvas:cv, antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  // Enbart ambient ljus (som det var innan) lyser alla ytor lika mycket oavsett vinkel mot
  // ljuset -- INGEN skuggning alls, vilket gjorde att sulci/gyri (hjärnvindlingarna) inte
  // syntes alls, bara en jämn grå klump. Riktade ljus (som huvudscenen redan har) ger den
  // kontrast som behövs för att se formen.
  scene.add(new THREE.AmbientLight(0xffffff,0.55));
  const miniKey = new THREE.DirectionalLight(0xffffff,0.9); miniKey.position.set(-3,5,4); scene.add(miniKey);
  const miniFill = new THREE.DirectionalLight(0xffffff,0.35); miniFill.position.set(3,-1,-2); scene.add(miniFill);

  const group = new THREE.Group();        // hjärnsiluetten (fylls i när cortex hunnit laddas)
  group.scale.setScalar(0.56);            // 70%, sedan ytterligare 20% mindre (0.7*0.8) -- bara i minikartan, egen scen/skala
  group.position.y = -0.8;                // 20% lägre ner i bilden
  scene.add(group);
  // planeGroup är barn till group (INTE ett eget syskon under scenen) -- ärver därmed samma
  // skala/position som hjärnsiluetten automatiskt, annars hamnar snittplanens position (som
  // sätts i RÅA, oskalade clip.value-koordinater) fel i förhållande till den förminskade/
  // nedflyttade hjärnan.
  const planeGroup = new THREE.Group();    // snittplan-indikatorer, ljusblå/halvgenomskinliga
  planeGroup.position.y = 0.6;             // 15% högre upp än hjärnan (lokal position, ärver group-skalan)
  group.add(planeGroup);
  const mkPlaneMat = ()=> new THREE.MeshBasicMaterial({
    color:0x7FB8D9, transparent:true, opacity:0.45, side:THREE.DoubleSide, depthWrite:false
  });
  // Enhetsstorlek (1x1) här -- den FAKTISKA storleken (precis stor nog för att täcka hjärnan
  // +20% marginal) sätts via .scale när cortex bounding box är känd, se silhouetteAdded nedan.
  const planes = {
    sagittal: new THREE.Mesh(new THREE.PlaneGeometry(1,1), mkPlaneMat()),
    coronal:  new THREE.Mesh(new THREE.PlaneGeometry(1,1), mkPlaneMat()),
    axial:    new THREE.Mesh(new THREE.PlaneGeometry(1,1), mkPlaneMat())
  };
  planes.sagittal.rotation.y = Math.PI/2;
  planes.axial.rotation.x = -Math.PI/2;
  Object.values(planes).forEach(p=>{ p.visible=false; p.renderOrder=1; planeGroup.add(p); });   // renderOrder>siluetten så planen syns genom den nu ogenomskinliga hjärnan

  brain3dMini = {renderer, scene, camera, group, planes, silhouetteAdded:false};

  function resize(){
    const w = cv.clientWidth||64, h = cv.clientHeight||64;
    renderer.setSize(w,h,false);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(cv);
  resize();

  function loop(){
    requestAnimationFrame(loop);
    if(!brain3d || !brain3d.active) return;
    // Lägg till hjärnsiluetten först när cortex faktiskt finns (den laddas sist, se
    // ensureBrain3D) -- minikartan fungerar (visar bara snittplanen) innan dess också.
    if(!brain3dMini.silhouetteAdded && brain3d.parts.cortex){
      const silMat = new THREE.MeshLambertMaterial({
        color:0xD9D9D9, side:THREE.DoubleSide
      });
      brain3d.parts.cortex.object.traverse(c=>{
        if(!c.isMesh)return;
        const silMesh = new THREE.Mesh(c.geometry, silMat);
        silMesh.matrixAutoUpdate = false;
        silMesh.matrix.copy(c.matrixWorld);   // hela transformkedjan från huvudscenen rakt av
        brain3dMini.group.add(silMesh);
      });
      // Snittplanen ska bara vara precis stora nog för att täcka hjärnan +20% marginal, inte
      // det godtyckligt stora 9x9-planet (som räcker för huvudvyn, där modellen är mycket
      // mindre än planet ändå). Basstorleken (1x1) skalas upp mot cortex EGNA bounding box.
      const box = new THREE.Box3().setFromObject(brain3d.parts.cortex.object);
      const span = Math.max(box.max.x-box.min.x, box.max.y-box.min.y, box.max.z-box.min.z)*1.32;
      Object.values(brain3dMini.planes).forEach(p=>p.scale.set(span,span,1));
      brain3dMini.silhouetteAdded = true;
    }
    // Fast snedställd vy (45° i sidled/vänster, 30° i höjdled, "oblik framifrån") -- följer
    // INTE huvudkamerans rotation längre. En stabil, alltid samma referensvinkel gör det
    // lättare att läsa av var snittet ligger, i stället för att minikartan snurrar med varje
    // gång man drar i huvudvyn.
    const dist = 9, miniRotY = Math.PI/4, miniRotX = Math.PI/6;
    camera.position.set(
      dist*Math.sin(miniRotY)*Math.cos(miniRotX),
      dist*Math.sin(miniRotX),
      dist*Math.cos(miniRotY)*Math.cos(miniRotX)
    );
    camera.lookAt(0,0,0);
    Object.keys(planes).forEach(axis=>{
      const c = brain3d.clip[axis];
      const pl = planes[axis];
      pl.visible = c.enabled;
      if(!c.enabled)return;
      if(axis==="sagittal") pl.position.set(c.value,0,0);
      else if(axis==="coronal") pl.position.set(0,0,c.value);
      else pl.position.set(0,c.value,0);
    });
    renderer.render(scene, camera);
  }
  loop();
}

/* ---------- "Bara locken"-vy (separat canvas till höger om huvudvyn) ----------
   Återanvänder SAMMA scengraf (brain3d.scene) som huvudvyn, med en EGEN renderer/kamera
   (egen WebGL-kontext, egen stencilbuffert) -- ingen geometri dupliceras. Kameran speglar
   huvudkamerans rotY/rotX/dist varje bildruta, men har lager 0 avstängt och BARA lager 1
   påslaget (se .layers.enable(1) i _buildStencilCaps) -- då renderas BARA locken (och deras
   osynliga stencil-skrivningar, som ändå inte ritar färg), inte bakgrundsfyllnaden
   (_buildBulkCaps, stannar på lager 0) och inte själva organen (också bara lager 0). */
let brain3dCapsView = null;
function ensureBrain3DCapsView(cv){
  if(brain3dCapsView || !cv || !window.THREE || !brain3d) return;
  const renderer = new THREE.WebGLRenderer({canvas:cv, antialias:true, alpha:true, stencil:true});
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  renderer.localClippingEnabled = true;
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  camera.layers.disableAll();
  camera.layers.enable(1);
  brain3dCapsView = {renderer, camera};

  function resize(){
    const w = cv.clientWidth||300, h = cv.clientHeight||225;
    renderer.setSize(w,h,false);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(cv);
  resize();

  function loop(){
    requestAnimationFrame(loop);
    if(!brain3d || !brain3d.active) return;
    const {rotY,rotX,dist,pan} = brain3d;
    camera.position.set(
      pan.x + dist*Math.sin(rotY)*Math.cos(rotX),
      pan.y + dist*Math.sin(rotX),
      pan.z + dist*Math.cos(rotY)*Math.cos(rotX)
    );
    camera.lookAt(pan.x,pan.y,pan.z);
    renderer.render(brain3d.scene, camera);
  }
  loop();
}

/* ---------- Kameraförval ----------
   "Framifrån"/"Från sidan" ersätter de gamla platta foton (brain_front.png/brain_side.png)
   -- SAMMA modell, bara en annan kameravinkel, så lokalisationsmarkeringarna (updateBrain3D)
   syns i alla lägen i stället för att vara låsta till två separata bilder. preset==null
   betyder "fri rotation" (sätts automatiskt när man drar manuellt, se pointermove ovan). */
const BRAIN3D_PRESETS = {
  // dist 8.6->9.5 (lite mer utzoomat som startläge) + panY 0.6 (siktpunkten lyft uppåt, vilket
  // flyttar hjärnan cirka 10% nedåt i bilden -- se camera.lookAt(pan) i applyBrain3DCamera:
  // att panorera SIKTPUNKTEN uppåt gör att kameran (som följer med, position beror också av
  // pan.y) riktas mot en högre punkt, så det faktiska (stillastående) innehållet hamnar lägre
  // i bildrutan.
  front: {rotY:0, rotX:-0.05, dist:9.5, panY:0.6},
  side:  {rotY:Math.PI/2, rotX:-0.05, dist:8.6},
  whole: {rotY:0.3, rotX:-0.1, dist:26}   // bas-dist för huvud->ryggmärg, se _brain3dWholeFraming
};
function setBrain3DPreset(key){
  if(!brain3d)return;
  brain3d.activePreset = key;
  if(key && BRAIN3D_PRESETS[key]){
    Object.assign(brain3d, BRAIN3D_PRESETS[key]);
    // "Helkropp" siktar annars (precis som Framifrån/Från sidan) mot hjärnans egen referenspunkt
    // (0,0,0) -- vid stor utzoomning betyder det att man ser huvudet nära bildens mitt och det
    // mesta av den (mycket längre) ryggmärgen långt nedanför, i stället för huvud-till-svans.
    // pan.y flyttar siktpunkten till mitten mellan hjässan och den nedersta synliga punkten. Ett
    // förval återställer alltid pan helt (X/Y/Z) -- annars hade en tidigare manuell panorering
    // (se pointermove) blivit kvar och gett en oväntad/förvirrande startposition.
    const preset = BRAIN3D_PRESETS[key];
    if(key === "whole"){
      const framing = _brain3dWholeFraming();
      brain3d.pan.set(0, framing.lookAtY, 0);
      brain3d.dist = framing.dist;
    } else {
      brain3d.pan.set(0, preset.panY||0, 0);
    }
    applyBrain3DCamera();
  }
}
// Helkropp-förvalets ram: täcker som grundläge huvud->ryggmärgens nedre ände (samma som innan
// benens nerver fanns). Om peripheral_nerves är synlig just nu (spine-knappen på, se
// setBrain3DCordVisible) sträcks nedre gränsen i stället ner till dess egen (mycket lägre)
// bottenpunkt -- annars klipps benen bort ur bilden trots "zooma ut helt".
// dist räknas ut TRIGONOMETRISKT från kamerans faktiska vertikala FOV (inte längre proportionellt
// skalat mot den gamla handjusterade dist:26 -- den siffran visade sig (mätt via
// Vector3.project(camera), se konversationen) redan själv släppa ut huvudets hjässa/ryggmärgens
// spets NÅGOT utanför synligt NDC-omr��de (y>1 resp. y<-1), bara osynligt eftersom överskottet i
// världsenheter var litet (~1.4 enheter av ett ~20-enheter-spann). Samma proportionella
// "läckage" på det MYCKET längre huvud->fot-spannet (~55 enheter) blev däremot en tydligt synlig
// avklippning vid låret/foten -- därför räknas dist nu ut med explicit marginal mot NDC-kanten
// i stället för att ärva den gamla, ej fullt validerade marginalen.
const BRAIN3D_WHOLE_MARGIN = 0.85;   // mål-NDC-y för toppen/botten (<1 = lite luft kvar i bild)
function _brain3dWholeFraming(){
  if(!brain3d || !brain3d.loaded) return {lookAtY:-6, dist:26};
  const cordBox = _brain3dWorldBox("spinalcord");
  if(!cordBox) return {lookAtY:-6, dist:26};
  const topBox = _brain3dWorldBox("cortex") || _brain3dWorldBox("corpus_callosum");
  const topY = topBox ? topBox.max.y : cordBox.max.y;
  const baseBottomY = cordBox.min.y;
  let bottomY = baseBottomY;
  const nerves = brain3d.parts.peripheral_nerves;
  if(nerves && nerves.wrapper.visible){
    const nerveBox = _brain3dWorldBox("peripheral_nerves");
    if(nerveBox) bottomY = Math.min(bottomY, nerveBox.min.y);
  }
  const lookAtY = (topY+bottomY)/2;
  // Största av de två halvorna (inte bara (topY-bottomY)/2) -- lookAtY är den geometriska
  // mittpunkten men projektionen är inte helt symmetrisk kring den pga kamerans rotX-lutning
  // (bekräftat via Vector3.project: topp gav NDC y=1.09, botten y=-1.18 vid SAMMA dist) --
  // använd den mer begränsande halvan så BÅDA ändarna garanterat ryms.
  const halfSpan = Math.max(topY-lookAtY, lookAtY-bottomY);
  const halfFovRad = (brain3d.camera.fov/2) * Math.PI/180;
  const dist = halfSpan>0 ? (halfSpan*(1/BRAIN3D_WHOLE_MARGIN)) / Math.tan(halfFovRad) : 26;
  return {lookAtY:(topY+bottomY)/2, dist};
}
function _brain3dWholeLookAtY(){
  return _brain3dWholeFraming().lookAtY;
}

/* ---------- Klippsnitt ----------
   axis: "sagittal" (vänster/höger), "coronal" (fram/bak) eller "axial" (upp/ner).
   value: slider-värde i SCEN-enheter, ungefärligt intervall -3..3 (hjärnan är ~±2 enheter
   från centrum efter skalningen ovan) -- normalen pekar mot den halva som klipps BORT. */
// Grund-normalen per axel INNAN ev. vändning (se setBrain3DClipFlip) -- den ursprungliga,
// ovända riktningen som klippsnitts-planen skapades med i ensureBrain3D.
const BRAIN3D_CLIP_BASE_NORMAL = {
  sagittal: new THREE.Vector3(1,0,0),
  coronal:  new THREE.Vector3(0,0,1),
  axial:    new THREE.Vector3(0,1,0)
};
function _brain3dApplyClipPlane(axis){
  const c = brain3d.clip[axis];
  // Alla snitt vända jämfört med den allra första versionen (den kvarvarande sidan låg fel
  // väg) -- sign inverterad så OVÄND (flip:false) nu behåller x<=value osv, och vändknappen
  // (flip:true) ger x>=value i stället.
  const sign = c.flip ? 1 : -1;
  c.plane.normal.copy(BRAIN3D_CLIP_BASE_NORMAL[axis]).multiplyScalar(sign);
  c.plane.constant = c.enabled ? -sign*c.value : 30;   // 30 = långt utanför modellen, dvs "av"
}
function setBrain3DClip(axis, enabled, value){
  if(!brain3d || !brain3d.clip[axis])return;
  const c = brain3d.clip[axis];
  c.enabled = enabled;
  if(value!==undefined) c.value = value;
  _brain3dApplyClipPlane(axis);
  _updateBulkCapPositions(brain3d.clip, brain3d.bulkCaps);
  if(brain3d.loaded){
    _updateStencilCapPositions(brain3d.clip, brain3d.parts);
    // Ventriklarnas RIKTIGA (klippta) yta -- till skillnad från de solida strukturerna --
    // visar ett synligt brusigt/prickigt mönster när den klipps: den är transparent, dubbelsidig
    // och byggd av 12 separata, delvis hoptryckta delytor (laterala ventriklar, tredje/fjärde
    // ventrikeln, aqueductus), så flera halvgenomskinliga lager hamnar i samma bildpunkt och
    // WebGL blandar dem i godtycklig (osorterad) ritordning -- ser ut som hål i vävnaden bakom
    // (fjärde ventrikeln ligger mitt i hjärnstammen). Locket (se capMat ovan) räcker inte ensamt
    // eftersom den KVARVARANDE, fortfarande klippta råytan renderas ÖVER/vid sidan av det --
    // döljer därför hela den råa ventrikelytan så fort NÅGOT snitt är aktivt; det halvgenomskinliga
    // locket vid snittplanet ger ändå en antydan om var likvorrummen ligger.
    const anyClipEnabled = Object.values(brain3d.clip).some(cc=>cc.enabled);
    const ventricles = brain3d.parts.ventricles;
    if(ventricles) ventricles.wrapper.visible = !anyClipEnabled;
  }
}
// Vänder vilken halva som behålls för en axel (t.ex. se hjärnans framsida i stället för
// baksidan vid ett koronarsnitt) -- samma snittposition, motsatt sida bortskuren.
function setBrain3DClipFlip(axis, flip){
  if(!brain3d || !brain3d.clip[axis])return;
  brain3d.clip[axis].flip = flip;
  _brain3dApplyClipPlane(axis);
  _updateBulkCapPositions(brain3d.clip, brain3d.bulkCaps);
  if(brain3d.loaded) _updateStencilCapPositions(brain3d.clip, brain3d.parts);
}

/* ---------- Nervbanor i 3D ----------
   Bygger en rörformad kurva genom de RIKTIGA (lastade) delarnas faktiska mittpunkter --
   inga hårdkodade koordinater, se kommentaren i renderBrain3DTracts. Cortex/ryggmärg finns
   bara som EN sammanhängande yta (inga per-region- eller per-sida-mesh), så kurvans
   ändpunkter där är en representativ punkt (lateral/övre del av cortex-skalet, ryggmärgens
   mittlinje vid två nivåer) -- INTE en anatomiskt exakt bana, samma pedagogiska nivå som
   den befintliga 2D-schemat i tracts.js. */
function _brain3dWorldBox(cat){
  const part = brain3d && brain3d.parts[cat];
  if(!part)return null;
  part.wrapper.updateMatrixWorld(true);
  // part.object (den RIKTIGA, synliga ytan), inte part.wrapper -- wrapper har även den
  // osynliga cap-proxyn som syskon (se applyParts), och den grovt voxelfyllda proxyn kan sticka
  // ut långt utanför den verkliga ytan om källdatan är kraftigt fragmenterad (ryggmärgen bestod
  // av 625 osammanhängande bitar innan proxyn byggdes -- gav en proxy ~3x för stor).
  // Box3.setFromObject traverserar ALLA barn oavsett .visible (bekräftat i denna three.js-
  // version) -- måste därför uteslutande konturmeshen (outlineMesh, se "Atlas-stil") för hand,
  // annars räknas dess avsiktligt 1.02x förstorade (men på RÅA, tusental-skaliga koordinater
  // applicerade) skala med och ger en kraftigt uppblåst box, precis samma bugg som gav
  // thalamus "två lila områden" i _buildStencilCaps.
  const box = new THREE.Box3();
  let found = false;
  part.object.traverse(c=>{
    if(c.isMesh && c!==part.outlineMesh){ box.expandByObject(c); found = true; }
  });
  return found ? box : new THREE.Box3().setFromObject(part.object);
}
function _brain3dWorldCenter(cat){
  const box=_brain3dWorldBox(cat); if(!box || box.isEmpty())return null;
  return box.getCenter(new THREE.Vector3());
}
function _brain3dCortexPoint(side){
  const box=_brain3dWorldBox("cortex"); if(!box)return null;
  const t = side==="L" ? 0.76 : 0.24;
  return new THREE.Vector3(
    box.min.x+(box.max.x-box.min.x)*t,
    box.min.y+(box.max.y-box.min.y)*0.88,
    box.min.z+(box.max.z-box.min.z)*0.5
  );
}
// side-argumentet är VILKEN SIDA AV RYGGMÄRGEN just den här punkten hör till (kan skilja sig
// från banans URSPRUNGLIGA sida efter en korsning, se TRACT3D_ANATOMY/buildTract3DRoute) --
// lateral offset inom märgens EGEN bredd vid den höjden (inte ett fast värde oberoende av hur
// bred/smal märgen råkar vara just där), annars kan kurvan svepa UTANFÖR märgens verkliga
// tvärsnitt i sidled -- särskilt vid Catmull-Rom-interpolationens överslag mellan en tydligt
// lateralt placerad punkt (t.ex. capsula interna) och en punkt nära märgens mittlinje.
function _brain3dCordPoint(highFrac, side){
  const box=_brain3dWorldBox("spinalcord"); if(!box)return null;
  const c=box.getCenter(new THREE.Vector3());
  const halfWidth = (box.max.x-box.min.x)/2;
  const lateral = side ? (side.toUpperCase()==="L"?1:-1) * halfWidth*0.4 : 0;
  return new THREE.Vector3(c.x+lateral, box.min.y+(box.max.y-box.min.y)*highFrac, c.z);
}
function _brain3dTractPointByName(name, side){
  const s = side.toLowerCase();
  switch(name){
    case "cortex": return _brain3dCortexPoint(side);
    case "capsule": return _brain3dWorldCenter("capsule_"+s);
    case "midbrain": return _brain3dWorldCenter("midbrain_"+s);
    case "pons": return _brain3dWorldCenter("pons_"+s);
    case "medulla": return _brain3dWorldCenter("medulla_"+s);
    case "thalamus": return _brain3dWorldCenter("thalamus_"+s);
    case "cordHigh": return _brain3dCordPoint(0.92, side);
    case "cordLow": return _brain3dCordPoint(0.15, side);
    default: return null;
  }
}
// Varje bana: "order" är den ANATOMISKA ordningen kortex<->ryggmärg (oavsett vilken riktning
// signalen faktiskt går), "crossAfter" är namnet på punkten EFTER vilken banan korsat till
// motsatt sida (decussation -- INTE en synaps, bara en sidbytes-punkt i mittlinjen, ingen
// stopp-sfär där), och "stops" är de punkter som ÄR verkliga synapser (se renderBrain3DTracts
// -- en liten röd sfär DÄR i stället för att hela organet färgas rött, som tidigare).
const TRACT3D_ANATOMY = {
  // Kortikospinalbanan: EN sammanhängande övre motorneuron-axon kortex->framhorn, ingen
  // synaps förrän framhornscellen -- korsar i pyramidbanornas nivå (nedre medulla/pyramiderna).
  corticospinal: {
    order:["cortex","capsule","midbrain","pons","medulla","cordHigh","cordLow"],
    crossAfter:"medulla", stops:["cordLow"]
  },
  // Baksträngs-mediala lemniskusbanan: synapsar FÖRST i nucleus gracilis/cuneatus (medulla,
  // samma sida som ryggmärgen), korsar direkt därefter som fibrae arcuatae internae, synapsar
  // SEDAN i talamus (motsatt sida) innan den fortsätter till cortex.
  dcml: {
    order:["cordLow","cordHigh","medulla","pons","midbrain","thalamus","capsule","cortex"],
    crossAfter:"medulla", stops:["medulla","thalamus"]
  },
  // Spinotalamiska banan: synapsar FÖRST i bakhornet (samma nivå som den går in i märgen),
  // korsar nästan direkt (commissura alba anterior, inom någon enstaka nivå), synapsar SEDAN
  // i talamus (motsatt sida) innan den fortsätter till cortex.
  spinothalamic: {
    order:["cordLow","cordHigh","medulla","pons","midbrain","thalamus","capsule","cortex"],
    crossAfter:"cordLow", stops:["cordLow","thalamus"]
  }
};
function buildTract3DRoute(side, key){
  const route = TRACT3D_ANATOMY[key];
  if(!route) return {points:[], stops:[]};
  const opposite = side==="L" ? "R" : "L";
  let crossed = false;
  const points = [], stops = [];
  route.order.forEach(name=>{
    const s = crossed ? opposite : side;
    const p = _brain3dTractPointByName(name, s);
    if(p){
      points.push(p);
      if(route.stops.includes(name)) stops.push(p);
    }
    if(name === route.crossAfter) crossed = true;
  });
  return {points, stops};
}
function renderBrain3DTracts(key){
  if(!brain3d)return;
  brain3d.tractKeys = key;
  const g = brain3d.tractGroup;
  while(g.children.length) g.remove(g.children[0]);
  if(!brain3d.loaded || !key || !TRACT3D_ANATOMY[key])return;
  const sys = typeof TRACT_SYSTEMS!=="undefined" ? TRACT_SYSTEMS[key] : null;
  const color = sys ? sys.color : "#F44336";
  ["L","R"].forEach(side=>{
    const {points, stops} = buildTract3DRoute(side, key);
    if(points.length<2)return;
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, 64, 0.045, 8, false);
    const mat = new THREE.MeshLambertMaterial({color:new THREE.Color(color), clippingPlanes:brain3d.allClipPlanes});
    g.add(new THREE.Mesh(geo, mat));
    // Stopp (verkliga synapser) -- en liten röd sfär, INTE hela organet rödmarkerat (det gjorde
    // updateBrain3D({regions}) tidigare, borttaget, se filkommentaren i tracts.js).
    stops.forEach(p=>{
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.07,12,12),
        new THREE.MeshLambertMaterial({color:0xD8473D, clippingPlanes:brain3d.allClipPlanes})
      );
      sphere.position.copy(p);
      g.add(sphere);
    });
  });
}

/* ---------- Reflexbågar (Simulator > Reflexer) ----------
   Samma waypoint-kurve-teknik som Nervbanor ovan, men en reflexbåge är en LOOP (afferent
   nerv -> omkoppling -> efferent nerv) i stället för en enkelriktad väg genom CNS, och
   korsar aldrig medellinjen (ingen av de nio reflexerna nedan gör det) -- därför en egen,
   enklare buildReflex3DRoute i stället för att återanvända buildTract3DRoute:s
   sido-växlings-logik. Egna hjälpfunktioner (_brain3dReflexPointByName m.fl.) i stället för
   att bygga ut _brain3dTractPointByName -- annat vokabulär (nervstammar/muskler/schematiska
   punkter kontra hjärnstams-/kapsel-mittpunkter), håller banornas kod okopplad från
   reflexernas. REFLEX3D_ANATOMY/REFLEX3D_NERVE_POINTS/REFLEX3D_COLOR definieras i
   reflex3d-data.js (laddas separat, men bara REFERERAS inifrån funktionskroppar här --
   de anropas först när användaren faktiskt klickar en reflex, långt efter att alla
   <script>-taggar körts, så laddningsordningen spelar ingen roll). */
// Omvandlar en spinal nivå ("C6") till samma fraktion/lateral-offset-teknik som
// cordHigh/cordLow redan använder (_brain3dCordPoint) -- återanvänder den, i stället för
// att duplicera dess "håll dig innanför märgens EGEN bredd"-logik.
function _brain3dCordLevelPoint(level, side){
  if(typeof SPINAL_LEVELS === "undefined") return null;
  const idx = SPINAL_LEVELS.indexOf(level);
  if(idx < 0) return null;
  const frac = 1 - idx/(SPINAL_LEVELS.length-1);   // C2≈1 (högt upp), S4_5≈0 (längst ner)
  return _brain3dCordPoint(frac, side);
}
// Punkter utan NÅGON anatomi i biblioteket alls (benreflexernas nerv/muskel, och de
// muskelstubbar inga reflexer har riktig muskelgeometri för) -- syntetiska, medvetet
// UTANFÖR den synliga modellen (samma anda som cordHigh/cordLow är syntetiska punkter
// inom märgens EGEN box, fast här går vi medvetet UTANFÖR, nedåt/framåt, eftersom det inte
// finns någon riktig geometri att hålla oss innanför).
function _brain3dSchematicPoint(name, side){
  const box = _brain3dWorldBox("spinalcord"); if(!box) return null;
  const lateralSign = side==="L" ? 1 : -1;
  const halfWidth = (box.max.x-box.min.x)/2;
  // Ju "längre ner" i kroppen (ben) desto längre under märgens egen box -- ordnar de tre
  // benreflex-punkttyperna (muskel/nerv/hud) på tydligt olika avstånd så kurvans tre
  // segment inte klumpar ihop sig visuellt.
  const depthByName = {
    muscle_quadriceps_schematic: 0.35, n_femoral_schematic: 0.55,
    muscle_gastroc_schematic: 0.85, n_tibial_schematic: 0.65,
    skin_sole_schematic: 1.05, muscle_edb_schematic: 1.0
  };
  const depth = depthByName[name] ?? 0.5;
  return new THREE.Vector3(
    box.getCenter(new THREE.Vector3()).x + lateralSign*halfWidth*0.6,
    box.min.y - (box.max.y-box.min.y)*depth,
    box.getCenter(new THREE.Vector3()).z
  );
}
function _brain3dReflexPointByName(name, side){
  if(name.startsWith("cord")) return _brain3dCordLevelPoint(name.slice(4), side);   // "cordC6" -> "C6"
  if(name.endsWith("_schematic")) return _brain3dSchematicPoint(name, side);
  const table = typeof REFLEX3D_NERVE_POINTS!=="undefined" ? REFLEX3D_NERVE_POINTS[name] : null;
  if(table) return table[side] ? table[side].clone() : null;
  return _brain3dTractPointByName(name, side);   // delar landmärken (pons/medulla) med Nervbanor
}
function buildReflex3DRoute(side, key){
  const r = typeof REFLEX3D_ANATOMY!=="undefined" ? REFLEX3D_ANATOMY[key] : null;
  if(!r) return null;
  const afferentPts = r.afferent.map(n => _brain3dReflexPointByName(n, side)).filter(Boolean);
  const efferentPts = r.efferent.map(n => _brain3dReflexPointByName(n, side)).filter(Boolean);
  const synapse = _brain3dReflexPointByName(r.synapse, side);
  return {afferentPts, efferentPts, synapse};
}
// Återanvänder brain3d.tractGroup (INTE en egen grupp) -- den delade NIHSS-städningen
// (renderBrain3DTracts(null), se main.js) nollställer redan tractGroup ovillkorligt, INNAN
// sitt eget "return om ingen bana vald"-villkor, så den städar transparent bort kvarvarande
// reflexrör också, så länge de bor i samma grupp. En egen grupp för reflexer hade tyst
// brutit den städningen.
function renderBrain3DReflexArc(key){
  if(!brain3d) return;
  brain3d.reflexKey = key;
  const g = brain3d.tractGroup;
  while(g.children.length) g.remove(g.children[0]);
  if(!brain3d.loaded || !key || typeof REFLEX3D_ANATOMY==="undefined" || !REFLEX3D_ANATOMY[key]) return;
  const colors = typeof REFLEX3D_COLOR!=="undefined" ? REFLEX3D_COLOR : {afferent:"#2C7DA0", efferent:"#D8473D"};
  ["L","R"].forEach(side=>{
    const route = buildReflex3DRoute(side, key);
    if(!route) return;
    [["afferentPts","afferent"], ["efferentPts","efferent"]].forEach(([ptsKey, colorKey])=>{
      const pts = route[ptsKey];
      if(pts.length < 2) return;
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, 48, 0.04, 8, false);
      const mat = new THREE.MeshLambertMaterial({color:new THREE.Color(colors[colorKey]), clippingPlanes:brain3d.allClipPlanes});
      g.add(new THREE.Mesh(geo, mat));
    });
    if(route.synapse){
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.07,12,12),
        new THREE.MeshLambertMaterial({color:0xD8473D, clippingPlanes:brain3d.allClipPlanes})
      );
      sphere.position.copy(route.synapse);
      g.add(sphere);
    }
  });
}

// Cortexskalet är bara till för genomskinlig kontext (var sitter djupet i förhållande till
// ytan) -- det ska ALDRIG gråas ut eller rödmarkeras av highlight-logiken nedan (det finns
// ju ingen "cortex-region" att markera, se filkommentaren om vad som saknas i biblioteken).
// Egen på/av-knapp i UI:t, defaultar till synlig eftersom det var precis det som efterfrågades.
// Cortex/ryggmärg är ALLTID synliga nu (aldrig helt dolda) -- kryssrutan växlar i stället
// mellan en genomskinlig "spök"-nivå (av) och full, ogenomskinlig färg (på), så man alltid har
// den yttre konturen som referens men kan välja om den ska skymma det som ligger innanför.
const BRAIN3D_GHOST_OPACITY = {cortex:0.16, spinalcord:0.25};
function _brain3dSetGhostOpaque(cat, opaque){
  if(!brain3d || !brain3d.parts[cat])return;
  brain3d.ghostState = brain3d.ghostState || {};
  brain3d.ghostState[cat] = opaque;   // kom ihåg valet, så setBrain3DStructureHighlight kan återställa rätt läge (inte bara "alltid genomskinlig")
  const part = brain3d.parts[cat];
  part.wrapper.visible = true;
  const mat = part.material;
  mat.opacity = opaque ? 1 : (BRAIN3D_GHOST_OPACITY[cat] ?? 0.3);
  mat.transparent = !opaque;
  mat.depthWrite = opaque;
}
function setBrain3DCortexVisible(v){
  _brain3dSetGhostOpaque("cortex", v);
}
// Motsvarande av/på för ryggmärgen -- genomskinlig som default i NIHSS-vyn (den bryr sig om
// hjärnstrukturer, en helt ogenomskinlig märg bara skymmer/sträcker ut ramen i onödan där),
// ogenomskinlig som default i Nervbanor (där är hela poängen att se var banan fortsätter ner).
function setBrain3DCordVisible(v){
  _brain3dSetGhostOpaque("spinalcord", v);
  // Kotpelaren (grå, ALLTID halvgenomskinlig kontext runt kanalen, se BRAIN3D_CAP_SKIP-
  // kommentaren) följer samma knapp som ryggmärgen för SYNLIGHET (visas/döljs ihop, ett extra
  // UI-val hade bara varit brus) men byter aldrig till ogenomskinlig -- den är bara kontext.
  if(brain3d && brain3d.parts.vertebrae) brain3d.parts.vertebrae.wrapper.visible = v;
  // Perifera nerverna (kranialnerver + cervikal-/brachialplexus, se Models/Peripheral Nervous
  // System/) är INTE en egen klickbar struktur -- inget knapp i #brain3dStructs, ingen egen
  // urvalslogik -- bara ren kontext som följer SAMMA på/av-knapp som ryggmärgen/kotpelaren,
  // av exakt samma skäl (se kommentaren ovan om kotpelaren).
  if(brain3d && brain3d.parts.peripheral_nerves) brain3d.parts.peripheral_nerves.wrapper.visible = v;
}
// "Visa EN struktur" -- valfri knapp per anatomisk grupp (samma grupper som NEURO_ATLAS_COLORS/
// _brain3dGroupOf). Vald grupp: röd och helt ogenomskinlig. Alla andra: sin egen färg men
// mycket genomskinliga (kontext/silhuett). groupKey===null återställer allt till normalt
// utseende (respekterar cortex/ryggmärgens EGNA på/av-läge, se brain3d.ghostState).
function _brain3dNormalOpacity(cat){
  if(cat==="ventricles") return {opacity:0.55, transparent:true, depthWrite:false};
  if(cat==="vertebrae") return {opacity:0.35, transparent:true, depthWrite:false};
  if(cat==="peripheral_nerves") return {opacity:1, transparent:false, depthWrite:true};
  if(cat==="cortex" || cat==="spinalcord"){
    const opaque = brain3d.ghostState && brain3d.ghostState[cat];
    return opaque ? {opacity:1, transparent:false, depthWrite:true}
                  : {opacity:BRAIN3D_GHOST_OPACITY[cat]??0.3, transparent:true, depthWrite:false};
  }
  return {opacity:1, transparent:false, depthWrite:true};
}
function setBrain3DStructureHighlight(groupKey){
  if(!brain3d)return;
  // De två urvalssystemen (helt organ rött / EN cortex-delregion röd) är avsiktligt
  // ömsesidigt uteslutande -- annars kan man hamna i ett förvirrande blandtillstånd (t.ex.
  // capsula röd OCH motorisk cortex röd samtidigt). Att välja ett nollställer det andra.
  // (Rensar cortexRegion-läget DIREKT här, i stället för att anropa setBrain3DCortexRegion --
  // annars skulle de två funktionerna kunna anropa varandra i en oändlig loop.)
  if(brain3d.cortexRegion){
    BRAIN3D_CORTEX_REGIONS.forEach(cat=>{ const p=brain3d.parts[cat]; if(p) p.wrapper.visible=false; });
    if(brain3d.parts.cortex) brain3d.parts.cortex.wrapper.visible = true;
    brain3d.cortexRegion = null;
  }
  brain3d.structureHighlight = groupKey;
  Object.keys(brain3d.parts).forEach(cat=>{
    if(cat.startsWith("ctx_"))return;   // egen, separat urvalslogik -- se setBrain3DCortexRegion
    const part = brain3d.parts[cat];
    const mat = part.material;
    const isVent = cat === "ventricles";
    if(!groupKey){
      mat.color.copy(part.baseColor);
      Object.assign(mat, _brain3dNormalOpacity(cat));
      // Locket ska tillbaka till sitt EGNA normala utseende (ventriklarna är alltid
      // halvgenomskinliga, se isVentricles i _buildStencilCaps) -- inte bara färgen.
      // transparent FÅR ALDRIG bli true här (även för ventriklarna) -- se den långa
      // kommentaren i _buildStencilCaps om varför (stencil-bläckning mellan strukturer).
      if(part.caps){
        const capColor = part.baseColor.clone().multiplyScalar(BRAIN3D_CAP_BRIGHTNESS);
        Object.values(part.caps).forEach(entry=>{
          entry.cap.material.color.copy(capColor);
          entry.cap.material.opacity = isVent ? 0.55 : 1;
          entry.cap.material.depthWrite = !isVent;
        });
      }
      return;
    }
    const isSelected = _brain3dGroupOf(cat) === groupKey;
    if(isSelected){
      mat.color.set(NEURO_ATLAS_COLORS.active);
      mat.opacity = 1; mat.transparent = false; mat.depthWrite = true;
      // Locket (snittytan) ska matcha -- annars förblir det i den gamla, ej urvalda färgen
      // trots att organets egen yta lyser röd, vilket ser ut som att organet är "halvvalt".
      // Ventriklarnas lock förblir dock halvgenomskinligt (0.55/0.78) ÄVEN när valt -- deras
      // capproxy (voxelfyllning, se Neuro/models/brain/capproxy/ventricles.js) är medvetet
      // grov/överdimensionerad jämfört med de tunna verkliga ventrikelväggarna (annars gav
      // den råa ytan brusiga "hål", se kommentaren om isVentricles ovan) -- det var bara
      // OK att se ut lite för stort/oprecist SÅ LÄNGE det var subtilt genomskinligt. Att
      // tvinga fullt opakt rött gjorde denna redan-approximerade form plötsligt till en
      // skarp, till synes exakt (men FEL, alldeles för stor) röd klump som täckte talamus/
      // basala ganglier/hjärnstammen (upptäckt: användaren valde Ventriklar och såg detta).
      if(part.caps){
        Object.values(part.caps).forEach(entry=>{
          entry.cap.material.color.set(NEURO_ATLAS_COLORS.active);
          if(isVent){
            entry.cap.material.opacity = 0.78; entry.cap.material.depthWrite = false;
          } else {
            entry.cap.material.opacity = 1; entry.cap.material.depthWrite = true;
          }
        });
      }
    } else {
      mat.color.copy(part.baseColor);
      mat.opacity = 0.1; mat.transparent = true; mat.depthWrite = false;
      // Locket måste OCKSÅ tona ner -- annars förblir andra strukturers (alltid fullt
      // opaka, depthWrite:true) snittytor synliga och kan i djupled skymma en vald grannes
      // (t.ex. den lilla 4:e ventrikeln, som ligger MITT I hjärnstammen) lock helt, trots
      // att organen själva korrekt tonats ner -- läste ut som "ventriklarna visar ingenting"
      // och "ryggmärgsval visar hjärnstammen kvar" (upptäckt: användaren valde Ventriklar
      // och Ryggmärg, se konversationen).
      //
      // VIKTIGT: locket (INKLUSIVE ventriklarnas) FÅR ALDRIG bli transparent:true här --
      // Three.js sorterar transparent:true-objekt i en helt SEPARAT kö som ritas EFTER hela
      // den opaka kön, oavsett renderOrder. Hela stencil-kapningstekniken bygger på att varje
      // strukturs skriv->testa->nolla-cykel körs i EXAKT rätt inbördes ordning (se de långa
      // kommentarerna i _buildStencilCaps om renderOrder-intervall) -- att dra ut EN strukturs
      // lock ur den opaka kön gjorde att ALLA strukturers stencil-SKRIVNINGAR (fortfarande
      // opaka) hann köras FÖRE något av de nu transparenta lockens test/nollställning, så
      // överlappande grannars skrivningar ackumulerades i samma stencil-celler -- antingen
      // som en UNION av flera strukturers yta i stället för bara sin egen (upptäckt: att välja
      // Ventriklar/Ryggmärg visade en jättelik röd klump formad som talamus+basala ganglier+
      // hjärnstammen tillsammans), ELLER (ventriklarnas eget lock, det ENDA transparent:true-
      // locket i hela scenen) att DESS EGEN nollställning sköts upp till efter ALLA andra
      // strukturers cykler -- så en SENARE kategori (ryggmärg, kotpelare, cortex) kunde läsa
      // ventriklarnas kvarliggande, ej ännu nollställda bit som sin egen och blöda in i FEL
      // område, medan ventrikellocket självt (vars test också kom sist) aldrig såg något kvar
      // att testa mot och visade INGENTING (upptäckt: användaren rapporterade exakt detta --
      // "ryggmärg" tände röda fläckar vid talamus, "ventriklar" visade ingenting alls).
      // opacity/blending ger fortfarande genomskinlighet (three.js styr blend-status via
      // `blending`, inte `transparent`), så utseendet är oförändrat.
      if(part.caps){
        if(isVent){
          const capColor = part.baseColor.clone().multiplyScalar(BRAIN3D_CAP_BRIGHTNESS);
          Object.values(part.caps).forEach(entry=>{
            entry.cap.material.color.copy(capColor);
            entry.cap.material.opacity = 0.1;
            entry.cap.material.depthWrite = false;
          });
        } else {
          const capColor = part.baseColor.clone().multiplyScalar(BRAIN3D_CAP_BRIGHTNESS).lerp(new THREE.Color(0xffffff), 0.72);
          Object.values(part.caps).forEach(entry=>{
            entry.cap.material.color.copy(capColor);
            entry.cap.material.opacity = 1;
            entry.cap.material.transparent = false;
            entry.cap.material.depthWrite = true;
          });
        }
      }
    }
  });
}
// Cortex-delregioner (motorisk cortex, Brocas område osv, se BRAIN3D_CORTEX_REGIONS) -- helt
// separat från helorgan-highlighten ovan: regionerna delar geometri med cortex-skalet (samma
// gyrus-ytor, se merge-scriptet), så för att undvika att en opak röd yta och den halvgenomskinliga
// spökytan tävlar om exakt samma pixlar (z-fighting) döljs cortex-skalet helt medan en
// delregion visas, i stället för att lägga dem ovanpå varandra.
function setBrain3DCortexRegion(regionKey){
  if(!brain3d)return;
  if(brain3d.structureHighlight){
    Object.keys(brain3d.parts).forEach(cat=>{
      if(cat.startsWith("ctx_"))return;
      const part = brain3d.parts[cat];
      part.material.color.copy(part.baseColor);
      Object.assign(part.material, _brain3dNormalOpacity(cat));
    });
    brain3d.structureHighlight = null;
  }
  brain3d.cortexRegion = regionKey;
  BRAIN3D_CORTEX_REGIONS.forEach(cat=>{
    const part = brain3d.parts[cat];
    if(part) part.wrapper.visible = (cat === regionKey);
  });
  if(brain3d.parts.cortex) brain3d.parts.cortex.wrapper.visible = !regionKey;
}

// highlight: {region, side} (NIHSS -- en enda REGION_MARKERS-sträng) ELLER {regions:[...],
// side} (Nervbanor -- flera regioner samtidigt, t.ex. kortikospinalbanans capsule+brainstem)
// eller null för att visa allt i normal färg. side "L"/"R"/null (null = båda sidor lyser
// upp, som när candidate.side saknas i NIHSS-datan, eller för banor som inte är sidospecifika).
function updateBrain3D(highlight){
  if(!brain3d)return;
  brain3d.highlight = highlight;
  if(!brain3d.loaded)return;
  const regionKeys = highlight ? (highlight.regions || (highlight.region?[highlight.region]:[])) : [];
  const activeCats = regionKeys.length ? regionKeys.flatMap(r=>BRAIN3D_REGION_PARTS[r]||[]) : null;
  BRAIN3D_CATEGORIES.forEach(cat=>{
    if(cat==="cortex"||cat.startsWith("ctx_"))return;
    const part = brain3d.parts[cat];
    if(!part)return;
    if(!activeCats){ part.material.color.copy(part.baseColor); return; }
    const inRegion = activeCats.includes(cat);
    const sideOk = !highlight.side || cat.endsWith("_"+highlight.side.toLowerCase());
    if(inRegion && sideOk){
      part.material.color.set(NEURO_ATLAS_COLORS.active);
    } else if(inRegion){
      // fel sida av rätt struktur -- svagt markerad, inte helt bortgråad
      part.material.color.copy(part.baseColor).lerp(new THREE.Color(NEURO_ATLAS_COLORS.active), 0.25);
    } else {
      const hsl={}; part.baseColor.getHSL(hsl);
      part.material.color.setHSL(hsl.h, hsl.s*0.12, Math.min(0.9, hsl.l*0.9+0.25));
    }
  });
}
