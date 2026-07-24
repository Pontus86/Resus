/* ---------- Kärnmodulen: djupa kärnor och andra strukturer utan egen kategori i huvudmodellen ----------
   Ett HELT SEPARAT 3D-läge (egen scen/kamera/renderer, egen <canvas>) bredvid Nervbanor-fliken --
   INTE tillagt i den befintliga brain3d-scenen, eftersom ~150 nya, individuellt valbara objekt
   hade krävt egna stencil-lock/renderOrder-slots per struktur (som i _buildStencilCaps) och
   snabbt trasslat in sig i det redan komplexa klippnings-/lock-systemet där. Här behövs ingen
   klippning alls -- bara ladda, färgsätt per grupp, och lys upp EN vald kärna i taget, precis
   som setBrain3DStructureHighlight men mycket enklare (ingen stencil, inga snitt).

   Samma råa koordinatsystem/transform (BRAIN3D_CENTER/SCALE/ROTATION/YAW_FIX, se brain3d.js) --
   källfilerna kommer från samma Models/Brain-bibliotek som cortex-gyrusytorna, verifierat genom
   att jämföra råa vertex-tal (samma ~1500-skala Z, ~-70-skala Y). En blek, halvgenomskinlig
   cortex-siluett (samma geometri som brain3d.js's cortex, inte en ny tolkning) ger rumslig
   kontext utan att dominera bilden. */
let nuclei3d = null;

const NUCLEI3D_GROUP_COLORS = {
  thalamus: "#B79FDB",
  hypothalamus: "#E8A69A",
  basalganglia: "#D4B483",
  midbrain: "#E0B478",
  limbic: "#9FC1D9",
  commissures: "#F0DFA8",
  midline: "#CF917C",
  ventricles_detail: "#7FB8E0",
  cerebellum_detail: "#8FCB9B"
};
const NUCLEI3D_GROUPS_ORDER = ["thalamus","hypothalamus","basalganglia","midbrain","limbic","commissures","midline","ventricles_detail","cerebellum_detail"];

