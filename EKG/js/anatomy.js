/* ---------- Hjärtats anatomi: elektrisk axel, kärlterritorium, 3D-hjärta ---------- */
/* Alla tre vyerna läser SAMMA profil (Simulator.getProfile()/setOnFrame, se simulator.js)
   som redan driver det synliga 12-avlednings-EKG:t — inga separata/parallella modeller.
   Axeln och territorierna är INTE hårdkodade per tillstånds-id (det skulle missa
   kombinationer och framtida tillstånd), utan härleds ur samma st/qAmpMap/tInvMap/rAmpMap
   som faktiskt ritar vågorna, se qrsNetDeflection/computeTerritoryScores. */

/* ================= Elektrisk axel (frontalplan) ================= */
const AXIS_QRS_WINDOW=[0.15,0.42];   // ungefär Q- till S-vågens utsträckning, se ecgWaves() i ecg-model.js
const AXIS_SAMPLES=60;

// Nettoutslag (arean mot baslinjen) för EN avledning under QRS-fönstret — samma princip
// kliniker använder för att avgöra om en avledning är nettopositiv/negativ, vilket är
// exakt det den klassiska I/aVF-axelberäkningen bygger på.
function qrsNetDeflection(lead,pr){
  const [p0,p1]=AXIS_QRS_WINDOW;
  const dp=(p1-p0)/AXIS_SAMPLES;
  let area=0;
  for(let i=0;i<=AXIS_SAMPLES;i++){
    const p=p0+i*dp;
    const v=ecgSample(lead,p,pr,0);
    area+=v*(i===0||i===AXIS_SAMPLES?0.5:1)*dp;
  }
  return area;
}
function computeQrsAxis(pr){
  const netI=qrsNetDeflection("I",pr), netAVF=qrsNetDeflection("aVF",pr);
  if(Math.abs(netI)<1e-6&&Math.abs(netAVF)<1e-6)return 0;
  return Math.atan2(netAVF,netI)*180/Math.PI;
}
const AXIS_ZONES=[
  {from:-30,to:90,label:"Normal axel",tag:"ok",
    explain:"Hjärtats huvudsakliga depolarisationsriktning ligger inom normalintervallet — stämmer med normal vänsterkammardominans."},
  {from:-90,to:-30,label:"Vänsterställd axel (LAD)",tag:"warn",
    explain:"Ses vid t.ex. vänster fascikelblock (LAFB), inferior infarkt med förlorad nedåtriktad kraft, eller vänsterkammarhypertrofi."},
  {from:90,to:180,label:"Högerställd axel (RAD)",tag:"warn",
    explain:"Ses vid t.ex. höger fascikelblock (LPFB), högerkammarhypertrofi/-belastning (t.ex. lungemboli), eller lateral infarkt."},
  {from:-180,to:-90,label:"Extrem axelavvikelse (\"nordvästlig\")",tag:"bad",
    explain:"Ovanligt och sällan godartat — ses vid t.ex. uttalad hyperkalemi, ventrikulär rytm, eller kombinerade grenblock."}
];
function axisZoneFor(deg){ return AXIS_ZONES.find(z=>deg>=z.from&&deg<z.to)||AXIS_ZONES[3]; }

