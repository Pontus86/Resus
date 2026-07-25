/* ---------- Kropps-atlas 3D: motor ----------
   Skiljer sig medvetet från Neuro/js/brain3d.js:s teknik på en central punkt: brain3d.js har
   ~20 NAMNGIVNA KATEGORIER (en knapp per struktur), kropps-atlas har ~1700 INDIVIDUELLA delar
   (skelett/muskler/nerver/kärl/ledband, se manifest.js) -- en fast knapplista skulle vara
   ohanterlig i den skalan. Lösningen här: EN generisk registry (body3d.registry[namn] =
   {mesh, system, region, side}) byggd genom att bevara "o "-rader i den sammanslagna OBJ-texten
   (till skillnad från Neuro:s peripheral_nerves.js, som medvetet SLÅR IHOP allt till en enda
   yta eftersom inget enskilt namn behövdes där) -- THREE.OBJLoader delar då automatiskt upp
   varje "o"-block som en egen Mesh i den returnerade gruppen. Sök/filtrera/isolera blir sedan
   generiska loopar över registryn i stället för hundratals hårdkodade knappar.
   Ingen stencil-cap-klippteknik här (den byggdes för ~20 kategorier, inte 1700 individuella
   delar -- att bygga vattentäta proxys för var och en hade varit en helt egen, mycket större
   uppgift) -- snitt är enkla THREE.js-klippplan utan lock (samma "öppen yta"-stil som
   brain3d.js redan använder för vertebrae/peripheral_nerves, se BRAIN3D_CAP_SKIP där). */

let body3d = null;
// Klippplanens "av"-avstånd, se kommentaren vid body3d.clip nedan.
const BODY3D_CLIP_OFF = 200;

