/* ---------- HRA-ryggmärg: verkliga nivåsegment C1–S4 i en separat 3D-vy ---------- */
let hraSpinal3d = null;
let hraSpinalPendingLevel = "C5";

function _hraSpinalGroup(level){
  if(level.startsWith("C")) return "cervical";
  if(level.startsWith("T")) return "thoracic";
  if(level.startsWith("L")) return "lumbar";
  return "sacral";
}

function _hraSpinalResize(){
  if(!hraSpinal3d) return;
  const {canvas,renderer,camera} = hraSpinal3d;
  const width = Math.max(1,canvas.clientWidth);
  const height = Math.max(1,canvas.clientHeight);
  const pixelRatio = Math.min(2,window.devicePixelRatio||1);
  const targetWidth = Math.round(width*pixelRatio);
  const targetHeight = Math.round(height*pixelRatio);
  if(canvas.width !== targetWidth || canvas.height !== targetHeight){
    renderer.setSize(width,height,false);
    camera.aspect = width/height;
    camera.updateProjectionMatrix();
  }
}

function _hraSpinalApplySelection(level){
  hraSpinalPendingLevel = level;
  const profile = document.getElementById("cordLevelProfile");
  if(profile){
    const groupLabel = {cervical:"cervikalt",thoracic:"thorakalt",lumbar:"lumbalt",sacral:"sakralt"}[_hraSpinalGroup(level)];
    profile.textContent = `${level} · ${groupLabel} tvärsnitt`;
  }
  if(!hraSpinal3d) return;
  hraSpinal3d.level = level;
  Object.entries(hraSpinal3d.segments).forEach(([key,meshes])=>{
    const selected = key === level;
    meshes.forEach(mesh=>{
      mesh.material.color.set(selected ? 0xD8473D : 0xD7A86E);
      mesh.material.opacity = selected ? 1 : 0.36;
      mesh.material.depthWrite = selected;
    });
  });
}

function setHraSpinalLevel(level){
  _hraSpinalApplySelection(level);
}

function initHraSpinal3D(canvas){
  if(hraSpinal3d || !canvas || !window.THREE || !window.HRA_SPINAL_CORD_OBJ) return;
  const renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34,1,0.1,100);
  scene.add(new THREE.HemisphereLight(0xffffff,0x796b5c,1.25));
  const key = new THREE.DirectionalLight(0xffffff,0.75);
  key.position.set(-3,5,4);
  scene.add(key);

  const loader = new THREE.OBJLoader();
  const object = loader.parse(window.HRA_SPINAL_CORD_OBJ);
  const segments = {};
  object.children.forEach(child=>{
    const level = child.name;
    if(!/^([CTLS])\d+$/.test(level)) return;
    const meshes = [];
    child.traverse(mesh=>{
      if(!mesh.isMesh) return;
      mesh.material = new THREE.MeshPhongMaterial({
        color:0xD7A86E,transparent:true,opacity:0.36,shininess:16,side:THREE.DoubleSide
      });
      meshes.push(mesh);
    });
    segments[level] = meshes;
  });

  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  object.position.copy(center).multiplyScalar(-1);
  object.scale.setScalar(5.5/size.y);
  const group = new THREE.Group();
  group.add(object);
  scene.add(group);

  camera.position.set(0.4,0.1,8.2);
  camera.lookAt(0,0,0);
  hraSpinal3d = {canvas,renderer,scene,camera,group,segments,active:false,level:null,rotY:-0.28,rotX:0,zoom:1};
  _hraSpinalApplySelection(hraSpinalPendingLevel);

  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener("pointerdown",event=>{
    dragging = true; lastX = event.clientX; lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointerup",()=>{ dragging=false; });
  canvas.addEventListener("pointerleave",()=>{ dragging=false; });
  canvas.addEventListener("pointermove",event=>{
    if(!dragging) return;
    hraSpinal3d.rotY += (event.clientX-lastX)*0.008;
    hraSpinal3d.rotX = Math.max(-0.55,Math.min(0.55,hraSpinal3d.rotX+(event.clientY-lastY)*0.006));
    lastX = event.clientX; lastY = event.clientY;
  });
  canvas.addEventListener("wheel",event=>{
    event.preventDefault();
    hraSpinal3d.zoom = Math.max(0.72,Math.min(1.8,hraSpinal3d.zoom+event.deltaY*0.001));
  },{passive:false});

  if(window.ResizeObserver) new ResizeObserver(_hraSpinalResize).observe(canvas);
  _hraSpinalResize();
  (function animate(){
    requestAnimationFrame(animate);
    if(!hraSpinal3d || !hraSpinal3d.active) return;
    _hraSpinalResize();
    group.rotation.set(hraSpinal3d.rotX,hraSpinal3d.rotY,0);
    camera.position.z = 8.2*hraSpinal3d.zoom;
    renderer.render(scene,camera);
  })();
}

function setHraSpinal3DActive(active){
  if(active && !hraSpinal3d) initHraSpinal3D(document.getElementById("hraSpinalCanvas"));
  if(hraSpinal3d) hraSpinal3d.active = !!active;
}