function drawAxisDiagram(cv,pr){
  const ctx=cv.getContext("2d");
  const W=cv.width,H=cv.height;
  ctx.clearRect(0,0,W,H);
  const cx=W/2,cy=H/2,R=Math.min(W,H)/2-40;
  const rad=d=>d*Math.PI/180;

  AXIS_ZONES.forEach(z=>{
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,R,rad(z.from),rad(z.to));
    ctx.closePath();
    ctx.fillStyle=z.tag==="ok"?"rgba(46,125,50,0.08)":z.tag==="warn"?"rgba(178,90,0,0.08)":"rgba(197,54,43,0.10)";
    ctx.fill();
  });

  ctx.strokeStyle="#DAD6D4";ctx.lineWidth=1;
  Object.keys(ECG_FRONTAL).forEach(lead=>{
    const a=rad(ECG_FRONTAL[lead]);
    ctx.beginPath();
    ctx.moveTo(cx-R*Math.cos(a),cy-R*Math.sin(a));
    ctx.lineTo(cx+R*Math.cos(a),cy+R*Math.sin(a));
    ctx.stroke();
  });
  ctx.font="12px Archivo, sans-serif";ctx.fillStyle="#6B6B6B";ctx.textAlign="center";ctx.textBaseline="middle";
  Object.keys(ECG_FRONTAL).forEach(lead=>{
    const a=rad(ECG_FRONTAL[lead]);
    const lx=cx+(R+16)*Math.cos(a),ly=cy+(R+16)*Math.sin(a);
    ctx.fillText(lead,lx,ly);
  });

  const axisDeg=computeQrsAxis(pr);
  const a=rad(axisDeg);
  const len=R*0.84;
  const ax=cx+len*Math.cos(a),ay=cy+len*Math.sin(a);
  ctx.strokeStyle="#F44336";ctx.lineWidth=3.5;ctx.lineCap="round";
  ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(ax,ay);ctx.stroke();
  const ah=11;
  ctx.beginPath();
  ctx.moveTo(ax,ay);
  ctx.lineTo(ax-ah*Math.cos(a-0.42),ay-ah*Math.sin(a-0.42));
  ctx.lineTo(ax-ah*Math.cos(a+0.42),ay-ah*Math.sin(a+0.42));
  ctx.closePath();ctx.fillStyle="#F44336";ctx.fill();
  ctx.beginPath();ctx.arc(cx,cy,3.5,0,Math.PI*2);ctx.fillStyle="#1C1B1B";ctx.fill();
}
function renderAxisReadout(pr){
  const host=document.getElementById("axisReadout");
  if(!host)return;
  const deg=computeQrsAxis(pr), zone=axisZoneFor(deg);
  host.innerHTML=`
    <div class="axis-deg">${Math.round(deg)}°</div>
    <span class="rs-tag ${zone.tag==="ok"?"ok":zone.tag==="warn"?"warn":"red"}">${zone.label}</span>
    <p class="mini">${zone.explain}</p>
    <p class="mini">Beräknad precis som kliniskt: nettoutslag i avledning I (${Math.round(qrsNetDeflection("I",pr)*100)}) och aVF (${Math.round(qrsNetDeflection("aVF",pr)*100)}) ger vinkeln.</p>`;
}

/* ================= Kärlterritorium (framifrån-vy) ================= */
/* Territorierna härleds INTE per tillstånds-id (skulle missa kombinationer/framtida
   tillstånd) utan direkt ur samma st/qAmpMap/tInvMap/rAmpMap som ritar de synliga
   avledningarna — se leadAbnormality(). ST-höjning väger tyngst (akut skadeström),
   patologisk Q näst tyngst (genomgången transmural skada), T-inversion lättast
   (ospecifik ischemitecken). Posterior härleds separat (spegelbildstecken i V1–V2:
   ST-sänkning + hög R), se posteriorScore(). */
function leadAbnormality(lead,pr){
  const st=(pr.st&&pr.st[lead])||0, q=(pr.qAmpMap&&pr.qAmpMap[lead])||0, tinv=(pr.tInvMap&&pr.tInvMap[lead])||0;
  return Math.min(1, Math.max(0,st)*1.0 + q*0.7 + tinv*0.35);
}
function territoryScore(leads,pr){ return Math.min(1, Math.max(...leads.map(l=>leadAbnormality(l,pr)))); }
function posteriorScore(pr){
  const v1=Math.max(0,-((pr.st&&pr.st.V1)||0))*0.6+((pr.rAmpMap&&pr.rAmpMap.V1)||0)*0.7;
  const v2=Math.max(0,-((pr.st&&pr.st.V2)||0))*0.6+((pr.rAmpMap&&pr.rAmpMap.V2)||0)*0.7;
  return Math.min(1,Math.max(v1,v2));
}
function computeTerritoryScores(pr){
  return {
    septal:{score:territoryScore(["V1","V2"],pr), name:"Septum", vessel:"LAD (proximal)",
      explain:"Kammarskiljeväggen, mellan V1 och V2 — LAD:s septalgrenar."},
    anterior:{score:territoryScore(["V3","V4"],pr), name:"Framvägg", vessel:"LAD",
      explain:"Vänsterkammarens framvägg, V3–V4 — LAD:s huvudstam/diagonalgrenar."},
    lateral:{score:territoryScore(["V5","V6","I","aVL"],pr), name:"Lateral vägg", vessel:"LCx (oftast)",
      explain:"Elektriskt \"tyst\" område ingen avledning ligger direkt över — V5–V6, I, aVL. Lätt att missa."},
    inferior:{score:territoryScore(["II","III","aVF"],pr), name:"Undervägg", vessel:"RCA (~80 %) eller LCx",
      explain:"Diafragmal yta, II/III/aVF — syns bäst underifrån, inte på en ren framifrån-vy."},
    posterior:{score:posteriorScore(pr), name:"Bakvägg", vessel:"RCA eller LCx (posterior gren)",
      explain:"Ingen avledning ser baksidan direkt — spegelbildstecken i V1–V3 (ST-sänkning, hög R) avslöjar den."}
  };
}

const HEART_SVG_NS="http://www.w3.org/2000/svg";
function _svgEl(tag,attrs){ const e=document.createElementNS(HEART_SVG_NS,tag); for(const k in attrs)e.setAttribute(k,attrs[k]); return e; }