// key -> {label, groupKey}, uppslaget en gång ur manifestet -- används av den lata laddningen
// (se _nuclei3dEnsurePart) för att veta vilken färg/vilket namn en kärna ska få.
let _nuclei3dKeyIndex = null;
function _nuclei3dBuildKeyIndex(){
  _nuclei3dKeyIndex = {};
  if(!window.NUCLEI3D_MANIFEST) return;
  Object.keys(window.NUCLEI3D_MANIFEST).forEach(groupKey=>{
    window.NUCLEI3D_MANIFEST[groupKey].items.forEach(({key,label})=>{
      _nuclei3dKeyIndex[key] = {label, groupKey};
    });
  });
}
function ensureNuclei3D(cv, onReady){
  if(nuclei3d || !cv || !window.THREE) return;
  const renderer = new THREE.WebGLRenderer({canvas:cv, antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);

  const ambient = new THREE.AmbientLight(0xffffff,0.6); scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff,0.75); key.position.set(-3,5,3); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff,0.35); fill.position.set(2,1,3); scene.add(fill);

  const group = new THREE.Group();
  scene.add(group);

  nuclei3d = {renderer,scene,camera,group,parts:{}, loader:new THREE.OBJLoader(), active:false,
    rotY:0.35, rotX:-0.08, dist:6, pan:new THREE.Vector3(0,0,0), loaded:false, highlight:null};
  applyNuclei3DCamera();
  _nuclei3dBuildKeyIndex();

  // "loaded"/onReady triggas OMEDELBART, INNAN kontext-siluetten ens börjat ladda -- annars
  // väntade knapparna (och döljandet av "Laddar…") i onödan på en tolkning av HELA
  // 73-gyrus-cortex-ytan (samma stora mesh som huvudmodellen, ~13MB, flera sekunders parse),
  // trots att den bara är en bakgrunds-siluett och ingen kärna alls behöver den för att visas.
  nuclei3d.loaded = true;
  if(onReady) onReady();

  // Kontext-siluett: återanvänder cortex-OBJ-datan (redan inbäddad för huvudmodellen, ingen
  // extra nedladdning) som en blek, halvgenomskinlig referens -- samma knep som minikartan i
  // brain3d.js. Laddas i BAKGRUNDEN (setTimeout) och poppar bara in när den är klar -- se
  // kommentaren ovan om varför den inte får blockera "loaded". De 149 kärnorna laddas
  // dessutom lat, en i taget, först när man faktiskt klickar på dem (se _nuclei3dEnsurePart).
  setTimeout(()=>{
    if(!window.BRAIN3D_OBJ || !window.BRAIN3D_OBJ.cortex) return;
    try{
      const obj = nuclei3d.loader.parse(window.BRAIN3D_OBJ.cortex);
      const mat = new THREE.MeshLambertMaterial({color:0xF3EFE4, transparent:true, opacity:0.09, depthWrite:false, side:THREE.DoubleSide});
      obj.traverse(c=>{ if(c.isMesh){ c.material = mat; c.renderOrder = -1; } });
      const wrapper = new THREE.Group();
      wrapper.add(obj);
      _nuclei3dApplyBaseTransform(obj, wrapper);
      group.add(wrapper);
    }catch(e){ console.error("nuclei3d: kunde inte tolka cortex-kontextyta", e); }
  }, 0);

  function resize(){
    const w = cv.clientWidth||360, h = cv.clientHeight||360;
    renderer.setSize(w,h,false);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(cv);
  resize();

  function loop(){
    requestAnimationFrame(loop);
    if(nuclei3d.active) renderer.render(scene,camera);
  }
  loop();

  _nuclei3dWirePointer(cv);
}
// Samma råa -CENTER-förskjutning/skala/rotation som huvudmodellen (se BRAIN3D_CENTER m.fl. i
// brain3d.js) -- SAMMA källbibliotek, så koordinatsystemet är identiskt.
function _nuclei3dApplyBaseTransform(obj, wrapper){
  obj.position.set(-BRAIN3D_CENTER.x,-BRAIN3D_CENTER.y,-BRAIN3D_CENTER.z);
  wrapper.scale.setScalar(BRAIN3D_SCALE);
  const baseQuat = new THREE.Quaternion().setFromEuler(BRAIN3D_ROTATION);
  const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), BRAIN3D_YAW_FIX);
  wrapper.quaternion.copy(yawQuat).multiply(baseQuat);
}
function applyNuclei3DCamera(){
  if(!nuclei3d)return;
  const {camera,rotY,rotX,dist,pan} = nuclei3d;
  camera.position.set(
    pan.x + dist*Math.sin(rotY)*Math.cos(rotX),
    pan.y + dist*Math.sin(rotX),
    pan.z + dist*Math.cos(rotY)*Math.cos(rotX)
  );
  camera.lookAt(pan.x,pan.y,pan.z);
}
function setNuclei3DActive(v){ if(nuclei3d) nuclei3d.active = v; }
// Laddar EN kärna första gången den efterfrågas (klick), inte i förväg -- 149 objekt (~31MB)
// laddade i förväg, ens uppdelat i grupper, tog tillräckligt lång tid att om man hann klicka
// på en kärna i en SENARE grupp innan den hunnit tolkas, fanns den ännu inte i nuclei3d.parts:
// setNuclei3DHighlight hittade ingen matchande "k===key" och man såg bara ALLT tona ner utan
// att NÅGOT lyste upp -- såg ut som att "3d-strukturen inte visas alls". Nu tar ett klick bara
// ~en enda OBJLoader.parse() av EN liten kärna (snabbt), i stället för att behöva vänta in
// en hel kö av andra objekt som råkar ligga tidigare i laddningsordningen.
function _nuclei3dEnsurePart(key){
  if(!nuclei3d || !key) return null;
  if(nuclei3d.parts[key]) return nuclei3d.parts[key];
  const info = _nuclei3dKeyIndex && _nuclei3dKeyIndex[key];
  const text = window.NUCLEI3D_OBJ && window.NUCLEI3D_OBJ[key];
  if(!info || !text){ console.error("nuclei3d: saknar data för", key); return null; }
  let obj;
  try{ obj = nuclei3d.loader.parse(text); }
  catch(e){ console.error("nuclei3d: kunde inte tolka", key, e); return null; }
  const color = new THREE.Color(NUCLEI3D_GROUP_COLORS[info.groupKey] || "#C9C5C2");
  const mat = new THREE.MeshLambertMaterial({color, side:THREE.DoubleSide});
  let mesh = null;
  obj.traverse(c=>{ if(c.isMesh){ c.material = mat; mesh = mesh || c; } });
  if(!mesh) return null;
  const wrapper = new THREE.Group();
  wrapper.add(obj);
  _nuclei3dApplyBaseTransform(obj, wrapper);
  nuclei3d.group.add(wrapper);
  const part = {object:obj, material:mat, baseColor:color.clone(), wrapper, label:info.label, groupKey:info.groupKey};
  nuclei3d.parts[key] = part;
  return part;
}
// Lyser upp EN vald kärna (röd, opak), alla andra tonas ner -- samma mönster som
// setBrain3DStructureHighlight i brain3d.js, men utan stencil/snitt-hänsyn.
function setNuclei3DHighlight(key){
  if(!nuclei3d)return;
  if(key) _nuclei3dEnsurePart(key);
  nuclei3d.highlight = key;
  Object.keys(nuclei3d.parts).forEach(k=>{
    const part = nuclei3d.parts[k];
    if(!key){
      part.material.color.copy(part.baseColor);
      part.material.opacity = 1; part.material.transparent = false; part.material.depthWrite = true;
      return;
    }
    if(k === key){
      part.material.color.set(0xD8473D);
      part.material.opacity = 1; part.material.transparent = false; part.material.depthWrite = true;
    } else {
      part.material.color.copy(part.baseColor);
      part.material.opacity = 0.08; part.material.transparent = true; part.material.depthWrite = false;
    }
  });
}
function _nuclei3dWirePointer(cv){
  let dragging = false, lastX = 0, lastY = 0, panning = false;
  cv.addEventListener("pointerdown", e=>{
    dragging = true; panning = e.shiftKey;
    lastX = e.clientX; lastY = e.clientY;
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener("pointermove", e=>{
    if(!dragging || !nuclei3d) return;
    const dx = e.clientX-lastX, dy = e.clientY-lastY;
    lastX = e.clientX; lastY = e.clientY;
    if(panning){
      const cam = nuclei3d.camera;
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld,0);
      const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld,1);
      const scale = nuclei3d.dist*0.0016;
      nuclei3d.pan.addScaledVector(right,-dx*scale).addScaledVector(up,dy*scale);
    } else {
      nuclei3d.rotY += dx*0.006;
      nuclei3d.rotX = Math.max(-1.3,Math.min(1.3, nuclei3d.rotX + dy*0.006));
    }
    applyNuclei3DCamera();
  });
  ["pointerup","pointercancel","pointerleave"].forEach(ev=>cv.addEventListener(ev, ()=>dragging=false));
  cv.addEventListener("wheel", e=>{
    if(!nuclei3d)return;
    e.preventDefault();
    nuclei3d.dist = Math.max(1.2, Math.min(30, nuclei3d.dist * (1+Math.sign(e.deltaY)*0.08)));
    applyNuclei3DCamera();
  }, {passive:false});
}