function ensureBody3D(canvas, onReady){
  if(body3d || !canvas || !window.THREE) return;
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
  const group = new THREE.Group();
  scene.add(group);
  // Egen grupp för procedurträningens landmärken/nålvägar (se _body3dWorldBox m.fl. nedan) --
  // aldrig anatomiska meshar, bara schematiska rör/sfärer. Läggs direkt i scenen (inte i
  // "group", som bara är en tom container utan egen transform -- samma nivå som brain3d.js:s
  // tractGroup, se Neuro/js/brain3d.js). Kropps-atlas egen sida använder aldrig denna.
  const overlayGroup = new THREE.Group();
  scene.add(overlayGroup);

  const ambient = new THREE.AmbientLight(0xffffff, 0.75);
  const key = new THREE.DirectionalLight(0xffffff, 0.65); key.position.set(2,3,4);
  const fill = new THREE.DirectionalLight(0xffffff, 0.3); fill.position.set(-3,-1,-2);
  scene.add(ambient, key, fill, camera);

  const clip = {
    // "Av"-avståndet (BODY3D_CLIP_OFF) måste vara utanför HELA kroppens utsträckning (ben ner
    // till ca y=-52), inte bara hjärnans (brain3d.js:s ±20-tal räckte där men klippte av
    // benen redan innan användaren rört ett reglage här -- upptäckt genom att jämföra
    // faktiskt korrekta, sammanhängande world-space bounding boxes (höft->fot, inga luckor)
    // mot en skärmdump där benen ändå saknades helt, se konversationen).
    sagittal: {enabled:false, value:0, flip:false, plane:new THREE.Plane(new THREE.Vector3(1,0,0), BODY3D_CLIP_OFF)},
    coronal:  {enabled:false, value:0, flip:false, plane:new THREE.Plane(new THREE.Vector3(0,0,1), BODY3D_CLIP_OFF)},
    axial:    {enabled:false, value:0, flip:false, plane:new THREE.Plane(new THREE.Vector3(0,1,0), BODY3D_CLIP_OFF)}
  };
  const clipPlanes = [clip.sagittal.plane, clip.coronal.plane, clip.axial.plane];

  body3d = {
    renderer, scene, camera, group, overlayGroup, clip, clipPlanes,
    registry:{}, groups:{}, loadedSystems:{},
    active:false, rotY:0.4, rotX:-0.08, dist:90, pan:new THREE.Vector3(0,-20,0),   // grov gissning, ersätts av _body3dDefaultFraming() nedan så snart skelettet laddats klart
    loaded:false, selectedName:null, isolate:false,
    regionFilter:"all", sideFilter:"both",
    onReadyQueue: onReady ? [onReady] : []
  };
  applyBody3DCamera();

  // Skelett + hjärna/ryggmärg laddas direkt (rimlig "helkropp" utan att tvinga fram alla
  // mjukdelar), övriga system laddas lazy första gången de slås på (se setBody3DSystemVisible).
  const initialSystems = BODY3D_SYSTEMS.filter(s => BODY3D_DEFAULT_ON[s]);
  let idx = 0;
  function loadNext(){
    if(idx >= initialSystems.length){
      body3d.loaded = true;
      _body3dRefreshVisibility();
      const framing = _body3dDefaultFraming();
      body3d.pan.set(0, framing.lookAtY, 0);
      body3d.dist = framing.dist;
      applyBody3DCamera();
      body3d.onReadyQueue.forEach(fn=>fn());
      body3d.onReadyQueue = [];
      return;
    }
    const sys = initialSystems[idx++];
    _body3dLoadSystem(sys, ()=> setTimeout(loadNext, 0));
  }
  loadNext();

  function animate(){
    if(body3d && body3d.active) renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  // Klick-i-3D-vyn (raycasting) -- komplement till sökrutan, se main.js.
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  canvas.addEventListener("click", (e)=>{
    if(!body3d || body3d.dragged) return;
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX-rect.left)/rect.width)*2-1;
    ndc.y = -((e.clientY-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(ndc, camera);
    const meshes = Object.values(body3d.registry).map(r=>r.mesh).filter(m=>m.visible);
    // Schematiska landmärken (procedurträning) har inget registry-namn -- de bär sitt eget
    // namn i userData.pickName i stället, se body3dAddOverlayMarker nedan. Samma
    // window.onBody3DPick-krok för båda, så konsumenten (info-panelen) bara behöver EN
    // kodväg oavsett om träffen var en riktig struktur eller ett schematiskt märke.
    const overlayMeshes = body3d.overlayGroup.children.filter(m=>m.visible && m.userData.pickName);
    const hits = raycaster.intersectObjects(meshes.concat(overlayMeshes), false);
    if(hits.length){
      const hit = hits[0].object;
      const name = hit.userData.pickName || Object.keys(body3d.registry).find(k=>body3d.registry[k].mesh===hit);
      if(name && typeof window.onBody3DPick === "function") window.onBody3DPick(name);
    }
  });

  // Drag för att rotera, scroll för att zooma, skift+drag för att panorera -- samma mönster
  // som brain3d.js.
  let dragging=false, shiftDrag=false, lastX=0, lastY=0;
  canvas.addEventListener("pointerdown", e=>{
    dragging=true; body3d.dragged=false; shiftDrag=e.shiftKey; lastX=e.clientX; lastY=e.clientY;
  });
  window.addEventListener("pointerup", ()=>{ dragging=false; });
  window.addEventListener("pointermove", e=>{
    if(!dragging || !body3d) return;
    const dx=e.clientX-lastX, dy=e.clientY-lastY;
    if(Math.abs(dx)>2||Math.abs(dy)>2) body3d.dragged=true;
    lastX=e.clientX; lastY=e.clientY;
    if(shiftDrag){
      body3d.pan.x -= dx*0.01; body3d.pan.y += dy*0.01;
    } else {
      body3d.rotY += dx*0.008; body3d.rotX = Math.max(-1.3, Math.min(1.3, body3d.rotX + dy*0.008));
    }
    applyBody3DCamera();
  });
  canvas.addEventListener("wheel", e=>{
    if(!body3d) return;
    e.preventDefault();
    body3d.dist = Math.max(5, Math.min(250, body3d.dist * (1 + e.deltaY*0.001)));
    applyBody3DCamera();
  }, {passive:false});

  window.addEventListener("resize", _body3dResize);
  _body3dResize();
}

function _body3dResize(){
  if(!body3d) return;
  const canvas = body3d.renderer.domElement;
  const w = canvas.clientWidth||478, h = canvas.clientHeight||358;
  body3d.renderer.setSize(w, h, false);
  body3d.camera.aspect = w/h;
  body3d.camera.updateProjectionMatrix();
}

function applyBody3DCamera(){
  if(!body3d) return;
  const {camera, rotY, rotX, dist, pan} = body3d;
  camera.position.set(
    pan.x + dist*Math.sin(rotY)*Math.cos(rotX),
    pan.y + dist*Math.sin(rotX),
    pan.z + dist*Math.cos(rotY)*Math.cos(rotX)
  );
  camera.lookAt(pan.x, pan.y, pan.z);
}
function setBody3DActive(v){ if(body3d) body3d.active = v; }

function setBody3DPreset(key){
  if(!body3d || !BODY3D_PRESETS[key]) return;
  Object.assign(body3d, BODY3D_PRESETS[key]);
  const framing = _body3dDefaultFraming();
  body3d.pan.set(0, framing.lookAtY, 0);
  body3d.dist = framing.dist;
  applyBody3DCamera();
}

// Räknar ut pan.y/dist så HELA för närvarande synliga kroppen (oavsett vilka system/filter som
// är aktiva just nu) ryms i bild, TRIGONOMETRISKT från kamerans faktiska FOV -- samma teknik
// (och samma bugg den fixar) som Neuro/js/brain3d.js:s _brain3dWholeFraming: en hårdkodad
// gissning på pan.y/dist visade sig (mätt via Vector3.project) lämna fötterna strax UTANFÖR
// synligt NDC-område (y=-1.06, ska vara inom -1..1) -- därför räknas det ut på nytt varje gång
// (första laddningen OCH varje kamera-förval), robust mot att den faktiska datan/filtreringen
// ändras. Största av de två halvorna används (inte bara mitten) eftersom kamerans rotX-lutning
// gör projektionen något osymmetrisk kring pan.y, se motsvarande kommentar i brain3d.js.
const BODY3D_MARGIN = 0.85;
// Utbruten ur den ursprungliga _body3dDefaultFraming (var inline där) -- Procedurträning
// återanvänder samma trigonometri för att zooma till EN procedurs region/landmärke i stället
// för hela den synliga kroppen, se _body3dRegionBox nedan.
function _body3dFrameBox(box, margin){
  if(!box || box.isEmpty()) return null;
  const topY = box.max.y, bottomY = box.min.y;
  const lookAtY = (topY+bottomY)/2;
  const halfSpan = Math.max(topY-lookAtY, lookAtY-bottomY);
  const halfFovRad = (body3d.camera.fov/2) * Math.PI/180;
  const dist = halfSpan>0 ? (halfSpan/margin) / Math.tan(halfFovRad) : 90;
  return {lookAtY, dist};
}
function _body3dDefaultFraming(){
  if(!body3d) return {lookAtY:-20, dist:90};
  const box = new THREE.Box3();
  let found = false;
  Object.values(body3d.registry).forEach(entry=>{
    if(!entry.mesh.visible) return;
    box.expandByObject(entry.mesh);
    found = true;
  });
  if(!found) return {lookAtY:-20, dist:90};
  return _body3dFrameBox(box, BODY3D_MARGIN) || {lookAtY:-20, dist:90};
}

// ---------- laddning ----------

function _body3dApplyTransform(obj){
  obj.position.set(-BODY3D_CENTER.x, -BODY3D_CENTER.y, -BODY3D_CENTER.z);
  const wrapper = new THREE.Group();
  wrapper.add(obj);
  wrapper.scale.setScalar(BODY3D_SCALE);
  const baseQuat = new THREE.Quaternion().setFromEuler(BODY3D_ROTATION);
  const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), BODY3D_YAW_FIX);
  wrapper.quaternion.copy(yawQuat).multiply(baseQuat);
  return wrapper;
}