// Territorieöverlagen är fasta, ungefärliga anatomiska ZONER (klippta mot hjärtats
// kontur) snarare än perfekt handritade gränser per vägg — samma pragmatiska förenkling
// klassiska "territoriekartor"/bullseye-diagram i läroböcker gör, eftersom en sann
// framifrån-vy ändå inte visar under-/bakväggen direkt (se explain-texterna ovan).
// Koordinater kalibrerade mot images/heart_anterior.png (1232×732, se längst ner i
// filen) — en riktig skärmdump av 3D-modellen i standardvinkel, inte en handritad skiss.
const TERRITORY_ZONES={
  septal:   "M700,150 C715,280 712,470 700,640 C692,665 680,685 665,700 L630,685 C650,540 655,340 645,190 Z",
  anterior: "M715,150 C760,175 800,230 820,310 C840,420 830,560 790,660 C760,700 715,720 665,725 C685,600 692,440 685,290 C682,235 690,185 715,150 Z",
  lateral:  "M830,220 C880,250 915,310 925,380 C935,460 915,540 870,600 C860,540 865,470 855,400 C848,340 838,275 830,220 Z",
  inferior: "M420,600 C480,660 570,700 660,708 C740,700 820,665 875,610 C820,660 730,690 650,690 C560,690 470,655 420,600 Z",
  posterior:"M900,270 C925,310 935,360 928,410 C922,455 900,495 870,520 C895,470 905,410 898,355 C894,320 895,290 900,270 Z"
};
// Territorium -> vilket kärl det tillhör (för legend-text/etiketter, t.ex. "LAD (proximal)")
// — septum/framvägg = LAD, laterala väggen = LCx, undervägg = RCA; bakväggen är genuint
// tvetydig (RCA ELLER LCx beroende på dominans) och märks "overlap". ALLA fyra pekar numera
// på SAMMA röda ton (ATLAS_COLORS.artery/arteryActive) — arteriell färgkodning ska vara
// konsekvent röd (som i en riktig atlas), inte en regnbåge per kärl; vilket kärl det ÄR
// framgår av legendtexten och positionen, inte av nyansen.
const TERRITORY_VESSEL_COLOR={septal:"lad",anterior:"lad",lateral:"lcx",inferior:"rca",posterior:"overlap"};
// Atlasfärgpalett, uppmättad mot originalspecen (given av användaren) för tydligare
// "tecknad"/illustrativ känsla — fortfarande matt (ingen specular, se
// MeshLambertMaterial/MeshBasicMaterial nedan), bara mer distinkt. Samma palett
// återanvänds i 3D-hjärtat.
const ATLAS_COLORS={
  myocard:"#E37272", rvHighlight:"#ED9E92", lvHighlight:"#D55F5F", atria:"#EDB9A4",
  vessel:"#B3D6EE",       // pulmonalis: venös konvention (transporterar syrefattigt blod), inte rödmärkt
  artery:"#D8473D",       // aorta + ALLA tre kransartärer (LAD/RCA/LCx) delar denna
  arteryActive:"#8F160C", // mörkare/mer mättad när territoriet har hög poäng
  gray:"#A8A4A2", grayLight:"#D8D8D8"
};
const TERRITORY_COLORS={lad:ATLAS_COLORS.artery, lcx:ATLAS_COLORS.artery, rca:ATLAS_COLORS.artery, overlap:ATLAS_COLORS.artery};

// Ungefärlig kontur runt hjärtat i fotot (images/heart_anterior.png), bara till för att
// klippa territorieöverlagen så de inte läcker ut över den vita bakgrunden — behöver inte
// vara pixelperfekt, bara tillräckligt generös för att rymma alla fem zonerna ovan.
const TERRITORY_PHOTO_OUTLINE="M300,110 C265,150 275,320 290,470 C300,570 355,660 425,705"
  +" C490,732 585,730 655,722 C755,708 855,645 925,555 C985,470 1005,370 998,270"
  +" C990,175 945,115 895,92 C845,72 800,85 762,108 C700,55 600,50 540,82"
  +" C480,55 400,65 350,88 C325,95 310,100 300,110 Z";

