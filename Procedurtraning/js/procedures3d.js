/* ---------- Procedurträning: 3D-koppling ----------
   Egna hjälpfunktioner (inte en förlängning av Neuro/js/brain3d.js:s _brain3dSchematicPoint)
   eftersom vokabulären är helt annan (bendjup/insticksvinkel, inte hjärnstams-/kapselnivåer)
   -- håller koden okopplad, samma designval som brain3d.js redan gjorde mellan Nervbanor och
   Reflexer (se dess filkommentar). Bygger på de generiska _body3dWorldBox/body3dAddOverlay-
   Marker/_body3dAnimateIncision-funktionerna i Kroppsatlas/js/body3d.js -- inget av det är
   dubblerat här. */

const BODY3D_SCHEMATIC_POINTS = {
  // Tuberositas tibiae har ingen egen mesh (bara del av hela Tibia-benets geometri, se
  // planfilens gap-analys) -- en punkt inom benets EGEN box, i stället för en fri koordinat:
  // ~8% nedanför den proximala (knä-)änden, mot den mediala/främre ytan. "Medial" beror på
  // sida: höger ben ligger i negativ-X-territorium (samma vänster/höger-konvention som redan
  // etablerades vid lung-/organkalibreringen denna session -- positiv X = anatomiskt vänster),
  // så mitten-nära (medialt) för höger ben är den STÖRRE (mindre negativa) x-änden av benets
  // egen box -- samma fraktions-inom-egen-box-teknik som _brain3dCordPoint redan använder.
  tibial_tuberosity(side){
    const box = _body3dWorldBox("Tibia." + side);
    if(!box) return null;
    const y = box.max.y - (box.max.y - box.min.y) * 0.08;
    const medialX = side === "r" ? box.max.x : box.min.x;
    const lateralX = side === "r" ? box.min.x : box.max.x;
    const x = medialX * 0.7 + lateralX * 0.3;
    const z = box.min.z * 0.3 + box.max.z * 0.7;   // mot den främre (anteriora) ytan
    return new THREE.Vector3(x, y, z);
  },
  // Sternocleidomastoideus har ingen egen mesh i något bibliotek (bekräftat, se planfilens
  // gap-analys) -- ritas som ett schematiskt BAND (två punkter, blir ett rör i stället för
  // en sfär, se body3dAddOverlayMarker) mellan dess två verkliga fästen: nyckelbenets mediala
  // (sternala) ände nedtill, och halsvenens övre (kraniala) ände upptill -- en ungefärlig men
  // rimlig proxy för var muskelns förlopp faktiskt ligger, eftersom varken origo (sternum/
  // klavikel) eller insertio (processus mastoideus, ingen egen mesh) finns som egen punkt.
  sternocleidomastoid(side){
    const clav = _body3dWorldBox("Clavicle." + side);
    const ijv = _body3dWorldBox("Internal_jugular_vein." + side);
    if(!clav || !ijv) return null;
    const clavMedialX = side === "r" ? clav.max.x : clav.min.x;
    const lower = new THREE.Vector3(
      clavMedialX, clav.getCenter(new THREE.Vector3()).y, clav.max.z
    );
    const upper = new THREE.Vector3(
      ijv.getCenter(new THREE.Vector3()).x, ijv.getCenter(new THREE.Vector3()).y, ijv.max.z
    );
    return [lower, upper];
  }
};

// Namn har formen "bas_schematic" eller "bas_schematic.l"/".r" -- samma "_schematic"-suffix-
// konvention som reflex3d-data.js redan etablerat, återanvänd rakt av (inte omfunnen).
// Returnerar alltid en ARRAY av punkter (längd 1 för enkla punkter/riktiga landmärken, längd
// 2+ för scheman-BAND som sternocleidomastoid ovan) -- body3dAddOverlayMarker ritar redan en
// sfär vid längd 1 och ett rör annars, så ingen extra gren behövs vid anropsstället.
function _procedure3dPointsFor(name){
  const m = name.match(/^(.+)_schematic(?:\.(l|r))?$/);
  if(m){
    const fn = BODY3D_SCHEMATIC_POINTS[m[1]];
    const result = fn ? fn(m[2] || null) : null;
    if(!result) return [];
    return Array.isArray(result) ? result : [result];
  }
  const p = _body3dWorldCenter(name);
  return p ? [p] : [];
}
// Enkel-punkts-variant för kamerafokus m.m. -- första punkten räcker för att peka kameran
// åt rätt håll, även för ett band.
function _procedure3dPointFor(name){
  return _procedure3dPointsFor(name)[0] || null;
}