function _body3dRegister(mesh, name, system, region, side, color){
  // Huden är en hel, sluten kroppsyta -- skulle annars dölja allt annat (skelett/organ/...)
  // så fort den slås på. Övriga system: full opacitet som standard.
  const baseOpacity = system === "skin" ? 0.12 : 1;
  mesh.material = new THREE.MeshLambertMaterial({
    color: new THREE.Color(color), side: THREE.DoubleSide, clippingPlanes: body3d.clipPlanes,
    transparent: baseOpacity < 1, opacity: baseOpacity, depthWrite: baseOpacity >= 1
  });
  mesh.userData.baseColor = color;
  mesh.userData.baseOpacity = baseOpacity;
  body3d.registry[name] = {mesh, system, region: region||"axial", side: side||"mid"};
}

// De tunga systemen (bl.a. muskler, nerver, kranialnerver och hjärtdetaljer) är INTE
// statiska <script>-taggar i
// index.html -- laddas dynamiskt on-demand här, en gång, cachat därefter av samma
// window.BODY3D_OBJ[system]-kontroll som redan skyddar mot dubbelladdning.
function _body3dLoadSystemScript(system, cb){
  if(window.BODY3D_OBJ && window.BODY3D_OBJ[system]){ cb(); return; }
  const s = document.createElement("script");
  s.src = BODY3D_MODELS_BASE + system + ".js";
  s.onload = cb;
  s.onerror = ()=>{ console.error("body3d: kunde inte ladda", s.src); cb(); };
  document.head.appendChild(s);
}