function buildTerritorySvg(svg){
  svg.innerHTML="";
  const defs=_svgEl("defs",{});
  const clip=_svgEl("clipPath",{id:"heartClip"});
  clip.appendChild(_svgEl("path",{d:TERRITORY_PHOTO_OUTLINE}));
  defs.appendChild(clip);
  svg.appendChild(defs);

  // Riktigt foto av 3D-modellen (se images/heart_anterior.png) som bakgrund i stället för
  // handritade former — samma anatomiska data som 3D-hjärtat, bara en fast vinkel.
  svg.appendChild(_svgEl("image",{href:"images/heart_anterior.png",x:0,y:0,width:1232,height:732,preserveAspectRatio:"xMidYMid meet"}));

  // Territorieöverlag: byggs en gång, klippta mot konturen, opaciteten uppdateras per
  // avläst poäng i renderTerritoryMap (ingen omritning av hela SVG:n varje anrop).
  const overlayG=_svgEl("g",{"clip-path":"url(#heartClip)",id:"territoryOverlayG"});
  Object.keys(TERRITORY_ZONES).forEach(key=>{
    const color=TERRITORY_COLORS[TERRITORY_VESSEL_COLOR[key]];
    overlayG.appendChild(_svgEl("path",{d:TERRITORY_ZONES[key],id:"tz-"+key,fill:color,opacity:"0","stroke":color,"stroke-width":"1.5","stroke-opacity":"0"}));
  });
  svg.appendChild(overlayG);
}
let territorySvgBuilt=false;
function renderTerritoryMap(pr){
  const svg=document.getElementById("territorySvg");
  if(!svg)return;
  if(!territorySvgBuilt){ buildTerritorySvg(svg); territorySvgBuilt=true; }
  const scores=computeTerritoryScores(pr);
  Object.keys(scores).forEach(key=>{
    const zoneEl=document.getElementById("tz-"+key);
    if(!zoneEl)return;
    const s=scores[key].score;
    zoneEl.setAttribute("opacity", (0.12+0.68*s).toFixed(2));
    zoneEl.setAttribute("stroke-opacity", s>0.08?"0.7":"0");
  });
  const legend=document.getElementById("territoryLegend");
  if(legend){
    legend.innerHTML=Object.keys(scores).map(key=>{
      const z=scores[key];
      const color=TERRITORY_COLORS[TERRITORY_VESSEL_COLOR[key]];
      return `<div class="territory-legend-item">
        <span class="territory-legend-swatch" style="background:${color};opacity:${(0.35+0.65*z.score).toFixed(2)}"></span>
        <span><b>${z.name}</b> <span class="territory-legend-sub">(${z.vessel})</span><br><span class="territory-legend-sub">${z.explain}</span></span>
        <span class="pct">${Math.round(z.score*100)}%</span>
      </div>`;
    }).join("");
  }
}

/* ================= Bullseye (AHA 17-segment kortaxel) =================
   Samma idé som en nukleärmedicinsk/MR-perfusions-"bullseye" -- 17 myokardsegment i tre
   koncentriska ringar (bas/mellan/apikal) plus apex, sett rakt uppifrån/nerifrån längs
   kammarens kortaxel. Varje segment tillhör ETT kranskärl enligt den vedertagna AHA-
   segment-till-kärl-tilldelningen (Cerqueira 2002) -- ingen ny poängmodell, bara en
   ANNAN geometrisk projektion av precis samma computeVesselScores(pr) som redan färgar
   kranskärlen på 3D-hjärtat. Vinkelkonventionen (topp=anterior, höger=septal, botten=
   inferior, vänster=lateral) är en pedagogisk förenkling, inte en certifierad nuklear-
   kardiologisk mall -- syftet är att visuellt koppla ischemiträdet till "vilket snitt
   genom hjärtat påverkas", inte att ersätta en riktig perfusionsundersökning. */