// Säkerhetstriangeln är en yta, inte ett klickbart anatomiskt landmärke. Därför får meshen
// inget pickName: raycastingen fortsätter igenom till de riktiga musklerna/revbenet bakom.
function renderSafetyTriangle(pointNames, color){
  if(!body3d || !pointNames || pointNames.length !== 3) return null;
  const points = pointNames.map(_procedure3dPointFor);
  if(points.some(p=>!p)) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(
    points.flatMap(p=>[p.x, p.y, p.z]), 3
  ));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({
      color:new THREE.Color(color || "#4A90A4"),
      transparent:true,
      opacity:0.3,
      side:THREE.DoubleSide,
      depthWrite:false,
      clippingPlanes:body3d.clipPlanes
    })
  );
  body3d.overlayGroup.add(mesh);
  return mesh;
}

let proc3d = {key:null, stageIndex:-1};

// Alla RIKTIGA registry-namn en procedur refererar till -- både landmärken och stegens
// cut/reveal-listor ("Skin" är t.ex. bara ett cut-mål, aldrig ett landmärke i sig, se
// konversationen om varför en tidigare version som bara tittade på landmarks missade den).
function _procedure3dRealNames(key){
  const proc = PROCEDURE3D_ANATOMY[key];
  const names = new Set();
  (proc.landmarks || []).forEach(l => { if(l.kind === "real") names.add(l.name); });
  (proc.stages || []).forEach(s => {
    (s.cut||[]).forEach(n=>names.add(n));
    (s.reveal||[]).forEach(n=>names.add(n));
  });
  return names;
}

// Vilka system (skeletal/organ/vascular/.../skin) en procedur faktiskt behöver -- räknas ut
// genom att slå upp varje namn i BODY3D_MANIFEST, i stället för att hårdkodas per procedur,
// så en ny procedur inte kan glömma att ladda rätt system.
function _procedure3dRequiredSystems(key){
  const systems = new Set();
  _procedure3dRealNames(key).forEach(name=>{
    const meta = (window.BODY3D_MANIFEST || []).find(p => p.name === name);
    if(meta) systems.add(meta.system);
  });
  return systems;
}

// proc.region är i första hand till för kamera-/marker-storleksskalning (_body3dRegionBox),
// men återanvänds som synlighetsfilter i loadProcedure3D nedan -- OM alla procedurens riktiga
// strukturer faktiskt är taggade med den regionen i manifestet. Upptäckt vid byggandet av
// central-line-ijv: Common_carotid_artery.r/Clavicle.r är (felaktigt, ett redan existerande
// datakvalitetsfel i den ursprungliga mergen -- samma sorts miss som External_jugular_vein.r
// råkade ut för, se planfilen) taggade "upper_limb" trots att de sitter i halsen/mot axeln --
// ett strikt "head_neck"-filter skulle då dölja själva farostrukturen (a. carotis) helt.
// I stället för att hårdkoda undantag per procedur: faller tillbaka till "all" så fort NÅGON
// riktig struktur inte matchar den deklarerade regionen (region:"all"-jokrar, t.ex. Skin,
// missmatchar aldrig -- de matchar redan vilket filter som helst i _body3dPassesFilter).
function _procedure3dRegionFilterFor(key){
  const proc = PROCEDURE3D_ANATOMY[key];
  let mismatched = false;
  _procedure3dRealNames(key).forEach(name=>{
    const meta = (window.BODY3D_MANIFEST || []).find(p => p.name === name);
    if(meta && meta.region !== "all" && meta.region !== proc.region) mismatched = true;
  });
  return mismatched ? "all" : proc.region;
}