function _body3dLoadSystem(system, done){
  if(body3d.loadedSystems[system]){ if(done) done(); return; }
  body3d.loadedSystems[system] = true;
  if(system !== "brain" && !(window.BODY3D_OBJ && window.BODY3D_OBJ[system])){
    _body3dLoadSystemScript(system, ()=>_body3dLoadSystemParsed(system, done));
    return;
  }
  _body3dLoadSystemParsed(system, done);
}

// body3d.loadedSystems[system] sätts sant redan när en hämtning STARTAR (se _body3dLoadSystem
// ovan) -- bra som "påbörja inte en andra hämtning"-spärr, men fel att tolka som "klar och
// sökbar i registryn", vilket Procedurtraning/js/procedures3d.js:s loadProcedure3D() tidigare
// gjorde (B-004: race mellan flera samtidiga proceduranrop, se BUGS.md). body3d.systemReady
// är den FAKTISKA signalen -- sätts bara här, vid riktig hämtnings-/parsningsslut, aldrig vid
// start. _body3dOnSystemReady kan anropas av GODTYCKLIGT många lyssnare oberoende av
// varandra (till skillnad från window.onBody3DSystemLoaded, som bara rymmer EN global
// funktion åt gången och tystnar tidigare lyssnare om den skrivs över -- den lämnas orörd här,
// Kropps-atlas egen "laddar…"-indikator i main.js fortsätter använda den som förut, det här
// är en tillkommande, separat mekanism, inte en ersättning).
function _body3dOnSystemReady(system, cb){
  if(!body3d) return;
  if(!body3d.systemReady) body3d.systemReady = {};
  if(body3d.systemReady[system]){ cb(); return; }
  if(!body3d.systemReadyCallbacks) body3d.systemReadyCallbacks = {};
  (body3d.systemReadyCallbacks[system] = body3d.systemReadyCallbacks[system] || []).push(cb);
}
function _body3dMarkSystemReady(system){
  if(!body3d) return;
  if(!body3d.systemReady) body3d.systemReady = {};
  body3d.systemReady[system] = true;
  const cbs = (body3d.systemReadyCallbacks && body3d.systemReadyCallbacks[system]) || [];
  if(body3d.systemReadyCallbacks) body3d.systemReadyCallbacks[system] = [];
  cbs.forEach(cb=>cb());
}