const AHA17=[
  {n:1,ring:"basal",vessel:"lad",a0:-30,a1:30,label:"Basal anterior"},
  {n:2,ring:"basal",vessel:"lad",a0:30,a1:90,label:"Basal anteroseptal"},
  {n:3,ring:"basal",vessel:"rca",a0:90,a1:150,label:"Basal inferoseptal"},
  {n:4,ring:"basal",vessel:"rca",a0:150,a1:210,label:"Basal inferior"},
  {n:5,ring:"basal",vessel:"lcx",a0:210,a1:270,label:"Basal inferolateral"},
  {n:6,ring:"basal",vessel:"lcx",a0:270,a1:330,label:"Basal anterolateral"},
  {n:7,ring:"mid",vessel:"lad",a0:-30,a1:30,label:"Mellan anterior"},
  {n:8,ring:"mid",vessel:"lad",a0:30,a1:90,label:"Mellan anteroseptal"},
  {n:9,ring:"mid",vessel:"rca",a0:90,a1:150,label:"Mellan inferoseptal"},
  {n:10,ring:"mid",vessel:"rca",a0:150,a1:210,label:"Mellan inferior"},
  {n:11,ring:"mid",vessel:"lcx",a0:210,a1:270,label:"Mellan inferolateral"},
  {n:12,ring:"mid",vessel:"lcx",a0:270,a1:330,label:"Mellan anterolateral"},
  {n:13,ring:"apical",vessel:"lad",a0:-45,a1:45,label:"Apikal anterior"},
  {n:14,ring:"apical",vessel:"lad",a0:45,a1:135,label:"Apikal septal"},
  {n:15,ring:"apical",vessel:"rca",a0:135,a1:225,label:"Apikal inferior"},
  {n:16,ring:"apical",vessel:"lcx",a0:225,a1:315,label:"Apikal lateral"}
];
const AHA_RING_R={basal:[90,130], mid:[55,90], apical:[20,55]};
const AHA_VESSEL_NAMES={lad:"LAD (fram/septum)", rca:"RCA (undervägg)", lcx:"LCx (lateral vägg)"};
function _polarPt(cx,cy,r,deg){
  const rad=deg*Math.PI/180;
  return [cx+r*Math.sin(rad), cy-r*Math.cos(rad)];
}
function _annularSectorPath(cx,cy,rOuter,rInner,a0,a1){
  const [x0o,y0o]=_polarPt(cx,cy,rOuter,a0), [x1o,y1o]=_polarPt(cx,cy,rOuter,a1);
  const [x1i,y1i]=_polarPt(cx,cy,rInner,a1), [x0i,y0i]=_polarPt(cx,cy,rInner,a0);
  const largeArc=(a1-a0)>180?1:0;
  return `M${x0o.toFixed(2)},${y0o.toFixed(2)} A${rOuter},${rOuter} 0 ${largeArc} 1 ${x1o.toFixed(2)},${y1o.toFixed(2)} `+
         `L${x1i.toFixed(2)},${y1i.toFixed(2)} A${rInner},${rInner} 0 ${largeArc} 0 ${x0i.toFixed(2)},${y0i.toFixed(2)} Z`;
}
let bullseyeSvgBuilt=false;
function buildBullseyeSvg(svg){
  while(svg.firstChild) svg.removeChild(svg.firstChild);
  const cx=150,cy=150;
  AHA17.forEach(seg=>{
    const [rInner,rOuter]=AHA_RING_R[seg.ring];
    const d=_annularSectorPath(cx,cy,rOuter,rInner,seg.a0,seg.a1);
    svg.appendChild(_svgEl("path",{d,id:"bs-"+seg.n,fill:ATLAS_COLORS.artery,opacity:"0.12",stroke:"#fff","stroke-width":"1.5"}));
  });
  svg.appendChild(_svgEl("circle",{cx,cy,r:AHA_RING_R.apical[0],id:"bs-17",fill:ATLAS_COLORS.artery,opacity:"0.12",stroke:"#fff","stroke-width":"1.5"}));
  svg.appendChild(_svgEl("circle",{cx,cy,r:AHA_RING_R.basal[1],fill:"none",stroke:"#C7C2BF","stroke-width":"2"}));
}
function renderBullseye(pr){
  const svg=document.getElementById("bullseyeSvg");
  if(!svg)return;
  if(!bullseyeSvgBuilt){ buildBullseyeSvg(svg); bullseyeSvgBuilt=true; }
  const vs=computeVesselScores(pr);
  AHA17.forEach(seg=>{
    const el=document.getElementById("bs-"+seg.n);
    if(el) el.setAttribute("opacity",(0.12+0.78*vs[seg.vessel]).toFixed(2));
  });
  const apexEl=document.getElementById("bs-17");
  if(apexEl) apexEl.setAttribute("opacity",(0.12+0.78*vs.lad).toFixed(2));
  const legend=document.getElementById("bullseyeLegend");
  if(legend){
    legend.innerHTML=Object.keys(vs).map(k=>`
      <div class="territory-legend-item">
        <span class="territory-legend-swatch" style="background:${ATLAS_COLORS.artery};opacity:${(0.35+0.65*vs[k]).toFixed(2)}"></span>
        <span><b>${AHA_VESSEL_NAMES[k]}</b></span>
        <span class="pct">${Math.round(vs[k]*100)}%</span>
      </div>`).join("");
  }
}

/* ================= 3D-hjärta ================= */
/* Riktig anatomisk geometri (BodyParts3D/FMA-datasetet, se EKG/models/heart/ — sammanslagna
   OBJ-filer per kammare/kärl, se sql-liknande merge-scriptet som genererade dem). NIO delar
   laddas asynkront (rv/lv/ra/la/aorta/pulmonary/lad/rca/lcx), centreras/skalas om från sina
   verkliga mm-koordinater till scenens enhetsskala, och färgas enligt atlaspaletten
   (ATLAS_COLORS/TERRITORY_COLORS, delad med 2D-kartan). Kranskärlen (lad/rca/lcx) är
   FAKTISKA kärlmodeller — territorieindelningen (computeTerritoryScores) lyser upp dem
   direkt i stället för att lägga platta "lappar" ovanpå en ungefärlig yta. */
let heart3d = null; // {renderer, scene, camera, group, parts:{}, animId}