// Laddar procedurens system (om de inte redan är laddade -- se pending-räknaren, som bara
// räknar system som genuint saknas, inte sådana som bara behöver visas igen, eftersom
// setBody3DSystemVisible hanterar det senare fallet synkront utan att trigga
// window.onBody3DSystemLoaded, se Kroppsatlas/js/body3d.js).
function loadProcedure3D(key, onReady){
  const proc = PROCEDURE3D_ANATOMY[key];
  if(!proc || !body3d) return;
  proc3d.key = key;
  proc3d.stageIndex = -1;
  body3dClearOverlay();
  body3dClearSelection();
  setBody3DRegionFilter(_procedure3dRegionFilterFor(key));
  setBody3DSideFilter(proc.side || "both");

  const systems = [..._procedure3dRequiredSystems(key)];
  let pending = systems.filter(sys => !body3d.loadedSystems[sys]).length;
  if(pending === 0){
    systems.forEach(sys => setBody3DSystemVisible(sys, true));
    if(onReady) onReady();
    return;
  }
  window.onBody3DSystemLoaded = (sys) => {
    if(!systems.includes(sys)) return;
    pending--;
    if(pending <= 0 && onReady) onReady();
  };
  systems.forEach(sys => setBody3DSystemVisible(sys, true));
}

function _procedure3dFrameOnPoint(point, halfExtent){
  if(!point || !body3d) return;
  const box = new THREE.Box3(
    point.clone().subScalar(halfExtent),
    point.clone().addScalar(halfExtent)
  );
  const framing = _body3dFrameBox(box, 0.6);
  if(!framing) return;
  body3d.pan.set(point.x, framing.lookAtY, point.z);
  body3d.dist = framing.dist;
  applyBody3DCamera();
}

// Ritar det aktuella steget: ackumulerar cut/reveal från STEG 0 t.o.m. det aktuella (inte
// bara det senaste) så tidigare snitt inte "läks ihop" när man går vidare till nästa steg.
function renderProcedure3DStage(){
  const proc = PROCEDURE3D_ANATOMY[proc3d.key];
  if(!proc || !body3d) return;
  body3dClearOverlay();
  if(proc3d.stageIndex < 0) return;

  const stage = proc.stages[proc3d.stageIndex];
  const focusName = stage.focus || (proc.landmarks.find(l=>l.role==="target")||{}).name;
  const focusPoint = focusName ? _procedure3dPointFor(focusName) : null;

  const cutNames = new Set(), revealNames = new Set();
  for(let i=0; i<=proc3d.stageIndex; i++){
    const s = proc.stages[i];
    (s.cut||[]).forEach(n=>cutNames.add(n));
    (s.reveal||[]).forEach(n=>revealNames.add(n));
  }
  cutNames.forEach(name=>{
    const box = _body3dWorldBox(name);
    const size = box ? box.getSize(new THREE.Vector3()).length() : 1;
    const point = focusPoint || (box ? box.getCenter(new THREE.Vector3()) : null);
    if(point) _body3dAnimateIncision(point, size*0.12, [name], 500);
  });
  // body3dSelectByName håller bara EN markering åt gången (samma modell som Kropps-atlas
  // egen sida) -- för io-tibia finns bara ett reveal-mål per steg så det räcker; en procedur
  // med flera samtidiga mål skulle behöva en riktig multi-select-utökning av body3d.js, inte
  // löst här.
  revealNames.forEach(name => body3dSelectByName(name));

  const regionBox = _body3dRegionBox(proc.region);
  const regionSize = regionBox ? regionBox.getSize(new THREE.Vector3()).length() : 6;
  if(focusPoint) _procedure3dFrameOnPoint(focusPoint, regionSize*0.18);
  // Schematiska märken visas oavsett kamerafokus (inte bara när steget råkar ha ett "focus"-
  // fält) -- det är två separata saker: VAR kameran tittar kontra VILKA märken som finns.
  (proc.landmarks||[]).forEach(l=>{
    if(l.kind !== "schematic") return;
    const pts = _procedure3dPointsFor(l.name);
    if(pts.length) body3dAddOverlayMarker(l.name, pts, PROCEDURE3D_ROLE_COLOR[l.role]||"#4A90A4", regionSize*0.012);
  });
  if(proc.safetyTriangle){
    renderSafetyTriangle(proc.safetyTriangle.points, proc.safetyTriangle.color);
  }
}

function advanceProcedure3DStage(){
  const proc = PROCEDURE3D_ANATOMY[proc3d.key];
  if(!proc || proc3d.stageIndex >= proc.stages.length-1) return false;
  proc3d.stageIndex++;
  renderProcedure3DStage();
  return true;
}
function resetProcedure3DStage(){
  proc3d.stageIndex = -1;
  body3dClearOverlay();
  body3dClearSelection();
}