function _body3dLoadSystemParsed(system, done){
  const loader = new THREE.OBJLoader();
  const sysGroup = new THREE.Group();
  body3d.groups[system] = sysGroup;
  body3d.group.add(sysGroup);
  // Markerar redo OCH anropar done() på VARJE utgång nedan (även felvägarna -- loadedSystems
  // är redan satt sant vid det laget, ett misslyckat försök görs aldrig om, så en lyssnare som
  // väntar via _body3dOnSystemReady måste ändå få veta att "hämtningen är över", annars hänger
  // den för evigt).
  function finish(){ _body3dMarkSystemReady(system); if(done) done(); }

  if(system === "brain"){
    let i = 0;
    function nextBrainFile(){
      if(i >= BODY3D_BRAIN_CATEGORIES.length){ finish(); return; }
      const {cat, region} = BODY3D_BRAIN_CATEGORIES[i++];
      const text = window.BRAIN3D_OBJ && window.BRAIN3D_OBJ[cat];
      if(!text){ setTimeout(nextBrainFile,0); return; }
      let obj;
      try{ obj = loader.parse(text); } catch(e){ console.error("body3d: parse fail", cat, e); setTimeout(nextBrainFile,0); return; }
      let mesh = null;
      obj.traverse(c=>{ if(c.isMesh && !mesh) mesh = c; });
      if(mesh){
        const wrapper = _body3dApplyTransform(mesh);
        sysGroup.add(wrapper);
        _body3dRegister(mesh, cat, "brain", region, cat.endsWith("_l")?"l":(cat.endsWith("_r")?"r":"mid"), _body3dBrainColorFor(cat));
      }
      setTimeout(nextBrainFile, 0);
    }
    nextBrainFile();
    return;
  }

  const text = window.BODY3D_OBJ && window.BODY3D_OBJ[system];
  if(!text){ console.error("body3d: saknar data för", system); finish(); return; }
  let obj;
  try{ obj = loader.parse(text); }
  catch(e){ console.error("body3d: kunde inte tolka OBJ för", system, e); finish(); return; }

  const manifestBySystem = (window.BODY3D_MANIFEST||[])
    .concat(typeof BODY3D_FEMALE_PELVIS_PARTS === "undefined" ? [] : BODY3D_FEMALE_PELVIS_PARTS)
    .concat(window.BODY3D_BP3D_CLINICAL_PARTS||[])
    .filter(p=>p.system===system);
  const metaByName = {};
  manifestBySystem.forEach(p=>{ metaByName[p.name] = p; });

  const wrapper = _body3dApplyTransform(obj);
  sysGroup.add(wrapper);
  obj.traverse(c=>{
    if(!c.isMesh) return;
    const meta = metaByName[c.name] || {region:"axial", side:"mid"};
    let color = meta.color || BODY3D_SYSTEM_COLOR[system] || "#cccccc";
    if(system === "vascular") color = /vein/i.test(c.name) ? BODY3D_SYSTEM_COLOR.vascular_vein : BODY3D_SYSTEM_COLOR.vascular_artery;
    if(system === "cardiac_detail" && meta.tissue === "vascular"){
      color = /vein/i.test(c.name) ? BODY3D_SYSTEM_COLOR.vascular_vein : BODY3D_SYSTEM_COLOR.vascular_artery;
    }
    _body3dRegister(c, c.name, system, meta.region, meta.side, color);
  });
  finish();
}