const HEART3D_CATEGORIES = ["rv","lv","ra","la","aorta","pulmonary","lad","rca","lcx"];
// Center/skala beräknad en gång ur EKG/models/heart/bounds.json (se merge_heart_obj.py) —
// samma varje sidladdning, ingen anledning att hämta bounds.json bara för det.
const HEART3D_CENTER = new THREE.Vector3(22.06245,-123.84835,1233.615);
const HEART3D_SCALE = 0.034; // ~118 mm största utsträckning -> ~4 enheter, matchar scenens tidigare mått
// Datasetets råa koordinatsystem är INTE scenens Y-upp/Z-mot-kameran — den här rotationen
// (bestämd genom att rendera och jämföra mot en referensbild) mappar om det till
// bas-uppåt/apex-nedåt, RV-framåt.
const HEART3D_ROTATION = new THREE.Euler(-Math.PI/2, 0, Math.PI);
// Extra rättning runt VÄRLDENS y-axel (inte en del av HEART3D_ROTATION-eulern ovan, som
// redan sätter upp/ner-axeln korrekt) — bestämd genom att rotera kameran runt den laddade
// modellen och jämföra mot verklig anatomi (lungvenernas öppningar i vä förmak syns bara
// på BAKSidan, vilket gav facit för vilken vinkel som är framifrån).
const HEART3D_YAW_FIX = Math.PI;

const HEART3D_MATERIALS = {
  rv:{type:"chamber", color:ATLAS_COLORS.rvHighlight},
  lv:{type:"chamber", color:ATLAS_COLORS.lvHighlight},
  ra:{type:"chamber", color:ATLAS_COLORS.atria},
  la:{type:"chamber", color:ATLAS_COLORS.atria},
  aorta:{type:"vessel", color:ATLAS_COLORS.artery},   // aorta: arteriell, samma röda ton som kransartärerna
  pulmonary:{type:"vessel", color:ATLAS_COLORS.vessel},   // pulmonalis: venös konvention, förblir blå
  lad:{type:"coronary", color:ATLAS_COLORS.artery},
  rca:{type:"coronary", color:ATLAS_COLORS.artery},
  lcx:{type:"coronary", color:ATLAS_COLORS.artery}
};

