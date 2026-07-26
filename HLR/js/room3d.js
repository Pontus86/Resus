/* Riktig 3D-vy för akutrummet. Modellerna byggs av små Three.js-meshar så att scenen
   fungerar via file:// utan modellhämtning, byggsteg eller tungt minnesbehov. */
const HLRRoom3D=(()=>{
  const API={ready:false,failed:false};
  const objects={},staff={},materials={};
  let canvas,renderer,scene,camera,raycaster,pointer,clockLight,shockLight;
  let patient,patientTorso,lucas,piston,pads,airwayMask,airwayTube,ventBag,accessPatch;
  let padCable,ivLine,usCable,monitorTrace;
  let defibScreen,defibLamp,ultrasoundProbe;
  let lastWidth=0,lastHeight=0;

  const C={
    floor:0xD6DED9,grid:0xBAC8C0,wall:0xE9EEEA,wallEdge:0xA9B8B0,
    white:0xF7F8F6,metal:0xAAB5B0,metalDark:0x56645D,screen:0x12201B,
    skin:0xD8A278,hair:0x43362F,gown:0xBFD7C9,red:0xC94B40,green:0x35A46F,
    blue:0x5C91B8,yellow:0xD9C94B,amber:0xE7A33A,dark:0x26312C
  };
  const ROLE_COLOR={
    doctor:0x2D4569,nurse_ssk:0x447CAD,compressor:0x77A9C5,
    ambulance:0xB7C943,airway_staff:0x376B98,narkos_ssk:0x315F88,surgeon:0x397366
  };
  const Y_AXIS=new THREE.Vector3(0,1,0);

  function material(name,color,extra){
    if(!materials[name])materials[name]=new THREE.MeshStandardMaterial(Object.assign({
      color,roughness:.72,metalness:0
    },extra||{}));
    return materials[name];
  }
  function box(w,h,d,mat){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    m.castShadow=true;m.receiveShadow=true;return m;
  }
  function cylinder(r,h,mat,segments){
    const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments||12),mat);
    m.castShadow=true;m.receiveShadow=true;return m;
  }
  function sphere(r,mat,segments){
    const m=new THREE.Mesh(new THREE.SphereGeometry(r,segments||16,segments||12),mat);
    m.castShadow=true;m.receiveShadow=true;return m;
  }
  function setCylinder(mesh,a,b,radius){
    const mid=a.clone().add(b).multiplyScalar(.5),dir=b.clone().sub(a);
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(Y_AXIS,dir.clone().normalize());
    mesh.scale.set(radius,dir.length(),radius);
  }
  function limb(mat,radius){
    const m=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,10),mat);
    m.castShadow=true;m.receiveShadow=true;m.userData.radius=radius;return m;
  }
  function markPick(group,role){
    group.traverse(o=>{if(o.isMesh&&!o.userData.pickRole)o.userData.pickRole=role;});
    return group;
  }
  function layoutItem(role,sprite){
    if(typeof ROOM_LAYOUT!=="object")return null;
    return (ROOM_LAYOUT.items||[]).find(it=>it.role===role||(sprite&&it.sprite===sprite));
  }
  function layoutPosition(role,sprite,fallbackX,fallbackZ){
    const item=layoutItem(role,sprite);
    if(!item)return new THREE.Vector3(fallbackX||0,0,fallbackZ||0);
    return new THREE.Vector3((item.x-272)/31,0,(item.y-176)/28);
  }
  function place(group,role,sprite,x,z){
    group.position.copy(layoutPosition(role,sprite,x,z));
    scene.add(group);objects[role||sprite]=group;return group;
  }
  function line(color){
    const geometry=new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()
    ]);
    const result=new THREE.Line(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity:.9}));
    scene.add(result);return result;
  }
  function setLine(target,a,b,lift){
    const middle=a.clone().lerp(b,.5);middle.y+=lift||.25;
    target.geometry.setFromPoints([a,middle,b]);
    target.visible=true;
  }

  function createRoom(){
    const floorMat=material("floor",C.floor),gridMat=new THREE.LineBasicMaterial({color:C.grid,transparent:true,opacity:.55});
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(17.4,10.8),floorMat);
    floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
    const gridPoints=[];
    for(let x=-8.4;x<=8.4;x+=1.2)gridPoints.push(new THREE.Vector3(x,.012,-5.2),new THREE.Vector3(x,.012,5.2));
    for(let z=-5.2;z<=5.2;z+=1.2)gridPoints.push(new THREE.Vector3(-8.4,.012,z),new THREE.Vector3(8.4,.012,z));
    const grid=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gridPoints),gridMat);scene.add(grid);

    const wallMat=material("wall",C.wall),edgeMat=material("wallEdge",C.wallEdge);
    const back=box(17.4,4.2,.18,wallMat);back.position.set(0,2.1,-5.3);scene.add(back);
    const left=box(.18,4.2,10.6,wallMat);left.position.set(-8.7,2.1,0);scene.add(left);
    const rail=box(17.1,.12,.14,edgeMat);rail.position.set(0,1.15,-5.17);scene.add(rail);
    const gas=box(2,.65,.18,material("gasPanel",C.white));gas.position.set(-3.4,2.1,-5.06);scene.add(gas);
    [-3.85,-3.3,-2.75].forEach((x,i)=>{
      const port=cylinder(.13,.12,material(i===0?"oxygen":i===1?"air":"vacuum",i===0?0x3C9B5F:i===1?0xD6D9D7:0xE0C14F),14);
      port.rotation.x=Math.PI/2;port.position.set(x,2.1,-4.94);scene.add(port);
    });

    const monitor=new THREE.Group();
    const frame=box(2.3,1.25,.25,material("dark",C.dark));frame.position.y=2.7;monitor.add(frame);
    const screen=box(1.95,.92,.08,material("screen",C.screen,{emissive:0x071A12,emissiveIntensity:.8}));
    screen.position.set(0,2.7,.17);monitor.add(screen);
    monitor.position.set(2.3,0,-5.0);scene.add(monitor);
    const points=[];for(let i=0;i<48;i++)points.push(new THREE.Vector3(-.88+i*.037,2.7,-4.78));
    monitorTrace=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({color:0x35E08E}));scene.add(monitorTrace);

    const sign=box(1.9,.5,.12,material("sign",0x2F6F65));sign.position.set(-6.2,3.15,-5.08);scene.add(sign);
    const lightMat=material("lightPanel",0xFFFBE8,{emissive:0xFFF3B0,emissiveIntensity:.45});
    [[-2.8,3.9,-1],[2.8,3.9,1.2]].forEach(p=>{
      const light=box(2.4,.08,.8,lightMat);light.position.set(p[0],p[1],p[2]);scene.add(light);
    });
  }

  function createBed(){
    const g=new THREE.Group(),metal=material("metal",C.metal),white=material("white",C.white);
    const frame=box(2.7,.18,4.5,metal);frame.position.y=.55;g.add(frame);
    const mattress=box(2.45,.25,4.15,white);mattress.position.y=.78;g.add(mattress);
    const pillow=box(1.55,.22,.75,material("pillow",0xE5EBE7));pillow.position.set(0,.98,-1.55);g.add(pillow);
    [-1.42,1.42].forEach(x=>{
      const rail=box(.08,.48,2.5,metal);rail.position.set(x,1.08,.1);g.add(rail);
    });
    [[-1.12,-1.85],[1.12,-1.85],[-1.12,1.85],[1.12,1.85]].forEach(p=>{
      const leg=cylinder(.07,.65,metal,10);leg.position.set(p[0],.27,p[1]);g.add(leg);
      const wheel=cylinder(.14,.08,material("wheel",C.dark),12);wheel.rotation.z=Math.PI/2;wheel.position.set(p[0],.08,p[1]);g.add(wheel);
    });
    place(markPick(g,"bed"),"bed",null,0,0);
  }

  function createPatient(){
    const skin=material("skin",C.skin),gown=material("gown",C.gown),hair=material("hair",C.hair);
    const g=new THREE.Group();g.position.set(0,.98,0);
    patientTorso=box(1.15,.42,1.55,gown);patientTorso.position.set(0,.13,-.18);g.add(patientTorso);
    const pelvis=box(.94,.36,.75,gown);pelvis.position.set(0,.1,.95);g.add(pelvis);
    const neck=cylinder(.16,.3,skin,12);neck.rotation.x=Math.PI/2;neck.position.set(0,.1,-1.08);g.add(neck);
    const head=sphere(.38,skin,18);head.scale.set(.9,.75,1.08);head.position.set(0,.15,-1.48);g.add(head);
    const hairCap=sphere(.385,hair,16);hairCap.scale.set(.92,.38,1.08);hairCap.position.set(0,.36,-1.51);g.add(hairCap);
    const limbMat=skin;
    [[new THREE.Vector3(-.48,.1,-.55),new THREE.Vector3(-1.03,.06,.48)],
      [new THREE.Vector3(.48,.1,-.55),new THREE.Vector3(1.03,.06,.48)],
      [new THREE.Vector3(-.28,.08,1.18),new THREE.Vector3(-.38,.06,1.92)],
      [new THREE.Vector3(.28,.08,1.18),new THREE.Vector3(.38,.06,1.92)]].forEach(pair=>{
        const part=limb(limbMat,.13);setCylinder(part,pair[0],pair[1],.13);g.add(part);
      });
    pads=new THREE.Group();
    const padMat=material("pad",0xF4EFE4);
    [[-.34,.38,-.62],[.34,.38,.12]].forEach(p=>{const pad=box(.36,.05,.46,padMat);pad.position.set(p[0],p[1],p[2]);pads.add(pad);});
    g.add(pads);
    airwayMask=sphere(.25,material("mask",0x87C8D0,{transparent:true,opacity:.62}),14);
    airwayMask.scale.set(.8,.45,1.15);airwayMask.position.set(0,.39,-1.77);g.add(airwayMask);
    airwayTube=cylinder(.055,.75,material("tube",0xEDE9D7),10);
    airwayTube.rotation.x=Math.PI/2;airwayTube.position.set(.03,.39,-1.98);g.add(airwayTube);
    ventBag=sphere(.28,material("bag",0x8BC7D5,{transparent:true,opacity:.76}),14);
    ventBag.scale.set(.7,.8,1.45);ventBag.position.set(.38,.55,-2.16);g.add(ventBag);
    accessPatch=box(.2,.06,.28,material("access",0xEDE9D7));accessPatch.position.set(1.02,.21,.38);g.add(accessPatch);
    patient=place(g,"patient",null,0,0);patient.position.y=.98;

    lucas=new THREE.Group();
    const lucasWhite=material("lucasWhite",0xF4F5F2),lucasDark=material("lucasDark",0x373A38);
    [-.82,.82].forEach(x=>{const post=box(.15,1.35,.18,lucasWhite);post.position.set(x,1.42,-.18);lucas.add(post);});
    const bridge=box(1.8,.18,.25,lucasWhite);bridge.position.set(0,2.05,-.18);lucas.add(bridge);
    piston=cylinder(.16,.78,lucasDark,14);piston.position.set(0,1.56,-.18);lucas.add(piston);
    const cup=cylinder(.31,.12,lucasDark,16);cup.position.set(0,1.14,-.18);lucas.add(cup);
    scene.add(markPick(lucas,"bed"));
  }

  function createStaff(role){
    const col=ROLE_COLOR[role]||ROLE_COLOR.doctor;
    const cloth=material("role-"+role,col),skin=material("skin",C.skin),dark=material("dark",C.dark);
    const g=new THREE.Group();
    const torso=new THREE.Mesh(new THREE.CylinderGeometry(.34,.46,1.05,10),cloth);
    torso.position.y=1.35;torso.castShadow=true;g.add(torso);
    const head=sphere(.28,skin,14);head.position.y=2.08;g.add(head);
    const cap=sphere(.285,role==="airway_staff"||role==="narkos_ssk"||role==="surgeon"?material("cap-"+role,col):material("hair",C.hair),14);
    cap.scale.y=.42;cap.position.y=2.23;g.add(cap);
    [-.18,.18].forEach(x=>{
      const leg=limb(dark,.1);setCylinder(leg,new THREE.Vector3(x,.85,0),new THREE.Vector3(x,.1,0),.1);g.add(leg);
      const shoe=box(.22,.12,.38,dark);shoe.position.set(x,.08,.1);g.add(shoe);
    });
    const armL=limb(cloth,.085),armR=limb(cloth,.085);g.add(armL,armR);
    const handL=sphere(.105,skin,10),handR=sphere(.105,skin,10);g.add(handL,handR);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.52,.62,28),
      new THREE.MeshBasicMaterial({color:C.green,transparent:true,opacity:0,side:THREE.DoubleSide}));
    ring.rotation.x=-Math.PI/2;ring.position.y=.025;g.add(ring);
    g.userData={role,torso,armL,armR,handL,handR,ring,baseY:0};
    markPick(g,role);staff[role]=g;
    const pos=layoutPosition(role,null,0,0);g.position.copy(pos);
    scene.add(g);return g;
  }
  function poseStaff(g,target,active,compressing){
    if(!g)return;
    const data=g.userData;
    const dx=target.x-g.position.x,dz=target.z-g.position.z;
    g.rotation.y=Math.atan2(dx,dz);
    g.updateMatrixWorld(true);
    const localTarget=g.worldToLocal(target.clone());
    const shoulderL=new THREE.Vector3(-.34,1.63,0),shoulderR=new THREE.Vector3(.34,1.63,0);
    let handL,handR;
    if(active){
      handL=localTarget.clone().add(new THREE.Vector3(-.14,compressing ? .08 : .15,0));
      handR=localTarget.clone().add(new THREE.Vector3(.14,compressing ? .08 : .15,0));
    }else{
      handL=new THREE.Vector3(-.48,.98,.08);handR=new THREE.Vector3(.48,.98,.08);
    }
    setCylinder(data.armL,shoulderL,handL,.085);setCylinder(data.armR,shoulderR,handR,.085);
    data.handL.position.copy(handL);data.handR.position.copy(handR);
    data.ring.material.opacity=active ? .78 : 0;
    data.ring.material.color.setHex(compressing?C.red:C.green);
  }

  function equipmentFrame(color,w,h,d){
    const g=new THREE.Group(),body=box(w,h,d,material("equipment-"+color,color));body.position.y=h/2+.25;g.add(body);
    [-w*.32,w*.32].forEach(x=>[-d*.32,d*.32].forEach(z=>{
      const wheel=sphere(.1,material("wheel",C.dark),10);wheel.position.set(x,.1,z);g.add(wheel);
    }));
    return g;
  }
  function createEquipment(){
    const screen=material("screen",C.screen,{emissive:0x061B13,emissiveIntensity:.8});

    const cart=equipmentFrame(C.red,1.35,1.35,.82);
    for(let y=.55;y<1.45;y+=.3){const seam=box(1.15,.035,.85,material("cartSeam",0xE8958E));seam.position.y=y;cart.add(seam);}
    place(markPick(cart,"crash_cart"),"crash_cart","crashcart",-6,-3);

    const defib=equipmentFrame(C.red,1.25,1.15,.82);
    defibScreen=box(.82,.5,.05,material("defibScreen",C.screen,{emissive:0x061B13,emissiveIntensity:.8}));
    defibScreen.position.set(0,1.05,-.44);defibScreen.rotation.x=-.12;defib.add(defibScreen);
    defibLamp=sphere(.09,material("defibLamp",0xEEE9D7,{emissive:0x000000}),10);defibLamp.position.set(.42,.76,-.45);defib.add(defibLamp);
    const charge=box(.42,.12,.12,material("charge",C.red,{emissive:0x5A0804,emissiveIntensity:.5}));
    charge.position.set(0,.69,-.48);charge.userData.pickRole="ladda_button";defib.add(charge);
    place(markPick(defib,"defib"),"defib",null,6.4,-3);

    const us=equipmentFrame(0xD9E2DE,1.2,1.5,.82);
    const usScreen=box(.86,.62,.06,screen);usScreen.position.set(0,1.36,-.44);us.add(usScreen);
    ultrasoundProbe=cylinder(.08,.52,material("probe",0x52615A),10);ultrasoundProbe.rotation.z=Math.PI/2;ultrasoundProbe.position.set(-.72,1.05,0);us.add(ultrasoundProbe);
    place(markPick(us,"ultrasound"),"ultrasound",null,7,1);

    const vent=equipmentFrame(0xD9E2DE,1.1,1.5,.75);
    const ventScreen=box(.75,.45,.05,screen);ventScreen.position.set(0,1.35,-.4);vent.add(ventScreen);
    place(vent,"ventilator","ventilator",4.4,-.9);

    const pole=new THREE.Group();
    const stem=cylinder(.045,2.4,material("metal",C.metal),10);stem.position.y=1.3;pole.add(stem);
    const hook=box(.7,.05,.05,material("metal",C.metal));hook.position.y=2.48;pole.add(hook);
    const bag=box(.42,.65,.12,material("fluid",0xA5D5E8,{transparent:true,opacity:.72}));bag.position.set(-.22,2.06,0);pole.add(bag);
    place(pole,"iv_pole",null,-3,-.9);

    const oxygen=new THREE.Group();
    const bottle=cylinder(.27,1.35,material("oxygen",0x3B9B60),14);bottle.position.y=.8;oxygen.add(bottle);
    const valve=box(.25,.18,.25,material("metal",C.metal));valve.position.y=1.55;oxygen.add(valve);
    place(oxygen,"o2_cyl",null,-7.8,-.9);

    const sink=new THREE.Group();
    const basin=box(1.45,.35,.8,material("sink",0xDCE5E1));basin.position.y=.9;sink.add(basin);
    const bowl=cylinder(.42,.1,material("metal",C.metal),20);bowl.position.y=1.1;sink.add(bowl);
    const tap=cylinder(.05,.55,material("metal",C.metal),10);tap.position.set(0,1.38,.22);sink.add(tap);
    place(sink,"sink","sink",-4,-4);

    const computer=equipmentFrame(0xD6DEDA,.9,.65,.7);
    const computerScreen=box(.72,.48,.05,screen);computerScreen.position.set(0,1.15,-.38);computer.add(computerScreen);
    place(computer,"computer","computer",7.6,3);

    const stool=new THREE.Group(),seat=cylinder(.42,.18,material("stool",0x66867E),18);seat.position.y=.62;stool.add(seat);
    const stoolLeg=cylinder(.08,.58,material("metal",C.metal),10);stoolLeg.position.y=.3;stool.add(stoolLeg);
    place(stool,"stool","stool",6.3,2.6);
  }

  function createDynamicLines(){
    padCable=line(0x606C67);ivLine=line(0x76B7CF);usCable=line(0x56645D);
    padCable.visible=ivLine.visible=usCable.visible=false;
  }
  function createLights(){
    scene.add(new THREE.HemisphereLight(0xFFFDF4,0x63736A,.82));
    const key=new THREE.DirectionalLight(0xFFF7DF,1.28);key.position.set(-5,11,5);
    key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-10;key.shadow.camera.right=10;
    key.shadow.camera.top=8;key.shadow.camera.bottom=-8;scene.add(key);
    clockLight=new THREE.PointLight(0xCDEDDD,.35,8);clockLight.position.set(0,3.5,-1);scene.add(clockLight);
    shockLight=new THREE.PointLight(0xFFF2D0,0,16);shockLight.position.set(0,5,0);scene.add(shockLight);
  }
  function init(){
    if(API.ready||API.failed)return API.ready;
    canvas=document.getElementById("room3d");
    if(!canvas||typeof THREE==="undefined"){API.failed=true;return false;}
    try{
      renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:"high-performance"});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
      renderer.outputEncoding=THREE.sRGBEncoding;
      renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      renderer.setClearColor(C.floor,1);
      scene=new THREE.Scene();scene.fog=new THREE.Fog(0xE3E9E5,18,30);
      camera=new THREE.OrthographicCamera(-10.2,10.2,6,-6,.1,60);
      camera.position.set(10.5,14.5,12.5);camera.lookAt(0,.8,0);
      raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();
      createRoom();createBed();createPatient();createEquipment();
      ["airway_staff","compressor","doctor","nurse_ssk","ambulance","narkos_ssk","surgeon"].forEach(createStaff);
      createDynamicLines();createLights();
      canvas.addEventListener("webglcontextlost",e=>{e.preventDefault();API.failed=true;API.ready=false;});
      window.addEventListener("resize",resize);
      API.ready=true;resize();return true;
    }catch(error){
      console.warn("HLR 3D kunde inte starta, använder Canvas-fallback.",error);
      API.failed=true;return false;
    }
  }
  function resize(){
    if(!renderer||!canvas)return;
    const width=Math.max(1,Math.round(canvas.clientWidth||560));
    const height=Math.max(1,Math.round(canvas.clientHeight||330));
    if(width===lastWidth&&height===lastHeight)return;
    lastWidth=width;lastHeight=height;renderer.setSize(width,height,false);
    const aspect=width/height,frustum=11.2;
    camera.left=-frustum*aspect/2;camera.right=frustum*aspect/2;
    camera.top=frustum/2;camera.bottom=-frustum/2;camera.updateProjectionMatrix();
  }
  function queueBusy(role){
    return typeof roleBusy==="function"&&roleBusy(role);
  }
  function ownerFor(role){
    if(role==="doctor")return "lakare";
    if(role==="nurse_ssk")return "ssk";
    if(role==="ambulance")return "ambulans";
    if(role==="narkos_ssk")return "ivassk";
    if(role==="surgeon")return "kirurg";
    if(role==="airway_staff")return typeof available==="function"&&available("narkos")?"narkos":"ambulans";
    if(role==="compressor")return typeof compressor==="function"&&compressor()||"usk";
    return null;
  }
  function updateStaff(){
    const chest=new THREE.Vector3(0,1.45,-.18),head=new THREE.Vector3(0,1.38,-1.65);
    Object.keys(staff).forEach(role=>{
      const g=staff[role];
      g.visible=role==="narkos_ssk"?!!S.teamArrived:role==="surgeon"?!!S.surgeonPresent:role==="compressor"?!S.lucas:true;
      if(!g.visible)return;
      const owner=ownerFor(role),compressing=role==="compressor"&&S.comp&&!S.lucas&&!S.rosc;
      const ventilating=role==="airway_staff"&&S.vent&&!S.rosc;
      const active=compressing||ventilating||(owner&&queueBusy(owner));
      const target=compressing?chest:ventilating?head:new THREE.Vector3(0,1.2,0);
      const press=compressing?Math.max(0,Math.sin(typeof compPhase==="number"?compPhase:0)):0;
      g.position.y=compressing?-press*.1:0;
      poseStaff(g,target,active,compressing);
      g.userData.torso.rotation.x=active ? .08 : 0;
    });
  }
  function updatePatient(){
    patient.visible=!!S.patientPresent;
    if(!patient.visible){lucas.visible=false;return;}
    const phase=typeof compPhase==="number"?compPhase:0;
    const press=S.comp?Math.max(0,Math.sin(phase)):0;
    patientTorso.scale.y=1-press*.22;
    patientTorso.position.y=.13-press*.04;
    pads.visible=!!S.pads;
    airwayMask.visible=S.airway==="mask"||S.airway==="igel";
    airwayTube.visible=S.airway==="tub"||S.airway==="koniotomi";
    ventBag.visible=!!S.vent;
    ventBag.scale.y=.8*(S.vent?1-.16*Math.max(0,Math.sin(phase/5)):1);
    accessPatch.visible=!!S.access;
    lucas.visible=!!S.lucas&&!S.rosc;
    if(lucas.visible)piston.position.y=1.56-press*.22;

    if(S.pads){
      const defibPos=objects.defib.position.clone().add(new THREE.Vector3(0,1,-.45));
      setLine(padCable,defibPos,new THREE.Vector3(.34,1.38,.12),.45);
    }else padCable.visible=false;
    if(S.access){
      const pole=objects.iv_pole.position.clone().add(new THREE.Vector3(-.2,2.05,0));
      setLine(ivLine,pole,new THREE.Vector3(1.02,1.2,.38),.65);
    }else ivLine.visible=false;
    if(S.usActive){
      const us=objects.ultrasound.position.clone().add(new THREE.Vector3(-.65,1.05,0));
      setLine(usCable,us,new THREE.Vector3(.48,1.35,.15),.3);
      ultrasoundProbe.visible=true;
    }else{usCable.visible=false;ultrasoundProbe.visible=true;}
  }
  function updateEquipment(){
    objects.iv_pole.visible=!!S.access;
    objects.o2_cyl.visible=!!S.o2Safe;
    defibLamp.material.color.setHex(S.charged?0xFFE168:S.charging?0xFF7A70:0xEEE9D7);
    defibLamp.material.emissive.setHex(S.charged?0xB98700:S.charging?0x8E120A:0);
    defibScreen.material.emissiveIntensity=S.pads?1.35:.35;
  }
  function updateMonitor(){
    if(!monitorTrace)return;
    const position=monitorTrace.geometry.attributes.position;
    const rhythm=S.rhythm,active=S.pads;
    for(let i=0;i<position.count;i++){
      const x=-.88+i*.037,t=(S.t||0)*2+i*.13;
      let value=0;
      if(active){
        if(rhythm==="VF")value=Math.sin(t*2.7)*.12+Math.sin(t*5.1)*.1;
        else if(rhythm==="asystoli")value=Math.sin(t*.8)*.015;
        else{const p=((t%3)+3)%3;value=p<.18?Math.sin(p/.18*Math.PI)*.25:Math.sin(t)*.025;}
      }
      position.setXYZ(i,x,2.7+value,-4.78);
    }
    position.needsUpdate=true;monitorTrace.material.opacity=active?1:.28;monitorTrace.material.transparent=true;
  }
  function render(){
    if(!init())return false;
    if(API.failed)return false;
    resize();updateStaff();updatePatient();updateEquipment();updateMonitor();
    const flash=Math.max(0,S.shockFlash||0);
    shockLight.intensity=flash*8;
    clockLight.color.setHex(S.rosc?0x82E39D:0xCDEDDD);
    clockLight.intensity=S.rosc?1.2:.35;
    renderer.render(scene,camera);return true;
  }
  function pick(event){
    if(!API.ready||API.failed||!canvas)return null;
    const rect=canvas.getBoundingClientRect();
    pointer.x=((event.clientX-rect.left)/rect.width)*2-1;
    pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects(scene.children,true);
    for(const hit of hits){
      let visible=true,node=hit.object;
      for(let parent=node;parent;parent=parent.parent){
        if(!parent.visible){visible=false;break;}
      }
      if(!visible)continue;
      while(node){
        if(node.userData&&node.userData.pickRole)return node.userData.pickRole;
        node=node.parent;
      }
    }
    return null;
  }
  function setVisible(visible){
    if(!canvas)return;
    canvas.classList.toggle("room-view-hidden",!visible);
  }
  API.init=init;API.render=render;API.pick=pick;API.setVisible=setVisible;API.resize=resize;
  return API;
})();