function setBody3DSystemVisible(system, visible){
  if(!body3d) return;
  if(visible && !body3d.loadedSystems[system]){
    _body3dLoadSystem(system, ()=>{
      if(body3d.groups[system]) body3d.groups[system].visible = true;
      _body3dRefreshVisibility();
      if(typeof window.onBody3DSystemLoaded === "function") window.onBody3DSystemLoaded(system);
    });
    return;
  }
  if(body3d.groups[system]) body3d.groups[system].visible = visible;
  _body3dRefreshVisibility();
}

// ---------- filter / urval ----------

function setBody3DRegionFilter(region){ if(body3d){ body3d.regionFilter = region; _body3dRefreshVisibility(); } }
function setBody3DSideFilter(side){ if(body3d){ body3d.sideFilter = side; _body3dRefreshVisibility(); } }
function setBody3DIsolate(v){ if(body3d){ body3d.isolate = v; _body3dRefreshVisibility(); } }

function body3dSelectByName(name){
  if(!body3d) return;
  body3d.selectedName = body3d.registry[name] ? name : null;
  _body3dRefreshVisibility();
}
function body3dClearSelection(){ if(body3d){ body3d.selectedName = null; _body3dRefreshVisibility(); } }

function _body3dPassesFilter(entry){
  // entry.region==="all" (t.ex. Skin -- en enda sammanhängande yta för hela kroppen, kan inte
  // delvis visas per region) är en JOKER: matchar VILKET regionfilter som helst, inte bara
  // det bokstavliga "all"-filtret.
  const regionOk = body3d.regionFilter==="all" || entry.region==="all" || entry.region===body3d.regionFilter;
  const sideOk = body3d.sideFilter==="both" || entry.side==="mid" || entry.side===body3d.sideFilter;
  return regionOk && sideOk;
}

function _body3dRefreshVisibility(){
  if(!body3d) return;
  const hasSelection = !!body3d.selectedName;
  Object.keys(body3d.registry).forEach(name=>{
    const entry = body3d.registry[name];
    const sysVisible = body3d.groups[entry.system] ? body3d.groups[entry.system].visible : false;
    const filterOk = _body3dPassesFilter(entry);
    const isSelected = name === body3d.selectedName;
    let visible = sysVisible && filterOk;
    if(hasSelection && body3d.isolate) visible = isSelected;
    entry.mesh.visible = visible;
    if(entry.mesh.material){
      const baseOpacity = entry.mesh.userData.baseOpacity != null ? entry.mesh.userData.baseOpacity : 1;
      if(isSelected){
        entry.mesh.material.color.set("#D8473D");
        entry.mesh.material.opacity = 1; entry.mesh.material.transparent = false;
      } else {
        entry.mesh.material.color.set(entry.mesh.userData.baseColor);
        if(hasSelection && !body3d.isolate){
          entry.mesh.material.opacity = Math.min(baseOpacity, 0.18); entry.mesh.material.transparent = true;
        } else {
          entry.mesh.material.opacity = baseOpacity; entry.mesh.material.transparent = baseOpacity < 1;
        }
      }
    }
  });
}

// ---------- snitt (enkla klippplan, inga lock -- se filkommentar överst) ----------

const BODY3D_CLIP_BASE_NORMAL = {
  sagittal: new THREE.Vector3(1,0,0),
  coronal:  new THREE.Vector3(0,0,1),
  axial:    new THREE.Vector3(0,1,0)
};
function setBody3DClip(axis, enabled, value, flip){
  if(!body3d) return;
  const c = body3d.clip[axis];
  c.enabled = enabled; c.value = value; c.flip = flip;
  const sign = flip ? 1 : -1;
  c.plane.normal.copy(BODY3D_CLIP_BASE_NORMAL[axis]).multiplyScalar(sign);
  c.plane.constant = enabled ? -sign*value : BODY3D_CLIP_OFF;
}