function ensureHeart3D(cv){
  if(heart3d || !cv || !window.THREE) return;
  const renderer = new THREE.WebGLRenderer({canvas:cv, antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.set(0,-0.5,8.6);
  camera.lookAt(0,-0.5,0);

  // Enhetlig "studiobelysning" uppifrån-vänster (atlasstil) — mest ambient, svagt
  // riktat ljus, så rundade ytor inte får en utbränd/glansig ljusfläck (ursprunget hade
  // för starkt riktat ljus, gav en tydlig "flare"-känsla på de välvda kamrarna).
  scene.add(new THREE.AmbientLight(0xffffff,0.88));
  const key = new THREE.DirectionalLight(0xffffff,0.32); key.position.set(-3,5,3); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff,0.16); fill.position.set(2,1,3); scene.add(fill);

  const group = new THREE.Group();
  scene.add(group);

  const parts = {};
  heart3d = {renderer,scene,camera,group,parts,active:false,rotY:0.35,rotX:-0.08,dist:8.6,loaded:false,isolate:null,userIsolate:false};
  applyHeart3DCamera();

  // window.HEART3D_OBJ[cat] är OBJ-textinnehållet, inbäddat via <script>-taggar (se
  // index.html) — parse() körs synkront på strängen, ingen fetch() av lokala filer
  // (blockerad under file://, se filkommentaren högst upp).
  const loader = new THREE.OBJLoader();
  const objs = HEART3D_CATEGORIES.map(cat=>{
    const text = window.HEART3D_OBJ && window.HEART3D_OBJ[cat];
    if(!text){ console.error("heart3d: saknar inbäddad OBJ-data för", cat); return null; }
    try{ return loader.parse(text); }
    catch(e){ console.error("heart3d: kunde inte tolka OBJ för", cat, e); return null; }
  });
  (function applyParts(){
    objs.forEach((obj,i)=>{
      if(!obj)return;
      const cat = HEART3D_CATEGORIES[i];
      const spec = HEART3D_MATERIALS[cat];
      const mat = new THREE.MeshLambertMaterial({color:new THREE.Color(spec.color)});
      let mesh=null;
      obj.traverse(child=>{
        if(child.isMesh){
          child.material = mat;
          mesh = mesh ? mesh : child;
        }
      });
      const wrapper = new THREE.Group();
      wrapper.add(obj);
      obj.position.set(-HEART3D_CENTER.x,-HEART3D_CENTER.y,-HEART3D_CENTER.z);   // centrera de RÅA mm-koordinaterna kring origo, innan skalning/rotation
      wrapper.scale.setScalar(HEART3D_SCALE);
      const baseQuat = new THREE.Quaternion().setFromEuler(HEART3D_ROTATION);
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), HEART3D_YAW_FIX);
      wrapper.quaternion.copy(yawQuat).multiply(baseQuat);
      group.add(wrapper);
      parts[cat] = {object:obj, material:mat, baseColor:new THREE.Color(spec.color)};
    });
    heart3d.loaded = true;
  })();

  let dragging=false, lastX=0, lastY=0;
  cv.addEventListener("pointerdown", e=>{ dragging=true; lastX=e.clientX; lastY=e.clientY; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointerup", ()=>{ dragging=false; });
  cv.addEventListener("pointerleave", ()=>{ dragging=false; });
  cv.addEventListener("pointermove", e=>{
    if(!dragging)return;
    heart3d.rotY += (e.clientX-lastX)*0.008;
    heart3d.rotX = Math.max(-1.1,Math.min(1.1, heart3d.rotX + (e.clientY-lastY)*0.008));
    lastX=e.clientX; lastY=e.clientY;
    applyHeart3DCamera();
  });
  cv.addEventListener("wheel", e=>{
    e.preventDefault();
    heart3d.dist = Math.max(4.5, Math.min(15, heart3d.dist + e.deltaY*0.006));
    applyHeart3DCamera();
  }, {passive:false});

  function resize(){
    const w = cv.clientWidth||420, h = cv.clientHeight||420;
    renderer.setSize(w,h,false);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(cv);
  resize();

  function loop(){
    heart3d.animId = requestAnimationFrame(loop);
    if(heart3d.active) renderer.render(scene,camera);
  }
  loop();
}
function applyHeart3DCamera(){
  if(!heart3d)return;
  const {camera,rotY,rotX,dist} = heart3d;
  camera.position.set(
    dist*Math.sin(rotY)*Math.cos(rotX),
    -0.5+dist*Math.sin(rotX),
    dist*Math.cos(rotY)*Math.cos(rotX)
  );
  camera.lookAt(0,-0.5,0);
}
// Pausar renderloopen när 3D-vyn inte syns (annan undervy vald, panelen ihopfälld, eller
// man bytt EKG-flik) — annars renderas en osynlig WebGL-scen i onödan i bakgrunden.
function setHeart3DActive(v){ if(heart3d) heart3d.active = v; }

// De FEM väggterritorierna (samma som 2D-kartan) mappas ner till TRE kärlpoäng — nu när
// kranskärlen är riktig geometri kan de FÄRGAS DIREKT i stället för att lägga platta
// "lappar" ovanpå en ungefärlig yta. Bakväggens poäng (genuint tvetydig RCA/LCx) räknas
// in i BÅDA med reducerad vikt. Alla tre kärlen delar SAMMA "aktiv"-röd (ATLAS_COLORS.
// arteryActive) — vilket kärl som är drabbat framgår av VILKET rör som mörknar, inte av
// en egen kulör per kärl.
const VESSEL_ACTIVE_COLOR={lad:ATLAS_COLORS.arteryActive, rca:ATLAS_COLORS.arteryActive, lcx:ATLAS_COLORS.arteryActive};
// Kamrarna (väggens muskelmassa) får också en mildare version av samma "påverkad"-färgning
// — LV representerar 4 av 5 väggterritorier direkt, RV får en svagare andel (RCA/posterior
// försörjer delvis höger kammare också). Ingen sub-regionsprecision (LV är EN sammanslagen
// mesh) men kombinerat med det riktiga kärlets färg ger det ändå en tydlig "här är problemet"-
// signal, inte bara en isolerad linje.
const CHAMBER_ACTIVE_COLOR={lv:ATLAS_COLORS.arteryActive, rv:ATLAS_COLORS.arteryActive};
function computeVesselScores(pr){
  const s=computeTerritoryScores(pr);
  return {
    lad: Math.max(s.septal.score, s.anterior.score),
    lcx: Math.max(s.lateral.score, s.posterior.score*0.6),
    rca: Math.max(s.inferior.score, s.posterior.score*0.6)
  };
}
function computeChamberScores(pr){
  const s=computeTerritoryScores(pr);
  return {
    lv: Math.max(s.septal.score, s.anterior.score, s.lateral.score, s.inferior.score, s.posterior.score*0.7),
    rv: Math.max(s.posterior.score*0.3, s.inferior.score*0.25)
  };
}
// Isolera/gråa ut: klick på en av knapparna (RV/LV/.../LCx) sätter heart3d.isolate till den
// kategorin — alla ANDRA delar blir gråa (låg mättnad) tills "Alla" klickas igen. Byggd som
// ett EFTERFILTER på den redan beräknade "riktiga" färgen (part.currentColor), inte en
// särskild gren, så isolering och tillståndsfärgning aldrig kan hamna i otakt med varandra.
function applyPartColor(part, color, isolateKey, cat){
  if(isolateKey && isolateKey!==cat){
    const hsl={}; color.getHSL(hsl);
    part.material.color.setHSL(hsl.h, hsl.s*0.10, Math.min(0.88, hsl.l*0.85+0.30));
  } else {
    part.material.color.copy(color);
  }
}
function setHeart3DIsolate(key){
  if(!heart3d)return;
  // Manuellt knappklick stänger av auto-fokus (se computeAutoIsolate) permanent -- när
  // användaren väl själv börjat styra isoleringen ska vi aldrig hoppa in och ändra den åt
  // dem igen, inte ens om "Alla" klickas (det är då ett medvetet val att se allt, inte
  // "ingen preferens").
  heart3d.userIsolate = true;
  heart3d.isolate = key||null;
  if(heart3d.lastProfile) updateHeart3D(heart3d.lastProfile);
}
// Auto-fokus: när ETT kärl klart dominerar (typiskt en STEMI-typ) grå ut resten av
// modellen automatiskt, utan att kräva ett manuellt knappklick -- "man ska direkt SE
// vilket område som är drabbat". Rent poängdriven (ingen hårdkodad lista över
// tillstånds-id:n) så det fungerar för alla ischemivarianter med tydlig kärlprofil, inte
// bara STEMI. Vid en genuint tvetydig bild (t.ex. posterior STEMI, som lastar RCA och LCx
// nästan lika mycket -- se computeVesselScores) väljs INGET kärl automatiskt, eftersom
// appen själv beskriver den bilden som elektriskt tvetydig.
function computeAutoIsolate(vesselScores){
  const THRESHOLD=0.12, DOMINANCE=1.4;
  const entries=Object.entries(vesselScores).sort((a,b)=>b[1]-a[1]);
  if(!entries.length || entries[0][1]<THRESHOLD) return null;
  const [topKey,topScore]=entries[0];
  const second=entries[1]?entries[1][1]:0;
  if(second>0 && topScore/second<DOMINANCE) return null;
  return topKey;
}
function syncHeart3DIsolateButtons(key){
  const row=document.getElementById("heart3dIsolate");
  if(!row)return;
  row.querySelectorAll("button").forEach(b=>b.classList.toggle("active",(b.dataset.part||null)===(key||null)));
}
function updateHeart3D(pr){
  if(!heart3d)return;
  heart3d.active = true;
  heart3d.lastProfile = pr;
  if(heart3d.loaded){
    const vesselScores=computeVesselScores(pr);
    const chamberScores=computeChamberScores(pr);
    if(!heart3d.userIsolate){
      const auto=computeAutoIsolate(vesselScores);
      if(auto!==heart3d.isolate){ heart3d.isolate=auto; syncHeart3DIsolateButtons(auto); }
    }
    HEART3D_CATEGORIES.forEach(cat=>{
      const part=heart3d.parts[cat];
      if(!part)return;
      let color=part.baseColor;
      // Kärlen/kamrarna är verklig, tunn anatomisk geometri — en ren linjär lerp mot "aktiv"
      // färg syns dåligt på håll vid måttliga poäng. Kvadratrotsböjd kurva ger en tydligare
      // visuell signal redan vid 30–50 % utan att ändra det underliggande poängvärdet
      // (legenden visar fortfarande den råa procenten).
      if(VESSEL_ACTIVE_COLOR[cat]!=null){
        const boosted=Math.pow(vesselScores[cat],0.5);
        color=part.baseColor.clone().lerp(new THREE.Color(VESSEL_ACTIVE_COLOR[cat]), boosted);
      } else if(CHAMBER_ACTIVE_COLOR[cat]!=null){
        const boosted=Math.pow(chamberScores[cat],0.6)*0.75;   // mildare tak än kärlen — väggen ska stödja kärlfärgen, inte överrösta den
        color=part.baseColor.clone().lerp(new THREE.Color(CHAMBER_ACTIVE_COLOR[cat]), boosted);
      }
      part.currentColor=color;
      applyPartColor(part, color, heart3d.isolate, cat);
    });
  }
  const scores = computeTerritoryScores(pr);
  const legend=document.getElementById("heart3dLegend");
  if(legend){
    legend.innerHTML=Object.keys(scores).map(key=>{
      const z=scores[key];
      const color=TERRITORY_COLORS[TERRITORY_VESSEL_COLOR[key]];
      return `<div class="territory-legend-item" style="border:none;padding:0">
        <span class="territory-legend-swatch" style="background:${color};opacity:${(0.35+0.65*z.score).toFixed(2)}"></span>
        <span><b>${z.name}</b></span><span class="pct">${Math.round(z.score*100)}%</span>
      </div>`;
    }).join("");
  }
}
