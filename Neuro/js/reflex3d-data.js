/* ---------- Reflexbågar i 3D: datamodell ----------
   Kliniska namn/nivåer/beskrivningar kommer från den BEFINTLIGA REFLEXES-listan
   (reflex-data.js, redan använd av dermatome-diagram.js för en 2D-vy) -- dupliceras INTE
   här, bara ett urval (REFLEX3D_IDS) av vilka som får en 3D-representation.
   REFLEX3D_ANATOMY beskriver varje reflex som en LOOP: afferent (sensorisk) väg fram till
   en omkopplingspunkt (synapse), sedan efferent (motorisk) väg tillbaka -- till skillnad
   från Nervbanor (TRACT3D_ANATOMY i brain3d.js), som beskriver en enkelriktad väg genom
   CNS. Waypoint-namn som börjar med "cord" (t.ex. "cordC6") slås upp mot en spinal nivå via
   _brain3dCordLevelPoint; namn som slutar på "_schematic" har INGEN riktig anatomi i
   biblioteket (kollat: inga ben-nerver finns i någon källbibliotek) och placeras syntetiskt
   under/utanför den synliga modellen, se _brain3dSchematicPoint i brain3d.js. Övriga namn
   slås upp i REFLEX3D_NERVE_POINTS nedan -- handplacerade approximativa världskoordinater
   (kalibrerade mot faktiska landmärkens världsposition, t.ex. capsula ~(0.6,1.2,0.7),
   ryggmärgen Y-spann ~-1.4 till -16.8 -- se konversationen), eftersom perifera nerverna
   (peripheral_nerves.js) är EN sammanslagen, icke-adresserbar yta utan att man tolkar om
   källdatan (inte gjort här, bara ~8 specifika nervnamn behövs av 88). */
const REFLEX3D_IDS = ["biceps","brachioradialis","triceps","patellar","achilles","plantar","corneal","jawjerk","gag"];

const REFLEX3D_ANATOMY = {
  biceps: {
    afferent:["muscle_biceps","n_musculocutaneous"], synapse:"cordC6",
    efferent:["n_musculocutaneous","muscle_biceps"]
  },
  brachioradialis: {
    afferent:["muscle_brachioradialis","n_radial"], synapse:"cordC6",
    efferent:["n_radial","muscle_brachioradialis"]
  },
  triceps: {
    afferent:["muscle_triceps","n_radial"], synapse:"cordC7",
    efferent:["n_radial","muscle_triceps"]
  },
  patellar: {
    afferent:["muscle_quadriceps_schematic","n_femoral_schematic"], synapse:"cordL4",
    efferent:["n_femoral_schematic","muscle_quadriceps_schematic"], schematic:true
  },
  achilles: {
    afferent:["muscle_gastroc_schematic","n_tibial_schematic"], synapse:"cordS1",
    efferent:["n_tibial_schematic","muscle_gastroc_schematic"], schematic:true
  },
  plantar: {
    afferent:["skin_sole_schematic","n_tibial_schematic"], synapse:"cordS1",
    efferent:["n_tibial_schematic","muscle_edb_schematic"], schematic:true
  },
  corneal: {
    afferent:["cornea_schematic","n_trigeminal_v1"], synapse:"pons",
    efferent:["n_facial_vii","muscle_orbicularis_oculi_schematic"]
  },
  jawjerk: {
    afferent:["muscle_masseter_schematic","n_trigeminal_v3"], synapse:"pons",
    efferent:["n_trigeminal_v3","muscle_masseter_schematic"]
  },
  gag: {
    afferent:["pharynx_schematic","n_glossopharyngeal_ix"], synapse:"medulla",
    efferent:["n_vagus_x","pharynx_schematic"]
  }
};

const REFLEX3D_COLOR = {afferent:"#2C7DA0", efferent:"#D8473D"};   // afferent=blå (sensorisk), efferent=röd (samma som synaps-punkten)

// {L: Vector3, R: Vector3} per nervstam/muskel -- byggs lazy (Vector3 kräver att THREE finns,
// vilket det gör vid uppstart eftersom lib/three.min.js laddas långt före denna fil, men
// göms ändå bakom en funktion för tydlighetens skull i stället för toplevel-kod).
let _REFLEX3D_NERVE_POINTS_CACHE = null;
function _buildReflex3DNervePoints(){
  const V = (x,y,z) => new THREE.Vector3(x,y,z);
  // Armreflexer -- plexus brachialis-nivå ligger runt cervikala märgens övre del
  // (~Y -2 till -5, se cordC6/cordC7 i konversationen), nerv-/muskelpunkterna extenderar
  // lateralt (X) och något framåt/nedåt för att representera axel->arm, utanför den
  // faktiska modellen (inga arm-/muskelnät i biblioteket).
  const armL = {
    n_musculocutaneous: V(1.8, -3.2, -0.3),
    muscle_biceps:      V(3.2, -4.0, 0.2),
    n_radial:           V(1.9, -3.4, -0.6),
    muscle_triceps:     V(3.0, -4.3, -0.8),
    muscle_brachioradialis: V(3.6, -5.5, 0.0)
  };
  // Kranialnervsreflexer -- små offsets från pons/medulla mot där ansiktet/käken/svalget
  // ungefärligen ligger (framåt/+Z, en aning lateralt) -- ingen ansikts-/svalggeometri i
  // biblioteket, så dessa är lika schematiska i princip som benreflexerna, fast mindre
  // magnitud (närmare hjärnstammen än vad ben-punkterna är från ryggmärgen).
  const cranialL = {
    n_trigeminal_v1: V(0.55, 0.15, 1.35),
    n_trigeminal_v3: V(1.15, -0.55, 0.95),
    n_facial_vii:    V(0.9, -0.3, -0.1),
    n_glossopharyngeal_ix: V(0.7, -1.25, 0.05),
    n_vagus_x:       V(0.78, -1.4, -0.2),
    cornea_schematic: V(0.5, 0.3, 1.6),
    muscle_orbicularis_oculi_schematic: V(0.5, 0.25, 1.55),
    muscle_masseter_schematic: V(1.2, -0.6, 1.0)
  };
  const points = {};
  Object.keys(armL).forEach(k=>{ const p = armL[k]; points[k] = {L:p, R:V(-p.x,p.y,p.z)}; });
  Object.keys(cranialL).forEach(k=>{ const p = cranialL[k]; points[k] = {L:p, R:V(-p.x,p.y,p.z)}; });
  // Farynx ligger nära medellinjen -- liten lateral offset per sida räcker för att banans
  // två sidor (vänster/höger) inte helt ska sammanfalla visuellt.
  points.pharynx_schematic = {L:V(0.25,-1.55,0.55), R:V(-0.25,-1.55,0.55)};
  return points;
}
Object.defineProperty(window, "REFLEX3D_NERVE_POINTS", {
  get(){
    if(!_REFLEX3D_NERVE_POINTS_CACHE) _REFLEX3D_NERVE_POINTS_CACHE = _buildReflex3DNervePoints();
    return _REFLEX3D_NERVE_POINTS_CACHE;
  }
});
