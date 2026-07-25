/* ---------- Kropps-atlas 3D: konstanter och metadata ----------
   Delar SAMMA råa koordinatrymd (BodyParts3D mm, före skalning) och centrerings-/rotations-
   konstanter som Neuro/js/brain3d.js -- hjärn-/ryggmärgsfilerna är bokstavligen KOPIERADE
   därifrån (samma embedded OBJ-text), och skelett/muskel/nerv/kärl-datan (Open3DModel/
   anatomytool.org, se konversationen) är kalibrerad till SAMMA rymd (matchning av sacrum/L5
   mellan de två källorna, se merge-scriptet) -- så en enda gemensam CENTER/SCALE/ROTATION
   räcker för att allt ska hamna rätt i förhållande till varandra utan extra justering. */
const BODY3D_CENTER = new THREE.Vector3(-0.66, -71.61515, 1523.88);
const BODY3D_SCALE = 0.034;
const BODY3D_ROTATION = new THREE.Euler(-Math.PI/2, 0, Math.PI);
const BODY3D_YAW_FIX = Math.PI;

// Var models/body/-filerna hämtas ifrån -- kan sättas på window INNAN denna fil laddas (se
// Procedurtraning/index.html, som pekar den mot "../Kroppsatlas/models/body/" eftersom den
// modulen återanvänder Kropps-atlas modelldata i stället för att kopiera ~185MB). Kropps-atlas
// själv sätter aldrig window.BODY3D_MODELS_BASE, så den fortsätter använda sin egen relativa
// "models/body/" precis som innan.
const BODY3D_MODELS_BASE = window.BODY3D_MODELS_BASE || "models/body/";

// De ~20 hjärn-/ryggmärgskategorierna, återanvända as-is (window.BRAIN3D_OBJ, inte
// window.BODY3D_OBJ -- filerna är okopierade kopior av Neuro-modulens egna, se
// Kroppsatlas/models/body/brain/). region:"axial" för spinalcord (löper genom hela
// ryggraden), annars "head_neck".
const BODY3D_BRAIN_CATEGORIES = [
  {cat:"cortex", region:"head_neck"},
  {cat:"corpus_callosum", region:"head_neck"},
  {cat:"white_matter", region:"head_neck"},
  {cat:"ventricles", region:"head_neck"},
  {cat:"thalamus_l", region:"head_neck"}, {cat:"thalamus_r", region:"head_neck"},
  {cat:"basalganglia_l", region:"head_neck"}, {cat:"basalganglia_r", region:"head_neck"},
  {cat:"capsule_l", region:"head_neck"}, {cat:"capsule_r", region:"head_neck"},
  {cat:"midbrain_l", region:"head_neck"}, {cat:"midbrain_r", region:"head_neck"},
  {cat:"pons_l", region:"head_neck"}, {cat:"pons_r", region:"head_neck"},
  {cat:"medulla_l", region:"head_neck"}, {cat:"medulla_r", region:"head_neck"},
  {cat:"cerebellum_l", region:"head_neck"}, {cat:"cerebellum_r", region:"head_neck"},
  {cat:"cerebellum_vermis", region:"head_neck"},
  {cat:"spinalcord", region:"axial", label:"Ryggmärg"},
  {cat:"cauda_equina", region:"axial", label:"Cauda equina"}
];

// organ/skin: BodyParts3D 4.0 (samma källa och rymd som brain-kategorierna, alltså RAKT AV
// utan Open3DModel-kalibreringen) -- se Kroppsatlas/models/body/organ.js/skin.js och
// konversationen (användaren bad att kolla Models/BodyParts_3d efter det Open3DModel saknar:
// bål-organ, hud). Egna system (inte del av "brain"-pseudogruppen) eftersom de laddas/parsas
// som VANLIGA BODY3D_OBJ-filer med "o "-rader kvar (individuellt adresserbara, till skillnad
// från hjärnfilernas ett-mesh-per-fil-konvention) -- går genom samma kodväg som skelett/
// muskler/nerver/kärl/ledband i body3d.js, inga motorändringar behövda.
const BODY3D_SYSTEMS = ["brain","skeletal","muscular","nervous","vascular","connective","organ","female_pelvis","skin"];