// ---------- bounding box (för region-baserad kamera-inramning, se main.js) ----------

function _body3dRegionBox(region){
  if(!body3d) return null;
  const box = new THREE.Box3();
  let found = false;
  Object.values(body3d.registry).forEach(entry=>{
    if(!entry.mesh.visible) return;
    if(region!=="all" && entry.region!==region) return;
    box.expandByObject(entry.mesh);
    found = true;
  });
  return found ? box : null;
}

/* ---------- Landmärken i world-space (för Procedurträning) ----------
   Generisk motsvarighet till Neuro/js/brain3d.js:s _brain3dWorldBox/_brain3dWorldCenter, men
   över body3d.registry i stället för brain3d.parts -- samma idé (riktiga punkter från RIKTIG,
   redan transformerad geometri, aldrig hårdkodade koordinater), ingen egen kontur-mesh att
   undanta här (registryns meshar är redan de enda, rena meshobjekten -- ingen cap-proxy-syskon
   som i brain3d.js, se filkommentaren där). Kropps-atlas egen sida anropar aldrig dessa. */
function _body3dWorldBox(name){
  const entry = body3d && body3d.registry[name];
  if(!entry) return null;
  entry.mesh.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(entry.mesh);
}
function _body3dWorldCenter(name){
  const box = _body3dWorldBox(name);
  if(!box || box.isEmpty()) return null;
  return box.getCenter(new THREE.Vector3());
}

/* ---------- Lokal snitt-volym (för Procedurträningens "gör snitt") ----------
   Skiljer sig från "Snitt"-panelens klippplan ovan (setBody3DClip) på ett avgörande sätt:
   de är hel-kropps-plan i UNION-läge (material.clipIntersection default false) -- ett aktivt
   plan tar bort HELA ena halvan av kroppen. Här vill vi motsatsen: ta bort bara insidan av en
   liten låda runt insticksstället, resten av strukturen kvar orörd. THREE.js har inget
   "klipp bara den här lilla volymen"-läge direkt, men INTERSECTION-läge (clipIntersection=
   true) ger det indirekt: en fragment tas bort bara om den ligger på "minus"-sidan av ALLA
   sex planen SAMTIDIGT. Om de sex planen är lådans sex sidor (två per axel, inåtriktade)
   blir just den samtidiga minus-regionen exakt lådans insida.
   THREE.Plane-konventionen: distance(p) = normal·p + constant, negativt avstånd = "tas bort".
   För ett plan med normal n ska "negativt avstånd" motsvara "n·p < n·center + halfSize" (dvs
   n=+x ger den ÖVRE gränsen center.x+halfSize, n=-x ger den UNDRE center.x-halfSize) --
   löser ut till constant = -n·center - halfSize. Verifierad genom insticksfallet
   (center.x=10, halfSize=2 -> n=+x ger p.x<12, n=-x ger p.x>8, snittet 8<p.x<12 är lådan,
   inte tomma mängden) INNAN den kopplades till faktisk geometri, sedan bekräftad visuellt
   i Playwright (se verifieringsavsnittet i planfilen) -- inte gissad i produktion. */
