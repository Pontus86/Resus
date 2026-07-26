/* Riktig 3D-vy för akutrummet. Modellerna byggs av små Three.js-meshar så att scenen
   fungerar via file:// utan modellhämtning, byggsteg eller tungt minnesbehov. */
const HLRRoom3D=(()=>{
  const API={ready:false,failed:false};
  const objects={},staff={},materials={};
  let canvas,renderer,scene,camera,raycaster,pointer,clockLight,shockLight;
  let patient,patientTorso,lucas,piston,pads,airwayMask,airwayTube,ventBag,accessPatch;
  let padCable,ivLine,usCable,ventCircuit,monitorTrace,defibTrace;
  let defibScreen,defibLamp,defibChargeButton,ultrasoundProbe,lucasLamp;
  let postScene,postCamera,postQuad,sceneTarget,bloomTargetA,bloomTargetB;
  let brightMaterial,blurMaterial,compositeMaterial,postFXReady=false;
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
  const LAYOUT_SPREAD=.84,MODEL_SCALE=1.08;
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
  function tube(a,b,radius,mat,segments){
    const result=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,segments||12),mat);
    result.castShadow=true;result.receiveShadow=true;
    setCylinder(result,a,b,radius);return result;
  }
  function markPick(group,role){
    group.traverse(o=>{if(o.isMesh&&!o.userData.pickRole)o.userData.pickRole=role;});
    return group;
  }
  function layoutItem(role,sprite){
    if(typeof ROOM_LAYOUT!=="object")return null;
    return (ROOM_LAYOUT.items||[]).find(it=>it.role===role||(sprite&&it.sprite===sprite));
  }
  function authoredObject(role){
    if(typeof HLR_ROOM3D_LAYOUT!=="object"||!HLR_ROOM3D_LAYOUT.objects)return null;
    return HLR_ROOM3D_LAYOUT.objects[role]||null;
  }
  function applyAuthoredTransform(group,role,baseScale){
    const data=authoredObject(role),scale=baseScale===undefined?1:baseScale;
    if(!data){group.scale.multiplyScalar(scale);return false;}
    group.position.fromArray(data.position);
    group.quaternion.fromArray(data.quaternion);
    group.scale.fromArray(data.scale);
    return true;
  }
  function layoutPosition(role,sprite,fallbackX,fallbackZ){
    const item=layoutItem(role,sprite);
    const x=item?(item.x-272)/31:(fallbackX||0);
    const z=item?(item.y-176)/28:(fallbackZ||0);
    return new THREE.Vector3(x*LAYOUT_SPREAD,0,z*LAYOUT_SPREAD);
  }
  function place(group,role,sprite,x,z){
    group.position.copy(layoutPosition(role,sprite,x,z));
    applyAuthoredTransform(group,role||sprite,MODEL_SCALE);
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

  function initPostFX(){
    try{
      const targetOptions={minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat};
      sceneTarget=new THREE.WebGLRenderTarget(1,1,Object.assign({depthBuffer:true},targetOptions));
      bloomTargetA=new THREE.WebGLRenderTarget(1,1,Object.assign({depthBuffer:false},targetOptions));
      bloomTargetB=new THREE.WebGLRenderTarget(1,1,Object.assign({depthBuffer:false},targetOptions));
      const vertexShader="varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}";
      brightMaterial=new THREE.ShaderMaterial({
        uniforms:{tInput:{value:null}},
        vertexShader,
        fragmentShader:[
          "uniform sampler2D tInput;varying vec2 vUv;",
          "void main(){vec3 c=texture2D(tInput,vUv).rgb;",
          "float b=max(max(c.r,c.g),c.b);float glow=smoothstep(.72,.98,b);",
          "gl_FragColor=vec4(c*glow,1.0);}"
        ].join("\n"),
        depthTest:false,depthWrite:false,toneMapped:false
      });
      blurMaterial=new THREE.ShaderMaterial({
        uniforms:{tInput:{value:null},texel:{value:new THREE.Vector2(1,1)},direction:{value:new THREE.Vector2(1,0)}},
        vertexShader,
        fragmentShader:[
          "uniform sampler2D tInput;uniform vec2 texel;uniform vec2 direction;varying vec2 vUv;",
          "void main(){vec2 o=texel*direction;vec3 c=texture2D(tInput,vUv).rgb*.227027;",
          "c+=(texture2D(tInput,vUv+o*1.384615).rgb+texture2D(tInput,vUv-o*1.384615).rgb)*.316216;",
          "c+=(texture2D(tInput,vUv+o*3.230769).rgb+texture2D(tInput,vUv-o*3.230769).rgb)*.070270;",
          "gl_FragColor=vec4(c,1.0);}"
        ].join("\n"),
        depthTest:false,depthWrite:false,toneMapped:false
      });
      compositeMaterial=new THREE.ShaderMaterial({
        uniforms:{tScene:{value:null},tBloom:{value:null},bloomStrength:{value:.28}},
        vertexShader,
        fragmentShader:[
          "uniform sampler2D tScene;uniform sampler2D tBloom;uniform float bloomStrength;varying vec2 vUv;",
          "void main(){vec3 base=texture2D(tScene,vUv).rgb;vec3 bloom=texture2D(tBloom,vUv).rgb;",
          "float l=dot(base,vec3(.2126,.7152,.0722));base=mix(vec3(l),base,1.055);",
          "base=(base-.5)*1.035+.5;float d=distance(vUv,vec2(.5));",
          "float vignette=1.0-smoothstep(.28,.74,d);base*=mix(.88,1.015,vignette);",
          "gl_FragColor=vec4(base+bloom*bloomStrength,1.0);",
          "#include <tonemapping_fragment>",
          "#include <encodings_fragment>",
          "}"
        ].join("\n"),
        depthTest:false,depthWrite:false
      });
      postScene=new THREE.Scene();postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
      postQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),brightMaterial);
      postQuad.frustumCulled=false;postScene.add(postQuad);
      postFXReady=true;
    }catch(error){
      console.warn("HLR 3D efterbehandling kunde inte starta, använder direkt rendering.",error);
      postFXReady=false;
    }
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
    const gasGroup=new THREE.Group();
    const gas=box(2,.65,.18,material("gasPanel",C.white));gasGroup.add(gas);
    [-.45,.1,.65].forEach((x,i)=>{
      const port=cylinder(.13,.12,material(i===0?"oxygen":i===1?"air":"vacuum",i===0?0x3C9B5F:i===1?0xD6D9D7:0xE0C14F),14);
      port.rotation.x=Math.PI/2;port.position.set(x,0,.12);gasGroup.add(port);
    });
    gasGroup.position.set(-3.4,2.1,-5.06);applyAuthoredTransform(gasGroup,"gas_panel");scene.add(gasGroup);

    const monitor=new THREE.Group();
    const frame=box(2.3,1.25,.25,material("dark",C.dark));monitor.add(frame);
    const screen=box(1.95,.92,.08,material("screen",C.screen,{emissive:0x071A12,emissiveIntensity:.8}));
    screen.position.set(0,0,.17);monitor.add(screen);
    monitor.position.set(2.3,2.7,-5.0);applyAuthoredTransform(monitor,"monitor_wall");scene.add(monitor);
    const points=[];for(let i=0;i<48;i++)points.push(new THREE.Vector3(-.88+i*.037,0,.22));
    monitorTrace=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({color:0x35E08E}));monitor.add(monitorTrace);

    const sign=box(1.9,.5,.12,material("sign",0x2F6F65));sign.position.set(-6.2,3.15,-5.08);
    applyAuthoredTransform(sign,"sign");scene.add(sign);
    const lightMat=material("lightPanel",0xFFFBE8,{emissive:0xFFF3B0,emissiveIntensity:.45});
    // Lamporna har egna Blender-kontroller eftersom deras projektion lätt kan skymma teamet.
    [[-3.3,4.15,-3.0,"ceiling_light_left"],[2.6,4.15,-3.4,"ceiling_light_right"]].forEach(p=>{
      const light=box(2.4,.08,.8,lightMat);light.position.set(p[0],p[1],p[2]);
      applyAuthoredTransform(light,p[3]);scene.add(light);
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
    patient=place(g,"patient",null,0,0);
    if(!authoredObject("patient"))patient.position.y=.98;

    lucas=new THREE.Group();
    const lucasWhite=material("lucasWhite",0xE8ECE8,{roughness:.38});
    const lucasDark=material("lucasDark",0x252A28,{roughness:.55});
    const lucasMetal=material("lucasMetal",0x87938E,{roughness:.32,metalness:.62});
    const lucasBlue=material("lucasBlue",0x307AA3,{roughness:.42});
    const backplate=box(1.72,.09,1.08,lucasDark);backplate.position.set(0,1.01,-.18);lucas.add(backplate);
    [-1,1].forEach(side=>{
      const lowerA=new THREE.Vector3(side*.73,1.04,-.18),lowerB=new THREE.Vector3(side*.99,1.47,-.18);
      const upperB=new THREE.Vector3(side*.76,1.96,-.18);
      lucas.add(tube(lowerA,lowerB,.085,lucasWhite,14),tube(lowerB,upperB,.085,lucasWhite,14));
      const lock=cylinder(.13,.18,lucasBlue,14);lock.rotation.z=Math.PI/2;
      lock.position.set(side*.93,1.5,-.18);lucas.add(lock);
      const strap=box(.11,.035,.92,material("lucasStrap",0x1D2321));strap.position.set(side*.56,1.08,-.18);
      lucas.add(strap);
    });
    const topHousing=box(1.48,.3,.48,lucasWhite);topHousing.position.set(0,1.97,-.18);lucas.add(topHousing);
    const topInset=box(.72,.17,.5,lucasDark);topInset.position.set(0,1.95,-.18);lucas.add(topInset);
    const battery=box(.38,.34,.36,lucasBlue);battery.position.set(.51,2.16,-.18);lucas.add(battery);
    const control=box(.42,.18,.035,lucasDark);control.position.set(-.45,2.08,.079);lucas.add(control);
    lucasLamp=sphere(.045,material("lucasLamp",0x5CC98A,{emissive:0x174F30,emissiveIntensity:.9}),10);
    lucasLamp.position.set(-.53,2.1,.105);lucas.add(lucasLamp);
    const motor=cylinder(.23,.38,lucasMetal,18);motor.position.set(0,1.73,-.18);lucas.add(motor);
    piston=new THREE.Group();
    const bellows=cylinder(.18,.42,lucasDark,18);bellows.position.y=.04;piston.add(bellows);
    const shaft=cylinder(.07,.35,lucasMetal,14);shaft.position.y=-.29;piston.add(shaft);
    const cup=cylinder(.3,.13,lucasDark,20);cup.position.y=-.5;piston.add(cup);
    const cupLip=new THREE.Mesh(new THREE.TorusGeometry(.26,.045,8,20),lucasDark);
    cupLip.rotation.x=Math.PI/2;cupLip.position.y=-.57;cupLip.castShadow=true;piston.add(cupLip);
    piston.position.set(0,1.61,-.18);lucas.add(piston);
    applyAuthoredTransform(lucas,"lucas",MODEL_SCALE);
    scene.add(markPick(lucas,"bed"));
  }

  function createStaff(role){
    const col=ROLE_COLOR[role]||ROLE_COLOR.doctor;
    const cloth=material("role-"+role,col),skin=material("skin",C.skin),dark=material("dark",C.dark);
    const g=new THREE.Group();
    const pelvis=sphere(.37,cloth,14);pelvis.scale.set(1,.72,.72);pelvis.position.y=1.12;g.add(pelvis);
    const torso=new THREE.Mesh(new THREE.CylinderGeometry(.32,.45,.72,14),cloth);
    torso.position.y=1.52;torso.castShadow=true;g.add(torso);
    const shoulders=sphere(.46,cloth,14);shoulders.scale.set(1,.6,.68);shoulders.position.y=1.7;g.add(shoulders);
    const collar=new THREE.Mesh(new THREE.TorusGeometry(.13,.026,8,18),dark);
    collar.rotation.x=Math.PI/2;collar.position.set(0,1.84,.02);g.add(collar);
    const neck=cylinder(.115,.18,skin,12);neck.position.y=1.94;g.add(neck);
    const head=sphere(.29,skin,18);head.scale.set(.9,1.08,.9);head.position.y=2.17;g.add(head);
    const jaw=sphere(.22,skin,14);jaw.scale.set(.9,.78,.88);jaw.position.set(0,2.06,.035);g.add(jaw);
    const nose=sphere(.05,skin,10);nose.scale.set(.75,1,1.25);nose.position.set(0,2.18,.275);g.add(nose);
    [-.1,.1].forEach(x=>{
      const eye=sphere(.024,dark,8);eye.scale.set(1,.72,.45);eye.position.set(x,2.22,.266);g.add(eye);
      const ear=sphere(.05,skin,8);ear.scale.set(.45,1,.7);ear.position.set(x<0?-.27:.27,2.18,0);g.add(ear);
    });
    const cap=sphere(.295,role==="airway_staff"||role==="narkos_ssk"||role==="surgeon"?material("cap-"+role,col):material("hair",C.hair),16);
    cap.scale.set(1,.48,1);cap.position.y=2.36;g.add(cap);
    [-.18,.18].forEach(x=>{
      const thigh=limb(cloth,.135);setCylinder(thigh,new THREE.Vector3(x,1.15,0),new THREE.Vector3(x,.74,0),.135);g.add(thigh);
      const knee=sphere(.13,cloth,10);knee.position.set(x,.71,0);g.add(knee);
      const shin=limb(cloth,.105);setCylinder(shin,new THREE.Vector3(x,.68,0),new THREE.Vector3(x,.14,0),.105);g.add(shin);
      const shoe=box(.23,.13,.4,dark);shoe.position.set(x,.08,.1);g.add(shoe);
    });
    const upperArmL=limb(cloth,.115),upperArmR=limb(cloth,.115);
    const foreArmL=limb(skin,.09),foreArmR=limb(skin,.09);
    g.add(upperArmL,upperArmR,foreArmL,foreArmR);
    const handL=sphere(.105,skin,10),handR=sphere(.105,skin,10);g.add(handL,handR);
    handL.scale.set(.82,1.12,.78);handR.scale.copy(handL.scale);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.52,.62,28),
      new THREE.MeshBasicMaterial({color:C.green,transparent:true,opacity:0,side:THREE.DoubleSide}));
    ring.rotation.x=-Math.PI/2;ring.position.y=.025;g.add(ring);
    g.userData={role,torso,upperArmL,upperArmR,foreArmL,foreArmR,handL,handR,ring,baseY:0};
    markPick(g,role);staff[role]=g;
    const pos=layoutPosition(role,null,0,0);g.position.copy(pos);
    applyAuthoredTransform(g,role,MODEL_SCALE);
    g.userData.layoutYaw=g.rotation.y;
    scene.add(g);return g;
  }
  function poseStaff(g,target,active,compressing){
    if(!g)return;
    const data=g.userData;
    const dx=target.x-g.position.x,dz=target.z-g.position.z;
    g.rotation.y=active?Math.atan2(dx,dz):data.layoutYaw;
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
    const elbowL=shoulderL.clone().lerp(handL,.52).add(new THREE.Vector3(-.1,.02,.04));
    const elbowR=shoulderR.clone().lerp(handR,.52).add(new THREE.Vector3(.1,.02,.04));
    setCylinder(data.upperArmL,shoulderL,elbowL,.115);setCylinder(data.upperArmR,shoulderR,elbowR,.115);
    setCylinder(data.foreArmL,elbowL,handL,.09);setCylinder(data.foreArmR,elbowR,handR,.09);
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

    const defib=new THREE.Group();
    const defibRed=material("defibRed",0xB93631,{roughness:.42});
    const defibPlastic=material("defibPlastic",0xDDE2DF,{roughness:.38});
    const defibDark=material("defibDark",0x202724,{roughness:.5});
    const defibMetal=material("defibMetal",0x8D9994,{roughness:.28,metalness:.65});
    const base=box(1.3,.16,.82,defibDark);base.position.y=.25;defib.add(base);
    const cabinet=box(1.08,.72,.68,defibRed);cabinet.position.y=.68;defib.add(cabinet);
    [.48,.69,.9].forEach(y=>{
      const seam=box(.93,.025,.015,material("defibSeam",0x7D211E));seam.position.set(0,y,.351);defib.add(seam);
    });
    [[-.5,.22],[.5,.22],[-.5,-.22],[.5,-.22]].forEach(p=>{
      const yoke=box(.1,.2,.1,defibMetal);yoke.position.set(p[0],.14,p[1]);defib.add(yoke);
      const wheel=cylinder(.11,.08,material("wheel",C.dark),14);wheel.rotation.z=Math.PI/2;
      wheel.position.set(p[0],.07,p[1]);defib.add(wheel);
    });
    const mast=box(.16,.47,.18,defibMetal);mast.position.set(0,1.18,0);defib.add(mast);
    const shelf=box(1.3,.1,.78,defibDark);shelf.position.y=1.38;defib.add(shelf);
    const monitorShell=box(1.2,.84,.58,defibPlastic);monitorShell.position.set(0,1.74,.02);
    monitorShell.rotation.x=-.08;defib.add(monitorShell);
    const hood=box(1.08,.68,.08,defibDark);hood.position.set(0,1.78,.33);hood.rotation.x=-.08;defib.add(hood);
    defibScreen=box(.82,.47,.035,material("defibScreen",C.screen,{
      emissive:0x061B13,emissiveIntensity:.8,roughness:.18,metalness:.08
    }));
    defibScreen.position.set(-.09,1.82,.381);defibScreen.rotation.x=-.08;defib.add(defibScreen);
    const tracePoints=[];for(let i=0;i<36;i++)tracePoints.push(new THREE.Vector3(-.46+i*.021,1.82,.405));
    defibTrace=new THREE.Line(new THREE.BufferGeometry().setFromPoints(tracePoints),
      new THREE.LineBasicMaterial({color:0x52E49B,transparent:true,opacity:.28}));defib.add(defibTrace);
    const dial=cylinder(.1,.06,defibDark,18);dial.rotation.x=Math.PI/2;dial.position.set(.48,1.89,.383);defib.add(dial);
    [[.4,1.69,0xE6B53B],[.54,1.69,0x4FAE78]].forEach(p=>{
      const button=cylinder(.055,.035,material("defibButton-"+p[2],p[2],{roughness:.36}),14);
      button.rotation.x=Math.PI/2;button.position.set(p[0],p[1],.388);defib.add(button);
    });
    defibChargeButton=box(.35,.12,.06,material("charge",0xD9473E,{emissive:0x5A0804,emissiveIntensity:.5}));
    defibChargeButton.position.set(.38,1.53,.4);defibChargeButton.userData.pickRole="ladda_button";defib.add(defibChargeButton);
    defibLamp=sphere(.065,material("defibLamp",0xEEE9D7,{emissive:0x000000}),12);
    defibLamp.position.set(.55,1.53,.44);defib.add(defibLamp);
    const handle=box(1.48,.09,.1,defibDark);handle.position.set(0,2.25,-.14);defib.add(handle);
    [-.64,.64].forEach(x=>{
      const grip=box(.16,.19,.3,defibDark);grip.position.set(x,1.43,.04);defib.add(grip);
      const paddle=box(.22,.13,.38,defibPlastic);paddle.position.set(x,1.51,.09);defib.add(paddle);
      const socket=cylinder(.055,.035,defibDark,12);socket.rotation.x=Math.PI/2;
      socket.position.set(x*.67,1.4,.4);defib.add(socket);
    });
    place(markPick(defib,"defib"),"defib",null,6.4,-3);

    const us=new THREE.Group();
    const usBody=material("usBody",0xDCE4E0,{roughness:.4});
    const usDark=material("usDark",0x4D5A54,{roughness:.48});
    const usMetal=material("usMetal",0x8E9B95,{roughness:.3,metalness:.55});
    const usBase=box(1.15,.13,.72,usDark);usBase.position.y=.23;us.add(usBase);
    [[-.44,.2],[.44,.2],[-.44,-.2],[.44,-.2]].forEach(p=>{
      const wheel=cylinder(.1,.07,material("wheel",C.dark),14);wheel.rotation.z=Math.PI/2;
      wheel.position.set(p[0],.08,p[1]);us.add(wheel);
    });
    const usColumn=box(.18,1.05,.18,usMetal);usColumn.position.y=.82;us.add(usColumn);
    const usCabinet=box(.86,.58,.62,usBody);usCabinet.position.set(0,.7,0);us.add(usCabinet);
    const keyboard=box(.9,.08,.45,usDark);keyboard.position.set(0,1.15,.22);keyboard.rotation.x=-.12;us.add(keyboard);
    [0xD9C94B,0x5C91B8,0x35A46F].forEach((color,i)=>{
      const key=cylinder(.035,.025,material("usKey-"+color,color),10);key.rotation.x=Math.PI/2;
      key.position.set(-.18+i*.18,1.2,.45);us.add(key);
    });
    const usArm=tube(new THREE.Vector3(0,1.16,-.03),new THREE.Vector3(0,1.55,.02),.055,usMetal,12);us.add(usArm);
    const usShell=box(1.05,.72,.16,usDark);usShell.position.set(0,1.72,.08);usShell.rotation.x=-.1;us.add(usShell);
    const usScreen=box(.86,.54,.035,screen);usScreen.position.set(0,1.73,.177);usScreen.rotation.x=-.1;us.add(usScreen);
    const scanFan=new THREE.Mesh(new THREE.RingGeometry(.04,.3,24,1,-2.2,1.25),
      new THREE.MeshBasicMaterial({color:0xB9D0C7,transparent:true,opacity:.58,side:THREE.DoubleSide}));
    scanFan.scale.set(.9,.7,1);scanFan.position.set(0,1.7,.202);scanFan.rotation.z=.48;us.add(scanFan);
    const probeHolder=new THREE.Mesh(new THREE.TorusGeometry(.14,.035,8,18),usDark);
    probeHolder.rotation.y=Math.PI/2;probeHolder.position.set(-.65,1.03,.1);probeHolder.castShadow=true;us.add(probeHolder);
    ultrasoundProbe=cylinder(.075,.48,material("probe",0x52615A),12);
    ultrasoundProbe.rotation.z=Math.PI/2;ultrasoundProbe.position.set(-.7,1.02,.08);us.add(ultrasoundProbe);
    place(markPick(us,"ultrasound"),"ultrasound",null,7,1);

    const vent=new THREE.Group();
    const ventBody=material("ventBody",0xD6DFDB,{roughness:.4});
    const ventDark=material("ventDark",0x35423C,{roughness:.5});
    const ventBase=box(1.05,.13,.68,ventDark);ventBase.position.y=.23;vent.add(ventBase);
    [[-.4,.18],[.4,.18],[-.4,-.18],[.4,-.18]].forEach(p=>{
      const wheel=cylinder(.1,.07,material("wheel",C.dark),14);wheel.rotation.z=Math.PI/2;
      wheel.position.set(p[0],.08,p[1]);vent.add(wheel);
    });
    const ventColumn=box(.15,.85,.16,usMetal);ventColumn.position.y=.72;vent.add(ventColumn);
    const ventModule=box(.95,.95,.62,ventBody);ventModule.position.set(0,1.28,0);vent.add(ventModule);
    const ventFace=box(.84,.78,.055,ventDark);ventFace.position.set(0,1.36,.335);vent.add(ventFace);
    const ventScreen=box(.68,.36,.03,screen);ventScreen.position.set(0,1.53,.372);vent.add(ventScreen);
    const ventWave=[];for(let i=0;i<28;i++){
      const phase=i%9,value=phase<3?phase*.045:phase<6?(6-phase)*.045:0;
      ventWave.push(new THREE.Vector3(-.29+i*.022,1.5+value,.393));
    }
    vent.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ventWave),
      new THREE.LineBasicMaterial({color:0x65D8B0})));
    [-.22,0,.22].forEach((x,i)=>{
      const knob=cylinder(.055,.04,material("ventKnob-"+i,i===1?C.yellow:C.blue),14);
      knob.rotation.x=Math.PI/2;knob.position.set(x,1.18,.375);vent.add(knob);
    });
    const outlet=cylinder(.09,.06,ventDark,16);outlet.rotation.x=Math.PI/2;outlet.position.set(.34,1.02,.36);vent.add(outlet);
    const humidifier=cylinder(.14,.34,material("humidifier",0x9FD3D8,{transparent:true,opacity:.72}),16);
    humidifier.position.set(-.38,.88,.05);vent.add(humidifier);
    const ventHandle=box(1.08,.08,.1,ventDark);ventHandle.position.set(0,1.89,-.18);vent.add(ventHandle);
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
    padCable=line(0x606C67);ivLine=line(0x76B7CF);usCable=line(0x56645D);ventCircuit=line(0x8BC7D5);
    padCable.visible=ivLine.visible=usCable.visible=ventCircuit.visible=false;
  }
  function createLights(){
    scene.add(new THREE.HemisphereLight(0xFFFDF4,0x63736A,.68));
    const key=new THREE.DirectionalLight(0xFFF7DF,.72);key.position.set(-5,11,5);
    key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-10;key.shadow.camera.right=10;
    key.shadow.camera.top=8;key.shadow.camera.bottom=-8;scene.add(key);
    const defaultSpots={
      bed:{color:0xFFF3D8,intensity:1.2,position:[.2,6.8,.8],target:[0,1,-.1],angle:.43,penumbra:.72,distance:15,decay:1.35,shadow:true},
      airway:{color:0xDCEFFF,intensity:.78,position:[-2.8,5.7,-2.6],target:[0,1,-1.55],angle:.36,penumbra:.72,distance:15,decay:1.35},
      equipment:{color:0xFFE6C4,intensity:.7,position:[4.8,5.5,-2.2],target:[4.2,.9,-1.2],angle:.5,penumbra:.72,distance:15,decay:1.35}
    };
    const authoredSpots=typeof HLR_ROOM3D_LAYOUT==="object"&&HLR_ROOM3D_LAYOUT.lights||{};
    Object.keys(defaultSpots).forEach(role=>{
      const spec=Object.assign({},defaultSpots[role],authoredSpots[role]||{});
      const color=Array.isArray(spec.color)?new THREE.Color().fromArray(spec.color):spec.color;
      const spot=new THREE.SpotLight(color,spec.intensity,spec.distance,spec.angle,spec.penumbra,spec.decay);
      spot.position.fromArray(spec.position);spot.target.position.fromArray(spec.target);
      if(spec.shadow){
        spot.castShadow=true;spot.shadow.mapSize.set(512,512);spot.shadow.bias=-.0004;
        spot.shadow.camera.near=.5;spot.shadow.camera.far=16;
      }
      scene.add(spot,spot.target);
    });
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
      const cameraData=typeof HLR_ROOM3D_LAYOUT==="object"&&HLR_ROOM3D_LAYOUT.camera;
      if(cameraData){
        camera.position.fromArray(cameraData.position);camera.lookAt(new THREE.Vector3().fromArray(cameraData.target));
      }else{camera.position.set(10.5,14.5,12.5);camera.lookAt(0,.8,0);}
      raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();
      createRoom();createBed();createPatient();createEquipment();
      ["airway_staff","compressor","doctor","nurse_ssk","ambulance","narkos_ssk","surgeon"].forEach(createStaff);
      createDynamicLines();createLights();initPostFX();
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
    const aspect=width/height;
    const frustum=typeof HLR_ROOM3D_LAYOUT==="object"&&HLR_ROOM3D_LAYOUT.camera?HLR_ROOM3D_LAYOUT.camera.frustum:11.2;
    camera.left=-frustum*aspect/2;camera.right=frustum*aspect/2;
    camera.top=frustum/2;camera.bottom=-frustum/2;camera.updateProjectionMatrix();
    if(postFXReady){
      const drawingSize=renderer.getDrawingBufferSize(new THREE.Vector2());
      const bloomWidth=Math.max(1,Math.round(drawingSize.x*.5));
      const bloomHeight=Math.max(1,Math.round(drawingSize.y*.5));
      sceneTarget.setSize(drawingSize.x,drawingSize.y);
      bloomTargetA.setSize(bloomWidth,bloomHeight);bloomTargetB.setSize(bloomWidth,bloomHeight);
      blurMaterial.uniforms.texel.value.set(1/bloomWidth,1/bloomHeight);
    }
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
    patient.updateMatrixWorld(true);
    const chest=patient.localToWorld(new THREE.Vector3(0,.47,-.18));
    const head=patient.localToWorld(new THREE.Vector3(0,.4,-1.65));
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
    if(lucas.visible)piston.position.y=1.61-press*.22;

    if(S.pads){
      const defibPos=objects.defib.localToWorld(new THREE.Vector3(0,1.4,.4));
      const padPos=patient.localToWorld(new THREE.Vector3(.34,.4,.12));
      setLine(padCable,defibPos,padPos,.45);
    }else padCable.visible=false;
    if(S.access){
      const pole=objects.iv_pole.localToWorld(new THREE.Vector3(-.2,2.05,0));
      const access=patient.localToWorld(new THREE.Vector3(1.02,.22,.38));
      setLine(ivLine,pole,access,.65);
    }else ivLine.visible=false;
    if(S.usActive){
      const us=objects.ultrasound.localToWorld(new THREE.Vector3(-.7,1.02,.08));
      const probe=patient.localToWorld(new THREE.Vector3(.48,.37,.15));
      setLine(usCable,us,probe,.3);
      ultrasoundProbe.visible=true;
    }else{usCable.visible=false;ultrasoundProbe.visible=true;}
    if(S.vent){
      const ventilator=objects.ventilator.localToWorld(new THREE.Vector3(.34,1.02,.36));
      const airway=patient.localToWorld(new THREE.Vector3(.25,.44,-1.9));
      setLine(ventCircuit,ventilator,airway,.55);
    }else ventCircuit.visible=false;
  }
  function updateEquipment(){
    objects.iv_pole.visible=!!S.access;
    objects.o2_cyl.visible=!!S.o2Safe;
    defibLamp.material.color.setHex(S.charged?0xFFE168:S.charging?0xFF7A70:0xEEE9D7);
    defibLamp.material.emissive.setHex(S.charged?0xB98700:S.charging?0x8E120A:0);
    defibScreen.material.emissiveIntensity=S.pads?1.35:.35;
    defibChargeButton.material.emissiveIntensity=S.charged?1.8:S.charging?1.15:.35;
    lucasLamp.material.color.setHex(S.comp?0x5CC98A:0xE5B94B);
    lucasLamp.material.emissive.setHex(S.comp?0x174F30:0x6E4B08);
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
      position.setXYZ(i,x,value,.22);
    }
    position.needsUpdate=true;monitorTrace.material.opacity=active?1:.28;monitorTrace.material.transparent=true;
    if(defibTrace){
      const defibPosition=defibTrace.geometry.attributes.position;
      for(let i=0;i<defibPosition.count;i++){
        const x=-.46+i*.021,t=(S.t||0)*2+i*.13;
        let value=0;
        if(active){
          if(rhythm==="VF")value=Math.sin(t*2.7)*.065+Math.sin(t*5.1)*.045;
          else if(rhythm==="asystoli")value=Math.sin(t*.8)*.007;
          else{const p=((t%3)+3)%3;value=p<.18?Math.sin(p/.18*Math.PI)*.12:Math.sin(t)*.01;}
        }
        defibPosition.setXYZ(i,x,1.82+value,.405);
      }
      defibPosition.needsUpdate=true;defibTrace.material.opacity=active?1:.28;
    }
  }
  function renderWithPostFX(){
    if(!postFXReady){renderer.setRenderTarget(null);renderer.render(scene,camera);return;}
    renderer.setRenderTarget(sceneTarget);renderer.clear();renderer.render(scene,camera);

    postQuad.material=brightMaterial;brightMaterial.uniforms.tInput.value=sceneTarget.texture;
    renderer.setRenderTarget(bloomTargetA);renderer.clear();renderer.render(postScene,postCamera);

    postQuad.material=blurMaterial;blurMaterial.uniforms.tInput.value=bloomTargetA.texture;
    blurMaterial.uniforms.direction.value.set(1,0);
    renderer.setRenderTarget(bloomTargetB);renderer.clear();renderer.render(postScene,postCamera);

    blurMaterial.uniforms.tInput.value=bloomTargetB.texture;blurMaterial.uniforms.direction.value.set(0,1);
    renderer.setRenderTarget(bloomTargetA);renderer.clear();renderer.render(postScene,postCamera);

    postQuad.material=compositeMaterial;compositeMaterial.uniforms.tScene.value=sceneTarget.texture;
    compositeMaterial.uniforms.tBloom.value=bloomTargetA.texture;
    renderer.setRenderTarget(null);renderer.render(postScene,postCamera);
  }
  function render(){
    if(!init())return false;
    if(API.failed)return false;
    resize();updateStaff();updatePatient();updateEquipment();updateMonitor();
    const flash=Math.max(0,S.shockFlash||0);
    shockLight.intensity=flash*8;
    clockLight.color.setHex(S.rosc?0x82E39D:0xCDEDDD);
    clockLight.intensity=S.rosc?1.2:.35;
    renderWithPostFX();return true;
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