const BODY3D_SYSTEM_LABEL = {
  brain: "Hjärna & ryggmärg", skeletal: "Skelett", muscular: "Muskler",
  nervous: "Nerver", vascular: "Kärl", connective: "Ledband/bindväv",
  organ: "Inre organ", female_pelvis: "Kvinnligt bäcken", skin: "Hud"
};
// Standardpalett per system -- kärl särskiljs artär(röd)/ven(blå) via namnkontroll i body3d.js
// (samma _isVein-heuristik som används vid färgsättning), övriga system: en färg räcker.
const BODY3D_SYSTEM_COLOR = {
  brain: "#C98F84",
  skeletal: "#EDE6D3",
  muscular: "#B23A2E",
  nervous: "#E8C744",
  vascular_artery: "#C0392B",
  vascular_vein: "#3B6FA0",
  connective: "#8FB8C9",
  organ: "#C9776B",
  female_pelvis: "#D98CA3",
  skin: "#E8C9A8"
};
// Per-kategori nyanser inom "brain"-pseudo-systemet, återanvänt rakt av från Neuro/js/
// brain3d.js:s NEURO_ATLAS_COLORS -- samma visuella språk mellan modulerna.
const BODY3D_BRAIN_COLOR = {
  thalamus:"#B79FDB", basalganglia:"#D4B483", capsule:"#F2ECDD",
  midbrain:"#E8A69A", pons:"#E8A69A", medulla:"#E8A69A", cerebellum:"#9FC1D9",
  corpus_callosum:"#F0DFA8", white_matter:"#F5F1E6", ventricles:"#7FB8E0",
  cortex:"#EDE0C9", spinalcord:"#E0B37D", cauda_equina:"#E8C744"
};
function _body3dBrainColorFor(cat){
  const base = cat.replace(/_l$|_r$/,"").replace(/_vermis$/,"");
  return BODY3D_BRAIN_COLOR[base] || BODY3D_BRAIN_COLOR[cat] || BODY3D_SYSTEM_COLOR.brain;
}
// Vilka system laddas/visas som DEFAULT (resten laddas lazy första gången de slås på, se
// setBody3DSystemVisible i body3d.js) -- skelett+hjärna/ryggmärg ger en meningsfull "helkropp"
// direkt utan att tvinga fram en flera-tiotals-MB-laddning av alla mjukdelar på en gång.
const BODY3D_DEFAULT_ON = {brain:true, skeletal:true, muscular:false, nervous:false, vascular:false, connective:false, organ:false, female_pelvis:false, skin:false};

// HRA v1.2-data laddas lazy som ett eget system. Bäcken-GLB:n används bara som
// kalibreringsreferens i tools/build_hra_female_pelvis.js; atlasens befintliga höftben,
// sacrum och coccyx visas i stället för ett överlappande andra bäckenskelett.
const BODY3D_FEMALE_PELVIS_PARTS = [
  {name:"Uterus", label:"Livmoder", system:"female_pelvis", region:"axial", side:"mid", color:"#D7839B"},
  {name:"Ovary.l", label:"Vänster äggstock", system:"female_pelvis", region:"axial", side:"l", color:"#E8A6B8"},
  {name:"Ovary.r", label:"Höger äggstock", system:"female_pelvis", region:"axial", side:"r", color:"#E8A6B8"},
  {name:"Fallopian_tube.l", label:"Vänster äggledare", system:"female_pelvis", region:"axial", side:"l", color:"#D7839B"},
  {name:"Fallopian_tube.r", label:"Höger äggledare", system:"female_pelvis", region:"axial", side:"r", color:"#D7839B"},
  {name:"Urinary_bladder", label:"Urinblåsa (kvinnlig)", system:"female_pelvis", region:"axial", side:"mid", color:"#D8B45B"},
  {name:"Ureter.l", label:"Vänster uretär", system:"female_pelvis", region:"axial", side:"l", color:"#E0C979"},
  {name:"Ureter.r", label:"Höger uretär", system:"female_pelvis", region:"axial", side:"r", color:"#E0C979"},
  {name:"Vagina", label:"Vagina", system:"female_pelvis", region:"axial", side:"mid", color:"#C97D99"},
  {name:"Ligaments_uterus_ovaries", label:"Livmoderns och äggstockarnas ligament", system:"female_pelvis", region:"axial", side:"mid", color:"#E4CDB3"},
  {name:"Blood_vasculature_uterus", label:"Livmoderns blodkärl", system:"female_pelvis", region:"axial", side:"mid", color:"#C84A55"}
];

const BODY3D_REGION_LABEL = {
  all: "Alla regioner", head_neck: "Huvud & hals", axial: "Bål & rygg",
  upper_limb: "Arm & hand", lower_limb: "Ben & fot"
};
const BODY3D_REGIONS_ORDER = ["all","head_neck","axial","upper_limb","lower_limb"];

const BODY3D_PRESETS = {
  front: {rotY:0, rotX:0},
  back:  {rotY:Math.PI, rotX:0},
  left:  {rotY:-Math.PI/2, rotX:0},
  right: {rotY:Math.PI/2, rotX:0}
};