function _body3dIncisionPlanes(center, halfSize){
  const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  return dirs.map(([x,y,z])=>{
    const n = new THREE.Vector3(x,y,z);
    return new THREE.Plane(n, -n.dot(center) - halfSize);
  });
}
// Sätter/återställer klippläge för namngivna registry-strukturer. Varje mesh har sin EGEN
// materialinstans (se _body3dRegister ovan) -- att ändra en strukturs clippingPlanes påverkar
// aldrig någon annan, även om flera strukturer råkar vara "aktiva" i olika snitt samtidigt.
// body3d.cutMeshes håller reda på VILKA som just nu är skurna, oavsett vilken procedur/steg
// som gjorde det -- annars finns ingen väg tillbaka till "återställ ALLT som skurits" utan
// att varje anropare själv måste minnas listan (upptäckt som B-005: varken reset eller
// procedurbyte i Procedurtraning/js/procedures3d.js rörde klipp-state alls, se BUGS.md).
function body3dStageLayer(meshNames, incisionPlanes, active){
  if(!body3d) return;
  if(!body3d.cutMeshes) body3d.cutMeshes = new Set();
  meshNames.forEach(name=>{
    const entry = body3d.registry[name];
    if(!entry || !entry.mesh.material) return;
    entry.mesh.material.clippingPlanes = active ? incisionPlanes : body3d.clipPlanes;
    entry.mesh.material.clipIntersection = !!active;
    entry.mesh.material.needsUpdate = true;
    if(active) body3d.cutMeshes.add(name); else body3d.cutMeshes.delete(name);
  });
}
// Animerar snitt-lådan från 0 till targetRadius -- en stegvis "avslöjande" i stället för att
// bara poppa upp klippt, se Procedurtraning/js/procedures3d.js för hur stegen kedjas.
// _body3dIncisionGen är en generationsräknare: varje ny animation tar ett eget nummer, och
// varje frame kollar att numret fortfarande är det AKTUELLA -- om body3dResetAllCuts() (eller
// en nyare animation) hunnit höja räknaren under tiden avbryts den gamla rAF-kedjan tyst i
// stället för att fortsätta mutera material efter en reset/procedurbyte (B-005, andra halvan).
let _body3dIncisionGen = 0;
function _body3dAnimateIncision(center, targetRadius, meshNames, duration, onDone){
  const myGen = ++_body3dIncisionGen;
  const t0 = performance.now();
  function step(now){
    if(myGen !== _body3dIncisionGen) return; // överkörd av reset eller en nyare animation
    const t = Math.min(1, (now - t0) / duration);
    body3dStageLayer(meshNames, _body3dIncisionPlanes(center, targetRadius * t), true);
    if(t < 1) requestAnimationFrame(step); else if(onDone) onDone();
  }
  requestAnimationFrame(step);
}
// Återställer ALLA för närvarande skurna strukturer till normalt klippläge och ogiltigförklarar
// varje pågående snitt-animation (se _body3dIncisionGen ovan). Anropas från
// Procedurtraning/js/procedures3d.js:s resetProcedure3DStage() OCH loadProcedure3D() -- båda
// ställena som tidigare glömde städa klipp-state helt (B-005).
function body3dResetAllCuts(){
  if(!body3d) return;
  _body3dIncisionGen++;
  if(body3d.cutMeshes && body3d.cutMeshes.size){
    body3dStageLayer([...body3d.cutMeshes], null, false);
  }
}
// Lägger ett schematiskt märke (rör mellan punkter, eller en ensam sfär) i overlayGroup, med
// ett pickName så klicket i canvasen (se ensureBody3D ovan) hittar det via samma
// window.onBody3DPick-krok som riktiga strukturer.
function body3dAddOverlayMarker(pickName, points, color, radius){
  if(!body3d) return null;
  let mesh;
  if(points.length >= 2){
    const curve = new THREE.CatmullRomCurve3(points);
    mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 32, radius||0.05, 8, false),
      new THREE.MeshLambertMaterial({color:new THREE.Color(color), clippingPlanes:body3d.clipPlanes})
    );
  } else {
    mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius||0.08, 12, 12),
      new THREE.MeshLambertMaterial({color:new THREE.Color(color), clippingPlanes:body3d.clipPlanes})
    );
    mesh.position.copy(points[0]);
  }
  mesh.userData.pickName = pickName;
  body3d.overlayGroup.add(mesh);
  return mesh;
}
function body3dClearOverlay(){
  if(!body3d) return;
  while(body3d.overlayGroup.children.length) body3d.overlayGroup.remove(body3d.overlayGroup.children[0]);
}
